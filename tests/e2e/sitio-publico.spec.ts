import { test, expect } from '@playwright/test';

/**
 * Sitio público: navegación, noticias y feed. No toca la base ni necesita
 * sesión, así que se puede correr solo:
 *   npx playwright test sitio-publico
 */

test.describe('navegación a noticias', () => {
  test('el navbar tiene el link a /noticias y lleva al listado', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('.nav-links a[href="/noticias"]');
    await expect(link).toHaveCount(1);
    await link.click();
    await expect(page).toHaveURL(/\/noticias\/?$/);
  });

  test('el footer tiene el link a /noticias', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.ftr-links a[href="/noticias"]')).toHaveCount(1);
  });

  test('/noticias se alcanza directo y lista las noticias', async ({ page }) => {
    await page.goto('/noticias');
    // Hay al menos las cinco notas cargadas al momento de escribir el test.
    const tarjetas = page.locator('.news-grid .news-card');
    expect(await tarjetas.count()).toBeGreaterThanOrEqual(5);
  });
});

test.describe('nota de prensa externa', () => {
  test('la nota de El Nueve aparece y apunta al medio', async ({ page }) => {
    await page.goto('/noticias');
    const link = page.locator('a[href*="elnueve.com"]').first();
    await expect(link).toHaveAttribute('href', /elnueve\.com/);
    // Prensa externa nunca debe generar página propia dentro del sitio.
    const respuesta = await page.request.get('/noticias/elnueve-nueva-forma-de-innovar-en-educacion');
    expect(respuesta.status()).toBe(404);
  });
});

test.describe('nota interna de la rectora', () => {
  const slug = '/noticias/rectora-ies-9023-en-cada-dia-el-nueve';

  test('todas las imágenes tienen alt descriptivo', async ({ page }) => {
    await page.goto(slug);
    // Solo las de la nota: el logo del navbar y del footer llevan un alt corto
    // a propósito.
    const imgs = page.locator('main img');
    const total = await imgs.count();
    expect(total).toBeGreaterThan(0);

    for (let i = 0; i < total; i++) {
      const alt = await imgs.nth(i).getAttribute('alt');
      // El alt vacío es válido en HTML para imágenes decorativas, pero acá
      // todas son de contenido: tienen que describir la foto.
      expect(alt, `la imagen ${i} no tiene alt`).toBeTruthy();
      expect(alt!.length, `el alt de la imagen ${i} es demasiado corto: "${alt}"`).toBeGreaterThan(20);
    }
  });

  test('los videos propios tienen poster', async ({ page }) => {
    await page.goto(slug);

    // El primero se renderiza con el atributo poster puesto.
    const video = page.locator('video').first();
    await expect(video).toHaveAttribute('poster', /\.webp$/);

    // El resto lo lleva en data-poster, que el player usa al cambiar de video.
    const items = page.locator('[data-poster]');
    const total = await items.count();
    expect(total).toBeGreaterThan(0);
    for (let i = 0; i < total; i++) {
      expect(await items.nth(i).getAttribute('data-poster')).toMatch(/\.webp$/);
    }
  });

  test('los archivos de poster existen de verdad', async ({ page }) => {
    await page.goto(slug);
    const posters = await page.locator('[data-poster]').evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).dataset.poster!).filter(Boolean),
    );
    expect(posters.length).toBeGreaterThan(0);

    for (const src of posters) {
      const respuesta = await page.request.get(src);
      expect(respuesta.status(), `${src} no se sirve`).toBe(200);
    }
  });
});

test.describe('feed RSS', () => {
  test('/rss.xml responde XML con las noticias', async ({ page }) => {
    const respuesta = await page.request.get('/rss.xml');
    expect(respuesta.status()).toBe(200);
    expect(respuesta.headers()['content-type']).toContain('xml');

    const xml = await respuesta.text();
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<language>es-AR</language>');
    expect(xml).toContain('Hackathon EduTech Mendoza 2026');

    // Una entrada por noticia, y la de prensa apunta al medio.
    const items = xml.match(/<item>/g) ?? [];
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(xml).toContain('elnueve.com');
  });

  test('el feed se autodescubre desde el head', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('link[rel="alternate"][type="application/rss+xml"]');
    await expect(link).toHaveAttribute('href', '/rss.xml');
  });
});
