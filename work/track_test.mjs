// Generate long stretches of road for every difficulty and several seeds, and report what matters:
// overlaps, squeezes, how far the road sits from the natural ground, grades, corners, set pieces, and speed.
// node work/track_test.mjs [km]
import { Track, DIFFS } from '../game/src/track.js';

const KM = Number(process.argv[2] || 8);
const seeds = [20260921, 7, 12345, 99, 424242];
for (const dk of Object.keys(DIFFS)) {
  const rows = [];
  for (const seed of seeds) {
    const t0 = performance.now();
    const t = new Track(seed, dk);
    t.ensure(KM * 1000);
    const ms = performance.now() - t0;
    const P = t.pts;
    // overlaps: two samples more than 120 m of road apart, closer than the corridor allows
    let minD = Infinity, overlaps = 0;
    const lim = 2 * t.wall + 2;
    const cell = new Map();
    const key = (x, z) => Math.floor(x / 30) * 100000 + Math.floor(z / 30);
    P.forEach((p, i) => { const k = key(p.x, p.z); (cell.get(k) || cell.set(k, []).get(k)).push(i); });
    for (let i = 0; i < P.length; i += 2) {
      const p = P[i];
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const c = cell.get((Math.floor(p.x / 30) + dx) * 100000 + Math.floor(p.z / 30) + dz); if (!c) continue;
        for (const j of c) { if (j <= i + 60) continue; const q = P[j]; const d = Math.hypot(p.x - q.x, p.z - q.z); if (d < minD) minD = d; if (d < lim) overlaps++; }
      }
    }
    // the road against the mountain
    let sumAbs = 0, maxCut = 0, maxFill = 0; const devs = [];
    let maxGrade = 0;
    for (let i = 0; i < P.length; i++) {
      const p = P[i]; const dev = t.field.base(p.x, p.z) - p.y; devs.push(Math.abs(dev)); sumAbs += Math.abs(dev);
      if (dev > maxCut) maxCut = dev; if (-dev > maxFill) maxFill = -dev;
      if (i) maxGrade = Math.max(maxGrade, Math.abs((p.y - P[i - 1].y) / (p.s - P[i - 1].s)));
    }
    devs.sort((a, b) => a - b);
    const kinds = {}; t.features.forEach((f) => { kinds[f.type] = (kinds[f.type] || 0) + 1; });
    const climb = P[P.length - 1].y - P[0].y;
    rows.push({ seed, ms: ms.toFixed(0), pts: P.length, squeezes: t.squeezes, overlaps, minD: minD.toFixed(1),
      devMean: (sumAbs / P.length).toFixed(1), dev95: devs[Math.floor(devs.length * 0.95)].toFixed(1), maxCut: maxCut.toFixed(1), maxFill: maxFill.toFixed(1),
      maxGrade: (maxGrade * 100).toFixed(1) + '%', climb: climb.toFixed(0), hairpins: kinds.hairpin || 0, sweep: kinds.sweeper || 0, ess: kinds.ess || 0,
      kink: kinds.kink || 0, str: kinds.straight || 0, sets: t.markers.map((m) => m.kind[0]).join(''), tunnels: t.tunnels.length });
  }
  console.log(`\n== ${dk.toUpperCase()}  (${KM} km, clearance ${(2 * DIFFS[dk].wall + 9).toFixed(1)} m, overlap limit ${(2 * DIFFS[dk].wall + 2).toFixed(1)} m)`);
  console.table(rows);
}
