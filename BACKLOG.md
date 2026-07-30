# Backlog HEM2026

Mejoras identificadas pendientes de aprobación / información externa.

> Última revisión: **2026-07-30**. En esta sesión se cerraron el ítem 2
> (distinguir los registros abandonados en el admin) y el de `var(--t-normal)`,
> que estaba en dos lugares y no en uno. El 2026-07-29 se habían cerrado los
> ítems 1, 2, 3, 4, 5, 7, 8 y 9 de la lista anterior (formato del puntaje,
> normalización de Instagram, carrera de la entrega de proyecto, validación de
> teléfono, textos de la nota de la rectora, `/noticias` en la navegación,
> `poster` de los videos y feed RSS). Quedan los que siguen.

## Aprobadas a la espera de implementación

### 1. Las tarjetas de noticia no muestran imagen
`NewsCard.astro` es solo texto. Ahora que las notas tienen `imagen`, mostrarla
como miniatura levantaría mucho la sección del home y el listado. Hay que definir
qué hacer con las que no tienen imagen (las de prensa externa y los avisos):
placeholder con el color de la categoría, o grilla que tolere tarjetas mixtas.

### 2. Validación del campo libre de institución
`institution_other` solo valida "no vacío": hay un perfil cargado con `-` como
institución, que aparece así en el ranking de la pestaña Métricas. Falta definir
un mínimo razonable (largo, o una lista de valores rechazados).

Salió del ítem de los registros abandonados, que se cerró el 2026-07-30.

### 3. Recordatorio a los registros abandonados
Ya se los puede identificar y filtrar en el admin (ver "Registros abandonados"
en `ESTADO_ACTUAL.md`), pero **no se les manda nada**. Queda decidir si se les
manda un mail para que completen el formulario, y con qué texto. El módulo de
comunicados masivos hoy segmenta por rol sobre los **aprobados**, así que habría
que sumarle este segmento.

## Deuda técnica menor

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
