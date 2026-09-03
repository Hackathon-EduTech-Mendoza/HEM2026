// scripts/generar-podio-pdf.mjs
//
// Genera el informe del podio del HEM2026 para la organización: primer,
// segundo y tercer puesto con el detalle de cada equipo —integrantes, líder,
// perfil, institución y contacto—, más los mentores y el proyecto.
//
// ⚠️ DE DÓNDE SALE EL ORDEN. Del **Acta Nº 2 firmada por el jurado el
// 29/08/2026**, no de la base. `teams.final_position` sigue en NULL: la
// deliberación final se hizo en papel y nunca se cargó en la plataforma. La
// base solo aporta los 10 finalistas (`projects.is_finalist`), que coinciden
// exactamente con el Acta Nº 1, y los datos personales de cada integrante.
// Por eso el informe NO lleva puntajes: los de la plataforma corresponden a la
// preclasificación, no al pitch que definió el podio.
//
// El tercer puesto es **compartido** entre HelpApp y Sign IA. Está así en el
// acta, y el HTML lo muestra como dos bloques con el mismo número de puesto.
//
// Los datos entran por docs/podio/podio.json y no por una conexión a la base a
// propósito, igual que en generar-listas-certificados.mjs: el `.env` del repo
// apunta a **dev** y prod se lee en modo solo-lectura desde fuera del script.
// El JSON vive en /docs (ignorado por git) porque lleva DNI, correos y
// teléfonos.
//
// Para regenerar la parte de integrantes, en el SQL Editor de prod:
//
//   select t.name as equipo, p.last_name, p.first_name, p.dni, p.email,
//          p.phone_whatsapp, p.disciplinary_profile::text as perfil,
//          case p.institution::text
//            when 'ies_9023_maipu' then 'IES 9-023 (Maipú)'
//            when 'ies_edison'     then 'IES Tomás Alva Edison'
//            else coalesce(nullif(trim(p.institution_other),''),'Sin especificar') end as institucion,
//          p.year_of_study::text as anio, p.is_egresado,
//          (t.leader_id = p.id) as es_lider
//   from profiles p join teams t on t.id = p.team_id
//   where t.name in ('EduFrequency','EduSeñas','HelpApp','Code &  Class')
//   order by t.name, es_lider desc, upper(p.last_name);
//
// Uso:
//   npm run docs:podio

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = resolve(RAIZ, 'docs/podio');
const ENTRADA = resolve(SALIDA, 'podio.json');

const EVENTO = 'Hackathon EduTech Mendoza 2026';
const EDICION = 'Segunda edición';
const JORNADAS = '28 y 29 de agosto de 2026';

/** Los tres perfiles que usa la plataforma, con la etiqueta que se imprime. */
const PERFILES = { docente: 'Docente', tecnico: 'Técnico', otro: 'Otro' };

const ORDINALES = { primero: '1.º año', segundo: '2.º año', tercero: '3.º año', cuarto: '4.º año' };

function dniConPuntos(dni) {
  return String(dni).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Los teléfonos vienen de un campo de texto libre, así que hay de todo:
 * "2615784387", "5492616635799", "542612539298". Se normaliza a 10 dígitos
 * (área + número) sacando el 54 de país y el 9 de móvil, y si no encaja en
 * ningún patrón conocido se imprime tal cual: es mejor un teléfono raro que
 * uno recortado mal.
 */
function telefonoLegible(crudo) {
  if (!crudo) return '—';
  const d = String(crudo).replace(/\D/g, '');
  const nacional = d.replace(/^54/, '').replace(/^9/, '');
  if (nacional.length !== 10) return crudo;
  return `${nacional.slice(0, 3)} ${nacional.slice(3, 6)}-${nacional.slice(6)}`;
}

function escaparHtml(texto) {
  return String(texto).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

/** Un enlace largo de Drive rompe la caja al imprimir; en el PDF se ve el dominio. */
function enlace(url, etiqueta) {
  if (!url) return '—';
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    /* si no parsea, se muestra la URL cruda */
  }
  return `<a href="${escaparHtml(url)}">${escaparHtml(etiqueta || host)}</a>`;
}

/**
 * Chequeos que tienen que fallar ruidosamente. Un informe firmado por la
 * organización con un equipo sin líder, o con un puesto que no está en el
 * acta, es peor que no tener informe.
 */
function validar(datos) {
  const problemas = [];

  if (!datos.puestos?.length) problemas.push('No hay puestos en el JSON.');

  for (const p of datos.puestos ?? []) {
    const donde = `puesto ${p.puesto} (${p.proyecto})`;
    if (!p.integrantes?.length) problemas.push(`${donde}: sin integrantes.`);
    const lideres = (p.integrantes ?? []).filter((i) => i.lider);
    if (lideres.length !== 1) problemas.push(`${donde}: ${lideres.length} líderes, se esperaba 1.`);
    for (const i of p.integrantes ?? []) {
      if (!i.apellido || !i.nombre) problemas.push(`${donde}: integrante sin nombre completo.`);
      if (!/^\d{7,9}$/.test(String(i.dni))) problemas.push(`${donde}: DNI con formato raro "${i.dni}" (${i.apellido}).`);
      if (!PERFILES[i.perfil]) problemas.push(`${donde}: perfil desconocido "${i.perfil}" (${i.apellido}).`);
    }
  }

  const dnis = new Map();
  for (const p of datos.puestos ?? []) {
    for (const i of p.integrantes ?? []) {
      const previo = dnis.get(i.dni);
      if (previo) problemas.push(`DNI ${i.dni} repetido: ${previo} y ${p.proyecto}.`);
      dnis.set(i.dni, p.proyecto);
    }
  }

  if (problemas.length) {
    throw new Error(`El JSON tiene ${problemas.length} problema(s):\n  - ${problemas.join('\n  - ')}`);
  }
}

function bloqueIntegrantes(integrantes) {
  const filas = integrantes
    .map(
      (i) => `            <tr${i.lider ? ' class="es-lider"' : ''}>
              <td class="nombre">${escaparHtml(i.apellido)}, ${escaparHtml(i.nombre)}${
                i.lider ? ' <span class="chip chip-lider">Líder</span>' : ''
              }${i.egresado ? ' <span class="chip">Egresada/o</span>' : ''}</td>
              <td class="perfil">${escaparHtml(PERFILES[i.perfil])}</td>
              <td class="dni">${dniConPuntos(i.dni)}</td>
              <td class="inst">${escaparHtml(i.institucion)}${
                i.anio ? ` <span class="anio">· ${escaparHtml(ORDINALES[i.anio] ?? i.anio)}</span>` : ''
              }</td>
              <td class="contacto"><a href="mailto:${escaparHtml(i.email)}">${escaparHtml(i.email)}</a><br><span class="tel">${escaparHtml(
                telefonoLegible(i.telefono),
              )}</span></td>
            </tr>`,
    )
    .join('\n');

  return `        <table class="integrantes">
          <thead>
            <tr><th>Apellido y nombre</th><th>Perfil</th><th>DNI</th><th>Institución</th><th>Contacto</th></tr>
          </thead>
          <tbody>
${filas}
          </tbody>
        </table>`;
}

function bloquePuesto(p, indice) {
  const composicion = p.integrantes.reduce((acc, i) => {
    acc[i.perfil] = (acc[i.perfil] ?? 0) + 1;
    return acc;
  }, {});
  const resumenComposicion = Object.entries(composicion)
    .map(([perfil, n]) => `${n} ${PERFILES[perfil].toLowerCase()}${n === 1 ? '' : 's'}`)
    .join(' · ');

  return `      <section class="puesto puesto-${p.puesto}"${indice > 0 ? ' ' : ''}>
        <header class="puesto-cab">
          <div class="medalla">${p.puesto}<span class="orden">.º</span></div>
          <div class="titulos">
            <p class="etiqueta">${escaparHtml(p.etiqueta)}</p>
            <h3>${escaparHtml(p.proyecto)}</h3>
            <p class="equipo">Equipo <strong>${escaparHtml(p.equipo)}</strong> · ${escaparHtml(
              resumenComposicion,
            )} · ${p.integrantes.length} integrantes${
              p.grupo_jurado ? ` · grupo de jurado ${p.grupo_jurado}` : ''
            }</p>
          </div>
        </header>

        ${p.nota_equipo ? `<p class="nota-equipo">${escaparHtml(p.nota_equipo)}</p>` : ''}

        <div class="proyecto">
          <div><h4>Problema</h4><p>${escaparHtml(p.problema)}</p></div>
          <div><h4>Solución</h4><p>${escaparHtml(p.solucion)}</p></div>
        </div>

        <dl class="meta">
          <dt>Mentores</dt>
          <dd>${p.mentores
            .map((m) => `${escaparHtml(m.nombre)} <span class="mail">&lt;${escaparHtml(m.email)}&gt;</span>`)
            .join(' · ')}</dd>
          <dt>Prototipo</dt>
          <dd>${enlace(p.prototipo)}</dd>
          <dt>Material de apoyo</dt>
          <dd>${enlace(p.material)}</dd>
        </dl>

${bloqueIntegrantes(p.integrantes)}
      </section>`;
}

function armarHtml(datos) {
  const generado = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
  const personas = datos.puestos.reduce((n, p) => n + p.integrantes.length, 0);
  const equipos = datos.puestos.length;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Podio ${EVENTO} — equipos ganadores</title>
<style>
  :root {
    --tinta: #16202e;
    --tinta-suave: #5b6879;
    --linea: #d9dfe7;
    --acento: #0f5c8c;
    --franja: #f4f7fa;
    --oro: #a67c00;
    --plata: #6b7280;
    --bronce: #96562a;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 28px 32px 48px;
    font: 11pt/1.45 "Segoe UI", system-ui, -apple-system, sans-serif;
    color: var(--tinta);
    background: #fff;
  }
  a { color: var(--acento); }
  header.doc { border-bottom: 3px solid var(--acento); padding-bottom: 14px; margin-bottom: 22px; }
  h1 { margin: 0 0 4px; font-size: 19pt; letter-spacing: -0.01em; }
  header.doc p { margin: 2px 0; color: var(--tinta-suave); font-size: 10pt; }
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
  .aclaracion strong { color: var(--tinta); }

  /* Un puesto por página: el informe se reparte impreso y cada equipo se
     entrega por separado. La última no lleva salto para no dejar una hoja
     en blanco al final. */
  .puesto { padding-top: 6px; margin-bottom: 26px; break-inside: avoid; }
  .puesto + .puesto { border-top: 1px solid var(--linea); padding-top: 20px; }
  .puesto-cab { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 12px; }
  .medalla {
    flex: none;
    width: 46px; height: 46px;
    border-radius: 50%;
    display: grid; place-items: center;
    font-size: 17pt; font-weight: 700;
    color: #fff; background: var(--acento);
    /* el fondo del círculo tiene que sobrevivir a la impresión */
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .medalla .orden { font-size: 9pt; font-weight: 600; align-self: flex-start; margin-top: 4px; }
  .puesto-1 .medalla { background: var(--oro); }
  .puesto-2 .medalla { background: var(--plata); }
  .puesto-3 .medalla { background: var(--bronce); }
  .titulos { min-width: 0; }
  .etiqueta {
    margin: 0; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--tinta-suave); font-weight: 600;
  }
  .puesto h3 { margin: 1px 0 3px; font-size: 15pt; letter-spacing: -0.01em; }
  .equipo { margin: 0; font-size: 9.5pt; color: var(--tinta-suave); }
  .nota-equipo {
    margin: 0 0 12px; padding: 7px 10px; font-size: 9pt;
    background: var(--franja); border-left: 3px solid var(--tinta-suave); color: var(--tinta-suave);
  }

  .proyecto { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 12px; }
  .proyecto h4 {
    margin: 0 0 3px; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--acento);
  }
  .proyecto p { margin: 0; font-size: 9.5pt; text-align: justify; }

  dl.meta {
    display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px;
    margin: 0 0 12px; padding: 9px 12px; background: var(--franja); font-size: 9pt;
  }
  dl.meta dt { color: var(--tinta-suave); font-weight: 600; }
  dl.meta dd { margin: 0; }
  dl.meta .mail { color: var(--tinta-suave); font-size: 8.5pt; }

  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--linea); vertical-align: top; }
  thead th {
    font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--tinta-suave); border-bottom: 2px solid var(--linea);
  }
  .integrantes td { font-size: 9.5pt; }
  .integrantes tbody tr:nth-child(even) { background: var(--franja); }
  .nombre { font-weight: 600; }
  .perfil { width: 74px; }
  .dni { width: 92px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .inst { color: var(--tinta-suave); font-size: 9pt; }
  .anio { white-space: nowrap; }
  .contacto { width: 210px; font-size: 8.5pt; word-break: break-word; }
  .contacto .tel { color: var(--tinta-suave); font-variant-numeric: tabular-nums; }
  .chip {
    display: inline-block; padding: 0 5px; margin-left: 3px;
    font-size: 7.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
    border: 1px solid var(--linea); border-radius: 8px; color: var(--tinta-suave);
    vertical-align: 1px;
  }
  .chip-lider { border-color: var(--acento); color: var(--acento); }

  ol.finalistas { margin: 0; padding-left: 22px; column-count: 2; column-gap: 26px; font-size: 9.5pt; }
  ol.finalistas li { margin-bottom: 2px; break-inside: avoid; }

  footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid var(--linea); font-size: 8.5pt; color: var(--tinta-suave); }

  @media (max-width: 700px) {
    body { padding: 18px; }
    .proyecto { grid-template-columns: 1fr; }
    ol.finalistas { column-count: 1; }
    .contacto { width: auto; }
  }
  @media print {
    body { padding: 0; font-size: 9.5pt; }
    h2 { page-break-after: avoid; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    .puesto { page-break-inside: avoid; }
    .puesto + .puesto { page-break-before: always; border-top: 0; padding-top: 6px; }
  }
  @page { margin: 14mm 12mm; size: A4; }
</style>
</head>
<body>
  <header class="doc">
    <h1>${EVENTO}</h1>
    <p>${EDICION} — equipos ganadores y detalle del podio</p>
    <p>Jornadas presenciales: ${JORNADAS} · Definición del podio: ${escaparHtml(datos.acta.fecha)}, ${escaparHtml(
      datos.acta.lugar,
    )}</p>
  </header>

  <p class="aclaracion">
    <strong>Fuente y alcance.</strong> El orden del podio es el que consta en el
    <strong>Acta N.º ${escaparHtml(datos.acta.numero)} — ${escaparHtml(
      datos.acta.titulo,
    )}</strong>, firmada por el jurado el ${escaparHtml(datos.acta.fecha)} tras la etapa de pitch.
    <strong>El informe no incluye puntajes:</strong> los que registró la plataforma corresponden a la
    preclasificación que definió los 10 finalistas, no a la deliberación final, y por lo tanto no
    reproducen este orden. El <strong>tercer puesto es compartido</strong> entre dos equipos, tal
    como está asentado en el acta. Los datos de los ${personas} integrantes ―nombre, DNI,
    institución y contacto― salen de la base de la plataforma.
  </p>

  <h2>1. Podio <span class="cuenta">${equipos} equipos · ${personas} integrantes</span></h2>

${datos.puestos.map(bloquePuesto).join('\n')}

  <h2>2. Los 10 equipos finalistas <span class="cuenta">Acta N.º 1 — Ronda final</span></h2>
  <p class="aclaracion">
    Equipos que pasaron a la <strong>Etapa N.º 4 — Pitch</strong> según el Acta N.º 1. El orden es
    el del acta, que refleja la preclasificación: <strong>no es el orden del podio</strong>.
  </p>
  <ol class="finalistas">
${datos.finalistas_acta_1.map((f) => `    <li>${escaparHtml(f)}</li>`).join('\n')}
  </ol>

  <h2>3. Jurado firmante</h2>
  <table>
    <thead><tr><th>Nombre</th><th class="dni">DNI</th></tr></thead>
    <tbody>
${datos.acta.jurados
  .map((j) => `      <tr><td class="nombre">${escaparHtml(j.nombre)}</td><td class="dni">${dniConPuntos(j.dni)}</td></tr>`)
  .join('\n')}
    </tbody>
  </table>
  <p class="aclaracion" style="margin-top:10px">${escaparHtml(datos.acta.nota_jurados)}</p>

  <footer>
    Generado el ${generado} a partir del acta firmada y de la base de la plataforma
    (<code>npm run docs:podio</code>). Documento de trabajo interno: contiene datos personales
    de los participantes. Para publicar, usar la página <code>/ganadores</code>, que muestra el
    podio sin datos de contacto.
  </footer>
</body>
</html>
`;
}

async function main() {
  const datos = JSON.parse(await readFile(ENTRADA, 'utf8'));
  validar(datos);

  await mkdir(SALIDA, { recursive: true });
  await writeFile(resolve(SALIDA, 'podio-hem2026.html'), armarHtml(datos), 'utf8');

  const personas = datos.puestos.reduce((n, p) => n + p.integrantes.length, 0);
  console.log(`✓ ${datos.puestos.length} equipos en el podio, ${personas} integrantes`);
  console.log('  docs/podio/podio-hem2026.html  (abrir e imprimir a PDF)');
}

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
