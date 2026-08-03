-- Canal de consultas públicas.
--
-- Motivo (pedido de Martín, 2026-08-03): se dio de baja el WhatsApp del evento y
-- hace falta un espacio visible donde los interesados puedan escribir. Lo que
-- llega se guarda acá y además se avisa por mail, para que una consulta no se
-- pierda si el envío falla.
--
-- ⚠️ La tabla NO tiene policy de INSERT: nadie escribe por PostgREST, ni
-- siquiera anon. El único camino de entrada es POST /api/consulta, que valida,
-- aplica el honeypot y el rate limit, y escribe con la service role key (que
-- saltea RLS). Si algún día se agrega una policy de INSERT para anon, el
-- formulario queda expuesto a que lo carguen sin pasar por esas defensas.

CREATE TABLE IF NOT EXISTS public.consultas (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre       text NOT NULL,
    email        text NOT NULL,
    mensaje      text NOT NULL,
    estado       text NOT NULL DEFAULT 'nueva',
    -- Contexto del envío, para poder rastrear abuso sin guardar la IP en claro.
    origen       text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    responded_at timestamptz,
    responded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

    CONSTRAINT consultas_nombre_check  CHECK (char_length(btrim(nombre)) BETWEEN 2 AND 120),
    CONSTRAINT consultas_email_check   CHECK (char_length(email) <= 254 AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    CONSTRAINT consultas_mensaje_check CHECK (char_length(btrim(mensaje)) BETWEEN 10 AND 2000),
    CONSTRAINT consultas_estado_check  CHECK (estado IN ('nueva', 'respondida', 'archivada')),
    -- Una consulta respondida tiene que decir cuándo: si no, el listado del
    -- admin no puede distinguir lo atendido de lo que solo se marcó.
    CONSTRAINT consultas_respondida_check CHECK (
        (estado = 'respondida' AND responded_at IS NOT NULL)
        OR
        (estado <> 'respondida' AND responded_at IS NULL)
    )
);

-- El admin lista por fecha y filtra por estado; es el único acceso de lectura.
CREATE INDEX IF NOT EXISTS consultas_created_at_idx ON public.consultas (created_at DESC);
CREATE INDEX IF NOT EXISTS consultas_estado_idx     ON public.consultas (estado);
-- FK sin índice: el resto del esquema no tiene ninguna, se mantiene la regla.
CREATE INDEX IF NOT EXISTS consultas_responded_by_idx ON public.consultas (responded_by);

ALTER TABLE public.consultas ENABLE ROW LEVEL SECURITY;

-- Solo admin y superadmin ven y gestionan las consultas.
DROP POLICY IF EXISTS "admins_read_consultas" ON public.consultas;
CREATE POLICY "admins_read_consultas" ON public.consultas
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND p.role = ANY (ARRAY['admin'::user_role, 'superadmin'::user_role])
        )
    );

DROP POLICY IF EXISTS "admins_update_consultas" ON public.consultas;
CREATE POLICY "admins_update_consultas" ON public.consultas
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND p.role = ANY (ARRAY['admin'::user_role, 'superadmin'::user_role])
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND p.role = ANY (ARRAY['admin'::user_role, 'superadmin'::user_role])
        )
    );

DROP POLICY IF EXISTS "admins_delete_consultas" ON public.consultas;
CREATE POLICY "admins_delete_consultas" ON public.consultas
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND p.role = ANY (ARRAY['admin'::user_role, 'superadmin'::user_role])
        )
    );

-- anon no necesita ningún permiso: no lee ni escribe esta tabla.
REVOKE ALL ON public.consultas FROM anon;
GRANT SELECT, UPDATE, DELETE ON public.consultas TO authenticated;
