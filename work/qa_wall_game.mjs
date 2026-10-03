// The car against the world's hard edges, in the game itself (main.js: walls once a frame per corner, the scrape-free
// pivot, the scoring's crash threshold):
//   1. nose in: the car set against a rail (the pass) or a street front (the city) at 30 to 150 degrees, from a
//      standstill or rolling at 5 m/s, then the gas held with the wheel away from the wall, toward it, or straight.
//      How long until it drives off along the road, and does it ever stay stuck?
//   2. a slide whose tail swings into the rail: the drift's fate (kept, or dropped as a crash), the speed it costs.
//   node work/qa_wall_game.mjs [--city] [--fps=30] [--out=work/shots/qa_wall]
import fs from 'fs';
import path from 'path';
import { open, arg, sleep } from './qa_lib.mjs';

const CITY = process.argv.includes('--city');
const FPS = Number(arg('fps', 0));
const OUT = arg('out', 'work/shots/qa_wall');
const q = await open({ out: OUT, storage: { 'sundrift.drifted': '1' } });
const { ev, note } = q;
if (FPS) await ev(`(() => { const raf = window.requestAnimationFrame.bind(window); let last = 0; window.requestAnimationFrame = (f) => raf(function g(t) { if (t - last < ${1000 / FPS} - 2) return raf(g); last = t; f(t); }); })()`);
if (CITY) { await q.tap('.map[data-m=city]'); await sleep(500); await q.waitBuilt(); await sleep(1200); }
await q.tap('#startb');
await sleep(1500);

// find straight stretches with a hard edge on one side (a rail, or the city's fronts), built
const spots = await ev(`(async () => {
  const D = window.__DEBUG__, t = D.track, out = [];
  for (let s = 120; s < 2200 && out.length < 6; s += 40) {
    D.teleport(s, 0);
    await new Promise((r) => setTimeout(r, 60));
    for (const side of [1, -1]) {
      let ok = true;
      for (let k = -12; k <= 30 && ok; k += 2) {
        const p = t.sample(s + k), pt = t.pts[p.i], hard = side > 0 ? pt.hardL : pt.hardR;
        if (hard === undefined || hard === Infinity || p.tunnel || Math.abs(p.k) > 1 / 250 || p.express) ok = false;
      }
      if (ok && !out.some((o) => Math.abs(o.s - s) < 150)) { const pt = t.pts[t.sample(s).i]; out.push({ s, side, hard: side > 0 ? pt.hardL : pt.hardR }); }
    }
  }
  return out;
})()`);
note('spots', JSON.stringify(spots));

const rows = [];
let n = 0;
for (const theta of [30, 60, 85, 120, 150]) for (const v0 of [0, 5]) for (const steerMode of ['away', 'toward', 'straight']) {
  const sp = spots[n++ % spots.length];
  const r = await ev(`(async () => {
    const D = window.__DEBUG__, t = D.track, G = D.G, car = D.car;
    const s = ${sp.s}, side = ${sp.side}, th = ${theta} * Math.PI / 180, hard = ${sp.hard};
    D.magnet.run = null; D.chase.cine = null; G.off = null;
    D.teleport(s, 0);
    await new Promise((r) => setTimeout(r, 300));
    const p = t.sample(s), lx = Math.cos(p.h), lz = -Math.sin(p.h);
    const w = (side > 0 ? p.wl : p.wr) + hard;
    // the outer front corner just short of the wall
    const K = 0.62, fN = 2.08 * K, lN = 0.97 * K;
    const uc = side * (w - 0.04 - fN * Math.sin(th) - lN * Math.abs(Math.cos(th)));
    car.reset(p.x + lx * uc, p.z + lz * uc, p.h + side * th);
    car.vF = ${v0};
    G.carY = p.y; G.vy = 0; G.off = null; G.floor = null;
    D.scoring.reset();
    let T = 0, freeAt = -1, pinnedMax = 0, minV = 99, stuckT = 0, maxStuck = 0;
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    await new Promise((res) => {
      window.__AUTOPILOT__ = (dt) => {
        T += dt;
        const err = wrap((G.roadH ?? p.h) - car.yaw);
        pinnedMax = Math.max(pinnedMax, G.pinned || 0);
        if (car.speed < 0.5) { stuckT += dt; maxStuck = Math.max(maxStuck, stuckT); } else stuckT = 0;
        if (freeAt < 0 && car.vF > 5 && Math.abs(err) < 0.45) freeAt = T;
        if (T > 9 || freeAt >= 0 && T > freeAt + 0.5) { window.__AUTOPILOT__ = null; res(); }
        const away = -side;
        const steer = '${steerMode}' === 'away' ? away : '${steerMode}' === 'toward' ? -away : 0;
        return { throttle: 1, brake: 0, steer, hand: 0, reverse: false, touch: false };
      };
    });
    return { free: freeAt >= 0 ? +freeAt.toFixed(2) : null, pinnedMax: +pinnedMax.toFixed(2), maxStuck: +maxStuck.toFixed(2), magnet: D.magnet.active, off: !!G.off, u: +G.u.toFixed(1) };
  })()`);
  rows.push({ theta, v0, steerMode, ...r });
  note(`nose ${String(theta).padStart(3)} deg, ${v0} m/s, wheel ${steerMode.padEnd(8)}: ${r.free !== null ? 'drives off after ' + r.free + ' s' : 'NOT FREE after 9 s'}  (longest stopped ${r.maxStuck} s, pinned ${r.pinnedMax} s${r.magnet ? ', MAGNET' : ''}${r.off ? ', off the road' : ''})`);
}

// 2. a slide into the rail: the car set 1.6 m from the rail, sliding (slip 25 to 45 deg) with the tail toward it
const slides = [];
for (const slip of [25, 35, 45]) for (const v of [16, 22, 28]) {
  const sp = spots[n++ % spots.length];
  const r = await ev(`(async () => {
    const D = window.__DEBUG__, t = D.track, G = D.G, car = D.car, sc = D.scoring;
    const s = ${sp.s} - 10, side = ${sp.side}, hard = ${sp.hard};
    D.teleport(s, 0);
    await new Promise((r) => setTimeout(r, 300));
    const p = t.sample(s), lx = Math.cos(p.h), lz = -Math.sin(p.h);
    const w = (side > 0 ? p.wl : p.wr) + hard;
    const uc = side * (w - 1.7);
    // travelling along the road, the nose turned away from the wall by the slip (so the tail is toward it)
    const b = ${slip} * Math.PI / 180;
    car.reset(p.x + lx * uc, p.z + lz * uc, p.h - side * b);
    car.vF = ${v} * Math.cos(b); car.vL = ${v} * Math.sin(b) * side;
    G.carY = p.y; G.vy = 0; G.off = null; G.floor = null;
    sc.reset();
    let T = 0, hits = 0, impMax = 0, active = 0, crash = false;
    const hw = car.hitWall.bind(car);
    car.hitWall = (...a) => { const v = hw(...a); if (v > 0.5) hits++; impMax = Math.max(impMax, v); return v; };
    const v0 = car.speed;
    await new Promise((res) => {
      window.__AUTOPILOT__ = (dt) => {
        T += dt;
        if (sc.active) active += dt;
        if (T > 2.5) { window.__AUTOPILOT__ = null; res(); }
        // the key held into the turn (away from the wall: the slide's own way), the gas
        return { throttle: 1, brake: 0, steer: -side, hand: 0, reverse: false, touch: false };
      };
    });
    car.hitWall = hw;
    return { hits, impMax: +impMax.toFixed(1), crashes: sc.stats.crashes, drifting: +active.toFixed(2), v0: +v0.toFixed(1), v1: +car.speed.toFixed(1), slipEnd: Math.round(car.beta * 57.3) };
  })()`);
  slides.push({ slip, v, ...r });
  note(`slide ${slip} deg at ${v} m/s, tail into the rail: wall contacts ${r.hits}, worst impact ${r.impMax} m/s, crashes ${r.crashes}, drifting ${r.drifting} s of 2.5, speed ${r.v0} -> ${r.v1}`);
}
fs.mkdirSync(path.resolve(OUT), { recursive: true });
fs.writeFileSync(path.resolve(OUT, `wall_${CITY ? 'city' : 'pass'}${FPS ? '_' + FPS + 'fps' : ''}.json`), JSON.stringify({ spots, rows, slides }, null, 1));
if (q.errors.length) note('errors', q.errors.slice(0, 5));
await q.close();
