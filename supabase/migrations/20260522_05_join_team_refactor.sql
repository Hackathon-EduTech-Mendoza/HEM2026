-- Migración: 20260522_05_join_team_refactor.sql
-- Descripción: Actualiza la función RPC join_team para validar dinámicamente los límites de egresados, perfiles técnicos y perfiles docentes.

CREATE OR REPLACE FUNCTION public.join_team(p_join_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
