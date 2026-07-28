# Imágenes de noticias

Las fotos que acompañan las notas internas van acá, y se referencian desde el
frontmatter del `.md` correspondiente en `src/content/noticias/`.

## Cómo subir fotos

1. Convertí la imagen a **.webp** (mismo formato que usamos en el resto del sitio).
2. Nombrala con el slug de la nota + un sufijo:
   `rectora-cada-dia-portada.webp`, `rectora-cada-dia-01.webp`, etc.
3. Dejala en esta carpeta.
4. En el `.md` de la nota, descomentá y completá:

```yaml
imagen: "/img/noticias/rectora-cada-dia-portada.webp"
imagenAlt: "Descripción de lo que se ve en la foto"
galeria:
  - src: "/img/noticias/rectora-cada-dia-01.webp"
    alt: "Descripción de la foto"
  - src: "/img/noticias/rectora-cada-dia-02.webp"
    alt: "Descripción de la foto"
```

La ruta siempre arranca en `/img/noticias/` (sin `public`).

## Recomendaciones

- **Portada**: apaisada, mínimo 1200px de ancho. También se usa como imagen de
  Open Graph cuando comparten la nota en redes.
- **Galería**: cualquier proporción, se acomodan en una grilla de 2 columnas.
- El `alt` es obligatorio y lo leen los lectores de pantalla: describí lo que se
  ve, no repitas el título de la nota.
