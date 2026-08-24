// scripts/generar-qr.mjs
//
// Genera el QR de la plataforma para imprimir y para difundir por mensajería.
//
// Se genera con un script y no a mano en una web de QR por dos razones: queda
// versionado junto al resto del material (igual que el PDF de las Bases), y si
// alguna vez cambia el dominio se regenera con un comando en lugar de tener que
// acordarse de qué generador se usó.
//
// Salen tres archivos, porque cada uno sirve para algo distinto:
//   - .svg  -> vectorial, es el que va a imprenta (banners, folletos, cartelería).
//   - .png  -> 1200 px, el que se manda por WhatsApp o se pega en una slide.
//   - -chico.png -> 600 px, para cuando el de 1200 pesa de más en un chat.
//
// Uso:
//   npm run docs:qr

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = resolve(RAIZ, 'public/img/qr');

// El mismo `site` que astro.config.mjs. Con www: es la forma canónica que
// resuelve el sitio, y así el QR no depende de un redirect.
const DESTINO = 'https://www.hackathonedutech.com.ar';

// Nivel de corrección de errores alto: un QR impreso se raya, se dobla y se
// fotografía torcido. 'H' tolera hasta ~30% de daño. Cuesta densidad, pero para
// una URL corta como esta el módulo sigue siendo grande y se lee sin problema.
const OPCIONES = {
  errorCorrectionLevel: 'H',
  margin: 4, // "quiet zone": sin este borde blanco muchos lectores no enganchan.
  color: {
    dark: '#000000',
    light: '#FFFFFF',
  },
};

/**
 * Negro sobre blanco a propósito, aunque el sitio tenga marca propia.
 *
 * Un QR con los colores de marca se ve mejor y se lee peor: los lectores
 * necesitan contraste alto y fondo claro, y el material impreso se fotocopia y
 * se proyecta. Si hace falta uno "de marca" para una pieza puntual, se arma
 * sobre el SVG en el diseño, no acá.
 */
async function generar() {
  await mkdir(SALIDA, { recursive: true });

  const svg = await QRCode.toString(DESTINO, { ...OPCIONES, type: 'svg' });
  await writeFile(resolve(SALIDA, 'hackathonedutech-qr.svg'), svg, 'utf8');

  await QRCode.toFile(resolve(SALIDA, 'hackathonedutech-qr.png'), DESTINO, {
    ...OPCIONES,
    width: 1200,
  });

  await QRCode.toFile(resolve(SALIDA, 'hackathonedutech-qr-chico.png'), DESTINO, {
    ...OPCIONES,
    width: 600,
  });

  console.log(`QR de ${DESTINO}`);
  console.log(`  ${resolve(SALIDA, 'hackathonedutech-qr.svg')}`);
  console.log(`  ${resolve(SALIDA, 'hackathonedutech-qr.png')}`);
  console.log(`  ${resolve(SALIDA, 'hackathonedutech-qr-chico.png')}`);
}

generar().catch((error) => {
  console.error('No se pudo generar el QR:', error);
  process.exit(1);
});
