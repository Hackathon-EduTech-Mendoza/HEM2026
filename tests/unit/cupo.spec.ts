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
 * Los dos conteos son la parte que más fácil se rompe: son números distintos
 * que responden preguntas distintas, y confundirlos le niega el lugar a gente
 * que la base sí deja entrar.
 */
test.describe('los dos conteos: cartel vs. lugar real', () => {
  test('el cartel puede decir "completo" y todavía haber lugar real', () => {
    // El caso de prod al 20/08 llevado al límite: 300 registros contando los
    // que no completaron el onboarding, pero solo 257 con perfil completo.
    const cupo = calcularCupo(300, 257, 300);

    expect(cupo.estado).toBe('completo'); // lo que ve el visitante
    expect(cupo.hayLugar).toBe(true); // lo que decide el trigger
  });

  test('el lugar real se agota con los perfiles completos, no con los registros', () => {
    const cupo = calcularCupo(312, 300, 300);
    expect(cupo.hayLugar).toBe(false);
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
