import { config } from '../config.js';

describe('Config', () => {
  test('tiene las propiedades requeridas', () => {
    expect(config).toHaveProperty('env');
    expect(config).toHaveProperty('wsaaUrl');
    expect(config).toHaveProperty('wsfeUrl');
    expect(config).toHaveProperty('wsfeNs');
    expect(config).toHaveProperty('port');
  });

  test('wsaaUrl es una URL válida', () => {
    expect(config.wsaaUrl).toMatch(/^https:\/\//);
    expect(config.wsaaUrl).toContain('afip.gov.ar');
  });

  test('wsfeUrl es una URL válida', () => {
    expect(config.wsfeUrl).toMatch(/^https:\/\//);
    expect(config.wsfeUrl).toContain('afip.gov.ar');
  });

  test('wsfeNs es el namespace correcto', () => {
    expect(config.wsfeNs).toBe('http://ar.gov.afip.dif.FEV1/');
  });

  test('port es un número', () => {
    expect(typeof config.port).toBe('number');
    expect(config.port).toBeGreaterThan(0);
    expect(config.port).toBeLessThan(65536);
  });

  test('env es homologacion o produccion', () => {
    expect(['homologacion', 'produccion']).toContain(config.env);
  });

  describe('URLs por entorno', () => {
    test('homologacion usa URLs de homo', () => {
      if (config.env === 'homologacion') {
        expect(config.wsaaUrl).toContain('homo');
        expect(config.wsfeUrl).toContain('homo');
      }
    });

    test('produccion usa URLs de produccion', () => {
      if (config.env === 'produccion') {
        expect(config.wsaaUrl).not.toContain('homo');
        expect(config.wsfeUrl).not.toContain('homo');
      }
    });
  });
});
