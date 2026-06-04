// src/pages/api/send-bulletin.ts
import type { APIRoute } from 'astro';

export const POST: APIRoute = async (context) => {
  return new Response(JSON.stringify({ message: "API Route initialized" }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
