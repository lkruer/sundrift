// For each slow frame the page marked (performance.mark 'qa-slow ...'), what the renderer's main thread (and the GPU
// process) was doing in that frame's window: the longest events, and every garbage collection. Streams the trace (one
// event per line), keeping only thread names, the marks and events longer than 5 ms.
import fs from 'fs';
import readline from 'readline';
const file = process.argv[2];
const names = {}, marks = [], ev = [];
const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
for await (let line of rl) {
  line = line.trim(); if (!line.startsWith('{"')) continue; if (line.endsWith(',')) line = line.slice(0, -1); if (line.endsWith(']}')) line = line.slice(0, -2);
  let e; try { e = JSON.parse(line); } catch { continue; }
  if (e.ph === 'M' && e.name === 'thread_name') names[e.pid + ':' + e.tid] = e.args.name;
  else if (typeof e.name === 'string' && e.name.startsWith('qa-slow')) marks.push(e);
  else if (e.ph === 'X' && e.dur > 5000) ev.push({ name: e.name, ts: e.ts, dur: e.dur, th: e.pid + ':' + e.tid, fn: e.args && e.args.data && e.args.data.functionName });
}
const main = Object.entries(names).filter(([, n]) => n === 'CrRendererMain').map(([k]) => k);
const gpu = Object.entries(names).filter(([, n]) => n === 'CrGpuMain').map(([k]) => k);
const gcAll = ev.filter((e) => /GC|Scavenge|MarkCompact|Sweep|Mark/.test(e.name) && main.includes(e.th));
console.log('marks', marks.length, 'events kept', ev.length, 'GC-ish events >5 ms on the main thread:', gcAll.length);
const byName = {}; for (const g of gcAll) { (byName[g.name] = byName[g.name] || []).push(Math.round(g.dur / 1000)); }
for (const [k, v] of Object.entries(byName).sort((a, b) => Math.max(...b[1]) - Math.max(...a[1])).slice(0, 12)) console.log('  ', k, 'count', v.length, 'max', Math.max(...v), 'ms:', v.slice(0, 14).join(','));
for (const m of marks) {
  const real = Number(m.name.split(' ')[1]) * 1000;
  const t1 = m.ts, t0 = t1 - real - 20000;
  const inWin = ev.filter((e) => e.ts < t1 && e.ts + e.dur > t0 && e.dur > 15000);
  const mainEv = inWin.filter((e) => main.includes(e.th)).sort((a, b) => b.dur - a.dur).slice(0, 7);
  const gpuEv = inWin.filter((e) => gpu.includes(e.th)).sort((a, b) => b.dur - a.dur).slice(0, 4);
  console.log(`\n${m.name}`);
  for (const e of mainEv) console.log('   main', String(Math.round(e.dur / 1000)).padStart(5), 'ms', e.name, e.fn || '');
  for (const e of gpuEv) console.log('   gpu ', String(Math.round(e.dur / 1000)).padStart(5), 'ms', e.name);
}
