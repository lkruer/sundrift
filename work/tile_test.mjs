// Does any terrain triangle poke up through the road ribbon? Build tile grids exactly as terrain.js does and
// probe points across the road inside them.
import { Track } from '../game/src/track.js';
import { Ground } from '../game/src/ground.js';
const TILE = 96;
function surf(H, n, sp, lx, lz) {
  const gx = lx / sp + 1, gz = lz / sp + 1;
  const i = Math.min(n - 2, Math.max(0, Math.floor(gx))), j = Math.min(n - 2, Math.max(0, Math.floor(gz)));
  const fx = gx - i, fz = gz - j;
  const a = H[j * n + i], b = H[j * n + i + 1], c = H[(j + 1) * n + i], d = H[(j + 1) * n + i + 1];
  return fx + fz <= 1 ? a + (b - a) * fx + (c - a) * fz : d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
}
for (const dk of ['easy', 'medium', 'hard']) {
  const t = new Track(20260921, dk); t.ensure(5000);
  const g = new Ground(t);
  for (const seg of [64, 32, 16]) {
    const sp = TILE / seg, n = seg + 3, verge = Math.max(2.2, sp * 1.45);
    const tiles = new Map();
    const grid = (ti, tj) => {
      const key = ti * 100000 + tj; let H = tiles.get(key); if (H) return H;
      H = new Float32Array(n * n); const s = {};
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) H[j * n + i] = g.sample(ti * TILE - sp + i * sp, tj * TILE - sp + j * sp, verge, s).h;
      tiles.set(key, H); return H;
    };
    let worst = -9, bad = 0, probes = 0;
    for (let i = 10; i < 1500; i += 1) {
      const p = t.pts[i], q = t.pts[i + 1]; if (p.tunnel || q.tunnel) continue;
      for (const f of [0.25, 0.75]) {
        const x0 = p.x + (q.x - p.x) * f, z0 = p.z + (q.z - p.z) * f, y0 = p.y + (q.y - p.y) * f, h = p.h;
        const lx = Math.cos(h), lz = -Math.sin(h);
        const wl = p.wl, wr = p.wr;
        for (let u = -wr + 0.1; u <= wl - 0.1; u += 0.7) {
          const x = x0 + lx * u, z = z0 + lz * u;
          const ti = Math.floor(x / TILE), tj = Math.floor(z / TILE);
          const H = grid(ti, tj);
          const hs = surf(H, n, sp, x - ti * TILE, z - tj * TILE);
          const ribbon = y0 + (Math.abs(u) > t.half ? -0.02 : 0);
          const dy = hs - ribbon; probes++;
          if (dy > worst) worst = dy;
          if (dy > 0.0) bad++;
        }
      }
    }
    console.log(dk.padEnd(6), `seg ${seg} (${sp} m):`, 'terrain above ribbon: worst', worst.toFixed(3), 'm, points above', bad, 'of', probes, ' tiles', tiles.size);
  }
}
