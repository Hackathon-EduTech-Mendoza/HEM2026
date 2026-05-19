-- Migración: Auto-aprobación de registro
-- Pivote: ya no se requiere aprobación manual del admin para participantes.
-- Los nuevos signups se aprueban automáticamente al completar el onboarding.

-- 1. Cambiar default de registration_status a 'aprobado'
ALTER TABLE public.profiles
ALTER COLUMN registration_status SET DEFAULT 'aprobado'::registration_status;

-- 2. Aprobar masivamente a quienes ya completaron su perfil pero quedaron como pendientes
-- (No toca rechazados ni usuarios sin perfil completo)
UPDATE public.profiles
SET registration_status = 'aprobado'
WHERE registration_status = 'pendiente'
  AND dni IS NOT NULL
  AND institution IS NOT NULL;

-- Nota: El trigger handle_new_user() no setea registration_status explícitamente,
-- por lo que usará el nuevo default 'aprobado' de la columna automáticamente.
-- No se requiere modificar el trigger.
