import http from 'http';
import fs from 'fs';

const body = JSON.stringify({
  factura: {
    cae: '86128613205185',
    caeFchVto: '20260401',
    cbteNro: 1,
    cbteFch: '20260322',
    puntoVenta: 5,
    cbteTipo: 11,
    cuitEmisor: '20286695656',
    importe: 100.00,
    detalle: 'Factura de prueba - Produccion',
    docTipo: 99,
    docNro: '0',
    moneda: 'PES',
    cotizacion: 1,
  },
  emisor: {
    razonSocial: 'MARTIN RODRIGUEZ',
    domicilio: 'Buenos Aires, Argentina',
    condicionIVA: 'Responsable Monotributo',
    iibb: '20286695656',
    inicioActividades: '01/01/2020',
  },
});

console.log('Generando PDF...');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/generar-pdf',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
}, (res) => {
  if (res.statusCode === 200) {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      const filename = 'factura_5_1.pdf';
      fs.writeFileSync(filename, pdfBuffer);
      console.log(`PDF guardado: ${filename} (${pdfBuffer.length} bytes)`);
    });
  } else {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('Error:', res.statusCode);
      console.log(data);
    });
  }
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(body);
req.end();
