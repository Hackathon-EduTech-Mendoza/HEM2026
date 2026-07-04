-- Las funciones de trigger no deben ser invocables como RPC vía PostgREST.
-- Solo las ejecuta Postgres internamente al disparar sus triggers.
REVOKE EXECUTE ON FUNCTION public.auto_approve_participant() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_full_name() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.protect_role_escalation() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM anon, authenticated, public;
