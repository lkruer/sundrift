// The two air-probe runs that flagged the car ~10 m under the ground: replayed, logging where the car is when the
// ground height is above it (on the road? in a tunnel? off the road?), to tell a real fall-through from a check that
// reads the hill over a tunnel.   node work/qa_under_trace.mjs
import { open, sleep } from './qa_lib.mjs';
const q = await open({ out: 'work/shots/qa_air', storage: { 'sundrift.drifted': '1' } });
const { ev, note, shot } = q;
await q.tap('#startb');
await sleep(1500);
for (const [s, side] of [[780, -1], [3210, 1]]) {
  const r = await ev(`(async () => {
    const D = window.__DEBUG__, t = D.track, G = D.G, car = D.car;
    D.magnet.run = null; D.chase.cine = null; G.off = null;
    D.teleport(${s} - 25, 100); await new Promise((r) => setTimeout(r, 200)); D.teleport(${s} - 25, 100);
    let T = 0; const log = []; let first = null;
    await new Promise((res) => {
      window.__AUTOPILOT__ = (dt) => {
        T += dt;
        const gy = D.world.ground.height(car.x, car.z);
        const n = t.nearest(car.x, car.z, G.idx), w = n.u >= 0 ? n.wl : n.wr;
        const under = !car.air && G.carY < gy - 0.5;
        if (under && !first) first = { T: +T.toFixed(2), s: Math.round(G.s), u: +G.u.toFixed(1), beyond: +(Math.abs(n.u) - w).toFixed(1), carY: +G.carY.toFixed(1), ground: +gy.toFixed(1), road: +n.y.toFixed(1), tunnel: !!t.inTunnel(G.s), nearTunnel: !!t.nearTunnel(G.s, 30), off: !!G.off, onRoad: !!(G.floor && G.floor.onRoad), kmh: Math.round(car.kmh) };
        if (Math.floor(T * 2) !== Math.floor((T - dt) * 2)) log.push([+T.toFixed(1), Math.round(G.s), +G.u.toFixed(1), +G.carY.toFixed(1), +gy.toFixed(1), +n.y.toFixed(1), !!t.inTunnel(G.s), !!G.off, Math.round(car.kmh)]);
        if (T > 14) { window.__AUTOPILOT__ = null; res(); }
        const want = n.h + ${side} * 0.35, err = Math.atan2(Math.sin(want - car.yaw), Math.cos(want - car.yaw));
        return T < 2.5 ? { throttle: 1, brake: 0, steer: Math.max(-1, Math.min(1, err * 2)), hand: 0, reverse: false, touch: false } : { throttle: 0, brake: T > 4 ? 1 : 0, steer: 0, hand: 0, reverse: false, touch: false };
      };
    });
    return { first, log };
  })()`);
  note(`s ${s} side ${side}: first "under" frame:`, JSON.stringify(r.first));
  note('  [T, s, u, carY, ground, road y, in tunnel, off, kmh] every 0.5 s:', JSON.stringify(r.log));
  if (r.first) await shot(`qa_under_${s}`);
}
await q.close();
