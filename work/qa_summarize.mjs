// Summarize a long run: start vs end windows, growth of everything sampled, and the clock.
import fs from 'fs';
const name = process.argv[2];
const j = JSON.parse(fs.readFileSync(`work/qa_out/${name}/long.json`, 'utf8'));
const S = j.samples;
const win = (a, b) => S.filter((x) => x.el >= a && x.el < b);
const agg = (w) => {
  const fr = w.map((x) => x.f), n = fr.reduce((a, f) => a + f.n, 0);
  const avg = (k) => +(w.reduce((a, x) => a + (typeof k === 'function' ? k(x) : x.s[k]), 0) / Math.max(1, w.length)).toFixed(1);
  const med = (arr) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  return {
    frames: n, p50: med(fr.map((f) => f.real.p50)), p99med: med(fr.map((f) => f.real.p99)), worst: Math.max(...fr.map((f) => f.real.max)), over34: fr.reduce((a, f) => a + f.over34, 0),
    over34per1k: +(1000 * fr.reduce((a, f) => a + f.over34, 0) / Math.max(1, n)).toFixed(1),
    js50: med(fr.map((f) => f.js.p50)), js99: med(fr.map((f) => f.js.p99)), world99: med(fr.map((f) => f.world.p99)),
    heapMB: avg('heapMB'), geo: avg('geo'), tex: avg('tex'), progs: avg('progs'), calls: avg('calls'), trisM: +(avg('tris') / 1e6).toFixed(2), objs: avg('objs'), dom: avg('dom'),
    chunks: avg('chunks'), tiles: avg('tiles'), cols: avg('cols'), lamps: avg('lamps'), particles: avg('particles'), debris: avg('debris'),
    audPlaying: avg((x) => x.s.aud ? x.s.aud.playing : 0), audLive: avg((x) => x.s.aud ? x.s.aud.live : 0),
    pts: w.length ? w[w.length - 1].s.pts : 0, pads: w.length ? w[w.length - 1].s.pads : 0,
    tileAvgMs: w.length ? +(w[w.length - 1].s.tMs / Math.max(1, w[w.length - 1].s.tBuilt)).toFixed(1) : 0,
  };
};
const last = S[S.length - 1].el;
const A = agg(win(15, 135)), B = agg(win(last - 120, last + 1));
console.log(`${name}: ${Math.round(last / 60)} min, ready ${j.readyS} s`);
const keys = Object.keys(A);
for (const k of keys) console.log(k.padEnd(12), String(A[k]).padStart(9), ' -> ', String(B[k]).padStart(9));
// the clock: when it crossed what
const hrs = S.map((x) => [x.el, x.s.hour, x.s.night, x.s.rain]);
console.log('clock', hrs.filter((_, i) => i % 6 === 0).map((h) => `${h[0]}s:${h[1].toFixed(1)}h n${h[2]} r${h[3]}`).join('  '));
// tex growth per minute, and the env rebuild suspicion: tex vs rain/night changes
console.log('tex', S.filter((_, i) => i % 6 === 0).map((x) => `${x.el}:${x.s.tex}`).join(' '));
console.log('dist m', S[S.length - 1].s.dist, 'score', S[S.length - 1].s.score, 'drifts', S[S.length - 1].s.drifts, 'crashes', S[S.length - 1].s.crashes);
console.log('gc', JSON.stringify(j.gcs.map((g) => [g.label, g.heapMB, g.nodes, g.jsEventListeners])));
console.log('newProgs', JSON.stringify(j.newProgs.map((p) => [p[0], p[2], p[3].slice(-60)])));
console.log('errors', JSON.stringify(j.errors.slice(0, 10)));
