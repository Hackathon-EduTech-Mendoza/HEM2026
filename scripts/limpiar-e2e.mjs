// scripts/limpiar-e2e.mjs
//
// Barre los datos de prueba que quedaron de corridas viejas de la suite E2E.
// La suite ahora se limpia sola al terminar, así que esto es la red de
// seguridad: sirve si una corrida se cortó a la mitad o si la limpieza falló.
//
// Uso:
//   npm run test:e2e:limpiar            -> muestra qué borraría (no borra nada)
//   npm run test:e2e:limpiar -- --si    -> borra de verdad
//
// NUNCA borra e2e.admin@hem2026.test: es fijo, hay que promoverlo a admin por
// SQL a mano y sin él la suite entera deja de correr.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const CONFIRMAR = process.argv.includes('--si');
const ADMIN_EMAIL = 'e2e.admin@hem2026.test';

const env = {};
for (const line of readFileSync('.env', 'utf-8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}

if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY en el .env.');
  process.exit(1);
}

const db = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Qué hay ──
const { data: perfiles, error } = await db
  .from('profiles')
  .select('id, email, role, created_at')
  .like('email', 'e2e.%@hem2026.test')
  .neq('email', ADMIN_EMAIL)
  .order('created_at');

if (error) {
  console.error('No se pudo consultar profiles:', error.message);
  process.exit(1);
}

const { data: equipos } = await db.from('teams').select('id, name').like('name', 'Equipo E2E %');

console.log(`\nPerfiles de prueba: ${perfiles.length}`);
for (const p of perfiles) {
  console.log(`  ${p.created_at.slice(0, 16)}  ${p.role.padEnd(8)} ${p.email}`);
}
console.log(`Equipos de prueba: ${equipos?.length ?? 0}`);
for (const t of equipos ?? []) console.log(`  ${t.name}`);
console.log(`\nSe conserva siempre: ${ADMIN_EMAIL}`);

if (perfiles.length === 0 && (equipos?.length ?? 0) === 0) {
  console.log('\nNo hay nada que limpiar.');
  process.exit(0);
}

if (!CONFIRMAR) {
  console.log('\nNada se borró. Para borrar de verdad:\n  npm run test:e2e:limpiar -- --si\n');
  process.exit(0);
}

// ── Borrado, en el orden que exigen las FK ──
const idsPerfiles = perfiles.map((p) => p.id);
const idsEquipos = (equipos ?? []).map((t) => t.id);

let idsProyectos = [];
if (idsEquipos.length > 0) {
  const { data } = await db.from('projects').select('id').in('team_id', idsEquipos);
  idsProyectos = (data ?? []).map((p) => p.id);
}

if (idsProyectos.length > 0) {
  await db.from('evaluations').delete().in('project_id', idsProyectos);
}

if (idsEquipos.length > 0) {
  await db.from('help_requests').delete().in('team_id', idsEquipos);
  await db.from('projects').delete().in('team_id', idsEquipos);
  // Cortar la referencia antes del equipo: teams.leader_id es NO ACTION.
  await db.from('profiles').update({ team_id: null }).in('team_id', idsEquipos);
  await db.from('teams').delete().in('id', idsEquipos);
}

if (idsPerfiles.length > 0) {
  const { error: e } = await db.from('profiles').delete().in('id', idsPerfiles);
  if (e) console.error('Error borrando perfiles:', e.message);
}

// profiles no tiene FK contra auth.users: hay que borrar las dos puntas o queda
// la cuenta fantasma y el email no se puede volver a registrar.
let cuentas = 0;
for (const id of idsPerfiles) {
  const { error: e } = await db.auth.admin.deleteUser(id);
  if (e) console.error(`  no se pudo borrar la cuenta ${id}: ${e.message}`);
  else cuentas++;
}

console.log(
  `\nListo: ${idsPerfiles.length} perfiles, ${cuentas} cuentas de auth, ` +
    `${idsEquipos.length} equipos, ${idsProyectos.length} proyectos.`,
);

// ── Estado final, para dejarlo a la vista ──
const { data: cfg } = await db
  .from('event_config')
  .select('key, value')
  .eq('key', 'evaluation_phase')
  .single();
console.log(`evaluation_phase quedó en: ${cfg?.value}`);

const { count } = await db.from('profiles').select('id', { count: 'exact', head: true });
console.log(`Perfiles totales en la base: ${count}`);
