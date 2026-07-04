-- Las vistas pasan a respetar el RLS del usuario que consulta (security_invoker).
-- Antes, como SECURITY DEFINER, exponían promedios de evaluaciones y stats de
-- mentores a cualquier rol con SELECT, incluido anon.
ALTER VIEW public.project_leaderboard SET (security_invoker = true);
ALTER VIEW public.mentor_help_stats SET (security_invoker = true);

-- Higiene: las vistas agregadas no son actualizables; nadie necesita permisos de escritura.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.project_leaderboard FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.mentor_help_stats FROM anon, authenticated;
