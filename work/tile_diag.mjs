import { Track } from '../game/src/track.js';
import { Ground } from '../game/src/ground.js';
const TILE = 96;
const dk = process.argv[2] || 'medium';
const t = new Track(20260921, dk); t.ensure(5000);
const g = new Ground(t);
const seg = 64, sp = TILE / seg, n = seg + 3, verge = 2.2;
const tiles = new Map();
const grid = (ti, tj) => { const key = ti * 100000 + tj; let H = tiles.get(key); if (H) return H;
  H = new Float32Array(n * n); const s = {};
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) H[j * n + i] = g.sample(ti * TILE - sp + i * sp, tj * TILE - sp + j * sp, verge, s).h;
  tiles.set(key, H); return H; };
let shown = 0;
for (let i = 10; i < 1500 && shown < 12; i++) {
  const p = t.pts[i], q = t.pts[i + 1]; if (p.tunnel || q.tunnel) continue;
  for (const f of [0.25, 0.75]) {
    const x0 = p.x + (q.x - p.x) * f, z0 = p.z + (q.z - p.z) * f, y0 = p.y + (q.y - p.y) * f;
    const hh = p.h + (q.h - p.h) * f; const lx = Math.cos(hh), lz = -Math.sin(hh);
    for (let u = -p.wr + 0.1; u <= p.wl - 0.1; u += 0.7) {
      const x = x0 + lx * u, z = z0 + lz * u;
      const ti = Math.floor(x / TILE), tj = Math.floor(z / TILE); const H = grid(ti, tj);
      const gx = (x - ti * TILE) / sp + 1, gz = (z - tj * TILE) / sp + 1;
      const ii = Math.floor(gx), jj = Math.floor(gz);
      const fx = gx - ii, fz = gz - jj;
      const a = H[jj * n + ii], b = H[jj * n + ii + 1], c = H[(jj + 1) * n + ii], d = H[(jj + 1) * n + ii + 1];
      const hs = fx + fz <= 1 ? a + (b - a) * fx + (c - a) * fz : d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
      const ribbon = y0 + (Math.abs(u) > t.half ? -0.02 : 0);
      if (hs - ribbon > 0.03) {
        shown++;
        const s = {}; g.sample(x, z, verge, s);
        console.log(`i=${i} f=${f} u=${u.toFixed(1)} feat=${t.features[p.fi]?.type} k=${p.k.toFixed(3)} wl=${p.wl.toFixed(1)} wr=${p.wr.toFixed(1)} over=${(hs - ribbon).toFixed(3)} | direct sample h-ribbon=${(s.h - ribbon).toFixed(3)} flat=${s.flat} edge=${s.edge.toFixed(2)} | corners rel: ${[a, b, c, d].map((v) => (v - ribbon).toFixed(2)).join(' ')}`);
        break;
      }
    }
  }
}
