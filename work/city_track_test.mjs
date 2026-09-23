// NEO TOKYO layouts: generate each city course for several seeds and report overlaps, squeezes and the feature
// mix; write the first seed's centrelines to work/city_plan.json for a plan picture.
// node work/city_track_test.mjs [km]
import fs from 'fs';
import { Track, CITY_DIFFS } from '../game/src/track.js';
const KM = Number(process.argv[2] || 12);
const seeds = [20260921, 7, 12345, 99, 424242];
const plan = {};
for (const dk of Object.keys(CITY_DIFFS)) {
  for (const seed of seeds) {
    const t0 = performance.now();
    const t = new Track(seed, dk, 'city');
    t.ensure(KM * 1000);
    const ms = performance.now() - t0;
    // overlaps: pairs of samples > 80 m apart along the road but closer than 2*wall + 2 in plan
    let overlaps = 0, minD = Infinity;
    const P = t.pts.slice(0, t.nFinal);
    const cell = new Map(), C = 24, key = (x, z) => `${Math.floor(x / C)},${Math.floor(z / C)}`;
    P.forEach((p, i) => { const k = key(p.x, p.z); (cell.get(k) || cell.set(k, []).get(k)).push(i); });
    for (let i = 0; i < P.length; i += 2) {
      const p = P[i]; const cx = Math.floor(p.x / C), cz = Math.floor(p.z / C);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const j of cell.get(`${cx + dx},${cz + dz}`) || []) {
        if (Math.abs(P[j].s - p.s) < 80) continue;
        const d = Math.hypot(P[j].x - p.x, P[j].z - p.z); if (d < minD) minD = d;
        if (d < 2 * t.wall + 2) overlaps++;
      }
    }
    const types = {}; for (const f of t.features) types[f.type] = (types[f.type] || 0) + 1;
    const sets = t.markers.map((m) => m.kind[0]).join('');
    console.log(dk.padEnd(6), String(seed).padEnd(9), `${ms.toFixed(0)} ms`, `squeezes ${t.squeezes}`, `overlaps ${overlaps}`, `minD ${minD.toFixed(1)}`, JSON.stringify(types), sets.slice(0, 30), 'tunnels', t.tunnels.length);
    if (seed === seeds[0]) plan[dk] = P.filter((_, i) => i % 3 === 0).map((p) => [Math.round(p.x), Math.round(p.z)]);
  }
}
fs.writeFileSync('work/city_plan.json', JSON.stringify(plan));
