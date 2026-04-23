/**
 * Cache en memoria de tokens WSAA.
 * Key = "CUIT:servicio", Value = { token, sign, expiresAt }
 *
 * Los tokens de WSAA duran ~12 horas. Este cache evita re-autenticar en cada request.
 * Para entornos serverless con múltiples instancias, reemplazar por Redis / DynamoDB.
 */
const cache = new Map();

const MARGIN_MS = 5 * 60 * 1000;

export function getCachedToken(cuit, service) {
  const key = `${cuit}:${service}`;
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() >= entry.expiresAt - MARGIN_MS) {
    cache.delete(key);
    return null;
  }

  return { token: entry.token, sign: entry.sign };
}

export function setCachedToken(cuit, service, token, sign, expirationTime) {
  const key = `${cuit}:${service}`;
  cache.set(key, {
    token,
    sign,
    expiresAt: new Date(expirationTime).getTime(),
  });
}
