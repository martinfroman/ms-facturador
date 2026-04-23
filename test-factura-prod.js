import http from 'http';

const body = JSON.stringify({
  cuit: '20286695656',
  certPath: 'C:\\Martin\\ARCA\\Homo\\ws-facturacion_73bfee8c0f09f817.crt',
  keyPath: 'C:\\Martin\\ARCA\\Homo\\testing.key',
  importe: 100.00,
  detalle: 'Factura de prueba - Produccion',
  puntoVenta: 5,
  cbteTipo: 11,
  concepto: 1,
  docTipo: 99,
  docNro: '0',
});

console.log('Enviando request de facturación...');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/facturar',
  method: 'POST',
  timeout: 120000,
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

req.setTimeout(120000);
req.on('timeout', () => { console.log('Request timeout'); req.destroy(); });
req.on('error', (e) => console.error('Error:', e.message));
req.write(body);
req.end();
