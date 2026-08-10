// scripts/generar-bases-pdf.mjs
//
// Genera el PDF descargable de las Bases y Condiciones imprimiendo la página
// /bases-y-condiciones con puppeteer.
//
// Por qué desde la página y no desde el .docx: el .docx es la v11 que la
// organización presentó a la DES, y su Art. 11º delega la rúbrica a "una
// comunicación posterior" — no la trae. La página sí publica esa rúbrica, como
// Anexo II. Generando el PDF desde acá, el documento descargable dice lo mismo
// que el sitio y deja de citar un anexo que no contiene.
//
// El formato sale de las reglas `@media print` de src/styles/global.css y de
// las de la propia página. Si el PDF sale feo, se corrigen ahí, no acá.
//
// Uso:
//   npm run build && npm run docs:bases
//
// Levanta `astro preview` solo, genera el PDF y lo apaga.

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ESTATICO = resolve(RAIZ, 'dist/client');
const SALIDA = resolve(RAIZ, 'public/docs/hackathon-edutech-2026-bases-y-condiciones.pdf');
const PUERTO = 4331; // No es 4321: así no choca con un `npm run dev` abierto.
const URL = `http://localhost:${PUERTO}/bases-y-condiciones`;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

/**
 * Servidor estático mínimo sobre dist/client.
 *
 * No usamos `astro preview` porque el adapter de Vercel no lo soporta. La
 * página de las Bases es `prerender = true`, así que en el build ya es un HTML
 * suelto y alcanza con servirlo.
 */
async function levantarServidor() {
  const server = createServer((req, res) => {
    const ruta = decodeURIComponent(new global.URL(req.url, 'http://x').pathname);
    let archivo = join(ESTATICO, ruta);
    if (!extname(archivo)) archivo = join(archivo, 'index.html');

    // Nada fuera de dist/client, por las dudas.
    if (!archivo.startsWith(ESTATICO)) {
      res.writeHead(403).end();
      return;
    }

    createReadStream(archivo)
      .on('open', () =>
        res.writeHead(200, {
          'Content-Type': TIPOS[extname(archivo)] ?? 'application/octet-stream',
        }),
      )
      .on('error', () => res.writeHead(404).end())
      .pipe(res);
  });

  await new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(PUERTO, '127.0.0.1', ok);
  });

  const prueba = await fetch(URL).catch(() => null);
  if (!prueba?.ok) {
    server.close();
    throw new Error(
      `No se encontró la página en ${ESTATICO}. ¿Corriste "npm run build" antes?`,
    );
  }

  return { kill: () => server.close() };
}

const preview = await levantarServidor();
const navegador = await puppeteer.launch();

try {
  const pagina = await navegador.newPage();
  await pagina.goto(URL, { waitUntil: 'networkidle0' });

  // Las animaciones de entrada dejan bloques en opacity: 0 si no se disparó el
  // IntersectionObserver — en el PDF saldrían páginas en blanco.
  await pagina.addStyleTag({
    content: `*, *::before, *::after {
      animation: none !important;
      transition: none !important;
      opacity: 1 !important;
      transform: none !important;
    }`,
  });

  await mkdir(dirname(SALIDA), { recursive: true });
  await pagina.pdf({
    path: SALIDA,
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="width:100%;font-family:sans-serif;font-size:8px;color:#666;
                  padding:0 16mm;display:flex;justify-content:space-between;">
        <span>Hackathon EduTech Mendoza 2026 — Bases y Condiciones</span>
        <span><span class="pageNumber"></span> de <span class="totalPages"></span></span>
      </div>`,
  });

  const { size } = await stat(SALIDA);
  console.log(`PDF generado: ${SALIDA} (${(size / 1024).toFixed(0)} KB)`);
} finally {
  await navegador.close();
  preview.kill();
}
