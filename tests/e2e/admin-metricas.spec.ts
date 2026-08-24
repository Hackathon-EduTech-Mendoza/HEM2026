import { test, expect } from '@playwright/test';
import { loginUi, openAdminTab, ADMIN_EMAIL, E2E_PASSWORD } from './utils';

/**
 * Pestaña Métricas del Centro de Comando. Solo lee: no crea ni modifica nada,
 * así que se puede correr suelta sin ensuciar la base:
 *   npx playwright test admin-metricas
 *
 * Requiere el admin de prueba ya bootstrapeado (ver tests/e2e/utils.ts).
 */

test('Métricas es la pestaña por defecto y muestra los conteos', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await loginUi(page, ADMIN_EMAIL, E2E_PASSWORD);
  await page.goto('/admin');

  // Entrar al panel cae en Métricas sin tener que hacer click.
  await expect(page.locator('#tab-metricas')).toBeVisible();
  await expect(page.locator('.tab-btn[data-target="tab-metricas"]')).toHaveClass(/active/);

  // Los 5 KPIs, con números de verdad (hay al menos el propio admin de prueba).
  // Acotado a #tab-metricas: otras pestañas (Encuesta) reusan estas mismas
  // clases y todas conviven en el DOM, así que un selector global cuenta de más.
  const kpis = page.locator('#tab-metricas .metrics-kpis .metric-value');
  await expect(kpis).toHaveCount(5);

  const total = Number((await kpis.first().innerText()).trim());
  expect(total).toBeGreaterThan(0);

  // El total tiene que ser la suma de los tres estados de inscripción. La fila
  // de "Registro incompleto" queda afuera a propósito: no son inscriptos.
  const porEstado = page.locator('#tab-metricas .metrics-grid .admin-card').nth(0).locator('.metrics-list').nth(1);
  const valores = await porEstado.locator('li:not(.metrics-list-aside) strong').allInnerTexts();
  const suma = valores.reduce((acc, v) => acc + Number(v.trim()), 0);
  expect(suma).toBe(total);

  await context.close();
});

test('los registros abandonados se cuentan aparte y no inflan la cola de aprobación', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await loginUi(page, ADMIN_EMAIL, E2E_PASSWORD);
  await page.goto('/admin');

  // El KPI de incompletos y la fila aparte de "Por estado" tienen que coincidir:
  // son el mismo número calculado en dos lugares de la pantalla.
  const kpiIncompletos = Number(
    (await page.locator('#tab-metricas .metrics-kpis .metric-card').nth(3).locator('.metric-value').innerText()).trim(),
  );
  const filaAparte = Number(
    (await page.locator('#tab-metricas .metrics-list-aside strong').innerText()).trim(),
  );
  expect(filaAparte).toBe(kpiIncompletos);

  // En Usuarios, el filtro de completitud deja ver exactamente esas filas, y
  // todas las visibles llevan el badge.
  await openAdminTab(page, 'tab-usuarios');
  await page.selectOption('#filter-completitud', 'incompleto');

  const visibles = page.locator('#tab-usuarios .user-row:visible');
  await expect(visibles).toHaveCount(kpiIncompletos);
  await expect(page.locator('#tab-usuarios .user-row:visible .badge-incompleto')).toHaveCount(
    kpiIncompletos,
  );

  // Y el complemento: completos + incompletos son todos los registros.
  await page.selectOption('#filter-completitud', 'completo');
  const completos = await visibles.count();
  await page.selectOption('#filter-completitud', 'all');
  expect(await visibles.count()).toBe(completos + kpiIncompletos);

  await context.close();
});

test('el gráfico dibuja una barra por día de las últimas 2 semanas', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await loginUi(page, ADMIN_EMAIL, E2E_PASSWORD);
  await page.goto('/admin');

  await expect(page.locator('.metrics-chart-card')).toBeVisible();
  // Acotado a la tarjeta del gráfico: la pestaña Encuesta dibuja sus propias
  // barras con las mismas clases y estaban entrando en el conteo.
  const grafico = page.locator('#tab-metricas .metrics-chart-card');
  await expect(grafico.locator('.chart-bar')).toHaveCount(14);
  await expect(grafico.locator('.chart-bar-label')).toHaveCount(14);

  await context.close();
});

test('las otras pestañas siguen funcionando', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await loginUi(page, ADMIN_EMAIL, E2E_PASSWORD);
  await page.goto('/admin');

  // La pestaña nueva no debe haber roto la navegación existente.
  for (const target of [
    'tab-usuarios',
    'tab-configuracion',
    'tab-mentoria',
    'tab-resultados',
    'tab-comunicados',
    'tab-presentaciones',
  ]) {
    await openAdminTab(page, target);
    await expect(page.locator(`#${target}`)).toHaveClass(/active/);
  }

  // Y se puede volver a Métricas.
  await openAdminTab(page, 'tab-metricas');
  await expect(page.locator('#tab-metricas')).toHaveClass(/active/);

  await context.close();
});

test('el ranking marca cuál es el puntaje oficial', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await loginUi(page, ADMIN_EMAIL, E2E_PASSWORD);
  await page.goto('/admin');
  await openAdminTab(page, 'tab-resultados');

  // Decisión del admin del concurso: el oficial es el ponderado.
  await expect(page.locator('#tab-resultados').getByText('(oficial)').first()).toBeVisible();
  await expect(page.locator('#tab-resultados').getByText('(referencia)').first()).toBeVisible();

  await context.close();
});
