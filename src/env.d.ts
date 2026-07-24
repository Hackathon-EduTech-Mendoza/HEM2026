// src/env.d.ts
// Tipado global de Astro: extiende App.Locals con la sesión y perfil del usuario.

/// <reference types="astro/client" />

type UserRole = 'superadmin' | 'admin' | 'juez' | 'mentor' | 'usuario';

interface UserProfile {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  professional_title: string | null;
  email: string;
  role: UserRole;
  institution: string | null;
  /** Nombre libre de la institución cuando `institution` es 'otra'. */
  institution_other: string | null;
  dni: string | null;
  phone_whatsapp: string | null;
  instagram_handle: string | null;
  year_of_study: string | null;
  disciplinary_profile: string | null;
  is_egresado: boolean;
  registration_status: 'pendiente' | 'aprobado' | 'rechazado';
  team_id: string | null;
}

declare namespace App {
  interface Locals {
    /** Usuario autenticado. null si la sesión no existe o expiró. */
    user: import('@supabase/supabase-js').User | null;
    /** Perfil completo de la tabla public.profiles. null si no está autenticado. */
    profile: UserProfile | null;
  }
}
