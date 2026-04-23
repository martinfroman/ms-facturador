import request from 'supertest';
import { app } from '../app.js';

describe('Endpoints API', () => {
  describe('GET /health', () => {
    test('responde con status ok', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('env');
    });
  });

  describe('POST /facturar - Validaciones', () => {
    test('retorna 400 si falta cuit', async () => {
      const response = await request(app)
        .post('/facturar')
        .send({
          certPath: '/path/to/cert.crt',
          keyPath: '/path/to/key.key',
          importe: 100
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('cuit');
    });

    test('retorna 400 si falta certPath', async () => {
      const response = await request(app)
        .post('/facturar')
        .send({
          cuit: '20123456789',
          keyPath: '/path/to/key.key',
          importe: 100
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('certPath');
    });

    test('retorna 400 si falta keyPath', async () => {
      const response = await request(app)
        .post('/facturar')
        .send({
          cuit: '20123456789',
          certPath: '/path/to/cert.crt',
          importe: 100
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('keyPath');
    });

    test('retorna 400 si no hay items ni importe', async () => {
      const response = await request(app)
        .post('/facturar')
        .send({
          cuit: '20123456789',
          certPath: '/path/to/cert.crt',
          keyPath: '/path/to/key.key'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('items');
    });

    test('retorna 400 si importe es 0', async () => {
      const response = await request(app)
        .post('/facturar')
        .send({
          cuit: '20123456789',
          certPath: '/path/to/cert.crt',
          keyPath: '/path/to/key.key',
          importe: 0
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('retorna 400 si importe es negativo', async () => {
      const response = await request(app)
        .post('/facturar')
        .send({
          cuit: '20123456789',
          certPath: '/path/to/cert.crt',
          keyPath: '/path/to/key.key',
          importe: -100
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('retorna 400 si items es array vacío', async () => {
      const response = await request(app)
        .post('/facturar')
        .send({
          cuit: '20123456789',
          certPath: '/path/to/cert.crt',
          keyPath: '/path/to/key.key',
          items: []
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /facturar-pdf - Validaciones', () => {
    test('retorna 400 si falta cuit', async () => {
      const response = await request(app)
        .post('/facturar-pdf')
        .send({
          certPath: '/path/to/cert.crt',
          keyPath: '/path/to/key.key',
          importe: 100
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('retorna 400 si no hay items ni importe', async () => {
      const response = await request(app)
        .post('/facturar-pdf')
        .send({
          cuit: '20123456789',
          certPath: '/path/to/cert.crt',
          keyPath: '/path/to/key.key'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /generar-pdf - Validaciones', () => {
    test('retorna 400 si falta factura', async () => {
      const response = await request(app)
        .post('/generar-pdf')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('cae');
    });

    test('retorna 400 si factura no tiene cae', async () => {
      const response = await request(app)
        .post('/generar-pdf')
        .send({
          factura: {
            cbteNro: 1,
            puntoVenta: 5
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('genera PDF correctamente con datos válidos', async () => {
      const response = await request(app)
        .post('/generar-pdf')
        .send({
          factura: {
            cae: '86128613205185',
            caeFchVto: '20260401',
            cbteNro: 1,
            cbteFch: '20260322',
            puntoVenta: 5,
            cbteTipo: 11,
            cuitEmisor: '20286695656',
            importe: 100.00,
            detalle: 'Test',
            docTipo: 99,
            docNro: '0'
          },
          emisor: {
            razonSocial: 'TEST EMISOR',
            domicilio: 'Test Address',
            condicionIVA: 'Monotributo'
          }
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('factura_5_1.pdf');
      expect(response.body).toBeInstanceOf(Buffer);
    });

    test('genera PDF con múltiples items', async () => {
      const response = await request(app)
        .post('/generar-pdf')
        .send({
          factura: {
            cae: '86128613205185',
            caeFchVto: '20260401',
            cbteNro: 2,
            cbteFch: '20260322',
            puntoVenta: 5,
            cbteTipo: 11,
            cuitEmisor: '20286695656',
            importe: 2500.00,
            items: [
              { descripcion: 'Servicio A', cantidad: 1, precioUnitario: 1000 },
              { descripcion: 'Servicio B', cantidad: 2, precioUnitario: 500 },
              { descripcion: 'Servicio C', cantidad: 5, precioUnitario: 100 }
            ],
            docTipo: 99,
            docNro: '0'
          }
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
    });

    test('genera PDF con emisor por defecto si no se proporciona', async () => {
      const response = await request(app)
        .post('/generar-pdf')
        .send({
          factura: {
            cae: '86128613205185',
            caeFchVto: '20260401',
            cbteNro: 1,
            cbteFch: '20260322',
            puntoVenta: 5,
            cbteTipo: 11,
            cuitEmisor: '20286695656',
            importe: 100.00,
            docTipo: 99,
            docNro: '0'
          }
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
    });
  });
});
