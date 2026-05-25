-- Migración: 20260522_04_dual_mentor_support.sql
-- Descripción: Agrega soporte para un segundo mentor en la tabla teams y actualiza la vista de métricas.

-- 1. Agregar el segundo mentor a la tabla teams
ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS mentor_id_2 UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Eliminar la vista si existe y volver a crearla para evitar restricciones de reemplazo
DROP VIEW IF EXISTS public.mentor_help_stats;

CREATE VIEW public.mentor_help_stats AS
SELECT
  p.id                     AS mentor_id,
  p.full_name              AS mentor_name,
  COUNT(hr.id)             AS total_tickets,
  COUNT(hr.id) FILTER (WHERE hr.status = 'pendiente')  AS pending_count,
  COUNT(hr.id) FILTER (WHERE hr.status = 'en_camino')  AS in_progress_count,
  COUNT(hr.id) FILTER (WHERE hr.status = 'finalizado') AS finished_count,
  COUNT(hr.id) FILTER (WHERE hr.status = 'expirado')   AS expired_count,
  COALESCE(
    ROUND(
      AVG(
        EXTRACT(EPOCH FROM (hr.started_at - hr.created_at)) / 60
      ) FILTER (WHERE hr.started_at IS NOT NULL)
    , 1
    ), 0
  ) AS avg_response_minutes,
  COALESCE(
    ROUND(
      AVG(
        EXTRACT(EPOCH FROM (hr.finished_at - hr.started_at)) / 60
      ) FILTER (WHERE hr.finished_at IS NOT NULL AND hr.started_at IS NOT NULL)
    , 1
    ), 0
  ) AS avg_session_minutes,
  (SELECT COUNT(*) FROM teams t WHERE t.mentor_id = p.id OR t.mentor_id_2 = p.id) AS assigned_teams
FROM
  public.profiles p
LEFT JOIN
  public.help_requests hr ON hr.mentor_id = p.id
WHERE
  p.role = 'mentor' AND p.registration_status = 'aprobado'
GROUP BY
  p.id, p.full_name;
