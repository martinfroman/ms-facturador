import { AfipError } from '../errors/afipError.js';

describe('AfipError', () => {
  test('crea error con mensaje, código y detalles', () => {
    const error = new AfipError('Test error', 'TEST_CODE', { foo: 'bar' });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AfipError);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.details).toEqual({ foo: 'bar' });
    expect(error.name).toBe('AfipError');
  });

  test('toJSON devuelve objeto serializable', () => {
    const error = new AfipError('WSFE Error', 'WSFE_001', { campo: 'valor' });
    const json = error.toJSON();

    expect(json).toEqual({
      error: 'AfipError',
      code: 'WSFE_001',
      message: 'WSFE Error',
      details: { campo: 'valor' }
    });
  });

  test('funciona sin detalles', () => {
    const error = new AfipError('Simple error', 'SIMPLE');

    expect(error.message).toBe('Simple error');
    expect(error.code).toBe('SIMPLE');
    expect(error.details).toBeUndefined();
  });

  test('funciona con detalles como array', () => {
    const detalles = [
      { Code: 10016, Msg: 'Punto de venta no habilitado' },
      { Code: 10017, Msg: 'Otro error' }
    ];
    const error = new AfipError('Múltiples errores', 'MULTI', detalles);

    expect(error.details).toEqual(detalles);
    expect(error.toJSON().details).toHaveLength(2);
  });
});
