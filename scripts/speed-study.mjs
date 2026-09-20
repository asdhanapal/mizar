// Measures how fast a list of public websites is, using Google's free PageSpeed Insights API,
// and writes a ranked table you can publish as original research.
//
//   npm run speed-study                          measure every URL in scripts/speed-sites.txt (resumes if interrupted)
//   npm run speed-study -- --url=https://x.com/  measure one page and print it
//   npm run speed-study -- --runs=3              median of 3 runs per site (slower, less noisy)
//   npm run speed-study -- --fresh               ignore earlier results and start over
//
// Engine: by default Lighthouse runs on this computer (needs Chrome installed, no key, no quota).
// Set PAGESPEED_API_KEY (free from Google Cloud) to use Google's PageSpeed service instead, which also
// returns real-visitor "field" data for sites with enough traffic.
//
// Read before publishing: these are LAB numbers from a single machine, mobile profile, homepage only.
// They vary from run to run and from what real visitors see. Say so in the article, publish the method,
// and never claim intent.
import fs from 'node:fs';
import { execFile } from 'node:child_process';

const API ='https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const runs = Math.max(1, Number(flag('runs')) || 1);
const strategy = flag('strategy') || 'mobile';
// "api" = Google's PageSpeed service (needs PAGESPEED_API_KEY, its keyless daily quota is shared and often used up).
// "local" = Lighthouse on this computer with the installed Chrome (default without a key).
const engine = flag('engine') || (process.env.PAGESPEED_API_KEY ? 'api' : 'local');
const outDir = new URL('../docs/speed-study/', import.meta.url);
const resultsFile = new URL('results.json', outDir);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

// Pulls the numbers we publish out of a Lighthouse result (from either engine).
function summarize(lh, loadingExperience) {
  const audit = (id) => lh.audits[id]?.numericValue;
  const field = loadingExperience?.metrics;
  return {
    perf: Math.round((lh.categories.performance.score ?? 0) * 100),
    seo: Math.round((lh.categories.seo?.score ?? 0) * 100),
    fcp: Math.round(audit('first-contentful-paint')),
    lcp: Math.round(audit('largest-contentful-paint')),
    tbt: Math.round(audit('total-blocking-time')),
    cls: Number((audit('cumulative-layout-shift') ?? 0).toFixed(3)),
    kb: Math.round((audit('total-byte-weight') ?? 0) / 1024),
    finalUrl: lh.finalDisplayedUrl || lh.finalUrl,
    fieldVerdict: loadingExperience?.overall_category ?? null,
    fieldLcp: field?.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
  };
}

// Runs Lighthouse on this computer with the installed Chrome. Needs no API key or quota.
function runLocal(url) {
  return new Promise((resolve) => {
    const cli = ['--yes', 'lighthouse@latest', url, '--quiet', '--output=json', '--output-path=stdout', '--only-categories=performance,seo', '--chrome-flags=--headless=new --no-sandbox'];
    if (strategy === 'desktop') cli.push('--preset=desktop');
    execFile('npx', cli, { maxBuffer: 64 * 1024 * 1024, timeout: 240000 }, (err, stdout) => {
      try {
        resolve(summarize(JSON.parse(stdout), null));
      } catch {
        resolve({ error: (err?.message || 'no result from Lighthouse').split('\n')[0].slice(0, 140) });
      }
    });
  });
}

const runOnce = (url) => (engine === 'api' ? runApi(url) : runLocal(url));

async function runApi(url) {
  const q = new URLSearchParams({ url, strategy });
  q.append('category', 'performance');
  q.append('category', 'seo');
  if (process.env.PAGESPEED_API_KEY) q.set('key', process.env.PAGESPEED_API_KEY);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${API}?${q}`, { signal: AbortSignal.timeout(150000) });
      if (res.status === 429 || res.status >= 500) {
        await sleep(15000 * attempt);
        continue;
      }
      const j = await res.json();
      if (j.error) return { error: j.error.message?.slice(0, 140) ?? 'API error' };
      return summarize(j.lighthouseResult, j.loadingExperience);
    } catch (e) {
      if (attempt === 3) return { error: String(e.message || e).slice(0, 140) };
      await sleep(8000);
    }
  }
  return { error: 'rate limited after retries' };
}

async function measure(url) {
  const samples = [];
  for (let i = 0; i < runs; i++) {
    const r = await runOnce(url);
    if (r.error) return { url, error: r.error };
    samples.push(r);
  }
  const pick = samples.sort((a, b) => a.perf - b.perf)[Math.floor(samples.length / 2)]; // the median run, kept whole
  return { url, runs, measuredAt: new Date().toISOString(), ...pick };
}

const ms = (v) => (v == null ? '-' : `${(v / 1000).toFixed(1)}s`);

function writeReport(results) {
  const ok = results.filter((r) => !r.error).sort((a, b) => b.perf - a.perf || a.lcp - b.lcp);
  const failed = results.filter((r) => r.error);
  const host = (u) => new URL(u).hostname.replace(/^www\./, '');
  const lines = [
    '# Website speed study (draft data)',
    '',
    `Measured ${new Date().toISOString().slice(0, 10)} with Lighthouse (${engine === 'api' ? "Google's PageSpeed Insights service" : 'run locally in Chrome'}), ${strategy} profile, homepage only, ${runs === 1 ? 'one run' : `median of ${runs} runs`} per site.`,
    `${ok.length} sites measured${failed.length ? `, ${failed.length} could not be measured` : ''}.`,
    '',
    '| # | Site | Score | LCP | TBT | CLS | Page weight | Chrome user data |',
    '|---|---|---|---|---|---|---|---|',
    ...ok.map((r, i) => `| ${i + 1} | ${host(r.url)} | ${r.perf} | ${ms(r.lcp)} | ${r.tbt} ms | ${r.cls} | ${(r.kb / 1024).toFixed(1)} MB | ${r.fieldVerdict ? `${r.fieldVerdict.toLowerCase()} (LCP ${ms(r.fieldLcp)})` : 'not enough data'} |`),
    '',
    '## Method and limits',
    `- Lab data from ${engine === 'api' ? "one Google server" : 'one computer and internet connection'}, ${strategy} profile with simulated throttling. Scores move a few points between runs.`,
    '- Homepage only. A site can be fast on its homepage and slow elsewhere.',
    '- "Chrome user data" is what real visitors experience, and exists only for sites with enough traffic.',
    '- LCP = time to the main content, TBT = time the page is unresponsive, CLS = layout jump. Good is roughly LCP under 2.5 s, TBT under 200 ms, CLS under 0.1.',
    '- Publish the method, link the source, and offer any site a right of reply. Do not attribute intent.',
    ...(failed.length ? ['', '## Not measured', ...failed.map((r) => `- ${host(r.url)}: ${r.error}`)] : []),
    '',
  ];
  fs.writeFileSync(new URL('results.md', outDir), lines.join('\n'));
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const single = flag('url');
  if (single) {
    console.log(JSON.stringify(await measure(single), null, 2));
    return;
  }

  const urls = fs.readFileSync(new URL('speed-sites.txt', import.meta.url), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  let results = !args.includes('--fresh') && fs.existsSync(resultsFile) ? JSON.parse(fs.readFileSync(resultsFile, 'utf8')) : [];
  const done = new Set(results.filter((r) => !r.error).map((r) => r.url));
  const todo = urls.filter((u) => !done.has(u));
  results = results.filter((r) => urls.includes(r.url) && !r.error);
  console.log(`${done.size} already measured, ${todo.length} to go.`);

  for (const [i, url] of todo.entries()) {
    const r = await measure(url);
    results.push(r);
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2)); // saved after every site, so nothing is lost if it stops
    console.log(`[${i + 1}/${todo.length}] ${r.error ? 'FAILED ' + r.error : `score ${r.perf}, LCP ${ms(r.lcp)}`}  ${url}`);
    await sleep(2500);
  }
  writeReport(results);
  console.log('\nWrote docs/speed-study/results.md and results.json');
}

main();
