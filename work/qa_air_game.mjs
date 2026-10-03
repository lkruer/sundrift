// Off the open edges at speed, in the game: how long in the air, how high over the ground, how hard the landing, and
// whether anything comes out wrong (a NaN, the car under the ground, a spin on landing). Then the magnet that follows
// (the gas is let go, the countdown runs out): where it sets the car down (on the asphalt? facing along the road? clear
// of the walls?) and how the car leaves it.
//   node work/qa_air_game.mjs [--city] [--course=hard]
import fs from 'fs';
import path from 'path';
import { open, arg, sleep } from './qa_lib.mjs';

const CITY = process.argv.includes('--city');
const COURSE = arg('course', 'easy');
const OUT = arg('out', 'work/shots/qa_air');
const q = await open({ out: OUT, storage: { 'sundrift.drifted': '1' } });
const { ev, note, shot } = q;
if (CITY) { await q.tap('.map[data-m=city]'); await sleep(500); await q.waitBuilt(); await sleep(1200); }
if (COURSE === 'hard') { await q.tap('.diff[data-d=hard]'); await sleep(500); await q.waitBuilt(); await sleep(1200); }
await q.tap('#startb');
await sleep(1500);

// open edges on gentle stretches (the car can leave by them)
const spots = await ev(`(async () => {
  const D = window.__DEBUG__, t = D.track, out = [];
  for (let s = 150; s < 4000 && out.length < 10; s += 90) {
    D.teleport(s, 0);
    await new Promise((r) => setTimeout(r, 60));
    for (const side of [1, -1]) {
      let ok = true;
      for (let k = -10; k <= 40 && ok; k += 5) { const p = t.sample(s + k), pt = t.pts[p.i], hd = side > 0 ? pt.hardL : pt.hardR; if (p.tunnel || Math.abs(p.k) > 1 / 70 || !(hd === Infinity || (${CITY} && hd > 2))) ok = false; }
      if (ok && !out.some((o) => Math.abs(o.s - s) < 200)) { out.push({ s, side }); break; }
    }
  }
  return out;
})()`);
note('open edges', JSON.stringify(spots));
const rows = [];
for (const sp of spots) for (const kmh of [60, 100]) {
  const r = await ev(`(async () => {
    const D = window.__DEBUG__, t = D.track, G = D.G, car = D.car;
    D.magnet.run = null; D.chase.cine = null; G.off = null;
    D.teleport(${sp.s} - 25, ${kmh});
    await new Promise((r) => setTimeout(r, 200));
    D.teleport(${sp.s} - 25, ${kmh});
    const side = ${sp.side};
    let T = 0, airT = 0, maxH = 0, landV = 0, wasAir = false, bad = '', magT = -1, mag = null, after = null, maxBetaLand = 0, landT = -1;
    await new Promise((res) => {
      window.__AUTOPILOT__ = (dt) => {
        T += dt;
        if (!Number.isFinite(car.x + car.z + car.yaw + car.vF + car.vL + G.carY)) bad = 'NaN';
        const gy = D.world.ground.height(car.x, car.z);
        if (car.air) { airT += dt; maxH = Math.max(maxH, G.carY - gy); }
        if (wasAir && !car.air) { landV = Math.max(landV, -G.vy); landT = T; }
        if (landT > 0 && T - landT < 1.5) maxBetaLand = Math.max(maxBetaLand, Math.abs(car.beta));
        if (!car.air && G.carY < gy - 0.5 && !D.magnet.active) bad = 'under the ground by ' + (gy - G.carY).toFixed(2);
        wasAir = car.air;
        if (D.magnet.active && magT < 0) magT = T;
        if (magT > 0 && !D.magnet.active && !mag) {
          const n = t.nearest(car.x, car.z, G.idx), w = n.u >= 0 ? n.wl : n.wr;
          mag = { u: +n.u.toFixed(2), onAsphalt: Math.abs(n.u) < t.half, headErr: +(Math.atan2(Math.sin(n.h - car.yaw), Math.cos(n.h - car.yaw)) * 57.3).toFixed(1), vF: +car.vF.toFixed(1), s: Math.round(n.s) };
        }
        if (mag && !after && T > magT + 3.2) after = { kmh: Math.round(car.kmh), off: !!G.off };
        if (T > 14 || after) { window.__AUTOPILOT__ = null; res(); }
        // off the edge at an angle, the gas held 2.5 s, then nothing (let the magnet come)
        const n = t.nearest(car.x, car.z, G.idx);
        const want = n.h + side * 0.35, err = Math.atan2(Math.sin(want - car.yaw), Math.cos(want - car.yaw));
        return T < 2.5 ? { throttle: 1, brake: 0, steer: Math.max(-1, Math.min(1, err * 2)), hand: 0, reverse: false, touch: false } : { throttle: 0, brake: T > 4 ? 1 : 0, steer: 0, hand: 0, reverse: false, touch: false };
      };
    });
    return { airT: +airT.toFixed(2), maxH: +maxH.toFixed(2), landV: +landV.toFixed(1), maxBetaLand: Math.round(maxBetaLand * 57.3), bad, mag, after };
  })()`);
  rows.push({ ...sp, kmh, ...r });
  note(`s ${sp.s} ${sp.side > 0 ? 'left' : 'right'} at ${kmh} km/h: air ${r.airT} s, highest ${r.maxH} m, landing ${r.landV} m/s, slip after landing ${r.maxBetaLand} deg${r.bad ? '  ' + r.bad.toUpperCase() : ''}; magnet: ${r.mag ? `set down at u ${r.mag.u} (${r.mag.onAsphalt ? 'on the asphalt' : 'OFF THE ASPHALT'}), heading off the road by ${r.mag.headErr} deg, ${r.mag.vF} m/s` : 'none'}${r.after ? `; 3 s later ${r.after.kmh} km/h${r.after.off ? ', OFF THE ROAD AGAIN' : ''}` : ''}`);
}
fs.mkdirSync(path.resolve(OUT), { recursive: true });
fs.writeFileSync(path.resolve(OUT, `air_${CITY ? 'city' : 'pass'}_${COURSE}.json`), JSON.stringify(rows, null, 1));
if (q.errors.length) note('errors', q.errors.slice(0, 5));
await q.close();
