import fs from 'fs';
import readline from 'readline';
const file = process.argv[2], T = Number(process.argv[3] || 0);
const names = {}, marks = [], long = {};
const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
const ev = [];
for await (let line of rl) {
  line = line.trim(); if (!line.startsWith('{"')) continue; if (line.endsWith(',')) line = line.slice(0, -1);
  let e; try { e = JSON.parse(line); } catch { continue; }
  if (e.ph === 'M' && e.name === 'thread_name') names[e.pid + ':' + e.tid] = e.args.name;
  else if (typeof e.name === 'string' && e.name.startsWith('qa-slow')) marks.push(e);
  else if (e.ph === 'X' && e.dur > 20000) ev.push({ name: e.name, ts: e.ts, dur: e.dur, th: e.pid + ':' + e.tid });
}
const cnt = {}; for (const e of ev) { const n = names[e.th] || e.th; cnt[n] = (cnt[n] || 0) + 1; }
console.log('threads with events >20ms:', JSON.stringify(cnt));
for (const m of marks) {
  const real = Number(m.name.split(' ')[1]) * 1000, t1 = m.ts, t0 = t1 - real - 20000;
  console.log('\n' + m.name);
  for (const e of ev.filter((e) => e.ts < t1 && e.ts + e.dur > t0 && !/CrRendererMain/.test(names[e.th] || '')).sort((a, b) => b.dur - a.dur).slice(0, 8)) console.log('  ', (names[e.th] || e.th).padEnd(26), String(Math.round(e.dur / 1000)).padStart(5), 'ms', e.name);
}
