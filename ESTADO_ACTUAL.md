# Estado actual del repositorio

> Actualizado: **2026-07-29**. Resume dónde está el código, cómo está la base y
> qué queda pendiente, para poder retomar sin reconstruir el contexto.

## Git

| | |
|---|---|
| Rama de trabajo | `Nahuel_Develop` |
| Último commit | ver la tabla de la sesión 2026-07-29, más abajo |
| Estado | 10 commits locales **sin pushear** al 2026-07-29 |

El PR **#32 fue mergeado a `main` y está deployado**. Sobre eso están los commits
de la sesión del 2026-07-29, todavía solo en local: falta pushear
`Nahuel_Develop` y abrir el PR.

⚠️ **`develop` NO tiene este trabajo.** Quedó en una línea divergente
(`689ac41`, con los componentes de Seba). Si el flujo del equipo sigue usando
`develop`, hay que decidir si se sincroniza con `main` o si se descarta esa rama.
Otras ramas remotas activas: `Gustavo_develop` (exportar Excel/PDF en admin) y
`seba/feat/componentes-orden`.

El `origin` local apunta a `Nahuelito22/HEM2026`, que redirige a
`Hackathon-EduTech-Mendoza/HEM2026`. Conviene actualizar la URL del remoto.

### Sesión 2026-07-29 (métricas, backlog y tests)

| Commit | Qué es |
|--------|--------|
| `06889cc` | Pestaña **Métricas** en el admin (inscriptos, estados, roles, instituciones, gráfico diario) |
| `8da7258` | El puntaje **ponderado** queda como oficial y se marca en pantalla |
| `73ff9a5` | Normalización de Instagram y teléfono + runner de tests unitarios |
| `8267b14` | La entrega de proyecto ya no borra lo tipeado al cargar |
| `fe12f71` | `/noticias` en el navbar y el footer |
| `bcf5e85` | Cobertura de El Nueve como prensa externa |
| `74bcff7` | `alt` reales y `poster` de los videos de la nota de la rectora |
| `5d5a12c` | Feed RSS en `/rss.xml` |
| `46b4bc0` | Suites de tests del sitio público y de la pestaña Métricas |

Se cerraron 8 de los 9 ítems que tenía el `BACKLOG.md`.

### Trabajo de la sesión 2026-07-28 (sitio público)

| Commit | Qué es |
|--------|--------|
| `d17b636` | Cuyo Connect sumado a aliados estratégicos |
| `d815d06` | Ajuste de altura del logo de Cuyo Connect |
| `4ad3bb1` | Nota de Los Andes + el "Leer más" pasa a funcionar de verdad |
| `4176135` | Noticias migradas a content collection + nota de la rectora |
| `691af2e` | Listado `/noticias` y extracción de `NewsCard` |
| `a4cbebd` | Soporte de videos y carpeta de medios por nota |
| `070ddf6` | Fotos y videos de la nota de la rectora conectados |
| `155a4f4` | Observación del jurado: del viernes al sábado |
| `5db7ffd` | WhatsApp del evento publicado en FAQ y footer |

### Sesión 2026-07-24 (evaluación)

Rúbrica de 6 criterios 1–5 con puntaje ponderado, instructivo para el jurado,
Bases y Condiciones alineadas, campo libre de institución, tests E2E y playbook
de QA. Detalle en el historial (`d8ee95b`…`c39bb2d`).

## Base de datos (Supabase `cotwhywqcocutrkmrpiw`, región us-east-2)

**Contenido al 2026-07-29:** **49 perfiles** (35 usuario, 3 mentor, 3 juez, 8
staff entre admin y superadmin) y **0 equipos, 0 proyectos, 0 evaluaciones**.
De los 49, **27 aprobados y 22 pendientes de revisión**. Por institución: 20 del
IES 9-023, 4 de Edison, 3 "otra", y **16 sin institución** (gente que se registró
y no terminó el onboarding).

Estos números salen ahora de la pestaña **Métricas** del admin, que los calcula
sobre `profiles` sin consultas nuevas. Antes había que ir a Vercel o leerlos
sueltos en otras pestañas.

Los datos de prueba viejos se borraron el 2026-07-24 junto con el equipo "Los
Vengadores" y el proyecto "Guidia". Se conservó `e2e.admin@hem2026.test`, que lo
necesita `npm run test:e2e`.

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

**El puntaje oficial es el ponderado (/100)** — decidido por el administrador del
concurso el 2026-07-29. Es el que ordena el ranking y define posiciones. La suma
directa (/30) se sigue mostrando al lado, marcada como referencia, pero no define
nada. Los encabezados del ranking dicen "(oficial)" y "(referencia)".

## Noticias (sitio público)

Las noticias son una **content collection de Astro**: un `.md` por noticia en
`src/content/noticias/`, con schema tipado en `src/content.config.ts`. Antes eran
un array hardcodeado dentro del componente. Para publicar una noticia ahora
alcanza con agregar un archivo: no se toca ningún componente.

El **tipo de noticia sale del frontmatter**, sin flags extra:

| Tipo | Cómo se define | Qué hace la tarjeta |
|---|---|---|
| Prensa externa | tiene `url` + `fuente` | abre el medio en pestaña nueva |
| Nota interna | tiene cuerpo markdown | va a `/noticias/<slug>`, que se prerenderiza |
| Aviso corto | ni `url` ni cuerpo | sin "Leer más" |

Piezas: `NewsCard.astro` (tarjeta compartida), `NewsSection.astro` (bloque del
home, muestra las 3 más recientes + "Ver todas" si hay más), `/noticias`
(listado completo), `/noticias/[slug]` (nota interna) y `NewsVideoPlayer.astro`
(escenario + playlist, encadena la parte siguiente al terminar una).
`src/utils/noticias.ts` centraliza orden, formato de fecha y resolución de enlace.

### Medios

Una carpeta por nota, nombrada con el slug del `.md`:

```
public/img/noticias/<slug>/      fotos (.webp)
public/video/noticias/<slug>/    videos propios (.mp4 H.264 + AAC)
```

Hay un `README.md` en cada una con el flujo. **Política de videos:** si ya está
publicado en YouTube/redes se usa el campo `youtube` (se embebe por
`youtube-nocookie`); solo se versionan archivos propios de menos de ~10 MB,
porque **lo que entra al repo queda para siempre en el historial de git**. Hoy la
nota de la rectora tiene 3 mp4 propios que suman 4,5 MB.

⚠️ **`content.config.ts` no se recarga en caliente.** Si agregás una noticia y la
sección aparece vacía en dev, reiniciá `npm run dev`. Los `.md` sí se recargan
solos; el que no es la config de la colección.

## Contacto

WhatsApp del evento **+54 9 2615 36-5167** y el mail viven en
`src/utils/contacto.ts`, y desde ahí los consumen el cierre del FAQ y el footer.
Si cambian, se tocan en un solo lado.

## Tests

Tres comandos:

| Comando | Qué corre | Toca la base |
|---|---|---|
| `npm run test:unit` | 34 tests de las funciones puras (`src/utils/perfil.ts`) | no |
| `npx playwright test sitio-publico` | 9 tests del sitio público | no |
| `npx playwright test admin-metricas` | 4 tests de la pestaña Métricas | solo lee |
| `npm run test:e2e` | todo, incluido el flujo serial completo | **sí, escribe** |

Los unitarios usan el runner de Playwright con `playwright.unit.config.ts` (sin
navegador ni dev server) para no sumar otra dependencia. Corren en ~1 segundo.

`tests/e2e/full-flow.spec.ts` son 14 tests **seriales** que cubren registro,
onboarding, equipos, entrega de proyecto, aprobación de juez, votación en dos
fases, finalistas y seguridad (middleware, RLS y escalación de rol). Corren
contra la base real: los datos de prueba usan `e2e.*@hem2026.test` y equipos
`Equipo E2E *`; hay que limpiarlos después y devolver `evaluation_phase` a
`cerrada`. Estaban en verde al 2026-07-24; el test de entrega de proyecto se
reescribió el 2026-07-29 y **todavía no se volvió a correr la suite completa**.

`sitio-publico.spec.ts` y `admin-metricas.spec.ts` son independientes del flujo
serial, así que se pueden correr sueltas sin ensuciar nada.

⚠️ La suite corre en el **puerto 4399**, no en el 4321. Con `reuseExistingServer`
y el puerto por defecto, si había otro proyecto Astro levantado los tests corrían
contra ese sitio y fallaban con un 404 desconcertante.

### CI (GitHub Actions)

`.github/workflows/ci.yml`. En **cada push y cada PR** corren tres jobs que no
tocan la base: `unit`, `build` y `e2e-publico`. Les alcanza con credenciales
falsas de Supabase, porque las páginas públicas se prerenderizan y el middleware
las saltea (`context.isPrerendered`).

La suite completa (`e2e-completo`) **no corre automático**: escribe en la base
real. Se dispara a mano desde Actions → CI → *Run workflow*, marcando la casilla.

Para que ese job funcione hacen falta dos **secrets** en el repo
(Settings → Secrets and variables → Actions):

| Secret | Valor |
|---|---|
| `PUBLIC_SUPABASE_URL` | el mismo del `.env` |
| `PUBLIC_SUPABASE_ANON_KEY` | el mismo del `.env` |

Sin esos secrets los otros tres jobs igual pasan; solo falla `e2e-completo`.

⚠️ **`tests/e2e/utils.ts` lee un archivo `.env` del disco**, no `process.env`, así
que el workflow lo materializa desde los secrets antes de correr. Si algún día se
agrega una variable a los tests, hay que sumarla en los dos lugares.

## Pendientes

### Decisiones con la organización

1. **Aprobación de Martín** para el texto nuevo de la sección 6 de las Bases y
   Condiciones (criterios con peso + proceso en dos instancias).

### Bugs y mejoras abiertos

2. **El jurado no puede corregir un voto ya guardado.** `/evaluacion` sólo hace
   `insert` y el `UNIQUE(project_id, judge_id, phase)` bloquea el segundo intento.
   La policy RLS de UPDATE ya existe: falta sólo el camino en la interfaz. Riesgo
   real durante el evento, y es **el pendiente más urgente**.
3. **Admin en `/evaluacion` con la fase cerrada** ve la lista y el botón "Evaluar",
   pero guardar falla porque `phase` sería `cerrada` y el CHECK sólo admite
   `preclasificacion`/`final`. A los jueces no les pasa.
4. **`event_config` con fechas viejas**: `event_start_datetime` (2026-06-03) y
   `submission_deadline` (2026-06-06) son de la edición anterior. Hoy **no se usan**
   (el countdown del Hero tiene 2026-08-26 hardcodeada), pero rompen si alguien
   reactiva el fetch comentado en `Hero.astro`.
5. **22 inscripciones esperando aprobación** al 2026-07-29 (de 49 totales). Se ven
   en la pestaña Métricas del admin.
6. Ítems restantes del `BACKLOG.md`: miniatura en las tarjetas de noticia,
   estadísticas de visitas propias, validación de `institution_other`,
   `var(--t-normal)` inexistente y el orden del historial de migraciones.

### Higiene

7. **Rotar la service role key y la contraseña de la base**: quedaron expuestas
   en una sesión de trabajo del 2026-07-24.
8. Aprobación visual del rediseño del tab "Mi Perfil" (commit `663b09e`; si no
   convence, `git revert 663b09e`).
