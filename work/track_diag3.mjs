// At the first squeeze of a seed: what existing road is in the way (feature type, how long ago, uc/vc).
import { Track } from '../game/src/track.js';
const [dk, sd] = [process.argv[2] || 'easy', Number(process.argv[3] || 7922)];
const t = new Track(sd, dk);
const of = t._feature.bind(t);
let done = false;
t._feature = () => {
  if (done) return of();
  const sq0 = t.squeezes;
  const st = { x: t._x, z: t._z, h: t._h, uc: t._uc(t._x, t._z), vc: t._vc(t._x, t._z), n: t.pts.length, legStart: t._legStart };
  of();
  if (t.squeezes > sq0) {
    done = true;
    const f = t.features[t.features.length - 1];
    console.log(`squeeze at f${t.features.length - 1} (${f.type}) s=${f.s0.toFixed(0)} uc=${st.uc.toFixed(0)} vc=${st.vc.toFixed(0)} heading-e=${(t._h).toFixed(2)} legStart=${st.legStart}`);
    // what is within 80 m of the start point, excluding the last 60 samples
    const near = new Map();
    for (let i = 0; i < st.n - 30; i++) {
      const p = t.pts[i]; const d = Math.hypot(p.x - st.x, p.z - st.z);
      if (d < 90) { const key = p.fi; const cur = near.get(key); if (!cur || d < cur.d) near.set(key, { d, i, uc: t._uc(p.x, p.z), vc: t._vc(p.x, p.z), type: t.features[p.fi]?.type }); }
    }
    for (const [fi, v] of [...near].sort((a, b) => a[1].d - b[1].d)) console.log(`  f${fi} ${v.type} d=${v.d.toFixed(0)} i=${v.i} uc=${v.uc.toFixed(0)} vc=${v.vc.toFixed(0)}`);
    // the last few features before the squeeze
    for (let k = Math.max(0, t.features.length - 8); k < t.features.length; k++) {
      const g = t.features[k]; const a = t.pts[g.i0], b = t.pts[g.i1];
      console.log(`  feat f${k} ${g.type} dir=${g.dir} R=${g.R.toFixed(0)} uc ${t._uc(a.x, a.z).toFixed(0)}->${t._uc(b.x, b.z).toFixed(0)} vc ${t._vc(a.x, a.z).toFixed(0)}->${t._vc(b.x, b.z).toFixed(0)}`);
    }
  }
};
t.ensure(30000);
