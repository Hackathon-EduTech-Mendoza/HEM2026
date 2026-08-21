-- Migración: 20260821_01_team_size_5.sql
-- Descripción: fija el equipo en 5 integrantes exactos y la composición en
-- 2 o 3 perfiles docentes + 2 o 3 técnicos.
--
-- Confirmado por Martín el 2026-08-21. Reemplaza el "mínimo 3, máximo 5" del
-- Art. 6º original de las Bases: ahora el equipo es de 5, no menos.
--
-- Es puro cambio de datos: no se toca ni el RPC `join_team` (que ya lee
-- `max_team_size` y los máximos por perfil) ni el trigger
-- `trg_enforce_min_team_size` (que ya lee `min_team_size`). Subiendo estos
-- valores, las dos reglas que ya existen empiezan a hacer cumplir lo nuevo:
--
--   · `min_team_size = 5` → el trigger rechaza la CREACIÓN de la entrega de un
--     equipo con menos de 5. Ojo: cuenta filas de `profiles.team_id`, no
--     asistencia — un equipo armado con 5 al que le falta alguien el sábado
--     entrega igual. Admin y superadmin siguen exceptuados como destrabe.
--   · `max_tecnicos_per_team = 3` y `max_docentes_per_team = 3` → `join_team`
--     bloquea al cuarto perfil de un mismo tipo.
--
-- ⚠️ Lo que NO se valida: el MÍNIMO de 2 técnicos y 2 docentes. Decisión
-- explícita del 21/08 — un equipo de 5 con 4 técnicos y 1 docente entra igual.
-- La composición la garantiza la organización al armar los grupos, no un
-- trigger que pueda trabar una entrega el día del evento.
--
-- En prod los máximos por perfil YA estaban en 3 (se movieron a mano en algún
-- momento; el seed 20260522_03 los dejó en 2). En dev estaban en 2. El UPDATE
-- deja las dos bases iguales.

UPDATE public.event_config
SET value = '5',
    description = 'Minimo de integrantes por equipo'
WHERE key = 'min_team_size';

UPDATE public.event_config
SET value = '5',
    description = 'Maximo de integrantes por equipo'
WHERE key = 'max_team_size';

UPDATE public.event_config
SET value = '3',
    description = 'Maximo de miembros con perfil tecnico por equipo'
WHERE key = 'max_tecnicos_per_team';

UPDATE public.event_config
SET value = '3',
    description = 'Maximo de miembros con perfil docente por equipo'
WHERE key = 'max_docentes_per_team';
