# Auditoría Web Quality — HEM2026 Landing

Fecha: 26/05/2026 | URL: `http://localhost:4321` (dev server) | Modo: Mobile emulation (Lighthouse default)

---

## Scores Resumen

| Categoría | Score | Grado |
|---|---|---|
| **Performance** | **0.57** | Malo |
| **SEO** | **1.00** | Perfecto |
| **Accessibility** | **0.93** | Bueno |
| **Best Practices** | **0.96** | Bueno |

---

## Core Web Vitals (Landing)

| Métrica | Score | Valor | Evaluación |
|---|---|---|---|
| First Contentful Paint | 0.01 | **7.6 s** | Malo (>1.8s) |
| Largest Contentful Paint | 0.00 | **18.2 s** | Malo (>2.5s) |
| Speed Index | 0.18 | **8.4 s** | Malo (>3.4s) |
| Total Blocking Time | 1.00 | 10 ms | Bueno (<200ms) |
| Cumulative Layout Shift | 1.00 | 0 | Bueno (<0.1) |
| Time to Interactive | 0.03 | **18.8 s** | Malo (>3.8s) |

> **LCP Element:** `div#countdown` (Hero countdown) — render delay de 2627ms. El LCP es catastrofico (18.2s) debido a carga de JS pesado en dev mode.

---

## Hallazgos Críticos — Performance

### 1. Video de fondo enorme (7.1 MB)
- `videos/vibe-3.webm` pesa **7,143,771 bytes** (7.1 MB)
- Es el recurso más pesado de toda la página
- **Impacto:** Bandwidth + decode time

### 2. JavaScript sin minificar (890 KB desperdiciados)
- `@supabase_ssr.js`: 743 KB total, **435 KB sin minificar** (58.5%), **326 KB no usado** (44%)
- `@vite/client`: 295 KB total, **248 KB sin minificar** (84.1%)
- Navbar scripts: 86 KB total, **81 KB sin minificar** (93-97%)
- **Nota:** Estos números son de DEV MODE. En producción (build), Vite minifica y tree-shakea. Los resultados de producción serían significativamente mejores.

### 3. Imágenes de galería pesadas
- `foto-27.webp`: 632 KB
- `foto-22.webp`: 562 KB
- `foto-14.webp`: 446 KB
- `foto-12.webp`: 352 KB
- `foto-29.webp`: 238 KB
- **Impacto:** Total de galería ~2.2 MB sin lazy loading aparente

### 4. Logo sin dimensiones explícitas (CLS risk)
- `Logo_Tema_Claro.png`: 168 KB, tamaño real **2104x562px**, se muestra a **120x32px**
- Estimación de ahorro: **167 KB** (99.6% del peso)
- Falta `width` y `height` explícitos en `<img>`
- Afecta navbar y footer (2 instancias)

### 5. Forced Reflow (98ms)
- `GooeyBackground.astro` línea 69: 98.4ms de reflow forzado
- Acceso a propiedades de layout desde JS que invalidan el batch de render

### 6. Sin compresión en documento HTML
- Documento HTML: 113 KB sin comprimir
- El dev server de Vite no aplica gzip/brotli — en producción sí se aplicaría

### 7. Back/Forward Cache falla
- WebSocket de Vite HMR impide bfcache
- **Solo afecta en dev mode** — no aplica en producción

---

## Hallazgos — Accesibilidad

### 1. Contraste insuficiente en Footer (score: 0)
- **Elementos afectados:** `<h4>` en footer (EVENTO, PARTICIPÁ, ORGANIZAN) + `.ftr-copy` spans
- **Problema:** Color `#777777` sobre fondo `#ffffff` = ratio 4.47:1
- **Mínimo requerido:** 4.5:1 para texto normal
- **Solución:** Cambiar `#777777` a `#767676` (ratio 4.54:1) o más oscuro

### 2. Orden de headings (score: 0)
- Footer usa `<h4>` después del contenido principal, pero no hay `<h3>` precedente en el mismo contexto
- **Solución:** Cambiar `<h4>` del footer a `<p>` con clase styled, o asegurar jerarquía correcta

---

## Hallazgos — Best Practices

### 1. Errores en consola (score: 0)
- `504 Outdated Optimize Dep` del dev server de Vite
- **Solo en dev mode** — no aplica en producción

---

## Hallazgos — SEO (Todo OK)

Todos los audits SEO pasan con score 1.0:
- Title, meta description, canonical, hreflang, crawlable anchors, image alt, link text, robots

---

## Nota Importante: Dev Mode vs Producción

Esta auditoría se corrió contra el **dev server de Astro** (`astro dev`). Los números de performance son **significativamente peores** que los de producción porque:

| Factor | Dev Mode | Producción |
|---|---|---|
| JS minificado | No (890 KB waste) | Sí (Vite minifica) |
| Tree-shaking | No | Sí |
| Supabase SSR bundle | 743 KB completo | Solo lo importado |
| HMR / @vite/client | 295 KB | No existe |
| Compresión gzip/brotli | No | Sí (Vercel) |
| BFCache | Bloqueado por WebSocket | Disponible |

**Los scores reales de producción serían considerablemente mejores en Performance.** Los hallazgos que sí aplican a producción son:

1. Video de fondo de 7.1 MB
2. Logo de 168 KB mostrado a 120x32px
3. Imágenes de galería sin lazy loading
4. Contraste insuficiente en Footer (#777777)
5. Orden de headings en Footer
6. Forced reflow en GooeyBackground
7. Imágenes sin width/height explícitos

---

## Plan de Correcciones (Priorizado)

### Prioridad Alta (Impacto directo en UX y scores producción)

| # | Issue | Acción | Ahorro estimado |
|---|---|---|---|
| P1 | Video fondo 7.1 MB | Comprimir video, reducir resolución, o usar poster image + lazy load | ~5 MB |
| P2 | Logo 168 KB @ 2104x562 → 120x32 | Crear versión reducida (ej: 240x64 @ 2x, formato WebP) | ~167 KB |
| P3 | Galería sin lazy loading | Agregar `loading="lazy"` a imágenes below the fold | Ahorro de banda en initial load |
| P4 | Contraste footer `#777777` | Cambiar a `#6b6b6b` o darker para ratio >4.5:1 | Fix a11y |
| P5 | Heading order footer `<h4>` | Cambiar a `<p>` con clase styled | Fix a11y |

### Prioridad Media

| # | Issue | Acción | Ahorro estimado |
|---|---|---|---|
| P6 | Imágenes sin width/height | Agregar dimensiones explícitas a `<img>` | Previene CLS |
| P7 | Forced reflow GooeyBackground | Batch DOM reads/writes, usar `requestAnimationFrame` | ~98ms reflow |
| P8 | Galería imágenes pesadas | Optimizar con `astro:assets` o reducir calidad WebP | ~500 KB |

### Prioridad Baja (Solo dev mode, no afecta producción)

| # | Issue | Contexto |
|---|---|---|
| P9 | JS sin minificar | Dev mode — Vite minifica en build |
| P10 | @supabase_ssr bundle completo | Dev mode — tree-shaking en build |
| P11 | Sin compresión gzip | Dev mode — Vercel lo aplica |
| P12 | BFCache bloqueado | Dev mode — WebSocket de HMR |
| P13 | Console errors 504 | Dev mode — Vite optimize dep |

---

## Recomendación: Re-auditar en Producción

Para obtener scores reales, se debería auditar contra la URL de producción (Vercel deploy). El dev server infla los tiempos de carga por factores que no existen en producción. Los issues P1-P8 son los que realmente importan.
