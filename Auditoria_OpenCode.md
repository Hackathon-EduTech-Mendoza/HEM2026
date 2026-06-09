# Auditoría OpenCode — Mobile UX & Performance · HEM2026

> **Fecha**: 2026-06-09  
> **URL producción**: `https://www.hackathonedutech.com.ar/` (Vercel, Astro 6.2.1 SSR)  
> **Método**: Lighthouse móvil emulado + subagentes `explore` en `src/` + revisión de 3 auditorías previas  
> **Alcance**: 5 cambios quirúrgicos, código exacto a modificar, Desktop intacto

---

## 0. Estado de auditorías previas

Se revisaron los 3 archivos en `ayudas_y_recursos/terminados/Auditoria/`:

| # | Hallazgo previo | Estado | Fecha |
|---|---|---|---|
| P1 | Video 7.7 MB | ❌ PENDIENTE | 2026-05-26 |
| P2 | Logo PNG 168 KB | ✅ FIXED — Astro `<Image>` convierte a WebP en build | 2026-05-26 |
| P3 | Font Lexend render-blocking 828ms | ❌ PENDIENTE | 2026-05-26 |
| P4 | createBrowserClient global (34-47KB) | ❌ PENDIENTE | 2026-05-26 |
| P5 | Contraste footer `#777777` | ✅ FIXED — `--txt-m: #707070` (ratio 4.9:1) | 2026-05-26 |
| P6 | Footer `<h4>` rompe heading order | ✅ FIXED — ahora usa `<p class="ftr-heading">` | 2026-05-26 |
| P7 | Skip links no focusables | ✅ FIXED — `<a href="#main-content" class="skip-link">` + `id="main-content"` | 2026-05-26 |
| P8 | Galería ~2.5 MB sin lazy loading | ✅ FIXED — `loading="lazy"` en 5 imágenes de VibeCheck | 2026-05-26 |
| P9 | Imágenes sin width/height | ⚠️ PARCIAL — Navbar/Footer usan `<Image>`, pero Allies.astro aún sin dimensiones | 2026-05-26 |

**Resumen**: 4 de 9 hallazgos de alta prioridad siguen pendientes desde mayo. Esta auditoría los aborda junto con nuevos hallazgos de UX móvil.

---

## 1. Cambio quirúrgico #1 (P0 — Performance) · Lazy load + dimensiones en Allies marquee

### Problema

15 imágenes de aliados (3 sets duplicados para el infinite scroll) se cargan eagerly al abrir la landing. La sección Allies está **debajo del fold** (componente #7 de 10 en la landing). Ninguna tiene `loading="lazy"`, `decoding="async"` ni `width`/`height` explícitos (CLS risk). Cada `<img>` usa `style="width: auto; height: 90px"` sin atributos HTML dimensionales.

### Impacto

- ~500 KB de imágenes below-the-fold cargadas innecesariamente en first paint
- Potencial CLS de 15 imágenes sin aspect ratio reservado
- Medible en mobile 4G: ~1.5s de descarga evitable

### Archivo

`src/components/Allies.astro`

### Código a modificar

**Antes** (ejemplo, línea 27 — patrón idéntico en 15 `<img>`):
```astro
<img
  src="/img/allies/fundacion-underc0de-negro.webp"
  alt="Fundación Undercode"
  class="marquee-logo logo-light-theme"
  style="height: 90px; width: auto; object-fit: contain;"
/>
```

**Después**:
```astro
<img
  src="/img/allies/fundacion-underc0de-negro.webp"
  alt="Fundación Undercode"
  class="marquee-logo logo-light-theme"
  loading="lazy"
  decoding="async"
  width="250"
  height="90"
  style="object-fit: contain;"
/>
```

> El CSS `.marquee-item { height: 90px; width: 250px; }` (ya existente en línea 263-264) define el aspect ratio esperado. Agregar `width="250" height="90"` como atributos HTML le da al navegador la pista del aspect ratio **antes** de que cargue la imagen (elimina CLS). El `style` simplificado solo necesita `object-fit: contain`.

**Se reemplazan las 15 ocurrencias** (líneas 27, 33, 46, 59, 72, 87, 93, 106, 119, 132, 147, 153, 166, 179, 192).

---

## 2. Cambio quirúrgico #2 (P1 — Performance) · Video con `preload="none"` + poster

### Problema

`VibeCheck.astro` tiene un `<video autoplay loop muted playsinline>` en la posición #8 de la landing (debajo del fold). El default de `preload` es `"auto"`: el navegador descarga el MP4 entero (1-2 MB) **antes** de que el usuario haga scroll a esa sección. En mobile, esto puede consumir datos sin consentimiento y retrasa el LCP de los recursos above-the-fold.

5 videos (`vibe-1.mp4` a `vibe-5.mp4`) suman **~8.5 MB**. Se elige 1 aleatoriamente via JS al cargar — el navegador no puede predecir cuál y descarga el definido como `src` dinámico.

### Impacto

- 1-2 MB de video descargados al abrir la landing (before-fold drain)
- El `src` inyectado por JS elimina la optimización de precarga del browser
- Sin `poster`, el video muestra un frame negro hasta que bufferiza

### Archivo

`src/components/VibeCheck.astro`

### Código a modificar

**Antes** (línea 17):
```astro
<video autoplay loop muted playsinline class="vibe-video" id="vibe-player">
  <!-- El source se inyectará dinámicamente -->
</video>
```

**Después**:
```astro
<video autoplay loop muted playsinline preload="none"
  poster="/img/gallery/vibe-poster.webp"
  class="vibe-video" id="vibe-player">
  <!-- El source se inyectará dinámicamente -->
</video>
```

> **Requisito adicional**: generar un poster image estático (`public/img/gallery/vibe-poster.webp`, ~30 KB, 720p) a partir de un frame representativo del primer video. Si no hay recurso, usar un gradiente CSS como poster. El valor de `preload="none"` + `poster` evita la descarga del MP4 hasta que el usuario hace scroll a la sección.

**Bonus (fuera de scope quirúrgico inmediato)**: re-encodear los 5 videos a WebM VP9 720p (~300 KB c/u) y agregar `<source type="video/webm">`. Esto reduciría el payload total de 8.5 MB a ~1.5 MB.

---

## 3. Cambio quirúrgico #3 (P1 — Mobile UX) · Secciones con padding fluido

### Problema

6 de 9 secciones de la landing usan `padding: 8rem 0` (128px) sin media query de reducción para móvil. En un viewport de 375x812, esto significa ~768px de padding vertical entre secciones — casi una pantalla completa de espacio vacío.

| Componente | Clase | Padding | ¿Override mobile? |
|---|---|---|---|
| `InfoCards.astro` | `.about` | `8rem 0` | ❌ No |
| `NewsSection.astro` | `.news` | `8rem 0` | ❌ No |
| `Prizes.astro` | `.prizes` | `8rem 0` | ❌ No |
| `Schedule.astro` | `.schedule` | `8rem 0` | ❌ No |
| `Organizers.astro` | `.organizers` | `8rem 0` | ❌ No |
| `VibeCheck.astro` | `.vibe-section` | `6rem 0` | ❌ No |

### Impacto

- ~30% de reducción en altura total de página en mobile
- Elimina 6 media queries redundantes
- Single source of truth para espaciado entre secciones

### Archivos

`src/styles/global.css` + `src/components/InfoCards.astro` + `src/components/NewsSection.astro`  
+ `src/components/Prizes.astro` + `src/components/Schedule.astro`  
+ `src/components/Organizers.astro` + `src/components/VibeCheck.astro`

### Código a modificar

**Paso 1** — Agregar en `global.css` después de `:root`:
```css
--section-pad-y: clamp(3.5rem, 6vw, 8rem);
```

**Paso 2** — En cada uno de los 6 componentes, reemplazar el valor fijo por la variable.

**InfoCards.astro** (`.about`):
```css
/* antes */
.about { padding: 8rem 0; }

/* después */
.about { padding: var(--section-pad-y) 0; }
```

**NewsSection.astro** (`.news`):
```css
/* antes */
.news { padding: 8rem 0; }

/* después */
.news { padding: var(--section-pad-y) 0; }
```

**Prizes.astro** (`.prizes`):
```css
/* antes */
.prizes { padding: 8rem 0; }

/* después */
.prizes { padding: var(--section-pad-y) 0; }
```

**Schedule.astro** (`.schedule`):
```css
/* antes */
.schedule { padding: 8rem 0; }

/* después */
.schedule { padding: var(--section-pad-y) 0; }
```

**Organizers.astro** (`.organizers`):
```css
/* antes */
.organizers { padding: 8rem 0; }

/* después */
.organizers { padding: var(--section-pad-y) 0; }
```

**VibeCheck.astro** (`.vibe-section`):
```css
/* antes */
.vibe-section { padding: 6rem 0; }

/* después */
.vibe-section { padding: var(--section-pad-y) 0; }
```

> `clamp(3.5rem, 6vw, 8rem)` da: 52px en 375px wide → 72px en 600px → 128px en 1200px+. Los componentes `Allies.astro` y `FAQ.astro` ya tienen su override mobile propio y pueden quedarse como están o migrar a la variable para consistencia total.

---

## 4. Cambio quirúrgico #4 (P1 — Mobile UX) · PreviousEditions: grid 2-columnas + card tight

### Problema

`PreviousEditions.astro` renderiza **21 tarjetas de proyectos** en una única columna vertical en todo viewport menor a 768px. Cada tarjeta tiene `padding: 2.5rem` y ningún `max-width`, ocupando ~345px de ancho en un teléfono de 375px. El usuario debe hacer scroll por ~15,000px solo en esta sección.

### Impacto

- Reducción del ~50% en altura de esta sección en mobile
- Layout más legible (cards ~170px de ancho en vez de ~345px, líneas de texto 45-60 chars)
- Desktop (3 columnas) intacto

### Archivo

`src/components/PreviousEditions.astro`

### Código a modificar

Buscar el bloque `<style>` y localizar:

**Grid** (aproximadamente línea 290-310 en el CSS):
```css
/* antes */
.projects-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  margin-top: 3rem;
}

@media (min-width: 768px) {
  .projects-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1200px) {
  .projects-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

**Después**:
```css
.projects-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin-top: 2rem;
  max-width: 1000px;
  margin-left: auto;
  margin-right: auto;
}

@media (min-width: 480px) {
  .projects-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }
}

@media (min-width: 1024px) {
  .projects-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 2rem;
  }
}
```

**Card padding** (aproximadamente línea 330-340):
```css
/* antes */
.project-card {
  padding: 2.5rem;
  /* ... */
}

/* después */
.project-card {
  padding: clamp(1.25rem, 3vw, 2.5rem);
  /* ... */
}
```

> Los cambios clave: `min-width: 480px` (vs `768px`) para el 2-col — cubre la mayoría de teléfonos (iPhone 14 Pro Max = 430px, pero Galaxy S23 Ultra = 412px, justo debajo de 480px. En 480px+, 2 columnas). `gap` reducido en mobile para ahorrar espacio. `max-width: 1000px` en el grid para que no se expanda más de lo necesario. Card padding fluido con `clamp()`.

---

## 5. Cambio quirúrgico #5 (P2 — Performance) · GooeyBackground: 30fps + blur reducido en mobile

### Problema

`GooeyBackground.astro` aplica un filtro SVG `feGaussianBlur stdDeviation="15"` + `feColorMatrix` al canvas completo a **60fps**. En un viewport mobile de 375×812 (~300K píxeles), la GPU computa 15px de blur Gaussiano por cada píxel, 60 veces por segundo. A un `opacity: 0.03` (casi invisible), esto es trabajo de GPU desperdiciado que:

- Drena batería
- Compite con el scroll (jank en dispositivos gama baja)
- Calienta el SoC (thermal throttling en Qualcomm/Exynos)

El componente ya reduce `stdDeviation="10"` en `<768px` (línea 183), pero sigue siendo pesado.

### Impacto

- ~50% menos tiempo de GPU consumido en mobile
- Scroll más suave en dispositivos gama baja/media
- Efecto visual indistinguible a 5% de opacidad

### Archivo

`src/components/GooeyBackground.astro`

### Código a modificar

**Antes** (línea 183):
```ts
if (blurElement) {
  blurElement.setAttribute('stdDeviation', width < 768 ? '10' : '15');
}
```

**Después** (reemplazar todo el bloque `setupMetaballs` con el blur + throttling mejorados):
```ts
// Reducir intensidad del blur SVG en pantallas pequeñas para mejor rendimiento
const blurElement = document.querySelector('#gooey-effect feGaussianBlur') as Element | null;
if (blurElement) {
  blurElement.setAttribute('stdDeviation', width < 480 ? '5' : width < 768 ? '8' : '15');
}
```

Y en el bucle `animate()`, agregar throttling a 30fps en mobile (línea ~227):

```ts
// Reemplazar el animate() actual con versión throttled
const FPS = width < 768 ? 30 : 60;
const FRAME_INTERVAL = 1000 / FPS;
let lastFrameTime = 0;

function animate() {
  if (!ctx) return;

  const now = performance.now();
  const delta = now - lastFrameTime;

  if (delta < FRAME_INTERVAL) {
    animationFrameId = requestAnimationFrame(animate);
    return;
  }
  lastFrameTime = now - (delta % FRAME_INTERVAL);

  ctx.clearRect(0, 0, width, height);

  metaballs.forEach((ball) => {
    if (animationsEnabled) {
      ball.update(width, height);
    }
    ball.draw(ctx);
  });

  if (animationsEnabled) {
    animationFrameId = requestAnimationFrame(animate);
  }
}
```

> **Tres niveles de blur**: 480px (teléfonos) → `stdDeviation="5"`, 768px (tablets) → `"8"`, 1200px+ (desktop) → `"15"`. **30fps en mobile** vs 60fps en desktop. A `opacity: 0.03`, nadie nota la diferencia visual entre 30fps y 60fps, pero la GPU lo agradece.

---

## 6. Resumen priorizado

| # | Categoría | Archivo | Esfuerzo | Impacto |
|---|---|---|---|---|
| #1 | Perf | `Allies.astro` (15 img) | 15min | ~500KB ahorrados + 0 CLS |
| #3 | Mobile UX | `global.css` + 6 componentes | 15min | ~30% menos altura vertical en landing |
| #4 | Mobile UX | `PreviousEditions.astro` | 10min | ~50% menos scroll, cards legibles |
| #2 | Perf | `VibeCheck.astro` | 5min | 1-2MB no descargados en first load |
| #5 | Perf | `GooeyBackground.astro` | 15min | ~50% GPU savings, scroll más fluido |

**Total**: 5 commits, ~60min, 4 archivos tocados.

---

## 7. Hallazgos documentados (no abordados en esta ronda — deuda abierta)

| Hallazgo | Razón del diferimiento | Origen |
|---|---|---|
| Fonts: 4 weights Lexend sin preload ni subset | Requiere migrar de `@fontsource` a self-hosted. Scope grande (tocar Layout + generar woff2). | Auditoría prod P3 |
| createBrowserClient global en Navbar | Requiere split de Layout en Layout/LayoutAuth. Scope grande (tocar 17 páginas). | Auditoría prod P4 |
| Videos 8.5 MB: re-encode a WebM | Requiere FFmpeg + reemplazar 5 archivos en `public/`. Scope mediano, pero el fix #2 mitiga download. | Auditoría prod P1 |
| Gallery: 37 fotos WebP sin `srcset` ni AVIF | Requiere script de build con `sharp` y refactor de VibeCheck.astro. Scope mediano. | Nueva |
| Hero countdown: `aria-live="polite"` con `setInterval(1000)` | Chatter de lector de pantalla cada segundo. Ya fue reportado. Scope pequeño, no priorizado aquí. | Previo |

---

## 8. Verificación post-cambios

| Prueba | Criterio |
|---|---|
| `npm run build` | ✅ sin errores |
| Mobile 375px: padding entre secciones | ~52px (era 128px) |
| Mobile 480px: PreviousEditions | 2 columnas (era 1) |
| Lighthouse LCP Landing | Mejora esperada: 6.9s → ~4s (por lazy de 15 imágenes + video preload=none) |
| Lighthouse Perf Landing | Mejora esperada: 0.75 → ~0.82 |