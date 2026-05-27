-- 1. Faltan Índices en Foreign Keys (Performance)
CREATE INDEX IF NOT EXISTS idx_evaluations_judge_id ON public.evaluations(judge_id);
CREATE INDEX IF NOT EXISTS idx_teams_leader_id ON public.teams(leader_id);
CREATE INDEX IF NOT EXISTS idx_teams_mentor_id ON public.teams(mentor_id);
CREATE INDEX IF NOT EXISTS idx_teams_mentor_id_2 ON public.teams(mentor_id_2);

-- 2. Consolidar Políticas Permisivas Administrativas
DROP POLICY IF EXISTS superadmin_all_profiles ON public.profiles;
DROP POLICY IF EXISTS admin_select_profiles ON public.profiles;
DROP POLICY IF EXISTS admin_update_profiles ON public.profiles;
CREATE POLICY "staff_all_profiles" ON public.profiles AS PERMISSIVE FOR ALL TO public
USING ((select get_user_role()) IN ('admin'::user_role, 'superadmin'::user_role));

DROP POLICY IF EXISTS superadmin_all_teams ON public.teams;
DROP POLICY IF EXISTS admin_all_teams ON public.teams;
CREATE POLICY "staff_all_teams" ON public.teams AS PERMISSIVE FOR ALL TO public
USING ((select get_user_role()) IN ('admin'::user_role, 'superadmin'::user_role));

DROP POLICY IF EXISTS superadmin_all_projects ON public.projects;
DROP POLICY IF EXISTS admin_all_projects ON public.projects;
CREATE POLICY "staff_all_projects" ON public.projects AS PERMISSIVE FOR ALL TO public
USING ((select get_user_role()) IN ('admin'::user_role, 'superadmin'::user_role));

DROP POLICY IF EXISTS superadmin_all_event_config ON public.event_config;
DROP POLICY IF EXISTS admin_all_event_config ON public.event_config;
CREATE POLICY "staff_all_event_config" ON public.event_config AS PERMISSIVE FOR ALL TO public
USING ((select get_user_role()) IN ('admin'::user_role, 'superadmin'::user_role));

DROP POLICY IF EXISTS superadmin_all_editions ON public.editions;
DROP POLICY IF EXISTS admin_all_editions ON public.editions;
CREATE POLICY "staff_all_editions" ON public.editions AS PERMISSIVE FOR ALL TO public
USING ((select get_user_role()) IN ('admin'::user_role, 'superadmin'::user_role));

DROP POLICY IF EXISTS superadmin_all_edition_projects ON public.edition_projects;
DROP POLICY IF EXISTS admin_all_edition_projects ON public.edition_projects;
CREATE POLICY "staff_all_edition_projects" ON public.edition_projects AS PERMISSIVE FOR ALL TO public
USING ((select get_user_role()) IN ('admin'::user_role, 'superadmin'::user_role));

-- 3. Refactorizar auth.uid() a (select auth.uid()) para forzar InitPlan

-- help_requests
DROP POLICY IF EXISTS team_members_read_own_help_requests ON public.help_requests;
CREATE POLICY team_members_read_own_help_requests ON public.help_requests FOR SELECT TO authenticated
USING (team_id = (SELECT p.team_id FROM public.profiles p WHERE p.id = (select auth.uid())));

DROP POLICY IF EXISTS mentors_read_assigned_help_requests ON public.help_requests;
CREATE POLICY mentors_read_assigned_help_requests ON public.help_requests FOR SELECT TO authenticated
USING (mentor_id = (select auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.role = 'mentor'::user_role));

DROP POLICY IF EXISTS admins_read_all_help_requests ON public.help_requests;
CREATE POLICY admins_read_all_help_requests ON public.help_requests FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.role IN ('admin'::user_role, 'superadmin'::user_role)));

-- evaluations
DROP POLICY IF EXISTS "Judges can insert own evaluations" ON public.evaluations;
CREATE POLICY "Judges can insert own evaluations" ON public.evaluations FOR INSERT TO public
WITH CHECK (
  judge_id = (select auth.uid()) 
  AND EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'juez'::user_role)
  AND EXISTS (SELECT 1 FROM event_config WHERE key = 'evaluation_enabled' AND value = 'true')
);

DROP POLICY IF EXISTS "Judges can update own evaluations" ON public.evaluations;
CREATE POLICY "Judges can update own evaluations" ON public.evaluations FOR UPDATE TO public
USING (
  judge_id = (select auth.uid()) 
  AND EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'juez'::user_role)
  AND EXISTS (SELECT 1 FROM event_config WHERE key = 'evaluation_enabled' AND value = 'true')
);

DROP POLICY IF EXISTS "Judges can view own evaluations" ON public.evaluations;
CREATE POLICY "Judges can view own evaluations" ON public.evaluations FOR SELECT TO public
USING (judge_id = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can view all evaluations" ON public.evaluations;
CREATE POLICY "Admins can view all evaluations" ON public.evaluations FOR SELECT TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role IN ('admin'::user_role, 'superadmin'::user_role)));

-- 4. Fix search_path on functions
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
