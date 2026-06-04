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

  return new Response(JSON.stringify({ message: "API Route initialized", data: { subject, message, roleFilter } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
