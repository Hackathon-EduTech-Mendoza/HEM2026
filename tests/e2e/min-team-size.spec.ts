import { test, expect } from '@playwright/test';
import {
  RUN_ID,
  E2E_PASSWORD,
  ADMIN_EMAIL,
  createUserApi,
  completeProfileApi,
  newApiClient,
  newServiceClient,
  TestUser,
} from './utils';

/**
 * Mínimo de integrantes por equipo al entregar el proyecto
 * (trigger `trg_enforce_min_team_size` sobre `public.projects`).
 *
 * La regla vive en la base y no en el front porque la entrega es un
 * `from('projects').upsert()` directo contra la API: cualquier validación en
 * JavaScript se saltea con la consola abierta. Por eso estos tests atacan la
 * API igual que lo haría alguien con la consola, sin pasar por la UI.
 *
 * ⚠️ ESCRIBE EN LA BASE REAL: crea usuarios `e2e.*@hem2026.test`, equipos
 * `Equipo E2E <run> …` y proyectos. Va en la suite completa
 * («E2E completo (escribe en la base real)» del CI), que solo corre a mano.
 * Se limpia sola en el `afterAll`.
 *
 * Requiere el admin de prueba ya bootstrapeado (ver tests/e2e/utils.ts): el
 * caso del bypass necesita una sesión con rol admin de verdad.
 *
 * ⚠️ **Quién escribe importa más que qué se escribe.** El trigger deja pasar a
 * quien no tiene sesión (`get_user_role()` devuelve NULL con `auth.uid()` nulo)
 * para no romper seeds ni scripts de servicio. Es decir: la service role key
 * **también atraviesa el trigger**. Por eso el armado del equipo se hace con el
 * cliente de servicio (rápido y sin pelear con RLS), pero **el INSERT/UPDATE de
 * `projects` que se está probando siempre va con la sesión de un participante**.
 * Si algún día alguien "simplifica" esto usando `newServiceClient()` para la
 * entrega, los casos de rechazo van a pasar en verde sin probar nada.
 *
 * Los tests son seriales: comparten los equipos que arma el `beforeAll`.
 */
test.describe.configure({ mode: 'serial' });

// ── Estado compartido del run ──

interface EquipoE2E {
  id: string;
  nombre: string;
  integrantes: TestUser[];
  /** Primer integrante: es el que entrega (el líder, en el flujo real). */
  lider: TestUser;
}

/** Equipo de 2: por debajo del mínimo de 3. */
let equipoChico: EquipoE2E;
/** Equipo de 3: cumple el mínimo con lo justo. */
let equipoJusto: EquipoE2E;
/** Otro equipo de 3, que nunca entrega: prueba que el bloqueo es sobre el INSERT. */
let equipoJusto2: EquipoE2E;
/** Equipo de 3, para probar que la regla sigue a `event_config`. */
let equipoConfig: EquipoE2E;

// Todo lo creado, para el teardown. Se borra por id, no por patrón: así esta
// limpieza nunca se lleva puesto lo de otro archivo de la misma corrida.
const equiposCreados: string[] = [];
const perfilesCreados: string[] = [];

const CLAVE_MIN = 'min_team_size';
/** Valor de `event_config.min_team_size` al empezar; null si la clave no existe. */
let minOriginal: string | null = null;

// ── Helpers locales ──
//
// `utils.ts` sabe crear usuarios sueltos, pero no equipos de N integrantes:
// en el flujo real la gente se une de a una con el código, y el RPC `join_team`
// depende de `teams_enabled` y de los límites de composición, que no son lo que
// se está probando acá. Estos helpers arman el equipo por la puerta de atrás.

let contadorDni = 0;
const nuevoDni = () => `5${String(Date.now()).slice(-6)}${contadorDni++}`;

/** Código de 6 caracteres como los que genera `create_team` (es UNIQUE). */
function nuevoJoinCode(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return code;
}

/**
 * Crea `cantidad` participantes aprobados y los mete en un equipo nuevo.
 * Usa el cliente de servicio para asignar `team_id` y crear el equipo: es
 * andamiaje, no lo que se está probando.
 */
async function crearEquipoE2E(sufijo: string, cantidad: number): Promise<EquipoE2E> {
  const db = newServiceClient();

  const integrantes: TestUser[] = [];
  for (let i = 0; i < cantidad; i++) {
    const user = await createUserApi(`mts-${sufijo}-${i}`);
    await completeProfileApi(user, {
      first_name: `Min ${sufijo.toUpperCase()}${i}`,
      last_name: `Prueba ${RUN_ID}`,
      dni: nuevoDni(),
      // El primero técnico, el resto "otro": así ningún equipo choca contra los
      // límites de composición si alguna vez se validan también acá.
      disciplinary_profile: i === 0 ? 'tecnico' : 'otro',
    });
    perfilesCreados.push(user.id);
    integrantes.push(user);
  }

  // El nombre arranca con `Equipo E2E ` a propósito: es el patrón que barre
  // `npm run test:e2e:limpiar` si una corrida se corta antes del teardown.
  const nombre = `Equipo E2E ${RUN_ID} ${sufijo}`;
  const { data: equipo, error } = await db
    .from('teams')
    .insert({ name: nombre, join_code: nuevoJoinCode(), leader_id: integrantes[0].id })
    .select('id')
    .single();
  if (error) throw new Error(`No se pudo crear el equipo ${nombre}: ${error.message}`);
  equiposCreados.push(equipo.id);

  const { error: errorAsignar } = await db
    .from('profiles')
    .update({ team_id: equipo.id })
    .in('id', integrantes.map((u) => u.id));
  if (errorAsignar) {
    throw new Error(`No se pudo asignar el equipo ${nombre}: ${errorAsignar.message}`);
  }

  // Verificación del andamiaje: si el equipo no quedó con la cantidad esperada,
  // el test de abajo probaría otra cosa y encima daría verde.
  const { count } = await db
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', equipo.id);
  expect(count, `el equipo ${nombre} no quedó con ${cantidad} integrantes`).toBe(cantidad);

  return { id: equipo.id, nombre, integrantes, lider: integrantes[0] };
}

/** Entrega un proyecto **con la sesión del participante**, que es el caso real. */
function entregarProyecto(user: TestUser, teamId: string, titulo: string) {
  return user.client.from('projects').insert({
    team_id: teamId,
    title: titulo,
    description_problem: 'Problema de prueba E2E del mínimo de integrantes.',
    description_solution: 'Solución de prueba E2E del mínimo de integrantes.',
    url_prototype: 'https://example.com/prototipo-min-team-size',
  });
}

/** Saca a un integrante del equipo (baja de último momento). */
async function sacarDelEquipo(userId: string) {
  const db = newServiceClient();
  const { error } = await db.from('profiles').update({ team_id: null }).eq('id', userId);
  if (error) throw new Error(`No se pudo sacar del equipo a ${userId}: ${error.message}`);
}

/** Lee `event_config.min_team_size`; devuelve null si la clave no existe. */
async function leerMinTeamSize(): Promise<string | null> {
  const db = newServiceClient();
  const { data } = await db.from('event_config').select('value').eq('key', CLAVE_MIN).maybeSingle();
  return data?.value ?? null;
}

async function escribirMinTeamSize(valor: string) {
  const db = newServiceClient();
  const { error } = await db
    .from('event_config')
    .upsert({ key: CLAVE_MIN, value: valor, description: 'Mínimo de integrantes por equipo' }, { onConflict: 'key' });
  if (error) throw new Error(`No se pudo escribir ${CLAVE_MIN}=${valor}: ${error.message}`);
}

async function borrarMinTeamSize() {
  const db = newServiceClient();
  await db.from('event_config').delete().eq('key', CLAVE_MIN);
}

// ── Setup / teardown ──

test.beforeAll(async () => {
  minOriginal = await leerMinTeamSize();
  // Los casos de abajo asumen el mínimo publicado por el Art. 6º de las Bases.
  // Si alguien lo movió en la base, mejor decirlo que dar verde probando otra regla.
  expect(
    minOriginal === null || Number(minOriginal) === 3,
    `event_config.min_team_size está en "${minOriginal}"; estos tests están escritos para 3 (o la clave ausente, que también da 3 por defecto).`,
  ).toBeTruthy();

  equipoChico = await crearEquipoE2E('chico', 2);
  equipoJusto = await crearEquipoE2E('justo', 3);
  equipoJusto2 = await crearEquipoE2E('justo2', 3);
  equipoConfig = await crearEquipoE2E('config', 3);
});

/**
 * Borra solo lo de este archivo, por id. El orden no es intercambiable (mismo
 * criterio que `limpiarDatosE2E` en utils.ts):
 *   1. `projects` y `help_requests` — apuntan al equipo.
 *   2. `profiles.team_id = null` — para que nadie apunte al equipo.
 *   3. `teams` — antes que los perfiles: `teams.leader_id` es NO ACTION.
 *   4. `profiles`.
 *   5. Cuentas de `auth.users`, de a una: `profiles` no tiene FK contra ellas.
 */
test.afterAll(async () => {
  try {
    const db = newServiceClient();

    if (equiposCreados.length > 0) {
      await db.from('help_requests').delete().in('team_id', equiposCreados);
      await db.from('projects').delete().in('team_id', equiposCreados);
      await db.from('profiles').update({ team_id: null }).in('team_id', equiposCreados);
      await db.from('teams').delete().in('id', equiposCreados);
    }

    let cuentasAuth = 0;
    if (perfilesCreados.length > 0) {
      await db.from('profiles').delete().in('id', perfilesCreados);
      for (const id of perfilesCreados) {
        const { error } = await db.auth.admin.deleteUser(id);
        if (!error) cuentasAuth++;
      }
    }

    console.log(
      `\n[limpieza min-team-size ${RUN_ID}] ${perfilesCreados.length} perfiles, ` +
        `${cuentasAuth} cuentas de auth, ${equiposCreados.length} equipos.`,
    );
  } catch (e) {
    console.error(
      `\n[limpieza min-team-size ${RUN_ID}] FALLÓ. Hay que borrar a mano con: npm run test:e2e:limpiar\n`,
      e,
    );
  }
});

// ═══════════════════════════════════════════════════════════
// 1. Por debajo del mínimo: la entrega se rechaza
// ═══════════════════════════════════════════════════════════

test('un equipo de 2 no puede entregar el proyecto', async () => {
  const { error } = await entregarProyecto(
    equipoChico.lider,
    equipoChico.id,
    `Proyecto E2E min-chico ${RUN_ID}`,
  );

  expect(error, 'el equipo de 2 pudo entregar: el trigger no está frenando nada').not.toBeNull();
  // El prefijo es lo que le permite al front distinguir este rechazo de un
  // error de red y mostrar el motivo real: se chequea explícitamente.
  expect(error!.message).toContain('[min_team_size]');

  // Y no quedó nada escrito.
  const db = newServiceClient();
  const { count } = await db
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', equipoChico.id);
  expect(count).toBe(0);
});

// ═══════════════════════════════════════════════════════════
// 2. Con el mínimo cumplido: la entrega pasa
// ═══════════════════════════════════════════════════════════

test('un equipo de 3 entrega el proyecto sin problema', async () => {
  const titulo = `Proyecto E2E min-justo ${RUN_ID}`;
  const { error } = await entregarProyecto(equipoJusto.lider, equipoJusto.id, titulo);

  expect(error, `la entrega del equipo de 3 fue rechazada: ${error?.message}`).toBeNull();

  const db = newServiceClient();
  const { data } = await db.from('projects').select('title').eq('team_id', equipoJusto.id).single();
  expect(data?.title).toBe(titulo);
});

// ═══════════════════════════════════════════════════════════
// 3. Bypass de staff
//
// Es la vía de destrabe manual del día del evento: si un equipo queda trabado
// por una baja de último momento, un admin puede escribir igual.
// ═══════════════════════════════════════════════════════════

test('el admin puede entregar por un equipo que no llega al mínimo', async () => {
  const adminClient = newApiClient();
  const { error: loginError } = await adminClient.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: E2E_PASSWORD,
  });
  expect(loginError, 'no se pudo iniciar sesión con el admin de prueba').toBeNull();

  // Mismo equipo de 2 que ya fue rechazado arriba: lo único que cambia es quién escribe.
  const titulo = `Proyecto E2E min-bypass ${RUN_ID}`;
  const { error } = await adminClient.from('projects').insert({
    team_id: equipoChico.id,
    title: titulo,
    description_problem: 'Problema cargado por el admin como destrabe manual.',
    description_solution: 'Solución cargada por el admin como destrabe manual.',
  });

  expect(error, `el bypass de admin no funcionó: ${error?.message}`).toBeNull();

  const db = newServiceClient();
  const { data } = await db.from('projects').select('title').eq('team_id', equipoChico.id).single();
  expect(data?.title).toBe(titulo);
});

// ═══════════════════════════════════════════════════════════
// 4. El trigger también corre en UPDATE
//
// Si solo mirara el INSERT, un equipo entregaba con 3, perdía a alguien y
// seguía editando su entrega toda la jornada.
// ═══════════════════════════════════════════════════════════

test('un equipo que ya entregó y se achica PUEDE seguir editando', async () => {
  // El trigger corre solo en INSERT, a propósito (20260819_03). Si corriera
  // también en UPDATE, un equipo que entregó a las 22:00 y pierde a alguien a
  // las 23:30 no podría ni corregir un typo de su propia entrega: quedaría
  // castigado por algo posterior a la entrega y fuera de su control.
  const saliente = equipoJusto.integrantes[2];
  await sacarDelEquipo(saliente.id);

  const tituloEditado = `Proyecto E2E min-justo editado ${RUN_ID}`;
  const { error } = await equipoJusto.lider.client
    .from('projects')
    .update({ title: tituloEditado })
    .eq('team_id', equipoJusto.id);

  expect(error, `el equipo entregó válidamente y no pudo editar: ${error?.message}`).toBeNull();

  const db = newServiceClient();
  const { data } = await db.from('projects').select('title').eq('team_id', equipoJusto.id).single();
  expect(data?.title).toBe(tituloEditado);

  // Devolver al integrante para no dejar el equipo a mitad de camino.
  const { error: errorVolver } = await db
    .from('profiles')
    .update({ team_id: equipoJusto.id })
    .eq('id', saliente.id);
  expect(errorVolver).toBeNull();
});

test('un equipo por debajo del mínimo tampoco puede CREAR la entrega tras achicarse', async () => {
  // La otra cara del test anterior: lo que se bloquea es crear la entrega.
  // Este equipo nunca entregó, así que sigue sin poder hacerlo.
  const saliente = equipoJusto2.integrantes[2];
  await sacarDelEquipo(saliente.id);

  const { error } = await entregarProyecto(
    equipoJusto2.lider,
    equipoJusto2.id,
    `Proyecto E2E nunca ${RUN_ID}`,
  );

  expect(error, 'un equipo de 2 sin entrega previa igual pudo crearla').not.toBeNull();
  expect(error!.message).toContain('[min_team_size]');

  const db = newServiceClient();
  const { error: errorVolver } = await db
    .from('profiles')
    .update({ team_id: equipoJusto2.id })
    .eq('id', saliente.id);
  expect(errorVolver).toBeNull();
});

// ═══════════════════════════════════════════════════════════
// 5. La regla sigue a event_config.min_team_size
//
// El valor no está hardcodeado: si mañana las Bases piden 4, es un UPDATE de
// esa clave y nada más. Este test lo sube a 4 y lo DEJA COMO ESTABA sí o sí.
// ═══════════════════════════════════════════════════════════

test('subir min_team_size a 4 deja afuera a un equipo de 3', async () => {
  const valorOriginal = await leerMinTeamSize();

  try {
    await escribirMinTeamSize('4');

    const { error } = await entregarProyecto(
      equipoConfig.lider,
      equipoConfig.id,
      `Proyecto E2E min-config ${RUN_ID}`,
    );

    expect(error, 'con el mínimo en 4, el equipo de 3 igual pudo entregar').not.toBeNull();
    expect(error!.message).toContain('[min_team_size]');
    // El mensaje tiene que decir el número nuevo, no el 3 de antes.
    expect(error!.message).toContain('4');
  } finally {
    // Pase lo que pase, la config vuelve a como estaba: si esto queda en 4, el
    // día del evento ningún equipo de 3 puede entregar.
    if (valorOriginal === null) {
      await borrarMinTeamSize();
    } else {
      await escribirMinTeamSize(valorOriginal);
    }
  }

  expect(await leerMinTeamSize()).toBe(valorOriginal);
});

test('con el mínimo restaurado, el equipo de 3 vuelve a poder entregar', async () => {
  // Cierra el caso anterior: comprueba que el `finally` dejó la config sana y,
  // de paso, que el rechazo era por el valor nuevo y no por otra cosa.
  const { error } = await entregarProyecto(
    equipoConfig.lider,
    equipoConfig.id,
    `Proyecto E2E min-config ok ${RUN_ID}`,
  );
  expect(error, `la config no quedó restaurada: ${error?.message}`).toBeNull();
});
