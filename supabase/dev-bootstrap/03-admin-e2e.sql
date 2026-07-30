-- Promoción del admin de pruebas de la suite E2E.
--
-- ⚠️ ANTES de correr esto, la cuenta tiene que existir en auth. El signup NO se
-- hace por SQL: hay que crearla una vez, con cualquiera de estas dos vías:
--   a) Dashboard → Authentication → Users → Add user
--        email    e2e.admin@hem2026.test
--        password E2eHem2026!pass          (está en tests/e2e/utils.ts:26)
--        marcar "Auto Confirm User"
--   b) Levantar la app contra dev y registrarse con ese mail.
--
-- El trigger on_auth_user_created (ver 02-complemento.sql) crea sola la fila en
-- profiles; esto solo la promueve a admin, que es lo que el trigger NO hace a
-- propósito: handle_new_user() dejó de confiar en el rol que manda el cliente
-- justamente para que nadie se autoproclame admin en el signup.
--
-- Sin este usuario, `npm run test:e2e` no corre: es fijo y la suite nunca lo
-- borra.

UPDATE public.profiles
SET role                = 'admin',
    registration_status = 'aprobado',
    first_name          = 'Admin',
    last_name           = 'E2E'
WHERE email = 'e2e.admin@hem2026.test';

-- Verificación: tiene que devolver exactamente una fila con role = admin.
SELECT id, email, role, registration_status, first_name, last_name
FROM public.profiles
WHERE email = 'e2e.admin@hem2026.test';
