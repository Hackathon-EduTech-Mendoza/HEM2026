import { test, expect } from '@playwright/test';
import { CUPO_MAXIMO, calcularCupo, mensajeCupo } from '../../src/utils/cupo';

/**
 * El aviso de cupo se muestra en el home a cualquiera que entre, así que los
 * casos borde de acá no son teóricos: un `-3 lugares` o un `103% ocupado` en
 * pantalla es una captura de pantalla dando vueltas por WhatsApp.
 */

test.describe('calcularCupo', () => {
  test('el caso normal reparte bien lugares y porcentaje', () => {
    const cupo = calcularCupo(242, 242, 300);
    expect(cupo.inscriptos).toBe(242);
    expect(cupo.restantes).toBe(58);
    expect(cupo.porcentaje).toBe(81); // 80,67 redondeado
    expect(cupo.estado).toBe('disponible');
  });

  test('a partir del 85% el estado pasa a "ultimos"', () => {
    expect(calcularCupo(254, 254, 300).estado).toBe('disponible'); // 84,67%
    expect(calcularCupo(255, 255, 300).estado).toBe('ultimos'); // 85% justo
    expect(calcularCupo(299, 299, 300).estado).toBe('ultimos');
  });

  test('al llegar al tope el cupo está completo', () => {
    const cupo = calcularCupo(300, 300, 300);
    expect(cupo.estado).toBe('completo');
    expect(cupo.restantes).toBe(0);
    expect(cupo.porcentaje).toBe(100);
  });

  /**
   * Puede pasar de verdad: el trigger tiene una palanca para que el admin dé
   * de alta por encima del tope (una inscripción presencial, un caso puntual),
   * así que el aviso tiene que aguantarlo sin decir disparates.
   */
  test('pasarse del tope no da lugares negativos ni más de 100%', () => {
    const cupo = calcularCupo(312, 312, 300);
    expect(cupo.restantes).toBe(0);
    expect(cupo.porcentaje).toBe(100);
    expect(cupo.estado).toBe('completo');
  });

  test('el cupo vacío no rompe', () => {
    const cupo = calcularCupo(0, 0, 300);
    expect(cupo.restantes).toBe(300);
    expect(cupo.porcentaje).toBe(0);
    expect(cupo.estado).toBe('disponible');
  });

  test('un máximo mal configurado no divide por cero', () => {
    const cupo = calcularCupo(50, 50, 0);
    expect(cupo.porcentaje).toBe(0);
    expect(cupo.restantes).toBe(0);
    expect(cupo.estado).toBe('disponible');
  });

  test('un conteo negativo o roto se trata como cero', () => {
    expect(calcularCupo(-5, -5, 300).inscriptos).toBe(0);
    expect(calcularCupo(12.7, 12.7, 300).inscriptos).toBe(12);
  });

  test('el máximo por defecto es el de la edición', () => {
    expect(calcularCupo(100).maximo).toBe(CUPO_MAXIMO);
  });
});

/**
 * Los dos conteos son la parte que más fácil se rompe. Desde el 24/08 solo uno
 * decide: `inscriptos`. El bug que estos tests fijan ya ocurrió en prod —el
 * sitio anunciaba "cupo completo" con la inscripción todavía abierta— y la
 * forma de reintroducirlo es atar `hayLugar` de nuevo a `efectivos`.
 */
test.describe('los dos conteos: solo `inscriptos` decide', () => {
  /** El caso exacto de prod al 24/08: 305 registros, 255 con perfil completo. */
  test('el registro sin completar también ocupa lugar', () => {
    const cupo = calcularCupo(305, 255, 300);

    expect(cupo.estado).toBe('completo');
    expect(cupo.hayLugar).toBe(false); // ⚠️ antes daba true y por eso entraba gente
    expect(cupo.efectivos).toBe(255); // sigue reportándose, pero no decide
  });

  test('con lugar, el cartel y la puerta dicen lo mismo', () => {
    const cupo = calcularCupo(299, 200, 300);
    expect(cupo.estado).toBe('ultimos');
    expect(cupo.hayLugar).toBe(true);
  });

  /**
   * La regresión concreta: mientras `hayLugar` salía de `efectivos`, este caso
   * daba `true` con el cartel en "completo". Las dos superficies tienen que
   * moverse juntas pase lo que pase con el segundo conteo.
   */
  test('`efectivos` no puede reabrir un cupo que `inscriptos` cerró', () => {
    for (const efectivos of [0, 1, 150, 255, 299]) {
      const cupo = calcularCupo(300, efectivos, 300);
      expect(cupo.hayLugar).toBe(false);
      expect(cupo.estado).toBe('completo');
    }
  });

  test('el borde es el tope justo, no uno más', () => {
    expect(calcularCupo(299, 299, 300).hayLugar).toBe(true);
    expect(calcularCupo(300, 300, 300).hayLugar).toBe(false);
  });

  test('con el cupo apagado (tope 0) siempre hay lugar', () => {
    expect(calcularCupo(500, 500, 0).hayLugar).toBe(true);
  });

  test('sin segundo conteo, ambos números son el mismo', () => {
    const cupo = calcularCupo(242);
    expect(cupo.efectivos).toBe(242);
    expect(cupo.inscriptos).toBe(242);
  });
});

test.describe('mensajeCupo', () => {
  test('el plural es el caso normal', () => {
    expect(mensajeCupo(calcularCupo(242, 242, 300))).toBe('Quedan 58 lugares para participantes');
  });

  /** El singular importa: "Quedan 1 lugares" se lee como un bug. */
  test('con un solo lugar el texto va en singular', () => {
    expect(mensajeCupo(calcularCupo(299, 299, 300))).toBe('Queda 1 lugar para participantes');
  });

  test('completo no habla de lugares restantes', () => {
    expect(mensajeCupo(calcularCupo(300, 300, 300))).toBe('Cupo de participantes completo');
  });
});
