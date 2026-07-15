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
