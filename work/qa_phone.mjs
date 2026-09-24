// QA phone: layouts at three phone sizes and landscape, real touches (one-finger steering, the handbrake pad with a
// second finger, the pause button), an orientation change mid-run, and the first-run hint.
import fs from 'fs';
import path from 'path';
import { open, sleep } from './qa_lib.mjs';

const MAP = process.argv.find((a) => a.startsWith('--map=')) ? process.argv.find((a) => a.startsWith('--map=')).slice(6) : 'mountain';
const Q = await open({ phone: true, out: 'work/qa_out/phone_' + MAP });
const { page, ev, note, shot, tap, cdp, waitBuilt } = Q;
note('ready', Q.ready.toFixed(1), 's', 'touchMode', await ev('document.body.classList.contains("touch")'));
const VP = {
  p390: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  p360: { width: 360, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  p430: { width: 430, height: 932, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  l844: { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true },
  l640: { width: 640, height: 360, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true },
};
// what overlaps what: every visible HUD box, and any pair that intersect
const boxesJs = `(() => { const ids = ['scorebox','combo','dstack','clockbox','boostbar','cluster','angle','coach','toasts','courseout','hbtns','stick','brake','smash'];
  const out = {}; for (const id of ids) { const e = document.getElementById(id); if (!e) continue; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue; out[id] = [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; }
  const hits = []; const k = Object.keys(out); for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) { const a = out[k[i]], b = out[k[j]];
    if (['stick','brake'].includes(k[i]) || ['stick','brake'].includes(k[j])) continue;
    if (a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]) hits.push(k[i] + '/' + k[j]); }
  const off = k.filter((id) => { const a = out[id]; return a[0] < -2 || a[1] < -2 || a[2] > innerWidth + 2 || a[3] > innerHeight + 2; });
  return { vw: innerWidth, vh: innerHeight, boxes: out, overlaps: hits, offscreen: off }; })()`;
const titleJs = `(() => { const m = document.querySelector('#title .menu'); const r = m.getBoundingClientRect(); const s = document.getElementById('startb').getBoundingClientRect();
  return { menu: [Math.round(r.top), Math.round(r.bottom)], start: [Math.round(s.top), Math.round(s.bottom)], vh: innerHeight, scrollH: document.scrollingElement.scrollHeight, menuScroll: m.scrollHeight > m.clientHeight + 2 }; })()`;

if (MAP === 'city') { await tap('.map[data-m=city]'); await sleep(300); await waitBuilt(); }
for (const [k, vp] of Object.entries(VP)) {
  await page.setViewport(vp); await sleep(1200);
  await shot(`title_${k}`);
  note('title', k, await ev(titleJs));
}
await page.setViewport(VP.p390); await sleep(800);
await tap('#startb'); await sleep(1500);
note('started', await ev('({ mode: window.__DEBUG__.G.mode, touch: document.body.classList.contains("touch"), layer: document.getElementById("touch").classList.contains("on") })'));
await shot('run_start_p390');

// ---- touch driving: one finger on the stick, steering by telemetry; a second finger on the handbrake into tight corners
const rect = async (id) => ev(`(() => { const r = document.getElementById('${id}').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 8, radiusY: 8, force: 1 })) });
const driveTouch = async (sec, label) => {
  const st = await rect('stick'), br = await rect('brake');
  const x0 = st[0] + st[2] * 0.5, y0 = st[1] + st[3] * 0.62;
  const bx = br[0] + br[2] * 0.5, by = br[1] + br[3] * 0.6;
  await touch('touchStart', [[x0, y0, 0]]);
  let hand = false, t = 0, handT = 0, maxSlip = 0, steerSeen = 0, n = 0;
  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < sec) {
    const s = await ev(`(() => { const D = window.__DEBUG__, G = D.G, c = D.car, t = D.track; const e = Math.atan2(Math.sin((G.roadH ?? 0) - c.yaw), Math.cos((G.roadH ?? 0) - c.yaw)); const k = t.sample(G.s + 20).k;
      return { e, u: G.u, k, kmh: c.kmh, slip: c.beta * 57.3, steer: c.steer, mode: G.mode }; })()`);
    if (s.mode !== 'playing') break;
    let cmd = s.e * 1.4 - s.u * 0.12 + s.k * 9;
    if (Math.abs(s.slip) > 35) cmd = Math.sign(s.slip) * 0.8;
    cmd = Math.max(-1, Math.min(1, cmd));
    const tight = Math.abs(s.k) > 1 / 35 && s.kmh > 45;
    const x = x0 - cmd * 64, y = y0 - (s.kmh > (Math.abs(s.k) > 0.02 ? 70 : 120) ? -80 : 0);   // pull down to brake when too fast
    const wantHand = tight && (Date.now() - handT > 3000);
    if (wantHand && !hand) { hand = true; handT = Date.now(); await touch('touchStart', [[x, y, 0], [bx, by, 1]]); }
    else if (hand && Date.now() - handT > 400) { hand = false; await touch('touchEnd', [[x, y, 0]]); }
    else await touch('touchMove', hand ? [[x, y, 0], [bx, by, 1]] : [[x, y, 0]]);
    maxSlip = Math.max(maxSlip, Math.abs(s.slip)); steerSeen = Math.max(steerSeen, Math.abs(s.steer)); n++;
    await sleep(40);
  }
  await touch('touchEnd', []);
  note('touch drive', label, { ticks: n, maxSlip: Math.round(maxSlip), maxSteer: steerSeen.toFixed(2), s: await ev('Math.round(window.__DEBUG__.G.s)'), score: await ev('Math.round(window.__DEBUG__.scoring.total)'), drifts: await ev('window.__DEBUG__.scoring.stats.drifts') });
};
// a screenshot with a finger down and slid right, the wheel under it
{
  const st = await rect('stick');
  const x0 = st[0] + st[2] * 0.5, y0 = st[1] + st[3] * 0.62;
  await touch('touchStart', [[x0, y0, 0]]); await sleep(300);
  await touch('touchMove', [[x0 + 40, y0, 0]]); await sleep(400);
  note('finger down, slid right 40 px:', await ev('({ steer: window.__DEBUG__.car.steer.toFixed(2), throttle: window.__DEBUG__.car.throttle, wheelOpacity: getComputedStyle(document.getElementById("wheel")).opacity })'));
  await shot('touch_wheel_p390');
  await touch('touchMove', [[x0 + 40, y0 + 120, 0]]); await sleep(500);
  note('pulled down 120 px (brake):', await ev('({ brake: window.__DEBUG__.car.brake, throttle: window.__DEBUG__.car.throttle, kmh: Math.round(window.__DEBUG__.car.kmh) })'));
  await touch('touchEnd', []); await sleep(300);
}
await driveTouch(25, 'portrait 390');
await shot('run_touch_p390');
note('hud p390', await ev(boxesJs));
// the coach hint (first run: nothing banked yet) shows 9 to 36 s in; screenshot when it is up
note('coach', await ev('({ text: document.getElementById("coach").textContent, op: getComputedStyle(document.getElementById("coach")).opacity })'));

// ---- the pause button by touch, resume by touch
await tap('#pauseb'); await sleep(600);
note('pause tap:', await ev('window.__DEBUG__.G.mode'), await ev('window.__DEBUG__.audio.ctx ? window.__DEBUG__.audio.ctx.state : "-"'));
await shot('pause_p390');
await tap('#resumeb'); await sleep(600);
note('resume tap:', await ev('window.__DEBUG__.G.mode'));

// ---- orientation change mid-run: landscape and back
for (const k of ['l844', 'p360', 'p430', 'l640', 'p390']) {
  await page.setViewport(VP[k]); await sleep(1500);
  const cv = await ev('({ canvas: [document.getElementById("c").width, document.getElementById("c").height], css: [innerWidth, innerHeight], aspect: window.__DEBUG__.chase.cam.aspect.toFixed(3) })');
  note('viewport', k, cv, await ev(boxesJs));
  await driveTouch(8, k);
  await shot(`run_${k}`);
  await tap('#pauseb'); await sleep(500); await shot(`pause_${k}`); await tap('#resumeb'); await sleep(400);
}
// ---- the off-road panel and the magnet on a phone (does the panel sit clear of the rest?)
await ev(`(() => { const D = window.__DEBUG__; window.__AUTOPILOT__ = (dt) => { const c = D.car, t = D.track, G = D.G; const p = t.sample(G.s + 12); const w = p.wl + 6; const lx = Math.cos(p.h), lz = -Math.sin(p.h);
  const want = Math.atan2(p.x + lx * w - c.x, p.z + lz * w - c.z); let e = want - c.yaw; e = Math.atan2(Math.sin(e), Math.cos(e)); return { throttle: c.speed < 9 ? 1 : 0, brake: 0, steer: Math.max(-1, Math.min(1, e * 2)), hand: 0, reverse: false, touch: true }; }; })()`);
for (let i = 0; i < 20; i++) { await sleep(500); const o = await ev('window.__DEBUG__.G.off ? window.__DEBUG__.G.off.t : null'); if (o !== null && o < 3.5) break; }
await shot('offroad_p390');
note('off-road panel', await ev(boxesJs));
for (let i = 0; i < 20; i++) { await sleep(300); if (await ev('window.__DEBUG__.magnet.active')) break; }
await sleep(700);
await shot('magnet_p390');
await ev('window.__AUTOPILOT__ = null');
note('errors', Q.errors.length, JSON.stringify(Q.errors.slice(0, 10)));
fs.writeFileSync(path.join(Q.OUT, 'phone.txt'), Q.log.join('\n'));
await Q.close();
