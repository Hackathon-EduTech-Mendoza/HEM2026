import { test, expect } from '@playwright/test';
import { loginUi, ADMIN_EMAIL, E2E_PASSWORD } from './utils';

/**
 * El admin puede entrar a /evaluacion (el middleware lo deja), pero no puede
 * votar: la policy RLS de INSERT de `evaluations` exige `role = 'juez'`. Antes
 * veía la interfaz de votación igual y guardar fallaba con un error críptico.
 *
 * Solo lee, así que se puede correr suelta:
 *   npx playwright test admin-evaluacion
 *
 * Escrita para valer en cualquier fase: no fija cuál está activa, porque
 * `evaluation_phase` se cambia desde el admin y no queremos que este test se
 * caiga por eso.
 */

test('el admin nunca ve la interfaz de votación en /evaluacion', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await loginUi(page, ADMIN_EMAIL, E2E_PASSWORD);
  await page.goto('/evaluacion');

  // No lo echa: la página es visible para admin.
  await expect(page).toHaveURL(/\/evaluacion/);
  await expect(page.locator('.eval-header h1')).toBeVisible();

  // Pero sí lo frena antes de ofrecerle algo que no puede guardar.
  await expect(page.locator('.warning-card')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Evaluar/ })).toHaveCount(0);
  await expect(page.locator('.eval-sections')).toHaveCount(0);

  // Y le dice adónde ir en vez de dejarlo en un cartel mudo.
  await expect(page.locator('.warning-note a[href="/admin"]')).toBeVisible();

  await context.close();
});
