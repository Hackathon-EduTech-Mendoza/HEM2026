// src/utils/instituciones.ts
//
// El campo "Institución u organización" del onboarding es texto libre cuando la
// persona elige "Otra". Sin ayuda, la misma institución entra escrita de formas
// distintas: al 2026-08-03 el IES 9-010 estaba cargado como "IES 9-010 Rosario
// Vera Peñaloza" y como 'IES NO 9-010 "Rosario Vera Peñaloza"', y el 9-030 como
// "Instituto Bicentenario N°9030" y como su nombre completo de 75 caracteres.
// Eso parte una institución en dos en las métricas del admin.
//
// Acá viven las dos mitades de la solución: la lista que se sugiere mientras se
// escribe y la normalización de lo que finalmente se guarda.

/**
 * Institutos de Educación Superior de Mendoza.
 *
 * Fuente: la nómina de oferta educativa de la DGE (mendoza.edu.ar). ⚠️ No es
 * exhaustiva —faltan el 9-020, el 9-022 y el 9-025, que no figuran en esa
 * publicación— y por eso el campo NO es una lista cerrada: es autocompletado.
 *
 * El 9-023 de Maipú y el Tomás Alva Edison no están acá a propósito: son
 * opciones fijas del desplegable, antes de llegar a "Otra".
 */
const IES_MENDOZA = [
  'IES 9-001 Gral. José de San Martín',
  'IES 9-002 Tomás Godoy Cruz',
  'IES 9-003 Mercedes Tomasa de San Martín de Balcarce',
  'IES 9-004 Gral. Toribio de Luzuriaga',
  'IES 9-005 Fidela Amparán',
  'IES 9-006 Prof. Humberto Tolosa',
  'IES 9-007 Dr. Salvador Calafat',
  'IES 9-008 Manuel Belgrano',
  'IES 9-009 Tupungato',
  'IES 9-010 Rosario Vera Peñaloza',
  'IES 9-011 Del Atuel',
  'IES 9-012 San Rafael en Informática',
  'IES 9-013 ISTEEC',
  'IES 9-014 Profesorado de Arte',
  'IES 9-015 Valle de Uco',
  'IES 9-016 Dr. Jorge E. Coll',
  'IES 9-017 Escuela Regional de Cine y Video',
  'IES 9-018 Gdor. Celso Alejandro Jaque',
  'IES 9-019 INSUTEC',
  'IES 9-021 De Junín',
  'IES 9-024 Lavalle',
  'IES 9-026 De la Patria Grande',
  'IES 9-027 De Guaymallén',
  'IES 9-028 Prof. Estela Susana Quiroga',
  'IES 9-029 De Luján',
  'IES 9-030 Del Bicentenario',
];

/**
 * Universidades con presencia en Mendoza.
 *
 * Van incluidas porque el Art. 5º de las Bases habilita "otras carreras de
 * nivel superior", que en Argentina incluye a las universidades — y de hecho ya
 * hay un participante inscripto desde la UTN.
 */
const UNIVERSIDADES_MENDOZA = [
  'Universidad Nacional de Cuyo (UNCuyo)',
  'Universidad Tecnológica Nacional (UTN) — Facultad Regional Mendoza',
  'Universidad Tecnológica Nacional (UTN) — Facultad Regional San Rafael',
  'Universidad de Mendoza (UM)',
  'Universidad Juan Agustín Maza (UMaza)',
  'Universidad del Aconcagua (UDA)',
  'Universidad Champagnat',
  'Universidad de Congreso',
];

/** Institutos privados ya presentes entre los inscriptos. */
const OTRAS_INSTITUCIONES = ['Instituto Superior San Pedro Nolasco'];

/**
 * Lo que se ofrece como autocompletado, ordenado alfabéticamente.
 *
 * ⚠️ Es una sugerencia, nunca una lista cerrada. Los mentores y jueces no
 * responden "dónde estudio" sino "de dónde vengo": entre los cargados hay una
 * empresa (Patagonian Tech) y un jardín de infantes (JIN 0168). Cerrar el campo
 * a un padrón educativo dejaría a esa gente sin poder completar el formulario.
 */
export const INSTITUCIONES_SUGERIDAS: string[] = [
  ...IES_MENDOZA,
  ...UNIVERSIDADES_MENDOZA,
  ...OTRAS_INSTITUCIONES,
].sort((a, b) => a.localeCompare(b, 'es'));

/**
 * Limpia lo tipeado sin cambiarle el sentido: espacios de sobra, comillas
 * sueltas al principio o al final, y puntuación colgada.
 *
 * Deliberadamente NO toca mayúsculas, acentos ni abreviaturas: "IES" no debe
 * volverse "Ies", y adivinar que "9030" es "9-030" sería inventar.
 *
 *   "  IES   9-010  "          -> "IES 9-010"
 *   '"Del Bicentenario"'       -> "Del Bicentenario"
 *   "LAE Uncuyo,"              -> "LAE Uncuyo"
 *   "   "                      -> ""
 */
export function normalizarInstitucion(input: string | null | undefined): string {
  if (!input) return '';

  return input
    .replace(/\s+/g, ' ')
    .trim()
    // Comillas rectas o tipográficas que envuelven todo el valor.
    .replace(/^["'“”«]+|["'“”»]+$/g, '')
    // Puntuación que quedó colgando al final.
    .replace(/[,;.\-–—]+$/, '')
    .trim();
}

/**
 * ¿Esto parece el nombre de una institución?
 *
 * El listón es bajo a propósito: la idea es filtrar el relleno para zafar del
 * campo obligatorio, no auditar respuestas. Al 2026-08-03 había tres perfiles
 * cargados con "-" y con "A", que es exactamente lo que esto ataja.
 *
 * Se piden 3 caracteres y al menos 2 letras, de modo que siglas y códigos
 * reales pasen: "UTN", "JIN 0168" y "LAE Uncuyo" son todos válidos.
 */
export function esInstitucionValida(input: string | null | undefined): boolean {
  const valor = normalizarInstitucion(input);
  if (valor.length < 3) return false;

  const letras = valor.match(/\p{L}/gu);
  return (letras?.length ?? 0) >= 2;
}
