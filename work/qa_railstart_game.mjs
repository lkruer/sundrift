// Off the road where the edge is open, driving along the verge, and the edge ahead becomes a rail (a guardrail run
// begins, a tunnel portal, the city's expressway): main.js tests each corner against the side's hard line, so a car
// already past where the rail now is counts as deep inside it, and car.hitWall moves it out by the whole depth. Does the
// car jump through the rail onto the road? How far in one frame?
//   node work/qa_railstart_game.mjs [--city] [--course=hard]
import fs from 'fs';
import path from 'path';
import { open, arg, sleep } from './qa_lib.mjs';

const CITY = process.argv.includes('--city');
const COURSE = arg('course', 'easy');
const OUT = arg('out', 'work/shots/qa_wall');
const q = await open({ out: OUT, storage: { 'sundrift.drifted': '1' } });
const { ev, note, shot } = q;
if (CITY) { await q.tap('.map[data-m=city]'); await sleep(500); await q.waitBuilt(); await sleep(1200); }
if (COURSE === 'hard') { await q.tap('.diff[data-d=hard]'); await sleep(500); await q.waitBuilt(); await sleep(1200); }
await q.tap('#startb');
await sleep(1500);

// where a side's hard line steps from open (or the city's fronts) to a rail, on a gentle stretch, in built chunks
const spots = await ev(`(async () => {
  const D = window.__DEBUG__, t = D.track, out = [];
  for (let s = 100; s < 3000 && out.length < 8; s += 60) {
    D.teleport(s, 0);
    await new Promise((r) => setTimeout(r, 80));
    for (let i = t.index(s - 40); i < t.index(s + 60); i++) {
      const a = t.pts[i], b = t.pts[i + 1];
      if (!a || !b) continue;
      for (const side of [1, -1]) {
        const ha = side > 0 ? a.hardL : a.hardR, hb = side > 0 ? b.hardL : b.hardR;
        if (ha === undefined || hb === undefined) continue;
        if (ha > 1 && hb === 0 && Math.abs(a.k) < 1 / 60 && !out.some((o) => Math.abs(o.s - b.s) < 80)) out.push({ s: b.s, side, from: ha, why: b.tunnel ? 'tunnel' : b.express ? 'express' : t.nearTunnel(b.s, 12) ? 'portal' : 'rail' });
      }
    }
  }
  return out;
})()`);
note('rail starts', JSON.stringify(spots));
const rows = [];
let k = 0;
for (const sp of spots) {
  for (const off of [1.2, 2.5]) {
    const r = await ev(`(async () => {
      const D = window.__DEBUG__, t = D.track, G = D.G, car = D.car;
      const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
      const s0 = ${sp.s} - ${process.argv.includes('--near') ? 4 : 30}, side = ${sp.side};
      // (a magnet still carrying the car from the case before would hold it: let it go)
      D.magnet.run = null; D.chase.cine = null; G.off = null;
      D.teleport(s0, 0);
      await new Promise((r) => setTimeout(r, 300));
      const p = t.sample(s0), lx = Math.cos(p.h), lz = -Math.sin(p.h);
      const u0 = side * ((side > 0 ? p.wl : p.wr) + ${off});
      car.reset(p.x + lx * u0, p.z + lz * u0, p.h); car.vF = 12;
      G.carY = D.world.ground.height(car.x, car.z); G.vy = 0; G.off = null; G.floor = null;
      let T = 0, maxJump = 0, jumpAt = null, lastU = null, uAfter = null, lastX = car.x, lastZ = car.z, impacts = 0;
      const hw = car.hitWall.bind(car); car.hitWall = (...a) => { if (a[2] > 0.5) impacts++; return hw(...a); };
      await new Promise((res) => {
        window.__AUTOPILOT__ = (dt) => {
          T += dt;
          const n = t.nearest(car.x, car.z, G.idx);
          // the lateral step, measured on the road's frame, since the last frame
          const moved = Math.hypot(car.x - lastX, car.z - lastZ); lastX = car.x; lastZ = car.z;
          if (lastU !== null && Math.abs(n.u - lastU) < 20 && Math.abs(n.u - lastU) > maxJump) { maxJump = Math.abs(n.u - lastU); jumpAt = [+G.s.toFixed(1), +lastU.toFixed(2), +n.u.toFixed(2), +moved.toFixed(2)]; } if (moved > (window.__MAXMOVE__ || 0)) window.__MAXMOVE__ = moved;
          lastU = n.u;
          if (G.s > ${sp.s} + 15 || T > 6 || D.magnet.active) { uAfter = n.u; window.__AUTOPILOT__ = null; res(); }
          // hold the line along the verge, parallel to the road
          const err = wrap(n.h - car.yaw) * 1.6 - (n.u - u0) * 0.15;
          return { throttle: car.speed < 12 ? 0.6 : 0, brake: 0, steer: Math.max(-1, Math.min(1, err)), hand: 0, reverse: false, touch: false };
        };
      });
      car.hitWall = hw;
      const mm = window.__MAXMOVE__ || 0; window.__MAXMOVE__ = 0; return { maxMove: +mm.toFixed(2), maxJump: +maxJump.toFixed(2), jumpAt, uAfter: uAfter === null ? null : +uAfter.toFixed(2), impacts, magnet: D.magnet.active };
    })()`);
    rows.push({ ...sp, off, ...r });
    note(`${sp.why} starting at s ${Math.round(sp.s)} (side ${sp.side > 0 ? 'left' : 'right'}), the car ${off} m past the edge on the verge: biggest lateral step in one frame ${r.maxJump} m (biggest move in a frame ${r.maxMove} m) ${r.jumpAt ? '[s, u before, u after, metres moved] ' + JSON.stringify(r.jumpAt) : ''}, ends at u ${r.uAfter}${r.magnet ? ' (magnet)' : ''}`);
    if (r.maxJump > 0.8 && k++ < 2) await shot(`qa_railstart_${Math.round(sp.s)}_${off}`);
  }
}
fs.mkdirSync(path.resolve(OUT), { recursive: true });
fs.writeFileSync(path.resolve(OUT, `railstart_${CITY ? 'city' : 'pass'}_${COURSE}.json`), JSON.stringify(rows, null, 1));
if (q.errors.length) note('errors', q.errors.slice(0, 5));
await q.close();
