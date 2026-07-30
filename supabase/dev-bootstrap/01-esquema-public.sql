


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."disciplinary_profile" AS ENUM (
    'docente',
    'tecnico',
    'otro'
);


ALTER TYPE "public"."disciplinary_profile" OWNER TO "postgres";


CREATE TYPE "public"."institution" AS ENUM (
    'ies_9023_maipu',
    'ies_edison',
    'otra'
);


ALTER TYPE "public"."institution" OWNER TO "postgres";


CREATE TYPE "public"."registration_status" AS ENUM (
    'pendiente',
    'aprobado',
    'rechazado'
);


ALTER TYPE "public"."registration_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'superadmin',
    'admin',
    'juez',
    'usuario',
    'mentor'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE TYPE "public"."year_of_study" AS ENUM (
    'primero',
    'segundo',
    'tercero',
    'otro'
);


ALTER TYPE "public"."year_of_study" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_mentors_randomly"("reset_current" boolean DEFAULT false) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  mentors_array UUID[];
  mentor_count  INT;
  i             INT := 1;
  teams_updated INT := 0;
  v_caller_role TEXT;
  rec           RECORD;
BEGIN
  -- 0. Solo admins pueden ejecutar esto
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role NOT IN ('admin', 'superadmin') THEN
    RETURN json_build_object('ok', false, 'error', 'Permisos insuficientes.');
  END IF;

  -- 1. Si se pide resetear, poner todos los mentor_id en NULL (con WHERE para evitar error)
  IF reset_current THEN
    UPDATE teams SET mentor_id = NULL WHERE mentor_id IS NOT NULL;
  END IF;

  -- 2. Obtener mentores aprobados
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

  -- 3. Shuffle de mentores para aleatoriedad inicial
  SELECT array_agg(val) INTO mentors_array
  FROM (SELECT unnest(mentors_array) AS val ORDER BY random()) s;

  -- 4. Asignar con round-robin a equipos sin mentor
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
$$;


ALTER FUNCTION "public"."assign_mentors_randomly"("reset_current" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_approve_participant"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.role = 'usuario'
     AND NEW.dni IS NOT NULL
     AND NEW.institution IS NOT NULL
  THEN
    NEW.registration_status := 'aprobado';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_approve_participant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_team"("p_team_name" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_profile RECORD;
  v_join_code TEXT;
  v_team_id UUID;
BEGIN
  -- 1. Verify teams_enabled is active
  IF NOT EXISTS (
    SELECT 1 FROM public.event_config 
    WHERE key = 'teams_enabled' AND value = 'true'
  ) THEN
    RETURN json_build_object('ok', false, 'error', 'La formación de equipos no está habilitada.');
  END IF;

  -- 2. Validate user profile
  SELECT * INTO v_user_profile FROM public.profiles WHERE id = v_user_id;
  
  IF v_user_profile IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Perfil no encontrado.');
  END IF;
  
  IF v_user_profile.registration_status != 'aprobado' THEN
    RETURN json_build_object('ok', false, 'error', 'Tu inscripción debe estar aprobada para crear un equipo.');
  END IF;

  IF v_user_profile.team_id IS NOT NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Ya pertenecés a un equipo. Abandonalo primero.');
  END IF;

  -- 3. Validate team name is not empty
  IF p_team_name IS NULL OR trim(p_team_name) = '' THEN
    RETURN json_build_object('ok', false, 'error', 'El nombre del equipo es obligatorio.');
  END IF;

  -- 4. Generate unique 6-character join_code
  LOOP
    v_join_code := upper(substr(md5(random()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.teams WHERE join_code = v_join_code);
  END LOOP;

  -- 5. Create team
  INSERT INTO public.teams (name, join_code, leader_id)
  VALUES (trim(p_team_name), v_join_code, v_user_id)
  RETURNING id INTO v_team_id;

  -- 6. Assign user to team
  UPDATE public.profiles SET team_id = v_team_id WHERE id = v_user_id;

  RETURN json_build_object(
    'ok', true, 
    'team_id', v_team_id, 
    'join_code', v_join_code, 
    'team_name', trim(p_team_name)
  );
END;
$$;


ALTER FUNCTION "public"."create_team"("p_team_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_team_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT team_id FROM profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_team_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"() RETURNS "public"."user_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_team_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT team_id FROM public.profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_user_team_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role TEXT := COALESCE(NEW.raw_user_meta_data->>'role', 'usuario');
BEGIN
  -- Solo roles no privilegiados pueden venir del signup público
  IF v_role NOT IN ('usuario', 'mentor', 'juez') THEN
    v_role := 'usuario';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, registration_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_role::public.user_role,
    'pendiente'
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_team"("p_join_code" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_team_id UUID;
  v_team_name TEXT;
  v_user_id UUID := auth.uid();
  v_user_profile RECORD;
  v_team_size INT;
  v_egresado_count INT;
  v_tecnico_count INT;
  v_docente_count INT;
  v_max_size INT;
  v_max_egresados INT;
  v_max_tecnicos INT;
  v_max_docentes INT;
BEGIN
  -- 1. Verificar que teams_enabled esté activo
  IF NOT EXISTS (
    SELECT 1 FROM public.event_config 
    WHERE key = 'teams_enabled' AND value = 'true'
  ) THEN
    RETURN json_build_object('ok', false, 'error', 'La formación de equipos no está habilitada.');
  END IF;

  -- 2. Validar perfil de usuario
  SELECT * INTO v_user_profile FROM public.profiles WHERE id = v_user_id;
  
  IF v_user_profile IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Perfil no encontrado.');
  END IF;
  
  IF v_user_profile.registration_status != 'aprobado' THEN
    RETURN json_build_object('ok', false, 'error', 'Tu inscripción debe estar aprobada para unirte a un equipo.');
  END IF;

  IF v_user_profile.team_id IS NOT NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Ya pertenecés a un equipo. Abandonalo primero.');
  END IF;

  -- 3. Validar código de unión
  IF p_join_code IS NULL OR trim(p_join_code) = '' THEN
    RETURN json_build_object('ok', false, 'error', 'Ingresá un código de equipo.');
  END IF;

  -- 4. Buscar equipo por código (case insensitive)
  SELECT id, name INTO v_team_id, v_team_name 
  FROM public.teams WHERE join_code = upper(trim(p_join_code));
  
  IF v_team_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Código de equipo inválido. Verificá que esté bien escrito.');
  END IF;

  -- 5. Validar límite de tamaño del equipo
  SELECT COALESCE(
    (SELECT value::INT FROM public.event_config WHERE key = 'max_team_size'), 
    5
  ) INTO v_max_size;

  SELECT COUNT(*) INTO v_team_size 
  FROM public.profiles WHERE team_id = v_team_id;
  
  IF v_team_size >= v_max_size THEN
    RETURN json_build_object('ok', false, 'error', 
      format('El equipo "%s" ya tiene el máximo de %s integrantes.', v_team_name, v_max_size));
  END IF;

  -- 6. Validar regla de egresados
  IF v_user_profile.is_egresado THEN
    SELECT COALESCE(
      (SELECT value::INT FROM public.event_config WHERE key = 'max_egresados_per_team'), 
      1
    ) INTO v_max_egresados;

    SELECT COUNT(*) INTO v_egresado_count 
    FROM public.profiles WHERE team_id = v_team_id AND is_egresado = true;
    
    IF v_egresado_count >= v_max_egresados THEN
      RETURN json_build_object('ok', false, 'error', 
        format('Este equipo ya cuenta con el máximo de %s egresado(s) permitido.', v_max_egresados));
    END IF;
  END IF;

  -- 7. Validar regla de perfil técnico
  IF v_user_profile.disciplinary_profile = 'tecnico' THEN
    SELECT COALESCE(
      (SELECT value::INT FROM public.event_config WHERE key = 'max_tecnicos_per_team'), 
      2
    ) INTO v_max_tecnicos;

    SELECT COUNT(*) INTO v_tecnico_count 
    FROM public.profiles WHERE team_id = v_team_id AND disciplinary_profile = 'tecnico';
    
    IF v_tecnico_count >= v_max_tecnicos THEN
      RETURN json_build_object('ok', false, 'error', 
        format('Este equipo ya cuenta con el máximo de %s perfil(es) técnico(s) permitido.', v_max_tecnicos));
    END IF;
  END IF;

  -- 8. Validar regla de perfil docente
  IF v_user_profile.disciplinary_profile = 'docente' THEN
    SELECT COALESCE(
      (SELECT value::INT FROM public.event_config WHERE key = 'max_docentes_per_team'), 
      2
    ) INTO v_max_docentes;

    SELECT COUNT(*) INTO v_docente_count 
    FROM public.profiles WHERE team_id = v_team_id AND disciplinary_profile = 'docente';
    
    IF v_docente_count >= v_max_docentes THEN
      RETURN json_build_object('ok', false, 'error', 
        format('Este equipo ya cuenta con el máximo de %s perfil(es) docente(s) permitido.', v_max_docentes));
    END IF;
  END IF;

  -- 9. Todo correcto: asignar usuario al equipo
  UPDATE public.profiles SET team_id = v_team_id WHERE id = v_user_id;

  RETURN json_build_object('ok', true, 'team_name', v_team_name, 'team_id', v_team_id);
END;
$$;


ALTER FUNCTION "public"."join_team"("p_join_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_team"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_team_id UUID;
  v_is_leader BOOLEAN;
  v_team_name TEXT;
BEGIN
  -- 1. Verify teams_enabled is active
  IF NOT EXISTS (
    SELECT 1 FROM public.event_config 
    WHERE key = 'teams_enabled' AND value = 'true'
  ) THEN
    RETURN json_build_object('ok', false, 'error', 'La gestión de equipos no está habilitada.');
  END IF;

  -- 2. Check user belongs to a team
  SELECT team_id INTO v_team_id FROM public.profiles WHERE id = v_user_id;
  
  IF v_team_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'No pertenecés a ningún equipo.');
  END IF;

  -- 3. Get team info and check if leader
  SELECT name, (leader_id = v_user_id) INTO v_team_name, v_is_leader 
  FROM public.teams WHERE id = v_team_id;

  IF v_is_leader THEN
    -- Leader leaves → dissolve entire team
    -- First: remove all members
    UPDATE public.profiles SET team_id = NULL WHERE team_id = v_team_id;
    -- Then: delete the team
    DELETE FROM public.teams WHERE id = v_team_id;
    
    RETURN json_build_object(
      'ok', true, 
      'dissolved', true, 
      'message', format('El equipo "%s" fue disuelto porque el líder abandonó.', v_team_name)
    );
  ELSE
    -- Regular member leaves
    UPDATE public.profiles SET team_id = NULL WHERE id = v_user_id;
    
    RETURN json_build_object(
      'ok', true, 
      'dissolved', false, 
      'message', format('Abandonaste el equipo "%s".', v_team_name)
    );
  END IF;
END;
$$;


ALTER FUNCTION "public"."leave_team"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mentor_update_ticket"("p_ticket_id" "uuid", "p_new_status" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_ticket RECORD;
BEGIN
  -- 1. Obtener el ticket
  SELECT * INTO v_ticket FROM help_requests WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Ticket no encontrado.');
  END IF;

  -- 2. Verificar que el caller es el mentor asignado
  IF v_ticket.mentor_id IS NULL OR v_ticket.mentor_id <> auth.uid() THEN
    RETURN json_build_object('ok', false, 'error', 'No tenés permiso para actualizar este ticket.');
  END IF;

  -- 3. Validar transiciones de estado
  IF NOT (
    (v_ticket.status = 'pendiente' AND p_new_status IN ('en_camino', 'finalizado'))
    OR
    (v_ticket.status = 'en_camino' AND p_new_status = 'finalizado')
  ) THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'Transición inválida: ' || v_ticket.status || ' -> ' || p_new_status
    );
  END IF;

  -- 4. Actualizar con timestamps correspondientes
  UPDATE help_requests
  SET
    status      = p_new_status,
    started_at  = CASE WHEN p_new_status = 'en_camino' THEN now() ELSE started_at END,
    finished_at = CASE WHEN p_new_status = 'finalizado' THEN now() ELSE finished_at END
  WHERE id = p_ticket_id;

  RETURN json_build_object('ok', true, 'new_status', p_new_status);
END;
$$;


ALTER FUNCTION "public"."mentor_update_ticket"("p_ticket_id" "uuid", "p_new_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_role_escalation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller_id   UUID := auth.uid();
  v_caller_role public.user_role;
BEGIN
  -- Sin cambio de rol → no hay nada que validar
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  -- Contexto sin usuario autenticado (service_role, migraciones, SQL editor)
  IF v_caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;

  IF v_caller_role = 'superadmin' THEN
    RETURN NEW;
  END IF;

  IF v_caller_role = 'admin' THEN
    IF NEW.role IN ('admin', 'superadmin') THEN
      RAISE EXCEPTION 'Solo un superadmin puede asignar roles administrativos.';
    END IF;
    RETURN NEW;
  END IF;

  -- Usuario común: solo su propia fila, solo roles no privilegiados,
  -- y solo partiendo de 'usuario' (flujo de onboarding).
  IF v_caller_id = NEW.id
     AND OLD.role = 'usuario'
     AND NEW.role IN ('usuario', 'mentor', 'juez')
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'No tenés permiso para modificar el rol de este perfil.';
END;
$$;


ALTER FUNCTION "public"."protect_role_escalation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_help"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_team_id   UUID;
  v_mentor_id UUID;
  v_recent    TIMESTAMPTZ;
  v_cooldown  INT;
  v_enabled   TEXT;
  v_ticket_id UUID;
BEGIN
  -- 1. Obtener el equipo y mentor del usuario actual
  SELECT team_id INTO v_team_id FROM profiles WHERE id = auth.uid();
  IF v_team_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'No pertenecés a ningún equipo.');
  END IF;

  SELECT mentor_id INTO v_mentor_id FROM teams WHERE id = v_team_id;
  IF v_mentor_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Tu equipo no tiene mentor asignado aún.');
  END IF;

  -- 2. Verificar que help_enabled esté activo
  SELECT value INTO v_enabled FROM event_config WHERE key = 'help_enabled';
  IF v_enabled IS NULL OR v_enabled <> 'true' THEN
    RETURN json_build_object('ok', false, 'error', 'Los pedidos de ayuda están deshabilitados.');
  END IF;

  -- 3. Verificar que no haya un ticket activo
  IF EXISTS (
    SELECT 1 FROM help_requests
    WHERE team_id = v_team_id AND status IN ('pendiente', 'en_camino')
  ) THEN
    RETURN json_build_object('ok', false, 'error', 'Tu equipo ya tiene un pedido de ayuda activo.');
  END IF;

  -- 4. Verificar cooldown
  SELECT value INTO v_cooldown FROM event_config WHERE key = 'help_cooldown_minutes';
  v_cooldown := COALESCE(v_cooldown::INT, 0);

  IF v_cooldown > 0 THEN
    SELECT MAX(finished_at) INTO v_recent
    FROM help_requests
    WHERE team_id = v_team_id AND status = 'finalizado';

    IF v_recent IS NOT NULL AND (now() - v_recent) < (v_cooldown || ' minutes')::INTERVAL THEN
      RETURN json_build_object(
        'ok', false,
        'error', 'Debés esperar ' || v_cooldown || ' minutos entre pedidos de ayuda.'
      );
    END IF;
  END IF;

  -- 5. Crear el ticket
  INSERT INTO help_requests (team_id, mentor_id, status)
  VALUES (v_team_id, v_mentor_id, 'pendiente')
  RETURNING id INTO v_ticket_id;

  RETURN json_build_object('ok', true, 'ticket_id', v_ticket_id);
END;
$$;


ALTER FUNCTION "public"."request_help"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_full_name"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.first_name IS NOT NULL AND NEW.last_name IS NOT NULL THEN
    NEW.full_name := NEW.first_name || ' ' || NEW.last_name;
  ELSIF NEW.first_name IS NOT NULL THEN
    NEW.full_name := NEW.first_name;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_full_name"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."edition_projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "edition_id" "uuid" NOT NULL,
    "project_name" "text" NOT NULL,
    "team_name" "text",
    "description" "text",
    "final_position" smallint,
    "category" "text",
    "url_demo" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."edition_projects" OWNER TO "postgres";


COMMENT ON TABLE "public"."edition_projects" IS 'Proyectos destacados/ganadores de ediciones anteriores para la landing page.';



CREATE TABLE IF NOT EXISTS "public"."editions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "edition_number" smallint NOT NULL,
    "year" smallint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "is_current" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."editions" OWNER TO "postgres";


COMMENT ON TABLE "public"."editions" IS 'Ediciones históricas de la Hackathon. Diseño perpetuo multi-año.';



CREATE TABLE IF NOT EXISTS "public"."evaluations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "judge_id" "uuid" NOT NULL,
    "phase" "text" NOT NULL,
    "score_problem" smallint NOT NULL,
    "score_solution" smallint NOT NULL,
    "score_innovation" smallint NOT NULL,
    "score_feasibility" smallint NOT NULL,
    "score_impact" smallint NOT NULL,
    "score_communication" smallint NOT NULL,
    "feedback" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "evaluations_phase_check" CHECK (("phase" = ANY (ARRAY['preclasificacion'::"text", 'final'::"text"]))),
    CONSTRAINT "evaluations_score_communication_check" CHECK ((("score_communication" >= 1) AND ("score_communication" <= 5))),
    CONSTRAINT "evaluations_score_feasibility_check" CHECK ((("score_feasibility" >= 1) AND ("score_feasibility" <= 5))),
    CONSTRAINT "evaluations_score_impact_check" CHECK ((("score_impact" >= 1) AND ("score_impact" <= 5))),
    CONSTRAINT "evaluations_score_innovation_check" CHECK ((("score_innovation" >= 1) AND ("score_innovation" <= 5))),
    CONSTRAINT "evaluations_score_problem_check" CHECK ((("score_problem" >= 1) AND ("score_problem" <= 5))),
    CONSTRAINT "evaluations_score_solution_check" CHECK ((("score_solution" >= 1) AND ("score_solution" <= 5)))
);


ALTER TABLE "public"."evaluations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."event_config" IS 'Configuraciones clave-valor del evento (deadlines, sedes, etc.)';



CREATE TABLE IF NOT EXISTS "public"."help_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "mentor_id" "uuid",
    "status" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    CONSTRAINT "help_requests_status_check" CHECK (("status" = ANY (ARRAY['pendiente'::"text", 'en_camino'::"text", 'finalizado'::"text", 'expirado'::"text"])))
);

ALTER TABLE ONLY "public"."help_requests" REPLICA IDENTITY FULL;


ALTER TABLE "public"."help_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "dni" "text",
    "email" "text" NOT NULL,
    "phone_whatsapp" "text",
    "instagram_handle" "text",
    "role" "public"."user_role" DEFAULT 'usuario'::"public"."user_role" NOT NULL,
    "institution" "public"."institution",
    "year_of_study" "public"."year_of_study",
    "disciplinary_profile" "public"."disciplinary_profile",
    "is_egresado" boolean DEFAULT false NOT NULL,
    "registration_status" "public"."registration_status" DEFAULT 'pendiente'::"public"."registration_status" NOT NULL,
    "team_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "professional_title" "text",
    "institution_other" "text",
    CONSTRAINT "profiles_institution_other_check" CHECK ((("institution_other" IS NULL) OR ("institution" = 'otra'::"public"."institution")))
);

ALTER TABLE ONLY "public"."profiles" REPLICA IDENTITY FULL;


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'Perfiles de usuario, extiende auth.users 1:1. (§6, §8 B&C)';



COMMENT ON COLUMN "public"."profiles"."is_egresado" IS 'Max 1 egresado por equipo. (§6 B&C)';



COMMENT ON COLUMN "public"."profiles"."institution_other" IS 'Nombre libre de la institución cuando institution = ''otra''. NULL en el resto de los casos.';



CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "is_finalist" boolean DEFAULT false NOT NULL,
    "final_position" smallint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "join_code" "text",
    "leader_id" "uuid",
    "mentor_id" "uuid",
    "mentor_id_2" "uuid",
    CONSTRAINT "chk_final_position" CHECK ((("final_position" IS NULL) OR (("final_position" >= 1) AND ("final_position" <= 3))))
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


COMMENT ON TABLE "public"."teams" IS 'Equipos de la Hackathon. Min 3, max 5 miembros. Max 1 egresado. (§7 B&C)';



CREATE OR REPLACE VIEW "public"."mentor_help_stats" WITH ("security_invoker"='true') AS
 SELECT "p"."id" AS "mentor_id",
    "p"."full_name" AS "mentor_name",
    "count"("hr"."id") AS "total_tickets",
    "count"("hr"."id") FILTER (WHERE ("hr"."status" = 'pendiente'::"text")) AS "pending_count",
    "count"("hr"."id") FILTER (WHERE ("hr"."status" = 'en_camino'::"text")) AS "in_progress_count",
    "count"("hr"."id") FILTER (WHERE ("hr"."status" = 'finalizado'::"text")) AS "finished_count",
    "count"("hr"."id") FILTER (WHERE ("hr"."status" = 'expirado'::"text")) AS "expired_count",
    COALESCE("round"("avg"((EXTRACT(epoch FROM ("hr"."started_at" - "hr"."created_at")) / (60)::numeric)) FILTER (WHERE ("hr"."started_at" IS NOT NULL)), 1), (0)::numeric) AS "avg_response_minutes",
    COALESCE("round"("avg"((EXTRACT(epoch FROM ("hr"."finished_at" - "hr"."started_at")) / (60)::numeric)) FILTER (WHERE (("hr"."finished_at" IS NOT NULL) AND ("hr"."started_at" IS NOT NULL))), 1), (0)::numeric) AS "avg_session_minutes",
    ( SELECT "count"(*) AS "count"
           FROM "public"."teams" "t"
          WHERE (("t"."mentor_id" = "p"."id") OR ("t"."mentor_id_2" = "p"."id"))) AS "assigned_teams"
   FROM ("public"."profiles" "p"
     LEFT JOIN "public"."help_requests" "hr" ON (("hr"."mentor_id" = "p"."id")))
  WHERE (("p"."role" = 'mentor'::"public"."user_role") AND ("p"."registration_status" = 'aprobado'::"public"."registration_status"))
  GROUP BY "p"."id", "p"."full_name";


ALTER VIEW "public"."mentor_help_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description_problem" "text" NOT NULL,
    "description_solution" "text" NOT NULL,
    "url_prototype" "text",
    "url_support_material" "text",
    "submitted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_finalist" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


COMMENT ON TABLE "public"."projects" IS 'Entregables por equipo, relación 1:1. (§11 B&C)';



CREATE OR REPLACE VIEW "public"."project_leaderboard" WITH ("security_invoker"='true') AS
 SELECT "p"."id" AS "project_id",
    "p"."title",
    "t"."name" AS "team_name",
    "p"."is_finalist",
    "ph"."phase",
    "count"("e"."id") AS "evaluations_count",
    COALESCE("avg"("e"."score_problem"), (0)::numeric) AS "avg_problem",
    COALESCE("avg"("e"."score_solution"), (0)::numeric) AS "avg_solution",
    COALESCE("avg"("e"."score_innovation"), (0)::numeric) AS "avg_innovation",
    COALESCE("avg"("e"."score_feasibility"), (0)::numeric) AS "avg_feasibility",
    COALESCE("avg"("e"."score_impact"), (0)::numeric) AS "avg_impact",
    COALESCE("avg"("e"."score_communication"), (0)::numeric) AS "avg_communication",
    COALESCE("avg"(((((("e"."score_problem" + "e"."score_solution") + "e"."score_innovation") + "e"."score_feasibility") + "e"."score_impact") + "e"."score_communication")), (0)::numeric) AS "raw_score",
    ((((((((COALESCE("avg"("e"."score_problem"), (0)::numeric) * 0.15) + (COALESCE("avg"("e"."score_solution"), (0)::numeric) * 0.20)) + (COALESCE("avg"("e"."score_innovation"), (0)::numeric) * 0.15)) + (COALESCE("avg"("e"."score_feasibility"), (0)::numeric) * 0.20)) + (COALESCE("avg"("e"."score_impact"), (0)::numeric) * 0.15)) + (COALESCE("avg"("e"."score_communication"), (0)::numeric) * 0.15)) / (5)::numeric) * (100)::numeric) AS "final_score"
   FROM ((("public"."projects" "p"
     CROSS JOIN ( VALUES ('preclasificacion'::"text"), ('final'::"text")) "ph"("phase"))
     LEFT JOIN "public"."teams" "t" ON (("p"."team_id" = "t"."id")))
     LEFT JOIN "public"."evaluations" "e" ON ((("e"."project_id" = "p"."id") AND ("e"."phase" = "ph"."phase"))))
  GROUP BY "p"."id", "p"."title", "t"."name", "p"."is_finalist", "ph"."phase"
  ORDER BY ((((((((COALESCE("avg"("e"."score_problem"), (0)::numeric) * 0.15) + (COALESCE("avg"("e"."score_solution"), (0)::numeric) * 0.20)) + (COALESCE("avg"("e"."score_innovation"), (0)::numeric) * 0.15)) + (COALESCE("avg"("e"."score_feasibility"), (0)::numeric) * 0.20)) + (COALESCE("avg"("e"."score_impact"), (0)::numeric) * 0.15)) + (COALESCE("avg"("e"."score_communication"), (0)::numeric) * 0.15)) / (5)::numeric) * (100)::numeric) DESC;


ALTER VIEW "public"."project_leaderboard" OWNER TO "postgres";


ALTER TABLE ONLY "public"."edition_projects"
    ADD CONSTRAINT "edition_projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."editions"
    ADD CONSTRAINT "editions_edition_number_key" UNIQUE ("edition_number");



ALTER TABLE ONLY "public"."editions"
    ADD CONSTRAINT "editions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evaluations"
    ADD CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evaluations"
    ADD CONSTRAINT "evaluations_project_id_judge_id_phase_key" UNIQUE ("project_id", "judge_id", "phase");



ALTER TABLE ONLY "public"."event_config"
    ADD CONSTRAINT "event_config_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."event_config"
    ADD CONSTRAINT "event_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."help_requests"
    ADD CONSTRAINT "help_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_dni_key" UNIQUE ("dni");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_team_id_key" UNIQUE ("team_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_join_code_key" UNIQUE ("join_code");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_edition_projects_edition_id" ON "public"."edition_projects" USING "btree" ("edition_id");



CREATE INDEX "idx_editions_year" ON "public"."editions" USING "btree" ("year");



CREATE INDEX "idx_evaluations_judge_id" ON "public"."evaluations" USING "btree" ("judge_id");



CREATE INDEX "idx_evaluations_project_phase" ON "public"."evaluations" USING "btree" ("project_id", "phase");



CREATE INDEX "idx_help_requests_mentor" ON "public"."help_requests" USING "btree" ("mentor_id");



CREATE INDEX "idx_help_requests_status" ON "public"."help_requests" USING "btree" ("status");



CREATE INDEX "idx_help_requests_team" ON "public"."help_requests" USING "btree" ("team_id");



CREATE UNIQUE INDEX "idx_one_active_help_request" ON "public"."help_requests" USING "btree" ("team_id") WHERE ("status" = ANY (ARRAY['pendiente'::"text", 'en_camino'::"text"]));



CREATE INDEX "idx_profiles_registration_status" ON "public"."profiles" USING "btree" ("registration_status");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_profiles_team_id" ON "public"."profiles" USING "btree" ("team_id");



CREATE INDEX "idx_projects_team_id" ON "public"."projects" USING "btree" ("team_id");



CREATE INDEX "idx_teams_leader_id" ON "public"."teams" USING "btree" ("leader_id");



CREATE INDEX "idx_teams_mentor_id" ON "public"."teams" USING "btree" ("mentor_id");



CREATE INDEX "idx_teams_mentor_id_2" ON "public"."teams" USING "btree" ("mentor_id_2");



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."evaluations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_edition_projects_updated_at" BEFORE UPDATE ON "public"."edition_projects" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_editions_updated_at" BEFORE UPDATE ON "public"."editions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_event_config_updated_at" BEFORE UPDATE ON "public"."event_config" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_projects_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_teams_updated_at" BEFORE UPDATE ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trg_auto_approve" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."auto_approve_participant"();



CREATE OR REPLACE TRIGGER "trg_protect_role_escalation" BEFORE UPDATE OF "role" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_role_escalation"();



CREATE OR REPLACE TRIGGER "trg_sync_full_name" BEFORE INSERT OR UPDATE OF "first_name", "last_name" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_full_name"();



ALTER TABLE ONLY "public"."edition_projects"
    ADD CONSTRAINT "edition_projects_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."evaluations"
    ADD CONSTRAINT "evaluations_judge_id_fkey" FOREIGN KEY ("judge_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."evaluations"
    ADD CONSTRAINT "evaluations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."help_requests"
    ADD CONSTRAINT "help_requests_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."help_requests"
    ADD CONSTRAINT "help_requests_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_mentor_id_2_fkey" FOREIGN KEY ("mentor_id_2") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



CREATE POLICY "Admins can view all evaluations" ON "public"."evaluations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = ANY (ARRAY['admin'::"public"."user_role", 'superadmin'::"public"."user_role"]))))));



CREATE POLICY "Judges can insert own evaluations" ON "public"."evaluations" FOR INSERT WITH CHECK ((("judge_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'juez'::"public"."user_role") AND ("profiles"."registration_status" = 'aprobado'::"public"."registration_status")))) AND ("phase" = ( SELECT "event_config"."value"
   FROM "public"."event_config"
  WHERE ("event_config"."key" = 'evaluation_phase'::"text"))) AND (("phase" = 'preclasificacion'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."projects"
  WHERE (("projects"."id" = "evaluations"."project_id") AND ("projects"."is_finalist" = true)))))));



CREATE POLICY "Judges can update own evaluations" ON "public"."evaluations" FOR UPDATE USING ((("judge_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'juez'::"public"."user_role") AND ("profiles"."registration_status" = 'aprobado'::"public"."registration_status")))) AND ("phase" = ( SELECT "event_config"."value"
   FROM "public"."event_config"
  WHERE ("event_config"."key" = 'evaluation_phase'::"text")))));



CREATE POLICY "Judges can view own evaluations" ON "public"."evaluations" FOR SELECT USING (("judge_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "admins_read_all_help_requests" ON "public"."help_requests" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = ANY (ARRAY['admin'::"public"."user_role", 'superadmin'::"public"."user_role"]))))));



CREATE POLICY "admins_read_projects" ON "public"."projects" FOR SELECT TO "authenticated" USING (("public"."get_user_role"() = ANY (ARRAY['superadmin'::"public"."user_role", 'admin'::"public"."user_role", 'juez'::"public"."user_role"])));



CREATE POLICY "anon_select_event_config" ON "public"."event_config" FOR SELECT USING (true);



CREATE POLICY "approved_user_insert_teams" ON "public"."teams" FOR INSERT WITH CHECK ((("public"."get_user_role"() = 'usuario'::"public"."user_role") AND (( SELECT "profiles"."registration_status"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'aprobado'::"public"."registration_status") AND (( SELECT "profiles"."team_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) IS NULL)));



CREATE POLICY "authenticated_select_event_config" ON "public"."event_config" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



ALTER TABLE "public"."edition_projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."editions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."evaluations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."help_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "judge_select_profiles" ON "public"."profiles" FOR SELECT USING (("public"."get_user_role"() = 'juez'::"public"."user_role"));



CREATE POLICY "judge_select_projects" ON "public"."projects" FOR SELECT USING (("public"."get_user_role"() = 'juez'::"public"."user_role"));



CREATE POLICY "judge_select_teams" ON "public"."teams" FOR SELECT USING (("public"."get_user_role"() = 'juez'::"public"."user_role"));



CREATE POLICY "mentor_select_profiles" ON "public"."profiles" FOR SELECT USING (("public"."get_user_role"() = 'mentor'::"public"."user_role"));



CREATE POLICY "mentor_select_projects" ON "public"."projects" FOR SELECT USING (("public"."get_user_role"() = 'mentor'::"public"."user_role"));



CREATE POLICY "mentor_select_teams" ON "public"."teams" FOR SELECT USING (("public"."get_user_role"() = 'mentor'::"public"."user_role"));



CREATE POLICY "mentors_read_assigned_help_requests" ON "public"."help_requests" FOR SELECT TO "authenticated" USING ((("mentor_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'mentor'::"public"."user_role"))))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_select_edition_projects" ON "public"."edition_projects" FOR SELECT USING (true);



CREATE POLICY "public_select_editions" ON "public"."editions" FOR SELECT USING (true);



CREATE POLICY "staff_all_edition_projects" ON "public"."edition_projects" USING ((( SELECT "public"."get_user_role"() AS "get_user_role") = ANY (ARRAY['admin'::"public"."user_role", 'superadmin'::"public"."user_role"])));



CREATE POLICY "staff_all_editions" ON "public"."editions" USING ((( SELECT "public"."get_user_role"() AS "get_user_role") = ANY (ARRAY['admin'::"public"."user_role", 'superadmin'::"public"."user_role"])));



CREATE POLICY "staff_all_event_config" ON "public"."event_config" USING ((( SELECT "public"."get_user_role"() AS "get_user_role") = ANY (ARRAY['admin'::"public"."user_role", 'superadmin'::"public"."user_role"])));



CREATE POLICY "staff_all_profiles" ON "public"."profiles" USING ((( SELECT "public"."get_user_role"() AS "get_user_role") = ANY (ARRAY['admin'::"public"."user_role", 'superadmin'::"public"."user_role"])));



CREATE POLICY "staff_all_projects" ON "public"."projects" USING ((( SELECT "public"."get_user_role"() AS "get_user_role") = ANY (ARRAY['admin'::"public"."user_role", 'superadmin'::"public"."user_role"])));



CREATE POLICY "staff_all_teams" ON "public"."teams" USING ((( SELECT "public"."get_user_role"() AS "get_user_role") = ANY (ARRAY['admin'::"public"."user_role", 'superadmin'::"public"."user_role"])));



CREATE POLICY "team_members_read_own_help_requests" ON "public"."help_requests" FOR SELECT TO "authenticated" USING (("team_id" = ( SELECT "p"."team_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teams_insert_own_project" ON "public"."projects" FOR INSERT TO "authenticated" WITH CHECK (("team_id" = "public"."get_my_team_id"()));



CREATE POLICY "teams_select_own_project" ON "public"."projects" FOR SELECT TO "authenticated" USING (("team_id" = "public"."get_my_team_id"()));



CREATE POLICY "teams_update_own_project" ON "public"."projects" FOR UPDATE TO "authenticated" USING (("team_id" = "public"."get_my_team_id"())) WITH CHECK (("team_id" = "public"."get_my_team_id"()));



CREATE POLICY "user_insert_own_project" ON "public"."projects" FOR INSERT WITH CHECK (("team_id" = "public"."get_user_team_id"()));



CREATE POLICY "user_select_own_profile" ON "public"."profiles" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "user_select_own_project" ON "public"."projects" FOR SELECT USING (("team_id" = "public"."get_user_team_id"()));



CREATE POLICY "user_select_teams" ON "public"."teams" FOR SELECT USING (("public"."get_user_role"() = 'usuario'::"public"."user_role"));



CREATE POLICY "user_update_own_profile" ON "public"."profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "user_update_own_project" ON "public"."projects" FOR UPDATE USING (("team_id" = "public"."get_user_team_id"())) WITH CHECK (("team_id" = "public"."get_user_team_id"()));



CREATE POLICY "user_update_own_team" ON "public"."teams" FOR UPDATE USING (("id" = "public"."get_user_team_id"())) WITH CHECK (("id" = "public"."get_user_team_id"()));



CREATE POLICY "users_read_mentor_profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("role" = 'mentor'::"public"."user_role"));



CREATE POLICY "users_select_team_members" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("team_id" IS NOT NULL) AND ("team_id" = "public"."get_my_team_id"())));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."profiles";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."teams";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."assign_mentors_randomly"("reset_current" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."assign_mentors_randomly"("reset_current" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_mentors_randomly"("reset_current" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."auto_approve_participant"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."auto_approve_participant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_team"("p_team_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_team"("p_team_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_team_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_team_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_team_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_team_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_team_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_team_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."join_team"("p_join_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_team"("p_join_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."leave_team"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_team"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mentor_update_ticket"("p_ticket_id" "uuid", "p_new_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mentor_update_ticket"("p_ticket_id" "uuid", "p_new_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mentor_update_ticket"("p_ticket_id" "uuid", "p_new_status" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."protect_role_escalation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."protect_role_escalation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."request_help"() TO "anon";
GRANT ALL ON FUNCTION "public"."request_help"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_help"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_full_name"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_full_name"() TO "service_role";
























GRANT ALL ON TABLE "public"."edition_projects" TO "anon";
GRANT ALL ON TABLE "public"."edition_projects" TO "authenticated";
GRANT ALL ON TABLE "public"."edition_projects" TO "service_role";



GRANT ALL ON TABLE "public"."editions" TO "anon";
GRANT ALL ON TABLE "public"."editions" TO "authenticated";
GRANT ALL ON TABLE "public"."editions" TO "service_role";



GRANT ALL ON TABLE "public"."evaluations" TO "anon";
GRANT ALL ON TABLE "public"."evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."evaluations" TO "service_role";



GRANT ALL ON TABLE "public"."event_config" TO "anon";
GRANT ALL ON TABLE "public"."event_config" TO "authenticated";
GRANT ALL ON TABLE "public"."event_config" TO "service_role";



GRANT ALL ON TABLE "public"."help_requests" TO "anon";
GRANT ALL ON TABLE "public"."help_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."help_requests" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."mentor_help_stats" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."mentor_help_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."mentor_help_stats" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."project_leaderboard" TO "anon";
GRANT ALL ON TABLE "public"."project_leaderboard" TO "authenticated";
GRANT ALL ON TABLE "public"."project_leaderboard" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































