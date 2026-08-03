// scripts/seed-dev.mjs
//
// Puebla HEM-Dev con un juego de perfiles de prueba parecido al de producción,
// para poder probar la app en local sin datos de personas reales.
//
// Uso:
//   npm run seed:dev              -> muestra qué crearía (no toca nada)
//   npm run seed:dev -- --si      -> lo crea de verdad
//   npm run seed:dev -- --borrar  -> borra los perfiles sembrados (pide --si)
//
// ⚠️ SOLO CORRE CONTRA HEM-DEV. Antes de escribir compara el project_ref del
// .env contra DEV_REF y aborta si no coincide. La comprobación no es paranoia:
// el .env es el mismo archivo que apuntaba a producción hasta el 2026-07-30, y
// con la service role key este script no encuentra ningún RLS que lo frene.
//
// ⚠️ Las contraseñas son deliberadamente triviales y están en el repo. Vale
// porque HEM-Dev no tiene un solo dato personal y no está publicado en ningún
// lado. Si alguna vez se copian datos de prod a dev, esto deja de ser aceptable.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const CONFIRMAR = process.argv.includes('--si');
const BORRAR = process.argv.includes('--borrar');

/** El único proyecto contra el que este script tiene permitido escribir. */
const DEV_REF = 'mhipqazqvnuvtlrbqdce';
const PASSWORD = '12345678';

// ── Entorno ──
const env = {};
for (const line of readFileSync('.env', 'utf-8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}

if (!env.PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env.');
  process.exit(1);
}

if (!env.PUBLIC_SUPABASE_URL.includes(DEV_REF)) {
  console.error(`
✋ ABORTADO: el .env NO apunta a HEM-Dev.

   PUBLIC_SUPABASE_URL = ${env.PUBLIC_SUPABASE_URL}
   esperado            = https://${DEV_REF}.supabase.co

   Este script crea cuentas y perfiles con la service role key, que saltea todo
   el RLS. Corriéndolo contra producción ensuciaría la base real del evento.
`);
  process.exit(1);
}

const db = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Los perfiles a sembrar ──
// Imitan la forma de los de prod (mezcla de instituciones y perfiles
// disciplinares), pero los datos son inventados.
const USUARIOS = [
  {
    email: 'matiasghilardisalinas@gmail.com',
    role: 'superadmin',
    first_name: 'Matías',
    last_name: 'Ghilardi Salinas',
    dni: '30111222',
    phone_whatsapp: '2615000001',
    institution: 'ies_9023_maipu',
    disciplinary_profile: 'tecnico',
    year_of_study: 'otro',
    is_egresado: true,
    professional_title: 'Desarrollador',
    registration_status: 'aprobado',
  },
  {
    email: 'admin@gmail.com',
    role: 'admin',
    first_name: 'Ana',
    last_name: 'Administradora',
    dni: '30111333',
    phone_whatsapp: '2615000002',
    institution: 'ies_9023_maipu',
    disciplinary_profile: 'docente',
    year_of_study: 'otro',
    is_egresado: true,
    professional_title: 'Profesora',
    registration_status: 'aprobado',
  },
  {
    email: 'jueztest@gmail.com',
    role: 'juez',
    first_name: 'Valeria',
    last_name: 'Suárez',
    dni: '28444555',
    phone_whatsapp: '2615000003',
    institution: 'ies_edison',
    disciplinary_profile: 'docente',
    year_of_study: 'otro',
    is_egresado: true,
    professional_title: 'Licenciada en Educación',
    // El juez arranca APROBADO a propósito: la policy RLS de INSERT de
    // evaluations exige juez aprobado, así que sin esto no se puede votar.
    registration_status: 'aprobado',
  },
  {
    email: 'mentortest@gmail.com',
    role: 'mentor',
    first_name: 'Diego',
    last_name: 'Ferrer',
    dni: '27333444',
    phone_whatsapp: '2615000004',
    institution: 'otra',
    institution_other: 'Patagonian Tech',
    disciplinary_profile: 'tecnico',
    year_of_study: 'otro',
    is_egresado: true,
    professional_title: 'Ingeniero en Sistemas',
    // Igual que el juez: el desplegable de Mentoría solo lista aprobados.
    registration_status: 'aprobado',
  },
  {
    email: 'usertest1@gmail.com',
    role: 'usuario',
    first_name: 'Lucía',
    last_name: 'Fernández',
    dni: '45111222',
    phone_whatsapp: '2615000011',
    institution: 'ies_9023_maipu',
    disciplinary_profile: 'docente',
    year_of_study: 'segundo',
    is_egresado: false,
    registration_status: 'aprobado',
  },
  {
    email: 'usertest2@gmail.com',
    role: 'usuario',
    first_name: 'Mateo',
    last_name: 'Ríos',
    dni: '45222333',
    phone_whatsapp: '2615000012',
    institution: 'ies_edison',
    disciplinary_profile: 'tecnico',
    year_of_study: 'tercero',
    is_egresado: false,
    registration_status: 'aprobado',
  },
  {
    email: 'usertest3@gmail.com',
    role: 'usuario',
    first_name: 'Sofía',
    last_name: 'Paz',
    dni: '45333444',
    phone_whatsapp: '2615000013',
    institution: 'otra',
    institution_other: 'IES 9-012 Tupungato',
    disciplinary_profile: 'otro',
    year_of_study: 'primero',
    is_egresado: false,
    registration_status: 'aprobado',
  },
];

const EMAILS = USUARIOS.map((u) => u.email);

/** La Admin API no filtra por email, así que se pagina y se busca a mano. */
async function buscarCuenta(email) {
  let page = 1;
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const encontrada = data.users.find((u) => u.email === email);
    if (encontrada) return encontrada;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

// ── Modo borrado ──
if (BORRAR) {
  if (!CONFIRMAR) {
    console.log('\nBorraría estas cuentas de HEM-Dev:');
    for (const e of EMAILS) console.log(`  ${e}`);
    console.log('\nAgregá --si para borrarlas de verdad.\n');
    process.exit(0);
  }

  for (const email of EMAILS) {
    const cuenta = await buscarCuenta(email);
    if (!cuenta) {
      console.log(`  —  ${email} (no existía)`);
      continue;
    }
    // Borrar la cuenta de auth cascadea a profiles por profiles_id_fkey.
    const { error } = await db.auth.admin.deleteUser(cuenta.id);
    console.log(error ? `  ✗  ${email}: ${error.message}` : `  ✓  ${email} borrado`);
  }
  console.log('');
  process.exit(0);
}

// ── Modo alta ──
if (!CONFIRMAR) {
  console.log(`\nSembraría en HEM-Dev (${DEV_REF}) estos ${USUARIOS.length} perfiles:\n`);
  for (const u of USUARIOS) {
    console.log(`  ${u.role.padEnd(11)} ${u.email.padEnd(34)} ${u.first_name} ${u.last_name}`);
  }
  console.log(`\nTodos con la contraseña: ${PASSWORD}`);
  console.log('\nAgregá --si para crearlos de verdad.\n');
  process.exit(0);
}

console.log(`\nSembrando en HEM-Dev (${DEV_REF})…\n`);

for (const { email, role, ...perfil } of USUARIOS) {
  let cuenta = await buscarCuenta(email);

  if (cuenta) {
    // Idempotente: si ya existe se le repone la contraseña y se actualiza el
    // perfil, así volver a correr el script no obliga a borrar antes.
    const { error } = await db.auth.admin.updateUserById(cuenta.id, {
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) {
      console.log(`  ✗  ${email}: ${error.message}`);
      continue;
    }
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: PASSWORD,
      // Sin esto la cuenta queda sin confirmar y no puede iniciar sesión. La
      // Admin API no pasa por el mailer, así que no depende del toggle
      // "Confirm email" del proyecto.
      email_confirm: true,
      user_metadata: { full_name: `${perfil.first_name} ${perfil.last_name}` },
    });
    if (error) {
      console.log(`  ✗  ${email}: ${error.message}`);
      continue;
    }
    cuenta = data.user;
  }

  // El trigger on_auth_user_created ya creó la fila en profiles con rol
  // 'usuario' y estado 'pendiente'; acá se la completa. El rol se puede subir
  // porque protect_role_escalation deja pasar cuando auth.uid() es NULL, que
  // es el caso de la service role key.
  const { error: errPerfil } = await db
    .from('profiles')
    .update({ ...perfil, role })
    .eq('id', cuenta.id);

  if (errPerfil) {
    console.log(`  ✗  ${email}: perfil no actualizado — ${errPerfil.message}`);
    continue;
  }

  console.log(`  ✓  ${role.padEnd(11)} ${email}`);
}

console.log('\nListo. Las credenciales están en CREDENCIALES-DEV.local.md (no versionado).\n');
