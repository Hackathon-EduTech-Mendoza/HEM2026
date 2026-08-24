import { test, expect, request, type Page } from '@playwright/test';
import {
  createUserApi,
  completeProfileApi,
  newApiClient,
  newServiceClient,
  loginUi,
  E2E_PASSWORD,
  type TestUser,
} from './utils';

/**
 * Encuesta post evento.
 *
 * ⚠️ ESCRIBE EN LA BASE REAL y toca `event_config` (`survey_enabled`). El
 * `afterAll` restaura el valor original y borra lo que creó. Va en la suite
 * completa, que sólo corre a mano.
 *
 * Lo que más importa acá no es que el formulario ande, sino que **no haya otro
 * camino de entrada que el endpoint**: las dos tablas no tienen policy de
 * INSERT y el único que escribe es /api/encuesta con la service role key. Por
 * eso varios casos atacan PostgREST directamente con la anon key, igual que lo
 * haría alguien con las devtools abiertas.
 *
 * ⚠️ Los tests de RLS **siembran datos ajenos antes de verificar**. Sin eso
 * pasarían con las tablas vacías aunque no hubiera ninguna policy, que es
 * exactamente lo que no se quiere de un test de seguridad.
 *
 * Los tests son seriales: comparten el escenario que arma el `beforeAll`.
 */
test.describe.configure({ mode: 'serial' });

const db = newServiceClient();

let participante: TestUser;
/** Un segundo participante, para el camino "no trabajé con un mentor". */
let participanteSinMentor: TestUser;
let juez: TestUser;
let valorOriginalFlag = 'false';

/** Texto de la respuesta que manda el test del formulario. */
const COMENTARIO_UI = '[e2e] más tiempo para el pitch';

async function getConfig(key: string): Promise<string> {
  const { data } = await db.from('event_config').select('value').eq('key', key).single();
  return data?.value ?? '';
}

async function setConfig(key: string, value: string) {
  const { error } = await db.from('event_config').update({ value }).eq('key', key);
  if (error) throw new Error(`No se pudo setear ${key}: ${error.message}`);
}

/**
 * Borra lo que dejó la corrida.
 *
 * ⚠️ Las respuestas no tienen dueño (ese es el punto de la feature), así que la
 * única forma de reconocerlas es el texto. **Todo test que escriba una
 * respuesta tiene que mandar un `p4_cambiaria` que empiece con `[e2e`**: una
 * respuesta sin comentario es indeleble y queda ensuciando los promedios de dev
 * para siempre.
 */
async function limpiarEncuesta() {
  for (const u of [participante, participanteSinMentor, juez]) {
    if (u) await db.from('encuesta_respondio').delete().eq('user_id', u.id);
  }
  await db.from('encuesta_respuestas').delete().like('p4_cambiaria', '[e2e%');
}

/** Hace un POST a /api/encuesta con la sesión de un usuario ya logueado. */
async function postConSesion(page: Page, baseURL: string | undefined, payload: unknown) {
  const cookies = await page.context().cookies();
  const ctx = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      Cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; '),
    },
  });
  const res = await ctx.post('/api/encuesta', { data: payload });
  const status = res.status();
  await ctx.dispose();
  return status;
}

test.beforeAll(async () => {
  valorOriginalFlag = await getConfig('survey_enabled');

  participante = await createUserApi('encuesta.participante');
  await completeProfileApi(participante, {
    first_name: 'Encu',
    last_name: 'Participante',
    dni: '40000101',
    role: 'usuario',
  });

  participanteSinMentor = await createUserApi('encuesta.sinmentor');
  await completeProfileApi(participanteSinMentor, {
    first_name: 'Encu',
    last_name: 'SinMentor',
    dni: '40000103',
    role: 'usuario',
  });

  juez = await createUserApi('encuesta.juez');
  await completeProfileApi(juez, {
    first_name: 'Encu',
    last_name: 'Juez',
    dni: '40000102',
    role: 'juez',
  });

  await limpiarEncuesta();

  // Datos ajenos, para que los tests de RLS tengan algo que NO se pueda ver.
  const { error: errorSemilla } = await db.from('encuesta_respuestas').insert({
    p1_general: 3,
    p2_mentoria: null,
    p3_volveria: 'no',
    p4_cambiaria: '[e2e-seed] respuesta de otra persona',
  });
  if (errorSemilla) throw new Error(`No se pudo sembrar: ${errorSemilla.message}`);

  const { error: errorMarca } = await db
    .from('encuesta_respondio')
    .insert({ user_id: juez.id });
  if (errorMarca) throw new Error(`No se pudo sembrar la marca: ${errorMarca.message}`);
});

test.afterAll(async () => {
  await limpiarEncuesta();
  await setConfig('survey_enabled', valorOriginalFlag || 'false');

  for (const u of [participante, participanteSinMentor, juez]) {
    if (!u) continue;
    await db.from('profiles').delete().eq('id', u.id);
    await db.auth.admin.deleteUser(u.id).catch(() => {});
  }
});

test.describe('las tablas no se escriben por PostgREST', () => {
  test('un anónimo no puede insertar una respuesta', async () => {
    const anon = newApiClient();
    const { error } = await anon
      .from('encuesta_respuestas')
      .insert({ p1_general: 5, p2_mentoria: 5, p3_volveria: 'si' });
    expect(error).not.toBeNull();
  });

  test('un anónimo no puede insertar una marca', async () => {
    const anon = newApiClient();
    const { error } = await anon
      .from('encuesta_respondio')
      .insert({ user_id: '00000000-0000-0000-0000-000000000000' });
    expect(error).not.toBeNull();
  });

  test('un participante logueado tampoco puede insertar una respuesta', async () => {
    const { error } = await participante.client
      .from('encuesta_respuestas')
      .insert({ p1_general: 1, p2_mentoria: 1, p3_volveria: 'no' });
    expect(error).not.toBeNull();
  });

  test('la función que escribe no se puede invocar por PostgREST', async () => {
    // Está granteada sólo a service_role. Si alguien la abriera a
    // authenticated, se podría escribir saltándose todas las validaciones del
    // endpoint (el flag, el rol, el perfil completo).
    const anon = newApiClient();
    const { error: errorAnon } = await anon.rpc('registrar_respuesta_encuesta', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_p1: 5,
      p_p2: 5,
      p_p3: 'si',
      p_p4: null,
    });
    expect(errorAnon).not.toBeNull();

    const { error: errorLogueado } = await participante.client.rpc(
      'registrar_respuesta_encuesta',
      { p_user_id: participante.id, p_p1: 5, p_p2: 5, p_p3: 'si', p_p4: null },
    );
    expect(errorLogueado).not.toBeNull();
  });

  test('un participante no ve la respuesta sembrada de otra persona', async () => {
    // Hay una respuesta en la tabla (la del beforeAll): que devuelva 0 filas es
    // RLS trabajando, no la tabla vacía.
    const { data, error } = await participante.client
      .from('encuesta_respuestas')
      .select('*');
    expect(error).toBeNull();
    expect(data).toEqual([]);

    // Y con service role sí se ve, o sea que la fila existe de verdad.
    const { data: comoServicio } = await db
      .from('encuesta_respuestas')
      .select('id')
      .like('p4_cambiaria', '[e2e-seed]%');
    expect(comoServicio?.length).toBe(1);
  });

  test('un participante no ve la marca sembrada de otra persona', async () => {
    // La marca del juez está puesta desde el beforeAll.
    const { data, error } = await participante.client
      .from('encuesta_respondio')
      .select('*');
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: comoServicio } = await db
      .from('encuesta_respondio')
      .select('user_id')
      .eq('user_id', juez.id);
    expect(comoServicio?.length).toBe(1);
  });
});

test.describe('el endpoint', () => {
  test('rechaza GET con 405', async ({ baseURL }) => {
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.get('/api/encuesta');
    expect(res.status()).toBe(405);
    await ctx.dispose();
  });

  test('sin sesión responde 401', async ({ baseURL }) => {
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.post('/api/encuesta', {
      data: { p1_general: 5, p2_mentoria: 5, p3_volveria: 'si' },
    });
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });

  test('con la palanca apagada rechaza el POST tardío', async ({ page, baseURL }) => {
    // El caso real: alguien deja el formulario abierto y el admin apaga la
    // encuesta antes de que lo mande.
    await setConfig('survey_enabled', 'false');
    await loginUi(page, participante.email, E2E_PASSWORD);
    const status = await postConSesion(page, baseURL, {
      p1_general: 5,
      p2_mentoria: 5,
      p3_volveria: 'si',
      p4_cambiaria: '[e2e] tardío',
    });
    expect(status).toBe(403);
  });

  test('un juez no puede postear aunque esquive la redirección de la página', async ({
    page,
    baseURL,
  }) => {
    await setConfig('survey_enabled', 'true');
    await loginUi(page, juez.email, E2E_PASSWORD);
    const status = await postConSesion(page, baseURL, {
      p1_general: 5,
      p2_mentoria: 5,
      p3_volveria: 'si',
      p4_cambiaria: '[e2e] de un juez',
    });
    expect(status).toBe(403);
  });
});

test.describe('el flujo del participante', () => {
  test('con la encuesta apagada, la página no muestra el formulario', async ({ page }) => {
    await setConfig('survey_enabled', 'false');
    await loginUi(page, participante.email, E2E_PASSWORD);
    await page.goto('/encuesta');
    await expect(page.locator('#encuesta-form')).toHaveCount(0);
    await expect(page.locator('.encuesta-cerrada')).toBeVisible();
  });

  test('con la encuesta apagada, el dashboard no muestra el aviso', async ({ page }) => {
    await setConfig('survey_enabled', 'false');
    await loginUi(page, participante.email, E2E_PASSWORD);
    await expect(page.locator('.encuesta-strip')).toHaveCount(0);
  });

  test('encendida, el dashboard muestra el aviso y lleva a la encuesta', async ({ page }) => {
    await setConfig('survey_enabled', 'true');
    await loginUi(page, participante.email, E2E_PASSWORD);
    const aviso = page.locator('.encuesta-strip');
    await expect(aviso).toBeVisible();
    await aviso.click();
    await page.waitForURL(/\/encuesta/);
    await expect(page.locator('#encuesta-form')).toBeVisible();
  });

  test('responde y la respuesta queda guardada', async ({ page }) => {
    await setConfig('survey_enabled', 'true');
    await loginUi(page, participante.email, E2E_PASSWORD);
    await page.goto('/encuesta');

    // Los radio están ocultos por CSS (el patrón de botones grandes), así que
    // se clickea la etiqueta, que es lo que toca una persona de verdad.
    await page.locator('label:has(input[name="p1_general"][value="4"])').click();
    await page.locator('label:has(input[name="p2_mentoria"][value="5"])').click();
    await page.locator('label:has(input[name="p3_volveria"][value="si"])').click();
    await page.fill('#p4_cambiaria', COMENTARIO_UI);
    await page.click('#encuesta-submit');

    // Al guardar recarga y muestra el agradecimiento.
    await expect(page.locator('.encuesta-listo')).toBeVisible({ timeout: 15_000 });

    const { data } = await db
      .from('encuesta_respuestas')
      .select('*')
      .eq('p4_cambiaria', COMENTARIO_UI);
    expect(data?.length).toBe(1);
    expect(data![0].p1_general).toBe(4);
    expect(data![0].p2_mentoria).toBe(5);
    expect(data![0].p3_volveria).toBe('si');
  });

  test('ahora sí ve su propia marca, y sólo la suya', async () => {
    const { data } = await participante.client.from('encuesta_respondio').select('user_id');
    expect(data?.length).toBe(1);
    expect(data![0].user_id).toBe(participante.id);
  });

  test('la respuesta no guarda ninguna referencia a la persona', async () => {
    const { data } = await db
      .from('encuesta_respuestas')
      .select('*')
      .eq('p4_cambiaria', COMENTARIO_UI);
    const fila = data![0];
    expect(JSON.stringify(fila)).not.toContain(participante.id);
    expect(Object.keys(fila)).not.toContain('user_id');
  });

  test('la fecha se guarda sin hora, para no poder cruzarla con la marca', async () => {
    const { data } = await db
      .from('encuesta_respuestas')
      .select('responded_on')
      .eq('p4_cambiaria', COMENTARIO_UI);
    // Un DATE viaja como 'YYYY-MM-DD'. Si algún día pasa a timestamptz esto
    // falla, que es justo lo que se quiere: el anonimato depende de esto.
    expect(data![0].responded_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('no puede responder dos veces: el endpoint devuelve 409', async ({ page, baseURL }) => {
    await loginUi(page, participante.email, E2E_PASSWORD);
    const status = await postConSesion(page, baseURL, {
      p1_general: 1,
      p2_mentoria: 1,
      p3_volveria: 'no',
      p4_cambiaria: '[e2e] duplicado',
    });
    expect(status).toBe(409);

    // Y la transacción no dejó nada: ni una segunda respuesta.
    const { data } = await db
      .from('encuesta_respuestas')
      .select('id')
      .eq('p4_cambiaria', '[e2e] duplicado');
    expect(data?.length).toBe(0);
  });

  test('ya respondida, el dashboard deja de mostrar el aviso', async ({ page }) => {
    await loginUi(page, participante.email, E2E_PASSWORD);
    await expect(page.locator('.encuesta-strip')).toHaveCount(0);
  });

  test('"No trabajé con un mentor" se guarda como NULL y no entra en el promedio', async ({
    page,
  }) => {
    // Es el único camino que ejercita el paso de `null` por la RPC hasta un
    // smallint, y el que decide si el promedio de mentoría sale bien.
    await setConfig('survey_enabled', 'true');
    await loginUi(page, participanteSinMentor.email, E2E_PASSWORD);
    await page.goto('/encuesta');

    await page.locator('label:has(input[name="p1_general"][value="2"])').click();
    await page.locator('label:has(input[name="p2_mentoria"][value="sin_mentor"])').click();
    await page.locator('label:has(input[name="p3_volveria"][value="tal_vez"])').click();
    await page.fill('#p4_cambiaria', '[e2e] sin mentor');
    await page.click('#encuesta-submit');

    await expect(page.locator('.encuesta-listo')).toBeVisible({ timeout: 15_000 });

    const { data } = await db
      .from('encuesta_respuestas')
      .select('p2_mentoria')
      .eq('p4_cambiaria', '[e2e] sin mentor');
    expect(data?.length).toBe(1);
    expect(data![0].p2_mentoria).toBeNull();

    // El promedio ignora los NULL: con un 5 (del test de arriba) y este sin
    // mentor, el promedio sigue siendo 5, no 2.5.
    const { data: resultados } = await db.from('encuesta_resultados').select('*').single();
    expect(Number(resultados!.p2_promedio)).toBe(5);
    expect(Number(resultados!.p2_sin_mentor)).toBeGreaterThanOrEqual(1);
  });
});

test.describe('quien no es participante', () => {
  test('un juez que entra a /encuesta va a parar a su panel', async ({ page }) => {
    await setConfig('survey_enabled', 'true');
    await loginUi(page, juez.email, E2E_PASSWORD);
    await page.goto('/encuesta');
    await page.waitForURL(/\/evaluacion/, { timeout: 15_000 });
    expect(page.url()).toContain('/evaluacion');
  });
});
