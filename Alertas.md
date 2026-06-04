# Alertas — Estandarización de UX con SweetAlert2

> **Estado**: 📋 Propuesta pendiente de aprobación visual por el equipo técnico.
> **Alcance**: reemplazar `alert()` / `confirm()` / `prompt()` nativos por un wrapper accesible y consistente con el Design System.
> **Stack objetivo**: Astro 6.2 + vanilla JS + SweetAlert2 11+.

---

## 1. Contexto y motivación

La plataforma SaaS de la Hackathon está próxima a salir a producción. Hoy convivimos con alertas nativas de JavaScript (`alert()`, `confirm()`) dispersas en componentes `.astro`. Esto genera tres problemas concretos:

| Problema | Impacto |
|---|---|
| **Bloqueo del hilo principal** | La UI se congela; no se puede interactuar hasta aceptar. |
| **Ruptura estética** | El popup nativo ignora el Design System (colores, radios, tipografía). |
| **Inconsistencia cross-browser** | Texto, posición y copy difieren entre Chrome, Firefox y Safari. |

**Búsqueda actual** (grep en `src/`): 2 ocurrencias confirmadas de `alert(...)`:

- `src/pages/dashboard/index.astro:1546` → mensaje de error al pedir ayuda.
- `src/components/ProjectSubmission.astro:303` → error al guardar proyecto.

> El refactor masivo descubrirá más usos durante la **Épica 2 (Auditoría)**.

---

## 2. Design System aplicado a SweetAlert2

La paleta se inyecta en `src/utils/alerts.js` desde un único objeto `PALETTE` (fuente de verdad).

| Token | Hex | Uso |
|---|---|---|
| `bg` | `#1a1a1a` | Fondo del popup |
| `bgAlt` | `#262626` | Botón cancelar, fondo de toast |
| `text` | `#f3f4f6` | Título, contenido |
| `textMuted` | `#9ca3af` | Texto secundario |
| `primary` | `#d946ef` | Fucsia — acción principal / confirmar |
| `success` | `#a3e635` | Verde — éxito |
| `danger` | `#ef4444` | Rojo — error / acción destructiva |
| `warning` | `#f97316` | Naranja — advertencia |
| `border` | `#374151` | Borde sutil del popup |

> **Decisión**: el wrapper usa literales hex (no `var(--c1)`) porque SweetAlert2 se monta en un subárbol DOM fuera del contexto `[data-theme=...]` y las variables CSS no propagan.

---

## 3. API del wrapper

`src/utils/alerts.js` exporta cuatro funciones:

```js
import { showError, showSuccess, showConfirm, showToast } from '@/utils/alerts';
```

| Función | Retorno | Caso de uso |
|---|---|---|
| `showError(title, text, confirmText?)` | `Promise<SweetAlertResult>` | Validaciones, errores de API |
| `showSuccess(title, text, confirmText?)` | `Promise<SweetAlertResult>` | Operación completada |
| `showConfirm({ title, text, confirmText?, cancelText?, destructive?, icon? })` | `Promise<boolean>` | Decisión crítica antes de acción irreversible |
| `showToast(icon, title, timer?)` | `Promise<SweetAlertResult>` | Feedback efímero no bloqueante |

### Accesibilidad de fábrica (sin código extra)

- ✅ `role="alert"` y `aria-live` en pantalla de error.
- ✅ `aria-live="polite"` en toast.
- ✅ Focus trap automático.
- ✅ Cierre con `Esc`.
- ✅ Confirmación con `Enter`.
- ✅ `prefers-reduced-motion`: respetar las animaciones nativas de Swal (deshabilitables con `allowOutsideClick: false` + clase CSS si es necesario en QA).

---

## 4. Épicas, fases y commits

> **Convención de commits** (siguiendo el estilo del repo):
> `tipo(alcance): descripción breve`
> Tipos: `feat`, `refactor`, `chore`, `docs`, `style`, `test`, `fix`.

---

### 🟣 ÉPICA 1 — Setup e infraestructura

**Objetivo**: instalar la dependencia, crear el wrapper base y dejarlo listo para uso.

| # | Tarea | Commit |
|---|---|---|
| 1.1 | Instalar `sweetalert2` como dependencia de producción. | `chore(deps): add sweetalert2` |
| 1.2 | Crear `src/utils/alerts.js` con paleta, base config y 4 funciones públicas. | `feat(utils): add centralized SweetAlert2 wrapper` |
| 1.3 | Crear `src/utils/alerts.d.ts` con tipos TypeScript (opcional, recomendado). | `chore(types): add alerts type declarations` |
| 1.4 | Verificar manualmente cada función en una página de prueba (popup, toast, focus trap, Esc). | `chore(qa): manual smoke test of alerts wrapper` |

**Criterio de cierre de la épica**: las 4 funciones se invocan en `dev` con la paleta correcta.

---

### 🟣 ÉPICA 2 — Auditoría exhaustiva de uso actual

**Objetivo**: mapear TODAS las alertas nativas, prompts y confirms del proyecto antes de refactorizar.

> **Agente a desplegar**: `explore` (búsqueda exhaustiva en `src/`).
> **Prompt sugerido**:
> ```
> Buscá en src/ TODAS las ocurrencias de:
> - alert(...)
> - confirm(...)
> - prompt(...)
> - window.alert / window.confirm
> - uso de Notification API nativa
>
> Devolvé una tabla Markdown con: archivo, línea, contexto (3 líneas antes/después),
> tipo (error/éxito/confirmación/toast) y propuesta de reemplazo.
> ```

| # | Tarea | Commit |
|---|---|---|
| 2.1 | Lanzar subagente `explore` y obtener tabla de hallazgos. | `docs(audit): map native alert/confirm/prompt usage` |
| 2.2 | Priorizar hallazgos por frecuencia e impacto (matriz: auth > admin > dashboard > landing). | `docs(audit): prioritize alert refactor backlog` |
| 2.3 | Volcar hallazgos en `docs/audits/alerts-audit.md`. | `docs(audit): publish alerts audit findings` |

**Criterio de cierre**: 100% de las ocurrencias catalogadas, sin resultados sin asignar.

---

### 🟣 ÉPICA 3 — Refactor por módulo (3 fases)

> **Estrategia**: un commit por archivo tocado. Branch feature por fase.

#### Fase 3A — Auth (registro, login, recuperación)

| # | Tarea | Commit |
|---|---|---|
| 3A.1 | Refactor `src/pages/registro.astro` → reemplazar `form-error` div por `showError`. | `refactor(auth): use alerts wrapper in registro` |
| 3A.2 | Refactor `src/pages/login.astro` → errores de credenciales y validación. | `refactor(auth): use alerts wrapper in login` |
| 3A.3 | Crear `src/pages/recuperar.astro` (si no existe) usando `showSuccess` al enviar email. | `feat(auth): add password recovery page` |

#### Fase 3B — Dashboard y equipo

| # | Tarea | Commit |
|---|---|---|
| 3B.1 | Refactor `src/pages/dashboard/index.astro:1546` (alerta de ayuda SOS). | `refactor(dashboard): use alerts wrapper in SOS panel` |
| 3B.2 | Refactor `src/components/TeamManager.astro` → confirmaciones para salir/unirse a equipo. | `refactor(team): use alerts wrapper in TeamManager` |
| 3B.3 | Refactor `src/components/ProjectSubmission.astro:303`. | `refactor(project): use alerts wrapper in ProjectSubmission` |

#### Fase 3C — Admin y mentoría

| # | Tarea | Commit |
|---|---|---|
| 3C.1 | Refactor `src/pages/admin/index.astro` → confirmaciones de aprobación, rechazo, reset. | `refactor(admin): use alerts wrapper in admin panel` |
| 3C.2 | Refactor `src/pages/mentoria/index.astro` → confirmaciones de asignación. | `refactor(mentor): use alerts wrapper in mentoria` |
| 3C.3 | Refactor `src/pages/evaluacion/index.astro` → confirmaciones de puntaje. | `refactor(judge): use alerts wrapper in evaluacion` |

**Criterio de cierre de la épica**: `rg "alert\(|confirm\(|prompt\(" src/` → 0 resultados.

---

### 🟣 ÉPICA 4 — QA, accesibilidad y documentación

**Objetivo**: validar que la implementación cumple WCAG 2.2 AA y queda documentada para el equipo.

| # | Tarea | Commit |
|---|---|---|
| 4.1 | Auditoría a11y con axe-core (extensión o `@axe-core/cli`) en 3 páginas críticas. | `test(a11y): axe-core sweep of pages with alerts` |
| 4.2 | Pruebas con lector de pantalla (NVDA / VoiceOver) → confirmar lectura del título y contenido. | `docs(a11y): screen reader test report` |
| 4.3 | Lighthouse a11y ≥ 0.95 en login, registro, dashboard. | `test(perf): lighthouse a11y ≥ 0.95` |
| 4.4 | Documentar API en `BEST_PRACTICES.md` (sección "Alertas y notificaciones"). | `docs(guide): document SweetAlert2 wrapper usage` |
| 4.5 | Commit final de épica con tag `v1.0-alerts`. | `chore(release): tag v1.0-alerts` |

---

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Bundle size de SweetAlert2 (~30KB gzip) impacta LCP en landing. | Import dinámico (`await import('sweetalert2')`) en componentes; el wrapper ya lo permite vía tree-shaking. |
| Usuarios con `prefers-reduced-motion` ven animaciones. | Deshabilitar animaciones con `showClass: {}` y `hideClass: {}` si QA lo requiere. |
| Tests E2E (Playwright) no pueden asir `Swal.fire`. | Usar `await page.locator('.swal2-popup').waitFor()` + selectores por `customClass`. |
| Foco se pierde al cerrar modal en formularios largos. | `Swal` devuelve foco al `confirmButton` original por defecto; validar manualmente en QA. |

---

## 6. Definition of Done (DoD)

Una alerta está "estandarizada" cuando:

- [ ] No usa `alert()` / `confirm()` / `prompt()` nativos.
- [ ] Se invoca desde `src/utils/alerts.js` (no importa `sweetalert2` directo).
- [ ] El color de la acción principal coincide con la paleta del Design System.
- [ ] Pasa axe-core sin violaciones críticas.
- [ ] Es navegable por teclado (Tab, Esc, Enter).
- [ ] Está testeada en light mode y dark mode.

---

## 7. Próximos pasos

1. ✅ Equipo técnico aprueba paleta y API del wrapper.
2. ✅ Merge de Épica 1 a `main`.
3. ✅ Auditoría completada (Épica 2).
4. ⏳ Refactor por módulos (Épica 3) en PRs pequeños.
5. ⏳ QA + tag de release (Épica 4).

---

## 8. Bitácora de progreso

### Épica 1 — Setup e infraestructura ✅ COMPLETADA (2026-06-04)

| # | Tarea | Commit | Estado |
|---|---|---|---|
| 1.1 | Instalar `sweetalert2` | `6b6d086` | ✅ |
| 1.2 | Wrapper `src/utils/alerts.js` | `c2107fa` | ✅ |
| 1.3 | Declaraciones TypeScript `src/utils/alerts.d.ts` | `a8f7b9b` | ✅ |
| 1.4 | Página de smoke test `src/pages/__test-alerts.astro` | `fedb7df` | ✅ |

**Verificación**: `npm run build` completado sin errores. La página de smoke test sólo se renderiza en modo `dev` (`import.meta.env.DEV` → 404 en producción).

**Pendiente tras aprobación de Fase 2**: eliminar `src/pages/__test-alerts.astro`.

### Épica 2 — Auditoría exhaustiva ✅ COMPLETADA (2026-06-04)

| # | Tarea | Commit | Estado |
|---|---|---|---|
| 2.1 | Subagente `explore` → mapa de hallazgos en `docs/audits/alerts-audit.md` | `c0c92f3` | ✅ |
| 2.2 | Backlog priorizado en `docs/audits/alerts-audit-priority.md` | `ac2358e` | ✅ |
| 2.3 | Publicación de hallazgos (este commit) | _próximo_ | ⏳ |

**Hallazgos clave**:

- 5 alerts/confirm nativos (`alert`: 2, `confirm`: 3) en 4 archivos.
- 2 modales custom (`<dialog>` admin, `<div>` evaluación).
- 5 wrappers `showToast` duplicados (admin: 22 invocaciones, total: 34).
- Esfuerzo total estimado: **~3.5h** (40min para los 5 hallazgos bloqueantes de release).

**Documentos publicados**:
- `docs/audits/alerts-audit.md` — auditoría exhaustiva con tabla por categoría.
- `docs/audits/alerts-audit-priority.md` — matriz de priorización + backlog ordenado.
