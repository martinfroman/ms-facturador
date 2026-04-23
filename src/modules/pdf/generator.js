import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

const BLUE_HEADER = '#1a5276';
const LIGHT_BLUE = '#d6eaf8';

function generateQRData(factura) {
  const qrData = {
    ver: 1,
    fecha: formatDateQR(factura.cbteFch),
    cuit: parseInt(factura.cuitEmisor),
    ptoVta: factura.puntoVenta,
    tipoCmp: factura.cbteTipo,
    nroCmp: factura.cbteNro,
    importe: factura.importe,
    moneda: factura.moneda || 'PES',
    ctz: factura.cotizacion || 1,
    tipoDocRec: factura.docTipo,
    nroDocRec: parseInt(factura.docNro) || 0,
    tipoCodAut: 'E',
    codAut: parseInt(factura.cae),
  };

  const base64 = Buffer.from(JSON.stringify(qrData)).toString('base64');
  return `https://www.afip.gob.ar/fe/qr/?p=${base64}`;
}

function formatDateQR(dateStr) {
  if (typeof dateStr === 'string' && dateStr.length === 8) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr;
}

function formatDateDisplay(dateStr) {
  if (typeof dateStr === 'string' && dateStr.length === 8) {
    return `${dateStr.slice(6, 8)}/${dateStr.slice(4, 6)}/${dateStr.slice(0, 4)}`;
  }
  return dateStr;
}

function formatCuit(cuit) {
  const c = String(cuit).replace(/\D/g, '');
  if (c.length === 11) {
    return `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}`;
  }
  return c;
}

function formatNumber(num) {
  return num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getTipoComprobanteName(tipo) {
  const tipos = {
    1: 'FACTURA', 2: 'NOTA DE DÉBITO', 3: 'NOTA DE CRÉDITO',
    6: 'FACTURA', 7: 'NOTA DE DÉBITO', 8: 'NOTA DE CRÉDITO',
    11: 'FACTURA', 12: 'NOTA DE DÉBITO', 13: 'NOTA DE CRÉDITO',
  };
  return tipos[tipo] || 'COMPROBANTE';
}

function getTipoComprobanteLetter(tipo) {
  if ([1, 2, 3].includes(tipo)) return 'A';
  if ([6, 7, 8].includes(tipo)) return 'B';
  if ([11, 12, 13].includes(tipo)) return 'C';
  return '?';
}

function getCondicionIVAReceptor(docTipo) {
  if (docTipo === 80) return 'IVA Responsable Inscripto';
  if (docTipo === 99) return 'Consumidor Final';
  return 'Consumidor Final';
}

/**
 * Genera un PDF de factura electrónica argentina - Diseño ARCA oficial
 */
export async function generarPDF(factura, emisor) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const marginLeft = 40;
      const marginRight = 40;
      const pageWidth = doc.page.width - marginLeft - marginRight;
      const centerX = doc.page.width / 2;
      const rightEdge = marginLeft + pageWidth;

      let y = 40;

      // ═══════════════════════════════════════════════════════════════════════
      // BANNER "ORIGINAL"
      // ═══════════════════════════════════════════════════════════════════════
      doc.rect(marginLeft, y, pageWidth, 20).fill(BLUE_HEADER);
      doc.fillColor('white').fontSize(11).font('Helvetica-Bold');
      doc.text('ORIGINAL', marginLeft, y + 5, { width: pageWidth, align: 'center' });
      y += 20;

      // ═══════════════════════════════════════════════════════════════════════
      // ENCABEZADO PRINCIPAL
      // ═══════════════════════════════════════════════════════════════════════
      const headerHeight = 100;
      const letraBoxSize = 40;
      
      // Un solo recuadro grande
      doc.rect(marginLeft, y, pageWidth, headerHeight).stroke('#000');

      // ─── Recuadro de la letra (centro superior) ───
      const letraBoxX = centerX - letraBoxSize / 2;
      const letraBoxY = y + 5;
      
      // Línea vertical desde abajo del recuadro grande hasta el recuadro de la letra
      doc.moveTo(centerX, y + headerHeight).lineTo(centerX, letraBoxY + letraBoxSize).stroke('#000');
      
      // Fondo blanco y borde
      doc.rect(letraBoxX, letraBoxY, letraBoxSize, letraBoxSize).fillAndStroke('#fff', '#000');

      const letra = getTipoComprobanteLetter(factura.cbteTipo);
      doc.fillColor('black').fontSize(28).font('Helvetica-Bold');
      doc.text(letra, letraBoxX, letraBoxY + 6, { width: letraBoxSize, align: 'center' });

      doc.fontSize(7).font('Helvetica');
      doc.text(`COD. ${String(factura.cbteTipo).padStart(3, '0')}`, letraBoxX, letraBoxY + letraBoxSize - 10, { width: letraBoxSize, align: 'center' });

      // ─── Lado izquierdo: Datos del emisor ───
      const leftColX = marginLeft + 8;
      const leftColWidth = centerX - marginLeft - letraBoxSize / 2 - 15;

      doc.fillColor('black').fontSize(10).font('Helvetica-Bold');
      doc.text(emisor.razonSocial || 'RAZÓN SOCIAL', leftColX, y + 8, { width: leftColWidth });

      doc.fontSize(8).font('Helvetica');
      let emisorY = y + 24;
      doc.text(`Razón Social: ${emisor.razonSocial || '-'}`, leftColX, emisorY, { width: leftColWidth });
      emisorY += 13;
      doc.text(`Domicilio Comercial: ${emisor.domicilio || '-'}`, leftColX, emisorY, { width: leftColWidth });
      emisorY += 13;
      doc.text(`Condición frente al IVA: ${emisor.condicionIVA || 'Responsable Monotributo'}`, leftColX, emisorY, { width: leftColWidth });

      // ─── Lado derecho: Datos del comprobante ───
      const rightColX = centerX + letraBoxSize / 2 + 10;
      const rightColWidth = rightEdge - rightColX - 8;

      doc.fontSize(14).font('Helvetica-Bold');
      doc.text(getTipoComprobanteName(factura.cbteTipo), rightColX, y + 8, { width: rightColWidth });

      const pv = String(factura.puntoVenta).padStart(5, '0');
      const nro = String(factura.cbteNro).padStart(8, '0');

      doc.fontSize(8).font('Helvetica');
      let rightY = y + 26;
      doc.text(`Punto de Venta: ${pv}    Comp. Nro: ${nro}`, rightColX, rightY);
      rightY += 11;
      doc.text(`Fecha de Emisión: ${formatDateDisplay(factura.cbteFch)}`, rightColX, rightY);
      rightY += 14;
      doc.text(`CUIT: ${formatCuit(factura.cuitEmisor)}`, rightColX, rightY);
      rightY += 11;
      doc.text(`Ingresos Brutos: ${emisor.iibb || factura.cuitEmisor}`, rightColX, rightY);
      rightY += 11;
      doc.text(`Fecha de Inicio de Actividades: ${emisor.inicioActividades || '01/01/2020'}`, rightColX, rightY);

      y += headerHeight;

      // ═══════════════════════════════════════════════════════════════════════
      // DATOS DEL RECEPTOR
      // ═══════════════════════════════════════════════════════════════════════
      y += 5;
      const receptorHeight = 50;
      doc.rect(marginLeft, y, pageWidth, receptorHeight).stroke('#000');

      const receptorY = y + 8;
      const col1X = marginLeft + 8;
      const col2X = marginLeft + pageWidth / 2 + 10;

      doc.fontSize(8).font('Helvetica');

      // Columna izquierda
      const tipoDocLabel = factura.docTipo === 80 ? 'CUIT' : factura.docTipo === 96 ? 'DNI' : 'Doc';
      const docNroDisplay = factura.docNro === '0' || !factura.docNro ? '-' : 
        (factura.docTipo === 80 ? formatCuit(factura.docNro) : factura.docNro);

      doc.font('Helvetica-Bold').text(`${tipoDocLabel}: `, col1X, receptorY, { continued: true });
      doc.font('Helvetica').text(docNroDisplay);

      doc.font('Helvetica-Bold').text('Apellido y Nombre / Razón Social: ', col1X, receptorY + 12, { continued: true });
      doc.font('Helvetica').text(factura.receptorNombre || (factura.docNro === '0' ? 'CONSUMIDOR FINAL' : '-'));

      doc.font('Helvetica-Bold').text('Condición frente al IVA: ', col1X, receptorY + 24, { continued: true });
      doc.font('Helvetica').text(getCondicionIVAReceptor(factura.docTipo));

      // Columna derecha
      doc.font('Helvetica-Bold').text('Domicilio: ', col2X, receptorY, { continued: true });
      doc.font('Helvetica').text(factura.receptorDomicilio || '-', { width: pageWidth / 2 - 30 });

      doc.font('Helvetica-Bold').text('Condición de venta: ', col2X, receptorY + 24, { continued: true });
      doc.font('Helvetica').text(factura.condicionVenta || 'Contado');

      y += receptorHeight;

      // ═══════════════════════════════════════════════════════════════════════
      // TABLA DE ITEMS
      // ═══════════════════════════════════════════════════════════════════════
      y += 5;
      const tableHeaderHeight = 18;
      const rowHeight = 18;

      // Calcular anchos de columna proporcionales al ancho disponible
      const colWidths = {
        codigo: 35,
        producto: 170,
        cantidad: 50,
        unidad: 55,
        precio: 60,
        bonifPct: 40,
        bonifImp: 45,
        subtotal: 60
      };

      // Posiciones de columnas
      const colCodigo = marginLeft + 3;
      const colProducto = colCodigo + colWidths.codigo;
      const colCantidad = colProducto + colWidths.producto;
      const colUnidad = colCantidad + colWidths.cantidad;
      const colPrecio = colUnidad + colWidths.unidad;
      const colBonifPct = colPrecio + colWidths.precio;
      const colBonifImp = colBonifPct + colWidths.bonifPct;
      const colSubtotal = colBonifImp + colWidths.bonifImp;

      // Header de la tabla
      doc.rect(marginLeft, y, pageWidth, tableHeaderHeight).fill(LIGHT_BLUE).stroke('#000');
      doc.fillColor('black').fontSize(7).font('Helvetica-Bold');

      doc.text('Código', colCodigo, y + 5, { width: colWidths.codigo });
      doc.text('Producto / Servicio', colProducto, y + 5, { width: colWidths.producto });
      doc.text('Cantidad', colCantidad, y + 5, { width: colWidths.cantidad, align: 'right' });
      doc.text('U. Medida', colUnidad + 5, y + 5, { width: colWidths.unidad });
      doc.text('Precio Unit.', colPrecio, y + 5, { width: colWidths.precio, align: 'right' });
      doc.text('% Bonif', colBonifPct, y + 5, { width: colWidths.bonifPct, align: 'right' });
      doc.text('Imp. Bonif', colBonifImp, y + 5, { width: colWidths.bonifImp, align: 'right' });
      doc.text('Subtotal', colSubtotal, y + 5, { width: colWidths.subtotal - 5, align: 'right' });

      y += tableHeaderHeight;

      // Items
      const items = factura.items || [{
        descripcion: factura.detalle || 'Servicios prestados',
        cantidad: 1,
        precioUnitario: factura.importe,
        unidad: 'unidades'
      }];

      items.forEach((item) => {
        const cantidad = item.cantidad || 1;
        const precio = item.precioUnitario || item.precio || 0;
        const subtotal = cantidad * precio;
        const bonifPct = item.bonificacionPct || 0;
        const bonifImp = item.bonificacionImp || 0;

        doc.rect(marginLeft, y, pageWidth, rowHeight).stroke('#ccc');
        doc.fillColor('black').fontSize(7).font('Helvetica');

        doc.text(item.codigo || '', colCodigo, y + 5, { width: colWidths.codigo });
        doc.text(item.descripcion || 'Producto/Servicio', colProducto, y + 5, { width: colWidths.producto });
        doc.text(formatNumber(cantidad), colCantidad, y + 5, { width: colWidths.cantidad, align: 'right' });
        doc.text(item.unidad || 'unidades', colUnidad + 5, y + 5, { width: colWidths.unidad });
        doc.text(formatNumber(precio), colPrecio, y + 5, { width: colWidths.precio, align: 'right' });
        doc.text(formatNumber(bonifPct), colBonifPct, y + 5, { width: colWidths.bonifPct, align: 'right' });
        doc.text(formatNumber(bonifImp), colBonifImp, y + 5, { width: colWidths.bonifImp, align: 'right' });
        doc.text(formatNumber(subtotal), colSubtotal, y + 5, { width: colWidths.subtotal - 5, align: 'right' });

        y += rowHeight;
      });

      // Espacio después de items
      y += 15;

      // ═══════════════════════════════════════════════════════════════════════
      // TOTALES (alineados a la derecha)
      // ═══════════════════════════════════════════════════════════════════════
      const labelWidth = 140;
      const valueWidth = 80;
      const totalsLabelX = rightEdge - labelWidth - valueWidth;
      const totalsValueX = rightEdge - valueWidth;

      doc.fontSize(9).font('Helvetica');

      // Subtotal
      doc.text('Subtotal: $', totalsLabelX, y, { width: labelWidth, align: 'right' });
      doc.text(formatNumber(factura.importe), totalsValueX, y, { width: valueWidth, align: 'right' });
      y += 14;

      // Importe Otros Tributos
      const otrosTributos = factura.impTrib || 0;
      doc.text('Importe Otros Tributos: $', totalsLabelX, y, { width: labelWidth, align: 'right' });
      doc.text(formatNumber(otrosTributos), totalsValueX, y, { width: valueWidth, align: 'right' });
      y += 14;

      // Total
      doc.font('Helvetica-Bold').fontSize(11);
      doc.text('Importe Total: $', totalsLabelX, y, { width: labelWidth, align: 'right' });
      doc.text(formatNumber(factura.importe + otrosTributos), totalsValueX, y, { width: valueWidth, align: 'right' });

      // ═══════════════════════════════════════════════════════════════════════
      // PIE DE PÁGINA - QR, ARCA, CAE
      // ═══════════════════════════════════════════════════════════════════════
      const footerY = doc.page.height - 130;

      // Línea separadora
      doc.moveTo(marginLeft, footerY - 10).lineTo(rightEdge, footerY - 10).stroke('#ccc');

      // QR
      const qrUrl = generateQRData(factura);
      const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 150, margin: 1 });
      const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
      doc.image(qrBuffer, marginLeft, footerY, { width: 80 });

      // ARCA Logo y texto
      const arcaX = marginLeft + 100;
      doc.fillColor(BLUE_HEADER).fontSize(14).font('Helvetica-Bold');
      doc.text('ARCA', arcaX, footerY + 5);
      doc.fillColor('gray').fontSize(6).font('Helvetica');
      doc.text('AGENCIA DE RECAUDACIÓN', arcaX, footerY + 22);
      doc.text('Y CONTROL ADUANERO', arcaX, footerY + 29);

      doc.fillColor(BLUE_HEADER).fontSize(9).font('Helvetica-Bold');
      doc.text('Comprobante Autorizado', arcaX, footerY + 45);

      doc.fillColor('gray').fontSize(6).font('Helvetica');
      doc.text('Esta Agencia no se responsabiliza por los datos ingresados en el detalle de la operación', arcaX, footerY + 60, { width: 200 });

      // Página
      const pageX = centerX + 20;
      doc.fillColor('black').fontSize(9).font('Helvetica');
      doc.text('Pág. 1/1', pageX, footerY + 25);

      // CAE
      const caeX = rightEdge - 150;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text(`CAE N°: ${factura.cae}`, caeX, footerY + 10, { width: 150, align: 'right' });
      doc.text(`Fecha de Vto. de CAE: ${formatDateDisplay(factura.caeFchVto)}`, caeX, footerY + 25, { width: 150, align: 'right' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
