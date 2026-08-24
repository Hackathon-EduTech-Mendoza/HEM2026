// src/utils/cupo.ts
//
// Cupo máximo de participantes de la edición 2026. Por espacio y logística la
// sede no da abasto para más gente, así que la inscripción se cierra al tope.
//
// El cierre es real: el trigger `enforce_max_participants` de la base rechaza
// el alta que pasa el tope, y el cartel es el aviso previo.

/**
 * ⚠️ ESTO ES SOLO EL FALLBACK. El tope que manda es
 * `event_config.max_participants`, que es lo que lee el trigger y lo que mueve
 * la card "Cupo de Participantes" del panel; `api/cupo.ts` lo lee de ahí y solo
 * cae en esta constante si la fila falta o no es un número.
 *
 * O sea: cambiar este valor NO mueve el cupo. Para eso está el panel.
 */
export const CUPO_MAXIMO = 300;

/**
 * A partir de qué porcentaje de ocupación el aviso pasa a tono de urgencia.
 * Por debajo de esto el mensaje es informativo y no conviene alarmar: faltando
 * más de un cuarto de los lugares, un cartel rojo solo mete ruido.
 */
export const UMBRAL_URGENCIA = 0.85;

export type EstadoCupo = 'disponible' | 'ultimos' | 'completo';

/**
 * ⚠️ ACÁ HAY DOS CONTEOS Y SOLO UNO DECIDE.
 *
 * Desde el 2026-08-24 el tope se mide con `inscriptos`: el registro que nunca
 * terminó el onboarding TAMBIÉN ocupa lugar. Es lo que pidió Martín y es lo
 * realista — esa gente completa el perfil el día del evento, ya con el cuerpo
 * adentro de la sede, así que su lugar está tomado desde que se anotó y la
 * logística tiene que contarlo.
 *
 *   inscriptos -> "¿queda lugar?". Es EL número: mueve el cartel y decide
 *                 `hayLugar`. Es exactamente lo que cuenta el trigger
 *                 `enforce_max_participants` en la base.
 *
 *   efectivos  -> cuántos de esos ya completaron el perfil. Informativo: sirve
 *                 para el panel y para dimensionar cuánto onboarding va a
 *                 haber el día D. NO decide nada.
 *
 * ⚠️ Antes `hayLugar` salía de `efectivos` mientras el cartel salía de
 * `inscriptos`, y por eso el sitio anunciaba "completo" con la inscripción
 * todavía abierta. Si volvés a atar `hayLugar` a `efectivos`, vuelve ese
 * agujero.
 */
export interface Cupo {
  /** Participantes contando los registros sin completar. El conteo que manda. */
  inscriptos: number;
  /** Cuántos de esos ya tienen el perfil completo. Solo informativo. */
  efectivos: number;
  maximo: number;
  /** Sobre `inscriptos`. Nunca negativo: si se pasó del tope, quedan 0, no -3. */
  restantes: number;
  /** Entero 0-100 sobre `inscriptos`, para la barra de progreso y el texto. */
  porcentaje: number;
  /** Estado del CARTEL. Deriva de `inscriptos`. */
  estado: EstadoCupo;
  /**
   * Si todavía se puede dar de alta una cuenta de participante. Deriva de
   * `inscriptos`, así que hoy es el negado de `estado === 'completo'`. Se
   * mantiene como campo aparte porque son dos preguntas distintas para quien
   * consume esto: una es qué decir y la otra es qué dejar hacer.
   */
  hayLugar: boolean;
}

/**
 * Traduce los conteos crudos al estado que consume la UI.
 *
 * Se banca que los conteos superen el máximo porque puede pasar de verdad: el
 * trigger tiene una palanca para que el admin dé de alta por encima del tope.
 * En ese caso el cupo se muestra completo y al 100%, nunca al 103% ni con
 * lugares negativos.
 *
 * `efectivos` cae por defecto en `inscriptos` para el caso en que solo se tenga
 * un número.
 */
export function calcularCupo(
  inscriptos: number,
  efectivos: number = inscriptos,
  maximo: number = CUPO_MAXIMO,
): Cupo {
  // Un máximo de 0 o negativo sería un error de configuración; se trata como
  // "sin cupo definido" y el cálculo no divide por cero.
  const tope = maximo > 0 ? maximo : 0;
  const contados = Math.max(0, Math.trunc(inscriptos));
  const completos = Math.max(0, Math.trunc(efectivos));

  const restantes = Math.max(0, tope - contados);
  const porcentaje = tope === 0 ? 0 : Math.min(100, Math.round((contados / tope) * 100));

  let estado: EstadoCupo = 'disponible';
  if (tope > 0 && contados >= tope) estado = 'completo';
  else if (tope > 0 && contados / tope >= UMBRAL_URGENCIA) estado = 'ultimos';

  // Tope 0 = cupo apagado desde `event_config`: entra cualquiera.
  const hayLugar = tope === 0 || contados < tope;

  return { inscriptos: contados, efectivos: completos, maximo: tope, restantes, porcentaje, estado, hayLugar };
}

/**
 * Texto principal del aviso. Vive acá y no en el componente para que la
 * redacción se pueda testear y para no repetirla entre el chip del hero y la
 * barra fija.
 */
export function mensajeCupo(cupo: Cupo): string {
  if (cupo.estado === 'completo') return 'Cupo de participantes completo';
  if (cupo.restantes === 1) return 'Queda 1 lugar para participantes';
  return `Quedan ${cupo.restantes} lugares para participantes`;
}
