// QA: small phones on their side (640x360, iPhone SE 667x375, 568x320): is START on screen, and does the run's HUD leave the car visible?
import { open, sleep } from './qa_lib.mjs';

const Q = await open({ phone: true, out: 'work/qa_out/small_landscape' });
const { page, ev, note, shot, tap } = Q;
const sizes = [[640, 360], [667, 375], [568, 320], [740, 360]];
const startJs = `(() => { const s = document.getElementById('startb').getBoundingClientRect(), m = document.querySelector('#title .menu').getBoundingClientRect(); return { start: [Math.round(s.top), Math.round(s.bottom)], vh: innerHeight, startVisible: s.bottom <= innerHeight && s.top >= 0, menuTop: Math.round(m.top) }; })()`;
for (const [w, h] of sizes) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true }); await sleep(1000);
  note(`title ${w}x${h}`, JSON.stringify(await ev(startJs)));
  await shot(`title_${w}x${h}`);
}
await page.setViewport({ width: 667, height: 375, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true }); await sleep(800);
await ev('document.getElementById("startb").click()'); await sleep(1500);
// put the car off the road so the countdown panel shows, with a smash callout and a drift count up
await ev(`(() => { const D = window.__DEBUG__; window.__AUTOPILOT__ = (dt) => { const c = D.car, t = D.track, G = D.G; const p = t.sample(G.s + 12); const w = p.wl + 6; const lx = Math.cos(p.h), lz = -Math.sin(p.h);
  const want = Math.atan2(p.x + lx * w - c.x, p.z + lz * w - c.z); let e = want - c.yaw; e = Math.atan2(Math.sin(e), Math.cos(e)); return { throttle: c.speed < 10 ? 1 : 0, brake: 0, steer: Math.max(-1, Math.min(1, e * 2)), hand: c.speed > 8 ? 1 : 0, reverse: false, touch: true }; }; })()`);
for (let i = 0; i < 30; i++) { await sleep(300); if (await ev('!!window.__DEBUG__.G.off')) break; }
await sleep(700);
await shot('run_667x375_offroad');
const car = await ev(`(() => { const D = window.__DEBUG__, v = new (D.car.constructor === Object ? Object : Object)(); const cam = D.chase.cam, p = D.scene.getObjectByName('car').position.clone().project(cam);
  const sx = (p.x * 0.5 + 0.5) * innerWidth, sy = (1 - (p.y * 0.5 + 0.5)) * innerHeight; const hits = [];
  for (const id of ['courseout', 'dstack', 'angle', 'smash', 'toasts', 'coach']) { const e = document.getElementById(id); if (!e) continue; const r = e.getBoundingClientRect(); if (r.width && getComputedStyle(e).opacity !== '0' && sx > r.left && sx < r.right && sy > r.top && sy < r.bottom) hits.push(id); }
  return { carOnScreen: [Math.round(sx), Math.round(sy)], coveredBy: hits }; })()`);
note('car on screen (667x375, off the road):', JSON.stringify(car));
await ev('window.__AUTOPILOT__ = null');
note('errors', Q.errors.length);
await Q.close();
