import fs from 'fs';
import http from 'http';

const cert = fs.readFileSync('C:\\Martin\\ARCA\\Homo\\ws-facturacion_73bfee8c0f09f817.crt', 'utf-8');
const key = fs.readFileSync('C:\\Martin\\ARCA\\Homo\\testing.key', 'utf-8');

const body = JSON.stringify({
  cuit: '20286695656',
  cert,
  key,
  importe: 100.00,
  detalle: 'Factura de prueba',
  puntoVenta: 5,
  cbteTipo: 11,
  concepto: 1,
  docTipo: 99,
  docNro: '0',
});

console.log('Enviando request...');
console.log('Body length:', body.length);

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/facturar',
  method: 'POST',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
}, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      console.log('Response:', JSON.stringify(JSON.parse(data), null, 2));
    } catch {
      console.log('Response:', data);
    }
  });
});

req.setTimeout(60000);
req.on('timeout', () => { console.log('Request timeout'); req.destroy(); });
req.on('error', (e) => console.error('Error:', e.message));
req.write(body);
req.end();
