# Auditoría de Alertas Nativas — HEM2026

> **Fecha**: 2026-06-04
> **Rama**: `Nahuel_Develop`
> **Alcance**: `src/` completo (38 archivos: 32 `.astro`, 2 `.ts`, 2 `.js`, 1 `.d.ts`, 1 `.css`)
> **Wrapper disponible**: `src/utils/alerts.js` (SweetAlert2 ^11.26.25)

## Resumen ejecutivo

| Categoría | Ocurrencias | Acción |
|---|---|---|
| `alert()` nativos | 2 | Reemplazar por `showError()` |
| `confirm()` nativos | 3 | Reemplazar por `showConfirm({ destructive })` |
| `prompt()` nativos | 0 | — |
| Notification API | 0 | — |
| Modales custom (`<dialog>`) | 1 | Migrar a `Swal.fire({ html })` |
| Modales custom (`<div>` + clase) | 1 | Evaluar migración a `Swal.fire({ html })` o mantener `<dialog>` |
| Wrappers `showToast` duplicados | 5 | Consolidar en `showToast()` del wrapper |
| **Total refactor estricto** | **7** | — |
| **Total + consolidación** | **12** | — |

## Hallazgos detallados

### 1 · `alert()` nativos

| # | Archivo | Línea | Snippet | Tipo | Propuesta |
|---|---------|-------|---------|------|-----------|
| 1.1 | `src/pages/dashboard/index.astro` | 1546 | `alert(data?.error \|\| error?.message \|\| 'Error al pedir ayuda.');` | error (RPC `request_help`) | `await showError('No se pudo enviar el pedido', data?.error \|\| error?.message)` |
| 1.2 | `src/components/ProjectSubmission.astro` | 303 | `alert('Hubo un error al guardar el proyecto. Revisa tu conexión o intenta más tarde.')` | error (Supabase upsert) | `await showError('No se pudo guardar el proyecto', 'Revisá tu conexión o intentá más tarde.')` |

### 2 · `confirm()` nativos

| # | Archivo | Línea | Snippet | Tipo | Propuesta |
|---|---------|-------|---------|------|-----------|
| 2.1 | `src/pages/admin/index.astro` | 2386 | `if (!confirm(confirmMsg)) return;` (asignar/resetear mentores) | confirmación destructiva condicional | `const ok = await showConfirm({ title: ..., text: confirmMsg, destructive: reset, ... }); if (!ok) return;` |
| 2.2 | `src/pages/admin/index.astro` | 2554 | `if (!confirm(confirmMsg)) return;` (envío comunicado Brevo a N destinatarios) | confirmación crítica (consume cuota diaria Brevo) | `await showConfirm({ title: '¿Enviar comunicado a ' + N + ' personas?', text: confirmMsg, destructive: true, confirmText: 'Sí, enviar' })` |
| 2.3 | `src/components/TeamManager.astro` | 701 | `if (!confirm(msg)) return;` (abandonar / disolver equipo) | confirmación destructiva | `await showConfirm({ title: '¿Abandonar el equipo?', text: msg, destructive: true, confirmText: 'Abandonar' })` |

### 3 · `prompt()` nativos

Sin hallazgos.

### 4 · Notification API

Sin hallazgos. Las 3 ocurrencias de la palabra `Notification` en el código son comentarios HTML (`<!-- Toast Notification -->` en `admin/index.astro:935`, `recuperar-password.astro:42`, `actualizar-password.astro:59`).

### 5 · Modales custom (no usan SweetAlert2)

| # | Archivo | Líneas | Patrón | Contenido | Propuesta |
|---|---------|--------|--------|-----------|-----------|
| 5.1 | `src/pages/admin/index.astro` | 892 / 933 / 2420 | `<dialog id="help-dialog" class="admin-dialog">` + `helpDialog?.showModal()` | Texto estático ("Guía Rápida de Administración": Usuarios, Configuración, Mentoría) | `Swal.fire({ html: '...contenido estático...', width: 650, confirmButtonText: 'Entendido' })` |
| 5.2 | `src/pages/evaluacion.astro` | 138-225 (markup) / 553-610 (JS) / 362-435 (CSS) | `<div id="eval-modal" class="modal-backdrop">` + `function openModal(project)` / `closeModal()` | **Formulario completo**: 4 sliders, textarea feedback, 2 links condicionales, hidden inputs (`project_id`, `judge_id`) | **(a)** `Swal.fire({ html: formHTML, width: 800, preConfirm: serializar })` · **(b)** mantener `<dialog>` HTMLDialogElement (ya accesible) y usar wrapper solo para toasts/confirms. Recomendar **(a)** para consistencia con DS. |

### 6 · Wrappers `showToast` custom (duplican funcionalidad)

| # | Archivo | Definición | Invocaciones | Toast container |
|---|---------|------------|--------------|-----------------|
| 6.1 | `src/pages/admin/index.astro` | línea 1984 | 22 invocaciones (líneas 2030, 2035, 2152, 2156, 2196, 2199, 2224, 2227, 2252, 2255, 2280, 2283, 2321, 2323, 2365, 2367, 2398, 2400, 2541, 2547, 2580, 2582, 2600) | inline |
| 6.2 | `src/pages/recuperar-password.astro` | línea 230 | 1 (línea 281) | `<div id="toast">` (línea 43) |
| 6.3 | `src/pages/actualizar-password.astro` | línea 251 | 1 (línea 323) | `<div id="toast">` (línea 60) |
| 6.4 | `src/components/TeamManager.astro` | línea 469 | 8 (líneas 658, 666, 684, 692, 710, 719, 740, 742) | `<div id="team-toast">` (línea 125) |
| 6.5 | `src/pages/evaluacion.astro` | línea 631 | 2 (líneas 663, 667) | `<div id="toast">` (línea 223) |

> **Riesgo de shadowing**: al migrar, hay que renombrar/eliminar la función local antes de `import { showToast } from '@/utils/alerts'`. Alternativa: `import * as Alerts from '@/utils/alerts'` y usar `Alerts.showToast(...)`.

## Archivos SIN hallazgos de alerts nativos / modales custom

### Pages
- `src/pages/404.astro`
- `src/pages/bases-y-condiciones.astro`
- `src/pages/ediciones.astro`
- `src/pages/index.astro` (sólo `application/ld+json`, no scripts de cliente)
- `src/pages/login.astro` (errores en `errorDiv.textContent`, no usa `alert()`)
- `src/pages/mentoria.astro` (errores sólo `console.error`, sin feedback al usuario)
- `src/pages/onboarding.astro` (errores en `errorDiv.textContent`)
- `src/pages/registro.astro` (errores en `errorDiv.textContent`)
- `src/pages/__test-alerts.astro` (smoke test, ya usa el wrapper)

### Components
- `src/components/AnimToggle.astro`
- `src/components/FAQ.astro`
- `src/components/Footer.astro`
- `src/components/GooeyBackground.astro` (canvas, sin UI de feedback)
- `src/components/Hero.astro` (countdown en DOM, no modal)
- `src/components/InfoCards.astro`
- `src/components/Navbar.astro` (logout: `console.error` + `console.log` sin feedback al usuario)
- `src/components/NewsSection.astro`
- `src/components/Organizers.astro`
- `src/components/PreviousEditions.astro`
- `src/components/Prizes.astro`
- `src/components/Schedule.astro`
- `src/components/ThemeToggle.astro`
- `src/components/VibeCheck.astro`

### Layouts / Lib / Utils
- `src/layouts/Layout.astro`
- `src/lib/supabase.ts`
- `src/utils/alerts.js` (es el wrapper)
- `src/utils/alerts.d.ts`
- `src/middleware.ts` (server-side)
- `src/env.d.ts`

### API
- `src/pages/api/send-bulletin.ts` (server-side, errores vía `response.json()`)

## Observaciones

1. **Wrapper listo, casi sin adopción**: sólo `__test-alerts.astro` lo importa. La migración es directa.
2. **Shadowing de `showToast`** (ver §6): documentar el patrón de import en `BEST_PRACTICES.md`.
3. **Modal de evaluación (#5.2)** es el hallazgo más complejo (form completo con estado). Evaluar trade-off en reunión.
4. **Modal `<dialog>` nativo en admin (#5.1)** ya es accesible (focus trap, `Esc`, `::backdrop`) — buen candidato a `Swal.fire({ html })`.
5. **Copy en voseo argentino** ("Revisá tu bandeja", "intentá más tarde") — mantener en migración.
6. **Patrón uniforme de error**: `data?.error || error?.message || 'Error al...'` se repite. Considerar helper `showErrorFromResponse(err, fallbackMsg)`.
7. **Deuda técnica de UX**: 25 ocurrencias de `console.error` en 13 archivos sin feedback al usuario (ej. `Navbar.astro:722, 755`, `mentoria.astro:65`). **No es hallazgo de esta auditoría** pero vale la pena mencionarlo.
8. **Sin librerías externas de modales** en `package.json` (sólo SweetAlert2 + devDeps de Lighthouse/Puppeteer).
9. **Página de smoke test** `__test-alerts.astro` puede eliminarse tras la migración (Fase 3).
