-- Migración: 20260819_02_fix_team_id_self_assignment.sql
-- ⚠️ ARREGLO DE SEGURIDAD — exposición de datos personales entre participantes.
--
-- PROBLEMA
-- `authenticated` tenía UPDATE a nivel TABLA sobre `public.profiles`, y la policy
-- `user_update_own_profile` solo verifica que la fila sea la propia
-- (`auth.uid() = id`) — no restringe QUÉ VALOR puede tomar cada columna.
--
-- Combinando eso con:
--   - `user_select_teams`, que deja a cualquier participante listar todos los
--     equipos con su id, y
--   - `users_select_team_members`, que expone el perfil completo de quienes
--     comparten `team_id`,
--
-- cualquiera de los ~245 inscriptos podía hacer, desde la consola del navegador:
--
--   await supabase.from('teams').select('id');
--   await supabase.from('profiles').update({ team_id: '<id ajeno>' }).eq('id', miId);
--   await supabase.from('profiles').select('*');   // dni, email, phone_whatsapp…
--
-- y recorrer equipo por equipo cosechando **DNI, email y teléfono** del resto de
-- los participantes, menores incluidos. De paso salteaba por completo el RPC
-- `join_team`: sin código de invitación, sin `teams_enabled`, y sin los límites
-- de composición y de tamaño de equipo.
--
-- SOLUCIÓN
-- Quitar el UPDATE de tabla y devolverlo como lista explícita de columnas, sin
-- `team_id`. La pertenencia a un equipo pasa a ser potestad exclusiva de los RPC
-- `join_team` / `leave_team` / `create_team`, que son SECURITY DEFINER y por lo
-- tanto no dependen de este grant: siguen funcionando igual.
--
-- Verificado en HEM-Dev antes de aplicar (dentro de una transacción con rollback):
--   1. El exploit falla con "permission denied for table profiles".
--   2. La edición legítima de perfil (onboarding y dashboard) sigue funcionando.
--   3. `join_team('DEMO02')` sigue devolviendo ok:true y asignando el equipo.

REVOKE UPDATE ON public.profiles FROM authenticated, anon;

-- Las columnas que el propio usuario edita en onboarding.astro y dashboard/index.astro.
-- `team_id` queda deliberadamente afuera; `id` y `created_at` tampoco están porque
-- nadie los edita.
GRANT UPDATE (
  first_name,
  last_name,
  full_name,
  dni,
  email,
  institution,
  institution_other,
  year_of_study,
  disciplinary_profile,
  is_egresado,
  professional_title,
  instagram_handle,
  phone_whatsapp,
  registration_status,
  role,
  updated_at
) ON public.profiles TO authenticated;

-- `role` sigue siendo escribible porque onboarding.astro lo setea al elegir perfil,
-- pero está protegido aparte por el trigger `trg_protect_role_escalation`
-- (20260703_01_security_role_protection.sql), que impide auto-promoverse.
-- `anon` no recupera ningún UPDATE: no tiene por qué escribir perfiles.
