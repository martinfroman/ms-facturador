import fs from 'fs';
import https from 'https';
import { execSync } from 'child_process';
import os from 'os';
import path from 'path';

const CERT_PATH = 'C:\\Martin\\ARCA\\Homo\\ws-facturacion_73bfee8c0f09f817.crt';
const KEY_PATH = 'C:\\Martin\\ARCA\\Homo\\testing.key';

// Generate TRA XML
function generateTRA(service) {
  const now = new Date();
  const genTime = new Date(now.getTime() - 10 * 60 * 1000);
  const expTime = new Date(now.getTime() + 10 * 60 * 1000);
  
  const formatDate = (d) => d.toISOString().replace('Z', '-00:00');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(now.getTime() / 1000)}</uniqueId>
    <generationTime>${formatDate(genTime)}</generationTime>
    <expirationTime>${formatDate(expTime)}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`;
}

// Sign TRA using OpenSSL (same as Kotlin project fallback)
function signWithOpenSSL(traXml, certPath, keyPath) {
  const tmpDir = os.tmpdir();
  const xmlFile = path.join(tmpDir, `tra_${Date.now()}.xml`);
  const cmsFile = path.join(tmpDir, `tra_${Date.now()}.cms`);
  
  try {
    // Write TRA XML to temp file
    fs.writeFileSync(xmlFile, traXml);
    
    // Sign with OpenSSL: openssl cms -sign -in xml -out cms -signer cert -inkey key -nodetach -outform DER
    const cmd = `openssl cms -sign -in "${xmlFile}" -out "${cmsFile}" -signer "${certPath}" -inkey "${keyPath}" -nodetach -outform DER`;
    console.log('Running:', cmd);
    execSync(cmd, { stdio: 'pipe' });
    
    // Read CMS and convert to base64
    const cmsBytes = fs.readFileSync(cmsFile);
    const base64 = cmsBytes.toString('base64').replace(/\n/g, '').replace(/\r/g, '');
    
    console.log('CMS generated, length:', base64.length);
    return base64;
  } finally {
    // Cleanup
    try { fs.unlinkSync(xmlFile); } catch {}
    try { fs.unlinkSync(cmsFile); } catch {}
  }
}

// Main
const traXml = generateTRA('wsfe');
console.log('TRA XML:');
console.log(traXml);
console.log('---');

const cms = signWithOpenSSL(traXml, CERT_PATH, KEY_PATH);
console.log('CMS Base64:');
console.log(cms);
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

const url = new URL('https://wsaa.afip.gov.ar/ws/services/LoginCms');
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
