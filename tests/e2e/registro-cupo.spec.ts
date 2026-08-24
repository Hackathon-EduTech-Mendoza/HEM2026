import { test, expect } from '@playwright/test';

/**
 * Cierre de la inscripción por cupo lleno (24/08).
 *
 * No toca la base ni necesita sesión: se intercepta `/api/cupo` para simular
 * cada estado. Poner la base de dev en 300 participantes para probar esto
 * sería carísimo de montar y de limpiar, y lo que hay que verificar acá es la
 * reacción de la página al número, no el número.
 *
 *   npx playwright test registro-cupo
 */

const CUPO_LLENO = {
  inscriptos: 305,
  efectivos: 255,
  maximo: 300,
  restantes: 0,
  porcentaje: 100,
  estado: 'completo',
  hayLugar: false,
};

const CUPO_CON_LUGAR = {
  inscriptos: 242,
  efectivos: 200,
  maximo: 300,
  restantes: 58,
  porcentaje: 81,
  estado: 'disponible',
  hayLugar: true,
};

/** Fija la respuesta de `/api/cupo` para la navegación que sigue. */
async function fijarCupo(page: import('@playwright/test').Page, cupo: unknown) {
  await page.route('**/api/cupo', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cupo) }),
  );
}

test.describe('/registro con el cupo lleno', () => {
  test('esconde el formulario y explica que la inscripción cerró', async ({ page }) => {
    await fijarCupo(page, CUPO_LLENO);
    await page.goto('/registro');

    await expect(page.locator('#registro-cerrado')).toBeVisible();
    await expect(page.locator('#register-form')).toBeHidden();
    await expect(page.locator('#auth-title')).toHaveText('Inscripción cerrada');
    // Quien ya tiene cuenta no queda huérfano: el camino a /login sigue a mano.
    await expect(page.locator('#registro-cerrado a[href="/login"]')).toBeVisible();
  });

  /**
   * La razón de ser de la puerta aparte: mentores y jueces no ocupan cupo y
   * entran por el mismo signup, así que cerrarles el alta los dejaría afuera.
   */
  test('mentores y jueces conservan la puerta abierta', async ({ page }) => {
    for (const rol of ['mentor', 'juez']) {
      await fijarCupo(page, CUPO_LLENO);
      await page.goto(`/registro?rol=${rol}`);

      await expect(page.locator('#register-form')).toBeVisible();
      await expect(page.locator('#registro-cerrado')).toBeHidden();
      await expect(page.locator('#rol-aviso')).toContainText(rol);
    }
  });

  /** Un rol inventado en la barra de direcciones no destraba nada. */
  test('un ?rol= que no está en la lista blanca no abre la puerta', async ({ page }) => {
    await fijarCupo(page, CUPO_LLENO);
    await page.goto('/registro?rol=admin');

    await expect(page.locator('#registro-cerrado')).toBeVisible();
    await expect(page.locator('#register-form')).toBeHidden();
    await expect(page.locator('#rol-aviso')).toBeHidden();
  });
});

test.describe('/registro con lugar disponible', () => {
  test('el formulario se muestra normal', async ({ page }) => {
    await fijarCupo(page, CUPO_CON_LUGAR);
    await page.goto('/registro');

    await expect(page.locator('#register-form')).toBeVisible();
    await expect(page.locator('#registro-cerrado')).toBeHidden();
    await expect(page.locator('#rol-aviso')).toBeHidden();
  });
});

/**
 * El modo de falla importa tanto como el caso feliz: `/api/cupo` ya se cayó una
 * vez con un 503 por una env var faltante. Si esa caída cerrara el registro,
 * un error de configuración dejaría a todo el mundo —mentores incluidos— sin
 * poder anotarse, y en silencio. Ante la duda se deja intentar y decide el
 * trigger de la base.
 */
test.describe('/registro si /api/cupo se cae', () => {
  test('un 503 deja el formulario abierto', async ({ page }) => {
    await page.route('**/api/cupo', route => route.fulfill({ status: 503, body: '{}' }));
    await page.goto('/registro');

    await expect(page.locator('#register-form')).toBeVisible();
    await expect(page.locator('#registro-cerrado')).toBeHidden();
  });

  test('una respuesta ilegible deja el formulario abierto', async ({ page }) => {
    await page.route('**/api/cupo', route => route.abort());
    await page.goto('/registro');

    await expect(page.locator('#register-form')).toBeVisible();
    await expect(page.locator('#registro-cerrado')).toBeHidden();
  });
});
