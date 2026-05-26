-- Migración: 20260522_02_auto_approve_trigger.sql
-- Descripción: Implementa el trigger de auto-aprobación condicional.
-- Solo aprueba a usuarios con rol 'usuario' (participante) si completaron DNI e institución.
-- Jueces y mentores quedan en revisión manual ('pendiente').

-- 1. Eliminar trigger y función anteriores si existen
DROP TRIGGER IF EXISTS trg_auto_approve ON public.profiles;
DROP FUNCTION IF EXISTS public.auto_approve_participant();

-- 2. Crear función de auto-aprobación condicional
CREATE OR REPLACE FUNCTION public.auto_approve_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'usuario'
     AND NEW.dni IS NOT NULL
     AND NEW.institution IS NOT NULL
  THEN
    NEW.registration_status := 'aprobado';
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Crear trigger para la auto-aprobación condicional
DROP TRIGGER IF EXISTS trg_auto_approve ON public.profiles;
CREATE TRIGGER trg_auto_approve
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_approve_participant();
