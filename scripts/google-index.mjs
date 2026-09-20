// Asks Google to crawl your pages sooner, using its Indexing API.
//
// READ FIRST: Google documents this API for JobPosting and livestream pages only. It accepts any URL,
// and it can make Google CRAWL a page sooner, but it does not improve ranking. Google says other uses
// are unsupported and "may stop working without notice". It is opt-in and never runs on build.
//
// One-time setup (needs your Google account, not something a script can do for you):
//   1. Add and verify skandava.com in Google Search Console (Domain or URL-prefix property).
//   2. Google Cloud Console: create a project, enable "Web Search Indexing API".
//   3. Create a service account, then a JSON key. Save it OUTSIDE this repo.
//   4. In Search Console > Settings > Users and permissions, add the service account's email as an Owner.
//   5. export GOOGLE_INDEXING_KEY_FILE=/absolute/path/to/service-account.json
//
// Usage (run AFTER a build, so dist/sitemap-0.xml exists):
//   npm run gindex -- --dry            print what would be sent, sends nothing
//   npm run gindex -- --days=3         only pages whose sitemap lastmod is within the last 3 days
//   npm run gindex                     send every sitemap URL (quota is about 200 a day)
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const SCOPE = 'https://www.googleapis.com/auth/indexing';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const PUBLISH_URL = 'https://indexing.googleapis.com/v3/urlNotifications:publish';

const b64 = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

/** Signed service-account JWT, built with Node's own crypto so there are no dependencies. */
export function makeJwt({ client_email, private_key }, now = Math.floor(Date.now() / 1000)) {
  const head = b64({ alg: 'RS256', typ: 'JWT' });
  const claims = b64({ iss: client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 });
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${claims}`).sign(private_key, 'base64url');
  return `${head}.${claims}.${sig}`;
}

/** Sitemap URLs, optionally only those modified within the last `days` days. */
export function sitemapUrls(xml, days) {
  const cutoff = days ? Date.now() - days * 86400000 : 0;
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)]
    .map((m) => ({ loc: m[1].match(/<loc>([^<]+)<\/loc>/)?.[1], lastmod: m[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] }))
    .filter((u) => u.loc && (!cutoff || (u.lastmod && new Date(u.lastmod).valueOf() >= cutoff)))
    .map((u) => u.loc);
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const days = Number(args.find((a) => a.startsWith('--days='))?.split('=')[1]) || 0;

  const sitemap = new URL('../dist/sitemap-0.xml', import.meta.url);
  if (!fs.existsSync(sitemap)) {
    console.error('dist/sitemap-0.xml not found. Run "npm run build" first.');
    process.exit(1);
  }
  const urls = sitemapUrls(fs.readFileSync(sitemap, 'utf8'), days);
  if (!urls.length) {
    console.log(days ? `No pages modified in the last ${days} day(s).` : 'No URLs in the sitemap.');
    return;
  }
  if (urls.length > 200) console.warn(`${urls.length} URLs: the default quota is about 200 a day, so some will be rejected.`);

  if (dry) {
    console.log(`Would ask Google to crawl ${urls.length} URL(s):`);
    urls.forEach((u) => console.log('  ' + u));
    return;
  }

  const keyFile = process.env.GOOGLE_INDEXING_KEY_FILE;
  if (!keyFile || !fs.existsSync(keyFile)) {
    console.error('Set GOOGLE_INDEXING_KEY_FILE to your service-account JSON key (see the setup steps at the top of this file).');
    process.exit(1);
  }
  const key = JSON.parse(fs.readFileSync(keyFile, 'utf8'));

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: makeJwt(key) }),
  });
  const token = await tokenRes.json();
  if (!token.access_token) {
    console.error('Could not get an access token:', token.error_description || token.error || tokenRes.status);
    process.exit(1);
  }

  let ok = 0;
  for (const url of urls) {
    const res = await fetch(PUBLISH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.access_token}` },
      body: JSON.stringify({ url, type: 'URL_UPDATED' }),
    });
    if (res.ok) ok++;
    console.log(`${res.status}  ${url}`);
    if (res.status === 403) console.log('    403 usually means the service account is not an Owner of this property in Search Console, or the URL host does not match it.');
    if (res.status === 429) {
      console.log('    Daily quota reached. Stopping.');
      break;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  console.log(`\nAccepted ${ok} of ${urls.length}. Accepted means queued for a crawl, not indexed or ranked.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
