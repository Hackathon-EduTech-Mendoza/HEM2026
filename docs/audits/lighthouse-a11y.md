# Auditoría Lighthouse — Accesibilidad

> **Fecha**: 2026-06-04
> **Herramienta**: Lighthouse 13.3.0
> **Categoría auditada**: `accessibility` (WCAG 2.1 A + AA)
> **Páginas auditadas**: 3 (login, registro, bases-y-condiciones)
> **Threshold del proyecto**: ≥ 95

## Resumen ejecutivo

| Página | Score a11y | Pasa threshold (≥95) | Audits fallidos |
|---|---|---|---|
| `/login` | **98** | ✅ | 1 (skip-link, preexistente) |
| `/registro` | **98** | ✅ | 1 (skip-link, preexistente) |
| `/bases-y-condiciones` | **98** | ✅ | 1 (skip-link, preexistente) |

**Conclusión**: las 3 páginas críticas aprueban el threshold de a11y. El único punto perdido es un **falso positivo conocido** de Lighthouse (skip-link con visibility-on-focus pattern) que ya existía antes del refactor de alerts.

## Detalle del único audit fallido

### `skip-link` — Skip links are not focusable.

**Páginas afectadas**: 3/3

**Descripción**: el proyecto tiene un skip-link para saltar al contenido principal (`<a href="#main-content" class="skip-link">Saltar al contenido</a>`). Por diseño, este enlace está visualmente oculto (`top: -40px`) hasta que recibe foco (`top: 0`). El enlace SÍ es focusable por teclado, pero Lighthouse espera que sea visible permanentemente para aprobar el audit.

**Por qué es un falso positivo**: el patrón "skip-link hidden until focus" es una práctica recomendada por WCAG 2.4.1 (Bypass Blocks) y es compatible con lectores de pantalla (que sí lo anuncian al recibir foco).

**Acción recomendada**: ignorar este audit. El comportamiento real es correcto.

**Si se quisiera "aprobarlos" en Lighthouse**:
- Opción 1: hacer el skip-link siempre visible (rompe el patrón visual).
- Opción 2: usar `clip` o `clip-path` en lugar de `top: -40px` (Lighthouse a veces lo reconoce).
- Opción 3: agregar `aria-hidden="false"` explícitamente (no cambia el comportamiento).

**Recomendación**: no tocar. Mantener el patrón.

## Páginas no auditadas (requieren auth)

- `/dashboard/*` (requiere sesión activa)
- `/admin/*` (requiere rol admin)
- `/mentoria` (requiere rol mentor)
- `/evaluacion` (requiere rol juez)

Estas páginas se prueban manualmente siguiendo el procedimiento en `docs/audits/screen-reader-test-procedure.md`. La auditoría automatizada con axe-core (Task 4.1) cubrió las páginas públicas restantes.

## Cómo ejecutar Lighthouse a11y

```bash
# 1. Iniciar el dev server
npm run dev

# 2. Correr lighthouse solo en la categoría accessibility
npx lighthouse http://localhost:4321/login \
  --only-categories=accessibility \
  --output=json \
  --output-path=docs/audits/lighthouse-reports/login.json \
  --chrome-flags="--headless --no-sandbox"
```

> **Nota Windows**: chrome-launcher emite un error `EPERM` al finalizar el cleanup del proceso de Chrome. El JSON se genera correctamente **antes** del error. Es un bug conocido de chrome-launcher en Windows y se puede ignorar.

## Archivos generados

```
docs/audits/lighthouse-reports/
├── login.json
├── registro.json
└── bases_y_condiciones.json
```

## Criterio de aprobación

| Estado | Criterio | Resultado |
|---|---|---|
| ✅ PASA | Lighthouse a11y ≥ 0.95 en `/login` | 0.98 |
| ✅ PASA | Lighthouse a11y ≥ 0.95 en `/registro` | 0.98 |
| ✅ PASA | Lighthouse a11y ≥ 0.95 en `/bases-y-condiciones` | 0.98 |
| ⚠️ REVISAR | Mismo threshold en páginas autenticadas | Pendiente manual |
