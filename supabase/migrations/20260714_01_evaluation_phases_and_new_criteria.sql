-- Feria de Ideas 2026: nuevos criterios de evaluación (7) + flujo de dos fases
-- Fase 1 (preclasificacion): todos los proyectos. Fase 2 (final): solo finalistas.
-- Los datos previos de evaluations eran de prueba, se descartan.

-- =========================================================
-- 1. Tabla evaluations: 7 criterios del instructivo + fase
-- =========================================================
DROP VIEW IF EXISTS public.project_leaderboard;
DROP TABLE IF EXISTS public.evaluations CASCADE;

CREATE TABLE public.evaluations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    judge_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    phase text NOT NULL CHECK (phase IN ('preclasificacion', 'final')),
    -- Criterios del INSTRUCTIVO PROCESO DE EVALUACION - FERIA DE IDEAS 2026
    score_problem       smallint NOT NULL CHECK (score_problem BETWEEN 1 AND 10),        -- Identificación del problema u oportunidad
    score_solution      smallint NOT NULL CHECK (score_solution BETWEEN 1 AND 10),       -- Propuesta de solución y generación de valor
    score_innovation    smallint NOT NULL CHECK (score_innovation BETWEEN 1 AND 10),     -- Nivel de innovación
    score_validation    smallint NOT NULL CHECK (score_validation BETWEEN 1 AND 10),     -- Validación realizada
    score_feasibility   smallint NOT NULL CHECK (score_feasibility BETWEEN 1 AND 10),    -- Factibilidad técnica, económica y operativa
    score_impact        smallint NOT NULL CHECK (score_impact BETWEEN 1 AND 10),         -- Impacto potencial
    score_communication smallint NOT NULL CHECK (score_communication BETWEEN 1 AND 10),  -- Calidad de la comunicación y presentación
    feedback text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(project_id, judge_id, phase)
);

CREATE INDEX IF NOT EXISTS idx_evaluations_judge_id ON public.evaluations(judge_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_project_phase ON public.evaluations(project_id, phase);

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 2. Proyectos: marca de finalista
-- =========================================================
ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS is_finalist boolean NOT NULL DEFAULT false;

-- =========================================================
-- 3. Configuración del evento
--    evaluation_phase: cerrada | preclasificacion | deliberacion | final
--    finalists_count: cupo de finalistas (default 10)
-- =========================================================
DELETE FROM public.event_config WHERE key = 'evaluation_enabled';
-- Clave huérfana con nombre viejo (el código usa finalists_count)
DELETE FROM public.event_config WHERE key = 'finalist_count';

INSERT INTO public.event_config (key, value)
VALUES ('evaluation_phase', 'cerrada')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.event_config (key, value)
VALUES ('finalists_count', '10')
ON CONFLICT (key) DO NOTHING;

-- =========================================================
-- 4. Políticas RLS
-- =========================================================
CREATE POLICY "Judges can insert own evaluations" ON public.evaluations
    FOR INSERT TO public
    WITH CHECK (
        judge_id = (select auth.uid())
        AND EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'juez'::user_role)
        -- Solo se puede votar en la fase activa
        AND phase = (SELECT value FROM event_config WHERE key = 'evaluation_phase')
        -- En la fase final solo se votan proyectos finalistas
        AND (
            phase = 'preclasificacion'
            OR EXISTS (SELECT 1 FROM projects WHERE id = project_id AND is_finalist = true)
        )
    );

CREATE POLICY "Judges can update own evaluations" ON public.evaluations
    FOR UPDATE TO public
    USING (
        judge_id = (select auth.uid())
        AND EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'juez'::user_role)
        AND phase = (SELECT value FROM event_config WHERE key = 'evaluation_phase')
    );

CREATE POLICY "Judges can view own evaluations" ON public.evaluations
    FOR SELECT TO public
    USING (judge_id = (select auth.uid()));

CREATE POLICY "Admins can view all evaluations" ON public.evaluations
    FOR SELECT TO public
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role IN ('admin'::user_role, 'superadmin'::user_role)));

-- =========================================================
-- 5. Trigger updated_at
-- =========================================================
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.evaluations
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- =========================================================
-- 6. Leaderboard por fase
--    Cada proyecto aparece una vez por fase (con 0 evaluaciones si nadie votó),
--    así el ranking de preclasificación lista todo y el final lista finalistas.
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
    COALESCE(AVG(e.score_validation), 0)    AS avg_validation,
    COALESCE(AVG(e.score_feasibility), 0)   AS avg_feasibility,
    COALESCE(AVG(e.score_impact), 0)        AS avg_impact,
    COALESCE(AVG(e.score_communication), 0) AS avg_communication,
    COALESCE(AVG(
        e.score_problem + e.score_solution + e.score_innovation + e.score_validation +
        e.score_feasibility + e.score_impact + e.score_communication
    ), 0) AS final_score
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
