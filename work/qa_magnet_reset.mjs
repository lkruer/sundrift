// QA: RESTART and MAIN MENU while the magnet has the car. Where is the magnet afterwards?
import { open, sleep } from './qa_lib.mjs';

const Q = await open({ out: 'work/qa_out/magnet_reset' });
const { ev, note, shot, tap } = Q;
await tap('#startb'); await sleep(1500);
const offroad = `(() => { const D = window.__DEBUG__; window.__AUTOPILOT__ = (dt) => { const c = D.car, t = D.track, G = D.G; const p = t.sample(G.s + 12); const side = (t.pts[p.i].hardL === Infinity) ? 1 : -1; const w = (side > 0 ? p.wl : p.wr) + 6; const lx = Math.cos(p.h), lz = -Math.sin(p.h);
  const want = Math.atan2(p.x + lx * w * side - c.x, p.z + lz * w * side - c.z); let e = want - c.yaw; e = Math.atan2(Math.sin(e), Math.cos(e)); return { throttle: c.speed < 8 ? 1 : 0, brake: 0, steer: Math.max(-1, Math.min(1, e * 2)), hand: 0, reverse: false, touch: false }; }; })()`;
const mag = `(() => { const M = window.__DEBUG__.magnet; return { active: M.active, pos: M.g.position.toArray().map((v) => +v.toFixed(1)), beam: +M.beam.material.opacity.toFixed(2), rings: M.rings.map((r) => +r.material.opacity.toFixed(2)), dust: +M.dust.material.opacity.toFixed(2) }; })()`;
for (const how of ['restart', 'quit']) {
  await ev(offroad);
  for (let i = 0; i < 60; i++) { await sleep(250); if (await ev('window.__DEBUG__.magnet.active && window.__DEBUG__.magnet.run.t > 0.8')) break; }
  note(how, 'magnet mid-flight:', JSON.stringify(await ev(mag)));
  await ev('window.__AUTOPILOT__ = null');
  await tap('#pauseb'); await sleep(300);
  await tap(how === 'restart' ? '#restartb' : '#quitb'); await sleep(1500);
  note(how, 'after', JSON.stringify(await ev(mag)), 'car at', await ev('Math.round(window.__DEBUG__.G.s)'), 'mode', await ev('window.__DEBUG__.G.mode'));
  // look at where the magnet was left, from the car
  await ev(`(() => { const D = window.__DEBUG__, M = D.magnet.g.position, c = D.car; window.__CAM__ = { pos: [c.x, D.G.carY + 4, c.z], look: [M.x, M.y, M.z], fov: 60 }; })()`);
  await sleep(600); await shot('magnet_left_after_' + how); await ev('window.__CAM__ = null');
  if (how === 'quit') break;
}
note('errors', Q.errors.length, JSON.stringify(Q.errors.slice(0, 5)));
await Q.close();
