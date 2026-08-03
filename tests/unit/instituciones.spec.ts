import { test, expect } from '@playwright/test';
import {
  INSTITUCIONES_SUGERIDAS,
  normalizarInstitucion,
  esInstitucionValida,
} from '../../src/utils/instituciones';

/**
 * Los casos vienen de lo que había cargado de verdad en producción al
 * 2026-08-03, que es lo que motivó el campo asistido.
 */

test.describe('normalizarInstitucion', () => {
  test('colapsa espacios de sobra', () => {
    expect(normalizarInstitucion('  IES   9-010   Rosario  Vera  Peñaloza ')).toBe(
      'IES 9-010 Rosario Vera Peñaloza',
    );
  });

  test('saca las comillas que envuelven todo el valor', () => {
    expect(normalizarInstitucion('"Del Bicentenario"')).toBe('Del Bicentenario');
    expect(normalizarInstitucion('“Rosario Vera Peñaloza”')).toBe('Rosario Vera Peñaloza');
  });

  test('no toca las comillas internas, que son parte del nombre', () => {
    const nombre = 'Instituto Superior N°9030 "Del Bicentenario"';
    // Las de adentro quedan; solo se limpia la del final.
    expect(normalizarInstitucion(nombre)).toBe('Instituto Superior N°9030 "Del Bicentenario');
  });

  test('saca la puntuación colgada al final', () => {
    expect(normalizarInstitucion('LAE Uncuyo,')).toBe('LAE Uncuyo');
    expect(normalizarInstitucion('Universidad de Mendoza.')).toBe('Universidad de Mendoza');
  });

  test('no cambia mayúsculas ni acentos: "IES" no debe volverse "Ies"', () => {
    expect(normalizarInstitucion('IES 9-008 Manuel Belgrano')).toBe('IES 9-008 Manuel Belgrano');
    expect(normalizarInstitucion('SEDE UTN GRACIELA PANE')).toBe('SEDE UTN GRACIELA PANE');
  });

  test('no inventa: "9030" no se convierte en "9-030"', () => {
    expect(normalizarInstitucion('Instituto Bicentenario N°9030')).toBe(
      'Instituto Bicentenario N°9030',
    );
  });

  test('vacío, nulo o solo espacios dan cadena vacía', () => {
    expect(normalizarInstitucion('')).toBe('');
    expect(normalizarInstitucion('   ')).toBe('');
    expect(normalizarInstitucion(null)).toBe('');
    expect(normalizarInstitucion(undefined)).toBe('');
  });
});

test.describe('esInstitucionValida', () => {
  test('rechaza el relleno que había cargado en producción', () => {
    expect(esInstitucionValida('-')).toBe(false);
    expect(esInstitucionValida('A')).toBe(false);
    expect(esInstitucionValida('   ')).toBe(false);
    expect(esInstitucionValida('')).toBe(false);
    expect(esInstitucionValida(null)).toBe(false);
  });

  test('rechaza lo que no tiene letras suficientes', () => {
    expect(esInstitucionValida('---')).toBe(false);
    expect(esInstitucionValida('123')).toBe(false);
    expect(esInstitucionValida('a1')).toBe(false);
  });

  test('acepta siglas y códigos cortos que son reales', () => {
    expect(esInstitucionValida('UTN')).toBe(true);
    expect(esInstitucionValida('JIN 0168')).toBe(true);
    expect(esInstitucionValida('LAE Uncuyo')).toBe(true);
  });

  test('acepta todos los valores legítimos que ya estaban cargados', () => {
    const reales = [
      'IES 9-010 Rosario Vera Peñaloza',
      'IES Manuel Belgrano 9-008',
      'Instituto Bicentenario N°9030',
      'Instituto Superior de Formación Docente y Técnica N°9030 "Del Bicentenario"',
      'San Pedro Nolasco',
      'SEDE UTN GRACIELA PANE',
      'Patagonian Tech',
      'LAE Uncuyo',
      'JIN 0168',
    ];
    for (const nombre of reales) {
      expect(esInstitucionValida(nombre), `"${nombre}" debería ser válida`).toBe(true);
    }
  });

  test('valida sobre el valor normalizado, no sobre lo tipeado', () => {
    // Tres caracteres, pero dos son espacios que se colapsan.
    expect(esInstitucionValida(' A ')).toBe(false);
    expect(esInstitucionValida('  UTN  ')).toBe(true);
  });
});

test.describe('INSTITUCIONES_SUGERIDAS', () => {
  test('no tiene repetidos', () => {
    expect(new Set(INSTITUCIONES_SUGERIDAS).size).toBe(INSTITUCIONES_SUGERIDAS.length);
  });

  test('está ordenada alfabéticamente', () => {
    const ordenada = [...INSTITUCIONES_SUGERIDAS].sort((a, b) => a.localeCompare(b, 'es'));
    expect(INSTITUCIONES_SUGERIDAS).toEqual(ordenada);
  });

  test('cada entrada pasa su propia validación', () => {
    for (const nombre of INSTITUCIONES_SUGERIDAS) {
      expect(esInstitucionValida(nombre), `"${nombre}" no pasa esInstitucionValida`).toBe(true);
      // Si una entrada no estuviera normalizada, elegirla del listado guardaría
      // algo distinto de lo que se ve.
      expect(normalizarInstitucion(nombre), `"${nombre}" no está normalizada`).toBe(nombre);
    }
  });

  test('incluye universidades, no sólo institutos', () => {
    expect(INSTITUCIONES_SUGERIDAS.some((n) => n.startsWith('Universidad'))).toBe(true);
  });

  /**
   * El `<datalist>` filtra por subcadena sobre el valor visible: si la sigla no
   * está escrita ahí, quien tipea "UTN" no ve nada y termina inventando una
   * variante nueva — que es justo el problema que este campo viene a evitar.
   * (Había alguien cargado como "SEDE UTN GRACIELA PANE".)
   */
  test('se puede encontrar por la sigla de uso corriente', () => {
    const buscar = (q: string) =>
      INSTITUCIONES_SUGERIDAS.filter((n) => n.toLowerCase().includes(q.toLowerCase()));

    for (const sigla of ['UTN', 'UNCuyo', 'UMaza', 'UDA', 'IES']) {
      expect(buscar(sigla).length, `buscar "${sigla}" no devuelve nada`).toBeGreaterThan(0);
    }
  });

  test('se puede encontrar un IES por su número', () => {
    const buscar = (q: string) => INSTITUCIONES_SUGERIDAS.filter((n) => n.includes(q));
    expect(buscar('9-010')).toHaveLength(1);
    expect(buscar('9-030')).toHaveLength(1);
  });

  test('no incluye a las dos organizadoras: son opciones fijas del desplegable', () => {
    const texto = INSTITUCIONES_SUGERIDAS.join(' | ');
    expect(texto).not.toContain('9-023');
    expect(texto).not.toContain('Edison');
  });
});
