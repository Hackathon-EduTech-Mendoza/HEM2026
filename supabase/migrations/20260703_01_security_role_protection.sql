-- Migración: 20260703_01_security_role_protection.sql
-- Descripción: Cierra las vías de escalada de privilegios detectadas en la auditoría de seguridad.
--   1. Trigger que impide que un usuario se asigne roles administrativos vía API (PostgREST).
--   2. handle_new_user() deja de confiar en el role enviado en raw_user_meta_data (controlado por el cliente en signUp).
--   3. Las políticas de evaluaciones exigen juez APROBADO, no solo el rol.

-- ──────────────────────────────────────────────────────────────
-- 1. Proteger la columna role contra auto-escalada
-- ──────────────────────────────────────────────────────────────
-- Reglas:
--   - Contextos sin JWT (service_role, SQL editor, triggers internos): sin restricción.
--   - superadmin: puede asignar cualquier rol.
--   - admin: puede asignar roles NO administrativos (no puede crear admins ni superadmins).
--   - resto: solo puede elegir 'usuario' | 'mentor' | 'juez' sobre SU propia fila
--     (necesario para el flujo de onboarding), nunca 'admin' ni 'superadmin'.

CREATE OR REPLACE FUNCTION public.protect_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

DROP TRIGGER IF EXISTS trg_protect_role_escalation ON public.profiles;
CREATE TRIGGER trg_protect_role_escalation
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_role_escalation();

-- ──────────────────────────────────────────────────────────────
-- 2. handle_new_user(): whitelist del rol recibido en metadata
-- ──────────────────────────────────────────────────────────────
-- Antes: (COALESCE(NEW.raw_user_meta_data->>'role', 'usuario'))::user_role
-- raw_user_meta_data lo controla el cliente en signUp() → cualquiera podía
-- nacer 'superadmin' llamando a /auth/v1/signup con data: { role: 'superadmin' }.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- ──────────────────────────────────────────────────────────────
-- 3. Evaluaciones: exigir juez APROBADO (no solo el rol)
-- ──────────────────────────────────────────────────────────────
-- El onboarding permite elegir el rol 'juez' libremente (queda 'pendiente'
-- hasta aprobación manual). Sin este check, un juez pendiente podía insertar
-- evaluaciones directamente vía API.

DROP POLICY IF EXISTS "Judges can insert own evaluations" ON public.evaluations;
CREATE POLICY "Judges can insert own evaluations" ON public.evaluations FOR INSERT TO public
WITH CHECK (
  judge_id = (select auth.uid())
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (select auth.uid())
      AND role = 'juez'::user_role
      AND registration_status = 'aprobado'
  )
  AND EXISTS (SELECT 1 FROM event_config WHERE key = 'evaluation_enabled' AND value = 'true')
);

DROP POLICY IF EXISTS "Judges can update own evaluations" ON public.evaluations;
CREATE POLICY "Judges can update own evaluations" ON public.evaluations FOR UPDATE TO public
USING (
  judge_id = (select auth.uid())
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (select auth.uid())
      AND role = 'juez'::user_role
      AND registration_status = 'aprobado'
  )
  AND EXISTS (SELECT 1 FROM event_config WHERE key = 'evaluation_enabled' AND value = 'true')
);
