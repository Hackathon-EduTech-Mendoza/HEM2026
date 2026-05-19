// src/middleware.ts
// Middleware global de Astro: autenticación, sesión y protección de rutas.

import { defineMiddleware } from 'astro:middleware';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';

/** Rutas que requieren haber iniciado sesión */
const PROTECTED_ROUTES = ['/dashboard', '/admin', '/evaluacion', '/mentoria'];

/** Rutas que requieren rol admin o superadmin */
const ADMIN_ROUTES = ['/admin'];

/** Rutas exclusivas para jueces */
const JUDGE_ROUTES = ['/evaluacion'];

/** Rutas exclusivas para mentores */
const MENTOR_ROUTES = ['/mentoria'];

/** Rutas de auth: si el usuario ya está logueado, redirigir al dashboard */
const AUTH_ROUTES = ['/login', '/registro'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, cookies, locals, redirect } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // ──────────────────────────────────────────────────
  // 1. Crear cliente Supabase SSR (lee/escribe cookies)
  // ──────────────────────────────────────────────────
  const supabase = createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          try {
            return parseCookieHeader(request.headers.get('Cookie') ?? '');
          } catch {
            return [];
          }
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // ──────────────────────────────────────────────────
  // 2. Obtener el usuario actual (verificado con el servidor)
  // ──────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser();

  // Valores por defecto en locals
  locals.user = user ?? null;
  locals.profile = null;

  // ──────────────────────────────────────────────────
  // 3. Si hay usuario, cargar su perfil desde profiles
  // ──────────────────────────────────────────────────
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    locals.profile = profile ?? null;
  }

  // ──────────────────────────────────────────────────
  // 4. Protección de rutas
  // ──────────────────────────────────────────────────

  const isProtected = PROTECTED_ROUTES.some(r => pathname.startsWith(r));
  const isAdminRoute = ADMIN_ROUTES.some(r => pathname.startsWith(r));
  const isAuthRoute  = AUTH_ROUTES.some(r => pathname.startsWith(r));

  // Rutas protegidas: redirigir a /login si no hay sesión
  if (isProtected && !user) {
    return redirect('/login');
  }

  // Rutas de admin: redirigir a /dashboard si el rol no es suficiente
  if (isAdminRoute && user) {
    const role = locals.profile?.role;
    if (role !== 'admin' && role !== 'superadmin') {
      return redirect('/dashboard');
    }
  }

  // Control de acceso a Dashboard vs Otros paneles según el rol
  if (pathname.startsWith('/dashboard') && user) {
    if (locals.profile?.role === 'juez') {
      return redirect('/evaluacion');
    }
    if (locals.profile?.role === 'mentor') {
      return redirect('/mentoria');
    }
  }

  // Protección de rutas exclusivas de juez
  const isJudgeRoute = JUDGE_ROUTES.some(r => pathname.startsWith(r));
  if (isJudgeRoute && user) {
    if (locals.profile?.role !== 'juez' && locals.profile?.role !== 'admin' && locals.profile?.role !== 'superadmin') {
      return redirect('/dashboard');
    }
  }

// Protección de rutas exclusivas de mentor
const isMentorRoute = MENTOR_ROUTES.some(r => pathname.startsWith(r));
if (isMentorRoute && user) {
	const role = locals.profile?.role;
	if (role === 'juez') {
		return redirect('/evaluacion');
	}
	if (role !== 'mentor' && role !== 'admin' && role !== 'superadmin') {
		return redirect('/dashboard');
	}
}

  // Rutas de auth (/login, /registro): si ya hay sesión, redirigir
  if (isAuthRoute && user) {
    if (locals.profile?.role === 'juez') {
      return redirect('/evaluacion');
    }
    if (locals.profile?.role === 'mentor') {
      return redirect('/mentoria');
    }
    return redirect('/dashboard');
  }

  return next();
});
