import { defineConfig } from '@playwright/test';

// Tests unitarios de las funciones puras de src/utils y src/lib.
// Usan el runner de Playwright (ya instalado) para no sumar otra dependencia,
// pero no levantan navegador ni dev server: corren en Node y son instantáneos.
// Se separan de playwright.config.ts justamente para no arrastrar el webServer.
export default defineConfig({
  testDir: './tests/unit',
  timeout: 10_000,
  fullyParallel: true,
  reporter: [['list']],
});
