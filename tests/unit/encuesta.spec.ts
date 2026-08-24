import { test, expect } from '@playwright/test';
import {
  MAX_COMENTARIO,
  RESPUESTAS_P3,
  escalaValida,
  validarRespuesta,
} from '../../src/utils/encuesta';

/**
 * La encuesta se responde una sola vez y no hay forma de corregirla después:
 * lo que entra mal queda mal en el promedio que Martín va a usar para armar la
 * edición del año que viene. Los bordes de acá son los que separan un "3
 * inventado" de un "no trabajé con un mentor", que no es lo mismo.
 *
 * ⚠️ Los criterios están duplicados contra los CHECK de la tabla
 * `encuesta_respuestas`. Si cambia uno hay que cambiar el otro.
 */

test.describe('escalaValida', () => {
  test('acepta los cinco enteros de la escala', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      expect(escalaValida(n)).toBe(true);
    }
  });

  test('rechaza lo que está fuera de 1 a 5', () => {
    expect(escalaValida(0)).toBe(false);
    expect(escalaValida(6)).toBe(false);
    expect(escalaValida(-1)).toBe(false);
  });

  test('rechaza los decimales y el string que parece número', () => {
    expect(escalaValida(4.5)).toBe(false);
    expect(escalaValida('4')).toBe(false);
  });

  test('rechaza null, undefined y NaN', () => {
    expect(escalaValida(null)).toBe(false);
    expect(escalaValida(undefined)).toBe(false);
    expect(escalaValida(NaN)).toBe(false);
  });
});

test.describe('validarRespuesta', () => {
  const valida = {
    p1_general: 4,
    p2_mentoria: 5,
    p3_volveria: 'si',
    p4_cambiaria: 'Más tiempo para el pitch.',
  };

  test('el caso normal pasa y devuelve el valor normalizado', () => {
    const r = validarRespuesta(valida);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.p1_general).toBe(4);
      expect(r.valor.p2_mentoria).toBe(5);
      expect(r.valor.p3_volveria).toBe('si');
      expect(r.valor.p4_cambiaria).toBe('Más tiempo para el pitch.');
    }
  });

  test('p2 en null es una respuesta válida: no trabajó con un mentor', () => {
    const r = validarRespuesta({ ...valida, p2_mentoria: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.p2_mentoria).toBeNull();
  });

  test('p2 ausente NO es lo mismo que p2 en null', () => {
    const { p2_mentoria, ...sinP2 } = valida;
    const r = validarRespuesta(sinP2);
    expect(r.ok).toBe(false);
  });

  test('las tres opciones de p3 se aceptan y cualquier otra no', () => {
    for (const opcion of RESPUESTAS_P3) {
      expect(validarRespuesta({ ...valida, p3_volveria: opcion }).ok).toBe(true);
    }
    expect(validarRespuesta({ ...valida, p3_volveria: 'quizas' }).ok).toBe(false);
    expect(validarRespuesta({ ...valida, p3_volveria: 'SI' }).ok).toBe(false);
  });

  test('el comentario es opcional: ausente, null y vacío quedan en null', () => {
    const { p4_cambiaria, ...sinComentario } = valida;
    for (const caso of [
      sinComentario,
      { ...valida, p4_cambiaria: null },
      { ...valida, p4_cambiaria: '' },
      { ...valida, p4_cambiaria: '   ' },
    ]) {
      const r = validarRespuesta(caso);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.valor.p4_cambiaria).toBeNull();
    }
  });

  test('el comentario se recorta antes de guardarse', () => {
    const r = validarRespuesta({ ...valida, p4_cambiaria: '  hay espacios  ' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.p4_cambiaria).toBe('hay espacios');
  });

  test('el comentario justo en el tope entra, y uno más no', () => {
    const alTope = 'a'.repeat(MAX_COMENTARIO);
    expect(validarRespuesta({ ...valida, p4_cambiaria: alTope }).ok).toBe(true);
    expect(validarRespuesta({ ...valida, p4_cambiaria: alTope + 'a' }).ok).toBe(false);
  });

  test('los espacios no cuentan para el tope, porque se recortan antes', () => {
    const conBordes = '  ' + 'a'.repeat(MAX_COMENTARIO) + '  ';
    expect(validarRespuesta({ ...valida, p4_cambiaria: conBordes }).ok).toBe(true);
  });

  test('un cuerpo que no es objeto no rompe', () => {
    for (const basura of [null, undefined, 'texto', 42, true]) {
      expect(validarRespuesta(basura).ok).toBe(false);
    }
  });

  test('un comentario que no es texto se rechaza', () => {
    expect(validarRespuesta({ ...valida, p4_cambiaria: 42 }).ok).toBe(false);
    expect(validarRespuesta({ ...valida, p4_cambiaria: { a: 1 } }).ok).toBe(false);
  });

  test('cada rechazo trae un mensaje para mostrarle a la persona', () => {
    const r = validarRespuesta({ ...valida, p1_general: 9 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });
});
