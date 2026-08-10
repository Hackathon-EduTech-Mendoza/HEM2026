// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Noticias del evento. Cada archivo en src/content/noticias/ es una noticia.
 *
 * Hay tres tipos, y el que corresponde sale solo del frontmatter:
 *   1. Prensa externa -> definir `url` (+ `fuente`). La tarjeta abre el medio.
 *   2. Nota interna   -> escribir el cuerpo en markdown debajo del frontmatter.
 *                        Se genera la página /noticias/<slug> y la tarjeta apunta ahí.
 *   3. Aviso corto    -> sin `url` y sin cuerpo. Solo tarjeta, sin "Leer más".
 */
const noticias = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/noticias' }),
  schema: z.object({
    titulo: z.string(),
    /** Se escribe como YYYY-MM-DD; ordena el listado de más nueva a más vieja. */
    fecha: z.date(),
    categoria: z.string(),
    extracto: z.string(),
    /** Color de acento de la tarjeta. */
    color: z.enum(['c1', 'c2']).default('c1'),
    /** Solo para prensa externa. */
    url: z.string().url().optional(),
    fuente: z.string().optional(),
    /**
     * Portada, relativa a /public. Cada nota tiene su carpeta propia:
     * "/img/noticias/<slug>/portada.webp"
     */
    imagen: z.string().optional(),
    imagenAlt: z.string().optional(),
    /** Fotos adicionales que se muestran al pie de la nota interna. */
    galeria: z
      .array(z.object({ src: z.string(), alt: z.string() }))
      .default([]),
    /**
     * Videos de la nota. Cada uno lleva `youtube` (recomendado: ID o URL) o
     * `src` (archivo propio en /video/noticias/<slug>/), nunca los dos.
     */
    videos: z
      .array(
        z
          .object({
            titulo: z.string(),
            youtube: z.string().optional(),
            src: z.string().optional(),
            /** Miniatura para el video propio, mientras no se reproduce. */
            poster: z.string().optional(),
          })
          .refine((v) => Boolean(v.youtube) !== Boolean(v.src), {
            message: 'Cada video necesita `youtube` o `src`, pero no ambos.',
          }),
      )
      .default([]),
    /**
     * Audios de la nota: entrevistas de radio y podcasts. Cada uno lleva
     * `spotify` (ID, URI o URL del episodio) y se embebe el reproductor del
     * medio, que ya trae sus propios controles y su portada.
     */
    audios: z
      .array(
        z.object({
          titulo: z.string(),
          spotify: z.string(),
        }),
      )
      .default([]),
  }),
});

export const collections = { noticias };
