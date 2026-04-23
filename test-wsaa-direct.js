import fs from 'fs';
import https from 'https';
import forge from 'node-forge';
import { XMLBuilder } from 'fast-xml-parser';

// Load cert and key
const certPem = fs.readFileSync('C:\\Martin\\ARCA\\Homo\\ws-facturacion_73bfee8c0f09f817.crt', 'utf-8');
const keyPem = fs.readFileSync('C:\\Martin\\ARCA\\Homo\\testing.key', 'utf-8');

const certificate = forge.pki.certificateFromPem(certPem);
const privateKey = forge.pki.privateKeyFromPem(keyPem);

// Generate TRA
function generateTRA(service) {
  const now = new Date();
  const genTime = new Date(now.getTime() - 10 * 60 * 1000);
  const expTime = new Date(now.getTime() + 10 * 60 * 1000);
  const formatDate = (d) => d.toISOString().replace('Z', '-00:00');

  const tra = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    loginTicketRequest: {
      '@_version': '1.0',
      header: {
        uniqueId: Math.floor(now.getTime() / 1000),
        generationTime: formatDate(genTime),
        expirationTime: formatDate(expTime),
      },
      service,
    },
  };

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    processEntities: false,
    format: true,
  });

  return builder.build(tra);
}

// Sign TRA with SHA-1
function signTRA(traXml, certificate, privateKey) {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(traXml, 'utf8');
  p7.addCertificate(certificate);
  p7.addSigner({
    key: privateKey,
    certificate,
    digestAlgorithm: forge.pki.oids.sha1,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });

  p7.sign({ detached: false });

  const asn1 = p7.toAsn1();
  const der = forge.asn1.toDer(asn1).getBytes();
  return forge.util.encode64(der);
}

const traXml = generateTRA('wsfe');
console.log('TRA XML:');
console.log(traXml);
console.log('---');

const cms = signTRA(traXml, certificate, privateKey);
console.log('CMS length:', cms.length);
console.log('---');

const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
   <soapenv:Header/>
   <soapenv:Body>
      <wsaa:loginCms xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
         <wsaa:in0>${cms}</wsaa:in0>
      </wsaa:loginCms>
   </soapenv:Body>
</soapenv:Envelope>`;

console.log('Sending SOAP request to WSAA...');

const url = new URL('https://wsaahomo.afip.gov.ar/ws/services/LoginCms');
const options = {
  hostname: url.hostname,
  port: 443,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'text/xml; charset=utf-8',
    'SOAPAction': '"loginCms"',
    'Content-Length': Buffer.byteLength(soapEnvelope),
  },
};

const req = https.request(options, (res) => {
  console.log('Status:', res.statusCode);
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Response:');
    console.log(data);
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(soapEnvelope);
req.end();
