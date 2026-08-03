// src/pages/api/consulta.ts
//
// Recibe las consultas del formulario público del sitio (#consultas).
//
// Es el ÚNICO camino de entrada a la tabla `consultas`: la tabla no tiene policy
// de INSERT, así que ni anon ni un usuario logueado pueden escribirla por
// PostgREST. Acá se valida, se filtra el spam y recién entonces se escribe con
// la service role key, que saltea RLS.
//
// La consulta se guarda ANTES de intentar el mail: si Brevo falla, la consulta
// ya está en la base y el admin la ve igual. Al revés se perdería.
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { EMAIL } from '../../utils/contacto';

export const prerender = false;

/** Límite por IP: 3 consultas cada 10 minutos. */
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_VENTANA_MS = 10 * 60 * 1000;

/**
 * Memoria del rate limit. Vive en el proceso, así que en serverless se reinicia
 * con cada instancia fría: frena el envío repetido de una misma persona, no un
 * ataque distribuido.
 *
 * ⚠️ Sólo se cuentan las consultas que efectivamente entraron. Si además se
 * contaran los intentos inválidos, alguien que se equivoca tres veces al tipear
 * el correo se quedaría 10 minutos afuera sin haber mandado nada.
 */
const envios = new Map<string, number[]>();

function vigentes(ip: string, ahora: number): number[] {
  return (envios.get(ip) ?? []).filter((t) => ahora - t < RATE_LIMIT_VENTANA_MS);
}

function limiteExcedido(ip: string): boolean {
  const ahora = Date.now();
  const previos = vigentes(ip, ahora);
  envios.set(ip, previos);
  return previos.length >= RATE_LIMIT_MAX;
}

/** Se llama recién cuando la consulta quedó guardada (o la mandó un bot). */
function registrarEnvio(ip: string): void {
  const ahora = Date.now();
  envios.set(ip, [...vigentes(ip, ahora), ahora]);

  // La memoria no crece sin techo: se limpian las IPs que ya no tienen envíos vivos.
  if (envios.size > 500) {
    for (const [k, v] of envios) {
      if (v.every((t) => ahora - t >= RATE_LIMIT_VENTANA_MS)) envios.delete(k);
    }
  }
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Mismo criterio que el CHECK de la base, para fallar temprano y con mejor mensaje. */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const ALL: APIRoute = async (context) => {
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: `Method ${context.request.method} not allowed` }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', Allow: 'POST' },
    });
  }

  const ip =
    context.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    context.clientAddress ||
    'desconocida';

  if (limiteExcedido(ip)) {
    return json(
      { error: 'Recibimos varias consultas tuyas en los últimos minutos. Probá de nuevo más tarde.' },
      429
    );
  }

  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  // Honeypot: un campo invisible que una persona nunca completa y un bot sí.
  // Se responde 200 a propósito, para no enseñarle al bot que fue detectado.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    registrarEnvio(ip);
    return json({ success: true }, 200);
  }

  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const mensaje = typeof body.mensaje === 'string' ? body.mensaje.trim() : '';

  if (nombre.length < 2 || nombre.length > 120) {
    return json({ error: 'Escribinos tu nombre (entre 2 y 120 caracteres).' }, 400);
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json({ error: 'Revisá el correo: no parece una dirección válida.' }, 400);
  }
  if (mensaje.length < 10 || mensaje.length > 2000) {
    return json({ error: 'La consulta tiene que tener entre 10 y 2000 caracteres.' }, 400);
  }

  const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE_KEY =
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[consulta] Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    return json({ error: 'El canal de consultas no está configurado. Escribinos por mail.' }, 500);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin
    .from('consultas')
    .insert({
      nombre,
      email,
      mensaje,
      origen: context.request.headers.get('referer') ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[consulta] No se pudo guardar:', error.message);
    return json({ error: 'No pudimos registrar tu consulta. Probá de nuevo en un rato.' }, 500);
  }

  registrarEnvio(ip);

  // El mail es el aviso, no el registro. Si falla, la consulta ya está guardada,
  // así que se loguea y se responde éxito igual.
  const BREVO_API_KEY = import.meta.env.BREVO_API_KEY || process.env.BREVO_API_KEY;
  const BREVO_SENDER_EMAIL = import.meta.env.BREVO_SENDER_EMAIL || process.env.BREVO_SENDER_EMAIL;
  const BREVO_SENDER_NAME = import.meta.env.BREVO_SENDER_NAME || process.env.BREVO_SENDER_NAME;

  if (BREVO_API_KEY && BREVO_SENDER_EMAIL && BREVO_SENDER_NAME) {
    const escapar = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': BREVO_API_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
          to: [{ email: EMAIL, name: 'Hackathon EduTech' }],
          // Responder al mail va directo a quien consultó, sin copiar la dirección a mano.
          replyTo: { email, name: nombre },
          subject: `Nueva consulta desde el sitio — ${nombre}`,
          htmlContent: `<html><body style="font-family: sans-serif; color: #1e293b;">
  <h2 style="margin: 0 0 16px;">Nueva consulta desde hackathonedutech.com.ar</h2>
  <p style="margin: 0 0 4px;"><strong>Nombre:</strong> ${escapar(nombre)}</p>
  <p style="margin: 0 0 16px;"><strong>Correo:</strong> ${escapar(email)}</p>
  <p style="margin: 0 0 8px;"><strong>Consulta:</strong></p>
  <div style="white-space: pre-wrap; padding: 12px 16px; background: #f1f5f9; border-radius: 8px; line-height: 1.6;">${escapar(mensaje)}</div>
  <p style="margin: 20px 0 0; font-size: 13px; color: #64748b;">
    Respondiendo a este correo le escribís directamente a ${escapar(email)}.
    La consulta también quedó guardada en el panel de administración.
  </p>
</body></html>`,
        }),
      });

      if (!res.ok) {
        console.error(`[consulta ${data.id}] Brevo respondió ${res.status}:`, await res.text());
      }
    } catch (err: any) {
      console.error(`[consulta ${data.id}] Error de red al avisar por mail:`, err?.message ?? err);
    }
  } else {
    console.warn(`[consulta ${data.id}] Guardada, pero sin aviso por mail: falta configurar Brevo.`);
  }

  return json({ success: true }, 200);
};
