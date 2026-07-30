// src/pages/rss.xml.ts
// Feed de las noticias del evento, para que un medio o la DGE pueda sindicar
// las novedades sin depender de que alguien les avise.

import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getNoticias, enlaceDeNoticia } from '../utils/noticias';

// Es contenido estático: se genera en el build y no necesita servidor.
export const prerender = true;

export async function GET(context: APIContext) {
  const noticias = await getNoticias();

  return rss({
    title: 'Noticias | Hackathon EduTech Mendoza 2026',
    description:
      'Novedades de la Hackathon EduTech Mendoza 2026: convocatoria, cronograma, sedes y cobertura de prensa.',
    // `context.site` sale de `site` en astro.config.mjs.
    site: context.site!,
    items: noticias.map((noticia) => {
      const enlace = enlaceDeNoticia(noticia);
      return {
        title: noticia.data.titulo,
        pubDate: noticia.data.fecha,
        description: noticia.data.extracto,
        categories: [noticia.data.categoria],
        // Prensa externa apunta al medio; las notas internas, a su página.
        // Los avisos cortos no tienen destino: quedan con el link del sitio.
        link: enlace ?? '/noticias',
      };
    }),
    customData: '<language>es-AR</language>',
  });
}
