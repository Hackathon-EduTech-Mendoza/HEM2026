// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

/** Rutas privadas o de sesión: fuera del sitemap (además llevan noindex) */
const EXCLUDED_FROM_SITEMAP = [
  '/admin/',
  '/dashboard/',
  '/onboarding/',
  '/evaluacion/',
  '/mentoria/',
  '/actualizar-password/',
  '/recuperar-password/',
];

// https://astro.build/config
export default defineConfig({
  site: 'https://www.hackathonedutech.com.ar',
  output: 'server',
  adapter: vercel(),
  integrations: [
    sitemap({
      filter: (page) => !EXCLUDED_FROM_SITEMAP.some((path) => page.endsWith(path)),
    }),
  ],
});
