-- 20260824_02_encuesta_post_evento.sql
--
-- Encuesta post evento: 4 preguntas para los participantes, anonima,
-- disparada por una palanca desde el panel. Pedido de Martin el 24/08.
--
-- ⚠️ NINGUNA LINEA PASA DE ~72 CARACTERES, a proposito. Esta migracion
-- se aplica pegandola en el SQL Editor del dashboard, y una linea larga
-- se corto al pegar dejando un string sin cerrar.
--
-- ⚠️ POR QUE SON DOS TABLAS Y NO UNA
--
-- La encuesta es anonima de verdad: la respuesta no guarda quien la
-- escribio. Pero igual hace falta saber quien ya respondio, para no
-- pedirsela de nuevo y para que nadie la cargue dos veces. Eso son dos
-- necesidades opuestas, asi que van en dos tablas SIN relacion entre
-- si:
--
--   encuesta_respondio  -> solo el user_id. Sabe QUIEN, no sabe QUE.
--   encuesta_respuestas -> solo las respuestas. Sabe QUE, no QUIEN.
--
-- ⚠️ Las dos guardan `responded_on` como DATE, no como timestamptz. Con
-- la hora al segundo y las dos tablas escribiendo en la misma
-- transaccion, cruzar una contra otra por el momento de insercion seria
-- trivial y el anonimato seria de mentira. La fecha sola no distingue
-- nada: todas las respuestas caen en los mismos dos o tres dias.
--
-- ⚠️ LIMITE CONOCIDO, y es mas amplio de lo que parece: el orden fisico
-- de las filas ES el orden de insercion, y CUALQUIER lectura sin ORDER
-- BY explicito lo expone. No hace falta acceso directo a la base ni
-- mirar el
-- ctid: un SELECT por PostgREST alcanza. Por eso toda lectura de
-- `encuesta_respuestas` tiene que ordenar por `id` (uuid v4,
-- aleatorio),
-- nunca dejarla sin ORDER BY. Ver src/pages/admin/index.astro, donde se
-- listan los comentarios. Cerrar el canal del todo pediria insertar en
-- diferido o con ruido, y no vale la complejidad; con el ORDER BY,
-- quien
-- quiera cruzar necesita acceso directo a la base.
--
-- ⚠️ NINGUNA DE LAS DOS TABLAS TIENE POLICY DE INSERT, igual que
-- `consultas`. El unico camino de entrada es POST /api/encuesta, que
-- valida la sesion, el rol, la palanca y el duplicado, y escribe con la
-- service role key (que saltea RLS). Si algun dia se agrega una policy
-- de INSERT, el formulario queda expuesto a que lo carguen sin pasar
-- por esas defensas, y ademas a que alguien escriba en una sola de las
-- dos tablas.
--
-- No se crea ninguna funcion nueva: no hay un objeto mas expuesto por
-- PostgREST que auditar. Es deliberado, viene de cerrar los RPC
-- abiertos a anon el 24/08 (20260824_01_cerrar_rpc_anon.sql).


-- ---------------------------------------------------------------------------
-- 1. Quien ya respondio
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.encuesta_respondio (
    user_id uuid PRIMARY KEY
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    responded_on date NOT NULL DEFAULT CURRENT_DATE
);

COMMENT ON TABLE public.encuesta_respondio IS
'Quien ya respondio la encuesta post evento. No guarda las respuestas: '
'existe solo para el anti-duplicado y para dejar de mostrar el aviso.';

COMMENT ON COLUMN public.encuesta_respondio.responded_on IS
'Fecha sin hora, a proposito: ver la cabecera de la migracion.';


-- ---------------------------------------------------------------------------
-- 2. Las respuestas, sin dueno
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.encuesta_respuestas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    p1_general smallint NOT NULL,
    p2_mentoria smallint,
    p3_volveria text NOT NULL,
    p4_cambiaria text,
    responded_on date NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT encuesta_p1_check
        CHECK (p1_general BETWEEN 1 AND 5),
    CONSTRAINT encuesta_p2_check
        CHECK (p2_mentoria IS NULL OR p2_mentoria BETWEEN 1 AND 5),
    CONSTRAINT encuesta_p3_check
        CHECK (p3_volveria IN ('si', 'tal_vez', 'no')),
    CONSTRAINT encuesta_p4_check
        CHECK (p4_cambiaria IS NULL
               OR char_length(btrim(p4_cambiaria)) BETWEEN 1 AND 1000)
);

COMMENT ON TABLE public.encuesta_respuestas IS
'Respuestas de la encuesta post evento. Anonimas: no hay ninguna '
'columna que apunte a una persona, y es a proposito.';

COMMENT ON COLUMN public.encuesta_respuestas.p2_mentoria IS
'NULL significa "no trabaje con un mentor", que es una opcion real del '
'formulario. No es un dato faltante: no debe entrar en el promedio.';

COMMENT ON COLUMN public.encuesta_respuestas.p4_cambiaria IS
'Texto libre opcional. Se guarda tal cual lo escribieron; escapar al '
'mostrarlo en el panel.';


-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.encuesta_respondio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encuesta_respuestas ENABLE ROW LEVEL SECURITY;

-- Cada uno ve solo su propia marca, para saber si ya respondio. Nadie
-- mas, ni siquiera un admin: saber quien respondio no hace falta para
-- nada y es la mitad del cruce que romperia el anonimato.
DROP POLICY IF EXISTS "own_read_encuesta_respondio"
    ON public.encuesta_respondio;
CREATE POLICY "own_read_encuesta_respondio"
    ON public.encuesta_respondio
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- Las respuestas las lee el staff. Son anonimas, asi que leerlas no
-- expone a nadie.
DROP POLICY IF EXISTS "admins_read_encuesta_respuestas"
    ON public.encuesta_respuestas;
CREATE POLICY "admins_read_encuesta_respuestas"
    ON public.encuesta_respuestas
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND p.role = ANY (ARRAY['admin'::public.user_role,
                                      'superadmin'::public.user_role])
        )
    );

-- Sin policy de INSERT, UPDATE ni DELETE en ninguna de las dos. Ver la
-- cabecera: el unico camino de entrada es /api/encuesta con service
-- role.


-- ---------------------------------------------------------------------------
-- 4. Grants
-- ---------------------------------------------------------------------------

-- Defensa en profundidad ademas de la ausencia de policies: aunque
-- manana alguien agregue una policy de INSERT por error, sin el grant
-- no escribe.
--
-- ⚠️ HAY QUE REVOCAR A `authenticated` TAMBIEN, NO ALCANZA CON PUBLIC Y
-- anon. Supabase tiene DEFAULT PRIVILEGES que le dan ALL a anon,
-- authenticated y service_role sobre cada tabla nueva de `public`, asi
-- que la tabla nace con INSERT/UPDATE/DELETE/TRUNCATE para
-- `authenticated` aunque uno nunca los haya escrito. Verificado en dev:
-- la primera version de esta migracion, que solo revocaba PUBLIC y
-- anon, dejo a `authenticated` con los siete privilegios. Es la misma
-- trampa
-- que documenta 20260822_01_judge_groups.sql:118-127 para funciones.
REVOKE ALL ON public.encuesta_respondio
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.encuesta_respuestas
    FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.encuesta_respondio TO authenticated;
GRANT SELECT ON public.encuesta_respuestas TO authenticated;

GRANT ALL ON public.encuesta_respondio TO service_role;
GRANT ALL ON public.encuesta_respuestas TO service_role;


-- ---------------------------------------------------------------------------
-- 5. El insert, atomico
-- ---------------------------------------------------------------------------

-- Las dos filas tienen que entrar juntas o no entrar. Si se hicieran
-- como dos INSERT sueltos desde el endpoint y el proceso se cortara en
-- el medio (timeout de la funcion serverless, cold start, un deploy
-- justo ahi), la marca quedaria sin su respuesta: esa persona veria "ya
-- respondiste" para siempre, su respuesta no existiria, y nadie podria
-- detectarlo porque el
-- panel no puede leer `encuesta_respondio` a proposito.
--
-- Una funcion corre en una sola transaccion, asi que el corte deja las
-- dos
-- cosas sin hacer, que es lo correcto: la persona reintenta y listo.
--
-- ⚠️ VA GRANTEADA SOLO A service_role, no a authenticated. La llama el
-- endpoint /api/encuesta con la service role key, nunca el navegador.
-- Con
-- el REVOKE de abajo, PostgREST no la expone a nadie mas.

CREATE OR REPLACE FUNCTION public.registrar_respuesta_encuesta(
    p_user_id uuid,
    p_p1 smallint,
    p_p2 smallint,
    p_p3 text,
    p_p4 text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'sin_usuario');
  END IF;

  -- La PK sobre user_id es la que resuelve la carrera de dos pedidos
  -- simultaneos: el segundo choca aca y sale por 'duplicado'.
  BEGIN
    INSERT INTO public.encuesta_respondio (user_id) VALUES (p_user_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('ok', false, 'error', 'duplicado');
  END;

  INSERT INTO public.encuesta_respuestas
      (p1_general, p2_mentoria, p3_volveria, p4_cambiaria)
  VALUES (p_p1, p_p2, p_p3, p_p4);

  RETURN json_build_object('ok', true);
END;
$function$;

COMMENT ON FUNCTION public.registrar_respuesta_encuesta(
    uuid, smallint, smallint, text, text) IS
'Guarda la marca y la respuesta en una sola transaccion. Solo la llama '
'/api/encuesta con la service role key.';

REVOKE ALL ON FUNCTION public.registrar_respuesta_encuesta(
    uuid, smallint, smallint, text, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_respuesta_encuesta(
    uuid, smallint, smallint, text, text)
    TO service_role;


-- ---------------------------------------------------------------------------
-- 6. La vista de resultados
-- ---------------------------------------------------------------------------

-- Una sola fila con todo lo que muestra el panel. `security_invoker =
-- true` como en `project_leaderboard`: la vista no es una puerta de
-- atras, el que la consulta necesita su propia policy sobre la tabla.
--
-- ⚠️ El promedio de P2 excluye los NULL solo porque AVG() ignora NULL.
-- Es lo correcto: "no trabaje con un mentor" no es un 0 ni un 3.

DROP VIEW IF EXISTS public.encuesta_resultados;
CREATE VIEW public.encuesta_resultados
WITH (security_invoker = true) AS
SELECT
    count(*)                                        AS total,
    round(avg(p1_general), 2)                       AS p1_promedio,
    count(*) FILTER (WHERE p1_general = 1)          AS p1_1,
    count(*) FILTER (WHERE p1_general = 2)          AS p1_2,
    count(*) FILTER (WHERE p1_general = 3)          AS p1_3,
    count(*) FILTER (WHERE p1_general = 4)          AS p1_4,
    count(*) FILTER (WHERE p1_general = 5)          AS p1_5,
    round(avg(p2_mentoria), 2)                      AS p2_promedio,
    count(*) FILTER (WHERE p2_mentoria = 1)         AS p2_1,
    count(*) FILTER (WHERE p2_mentoria = 2)         AS p2_2,
    count(*) FILTER (WHERE p2_mentoria = 3)         AS p2_3,
    count(*) FILTER (WHERE p2_mentoria = 4)         AS p2_4,
    count(*) FILTER (WHERE p2_mentoria = 5)         AS p2_5,
    count(*) FILTER (WHERE p2_mentoria IS NULL)     AS p2_sin_mentor,
    count(*) FILTER (WHERE p3_volveria = 'si')      AS p3_si,
    count(*) FILTER (WHERE p3_volveria = 'tal_vez') AS p3_tal_vez,
    count(*) FILTER (WHERE p3_volveria = 'no')      AS p3_no,
    count(*) FILTER (WHERE p4_cambiaria IS NOT NULL) AS p4_con_texto
FROM public.encuesta_respuestas;

COMMENT ON VIEW public.encuesta_resultados IS
'Agregados de la encuesta post evento para el panel. Una sola fila. '
'Con 0 respuestas devuelve total=0 y los promedios en NULL.';

REVOKE ALL ON public.encuesta_resultados
    FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.encuesta_resultados
    TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 7. La palanca
-- ---------------------------------------------------------------------------

-- Nace apagada, como judge_groups_enabled: la migracion se puede
-- aplicar sin cambiar el comportamiento de nada. La enciende el admin
-- cuando termina la hackathon.
INSERT INTO public.event_config (key, value, description)
VALUES (
    'survey_enabled',
    'false',
    'Muestra la encuesta post evento a los participantes.'
)
ON CONFLICT (key) DO NOTHING;
