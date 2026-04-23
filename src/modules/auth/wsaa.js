import { XMLParser } from 'fast-xml-parser';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
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

// ─── Firma PKCS#7 (CMS SignedData) usando OpenSSL ───────────────────────────
//
// AFIP requiere que el TRA esté firmado en formato CMS/PKCS#7 SignedData.
// Usamos OpenSSL como proceso externo porque genera firmas 100% compatibles.
//
// Equivalente a:
//   openssl cms -sign -in tra.xml -out tra.cms -signer cert.crt -inkey key.key -nodetach -outform DER

function signTRA(traXml, certificado, clavePrivada) {
  const tmpDir = os.tmpdir();
  const timestamp = Date.now();
  const xmlFile = path.join(tmpDir, `tra_${timestamp}.xml`);
  const cmsFile = path.join(tmpDir, `tra_${timestamp}.cms`);
  const certFile = path.join(tmpDir, `cert_${timestamp}.pem`);
  const keyFile = path.join(tmpDir, `key_${timestamp}.pem`);

  try {
    // Escribir archivos temporales
    fs.writeFileSync(xmlFile, traXml);
    fs.writeFileSync(certFile, normalizePem(certificado, 'CERTIFICATE'));
    fs.writeFileSync(keyFile, normalizePem(clavePrivada, 'RSA PRIVATE KEY'));

    const cmd = `openssl cms -sign -in "${xmlFile}" -out "${cmsFile}" -signer "${certFile}" -inkey "${keyFile}" -nodetach -outform DER`;
    execSync(cmd, { stdio: 'pipe' });

    const cmsBytes = fs.readFileSync(cmsFile);
    return cmsBytes.toString('base64').replace(/\n/g, '').replace(/\r/g, '');
  } finally {
    // Limpiar archivos temporales
    try { fs.unlinkSync(xmlFile); } catch {}
    try { fs.unlinkSync(cmsFile); } catch {}
    try { fs.unlinkSync(certFile); } catch {}
    try { fs.unlinkSync(keyFile); } catch {}
  }
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

  console.log('[WSAA] Firmando TRA con OpenSSL...');
  const cmsBase64 = signTRA(traXml, certificado, clavePrivada);
  console.log('[WSAA] TRA firmado, longitud CMS:', cmsBase64.length);

  console.log('[WSAA] Llamando LoginCms a', config.wsaaUrl);
  const { token, sign, expirationTime } = await callLoginCms(cmsBase64);
  console.log('[WSAA] Token obtenido, expira:', expirationTime);

  setCachedToken(cuit, service, token, sign, expirationTime);

  return { token, sign };
}
