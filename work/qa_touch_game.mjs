// The drift held by a thumb, in the game, with real touches on a phone (390 x 844): on one of NEO TOKYO's straight
// avenues at 80 km/h, starting from the right-hand side of the road, the thumb on the HAND BRAKE pad for 0.3 s while
// the finger slides out to X px into the turn (left) and stays there, the gas held (a finger on the stick is the gas).
// The slide angle it settles at (the mean slip from 0.6 to 1.8 s after the flick, before the slide's own turn takes
// the car across the road) at each X.
//   node work/qa_touch_game.mjs [--game=<dir>] [--px=35,45,55,70]
import { open, arg, sleep } from './qa_lib.mjs';

const PX = arg('px', '35,45,55,70').split(',').map(Number);
const q = await open({ phone: true, out: 'work/shots/qa_touch', storage: { 'sundrift.drifted': '1' } });
const { page, ev, note } = q;
await q.tap('.map[data-m=city]'); await sleep(500); await q.waitBuilt(); await sleep(1200);
await q.tap('#startb');
await sleep(1500);
// the straightest 120 m of avenue
const s0 = await ev(`(() => { const t = window.__DEBUG__.track; t.ensure(3000); let best = 300, bk = 1; for (let s = 150; s < 2800; s += 10) { let km = 0; for (let k = -20; k <= 100; k += 5) { const p = t.sample(s + k); km = Math.max(km, Math.abs(p.k) + (p.tunnel || p.express ? 1 : 0)); } if (km < bk) { bk = km; best = s; } } return { s: best, R: Math.round(1 / Math.max(bk, 1e-5)) }; })()`);
note('avenue at', JSON.stringify(s0));
const stick = await ev(`(() => { const b = document.getElementById('stick').getBoundingClientRect(); return { x: b.x + b.width * 0.5, y: b.y + b.height * 0.6 }; })()`);
const pad = await ev(`(() => { const p = window.__DEBUG__.hud.boxes().pad; return { x: p.x + p.w / 2, y: p.y + p.h / 2 }; })()`);
for (const px of PX) {
  const res = [];
  for (let rep = 0; rep < 3; rep++) {
    await ev(`(() => { const D = window.__DEBUG__, t = D.track, car = D.car; D.magnet.run = null; D.G.off = null; D.teleport(${s0.s}, 80);
      const p = t.sample(${s0.s}), lx = Math.cos(p.h), lz = -Math.sin(p.h), u = -(t.half - 1.5);
      car.x = p.x + lx * u; car.z = p.z + lz * u; D.scoring.reset(); return true; })()`);
    await sleep(120);
    const finger = await page.touchscreen.touchStart(stick.x, stick.y);
    const thumb = await page.touchscreen.touchStart(pad.x, pad.y);
    const t0 = await ev('performance.now()');
    for (let k = 1; k <= 4; k++) { await finger.move(stick.x - (px * k) / 4, stick.y); await sleep(15); }
    await sleep(240);
    await thumb.end();
    const r = await ev(`new Promise((res) => { const D = window.__DEBUG__, car = D.car; let n = 0, sum = 0, peak = 0, hits = 0; const hw = car.hitWall.bind(car); car.hitWall = (...a) => { const v = hw(...a); if (v > 0.5) hits++; return v; }; const f = () => { const T = (performance.now() - ${t0}) / 1000; if (T > 0.6 && T < 1.8) { sum += Math.abs(car.beta); n++; } peak = Math.max(peak, Math.abs(car.beta)); if (T > 1.8) { car.hitWall = hw; res({ held: +(sum / Math.max(1, n) * 57.3).toFixed(1), peak: +(peak * 57.3).toFixed(0), hits, wheel: +D.hud.input.t.steer.toFixed(2), kmh: Math.round(car.kmh) }); } else requestAnimationFrame(f); }; f(); })`);
    await finger.end();
    res.push(r);
    await sleep(300);
  }
  const held = res.reduce((a, r) => a + r.held, 0) / res.length;
  note(`finger ${String(px).padStart(2)} px into the turn (wheel ${res[0].wheel}): slide settles at ${held.toFixed(1)} deg (runs ${res.map((r) => r.held).join(', ')}; peaks ${res.map((r) => r.peak).join('/')}; wall contacts ${res.reduce((a, r) => a + r.hits, 0)})`);
}
if (q.errors.length) note('errors', q.errors.slice(0, 5));
await q.close();
