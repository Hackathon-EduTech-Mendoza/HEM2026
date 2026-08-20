-- 20260820_01_enforce_max_participants.sql
--
-- Cupo máximo de participantes: 300. Por espacio y logística la sede no da
-- abasto para más gente.
--
-- ⚠️ DÓNDE VA EL CANDADO Y POR QUÉ NO VA EN EL REGISTRO
--
-- Mentores y jueces se anotan por la MISMA puerta que los participantes: el
-- registro no pide rol, el rol se elige recién en el paso 1 del onboarding. Si
-- el corte estuviera en el alta de la cuenta, dejaría afuera también a mentores
-- y jueces, que no ocupan cupo. Por eso el candado va donde los caminos se
-- bifurcan: al momento de quedar registrado como participante.
--
-- ⚠️ POR QUÉ NO ALCANZA CON DESHABILITAR LA TARJETA EN PANTALLA
--
-- `onboarding.astro` hace un UPDATE directo a `profiles` desde el navegador con
-- la anon key. Cualquiera con la consola abierta se saltea un candado que viva
-- solo en el front. Además, dos personas tomando el lugar 300 al mismo tiempo
-- es una carrera que solo la base puede resolver.
--
-- ⚠️ QUÉ CUENTA COMO "OCUPAR LUGAR"
--
-- Ser participante CON EL PERFIL COMPLETO. La columna `role` tiene
-- DEFAULT 'usuario', así que un registro que nunca terminó el onboarding figura
-- como participante sin haberlo elegido: contarlo acá bloquearía el cupo con
-- gente que quizá termine siendo mentor, o que no vuelve nunca.
--
-- El aviso público del sitio (`/api/cupo`) SÍ los cuenta, a pedido de Martín,
-- para mostrar el peor caso. O sea que el cartel va a decir "completo" un poco
-- antes de que este trigger empiece a rechazar. Es a propósito y es el lado
-- conservador: nadie que se anote viendo el cartel se queda afuera.

-- El tope vive en event_config para poder moverlo sin deploy, igual que
-- min_team_size.
INSERT INTO public.event_config (key, value, description)
VALUES (
  'max_participants',
  '300',
  'Cupo máximo de participantes con perfil completo. 0 o vacío = sin límite.'
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enforce_max_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_max           INT;
  v_actuales      INT;
  v_actor_role    public.user_role;
  v_ocupa_ahora   BOOLEAN;
  v_ocupaba_antes BOOLEAN;
BEGIN
  -- Ocupa lugar quien queda como participante con nombre y apellido cargados.
  -- Mismo criterio que `isProfileComplete` en src/utils/perfil.ts.
  v_ocupa_ahora := (
    NEW.role = 'usuario'
    AND COALESCE(BTRIM(NEW.first_name), '') <> ''
    AND COALESCE(BTRIM(NEW.last_name), '') <> ''
  );

  -- Mentores, jueces y staff no tocan el cupo, ni al crearse ni al editarse.
  IF NOT v_ocupa_ahora THEN
    RETURN NEW;
  END IF;

  -- Quien YA estaba adentro puede seguir editando su perfil sin volver a pedir
  -- lugar. Sin esto, con el cupo lleno nadie podría corregirse un apellido.
  IF TG_OP = 'UPDATE' THEN
    v_ocupaba_antes := (
      OLD.role = 'usuario'
      AND COALESCE(BTRIM(OLD.first_name), '') <> ''
      AND COALESCE(BTRIM(OLD.last_name), '') <> ''
    );

    IF v_ocupaba_antes THEN
      RETURN NEW;
    END IF;
  END IF;

  -- El admin puede seguir dando de alta a mano por encima del tope (una
  -- inscripción presencial, un caso puntual). Es la palanca de destrabe.
  IF auth.uid() IS NOT NULL THEN
    v_actor_role := public.get_user_role();
    IF v_actor_role IN ('admin', 'superadmin') THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT COALESCE(
    (SELECT NULLIF(regexp_replace(value, '\D', '', 'g'), '')::INT
       FROM public.event_config WHERE key = 'max_participants'),
    300
  ) INTO v_max;

  -- 0 (o el registro borrado) = sin límite. Es cómo se apaga el cupo sin tener
  -- que borrar el trigger.
  IF v_max <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_actuales
  FROM public.profiles
  WHERE role = 'usuario'
    AND COALESCE(BTRIM(first_name), '') <> ''
    AND COALESCE(BTRIM(last_name), '') <> ''
    AND id <> NEW.id;

  IF v_actuales >= v_max THEN
    RAISE EXCEPTION
      '[max_participants] El cupo de participantes está completo (% de %). Escribinos si necesitás un lugar.',
      v_actuales, v_max
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_max_participants ON public.profiles;

CREATE TRIGGER trg_enforce_max_participants
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_participants();

COMMENT ON FUNCTION public.enforce_max_participants() IS
  'Cupo de participantes (event_config.max_participants). Cuenta solo participantes con perfil completo; mentores, jueces y staff quedan afuera del cupo. El admin puede pasarse del tope a mano.';
