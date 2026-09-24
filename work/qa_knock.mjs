// QA: knock over one of every kind of knockable thing on a map, driving into it; record what the game says and does.
import fs from 'fs';
import path from 'path';
import { open, sleep } from './qa_lib.mjs';

const MAP = (process.argv.find((a) => a.startsWith('--map=')) || '--map=mountain').slice(6);
const Q = await open({ out: 'work/qa_out/knock_' + MAP });
const { ev, note, shot, tap, waitBuilt } = Q;
if (MAP === 'city') { await tap('.map[data-m=city]'); await sleep(300); await waitBuilt(); await sleep(1500); }
await tap('#startb'); await sleep(1500);
// count smash callouts by label, and the sounds asked for by name
await ev(`(() => { const D = window.__DEBUG__; window.__KN__ = { smash: [], sfx: [] };
  const sm = D.hud.smash.bind(D.hud); D.hud.smash = (l, t, n) => { window.__KN__.smash.push([l, t, n]); return sm(l, t, n); };
  const sf = D.audio.sfx.bind(D.audio); D.audio.sfx = (name, k) => { window.__KN__.sfx.push(name); return sf(name, k); }; })()`);
const kinds = MAP === 'city' ? ['bag', 'box', 'crate', 'crates', 'cone', 'aboard', 'bike', 'lamp', 'bollard', 'vending', 'pole', 'chevron', 'chevronM', 'mirror', 'warn', 'shrub']
  : ['pole', 'shrub', 'lamp', 'warn', 'chevron', 'chevronM', 'mirror', 'vending', 'bollard'];
const results = [];
for (const kind of kinds) {
  // find one ahead of the car: a live record of that name in the collider hash, nearest the road ahead
  let found = null;
  for (let tries = 0; tries < 8 && !found; tries++) {
    found = await ev(`(() => { const D = window.__DEBUG__, w = D.world, t = D.track, G = D.G; let best = null;
      for (const a of w.cols.values()) for (const r of a) { if (!r.alive || r.name !== '${kind}') continue; const q = t.nearest(r.x, r.z, G.idx);
        if (q.s < G.s + 40 || Math.abs(q.u) > (q.u >= 0 ? q.wl : q.wr) + 7) continue; if (!best || q.s < best.s) best = { s: q.s, u: q.u, x: r.x, z: r.z, y: r.y }; }
      return best; })()`);
    if (!found) { await ev(`window.__DEBUG__.teleport(window.__DEBUG__.G.s + 400, 0)`); await sleep(2500); }
  }
  if (!found) { results.push([kind, 'none found']); note(kind, 'none found'); continue; }
  await ev(`window.__DEBUG__.teleport(${found.s - 30}, 30)`); await sleep(300);
  await ev(`window.__KN__.smash.length = 0; window.__KN__.sfx.length = 0; window.__KN__.score0 = window.__DEBUG__.scoring.total; window.__KN__.debris0 = window.__DEBUG__.debris.list.length;`);
  // drive straight at it
  await ev(`(() => { const D = window.__DEBUG__, X = ${found.x}, Z = ${found.z}; window.__AUTOPILOT__ = (dt) => { const c = D.car; const want = Math.atan2(X - c.x, Z - c.z); let e = want - c.yaw; e = Math.atan2(Math.sin(e), Math.cos(e));
    return { throttle: c.speed < 11 ? 1 : 0, brake: 0, steer: Math.max(-1, Math.min(1, e * 2.5)), hand: 0, reverse: false, touch: false }; }; })()`);
  let hit = null;
  for (let i = 0; i < 40; i++) {
    await sleep(100);
    hit = await ev(`(() => { const K = window.__KN__; return K.smash.length || window.__DEBUG__.debris.list.length > K.debris0 ? { smash: K.smash.slice(), sfx: K.sfx.slice(), score: Math.round(window.__DEBUG__.scoring.total - K.score0), debris: window.__DEBUG__.debris.list.length - K.debris0 } : null; })()`);
    if (hit) break;
  }
  await sleep(250);
  await shot(`hit_${kind}`);
  await ev('window.__AUTOPILOT__ = null');
  const after = await ev(`({ sfx: window.__KN__.sfx.slice(), smash: window.__KN__.smash.slice(), score: Math.round(window.__DEBUG__.scoring.total - window.__KN__.score0) })`);
  results.push([kind, hit ? 'hit' : 'MISSED', after]);
  note(kind, hit ? 'hit' : 'MISSED', after);
  await sleep(600);
}
note('errors', Q.errors.length, JSON.stringify(Q.errors.slice(0, 10)));
fs.writeFileSync(path.join(Q.OUT, 'knock.json'), JSON.stringify(results, null, 1));
await Q.close();
