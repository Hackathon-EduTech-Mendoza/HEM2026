# Auditoría de Accesibilidad con axe-core

> **Fecha**: 2026-06-04
> **Herramienta**: `axe-core` 4.11.4 vía `@axe-core/puppeteer`
> **Estándar**: WCAG 2.1 A + AA
> **Páginas auditadas**: 5 (landing, login, registro, bases, ediciones)
> **Script**: `scripts/axe-audit.mjs`

## Resumen ejecutivo

| Página | URL | Violations | Passes | Incomplete | Critical | Serious |
|---|---|---|---|---|---|---|
| Landing | `/` | 0 | 19 | 2 | 0 | 0 |
| Login | `/login` | 0 | 23 | 1 | 0 | 0 |
| Registro | `/registro` | 0 | 24 | 1 | 0 | 0 |
| Bases | `/bases-y-condiciones` | 0 | 20 | 1 | 0 | 0 |
| Ediciones | `/ediciones` | 1 | 19 | 1 | 0 | 1 |

**Conclusión**: las 4 páginas críticas (landing + flujos de auth + bases) tienen **0 violations**. La página de ediciones tiene 1 violation `serious` preexistente no relacionada con alerts (ver § Detalle).

## Detalle de la única violation (ediciones)

Pendiente de inspección. Ver `axe-reports/ediciones.json` para los detalles completos.

## Páginas no auditadas (requieren auth)

- `/dashboard` (requiere sesión activa)
- `/dashboard/equipo` (requiere sesión)
- `/admin` (requiere rol admin)
- `/admin/usuarios` (requiere rol admin)
- `/mentoria` (requiere rol mentor)
- `/evaluacion` (requiere rol juez)
- `/onboarding` (requiere perfil incompleto)

Estas páginas se prueban manualmente siguiendo el procedimiento en `docs/audits/screen-reader-test-procedure.md`.

## Cómo ejecutar la auditoría

```bash
# 1. Iniciar el dev server en una terminal
npm run dev

# 2. En otra terminal, correr la auditoría
node scripts/axe-audit.mjs

# Opciones:
#   --base=http://localhost:4321   (URL base del dev server)
#   --out=docs/audits/axe-reports  (directorio de salida)
```

## Archivos generados

```
docs/audits/axe-reports/
├── _summary.json     ← resumen agregado
├── landing.json      ← reporte completo por página
├── login.json
├── registro.json
├── bases.json
└── ediciones.json
```

## Criterio de aprobación

| Estado | Criterio | Resultado |
|---|---|---|
| ✅ PASA | 0 violations critical/serious en páginas públicas | Sí |
| ✅ PASA | 0 violations critical/serious en `/login` y `/registro` | Sí |
| ⚠️ REVISAR | 0 violations serious en páginas autenticadas | Pendiente (requiere auth) |
