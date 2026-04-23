import express from 'express';
import { facturar } from './modules/factura/wsfe.js';
import { generarPDF } from './modules/pdf/generator.js';

export const app = express();
app.use(express.json({ limit: '5mb' }));

/**
 * Calcula el importe total a partir de los items
 */
export function calcularImporte(items) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return null;
  }
  return items.reduce((total, item) => {
    const cantidad = item.cantidad || 1;
    const precio = item.precioUnitario || item.precio || 0;
    return total + (cantidad * precio);
  }, 0);
}

/**
 * POST /facturar
 * 
 * Body:
 *   - cuit: CUIT del emisor (sin guiones)
 *   - certificado: Contenido del certificado X.509 (PEM o Base64)
 *   - clavePrivada: Contenido de la clave privada RSA (PEM o Base64)
 *   - items: Array de items con { descripcion, cantidad, precioUnitario }
 *   - importe: (opcional si se envían items) Importe total
 *   - puntoVenta, cbteTipo, docTipo, docNro, etc.
 */
app.post('/facturar', async (req, res) => {
  try {
    const { cuit, certificado, clavePrivada, items, importe, detalle, ...opciones } = req.body;

    if (!cuit || !certificado || !clavePrivada) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos: cuit, certificado, clavePrivada',
      });
    }

    const importeCalculado = calcularImporte(items);
    const importeFinal = importeCalculado ?? importe;

    if (importeFinal == null || importeFinal <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar items[] o importe',
      });
    }

    const detalleFinal = detalle || (items ? items.map(i => i.descripcion).join(', ') : 'Productos/Servicios');

    const resultado = await facturar({
      cuit,
      certificado,
      clavePrivada,
      importe: parseFloat(importeFinal),
      detalle: detalleFinal,
      ...opciones,
    });

    return res.json({
      success: true,
      data: {
        ...resultado,
        items: items || [{ descripcion: detalleFinal, cantidad: 1, precioUnitario: importeFinal }],
        importe: importeFinal,
      },
    });
  } catch (error) {
    const status = error.name === 'AfipError' ? 502 : 500;
    return res.status(status).json({
      success: false,
      error: error.toJSON?.() ?? { message: error.message },
    });
  }
});

/**
 * POST /facturar-pdf
 * 
 * Igual que /facturar pero devuelve el PDF directamente
 */
app.post('/facturar-pdf', async (req, res) => {
  try {
    const { cuit, certificado, clavePrivada, items, importe, detalle, emisor, ...opciones } = req.body;

    if (!cuit || !certificado || !clavePrivada) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos: cuit, certificado, clavePrivada',
      });
    }

    const importeCalculado = calcularImporte(items);
    const importeFinal = importeCalculado ?? importe;

    if (importeFinal == null || importeFinal <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar items[] o importe',
      });
    }

    const detalleFinal = detalle || (items ? items.map(i => i.descripcion).join(', ') : 'Productos/Servicios');
    const itemsFinal = items || [{ descripcion: detalleFinal, cantidad: 1, precioUnitario: importeFinal }];

    const resultado = await facturar({
      cuit,
      certificado,
      clavePrivada,
      importe: parseFloat(importeFinal),
      detalle: detalleFinal,
      ...opciones,
    });

    const pdfBuffer = await generarPDF(
      {
        ...resultado,
        cuitEmisor: cuit,
        importe: parseFloat(importeFinal),
        items: itemsFinal,
        docTipo: opciones.docTipo || 99,
        docNro: opciones.docNro || '0',
        moneda: opciones.moneda || 'PES',
        cotizacion: opciones.cotizacion || 1,
      },
      emisor || { razonSocial: 'EMISOR', domicilio: '-', condicionIVA: 'Responsable Monotributo' }
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=factura_${resultado.puntoVenta}_${resultado.cbteNro}.pdf`);
    return res.send(pdfBuffer);
  } catch (error) {
    const status = error.name === 'AfipError' ? 502 : 500;
    return res.status(status).json({
      success: false,
      error: error.toJSON?.() ?? { message: error.message },
    });
  }
});

/**
 * POST /generar-pdf
 */
app.post('/generar-pdf', async (req, res) => {
  try {
    const { factura, emisor } = req.body;

    if (!factura || !factura.cae) {
      return res.status(400).json({
        success: false,
        error: 'Faltan datos de la factura (cae, cuitEmisor, etc.)',
      });
    }

    const pdfBuffer = await generarPDF(
      factura,
      emisor || { razonSocial: 'EMISOR', domicilio: '-', condicionIVA: 'Responsable Monotributo' }
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=factura_${factura.puntoVenta}_${factura.cbteNro}.pdf`);
    return res.send(pdfBuffer);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: process.env.AFIP_ENV || 'homologacion' });
});
