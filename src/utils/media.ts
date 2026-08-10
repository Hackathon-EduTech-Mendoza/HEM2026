// src/utils/media.ts
// Extractores de ID para los embeds de las notas. Viven acá y no en
// `noticias.ts` porque ese módulo importa `astro:content`, que fuera del build
// de Astro no resuelve y deja los helpers fuera del alcance de los unitarios.

/**
 * Acepta el ID pelado o cualquier forma de URL de YouTube (watch, youtu.be,
 * shorts, embed) y devuelve el ID para armar el iframe.
 */
export function idDeYoutube(valor: string): string {
  const limpio = valor.trim();
  // Ya es un ID: 11 caracteres sin barras ni puntos.
  if (/^[\w-]{11}$/.test(limpio)) return limpio;
  const patrones = [
    /[?&]v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /\/(?:embed|shorts|live|v)\/([\w-]{11})/,
  ];
  for (const patron of patrones) {
    const match = limpio.match(patron);
    if (match) return match[1];
  }
  // Sin coincidencia devolvemos lo recibido: el iframe fallará de forma
  // visible en vez de romper el build.
  return limpio;
}

/**
 * Acepta el ID pelado, el URI `spotify:episode:<id>` o cualquier forma de URL
 * de Spotify (con `/intl-es/`, con `?si=`, o la de `/embed/`) y devuelve el ID
 * para armar el iframe.
 */
export function idDeSpotify(valor: string): string {
  const limpio = valor.trim();
  // Ya es un ID: 22 caracteres base62, sin barras ni dos puntos.
  if (/^[A-Za-z0-9]{22}$/.test(limpio)) return limpio;
  const patrones = [
    /spotify:episode:([A-Za-z0-9]{22})/,
    /\/episode\/([A-Za-z0-9]{22})/,
  ];
  for (const patron of patrones) {
    const match = limpio.match(patron);
    if (match) return match[1];
  }
  // Mismo criterio que idDeYoutube: sin coincidencia devolvemos lo recibido,
  // para que el iframe falle de forma visible en vez de romper el build.
  return limpio;
}
