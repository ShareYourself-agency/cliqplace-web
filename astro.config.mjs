// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.cliqplace.cz',
  output: 'static',
  adapter: vercel(),
  integrations: [sitemap({ filter: (p) => !p.includes('/admin') })],
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'auto' },
  image: { responsiveStyles: false },
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  security: {
    checkOrigin: true,
    // CSP je v vercel.json (kvůli Google Tag Manageru a Meta Pixelu)
  },
});
