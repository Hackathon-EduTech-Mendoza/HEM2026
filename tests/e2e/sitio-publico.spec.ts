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
    // Hay al menos las siete notas cargadas al momento de escribir el test.
    const tarjetas = page.locator('.news-grid .news-card');
    expect(await tarjetas.count()).toBeGreaterThanOrEqual(7);
  });
});

test.describe('cobertura de la convocatoria', () => {
  /**
   * Las dos notas que sumó Martín el 2026-08-03. Van como prensa externa, así
   * que la tarjeta apunta al medio y no se genera página propia.
   */
  const coberturas = [
    { medio: 'mendoza.edu.ar', slug: 'dge-abren-inscripciones-segunda-edicion' },
    { medio: 'portaltic.com.ar', slug: 'portaltic-mendoza-lanza-hackathon-2026' },
  ];

  for (const { medio, slug } of coberturas) {
    test(`la nota de ${medio} aparece y apunta al medio`, async ({ page }) => {
      await page.goto('/noticias');
      const link = page.locator(`a[href*="${medio}"]`).first();
      await expect(link).toHaveAttribute('href', new RegExp(medio.replace('.', '\\.')));
      await expect(link).toHaveAttribute('target', '_blank');

      const respuesta = await page.request.get(`/noticias/${slug}`);
      expect(respuesta.status()).toBe(404);
    });
  }
});

test.describe('miniaturas de las tarjetas', () => {
  /**
   * La grilla es mixta a propósito: solo llevan portada las noticias con
   * `imagen` en el frontmatter (las de prensa externa usan la foto del medio,
   * que no es nuestra). Por eso los tests no fijan cuántas tienen: verifican
   * que las que la tienen no estén rotas.
   *
   * El riesgo real es una ruta mal escrita en `imagen:`, que da un 404 y deja
   * un hueco sin que nada falle en el build.
   */
  test('las portadas que existen cargan de verdad', async ({ page }) => {
    await page.goto('/noticias');
    await page.waitForLoadState('networkidle');

    const portadas = page.locator('.news-card-media img');
    const total = await portadas.count();

    for (let i = 0; i < total; i++) {
      const img = portadas.nth(i);
      const src = await img.getAttribute('src');
      // naturalWidth 0 = el navegador no pudo decodificarla (404 o corrupta).
      const ancho = await img.evaluate((el) => (el as HTMLImageElement).naturalWidth);
      expect(ancho, `la portada ${src} no cargó`).toBeGreaterThan(0);
    }
  });

  test('la tarjeta sin portada no deja el hueco de la imagen', async ({ page }) => {
    await page.goto('/noticias');

    // Las de prensa externa no tienen `imagen`: su tarjeta tiene que arrancar
    // por el encabezado, no por una banda vacía.
    const sinPortada = page.locator('.news-card:not(:has(.news-card-media))');
    expect(await sinPortada.count()).toBeGreaterThan(0);
    await expect(sinPortada.first().locator('.news-card-media')).toHaveCount(0);
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

test.describe('canal de consultas', () => {
  /**
   * El WhatsApp del evento se dio de baja el 2026-08-03 y lo reemplaza el
   * formulario. El test cubre las dos mitades: que el número no vuelva y que
   * el formulario esté donde tiene que estar.
   */
  test('no queda ningún enlace a WhatsApp en el sitio público', async ({ page }) => {
    for (const ruta of ['/', '/noticias', '/bases-y-condiciones']) {
      await page.goto(ruta);
      await expect(page.locator('a[href*="wa.me"]'), `${ruta} todavía linkea a WhatsApp`).toHaveCount(0);
    }
  });

  test('el formulario de consultas está en el home y el footer lo enlaza', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#consultas')).toHaveCount(1);
    await expect(page.locator('#consultas-form #consulta-nombre')).toBeVisible();
    await expect(page.locator('#consultas-form #consulta-email')).toBeVisible();
    await expect(page.locator('#consultas-form #consulta-mensaje')).toBeVisible();
    await expect(page.locator('.ftr-links a[href="/#consultas"]')).toHaveCount(1);
  });

  test('el honeypot no es visible ni tabulable', async ({ page }) => {
    await page.goto('/');
    const trampa = page.locator('#consulta-website');
    await expect(trampa).toHaveCount(1);
    await expect(trampa).not.toBeInViewport();
    await expect(trampa).toHaveAttribute('tabindex', '-1');
  });

  test('la validación del cliente frena un envío incompleto', async ({ page }) => {
    await page.goto('/');
    await page.fill('#consulta-nombre', 'A');
    await page.fill('#consulta-email', 'no-es-un-mail');
    await page.fill('#consulta-mensaje', 'corto');

    // Si algo se escapa a la validación, esto lo detecta: no debe salir request.
    let hubieraEnviado = false;
    page.on('request', (r) => {
      if (r.url().includes('/api/consulta')) hubieraEnviado = true;
    });

    await page.click('#consulta-enviar');
    await expect(page.locator('#consulta-estado')).toHaveClass(/is-error/);
    expect(hubieraEnviado).toBe(false);
  });

  test('el endpoint rechaza un GET', async ({ page }) => {
    const respuesta = await page.request.get('/api/consulta');
    expect(respuesta.status()).toBe(405);
  });
});

test.describe('bases y condiciones', () => {
  test('se puede descargar el documento y están los dos anexos', async ({ page }) => {
    await page.goto('/bases-y-condiciones');

    const descarga = page.locator('a.legal-download-btn');
    await expect(descarga).toHaveAttribute('href', /\.docx$/);
    const archivo = await page.request.get(
      (await descarga.getAttribute('href')) as string,
    );
    expect(archivo.status()).toBe(200);

    await expect(page.locator('#anexo-cronograma')).toHaveCount(1);
    await expect(page.locator('#anexo-rubrica')).toHaveCount(1);
  });

  test('el articulado es el de la v11 y ya no tiene las sedes viejas', async ({ page }) => {
    await page.goto('/bases-y-condiciones');
    const texto = (await page.locator('.legal-content').textContent()) ?? '';

    expect(texto).toContain('Art. 16º');
    expect(texto).toContain('Auditorio Municipal de Maipú');
    // Sede de una versión anterior de las bases: si vuelve, algo se revirtió.
    expect(texto).not.toContain('Le Parc');
  });
});
