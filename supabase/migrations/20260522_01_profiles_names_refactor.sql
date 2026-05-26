-- Migración: 20260522_01_profiles_names_refactor.sql
-- Descripción: Agrega first_name, last_name y professional_title a profiles.
-- Revierte el default de registration_status a 'pendiente'.
-- Crea trigger para sincronizar full_name.
-- Actualiza handle_new_user() para asignar 'pendiente' explícitamente.

-- 1. Agregar columnas a profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS professional_title TEXT;

-- 2. Revertir default de registration_status a 'pendiente'
ALTER TABLE public.profiles
ALTER COLUMN registration_status SET DEFAULT 'pendiente'::registration_status;

-- 3. Crear función de sincronización de full_name
CREATE OR REPLACE FUNCTION public.sync_full_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.first_name IS NOT NULL AND NEW.last_name IS NOT NULL THEN
    NEW.full_name := NEW.first_name || ' ' || NEW.last_name;
  ELSIF NEW.first_name IS NOT NULL THEN
    NEW.full_name := NEW.first_name;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Crear trigger para sincronizar full_name
DROP TRIGGER IF EXISTS trg_sync_full_name ON public.profiles;
CREATE TRIGGER trg_sync_full_name
  BEFORE INSERT OR UPDATE OF first_name, last_name ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_full_name();

-- 5. Actualizar la función handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, registration_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'usuario'),
    'pendiente'
  );
  RETURN NEW;
END;
$$;
