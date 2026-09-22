// Jitter probe: drive, and every frame project the car into the camera; report how much its screen
// position and the camera's roll wobble frame to frame (second differences), which is what reads as jitter.
//   node work/jitter.mjs [--query=?x]
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { createRequire } from 'module';
const require = createRequire('C:/Users/liamk/404-game-recipe/package.json');
const puppeteer = require('puppeteer');
const target = path.resolve('game');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]); if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(target, rel);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
if (process.env.PHONE) { await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'); } else await page.setViewport({ width: 1280, height: 720 });
await page.goto(`http://127.0.0.1:${server.address().port}/?prof`, { waitUntil: 'load' });
await page.waitForFunction('window.__READY__ === true', { timeout: 60000 });
await new Promise((r) => setTimeout(r, 900)); await page.click('#startb');
await page.evaluate(() => {
  const D = window.__DEBUG__; const V = D.car.constructor; window.__J = [];
  const cam = D.chase.cam;
  window.__ONFRAME__ = (dt, real) => {
    const c = D.car; if (!c) return;
    const p = { x: c.x, y: D.scene.getObjectByName('car').position.y + 0.4, z: c.z };
    const v = cam.position.clone ? null : null;
    // project by hand with the camera's matrices
    const e = cam.matrixWorldInverse.elements, P = cam.projectionMatrix.elements;
    const x = e[0] * p.x + e[4] * p.y + e[8] * p.z + e[12], y = e[1] * p.x + e[5] * p.y + e[9] * p.z + e[13], z = e[2] * p.x + e[6] * p.y + e[10] * p.z + e[14];
    const cx = P[0] * x + P[8] * z, cy = P[5] * y + P[9] * z, cw = -z;
    const up = cam.up;
    const body = D.scene.getObjectByName('bodyPivot');
    window.__J.push([real, cx / cw, cy / cw, body ? body.rotation.z : 0, body ? body.rotation.x : 0, c.kmh, c.beta]);
  };
});
// a scripted drive: throttle, a few handbrake drifts left and right
const hold = async (keys, ms) => { for (const k of keys) await page.keyboard.down(k); await new Promise((r) => setTimeout(r, ms)); for (const k of keys) await page.keyboard.up(k); };
await hold(['KeyW'], 3000);
for (let i = 0; i < 4; i++) {
  await hold(['KeyW', i % 2 ? 'KeyD' : 'KeyA', 'Space'], 350);
  await hold(['KeyW', i % 2 ? 'KeyD' : 'KeyA'], 900);
  await hold(['KeyW', i % 2 ? 'KeyA' : 'KeyD'], 500);
  await hold(['KeyW'], 1200);
}
const J = await page.evaluate(() => window.__J);
const P = await page.evaluate(() => ({ log: window.__DEBUG__.prof.log, long: window.__DEBUG__.prof.long, frames: window.__J.map((j, i) => [i, Math.round(j[0] * 1000)]).filter((x) => x[1] > 25) }));
console.log('long frames', JSON.stringify(P));
await browser.close(); server.close();
const d2 = (k) => { let s = 0, n = 0, mx = 0; for (let i = 2; i < J.length; i++) { const v = J[i][k] - 2 * J[i - 1][k] + J[i - 2][k]; s += v * v; n++; mx = Math.max(mx, Math.abs(v)); } return [Math.sqrt(s / n), mx]; };
const [sx, mxx] = d2(1), [sy, mxy] = d2(2), [sr, mxr] = d2(3), [sp, mxp] = d2(4);
const fr = J.map((j) => j[0] * 1000).sort((a, b) => a - b);
console.log(`frames ${J.length}  frame ms p50 ${fr[fr.length >> 1].toFixed(1)} p99 ${fr[Math.floor(fr.length * 0.99)].toFixed(1)} max ${fr[fr.length - 1].toFixed(1)}`);
console.log(`car on screen, 2nd diff RMS (max):  x ${(sx * 1000).toFixed(2)} (${(mxx * 1000).toFixed(1)})  y ${(sy * 1000).toFixed(2)} (${(mxy * 1000).toFixed(1)})   [NDC x1000]`);
console.log(`body roll 2nd diff RMS (max) ${(sr * 1e4).toFixed(2)} (${(mxr * 1e4).toFixed(1)})  pitch ${(sp * 1e4).toFixed(2)} (${(mxp * 1e4).toFixed(1)})   [rad x1e4]`);
console.log(`peak kmh ${Math.max(...J.map((j) => j[5])).toFixed(0)}  peak slip ${(Math.max(...J.map((j) => Math.abs(j[6]))) * 57.3).toFixed(0)} deg`);
