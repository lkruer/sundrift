// What the proposed scoring changes would do, measured in the sim (scoring.js itself is not touched: the proposals
// are a subclass here). The same scripted moves as qa_exploit_sim.mjs, scored by the shipped rules and by:
//   P1, the switch: a change of side counts (its 120 x mult, and a step of the chain) only when the side being left was
//       held at least SW_HOLD s and reached SW_PEAK rad, and at most once every SW_GAP s; otherwise the side just flips.
//   P2, the J-turn: 500 the first time, then only once the car has gone JT_GAP m since the last one that paid.
//   node work/qa_scoring_proposals.mjs
import { Car } from '../game/src/car.js';
import { Scoring } from '../game/src/scoring.js';
import { SCORE, clamp } from '../game/src/config.js';

const SW_HOLD = 0.6, SW_PEAK = 0.35, SW_GAP = 1.0, JT_GAP = 250;

/** The shipped Scoring with P1: the same update, but a side change is paid only for a real slide on the side left. */
class ScoringP1 extends Scoring {
  reset() { super.reset(); this.sideT = 0; this.sidePeak = 0; this.swGap = 0; }
  update(dt, car, impact, clipping) {
    const wasActive = this.active, dir0 = this.dir, chain0 = this.chain, pts0 = this.points;
    // the shipped rule runs; if it paid a switch the slide had not earned, the payment is taken back
    const nEv = this.events.length;
    super.update(dt, car, impact, clipping);
    this.swGap = Math.max(0, this.swGap - dt);
    if (!this.active) { this.sideT = 0; this.sidePeak = 0; return; }
    if (!wasActive) { this.sideT = 0; this.sidePeak = Math.abs(car.beta); return; }
    const sw = this.events.slice(nEv).find((e) => e.type === 'switch');
    if (sw) {
      const earned = this.sideT >= SW_HOLD && this.sidePeak >= SW_PEAK && this.swGap <= 0;
      if (!earned) {
        // undo: the chain step, the 120 x mult, the event (the side still flips)
        this.chain = chain0; this.points -= 120 * this.mult;
        this.events.splice(this.events.indexOf(sw), 1);
        // the multiplier may have climbed on the chain step this frame: put it back to what time alone gives
        const climbed = 1 + Math.min(4, (this.chain - 1) * 0.5) + Math.floor(this.time / SCORE.multEvery) * SCORE.multStep;
        this.mult = Math.min(Math.max(1, Math.min(this.mult, climbed)), SCORE.multMax);
      } else this.swGap = SW_GAP;
      this.sideT = 0; this.sidePeak = 0;
    } else { this.sideT += dt; this.sidePeak = Math.max(this.sidePeak, Math.abs(car.beta)); }
  }
}

/** P1b: a switch pays its 120 x mult but no longer steps the chain (the chain counts drifts, as banked and chained). */
class ScoringP1b extends Scoring {
  update(dt, car, impact, clipping) {
    const chain0 = this.chain, wasActive = this.active, nEv = this.events.length;
    super.update(dt, car, impact, clipping);
    if (wasActive && this.active && this.events.slice(nEv).some((e) => e.type === 'switch')) this.chain = chain0;
  }
}
/** P1c: as P1b, and the switch's bonus is a flat 120 (not multiplied). */
class ScoringP1c extends Scoring {
  update(dt, car, impact, clipping) {
    const chain0 = this.chain, wasActive = this.active, nEv = this.events.length, mult0 = this.mult;
    super.update(dt, car, impact, clipping);
    if (wasActive && this.active && this.events.slice(nEv).some((e) => e.type === 'switch')) { this.chain = chain0; this.points -= 120 * this.mult - 120; }
  }
}

function run(Sc, seconds, keys, { v0 = 0, jtGap = 0 } = {}) {
  const car = new Car(); car.reset(0, 0, 0); car.vF = v0;
  const sc = new Sc();
  const dt = 1 / 60; let kSteer = 0, t = 0, jturns = 0, paidJ = 0, lastJ = -1e9, dist = 0, px = 0, pz = 0;
  const st = { phase: 0, t0: 0 }, ev = {};
  for (let i = 0; i < seconds * 60; i++) {
    const k = keys(t, car, st);
    const sk = (k.A ? 1 : 0) - (k.D ? 1 : 0);
    const rate = sk !== 0 ? 7.2 : 12;
    kSteer += Math.max(-rate * dt, Math.min(rate * dt, sk - kSteer));
    if (Math.abs(kSteer) < 0.01 && sk === 0) kSteer = 0;
    car.step(dt, { throttle: typeof k.W === 'number' ? k.W : k.W ? 1 : 0, brake: k.S ? 1 : 0, steer: kSteer, hand: k.SP ? 1 : 0, reverse: !!k.S, touch: false, line: { curv: 0, here: 0 } }, 1);
    sc.update(dt, car, 0, false);
    dist += Math.hypot(car.x - px, car.z - pz); px = car.x; pz = car.z;
    if (car.jturnDone) {
      car.jturnDone = false; jturns++;
      if (!jtGap || dist - lastJ >= jtGap) { sc.total += 500; paidJ++; lastJ = dist; }
    }
    for (const e of sc.drain()) ev[e.type] = (ev[e.type] || 0) + 1;
    t += dt;
  }
  if (sc.active) sc.bank();
  return { ppm: sc.total / (seconds / 60), switches: ev.switch || 0, jturns, paidJ, biggest: sc.stats.biggest };
}

const f0 = (x) => Math.round(x).toLocaleString('en-US').padStart(9);
const moves = [
  ['wiggle every 0.7 s on a straight (gas held)', 60, (t) => { const P = 0.7, q = t < 0.3 ? -1 : Math.floor((t - 0.3 + P / 2) / P); return { W: t < 0.3 ? 0.3 : 1, SP: t < 0.3, A: q < 0 || q % 2 === 0, D: q >= 0 && q % 2 === 1 }; }, { v0: 22 }],
  ['wiggle every 1.0 s, held near 100 km/h', 60, (t, car) => { const P = 1.0, q = t < 0.3 ? -1 : Math.floor((t - 0.3 + P / 2) / P); return { W: t < 0.3 ? 0.3 : car.speed < 28 ? 1 : 0.5, SP: t < 0.3, A: q < 0 || q % 2 === 0, D: q >= 0 && q % 2 === 1 }; }, { v0: 22 }],
  ['S-bends: a held drift each way, 1.6 s a side', 60, (t) => { const q = t < 0.3 ? 0 : Math.floor((t - 0.3) / 1.6); return { W: t < 0.3 ? 0.3 : 1, SP: t < 0.3, A: q % 2 === 0, D: q % 2 === 1 }; }, { v0: 22 }],
  ['S-bends: 2.5 s a side', 60, (t) => { const q = t < 0.3 ? 0 : Math.floor((t - 0.3) / 2.5); return { W: t < 0.3 ? 0.3 : 1, SP: t < 0.3, A: q % 2 === 0, D: q % 2 === 1 }; }, { v0: 22 }],
  ['a 5 s drift, 3 s straight, repeated', 60, (t) => { const p = t % 8; return { W: p < 0.3 ? 0.3 : 1, SP: p < 0.3, A: p < 5 }; }, { v0: 22 }],
  ['J-turns in place (from 8 m/s back)', 60, (t, car, st) => {
    const T = t - st.t0;
    if (st.phase === 0) { if (car.vF < -8) { st.phase = 1; st.t0 = t; } return { S: true }; }
    if (st.phase === 1) { if (T > 1.0 && !car.jt) { st.phase = 2; st.t0 = t; } return { W: true, A: st.left !== false, D: st.left === false }; }
    if (st.phase === 2) { if (car.speed < 0.3 || car.vF < 0) { st.phase = 0; st.t0 = t; st.left = !(st.left !== false); } return { S: true }; }
    return {};
  }, { v0: 0 }],
];
console.log('move'.padEnd(48) + '    shipped (switches)    P1 earned sw.    P1b no chain step    P1c flat bonus');
for (const [label, secs, keys, opt] of moves) {
  const a = run(Scoring, secs, keys, opt), b = run(ScoringP1, secs, keys, { ...opt, jtGap: JT_GAP });
  const c = run(ScoringP1b, secs, keys, { ...opt, jtGap: JT_GAP }), d = run(ScoringP1c, secs, keys, { ...opt, jtGap: JT_GAP });
  const cell = (r) => `${f0(r.ppm)} (${String(r.switches).padStart(2)})${r.jturns ? ' J' + r.paidJ + '/' + r.jturns : ''}`;
  console.log(`${label.padEnd(48)} ${cell(a)}  ${cell(b)}  ${cell(c)}    ${cell(d)}`);
}
console.log(`\n(P1: a side counts after ${SW_HOLD} s at ${Math.round(SW_PEAK * 57.3)} deg or more, one switch a ${SW_GAP} s at most. P1b: a switch no longer steps the chain. P1c: P1b and a flat 120 a switch. P2 (all three): a J-turn pays again after ${JT_GAP} m)`);
