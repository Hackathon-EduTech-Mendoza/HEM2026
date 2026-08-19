-- Migración: 20260819_03_min_team_size_solo_insert.sql
-- Descripción: el trigger del mínimo pasa a dispararse SOLO en INSERT.
--
-- POR QUÉ
-- `20260819_01` lo dejó en `BEFORE INSERT OR UPDATE`. Eso hacía cumplir la regla,
-- pero abría una trampa que en el evento iba a doler:
--
--   El equipo de 3 entrega a las 22:00 → a las 23:30 alguien abandona (nada se lo
--   impide: `leave_team` no valida nada) → el líder queda en 2 y **ya no puede
--   corregir ni un typo de su propia entrega**. Encima el cartel le decía
--   "Todavía no pueden entregar", cuando en realidad ya había entregado.
--
-- Es decir: castigaba a un equipo que cumplió al momento de entregar, por algo
-- que pasó después y que no controla.
--
-- La regla que pidió la organización es **"un equipo de 1 o 2 no puede entregar"**,
-- y eso se cumple bloqueando la creación de la entrega. `ProjectSubmission.astro`
-- usa `upsert(..., { onConflict: 'team_id' })`: sin fila previa es un INSERT, que
-- queda bloqueado; con fila previa es un UPDATE, que ahora pasa. Un equipo por
-- debajo del mínimo nunca llega a tener proyecto.
--
-- Contrapartida asumida: un equipo que entregó válidamente y después se achica
-- conserva su entrega y puede editarla. Es deliberado — quién compite lo decide
-- la organización mirando el panel, no un trigger a las 23:55.
--
-- La función NO cambia: sigue igual que en `20260819_01` (con el corte de equipo
-- ajeno, el cast protegido y el bypass de staff). Solo cambia cuándo se dispara.

DROP TRIGGER IF EXISTS trg_enforce_min_team_size ON public.projects;

CREATE TRIGGER trg_enforce_min_team_size
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_min_team_size();

COMMENT ON FUNCTION public.enforce_min_team_size() IS
  'Bloquea la CREACIÓN de la entrega de equipos por debajo de event_config.min_team_size. Solo INSERT: un equipo que ya entregó puede seguir editando aunque se achique. Admin y superadmin quedan exceptuados.';
