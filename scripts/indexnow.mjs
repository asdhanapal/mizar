// Tells Bing, Yandex and other IndexNow search engines that your pages exist or changed.
// Run AFTER each deploy:  npm run indexnow      (add --dry to just print what would be sent)
import fs from 'node:fs';

const HOST = 'skandava.com';
const KEY = 'a6d6d670f87e5498a07a4eabbc9d6e36';
const sitemap = fs.readFileSync(new URL('../dist/sitemap-0.xml', import.meta.url), 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const body = { host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls };

if (process.argv.includes('--dry')) {
  console.log(`Would submit ${urls.length} URLs to IndexNow for ${HOST}:`);
  urls.forEach((u) => console.log('  ' + u));
  process.exit(0);
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});
console.log(`IndexNow responded ${res.status} ${res.statusText} (200 or 202 means accepted)`);
