-- Institución de pertenencia: permitir escribir el nombre cuando se elige "Otra".
--
-- `profiles.institution` guarda un código fijo ('ies_9023_maipu' | 'ies_edison' | 'otra').
-- Cuando es 'otra', el nombre real de la institución se guarda acá, así el admin
-- ve de qué institución viene cada persona en vez de un genérico "Otra".

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS institution_other text;

COMMENT ON COLUMN public.profiles.institution_other IS
    'Nombre libre de la institución cuando institution = ''otra''. NULL en el resto de los casos.';

-- Coherencia: solo puede haber texto libre si la institución es "otra"
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_institution_other_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_institution_other_check
    CHECK (institution_other IS NULL OR institution = 'otra');
