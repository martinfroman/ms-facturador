import { XMLParser } from 'fast-xml-parser';
import forge from 'node-forge';
import { soapRequest } from '../../soap/client.js';
import { config } from '../../config.js';
import { getCachedToken, setCachedToken } from './tokenCache.js';
import { AfipError } from '../../errors/afipError.js';

// ─── TRA (Ticket de Requerimiento de Acceso) ────────────────────────────────
//
// El TRA es un XML que le indica a WSAA:
//   - uniqueId:        identificador único (timestamp en segundos)
//   - generationTime:  desde cuándo es válido (con margen por clock skew)
//   - expirationTime:  hasta cuándo es válido
//   - service:         webservice al que queremos acceder ("wsfe")
//
// AFIP acepta un desfasaje de hasta 10 minutos en los timestamps.

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

// ─── Firma PKCS#7 (CMS SignedData) usando node-forge ────────────────────────
//
// AFIP requiere que el TRA esté firmado en formato CMS/PKCS#7 SignedData.
// Usamos node-forge (JS puro) para compatibilidad con entornos serverless (Vercel, Lambda, etc).

function signTRA(traXml, certificado, clavePrivada) {
  const certPem = normalizePem(certificado, 'CERTIFICATE');
  const keyPem = normalizePem(clavePrivada, 'RSA PRIVATE KEY');

  const cert = forge.pki.certificateFromPem(certPem);
  const privateKey = forge.pki.privateKeyFromPem(keyPem);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(traXml, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key: privateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });

  p7.sign();

  const asn1 = p7.toAsn1();
  const der = forge.asn1.toDer(asn1);
  return forge.util.encode64(der.getBytes()).replace(/\n/g, '').replace(/\r/g, '');
}

/**
 * Normaliza el contenido PEM (puede venir con o sin headers, en base64 puro, etc.)
 */
function normalizePem(content, type) {
  const trimmed = content.trim();
  
  // Si ya tiene headers PEM, devolverlo tal cual
  if (trimmed.startsWith('-----BEGIN')) {
    return trimmed;
  }
  
  // Si es base64 puro, agregar headers
  const base64Clean = trimmed.replace(/\s/g, '');
  const lines = base64Clean.match(/.{1,64}/g) || [];
  return `-----BEGIN ${type}-----\n${lines.join('\n')}\n-----END ${type}-----`;
}

// ─── LoginCms ────────────────────────────────────────────────────────────────
//
// Envía el CMS firmado al endpoint WSAA y parsea el loginTicketResponse
// para extraer Token y Sign.

async function callLoginCms(cmsBase64) {
  const bodyXml = `<wsaa:loginCms xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
         <wsaa:in0>${cmsBase64}</wsaa:in0>
      </wsaa:loginCms>`;

  const body = await soapRequest(config.wsaaUrl, '"loginCms"', bodyXml);

  const returnXml = body.loginCmsResponse?.loginCmsReturn;
  if (!returnXml) {
    throw new AfipError(
      'WSAA no devolvió loginCmsReturn',
      'WSAA_EMPTY_RESPONSE',
    );
  }

  // loginCmsReturn contiene un XML como string: el loginTicketResponse
  const innerParser = new XMLParser();
  const inner = innerParser.parse(returnXml);

  const credentials = inner?.loginTicketResponse?.credentials;
  if (!credentials?.token || !credentials?.sign) {
    throw new AfipError(
      'WSAA: credentials incompletas en loginTicketResponse',
      'WSAA_BAD_CREDENTIALS',
      inner,
    );
  }

  const expiration = inner?.loginTicketResponse?.header?.expirationTime;

  return {
    token: credentials.token,
    sign: credentials.sign,
    expirationTime: expiration,
  };
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Autentica contra WSAA y devuelve Token + Sign.
 * Usa cache para evitar llamadas redundantes (tokens duran ~12 hs).
 *
 * @param {string} cuit         - CUIT del contribuyente (sin guiones)
 * @param {string} certificado  - Contenido del certificado X.509 (PEM o Base64)
 * @param {string} clavePrivada - Contenido de la clave privada RSA (PEM o Base64)
 * @param {string} service      - Nombre del webservice (default: "wsfe")
 */
export async function authenticate(cuit, certificado, clavePrivada, service = 'wsfe') {
  console.log('[WSAA] Autenticando CUIT:', cuit, '| Servicio:', service);

  const cached = getCachedToken(cuit, service);
  if (cached) {
    console.log('[WSAA] Usando token cacheado');
    return cached;
  }

  console.log('[WSAA] Generando TRA...');
  const traXml = generateTRA(service);
  console.log('[WSAA] TRA generado');

  console.log('[WSAA] Firmando TRA...');
  const cmsBase64 = signTRA(traXml, certificado, clavePrivada);
  console.log('[WSAA] TRA firmado, longitud CMS:', cmsBase64.length);

  console.log('[WSAA] Llamando LoginCms a', config.wsaaUrl);
  const { token, sign, expirationTime } = await callLoginCms(cmsBase64);
  console.log('[WSAA] Token obtenido, expira:', expirationTime);

  setCachedToken(cuit, service, token, sign, expirationTime);

  return { token, sign };
}
