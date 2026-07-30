import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Env (leemos el .env del proyecto a mano, sin depender de dotenv) ──
function parseEnv(): Record<string, string> {
  const raw = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
  const env: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = parseEnv();
export const SUPABASE_URL = env.PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = env.PUBLIC_SUPABASE_ANON_KEY;
/** Necesaria solo para la limpieza: borrar cuentas de auth pide service role. */
export const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

// ── Identidades de prueba ──
// Sufijo por corrida para no chocar con datos de corridas anteriores.
export const RUN_ID = Date.now().toString(36);
export const E2E_PASSWORD = 'E2eHem2026!pass';
// El admin es fijo: se bootstrapea una sola vez (signup + promoción por SQL).
export const ADMIN_EMAIL = 'e2e.admin@hem2026.test';

export const emailFor = (name: string) => `e2e.${name}.${RUN_ID}@hem2026.test`;

export function newApiClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface TestUser {
  email: string;
  password: string;
  id: string;
  client: SupabaseClient;
}

/**
 * Crea un usuario por la API (mismo flujo que la UI: signUp con anon key).
 * Requiere que la confirmación de email esté deshabilitada en Supabase Auth.
 */
export async function createUserApi(name: string): Promise<TestUser> {
  const client = newApiClient();
  const email = emailFor(name);
  const { data, error } = await client.auth.signUp({ email, password: E2E_PASSWORD });
  if (error) throw new Error(`signUp falló para ${email}: ${error.message}`);
  if (!data.session || !data.user) {
    throw new Error(
      `signUp no devolvió sesión para ${email}. ¿Está activada la confirmación de email en Supabase Auth?`
    );
  }
  return { email, password: E2E_PASSWORD, id: data.user.id, client };
}

/** Completa el perfil como lo hace el onboarding (participante auto-aprobado). */
export async function completeProfileApi(
  user: TestUser,
  opts: {
    first_name: string;
    last_name: string;
    dni: string;
    role?: 'usuario' | 'mentor' | 'juez';
    disciplinary_profile?: 'tecnico' | 'docente' | 'otro';
    is_egresado?: boolean;
  }
) {
  const { error } = await user.client
    .from('profiles')
    .update({
      first_name: opts.first_name,
      last_name: opts.last_name,
      dni: opts.dni,
      phone_whatsapp: '2610000000',
      institution: 'ies_9023_maipu',
      disciplinary_profile: opts.disciplinary_profile ?? 'tecnico',
      year_of_study: 'segundo',
      is_egresado: opts.is_egresado ?? false,
      role: opts.role ?? 'usuario',
    })
    .eq('id', user.id);
  if (error) throw new Error(`No se pudo completar el perfil de ${user.email}: ${error.message}`);
}

// ── Helpers de UI ──

export async function loginUi(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('#submit-btn');
  // El login redirige según rol (dashboard / evaluacion / mentoria / admin vía nav)
  await page.waitForURL(/\/(dashboard|evaluacion|mentoria|onboarding)/, { timeout: 20_000 });
}

export async function logoutUi(page: Page) {
  // Cerrar sesión borrando cookies del contexto (más robusto que buscar el botón)
  await page.context().clearCookies();
}

/** Abre una pestaña del dashboard (perfil | equipo | recursos | sos). */
export async function openDashboardTab(page: Page, tab: string) {
  await page.click(`.tab-btn[data-tab="${tab}"]`);
  await page.waitForSelector(`#tab-${tab}.active`, { state: 'visible' });
}

/** Abre una pestaña del panel admin por data-target. */
export async function openAdminTab(page: Page, target: string) {
  await page.click(`.admin-tabs-nav .tab-btn[data-target="${target}"]`);
  await page.waitForSelector(`#${target}`, { state: 'visible' });
}

// ══════════════════════════════════════════════════════════════
// Limpieza
//
// La suite corre contra la base real, así que si no borra lo que crea, cada
// corrida deja 4 perfiles, 1 equipo, 1 proyecto y 2 evaluaciones. Eso ensucia
// los conteos de la pestaña Métricas del admin, que los cuenta como
// inscripciones reales.
//
// El admin de prueba (`ADMIN_EMAIL`) NO se borra nunca: es fijo, se bootstrapea
// una sola vez y hay que promoverlo a admin por SQL a mano.
// ══════════════════════════════════════════════════════════════

/** Cliente con service role: hace falta para borrar cuentas de `auth.users`. */
export function newServiceClient(): SupabaseClient {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Falta SUPABASE_SERVICE_ROLE_KEY en el .env: sin ella no se pueden borrar las cuentas de auth.',
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Borra todo lo que dejó una corrida. Con `runId` limpia solo esa corrida; sin
 * argumento barre **todas** las sobras `e2e.*` menos el admin fijo.
 *
 * El orden importa y no es intercambiable:
 *   1. `evaluations` — apuntan al proyecto y al juez.
 *   2. `help_requests` — apuntan al equipo.
 *   3. `projects` — apuntan al equipo.
 *   4. `profiles.team_id = null` — para que nadie apunte al equipo.
 *   5. `teams` — antes que los perfiles, porque `teams.leader_id` es NO ACTION
 *      y el equipo tiene que morir antes que el perfil de su líder.
 *   6. `profiles`.
 *   7. Cuentas de `auth.users` — `profiles` no tiene FK contra `auth.users`, así
 *      que hay que hacer las dos puntas o queda la cuenta fantasma y el email no
 *      se puede volver a registrar.
 */
export async function limpiarDatosE2E(runId?: string): Promise<{
  perfiles: number;
  equipos: number;
  proyectos: number;
  evaluaciones: number;
  cuentasAuth: number;
}> {
  const db = newServiceClient();
  const patronEmail = runId ? `e2e.%.${runId}@hem2026.test` : 'e2e.%@hem2026.test';
  const patronEquipo = runId ? `Equipo E2E ${runId}` : 'Equipo E2E %';

  // Perfiles de la corrida, sin tocar nunca el admin fijo.
  const { data: perfiles } = await db
    .from('profiles')
    .select('id, email')
    .like('email', patronEmail)
    .neq('email', ADMIN_EMAIL);

  const idsPerfiles = (perfiles ?? []).map((p) => p.id);

  const { data: equipos } = await db
    .from('teams')
    .select('id')
    .like('name', patronEquipo);
  const idsEquipos = (equipos ?? []).map((t) => t.id);

  let idsProyectos: string[] = [];
  if (idsEquipos.length > 0) {
    const { data: proyectos } = await db
      .from('projects')
      .select('id')
      .in('team_id', idsEquipos);
    idsProyectos = (proyectos ?? []).map((p) => p.id);
  }

  let evaluaciones = 0;
  if (idsProyectos.length > 0) {
    const { count } = await db
      .from('evaluations')
      .delete({ count: 'exact' })
      .in('project_id', idsProyectos);
    evaluaciones = count ?? 0;
  }

  if (idsEquipos.length > 0) {
    await db.from('help_requests').delete().in('team_id', idsEquipos);
    await db.from('projects').delete().in('team_id', idsEquipos);
    // Cortar la referencia antes de borrar el equipo.
    await db.from('profiles').update({ team_id: null }).in('team_id', idsEquipos);
    await db.from('teams').delete().in('id', idsEquipos);
  }

  if (idsPerfiles.length > 0) {
    await db.from('profiles').delete().in('id', idsPerfiles);
  }

  // Las cuentas de auth van al final, y de a una: no hay borrado masivo.
  let cuentasAuth = 0;
  for (const id of idsPerfiles) {
    const { error } = await db.auth.admin.deleteUser(id);
    if (!error) cuentasAuth++;
  }

  return {
    perfiles: idsPerfiles.length,
    equipos: idsEquipos.length,
    proyectos: idsProyectos.length,
    evaluaciones,
    cuentasAuth,
  };
}
