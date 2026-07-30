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

  // Los 4 KPIs, con números de verdad (hay al menos el propio admin de prueba).
  const kpis = page.locator('.metrics-kpis .metric-value');
  await expect(kpis).toHaveCount(4);

  const total = Number((await kpis.first().innerText()).trim());
  expect(total).toBeGreaterThan(0);

  // El total tiene que ser la suma de los tres estados de inscripción.
  const porEstado = page.locator('.metrics-grid .admin-card').nth(0).locator('.metrics-list').nth(1);
  const valores = await porEstado.locator('strong').allInnerTexts();
  const suma = valores.reduce((acc, v) => acc + Number(v.trim()), 0);
  expect(suma).toBe(total);

  await context.close();
});

test('el gráfico dibuja una barra por día de las últimas 2 semanas', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await loginUi(page, ADMIN_EMAIL, E2E_PASSWORD);
  await page.goto('/admin');

  await expect(page.locator('.metrics-chart-card')).toBeVisible();
  await expect(page.locator('.chart-bar')).toHaveCount(14);
  await expect(page.locator('.chart-bar-label')).toHaveCount(14);

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
