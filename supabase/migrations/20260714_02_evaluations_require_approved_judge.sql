-- Seguridad: un juez con inscripción pendiente/rechazada no puede votar.
-- Las políticas originales solo chequeaban role = 'juez'.
-- (Detectado por el test E2E: un juez recién registrado, aún sin aprobar,
--  podía insertar evaluaciones vía API.)

DROP POLICY IF EXISTS "Judges can insert own evaluations" ON public.evaluations;
CREATE POLICY "Judges can insert own evaluations" ON public.evaluations
    FOR INSERT TO public
    WITH CHECK (
        judge_id = (select auth.uid())
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = (select auth.uid())
              AND role = 'juez'::user_role
              AND registration_status = 'aprobado'
        )
        AND phase = (SELECT value FROM event_config WHERE key = 'evaluation_phase')
        AND (
            phase = 'preclasificacion'
            OR EXISTS (SELECT 1 FROM projects WHERE id = project_id AND is_finalist = true)
        )
    );

DROP POLICY IF EXISTS "Judges can update own evaluations" ON public.evaluations;
CREATE POLICY "Judges can update own evaluations" ON public.evaluations
    FOR UPDATE TO public
    USING (
        judge_id = (select auth.uid())
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = (select auth.uid())
              AND role = 'juez'::user_role
              AND registration_status = 'aprobado'
        )
        AND phase = (SELECT value FROM event_config WHERE key = 'evaluation_phase')
    );
