# Backlog HEM2026

Mejoras identificadas pendientes de aprobación / información externa.

> Última revisión: **2026-07-30**. En esta sesión se cerraron el ítem 2
> (distinguir los registros abandonados en el admin), el de `var(--t-normal)`
> —que estaba en dos lugares y no en uno— y el de las miniaturas en las tarjetas
> de noticia. El del recordatorio quedó implementado y a la espera de la
> decisión de mandarlo. El 2026-07-29 se habían cerrado los
> ítems 1, 2, 3, 4, 5, 7, 8 y 9 de la lista anterior (formato del puntaje,
> normalización de Instagram, carrera de la entrega de proyecto, validación de
> teléfono, textos de la nota de la rectora, `/noticias` en la navegación,
> `poster` de los videos y feed RSS). Quedan los que siguen.

## Aprobadas a la espera de implementación

### 1. Validación del campo libre de institución
`institution_other` solo valida "no vacío": hay un perfil cargado con `-` como
institución, que aparece así en el ranking de la pestaña Métricas. Falta definir
un mínimo razonable (largo, o una lista de valores rechazados).

Salió del ítem de los registros abandonados, que se cerró el 2026-07-30.

### 2. Mandar el recordatorio a los registros abandonados
**El código ya está** (commit `90dc9ab`): la pestaña Comunicados tiene el
segmento "Registro incompleto". Lo que falta es la decisión y el texto:

- ¿se les manda? Son 19 personas que se anotaron y quedaron trabadas en el
  formulario, con la inscripción todavía abierta
- redactar el mail: corto, con el link directo a `/onboarding`
- el saludo les va a decir "¡Hola Participante!", porque el nombre es
  justamente lo que no cargaron

⚠️ **No queda registro de a quién ya se le mandó.** Si se planea mandarlo más de
una vez, primero hay que guardar la fecha del último recordatorio en `profiles`,
o los mismos lo reciben de nuevo.

## Deuda técnica menor

### 3. Ordenar el historial de migraciones
Las migraciones se aplicaron siempre por MCP o dashboard, así que los timestamps
de `supabase_migrations.schema_migrations` no coinciden con los nombres de
archivo locales. Para el CLI ninguna migración local está aplicada y un
`supabase db push` reaplicaría todo desde mayo. Hay que ordenarlo con
`supabase migration repair`.

## Notas del sitio público

### 4. Los títulos de los videos de la nota de la rectora
Los `alt` de las fotos ya se corrigieron mirando el material, y los títulos de
los tres videos pasaron a ser descriptivos y neutros ("La entrevista en el
estudio de Cada Día, parte 1/2/3"). Si alguien que vio los clips completos
quiere diferenciarlos por contenido real, están en
`src/content/noticias/rectora-ies-9023-en-cada-dia-el-nueve.md`.

## Descartado (no volver a proponer)

### Tutoriales de la plataforma en /recursos

**Descartado el 2026-08-24 por el dueño del producto:** Martín los propuso
("creo que estaría bueno sumarlos") y el tutorial existe —lo grabó Matías y lo
tiene en WhatsApp, sin publicar—, pero no lo considera necesario para esta
edición.

Si alguna vez se retoma: la página `/recursos` es data-driven, así que sumarlo es
una entrada en el array `GRUPOS` de `src/pages/recursos.astro`. Un video no es un
PDF, así que habría que decidir dónde vive el archivo (`public/video/` propio, o
YouTube y entonces hay que declarar el dominio en `frame-src` del CSP de
`vercel.json`, que hoy solo permite youtube-nocookie y Spotify).

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
