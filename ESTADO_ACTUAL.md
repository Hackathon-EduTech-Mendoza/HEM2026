# Estado actual del repositorio

> Actualizado: **2026-08-10**. Resume dónde está el código, cómo está la base y
> qué queda pendiente, para poder retomar sin reconstruir el contexto.

### Sesión 2026-08-10 (Res 0180, PDF de las Bases y bajas en prod)

**Noticias.** Se sumó la entrevista a **Virginia Hernández en Aconcagua Radio**
(06/08). Es un episodio de Spotify y la colección solo sabía embeber video, así
que se agregó **soporte de audio**: campo `audios: [{ titulo, spotify }]` y
`NewsAudioPlayer.astro`, más corto que el de video porque el iframe de Spotify
trae sus propios controles. `idDeYoutube` se mudó junto a `idDeSpotify` a
`src/utils/media.ts`, porque `utils/noticias.ts` importa `astro:content` y eso
dejaba a los extractores fuera del alcance de los unitarios.

⚠️ **El CSP de `vercel.json` no declaraba `frame-src`**, así que los embeds de
YouTube ya venían violando la política. No se notaba porque el header está en
`Content-Security-Policy-Report-Only`: reporta y no bloquea. **Un embed de un
dominio nuevo hay que declararlo ahí** o funciona hasta que alguien lo ponga en
modo enforcing.

**Res 0180 y puntaje docente.** El Art. 12º decía **"(en trámite)" tres veces**
sobre el aval y el puntaje, pero la resolución se firmó el 3/8/2026: el sitio
prometía menos de lo que ya tenía. En paralelo la FAQ afirmaba aval y puntaje
**sin respaldo ni condiciones**. La resolución se publicó en `public/docs/` sin
editar —es un acto oficial y no trae correos, teléfonos ni DNI— y se la cita
desde el **footer**, la **FAQ** y el **Art. 12º** (ancla `#art-premios`), con
los destinatarios y los requisitos de acreditación.

⚠️ El puntaje real para asistentes es **0,00399 / 0,021** según el título de
base. Es chico, lo normal para 12 horas: conviene no publicitarlo a secas.

**Bases descargables en PDF.** El `.docx` es la v11 presentada a la DES y su
Art. 11º delega la rúbrica a "una comunicación posterior": **no la trae**, y
tiene un solo anexo. La página sí publica el Anexo II, así que citaba un anexo
que el documento no tenía. Ahora el descargable principal es un **PDF de 169 KB
y 10 páginas** que genera `npm run docs:bases` imprimiendo la propia página; el
`.docx` queda como alternativa. ⚠️ **Es manual: regenerarlo cuando cambie el
articulado o la rúbrica.** Ver la sección "Bases y Condiciones" más abajo.

**Bajas en producción.** A pedido de Martín se borraron **Nydia Vitale** y
**Luciano Ordas** (Martín lo escribe "Ordaz"), que se habían inscripto con el
perfil equivocado. 147 → 145 perfiles. ⚠️ **Borrar siempre por UUID:** un match
por nombre se llevaba puesta a *Nidia Solórzano*, que es otra persona, y había
una tercera cuenta con el mismo apellido —`nvitale@colegionorbridge.edu.ar`— que
era la propia interesada rehaciendo la inscripción y **no** había que tocar.

### Sesión 2026-08-03 · parte 2 (correcciones de Martín)

Dos noticias nuevas de prensa externa (**mendoza.edu.ar** de la DGE y **Portal
TIC**), las **Bases reemplazadas por la v11** y el **WhatsApp dado de baja**.

**Bases y Condiciones:** la página pasó de 10 secciones propias a los **16
artículos de la v11** —la versión presentada a la DES— más dos anexos: el
cronograma y la rúbrica. El documento original se puede **descargar** desde la
página (`public/docs/`), que era el punto 6 del brief.

⚠️ **Por qué la rúbrica quedó como Anexo II.** El Art. 11º de la v11 sólo lista
cuatro aspectos generales y delega la rúbrica a "una comunicación posterior de la
organización". Si se reemplazaba literal, el sitio dejaba de publicar los seis
criterios con pesos por fase que el sistema **ya aplica**. El anexo cumple lo que
el artículo promete sin perder lo aprobado el 30/07. Los pesos están, entonces,
en tres lados: `src/lib/rubric.ts`, la vista `project_leaderboard` y esta página.

De paso se corrigieron las **sedes**, que en esa página seguían siendo las de una
versión vieja de las bases ("Espacio Cultural Julio Le Parc" y "Escuela Edison").

**Del brief quedaron sin aplicar los puntos 1 y 2** por decisión de Martín:
el sistema de representante de equipo y el perfil disciplinar esperan definición.
El punto 3 (eje temático único) ya estaba aplicado de antes.

#### El WhatsApp se dio de baja y lo reemplaza un formulario

El número salió de `FAQ.astro`, `Footer.astro` y `contacto.ts`: **no se usa más**.
En su lugar hay un canal de consultas propio:

| Pieza | Qué hace |
|---|---|
| `Consultas.astro` | Formulario público, en el home debajo del FAQ (`#consultas`) |
| `POST /api/consulta` | Valida, filtra spam, guarda y avisa por mail |
| Tabla `consultas` | Migración `20260803_01`. Badge de "nuevas" en el admin |
| Pestaña **Consultas** | Listado con estados nueva / respondida / archivada |

⚠️ **La tabla no tiene policy de INSERT, a propósito.** Nadie escribe por
PostgREST, ni siquiera `anon`: el único camino es el endpoint, que valida, aplica
el honeypot y el rate limit, y recién ahí escribe con la service role key. Si
algún día se agrega una policy de INSERT para `anon`, el formulario queda
expuesto a que lo carguen salteándose todas esas defensas.

⚠️ **El rate limit cuenta consultas guardadas, no intentos.** Son 3 cada 10
minutos por IP. Contar también los intentos inválidos —que fue la primera
versión— dejaba 10 minutos afuera a quien se equivocara tres veces tipeando el
correo, sin haber mandado nada. La memoria vive en el proceso, así que en
serverless se reinicia con cada instancia fría: frena el reenvío de una persona,
no un ataque distribuido.

**La consulta se guarda antes de intentar el mail.** Si Brevo falla, la consulta
ya está en la base y el admin la ve igual; al revés se perdería. El aviso lleva
`replyTo` con el correo de quien consultó, así que responder el mail le escribe
directo.

En el FAQ se actualizaron además los **criterios de evaluación** (ahora son los
cuatro aspectos del Art. 11º, con enlace al Anexo II) y las **certificaciones**
(aval de la DGE y puntaje docente).

### Sesión 2026-08-03 · parte 1 (cierre de la rúbrica por fase)

| Commit | Qué es |
|--------|--------|
| `3d2c822` | Rúbrica dependiente de la fase: en preclasificación no se puntúa el pitch |

La migración `20260731_01_rubrica_por_fase.sql` quedó **aplicada en las dos
bases**: en dev el 2026-07-31 y en **prod el 2026-08-03**, por el SQL Editor del
dashboard. Verificado contra prod: `score_communication` nullable, el CHECK de
coherencia fase/criterio presente, y `project_leaderboard` recreada con los pesos
por fase y `security_invoker = true`.

**La separación dev/prod quedó operativa.** "Confirm email" está en OFF en
HEM-Dev y la suite completa corrió entera contra dev: **32 E2E en verde** (2.8m,
con la limpieza del `afterAll` funcionando) más **56 unitarios**. Los tests ya no
tocan producción.

## Git

| | |
|---|---|
| Rama de trabajo | `Nahuel_Develop` |
| Último commit | `9990590` — PDF descargable de las Bases |
| Estado al 2026-08-10 | pusheado, con el **PR #41 abierto** contra `main` |

**El flujo es siempre el mismo:** se reusa `Nahuel_Develop` para cada PR contra
`main`. Del #35 al #41 salieron todos de esa rama. Después de un merge, la rama
local se pone al día con `git merge --ff-only origin/main`.

| PR | Contenido | Estado |
|---|---|---|
| #39 | Notas de prensa del 07/08, El Cruce MDZ, logos institucionales | mergeado 08/08 |
| #40 | Aconcagua Radio, soporte de audio y `frame-src` del CSP | mergeado 10/08 (`1b3acff`) |
| #41 | Res 0180 en footer/FAQ/Art. 12º y PDF de las Bases | ⏳ **abierto** |

⚠️ **`develop` ya no existe.** Se eliminó en el remoto, igual que
`Gustavo_develop` y `seba/feat/componentes-orden` (verificado con
`git fetch --prune` el 2026-08-10). Ya no hay que decidir nada sobre esa rama.

El `origin` ya apunta directo a `Hackathon-EduTech-Mendoza/HEM2026` (se corrigió
el 2026-07-29). Antes apuntaba a `Nahuelito22/HEM2026` y funcionaba por el
redirect de GitHub, con el riesgo de que si alguien creaba un repo nuevo con ese
nombre en esa cuenta, los push habrían empezado a ir ahí **sin ningún error**.

⚠️ **Si alguien del equipo clonó desde la URL vieja, tiene el mismo problema.**
Se revisa con `git remote -v` y se corrige con:

```bash
git remote set-url origin https://github.com/Hackathon-EduTech-Mendoza/HEM2026.git
```

### Sesión 2026-07-30 (UX del admin y registros abandonados)

| Commit | Qué es |
|--------|--------|
| `05a9f3e` | Las cards de Métricas y los encabezados de fase dejan de pegarse al borde |
| `2602895` | Los registros abandonados dejan de contar como inscriptos |
| `47d67fe` | El admin deja de ver una pantalla de votación que no puede usar, y `var(--t-normal)` |
| `07b55f4` | Las tarjetas de noticia muestran la portada cuando la nota tiene una |
| `90dc9ab` | Segmento de comunicados para el recordatorio a los registros incompletos |
| `7d65fa4` | Bootstrap de HEM-Dev con el esquema de prod, sin datos personales |

### ✅ Separación HEM-Prod / HEM-Dev: OPERATIVA desde el 2026-08-03

> Lo que sigue de esta sección describe cómo se llegó. Lo único abierto es el
> **branch protection** de `main` (necesita `gh` instalado).

| Proyecto | `project_ref` | Estado |
|---|---|---|
| **HEM-Prod** | `cotwhywqcocutrkmrpiw` | La base real, 54 perfiles |
| **HEM-Dev** | `mhipqazqvnuvtlrbqdce` | Esquema completo, sin datos personales. Es contra la que corren los tests |

### Perfiles de prueba en dev (`npm run seed:dev`)

Desde el 2026-08-03 dev tiene **7 cuentas de prueba** —1 superadmin, 1 admin, 1
juez, 1 mentor y 3 participantes— para poder probar la app con `npm run dev` sin
inventar datos a mano cada vez. Los correos son del estilo `usertest1@gmail.com`,
`mentortest@gmail.com`, `admin@gmail.com`.

**Las credenciales están en `CREDENCIALES-DEV.local.md`, que no se versiona**
(`*.local.md` está en el `.gitignore`). El script lo regenera cuando haga falta.

```bash
npm run seed:dev                    # muestra qué haría, no toca nada
npm run seed:dev -- --si            # crea, o repone la contraseña si ya existen
npm run seed:dev -- --borrar --si   # borra las 7 cuentas
```

⚠️ **El script aborta si el `.env` no apunta a HEM-Dev**: compara el
`project_ref` antes de escribir. No es paranoia — usa la service role key, que
saltea todo el RLS, y ese mismo `.env` apuntaba a producción hasta el 2026-07-30.

⚠️ **El juez y el mentor se siembran ya aprobados a propósito.** Si quedaran
pendientes, el juez no podría votar (lo frena el RLS) y el mentor no aparecería
en el desplegable de Mentoría — que es exactamente el problema que hoy bloquea el
evento en producción, y que en dev no querés reproducir cada vez.

**Por qué:** hasta ahora `npm run test:e2e` corría **contra producción** — cada
corrida creaba 4 cuentas reales, 1 equipo, 1 proyecto y 2 evaluaciones, y las
borraba al terminar. Funcionaba, pero no es lo que querés durante el evento.

**Hecho:** `supabase/dev-bootstrap/` con el dump del esquema, el complemento, el
bootstrap del admin de pruebas y un README con los 5 pasos. `.mcp.json` tiene dos
servidores: `supabase-dev` (completo) y `supabase-prod` (**`read_only=true`**,
solo `docs,database,debugging`, para que auditarlo no pueda escribirlo).

⚠️ **Ese `read_only=true` implica que las migraciones de prod se aplican a mano**,
por el SQL Editor del dashboard. Es a propósito, y es lo que se hizo con
`20260731_01`. Si algún día hace falta escribir prod desde una sesión, hay que
sacarle el flag a `supabase-prod` en `.mcp.json` y **reiniciar la sesión**
(Claude Code lee los MCP al arrancar), y conviene reponerlo después.

⚠️ **Vercel no se tocó**: producción sigue apuntando a HEM-Prod.

**Solo el jurado vota.** El admin entra a `/evaluacion` (el middleware lo deja)
pero **nunca** puede guardar: la policy RLS de INSERT de `evaluations` exige
`role = 'juez'`. Ve una tarjeta que se lo explica, distinta según la fase esté
cerrada o abierta, y que lo manda al Centro de Comando. Lo cubre
`tests/e2e/admin-evaluacion.spec.ts`, escrito para valer en cualquier fase.

⚠️ **Los tokens de tiempo traen la curva adentro** (`--t-base: 0.3s var(--ease)`).
Sirven para `transition`, pero **no** para el shorthand de `animation`: quedarían
dos timing-functions y el navegador descarta la declaración. Ahí va una duración
literal.

**`.admin-card` lleva `padding: 0` a propósito**, para que las tablas queden a
ras del borde. Lo que no sea una tabla adentro de esa card tiene que reponer el
padding: hay `.admin-card.metrics-panel` (cards de Métricas) y
`.admin-card-header` (título + botones arriba de una tabla). Los dos van
calificados con `.admin-card` porque esa regla se declara más abajo en el
archivo y con un solo selector de clase les ganaría por orden.

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
| `be56d77` | CI en GitHub Actions (el repo no tenía `.github`) |
| `89a1441` | La suite E2E borra sus propios datos al terminar |
| `d042a89` | El `origin` pasa a apuntar a la organización |

Se cerraron 8 de los 9 ítems que tenía el `BACKLOG.md`, más el bug de corrección
de votos del jurado, que era el pendiente más urgente de este archivo.

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

**Contenido al 2026-08-10** (leído con el MCP `supabase-prod`): **158 filas en
`profiles`** — 122 con el perfil completo y 36 registros abandonados —, **119
aprobados** y 39 pendientes. **2 equipos, 0 proyectos, 0 evaluaciones.**
`evaluation_phase` está en `cerrada`.

> La inscripción está viva: ese mismo día la tabla pasó de 145 a 158 en unas
> horas. Cualquier número de esta sección envejece rápido — volver a contarlo
> antes de usarlo.

**Contenido al 2026-07-30 (histórico):** 54 filas, 35 inscriptos reales y 19
abandonados; 28 aprobados y 7 pendientes.

### Registros abandonados

**Al 2026-08-10 son 36 de 158** (eran 19 de 54 al 2026-07-30): cuentas que
nunca completaron el onboarding. No
tienen ni `first_name`, así que no hay nada que aprobarles. Como quedan en
estado `pendiente`, antes inflaban la cola de revisión: mostraba 26 cuando la
real era 7.

Desde el 2026-07-30 **el admin los separa**. El criterio vive en un solo lado:
**`isProfileComplete()` en `src/utils/perfil.ts`** (tener `first_name` **y**
`last_name`, ignorando los cargados con espacios). Lo importan el middleware
—para redirigir a `/onboarding`—, el admin y el endpoint de comunicados. Estuvo
copiado en cada lugar hasta esa fecha; si las definiciones se separan otra vez,
el admin cuenta como inscripta a gente que la app sigue mandando a completar el
formulario.

En la pestaña **Métricas**, `totalRegistrations` y **todos** los desgloses (rol,
estado, institución, egresados, gráfico diario, última inscripción) se calculan
sobre `registeredProfiles`. Los abandonados van a un KPI propio, a una fila
aparte de "Por estado" marcada como que no suma, y a un aviso con atajo a
Usuarios. En **Usuarios** llevan badge "Sin completar" y hay un filtro de
completitud.

**Se les puede mandar un recordatorio**, pero todavía no se mandó. La pestaña
Comunicados tiene un cuarto segmento, "Registro incompleto", que es el único que
**no** va sobre aprobados. Falta decidir el texto y apretar el botón.

⚠️ **No queda registro de a quién ya se le mandó.** Un segundo envío les llega de
nuevo. La confirmación lo avisa, pero si se va a mandar más de una vez conviene
guardar la fecha del último recordatorio antes.

Estos números salen de la pestaña **Métricas**, que los calcula sobre `profiles`
sin consultas nuevas. Antes había que ir a Vercel o leerlos sueltos en otras
pestañas.

Los datos de prueba viejos se borraron el 2026-07-24 junto con el equipo "Los
Vengadores" y el proyecto "Guidia". Se conservó `e2e.admin@hem2026.test`, que lo
necesita `npm run test:e2e`.

**Configuración:** `evaluation_phase = cerrada`, `finalists_count = 10`,
`teams_enabled = true`, `project_submission_enabled = true`.

**Migraciones aplicadas** (además de las históricas): `20260714_01` (fases y
criterios), `20260714_02` (juez aprobado), `20260724_01` (rúbrica 1–5
ponderada), `20260724_02` (`profiles.institution_other`), `20260731_01`
(rúbrica por fase: sin pitch en preclasificación) — **aplicada en dev y en prod**,
y `20260803_01` (tabla `consultas`) — **aplicada en dev, falta en prod**.

### Auditoría de seguridad del esquema (2026-07-30)

Corrida por conexión directa, solo lectura. **Sin hallazgos:**

| Chequeo | Resultado |
|---|---|
| Tablas de `public` sin RLS | **0** — las 8 lo tienen activo |
| Tablas con RLS pero sin ninguna policy | **0** |
| Vistas con `security_invoker` | **2 de 2** |
| Funciones `SECURITY DEFINER` sin `search_path` fijo | **0 de 13** |
| FKs sin índice | **0** |

Las dos que más importan: las vistas usan `security_invoker=true` (sin eso
`project_leaderboard` correría con los permisos de quien la creó y cualquiera
leería el ranking salteándose el RLS), y las 13 funciones `SECURITY DEFINER`
tienen `search_path` fijo, que es *el* vector clásico de escalada en Postgres.

Policies por tabla: `projects` 10, `profiles` 7, `teams` 6, `evaluations` 4,
`event_config` 3, `help_requests` 3, `editions` 2, `edition_projects` 2.

Falta correr el **Security Advisor del dashboard**, que ve cosas que no se
deducen del esquema (config de auth, MFA, claves filtradas). El MCP no tenía
permisos para `get_advisors` en esa sesión.

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

Criterios puntuados del 1 al 5, definidos en **`src/lib/rubric.ts`** (fuente
única de verdad: la usan `/evaluacion`, el ranking del admin y los tests).

⚠️ **La rúbrica depende de la fase** (pedido de Martín, 2026-07-30): en
preclasificación **no se puntúa «Comunicación y pitch»**, porque los jueces
recorren proyecto por proyecto puntuando el material y no hay presentación en
vivo. Su 15% se reparte en partes iguales entre los otros cinco (+3% a cada uno).

| Criterio | Preclasificación | Final |
|---|---|---|
| Problema y contexto educativo | 18% | 15% |
| Propuesta de solución y valor | 23% | 20% |
| Nivel de innovación | 18% | 15% |
| Factibilidad y prototipo | 23% | 20% |
| Impacto potencial en educación | 18% | 15% |
| Comunicación y pitch | — | 15% |
| **Máximo de la suma directa** | **25** | **30** |

Las dos fases normalizan a 100, así que los puntajes ponderados son comparables
entre sí. `criteriaFor(fase)` devuelve los criterios con el peso ya resuelto:
el formulario, el ranking y los tests iteran sobre eso, así que **agregar o
sacar un criterio no requiere tocarlos**.

En la base, `evaluations.score_communication` es **nullable** y el CHECK
`evaluations_communication_by_phase_check` obliga a que vaya NULL en
preclasificación y con valor en la final.

Los pesos están **duplicados a propósito** en la vista SQL `project_leaderboard`,
con comentarios cruzados: si cambiás uno, cambiá el otro.

El flujo es `cerrada → preclasificacion → deliberacion → final`, con selección
manual de finalistas (botón "Marcar Top N" + "Guardar Finalistas") entre medio.

**El puntaje oficial es el ponderado (/100)** — decidido por el administrador del
concurso el 2026-07-29. Es el que ordena el ranking y define posiciones. La suma
directa (/30) se sigue mostrando al lado, marcada como referencia, pero no define
nada. Los encabezados del ranking dicen "(oficial)" y "(referencia)".

### El jurado puede corregir su voto

Las tarjetas de "Evaluados" tienen un botón **Corregir** que reabre el modal con
los puntajes y el feedback ya cargados, y un aviso de que se van a reemplazar.
El guardado usa **`upsert` con `onConflict: 'project_id,judge_id,phase'`**: un
solo camino para votar y para corregir, resuelto por el
`UNIQUE(project_id, judge_id, phase)` de la tabla.

No hizo falta migración: la policy `"Judges can update own evaluations"`
(`20260714_02`) ya permitía el UPDATE. Sus condiciones son las que definen el
alcance: solo el voto propio, solo si el juez está **aprobado**, y **solo mientras
la fase del voto sigue siendo la activa**. O sea que una vez que arranca la final,
los votos de preclasificación quedan congelados — que es el comportamiento
deseado.

Corregir **no suma una evaluación nueva**: `evaluations_count` del ranking sigue
en 1. Hay un test E2E que lo verifica (`juez corrige su voto de preclasificación`).

## Bases y Condiciones

`/bases-y-condiciones` publica los **16 artículos de la v11** —la versión que la
organización presentó a la DES— más **Anexo I** (cronograma) y **Anexo II**
(rúbrica). El Art. 12º tiene ancla `#art-premios`, que usan el footer y la FAQ.

⚠️ **El Art. 11º de la v11 no trae la rúbrica:** lista cuatro aspectos generales
y la delega a "una comunicación posterior de la organización". Esa rúbrica es la
del Anexo II, que es la que el sistema aplica de verdad (`src/lib/rubric.ts`).
**Los pesos viven en tres lados** —`rubric.ts`, la vista SQL
`project_leaderboard` y esta página—; si cambian, se tocan los tres. Verificado
el 2026-08-10: los tres coinciden.

### Descargables (`public/docs/`)

| Archivo | Qué es |
|---|---|
| `hackathon-edutech-2026-bases-y-condiciones.pdf` | **El principal.** 169 KB, 10 páginas, completo con Anexo I y II |
| `hackathon-edutech-2026-bases-y-condiciones-v11.docx` | La v11 tal cual se presentó a la DES. **No tiene la rúbrica** y trae un solo anexo |
| `resolucion-0180-2026-puntaje-docente.pdf` | La resolución que otorga el puntaje docente |

El `.docx` **no lo hicimos nosotros**: lo generó un script (`dc:creator:
python-docx`) y lo editó Gabriela Linares en Word el 20–21/07.

### Cómo se regenera el PDF

```bash
npm run build && npm run docs:bases
```

Imprime `/bases-y-condiciones` con puppeteer (`scripts/generar-bases-pdf.mjs`).
⚠️ **Es manual: hay que correrlo cuando cambie el articulado o la rúbrica.**
`astro preview` no sirve —el adapter de Vercel no lo soporta—, así que el script
levanta su propio servidor estático sobre `dist/client` y necesita el build.

**El formato sale de las reglas `@media print` de `src/styles/global.css`.** Si
el PDF sale feo, se corrige ahí, no en el script.

⚠️ **Las cuatro trampas de imprimir este sitio.** Entre las tres primeras el PDF
pesaba **32 MB**; la cuarta hacía que arreglarlas no sirviera de nada:

1. **`body::before` es una textura de grano `feTurbulence`.** Se rasteriza en
   cada página y, al ser ruido, no comprime: **2,4 MB por página**.
2. **`.gooey-bg-container`** es un `<canvas>` con filtro SVG que también se
   rasteriza entero por página.
3. **`.card` tiene `backdrop-filter`** sobre un alto de varias páginas, lo que
   obliga a rasterizar toda el área.
4. **`.card` tiene `transition: all`**, así que al pasar a `media print` las
   propiedades *animan* y la impresión captura un fotograma intermedio: el
   `backdrop-filter` quedaba en `blur(8.3px)` en vez de `none`. **Sin cortar las
   transiciones, los arreglos 2 y 3 no se aplican** aunque el CSS esté bien.

Y una de especificidad: los tokens de tema se definen sobre `[data-theme]`, que
le gana a `:root` a secas. Un override de impresión tiene que igualar ese selector.

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

**La grilla de tarjetas es mixta a propósito.** `NewsCard.astro` muestra la
portada como banda 16/9 arriba **solo si la nota tiene `imagen`**; la que no la
tiene arranca por el encabezado. No hay placeholder de color: de 5 noticias solo
1 tiene foto, y las de prensa externa probablemente nunca la tengan (la imagen es
del medio, no nuestra), así que serían 4 bandas de acento inventadas contra 1
foto real — en contra de la regla del 10% del `DESIGN.md`. La grilla mejora sola
a medida que se carguen fotos.

Piezas: `NewsCard.astro` (tarjeta compartida), `NewsSection.astro` (bloque del
home, muestra las 3 más recientes + "Ver todas" si hay más), `/noticias`
(listado completo), `/noticias/[slug]` (nota interna), `NewsVideoPlayer.astro`
(escenario + playlist, encadena la parte siguiente al terminar una) y
`NewsAudioPlayer.astro`. `src/utils/noticias.ts` centraliza orden, formato de
fecha y resolución de enlace.

**Audio (desde el 2026-08-10).** Mismo criterio que el video —el medio se
escucha en el sitio, no se manda a la gente a la plataforma—: se declara
`audios: [{ titulo, spotify }]` y el campo acepta el ID, el URI
`spotify:episode:<id>` o cualquier URL. El reproductor es mucho más corto que el
de video porque el iframe de Spotify ya trae controles, portada y duración.

⚠️ **`src/utils/noticias.ts` importa `astro:content`, así que no se puede
importar desde los unitarios.** Los extractores de ID puros viven en
**`src/utils/media.ts`**, que sí es testeable (`tests/unit/media.spec.ts`).
Cualquier helper nuevo que no necesite la colección va ahí.

⚠️ **El CSP de `vercel.json` es `Content-Security-Policy-Report-Only`:** reporta
y no bloquea. Un embed de un dominio nuevo hay que sumarlo a `frame-src`, que
hoy tiene `youtube-nocookie.com` y `open.spotify.com`.

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

⚠️ **La casilla publicada estuvo rota desde el commit `5db7ffd` hasta el
2026-08-03.** Decía `hackathonedutech@gmail.com`, que **no existe**: Gmail la
rechaza con *hard bounce*. Estuvo a la vista en el footer, el bloque de contacto
y las Bases, y llegó a producción, así que **todo el que escribió ahí recibió un
rebote**. La real es `hackathoneducacionmendoza@gmail.com`, la dueña de la cuenta
de Brevo y su único remitente verificado.

Se descubrió porque el aviso del formulario de consultas no llegaba: el primer
envío rebotó y Brevo puso la dirección en su **lista de bloqueados**, así que los
siguientes ni se intentaron (`event: blocked` en
`/v3/smtp/statistics/events`). Verificado después del cambio: `event: delivered`.

**Si alguna vez cambia la casilla, mandar un correo de prueba y confirmar el
evento `delivered` antes de publicarla.** Un `HTTP 201` de la API de Brevo sólo
dice que aceptó el pedido, no que se entregó.

Desde el **2026-08-03 no hay WhatsApp**: Martín lo dio de baja porque finalmente
no se usa. `src/utils/contacto.ts` quedó sólo con el mail
(`hackathonedutech@gmail.com`), y el canal público es el formulario de consultas
del home. **No reponer un número ahí sin que la organización lo confirme**:
publicar un WhatsApp que nadie atiende es peor que no tenerlo.

⚠️ El campo `phone_whatsapp` del perfil es otra cosa y sigue en uso: es el
teléfono de cada participante, que se pide en el onboarding.

## Tests

Tres comandos:

| Comando | Qué corre | Toca la base |
|---|---|---|
| `npm run test:unit` | 82 tests de las funciones puras (`src/utils/perfil.ts`, `src/lib/rubric.ts`, `src/utils/instituciones.ts` y `src/utils/media.ts`) | no |
| `npx playwright test sitio-publico` | 22 tests del sitio público (noticias, consultas, bases) | no |
| `npx playwright test admin-metricas` | 5 tests de la pestaña Métricas | solo lee |
| `npx playwright test admin-evaluacion` | 1 test: el admin no ve la votación | solo lee |
| `npm run test:e2e` | todo, incluido el flujo serial completo | **sí, escribe** (se limpia solo) |

Los unitarios usan el runner de Playwright con `playwright.unit.config.ts` (sin
navegador ni dev server) para no sumar otra dependencia. Corren en ~1 segundo.

`tests/e2e/full-flow.spec.ts` son 19 tests **seriales** que cubren registro,
onboarding, equipos, entrega de proyecto, aprobación de juez, votación en dos
fases, finalistas y seguridad (middleware, RLS y escalación de rol). Corren
contra la base de **desarrollo** (desde el 2026-08-03; antes iban contra prod).
**Los 41 tests en verde al 2026-08-03**, corridos ese día contra HEM-Dev en 2.9
minutos, con la limpieza dejando la base como estaba.

Al **2026-08-10**: **82 unitarios** y los **22 del sitio público** en verde. La
suite completa no se volvió a correr desde el 03/08 — el trabajo posterior es
todo del sitio público y no toca la base.

### Datos de prueba: la suite se limpia sola

Cada corrida crea 4 perfiles, 1 equipo, 1 proyecto y 2 evaluaciones, con un
`RUN_ID` único por corrida. Antes **no se borraba nada**, así que se acumulaban y
la pestaña Métricas los contaba como inscripciones reales.

Ahora un `afterAll` llama a `limpiarDatosE2E(RUN_ID)` y borra solo lo de su
corrida. Si la limpieza falla no se cae la suite, pero avisa por consola.

Red de seguridad para cuando una corrida se corta antes del teardown:

```bash
npm run test:e2e:limpiar          # muestra qué borraría, no borra nada
npm run test:e2e:limpiar -- --si  # borra de verdad
```

⚠️ **`e2e.admin@hem2026.test` no se borra nunca.** Es fijo, se bootstrapeó una
vez y hay que promoverlo a admin **por SQL a mano**: si desaparece, la suite
entera deja de correr hasta que alguien lo recree. Tanto el teardown como el
script lo excluyen explícitamente.

El borrado necesita `SUPABASE_SERVICE_ROLE_KEY` (borrar cuentas de `auth.users`
no se puede con la anon key) y va en un orden que **no es intercambiable**:

`evaluations` → `help_requests` → `projects` → `profiles.team_id = null` →
`teams` → `profiles` → cuentas de `auth.users`

Los dos motivos: `teams.leader_id` es `NO ACTION`, así que el equipo tiene que
morir antes que el perfil de su líder; y `profiles` no tiene FK contra
`auth.users`, así que hay que borrar las dos puntas o queda la cuenta fantasma y
ese email no se puede volver a registrar.

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

| Secret | Valor | Para qué |
|---|---|---|
| `PUBLIC_SUPABASE_URL` | el mismo del `.env` | conectarse |
| `PUBLIC_SUPABASE_ANON_KEY` | el mismo del `.env` | conectarse |
| `SUPABASE_SERVICE_ROLE_KEY` | el mismo del `.env` | **el teardown**: borrar cuentas de auth |

Sin esos secrets los otros tres jobs igual pasan; solo falla `e2e-completo`. Si
falta la service role key, la suite corre pero **no limpia**, y deja datos de
prueba en la base.

⚠️ **`tests/e2e/utils.ts` lee un archivo `.env` del disco**, no `process.env`, así
que el workflow lo materializa desde los secrets antes de correr. Si algún día se
agrega una variable a los tests, hay que sumarla en los dos lugares.

## Pendientes

### Decisiones con la organización

1. **Sección 6 de las Bases: PRE-APROBADA, a la espera de confirmación.** Se
   lleva a la reunión de staff del 2026-07-30 para que Martín (administrador del
   concurso) confirme tres cosas del texto **ya publicado**: los pesos de los 6
   criterios, la escala 1–5 y los **diez (10) equipos finalistas**.

   ⚠️ Los 10 finalistas están **escritos en duro** en las Bases, pero en el admin
   el cupo es configurable (`finalists_count`). Si alguien lo cambia durante el
   evento, el sitio dice una cosa y el sistema hace otra.

2. **¿Se alinea el `.docx` v11 con la página?** Abierto desde el 2026-08-10. La
   página tiene el Anexo II con la rúbrica; el `.docx` presentado a la DES no.
   Hoy el descargable principal es el PDF generado desde la página, así que el
   hueco no se ve, pero los dos documentos **no dicen exactamente lo mismo**.
   Alinearlos implicaría una **v12** del documento y volver a presentarla.

3. **Publicar los avales: RESUELTO el 2026-08-10.** La Res 0180 se publica y se
   cita desde footer, FAQ y Art. 12º. El **aval técnico queda interno**: es la
   impresión de un correo de la DES con direcciones personales, y no agrega nada
   que la resolución no pruebe mejor.

### Bugs y mejoras abiertos

4. **`event_config` con fechas viejas**: `event_start_datetime` (2026-06-03) y
   `submission_deadline` (2026-06-06) son de la edición anterior. Hoy **no se usan**
   (el countdown del Hero tiene 2026-08-26 hardcodeada), pero rompen si alguien
   reactiva el fetch comentado en `Hero.astro`.
5. **Jueces y mentores se aprueban a mano, y eso es correcto.** El trigger
   `auto_approve_participant` aprueba solo a los participantes con DNI e
   institución; jueces y mentores quedan en revisión manual **por diseño**.

   Al 2026-08-03: los **jueces ya están aprobados** y los **4 mentores siguen
   pendientes a propósito** — la organización está verificando sus datos
   (confirmado por Nahuel ese día). ✅ **No es un olvido ni un bug: no hace
   falta reportarlo como pendiente.**

   Lo único que conviene tener presente es la consecuencia mientras dure: el
   desplegable de Mentoría solo lista mentores *aprobados*, así que hasta que se
   aprueben no se pueden asignar a ningún equipo. Si llega el 28/08 sin
   aprobarlos, la mentoría no se puede repartir.
6. Ítem restante del `BACKLOG.md`: recordatorio a los registros abandonados y el
   orden del historial de migraciones. La validación del campo libre de
   institución **quedó resuelta el 2026-08-03** (ver el campo asistido, más
   abajo).

Las **estadísticas de visitas propias** quedaron **descartadas** el 2026-07-29:
las visitas se siguen mirando en Vercel. El análisis de qué haría falta quedó en
`BACKLOG.md`, en la sección "Descartado".

### Higiene

7. **Rotar la service role key y la contraseña de la base**: quedaron expuestas
   en una sesión de trabajo del 2026-07-24.
8. Aprobación visual del rediseño del tab "Mi Perfil" (commit `663b09e`; si no
   convence, `git revert 663b09e`).
9. **Branch protection en `main`** con los checks `Tests unitarios`, `Build` y
   `E2E del sitio público`. ⚠️ No exigir `E2E completo (escribe en la base real)`:
   solo corre con `workflow_dispatch`, nunca en un PR, así que bloquearía todos
   los merges para siempre.
