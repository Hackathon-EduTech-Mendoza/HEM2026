// src/pages/api/send-bulletin.ts
import type { APIRoute } from 'astro';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';

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

  const validFilters = ['all', 'participant', 'mentor'];
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
    .select('email, first_name, full_name, role')
    .eq('registration_status', 'aprobado');

  if (roleFilter === 'participant') {
    query = query.eq('role', 'usuario');
  } else if (roleFilter === 'mentor') {
    query = query.eq('role', 'mentor');
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
    .filter((r): r is { email: string; first_name?: string; full_name?: string; role: string } => 
      typeof r.email === 'string' && r.email.trim() !== ''
    )
    .map(r => {
      let name = 'Participante';
      if (r.first_name && r.first_name.trim() !== '') {
        name = r.first_name.trim();
      } else if (r.full_name && r.full_name.trim() !== '') {
        name = r.full_name.trim().split(' ')[0];
      }
      return {
        email: r.email.trim(),
        name: name
      };
    });

  if (recipients.length === 0) {
    return new Response(JSON.stringify({ error: 'No approved recipients found for the selected filter.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ message: "API Route initialized", data: { subject, message, roleFilter, recipientsCount: recipients.length } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
