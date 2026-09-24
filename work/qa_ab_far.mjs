// QA A/B: the cost of the world late in a session, without driving half an hour first. The course is grown to 30 km (as
// half an hour at speed grows it), the car put down near the end of it, and driven by the autopilot for a minute:
// terrain tile build time, world ms per frame, and frame times. Run from the game folder under test (old or fixed).
import { open, sleep, AP_SRC } from './qa_lib.mjs';

const MAP = (process.argv.find((a) => a.startsWith('--map=')) || '--map=mountain').slice(6);
const FAR = Number((process.argv.find((a) => a.startsWith('--far=')) || '--far=30000').slice(6));
const Q = await open({ out: 'work/qa_out/abfar_' + MAP });
const { ev, note, tap, waitBuilt } = Q;
if (MAP === 'city') { await tap('.map[data-m=city]'); await sleep(300); await waitBuilt(); await sleep(1500); }
await tap('#startb'); await sleep(1500);
const measure = async (label, sec) => {
  await ev('window.__ONFRAME__ = window.__QA__.onFrame; window.__QA__.take(); window.__T0__ = { b: window.__DEBUG__.world.terrain.stats.built, ms: window.__DEBUG__.world.terrain.stats.ms };');
  await ev(`window.__QA_PLAN__ = 'none'; window.__QA_EVERY__ = 1e9;`); await ev(AP_SRC);
  await ev('window.__DEBUG__.rainNow(0); window.__DEBUG__.G.hour = 22;');
  await sleep(sec * 1000);
  const f = await ev('window.__QA__.take()');
  const t = await ev('(() => { const s = window.__DEBUG__.world.terrain.stats, a = window.__T0__; return { tiles: s.built - a.b, msPerTile: +((s.ms - a.ms) / Math.max(1, s.built - a.b)).toFixed(1), pads: window.__DEBUG__.track.pads.length, s: Math.round(window.__DEBUG__.G.s) }; })()');
  note(label, JSON.stringify({ frames: f.n, p50: f.real.p50, p90: f.real.p90, p99: f.real.p99, max: f.real.max, over20: f.over20, over34: f.over34, js50: f.js.p50, js99: f.js.p99, world50: f.world.p50, world99: f.world.p99, ...t }));
  await ev('window.__AUTOPILOT__ = null');
};
await measure('near the start', 50);
// grow the course and go to the far end of it
await ev(`(() => { const D = window.__DEBUG__; D.track.ensure(${FAR} + 2400); D.teleport(${FAR}, 60); })()`);
await sleep(4000);
await measure(`at ${FAR / 1000} km`, 50);
note('errors', Q.errors.length, JSON.stringify(Q.errors.slice(0, 5)));
await Q.close();
