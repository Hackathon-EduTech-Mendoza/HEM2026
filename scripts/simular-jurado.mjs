// scripts/simular-jurado.mjs
//
// Arma en HEM-Dev un escenario para probar los grupos de jurado: los 6 jueces
// con los nombres que pasó Martín y 12 equipos con su proyecto entregado.
//
// 12 es a propósito: divide exacto entre 2 tríos (6 y 6) y entre 3 duetos
// (4, 4 y 4), así se ve el reparto parejo en las dos conformaciones sin que el
// resto sobrante confunda.
//
// Uso:
//   node scripts/simular-jurado.mjs             -> muestra qué crearía
//   node scripts/simular-jurado.mjs --si        -> lo crea de verdad
//   node scripts/simular-jurado.mjs --borrar --si  -> lo borra todo
//
// ⚠️ SOLO CORRE CONTRA HEM-DEV, con la misma comprobación de project_ref que
// seed-dev.mjs. Es simulación: nada de esto va a producción.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const CONFIRMAR = process.argv.includes('--si');
const BORRAR = process.argv.includes('--borrar');

const DEV_REF = 'mhipqazqvnuvtlrbqdce';
const PASSWORD = '12345678';

/** Prefijo común para poder borrar la simulación sin tocar el seed del tutorial. */
const PREFIJO = 'SIM';

const env = {};
for (const line of readFileSync('.env', 'utf-8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}

if (!env.PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env.');
  process.exit(1);
}

if (!env.PUBLIC_SUPABASE_URL.includes(DEV_REF)) {
  console.error(`
✋ ABORTADO: el .env NO apunta a HEM-Dev.

   PUBLIC_SUPABASE_URL = ${env.PUBLIC_SUPABASE_URL}
   esperado            = https://${DEV_REF}.supabase.co
`);
  process.exit(1);
}

const db = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Los 6 jueces, con las instituciones que tienen en producción ──
const JUECES = [
  { email: 'sim-romina@hem-dev.test',  first_name: 'Romina Betiana', last_name: 'Iragorre Secotaro', institution: 'ies_edison' },
  { email: 'sim-luis@hem-dev.test',    first_name: 'Luis',           last_name: 'Vivanco',           institution: 'ies_edison' },
  { email: 'sim-henry@hem-dev.test',   first_name: 'Henry',          last_name: 'Tong Valera',       institution: 'otra', institution_other: 'Simulación' },
  { email: 'sim-camila@hem-dev.test',  first_name: 'Camila',         last_name: 'Dimarco',           institution: 'ies_edison' },
  { email: 'sim-leandro@hem-dev.test', first_name: 'Leandro Esteban',last_name: 'Quiroga',           institution: 'ies_9023_maipu' },
  { email: 'sim-jose@hem-dev.test',    first_name: 'José Francisco', last_name: 'Merciel',           institution: 'otra', institution_other: 'Simulación' },
];

const TITULOS = [
  'Aula Aumentada', 'Mapa de Trayectorias', 'Tutor de Lectura', 'Radar de Ausentismo',
  'Taller Remoto', 'Bitácora Docente', 'Simulador de Laboratorio', 'Ronda de Pares',
  'Agenda Accesible', 'Banco de Consignas', 'Panel de Convivencia', 'Ruta de Egreso',
];

const EQUIPOS = TITULOS.map((titulo, i) => ({
  name: `${PREFIJO} Equipo ${String(i + 1).padStart(2, '0')}`,
  join_code: `${PREFIJO}${String(i + 1).padStart(3, '0')}`,
  proyecto: {
    title: titulo,
    description_problem: `Problema que aborda «${titulo}», cargado por la simulación.`,
    description_solution: `Solución propuesta por el equipo para «${titulo}».`,
  },
}));

const EMAILS = JUECES.map((j) => j.email);
const JOIN_CODES = EQUIPOS.map((e) => e.join_code);

async function buscarCuenta(email) {
  let page = 1;
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const encontrada = data.users.find((u) => u.email === email);
    if (encontrada) return encontrada;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

// ── Modo borrado ──
if (BORRAR) {
  if (!CONFIRMAR) {
    console.log(`\nBorraría los ${EQUIPOS.length} equipos ${PREFIJO} (y sus proyectos) y estas ${EMAILS.length} cuentas:\n`);
    for (const e of EMAILS) console.log(`  ${e}`);
    console.log('\nAgregá --si para borrarlos de verdad.\n');
    process.exit(0);
  }

  // Los equipos primero: teams_leader_id_fkey no tiene ON DELETE.
  const { data: borrados, error: errEquipos } = await db
    .from('teams').delete().in('join_code', JOIN_CODES).select('join_code');

  console.log(errEquipos
    ? `  ✗  equipos: ${errEquipos.message}`
    : `  ✓  ${(borrados ?? []).length} equipos borrados`);

  for (const email of EMAILS) {
    const cuenta = await buscarCuenta(email);
    if (!cuenta) { console.log(`  —  ${email} (no existía)`); continue; }
    const { error } = await db.auth.admin.deleteUser(cuenta.id);
    console.log(error ? `  ✗  ${email}: ${error.message}` : `  ✓  ${email} borrado`);
  }
  console.log('');
  process.exit(0);
}

// ── Modo alta ──
if (!CONFIRMAR) {
  console.log(`\nCrearía en HEM-Dev (${DEV_REF}):\n`);
  console.log(`  ${JUECES.length} jueces aprobados:`);
  for (const j of JUECES) console.log(`    ${j.email.padEnd(28)} ${j.first_name} ${j.last_name}`);
  console.log(`\n  ${EQUIPOS.length} equipos con su proyecto entregado:`);
  for (const e of EQUIPOS) console.log(`    ${e.join_code}  ${e.name.padEnd(18)} «${e.proyecto.title}»`);
  console.log(`\nTodos con la contraseña: ${PASSWORD}`);
  console.log('\nAgregá --si para crearlos de verdad.\n');
  process.exit(0);
}

console.log(`\nSimulando jurado en HEM-Dev (${DEV_REF})…\n`);

for (const { email, ...perfil } of JUECES) {
  let cuenta = await buscarCuenta(email);

  if (cuenta) {
    const { error } = await db.auth.admin.updateUserById(cuenta.id, {
      password: PASSWORD, email_confirm: true,
    });
    if (error) { console.log(`  ✗  ${email}: ${error.message}`); continue; }
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true,
      user_metadata: { full_name: `${perfil.first_name} ${perfil.last_name}` },
    });
    if (error) { console.log(`  ✗  ${email}: ${error.message}`); continue; }
    cuenta = data.user;
  }

  // Aprobados a propósito: la policy de INSERT de evaluations exige juez
  // aprobado, así que sin esto la simulación no podría votar nada.
  const { error: errPerfil } = await db.from('profiles').update({
    ...perfil,
    role: 'juez',
    registration_status: 'aprobado',
    disciplinary_profile: 'docente',
    year_of_study: 'otro',
    is_egresado: true,
    judge_group: null,
  }).eq('id', cuenta.id);

  console.log(errPerfil
    ? `  ✗  ${email}: ${errPerfil.message}`
    : `  ✓  juez  ${email.padEnd(28)} ${perfil.first_name}`);
}

console.log('');

for (const equipo of EQUIPOS) {
  const { data: fila, error: errEquipo } = await db
    .from('teams')
    .upsert({ name: equipo.name, join_code: equipo.join_code }, { onConflict: 'join_code' })
    .select('id')
    .single();

  if (errEquipo) { console.log(`  ✗  ${equipo.name}: ${errEquipo.message}`); continue; }

  // El equipo va sin integrantes: para probar el reparto entre jueces alcanza
  // con que el proyecto exista, y poblar 12 equipos de 5 serían 60 cuentas de
  // ruido. El trigger de mínimo de integrantes deja pasar porque con la service
  // role key auth.uid() es NULL.
  const { error: errProyecto } = await db
    .from('projects')
    .upsert({ team_id: fila.id, ...equipo.proyecto, submitted_at: new Date().toISOString() },
            { onConflict: 'team_id' });

  console.log(errProyecto
    ? `  ✗  proyecto de ${equipo.name}: ${errProyecto.message}`
    : `  ✓  ${equipo.join_code}  ${equipo.name.padEnd(18)} «${equipo.proyecto.title}»`);
}

console.log(`\nListo. Contraseña de todos: ${PASSWORD}`);
console.log('Para borrar la simulación: node scripts/simular-jurado.mjs --borrar --si\n');
