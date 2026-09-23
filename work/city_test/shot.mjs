// Screenshots of the NEO TOKYO module test page, headless.
//   node work/city_test/shot.mjs '<json list of shots>' [--out=work/city_test/shots]
// A shot is { name, q: "view=street&...", w, h, clip?: [x, y, w, h], wait?: ms, js?: "code" }.
// Serves the whole sundrift folder, so the page imports the game's own modules.
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { createRequire } from 'module';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const require = createRequire(path.join('C:/Users/liamk/404-game-recipe', 'package.json'));
const puppeteer = require('puppeteer');
const ROOT = path.resolve('C:/Users/liamk/sundrift');
const OUT = path.resolve(arg('out', 'C:/Users/liamk/sundrift/work/city_test/shots'));
fs.mkdirSync(OUT, { recursive: true });
let shots = process.argv[2];
shots = fs.existsSync(shots) ? JSON.parse(fs.readFileSync(shots, 'utf8')) : JSON.parse(shots);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/work/city_test/`;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
for (const s of shots) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 400)));
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + t.slice(0, 400)); else if (m.type() === 'log') console.log('  page:', t.slice(0, 600)); });
  await page.setViewport({ width: s.w || 1280, height: s.h || 720, deviceScaleFactor: 1 });
  const t0 = Date.now();
  await page.goto(BASE + '?' + (s.q || ''), { waitUntil: 'load' });
  try { await page.waitForFunction('window.__READY__ === true', { timeout: 90000 }); }
  catch (e) { console.log('timeout', s.name, errors.slice(0, 6)); await page.close(); continue; }
  if (s.js) { const r = await page.evaluate(s.js); if (r !== undefined) console.log('  js:', JSON.stringify(r)); }
  if (s.wait) await new Promise((r) => setTimeout(r, s.wait));
  const opts = { path: path.join(OUT, s.name + '.png') };
  if (s.clip) opts.clip = { x: s.clip[0], y: s.clip[1], width: s.clip[2], height: s.clip[3] };
  await page.screenshot(opts);
  const stats = await page.evaluate('window.__STATS__');
  console.log('shot', s.name, (Date.now() - t0) + ' ms', stats ? JSON.stringify(stats) : '');
  if (errors.length) console.log('  errors:', errors.filter((e) => !/rig\]/.test(e)).slice(0, 6));
  await page.close();
}
await browser.close(); server.close();
