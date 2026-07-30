# Bootstrap de HEM-Dev

Cómo levantar el proyecto **HEM-Dev** (`mhipqazqvnuvtlrbqdce`) con el mismo
esquema que **HEM-Prod** (`cotwhywqcocutrkmrpiw`), **sin llevarse un solo dato
personal**.

> Generado el **2026-07-30** desde prod. Si el esquema de prod cambia, hay que
> regenerar el paso 1 (ver el final).

## Por qué existe dev

Hasta el 2026-07-30 `npm run test:e2e` corría **contra producción**: creaba 4
cuentas reales, un equipo y dos evaluaciones, y las borraba al terminar.
Funcionaba, pero es exactamente lo que no querés que pase durante el evento.

## Por qué no se copiaron los datos

Prod tiene 54 perfiles con DNI, mail, teléfono, Instagram e institución de
estudiantes reales. Duplicarlos en un proyecto de desarrollo es exponerlos sin
necesidad: **la suite E2E no depende de ningún dato de prod**, se crea sus
propios perfiles y los borra. Lo único fijo es el admin de pruebas, que se
bootstrapea en el paso 3.

## Los archivos

| Archivo | Qué trae |
|---|---|
| `01-esquema-public.sql` | Dump del esquema `public`: 8 tablas, 5 enums, 37 policies, 14 funciones, 10 triggers, 14 índices, 2 vistas, 5 extensiones y 73 grants. **Sin datos.** |
| `02-complemento.sql` | Lo que el dump de `public` no puede traer (ver abajo). |
| `03-admin-e2e.sql` | Promueve a admin la cuenta de pruebas de la suite. |

### ⚠️ Por qué hace falta el complemento

`supabase db dump` vuelca **solo el esquema `public`**. Quedan afuera tres cosas
que verifiqué contra prod:

1. **El trigger `on_auth_user_created` sobre `auth.users`.** Es el que dispara
   `public.handle_new_user()` para crear la fila en `profiles`. Sin él, el signup
   crea la cuenta de auth y **nunca el perfil**: el onboarding queda colgado y la
   suite E2E muere en el primer test. Es el error más fácil de cometer acá.
2. **Las 18 claves de `event_config`.** Son parámetros del evento (fases, cupos,
   límites de equipo), no datos de personas. Sin ellas el admin lee `null`.
3. **El cron job `expire-stale-help-requests`.** Hoy `help_enabled = false`, así
   que en dev es opcional; va para que el esquema sea equivalente.

## Pasos

1. **Aplicar el esquema.** Dashboard de HEM-Dev → SQL Editor → pegar y correr
   `01-esquema-public.sql`, después `02-complemento.sql`. En ese orden: el
   complemento referencia funciones que crea el primero.

2. **Crear el usuario de pruebas** (ver las instrucciones dentro de
   `03-admin-e2e.sql`) y después correr ese archivo.

3. **Apuntar el entorno a dev.** Las cuatro variables salen de
   Dashboard → Settings → API y → Database:

   ```
   PUBLIC_SUPABASE_URL=https://mhipqazqvnuvtlrbqdce.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=<anon de dev>
   SUPABASE_SERVICE_ROLE_KEY=<service role de dev>
   SUPABASE_DB_URL=<pooler de dev>
   ```

   ⚠️ **`tests/e2e/utils.ts` lee el archivo `.env` del disco, no `process.env`.**
   No alcanza con exportar variables en la terminal.

   ⚠️ **Vercel NO se toca**: producción sigue apuntando a HEM-Prod.

4. **Actualizar los secrets del CI** (Settings → Secrets and variables →
   Actions) a los de dev: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` y
   `SUPABASE_SERVICE_ROLE_KEY`. El job `e2e-completo` escribe en la base, así que
   es el que más importa que deje de mirar prod.

5. **Verificar.** `npm run test:e2e` completo contra dev. Si el paso 1 quedó a
   medias, falla en el primer test de registro.

## Regenerar el esquema cuando prod cambie

Necesita Docker corriendo (el CLI levanta un contenedor efímero propio para
`pg_dump`; no toca ningún contenedor tuyo):

```bash
npx supabase db dump --db-url "$SUPABASE_DB_URL" -f supabase/dev-bootstrap/01-esquema-public.sql
```

`db dump` es de **solo lectura**. El que nunca hay que correr es `db push`: el
historial de migraciones de prod tiene 32 entradas contra 20 archivos locales,
así que para el CLI casi ninguna migración local está aplicada y un push
reaplicaría todo desde mayo.

Ese desfasaje es, justamente, el motivo por el que dev se construye desde un
dump y no replayando `supabase/migrations/`: **esos archivos no son la historia
completa**.
