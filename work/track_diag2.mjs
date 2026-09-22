// Per-seed squeeze report at long range: where the generator runs out of room, and why.
import { Track, DIFFS } from '../game/src/track.js';
const KM = Number(process.argv[2] || 30);
const dks = (process.argv[3] || 'easy,medium').split(',');
for (const dk of dks) {
  for (let seed = 1; seed <= 12; seed++) {
    const sd = seed * 7919 + 3;
    const t = new Track(sd, dk);
    const log = [];
    const orig = t._clearance.bind(t);
    let fcl = [];
    t._clearance = (plan) => { const c = orig(plan); fcl.push(plan.type + (plan.dir > 0 ? 'L' : plan.dir < 0 ? 'R' : '') + ':' + c.toFixed(0)); return c; };
    const of = t._feature.bind(t);
    t._feature = () => {
      fcl = []; const sq0 = t.squeezes;
      const up = t.field.U;
      const lev = t._uc(t._x, t._z) - t._floorAt(t._x, t._z);
      const legLeft = t._legLeft;
      of();
      if (t.squeezes > sq0) {
        const f = t.features[t.features.length - 1];
        log.push(`  f${t.features.length - 1} s=${f.s0.toFixed(0)} lev=${lev.toFixed(0)} legLeft=${legLeft.toFixed(0)} uc=${t._uc(t._x, t._z).toFixed(0)} vc=${t._vc(t._x, t._z).toFixed(0)} took=${f.type} tried=[${fcl.join(' ')}]`);
      }
    };
    t.ensure(KM * 1000);
    if (log.length) { console.log(`${dk} seed ${sd}: ${t.squeezes} squeezes, legs ${t.features.filter(f => f.type === 'hairpin').length}`); console.log(log.slice(0, 6).join('\n')); }
  }
}
