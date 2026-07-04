// scripts/optimize-gallery.mjs
// Re-comprime las fotos de la galería a un tamaño acorde a su uso real en la UI
// (slots de ~400-600px CSS). Reduce fotos de hasta 1.4MB a ~60-120KB.
// Uso: node scripts/optimize-gallery.mjs
import sharp from 'sharp';
import { readdir, stat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const GALLERY_DIR = new URL('../public/img/gallery/', import.meta.url).pathname
  .replace(/^\/([A-Za-z]:)/, '$1'); // fix Windows path
const MAX_WIDTH = 960;
const QUALITY = 75;

const files = (await readdir(GALLERY_DIR)).filter(f => f.endsWith('.webp'));
let before = 0, after = 0;

for (const file of files) {
  const filePath = path.join(GALLERY_DIR, file);
  const { size: origSize } = await stat(filePath);

  // Leer a buffer para evitar locks de archivo en Windows y poder sobrescribir en el mismo path
  const input = await readFile(filePath);
  const output = await sharp(input)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 5 })
    .toBuffer();

  if (output.length < origSize) {
    await writeFile(filePath, output);
    before += origSize; after += output.length;
    console.log(`${file}: ${(origSize / 1024).toFixed(0)}KB → ${(output.length / 1024).toFixed(0)}KB`);
  } else {
    before += origSize; after += origSize;
    console.log(`${file}: ya optimizada (${(origSize / 1024).toFixed(0)}KB)`);
  }
}

// Poster estático para el video de VibeCheck (evita frame negro con preload="none")
const posterInput = await readFile(path.join(GALLERY_DIR, 'foto-2.webp'));
const posterOut = await sharp(posterInput)
  .resize({ width: 1280, withoutEnlargement: true })
  .webp({ quality: 60 })
  .toBuffer();
await writeFile(path.join(GALLERY_DIR, 'vibe-poster.webp'), posterOut);
console.log('vibe-poster.webp generado');

console.log(`\nTotal: ${(before / 1048576).toFixed(1)}MB → ${(after / 1048576).toFixed(1)}MB`);
