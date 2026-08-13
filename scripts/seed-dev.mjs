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
    email: 'jueztest2@gmail.com',
    role: 'juez',
    first_name: 'Ramiro',
    last_name: 'Ledesma',
    dni: '26555666',
    phone_whatsapp: '2615000005',
    institution: 'ies_9023_maipu',
    disciplinary_profile: 'docente',
    year_of_study: 'otro',
    is_egresado: true,
    professional_title: 'Profesor de Tecnología',
    // Un segundo juez hace falta para mostrar el promedio entre jurados: con
    // uno solo el ranking del admin es la nota de esa única persona.
    registration_status: 'aprobado',
  },
  {
    email: 'mentortest2@gmail.com',
    role: 'mentor',
    first_name: 'Carla',
    last_name: 'Bustos',
    dni: '29666777',
    phone_whatsapp: '2615000006',
    institution: 'ies_edison',
    disciplinary_profile: 'docente',
    year_of_study: 'otro',
    is_egresado: true,
    professional_title: 'Especialista en Didáctica',
    // Ocupa el slot mentor_id_2 del equipo 1, que es el único modo de ver en
    // Mentoría el badge "Mentor Pedagógico (Slot 2)".
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
    // A propósito el nombre más largo que hay cargado en producción (75
    // caracteres). Con él la tabla de Usuarios del admin generaba scroll
    // horizontal; queda como caso de prueba para que no vuelva a pasar.
    institution_other: 'Instituto Superior de Formación Docente y Técnica N°9030 "Del Bicentenario"',
    disciplinary_profile: 'otro',
    year_of_study: 'primero',
    is_egresado: false,
    registration_status: 'aprobado',
  },
  {
    email: 'usertest4@gmail.com',
    role: 'usuario',
    first_name: 'Tomás',
    last_name: 'Aguirre',
    dni: '45444555',
    phone_whatsapp: '2615000014',
    institution: 'ies_9023_maipu',
    disciplinary_profile: 'docente',
    year_of_study: 'segundo',
    is_egresado: false,
    registration_status: 'aprobado',
  },
  {
    email: 'usertest5@gmail.com',
    role: 'usuario',
    first_name: 'Julieta',
    last_name: 'Vega',
    dni: '45555666',
    phone_whatsapp: '2615000015',
    institution: 'ies_edison',
    disciplinary_profile: 'tecnico',
    year_of_study: 'tercero',
    is_egresado: false,
    registration_status: 'aprobado',
  },
  {
    email: 'usertest6@gmail.com',
    role: 'usuario',
    first_name: 'Bruno',
    last_name: 'Correa',
    dni: '45666777',
    phone_whatsapp: '2615000016',
    institution: 'otra',
    institution_other: 'Escuela Técnica N°4-121 Ing. Vicente Cicchitti',
    disciplinary_profile: 'otro',
    year_of_study: 'primero',
    // El único egresado de la tanda: con dos en el mismo equipo, join_team
    // rebota al segundo (max_egresados_per_team = 1).
    is_egresado: true,
    professional_title: 'Técnico en Programación',
    registration_status: 'aprobado',
  },
  {
    email: 'usertest7@gmail.com',
    role: 'usuario',
    first_name: 'Camila',
    last_name: 'Ojeda',
    dni: '45777888',
    phone_whatsapp: '2615000017',
    institution: 'ies_9023_maipu',
    disciplinary_profile: 'otro',
    year_of_study: 'primero',
    is_egresado: false,
    // Queda A PROPÓSITO sin equipo: es la cuenta para mostrar en vivo el alta
    // con código de unión. Si se la mete a un equipo, el tutorial pierde ese
    // paso y hay que volver a correr el seed para recuperarlo.
    registration_status: 'aprobado',
  },
];

const EMAILS = USUARIOS.map((u) => u.email);

// ── Los equipos a sembrar ──
// Los códigos son fijos (y no los seis caracteres aleatorios que genera
// create_team) para poder tipearlos en cámara y para que este script sepa
// cuáles son suyos a la hora de borrar.
const EQUIPOS = [
  {
    join_code: 'DEMO01',
    name: 'Aula Viva',
    lider: 'usertest1@gmail.com',
    miembros: ['usertest1@gmail.com', 'usertest2@gmail.com', 'usertest3@gmail.com'],
    mentor: 'mentortest@gmail.com',
    mentor_2: 'mentortest2@gmail.com',
    proyecto: {
      title: 'Cuaderno Vivo',
      description_problem:
        'En los primeros años del profesorado, la devolución de los trabajos prácticos llega dos o tres semanas después de la entrega. Para entonces el tema ya se cerró y la corrección no cambia nada: el estudiante la lee, la archiva y sigue arrastrando el mismo error.',
      description_solution:
        'Un cuaderno digital donde cada consigna se entrega por partes y el docente devuelve sobre el fragmento, no sobre el trabajo terminado. El estudiante ve la marca en el momento en que todavía puede corregirla, y el docente llega a la entrega final sin una pila de veinte trabajos para leer de cero.',
      url_prototype: 'https://www.figma.com/proto/hem2026-demo-cuaderno-vivo',
      url_support_material: 'https://drive.google.com/drive/folders/hem2026-demo-cuaderno-vivo',
      submitted: true,
    },
  },
  {
    join_code: 'DEMO02',
    name: 'Ruta Maker',
    lider: 'usertest4@gmail.com',
    miembros: ['usertest4@gmail.com', 'usertest5@gmail.com', 'usertest6@gmail.com'],
    mentor: 'mentortest@gmail.com',
    mentor_2: null,
    proyecto: {
      title: 'Taller Abierto',
      description_problem:
        'Las escuelas técnicas del Valle de Uco tienen equipamiento de taller que se usa pocas horas por semana, pero ninguna sabe qué tiene la de al lado. Cuando a una le falta una máquina para un proyecto, el proyecto se recorta.',
      description_solution:
        'Un registro compartido del equipamiento disponible por escuela, con un calendario de préstamo entre instituciones y una ficha de seguridad por máquina. Arranca con las seis escuelas técnicas del departamento y no necesita comprar nada nuevo para funcionar.',
      url_prototype: 'https://www.figma.com/proto/hem2026-demo-taller-abierto',
      // A propósito sin material de apoyo: así se ve cómo muestra el panel un
      // campo opcional vacío.
      url_support_material: null,
      submitted: true,
    },
  },
];

const JOIN_CODES = EQUIPOS.map((e) => e.join_code);

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
    console.log('\nBorraría de HEM-Dev estos equipos (y con ellos su proyecto):');
    for (const t of EQUIPOS) console.log(`  ${t.join_code}  ${t.name}`);
    console.log('\nY estas cuentas:');
    for (const e of EMAILS) console.log(`  ${e}`);
    console.log('\nAgregá --si para borrarlos de verdad.\n');
    process.exit(0);
  }

  // Los equipos van PRIMERO: teams_leader_id_fkey no tiene ON DELETE, así que
  // borrar al líder antes que a su equipo falla con violación de FK. Al equipo
  // sí le cascadean projects, help_requests y las evaluations de esos
  // proyectos, y profiles.team_id queda en NULL.
  const { data: borrados, error: errEquipos } = await db
    .from('teams')
    .delete()
    .in('join_code', JOIN_CODES)
    .select('join_code, name');

  if (errEquipos) {
    console.log(`  ✗  equipos: ${errEquipos.message}`);
  } else {
    for (const t of borrados ?? []) console.log(`  ✓  equipo ${t.join_code} (${t.name}) borrado`);
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
  console.log(`\nY estos ${EQUIPOS.length} equipos, cada uno con su proyecto entregado:\n`);
  for (const t of EQUIPOS) {
    console.log(`  ${t.join_code}  ${t.name.padEnd(12)} ${t.miembros.length} integrantes  →  «${t.proyecto.title}»`);
  }
  console.log('\nAgregá --si para crearlos de verdad.\n');
  process.exit(0);
}

console.log(`\nSembrando en HEM-Dev (${DEV_REF})…\n`);

/** email → id de la cuenta, para armar los equipos más abajo. */
const IDS = new Map();

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

  IDS.set(email, cuenta.id);
  console.log(`  ✓  ${role.padEnd(11)} ${email}`);
}

// ── Equipos y proyectos ──
// Se escriben a mano en vez de llamar a create_team/join_team porque esas dos
// RPC son SECURITY DEFINER y trabajan sobre auth.uid(), que con la service role
// key es NULL. Sembrar directo también permite fijar el join_code.
console.log('');

for (const equipo of EQUIPOS) {
  const idsMiembros = equipo.miembros.map((e) => IDS.get(e));
  if (idsMiembros.some((id) => !id)) {
    console.log(`  ✗  ${equipo.name}: falta alguna de las cuentas de sus integrantes`);
    continue;
  }

  const { data: fila, error: errEquipo } = await db
    .from('teams')
    .upsert(
      {
        name: equipo.name,
        join_code: equipo.join_code,
        leader_id: IDS.get(equipo.lider),
        mentor_id: equipo.mentor ? IDS.get(equipo.mentor) : null,
        mentor_id_2: equipo.mentor_2 ? IDS.get(equipo.mentor_2) : null,
      },
      { onConflict: 'join_code' }
    )
    .select('id')
    .single();

  if (errEquipo) {
    console.log(`  ✗  equipo ${equipo.name}: ${errEquipo.message}`);
    continue;
  }

  const { error: errMiembros } = await db
    .from('profiles')
    .update({ team_id: fila.id })
    .in('id', idsMiembros);

  if (errMiembros) {
    console.log(`  ✗  ${equipo.name}: integrantes no asignados — ${errMiembros.message}`);
    continue;
  }

  const { submitted, ...proyecto } = equipo.proyecto;
  const { error: errProyecto } = await db.from('projects').upsert(
    {
      ...proyecto,
      team_id: fila.id,
      // Sin submitted_at el proyecto figura como borrador y el equipo lo sigue
      // editando; con fecha queda entregado, que es el estado desde el que el
      // jurado lo ve completo.
      submitted_at: submitted ? new Date().toISOString() : null,
    },
    { onConflict: 'team_id' }
  );

  if (errProyecto) {
    console.log(`  ✗  proyecto de ${equipo.name}: ${errProyecto.message}`);
    continue;
  }

  console.log(
    `  ✓  equipo ${equipo.join_code}  ${equipo.name.padEnd(12)} ${idsMiembros.length} integrantes  →  «${proyecto.title}»`
  );
}

// Las cuentas que ningún equipo sembrado reclama vuelven a quedar sueltas. Sin
// esto, una corrida anterior donde Camila se unió a un equipo durante el
// tutorial dejaría el seed sin la cuenta libre que ese mismo paso necesita.
const CON_EQUIPO = new Set(EQUIPOS.flatMap((t) => t.miembros));
const SUELTOS = EMAILS.filter((e) => !CON_EQUIPO.has(e)).map((e) => IDS.get(e)).filter(Boolean);

if (SUELTOS.length) {
  const { error } = await db.from('profiles').update({ team_id: null }).in('id', SUELTOS);
  if (error) console.log(`\n  ✗  no se pudo dejar sin equipo a las cuentas sueltas: ${error.message}`);
}

console.log('\nListo. Las credenciales están en CREDENCIALES-DEV.local.md (no versionado).\n');
