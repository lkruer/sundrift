// Crash hunt: the phone profile (390 x 844 at 3x, touch) driving with the gate's autopilot while screenshots are taken
// every two seconds, the way the drift gate and the jam gate do, with the browser's own log and the page's crash
// events kept. Reports whether the tab survived, and what the browser said if it did not.
//   node work/crash_hunt.mjs [url] [--secs=90] [--runs=3]
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/liamk/404-game-recipe/package.json');
const puppeteer = require('puppeteer');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const URL = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://localhost:8123/__game__/game/';
const SECS = Number(arg('secs', 90)), RUNS = Number(arg('runs', 3));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pilot = fs.readFileSync('C:/Users/liamk/sundrift/work/shots_hud_desk.json', 'utf8');
const ap = JSON.parse(pilot).find((s) => s.js && s.js.includes('__AUTOPILOT__ =')).js.replace('touch: false', 'touch: true');
for (let run = 1; run <= RUNS; run++) {
  const log = [];
  const browser = await puppeteer.launch({ headless: true, dumpio: false, args: ['--no-sandbox', '--enable-logging=stderr', '--v=0'] });
  const proc = browser.process();
  if (proc && proc.stderr) proc.stderr.on('data', (d) => { const s = String(d); for (const l of s.split('\n')) if (/crash|oom|out of memory|gpu|lost|fatal|kill|terminat/i.test(l)) log.push(l.slice(0, 220)); });
  const page = await browser.newPage();
  let crashed = null;
  page.on('error', (e) => { crashed = 'page error: ' + e.message; });
  page.on('close', () => { crashed = crashed || 'page closed'; });
  page.on('pageerror', (e) => log.push('pageerror: ' + String(e.message).slice(0, 200)));
  page.on('console', (m) => { if (/lost|context|error/i.test(m.text())) log.push('console: ' + m.text().slice(0, 200)); });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36');
  const t0 = Date.now();
  let shots = 0, lastInfo = null;
  try {
    await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction('window.__READY__ === true', { timeout: 90000 });
    const b = await page.$eval('#startb', (e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await page.touchscreen.tap(b[0], b[1]);
    await sleep(1500);
    await page.evaluate(ap);
    const end = Date.now() + SECS * 1000;
    while (Date.now() < end && !crashed) {
      await page.screenshot({ path: `C:/Users/liamk/AppData/Local/Temp/claude/C--Users-liamk-stonkr-crypto/5d56d707-7957-40ae-a6a0-1e7c3fd29e3d/scratchpad/hunt_${run}.png` });
      shots++;
      lastInfo = await page.evaluate(() => { const h = window.__DEBUG__.hud, m = performance.memory || {}; return { heapMB: Math.round((m.usedJSHeapSize || 0) / 1e6), sprites: h.cache.size, canvas: [h.canvas.width, h.canvas.height], mode: window.__DEBUG__.G.mode, tex: window.__DEBUG__.renderer.info.memory.textures }; });
      await sleep(2000);
    }
  } catch (e) { crashed = crashed || String(e.message).slice(0, 160); }
  console.log(`run ${run}: ${crashed ? 'CRASHED (' + crashed + ')' : 'ok'} after ${((Date.now() - t0) / 1000).toFixed(0)} s, ${shots} shots, last ${JSON.stringify(lastInfo)}`);
  for (const l of log.slice(-12)) console.log('   ' + l);
  await browser.close().catch(() => {});
}
