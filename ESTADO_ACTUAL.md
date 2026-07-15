# Estado actual — rama `Nahuel_Develop`

> Última sesión: 2026-07-14/15. Este archivo resume qué quedó hecho y qué
> falta para retomar el trabajo sin perder contexto.

## Hecho en esta sesión (commits locales, SIN pushear)

| Commit | Qué es |
|--------|--------|
| `83b5f6c` | Criterios de evaluación Feria de Ideas 2026 (7 criterios) + votación en dos fases |
| `7a2cd4f` | Admin: selector de fase, doble ranking con selección de finalistas, cards SOS ocultas |
| `2bb2f9d` | Limpieza de migración (clave huérfana `finalist_count`, `security_invoker` en la vista) + `.mcp.json` |
| `663b09e` | **Rediseño del tab "Mi Perfil"**: credencial de participante, tiles de enlaces, header con badge, edición inline de contacto. Commit aislado: si no convence, `git revert 663b09e` |
| `7327a3d` | Fix de anclas rotas en enlaces rápidos del dashboard |
| `86e5358` | **Fix de seguridad**: un juez con inscripción pendiente podía ver /evaluacion y votar por API (RLS solo chequeaba el rol). Migración `20260714_02` aplicada en Supabase |
| `a3ea79e` | Suite E2E completa con Playwright (14 tests, todos pasan) + `BACKLOG.md` |

## Estado de la base (Supabase `cotwhywqcocutrkmrpiw`)

- Migraciones `20260714_01` (fases + criterios) y `20260714_02` (juez aprobado) **aplicadas**.
- `evaluation_phase = cerrada`, `finalists_count = 10`.
- Usuario admin de prueba para la suite E2E: `e2e.admin@hem2026.test` (no borrar; lo usa `npm run test:e2e`).
- Datos e2e de las corridas ya limpiados.

## Pendientes para la próxima sesión

1. **Push** de los commits de `Nahuel_Develop` (y PR a `develop` cuando corresponda).
2. **Borrar perfiles de test viejos** — falta confirmar la lista. Candidatos claros:
   `test@gmail.com`, `test2@`, `test3@`, `test5@`, `juez@gmail.com`, `mentor@gmail.com`,
   `pepito@`, `pepe@gmail.com`, `pepe@gmail.c`, `seb@gm.c`, `sebadevalbornoz@` ("1234 1234"),
   `adminnahuelito@`, `betagamer345@`, y el equipo **"Los Vengadores"** con su proyecto "Guidia".
   ⚠️ Hay perfiles reales mezclados (admins del evento y participantes de junio):
   Martin Pérez Millán, Denia Gomez, Priscila Vitto, María Jesús Italiani,
   Gustavo García, Mauro Lizarraga, Brian Juan, magalyalvarez234, seba266@yahoo — NO tocar sin confirmar.
3. **Aprobación visual del rediseño de "Mi Perfil"** (probar en `/dashboard` con `npm run dev`).
4. **Rúbrica oficial**: esperando que el administrador del concurso confirme escala y pesos
   de los 7 criterios (ver `BACKLOG.md` punto 1). Hoy: 1–10 sin pesos, total /70.
5. Ítems restantes del `BACKLOG.md`: normalizar Instagram, validar teléfono,
   carrera de "Cargando..." en `ProjectSubmission.astro`.

## Cómo correr la suite E2E

```bash
npm run test:e2e
```

Ver la sección "Tests End-to-End" del README para detalles y limpieza de datos.
