# Backlog HEM2026

Mejoras identificadas pendientes de aprobación / información externa.

> Última revisión: **2026-07-29**. En esa sesión se cerraron los ítems 1, 2, 3,
> 4, 5, 7, 8 y 9 de la lista anterior (formato del puntaje, normalización de
> Instagram, carrera de la entrega de proyecto, validación de teléfono, textos
> de la nota de la rectora, `/noticias` en la navegación, `poster` de los
> videos y feed RSS). Quedan los que siguen.

## Aprobadas a la espera de implementación

### 1. Las tarjetas de noticia no muestran imagen
`NewsCard.astro` es solo texto. Ahora que las notas tienen `imagen`, mostrarla
como miniatura levantaría mucho la sección del home y el listado. Hay que definir
qué hacer con las que no tienen imagen (las de prensa externa y los avisos):
placeholder con el color de la categoría, o grilla que tolere tarjetas mixtas.

### 2. Distinguir en el admin quién no completó el onboarding
**Este es el que tiene valor operativo real de los que quedan.**

Medido el 2026-07-29 sobre 50 perfiles:

| | |
|---|---|
| Nunca completaron el onboarding | **17** |
| De esos 17, en estado `pendiente` | **17** (todos) |
| Pendientes que **sí** completaron el perfil | **6** |

O sea que los ~23 "pendientes de revisión" que muestra la pestaña Métricas son
en realidad **6 personas esperando aprobación y 17 registros abandonados**. De
esos 17 no hay nada que aprobar: no tienen ni nombre cargado. Un admin que
recorra la cola pierde el tiempo con fichas vacías.

El dato ya existe y la app ya lo usa: `middleware.ts:95` define perfil completo
como tener `first_name` **y** `last_name`, y con eso decide mandar a
`/onboarding`. Falta solo exponerlo:

- separar el conteo en la pestaña Métricas (pendientes reales vs. abandonados)
- marcar esas filas en la pestaña Usuarios, o poder filtrarlas
- decidir si se les manda un recordatorio para que completen el perfil

**Decisión de diseño pendiente:** ¿se los trata como una categoría aparte
("Registro incompleto") o se los sigue contando como inscriptos? Cambia el
número grande de "Inscriptos totales", así que conviene definirlo antes.

De paso, el campo libre `institution_other` solo valida "no vacío" y hay un
perfil con `-` como institución.

## Deuda técnica menor

### 3. `var(--t-normal)` no existe
`.tab-content` en `src/pages/admin/index.astro` usa `var(--t-normal)` para la
animación de las pestañas, pero `global.css` define `--t-fast`, `--t-base` y
`--t-slow`. La animación corre sin duración. Es un one-liner.

### 4. Ordenar el historial de migraciones
Las migraciones se aplicaron siempre por MCP o dashboard, así que los timestamps
de `supabase_migrations.schema_migrations` no coinciden con los nombres de
archivo locales. Para el CLI ninguna migración local está aplicada y un
`supabase db push` reaplicaría todo desde mayo. Hay que ordenarlo con
`supabase migration repair`.

## Notas del sitio público

### 5. Los títulos de los videos de la nota de la rectora
Los `alt` de las fotos ya se corrigieron mirando el material, y los títulos de
los tres videos pasaron a ser descriptivos y neutros ("La entrevista en el
estudio de Cada Día, parte 1/2/3"). Si alguien que vio los clips completos
quiere diferenciarlos por contenido real, están en
`src/content/noticias/rectora-ies-9023-en-cada-dia-el-nueve.md`.

## Descartado (no volver a proponer)

### Estadísticas de visitas propias en el admin
**Descartado el 2026-07-29 por el dueño del producto:** no lo considera
necesario. Las visitas se siguen mirando en el panel de Vercel.

Queda registrado el análisis, por si alguna vez cambia la necesidad:
`@vercel/analytics` está instalado pero solo **escribe** — la API de lectura de
Web Analytics necesita plan pago y token, así que no se puede consultar desde el
sitio. Tenerlo adentro exigiría contador propio (tabla `page_views`, un
`POST /api/track-view.ts` y un beacon en `Layout.astro`), del lado del cliente y
**no** en el middleware, porque las páginas públicas son prerenderizadas
(`context.isPrerendered`) y el middleware no las ve. Costo: una escritura a la
base por pageview.
