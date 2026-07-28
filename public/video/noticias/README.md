# Videos de noticias

## Regla corta

**Si el video ya está en YouTube, Instagram o Facebook, no lo descargues: usá el
link.** Solo dejá archivos acá si el video no está publicado en ningún lado y
dura menos de un minuto.

## Opción 1 (recomendada): YouTube

Subí el video al canal de la Hackathon. Si no querés que aparezca en el canal,
poné la visibilidad en **"No listado"**: funciona igual embebido, pero no se
lista públicamente.

Después, en el `.md` de la nota:

```yaml
videos:
  - titulo: "La rectora en el programa Cada Día"
    youtube: "https://www.youtube.com/watch?v=XXXXXXXXXXX"
```

Acepta el link completo, el `youtu.be/...`, el de Shorts o el ID pelado.

Por qué conviene: el video no pesa en el repositorio, YouTube lo sirve en la
calidad que aguante la conexión de cada persona, y la reproducción no consume
ancho de banda del hosting.

## Opción 2: archivo propio

Solo para clips cortos que no están publicados en otro lado.

1. Convertilo a **.mp4 (H.264 + AAC)**, que es el que reproducen todos los
   navegadores.
2. Creá la carpeta con el slug de la nota y dejalo ahí:

```
public/video/noticias/<slug>/clip.mp4
```

3. Sumá una miniatura en `public/img/noticias/<slug>/` para que no se vea un
   recuadro negro antes de reproducir.
4. En el `.md`:

```yaml
videos:
  - titulo: "Clip de la entrevista"
    src: "/video/noticias/<slug>/clip.mp4"
    poster: "/img/noticias/<slug>/clip-poster.webp"
```

### Límites que conviene respetar

- **Máximo ~10 MB por archivo.** Más que eso, va a YouTube sí o sí.
- Todo lo que entra al repositorio queda para siempre en el historial de git,
  aunque después se borre. Por eso el umbral es bajo.
- Para comprimir, con ffmpeg:

```bash
ffmpeg -i original.mov -vcodec libx264 -crf 28 -preset slow -acodec aac -b:a 128k -movflags +faststart clip.mp4
```

`-crf` controla la calidad: 23 es alta, 28 es buena y pesa bastante menos.
`-movflags +faststart` hace que arranque sin esperar a bajar todo el archivo.

## Instagram y Facebook

No se pueden embeber de forma confiable (rompen seguido y requieren scripts de
terceros). Si el video está ahí, lo mejor es subirlo a YouTube como "No listado"
y usar la opción 1, o enlazarlo como noticia de prensa externa con `url`.
