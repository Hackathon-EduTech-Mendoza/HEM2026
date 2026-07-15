import { test, expect, Page, Browser } from '@playwright/test';
import {
  RUN_ID,
  E2E_PASSWORD,
  ADMIN_EMAIL,
  emailFor,
  createUserApi,
  completeProfileApi,
  loginUi,
  openDashboardTab,
  openAdminTab,
  newApiClient,
  TestUser,
} from './utils';

/**
 * Flujo completo de la app con todos los roles:
 *   participante (registro → equipo → proyecto) → juez (pendiente → aprobado → vota)
 *   → admin (aprueba, maneja fases, marca finalistas) → seguridad (RLS / middleware).
 *
 * Requiere un admin de prueba ya bootstrapeado (e2e.admin@hem2026.test, promovido por SQL).
 * Los tests son seriales: comparten estado del run (equipo, proyecto).
 */
test.describe.configure({ mode: 'serial' });

// ── Estado compartido del run ──
const TEAM_NAME = `Equipo E2E ${RUN_ID}`;
const PROJECT_TITLE = `Proyecto E2E ${RUN_ID}`;
const PRE_SCORES = { problem: 8, solution: 7, innovation: 9, validation: 6, feasibility: 8, impact: 7, communication: 9 }; // total 54
const FINAL_SCORES = { problem: 9, solution: 9, innovation: 9, validation: 8, feasibility: 9, impact: 9, communication: 10 }; // total 63
const PRE_TOTAL = Object.values(PRE_SCORES).reduce((a, b) => a + b, 0);
const FINAL_TOTAL = Object.values(FINAL_SCORES).reduce((a, b) => a + b, 0);

let participantB: TestUser;
let participantC: TestUser;
let joinCode = '';
const participantAEmail = emailFor('participante-a');
const juezEmail = emailFor('juez');

// ── Helpers locales ──

async function newPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

async function setSlider(page: Page, id: string, value: number) {
  await page.locator(`#${id}`).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    input.value = String(v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function fillEvaluation(page: Page, scores: typeof PRE_SCORES) {
  await setSlider(page, 'score_problem', scores.problem);
  await setSlider(page, 'score_solution', scores.solution);
  await setSlider(page, 'score_innovation', scores.innovation);
  await setSlider(page, 'score_validation', scores.validation);
  await setSlider(page, 'score_feasibility', scores.feasibility);
  await setSlider(page, 'score_impact', scores.impact);
  await setSlider(page, 'score_communication', scores.communication);
}

async function adminSetPhase(page: Page, phase: 'cerrada' | 'preclasificacion' | 'deliberacion' | 'final') {
  await page.goto('/admin');
  await openAdminTab(page, 'tab-configuracion');
  await page.selectOption('#evaluation-phase-select', phase);
  await expect(page.locator('#toast-msg')).not.toContainText('Error', { timeout: 10_000 });
  // Esperar a que el select quede habilitado de nuevo (fin del update)
  await expect(page.locator('#evaluation-phase-select')).toBeEnabled();
}

// ═══════════════════════════════════════════════════════════
// 0. SETUP: estado inicial conocido
// ═══════════════════════════════════════════════════════════

test('setup: admin deja la fase de evaluación en cerrada', async ({ browser }) => {
  const page = await newPage(browser);
  await loginUi(page, ADMIN_EMAIL, E2E_PASSWORD);
  await adminSetPhase(page, 'cerrada');
  await page.context().close();
});

// ═══════════════════════════════════════════════════════════
// 1. PARTICIPANTE: registro y onboarding por UI
// ═══════════════════════════════════════════════════════════

test('participante A: registro por UI → onboarding → dashboard confirmado', async ({ browser }) => {
  const page = await newPage(browser);

  await page.goto('/registro');
  await page.fill('#email', participantAEmail);
  await page.fill('#password', E2E_PASSWORD);
  await page.click('#submit-btn');
  await page.waitForURL('**/onboarding', { timeout: 20_000 });

  // Paso 1: rol participante
  await page.click('.role-card[data-role="usuario"]');
  await page.click('#btn-to-step-2');

  // Paso 2: datos
  await page.fill('#first_name', 'Ana E2E');
  await page.fill('#last_name', `Prueba ${RUN_ID}`);
  await page.fill('#dni', `9${String(Date.now()).slice(-7)}`);
  await page.fill('#phone_whatsapp', '2611111111');
  await page.selectOption('#institution', 'ies_9023_maipu');
  await page.selectOption('#disciplinary_profile', 'tecnico');
  await page.selectOption('#year_of_study', 'segundo');
  await page.click('#submit-btn');
  await page.waitForURL('**/dashboard', { timeout: 20_000 });

  // Rediseño Mi Perfil: saludo + badge + credencial
  await expect(page.locator('.profile-greeting h2')).toContainText('Ana E2E');
  await expect(page.locator('.profile-status')).toContainText('Inscripción confirmada');
  await expect(page.locator('.credential-card')).toContainText('IES 9-023 Maipú');
  await page.context().close();
});

// ═══════════════════════════════════════════════════════════
// 2. EQUIPO: crear y unirse
// ═══════════════════════════════════════════════════════════

test('participante A crea el equipo y obtiene código', async ({ browser }) => {
  const page = await newPage(browser);
  await loginUi(page, participantAEmail, E2E_PASSWORD);

  await openDashboardTab(page, 'equipo');
  await page.fill('#team-name-input', TEAM_NAME);
  await page.click('#create-team-btn');

  await expect(page.locator('#team-in-team')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#team-display-name')).toContainText(TEAM_NAME);
  joinCode = (await page.locator('#team-display-code').innerText()).trim();
  expect(joinCode.length).toBeGreaterThanOrEqual(4);
  await page.context().close();
});

test('participantes B y C se unen con el código', async ({ browser }) => {
  participantB = await createUserApi('participante-b');
  await completeProfileApi(participantB, {
    first_name: 'Beto E2E',
    last_name: `Prueba ${RUN_ID}`,
    dni: `8${String(Date.now()).slice(-7)}`,
    disciplinary_profile: 'docente',
  });
  participantC = await createUserApi('participante-c');
  await completeProfileApi(participantC, {
    first_name: 'Caro E2E',
    last_name: `Prueba ${RUN_ID}`,
    dni: `7${String(Date.now()).slice(-7)}`,
    disciplinary_profile: 'tecnico',
  });

  // B se une por UI (flujo real)
  const page = await newPage(browser);
  await loginUi(page, participantB.email, E2E_PASSWORD);
  await openDashboardTab(page, 'equipo');
  await page.fill('#join-code-input', joinCode);
  await page.click('#join-team-btn');
  await expect(page.locator('#team-in-team')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#team-display-name')).toContainText(TEAM_NAME);
  await page.context().close();

  // C se une por API (mismo RPC que usa la UI)
  const { data, error } = await participantC.client.rpc('join_team', { p_join_code: joinCode });
  expect(error).toBeNull();
  expect(data?.success ?? data?.ok ?? true).toBeTruthy();
});

// ═══════════════════════════════════════════════════════════
// 3. PROYECTO: el líder entrega el proyecto
// ═══════════════════════════════════════════════════════════

test('participante A (líder) entrega el proyecto', async ({ browser }) => {
  const page = await newPage(browser);
  await loginUi(page, participantAEmail, E2E_PASSWORD);
  await openDashboardTab(page, 'equipo');

  await expect(page.locator('#ps-active')).toBeVisible({ timeout: 20_000 });
  // ProjectSubmission pone "Cargando..." en los campos y los limpia cuando
  // responde el fetch inicial; escribir antes de eso pierde lo tipeado.
  await page.waitForFunction(() => {
    const el = document.getElementById('ps-title') as HTMLInputElement | null;
    return !!el && el.value !== 'Cargando...' && !el.disabled;
  });
  await page.fill('#ps-title', PROJECT_TITLE);
  await page.fill('#ps-problem', 'Problema de prueba E2E: la gestión del hackathon es manual.');
  await page.fill('#ps-solution', 'Solución de prueba E2E: plataforma web que automatiza inscripción y evaluación.');
  await page.fill('#ps-prototype', 'https://example.com/prototipo-e2e');
  await page.click('#ps-submit-btn');

  await expect(page.locator('#ps-last-saved')).toContainText('Última modificación', { timeout: 20_000 });
  await page.context().close();
});

// ═══════════════════════════════════════════════════════════
// 4. JUEZ: registro queda pendiente de aprobación
// ═══════════════════════════════════════════════════════════

test('juez: registro por UI queda en revisión', async ({ browser }) => {
  const page = await newPage(browser);

  await page.goto('/registro');
  await page.fill('#email', juezEmail);
  await page.fill('#password', E2E_PASSWORD);
  await page.click('#submit-btn');
  await page.waitForURL('**/onboarding', { timeout: 20_000 });

  await page.click('.role-card[data-role="juez"]');
  await page.click('#btn-to-step-2');
  await page.fill('#first_name', 'Justo E2E');
  await page.fill('#last_name', `Juez ${RUN_ID}`);
  await page.fill('#dni', `6${String(Date.now()).slice(-7)}`);
  await page.fill('#phone_whatsapp', '2612222222');
  await page.selectOption('#institution', 'otra');
  await page.selectOption('#disciplinary_profile', 'otro');
  await page.click('#submit-btn');

  // El juez con perfil completo va a /evaluacion; con estado pendiente ve el aviso de revisión
  await page.waitForURL(/\/(dashboard|evaluacion)/, { timeout: 20_000 });
  await page.goto('/evaluacion');
  await expect(page.locator('body')).toContainText('revisión');
  // Y no debe ver proyectos
  await expect(page.locator('.project-card')).toHaveCount(0);
  await page.context().close();

  // Tampoco puede votar por API (RLS exige juez aprobado)
  const juezClient = newApiClient();
  const { data: auth } = await juezClient.auth.signInWithPassword({ email: juezEmail, password: E2E_PASSWORD });
  const { data: projects } = await juezClient.from('projects').select('id').limit(1);
  const { error: rlsError } = await juezClient.from('evaluations').insert({
    project_id: projects![0].id,
    judge_id: auth!.user!.id,
    phase: 'preclasificacion',
    score_problem: 5, score_solution: 5, score_innovation: 5, score_validation: 5,
    score_feasibility: 5, score_impact: 5, score_communication: 5,
  });
  expect(rlsError).not.toBeNull();
});

// ═══════════════════════════════════════════════════════════
// 5. ADMIN: aprueba al juez y abre la preclasificación
// ═══════════════════════════════════════════════════════════

test('admin aprueba al juez y habilita fase preclasificación', async ({ browser }) => {
  const page = await newPage(browser);
  await loginUi(page, ADMIN_EMAIL, E2E_PASSWORD);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin/);

  // Ubicar la fila del juez por email y aprobarlo
  const juezRow = page.locator('tr.user-row', { hasText: juezEmail });
  await expect(juezRow).toHaveCount(1);
  await juezRow.locator('select.status-select').selectOption('aprobado');
  await expect(page.locator('#toast-msg')).toContainText('Usuario actualizado', { timeout: 10_000 });

  // Abrir fase de preclasificación
  await adminSetPhase(page, 'preclasificacion');
  await page.context().close();
});

// ═══════════════════════════════════════════════════════════
// 6. JUEZ: vota en preclasificación
// ═══════════════════════════════════════════════════════════

test('juez vota el proyecto en preclasificación', async ({ browser }) => {
  const page = await newPage(browser);
  await loginUi(page, juezEmail, E2E_PASSWORD);
  await page.goto('/evaluacion');

  await expect(page.locator('.phase-badge')).toContainText('Preclasificación');

  const card = page.locator('.project-card', { hasText: PROJECT_TITLE });
  await expect(card).toBeVisible();
  await card.locator('.evaluate-btn').click();
  await expect(page.locator('#eval-modal')).toBeVisible();

  await fillEvaluation(page, PRE_SCORES);
  await page.fill('#feedback', 'Feedback E2E de preclasificación.');
  await page.click('#submit-eval-btn');

  await expect(page.locator('#toast-msg')).toContainText('guardada con éxito', { timeout: 15_000 });
  // Tras el reload, el proyecto aparece como evaluado con el total correcto
  await page.waitForLoadState('load');
  const completedCard = page.locator('.project-card.completed', { hasText: PROJECT_TITLE });
  await expect(completedCard).toBeVisible({ timeout: 20_000 });
  await expect(completedCard.locator('.score-value')).toContainText(`${PRE_TOTAL}/70`);
  await page.context().close();
});

// ═══════════════════════════════════════════════════════════
// 7. ADMIN: resultados, finalistas y ronda final
// ═══════════════════════════════════════════════════════════

test('admin ve el puntaje, marca finalista y habilita la ronda final', async ({ browser }) => {
  const page = await newPage(browser);
  await loginUi(page, ADMIN_EMAIL, E2E_PASSWORD);
  await page.goto('/admin');
  await openAdminTab(page, 'tab-resultados');

  // El proyecto aparece en el ranking de preclasificación con 1 evaluación y el puntaje esperado
  const row = page.locator('#tab-resultados table').first().locator('tr', { hasText: PROJECT_TITLE });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(`${PRE_TOTAL}.00`);

  // Marcar finalista y guardar
  await row.locator('.finalist-checkbox').check();
  await page.click('#save-finalists-btn');
  await expect(page.locator('#toast-msg')).toContainText(/finalistas/i, { timeout: 10_000 });
  // Guardar finalistas dispara un window.location.reload() al segundo: esperarlo
  await page.waitForTimeout(1500);
  await page.waitForLoadState('load');

  // Pasar por deliberación y abrir la ronda final
  await adminSetPhase(page, 'deliberacion');
  await adminSetPhase(page, 'final');
  await page.context().close();
});

// ═══════════════════════════════════════════════════════════
// 8. JUEZ: vota en ronda final (solo finalistas)
// ═══════════════════════════════════════════════════════════

test('juez vota al finalista en la ronda final', async ({ browser }) => {
  const page = await newPage(browser);
  await loginUi(page, juezEmail, E2E_PASSWORD);
  await page.goto('/evaluacion');

  await expect(page.locator('.phase-badge')).toContainText(/final/i);

  const card = page.locator('.project-card', { hasText: PROJECT_TITLE });
  await expect(card).toBeVisible();
  await card.locator('.evaluate-btn').click();
  await expect(page.locator('#eval-modal')).toBeVisible();

  await fillEvaluation(page, FINAL_SCORES);
  await page.fill('#feedback', 'Feedback E2E de ronda final.');
  await page.click('#submit-eval-btn');

  await expect(page.locator('#toast-msg')).toContainText('guardada con éxito', { timeout: 15_000 });
  const completedCard = page.locator('.project-card.completed', { hasText: PROJECT_TITLE });
  await expect(completedCard).toBeVisible({ timeout: 20_000 });
  await expect(completedCard.locator('.score-value')).toContainText(`${FINAL_TOTAL}/70`);
  await page.context().close();
});

// ═══════════════════════════════════════════════════════════
// 9. SEGURIDAD: middleware y RLS
// ═══════════════════════════════════════════════════════════

test('seguridad: participante no accede a /admin ni /evaluacion', async ({ browser }) => {
  const page = await newPage(browser);
  await loginUi(page, participantB.email, E2E_PASSWORD);

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto('/evaluacion');
  await expect(page).toHaveURL(/\/dashboard/);
  await page.context().close();
});

test('seguridad: participante no puede escalar su rol a admin', async () => {
  const { error } = await participantB.client
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', participantB.id);
  expect(error).not.toBeNull();
});

test('seguridad: nadie puede votar fuera de la fase activa (RLS)', async () => {
  // La fase activa es 'final': un insert con phase='preclasificacion' debe fallar por RLS.
  const juezClient = newApiClient();
  const { data: auth, error: loginError } = await juezClient.auth.signInWithPassword({
    email: juezEmail,
    password: E2E_PASSWORD,
  });
  expect(loginError).toBeNull();

  const { data: projects } = await juezClient.from('projects').select('id').limit(1);
  const projectId = projects?.[0]?.id;
  expect(projectId).toBeTruthy();

  const { error } = await juezClient.from('evaluations').insert({
    project_id: projectId,
    judge_id: auth!.user!.id,
    phase: 'preclasificacion',
    score_problem: 5, score_solution: 5, score_innovation: 5, score_validation: 5,
    score_feasibility: 5, score_impact: 5, score_communication: 5,
  });
  expect(error).not.toBeNull();
});

// ═══════════════════════════════════════════════════════════
// 10. CIERRE: admin cierra la evaluación y el juez lo ve
// ═══════════════════════════════════════════════════════════

test('admin cierra la evaluación y el juez ve el aviso', async ({ browser }) => {
  const adminPage = await newPage(browser);
  await loginUi(adminPage, ADMIN_EMAIL, E2E_PASSWORD);
  await adminSetPhase(adminPage, 'cerrada');
  await adminPage.context().close();

  const juezPage = await newPage(browser);
  await loginUi(juezPage, juezEmail, E2E_PASSWORD);
  await juezPage.goto('/evaluacion');
  await expect(juezPage.locator('body')).toContainText('Evaluaciones Cerradas');
  await juezPage.context().close();
});
