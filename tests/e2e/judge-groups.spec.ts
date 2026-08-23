import { test, expect } from '@playwright/test';
import {
  RUN_ID,
  E2E_PASSWORD,
  createUserApi,
  completeProfileApi,
  newApiClient,
  newServiceClient,
  loginUi,
  logoutUi,
  TestUser,
} from './utils';

/**
 * Grupos de jurado en la preclasificación
 * (`can_judge_project`, las policies de `projects` y `evaluations`, y el
 * trigger `trg_protect_project_judge_group`).
 *
 * La división vive en la base y no en la pantalla porque el panel de evaluación
 * escribe con la anon key desde el navegador: esconder un proyecto en la UI se
 * saltea con la consola abierta. Por eso casi todos estos casos atacan la API
 * directamente, igual que lo haría alguien con las devtools.
 *
 * ⚠️ ESCRIBE EN LA BASE REAL y toca `event_config` (`evaluation_phase` y
 * `judge_groups_enabled`). El `afterAll` restaura los dos valores originales y
 * borra lo que creó. Va en la suite completa, que solo corre a mano.
 *
 * Los tests son seriales: comparten el escenario que arma el `beforeAll`.
 */
test.describe.configure({ mode: 'serial' });

const db = newServiceClient();

/** Cuántos proyectos crea el escenario. 6 divide exacto entre 2 y 3 grupos. */
const CANT_PROYECTOS = 6;

let juezG1: TestUser;
let juezG2: TestUser;
let juezSinGrupo: TestUser;
let participante: TestUser;

let idsProyectos: string[] = [];
let idsEquipos: string[] = [];
/** project_id → judge_group, para saber qué le toca a quién. */
const grupoDe = new Map<string, number>();

let faseOriginal: string;
let divisionOriginal: string;

async function getConfig(key: string): Promise<string> {
  const { data } = await db.from('event_config').select('value').eq('key', key).single();
  return data?.value ?? '';
}

async function setConfig(key: string, value: string) {
  const { error } = await db.from('event_config').update({ value }).eq('key', key);
  if (error) throw new Error(`No se pudo escribir ${key}: ${error.message}`);
}

test.beforeAll(async () => {
  faseOriginal = await getConfig('evaluation_phase');
  divisionOriginal = await getConfig('judge_groups_enabled');

  juezG1 = await createUserApi('juezg1');
  await completeProfileApi(juezG1, { first_name: 'Juez', last_name: 'Grupo Uno', dni: `9${RUN_ID.slice(-7)}1`, role: 'juez' });
  juezG2 = await createUserApi('juezg2');
  await completeProfileApi(juezG2, { first_name: 'Juez', last_name: 'Grupo Dos', dni: `9${RUN_ID.slice(-7)}2`, role: 'juez' });
  juezSinGrupo = await createUserApi('jueznull');
  await completeProfileApi(juezSinGrupo, { first_name: 'Juez', last_name: 'Sin Grupo', dni: `9${RUN_ID.slice(-7)}3`, role: 'juez' });
  participante = await createUserApi('parti');
  await completeProfileApi(participante, { first_name: 'Parti', last_name: 'Cipante', dni: `9${RUN_ID.slice(-7)}4` });

  // Los jueces tienen que estar aprobados: la policy de INSERT lo exige.
  await db.from('profiles').update({ registration_status: 'aprobado' })
    .in('id', [juezG1.id, juezG2.id, juezSinGrupo.id]);

  // Grupo del juez: se escribe con service role porque `judge_group` no tiene
  // GRANT de UPDATE para authenticated — la puerta real es el RPC set_judge_group.
  await db.from('profiles').update({ judge_group: 1 }).eq('id', juezG1.id);
  await db.from('profiles').update({ judge_group: 2 }).eq('id', juezG2.id);
  await db.from('profiles').update({ judge_group: null }).eq('id', juezSinGrupo.id);

  // Equipos y proyectos. El equipo del participante va primero: lo necesita
  // para el caso del trigger que protege `projects.judge_group`.
  for (let i = 0; i < CANT_PROYECTOS; i++) {
    const { data: equipo, error: errEquipo } = await db
      .from('teams').insert({ name: `Equipo E2E ${RUN_ID} jurado ${i}` }).select('id').single();
    if (errEquipo) throw new Error(`equipo ${i}: ${errEquipo.message}`);
    idsEquipos.push(equipo.id);

    const { data: proyecto, error: errProyecto } = await db
      .from('projects')
      .insert({
        team_id: equipo.id,
        title: `Proyecto E2E ${RUN_ID} ${i}`,
        description_problem: 'problema',
        description_solution: 'solucion',
        // Alterna 1 y 2, así cada grupo se lleva la mitad exacta.
        judge_group: (i % 2) + 1,
      })
      .select('id, judge_group')
      .single();
    if (errProyecto) throw new Error(`proyecto ${i}: ${errProyecto.message}`);
    idsProyectos.push(proyecto.id);
    grupoDe.set(proyecto.id, proyecto.judge_group);
  }

  // El participante entra al primer equipo, para que su proyecto sea "suyo".
  await db.from('profiles').update({ team_id: idsEquipos[0] }).eq('id', participante.id);

  await setConfig('evaluation_phase', 'preclasificacion');
  await setConfig('judge_groups_enabled', 'true');
});

test.afterAll(async () => {
  await setConfig('evaluation_phase', faseOriginal);
  await setConfig('judge_groups_enabled', divisionOriginal);

  if (idsProyectos.length > 0) {
    await db.from('evaluations').delete().in('project_id', idsProyectos);
    await db.from('projects').delete().in('id', idsProyectos);
  }
  const ids = [juezG1?.id, juezG2?.id, juezSinGrupo?.id, participante?.id].filter(Boolean) as string[];
  if (ids.length > 0) await db.from('profiles').update({ team_id: null }).in('id', ids);
  if (idsEquipos.length > 0) await db.from('teams').delete().in('id', idsEquipos);
  if (ids.length > 0) {
    await db.from('profiles').delete().in('id', ids);
    for (const id of ids) await db.auth.admin.deleteUser(id);
  }
});

/** Los proyectos del escenario que le tocan a un grupo. */
const proyectosDe = (grupo: number) => idsProyectos.filter((id) => grupoDe.get(id) === grupo);

test.describe('Lectura: cada juez ve solo lo suyo', () => {
  test('un juez ve los proyectos de su grupo y no los del otro', async () => {
    const { data } = await juezG1.client.from('projects').select('id').in('id', idsProyectos);
    const vistos = (data ?? []).map((p) => p.id).sort();
    expect(vistos).toEqual(proyectosDe(1).sort());
  });

  test('el otro grupo ve exactamente el complemento', async () => {
    const { data } = await juezG2.client.from('projects').select('id').in('id', idsProyectos);
    const vistos = (data ?? []).map((p) => p.id).sort();
    expect(vistos).toEqual(proyectosDe(2).sort());
    // Ningún proyecto compartido entre los dos grupos.
    expect(vistos.filter((id) => proyectosDe(1).includes(id))).toHaveLength(0);
  });

  test('un juez sin grupo asignado evalúa todo', async () => {
    const { data } = await juezSinGrupo.client.from('projects').select('id').in('id', idsProyectos);
    expect((data ?? []).map((p) => p.id).sort()).toEqual([...idsProyectos].sort());
  });

  test('un proyecto sin grupo lo ve todo el jurado', async () => {
    const suelto = proyectosDe(2)[0];
    await db.from('projects').update({ judge_group: null }).eq('id', suelto);

    const { data } = await juezG1.client.from('projects').select('id').eq('id', suelto);
    expect(data ?? []).toHaveLength(1);

    await db.from('projects').update({ judge_group: 2 }).eq('id', suelto);
  });
});

test.describe('Escritura: el candado está en la base', () => {
  test('un juez no puede evaluar un proyecto de otro grupo', async () => {
    const ajeno = proyectosDe(2)[0];
    const { error } = await juezG1.client.from('evaluations').insert({
      project_id: ajeno, judge_id: juezG1.id, phase: 'preclasificacion',
      score_problem: 5, score_solution: 5, score_innovation: 5,
      score_feasibility: 5, score_impact: 5,
    });
    expect(error, 'la RLS tenía que rechazar la evaluación ajena').not.toBeNull();
  });

  test('un juez sí puede evaluar un proyecto de su grupo', async () => {
    const propio = proyectosDe(1)[0];
    const { error } = await juezG1.client.from('evaluations').insert({
      project_id: propio, judge_id: juezG1.id, phase: 'preclasificacion',
      score_problem: 4, score_solution: 4, score_innovation: 4,
      score_feasibility: 4, score_impact: 4,
    });
    expect(error, error?.message).toBeNull();
  });

  /**
   * El agujero que apareció al auditar: la policy de UPDATE no miraba el
   * proyecto y no tenía WITH CHECK propio — cuando falta, Postgres reusa el
   * USING para la fila nueva, donde `project_id` no se valida. Así un juez
   * votaba algo suyo y después movía el voto a un proyecto ajeno.
   */
  test('un juez no puede MOVER su evaluación a un proyecto ajeno', async () => {
    const propio = proyectosDe(1)[1];
    const ajeno = proyectosDe(2)[1];

    const { data: creada, error: errInsert } = await juezG1.client
      .from('evaluations')
      .insert({
        project_id: propio, judge_id: juezG1.id, phase: 'preclasificacion',
        score_problem: 3, score_solution: 3, score_innovation: 3,
        score_feasibility: 3, score_impact: 3,
      })
      .select('id')
      .single();
    expect(errInsert, errInsert?.message).toBeNull();

    const { error } = await juezG1.client
      .from('evaluations')
      .update({ project_id: ajeno })
      .eq('id', creada!.id);
    expect(error, 'la RLS tenía que impedir mover el voto a un proyecto ajeno').not.toBeNull();

    // Y el caso legítimo sigue andando: corregir el puntaje propio.
    const { error: errPuntaje } = await juezG1.client
      .from('evaluations')
      .update({ score_problem: 5 })
      .eq('id', creada!.id);
    expect(errPuntaje, errPuntaje?.message).toBeNull();
  });

  /**
   * En `projects` el GRANT de UPDATE es de tabla, así que `judge_group` nació
   * escribible para cualquier autenticado. Con `user_update_own_project`, un
   * participante podía elegir qué jurado lo evalúa.
   */
  test('un participante no puede cambiarle el grupo a su propio proyecto', async () => {
    const propio = idsProyectos[0];
    const { error } = await participante.client
      .from('projects').update({ judge_group: 2 }).eq('id', propio);
    expect(error, 'el trigger tenía que rechazar el cambio de grupo').not.toBeNull();
  });

  test('un juez no puede repartir los proyectos', async () => {
    const { error } = await juezG1.client.rpc('assign_judge_groups', {
      p_group_count: 2, p_reassign_all: true,
    });
    expect(error, 'solo la organización puede repartir').not.toBeNull();
  });

  test('un juez no puede armar los grupos', async () => {
    const { error } = await juezG1.client.rpc('set_judge_group', {
      p_judge_id: juezG1.id, p_group: 2,
    });
    expect(error, 'solo la organización puede armar los grupos').not.toBeNull();
  });

  /**
   * Los dos RPC se saltean su propia validación cuando auth.uid() es NULL, para
   * dejar pasar migraciones y service_role. Supabase le da EXECUTE a `anon` por
   * DEFAULT PRIVILEGES, así que sin un REVOKE explícito un visitante SIN NINGUNA
   * SESIÓN podía llamarlos con la anon key —que es pública, va en el HTML— y
   * rebarajar los proyectos del evento. Verificado antes del arreglo.
   */
  test('un visitante sin sesión no puede tocar los grupos', async () => {
    const anon = newApiClient();

    const { error: errReparto } = await anon.rpc('assign_judge_groups', {
      p_group_count: 2, p_reassign_all: true,
    });
    expect(errReparto, 'anon no tiene que poder repartir').not.toBeNull();

    const { error: errGrupo } = await anon.rpc('set_judge_group', {
      p_judge_id: juezG1.id, p_group: 2,
    });
    expect(errGrupo, 'anon no tiene que poder armar los grupos').not.toBeNull();
  });
});

test.describe('La división es solo de preclasificación', () => {
  test('en la ronda final todos los jueces ven todos los finalistas', async () => {
    // Finalistas del grupo 2: los que el juez del grupo 1 NO veía recién.
    const finalistas = proyectosDe(2);
    await db.from('projects').update({ is_finalist: true }).in('id', finalistas);
    await setConfig('evaluation_phase', 'final');

    try {
      const { data } = await juezG1.client
        .from('projects').select('id').in('id', idsProyectos).eq('is_finalist', true);
      expect(
        (data ?? []).map((p) => p.id).sort(),
        'en la final la división no tiene que aplicar',
      ).toEqual([...finalistas].sort());

      // Y puede votarlos, aunque ninguno sea de su grupo.
      const { error } = await juezG1.client.from('evaluations').insert({
        project_id: finalistas[0], judge_id: juezG1.id, phase: 'final',
        score_problem: 4, score_solution: 4, score_innovation: 4,
        score_feasibility: 4, score_impact: 4, score_communication: 5,
      });
      expect(error, error?.message).toBeNull();
    } finally {
      await setConfig('evaluation_phase', 'preclasificacion');
      await db.from('projects').update({ is_finalist: false }).in('id', finalistas);
      await db.from('evaluations').delete().eq('phase', 'final').in('project_id', finalistas);
    }
  });

  test('apagar la división devuelve todos los proyectos a todo el jurado', async () => {
    await setConfig('judge_groups_enabled', 'false');
    try {
      const { data } = await juezG1.client.from('projects').select('id').in('id', idsProyectos);
      expect((data ?? []).map((p) => p.id).sort()).toEqual([...idsProyectos].sort());
    } finally {
      await setConfig('judge_groups_enabled', 'true');
    }
  });
});

test.describe('El panel del juez', () => {
  test('avisa a qué grupo pertenece y lista solo sus proyectos', async ({ page }) => {
    await logoutUi(page);
    await loginUi(page, juezG1.email, E2E_PASSWORD);
    await page.goto('/evaluacion');

    await expect(page.locator('.group-notice')).toContainText('grupo 1');

    // Los títulos del escenario que se ven en pantalla son solo los suyos.
    const propios = proyectosDe(1).length;
    const visibles = page.locator(`text=/Proyecto E2E ${RUN_ID} /`);
    expect(await visibles.count()).toBe(propios);
  });

  test('no muestra el aviso cuando la división está apagada', async ({ page }) => {
    await setConfig('judge_groups_enabled', 'false');
    try {
      await logoutUi(page);
      await loginUi(page, juezG1.email, E2E_PASSWORD);
      await page.goto('/evaluacion');
      await expect(page.locator('.group-notice')).toHaveCount(0);
    } finally {
      await setConfig('judge_groups_enabled', 'true');
    }
  });
});
