-- Rúbrica dependiente de la fase: en preclasificación no se puntúa el pitch.
--
-- Motivo (pedido de Martín, reunión del 2026-07-30): en la preclasificación los
-- jueces recorren proyecto por proyecto puntuando el material entregado. No hay
-- presentación en vivo, así que "Comunicación y pitch" no mide nada real. En la
-- ronda final, donde sí hay pitch, la rúbrica queda como estaba.
--
-- El 15% del criterio se reparte en partes iguales entre los otros cinco (+3%):
--
--   Criterio       Preclasificación   Final
--   problema             18%           15%
--   solución             23%           20%
--   innovación           18%           15%
--   factibilidad         23%           20%
--   impacto              18%           15%
--   comunicación      (no se puntúa)   15%
--
-- Ambas fases siguen normalizando a 100, así que los puntajes son comparables.
-- Los pesos deben coincidir con src/lib/rubric.ts.

DROP VIEW IF EXISTS public.project_leaderboard;

-- =========================================================
-- 1. score_communication pasa a ser opcional
-- =========================================================
ALTER TABLE public.evaluations
    ALTER COLUMN score_communication DROP NOT NULL;

-- =========================================================
-- 2. Coherencia entre fase y criterio
--    La regla vive en la base para que un voto incoherente no entre
--    aunque el formulario falle.
-- =========================================================
ALTER TABLE public.evaluations
    DROP CONSTRAINT IF EXISTS evaluations_communication_by_phase_check;

ALTER TABLE public.evaluations
    ADD CONSTRAINT evaluations_communication_by_phase_check CHECK (
        (phase = 'preclasificacion' AND score_communication IS NULL)
        OR
        (phase = 'final' AND score_communication IS NOT NULL)
    );

-- =========================================================
-- 3. Leaderboard: pesos y suma directa según la fase
--    raw_score: 0 a 25 en preclasificación (5 criterios), 0 a 30 en la final.
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
    -- Suma directa de los promedios, sin pesos (referencia, no ordena)
    COALESCE(AVG(
        e.score_problem + e.score_solution + e.score_innovation +
        e.score_feasibility + e.score_impact +
        CASE WHEN ph.phase = 'final' THEN e.score_communication ELSE 0 END
    ), 0) AS raw_score,
    -- Puntaje ponderado normalizado a 100: ordena el ranking
    CASE ph.phase
        WHEN 'preclasificacion' THEN (
            COALESCE(AVG(e.score_problem), 0)     * 0.18 +
            COALESCE(AVG(e.score_solution), 0)    * 0.23 +
            COALESCE(AVG(e.score_innovation), 0)  * 0.18 +
            COALESCE(AVG(e.score_feasibility), 0) * 0.23 +
            COALESCE(AVG(e.score_impact), 0)      * 0.18
        ) / 5 * 100
        ELSE (
            COALESCE(AVG(e.score_problem), 0)       * 0.15 +
            COALESCE(AVG(e.score_solution), 0)      * 0.20 +
            COALESCE(AVG(e.score_innovation), 0)    * 0.15 +
            COALESCE(AVG(e.score_feasibility), 0)   * 0.20 +
            COALESCE(AVG(e.score_impact), 0)        * 0.15 +
            COALESCE(AVG(e.score_communication), 0) * 0.15
        ) / 5 * 100
    END AS final_score
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
