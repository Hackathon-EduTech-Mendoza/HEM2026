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
  limpiarDatosE2E,
  TestUser,
} from './utils';
import { criteriaFor, maxRawScore, rawScore, weightedScore } from '../../src/lib/rubric';
import type { EvaluationPhase } from '../../src/lib/rubric';

/**
 * Flujo completo de la app con todos los roles:
 *   participante (registro → equipo → proyecto) → juez (pendiente → aprobado → vota)
 *   → admin (aprueba, maneja fases, marca finalistas) → seguridad (RLS / middleware).
 *
 * Requiere un admin de prueba ya bootstrapeado (e2e.admin@hem2026.test, promovido por SQL).
 * Los tests son seriales: comparten estado del run (equipo, proyecto).
 */
test.describe.configure({ mode: 'serial' });

// La suite escribe en la base real, así que se limpia sola: si no, cada corrida
// deja 4 perfiles que la pestaña Métricas cuenta como inscripciones reales.
// Solo borra lo de su propio RUN_ID; el admin de prueba nunca se toca.
test.afterAll(async () => {
  try {
    const borrado = await limpiarDatosE2E(RUN_ID);
    console.log(
      `\n[limpieza ${RUN_ID}] ${borrado.perfiles} perfiles, ${borrado.cuentasAuth} cuentas de auth, ` +
        `${borrado.equipos} equipos, ${borrado.proyectos} proyectos, ${borrado.evaluaciones} evaluaciones.`,
    );
  } catch (e) {
    // No se falla la corrida por la limpieza, pero tiene que quedar a la vista:
    // si esto pasa seguido, la base se llena de datos de prueba.
    console.error(
      `\n[limpieza ${RUN_ID}] FALLÓ. Hay que borrar a mano con: npm run test:e2e:limpiar\n`,
      e,
    );
  }
});

// ── Estado compartido del run ──
const TEAM_NAME = `Equipo E2E ${RUN_ID}`;
const PROJECT_TITLE = `Proyecto E2E ${RUN_ID}`;
// Rúbrica 1 a 5 sin criterio de validación (ver src/lib/rubric.ts).
// La rúbrica depende de la fase: en preclasificación no se puntúa el pitch,
// así que estos puntajes NO llevan `communication`.
const PRE_SCORES = { problem: 4, solution: 3, innovation: 5, feasibility: 4, impact: 3 };
const FINAL_SCORES = { problem: 5, solution: 5, innovation: 4, feasibility: 5, impact: 4, communication: 5 };
const PRE_TOTAL = rawScore(PRE_SCORES, 'preclasificacion');
const FINAL_TOTAL = rawScore(FINAL_SCORES, 'final');
const PRE_WEIGHTED = weightedScore(PRE_SCORES, 'preclasificacion');
const PRE_MAX = maxRawScore('preclasificacion');
const FINAL_MAX = maxRawScore('final');
// Puntaje intermedio para probar la corrección de un voto ya guardado.
// Distinto de PRE_SCORES en todos los criterios, para que no haya falsos verdes.
const CORRECTED_SCORES = { problem: 2, solution: 5, innovation: 3, feasibility: 2, impact: 5 };
const CORRECTED_TOTAL = rawScore(CORRECTED_SCORES, 'preclasificacion');
const CORRECTED_WEIGHTED = weightedScore(CORRECTED_SCORES, 'preclasificacion');

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

/**
 * Puntúa cada criterio clickeando la opción 1-5 correspondiente.
 * Solo recorre los criterios de la fase: en preclasificación el formulario
 * no renderiza «Comunicación y pitch».
 */
async function fillEvaluation(
  page: Page,
  scores: Record<string, number>,
  phase: EvaluationPhase,
) {
  for (const c of criteriaFor(phase)) {
    await page
      .locator(`label.scale-option:has(input[name="score_${c.key}"][value="${scores[c.key]}"])`)
      .click();
  }
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

/**
 * Las páginas públicas se prerenderizan, así que el servidor no sabe quién sos y
 * el HTML sale siempre con los botones de "Iniciar Sesión / Registro". Ocultarlos
 * cuando hay sesión es tarea del navbar en el cliente.
 *
 * Estuvo roto hasta el 2026-08-03: la regla que los ocultaba apuntaba a
 * `#nav-auth-buttons`, un id que no existe, así que el `display: flex !important`
 * de `.desktop-only` le ganaba al estilo inline que pone checkAuth(). En
 * /dashboard y /admin no se notaba porque ahí el bloque se renderiza vacío.
 */
test('con sesión iniciada, las páginas públicas no ofrecen iniciar sesión', async ({ browser }) => {
  const page = await newPage(browser);
  await loginUi(page, participantAEmail, E2E_PASSWORD);

  await page.setViewportSize({ width: 1440, height: 900 });

  // El 404 incluido: también lleva el navbar.
  for (const ruta of ['/', '/noticias', '/ediciones', '/ruta-que-no-existe']) {
    await page.goto(ruta);

    await expect(
      page.locator('#nav-auth-buttons-desktop'),
      `${ruta} sigue ofreciendo iniciar sesión`,
    ).toBeHidden();

    // Y en su lugar tiene que estar el menú de usuario.
    await expect(page.locator('#userDropdown'), `${ruta} no muestra el menú de usuario`).toBeVisible();
  }

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

  // Retrasamos a propósito el fetch inicial del proyecto para poder observar
  // el estado de carga: es donde antes se perdía lo que la persona tipeaba.
  await page.route(
    (url) => url.pathname.endsWith('/rest/v1/projects') && url.searchParams.has('team_id'),
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await new Promise((r) => setTimeout(r, 2000));
      return route.fallback();
    },
  );

  await loginUi(page, participantAEmail, E2E_PASSWORD);
  await openDashboardTab(page, 'equipo');

  await expect(page.locator('#ps-active')).toBeVisible({ timeout: 20_000 });

  // Mientras carga: los campos están deshabilitados (así no se puede tipear
  // algo que la respuesta después pisaría) y el aviso lo explica. El campo
  // nunca debe tener "Cargando..." como valor.
  const title = page.locator('#ps-title');
  await expect(title).toBeDisabled();
  await expect(title).toHaveValue('');
  await expect(page.locator('#ps-last-saved')).toContainText('Cargando');

  // Cuando termina, el líder recupera el control.
  await expect(title).toBeEnabled({ timeout: 20_000 });
  await expect(title).not.toHaveValue('Cargando...');

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
  // "Otra institución" despliega un campo obligatorio para escribir el nombre
  await page.selectOption('#institution', 'otra');
  await expect(page.locator('#institution_other')).toBeVisible();
  await page.fill('#institution_other', `Instituto E2E ${RUN_ID}`);
  await page.selectOption('#disciplinary_profile', 'otro');
  await page.click('#submit-btn');

  // El juez con perfil completo va a /evaluacion; con estado pendiente ve el aviso de revisión
  await page.waitForURL(/\/(dashboard|evaluacion)/, { timeout: 20_000 });

  // El nombre libre de la institución quedó guardado en el perfil
  const perfilClient = newApiClient();
  await perfilClient.auth.signInWithPassword({ email: juezEmail, password: E2E_PASSWORD });
  const { data: perfil } = await perfilClient
    .from('profiles')
    .select('institution, institution_other')
    .eq('email', juezEmail)
    .single();
  expect(perfil?.institution).toBe('otra');
  expect(perfil?.institution_other).toBe(`Instituto E2E ${RUN_ID}`);

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
    score_problem: 5, score_solution: 5, score_innovation: 5,
    // Sin score_communication: en preclasificación va NULL por CHECK. Si se
    // mandara, el insert fallaría por el CHECK y no por RLS, que es lo que
    // este test quiere probar.
    score_feasibility: 5, score_impact: 5,
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
  await openAdminTab(page, 'tab-usuarios');

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

  await fillEvaluation(page, PRE_SCORES, 'preclasificacion');
  await page.fill('#feedback', 'Feedback E2E de preclasificación.');
  await page.click('#submit-eval-btn');

  await expect(page.locator('#toast-msg')).toContainText('guardada con éxito', { timeout: 15_000 });
  // Tras el reload, el proyecto aparece como evaluado con el total correcto
  await page.waitForLoadState('load');
  const completedCard = page.locator('.project-card.completed', { hasText: PROJECT_TITLE });
  await expect(completedCard).toBeVisible({ timeout: 20_000 });
  await expect(completedCard.locator('.score-value')).toContainText(`${PRE_TOTAL}/${PRE_MAX}`);
  await page.context().close();
});

// ═══════════════════════════════════════════════════════════
// 6b. JUEZ: corrige un voto ya guardado
//
// Antes esto era imposible: /evaluacion solo hacía insert y el
// UNIQUE(project_id, judge_id, phase) rechazaba el segundo intento. Un jurado
// que se equivocaba durante la jornada no tenía salida.
//
// El test termina restaurando PRE_SCORES para que los tests siguientes, que son
// seriales y esperan ese puntaje, sigan valiendo.
// ═══════════════════════════════════════════════════════════

test('juez corrige su voto de preclasificación', async ({ browser }) => {
  const page = await newPage(browser);
  await loginUi(page, juezEmail, E2E_PASSWORD);
  await page.goto('/evaluacion');

  const completedCard = page.locator('.project-card.completed', { hasText: PROJECT_TITLE });
  await expect(completedCard).toBeVisible({ timeout: 20_000 });
  await completedCard.locator('.evaluate-btn').click();
  await expect(page.locator('#eval-modal')).toBeVisible();

  // Se ve que es una corrección, no un voto nuevo.
  await expect(page.locator('#modal-editando')).toBeVisible();
  await expect(page.locator('#submit-eval-btn')).toHaveText('Actualizar Evaluación');

  // El modal llega con el voto anterior ya cargado: si no, el jurado tendría
  // que acordarse de lo que puso y volver a completar los 6 criterios.
  for (const c of criteriaFor('preclasificacion')) {
    await expect(
      page.locator(`input[name="score_${c.key}"][value="${PRE_SCORES[c.key as keyof typeof PRE_SCORES]}"]`),
    ).toBeChecked();
  }
  await expect(page.locator('#feedback')).toHaveValue('Feedback E2E de preclasificación.');

  // Corregir a otro puntaje
  await fillEvaluation(page, CORRECTED_SCORES, 'preclasificacion');
  await page.fill('#feedback', 'Feedback E2E corregido.');
  await page.click('#submit-eval-btn');
  await expect(page.locator('#toast-msg')).toContainText('actualizada', { timeout: 15_000 });

  await page.waitForLoadState('load');
  const cardTrasCorregir = page.locator('.project-card.completed', { hasText: PROJECT_TITLE });
  await expect(cardTrasCorregir).toHaveCount(1);
  await expect(cardTrasCorregir.locator('.score-value')).toContainText(
    `${CORRECTED_TOTAL}/${PRE_MAX}`,
  );
  // Y no quedó pendiente además de evaluado.
  await expect(page.locator('.project-card:not(.completed)', { hasText: PROJECT_TITLE })).toHaveCount(0);

  // El admin ve el puntaje corregido, y sigue habiendo UNA sola evaluación:
  // corregir no puede sumar un voto nuevo.
  const adminPage = await newPage(browser);
  await loginUi(adminPage, ADMIN_EMAIL, E2E_PASSWORD);
  await adminPage.goto('/admin');
  await openAdminTab(adminPage, 'tab-resultados');
  const row = adminPage.locator('#tab-resultados table').first().locator('tr', { hasText: PROJECT_TITLE });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(`${CORRECTED_TOTAL.toFixed(1)}/${PRE_MAX}`);
  await expect(row).toContainText(CORRECTED_WEIGHTED.toFixed(2));
  await adminPage.context().close();

  // Restaurar el voto original para los tests que siguen.
  await page.goto('/evaluacion');
  await page.locator('.project-card.completed', { hasText: PROJECT_TITLE }).locator('.evaluate-btn').click();
  await expect(page.locator('#eval-modal')).toBeVisible();
  await fillEvaluation(page, PRE_SCORES, 'preclasificacion');
  await page.fill('#feedback', 'Feedback E2E de preclasificación.');
  await page.click('#submit-eval-btn');
  await expect(page.locator('#toast-msg')).toContainText('actualizada', { timeout: 15_000 });
  await page.waitForLoadState('load');
  await expect(
    page.locator('.project-card.completed', { hasText: PROJECT_TITLE }).locator('.score-value'),
  ).toContainText(`${PRE_TOTAL}/${PRE_MAX}`);

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
  // El ranking ordena por el puntaje ponderado; también muestra la suma directa
  await expect(row).toContainText(PRE_WEIGHTED.toFixed(2));
  await expect(row).toContainText(`${PRE_TOTAL.toFixed(1)}/${PRE_MAX}`);

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

  await fillEvaluation(page, FINAL_SCORES, 'final');
  await page.fill('#feedback', 'Feedback E2E de ronda final.');
  await page.click('#submit-eval-btn');

  await expect(page.locator('#toast-msg')).toContainText('guardada con éxito', { timeout: 15_000 });
  const completedCard = page.locator('.project-card.completed', { hasText: PROJECT_TITLE });
  await expect(completedCard).toBeVisible({ timeout: 20_000 });
  await expect(completedCard.locator('.score-value')).toContainText(`${FINAL_TOTAL}/${FINAL_MAX}`);
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
    score_problem: 5, score_solution: 5, score_innovation: 5,
    // Sin score_communication: en preclasificación va NULL por CHECK. Si se
    // mandara, el insert fallaría por el CHECK y no por RLS, que es lo que
    // este test quiere probar.
    score_feasibility: 5, score_impact: 5,
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
