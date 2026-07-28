// src/utils/noticias.ts
import { getCollection, type CollectionEntry } from 'astro:content';

export type Noticia = CollectionEntry<'noticias'>;

/** "2026-07-28" -> "28 de Julio, 2026" */
export function formatearFecha(fecha: Date): string {
  const mes = fecha.toLocaleDateString('es-AR', {
    month: 'long',
    timeZone: 'UTC',
  });
  const dia = fecha.getUTCDate().toString().padStart(2, '0');
  return `${dia} de ${mes.charAt(0).toUpperCase()}${mes.slice(1)}, ${fecha.getUTCFullYear()}`;
}

/** Una noticia tiene página propia solo si trae cuerpo en markdown. */
export function tieneNotaInterna(noticia: Noticia): boolean {
  return Boolean(noticia.body?.trim());
}

/**
 * A dónde apunta la tarjeta: al medio si es prensa, a la nota interna si tiene
 * cuerpo, o a ningún lado (los avisos cortos no llevan "Leer más").
 */
export function enlaceDeNoticia(noticia: Noticia): string | undefined {
  if (noticia.data.url) return noticia.data.url;
  if (tieneNotaInterna(noticia)) return `/noticias/${noticia.id}`;
  return undefined;
}

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

/** Todas las noticias, de la más nueva a la más vieja. */
export async function getNoticias(limite?: number): Promise<Noticia[]> {
  const noticias = await getCollection('noticias');
  noticias.sort((a, b) => b.data.fecha.getTime() - a.data.fecha.getTime());
  return limite ? noticias.slice(0, limite) : noticias;
}
