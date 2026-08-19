-- Migración: 20260819_01_enforce_min_team_size.sql
-- Descripción: Hace cumplir el mínimo de integrantes por equipo al entregar el
-- proyecto. Hasta ahora `min_team_size` era puramente informativo: el único
-- lugar que lo leía era el cartel de TeamManager.astro ("El equipo necesita al
-- menos N integrantes para competir"), que no bloqueaba nada. Un equipo de 1 o 2
-- personas podía guardar su entrega sin problema.
--
-- El mínimo NO se puede validar al crear o al unirse a un equipo: todo equipo
-- nace con 1 integrante. El único momento con sentido es la entrega, que es
-- donde el equipo compite. Por eso va como trigger sobre `projects`.
--
-- Va en un trigger y no en el front porque la entrega es un
-- `supabase.from('projects').upsert()` directo contra la API: una validación en
-- JavaScript se saltea con la consola abierta.
--
-- El valor sale de `event_config.min_team_size` (hoy '3', el número que publica
-- el Art. 6º de las Bases). Si en el futuro se autoriza subirlo a 5, es un
-- UPDATE de esa clave y esta función lo toma sola, sin tocar código.

CREATE OR REPLACE FUNCTION public.enforce_min_team_size()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_min_size    INT;
  v_team_size   INT;
  v_team_name   TEXT;
  v_actor_role  public.user_role;
BEGIN
  -- Sin equipo asignado no hay nada que contar; que lo resuelvan las FK y RLS.
  IF NEW.team_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Bypass de procesos sin sesión: seeds, scripts de service role, SQL Editor.
  -- Se pregunta por auth.uid() y no por el rol: si algún día `profiles.role`
  -- admitiera NULL, preguntar por el rol dejaría a ese usuario fuera de la regla
  -- en silencio. La intención es "no hay usuario", no "no tiene rol".
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- ⚠️ No opinar sobre equipos ajenos. El trigger BEFORE corre ANTES del
  -- WITH CHECK de RLS, así que sin este corte un participante podía intentar
  -- insertar un proyecto con el team_id de otro equipo y usar la diferencia
  -- entre el error del trigger y el de RLS como oráculo: le revelaba qué equipos
  -- están incompletos y con cuántos integrantes. Para un team_id ajeno dejamos
  -- pasar y que hable RLS, que responde igual para todos.
  IF NEW.team_id IS DISTINCT FROM public.get_user_team_id() THEN
    RETURN NEW;
  END IF;

  -- Bypass de staff: un admin o superadmin siempre puede escribir. Es la vía de
  -- destrabe manual si el día del evento un equipo queda trabado por una baja de
  -- último momento.
  v_actor_role := public.get_user_role();

  IF v_actor_role IN ('admin', 'superadmin') THEN
    RETURN NEW;
  END IF;

  -- `event_config.value` es TEXT sin CHECK: un '5 ' o un '' cargado a mano haría
  -- fallar el cast en CADA entrega, y los equipos verían "revisá tu conexión" sin
  -- entender nada. Se extraen los dígitos y, si no queda ninguno, se cae al
  -- default en vez de tumbar todas las entregas del evento.
  SELECT COALESCE(
    (SELECT NULLIF(regexp_replace(value, '\D', '', 'g'), '')::INT
       FROM public.event_config WHERE key = 'min_team_size'),
    3
  ) INTO v_min_size;

  -- Un mínimo de 0 o 1 desactiva la regla de hecho: todo equipo tiene al menos
  -- un integrante. Se sale temprano para no pagar el COUNT al pedo.
  IF v_min_size <= 1 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_team_size
  FROM public.profiles
  WHERE team_id = NEW.team_id;

  IF v_team_size < v_min_size THEN
    SELECT name INTO v_team_name FROM public.teams WHERE id = NEW.team_id;

    -- El prefijo [min_team_size] permite que el front distinga este rechazo de
    -- un error de red y muestre el motivo real en lugar de "revisá tu conexión".
    RAISE EXCEPTION
      '[min_team_size] El equipo "%" tiene % integrante(s) y se necesitan al menos % para entregar el proyecto.',
      COALESCE(v_team_name, 'sin nombre'), v_team_size, v_min_size
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_min_team_size() IS
  'Bloquea la entrega de proyectos de equipos por debajo de event_config.min_team_size. Admin y superadmin quedan exceptuados.';

DROP TRIGGER IF EXISTS trg_enforce_min_team_size ON public.projects;

CREATE TRIGGER trg_enforce_min_team_size
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_min_team_size();

-- La función es SECURITY DEFINER y se invoca sola desde el trigger: nadie debe
-- poder llamarla directamente por RPC.
REVOKE ALL ON FUNCTION public.enforce_min_team_size() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_min_team_size() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_min_team_size() FROM authenticated;
