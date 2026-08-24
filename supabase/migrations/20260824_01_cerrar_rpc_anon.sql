-- 20260824_01_cerrar_rpc_anon.sql
--
-- Cierra los RPC que un anonimo con la anon key podia ejecutar en prod.
-- Detectado el 22/08 auditando los grupos de jurado. Se vuelve peligroso el
-- 28/08, cuando se encienden teams_enabled y help_enabled.
--
-- ⚠️ DOS COSAS SE ARREGLAN ACA, Y LAS DOS HACEN FALTA
--
-- 1. LAS GUARDAS. El problema no es el grant solamente: las guardas comparan
--    contra auth.uid(), que sin sesion es NULL, y en SQL una comparacion con
--    NULL da NULL, no FALSE. Un `IF <NULL> THEN rechazar END IF` no dispara,
--    asi que la funcion sigue de largo. Es el mismo error en dos formas:
--
--      assign_mentors_randomly:  v_caller_role NOT IN ('admin','superadmin')
--                                -> NULL NOT IN (...) es NULL
--      mentor_update_ticket:     v_ticket.mentor_id <> auth.uid()
--                                -> <algo> <> NULL es NULL
--
--    Se arreglan con IS NULL / IS DISTINCT FROM, que nunca devuelven NULL.
--    Se corrigen aunque revoquemos el grant, porque un DROP + CREATE futuro
--    resetea los privilegios a los defaults y volveria a abrir el agujero.
--
-- 2. LOS GRANTS. Las funciones viejas tienen "=X/postgres" en proacl: ese es
--    el grant a PUBLIC, y anon lo hereda.
--    ⚠️ REVOKE ... FROM anon NO ALCANZA: hay que revocar FROM PUBLIC.
--
-- ⚠️ QUE NO SE TOCA, Y POR QUE
--
-- get_user_role(), get_user_team_id() y get_my_team_id() se quedan como estan.
-- Hay muchas policies con roles={public} que las llaman, y {public} incluye a
-- anon. Sacarles el EXECUTE convierte un "devuelve 0 filas" en un error 42501
-- en tablas centrales (profiles, teams, projects). Ademas devuelven el rol o
-- el equipo DEL QUE LLAMA: para un anonimo son NULL y no filtran nada.
--
-- Las trigger functions tampoco se tocan: PostgREST no expone funciones que
-- devuelven trigger, asi que su grant es cosmetico, y una de ellas es la del
-- cupo. No vale el riesgo a cuatro dias del evento.
--
-- ⚠️ assign_mentors_randomly SE QUEDA EN authenticated, NO en service_role:
-- el admin la llama desde el navegador con supabase.rpc() en
-- src/pages/admin/index.astro. Dejarla solo para service_role rompe el panel.

-- ---------------------------------------------------------------------------
-- 1. Guardas
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assign_mentors_randomly(
  reset_current boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  mentors_array UUID[];
  mentor_count  INT;
  i             INT := 1;
  teams_updated INT := 0;
  v_caller_role TEXT;
  rec           RECORD;
BEGIN
  -- Solo admins. El IS NULL de adelante es lo que corta al anonimo:
  -- sin sesion no hay fila, v_caller_role queda NULL, y NULL NOT IN (...)
  -- devuelve NULL, que no alcanza para entrar al IF.
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL
     OR v_caller_role NOT IN ('admin', 'superadmin') THEN
    RETURN json_build_object(
      'ok', false, 'error', 'Permisos insuficientes.'
    );
  END IF;

  IF reset_current THEN
    UPDATE teams SET mentor_id = NULL WHERE mentor_id IS NOT NULL;
  END IF;

  SELECT array_agg(id) INTO mentors_array
  FROM profiles
  WHERE role = 'mentor' AND registration_status = 'aprobado';

  mentor_count := array_length(mentors_array, 1);

  IF mentor_count IS NULL OR mentor_count = 0 THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'No hay mentores aprobados disponibles.',
      'teams_updated', 0
    );
  END IF;

  SELECT array_agg(val) INTO mentors_array
  FROM (SELECT unnest(mentors_array) AS val ORDER BY random()) s;

  FOR rec IN SELECT id FROM teams WHERE mentor_id IS NULL
  LOOP
    UPDATE teams SET mentor_id = mentors_array[i] WHERE id = rec.id;
    teams_updated := teams_updated + 1;
    i := i + 1;
    IF i > mentor_count THEN i := 1; END IF;
  END LOOP;

  RETURN json_build_object(
    'ok', true,
    'teams_updated', teams_updated,
    'mentors_used', mentor_count
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mentor_update_ticket(
  p_ticket_id uuid,
  p_new_status text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket RECORD;
BEGIN
  SELECT * INTO v_ticket FROM help_requests WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'ok', false, 'error', 'Ticket no encontrado.'
    );
  END IF;

  -- IS DISTINCT FROM en lugar de <>: con auth.uid() NULL, el <> devolvia
  -- NULL y la guarda no cortaba. Un integrante podia leer el UUID de su
  -- propio ticket por RLS y reenviarlo sin el header Authorization para
  -- caer en esta rama y cerrar tickets ajenos.
  IF v_ticket.mentor_id IS NULL
     OR v_ticket.mentor_id IS DISTINCT FROM auth.uid() THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'No tenes permiso para actualizar este ticket.'
    );
  END IF;

  IF NOT (
    (v_ticket.status = 'pendiente'
      AND p_new_status IN ('en_camino', 'finalizado'))
    OR
    (v_ticket.status = 'en_camino' AND p_new_status = 'finalizado')
  ) THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'Transicion invalida: '
               || v_ticket.status || ' -> ' || p_new_status
    );
  END IF;

  UPDATE help_requests
  SET
    status      = p_new_status,
    started_at  = CASE WHEN p_new_status = 'en_camino'
                       THEN now() ELSE started_at END,
    finished_at = CASE WHEN p_new_status = 'finalizado'
                       THEN now() ELSE finished_at END
  WHERE id = p_ticket_id;

  RETURN json_build_object('ok', true, 'new_status', p_new_status);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.assign_mentors_randomly(boolean)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mentor_update_ticket(uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_team(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_team(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_team() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_help() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.assign_mentors_randomly(boolean)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mentor_update_ticket(uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_team(text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_team(text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.leave_team()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_help()
  TO authenticated, service_role;
