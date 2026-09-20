// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { lastmodFor } from './scripts/lastmod.mjs';

// Dev only: serves /api/contact with the same handler the hosts use, reading .env.
// In production the host's function (functions/, api/ or netlify/functions/) answers instead.
/** @type {import('astro').AstroIntegration} */
const devContactApi = {
  name: 'dev-contact-api',
  hooks: {
    'astro:server:setup': ({ server }) => {
      const env = loadEnv('development', process.cwd(), '');
      server.middlewares.use('/api/contact', async (req, res) => {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
        const request = new Request('http://localhost/api/contact', {
          method: req.method,
          headers: { 'content-type': 'application/json' },
          body: hasBody ? Buffer.concat(chunks) : undefined,
        });
        const { handleContact } = await import('./src/server/contact.ts');
        const r = await handleContact(request, env);
        res.statusCode = r.status;
        r.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(await r.text());
      });
    },
  },
};

// Dev and build each get their own Vite cache, so running a build never breaks a running dev server.
const cacheDir = process.argv.includes('dev') ? 'node_modules/.vite-dev' : 'node_modules/.vite-build';

export default defineConfig({
  site: 'https://www.skandava.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    mdx(),
    sitemap({
      serialize(item) {
        const lastmod = lastmodFor(item.url);
        if (lastmod) item.lastmod = lastmod;
        return item;
      },
    }),
    devContactApi,
  ],
  vite: { cacheDir, plugins: [tailwindcss()] },
});
