// Ground function: speed, and whether the road ever ends up under or over the ground.
import { Track } from '../game/src/track.js';
import { Ground } from '../game/src/ground.js';
for (const dk of ['easy', 'medium', 'hard']) {
  const t = new Track(20260921, dk); t.ensure(6000);
  const g = new Ground(t);
  // 1) the road surface vs the ground, across the corridor, every sample
  let worstAbove = 0, worstBelow = 0, n = 0;
  for (let i = 5; i < t.nFinal - 5; i++) {
    const p = t.pts[i]; const lx = Math.cos(p.h), lz = -Math.sin(p.h);
    for (const u of [-p.wr + 0.05, -t.half, 0, t.half, p.wl - 0.05]) {
      const x = p.x + lx * u, z = p.z + lz * u;
      const h = g.height(x, z); n++;
      if (p.tunnel) continue;
      const dy = h - p.y;
      if (dy > worstAbove) worstAbove = dy;
      if (dy < worstBelow) worstBelow = dy;
    }
  }
  // 2) speed on a 65x65 tile near the road
  const p0 = t.pts[800];
  const t0 = performance.now();
  let acc = 0;
  for (let j = 0; j <= 66; j++) for (let i = 0; i <= 66; i++) acc += g.sample(p0.x - 48 + i * 1.5, p0.z - 48 + j * 1.5, 2.2).h;
  const ms = performance.now() - t0;
  // 3) away from any road
  const t1 = performance.now();
  for (let j = 0; j <= 66; j++) for (let i = 0; i <= 66; i++) acc += g.sample(p0.x + 3000 + i * 1.5, p0.z + 3000 + j * 1.5, 2.2).h;
  const ms2 = performance.now() - t1;
  console.log(dk, 'ground above road surface max', worstAbove.toFixed(3), 'm, below min', worstBelow.toFixed(3), 'm over', n, 'probes | LOD0 tile (67x67) near road', ms.toFixed(1), 'ms, far', ms2.toFixed(1), 'ms', acc > 0 ? '' : '');
}
