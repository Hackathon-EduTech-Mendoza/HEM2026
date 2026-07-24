# Estado actual del repositorio

> Actualizado: **2026-07-24**. Resume dónde está el código, cómo está la base y
> qué queda pendiente, para poder retomar sin reconstruir el contexto.

## Git

| | |
|---|---|
| Rama de trabajo | `Nahuel_Develop` |
| Último commit | `c39bb2d` (dentro del merge `876f161`) |
| Estado | Limpio, sincronizado con `origin/Nahuel_Develop` |

El PR **#30 fue mergeado a `main`**, así que `origin/main`, `origin/Nahuel_Develop`
y la copia local apuntan al mismo commit.

⚠️ **`develop` NO tiene este trabajo.** Quedó en una línea divergente
(`689ac41`, con los componentes de Seba). Si el flujo del equipo sigue usando
`develop`, hay que decidir si se sincroniza con `main` o si se descarta esa rama.
Otras ramas remotas activas: `Gustavo_develop` (exportar Excel/PDF en admin) y
`seba/feat/componentes-orden`.

El `origin` local apunta a `Nahuelito22/HEM2026`, que redirige a
`Hackathon-EduTech-Mendoza/HEM2026`. Conviene actualizar la URL del remoto.

### Trabajo de la sesión 2026-07-24

| Commit | Qué es |
|--------|--------|
| `d8ee95b` | Rúbrica EduTech: 6 criterios 1–5 con puntaje ponderado, instructivo para el jurado, Bases y Condiciones alineadas, fix de las cards de configuración del admin |
| `2d770e8` | Campo libre de institución cuando se elige "Otra" |
| `ab8d18b` | Tests E2E de la rúbrica y del campo de institución + playbook de QA |
| `0fe729b` | Registro de la auditoría |
| `c39bb2d` | Guía rápida del admin actualizada con el flujo de evaluación |

## Base de datos (Supabase `cotwhywqcocutrkmrpiw`, región us-east-2)

**Contenido actual:** 16 perfiles (1 superadmin, 7 admin, 1 juez, 7 usuario),
**0 equipos, 0 proyectos, 0 evaluaciones**. Los datos de prueba se borraron el
2026-07-24 junto con el equipo "Los Vengadores" y el proyecto "Guidia".
Se conservó `e2e.admin@hem2026.test`, que lo necesita `npm run test:e2e`.

**Configuración:** `evaluation_phase = cerrada`, `finalists_count = 10`,
`teams_enabled = true`, `project_submission_enabled = true`.

**Migraciones aplicadas** (además de las históricas): `20260714_01` (fases y
criterios), `20260714_02` (juez aprobado), `20260724_01` (rúbrica 1–5
ponderada), `20260724_02` (`profiles.institution_other`).

### ⚠️ Cómo conectarse (y qué no hacer)

El host directo `db.<ref>.supabase.co` **sólo resuelve a IPv6** y no es
alcanzable desde la red del equipo. Hay que usar el pooler:

```
postgresql://postgres.<project_ref>:<password>@aws-1-us-east-2.pooler.supabase.com:5432/postgres
```

Por el pooler el usuario es `postgres.<project_ref>`, no `postgres` a secas, y
los caracteres especiales de la contraseña van percent-encodeados (el `#` como
`%23`). Está en `.env` como `SUPABASE_DB_URL`.

**Nunca corras `supabase db push`.** Las migraciones se aplicaron siempre por
MCP o dashboard, así que en `supabase_migrations.schema_migrations` quedaron con
timestamps que no coinciden con los nombres de archivo locales: para el CLI
ninguna migración local está aplicada y un push reaplicaría todo desde mayo.
Para aplicar SQL nuevo, ejecutalo directo contra la conexión o usá el MCP.
Ordenar el historial con `supabase migration repair` es un pendiente aparte.

Otro detalle del esquema: **`profiles` no tiene FK contra `auth.users`**. Borrar
la cuenta de auth no borra el perfil ni al revés; hay que hacer las dos puntas o
quedan perfiles huérfanos. Y `teams.leader_id` es `NO ACTION`, así que el equipo
se borra antes que el perfil de su líder.

## Sistema de evaluación

6 criterios puntuados del 1 al 5, definidos en **`src/lib/rubric.ts`** (fuente
única de verdad: la usan `/evaluacion`, el ranking del admin y los tests):

| Criterio | Peso |
|---|---|
| Problema y contexto educativo | 15% |
| Propuesta de solución y valor | 20% |
| Nivel de innovación | 15% |
| Factibilidad y prototipo | 20% |
| Impacto potencial en educación | 15% |
| Comunicación y pitch | 15% |

Los pesos están **duplicados a propósito** en la vista SQL `project_leaderboard`,
con comentarios cruzados: si cambiás uno, cambiá el otro.

El flujo es `cerrada → preclasificacion → deliberacion → final`, con selección
manual de finalistas (botón "Marcar Top N" + "Guardar Finalistas") entre medio.
El ranking del admin muestra **suma directa (/30)** y **ponderado (/100)**, y
ordena por el ponderado.

## Tests

`npm run test:e2e` — 14 tests seriales en `tests/e2e/full-flow.spec.ts`, **todos
en verde** al 2026-07-24. Cubren registro, onboarding, equipos, entrega de
proyecto, aprobación de juez, votación en dos fases, finalistas y seguridad
(middleware, RLS y escalación de rol).

Corren contra la base real. Los datos de prueba usan `e2e.*@hem2026.test` y
equipos `Equipo E2E *`; hay que limpiarlos después y devolver `evaluation_phase`
a `cerrada`.

## Pendientes

### Decisiones con la organización

1. **Puntaje oficial: ponderado o suma directa.** El panel muestra los dos para
   poder compararlos con datos reales (ver `BACKLOG.md` punto 1). Si se cambia,
   hay que tocar el `ORDER BY` de la vista, el `.order()` del admin y la guía rápida.
2. **Aprobación de Martín** para el texto nuevo de la sección 6 de las Bases y
   Condiciones (criterios con peso + proceso en dos instancias).

### Bugs y mejoras abiertos

3. **El jurado no puede corregir un voto ya guardado.** `/evaluacion` sólo hace
   `insert` y el `UNIQUE(project_id, judge_id, phase)` bloquea el segundo intento.
   La policy RLS de UPDATE ya existe: falta sólo el camino en la interfaz. Riesgo
   real durante el evento.
4. **Admin en `/evaluacion` con la fase cerrada** ve la lista y el botón "Evaluar",
   pero guardar falla porque `phase` sería `cerrada` y el CHECK sólo admite
   `preclasificacion`/`final`. A los jueces no les pasa.
5. **`event_config` con fechas viejas**: `event_start_datetime` (2026-06-03) y
   `submission_deadline` (2026-06-06) son de la edición anterior. Hoy **no se usan**
   (el countdown del Hero tiene 2026-08-26 hardcodeada), pero rompen si alguien
   reactiva el fetch comentado en `Hero.astro`.
6. Ítems del `BACKLOG.md`: normalizar Instagram, validar teléfono como el DNI, y
   la carrera de "Cargando..." en `ProjectSubmission.astro`.

### Higiene

7. **Rotar la service role key y la contraseña de la base**: quedaron expuestas
   en una sesión de trabajo del 2026-07-24.
8. Aprobación visual del rediseño del tab "Mi Perfil" (commit `663b09e`; si no
   convence, `git revert 663b09e`).
