#!/usr/bin/env node
/**
 * The gate SUNDRIFT needs: a drift game has to be driven sideways to be tested, and the recipe's playtest
 * only drives forward. This one serves the game folder the way a host would, presses the real start button,
 * drives the pass with real key or touch events, steers by telemetry, throws the car into corners with the
 * real handbrake, and asserts that drifts were scored and banked. It photographs eight frames in motion into
 * one filmstrip, and it fails loudly.
 *
 *   node gate/drift-gate.mjs game                 desktop: 1280x720, click, keys
 *   node gate/drift-gate.mjs game --phone         phone: 390x844 @3x, real touches, one finger + handbrake thumb
 *   node gate/drift-gate.mjs game --metres=800    how far to drive (default 600)
 *   node gate/drift-gate.mjs game --out=_gate     where the frames go (default <game>/_gate)
 *   node gate/drift-gate.mjs game --recipe=../404-game-recipe   where puppeteer lives
 *
 * puppeteer resolves from the recipe checkout, not from here (docs/gates.md), hence --recipe.
 */
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const target = path.resolve(process.argv[2] || 'game');
const PHONE = process.argv.includes('--phone');
const METRES = Number(arg('metres', 600));
const OUT = path.resolve(arg('out', path.join(target, '_gate' + (PHONE ? '_phone' : ''))));
const RECIPE = path.resolve(arg('recipe', path.join(path.dirname(target), '..', '404-game-recipe')));
const require = createRequire(path.join(RECIPE, 'package.json'));
let puppeteer;
try { puppeteer = require('puppeteer'); } catch { console.error(`puppeteer not found under ${RECIPE}; pass --recipe=<path to 404-game-recipe>`); process.exit(1); }
if (!fs.existsSync(path.join(target, 'index.html'))) { console.error(`no index.html in ${target}`); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

// ---- serve ONLY the game folder, like a host
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };
const missing = [];
const server = createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/favicon.ico') { res.writeHead(204); return res.end(); }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(target, rel);
  if (!file.startsWith(target) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { missing.push(rel); res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL = `http://127.0.0.1:${server.address().port}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,720'] });
const page = await browser.newPage();
if (PHONE) {
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36');
} else await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });

const t0 = Date.now();
await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 120000 }).catch(() => { throw new Error('never signalled __READY__'); });
const readyS = ((Date.now() - t0) / 1000).toFixed(1);
const software = await page.evaluate(() => { try { const gl = document.createElement('canvas').getContext('webgl2'); const d = gl.getExtension('WEBGL_debug_renderer_info'); return /swiftshader|llvmpipe|software/i.test(String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL))); } catch { return false; } });

// ---- start from the REAL control
const box = await page.$eval('#startb', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, visible: e.offsetParent !== null }; });
if (!box.visible) { console.error('#startb is not visible'); process.exit(1); }
if (PHONE) await page.touchscreen.tap(box.x, box.y); else await page.mouse.click(box.x, box.y);
await sleep(600);
const startGone = await page.evaluate(() => { const e = document.getElementById('start'); return !e.classList.contains('on'); });

const read = () => page.evaluate(() => window.__GAME__ || null);

// ---- the driver: steer toward the centre of the road, handbrake into tight corners
const held = { left: false, right: false, hand: false, gas: false, brake: false };
let finger = null, thumb = null, fingerX = 0, fingerY = 0;
async function setKeys(want) {
  if (PHONE) {
    // one finger on #stick: throttle by touching, steer by sliding sideways; the other thumb on #brake
    if (!finger) {
      const r = await page.$eval('#stick', (e) => { const b = e.getBoundingClientRect(); return { x: b.x + b.width * 0.45, y: b.y + b.height * 0.55 }; });
      fingerX = r.x; fingerY = r.y;
      finger = await page.touchscreen.touchStart(fingerX, fingerY);
    }
    const dx = want.left ? -60 : want.right ? 60 : 0;
    const dy = want.brake ? 110 : 0;             // pulling the finger down is the brake
    await finger.move(fingerX + dx, fingerY + dy);
    if (want.hand && !thumb) {
      const b = await page.$eval('#brake .pad', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      thumb = await page.touchscreen.touchStart(b.x, b.y);
    } else if (!want.hand && thumb) { await thumb.end(); thumb = null; }
  } else {
    const map = { left: 'KeyA', right: 'KeyD', hand: 'Space', gas: 'KeyW', brake: 'KeyS' };
    for (const k of Object.keys(map)) {
      if (want[k] && !held[k]) await page.keyboard.down(map[k]);
      if (!want[k] && held[k]) await page.keyboard.up(map[k]);
    }
  }
  Object.assign(held, want);
}

const frames = [], samples = [];
let covered = 0, prev = null, driftFrames = 0, maxSlip = 0, banks = 0, lastScore = 0, drifting = false, driftBankedAt = [];
let handUntil = 0, handCooldown = 0, stalled = 0, peakDraws = 0, peakTris = 0, stuckSince = 0, reverseUntil = 0;
const shotEvery = METRES / 8;
let nextShot = shotEvery * 0.5;
const startAt = Date.now();
const cap = software ? 240000 : 90000;
let g = await read();
if (!g || !Array.isArray(g.pos)) { console.error('no __GAME__.pos'); process.exit(1); }
prev = g.pos;
await setKeys({ gas: true, brake: false, left: false, right: false, hand: false });
while (covered < METRES && Date.now() - startAt < cap) {
  await sleep(70);
  g = await read();
  if (!g) break;
  covered += Math.hypot(g.pos[0] - prev[0], g.pos[1] - prev[1]);
  prev = g.pos;
  samples.push({ t: Date.now() - startAt, kmh: g.kmh, slip: g.slip, drift: g.drift, score: g.score, draws: g.draws, tris: g.tris, fps: g.fps, lat: g.lat });
  peakDraws = Math.max(peakDraws, g.draws || 0); peakTris = Math.max(peakTris, g.tris || 0);
  maxSlip = Math.max(maxSlip, Math.abs(g.slip || 0));
  if (g.drift > 0) { driftFrames++; drifting = true; } else if (drifting) { drifting = false; }
  if (g.score > lastScore) { banks++; driftBankedAt.push(Math.round(covered)); lastScore = g.score; }
  // steering policy: aim at the centreline, anticipate the curve ahead
  const headErr = (() => { let d = g.roadHeading - g.heading; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; })();
  const cmd = headErr * 1.3 - g.lat * 0.12 + g.curvAhead * 9;
  const now = Date.now();
  // speed for the corner ahead: what the tyres can hold plus a margin the handbrake will scrub
  const k = Math.abs(g.curvAhead);
  const vmax = k > 0.002 ? Math.sqrt(11 / k) * 3.6 : 999;
  const tooFast = g.kmh > vmax * 1.15;
  const tight = k > 1 / 32 && g.kmh > 42;
  if (tight && now > handCooldown) { handUntil = now + 380; handCooldown = now + 3200; }
  const want = { gas: !tooFast, brake: tooFast && Math.abs(g.slip) < 15, hand: now < handUntil, left: cmd > 0.05, right: cmd < -0.05 };
  // wedged against a rail: reverse out with the wheels turned the other way, the way a player would
  if (g.kmh < 4 && samples.length > 20) stuckSince = stuckSince || now; else if (g.kmh > 8) stuckSince = 0;
  if (stuckSince && now - stuckSince > 1200) { reverseUntil = now + 1300; stuckSince = 0; }
  if (now < reverseUntil) { want.gas = false; want.brake = true; want.hand = false; want.left = cmd < 0; want.right = cmd > 0; }
  // in a slide, steer into the direction of travel when the angle gets big
  if (Math.abs(g.slip) > 38) { want.left = g.slip > 0; want.right = g.slip < 0; }
  await setKeys(want);
  if (covered >= nextShot && frames.length < 8) {
    const f = path.join(OUT, `f${frames.length}.png`);
    await page.screenshot({ path: f });
    frames.push(f); nextShot += shotEvery;
    console.log(`  frame ${frames.length - 1}  ${Math.round(covered)} m  ${g.kmh} km/h  slip ${g.slip}  drift ${g.drift}  score ${g.score}  draws ${g.draws}  tris ${g.tris}  fps ${g.fps}`);
  }
  if (g.kmh < 3 && samples.length > 40) stalled++;
}
await setKeys({ gas: false, brake: false, left: false, right: false, hand: false });
if (finger) await finger.end();
await sleep(300);
const last = await read();
// ---- filmstrip
if (frames.length) {
  const sheet = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#111;display:grid;grid-template-columns:1fr 1fr;gap:4px}img{width:100%;display:block}</style>${frames.map((f) => `<img src="${path.basename(f)}">`).join('')}`;
  fs.writeFileSync(path.join(OUT, 'strip.html'), sheet);
  const sp = await browser.newPage();
  await sp.setViewport({ width: PHONE ? 800 : 1300, height: 900 });
  await sp.goto('file://' + path.join(OUT, 'strip.html').replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
  await sp.screenshot({ path: path.join(OUT, 'filmstrip.png'), fullPage: true });
  await sp.close();
}
await browser.close(); server.close();

const fpsVals = samples.map((s) => s.fps).filter((n) => n > 0);
const medFps = fpsVals.length ? fpsVals.sort((a, b) => a - b)[Math.floor(fpsVals.length / 2)] : 0;
const avgKmh = samples.length ? Math.round(samples.reduce((a, s) => a + (s.kmh || 0), 0) / samples.length) : 0;
const problems = [];
if (!startGone) problems.push('the start screen stayed up after the real press on #startb');
if (covered < METRES * 0.8) problems.push(`covered ${Math.round(covered)} m of ${METRES}`);
if (banks < 2) problems.push(`only ${banks} drift(s) banked; a drift game that cannot be drifted by its gate is untested`);
if (maxSlip < 20) problems.push(`peak slip angle ${maxSlip} deg, never really sideways`);
if (driftFrames < 20) problems.push(`only ${driftFrames} samples in a drift`);
if (peakDraws > 900) problems.push(`${peakDraws} draw calls, over 900`);
if (peakTris > 1500000) problems.push(`${peakTris} triangles, over 1.5M`);
if (missing.length) problems.push(`${missing.length} 404(s), first ${missing[0]}`);
if (errors.length) problems.push(`${errors.length} console error(s): ${errors[0]}`);
if (stalled > 30) problems.push(`the car sat still for ${stalled} samples`);
if (frames.length < 6) problems.push(`only ${frames.length} frames captured`);
console.log(`\nmode            ${PHONE ? 'phone 390x844 @3x, real touches' : 'desktop 1280x720, click and keys'}${software ? '  (software rendering: fps is not a verdict)' : ''}`);
console.log(`ready           ${readyS} s`);
console.log(`covered         ${Math.round(covered)} m, average ${avgKmh} km/h`);
console.log(`drifts banked   ${banks}  at metres ${driftBankedAt.join(', ')}`);
console.log(`peak slip       ${maxSlip} deg   samples in drift ${driftFrames} of ${samples.length}`);
console.log(`score           ${last ? last.score : '?'}`);
console.log(`peak draws      ${peakDraws}   peak tris ${peakTris.toLocaleString('en-US')}   median fps ${medFps}`);
console.log(`filmstrip       ${path.join(OUT, 'filmstrip.png')}`);
fs.writeFileSync(path.join(OUT, 'gate.json'), JSON.stringify({ phone: PHONE, readyS, covered, banks, driftBankedAt, maxSlip, driftFrames, peakDraws, peakTris, medFps, avgKmh, errors, missing, problems, samples }, null, 2));
if (problems.length) { console.log('\nproblems:'); for (const p of problems) console.log('  ' + p); process.exit(1); }
console.log('\nit drifts. now LOOK at the filmstrip.');
