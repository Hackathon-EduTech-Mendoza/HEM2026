-- Migración: 20260822_01_judge_groups.sql
-- Descripción: reparte los proyectos de la PRECLASIFICACIÓN entre grupos de
-- jueces, para bajar la carga del día del evento.
--
-- Pedido de Martín, confirmado por Matías el 2026-08-22:
--   · La división aplica SOLO a preclasificación. En la ronda final los 10
--     finalistas presentan su pitch en vivo, con los 6 jueces en la misma
--     sala: ahí todos evalúan todo, dividirlos no ahorraría nada y metería
--     sesgo justo donde se define el podio.
--   · La conformación no está fijada: puede ser 2 tríos o 3 duetos. Por eso
--     el grupo es un NÚMERO y no una tabla de tríos — soporta N grupos sin
--     tocar el esquema, y se rearma el mismo sábado a la mañana.
--
-- El cálculo del ranking NO se toca: `project_leaderboard` promedia con avg()
-- sobre las evaluaciones que existen, así que un proyecto con 3 evaluaciones
-- y otro con 3 quedan en la misma escala aunque los vieran jueces distintos.
--
-- ⚠️ NULL significa "lo ve todo el mundo", tanto en el juez como en el
-- proyecto. Es la válvula de escape del día D: si falta un juez o algo sale
-- mal, poner el proyecto en NULL lo devuelve a los seis. Un proyecto
-- entregado después del reparto nace en NULL, así que nunca queda sin jueces.
--
-- ⚠️ NINGUNA LÍNEA DE CÓDIGO PASA DE ~72 CARACTERES, a propósito. Esta
-- migración se aplica pegándola en el SQL Editor del dashboard, y una línea
-- larga se cortó al pegar dejando un string sin cerrar («unterminated quoted
-- string»). Si agregás algo acá, mantené las líneas cortas.

-- ---------------------------------------------------------------------------
-- 1. Columnas
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS judge_group SMALLINT;

COMMENT ON COLUMN public.profiles.judge_group IS
  'Grupo de jurado para preclasificacion. NULL = evalua todo.';

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS judge_group SMALLINT;

COMMENT ON COLUMN public.projects.judge_group IS
  'Grupo de jurado que lo evalua. NULL = lo evaluan todos.';

CREATE INDEX IF NOT EXISTS idx_projects_judge_group
  ON public.projects (judge_group)
  WHERE judge_group IS NOT NULL;

-- Palanca general: mientras esté en 'false' todo se comporta como antes de
-- esta migración, aunque ya haya grupos cargados. Permite armar el reparto
-- con tranquilidad y recién ahí encenderlo.
INSERT INTO public.event_config (key, value, description)
VALUES (
  'judge_groups_enabled',
  'false',
  'Divide los proyectos entre grupos de jurado'
)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. La regla, en un solo lugar
-- ---------------------------------------------------------------------------

-- Se usa igual desde la policy de SELECT de `projects` y desde el WITH CHECK
-- de `evaluations`: si la regla viviera duplicada, tarde o temprano una de
-- las dos copias quedaría vieja.
CREATE OR REPLACE FUNCTION public.can_judge_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_enabled       BOOLEAN;
  v_phase         TEXT;
  v_judge_group   SMALLINT;
  v_project_group SMALLINT;
BEGIN
  SELECT COALESCE(
    (SELECT value = 'true'
       FROM public.event_config
      WHERE key = 'judge_groups_enabled'),
    FALSE
  ) INTO v_enabled;

  IF NOT v_enabled THEN
    RETURN TRUE;
  END IF;

  -- La división es solo de preclasificación: en la final todos ven todo.
  SELECT value INTO v_phase
    FROM public.event_config
   WHERE key = 'evaluation_phase';

  IF v_phase IS DISTINCT FROM 'preclasificacion' THEN
    RETURN TRUE;
  END IF;

  SELECT judge_group INTO v_judge_group
    FROM public.profiles
   WHERE id = auth.uid();

  IF v_judge_group IS NULL THEN
    RETURN TRUE;
  END IF;

  SELECT judge_group INTO v_project_group
    FROM public.projects
   WHERE id = p_project_id;

  IF v_project_group IS NULL THEN
    RETURN TRUE;
  END IF;

  RETURN v_judge_group = v_project_group;
END;
$function$;

-- ⚠️ El REVOKE a PUBLIC no alcanza: Supabase tiene DEFAULT PRIVILEGES que le
-- dan EXECUTE a `anon` sobre cada función nueva de `public`. Y como las dos
-- funciones de escritura se saltean su propia validación cuando auth.uid() es
-- NULL —para dejar pasar migraciones y service_role— un visitante sin sesión
-- podía llamarlas por la API REST con la anon key, que es pública porque va
-- en el HTML del sitio. Verificado en dev: `anon` rebarajó los 14 proyectos.
-- Hay que revocar a `anon` explícitamente, en las tres.
REVOKE EXECUTE ON FUNCTION public.can_judge_project(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_judge_project(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_judge_project(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. El candado: qué ve y qué puede votar cada juez
-- ---------------------------------------------------------------------------

-- ⚠️ `admins_read_projects` incluía a 'juez' en su lista de roles. Las
-- policies de SELECT se combinan con OR, así que dejarla como estaba anulaba
-- el filtro nuevo por completo: el juez seguiría viendo todos los proyectos
-- por esa puerta. Los jueces mantienen su acceso por `judge_select_projects`,
-- ahora filtrada.
DROP POLICY IF EXISTS "admins_read_projects" ON public.projects;
CREATE POLICY "admins_read_projects" ON public.projects
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() = ANY (ARRAY[
      'superadmin'::public.user_role,
      'admin'::public.user_role
    ])
  );

DROP POLICY IF EXISTS "judge_select_projects" ON public.projects;
CREATE POLICY "judge_select_projects" ON public.projects
  FOR SELECT
  USING (
    public.get_user_role() = 'juez'::public.user_role
    AND public.can_judge_project(id)
  );

-- El candado de verdad. Sin esto, esconder el proyecto en la pantalla es solo
-- cortesía: el panel de evaluación escribe con la anon key desde el
-- navegador, así que un INSERT a mano evaluaría cualquier proyecto.
DROP POLICY IF EXISTS "Judges can insert own evaluations"
  ON public.evaluations;
CREATE POLICY "Judges can insert own evaluations" ON public.evaluations
  FOR INSERT
  WITH CHECK (
    judge_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles
       WHERE profiles.id = (SELECT auth.uid())
         AND profiles.role = 'juez'::public.user_role
         AND profiles.registration_status =
             'aprobado'::public.registration_status
    )
    AND phase = (
      SELECT value FROM public.event_config
       WHERE key = 'evaluation_phase'
    )
    AND (
      phase = 'preclasificacion'
      OR EXISTS (
        SELECT 1 FROM public.projects
         WHERE projects.id = evaluations.project_id
           AND projects.is_finalist = TRUE
      )
    )
    AND public.can_judge_project(project_id)
  );

-- La policy de UPDATE tampoco miraba el proyecto, y no tenía WITH CHECK
-- propio: cuando falta, Postgres reusa el USING para validar la fila
-- resultante, y ahí `project_id` no se controla. Verificado en dev: un juez
-- podía votar un proyecto suyo y después MOVER esa evaluación a un proyecto
-- de otro grupo con un UPDATE, saltándose el candado del INSERT.
--
-- El WITH CHECK exige que la fila resultante caiga en un proyecto que le
-- toque. El USING queda sin esa condición a propósito: si un proyecto se
-- reasigna a otro grupo, el juez tiene que poder corregir el voto que ya
-- había emitido legítimamente.
DROP POLICY IF EXISTS "Judges can update own evaluations"
  ON public.evaluations;
CREATE POLICY "Judges can update own evaluations" ON public.evaluations
  FOR UPDATE
  USING (
    judge_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles
       WHERE profiles.id = (SELECT auth.uid())
         AND profiles.role = 'juez'::public.user_role
         AND profiles.registration_status =
             'aprobado'::public.registration_status
    )
    AND phase = (
      SELECT value FROM public.event_config
       WHERE key = 'evaluation_phase'
    )
  )
  WITH CHECK (
    judge_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles
       WHERE profiles.id = (SELECT auth.uid())
         AND profiles.role = 'juez'::public.user_role
         AND profiles.registration_status =
             'aprobado'::public.registration_status
    )
    AND phase = (
      SELECT value FROM public.event_config
       WHERE key = 'evaluation_phase'
    )
    AND public.can_judge_project(project_id)
  );

-- ---------------------------------------------------------------------------
-- 4. `judge_group` es una llave de visibilidad, no un dato del perfil
-- ---------------------------------------------------------------------------

-- `user_update_own_profile` deja a cada quien editar su propia fila entera,
-- así que sin esto un juez se cambia de grupo desde la consola y se abre
-- todos los proyectos. Mismo patrón que `protect_role_escalation`: la RLS
-- decide qué filas se tocan, no qué valores, y esta columna necesita lo
-- segundo.
CREATE OR REPLACE FUNCTION public.protect_judge_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id   UUID := auth.uid();
  v_caller_role public.user_role;
BEGIN
  IF NEW.judge_group IS NOT DISTINCT FROM OLD.judge_group THEN
    RETURN NEW;
  END IF;

  -- Contexto sin usuario autenticado (service_role, migraciones, SQL editor)
  IF v_caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_caller_role
    FROM public.profiles
   WHERE id = v_caller_id;

  IF v_caller_role IN ('admin', 'superadmin') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Solo la organizacion cambia el grupo de jurado.';
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_judge_group ON public.profiles;
CREATE TRIGGER trg_protect_judge_group
  BEFORE UPDATE OF judge_group ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_judge_group();

-- El mismo agujero, del otro lado y peor: en `projects` el GRANT de UPDATE
-- es de TABLA (no por columna como en `profiles`), así que `judge_group`
-- nació escribible para authenticated. Sumado a `user_update_own_project`,
-- que deja a cada equipo editar su propio proyecto, un participante podía
-- elegir qué grupo de jurado lo evalúa. Es la fuga de `team_id` de nuevo (ver
-- 20260819_02), y REVOKE UPDATE (judge_group) no la tapa mientras el grant
-- de tabla siga vivo.
CREATE OR REPLACE FUNCTION public.protect_project_judge_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id   UUID := auth.uid();
  v_caller_role public.user_role;
BEGIN
  IF NEW.judge_group IS NOT DISTINCT FROM OLD.judge_group THEN
    RETURN NEW;
  END IF;

  IF v_caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_caller_role
    FROM public.profiles
   WHERE id = v_caller_id;

  IF v_caller_role IN ('admin', 'superadmin') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Solo la organizacion cambia el grupo del proyecto.';
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_project_judge_group ON public.projects;
CREATE TRIGGER trg_protect_project_judge_group
  BEFORE UPDATE OF judge_group ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.protect_project_judge_group();

-- ---------------------------------------------------------------------------
-- 4b. La puerta para el admin
-- ---------------------------------------------------------------------------

-- En `profiles` los GRANT de UPDATE son por columna desde el arreglo de la
-- fuga de `team_id`, y `judge_group` no está en esa lista: ni el admin puede
-- escribirla desde el navegador, que es como funciona el panel. En vez de
-- abrir la columna con un grant —que se la abriría también a cada juez sobre
-- su propia fila— la única puerta es este RPC, que valida quién llama.
CREATE OR REPLACE FUNCTION public.set_judge_group(
  p_judge_id UUID,
  p_group    SMALLINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_caller_role public.user_role;
  v_target_role public.user_role;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT role INTO v_caller_role
      FROM public.profiles
     WHERE id = auth.uid();

    IF v_caller_role IS DISTINCT FROM 'admin'
       AND v_caller_role IS DISTINCT FROM 'superadmin' THEN
      RAISE EXCEPTION 'Solo la organizacion arma los grupos.';
    END IF;
  END IF;

  SELECT role INTO v_target_role
    FROM public.profiles
   WHERE id = p_judge_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'No existe ese perfil.';
  END IF;

  IF v_target_role IS DISTINCT FROM 'juez' THEN
    RAISE EXCEPTION 'Solo un juez puede tener grupo.';
  END IF;

  IF p_group IS NOT NULL AND p_group < 1 THEN
    RAISE EXCEPTION 'El grupo debe ser 1 o mas, o NULL.';
  END IF;

  UPDATE public.profiles
     SET judge_group = p_group
   WHERE id = p_judge_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_judge_group(UUID, SMALLINT)
  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_judge_group(UUID, SMALLINT)
  FROM anon;
GRANT EXECUTE ON FUNCTION public.set_judge_group(UUID, SMALLINT)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. El reparto al azar
-- ---------------------------------------------------------------------------

-- Reparte parejo con ntile() sobre un orden aleatorio. Por defecto toca solo
-- los proyectos sin grupo, que es lo que hace falta cuando entra una entrega
-- tarde: rebarajar todo a mitad de la mañana le cambiaría los proyectos a un
-- juez que ya venía evaluando. `p_reassign_all` fuerza el rebarajado.
CREATE OR REPLACE FUNCTION public.assign_judge_groups(
  p_group_count   INT,
  p_reassign_all  BOOLEAN DEFAULT FALSE
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_caller_role public.user_role;
  v_afectados   INT;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT role INTO v_caller_role
      FROM public.profiles
     WHERE id = auth.uid();

    IF v_caller_role IS DISTINCT FROM 'admin'
       AND v_caller_role IS DISTINCT FROM 'superadmin' THEN
      RAISE EXCEPTION 'Solo la organizacion reparte los proyectos.';
    END IF;
  END IF;

  IF p_group_count IS NULL OR p_group_count < 1 THEN
    RAISE EXCEPTION 'La cantidad de grupos debe ser 1 o mas.';
  END IF;

  IF p_reassign_all THEN
    UPDATE public.projects SET judge_group = NULL;
  END IF;

  WITH repartidos AS (
    SELECT id,
           NTILE(p_group_count) OVER (ORDER BY random()) AS grupo
      FROM public.projects
     WHERE judge_group IS NULL
  )
  UPDATE public.projects p
     SET judge_group = r.grupo
    FROM repartidos r
   WHERE p.id = r.id;

  GET DIAGNOSTICS v_afectados = ROW_COUNT;
  RETURN v_afectados;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.assign_judge_groups(INT, BOOLEAN)
  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_judge_groups(INT, BOOLEAN)
  FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_judge_groups(INT, BOOLEAN)
  TO authenticated;
