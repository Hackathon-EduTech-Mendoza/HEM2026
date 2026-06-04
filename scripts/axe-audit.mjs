/**
 * scripts/axe-audit.mjs
 *
 * Auditoría de accesibilidad con axe-core + Puppeteer.
 * Itera sobre una lista de URLs del dev server y guarda reportes JSON.
 *
 * Uso:
 *   node scripts/axe-audit.mjs [--base=http://localhost:4321] [--out=docs/audits/axe-reports]
 *
 * El dev server debe estar corriendo.
 */

import { AxePuppeteer } from '@axe-core/puppeteer';
import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { argv } from 'node:process';

const args = Object.fromEntries(
  argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => a.replace(/^--/, '').split('='))
);

const BASE = args.base || 'http://localhost:4321';
const OUT = args.out || 'docs/audits/axe-reports';

const URLS = [
  { path: '/', name: 'landing' },
  { path: '/login', name: 'login' },
  { path: '/registro', name: 'registro' },
  { path: '/bases-y-condiciones', name: 'bases' },
  { path: '/ediciones', name: 'ediciones' },
];

await mkdir(resolve(OUT), { recursive: true });

console.log(`[axe-audit] Base: ${BASE}`);
console.log(`[axe-audit] Output: ${OUT}`);
console.log(`[axe-audit] URLs: ${URLS.length}`);

const browser = await puppeteer.launch({ headless: true });
const summary = [];

try {
  for (const { path, name } of URLS) {
    const url = `${BASE}${path}`;
    process.stdout.write(`[axe-audit] ${name.padEnd(12)} ${url} ... `);

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    const results = await new AxePuppeteer(page)
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    await writeFile(
      resolve(OUT, `${name}.json`),
      JSON.stringify(results, null, 2),
      'utf8',
    );

    const violations = results.violations.length;
    const incomplete = results.incomplete.length;
    const passes = results.passes.length;
    const critical = results.violations.filter(
      (v) => v.impact === 'critical',
    ).length;
    const serious = results.violations.filter(
      (v) => v.impact === 'serious',
    ).length;

    summary.push({ name, url, violations, incomplete, passes, critical, serious });
    console.log(
      `violations=${violations} (critical=${critical} serious=${serious}) passes=${passes} incomplete=${incomplete}`,
    );

    await page.close();
  }
} finally {
  await browser.close();
}

await writeFile(
  resolve(OUT, '_summary.json'),
  JSON.stringify(summary, null, 2),
  'utf8',
);

console.log(`\n[axe-audit] Resumen:`);
for (const r of summary) {
  console.log(
    `  ${r.name.padEnd(12)} ${String(r.violations).padStart(2)} viol. | ${String(r.passes).padStart(3)} passes | ${r.critical} critical / ${r.serious} serious`,
  );
}
