# Auditoría Web Quality — HEM2026 Producción

Fecha: 27/05/2026 | URL: `https://www.hackathonedutech.com.ar` | Modo: Producción (Vercel) | Lighthouse Mobile emulation

---

## Scores Resumen — Comparativa por Página

| Página | Performance | SEO | Accessibility | Best Practices |
|---|---|---|---|---|
| **Landing /** | **0.75** | 1.00 | 0.93 | 1.00 |
| **Login /login** | **0.91** | 1.00 | 0.92 | 1.00 |
| **Registro /registro** | **0.90** | 1.00 | 0.92 | 1.00 |
| **Dashboard /dashboard** (no auth → redirect login) | **0.87** | 1.00 | 0.92 | 1.00 |
| **Admin /admin** (no auth → redirect login) | **0.91** | 1.00 | 0.92 | 1.00 |
| **Bases /bases-y-condiciones** | **0.91** | 1.00 | 0.92 | 1.00 |

### Comparativa Dev vs Producción (Landing)

| Categoría | Dev (localhost) | Producción | Delta |
|---|---|---|---|
| Performance | 0.57 | **0.75** | +0.18 |
| SEO | 1.00 | 1.00 | = |
| Accessibility | 0.93 | 0.93 | = |
| Best Practices | 0.96 | 1.00 | +0.04 |

> La mejora en Performance (+18 puntos) y Best Practices (+4 puntos) se explica por: minificación JS, tree-shaking, compresión gzip/brotli en Vercel, y ausencia de HMR/WebSocket. El LCP sigue siendo el principal cuello de botella en producción.

---

## Core Web Vitals — Comparativa por Página

| Métrica | Landing | Login | Registro | Dashboard | Admin | Bases |
|---|---|---|---|---|---|---|
| FCP | 1.9s (0.88) | 1.7s (0.93) | 1.7s (0.92) | 1.7s (0.92) | 1.6s (0.94) | 1.6s (0.93) |
| **LCP** | **6.9s (0.06)** | **3.4s (0.67)** | **3.4s (0.67)** | **3.4s (0.67)** | **3.4s (0.68)** | **3.4s (0.68)** |
| TBT | 0ms (1.00) | 0ms (1.00) | 0ms (1.00) | 0ms (1.00) | 0ms (1.00) | 0ms (1.00) |
| CLS | 0 (1.00) | 0.002 (1.00) | 0.004 (1.00) | 0.002 (1.00) | 0.002 (1.00) | 0.015 (1.00) |
| SI | 3.2s (0.92) | 2.7s (0.96) | 2.9s (0.94) | 5.4s (0.57) | 3.2s (0.92) | 3.1s (0.93) |
| TTI | 7.1s (0.51) | 3.4s (0.93) | 3.4s (0.93) | 3.4s (0.93) | 3.4s (0.93) | 3.4s (0.93) |

> **Problema principal:** LCP en la Landing es **6.9s** (score 0.06) — catastroficamente malo. El LCP element es `<span class="t-edutech">EDUTECH</span>` en el Hero. LCP breakdown: TTFB=348ms, elementRenderDelay=1368ms. El delay se debe a la carga del video de fondo y los recursos render-blocking.

---

## Hallazgos Críticos — Producción

### PERF-1: Video de fondo enorme (7.7 MB) — Landing
- `videos/vibe-1.webm`: **7,675,263 bytes** (7.7 MB)
- Es el recurso más pesado de toda la landing
- Impacto directo en LCP y TTI
- **Acción:** Comprimir video, reducir resolución (720p → 480p), reducir bitrate, o reemplazar con poster image + lazy load del video

### PERF-2: Logo PNG sobredimensionado (168 KB → mostrado a 120x32px)
- `Logo_Tema_Claro.png`: 2104x562px, **168 KB** — se muestra a 120x32px (navbar) y 120x32px (footer)
- `Logo_Tema_Oscuro.png`: 2104x562px, **171 KB** — misma situación
- **Ahorro estimado:** 166 KB por imagen (99% del peso)
- **Acción:** Crear versión pequeña (240x64 @2x) en formato WebP. Ahorro total ~330 KB

### PERF-3: Font Lexend render-blocking (828ms)
- `https://fonts.googleapis.com/css2?family=Lexend:wght@200;400;600;900&display=swap`
- Bloquea el render por **828ms** en landing, 820-879ms en otras páginas
- Carga 4 weights (200, 400, 600, 900) — ¿se usan todos?
- **Acción:**
  - Opción A: Preload font + `font-display: swap` (ya tiene `display=swap` en la URL, pero el CSS sigue siendo render-blocking)
  - Opción B: Self-host la font (elimina dependencia Google Fonts = 1 menos DNS lookup + sin render blocking CSS)
  - Opción C: Reducir weights (¿se usa weight 200?)

### PERF-4: createBrowserClient.js parcialmente no usado (34-47 KB)
- `_astro/createBrowserClient.DjAyAhHp.js`: 42-58 KB transfer, **34-47 KB no usados** (81%)
- Se carga en TODAS las páginas, incluso las que no necesitan Supabase client
- **Acción:** Importar `createBrowserClient` solo en páginas que lo necesitan (dashboard, admin, mentoria), no en Layout global

### PERF-5: Galería de fotos pesada sin lazy loading — Landing
- 5 fotos de galería en top byte weight: foto-36 (825 KB), foto-27 (633 KB), foto-13 (469 KB), foto-10 (382 KB), foto-29 (239 KB)
- Total galería en landing: **~2.5 MB** de imágenes below the fold
- **Acción:** Agregar `loading="lazy"` a todas las imágenes de galería. Considerar `astro:assets` para optimización automática

### PERF-6: Redirect innecesario en /dashboard y /admin (844ms / 807ms)
- `/dashboard` → `/login` (844ms redirect) cuando no autenticado
- `/admin` → `/login` (807ms redirect)
- El middleware de Astro hace el redirect server-side, pero Lighthouse lo detecta como redirect chain
- **Acción:** Esto es esperado para rutas protegidas (no es fixeable per se). Solo afecta el primer acceso sin auth. No prioritario.

### PERF-7: Speed Index bajo en Dashboard (5.4s, score 0.57)
- La redirect chain `/dashboard` → `/login` (844ms) degrada el SI
- La página de login que se renderiza después tiene buen SI (2.7s normalmente)
- **Acción:** Considerar que las rutas protegidas redirijan más rápido, o servir directamente la página de login con un indicador visual de "necesitas iniciar sesión"

---

## Hallazgos — Accesibilidad (Comunes a TODAS las páginas)

### A11Y-1: Contraste insuficiente en Footer — TODAS las páginas
- **Elementos:** `<h4>` (EVENTO, PARTICIPÁ, ORGANIZAN) + `<span class="ftr-copy">` (copyright, "Diseñado con fines educativos")
- **Problema:** Color `#777777` sobre fondo `#ffffff` = ratio **4.47:1** (necesita >= 4.5:1)
- **Solución:** Cambiar `#777777` → `#707070` (ratio 5.08:1) o `#767676` (ratio 4.54:1)

### A11Y-2: Heading order inválido en Footer — TODAS las páginas
- Footer usa `<h4>` para secciones (EVENTO, PARTICIPÁ, ORGANIZAN)
- No existe `<h3>` precedente en el mismo contexto de la página
- **Solución:** Cambiar `<h4>` del footer a `<p class="ftr-heading">` con estilo visual similar

### A11Y-3: Skip links no focusables — Login, Registro, Dashboard, Admin, Bases
- Los nav links "Inicio", "Acerca", "Cronograma" no tienen target de skip link
- La página no tiene un elemento `#main-content` o similar como target de un skip link
- **Solución:** Agregar `<a href="#main-content" class="skip-link">Saltar al contenido</a>` como primer elemento del body + `id="main-content"` en `<main>`

---

## Hallazgos — SEO (Todo OK, todas las páginas)

SEO score: **1.00** en todas las páginas auditadas. No se encontraron problemas.

---

## Hallazgos — Best Practices (OK en producción)

Best Practices score: **1.00** en producción (era 0.96 en dev por errores de consola de Vite HMR). Los problemas de dev mode no aplican en producción.

---

## Plan de Correcciones — Producción (Priorizado)

### Alta Prioridad (Impacto directo en LCP y Performance)

| # | Issue | Acción | Ahorro estimado | Archivos afectados |
|---|---|---|---|---|
| P1 | Video fondo 7.7 MB | Comprimir video (480p, bitrate reducido) o poster+lazy | ~5-6 MB | Hero.astro, video file |
| P2 | Logo PNG 168-171 KB (2104x562 → 120x32) | Crear versión WebP 240x64 @2x | ~330 KB (ambos logos) | Navbar.astro, Footer.astro |
| P3 | Font Lexend render-blocking 828ms | Self-host font + preload, o reducir weights | ~828ms LCP | Layout.astro, global.css |
| P4 | createBrowserClient.js 34-47 KB no usado | Importar solo en páginas auth, no en Layout | ~34-47 KB por página | Layout.astro, páginas auth |

### Media Prioridad (Accesibilidad + Performance)

| # | Issue | Acción | Ahorro estimado | Archivos afectados |
|---|---|---|---|---|
| P5 | Contraste footer `#777777` (4.47:1) | Oscurecer a `#707070` (5.08:1) | Fix a11y | Footer.astro CSS |
| P6 | Footer `<h4>` rompe heading order | Cambiar a `<p>` con clase styled | Fix a11y | Footer.astro |
| P7 | Skip links no focusables | Agregar skip-link + `id="main-content"` | Fix a11y | Layout.astro, Navbar.astro |
| P8 | Galería ~2.5 MB sin lazy loading | `loading="lazy"` en imgs below the fold | ~2.5 MB initial load | Gallery/Prizes/InfoCards |
| P9 | Imágenes sin `width`/`height` | Agregar dimensiones explícitas a logos | Previene CLS | Navbar.astro, Footer.astro |

### Baja Prioridad (Mejoras incrementales)

| # | Issue | Acción | Archivos afectados |
|---|---|---|---|
| P10 | favicon.png 28 KB | Optimizar o convertir a ICO/WebP | public/favicon.png |
| P11 | Redirect /dashboard → /login 844ms | Considerar SSR directo de login con mensaje | middleware.ts |

---

## Resumen de Impacto Estimado por Corrección

Si se aplican P1-P4 (alta prioridad):

| Métrica | Antes (actual) | Estimado después | Mejora |
|---|---|---|---|
| LCP Landing | 6.9s | ~2.5-3.5s | ~50-65% |
| FCP Landing | 1.9s | ~1.2-1.5s | ~20-35% |
| TTI Landing | 7.1s | ~3.5-4.5s | ~35-50% |
| Payload Landing | 10,466 KB | ~4,000 KB | ~60% |
| Performance Landing | 0.75 | ~0.90-0.95 | +15-20 pts |

Si se aplican P5-P9 (media prioridad):
- Accessibility: 0.92-0.93 → ~0.97-1.00
- CLS se mantiene 0 (solo prevención)

---

## Notas sobre Páginas Autenticadas

La auditoría Lighthouse no puede autenticarse. Las páginas `/dashboard`, `/admin`, `/mentoria`, `/evaluacion` redirigen a `/login` cuando no hay sesión activa. Los scores obtenidos para estas rutas reflejan la página de login (tras redirect).

Para auditar las páginas autenticadas se necesitaría:
1. Un script Puppeteer que haga login antes de correr Lighthouse
2. O auditar manualmente con Chrome DevTools Lighthouse tab (logueado en el browser)

Los hallazgos comunes (a11y footer, logo, render-blocking) aplican igualmente a las páginas autenticadas ya que comparten Layout + Navbar + Footer.
