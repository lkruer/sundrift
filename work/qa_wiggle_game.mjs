// The wiggle on the real road: the straightest stretches of the course, entered at 100 km/h, and the wheel thrown from
// side to side every ~0.7 s with the gas held (each side held a little longer the way that brings the car back to the
// middle). Points a second, switches, how far from the middle it strays, and whether it ever leaves the road or hits
// anything, against a held drift through the course's bends driven by the bench's skilled driver.
//   node work/qa_wiggle_game.mjs [--city] [--course=hard]
import fs from 'fs';
import path from 'path';
import { open, arg, sleep } from './qa_lib.mjs';

const CITY = process.argv.includes('--city');
const COURSE = arg('course', 'easy');
const OUT = arg('out', 'work/shots/qa_bench');
const q = await open({ out: OUT, storage: { 'sundrift.drifted': '1' } });
const { ev, note } = q;
if (CITY) { await q.tap('.map[data-m=city]'); await sleep(500); await q.waitBuilt(); await sleep(1200); }
if (COURSE === 'hard') { await q.tap('.diff[data-d=hard]'); await sleep(500); await q.waitBuilt(); await sleep(1200); }
await q.tap('#startb');
await sleep(1500);

// the straightest 250 m stretches within the first 3 km
const spots = await ev(`(() => {
  const t = window.__DEBUG__.track; t.ensure(3600);
  // every 200 m window by its tightest bend, the five straightest (not overlapping) kept, whatever their radius
  const all = [];
  for (let s = 200; s < 3000; s += 20) {
    let kmax = 0, tun = false;
    for (let k = 0; k <= 200; k += 5) { const p = t.sample(s + k); kmax = Math.max(kmax, Math.abs(p.k)); if (p.tunnel) tun = true; }
    if (!tun) all.push({ s, k: kmax });
  }
  all.sort((a, b) => a.k - b.k);
  const out = [];
  for (const a of all) if (out.length < 5 && !out.some((o) => Math.abs(o.s - a.s) < 260)) out.push({ s: a.s, R: Math.round(1 / Math.max(a.k, 1e-4)) });
  return out;
})()`);
note('straight stretches', JSON.stringify(spots));
const rows = [];
for (const sp of spots) {
  for (const P of [0.05, 0.1]) {
    const r = await ev(`(async () => {
      const D = window.__DEBUG__, t = D.track, G = D.G, car = D.car, sc = D.scoring;
      const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
      D.teleport(${sp.s}, 100); await new Promise((r) => setTimeout(r, 400));
      D.teleport(${sp.s}, 100);
      sc.reset();
      let T = 0, k = 0, side = 1, umax = 0, off = 0, flick = 0.3;
      const ev0 = {}; const oe = D.hud.onEvent.bind(D.hud); D.hud.onEvent = (e) => { ev0[e.type] = (ev0[e.type] || 0) + 1; return oe(e); };
      await new Promise((res) => {
        window.__AUTOPILOT__ = (dt) => {
          T += dt;
          umax = Math.max(umax, Math.abs(G.u)); if (G.off) off += dt;
          if (G.s > ${sp.s} + 200 || T > 14) { window.__AUTOPILOT__ = null; res(); }
          // a player's wiggle: a handbrake flick to start, then the key thrown the other way each time the direction of
          // travel swings past A either side of the road's heading (nudged toward the middle of the road): the swing's
          // size is the player's choice, the rhythm comes out of the car
          const travel = car.yaw + Math.atan2(car.vL, Math.max(1, car.vF));
          const err = wrap(travel - (G.roadH ?? 0)) + G.u * 0.03;   // positive: heading left of the road (or left of the middle)
          const A = ${P};
          if (T > flick) { if (side > 0 && err > A) side = -1; else if (side < 0 && err < -A) side = 1; }
          const key = T < flick ? 1 : side;
          const rate = key ? 7.2 : 12; k += Math.max(-rate * dt, Math.min(rate * dt, key - k));
          return { throttle: T < flick ? 0.3 : car.speed < 33 ? 1 : 0.6, brake: 0, steer: k, hand: T < flick ? 1 : 0, reverse: false, touch: false };
        };
      });
      D.hud.onEvent = oe;
      const held = sc.active ? sc.points : 0; if (sc.active) sc.bank();
      return { T: +T.toFixed(1), pts: Math.round(sc.total), pps: Math.round(sc.total / T), switches: ev0.switch || 0, crashes: sc.stats.crashes, umax: +umax.toFixed(1), off: +off.toFixed(1), kmh: Math.round(car.kmh), half: t.half, wall: t.wall };
    })()`);
    rows.push({ ...sp, P, ...r });
    note(`${CITY ? 'city' : 'pass'} ${COURSE} straight at ${sp.s} (R>${sp.R}) wiggle +-${Math.round(P * 57.3)} deg: ${r.pps} pts/s over ${r.T} s, ${r.switches} switches, strays ${r.umax} m (asphalt half ${r.half}, edge ${r.wall}), ${r.off} s off the road, ${r.crashes} crashes, ends ${r.kmh} km/h`);
  }
}
fs.writeFileSync(path.resolve(OUT, `wiggle_${CITY ? 'city' : 'pass'}_${COURSE}.json`), JSON.stringify(rows, null, 1));
if (q.errors.length) note('errors', q.errors.slice(0, 5));
await q.close();
