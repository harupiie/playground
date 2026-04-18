import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://harupiie.github.io',
  base: '/playground',
  output: 'static',
  integrations: [tailwind()],
});
