// src/pages/api/send-bulletin.ts
import type { APIRoute } from 'astro';

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

  return new Response(JSON.stringify({ message: "API Route initialized" }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
