// A car set on the verge (open edge, 1.2 m past it) at 12 m/s with the gas held, traced frame by frame: why does it
// not move at all in some places?   node work/qa_verge_trace.mjs [--s=770] [--side=1] [--off=1.2] [--game=<dir>]
import { open, arg, sleep } from './qa_lib.mjs';
const S = Number(arg('s', 770)), SIDE = Number(arg('side', 1)), OFF = Number(arg('off', 1.2)), BACK = Number(arg('back', 30));
const q = await open({ out: 'work/shots/qa_wall', storage: { 'sundrift.drifted': '1' } });
const { ev, note, shot } = q;
await q.tap('#startb');
await sleep(1500);
const out = await ev(`(async () => {
  const D = window.__DEBUG__, t = D.track, G = D.G, car = D.car;
  const s0 = ${S} - ${BACK}, side = ${SIDE};
  D.teleport(s0, 0);
  await new Promise((r) => setTimeout(r, 300));
  const p = t.sample(s0), lx = Math.cos(p.h), lz = -Math.sin(p.h);
  const u0 = side * ((side > 0 ? p.wl : p.wr) + ${OFF});
  car.reset(p.x + lx * u0, p.z + lz * u0, p.h); car.vF = 12;
  G.carY = D.world.ground.height(car.x, car.z); G.vy = 0; G.off = null; G.floor = null;
  const rows = []; let T = 0, f = 0, hits = 0;
  const hw = car.hitWall.bind(car); car.hitWall = (...a) => { hits++; return hw(...a); };
  await new Promise((res) => {
    window.__AUTOPILOT__ = (dt) => {
      T += dt; f++;
      if (f % 10 === 1) rows.push([+T.toFixed(2), +car.x.toFixed(2), +car.z.toFixed(2), +car.vF.toFixed(2), +car.speed.toFixed(2), car.air, +G.carY.toFixed(2), +D.world.ground.height(car.x, car.z).toFixed(2), G.off ? +G.off.t.toFixed(1) : null, hits, +G.u.toFixed(2), D.magnet.active, +(dt * 1000).toFixed(1), G.mode]);
      hits = 0;
      if (T > 3) { window.__AUTOPILOT__ = null; res(); }
      return { throttle: 1, brake: 0, steer: 0, hand: 0, reverse: false, touch: false };
    };
  });
  car.hitWall = hw;
  return rows;
})()`);
note('[t, x, z, vF, speed, air, carY, ground, off.t, wall hits, u, magnet, dt ms, mode]');
for (const r of out) note(JSON.stringify(r));
await shot('qa_verge_trace');
await q.close();
