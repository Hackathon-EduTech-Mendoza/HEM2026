// src/pages/api/encuesta.ts
//
// Recibe la encuesta post evento (4 preguntas, participantes, anónima).
//
// Es el ÚNICO camino de entrada a `encuesta_respondio` y a
// `encuesta_respuestas`: ninguna de las dos tiene policy de INSERT, así que
// nadie las escribe por PostgREST. Acá se valida la sesión, el rol, la palanca
// y el duplicado, y recién entonces se escribe con la service role key.
//
// ⚠️ LOS DOS INSERT VAN EN UNA FUNCIÓN, NO ACÁ. `registrar_respuesta_encuesta`
// escribe la marca de "ya respondió" y la respuesta en una sola transacción,
// así que un corte en el medio no puede dejar una sin la otra. La marca va
// primero y su PK sobre user_id es la que resuelve la carrera de dos pedidos
// simultáneos: el segundo choca y vuelve como 'duplicado' → 409.
//
// No se guarda ninguna relación entre la persona y lo que respondió: son dos
// tablas sin vínculo, y las dos guardan sólo la fecha, no la hora. El detalle
// está en supabase/migrations/20260824_02_encuesta_post_evento.sql.
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { validarRespuesta } from '../../utils/encuesta';
import { isProfileComplete } from '../../utils/perfil';

export const prerender = false;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const ALL: APIRoute = async (context) => {
  if (context.request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: `Method ${context.request.method} not allowed` }),
      { status: 405, headers: { 'Content-Type': 'application/json', Allow: 'POST' } },
    );
  }

  const user = context.locals.user;
  const profile = context.locals.profile;

  if (!user || !profile) {
    return json({ error: 'Necesitás iniciar sesión para responder.' }, 401);
  }

  // La encuesta es de participantes. Jueces, mentores y staff no la responden:
  // sus preguntas serían otras y mezclarlas ensucia los promedios.
  if (profile.role !== 'usuario') {
    return json({ error: 'La encuesta es para los participantes.' }, 403);
  }

  // Mismo criterio que el dashboard, que sólo muestra las palancas a los
  // aprobados: quien nunca quedó inscripto no participó del evento.
  if (profile.registration_status !== 'aprobado') {
    return json({ error: 'La encuesta es para los inscriptos al evento.' }, 403);
  }

  // El middleware manda a /onboarding a quien no terminó el perfil, pero eso
  // sólo cubre las páginas: `/api/encuesta` no matchea `/encuesta`, así que sin
  // este chequeo un perfil a medias podría postear directo contra el endpoint.
  if (!isProfileComplete(profile)) {
    return json({ error: 'Necesitás completar tu perfil primero.' }, 403);
  }

  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Cuerpo inválido.' }, 400);
  }

  // La validación vive en src/utils/encuesta.ts para que la cubran los tests
  // unitarios, que son los que corren en CI.
  const validacion = validarRespuesta(body);
  if (!validacion.ok) {
    return json({ error: validacion.error }, 400);
  }
  const { p1_general, p2_mentoria, p3_volveria, p4_cambiaria } = validacion.valor;

  const SUPABASE_URL =
    import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE_KEY =
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[encuesta] Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    return json({ error: 'La encuesta no está configurada. Avisanos por favor.' }, 500);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // La palanca se chequea acá también, no sólo en la página: si alguien guarda
  // el formulario abierto y el admin apaga la encuesta, el envío tardío no entra.
  const { data: flagRow, error: flagError } = await admin
    .from('event_config')
    .select('value')
    .eq('key', 'survey_enabled')
    // maybeSingle y no single: si la fila no existe (base sin la migración)
    // single devuelve PGRST116 y saldría por el 500 genérico, cuando lo que
    // corresponde decir es que la encuesta no está abierta.
    .maybeSingle();

  if (flagError) {
    console.error('[encuesta] No se pudo leer survey_enabled:', flagError.message);
    return json({ error: 'No pudimos registrar tu respuesta. Probá en un rato.' }, 500);
  }
  if (flagRow?.value !== 'true') {
    return json({ error: 'La encuesta no está abierta.' }, 403);
  }

  // Las dos filas entran juntas o no entra ninguna: la función corre en una
  // sola transacción. Con dos INSERT sueltos, un corte en el medio (timeout,
  // cold start, un deploy justo ahí) dejaría la marca sin su respuesta y esa
  // persona vería "ya respondiste" para siempre, sin forma de detectarlo.
  const { data: resultado, error: rpcError } = await admin.rpc(
    'registrar_respuesta_encuesta',
    {
      p_user_id: user.id,
      p_p1: p1_general,
      p_p2: p2_mentoria,
      p_p3: p3_volveria,
      p_p4: p4_cambiaria,
    },
  );

  if (rpcError) {
    console.error('[encuesta] No se pudo guardar:', rpcError.message);
    return json({ error: 'No pudimos registrar tu respuesta. Probá en un rato.' }, 500);
  }

  if (!resultado?.ok) {
    if (resultado?.error === 'duplicado') {
      return json({ error: 'Ya respondiste la encuesta. ¡Gracias!' }, 409);
    }
    console.error('[encuesta] La función rechazó la respuesta:', resultado?.error);
    return json({ error: 'No pudimos registrar tu respuesta. Probá en un rato.' }, 500);
  }

  return json({ success: true }, 200);
};
