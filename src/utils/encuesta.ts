// src/utils/encuesta.ts
//
// Validación de la encuesta post evento.
//
// Vive acá y no dentro del endpoint para poder testearla sin levantar el
// servidor ni tocar la base: los tests unitarios corren en CI y los E2E que
// escriben en la base sólo se corren a mano.
//
// ⚠️ Los criterios son los mismos CHECK que tiene la tabla
// `encuesta_respuestas`. Si cambia uno hay que cambiar el otro: acá se falla
// temprano y con un mensaje que la persona entiende, la base es la red final.

/** Las tres respuestas posibles de la pregunta 3. Igual que el CHECK. */
export const RESPUESTAS_P3 = ['si', 'tal_vez', 'no'] as const;

export type RespuestaP3 = (typeof RESPUESTAS_P3)[number];

/** Tope del texto libre. Igual que el CHECK. */
export const MAX_COMENTARIO = 1000;

export interface RespuestaEncuesta {
  p1_general: number;
  /** null es una respuesta real: "no trabajé con un mentor". */
  p2_mentoria: number | null;
  p3_volveria: RespuestaP3;
  p4_cambiaria: string | null;
}

export type ResultadoValidacion =
  | { ok: true; valor: RespuestaEncuesta }
  | { ok: false; error: string };

/** 1 a 5, entero. Ni "4", ni 4.5, ni NaN. */
export function escalaValida(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;
}

/**
 * Valida el cuerpo que manda el formulario.
 *
 * Devuelve el valor ya normalizado (comentario recortado, vacío convertido a
 * null) para que quien la llame escriba directo lo que sale de acá.
 */
export function validarRespuesta(body: unknown): ResultadoValidacion {
  if (body === null || typeof body !== 'object') {
    return { ok: false, error: 'Cuerpo inválido.' };
  }

  const { p1_general, p2_mentoria, p3_volveria, p4_cambiaria } = body as Record<
    string,
    unknown
  >;

  if (!escalaValida(p1_general)) {
    return { ok: false, error: 'Elegí una puntuación para la primera pregunta.' };
  }

  // undefined no vale: significa que el formulario no mandó la pregunta.
  if (p2_mentoria !== null && !escalaValida(p2_mentoria)) {
    return { ok: false, error: 'Elegí una opción para la pregunta de mentoría.' };
  }

  if (
    typeof p3_volveria !== 'string' ||
    !RESPUESTAS_P3.includes(p3_volveria as RespuestaP3)
  ) {
    return { ok: false, error: 'Elegí una opción para la última pregunta.' };
  }

  let comentario: string | null = null;
  if (p4_cambiaria !== undefined && p4_cambiaria !== null) {
    if (typeof p4_cambiaria !== 'string') {
      return { ok: false, error: 'El comentario no es válido.' };
    }
    const limpio = p4_cambiaria.trim();
    if (limpio.length > MAX_COMENTARIO) {
      return {
        ok: false,
        error: `El comentario no puede pasar de ${MAX_COMENTARIO} caracteres.`,
      };
    }
    comentario = limpio === '' ? null : limpio;
  }

  return {
    ok: true,
    valor: {
      p1_general,
      p2_mentoria: p2_mentoria as number | null,
      p3_volveria: p3_volveria as RespuestaP3,
      p4_cambiaria: comentario,
    },
  };
}
