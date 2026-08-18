// src/pages/api/send-bulletin.ts
import type { APIRoute } from 'astro';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { isProfileComplete } from '../../utils/perfil';

export const ALL: APIRoute = async (context) => {
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: `Method ${context.request.method} not allowed` }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Allow': 'POST' }
    });
  }

  const { locals } = context;
  const user = locals.user;
  const profile = locals.profile;

  if (!user || !profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized. Admin or superadmin role required.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { subject, message, roleFilter = 'all' } = body;

  if (!subject || typeof subject !== 'string' || subject.trim() === '') {
    return new Response(JSON.stringify({ error: 'Subject is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (subject.length > 150) {
    return new Response(JSON.stringify({ error: 'Subject must be 150 characters or less.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return new Response(JSON.stringify({ error: 'Message is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (message.length > 5000) {
    return new Response(JSON.stringify({ error: 'Message must be 5000 characters or less.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 'incompleto' es el recordatorio a los registros abandonados. Es el único
  // segmento que NO va sobre aprobados: justamente son los que nunca
  // completaron el formulario, así que siguen en estado pendiente.
  const validFilters = ['all', 'participant', 'mentor', 'juez', 'incompleto'];
  if (!validFilters.includes(roleFilter)) {
    return new Response(JSON.stringify({ error: 'Invalid role filter.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 1.5 Obtener los destinatarios desde Supabase
  const supabase = createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          try {
            return parseCookieHeader(context.request.headers.get("Cookie") ?? "");
          } catch {
            return [];
          }
        },
        setAll() {},
      },
    }
  );

  let query = supabase
    .from('profiles')
    .select('email, first_name, last_name, full_name, role');

  if (roleFilter !== 'incompleto') {
    query = query.eq('registration_status', 'aprobado');

    if (roleFilter === 'participant') {
      query = query.eq('role', 'usuario');
    } else if (roleFilter === 'mentor') {
      query = query.eq('role', 'mentor');
    } else if (roleFilter === 'juez') {
      query = query.eq('role', 'juez');
    }
  }

  const { data: recipientsData, error: dbError } = await query;

  if (dbError) {
    console.error("Database error fetching recipients:", dbError);
    return new Response(JSON.stringify({ error: 'Failed to fetch recipients from database.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const recipients = (recipientsData || [])
    .filter((r): r is { email: string; first_name?: string; last_name?: string; full_name?: string; role: string } =>
      typeof r.email === 'string' && r.email.trim() !== ''
    )
    // El descarte de los perfiles completos se hace acá y no en la query para
    // que el criterio salga de `isProfileComplete()`, que también contempla el
    // campo cargado con espacios. Un `.is('first_name', null)` en SQL dejaría
    // pasar esos casos y le mandaría el recordatorio a alguien que ya completó.
    .filter(r => roleFilter !== 'incompleto' || !isProfileComplete(r))
    .map(r => {
      let name = 'Participante';
      if (r.first_name && r.first_name.trim() !== '') {
        name = r.first_name.trim();
      } else if (r.full_name && r.full_name.trim() !== '') {
        name = r.full_name.trim().split(' ')[0];
      }
      // El nombre lo define el usuario y Brevo lo inserta sin escapar en el HTML del email
      name = name.replace(/[<>&"']/g, '');
      return {
        email: r.email.trim(),
        name: name
      };
    });

  if (recipients.length === 0) {
    return new Response(JSON.stringify({
      error: roleFilter === 'incompleto'
        ? 'No hay registros incompletos: todos completaron el formulario.'
        : 'No approved recipients found for the selected filter.'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 1.6 Construir el template HTML del email con el branding del evento
  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const formattedMessage = message
    .split('\n')
    .map(paragraph => {
      const trimmed = paragraph.trim();
      return trimmed !== '' ? `<p style="margin-bottom: 16px; line-height: 1.6; color: #cbd5e1;">${escapeHtml(trimmed)}</p>` : '';
    })
    .filter(p => p !== '')
    .join('');

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0f172a;
      color: #f1f5f9;
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body style="background-color: #0f172a; color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 20px; margin: 0;">
  <table cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155;">
    <!-- Header with brand gradient -->
    <tr>
      <td style="background: linear-gradient(135deg, #88007b 0%, #9fc637 100%); padding: 35px 20px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
          HEM 2026
        </h1>
        <p style="color: #f1f5f9; margin: 6px 0 0 0; font-size: 14px; font-weight: 500; letter-spacing: 0.02em;">
          Hackathon EduTech Mendoza
        </p>
      </td>
    </tr>
    <!-- Content Body -->
    <tr>
      <td style="padding: 35px 25px;">
        <p style="font-size: 16px; font-weight: 700; color: #f8fafc; margin-top: 0; margin-bottom: 20px;">
          ¡Hola {{ params.FNAME }}!
        </p>
        <div style="font-size: 15px; color: #cbd5e1; line-height: 1.6;">
          ${formattedMessage}
        </div>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background-color: #0f172a; padding: 25px 20px; text-align: center; border-top: 1px solid #334155;">
        <p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0; line-height: 1.4;">
          Recibiste este correo porque estás registrado en la Hackathon EduTech Mendoza 2026.
        </p>
        <p style="color: #475569; font-size: 11px; margin: 0;">
          © 2026 Hackathon EduTech Mendoza. Desarrollado por IES 9-023 e IES Tomás Alva Edison.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // 1.7 Dividir los destinatarios en lotes de 99 (límite de Brevo por messageVersion)
  const batchSize = 99;
  const batches: typeof recipients[] = [];
  for (let i = 0; i < recipients.length; i += batchSize) {
    batches.push(recipients.slice(i, i + batchSize));
  }

  // 1.8 Enviar cada lote a Brevo y 1.9 Manejar errores
  const BREVO_API_KEY = import.meta.env.BREVO_API_KEY || process.env.BREVO_API_KEY;
  const BREVO_SENDER_EMAIL = import.meta.env.BREVO_SENDER_EMAIL || process.env.BREVO_SENDER_EMAIL;
  const BREVO_SENDER_NAME = import.meta.env.BREVO_SENDER_NAME || process.env.BREVO_SENDER_NAME;

  if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL || !BREVO_SENDER_NAME) {
    console.error("Missing Brevo environment variables");
    return new Response(JSON.stringify({ error: 'Mailing service is not properly configured.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let sentCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const messageVersions = batch.map(r => ({
      to: [{ email: r.email, name: r.name }],
      params: { FNAME: r.name }
    }));

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': BREVO_API_KEY,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: {
            name: BREVO_SENDER_NAME,
            email: BREVO_SENDER_EMAIL
          },
          subject: subject,
          htmlContent: htmlContent,
          messageVersions: messageVersions
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Brevo API error for batch ${i + 1}:`, errorText);
        failedCount += batch.length;
        errors.push(`Lote ${i + 1}: ${response.status} - ${errorText}`);
      } else {
        sentCount += batch.length;
      }
    } catch (err: any) {
      console.error(`Network error sending batch ${i + 1} to Brevo:`, err);
      failedCount += batch.length;
      errors.push(`Lote ${i + 1}: ${err.message || 'Network error'}`);
    }
  }

  // 1.10 Retornar respuesta JSON al frontend
  if (sentCount === 0) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to send all batches.', 
      details: errors 
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ 
    success: true, 
    recipientCount: sentCount,
    failedCount: failedCount,
    errors: errors.length > 0 ? errors : undefined
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
