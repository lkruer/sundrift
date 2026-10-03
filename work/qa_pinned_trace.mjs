// One nose-in case traced frame by frame in the game: why does the scrape-free pivot (main.js G.pinned) stop?
//   node work/qa_pinned_trace.mjs [--theta=60] [--steer=straight|away|toward] [--v0=0] [--game=<dir>]
import { open, arg, sleep } from './qa_lib.mjs';
const TH = Number(arg('theta', 60)), ST = arg('steer', 'straight'), V0 = Number(arg('v0', 0));
const q = await open({ out: 'work/shots/qa_wall', storage: { 'sundrift.drifted': '1' } });
const { ev, note } = q;
await q.tap('#startb');
await sleep(1500);
const out = await ev(`(async () => {
  const D = window.__DEBUG__, t = D.track, G = D.G, car = D.car;
  const s = 560, side = 1, th = ${TH} * Math.PI / 180;
  D.teleport(s, 0);
  await new Promise((r) => setTimeout(r, 400));
  const p = t.sample(s), lx = Math.cos(p.h), lz = -Math.sin(p.h);
  const pt = t.pts[p.i]; const hard = pt.hardL;
  const w = p.wl + hard;
  const K = 0.62, fN = 2.08 * K, lN = 0.97 * K;
  const uc = side * (w - 0.04 - fN * Math.sin(th) - lN * Math.abs(Math.cos(th)));
  car.reset(p.x + lx * uc, p.z + lz * uc, p.h + side * th); car.vF = ${V0};
  G.carY = p.y; G.vy = 0; G.off = null; G.floor = null;
  const rows = []; let T = 0, f = 0;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const hw = car.hitWall.bind(car); let hits = 0, depthMax = 0;
  car.hitWall = (...a) => { hits++; depthMax = Math.max(depthMax, a[2]); return hw(...a); };
  await new Promise((res) => {
    window.__AUTOPILOT__ = (dt) => {
      T += dt; f++;
      if (f % 6 === 1) { rows.push([+T.toFixed(2), +car.speed.toFixed(2), +car.vF.toFixed(2), +car.vL.toFixed(2), +(wrap(car.yaw - p.h) * 57.3).toFixed(1), +(G.pinned || 0).toFixed(2), hits, +depthMax.toFixed(3), +car.omega.toFixed(2), +(car.steer * 57.3).toFixed(0), +G.u.toFixed(2)]); hits = 0; depthMax = 0; }
      if (T > 4) { window.__AUTOPILOT__ = null; res(); }
      const away = -side, steer = '${ST}' === 'away' ? away : '${ST}' === 'toward' ? -away : 0;
      return { throttle: 1, brake: 0, steer, hand: 0, reverse: false, touch: false };
    };
  });
  car.hitWall = hw;
  return rows;
})()`);
note('[t, speed, vF, vL, heading vs road deg, G.pinned, wall hits in 6 frames, deepest, omega, wheel deg, u]');
for (const r of out) note(JSON.stringify(r));
await q.close();
