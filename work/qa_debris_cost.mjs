// QA: what the flying debris costs per frame (its bodies' corners ask the ground every substep), near the start and
// late in a session (the course grown to --far metres), smashing down a city pavement.
import { open, sleep } from './qa_lib.mjs';

const FAR = Number((process.argv.find((a) => a.startsWith('--far=')) || '--far=15000').slice(6));
const Q = await open({ out: 'work/qa_out/debris_cost' });
const { ev, note, tap, waitBuilt } = Q;
await tap('.map[data-m=city]'); await sleep(300); await waitBuilt(); await sleep(1500);
await tap('#startb'); await sleep(1500);
await ev(`(() => { const D = window.__DEBUG__, d = D.debris, u = d.update.bind(d); window.__DC__ = []; d.update = (dt) => { const t = performance.now(); u(dt); const ms = performance.now() - t; const moving = d.list.filter((b) => !b.asleep && !(b.sink > 0)).length; if (moving) window.__DC__.push([ms, moving, dt]); }; })()`);
const smashRun = async (label) => {
  await ev('window.__DC__.length = 0');
  // along the pavement at 40 km/h: everything on it goes flying
  await ev(`(() => { const D = window.__DEBUG__; window.__AUTOPILOT__ = (dt) => { const c = D.car, t = D.track, G = D.G; const p = t.sample(G.s + 10); const side = 1, w = p.wl + 1.2; const lx = Math.cos(p.h), lz = -Math.sin(p.h);
    const want = Math.atan2(p.x + lx * w * side - c.x, p.z + lz * w * side - c.z); let e = want - c.yaw; e = Math.atan2(Math.sin(e), Math.cos(e)); return { throttle: c.speed < 11 ? 1 : 0, brake: 0, steer: Math.max(-1, Math.min(1, e * 2)), hand: 0, reverse: false, touch: false }; }; })()`);
  await sleep(12000);
  await ev('window.__AUTOPILOT__ = null');
  const r = await ev(`(() => { const a = window.__DC__; if (!a.length) return null; const ms = a.map((x) => x[0]).sort((p, q) => p - q); const per = a.map((x) => x[0] / x[1]);
    return { frames: a.length, bodiesMax: Math.max(...a.map((x) => x[1])), msAvg: +(ms.reduce((s, x) => s + x, 0) / ms.length).toFixed(2), msP99: +ms[Math.floor(ms.length * 0.99)].toFixed(2), msMax: +ms[ms.length - 1].toFixed(2), msPerBody: +(per.reduce((s, x) => s + x, 0) / per.length).toFixed(3), pads: window.__DEBUG__.track.pads.length }; })()`);
  note(label, JSON.stringify(r));
};
await smashRun('near the start');
await ev(`(() => { const D = window.__DEBUG__; D.track.ensure(${FAR} + 2400); D.teleport(${FAR}, 30); })()`);
await sleep(5000);
await smashRun(`at ${FAR / 1000} km`);
note('errors', Q.errors.length);
await Q.close();
