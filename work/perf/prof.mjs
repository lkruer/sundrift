// Aggregate a CDP CPU profile: self time by function and by file, inclusive time by function.
//   node prof.mjs profile.json [--top=40] [--incl=frame,step,...]
import fs from 'fs';
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const p = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const TOP = Number(arg('top', 40));
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
// self time per node from the samples (timeDeltas[i+1] is the time spent in sample i)
const self = new Map();
let total = 0;
for (let i = 0; i < p.samples.length; i++) {
  const dt = (p.timeDeltas[i + 1] ?? p.timeDeltas[i] ?? 0) / 1000;
  self.set(p.samples[i], (self.get(p.samples[i]) || 0) + dt);
  total += dt;
}
const short = (u) => (u ? u.replace(/^.*\/(npm\/three@[^/]+\/)?/, '').replace(/\?v=\d+/, '') : '');
const key = (n) => { const c = n.callFrame; return `${c.functionName || '(anon)'} ${short(c.url)}:${c.lineNumber + 1}`; };
const fnSelf = new Map(), fileSelf = new Map();
for (const [id, t] of self) {
  const n = byId.get(id), k = key(n), f = short(n.callFrame.url) || n.callFrame.functionName;
  fnSelf.set(k, (fnSelf.get(k) || 0) + t);
  fileSelf.set(f, (fileSelf.get(f) || 0) + t);
}
// inclusive: for every sample walk up the stack once per distinct key
const incl = new Map();
for (let i = 0; i < p.samples.length; i++) {
  const dt = (p.timeDeltas[i + 1] ?? p.timeDeltas[i] ?? 0) / 1000;
  const seen = new Set();
  let id = p.samples[i];
  while (id !== undefined) { const k = key(byId.get(id)); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) || 0) + dt); } id = parent.get(id); }
}
const idle = [...fnSelf].filter(([k]) => /^\((idle|program)\)/.test(k)).reduce((a, [, t]) => a + t, 0);
const busy = total - idle;
console.log(`total ${total.toFixed(0)} ms, busy (not idle/program) ${busy.toFixed(0)} ms`);
const pr = (m, n, title) => {
  console.log('\n== ' + title);
  for (const [k, t] of [...m].sort((a, b) => b[1] - a[1]).slice(0, n)) console.log(`${t.toFixed(0).padStart(7)} ms ${(100 * t / busy).toFixed(1).padStart(5)}%  ${k}`);
};
pr(fileSelf, 25, 'self by file');
pr(fnSelf, TOP, 'self by function');
const want = arg('incl', '');
if (want) {
  console.log('\n== inclusive');
  const ws = want.split(',');
  for (const [k, t] of [...incl].sort((a, b) => b[1] - a[1])) if (ws.some((w) => k.startsWith(w + ' '))) console.log(`${t.toFixed(0).padStart(7)} ms ${(100 * t / busy).toFixed(1).padStart(5)}%  ${k}`);
} else pr(incl, TOP, 'inclusive by function');
