// QA: which geometries leak? Every geometry the renderer draws is remembered (with what drew it); after a drive, the
// ones no longer in the scene and never disposed are still holding their GPU buffers.
import fs from 'fs';
import path from 'path';
import { open, sleep, AP_SRC } from './qa_lib.mjs';

const MAP = (process.argv.find((a) => a.startsWith('--map=')) || '--map=mountain').slice(6);
const MIN = Number((process.argv.find((a) => a.startsWith('--min=')) || '--min=3').slice(6));
const Q = await open({ out: 'work/qa_out/geoleak_' + MAP });
const { ev, note, tap, waitBuilt } = Q;
if (MAP === 'city') { await tap('.map[data-m=city]'); await sleep(300); await waitBuilt(); await sleep(1500); }
await tap('#startb'); await sleep(1500);
await ev(`(() => { const r = window.__DEBUG__.renderer, orig = r.renderBufferDirect; const seen = window.__GEO__ = new Map();
  r.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
    if (!seen.has(geometry.id)) { const e = { g: new WeakRef(geometry), what: object.type + ':' + (object.name || (object.parent && object.parent.name) || '') + '|' + material.type + ':' + (material.name || ''), disposed: false, n: geometry.attributes.position ? geometry.attributes.position.count : 0 };
      geometry.addEventListener('dispose', () => { e.disposed = true; }); seen.set(geometry.id, e); }
    return orig.apply(this, arguments); }; })()`);
await ev(`window.__QA_PLAN__ = 'smash,offroad,smash,crash,reverse,donut'; window.__QA_EVERY__ = 15;`);
await ev(AP_SRC);
await sleep(MIN * 60000);
await ev('window.__AUTOPILOT__ = null');
await sleep(1000);
if (process.argv.includes('--restart')) {
  await tap('#pauseb'); await sleep(400); await tap('#restartb'); await sleep(800);
  for (let i = 0; i < 100; i++) { await sleep(200); if (await ev('!window.__DEBUG__.world.job && !window.__DEBUG__.world.terrain.job')) break; }
  await sleep(3000);
  note('restarted at', await ev('Math.round(window.__DEBUG__.G.s)'));
}
const r = await ev(`(() => { const D = window.__DEBUG__, inScene = new Set(); D.scene.traverse((o) => { if (o.geometry) inScene.add(o.geometry.id); });
  const by = {}; let n = 0, verts = 0; for (const [id, e] of window.__GEO__) { if (e.disposed || inScene.has(id)) continue; const g = e.g.deref(); n++; verts += e.n; by[e.what] = (by[e.what] || 0) + 1; }
  return { drawn: window.__GEO__.size, leaked: n, leakedVerts: verts, rendererGeometries: D.renderer.info.memory.geometries, inScene: inScene.size, by: Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 25), s: Math.round(D.G.s) }; })()`);
note(JSON.stringify(r, null, 1));
note('errors', Q.errors.length);
fs.writeFileSync(path.join(Q.OUT, 'geoleak.json'), JSON.stringify(r, null, 1));
await Q.close();
