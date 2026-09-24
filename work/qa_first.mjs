// QA: a first-time player's first two minutes on a laptop, with real keys. The loading screen, the title (do Enter,
// Space or W start anything?), then a naive driver: W held, A and D to follow the road, no handbrake. Screenshots along
// the way, and everything the game said.
import fs from 'fs';
import path from 'path';
import { puppeteer, serve, sleep } from './qa_lib.mjs';

const OUT = path.resolve('work/qa_out/first'); fs.mkdirSync(OUT, { recursive: true });
const { server, url } = await serve();
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1280,720', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
const errors = []; page.on('pageerror', (e) => errors.push(String(e.message))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const log = []; const note = (...a) => { const s = a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); log.push(s); console.log(s); };
const t0 = Date.now();
page.goto(url, { waitUntil: 'load' });
await sleep(2500); await page.screenshot({ path: path.join(OUT, '00_loading.png') });
note('loading text at 2.5 s:', await page.evaluate('document.getElementById("loadmsg") ? document.getElementById("loadmsg").textContent : ""'));
await page.waitForFunction('window.__READY__ === true', { timeout: 90000 });
note('ready after', ((Date.now() - t0) / 1000).toFixed(1), 's');
await sleep(1000); await page.screenshot({ path: path.join(OUT, '01_title.png') });
// what a player might press to start
for (const k of ['Enter', 'Space', 'KeyW']) { await page.keyboard.press(k); await sleep(600); note(`title + ${k}:`, await page.evaluate('window.__DEBUG__.G.mode')); }
await page.click('#startb'); await sleep(300);
note('after START:', await page.evaluate('({ mode: window.__DEBUG__.G.mode, toast: document.getElementById("toasts").textContent })'));
// the naive driver: real keys, W held, A or D held toward the road ahead, S when far too fast into a bend
await page.keyboard.down('KeyW');
let held = null, brake = false;
const tl = []; const shots = [3, 8, 15, 25, 40, 60, 90, 118]; let si = 0;
const tStart = Date.now();
await page.evaluate(`(() => { const D = window.__DEBUG__; window.__SEEN__ = []; const oe = D.hud.onEvent.bind(D.hud); D.hud.onEvent = (e) => { window.__SEEN__.push([Math.round(D.G.playT), e.type, e.value]); return oe(e); };
  const sm = D.hud.smash.bind(D.hud); D.hud.smash = (l, t, n) => { window.__SEEN__.push([Math.round(D.G.playT), 'smash', l]); return sm(l, t, n); }; })()`);
while ((Date.now() - tStart) / 1000 < 120) {
  const s = await page.evaluate(`(() => { const D = window.__DEBUG__, G = D.G, c = D.car, t = D.track; const p = t.sample(G.s + 12 + c.speed * 0.4); const want = Math.atan2(p.x - c.x, p.z - c.z); let e = want - c.yaw; e = Math.atan2(Math.sin(e), Math.cos(e)); const k = Math.abs(t.sample(G.s + 25).k);
    return { e, kmh: c.kmh, k, off: G.off ? +G.off.t.toFixed(1) : null, mag: D.magnet.active, coach: getComputedStyle(document.getElementById('coach')).opacity === '1' ? document.getElementById('coach').textContent : '' }; })()`);
  const want = s.e > 0.08 ? 'KeyA' : s.e < -0.08 ? 'KeyD' : null;
  if (want !== held) { if (held) await page.keyboard.up(held); if (want) await page.keyboard.down(want); held = want; }
  const tooFast = s.kmh > (s.k > 0.03 ? 55 : s.k > 0.012 ? 85 : 200);
  if (tooFast !== brake) { if (tooFast) { await page.keyboard.up('KeyW'); await page.keyboard.down('KeyS'); } else { await page.keyboard.up('KeyS'); await page.keyboard.down('KeyW'); } brake = tooFast; }
  const el = (Date.now() - tStart) / 1000;
  if (si < shots.length && el >= shots[si]) { await page.screenshot({ path: path.join(OUT, `run_${String(shots[si]).padStart(3, '0')}s.png`) }); tl.push([shots[si], s]); si++; }
  if (s.coach && !tl.some((x) => x[0] === 'coach')) { tl.push(['coach', Math.round(el), s.coach]); await page.screenshot({ path: path.join(OUT, 'coach.png') }); }
  await sleep(60);
}
for (const k of ['KeyW', 'KeyA', 'KeyD', 'KeyS']) await page.keyboard.up(k);
note('timeline', JSON.stringify(tl));
note('what the game said', JSON.stringify(await page.evaluate('window.__SEEN__.filter((e) => !["boost","mult","chainlost"].includes(e[1]))')));
note('end state', await page.evaluate('({ score: Math.round(window.__DEBUG__.scoring.total), drifts: window.__DEBUG__.scoring.stats.drifts, crashes: window.__DEBUG__.scoring.stats.crashes, dist: Math.round(window.__DEBUG__.G.dist), hour: window.__DEBUG__.G.hour.toFixed(2), longFrames: window.__DEBUG__.G.longFrames, worst: Math.round(window.__DEBUG__.G.worstFrame) })'));
note('errors', errors.length, JSON.stringify(errors.slice(0, 8)));
fs.writeFileSync(path.join(OUT, 'first.txt'), log.join('\n'));
await browser.close(); server.close();
