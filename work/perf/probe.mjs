// Frame-time probe for MINIDRIFT: drives the car with the longrun autopilot under CDP CPU throttling and records
// per-frame JS / render / shadow timing and renderer counts; optionally a CPU profile of a further window.
//   node probe.mjs --game=<dir> [--map=city] [--phone] [--cpu=2] [--secs=20] [--warm=5] [--hour=23] [--rain=0]
//                  [--prof=out.json] [--profsecs=10] [--nomin] [--diff=easy] [--frames=out.json] [--tag=A]
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { startServer } from './srv.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire('C:/Users/liamk/404-game-recipe/package.json');
const puppeteer = require('puppeteer');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const has = (k) => process.argv.includes(`--${k}`);
const GAME = path.resolve(arg('game', 'C:/Users/liamk/sundrift/game'));
const MAP = arg('map', 'mountain');
const PHONE = has('phone');
const CPU = Number(arg('cpu', 2));
const SECS = Number(arg('secs', 20));
const WARM = Number(arg('warm', 5));
const HOUR = arg('hour', '23');
const RAIN = Number(arg('rain', 0));
const PROF = arg('prof', '');
const PROFSECS = Number(arg('profsecs', 10));
const NOMIN = has('nomin');
const DIFF = arg('diff', 'easy');
const TAG = arg('tag', path.basename(path.dirname(GAME)));
const CACHE = path.join(HERE, 'cdn');
fs.mkdirSync(CACHE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = await startServer({ g: GAME });
const URL0 = `http://127.0.0.1:${server.address().port}/${MAP === 'city' ? 'g-city' : 'g'}/`;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
if (PHONE) { await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); await page.setUserAgent(UA); }
else await page.setViewport({ width: Number(arg('w', 1280)), height: Number(arg('h', 800)), deviceScaleFactor: 1 });

// external files (three from the CDN, the fonts) come from a disk cache, so runs do not depend on the network
await page.setRequestInterception(true);
page.on('request', async (req) => {
  const u = req.url();
  if (!/^https?:\/\/(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\//.test(u)) return req.continue();
  let url = u;
  const THREEF = arg('three', '');
  if (THREEF && url.endsWith('/build/three.module.min.js')) return req.respond({ status: 200, contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync(THREEF) });
  if (NOMIN) url = url.replace('/build/three.module.min.js', '/build/three.module.js');
  const key = crypto.createHash('sha1').update(url + '|' + (PHONE ? 'm' : 'd')).digest('hex');
  const f = path.join(CACHE, key);
  try {
    if (!fs.existsSync(f)) {
      const r = await fetch(url, { headers: { 'User-Agent': PHONE ? UA : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' } });
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(f, buf); fs.writeFileSync(f + '.type', r.headers.get('content-type') || 'application/octet-stream');
    }
    await req.respond({ status: 200, contentType: fs.readFileSync(f + '.type', 'utf8'), headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync(f) });
  } catch (e) { console.error('cache', url, e.message); req.continue(); }
});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
await page.goto(URL0, { waitUntil: 'load' });
try { await page.waitForFunction('window.__READY__ === true', { timeout: 90000 }); }
catch (e) {
  const st = await page.evaluate(() => ({ msg: document.getElementById('loadmsg') && document.getElementById('loadmsg').textContent, boot: window.__BOOT__ })).catch(() => null);
  console.error('NOT READY', JSON.stringify(st), 'errors:', JSON.stringify(errors.slice(0, 5)));
  process.exit(2);
}
const gpu = await page.evaluate(() => { const gl = window.__DEBUG__.renderer.getContext(); const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); });
if (DIFF === 'hard') { await page.click('.diff[data-d=hard]'); await sleep(500); await page.waitForFunction('!document.getElementById("building").classList.contains("on")', { timeout: 60000 }); }
await sleep(800);
await page.click('#startb');
await sleep(600);
// the clock and the weather held, the autopilot on, and the frame recorder
await page.evaluate((hour, rain) => {
  const D = window.__DEBUG__, G = D.G, R = D.renderer;
  if (hour !== 'run') { G.hour = Number(hour); G.hourShown = Number(hour); }
  D.rainNow(rain);
  window.__AUTOPILOT__ = (dt) => { const t = D.track, c = D.car, n = t.nearest(c.x, c.z, G.idx), ahead = t.sample(G.s + 10 + c.speed * 0.6); let e = ahead.h - c.yaw; e = Math.atan2(Math.sin(e), Math.cos(e)); const k = Math.abs(t.sample(G.s + 25).k); const target = k > 0.03 ? 13 : k > 0.012 ? 19 : 30; const steer = Math.max(-1, Math.min(1, e * 2.4 - n.u * 0.12)); return { throttle: c.speed < target ? 1 : 0, brake: c.speed > target + 4 ? 1 : 0, steer, hand: k > 0.035 && c.speed > 14 ? 1 : 0, reverse: false, touch: false }; };
  const P = { rCalls: 0, sceneMs: 0, shadowMs: 0, shadowDraws: 0, postMs: 0, sceneDraws: 0 };
  window.__P__ = P;
  const oR = R.render;
  R.render = function (s, c) { P.rCalls++; if (s === D.scene) { const t = performance.now(), c0 = R.info.render.calls; oR.call(this, s, c); P.sceneMs += performance.now() - t; P.sceneDraws += R.info.render.calls - c0; } else oR.call(this, s, c); };
  const sm = R.shadowMap, oS = sm.render;
  sm.render = function (...a) { const t = performance.now(), c0 = R.info.render.calls; oS.apply(this, a); P.shadowMs += performance.now() - t; P.shadowDraws += R.info.render.calls - c0; };
  const post = D.post, oP = post.render;
  post.render = function (dt) { const t = performance.now(); oP.call(this, dt); P.postMs += performance.now() - t; };
  window.__PF__ = [];
  window.__ONFRAME__ = (dt, real) => {
    const i = R.info.render;
    window.__PF__.push([real * 1000, G.jsMs, G.simMs || 0, G.worldMs || 0, P.postMs, P.sceneMs, P.shadowMs, i.calls, i.triangles, P.shadowDraws, P.rCalls, G.s, G.fps, P.sceneDraws, G.hourShown]);
    P.rCalls = 0; P.sceneMs = 0; P.shadowMs = 0; P.shadowDraws = 0; P.postMs = 0; P.sceneDraws = 0;
  };
}, HOUR, RAIN);
// an experiment patched in at run time (a variant to time against the plain build)
const INJ = arg('inject', '');
if (INJ) { const r = await page.evaluate(fs.readFileSync(INJ, 'utf8')); if (r !== undefined) console.error('inject:', JSON.stringify(r)); }
const cdp = await page.createCDPSession();
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
await sleep(WARM * 1000);
await page.evaluate(() => { window.__PF__ = []; });
await sleep(SECS * 1000);
const F = await page.evaluate(() => window.__PF__);
const st = await page.evaluate(() => { const D = window.__DEBUG__, G = D.G; return { s: Math.round(G.s), hour: +G.hourShown.toFixed(2), night: +(G.night || 0).toFixed(2), rain: D.W.rain, programs: D.renderer.info.programs.length, geos: D.renderer.info.memory.geometries, tex: D.renderer.info.memory.textures, slow: G.longFrames, drifts: D.scoring ? D.scoring.stats.drifts : 0 }; });

const col = (k) => F.map((r) => r[k]);
const stats = (xs) => { const s = [...xs].sort((a, b) => a - b), n = s.length; const mean = s.reduce((a, b) => a + b, 0) / Math.max(1, n); return { mean: +mean.toFixed(2), p50: +(s[Math.floor(n * 0.5)] ?? 0).toFixed(2), p90: +(s[Math.floor(n * 0.9)] ?? 0).toFixed(2), p99: +(s[Math.floor(n * 0.99)] ?? 0).toFixed(2), max: +(s[n - 1] ?? 0).toFixed(1) }; };
const out = {
  tag: TAG, map: MAP, phone: PHONE, cpu: CPU, hour: HOUR, rain: RAIN, gpu, frames: F.length,
  fps: +(1000 / stats(col(0)).mean).toFixed(1), fpsG: stats(col(12)).p50,
  real: stats(col(0)), js: stats(col(1)), sim: stats(col(2)), world: stats(col(3)), post: stats(col(4)), scene: stats(col(5)), shadow: stats(col(6)),
  draws: stats(col(7)), tris: stats(col(8)), shadowDraws: stats(col(9)), sceneDraws: stats(col(13)), renderCalls: stats(col(10)), end: st, errors: errors.slice(0, 3),
};
const fr = arg('frames', ''); if (fr) fs.writeFileSync(fr, JSON.stringify(F));
// an extra script run in the page after the timing window (a census, a counter); its result is printed
const EV = arg('eval', '');
if (EV) { const r = await page.evaluate(fs.readFileSync(EV, 'utf8')); console.log('eval:', JSON.stringify(r)); }

if (PROF) {
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  await sleep(PROFSECS * 1000);
  const { profile } = await cdp.send('Profiler.stop');
  fs.writeFileSync(PROF, JSON.stringify(profile));
  out.prof = PROF;
}
console.log(JSON.stringify(out));
await browser.close(); server.close();
