import { defineConfig } from '@playwright/test';

// Suite E2E de HEM2026.
// Corre contra el dev server local (que usa la base real de Supabase):
// los usuarios de prueba llevan email e2e.*@hem2026.test para poder limpiarlos después.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4399',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  // Puerto propio de la suite, distinto del 4321 de `npm run dev`: con
  // `reuseExistingServer` y el puerto por defecto, si había otro proyecto
  // Astro levantado los tests corrían contra ese sitio y fallaban con 404.
  webServer: {
    command: 'npm run dev -- --port 4399',
    url: 'http://localhost:4399',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
