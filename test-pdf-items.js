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
    importe: 115000.00,
    items: [
      {
        descripcion: 'Desarrollo de módulo de facturación electrónica',
        cantidad: 1,
        precioUnitario: 50000.00
      },
      {
        descripcion: 'Horas de consultoría técnica',
        cantidad: 10,
        precioUnitario: 5000.00
      },
      {
        descripcion: 'Mantenimiento mensual del sistema',
        cantidad: 1,
        precioUnitario: 15000.00
      }
    ],
    docTipo: 99,
    docNro: '0',
    moneda: 'PES',
    cotizacion: 1,
  },
  emisor: {
    razonSocial: 'MARTIN BEATO',
    domicilio: 'Buenos Aires, Argentina',
    condicionIVA: 'Responsable Monotributo',
    iibb: '20286695656',
    inicioActividades: '01/01/2020',
  },
});

console.log('Generando PDF con múltiples items...');

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
      const filename = 'factura_con_items.pdf';
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
