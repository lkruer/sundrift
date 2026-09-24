// QA: which part of a ground sample grows with the course: the pads loop, the spur (tunnels) loop, or the rest?
import { Track } from '../game/src/track.js';
import { Ground } from '../game/src/ground.js';

const tile = (g, t, s, reps = 3) => {
  const p = t.sample(s);
  const lx = Math.cos(p.h), lz = -Math.sin(p.h);
  const cx = p.x + lx * 20, cz = p.z + lz * 20;
  let acc = 0;
  const t0 = performance.now();
  for (let rep = 0; rep < reps; rep++) for (let j = 0; j <= 66; j++) for (let i = 0; i <= 66; i++) acc += g.sample(cx - 48 + i * 1.5, cz - 48 + j * 1.5, 2.2).h;
  return (performance.now() - t0) / reps;
};
for (const map of ['mountain', 'city']) for (const dk of ['easy', 'hard']) {
  const t = new Track(20260921, dk, map);
  const g = new Ground(t);
  t.ensure(60000);
  for (let k = 0; k < 3; k++) tile(g, t, 30000, 1);
  const spots = [1000, 15000, 30000, 45000, 59000];
  const full = spots.map((s) => tile(g, t, s));
  const pads = t.pads; t.pads = [];
  const noPads = spots.map((s) => tile(g, t, s));
  t.pads = pads;
  const spur = g.spur; g.spur = () => -Infinity;
  const noSpur = spots.map((s) => tile(g, t, s));
  g.spur = spur;
  console.log(map, dk, 'tile ms at', spots.join('/'), '| full', full.map((x) => x.toFixed(1)).join('/'), '| no pads loop', noPads.map((x) => x.toFixed(1)).join('/'), '| no spur loop', noSpur.map((x) => x.toFixed(1)).join('/'));
}
