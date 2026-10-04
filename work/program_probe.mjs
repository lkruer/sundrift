// Shader programs compiled during play (each one a stall the first time something is drawn): loads the pass, starts a
// run, then runs the car along the road at speed (placed every frame) and logs every new program three makes, with
// where the car was and the program's name, and every frame over 34 ms.
//   node work/program_probe.mjs [--to=2500] [--kmh=110] [--phone] [--hour=17.3]
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { createRequire } from 'module';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const require = createRequire(path.join(arg('recipe', 'C:/Users/liamk/404-game-recipe'), 'package.json'));
const puppeteer = require('puppeteer');
const target = path.resolve(arg('game', 'game'));
const TO = Number(arg('to', 2500)), KMH = Number(arg('kmh', 110)), PHONE = process.argv.includes('--phone'), HOUR = Number(arg('hour', 17.3));
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
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load' });
await page.waitForFunction('window.__READY__ === true', { timeout: 60000 });
const n0 = await page.evaluate(() => window.__DEBUG__.renderer.info.programs.length);
console.log('programs at ready', n0);
await page.evaluate("document.getElementById('startb').click()");
await page.evaluate(({ TO, KMH, HOUR }) => {
  const D = window.__DEBUG__, R = D.renderer;
  const seen = new Set(R.info.programs.map((p) => p.id));
  window.__NEWP__ = []; window.__SLOW__ = [];
  let s = 8, last = performance.now(), started = performance.now();
  const v = KMH / 3.6;
  const step = () => {
    const now = performance.now(), dt = (now - last) / 1000; last = now;
    if (dt > 0.034) window.__SLOW__.push([Math.round(s), Math.round(dt * 1000)]);
    for (const p of R.info.programs) if (!seen.has(p.id)) { seen.add(p.id); window.__NEWP__.push([Math.round(s), +((now - started) / 1000).toFixed(1), p.name || '?', p.cacheKey ? p.cacheKey.slice(0, 160) : '']); }
    // (the first two seconds the car stands at the start, as a run begins)
    if (now - started > 2000) s += v * Math.min(dt, 0.05);
    if (s < TO) {
      D.G.hour = HOUR; const p = D.track.sample(s); D.car.reset(p.x, p.z, p.h); D.car.vF = v; D.G.s = s;
      requestAnimationFrame(step);
    } else window.__DONE__ = true;
  };
  requestAnimationFrame(step);
}, { TO, KMH, HOUR });
await page.waitForFunction('window.__DONE__ === true', { timeout: 600000, polling: 500 });
const r = await page.evaluate(() => ({ newp: window.__NEWP__, slow: window.__SLOW__, n: window.__DEBUG__.renderer.info.programs.length }));
console.log('programs at the end', r.n, ' new during play', r.newp.length);
for (const p of r.newp) console.log('  at', p[0], 'm', p[1], 's', p[2], p[3]);
console.log('slow frames', JSON.stringify(r.slow));
await browser.close(); server.close();
