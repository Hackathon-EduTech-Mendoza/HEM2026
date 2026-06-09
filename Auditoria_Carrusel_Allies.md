# Auditoría y Plan de Mejora — Carrusel de Aliados (`Allies.astro`)

> **Fecha**: 2026-06-04
> **Estado**: 🐛 Bug encontrado
> **Impacto**: P1 — el carrusel no se desplaza automáticamente tras ciertas condiciones.

---

## 1. Diagnóstico

El carrusel de `Allies.astro` usa una **animación CSS pura** (sin JavaScript):

```css
/* Allies.astro:250 */
.marquee-track {
    animation: scroll-marquee 25s linear infinite;
}

@keyframes scroll-marquee {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-33.3333%); }
}
```

Al mismo tiempo, `global.css:326-335` fuerza una anulación agresiva para `prefers-reduced-motion`:

```css
/* global.css */
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.3s !important;        /* de 25s → 0.3s */
        animation-iteration-count: 1 !important;    /* de infinite → 1 */
        transition-duration: 0.2s !important;
    }
}
```

Y el toggle de animaciones (`AnimToggle.astro`) **solo controla el canvas** de `GooeyBackground`, no las animaciones CSS:

| Componente | Controlado por el toggle |
|---|---|
| `GooeyBackground` (canvas) | ✅ Sí — escucha `edutech-animations-changed` |
| `Allies` (marquee CSS) | ❌ No — no tiene ningún JS |

### Secuencia exacta del bug

```
1. Usuario abre la página por primera vez con OS en reduced-motion
   └─ GooeyBackground detecta prefersReducedMotion y marca localStorage: 'false'

2. El marquee juega 1 iteración en 0.3s (la regla CSS global) y se DETIENE
   └─ Queda en translateX(-33.3333%), visible pero estático

3. Usuario hace click en el toggle para ACTIVAR animaciones
   └─ localStorage → 'true'
   └─ GooeyBackground RESUME (el canvas vuelve a animarse)
   └─ El marquee SIGUE DETENIDO porque:
       a) Ya consumió su única iteración (iteration-count: 1)
       b) No hay JS que reinicie la animación CSS
       c) El toggle no afecta CSS, solo el canvas
```

### Causa raíz (3 bugs en 1)

| # | Bug | Archivo |
|---|---|---|
| B1 | **CSS `prefers-reduced-motion` con `!important`** — anula `animation-iteration-count: infinite` a `1` en TODOS los elementos. Una vez que corre, la animación jamás se reinicia. | `global.css:328-329` |
| B2 | **`Allies.astro` no escucha al toggle** — no hay JS que pause/reanude la animación CSS ni que la reinicie tras B1. | `Allies.astro` (falta JS) |
| B3 | **El toggle tiene scope reducido** — el API pública de `edutech-animations-changed` solo se aprovecha en GooeyBackground. Cualquier animación CSS queda fuera. | `AnimToggle.astro`, `GooeyBackground.astro` |

---

## 2. Problemas adicionales detectados

### 2.1 `prefers-reduced-motion:` afecta TODAS las animaciones sin distinción

La regla actual:
```css
*, *::before, *::after {
    animation-duration: 0.3s !important;
    animation-iteration-count: 1 !important;
}
```

Esto rompe cualquier animación que necesita más de una iteración: el marquee, el shimmer de VibeCheck, el pulse del badge del hero, los reveals con secuencia de delays, etc. **No es específico al carrusel**.

### 2.2 Hover-pause inútil si la animación ya está rota

```css
.allies-marquee:hover .marquee-track {
    animation-play-state: paused;
}
```

Si la animación ya completó su única iteración, `animation-play-state` no hace nada. El `paused` solo funciona mientras la animación está corriendo.

---

## 3. Solución propuesta

### Estrategia general

Migrar el control de animaciones CSS del `@media` estático a un **sistema JS centralizado** que respete tanto `prefers-reduced-motion` del SO como la decisión explícita del usuario (toggle). El toggle debe ser la **fuente de verdad** para todas las animaciones (canvas + CSS).

### Cambios planificados

#### Cambio 1 — Suavizar `global.css` (1 commit)

**Archivo**: `src/styles/global.css:326-335`

**Antes**:
```css
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.3s !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.2s !important;
    }
}
```

**Después**:
```css
/* Respetar la preferencia del SO como fallback, sin !important para que JS pueda sobreescribir */
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01s;
        animation-iteration-count: 1;
        transition-duration: 0.01s;
    }
}

/* Clase gestionada por JS (toggle de animaciones) — tiene prioridad sobre @media */
html.animations-paused *,
html.animations-paused *::before,
html.animations-paused *::after {
    animation-play-state: paused !important;
}

/* Excepciones — animaciones que siempre deben correr (spinners de carga, etc.) */
html.animations-paused .force-animate {
    animation-play-state: running !important;
}
```

> **Nota**: quitar `!important` del `@media` permite que JS reinicie la animación del marquee. La clase `animations-paused` cubre el pause global sin necesidad del media query.

#### Cambio 2 — JS en `Allies.astro` (1 commit)

**Archivo**: `src/components/Allies.astro`

Agregar bloque `<script>` al final del componente:

```ts
function initMarqueeSync() {
    const track = document.querySelector('.marquee-track') as HTMLElement | null;
    if (!track) return;

    const STORAGE_KEY = 'edutech-animations';

    function getEnabled(): boolean {
        return localStorage.getItem(STORAGE_KEY) !== 'false';
    }

    function setGlobalClass(enabled: boolean) {
        document.documentElement.classList.toggle('animations-paused', !enabled);
    }

    function restartMarquee() {
        // Técnica estándar: quitar y re-añadir para reiniciar la animación
        track.style.animationName = 'none';
        track.style.animationPlayState = '';
        // Forzar reflow
        void track.offsetWidth;
        track.style.animationName = '';
    }

    function syncMarquee(enabled: boolean) {
        setGlobalClass(enabled);
        if (enabled) {
            restartMarquee();
        } else {
            track.style.animationPlayState = 'paused';
        }
    }

    // Inicializar
    syncMarquee(getEnabled());

    // Escuchar el toggle
    window.addEventListener('edutech-animations-changed', (e: any) => {
        syncMarquee(e.detail.enabled);
    });
}

initMarqueeSync();
```

**Funcionamiento**:
- Al cargar: si `animsEnabled === true`, reinicia la animación (soluciona B1).
- Al togglear: si se activa, re-trigger del keyframe (soluciona B2, B3).
- Al pausar: `animation-play-state: paused` + clase global en `<html>`.
- La clase `animations-paused` en `<html>` pausa TODAS las animaciones CSS (cobertura completa del toggle).

#### Cambio 3 — Refactor `AnimToggle` para gestionar la clase global (1 commit)

**Archivo**: `src/components/AnimToggle.astro`

Agregar al `updateAnimButtonsState()`:

```ts
function updateAnimButtonsState() {
    animToggleBtns.forEach(btn => {
        btn.classList.toggle('playing', animsEnabled);
        btn.classList.toggle('paused', !animsEnabled);
    });
    // Sincronizar clase global para animaciones CSS
    document.documentElement.classList.toggle('animations-paused', !animsEnabled);
}
```

> Esto asegura que el toggle también afecta animaciones CSS sin depender de que Allies escuche el evento.

#### Cambio 4 — Refactor `GooeyBackground` para respetar la preferencia del SO sin sobreescribir (1 commit)

**Archivo**: `src/components/GooeyBackground.astro:121-127`

**Antes**:
```ts
if (prefersReducedMotion && localStorage.getItem('edutech-animations') === null) {
    animationsEnabled = false;
    localStorage.setItem('edutech-animations', 'false');
    window.dispatchEvent(new CustomEvent('edutech-animations-changed', { detail: { enabled: false } }));
}
```

**Después**:
```ts
if (prefersReducedMotion && localStorage.getItem('edutech-animations') === null) {
    // Respetar SO, pero SIN sobreescribir localStorage
    // así el usuario puede revertirlo con el toggle sin perder su preferencia real
    animationsEnabled = false;
    // No guardamos en localStorage — dejamos que el usuario decida
}
```

> **Razón**: si GooeyBackground fuerza `localStorage = 'false'` al detectar `prefersReducedMotion`, el usuario SIEMPRE arranca con animaciones desactivadas aunque las quiera. Solo debe afectar esta sesión, guardar solo cuando el usuario toca el botón.

---

## 4. Fases y commits planeados

### Fase 1 — CSS (1 commit)

| # | Tarea | Archivo | Commit |
|---|---|---|---|
| 1.1 | Suavizar `@media prefers-reduced-motion` y agregar clase `animations-paused` | `src/styles/global.css` | `fix(a11y): soften reduced-motion override and add animations-paused class` |

### Fase 2 — JS del marquee (1 commit)

| # | Tarea | Archivo | Commit |
|---|---|---|---|
| 2.1 | Agregar listener de toggle + reinicio de animación + clase global | `src/components/Allies.astro` | `fix(allies): sync marquee with animation toggle and restart on enable` |

### Fase 3 — Toggle global (1 commit)

| # | Tarea | Archivo | Commit |
|---|---|---|---|
| 3.1 | AnimToggle gestiona la clase `animations-paused` en `<html>` | `src/components/AnimToggle.astro` | `fix(toggle): apply animations-paused class globally via toggle` |

### Fase 4 — GooeyBackground (1 commit)

| # | Tarea | Archivo | Commit |
|---|---|---|---|
| 4.1 | No sobreescribir `localStorage` al detectar `prefersReducedMotion` | `src/components/GooeyBackground.astro` | `fix(bg): respect OS preference without overriding user choice in localStorage` |

---

## 5. Verificación

| Prueba | Resultado esperado |
|---|---|
| OS sin reduced-motion, primera visita | Marquee se mueve automáticamente a 25s |
| OS con reduced-motion, primera visita | Marquee estático (respeta OS) |
| OS con reduced-motion, usuario activa toggle | Marquee se mueve (respeta elección explícita del usuario) |
| Hacer hover sobre el marquee | Se pausa al hacer hover, reanuda al quitar |
| Activar toggle en cualquier momento | Marquee se pausa/reanuda inmediatamente |
| `npm run build` | ✅ sin errores |
| GooeyBackground (canvas) | Sigue respondiendo al toggle, pero no fuerza localStorage |

---

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| `void track.offsetWidth` dispara reflow en cada toggleo | Es una sola llamada, imperceptible. |
| La clase `animations-paused` podría pausar spinners de carga | Agregar `.force-animate` como excepción si es necesario. |
| Otros componentes CSS podrían haber dependido del `!important` en `@media` | Revisarlos durante la auditoría visual post-cambio. |
| El GooeyBackground arranca con animaciones activas incluso con reducedMotion (tras el cambio 4.1) | Es el comportamiento correcto — si el usuario no ha tocado el toggle, el canvas corre igual (la opacidad es 0.03-0.05, casi imperceptible). Si el UX lead decide que debe respetar reducedMotion sin tocar localStorage, agregar una variable de sesión (`sessionStorage`). |

---

## 7. Esfuerzo estimado

| Fase | Commits | Esfuerzo |
|---|---|---|
| 1 — CSS | 1 | 10min |
| 2 — JS marquee | 1 | 15min |
| 3 — Toggle global | 1 | 5min |
| 4 — GooeyBackground | 1 | 5min |
| **Total** | **4 commits** | **~35min** |

---

## 8. Criterio de aceptación

- [ ] El marquee corre automáticamente en condiciones normales (sin reduced-motion).
- [ ] El toggle de animaciones pausa/reanuda el marquee CSS.
- [ ] Si `prefers-reduced-motion: reduce` está activo, la animación se reduce a 1 iteración (respeto del SO), pero el toggle del usuario puede reactivarla.
- [ ] El marquee se pausa correctamente al hacer hover.
- [ ] GooeyBackground no fuerza `localStorage = 'false'` en primera visita.