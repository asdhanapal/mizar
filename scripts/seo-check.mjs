// SEO guard. Run after a build:  npm run build && npm run seo:check
// Reads dist/ and exits 1 on errors, so a deploy pipeline can refuse to ship a broken page.
// Errors = things that hurt indexing. Warnings = things worth a look.
import fs from 'node:fs';
import path from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const ORIGIN = 'https://skandava.com';

const errors = [];
const warnings = [];
const err = (page, msg) => errors.push(`${page}  ${msg}`);
const warn = (page, msg) => warnings.push(`${page}  ${msg}`);

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const strip = (h) => decode(h.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

// ---- collect pages
const pages = new Map(); // url path -> html
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.html')) {
      const rel = '/' + path.relative(DIST, p).replace(/\\/g, '/');
      pages.set(rel.replace(/index\.html$/, ''), fs.readFileSync(p, 'utf8'));
    }
  }
})(DIST);

const isNoindex = (h) => /<meta name="robots" content="[^"]*noindex/i.test(h);
const indexable = [...pages].filter(([, h]) => !isNoindex(h));

// ---- sitemap
const sitemapFile = path.join(DIST, 'sitemap-0.xml');
const sitemapUrls = fs.existsSync(sitemapFile)
  ? [...fs.readFileSync(sitemapFile, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname)
  : [];
if (!sitemapUrls.length) err('sitemap', 'sitemap-0.xml missing or empty');
for (const u of sitemapUrls) {
  if (!pages.has(u)) err(u, 'in sitemap but not built');
  else if (isNoindex(pages.get(u))) err(u, 'in sitemap but marked noindex');
}
for (const [u] of indexable) if (!sitemapUrls.includes(u) && u !== '/404.html') warn(u, 'indexable but missing from sitemap');
const sm = fs.existsSync(sitemapFile) ? fs.readFileSync(sitemapFile, 'utf8') : '';
if (sm && !/<lastmod>/.test(sm)) warn('sitemap', 'no lastmod dates');

// ---- vercel.json: every page must have its trailing-slash redirect, and no blanket rule may touch /api
const vercelFile = new URL('../vercel.json', import.meta.url).pathname;
if (fs.existsSync(vercelFile)) {
  const cfg = JSON.parse(fs.readFileSync(vercelFile, 'utf8'));
  const sources = new Set((cfg.redirects ?? []).map((r) => r.source));
  for (const u of sitemapUrls) if (u !== '/' && !sources.has(u.slice(0, -1))) warn(u, 'no redirect from the no-slash address in vercel.json (run npm run vercel-config)');
  if (cfg.trailingSlash === true) err('vercel.json', '"trailingSlash": true would also redirect /api/contact and can break the contact form');
} else warn('vercel.json', 'missing (run npm run vercel-config)');

// ---- per page
const titles = new Map();
const descs = new Map();
const inbound = new Map(); // path -> Set of pages that link to it from <main>

for (const [url, html] of indexable) {
  const title = decode((html.match(/<title>([\s\S]*?)<\/title>/) ?? [])[1] ?? '');
  const desc = decode((html.match(/<meta name="description" content="([^"]*)"/) ?? [])[1] ?? '');
  if (!title) err(url, 'missing <title>');
  else if (title.length < 15 || title.length > 65) warn(url, `title length ${title.length} (aim 15-65): "${title}"`);
  if (!desc) err(url, 'missing meta description');
  else if (desc.length < 70 || desc.length > 170) warn(url, `description length ${desc.length} (aim 70-170)`);
  if (title) titles.set(title, [...(titles.get(title) ?? []), url]);
  if (desc) descs.set(desc, [...(descs.get(desc) ?? []), url]);

  const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1 !== 1) err(url, `${h1} <h1> tags (need exactly 1)`);

  const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) ?? [])[1];
  if (canonical !== ORIGIN + url) err(url, `canonical is ${canonical}, expected ${ORIGIN + url}`);

  for (const img of html.match(/<img\b[^>]*>/g) ?? []) if (!/\balt=/.test(img)) err(url, `image without alt: ${img.slice(0, 80)}`);

  // structured data: parses, and every bare {"@id"} reference points at something defined on the page
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const defined = new Set();
  const refs = new Set();
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    const keys = Object.keys(node);
    if (node['@id']) (keys.length === 1 ? refs : defined).add(node['@id']);
    if (node['@id'] && keys.length > 1) defined.add(node['@id']);
    Object.values(node).forEach(visit);
  };
  for (const b of blocks) {
    try {
      visit(JSON.parse(b));
    } catch {
      err(url, 'invalid JSON-LD');
    }
  }
  for (const r of refs) if (!defined.has(r)) err(url, `JSON-LD references ${r} but never defines it`);

  // contextual inbound links: only links inside <main> count, so the nav and footer do not hide orphans
  const main = (html.match(/<main[\s\S]*?<\/main>/) ?? [''])[0];
  for (const m of main.matchAll(/<a\b[^>]*href="(\/[^"#?]*)"/g)) {
    const target = m[1];
    if (target !== url) inbound.set(target, (inbound.get(target) ?? new Set()).add(url));
  }
  const words = strip(main).split(' ').filter(Boolean).length;
  if (words < 250 && !/^\/(tools|contact|privacy|blog)\/?$/.test(url) && url !== '/') warn(url, `thin content: ${words} words in <main>`);

  // internal links resolve
  for (const m of html.matchAll(/<a\b[^>]*href="(\/[^"#?]*)"/g)) {
    const t = m[1];
    if (t.startsWith('//')) continue;
    const isFile = /\.[a-z0-9]+$/i.test(t);
    if (isFile ? !fs.existsSync(path.join(DIST, t)) : !pages.has(t)) err(url, `broken internal link ${t}`);
  }
}

for (const [t, list] of titles) if (list.length > 1) err(list.join(', '), `duplicate title "${t}"`);
for (const [d, list] of descs) if (list.length > 1) err(list.join(', '), `duplicate description "${d.slice(0, 50)}..."`);

for (const [url] of indexable) {
  if (url === '/') continue;
  const from = inbound.get(url)?.size ?? 0;
  if (from === 0) warn(url, 'no contextual links from other pages (only nav/footer). Link to it from related content');
}

// ---- report
const out = (label, list) => list.length && console.log(`\n${label} (${list.length})\n` + list.map((l) => '  ' + l).join('\n'));
console.log(`Checked ${indexable.length} indexable pages, ${sitemapUrls.length} sitemap URLs.`);
out('ERRORS', errors);
out('WARNINGS', warnings);
if (!errors.length) console.log('\nNo errors.');
process.exit(errors.length ? 1 : 0);
