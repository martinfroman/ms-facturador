import { generarPDF } from '../modules/pdf/generator.js';

describe('Generador de PDF', () => {
  const facturaBase = {
    cae: '86128613205185',
    caeFchVto: '20260401',
    cbteNro: 1,
    cbteFch: '20260322',
    puntoVenta: 5,
    cbteTipo: 11,
    cuitEmisor: '20286695656',
    importe: 1000.00,
    docTipo: 99,
    docNro: '0',
    moneda: 'PES',
    cotizacion: 1
  };

  const emisorBase = {
    razonSocial: 'TEST COMPANY',
    domicilio: 'Test Street 123',
    condicionIVA: 'Responsable Monotributo',
    iibb: '20286695656',
    inicioActividades: '01/01/2020'
  };

  describe('Generación básica', () => {
    test('genera un buffer de PDF válido', async () => {
      const pdf = await generarPDF(facturaBase, emisorBase);
      
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
      // Los PDFs comienzan con %PDF
      expect(pdf.toString('utf-8', 0, 4)).toBe('%PDF');
    });

    test('genera PDF con detalle simple', async () => {
      const factura = {
        ...facturaBase,
        detalle: 'Servicio de consultoría'
      };

      const pdf = await generarPDF(factura, emisorBase);
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });
  });

  describe('Múltiples items', () => {
    test('genera PDF con un solo item', async () => {
      const factura = {
        ...facturaBase,
        items: [
          { descripcion: 'Servicio único', cantidad: 1, precioUnitario: 1000 }
        ]
      };

      const pdf = await generarPDF(factura, emisorBase);
      expect(pdf).toBeInstanceOf(Buffer);
    });

    test('genera PDF con múltiples items', async () => {
      const factura = {
        ...facturaBase,
        importe: 2500,
        items: [
          { descripcion: 'Desarrollo de software', cantidad: 1, precioUnitario: 1500 },
          { descripcion: 'Horas de consultoría', cantidad: 5, precioUnitario: 100 },
          { descripcion: 'Soporte técnico', cantidad: 2, precioUnitario: 250 }
        ]
      };

      const pdf = await generarPDF(factura, emisorBase);
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    test('genera PDF con muchos items (10+)', async () => {
      const items = Array.from({ length: 15 }, (_, i) => ({
        descripcion: `Producto ${i + 1}`,
        cantidad: i + 1,
        precioUnitario: 100
      }));

      const factura = {
        ...facturaBase,
        importe: items.reduce((sum, item) => sum + item.cantidad * item.precioUnitario, 0),
        items
      };

      const pdf = await generarPDF(factura, emisorBase);
      expect(pdf).toBeInstanceOf(Buffer);
    });
  });

  describe('Tipos de comprobante', () => {
    test.each([
      [1, 'Factura A'],
      [6, 'Factura B'],
      [11, 'Factura C'],
      [3, 'Nota de Crédito A'],
      [8, 'Nota de Crédito B'],
      [13, 'Nota de Crédito C'],
    ])('genera PDF para tipo de comprobante %i (%s)', async (cbteTipo) => {
      const factura = { ...facturaBase, cbteTipo };
      const pdf = await generarPDF(factura, emisorBase);
      expect(pdf).toBeInstanceOf(Buffer);
    });
  });

  describe('Tipos de documento receptor', () => {
    test('genera PDF para Consumidor Final (docTipo 99)', async () => {
      const factura = { ...facturaBase, docTipo: 99, docNro: '0' };
      const pdf = await generarPDF(factura, emisorBase);
      expect(pdf).toBeInstanceOf(Buffer);
    });

    test('genera PDF para CUIT (docTipo 80)', async () => {
      const factura = { ...facturaBase, docTipo: 80, docNro: '30712345678' };
      const pdf = await generarPDF(factura, emisorBase);
      expect(pdf).toBeInstanceOf(Buffer);
    });

    test('genera PDF para DNI (docTipo 96)', async () => {
      const factura = { ...facturaBase, docTipo: 96, docNro: '12345678' };
      const pdf = await generarPDF(factura, emisorBase);
      expect(pdf).toBeInstanceOf(Buffer);
    });
  });

  describe('Emisor', () => {
    test('genera PDF con emisor completo', async () => {
      const emisor = {
        razonSocial: 'EMPRESA TEST S.A.',
        domicilio: 'Av. Corrientes 1234, CABA',
        condicionIVA: 'IVA Responsable Inscripto',
        iibb: '901-123456-7',
        inicioActividades: '15/03/2015'
      };

      const pdf = await generarPDF(facturaBase, emisor);
      expect(pdf).toBeInstanceOf(Buffer);
    });

    test('genera PDF con emisor mínimo', async () => {
      const emisor = {
        razonSocial: 'EMISOR'
      };

      const pdf = await generarPDF(facturaBase, emisor);
      expect(pdf).toBeInstanceOf(Buffer);
    });
  });

  describe('Formatos de fecha', () => {
    test('maneja fecha en formato YYYYMMDD', async () => {
      const factura = {
        ...facturaBase,
        cbteFch: '20260315',
        caeFchVto: '20260325'
      };

      const pdf = await generarPDF(factura, emisorBase);
      expect(pdf).toBeInstanceOf(Buffer);
    });
  });

  describe('Importes', () => {
    test('maneja importes con decimales', async () => {
      const factura = {
        ...facturaBase,
        importe: 1234.56
      };

      const pdf = await generarPDF(factura, emisorBase);
      expect(pdf).toBeInstanceOf(Buffer);
    });

    test('maneja importes grandes', async () => {
      const factura = {
        ...facturaBase,
        importe: 9999999.99
      };

      const pdf = await generarPDF(factura, emisorBase);
      expect(pdf).toBeInstanceOf(Buffer);
    });

    test('maneja importes pequeños', async () => {
      const factura = {
        ...facturaBase,
        importe: 0.01
      };

      const pdf = await generarPDF(factura, emisorBase);
      expect(pdf).toBeInstanceOf(Buffer);
    });
  });

  describe('Código QR', () => {
    test('genera PDF con QR válido', async () => {
      const pdf = await generarPDF(facturaBase, emisorBase);
      expect(pdf).toBeInstanceOf(Buffer);
      // El PDF debe ser más grande que uno sin QR (el QR agrega bytes)
      expect(pdf.length).toBeGreaterThan(3000);
    });
  });
});
