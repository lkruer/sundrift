// QA: a JS sampling profile of the first minutes of a run, and for every slow frame (> 80 ms) the functions the main
// thread was in during it (self time, and the game's own function nearest the leaf).
import fs from 'fs';
import path from 'path';
import { open, sleep, AP_SRC } from './qa_lib.mjs';

const MAP = (process.argv.find((a) => a.startsWith('--map=')) || '--map=mountain').slice(6);
const SEC = Number((process.argv.find((a) => a.startsWith('--sec=')) || '--sec=100').slice(6));
const Q = await open({ out: 'work/qa_out/profile_' + MAP });
const { ev, note, tap, waitBuilt, cdp } = Q;
if (MAP === 'city') { await tap('.map[data-m=city]'); await sleep(300); await waitBuilt(); await sleep(1500); }
await tap('#startb'); await sleep(1500);
await ev('window.__QA__.hookDraws(window.__DEBUG__.renderer); window.__QA__.watchFirst = true;');
await ev('window.__ONFRAME__ = window.__QA__.onFrame; window.__QA__.take();');
await ev(`window.__QA_PLAN__ = 'smash,offroad,smash,crash,reverse,donut'; window.__QA_EVERY__ = 12;`); await ev(AP_SRC);
// the page's clock and the profiler's: anchor them with one reading of each
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
await cdp.send('Profiler.start');
const anchor = await ev('performance.now()');
await sleep(SEC * 1000);
const { profile } = await cdp.send('Profiler.stop');
const slow = await ev('window.__QA__.slowCtx.map((r) => r[r.length - 1]).filter((x) => x[1] > 80)');
const newProgs = await ev('window.__QA__.newProgs || []');
await ev('window.__AUTOPILOT__ = null');
fs.writeFileSync(path.join(Q.OUT, 'profile.cpuprofile'), JSON.stringify(profile));
// sample times in profiler microseconds; the page's performance.now() maps to them through the first sample near the anchor
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
const times = []; let t = profile.startTime; for (const d of profile.timeDeltas) { t += d; times.push(t); }
const toPage = (us) => anchor + (us - profile.startTime) / 1000;       // (profiling started right at the anchor)
const frameOf = (id) => { const n = byId.get(id); return n.callFrame; };
const gameFn = (id) => { let x = id; for (let k = 0; k < 40 && x; k++) { const f = frameOf(x); if (/\/src\/|rig\.js|assetlib/.test(f.url || '') && f.functionName) return (f.functionName || '(anon)') + ' ' + (f.url || '').split('/').pop().split('?')[0] + ':' + (f.lineNumber + 1); x = parent.get(x); } return '(no game frame)'; };
note('slow frames (> 80 ms) and what the main thread was doing in them:');
for (const s of slow) {
  const end = s[0], start = end - s[1];
  const self = {}, game = {}; let n = 0;
  for (let i = 0; i < times.length; i++) { const pt = toPage(times[i]); if (pt < start || pt > end) continue; n++; const f = frameOf(profile.samples[i]); const k = (f.functionName || '(anon)') + ' ' + (f.url || '').split('/').pop().split('?')[0]; self[k] = (self[k] || 0) + 1; const g = gameFn(profile.samples[i]); game[g] = (game[g] || 0) + 1; }
  const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${(v * 0.5).toFixed(0)}ms`).join(' | ');
  note(`  ${s[1]} ms frame (js ${s[2]}) [${s[3]}]: samples ${n}\n     self: ${top(self)}\n     game: ${top(game)}`);
}
note('new programs:', JSON.stringify(newProgs.map((p) => [p[0], p[2]])));
note('errors', Q.errors.length);
fs.writeFileSync(path.join(Q.OUT, 'profile.txt'), Q.log.join('\n'));
await Q.close();
