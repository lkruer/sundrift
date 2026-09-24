// QA: leaks, measured like for like. A census at the start line, a long drive (everything the autopilot does, rain
// coming and going), then RESTART back to the same start line under the same sky, and the census again.
import fs from 'fs';
import path from 'path';
import { open, sleep, AP_SRC } from './qa_lib.mjs';

const MAP = (process.argv.find((a) => a.startsWith('--map=')) || '--map=mountain').slice(6);
const MIN = Number((process.argv.find((a) => a.startsWith('--min=')) || '--min=6').slice(6));
const Q = await open({ out: 'work/qa_out/return_' + MAP });
const { ev, note, shot, tap, waitBuilt, cdp } = Q;
if (MAP === 'city') { await tap('.map[data-m=city]'); await sleep(300); await waitBuilt(); await sleep(1500); }
await tap('#startb'); await sleep(1500);
const settle = async () => {
  for (let i = 0; i < 100; i++) { await sleep(200); if (await ev('!window.__DEBUG__.world.job && !window.__DEBUG__.world.terrain.job && !window.__DEBUG__.world.terrain.farJob')) break; }
  await sleep(1500);
};
const census = async (label) => {
  // the same sky and weather every time: an hour of deep night, dry
  await ev('(() => { const D = window.__DEBUG__; D.rainNow(0); D.W.wet = 0; D.G.hour = 22; })()');
  await sleep(2500);
  await ev('window.__QA__.gcs.push(performance.now()); window.gc(); window.gc();'); await sleep(500);
  const r = await ev(`(() => { const D = window.__DEBUG__, r = D.renderer, w = D.world; let objs = 0, meshes = 0; D.scene.traverse((o) => { objs++; if (o.isMesh) meshes++; });
    const pools = {}; for (const [k, p] of Object.entries(w.pools)) if (p.n) pools[k] = p.n;
    return { s: Math.round(D.G.s), heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1), geo: r.info.memory.geometries, tex: r.info.memory.textures, progs: r.info.programs.length,
      objs, meshes, chunks: w.chunks.size, near: w.stats.near, tiles: w.terrain.tiles.size, cols: w.cols.size, colsBy: w.colsBy.size, lamps: w.lamps.length, dom: document.getElementsByTagName('*').length,
      debris: D.debris.list.length, flats: D.debris.flats.length, audPlaying: window.__QA__.aud.started - window.__QA__.aud.ended, pools }; })()`);
  const dom = await cdp.send('Memory.getDOMCounters');
  note('census', label, JSON.stringify({ ...r, listeners: dom.jsEventListeners, nodes: dom.nodes }));
  await shot('census_' + label.replace(/\W+/g, '_'));
  return r;
};
await settle();
const A = await census('start');
await ev(`window.__QA_PLAN__ = 'smash,offroad,smash,crash,reverse,smash,offroad,donut'; window.__QA_EVERY__ = 15;`);
await ev(AP_SRC);
const t0 = Date.now();
let k = 0;
while ((Date.now() - t0) / 60000 < MIN) {
  await sleep(20000); k++;
  // a shower every minute or so, and the hour pushed on, so the weather and the light change as they would in a long run
  if (k % 3 === 1) await ev('window.__DEBUG__.rainNow(0.8)');
  if (k % 3 === 2) await ev('(() => { const D = window.__DEBUG__; D.W.target = 0; D.W.next = 1e9; D.W.raining = false; })()');
  const s = await ev('({ s: Math.round(window.__DEBUG__.G.s), mode: window.__QA__.ap.mode, tex: window.__DEBUG__.renderer.info.memory.textures, geo: window.__DEBUG__.renderer.info.memory.geometries })');
  note('driving', JSON.stringify(s));
}
await ev('window.__AUTOPILOT__ = null');
await sleep(500);
// RESTART from the pause menu: back to the same start line
await tap('#pauseb'); await sleep(400); await tap('#restartb'); await sleep(800);
await settle();
const B = await census('after restart');
// and once more after a second, shorter drive, to see if anything keeps climbing
await ev(AP_SRC);
await sleep(90000);
await ev('window.__AUTOPILOT__ = null');
await tap('#pauseb'); await sleep(400); await tap('#restartb'); await sleep(800);
await settle();
const C = await census('after restart 2');
const diff = (a, b) => Object.fromEntries(Object.keys(a).filter((k) => typeof a[k] === 'number').map((k) => [k, +(b[k] - a[k]).toFixed(1)]));
note('delta start -> restart 1', JSON.stringify(diff(A, B)));
note('delta restart 1 -> restart 2', JSON.stringify(diff(B, C)));
note('pools start', JSON.stringify(A.pools)); note('pools restart 2', JSON.stringify(C.pools));
note('errors', Q.errors.length, JSON.stringify(Q.errors.slice(0, 10)));
fs.writeFileSync(path.join(Q.OUT, 'return.txt'), Q.log.join('\n'));
await Q.close();
