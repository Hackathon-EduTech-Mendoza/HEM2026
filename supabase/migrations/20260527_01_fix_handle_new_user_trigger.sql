-- Fix the handle_new_user trigger function to cast role to user_role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, registration_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    (COALESCE(NEW.raw_user_meta_data->>'role', 'usuario'))::public.user_role,
    'pendiente'
  );
  RETURN NEW;
END;
$$;
