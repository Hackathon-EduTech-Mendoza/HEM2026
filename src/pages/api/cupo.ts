// src/pages/api/cupo.ts
//
// Devuelve cuántos lugares de participante quedan. Lo consume el aviso de cupo
// del sitio público (barra fija + chip del hero).
//
// Por qué un endpoint y no un dato de build: las páginas públicas se
// prerenderizan, así que un conteo hecho en build queda congelado hasta el
// próximo deploy. Y la inscripción se mueve rápido — llegó a saltar 26 lugares
// en una sola tarde. Un número viejo en un cartel que dice "quedan N lugares"
// es peor que no mostrarlo.
//
// Por qué service role y no la anon key desde el navegador: contar `profiles`
// con la anon key exigiría abrir una policy de SELECT sobre la tabla de
// perfiles. Acá sale un único entero y nunca una fila, así que el dato personal
// no se expone. Mismo criterio que `consulta.ts`.
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { CUPO_MAXIMO, calcularCupo } from '../../utils/cupo';

export const prerender = false;

/**
 * Cache corta en el CDN. El número no necesita ser exacto al segundo y esto
 * evita que cada visita del home pegue una consulta a la base.
 */
const CACHE_SEGUNDOS = 60;

const json = (body: unknown, status = 200, cache = false) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(cache
        ? { 'Cache-Control': `public, max-age=${CACHE_SEGUNDOS}, s-maxage=${CACHE_SEGUNDOS}` }
        : { 'Cache-Control': 'no-store' }),
    },
  });

export const GET: APIRoute = async () => {
  const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE_KEY =
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[cupo] Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    return json({ error: 'Cupo no disponible' }, 503);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Quiénes ocupan cupo:
  //
  //   role = 'usuario'  -> el rol de participante. Mentores, jueces y staff NO
  //                        ocupan lugar (criterio de Martín, 2026-08-20). Por
  //                        eso el total de perfiles es bastante mayor que este
  //                        número: al 20/08 eran 306 perfiles contra 258
  //                        participantes.
  //
  // ⚠️ A propósito NO se filtra por perfil completo: un registro sin terminar el
  // onboarding TAMBIÉN reserva lugar. Es lo que pidió Martín y es lo coherente
  // con cerrar la inscripción en el alta de la cuenta.
  //
  // Desde el 2026-08-24 este es EL conteo: mueve el cartel y además decide
  // `hayLugar`, o sea si se puede crear una cuenta de participante. Es el mismo
  // criterio que cuenta el trigger `enforce_max_participants`
  // (20260824_03_cupo_cuenta_registros.sql). Si los dos se separan, el sitio
  // vuelve a prometer lugares que la base rechaza.
  //
  // ⚠️ Ojo con leer este número como "258 personas eligieron ser participantes".
  // La columna `role` tiene DEFAULT 'usuario', y el rol se elige recién en el
  // onboarding: los que están sin completar figuran como participantes porque
  // nadie tocó nada todavía, no porque lo hayan decidido. El conteo los toma
  // igual, pero es una sobreestimación deliberada, no un dato de intención.

  // Conteo 1: el conservador, para el cartel público.
  const todos = admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'usuario');

  // Conteo 2: cuántos de esos ya completaron el perfil. ⚠️ INFORMATIVO: no
  // decide nada desde el 24/08. Sirve para el panel y para dimensionar cuánta
  // gente va a estar haciendo onboarding el día del evento (la diferencia
  // contra el conteo 1 es exactamente esa cola). Sigue el criterio de
  // `isProfileComplete` en `utils/perfil.ts`.
  const completos = admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'usuario')
    .not('first_name', 'is', null)
    .not('last_name', 'is', null)
    .neq('first_name', '')
    .neq('last_name', '');

  // El tope sale de `event_config`, igual que lo lee el trigger. Si viviera solo
  // en la constante del código, mover el cupo sin deploy (la palanca que tiene
  // el admin) cambiaría el candado de la base pero NO el cartel: el sitio
  // seguiría anunciando 300 mientras la base ya usa otro número.
  const tope = admin
    .from('event_config')
    .select('value')
    .eq('key', 'max_participants')
    .maybeSingle();

  const [rTodos, rCompletos, rTope] = await Promise.all([todos, completos, tope]);

  // Un tope ilegible no es motivo para dejar el sitio sin aviso: se cae a la
  // constante, que es el valor acordado.
  const maximo = Number.parseInt(String(rTope.data?.value ?? ''), 10);

  if (rTodos.error || rCompletos.error) {
    console.error(
      '[cupo] No se pudo contar participantes:',
      rTodos.error?.message ?? rCompletos.error?.message,
    );
    return json({ error: 'Cupo no disponible' }, 503);
  }

  return json(
    calcularCupo(
      rTodos.count ?? 0,
      rCompletos.count ?? 0,
      Number.isFinite(maximo) ? maximo : CUPO_MAXIMO,
    ),
    200,
    true,
  );
};
