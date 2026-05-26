-- Migración: 20260522_03_team_composition_limits.sql
-- Descripción: Inserta los límites de composición de equipo en event_config.

INSERT INTO public.event_config (key, value, description) VALUES
('max_egresados_per_team', '1', 'Máximo de egresados por equipo'),
('max_tecnicos_per_team', '2', 'Máximo de miembros con perfil técnico por equipo'),
('max_docentes_per_team', '2', 'Máximo de miembros con perfil docente por equipo')
ON CONFLICT (key) DO NOTHING;
