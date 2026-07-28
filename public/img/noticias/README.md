# Imágenes de noticias

**Una carpeta por nota**, con el mismo nombre que el archivo `.md` en
`src/content/noticias/` (el "slug"). Así cada nota tiene su material junto y no
se mezcla nada:

```
public/img/noticias/
├── rectora-ies-9023-en-cada-dia-el-nueve/
│   ├── portada.webp
│   ├── 01.webp
│   └── 02.webp
└── otra-nota/
    └── portada.webp
```

## Cómo subir fotos

1. Convertí las imágenes a **.webp**.
2. Creá la carpeta con el slug de la nota, si no existe.
3. Nombralas `portada.webp`, `01.webp`, `02.webp`, … (sin fecha ni nombres largos:
   la carpeta ya dice de qué nota son).
4. En el `.md` de la nota:

```yaml
imagen: "/img/noticias/rectora-ies-9023-en-cada-dia-el-nueve/portada.webp"
imagenAlt: "Descripción de lo que se ve en la foto"
galeria:
  - src: "/img/noticias/rectora-ies-9023-en-cada-dia-el-nueve/01.webp"
    alt: "Descripción de la foto"
  - src: "/img/noticias/rectora-ies-9023-en-cada-dia-el-nueve/02.webp"
    alt: "Descripción de la foto"
```

La ruta siempre arranca en `/img/noticias/` (sin `public`).

## Recomendaciones

- **Portada**: apaisada, mínimo 1200px de ancho. También se usa como imagen de
  Open Graph cuando comparten la nota en redes.
- **Galería**: cualquier proporción, se acomodan en una grilla de 2 columnas.
- Mantené cada archivo **por debajo de 300 KB**. Si pesa más, bajá la calidad del
  webp a 80: no se nota y la página carga mucho más rápido.
- El `alt` es obligatorio y lo leen los lectores de pantalla: describí lo que se
  ve, no repitas el título de la nota.

## Videos

No van acá. Ver `public/video/noticias/README.md`.
