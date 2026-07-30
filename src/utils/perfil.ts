// src/utils/perfil.ts
// Normalización de los campos de contacto del perfil, para que mentores y
// admin reciban siempre el mismo formato sin importar cómo lo escribió la
// persona. Se usa en onboarding y en la edición del perfil del dashboard.

/**
 * Deja un handle de Instagram limpio: sin `@`, sin espacios y sin la URL
 * completa. Instagram no distingue mayúsculas, así que se guarda en minúscula
 * para que dos personas no queden con "Juan" y "juan" como si fueran distintos.
 *
 *   "@Juan.Perez"                        -> "juan.perez"
 *   "https://www.instagram.com/juan/"    -> "juan"
 *   "instagram.com/juan?igshid=abc"      -> "juan"
 *   "  "                                 -> null
 */
export function normalizeInstagram(input: string | null | undefined): string | null {
  if (!input) return null;

  let handle = input.trim();

  // URL completa o pegada del navegador: nos queda el primer segmento del path.
  handle = handle.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '');
  handle = handle.split(/[/?#]/)[0];

  // Un `@` al principio es lo más común; también se limpia si quedó suelto.
  handle = handle.replace(/^@+/, '');

  // Instagram solo admite letras, números, punto y guion bajo.
  handle = handle.replace(/[^A-Za-z0-9._]/g, '').toLowerCase();

  return handle || null;
}

/**
 * Deja solo los dígitos del teléfono, igual que se hace con el DNI. El `+` y
 * el `0`/`15` de los formatos locales se pierden a propósito: lo que se guarda
 * es la secuencia de dígitos que después se usa para armar el link de WhatsApp.
 *
 *   "+54 9 261 536-5167"  -> "5492615365167"
 *   "(261) 536 5167"      -> "2615365167"
 *   "  "                  -> null
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, '');
  return digits || null;
}
