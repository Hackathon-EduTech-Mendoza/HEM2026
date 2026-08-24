-- 20260824_03_cupo_cuenta_registros.sql
--
-- EL CUPO PASA A CONTAR REGISTROS, NO PERFILES COMPLETOS.
--
-- Decisión de Martín, 2026-08-24. Hasta acá `enforce_max_participants` contaba
-- solo participantes CON el perfil completo, con este razonamiento: un registro
-- que nunca terminó el onboarding quizá termine siendo mentor, o no vuelve
-- nunca, así que no debía trabar el cupo.
--
-- A cuatro días del evento eso ya no se sostiene. Esa gente NO es ruido: son
-- cuentas reales que van a completar el perfil el día de la jornada, con la
-- persona parada en la puerta de la sede. Su lugar está ocupado desde que se
-- anotaron, y la logística (espacio, sillas, viandas) tiene que contarlos.
--
-- Al 24/08 eso son 255 completos + 50 sin completar = 305 sobre un tope de 300:
-- aplicar esta migración CIERRA LA INSCRIPCIÓN DE PARTICIPANTES EN EL ACTO.
-- Es el efecto buscado, no un daño colateral.
--
-- ⚠️ LOS 305 QUE YA ESTÁN NO SE VEN AFECTADOS, Y SALE GRATIS
--
-- No hace falta ninguna lista de excepciones ni una fecha de corte. Con la
-- definición nueva, una fila `usuario` incompleta YA OCUPA lugar antes del
-- UPDATE, así que la cláusula `v_ocupaba_antes` de abajo la exime sola: los 50
-- pueden completar su onboarding el viernes aunque el cupo esté pasado. Esa
-- cláusula existía para que nadie quedara sin poder corregirse un apellido con
-- el cupo lleno; acá pasa a ser, además, el grandfather de los incompletos.
--
-- ⚠️ ESTO CIERRA EL ALTA DE CUENTA, NO SOLO LA ELECCIÓN DE ROL
--
-- `handle_new_user` inserta todo perfil nuevo con `role = 'usuario'` (es el
-- DEFAULT y el signup no pide rol). Con el cupo lleno, entonces, este trigger
-- ahora hace fallar el INSERT y con él TODO el signup público.
--
-- Por eso `registro.astro` pasa a mandar el rol en el signUp: quien entra por
-- /registro?rol=mentor (o juez) nace con ese rol, no ocupa cupo y sigue
-- pudiendo crear la cuenta. La puerta de mentores y jueces queda abierta.
--
-- ⚠️ Y esa puerta NO es un agujero para colarse al cupo: si alguien se anota
-- como mentor y después intenta pasarse a participante, cae en el camino de
-- abajo con OLD.role = 'mentor' (no ocupaba antes) y el conteo lo rechaza.
-- La invariante la sostiene este trigger, no el formulario.

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
  -- Ocupa lugar TODO participante, tenga o no el perfil completo.
  -- (Antes se exigía además nombre y apellido cargados.)
  v_ocupa_ahora := (NEW.role = 'usuario');

  -- Mentores, jueces y staff no tocan el cupo, ni al crearse ni al editarse.
  IF NOT v_ocupa_ahora THEN
    RETURN NEW;
  END IF;

  -- Quien YA estaba adentro sigue adentro: puede completar el onboarding o
  -- corregir sus datos aunque el cupo esté lleno. Es lo que protege a los 50
  -- registros sin completar que llegan el día del evento.
  IF TG_OP = 'UPDATE' THEN
    v_ocupaba_antes := (OLD.role = 'usuario');

    IF v_ocupaba_antes THEN
      RETURN NEW;
    END IF;
  END IF;

  -- El admin puede seguir dando de alta a mano por encima del tope (una
  -- inscripción presencial, un caso puntual). Es la palanca de destrabe, y
  -- ahora también la vía para sumar un mentor o un juez de último momento.
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

  -- El mismo criterio que `/api/cupo` usa para el cartel: participantes a
  -- secas. Los dos números tienen que coincidir o el sitio vuelve a prometer
  -- lugares que la base rechaza.
  SELECT COUNT(*) INTO v_actuales
  FROM public.profiles
  WHERE role = 'usuario'
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

-- El trigger ya existe desde 20260820_01 y no cambia de forma; se recrea igual
-- para que esta migración sea autosuficiente si se corre sobre una base limpia.
DROP TRIGGER IF EXISTS trg_enforce_max_participants ON public.profiles;

CREATE TRIGGER trg_enforce_max_participants
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_participants();

COMMENT ON FUNCTION public.enforce_max_participants() IS
  'Cupo de participantes (event_config.max_participants). Cuenta TODO perfil con role=usuario, complete o no (Martín, 24/08): el que se anotó ya ocupa lugar. Quien ya era usuario puede seguir editando y completar su onboarding. Mentores, jueces y staff no ocupan cupo. El admin puede pasarse del tope a mano.';
