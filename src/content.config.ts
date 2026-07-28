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
    /** Imagen de portada, relativa a /public (ej: "/img/noticias/foo.webp"). */
    imagen: z.string().optional(),
    imagenAlt: z.string().optional(),
    /** Fotos adicionales que se muestran al pie de la nota interna. */
    galeria: z
      .array(z.object({ src: z.string(), alt: z.string() }))
      .default([]),
  }),
});

export const collections = { noticias };
