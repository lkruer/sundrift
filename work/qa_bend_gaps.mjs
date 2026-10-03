// How far apart the bends are on each course (the game's own track generator, the shipped seed): a chain survives only
// if the next slide starts within the bank's 0.8 s and the chain's 2.6 s grace, 3.4 s, about 94 m at 100 km/h and 66 m
// at 70. For every course: the bends tighter than 110 m (the ones a drift is for), the straight-ish gaps between them,
// and how many of those gaps a chain can cross at 70 and at 100 km/h without a slide in between.
//   node work/qa_bend_gaps.mjs
import { Track } from '../game/src/track.js';
import { SCORE } from '../game/src/config.js';

const SEED = 20260921, LEN = 12000, R_BEND = 110;
const reach = (kmh) => (SCORE.endGrace + SCORE.chainGrace) * kmh / 3.6;
console.log(`chain reach: ${(SCORE.endGrace + SCORE.chainGrace).toFixed(1)} s, ${reach(70).toFixed(0)} m at 70 km/h, ${reach(100).toFixed(0)} m at 100 km/h`);
for (const map of ['mountain', 'city']) for (const diff of ['easy', 'hard']) {
  const t = new Track(SEED, diff, map);
  t.ensure(LEN + 200);
  // bends: runs of samples tighter than R_BEND
  const bends = [];
  let cur = null;
  for (let s = 0; s < LEN; s += 2) {
    const k = Math.abs(t.sample(s).k);
    if (k > 1 / R_BEND) { if (!cur) cur = { s0: s, s1: s }; else cur.s1 = s; }
    else if (cur) { bends.push(cur); cur = null; }
  }
  const gaps = [];
  for (let i = 1; i < bends.length; i++) gaps.push(bends[i].s0 - bends[i - 1].s1);
  gaps.sort((a, b) => a - b);
  const med = gaps[Math.floor(gaps.length / 2)];
  const within = (m) => gaps.filter((g) => g <= m).length / gaps.length;
  const perKm = bends.length / (LEN / 1000);
  console.log(`${(map === 'city' ? 'NEO TOKYO ' : 'pass ') + diff.toUpperCase()}`.padEnd(16) + `${perKm.toFixed(1)} bends/km, gaps median ${med.toFixed(0)} m (p25 ${gaps[Math.floor(gaps.length * 0.25)].toFixed(0)}, p75 ${gaps[Math.floor(gaps.length * 0.75)].toFixed(0)}); a chain crosses ${(within(reach(70)) * 100).toFixed(0)}% of gaps at 70 km/h, ${(within(reach(100)) * 100).toFixed(0)}% at 100`);
}
