// Pixel-exact A/B of a render-side change, in the same frame: the frame is drawn with state A and with state B and the
// final canvas (and the scene target) read back and compared. Deterministic, so the machine's load does not matter.
//   node vis.mjs --game=<dir> --tests=<file.js> [--map=city] [--phone] [--hours=23,12] [--at=300,900,1500] [--rain=0]
// tests file: an expression evaluating to an array of { name, a(), b() } run in the page (window.__DEBUG__ is there)
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
const GAME = path.resolve(arg('game'));
const MAP = arg('map', 'mountain');
const PHONE = process.argv.includes('--phone');
const HOURS = arg('hours', '23,12').split(',').map(Number);
const AT = arg('at', '60,400,900,1500').split(',').map(Number);
const RAIN = Number(arg('rain', 0));
const TESTS = fs.readFileSync(arg('tests'), 'utf8');
const CACHE = path.join(HERE, 'cdn');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await startServer({ g: GAME });
const URL0 = `http://127.0.0.1:${server.address().port}/${MAP === 'city' ? 'g-city' : 'g'}/`;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
if (PHONE) { await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); await page.setUserAgent(UA); }
else await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
await page.setRequestInterception(true);
page.on('request', async (req) => {
  const u = req.url();
  if (!/^https?:\/\/(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\//.test(u)) return req.continue();
  const key = crypto.createHash('sha1').update(u + '|' + (PHONE ? 'm' : 'd')).digest('hex');
  const f = path.join(CACHE, key);
  try {
    if (!fs.existsSync(f)) { const r = await fetch(u); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); fs.writeFileSync(f + '.type', r.headers.get('content-type') || 'application/octet-stream'); }
    await req.respond({ status: 200, contentType: fs.readFileSync(f + '.type', 'utf8'), headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync(f) });
  } catch (e) { req.continue(); }
});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
await page.goto(URL0, { waitUntil: 'load' });
await page.waitForFunction('window.__READY__ === true', { timeout: 120000 });
await page.click('#startb');
await sleep(500);
if (process.argv.includes('--where')) await page.evaluate(async () => { window.__THREE__ = await import('three'); window.__WHERE__ = true; });
// the comparison, in the page
await page.evaluate(`window.__VIS__ = ${TESTS};
window.__DIFF__ = (t) => {
  const D = window.__DEBUG__, R = D.renderer, gl = R.getContext(), post = D.post;
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const grab = () => { R.setRenderTarget(null); const b = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
  const sceneGrab = () => { const rt = post.sceneRT, b = new Uint16Array(rt.width * rt.height * 4); R.readRenderTargetPixels(rt, 0, 0, rt.width, rt.height, b); return b; };
  t.a(); post.render(0); const A = grab(), As = sceneGrab();
  t.b(); post.render(0); const B = grab(), Bs = sceneGrab();
  t.a();
  let n = 0, mx = 0, ns = 0; const where = [];
  for (let i = 0; i < A.length; i++) { const d = Math.abs(A[i] - B[i]); if (d) { n++; if (d > mx) mx = d; if (d > 2 && where.length < 400) where.push((i >> 2)); } }
  for (let i = 0; i < As.length; i++) if (As[i] !== Bs[i]) ns++;
  // what is at the differing pixels: a ray from the lens through each (up to a few distinct objects)
  const hits = {};
  if (where.length && window.__WHERE__) {
    const ray = new window.__THREE__.Raycaster(), cam = D.chase ? D.scene.children.find((o) => o.isCamera) : null;
    for (const p of where.filter((_, k) => k % 4 === 0).slice(0, 60)) {
      const x = p % w, y = Math.floor(p / w);
      ray.setFromCamera({ x: (x + 0.5) / w * 2 - 1, y: (y + 0.5) / h * 2 - 1 }, cam);
      const hit = ray.intersectObjects(D.scene.children, true).filter((q) => q.object.visible)[0];
      const k = hit ? (hit.object.name || hit.object.type) + '/' + (hit.object.parent && hit.object.parent.name) + ' ' + (Array.isArray(hit.object.material) ? 'multi' : hit.object.material.type + '#' + hit.object.material.id + ' ' + (hit.object.material.name || '')) + ' d=' + hit.distance.toFixed(1) : 'none';
      hits[k] = (hits[k] || 0) + 1;
    }
  }
  return { name: t.name, px: n, maxd: mx, sceneDiff: ns, of: A.length, at: where.slice(0, 6).map((p) => [p % w, Math.floor(p / w)]), hits };
};`);
const results = [];
for (const hour of HOURS) for (const s of AT) {
  await page.evaluate((hour, s, rain) => { const D = window.__DEBUG__, G = D.G; D.rainNow(rain); G.hour = hour; G.hourShown = hour; D.teleport(s, 60); window.__AUTOPILOT__ = () => ({ throttle: 0.3, brake: 0, steer: 0, hand: 0, reverse: false, touch: false }); }, hour, s, RAIN);
  await sleep(1500);
  const r = await page.evaluate(() => { window.__AUTOPILOT__ = () => ({ throttle: 0, brake: 1, steer: 0, hand: 0, reverse: false, touch: false }); const out = []; for (const t of window.__VIS__) out.push(window.__DIFF__(t)); return out; });
  for (const x of r) { x.hour = hour; x.s = s; results.push(x); console.log(JSON.stringify(x)); }
}
if (errors.length) console.log('errors:', errors.slice(0, 5));
await browser.close(); server.close();
