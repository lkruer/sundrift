// A Chrome performance trace of a stretch of a scripted run, to find out what a long frame was spent on.
//   node work/trace.mjs <script.json> --from=ms --to=ms [--out=work/trace.json]
// The script's steps run as in shot.mjs; tracing starts `from` ms after the first step and stops at `to`.
// Prints the longest events on each thread (GPU, compositor, main), longest first.
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { createRequire } from 'module';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const RECIPE = arg('recipe', 'C:/Users/liamk/404-game-recipe');
const require = createRequire(path.join(RECIPE, 'package.json'));
const puppeteer = require('puppeteer');
const target = path.resolve('game');
const OUT = path.resolve(arg('out', 'work/trace.json'));
const FROM = Number(arg('from', 20000)), TO = Number(arg('to', 32000));
const steps = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(target, rel);
  if (!file.startsWith(target) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1280,720'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load' });
await page.waitForFunction('window.__READY__ === true', { timeout: 60000 });
const t0 = Date.now();
let tracing = false, done = false;
const watcher = (async () => {
  while (!done) {
    const t = Date.now() - t0;
    if (!tracing && t >= FROM) { tracing = true; await page.tracing.start({ path: OUT, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'gpu', 'viz', 'cc', 'blink', 'v8', 'disabled-by-default-gpu.service', 'benchmark', 'toplevel'] }); console.log('trace on at', t); }
    if (tracing && t >= TO) { await page.tracing.stop(); console.log('trace off at', t); done = true; break; }
    await sleep(50);
  }
})();
for (const s of steps) {
  if (s.wait) await sleep(s.wait);
  if (s.js) { const r = await page.evaluate(s.js); if (r !== undefined) console.log(JSON.stringify(r).slice(0, 800)); }
  if (s.click) await page.click(s.click);
}
while (!done) await sleep(100);
await watcher;
const tr = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const ev = (tr.traceEvents || tr).filter((e) => e.ph === 'X' && e.dur > 15000);
const names = {};
for (const e of (tr.traceEvents || tr)) if (e.ph === 'M' && e.name === 'thread_name') names[e.pid + ':' + e.tid] = e.args.name;
ev.sort((a, b) => b.dur - a.dur);
for (const e of ev.slice(0, 40)) console.log((e.dur / 1000).toFixed(1).padStart(7), 'ms', (names[e.pid + ':' + e.tid] || e.tid).toString().padEnd(22), e.name, e.args && e.args.data ? JSON.stringify(e.args.data).slice(0, 160) : '');
await browser.close(); server.close();
