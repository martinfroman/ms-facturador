import forge from 'node-forge';

/**
 * Normaliza un string PEM. Si viene como base64 de un PEM completo,
 * lo decodifica. Si ya es PEM directo, lo devuelve tal cual.
 */
function normalizePem(input) {
  if (input.includes('-----BEGIN')) {
    return input;
  }
  return Buffer.from(input, 'base64').toString('utf-8');
}

/**
 * Parsea certificado X.509 y clave privada RSA desde PEM o base64-encoded PEM.
 * Todo en memoria — no toca filesystem.
 */
export function parseCertificateAndKey(certPem, keyPem) {
  const certStr = normalizePem(certPem);
  const keyStr = normalizePem(keyPem);

  const certificate = forge.pki.certificateFromPem(certStr);
  const privateKey = forge.pki.privateKeyFromPem(keyStr);

  return { certificate, privateKey };
}
