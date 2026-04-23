import http from 'http';
import fs from 'fs';

const body = JSON.stringify({
  factura: {
    cae: '75326213437877',
    caeFchVto: '20250816',
    cbteNro: 134,
    cbteFch: '20250806',
    puntoVenta: 1,
    cbteTipo: 11,
    cuitEmisor: '20286695656',
    importe: 2000000.00,
    items: [
      {
        codigo: '',
        descripcion: 'Servicios prestados',
        cantidad: 1,
        unidad: 'unidades',
        precioUnitario: 2000000.00,
        bonificacionPct: 0,
        bonificacionImp: 0
      }
    ],
    docTipo: 80,
    docNro: '30714851531',
    receptorNombre: 'CLAYER SISTEMAS S.R.L.',
    receptorDomicilio: 'Arcos 2030 Piso:26 Dpto:C - Capital Federal, Ciudad de Buenos Aires',
    condicionVenta: 'Transferencia Bancaria',
    moneda: 'PES',
    cotizacion: 1,
    impTrib: 0
  },
  emisor: {
    razonSocial: 'ROMAN MARTIN FERNANDO',
    domicilio: 'Acoyte 688 Piso:11 Dpto:B - Ciudad de Buenos Aires',
    condicionIVA: 'Responsable Monotributo',
    iibb: '20286695656',
    inicioActividades: '01/09/2019'
  }
});

console.log('Generando PDF con diseño ARCA...');

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
      const filename = 'factura_arca_v6.pdf';
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
