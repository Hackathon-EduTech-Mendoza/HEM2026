# Estado actual — rama `Nahuel_Develop`

> Última sesión: 2026-07-24. Este archivo resume qué quedó hecho y qué
> falta para retomar el trabajo sin perder contexto.
>
> Todo lo listado abajo está **pusheado** a `origin/Nahuel_Develop` (merge `1d81eef`).
> Falta el PR a `develop`.

## Commits de las sesiones 2026-07-14/15 y 2026-07-24

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
- `20260724_01` (rúbrica EduTech 1–5 ponderada) y `20260724_02` (`profiles.institution_other`)
  **aplicadas el 2026-07-24**. Verificado: `evaluations` sin `score_validation` y con CHECK 1–5,
  vista `project_leaderboard` con `raw_score` + `final_score` y `security_invoker=true`.
- `evaluation_phase = cerrada`, `finalists_count = 10`.

### ⚠️ Historial de migraciones desincronizado

Las migraciones se aplicaron siempre por MCP/dashboard, así que en
`supabase_migrations.schema_migrations` figuran con timestamps propios que **no coinciden
con los nombres de archivo locales**. Para el CLI, ninguna migración local está aplicada:
**`supabase db push` intentaría reaplicar todo desde mayo y rompería la base.**

Para aplicar migraciones nuevas, ejecutar el SQL directo contra la conexión
(`SUPABASE_DB_URL` en `.env`, por el pooler) o seguir usando el MCP. Ordenar esto con
`supabase migration repair` es un pendiente aparte.

### Conexión a la base

El host directo `db.<ref>.supabase.co` **solo resuelve a IPv6** y no es alcanzable desde
la red del equipo. Hay que usar el pooler:
`postgresql://postgres.<ref>:<password>@aws-1-us-east-2.pooler.supabase.com:5432/postgres`
(ojo: por el pooler el usuario es `postgres.<project_ref>`, y los caracteres especiales de
la contraseña van percent-encodeados — el `#` como `%23`).
- Usuario admin de prueba para la suite E2E: `e2e.admin@hem2026.test` (no borrar; lo usa `npm run test:e2e`).
- Datos e2e de las corridas ya limpiados.

## Pendientes para la próxima sesión

1. ~~Push de los commits~~ **HECHO el 2026-07-24**. Falta el **PR a `develop`**.
   Nota: el `origin` local apunta a `Nahuelito22/HEM2026`, que redirige a
   `Hackathon-EduTech-Mendoza/HEM2026`. Conviene actualizar la URL del remoto.

### Hallazgos abiertos de la auditoría (2026-07-24)

- **El jurado no puede corregir un voto ya guardado.** La UI de `/evaluacion` sólo
  hace `insert`, y el `UNIQUE(project_id, judge_id, phase)` impide volver a votar.
  La política RLS de UPDATE ya existe, así que falta sólo el camino en la interfaz.
  Riesgo real durante el evento: un juez que se equivoca queda trabado.
- **Admin en `/evaluacion` con la fase cerrada** ve la lista de proyectos y el botón
  "Evaluar", pero guardar falla porque `phase` sería `cerrada` y el CHECK sólo admite
  `preclasificacion`/`final`. Los jueces no lo sufren (ven el aviso de cerrado).
- **`event_config` tiene fechas viejas**: `event_start_datetime` (2026-06-03) y
  `submission_deadline` (2026-06-06) son de la edición anterior. Hoy **no se usan**
  (el countdown del Hero tiene la fecha hardcodeada, 2026-08-26), pero si alguien
  reactiva el fetch comentado en `Hero.astro` el contador queda mal.
2. ~~Borrar perfiles de test viejos~~ **HECHO el 2026-07-24** (lista confirmada por Martín).
   Se borraron 13 perfiles con sus cuentas de `auth.users`, el equipo **"Los Vengadores"**
   y el proyecto **"Guidia"**. Quedaron 16 perfiles, 0 equipos y 0 proyectos.
   Se **conservó** `e2e.admin@hem2026.test` porque lo necesita `npm run test:e2e`.
   `adminnahuelito@` y `betagamer345@` (cuentas admin propias) tampoco estaban en la lista.
3. **Aprobación visual del rediseño de "Mi Perfil"** (probar en `/dashboard` con `npm run dev`).
4. **Rúbrica EduTech**: ya implementada y aplicada (6 criterios, escala 1–5, puntaje
   ponderado + suma directa, instructivo para el jurado en `/evaluacion`). Queda definir
   con el administrador si el resultado oficial sale del ponderado o de la suma directa
   (ver `BACKLOG.md` punto 1).
5. Ítems restantes del `BACKLOG.md`: normalizar Instagram, validar teléfono,
   carrera de "Cargando..." en `ProjectSubmission.astro`.

## Cómo correr la suite E2E

```bash
npm run test:e2e
```

Ver la sección "Tests End-to-End" del README para detalles y limpieza de datos.
