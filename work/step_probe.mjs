// The world's build steps timed one by one while the car runs along the pass at speed (placed every frame, so the
// game's own loop builds what it needs as it would in a run): every step of a terrain tile's build and of a road
// chunk's build or dressing that takes longer than --ms is reported with what it was. Also the frames over 34 ms.
//   node work/step_probe.mjs [--from=0] [--to=1500] [--kmh=130] [--ms=6] [--phone]
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { createRequire } from 'module';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const require = createRequire(path.join(arg('recipe', 'C:/Users/liamk/404-game-recipe'), 'package.json'));
const puppeteer = require('puppeteer');
const target = path.resolve(arg('game', 'game'));
const FROM = Number(arg('from', 0)), TO = Number(arg('to', 1500)), KMH = Number(arg('kmh', 130)), MS = Number(arg('ms', 6)), PHONE = process.argv.includes('--phone');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]); if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(target, rel);
  if (!file.startsWith(target) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1280,720'] });
const page = await browser.newPage();
if (PHONE) {
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36');
} else await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('pageerror', e.message));
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load' });
await page.waitForFunction('window.__READY__ === true', { timeout: 60000 });
console.log('ready', ((Date.now() - t0) / 1000).toFixed(1), 's');
await page.evaluate("document.getElementById('startb').click()");
await sleep(2000);
await page.evaluate(({ MS, FROM, TO, KMH }) => {
  const D = window.__DEBUG__, W = D.world, T = W.terrain;
  window.__STEPS__ = []; window.__FRAMES__ = [];
  // every generator the world advances, timed a step at a time
  const wrap = (obj, name, label) => {
    const orig = obj[name].bind(obj);
    obj[name] = function (...a) {
      const it = orig(...a), tag = label(...a);
      let k = 0;
      return { next(v) { const s = performance.now(); const r = it.next(v); const ms = performance.now() - s; if (ms > MS) window.__STEPS__.push([tag, k, +ms.toFixed(1), Math.round(D.G.s)]); k++; return r; }, [Symbol.iterator]() { return this; } };
    };
  };
  wrap(T, '_build', (t, lod) => `tile ${t.i},${t.j} lod${lod}`);
  wrap(T, '_buildFar', () => 'far mesh');
  wrap(W, '_build', (c) => `chunk ${c} build`);
  wrap(W, '_dress', (ch) => `chunk ${ch && ch.c} dress`);
  // the run along the pass: the car put on the road every frame at speed
  let s = FROM, last = performance.now();
  const v = KMH / 3.6;
  const step = () => {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    window.__FRAMES__.push(+(dt * 1000).toFixed(1));
    s += v * dt;
    if (s < TO) {
      const p = D.track.sample(s);
      D.car.reset(p.x, p.z, p.h); D.car.vF = v; D.G.s = s;
      requestAnimationFrame(step);
    } else window.__DONE__ = true;
  };
  requestAnimationFrame(step);
}, { MS, FROM, TO, KMH });
await page.waitForFunction('window.__DONE__ === true', { timeout: 600000, polling: 500 });
const r = await page.evaluate(() => ({ steps: window.__STEPS__, frames: window.__FRAMES__ }));
const slow = r.frames.filter((f) => f > 34);
console.log(`frames ${r.frames.length}, over 34 ms: ${slow.length}  worst ${Math.max(...r.frames)} ms`);
const agg = {};
for (const [tag, k, ms, s] of r.steps) { const key = tag.replace(/[-\d]+,[-\d]+ /, '').replace(/chunk \d+ /, 'chunk ') + ' step ' + k; const e = agg[key] || (agg[key] = { n: 0, max: 0, sum: 0 }); e.n++; e.max = Math.max(e.max, ms); e.sum += ms; }
for (const [k, e] of Object.entries(agg).sort((a, b) => b[1].max - a[1].max)) console.log(`  ${k.padEnd(28)} slow ${String(e.n).padStart(4)}  max ${e.max.toFixed(1)} ms  mean ${(e.sum / e.n).toFixed(1)}`);
const worst = r.steps.sort((a, b) => b[2] - a[2]).slice(0, 8);
console.log('worst steps', JSON.stringify(worst));
await browser.close(); server.close();
