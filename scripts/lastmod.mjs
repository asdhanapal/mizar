// Real "last modified" dates for the sitemap. Google only trusts lastmod when it is accurate,
// so every date comes from the page's own source file, never from the build time.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url).pathname;

const git = (args) => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

/** Last commit date of a file, or its mtime when it has uncommitted edits or is not tracked. */
function fileDate(rel) {
  if (!fs.existsSync(root + rel)) return null;
  const committed = git(['log', '-1', '--format=%cI', '--', rel]);
  const dirty = git(['status', '--porcelain', '--', rel]);
  if (committed && !dirty) return new Date(committed);
  return fs.statSync(root + rel).mtime;
}

/** Blog posts carry their own dates in frontmatter; an updatedDate beats pubDate. */
function postDate(rel) {
  if (!fs.existsSync(root + rel)) return null;
  const head = fs.readFileSync(root + rel, 'utf8').split('---')[1] ?? '';
  const pick = (key) => head.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1].trim();
  const value = pick('updatedDate') ?? pick('pubDate');
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.valueOf()) ? d : fileDate(rel);
}

/** Drafts are not published, so they must never move a date in the sitemap. */
const isDraft = (rel) => /^draft:\s*true\s*$/m.test((fs.readFileSync(root + rel, 'utf8').split('---')[1] ?? ''));

// A lastmod in the future would be wrong, so dates are capped at now.
const newest = (dates) => dates.filter(Boolean).map((d) => (d > new Date() ? new Date() : d)).sort((a, b) => b - a)[0] ?? null;
const inDir = (dir) => (fs.existsSync(root + dir) ? fs.readdirSync(root + dir).map((f) => `${dir}/${f}`) : []);

/** ISO lastmod for a sitemap URL, or undefined when the source cannot be found. */
export function lastmodFor(url) {
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  let date = null;

  if (parts[0] === 'blog' && parts[1]) date = postDate(`src/content/blog/${parts[1]}.md`);
  else if (parts[0] === 'blog') date = newest(inDir('src/content/blog').filter((f) => !isDraft(f)).map(postDate));
  else if (parts[0] === 'services' && parts[1]) date = fileDate(`src/content/services/${parts[1]}.md`);
  else if (parts[0] === 'services') date = newest(inDir('src/content/services').map(fileDate));
  else {
    const page = parts.join('/') || 'index';
    date = fileDate(`src/pages/${page}.astro`) ?? fileDate(`src/pages/${page}/index.astro`);
  }
  return date ? date.toISOString() : undefined;
}
