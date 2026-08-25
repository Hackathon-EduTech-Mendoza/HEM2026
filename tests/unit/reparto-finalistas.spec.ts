import { test, expect } from '@playwright/test';
import { repartirPorGrupo, describirReparto } from '../../src/utils/reparto-finalistas';

/**
 * Esta función decide quién pasa a la ronda final. No se verifica a ojo el
 * sábado a la tarde con el jurado esperando, así que los casos borde de acá no
 * son teóricos: un grupo que recibe más finalistas que proyectos tiene, o un
 * reparto que cambia entre dos clicks, es una discusión con los docentes.
 */

/** Azúcar para leer los casos como se piensan: `{ '1': 16, '2': 16 }`. */
const mapa = (o: Record<string, number>) => new Map(Object.entries(o));
const plano = (m: Map<string, number>) => Object.fromEntries(m);

const suma = (m: Map<string, number>) =>
  Array.from(m.values()).reduce((a, b) => a + b, 0);

test.describe('repartirPorGrupo — casos del evento', () => {
  test('3 grupos parejos reparten 10 como 4/3/3', () => {
    const cupos = repartirPorGrupo(mapa({ '1': 16, '2': 16, '3': 16 }), 10);
    expect(suma(cupos)).toBe(10);
    // Con todo empatado, el desempate por nombre de grupo le da el extra al G1.
    expect(plano(cupos)).toEqual({ '1': 4, '2': 3, '3': 3 });
  });

  /** El escenario medido en dev: es el que motivó todo esto. */
  test('2 tríos con 24 proyectos cada uno reparten 5 y 5', () => {
    const cupos = repartirPorGrupo(mapa({ '1': 24, '2': 24 }), 10);
    expect(plano(cupos)).toEqual({ '1': 5, '2': 5 });
  });

  test('grupos desparejos reparten en proporción, no en partes iguales', () => {
    const cupos = repartirPorGrupo(mapa({ '1': 30, '2': 12, '3': 6 }), 10);
    expect(suma(cupos)).toBe(10);
    // 30/48, 12/48 y 6/48 de 10 → 6,25 · 2,5 · 1,25
    expect(plano(cupos)).toEqual({ '1': 6, '2': 3, '3': 1 });
  });

  /**
   * Los proyectos sin grupo los evaluó el jurado completo. Entran como una
   * bolsa más y no necesitan ningún caso especial.
   */
  test('la bolsa "todos" participa del reparto como una más', () => {
    const cupos = repartirPorGrupo(mapa({ '1': 20, '2': 20, todos: 10 }), 10);
    expect(suma(cupos)).toBe(10);
    expect(plano(cupos)).toEqual({ '1': 4, '2': 4, todos: 2 });
  });

  test('si no hay proyectos sin grupo, la bolsa "todos" ni aparece', () => {
    const cupos = repartirPorGrupo(mapa({ '1': 24, '2': 24, todos: 0 }), 10);
    expect(cupos.get('todos')).toBe(0);
    expect(suma(cupos)).toBe(10);
  });
});

test.describe('repartirPorGrupo — el tope por grupo', () => {
  /**
   * Sin tope, la proporción le daría 2 lugares a un grupo con 1 solo proyecto y
   * se marcarían checkboxes que no existen.
   */
  test('ningún grupo recibe más lugares que proyectos tiene', () => {
    const cupos = repartirPorGrupo(mapa({ '1': 40, '2': 1 }), 10);
    expect(cupos.get('2')).toBeLessThanOrEqual(1);
    expect(suma(cupos)).toBe(10);
  });

  /**
   * ⚠️ Consecuencia deliberada del reparto proporcional: un grupo con 1 proyecto
   * de 41 se gana 0,24 lugares, o sea ninguno. No es un bug — es lo que
   * significa "proporcional" — pero es la razón por la que conviene repartir los
   * proyectos parejo antes de encender la división, y por la que las tildes
   * siguen siendo editables a mano.
   */
  test('un grupo desproporcionadamente chico puede quedarse sin lugares', () => {
    const cupos = repartirPorGrupo(mapa({ '1': 20, '2': 20, '3': 1 }), 10);
    expect(cupos.get('3')).toBe(0);
    expect(suma(cupos)).toBe(10);
    expect((cupos.get('1') ?? 0) + (cupos.get('2') ?? 0)).toBe(10);
  });

  test('con los grupos parejos nadie se queda afuera del reparto', () => {
    const cupos = repartirPorGrupo(mapa({ '1': 16, '2': 16, '3': 16 }), 10);
    expect(Array.from(cupos.values()).every((n) => n > 0)).toBe(true);
  });

  test('con menos proyectos que cupo se reparten todos y no se inventa ninguno', () => {
    const cupos = repartirPorGrupo(mapa({ '1': 3, '2': 2 }), 10);
    expect(plano(cupos)).toEqual({ '1': 3, '2': 2 });
    expect(suma(cupos)).toBe(5);
  });
});

test.describe('repartirPorGrupo — invariantes', () => {
  test('siempre devuelve todas las claves, incluso las que reciben 0', () => {
    const cupos = repartirPorGrupo(mapa({ '1': 48, '2': 0, '3': 0 }), 10);
    expect(Array.from(cupos.keys()).sort()).toEqual(['1', '2', '3']);
    expect(cupos.get('2')).toBe(0);
    expect(cupos.get('3')).toBe(0);
  });

  /** Dos clicks seguidos tienen que marcar exactamente lo mismo. */
  test('el resultado no depende del orden en que vengan los grupos', () => {
    const a = repartirPorGrupo(mapa({ '1': 17, '2': 16, '3': 15 }), 10);
    const b = repartirPorGrupo(mapa({ '3': 15, '1': 17, '2': 16 }), 10);
    expect(plano(a)).toEqual(plano(b));
  });

  test('un solo grupo se lleva todo el cupo', () => {
    expect(plano(repartirPorGrupo(mapa({ '1': 48 }), 10))).toEqual({ '1': 10 });
  });

  test('sin proyectos no reparte nada', () => {
    expect(plano(repartirPorGrupo(mapa({ '1': 0, '2': 0 }), 10))).toEqual({ '1': 0, '2': 0 });
  });

  test('un mapa vacío no explota', () => {
    expect(plano(repartirPorGrupo(new Map(), 10))).toEqual({});
  });

  test('un cupo de 0 o negativo no marca a nadie', () => {
    expect(suma(repartirPorGrupo(mapa({ '1': 20, '2': 20 }), 0))).toBe(0);
    expect(suma(repartirPorGrupo(mapa({ '1': 20, '2': 20 }), -5))).toBe(0);
  });

  /** El cupo sale de `event_config`, que es texto: puede llegar cualquier cosa. */
  test('tamaños raros se normalizan en vez de envenenar la proporción', () => {
    const cupos = repartirPorGrupo(mapa({ '1': 20.7, '2': -3, '3': 10 }), 10);
    expect(suma(cupos)).toBe(10);
    expect(cupos.get('2')).toBe(0);
  });

  /**
   * Barrido: con cualquier combinación, el reparto nunca puede exceder el cupo
   * ni el tamaño de un grupo, y no puede dejar lugares sin usar habiendo dónde.
   */
  test('invariantes sobre muchas combinaciones', () => {
    for (let g1 = 0; g1 <= 20; g1 += 3) {
      for (let g2 = 0; g2 <= 20; g2 += 3) {
        for (let g3 = 0; g3 <= 20; g3 += 3) {
          for (const cupo of [1, 5, 10, 13]) {
            const tamanos = mapa({ '1': g1, '2': g2, '3': g3 });
            const cupos = repartirPorGrupo(tamanos, cupo);
            const total = suma(cupos);

            expect(total).toBeLessThanOrEqual(cupo);
            expect(total).toBe(Math.min(cupo, g1 + g2 + g3));

            tamanos.forEach((n, clave) => {
              expect(cupos.get(clave) ?? 0).toBeLessThanOrEqual(n);
              expect(cupos.get(clave) ?? 0).toBeGreaterThanOrEqual(0);
            });
          }
        }
      }
    }
  });
});

test.describe('describirReparto', () => {
  test('arma el resumen del toast ordenado por grupo', () => {
    expect(describirReparto(mapa({ '2': 3, '1': 4, '3': 3 }))).toBe('G1: 4 · G2: 3 · G3: 3');
  });

  test('la bolsa sin grupo se lee "Todos"', () => {
    expect(describirReparto(mapa({ '1': 4, todos: 2 }))).toBe('G1: 4 · Todos: 2');
  });

  test('un reparto vacío da una cadena vacía', () => {
    expect(describirReparto(new Map())).toBe('');
  });
});
