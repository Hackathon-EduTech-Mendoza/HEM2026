/**
 * HEM2026 - Rúbrica de evaluación (Hackathon EduTech Mendoza)
 *
 * Fuente única de verdad de los criterios, sus pesos y sus textos de ayuda.
 * Adaptada del "INSTRUCTIVO PROCESO DE EVALUACION - FERIA DE IDEAS 2026"
 * (Concurso Emprende U 2026) y del formulario de jurado de Emprende U:
 *   - Escala 1 a 5 por criterio, igual que el Google Form del jurado.
 *   - Se eliminó el criterio "Validación realizada": en 3 días de hackathon
 *     los equipos no llegan a validar la propuesta con usuarios reales.
 *   - Los criterios se reformularon con foco EduTech (educación + tecnología).
 *
 * FORMATO OFICIAL DEL PUNTAJE (decidido por el administrador del concurso,
 * 2026-07-29): el resultado oficial es el **puntaje ponderado** normalizado a
 * 100, que es el que ordena el ranking. La suma directa de los criterios se
 * sigue calculando y mostrando, pero solo como referencia: no define
 * posiciones ni finalistas.
 *
 * LA RÚBRICA DEPENDE DE LA FASE (pedido de Martín, 2026-07-30): en
 * preclasificación **no se puntúa "Comunicación y pitch"**. En esa instancia
 * los jueces recorren proyecto por proyecto puntuando el material entregado;
 * no hay pitch, así que el criterio no mediría nada. Su 15% se reparte en
 * partes iguales entre los otros cinco (+3% a cada uno). En la ronda final,
 * donde sí hay presentación en vivo, la rúbrica queda como estaba.
 *
 * IMPORTANTE: los pesos deben coincidir con los de la vista SQL
 * `public.project_leaderboard` (ver supabase/migrations/20260731_01_*.sql).
 * Si cambiás un peso acá, cambialo también en la vista.
 */

export type CriterionKey =
  | 'problem'
  | 'solution'
  | 'innovation'
  | 'feasibility'
  | 'impact'
  | 'communication';

/** Fases en las que el jurado puntúa. El flujo completo incluye además
 *  `cerrada` y `deliberacion`, en las que no se vota. */
export type EvaluationPhase = 'preclasificacion' | 'final';

export interface Criterion {
  /** Sufijo de la columna en `evaluations` (score_<key>) */
  key: CriterionKey;
  /** Título visible para el jurado */
  label: string;
  /** Abreviatura para el desglose del ranking en el panel admin */
  short: string;
  /**
   * Peso por fase sobre el puntaje ponderado. `null` = el criterio no se
   * puntúa en esa fase. Los pesos no nulos de cada fase deben sumar 1.
   */
  weights: Record<EvaluationPhase, number | null>;
  /** Pregunta guía que ve el jurado junto al criterio */
  question: string;
  /** Qué mirar concretamente: guía del instructivo del jurado */
  lookFor: string[];
}

/** Criterio ya resuelto para una fase concreta: `weight` es un número. */
export type PhaseCriterion = Omit<Criterion, 'weights'> & { weight: number };

export const CRITERIA: Criterion[] = [
  {
    key: 'problem',
    label: 'Problema y contexto educativo',
    short: 'Pro',
    weights: { preclasificacion: 0.18, final: 0.15 },
    question:
      '¿El equipo identifica con claridad un problema real del ámbito educativo y entiende a quién afecta?',
    lookFor: [
      'Describe el problema con precisión, no en generalidades.',
      'Identifica a quién afecta: estudiantes, docentes, escuelas, familias.',
      'Aporta datos, observaciones o experiencia propia que respalden el problema.',
    ],
  },
  {
    key: 'solution',
    label: 'Propuesta de solución y valor',
    short: 'Sol',
    weights: { preclasificacion: 0.23, final: 0.20 },
    question:
      '¿La solución responde efectivamente al problema y genera valor concreto para quien la use?',
    lookFor: [
      'La solución se conecta de forma directa con el problema planteado.',
      'Queda claro qué mejora en la vida del usuario si la usa.',
      'El alcance es coherente con lo que un equipo puede construir en la hackathon.',
    ],
  },
  {
    key: 'innovation',
    label: 'Nivel de innovación',
    short: 'Inn',
    weights: { preclasificacion: 0.18, final: 0.15 },
    question:
      '¿La propuesta aporta algo original respecto de lo que ya existe para resolver ese problema?',
    lookFor: [
      'Se diferencia de las herramientas que ya se usan hoy para lo mismo.',
      'Usa la tecnología con criterio, no como adorno.',
      'Aporta un enfoque, un uso o una combinación que no es la obvia.',
    ],
  },
  {
    key: 'feasibility',
    label: 'Factibilidad y prototipo',
    short: 'Fac',
    weights: { preclasificacion: 0.23, final: 0.20 },
    question:
      '¿Lo que muestran funciona y es realista llevarlo adelante en lo técnico, económico y operativo?',
    lookFor: [
      'Hay un prototipo, demo o maqueta navegable que se puede ver funcionando.',
      'El equipo explica cómo está hecho y qué falta para completarlo.',
      'La implementación real es plausible en una escuela o institución.',
    ],
  },
  {
    key: 'impact',
    label: 'Impacto potencial en educación',
    short: 'Imp',
    weights: { preclasificacion: 0.18, final: 0.15 },
    question:
      '¿Qué alcance puede tener la propuesta si se implementa: a cuántos llega y qué transforma?',
    lookFor: [
      'Estima a cuántas personas o instituciones podría llegar.',
      'Contempla impacto social, de inclusión o de accesibilidad.',
      'La mejora que promete es significativa, no cosmética.',
    ],
  },
  {
    key: 'communication',
    label: 'Comunicación y pitch',
    short: 'Com',
    // Solo en la final: en preclasificación no hay presentación en vivo.
    weights: { preclasificacion: null, final: 0.15 },
    question:
      '¿El equipo comunica con claridad, en el tiempo previsto y transmitiendo convicción?',
    lookFor: [
      'El relato se entiende sin conocimiento previo del proyecto.',
      'Respeta el tiempo y responde con solvencia a las preguntas del jurado.',
      'El material de apoyo (demo, presentación) acompaña y no distrae.',
    ],
  },
];

/** Escala 1 a 5, igual que el formulario de jurado de Emprende U. */
export const SCALE = [
  { value: 1, label: 'Insuficiente', hint: 'No aborda el criterio o es muy débil.' },
  { value: 2, label: 'Regular', hint: 'Lo aborda de forma incompleta o poco clara.' },
  { value: 3, label: 'Bueno', hint: 'Cumple con lo esperado, sin destacarse.' },
  { value: 4, label: 'Muy bueno', hint: 'Supera lo esperado en varios aspectos.' },
  { value: 5, label: 'Excelente', hint: 'Sobresaliente, es un ejemplo para el resto.' },
] as const;

export const MIN_SCORE = 1;
export const MAX_SCORE = 5;

/**
 * Criterios que se puntúan en una fase, con el peso ya resuelto.
 * Preclasificación devuelve 5 (sin comunicación); la final, los 6.
 */
export function criteriaFor(phase: EvaluationPhase): PhaseCriterion[] {
  return CRITERIA.filter((c) => c.weights[phase] !== null).map(
    ({ weights, ...rest }) => ({ ...rest, weight: weights[phase] as number }),
  );
}

/** Puntaje máximo de la suma directa (sin pesos) en una fase: N criterios x 5. */
export function maxRawScore(phase: EvaluationPhase): number {
  return criteriaFor(phase).length * MAX_SCORE;
}

/** Suma directa de un conjunto de puntajes (escala 0 a maxRawScore(phase)). */
export function rawScore(
  scores: Record<string, number>,
  phase: EvaluationPhase,
): number {
  return criteriaFor(phase).reduce(
    (total, c) => total + (Number(scores[c.key]) || 0),
    0,
  );
}

/** Puntaje ponderado normalizado a 100. Comparable entre fases. */
export function weightedScore(
  scores: Record<string, number>,
  phase: EvaluationPhase,
): number {
  const weighted = criteriaFor(phase).reduce(
    (total, c) => total + (Number(scores[c.key]) || 0) * c.weight,
    0,
  );
  return (weighted / MAX_SCORE) * 100;
}
