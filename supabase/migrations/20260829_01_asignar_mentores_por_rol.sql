-- 20260829_01_asignar_mentores_por_rol.sql
--
-- REPARTO DE MENTORES POR ROL, UNA SOLA VEZ, SOBRE LOS DOS SLOTS.
--
-- Esto NO arregla assign_mentors_randomly(): es el reparto a mano de esta
-- edición, con la función intacta. A un día del evento, tocar un RPC que el
-- panel llama en vivo es más riesgo que beneficio; el arreglo de la función
-- queda para después de la Hackathon.
--
-- QUÉ ESTABA MAL (auditoría del 2026-08-29 sobre la versión viva de la
-- función, la de 20260824_01_cerrar_rpc_anon.sql):
--
--   1. Llena un solo slot. Escribe únicamente teams.mentor_id. mentor_id_2
--      entró el 22/05 en 20260522_04_dual_mentor_support.sql y la función
--      nunca se actualizó. Todo lo demás sí usa los dos slots: mentoria.astro
--      filtra por ambos, el panel tiene dos selects, mentor_help_stats cuenta
--      los dos. La asignación automática quedó sola en la versión vieja.
--
--   2. Ignora el perfil. La bolsa es `role='mentor' AND registration_status=
--      'aprobado'`, sin mirar disciplinary_profile: cae cualquiera en el único
--      slot que llena.
--
--   3. `reset_current` limpia solo el slot 1, así que lo que se hubiera
--      cargado a mano en el slot 2 sobrevive descoordinado del reparto nuevo.
--
--   4. El equipo que se dobla no es aleatorio: baraja los mentores, pero
--      recorre `SELECT id FROM teams` sin ORDER BY, o sea el orden físico del
--      heap. Con 25 equipos y 24 mentores, el que queda con dos es siempre el
--      mismo lugar de la lista.
--
-- EL MAPEO DE SLOTS es el que ya asume src/pages/mentoria.astro:
--
--     teams.mentor_id    -> slot 1 -> mentor TÉCNICO     (disciplinary_profile = 'tecnico')
--     teams.mentor_id_2  -> slot 2 -> mentor PEDAGÓGICO  (disciplinary_profile = 'docente')
--
-- ⚠️ El slot 1 se lleva los SOS. request_help() resuelve el mentor con
--    `SELECT mentor_id FROM teams`: el pedagógico no recibe tickets. Si eso se
--    quiere al revés, se invierten las dos asignaciones del UPDATE de abajo.
--
-- ⚠️ ESTA MIGRACIÓN PISA LOS DOS SLOTS DE TODOS LOS EQUIPOS. Cualquier ajuste
--    hecho a mano desde el panel antes de aplicarla se pierde. Es el efecto
--    buscado: el reparto sale entero y parejo, no parchado.
--
-- ⚠️ NO ES IDEMPOTENTE EN EL RESULTADO. Aplicarla dos veces sobre la misma
--    base da un sorteo distinto. Las migraciones corren una sola vez por base
--    (supabase_migrations.schema_migrations lo registra), pero si alguien la
--    reaplica a mano, reparte de nuevo.
--
-- SOBRE UNA BASE VACÍA (dev recién levantado, CI) no hace nada: sin equipos el
-- UPDATE toca 0 filas y los asserts de abajo se saltean solos.
--
-- ANTES DE APLICARLA EN PRODUCCIÓN conviene correr el diagnóstico a mano en el
-- SQL Editor, porque el onboarding PERMITE 'otro' como perfil disciplinar a
-- los mentores (el veto de 'otro' es solo para participantes). Un mentor
-- cargado como 'otro' no entra en ninguna bolsa:
--
--   SELECT COALESCE(disciplinary_profile::text, '(sin perfil)') AS perfil,
--          count(*) AS mentores
--   FROM public.profiles
--   WHERE role = 'mentor' AND registration_status = 'aprobado'
--   GROUP BY 1 ORDER BY 1;
--
--   SELECT id, COALESCE(full_name, first_name || ' ' || last_name) AS nombre,
--          email, registration_status, disciplinary_profile
--   FROM public.profiles
--   WHERE role = 'mentor'
--     AND (registration_status <> 'aprobado'
--          OR disciplinary_profile IS NULL
--          OR disciplinary_profile = 'otro')
--   ORDER BY registration_status, nombre;
--
-- Esperado al 2026-08-29: 25 equipos, 24 mentores 'tecnico' y 24 'docente'.
-- Con esos números, un mentor de cada rol se lleva dos equipos y el resto uno.

DO $$
DECLARE
  v_equipos      INT;
  v_tecnicos     INT;
  v_pedagogicos  INT;
  v_sin_slot1    INT;
  v_sin_slot2    INT;
  v_mal_slot1    INT;
  v_mal_slot2    INT;
  v_repetido     INT;
BEGIN
  SELECT count(*) INTO v_equipos FROM public.teams;

  SELECT count(*) INTO v_tecnicos
  FROM public.profiles
  WHERE role = 'mentor'
    AND registration_status = 'aprobado'
    AND disciplinary_profile = 'tecnico';

  SELECT count(*) INTO v_pedagogicos
  FROM public.profiles
  WHERE role = 'mentor'
    AND registration_status = 'aprobado'
    AND disciplinary_profile = 'docente';

  -- Base sin equipos: dev recién levantado o CI. No hay nada que repartir y
  -- no es un error, así que se sale en silencio.
  IF v_equipos = 0 THEN
    RAISE NOTICE 'Sin equipos: no hay nada que repartir.';
    RETURN;
  END IF;

  -- Con una bolsa vacía el reparto saldría a medias y en silencio. Preferimos
  -- que la migración falle entera: el EXCEPTION revierte todo.
  IF v_tecnicos = 0 OR v_pedagogicos = 0 THEN
    RAISE EXCEPTION
      'Faltan mentores aprobados: % con perfil tecnico, % con perfil docente. Revisar disciplinary_profile antes de aplicar.',
      v_tecnicos, v_pedagogicos;
  END IF;

  RAISE NOTICE 'Repartiendo % equipos entre % mentores tecnicos y % pedagogicos.',
    v_equipos, v_tecnicos, v_pedagogicos;

  WITH
  -- MATERIALIZED es obligatorio: sin eso Postgres puede inlinear el CTE y
  -- reevaluar random() en cada referencia, y el mismo equipo sale con dos
  -- números de fila distintos dentro de la misma consulta.
  equipos AS MATERIALIZED (
    SELECT id, row_number() OVER (ORDER BY random()) AS rn
    FROM public.teams
  ),
  tecnicos AS MATERIALIZED (
    SELECT id, row_number() OVER (ORDER BY random()) AS rn
    FROM public.profiles
    WHERE role = 'mentor'
      AND registration_status = 'aprobado'
      AND disciplinary_profile = 'tecnico'
  ),
  pedagogicos AS MATERIALIZED (
    SELECT id, row_number() OVER (ORDER BY random()) AS rn
    FROM public.profiles
    WHERE role = 'mentor'
      AND registration_status = 'aprobado'
      AND disciplinary_profile = 'docente'
  ),
  -- Round-robin sobre un orden aleatorio de las DOS puntas: así el mentor de
  -- cada rol que se lleva el equipo de más también sale sorteado, que es
  -- justo lo que no hacía la función (punto 4 del encabezado).
  reparto AS (
    SELECT
      e.id AS team_id,
      t.id AS tecnico_id,
      p.id AS pedagogico_id
    FROM equipos e
    LEFT JOIN tecnicos t
      ON t.rn = ((e.rn - 1) % (SELECT count(*) FROM tecnicos)) + 1
    LEFT JOIN pedagogicos p
      ON p.rn = ((e.rn - 1) % (SELECT count(*) FROM pedagogicos)) + 1
  )
  UPDATE public.teams AS tm
  SET mentor_id   = r.tecnico_id,
      mentor_id_2 = r.pedagogico_id
  FROM reparto r
  WHERE tm.id = r.team_id;

  -- Verificación. Lo que en el script interactivo se miraba a ojo antes del
  -- COMMIT, acá tiene que ser un assert: nadie está leyendo la salida.
  SELECT
    count(*) FILTER (WHERE t.mentor_id   IS NULL),
    count(*) FILTER (WHERE t.mentor_id_2 IS NULL),
    count(*) FILTER (WHERE m1.disciplinary_profile IS DISTINCT FROM 'tecnico'),
    count(*) FILTER (WHERE m2.disciplinary_profile IS DISTINCT FROM 'docente'),
    count(*) FILTER (WHERE t.mentor_id = t.mentor_id_2)
  INTO v_sin_slot1, v_sin_slot2, v_mal_slot1, v_mal_slot2, v_repetido
  FROM public.teams t
  LEFT JOIN public.profiles m1 ON m1.id = t.mentor_id
  LEFT JOIN public.profiles m2 ON m2.id = t.mentor_id_2;

  IF v_sin_slot1 > 0 OR v_sin_slot2 > 0 THEN
    RAISE EXCEPTION
      'Quedaron equipos sin mentor: % sin slot 1, % sin slot 2.',
      v_sin_slot1, v_sin_slot2;
  END IF;

  IF v_mal_slot1 > 0 OR v_mal_slot2 > 0 THEN
    RAISE EXCEPTION
      'Mentor con el perfil equivocado: % en el slot tecnico, % en el pedagogico.',
      v_mal_slot1, v_mal_slot2;
  END IF;

  -- Las dos bolsas son disjuntas por construcción, así que esto no debería
  -- pasar nunca. Está por si alguien toca los WHERE de arriba.
  IF v_repetido > 0 THEN
    RAISE EXCEPTION
      'Hay % equipo(s) con el mismo mentor en los dos slots.', v_repetido;
  END IF;

  RAISE NOTICE 'Reparto OK: % equipos con mentor tecnico y pedagogico.', v_equipos;
END;
$$;
