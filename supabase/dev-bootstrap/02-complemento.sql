-- Complemento del dump de esquema de HEM-Prod.
-- El dump de `supabase db dump` cubre solo el esquema public, así que esto
-- agrega lo que queda afuera y sin lo cual la app no arranca en dev.
-- Generado desde prod el 2026-07-30. NO contiene datos personales.

-- ──────────────────────────────────────────────────────────────
-- 1. Trigger sobre auth.users  ⚠️ LO MÁS IMPORTANTE
-- ──────────────────────────────────────────────────────────────
-- Sin esto el signup crea la cuenta de auth pero NUNCA la fila en profiles:
-- la suite E2E muere en el primer test y el onboarding queda colgado.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ──────────────────────────────────────────────────────────────
-- 2. event_config: las 18 claves de configuración
-- ──────────────────────────────────────────────────────────────
-- Son parámetros del evento, no datos de personas. Sin esto el admin y el
-- panel de evaluación leen null y se comportan de forma impredecible.
INSERT INTO public.event_config (key, value) VALUES
  ('evaluation_phase', 'cerrada'),
  ('event_edition', '2'),
  ('event_name', 'Hackathon EduTech Mendoza 2026'),
  ('event_start_datetime', '2026-06-03T21:30:00-03:00'),
  ('finalists_count', '10'),
  ('help_cooldown_minutes', '5'),
  ('help_enabled', 'false'),
  ('max_docentes_per_team', '2'),
  ('max_egresados_per_team', '1'),
  ('max_team_size', '5'),
  ('max_tecnicos_per_team', '2'),
  ('mentor_session_duration', '15'),
  ('min_team_size', '3'),
  ('pitch_duration_minutes', '3'),
  ('pitch_qa_duration_minutes', '3'),
  ('project_submission_enabled', 'true'),
  ('submission_deadline', '2026-06-06T14:00:00-03:00'),
  ('teams_enabled', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ──────────────────────────────────────────────────────────────
-- 3. Cron job de expiración de pedidos de ayuda
-- ──────────────────────────────────────────────────────────────
-- Hoy help_enabled = false, así que en dev es opcional. Se deja para que el
-- esquema sea equivalente al de prod.
SELECT cron.schedule(
  'expire-stale-help-requests',
  '*/5 * * * *',
  $job$
  UPDATE public.help_requests
  SET status = 'expirado'
  WHERE status = 'pendiente'
    AND created_at < now() - interval '30 minutes';

  UPDATE public.help_requests
  SET status = 'expirado'
  WHERE status = 'en_camino'
    AND started_at < now() - interval '60 minutes';
  $job$
);
