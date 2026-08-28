import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import zlib from 'node:zlib';

/**
 * La página /recursos declara sus PDF a mano en el array GRUPOS y el peso lo
 * calcula el build leyendo public/. Este test cierra el hueco entre las dos
 * cosas: que cada href declarado exista en disco y que el archivo siga siendo
 * un PDF válido.
 *
 * Lo segundo no es paranoia: `*.pdf binary` está en .gitattributes porque un
 * PDF sin bytes NUL en los primeros 8 KB se coló como texto y core.autocrlf lo
 * dejó ilegible en el checkout de Windows. Si alguien toca .gitattributes, esta
 * comprobación de la cabecera %PDF y del EOF es la que avisa.
 */

const PAGINA = resolve('src/pages/recursos.astro');
const fuente = readFileSync(PAGINA, 'utf8');

/** Los `href: '/docs/...'` tal como quedan escritos en el frontmatter. */
function hrefsDeclarados(): string[] {
  return [...fuente.matchAll(/href:\s*'(\/docs\/[^']+)'/g)].map((m) => m[1]);
}

/** El `formato:` de cada recurso, en el mismo orden que los href del array. */
function formatosDeclarados(): string[] {
  return [...fuente.matchAll(/formato:\s*'([^']+)'/g)].map((m) => m[1]);
}

function archivo(href: string): Buffer {
  return readFileSync(resolve('public', href.replace(/^\//, '')));
}

/**
 * Cuenta páginas leyendo el /Count del árbol de páginas. En los PDF modernos
 * ese objeto viaja comprimido dentro de un object stream, así que hay que
 * inflar los streams antes de buscarlo.
 */
function paginas(pdf: Buffer): number {
  const s = pdf.toString('latin1');
  const cuentas = [...s.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]));

  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const inicio = m.index + m[0].length;
    const fin = s.indexOf('endstream', inicio);
    if (fin < 0) continue;
    try {
      const plano = zlib
        .inflateSync(Buffer.from(s.slice(inicio, fin), 'latin1'))
        .toString('latin1');
      cuentas.push(...[...plano.matchAll(/\/Count\s+(\d+)/g)].map((x) => Number(x[1])));
    } catch {
      // Stream sin comprimir o con otro filtro: no aporta el /Count, se ignora.
    }
  }

  return Math.max(0, ...cuentas);
}

test.describe('recursos declarados en /recursos', () => {
  test('el frontmatter declara los seis recursos', () => {
    expect(hrefsDeclarados()).toEqual([
      '/docs/hackathon-edutech-2026-mapa-de-ruta.pdf',
      '/docs/hackathon-edutech-2026-bases-y-condiciones.pdf',
      '/docs/hackathon-edutech-2026-charla-design-sprint.pdf',
      '/docs/hackathon-edutech-2026-capacitacion-pitch.pdf',
      '/docs/hackathon-edutech-2026-guia-mentores.pdf',
      '/docs/resolucion-0180-2026-puntaje-docente.pdf',
    ]);
  });

  test('cada href apunta a un PDF real de public/docs', () => {
    for (const href of hrefsDeclarados()) {
      const pdf = archivo(href);
      expect(pdf.subarray(0, 5).toString('latin1'), `cabecera de ${href}`).toBe('%PDF-');
      expect(pdf.subarray(-1024).toString('latin1'), `EOF de ${href}`).toContain('%%EOF');
      expect(pdf.length, `tamaño de ${href}`).toBeGreaterThan(1024);
    }
  });

  test('el material nuevo de Celina Páez tiene las páginas que anuncia', () => {
    const esperado: Record<string, number> = {
      '/docs/hackathon-edutech-2026-charla-design-sprint.pdf': 21,
      '/docs/hackathon-edutech-2026-capacitacion-pitch.pdf': 57,
    };

    for (const [href, cantidad] of Object.entries(esperado)) {
      expect(paginas(archivo(href)), `páginas de ${href}`).toBe(cantidad);
      // El texto del `formato:` es lo que ve la persona: si el PDF se
      // regenera con otra cantidad de láminas, hay que actualizarlo.
      expect(fuente).toContain(`'PDF · ${cantidad} diapositivas'`);
    }
  });

  test('cada recurso declara un formato', () => {
    expect(formatosDeclarados()).toHaveLength(hrefsDeclarados().length);
  });
});
