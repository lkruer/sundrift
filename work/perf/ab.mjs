// In-session A/B: one page, one drive, a variant switched on and off every --period ms; frames are tagged with the
// state they ran in, so both states see the same road, the same load on the machine and the same browser.
//   node ab.mjs --game=<dir> --variant=<file.js> [--map=city] [--phone] [--cpu=2] [--hour=23] [--secs=40] [--period=1000]
// variant file: an expression giving { on(), off() } (run in the page)
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
const CPU = Number(arg('cpu', 2)), SECS = Number(arg('secs', 40)), PERIOD = Number(arg('period', 1000));
const HOUR = arg('hour', '23'), RAIN = Number(arg('rain', 0));
const VAR = fs.readFileSync(arg('variant'), 'utf8');
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
await page.goto(URL0, { waitUntil: 'load' });
await page.waitForFunction('window.__READY__ === true', { timeout: 120000 });
await sleep(500);
await page.click('#startb');
await sleep(500);
await page.evaluate(`window.__VAR__ = ${VAR};`);
await page.evaluate((hour, rain) => {
  const D = window.__DEBUG__, G = D.G;
  if (hour !== 'run') { G.hour = Number(hour); G.hourShown = Number(hour); }
  D.rainNow(rain);
  window.__AUTOPILOT__ = (dt) => { const t = D.track, c = D.car, n = t.nearest(c.x, c.z, G.idx), ahead = t.sample(G.s + 10 + c.speed * 0.6); let e = ahead.h - c.yaw; e = Math.atan2(Math.sin(e), Math.cos(e)); const k = Math.abs(t.sample(G.s + 25).k); const target = k > 0.03 ? 13 : k > 0.012 ? 19 : 30; const steer = Math.max(-1, Math.min(1, e * 2.4 - n.u * 0.12)); return { throttle: c.speed < target ? 1 : 0, brake: c.speed > target + 4 ? 1 : 0, steer, hand: k > 0.035 && c.speed > 14 ? 1 : 0, reverse: false, touch: false }; };
  window.__STATE__ = 0; window.__AB__ = [];
  window.__ONFRAME__ = (dt, real) => { window.__AB__.push([window.__STATE__, G.jsMs, real * 1000, window.__GAME__.draws]); };
}, HOUR, RAIN);
const cdp = await page.createCDPSession();
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
await sleep(3000);
await page.evaluate(() => { window.__AB__ = []; });
const t0 = Date.now();
let st = 0;
while (Date.now() - t0 < SECS * 1000) {
  st = 1 - st;
  await page.evaluate((s) => { if (s) window.__VAR__.on(); else window.__VAR__.off(); window.__STATE__ = s; }, st);
  await sleep(PERIOD);
}
await page.evaluate(() => window.__VAR__.off());
const F = await page.evaluate(() => window.__AB__);
// drop the first two frames after each switch (the change settling)
const on = [], off = [];
let prev = -1, since = 0;
for (const [s, js, real, draws] of F) { if (s !== prev) { prev = s; since = 0; } since++; if (since <= 2) continue; (s ? on : off).push([js, real, draws]); }
const mean = (a, k) => a.reduce((x, r) => x + r[k], 0) / Math.max(1, a.length);
const med = (a, k) => { const s = a.map((r) => r[k]).sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
const o = { variant: path.basename(arg('variant')), map: MAP, phone: PHONE, cpu: CPU, hour: HOUR,
  off: { n: off.length, js: +mean(off, 0).toFixed(2), jsMed: +med(off, 0).toFixed(2), real: +mean(off, 1).toFixed(2), draws: +mean(off, 2).toFixed(0) },
  on: { n: on.length, js: +mean(on, 0).toFixed(2), jsMed: +med(on, 0).toFixed(2), real: +mean(on, 1).toFixed(2), draws: +mean(on, 2).toFixed(0) } };
o.gainJs = +(o.off.js - o.on.js).toFixed(2); o.gainPct = +(100 * (o.off.js - o.on.js) / o.off.js).toFixed(1);
console.log(JSON.stringify(o));
await browser.close(); server.close();
