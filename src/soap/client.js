import axios from 'axios';
import https from 'https';
import { XMLParser } from 'fast-xml-parser';

const httpsAgent = new https.Agent({
  ciphers: 'DEFAULT:@SECLEVEL=0',
});

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: true,
  trimValues: true,
});

/**
 * Envía un request SOAP y devuelve el Body parseado.
 *
 * @param {string} url      - Endpoint SOAP
 * @param {string} action   - Valor del header SOAPAction
 * @param {string} bodyXml  - XML interior del <soap:Body> (sin el tag Body en sí)
 * @returns {object} Body parseado de la respuesta SOAP
 */
export async function soapRequest(url, action, bodyXml) {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
   <soapenv:Header/>
   <soapenv:Body>
      ${bodyXml}
   </soapenv:Body>
</soapenv:Envelope>`;

  console.log('[SOAP] POST', url, '| Action:', action);
  console.log('[SOAP] Request body:\n', envelope);
  const start = Date.now();
  
  let data;
  try {
    const response = await axios.post(url, envelope, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: action,
      },
      timeout: 30_000,
      validateStatus: () => true,
      httpsAgent,
    });
    data = response.data;
    console.log('[SOAP] Respuesta en', Date.now() - start, 'ms, status:', response.status);
    
    if (response.status >= 400) {
      console.log('[SOAP] Error response:', data);
    }
  } catch (err) {
    console.error('[SOAP] Request error:', err.message);
    throw err;
  }

  const parsed = parser.parse(data);
  const body = parsed?.Envelope?.Body;
  if (!body) {
    throw new Error('Respuesta SOAP inválida: no se encontró Envelope.Body');
  }

  if (body.Fault) {
    const fault = body.Fault;
    throw new Error(`SOAP Fault: ${fault.faultcode} — ${fault.faultstring}`);
  }

  return body;
}
