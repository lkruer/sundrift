// QA: a very long idle on the title (nobody touches anything), then a run: does anything grow while the title sits
// there, and is the first minute of the run after it clean?
import { open, sleep, AP_SRC } from './qa_lib.mjs';

const MIN = Number((process.argv.find((a) => a.startsWith('--min=')) || '--min=6').slice(6));
const Q = await open({ out: 'work/qa_out/idle' });
const { ev, note, shot, tap } = Q;
const census = async (label) => {
  await ev('window.gc(); window.gc();'); await sleep(300);
  note(label, JSON.stringify(await ev(`(() => { const D = window.__DEBUG__, r = D.renderer; let objs = 0; D.scene.traverse(() => objs++); return { heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1), geo: r.info.memory.geometries, tex: r.info.memory.textures, progs: r.info.programs.length, objs, dom: document.getElementsByTagName('*').length, hour: D.G.hour, mode: D.G.mode, fps: D.G.fps }; })()`)));
};
await census('title at load');
await ev('window.__ONFRAME__ = window.__QA__.onFrame; window.__QA__.take();');
for (let m = 1; m <= MIN; m++) { await sleep(60000); const f = await ev('window.__QA__.take()'); note(`title idle ${m} min: frames ${f.n} p50 ${f.real.p50} p99 ${f.real.p99} max ${f.real.max}`); }
await census(`title after ${MIN} min idle`);
await shot('title_after_idle');
await tap('#startb'); await sleep(300);
await ev('window.__QA__.take();');
await ev(`window.__QA_PLAN__ = 'none'; window.__QA_EVERY__ = 1e9;`); await ev(AP_SRC);
await sleep(60000);
const f = await ev('window.__QA__.take()');
note('first minute of the run after the idle', JSON.stringify({ frames: f.n, p50: f.real.p50, p99: f.real.p99, max: f.real.max, over34: f.over34, slow: f.slow }));
await census('after one minute of driving');
note('errors', Q.errors.length, JSON.stringify(Q.errors.slice(0, 6)));
await Q.close();
