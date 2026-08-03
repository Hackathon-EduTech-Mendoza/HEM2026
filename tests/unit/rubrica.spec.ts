import { test, expect } from '@playwright/test';
import {
  CRITERIA,
  MAX_SCORE,
  criteriaFor,
  maxRawScore,
  rawScore,
  weightedScore,
} from '../../src/lib/rubric';

// La rúbrica depende de la fase: en preclasificación no hay pitch, así que ese
// criterio no se puntúa y su peso se reparte entre los otros cinco. El puntaje
// oficial es el ponderado sobre 100, así que un peso mal cargado mueve el
// ranking sin que nada falle a la vista.

test.describe('criteriaFor', () => {
  test('preclasificación tiene 5 criterios y no incluye el pitch', () => {
    const claves = criteriaFor('preclasificacion').map((c) => c.key);
    expect(claves).toHaveLength(5);
    expect(claves).not.toContain('communication');
  });

  test('la final tiene los 6 criterios, con el pitch', () => {
    const claves = criteriaFor('final').map((c) => c.key);
    expect(claves).toHaveLength(6);
    expect(claves).toContain('communication');
  });

  test('preclasificación conserva el orden y los criterios de la final', () => {
    const pre = criteriaFor('preclasificacion').map((c) => c.key);
    const final = criteriaFor('final').map((c) => c.key);
    expect(pre).toEqual(final.filter((k) => k !== 'communication'));
  });

  test('devuelve el peso ya resuelto como número', () => {
    for (const c of [...criteriaFor('preclasificacion'), ...criteriaFor('final')]) {
      expect(typeof c.weight).toBe('number');
      expect(c.weight).toBeGreaterThan(0);
    }
  });
});

test.describe('pesos', () => {
  // Si no suman 1, el ponderado deja de estar sobre 100 y las fases dejan de
  // ser comparables entre sí.
  for (const fase of ['preclasificacion', 'final'] as const) {
    test(`los pesos de ${fase} suman exactamente 1`, () => {
      const suma = criteriaFor(fase).reduce((t, c) => t + c.weight, 0);
      expect(suma).toBeCloseTo(1, 10);
    });
  }

  test('sacar el pitch sube el peso de los otros cinco', () => {
    for (const c of criteriaFor('preclasificacion')) {
      const enFinal = CRITERIA.find((x) => x.key === c.key)!.weights.final!;
      expect(c.weight).toBeGreaterThan(enFinal);
    }
  });

  test('el pitch no se puntúa en preclasificación', () => {
    const pitch = CRITERIA.find((c) => c.key === 'communication')!;
    expect(pitch.weights.preclasificacion).toBeNull();
    expect(pitch.weights.final).toBe(0.15);
  });
});

test.describe('maxRawScore', () => {
  test('preclasificación llega a 25 y la final a 30', () => {
    expect(maxRawScore('preclasificacion')).toBe(25);
    expect(maxRawScore('final')).toBe(30);
  });
});

test.describe('rawScore', () => {
  const todosCinco = {
    problem: 5, solution: 5, innovation: 5, feasibility: 5, impact: 5, communication: 5,
  };

  test('suma solo los criterios de la fase', () => {
    expect(rawScore(todosCinco, 'preclasificacion')).toBe(25);
    expect(rawScore(todosCinco, 'final')).toBe(30);
  });

  test('en preclasificación ignora el pitch aunque venga cargado', () => {
    const sinPitch = { ...todosCinco, communication: undefined as unknown as number };
    expect(rawScore(sinPitch, 'preclasificacion')).toBe(
      rawScore(todosCinco, 'preclasificacion'),
    );
  });

  test('un criterio faltante cuenta como 0, no rompe', () => {
    expect(rawScore({ problem: 4 }, 'preclasificacion')).toBe(4);
  });
});

test.describe('weightedScore', () => {
  test('el puntaje perfecto da 100 en las dos fases', () => {
    const perfecto = {
      problem: 5, solution: 5, innovation: 5, feasibility: 5, impact: 5, communication: 5,
    };
    expect(weightedScore(perfecto, 'preclasificacion')).toBeCloseTo(100, 10);
    expect(weightedScore(perfecto, 'final')).toBeCloseTo(100, 10);
  });

  test('el puntaje mínimo da 20 en las dos fases', () => {
    // Con la escala arrancando en 1, el piso es 1/5 del máximo.
    const minimo = {
      problem: 1, solution: 1, innovation: 1, feasibility: 1, impact: 1, communication: 1,
    };
    expect(weightedScore(minimo, 'preclasificacion')).toBeCloseTo(20, 10);
    expect(weightedScore(minimo, 'final')).toBeCloseTo(20, 10);
  });

  test('en preclasificación el pitch no mueve el puntaje', () => {
    const base = { problem: 4, solution: 3, innovation: 5, feasibility: 4, impact: 3 };
    const conPitch = { ...base, communication: 1 };
    expect(weightedScore(conPitch, 'preclasificacion')).toBeCloseTo(
      weightedScore(base, 'preclasificacion'),
      10,
    );
  });

  test('en la final el pitch sí mueve el puntaje', () => {
    const base = { problem: 4, solution: 4, innovation: 4, feasibility: 4, impact: 4 };
    const conPitchBajo = { ...base, communication: 1 };
    const conPitchAlto = { ...base, communication: 5 };
    expect(weightedScore(conPitchAlto, 'final')).toBeGreaterThan(
      weightedScore(conPitchBajo, 'final'),
    );
  });

  test('coincide con el cálculo manual de los pesos de preclasificación', () => {
    const scores = { problem: 4, solution: 3, innovation: 5, feasibility: 4, impact: 3 };
    const esperado =
      ((4 * 0.18 + 3 * 0.23 + 5 * 0.18 + 4 * 0.23 + 3 * 0.18) / MAX_SCORE) * 100;
    expect(weightedScore(scores, 'preclasificacion')).toBeCloseTo(esperado, 10);
  });
});
