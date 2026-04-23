import { calcularImporte } from '../app.js';

describe('calcularImporte', () => {
  describe('casos válidos', () => {
    test('calcula correctamente con un solo item', () => {
      const items = [
        { descripcion: 'Servicio A', cantidad: 1, precioUnitario: 1000 }
      ];
      expect(calcularImporte(items)).toBe(1000);
    });

    test('calcula correctamente con múltiples items', () => {
      const items = [
        { descripcion: 'Servicio A', cantidad: 1, precioUnitario: 1000 },
        { descripcion: 'Servicio B', cantidad: 2, precioUnitario: 500 },
        { descripcion: 'Servicio C', cantidad: 3, precioUnitario: 100 }
      ];
      // 1000 + (2*500) + (3*100) = 1000 + 1000 + 300 = 2300
      expect(calcularImporte(items)).toBe(2300);
    });

    test('usa cantidad default 1 si no se especifica', () => {
      const items = [
        { descripcion: 'Servicio A', precioUnitario: 1500 }
      ];
      expect(calcularImporte(items)).toBe(1500);
    });

    test('acepta "precio" como alias de "precioUnitario"', () => {
      const items = [
        { descripcion: 'Servicio A', cantidad: 2, precio: 750 }
      ];
      expect(calcularImporte(items)).toBe(1500);
    });

    test('maneja decimales correctamente', () => {
      const items = [
        { descripcion: 'Servicio A', cantidad: 3, precioUnitario: 33.33 }
      ];
      expect(calcularImporte(items)).toBeCloseTo(99.99, 2);
    });

    test('calcula correctamente con cantidades grandes', () => {
      const items = [
        { descripcion: 'Producto', cantidad: 1000, precioUnitario: 50.50 }
      ];
      expect(calcularImporte(items)).toBe(50500);
    });
  });

  describe('casos inválidos', () => {
    test('retorna null si items es null', () => {
      expect(calcularImporte(null)).toBeNull();
    });

    test('retorna null si items es undefined', () => {
      expect(calcularImporte(undefined)).toBeNull();
    });

    test('retorna null si items es un array vacío', () => {
      expect(calcularImporte([])).toBeNull();
    });

    test('retorna null si items no es un array', () => {
      expect(calcularImporte('no es array')).toBeNull();
      expect(calcularImporte(123)).toBeNull();
      expect(calcularImporte({})).toBeNull();
    });

    test('trata precio 0 como válido', () => {
      const items = [
        { descripcion: 'Gratis', cantidad: 1, precioUnitario: 0 }
      ];
      expect(calcularImporte(items)).toBe(0);
    });

    test('trata precio undefined como 0', () => {
      const items = [
        { descripcion: 'Sin precio', cantidad: 1 }
      ];
      expect(calcularImporte(items)).toBe(0);
    });
  });
});
