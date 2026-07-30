// scripts/extraer-poster.mjs
//
// Extrae un fotograma de cada video propio para usarlo como `poster`. Sin
// poster, el navegador muestra el primer fotograma, que suele ser negro.
//
// Usa el Chromium de Playwright (ya instalado para los tests) en vez de
// ffmpeg, para no pedirle al equipo que instale nada más.
//
// Uso:
//   node scripts/extraer-poster.mjs <carpeta-de-videos> [segundo] [archivo]
//
// Ejemplos:
//   node scripts/extraer-poster.mjs public/video/noticias/mi-nota 2.5
//   node scripts/extraer-poster.mjs public/video/noticias/mi-nota 12 1.mp4
//
// El tercer argumento sirve para rehacer un solo poster con otro segundo, sin
// pisar los que ya quedaron bien.
//
// Deja un <nombre>-poster.webp junto a cada .mp4. El segundo por defecto es 1;
// conviene mirar el resultado y reintentar con otro valor si el frame salió
// borroso o en un corte.

import { chromium } from 'playwright';
import { readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, join, parse } from 'node:path';
import { pathToFileURL } from 'node:url';

const carpeta = process.argv[2];
const segundo = Number(process.argv[3] ?? 1);

if (!carpeta) {
  console.error('Falta la carpeta de videos. Ver el encabezado del script.');
  process.exit(1);
}

const dir = resolve(process.cwd(), carpeta);
const soloArchivo = process.argv[4];
const videos = readdirSync(dir)
  .filter((f) => f.toLowerCase().endsWith('.mp4'))
  .filter((f) => !soloArchivo || f === soloArchivo);

if (videos.length === 0) {
  console.error(`No hay .mp4 en ${dir}`);
  process.exit(1);
}

// La página tiene que vivir en la misma carpeta que los videos: desde
// about:blank Chromium bloquea el acceso a file://. Se crea una página vacía
// al lado, se usa, y se borra al final.
const paginaTmp = join(dir, '.poster-tmp.html');
writeFileSync(paginaTmp, '<!doctype html><title>poster</title>');

// El flag permite que esa página lea los .mp4 vecinos.
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.goto(pathToFileURL(paginaTmp).href);

for (const archivo of videos) {
  const url = pathToFileURL(join(dir, archivo)).href;

  const dataUrl = await page.evaluate(
    async ([src, t]) => {
      const video = document.createElement('video');
      video.src = src;
      video.muted = true;

      await new Promise((ok, fail) => {
        video.addEventListener('loadeddata', ok, { once: true });
        video.addEventListener('error', () => fail(new Error('no se pudo abrir')), { once: true });
      });

      // Si el video es más corto que el segundo pedido, vamos al medio.
      video.currentTime = Math.min(t, video.duration / 2);
      await new Promise((ok) => video.addEventListener('seeked', ok, { once: true }));

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);

      return canvas.toDataURL('image/webp', 0.85);
    },
    [url, segundo],
  );

  const salida = join(dir, `${parse(archivo).name}-poster.webp`);
  writeFileSync(salida, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`${archivo} -> ${salida}`);
}

await browser.close();
unlinkSync(paginaTmp);
