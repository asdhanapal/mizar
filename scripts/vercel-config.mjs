// Writes vercel.json from the built sitemap:  npm run build && npm run vercel-config
//
// - Permanent (308) redirects from every page without its trailing slash (/about -> /about/), so Google
//   sees one address per page. They are listed page by page on purpose: a blanket "trailingSlash" rule
//   would also catch /api/contact, which the contact form posts to WITHOUT a slash, and break the form.
// - Redirects for old URLs that Google may still have indexed (LEGACY below).
// - Basic security headers, and a week of caching for the small root images.
// Re-run this after adding a page. `npm run seo:check` warns when a page is missing its redirect.
import fs from 'node:fs';

/** Old address -> where it should go now. Add a line whenever a page is removed or renamed. */
const LEGACY = [['/works', '/']];

const sitemap = new URL('../dist/sitemap-0.xml', import.meta.url);
if (!fs.existsSync(sitemap)) {
  console.error('dist/sitemap-0.xml not found. Run "npm run build" first.');
  process.exit(1);
}

const pages = [...fs.readFileSync(sitemap, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => new URL(m[1]).pathname)
  .filter((p) => p !== '/' && p.endsWith('/'));

const redirect = (source, destination) => ({ source, destination, permanent: true });

const config = {
  redirects: [
    ...LEGACY.flatMap(([from, to]) => [redirect(from, to), redirect(from + '/', to)]),
    ...pages.map((p) => redirect(p.slice(0, -1), p)),
  ],
  headers: [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
    {
      source: '/(og|logo|favicon|apple-touch-icon).png',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }],
    },
  ],
};

fs.writeFileSync(new URL('../vercel.json', import.meta.url), JSON.stringify(config, null, 2) + '\n');
console.log(`Wrote vercel.json: ${config.redirects.length} redirects (${pages.length} trailing-slash, ${LEGACY.length * 2} legacy).`);
