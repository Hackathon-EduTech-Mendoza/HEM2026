// src/utils/cupo.ts
//
// Cupo máximo de participantes de la edición 2026. Por espacio y logística la
// sede no da abasto para más gente, así que la inscripción se comunica como
// limitada.
//
// ⚠️ ESTO SOLO INFORMA. Hoy nada impide el registro número 301: no hay check en
// el alta ni trigger en la base. El cierre real quedó pendiente de definir (ver
// BACKLOG.md). Mientras tanto el cartel dice "se cierran al alcanzarlo" como
// intención, no como garantía técnica.

/**
 * Tope de participantes. Vive acá y no en `event_config` a propósito, igual que
 * la fecha del Hero: mover un número a la base obliga a tenerlo bien cargado en
 * las DOS bases (dev y prod) antes de leerlo, y todavía no está decidido si el
 * cupo se administra desde el panel. Cuando se defina el cierre, este es el
 * primer lugar a tocar.
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
 * ⚠️ ACÁ HAY DOS CONTEOS Y NO SON INTERCAMBIABLES.
 *
 * Son dos preguntas distintas y se responden con números distintos:
 *
 *   inscriptos -> "¿cuánta presión hay sobre el cupo?"  Incluye los registros
 *                 que NO terminaron el onboarding. Es el peor caso y es el que
 *                 se muestra en público (decisión de Martín, 2026-08-20).
 *
 *   efectivos  -> "¿queda lugar para mí?"  Solo participantes con el perfil
 *                 completo. Es EXACTAMENTE lo que cuenta el trigger
 *                 `enforce_max_participants` en la base.
 *
 * Mezclarlos rompe una de las dos superficies: si el onboarding usara
 * `inscriptos`, le diría "no hay lugar" a gente que el trigger sí dejaría
 * pasar. Por eso el cartel usa `estado` y el onboarding usa `hayLugar`.
 */
export interface Cupo {
  /** Participantes contando los registros sin completar. Para el cartel público. */
  inscriptos: number;
  /** Participantes con perfil completo: lo que el trigger cuenta de verdad. */
  efectivos: number;
  maximo: number;
  /** Sobre `inscriptos`. Nunca negativo: si se pasó del tope, quedan 0, no -3. */
  restantes: number;
  /** Entero 0-100 sobre `inscriptos`, para la barra de progreso y el texto. */
  porcentaje: number;
  /** Estado del CARTEL. Deriva de `inscriptos`, así que es el conservador. */
  estado: EstadoCupo;
  /** Si el trigger dejaría entrar a un participante más. Deriva de `efectivos`. */
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
 * un número (y porque así el cálculo del cartel se puede probar solo).
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
  const conLugar = Math.max(0, Math.trunc(efectivos));

  const restantes = Math.max(0, tope - contados);
  const porcentaje = tope === 0 ? 0 : Math.min(100, Math.round((contados / tope) * 100));

  let estado: EstadoCupo = 'disponible';
  if (tope > 0 && contados >= tope) estado = 'completo';
  else if (tope > 0 && contados / tope >= UMBRAL_URGENCIA) estado = 'ultimos';

  // Tope 0 = cupo apagado desde `event_config`: entra cualquiera.
  const hayLugar = tope === 0 || conLugar < tope;

  return { inscriptos: contados, efectivos: conLugar, maximo: tope, restantes, porcentaje, estado, hayLugar };
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
