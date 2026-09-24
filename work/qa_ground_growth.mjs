// QA: does the cost of a ground sample (and of the track's linear lookups) grow with the distance driven?
import { Track } from '../game/src/track.js';
import { Ground } from '../game/src/ground.js';

const tile = (g, t, s) => {
  const p = t.sample(s);
  // a 67x67 tile centred a little off the road (as a terrain tile beside the road would be)
  const lx = Math.cos(p.h), lz = -Math.sin(p.h);
  const cx = p.x + lx * 20, cz = p.z + lz * 20;
  let acc = 0;
  const t0 = performance.now();
  for (let rep = 0; rep < 3; rep++) for (let j = 0; j <= 66; j++) for (let i = 0; i <= 66; i++) acc += g.sample(cx - 48 + i * 1.5, cz - 48 + j * 1.5, 2.2).h;
  return [(performance.now() - t0) / 3, acc];
};
const lookups = (t, s) => {
  const t0 = performance.now();
  let n = 0;
  for (let k = 0; k < 2000; k++) { if (t.markerAt(s + k * 0.1, 1)) n++; if (t.padAt(s + k * 0.1, -1)) n++; if (t.nearTunnel(s + k * 0.1, 8)) n++; }
  return (performance.now() - t0) / 2000 * 1000; // us per triple
};
for (const map of ['mountain', 'city']) for (const dk of ['easy', 'hard']) {
  const t = new Track(20260921, dk, map);
  const g = new Ground(t);
  t.ensure(3000);
  tile(g, t, 1000); tile(g, t, 1000);            // warm the JIT
  const [a] = tile(g, t, 1000), [a2] = tile(g, t, 2000);
  const la = lookups(t, 1500);
  const c0 = { pads: t.pads.length, markers: t.markers.length, tunnels: t.tunnels.length, pts: t.pts.length };
  const tg = performance.now();
  t.ensure(60000);
  const genMs = performance.now() - tg;
  const [b] = tile(g, t, 1000), [b2] = tile(g, t, 59000), [b3] = tile(g, t, 30000);
  const lb = lookups(t, 58000);
  const c1 = { pads: t.pads.length, markers: t.markers.length, tunnels: t.tunnels.length, pts: t.pts.length, cells: t._cells.size };
  console.log(map, dk, `| 3 km: tile@1km ${a.toFixed(1)} ms, tile@2km ${a2.toFixed(1)} ms, lookups ${la.toFixed(2)} us`, JSON.stringify(c0),
    `\n            | 60 km (gen ${genMs.toFixed(0)} ms): tile@1km ${b.toFixed(1)} ms, tile@30km ${b3.toFixed(1)} ms, tile@59km ${b2.toFixed(1)} ms, lookups ${lb.toFixed(2)} us`, JSON.stringify(c1));
}
