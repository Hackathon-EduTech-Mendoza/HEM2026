# Backlog Priorizado — Refactor de Alertas

> **Fecha**: 2026-06-04
> **Input**: `docs/audits/alerts-audit.md`
> **Criterio de priorización**: `impacto_usuario × frecuencia × riesgo_operativo`

## Matriz de priorización

```
                       IMPACTO USUARIO
                 Bajo              Alto
            ┌──────────────┬──────────────┐
   Alta     │   DEFERIR    │   P0 URGENTE │
FRECUENCIA  │              │              │
            ├──────────────┼──────────────┤
   Baja     │   DROP       │   P1 RÁPIDO  │
            │              │              │
            └──────────────┴──────────────┘
```

## P0 — Urgente (impacto alto, frecuencia alta)

### P0.1 · Consolidar `showToast` en `admin/index.astro`
- **Hallazgo**: 6.1 (22 invocaciones)
- **Riesgo**: shadowing del nombre `showToast` con el wrapper al migrar
- **Complejidad**: M (refactor mecánico de 22 sitios + eliminar HTML/CSS/JS inline)
- **Esfuerzo**: ~1h
- **Justificación**: el admin es la página de mayor tráfico operacional durante el evento. 22 confirmaciones de éxito/error con toast inconsistente es la mayor fuente de fricción.

### P0.2 · Reemplazar `confirm()` en `admin/index.astro:2554` (Brevo)
- **Hallazgo**: 2.2
- **Riesgo**: ALTO — consumir cuota diaria de Brevo (300 emails/día del plan gratuito) por un click accidental
- **Complejidad**: S (1 sitio)
- **Esfuerzo**: ~10min
- **Justificación**: acción irreversible + impacto monetario. Bloqueante de release.

## P1 — Rápido (impacto alto, frecuencia baja)

### P1.1 · Reemplazar `alert()` en `dashboard/index.astro:1546` (RPC help)
- **Hallazgo**: 1.1
- **Complejidad**: S
- **Esfuerzo**: ~5min
- **Justificación**: el panel SOS es el canal de emergencia; la UX del error debe ser consistente con el resto del sistema.

### P1.2 · Reemplazar `alert()` en `ProjectSubmission.astro:303`
- **Hallazgo**: 1.2
- **Complejidad**: S
- **Esfuerzo**: ~5min
- **Justificación**: la entrega de proyecto es el momento más crítico del usuario; el error debe guiar la acción.

### P1.3 · Reemplazar `confirm()` en `TeamManager.astro:701` (abandonar equipo)
- **Hallazgo**: 2.3
- **Riesgo**: medio — disolver un equipo es destructivo pero recuperable (volver a crearlo)
- **Complejidad**: S
- **Esfuerzo**: ~10min

### P1.4 · Reemplazar `confirm()` en `admin/index.astro:2386` (asignar/resetear mentores)
- **Hallazgo**: 2.1
- **Riesgo**: medio — afecta el cronograma de mentoría pero no es destructivo
- **Complejidad**: S
- **Esfuerzo**: ~10min

## P2 — Diferir (impacto medio, refactor de mayor envergadura)

### P2.1 · Migrar `<dialog>` admin (hallazgo 5.1) a `Swal.fire({ html })`
- **Justificación**: el modal actual ya es accesible. Migrar es mejora estética, no funcional.
- **Decisión pendiente**: ¿se mantiene el `<dialog>` o se migra a Swal? Argumentos a favor de Swal: consistencia con el DS. Argumentos a favor de `<dialog>`: ya es accesible, no requiere serializar HTML a string.
- **Esfuerzo estimado**: ~30min si se migra.

### P2.2 · Migrar modal de evaluación (hallazgo 5.2) a `Swal.fire({ html })` con `preConfirm`
- **Riesgo**: ALTO — el modal tiene 4 sliders con estado, 1 textarea, 2 links condicionales, y datos hidden. Serializar un formulario con sliders dentro de `preConfirm` es propenso a bugs de timing.
- **Recomendación**: **mantener** el `<dialog>` HTMLDialogElement (migrar de `<div>` a `<dialog>` para hacerlo accesible) y usar el wrapper solo para `showToast`/`showConfirm`.
- **Esfuerzo estimado**: ~1h para migrar `<div>` → `<dialog>`, 0 si se decide dejar como está con solo agregar toast del wrapper.

## P3 — Drop (impacto bajo)

### P3.1 · Consolidar `showToast` en `recuperar-password.astro` (6.2), `actualizar-password.astro` (6.3), `TeamManager.astro` (6.4), `evaluacion.astro` (6.5)
- **Frecuencia**: 1, 1, 8, 2 invocaciones respectivamente
- **Esfuerzo**: bajo cada uno (~10min) pero requiere eliminar HTML/CSS/JS de cada página
- **Decisión**: consolidar junto con la migración del módulo correspondiente en Fase 3.

## Backlog ordenado

| # | Hallazgo | Archivo | Esfuerzo | Bloqueante release |
|---|----------|---------|----------|---------------------|
| 1 | P0.2 confirm Brevo | `admin/index.astro:2554` | 10min | ✅ Sí |
| 2 | P1.1 alert help | `dashboard/index.astro:1546` | 5min | ✅ Sí |
| 3 | P1.2 alert proyecto | `ProjectSubmission.astro:303` | 5min | ✅ Sí |
| 4 | P1.3 confirm abandonar equipo | `TeamManager.astro:701` | 10min | ✅ Sí |
| 5 | P1.4 confirm reset mentores | `admin/index.astro:2386` | 10min | ✅ Sí |
| 6 | P0.1 showToast admin | `admin/index.astro` (×22) | 1h | ⚠️ Recomendado |
| 7 | P3.1.4 showToast TeamManager | `TeamManager.astro` (×8) | 15min | — |
| 8 | P3.1.5 showToast evaluacion | `evaluacion.astro` (×2) | 10min | — |
| 9 | P2.1 dialog admin | `admin/index.astro` | 30min | — |
| 10 | P2.2 modal evaluacion | `evaluacion.astro` | 1h (refactor a `<dialog>`) | — |
| 11 | P3.1.2 showToast recuperar | `recuperar-password.astro` (×1) | 10min | — |
| 12 | P3.1.3 showToast actualizar | `actualizar-password.astro` (×1) | 10min | — |

**Total**: ~3.5h para todos los hallazgos. **~40min** para los 5 hallazgos bloqueantes de release.

## Recomendación para Fase 3

Ejecutar en este orden:
1. **Fase 3A — Auth y críticos**: hallazgos 1, 2, 3, 4, 5 (40min, 5 commits)
2. **Fase 3B — Admin consolidado**: hallazgo 6 (1h, 1 commit grande)
3. **Fase 3C — Toasts secundarios**: hallazgos 7, 8, 11, 12 (45min, 4 commits)
4. **Fase 3D — Modales propios**: hallazgos 9, 10 (1.5h, 2 commits)
