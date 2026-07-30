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

### 2. Estadísticas de visitas propias en el admin
La pestaña **Métricas** del Centro de Comando ya muestra todo lo de
inscripciones, pero las visitas al sitio siguen viéndose solo en Vercel.

`@vercel/analytics` está instalado, pero solo **escribe**: la API de lectura de
Web Analytics necesita plan pago y token, así que no se puede consultar desde el
sitio. Para tenerlo adentro hay que llevar el contador propio:

- tabla `page_views` en Supabase (`path`, `created_at`, hash de sesión, referrer)
- un `POST /api/track-view.ts`
- un beacon chico en `Layout.astro`

Tiene que ser del lado del cliente, **no** en `src/middleware.ts`: la landing y
las páginas públicas son prerenderizadas (`context.isPrerendered`), así que el
middleware no ve esas visitas. Suma una escritura a la base por pageview.

### 3. `institution_other` no valida nada
El campo libre de institución solo exige "no vacío", así que entran cosas como
`-`. Al 2026-07-29 hay **16 perfiles sin institución y uno con `-`** sobre 49
inscriptos. Los sin institución son, casi con certeza, gente que se registró y
no terminó el onboarding: conviene distinguir esos dos casos antes de tocar la
validación, y ver si hace falta un recordatorio para que completen el perfil.

## Deuda técnica menor

### 4. `var(--t-normal)` no existe
`.tab-content` en `src/pages/admin/index.astro` usa `var(--t-normal)` para la
animación de las pestañas, pero `global.css` define `--t-fast`, `--t-base` y
`--t-slow`. La animación corre sin duración. Es un one-liner.

### 5. Ordenar el historial de migraciones
Las migraciones se aplicaron siempre por MCP o dashboard, así que los timestamps
de `supabase_migrations.schema_migrations` no coinciden con los nombres de
archivo locales. Para el CLI ninguna migración local está aplicada y un
`supabase db push` reaplicaría todo desde mayo. Hay que ordenarlo con
`supabase migration repair`.

## Notas del sitio público

### 6. Los títulos de los videos de la nota de la rectora
Los `alt` de las fotos ya se corrigieron mirando el material, y los títulos de
los tres videos pasaron a ser descriptivos y neutros ("La entrevista en el
estudio de Cada Día, parte 1/2/3"). Si alguien que vio los clips completos
quiere diferenciarlos por contenido real, están en
`src/content/noticias/rectora-ies-9023-en-cada-dia-el-nueve.md`.
