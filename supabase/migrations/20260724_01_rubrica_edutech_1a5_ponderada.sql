-- Rúbrica EduTech: escala 1 a 5, sin criterio de validación, puntaje ponderado.
--
-- Cambios respecto de 20260714_01:
--   1. Se elimina `score_validation`: en 3 días de hackathon los equipos no
--      alcanzan a validar la propuesta con usuarios reales (pedido del admin
--      del concurso).
--   2. La escala pasa de 1-10 a 1-5, igual que el formulario de jurado de
--      Emprende U. Las evaluaciones ya cargadas se reescalan (no se pierden).
--   3. El leaderboard expone DOS puntajes para poder comparar formatos:
--      - `raw_score`   : suma directa de los 6 promedios (0 a 30).
--      - `final_score` : puntaje ponderado normalizado a 100 (ordena el ranking).
--
-- Los pesos deben coincidir con src/lib/rubric.ts.

DROP VIEW IF EXISTS public.project_leaderboard;

-- =========================================================
-- 1. Quitar los CHECK de la escala 1-10
-- =========================================================
ALTER TABLE public.evaluations
    DROP CONSTRAINT IF EXISTS evaluations_score_problem_check,
    DROP CONSTRAINT IF EXISTS evaluations_score_solution_check,
    DROP CONSTRAINT IF EXISTS evaluations_score_innovation_check,
    DROP CONSTRAINT IF EXISTS evaluations_score_validation_check,
    DROP CONSTRAINT IF EXISTS evaluations_score_feasibility_check,
    DROP CONSTRAINT IF EXISTS evaluations_score_impact_check,
    DROP CONSTRAINT IF EXISTS evaluations_score_communication_check;

-- =========================================================
-- 2. Reescalar 1-10 -> 1-5 y eliminar el criterio de validación
--    El bloque solo corre si el esquema todavía es el viejo (idempotente).
--    Mapeo: 1-2 -> 1, 3-4 -> 2, 5-6 -> 3, 7-8 -> 4, 9-10 -> 5
-- =========================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'evaluations'
          AND column_name = 'score_validation'
    ) THEN
        UPDATE public.evaluations SET
            score_problem       = CEIL(score_problem / 2.0)::smallint,
            score_solution      = CEIL(score_solution / 2.0)::smallint,
            score_innovation    = CEIL(score_innovation / 2.0)::smallint,
            score_feasibility   = CEIL(score_feasibility / 2.0)::smallint,
            score_impact        = CEIL(score_impact / 2.0)::smallint,
            score_communication = CEIL(score_communication / 2.0)::smallint;

        ALTER TABLE public.evaluations DROP COLUMN score_validation;
    END IF;
END $$;

-- =========================================================
-- 3. Nuevos CHECK de la escala 1-5
-- =========================================================
ALTER TABLE public.evaluations
    ADD CONSTRAINT evaluations_score_problem_check       CHECK (score_problem BETWEEN 1 AND 5),
    ADD CONSTRAINT evaluations_score_solution_check      CHECK (score_solution BETWEEN 1 AND 5),
    ADD CONSTRAINT evaluations_score_innovation_check    CHECK (score_innovation BETWEEN 1 AND 5),
    ADD CONSTRAINT evaluations_score_feasibility_check   CHECK (score_feasibility BETWEEN 1 AND 5),
    ADD CONSTRAINT evaluations_score_impact_check        CHECK (score_impact BETWEEN 1 AND 5),
    ADD CONSTRAINT evaluations_score_communication_check CHECK (score_communication BETWEEN 1 AND 5);

-- =========================================================
-- 4. Leaderboard por fase, con puntaje directo y ponderado
--    Pesos: problema 15 / solución 20 / innovación 15 /
--           factibilidad 20 / impacto 15 / comunicación 15
-- =========================================================
CREATE VIEW public.project_leaderboard AS
SELECT
    p.id AS project_id,
    p.title,
    t.name AS team_name,
    p.is_finalist,
    ph.phase,
    COUNT(e.id) AS evaluations_count,
    COALESCE(AVG(e.score_problem), 0)       AS avg_problem,
    COALESCE(AVG(e.score_solution), 0)      AS avg_solution,
    COALESCE(AVG(e.score_innovation), 0)    AS avg_innovation,
    COALESCE(AVG(e.score_feasibility), 0)   AS avg_feasibility,
    COALESCE(AVG(e.score_impact), 0)        AS avg_impact,
    COALESCE(AVG(e.score_communication), 0) AS avg_communication,
    -- Suma directa de los promedios (0 a 30), formato "1 a 5 sin pesos"
    COALESCE(AVG(
        e.score_problem + e.score_solution + e.score_innovation +
        e.score_feasibility + e.score_impact + e.score_communication
    ), 0) AS raw_score,
    -- Puntaje ponderado normalizado a 100: ordena el ranking
    (
        COALESCE(AVG(e.score_problem), 0)       * 0.15 +
        COALESCE(AVG(e.score_solution), 0)      * 0.20 +
        COALESCE(AVG(e.score_innovation), 0)    * 0.15 +
        COALESCE(AVG(e.score_feasibility), 0)   * 0.20 +
        COALESCE(AVG(e.score_impact), 0)        * 0.15 +
        COALESCE(AVG(e.score_communication), 0) * 0.15
    ) / 5 * 100 AS final_score
FROM
    public.projects p
CROSS JOIN
    (VALUES ('preclasificacion'), ('final')) AS ph(phase)
LEFT JOIN
    public.teams t ON p.team_id = t.id
LEFT JOIN
    public.evaluations e ON e.project_id = p.id AND e.phase = ph.phase
GROUP BY
    p.id, p.title, t.name, p.is_finalist, ph.phase
ORDER BY
    final_score DESC;

-- La vista debe respetar RLS del consultante (ver migración views_security_invoker)
ALTER VIEW public.project_leaderboard SET (security_invoker = true);
