// The HUD in the moments a player sees most, at a phone held upright (390 x 844), on its side (844 x 390) and a
// desktop (1280 x 720): the first seconds of a run, a drift held (the count, the multiplier, the angle meter), the
// cash-in, the off-road countdown going red, the magnet carrying the car, a smash, and a callout over the road.
// Real touches on the phone (one finger on the stick, the thumb on the pad); the autopilot steers on the desktop.
//   node work/qa_hud_shots.mjs [--vp=390x844 | --vp=844x390 | (desktop)] [--city] [--out=work/shots/qa_hud]
import fs from 'fs';
import path from 'path';
import { open, arg, sleep } from './qa_lib.mjs';

const VP = arg('vp', '');
const CITY = process.argv.includes('--city');
const tag = (VP || '1280x720') + (CITY ? '_city' : '');
const OUT = arg('out', 'work/shots/qa_hud');
let viewport = null;
if (VP) { const [w, h] = VP.split('x').map(Number); viewport = { width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true }; }
const q = await open({ phone: !!VP, viewport, out: OUT, storage: { 'sundrift.drifted': process.argv.includes('--first') ? '0' : '1' } });
const { page, ev, note, shot } = q;
if (CITY) { await q.tap('.map[data-m=city]'); await sleep(500); await q.waitBuilt(); await sleep(1200); }
await shot(`qa_${tag}_title`);
await q.tap('#startb');
await sleep(1200);
await shot(`qa_${tag}_0_start`);
const touch = !!VP;
// a real finger on the stick (phone): the input is touch, so the HUD draws the wheel and the pad
let finger = null, fx = 0, fy = 0;
if (touch) {
  const r = await ev(`(() => { const b = document.getElementById('stick').getBoundingClientRect(); return { x: b.x + b.width * 0.45, y: b.y + b.height * 0.6 }; })()`);
  fx = r.x; fy = r.y;
  finger = await page.touchscreen.touchStart(fx, fy);
}
// the drive: the gate's policy, with the steering coming from the finger on a phone (the autopilot sets only the
// throttle and the handbrake there, through the real input) or the keys' ramp on a desktop
await ev(`(() => {
  const D = window.__DEBUG__, G = D.G, t = D.track, car = D.car;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  let T = 0, handUntil = 0, handCool = 0, k = 0;
  window.__DRV__ = { key: 0, hand: 0 };
  window.__AUTOPILOT__ = (dt) => {
    T += dt;
    const slip = car.beta * 180 / Math.PI, kmh = car.kmh;
    const headErr = wrap((G.roadH ?? t.pts[G.idx].h) - car.yaw);
    const k0 = t.sample(G.s + 22).k, kk = Math.abs(k0);
    const vmax = kk > 0.002 ? Math.sqrt(11 / kk) * 3.6 : 999;
    const cmd = headErr * 1.3 - G.u * 0.12 + k0 * 9;
    if (kk > 1 / 32 && kmh > 42 && T > handCool) { handUntil = T + 0.38; handCool = T + 3.2; }
    let key = cmd > 0.05 ? 1 : cmd < -0.05 ? -1 : 0;
    if (Math.abs(slip) > 38) key = slip > 0 ? 1 : -1;
    window.__DRV__.key = key; window.__DRV__.hand = T < handUntil ? 1 : 0;
    const rate = key ? 7.2 : 12; k += Math.max(-rate * dt, Math.min(rate * dt, key - k));
    const real = D.hud.input ? D.hud.input.sample(dt) : null;
    const tooFast = kmh > vmax * 1.15;
    return { throttle: tooFast ? 0 : 1, brake: tooFast ? 1 : 0, steer: ${touch} && real ? real.steer : k, hand: T < handUntil ? 1 : 0, reverse: false, touch: ${touch} };
  };
  return true;
})()`);
// on a phone, the finger follows what the driver wants (a real touch move every 80 ms)
let driving = true;
const follow = (async () => {
  while (driving && touch) {
    const d = await ev('window.__DRV__ || { key: 0 }');
    const R = 70;
    await finger.move(fx - d.key * R * 0.95, fy).catch(() => {});
    await sleep(80);
  }
})();
const waitFor = (cond, ms) => ev(`new Promise((res) => { const t0 = performance.now(); const f = () => { let ok = false; try { ok = (${cond}); } catch {} if (ok || performance.now() - t0 > ${ms}) res(ok); else requestAnimationFrame(f); }; f(); })`);
// a drift held with points on it
const D = 'window.__DEBUG__';
const got = await waitFor(`${D}.scoring.active && ${D}.scoring.points > 600 && Math.abs(${D}.car.beta) > 0.4`, 40000);
await shot(`qa_${tag}_1_drift${got ? '' : '_maybe'}`);
await waitFor(`!${D}.scoring.active`, 15000);
await sleep(180);
await shot(`qa_${tag}_2_bank`);
await sleep(900);
await shot(`qa_${tag}_3_after_bank`);
// off the road: steer off a free edge and wait for the countdown to go red, then the magnet
driving = false; await follow;
const off = await ev(`(async () => {
  const D = window.__DEBUG__, t = D.track, G = D.G;
  for (let s = G.s + 40; s < G.s + 900; s += 10) {
    let ok = true;
    for (let k = 0; k <= 40 && ok; k += 5) { const p = t.sample(s + k), pt = t.pts[p.i]; if (p.tunnel || Math.abs(p.k) > 1 / 80 || !(pt.hardL === Infinity || pt.hardL === 2.75 && ${CITY})) ok = false; }
    if (ok) {
      // just past the open edge, rolling slowly along it, then stopped: the countdown runs
      D.teleport(s, 0);
      const p = t.sample(s), lx = Math.cos(p.h), lz = -Math.sin(p.h), u = p.wl + 1.4;
      D.car.reset(p.x + lx * u, p.z + lz * u, p.h); D.car.vF = 4;
      G.carY = D.world.ground.height(D.car.x, D.car.z); G.vy = 0; G.off = null; G.floor = null;
      return s;
    }
  }
  return -1;
})()`);
await sleep(300);
await ev(`(() => { const D = window.__DEBUG__, car = D.car; let T = 0; window.__AUTOPILOT__ = (dt) => { T += dt; return { throttle: 0, brake: 1, steer: 0, hand: 0, reverse: false, touch: ${touch} }; }; })()`);
await waitFor(`${D}.G.off && ${D}.G.off.t < 3.6`, 8000);
await shot(`qa_${tag}_4_offroad`);
await waitFor(`${D}.G.off && ${D}.G.off.t < 1.4`, 8000);
await shot(`qa_${tag}_5_offroad_hot`);
await waitFor(`${D}.magnet.active && ${D}.magnet.run.t > 0.9`, 8000);
await shot(`qa_${tag}_6_magnet`);
await waitFor(`!${D}.magnet.active`, 8000);
await sleep(200);
// a smash: the next knockable thing ahead, driven into
const sm = await ev(`(() => {
  const D = window.__DEBUG__, t = D.track, w = D.world, G = D.G;
  for (let ds = 20; ds <= 400; ds += 8) {
    const p = t.sample(G.s + ds); let best = null;
    w.near(p.x, p.z, 14, (rec) => { if (!best && rec.alive && rec.kind === 'knock') best = rec; });
    if (best) { const q = t.nearest(best.x, best.z, p.i); return { s: q.s, u: q.u, name: best.name }; }
  }
  return null;
})()`);
note('smash target', JSON.stringify(sm));
if (sm) {
  await ev(`(() => { const D = window.__DEBUG__, t = D.track, G = D.G, car = D.car; D.teleport(${sm.s} - 30, 50); const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    window.__AUTOPILOT__ = (dt) => { const pa = t.sample(G.s + 7 + car.speed * 0.4), lx = Math.cos(pa.h), lz = -Math.sin(pa.h); const tx = pa.x + lx * ${sm.u}, tz = pa.z + lz * ${sm.u}; const err = wrap(Math.atan2(tx - car.x, tz - car.z) - car.yaw); return { throttle: car.speed < 14 ? 1 : 0, brake: 0, steer: Math.max(-1, Math.min(1, err * 2.2)), hand: 0, reverse: false, touch: ${touch} }; }; })()`);
  await waitFor(`${D}.hud.smashS && performance.now() - ${D}.hud.smashS.t0 > 120`, 8000);
  await shot(`qa_${tag}_7_smash`);
}
await ev('window.__AUTOPILOT__ = null');
if (finger) await finger.end().catch(() => {});
// what the HUD's layout says about itself
const rects = await ev(`(() => { const h = window.__DEBUG__.hud; return { rects: h.rects(), boxes: h.boxes(), scale: h.s, W: h.W, H: h.H, compact: h.compact, portrait: h.portrait }; })()`);
fs.writeFileSync(path.resolve(OUT, `qa_${tag}_layout.json`), JSON.stringify(rects, null, 1));
note('layout', JSON.stringify({ W: rects.W, H: rects.H, compact: rects.compact, portrait: rects.portrait }));
if (q.errors.length) note('errors', q.errors.slice(0, 5));
await q.close();
