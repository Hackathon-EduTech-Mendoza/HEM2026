// scripts/generar-listas-certificados.mjs
//
// Genera las listas de participantes efectivos del HEM2026 para que la
// organización emita los certificados.
//
// ⚠️ QUIÉNES ENTRAN Y POR QUÉ. Participante efectivo = **quedó en un equipo**.
// No alcanza con estar inscripto ni con haber terminado el onboarding: al
// 2026-08-31 había 311 cuentas con rol `usuario` y 262 con el onboarding
// completo, pero solo 130 personas integraron alguno de los 25 equipos que
// presentaron proyecto. La base NO tiene registro de asistencia, así que
// `profiles.team_id IS NOT NULL` es el único rastro de participación real que
// existe. Certificar por inscripción sería certificar a gente que no fue.
//
// Salen dos archivos, porque se usan para cosas distintas:
//   - .html -> las dos listas (alfabética y por equipo) para imprimir a PDF.
//              Es lo que se manda como constancia y lo que se firma.
//   - .csv  -> la misma nómina en una fila por persona, para la combinación de
//              correspondencia del generador de certificados. Del PDF hay que
//              retipear los nombres; del CSV no.
//
// Los datos entran por un TSV y no por una conexión a la base a propósito: el
// `.env` del repo apunta a **dev**, y prod se lee en modo solo-lectura desde
// fuera del script. El TSV se regenera con la consulta documentada abajo y
// vive en /docs/ (ignorado por git), porque lleva DNI y correos.
//
// Para regenerar el TSV, en el SQL Editor de prod:
//
//   select concat_ws(chr(9), t.name, p.last_name, p.first_name,
//            regexp_replace(p.dni,'\D','','g'), p.email,
//            case p.institution::text
//              when 'ies_9023_maipu' then 'IES 9-023 (Maipú)'
//              when 'ies_edison'     then 'IES Tomás Alva Edison'
//              else coalesce(nullif(trim(p.institution_other),''),'Sin especificar') end,
//            p.year_of_study::text,
//            case when p.is_egresado then 'si' else 'no' end)
//   from profiles p join teams t on t.id = p.team_id
//   order by t.name, upper(p.last_name), upper(p.first_name);
//
// Uso:
//   npm run docs:certificados

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = resolve(RAIZ, 'docs/certificados');
const ENTRADA = resolve(SALIDA, 'participantes.tsv');

const EVENTO = 'Hackathon EduTech Mendoza 2026';
const JORNADAS = '28 y 29 de agosto de 2026';

const COLUMNAS = ['equipo', 'apellido', 'nombre', 'dni', 'email', 'institucion', 'anio', 'egresado'];

/** El DNI se muestra con puntos; en el CSV va sin ellos, que es lo que se pega en un padrón. */
function dniConPuntos(dni) {
  return dni.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Colación alfabética en español: "Ñuñez" después de "Nuñez", tildes ignoradas. */
const colador = new Intl.Collator('es', { sensitivity: 'base' });

function porApellido(a, b) {
  return colador.compare(a.apellido, b.apellido) || colador.compare(a.nombre, b.nombre);
}

function escaparHtml(texto) {
  return texto.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

/**
 * Una celda de CSV se entrecomilla siempre. Sale más largo, pero evita tener
 * que razonar sobre qué nombre de equipo trae una coma: "Code &  Class" y
 * "HT (HelpTeacher)" ya rompen la versión ingenua.
 */
function celdaCsv(valor) {
  return `"${String(valor).replace(/"/g, '""')}"`;
}

async function leerParticipantes() {
  const crudo = await readFile(ENTRADA, 'utf8');
  const lineas = crudo.split(/\r?\n/).filter((l) => l.trim() !== '');
  const cabecera = lineas.shift().split('\t');

  if (cabecera.join('\t') !== COLUMNAS.join('\t')) {
    throw new Error(`Cabecera inesperada en ${ENTRADA}.\n  esperada: ${COLUMNAS.join(' | ')}\n  recibida: ${cabecera.join(' | ')}`);
  }

  return lineas.map((linea, i) => {
    const campos = linea.split('\t');
    if (campos.length !== COLUMNAS.length) {
      throw new Error(`Fila ${i + 2} de ${ENTRADA}: ${campos.length} campos, se esperaban ${COLUMNAS.length}.`);
    }
    return Object.fromEntries(COLUMNAS.map((col, j) => [col, campos[j].trim()]));
  });
}

/**
 * Chequeos que tienen que fallar ruidosamente: un certificado con el nombre mal
 * escrito se reimprime, pero uno emitido dos veces a la misma persona o a
 * alguien sin DNI es un problema administrativo.
 */
function validar(participantes) {
  const problemas = [];
  const vistos = new Map();

  for (const p of participantes) {
    if (!p.apellido || !p.nombre) problemas.push(`Sin nombre completo: ${p.email || '(sin email)'}`);
    if (!/^\d{7,9}$/.test(p.dni)) problemas.push(`DNI con formato raro: "${p.dni}" (${p.apellido}, ${p.nombre})`);
    const previo = vistos.get(p.dni);
    if (previo) problemas.push(`DNI repetido ${p.dni}: ${previo} y ${p.apellido}, ${p.nombre}`);
    vistos.set(p.dni, `${p.apellido}, ${p.nombre}`);
  }

  if (problemas.length) {
    throw new Error(`El TSV tiene ${problemas.length} problema(s):\n  - ${problemas.join('\n  - ')}`);
  }
}

function agruparPorEquipo(participantes) {
  const equipos = new Map();
  for (const p of participantes) {
    if (!equipos.has(p.equipo)) equipos.set(p.equipo, []);
    equipos.get(p.equipo).push(p);
  }
  for (const miembros of equipos.values()) miembros.sort(porApellido);
  return [...equipos.entries()].sort((a, b) => colador.compare(a[0], b[0]));
}

function armarCsv(participantes) {
  const filas = [
    ['apellido', 'nombre', 'nombre_completo', 'dni', 'email', 'equipo', 'institucion'],
    ...[...participantes].sort(porApellido).map((p) => [
      p.apellido,
      p.nombre,
      `${p.nombre} ${p.apellido}`,
      p.dni,
      p.email,
      p.equipo,
      p.institucion,
    ]),
  ];
  // BOM al principio: sin él, Excel en Windows abre el CSV en la codificación
  // del sistema y los apellidos con tilde o con ñ llegan rotos a los diplomas.
  return '﻿' + filas.map((f) => f.map(celdaCsv).join(',')).join('\r\n') + '\r\n';
}

function armarHtml(participantes, equipos) {
  const alfabetica = [...participantes].sort(porApellido);
  const generado = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

  const filasAlfabeticas = alfabetica
    .map(
      (p, i) => `        <tr>
          <td class="num">${i + 1}</td>
          <td class="nombre">${escaparHtml(p.apellido)}, ${escaparHtml(p.nombre)}</td>
          <td class="dni">${dniConPuntos(p.dni)}</td>
          <td>${escaparHtml(p.equipo)}</td>
          <td class="inst">${escaparHtml(p.institucion)}</td>
        </tr>`,
    )
    .join('\n');

  const bloquesEquipo = equipos
    .map(
      ([equipo, miembros]) => `      <section class="equipo">
        <h3>${escaparHtml(equipo)} <span class="cuenta">${miembros.length} integrantes</span></h3>
        <table>
          <tbody>
${miembros
  .map(
    (p) => `            <tr>
              <td class="nombre">${escaparHtml(p.apellido)}, ${escaparHtml(p.nombre)}</td>
              <td class="dni">${dniConPuntos(p.dni)}</td>
              <td class="inst">${escaparHtml(p.institucion)}</td>
            </tr>`,
  )
  .join('\n')}
          </tbody>
        </table>
      </section>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Participantes ${EVENTO} — nómina para certificados</title>
<style>
  :root {
    --tinta: #16202e;
    --tinta-suave: #5b6879;
    --linea: #d9dfe7;
    --acento: #0f5c8c;
    --franja: #f4f7fa;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 28px 32px 48px;
    font: 11pt/1.45 "Segoe UI", system-ui, -apple-system, sans-serif;
    color: var(--tinta);
    background: #fff;
  }
  header { border-bottom: 3px solid var(--acento); padding-bottom: 14px; margin-bottom: 22px; }
  h1 { margin: 0 0 4px; font-size: 19pt; letter-spacing: -0.01em; }
  header p { margin: 2px 0; color: var(--tinta-suave); font-size: 10pt; }
  h2 {
    margin: 34px 0 6px;
    font-size: 13.5pt;
    color: var(--acento);
    border-bottom: 1px solid var(--linea);
    padding-bottom: 5px;
  }
  h2 .cuenta { float: right; font-size: 10pt; font-weight: normal; color: var(--tinta-suave); }
  .aclaracion {
    margin: 0 0 16px;
    padding: 10px 13px;
    background: var(--franja);
    border-left: 3px solid var(--acento);
    font-size: 9.5pt;
    color: var(--tinta-suave);
  }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--linea); vertical-align: top; }
  thead th {
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tinta-suave);
    border-bottom: 2px solid var(--linea);
  }
  tbody tr:nth-child(even) { background: var(--franja); }
  .num { width: 34px; color: var(--tinta-suave); text-align: right; font-variant-numeric: tabular-nums; }
  .nombre { font-weight: 600; }
  .dni { width: 92px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .inst { color: var(--tinta-suave); font-size: 9.5pt; }
  /* Dos columnas de equipos: 25 bloques cortos en una sola columna desperdician
     media página cada uno. En pantalla angosta y al imprimir se apilan solos. */
  .equipos { column-count: 2; column-gap: 26px; }
  .equipo { break-inside: avoid; page-break-inside: avoid; margin: 0 0 15px; }
  .equipo h3 {
    margin: 0 0 3px;
    font-size: 10.5pt;
    padding-bottom: 3px;
    border-bottom: 2px solid var(--acento);
  }
  .equipo .cuenta { float: right; font-weight: normal; font-size: 8.5pt; color: var(--tinta-suave); }
  .equipo td { padding: 3px 6px; font-size: 9.5pt; }
  .equipo .dni { width: 82px; }
  .equipo .inst { display: none; } /* la institución ya está en la lista general */
  footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid var(--linea); font-size: 8.5pt; color: var(--tinta-suave); }
  @media (max-width: 700px) { .equipos { column-count: 1; } body { padding: 18px; } }
  @media print {
    body { padding: 0; font-size: 9.5pt; }
    h2 { page-break-after: avoid; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  }
  @page { margin: 14mm 12mm; size: A4; }
</style>
</head>
<body>
  <header>
    <h1>${EVENTO}</h1>
    <p>Nómina de participantes para la emisión de certificados</p>
    <p>Jornadas presenciales: ${JORNADAS}</p>
  </header>

  <p class="aclaracion">
    <strong>Alcance de esta nómina.</strong> Incluye a las ${participantes.length} personas que
    integraron uno de los ${equipos.length} equipos que presentaron proyecto. No incluye a
    quienes se inscribieron y no llegaron a conformar equipo: la plataforma no registra
    asistencia, y la pertenencia a un equipo es el único registro de participación efectiva.
    Las dos listas contienen exactamente a las mismas personas, ordenadas de dos maneras
    distintas para poder cotejarlas.
  </p>

  <h2>1. Listado general <span class="cuenta">${participantes.length} personas</span></h2>
  <table>
    <thead>
      <tr><th class="num">#</th><th>Apellido y nombre</th><th>DNI</th><th>Equipo</th><th>Institución</th></tr>
    </thead>
    <tbody>
${filasAlfabeticas}
    </tbody>
  </table>

  <h2>2. Listado por equipo <span class="cuenta">${equipos.length} equipos</span></h2>
  <div class="equipos">
${bloquesEquipo}
  </div>

  <footer>
    Generado el ${generado} desde la base de la plataforma
    (<code>npm run docs:certificados</code>). Documento de trabajo interno: contiene
    datos personales de los participantes.
  </footer>
</body>
</html>
`;
}

async function main() {
  const participantes = await leerParticipantes();
  validar(participantes);

  const equipos = agruparPorEquipo(participantes);

  await mkdir(SALIDA, { recursive: true });
  await writeFile(resolve(SALIDA, 'participantes-hem2026.html'), armarHtml(participantes, equipos), 'utf8');
  await writeFile(resolve(SALIDA, 'participantes-hem2026.csv'), armarCsv(participantes), 'utf8');

  console.log(`✓ ${participantes.length} participantes en ${equipos.length} equipos`);
  console.log(`  docs/certificados/participantes-hem2026.html  (abrir e imprimir a PDF)`);
  console.log(`  docs/certificados/participantes-hem2026.csv   (combinación de correspondencia)`);
}

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
