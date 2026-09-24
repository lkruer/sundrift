/**
 * Drift scoring: the state machine behind the score at the top of the screen.
 *
 * A drift starts when the body slip angle passes SCORE.minSlip at speed. While it lasts, points accrue at a
 * rate that scales with speed, angle and a multiplier that climbs the longer the slide is held. A direction
 * change mid-slide (a transition) keeps the drift alive and bumps the chain. When the car straightens for
 * SCORE.endGrace seconds the drift is BANKED: the points go into the total, boost is granted in proportion,
 * and the chain timer starts; a new drift inside SCORE.chainGrace continues the chain, which multiplies the
 * next drift's starting multiplier. A hard wall hit drops whatever is unbanked and breaks the chain.
 *
 * Every consequence is emitted as an event ({ type, value }) so the HUD and the audio can react without
 * this file knowing either exists.
 */
import { SCORE, clamp } from './config.js?v=202609242220';

export class Scoring {
  constructor() {
    this.total = 0;
    this.best = 0;
    this.best = 0;
    this.reset();
  }

  reset() {
    this.total = 0;
    this.active = false;
    this.points = 0; this.mult = 1; this.time = 0; this.dir = 0;
    this.chain = 0; this.chainTimer = 0;
    this.endTimer = 0;
    this.clipCooldown = 0;
    this.tier = 0;
    this.bigT = 0; this.bigDone = false;     // a big angle held (the HUD's callout; see update)
    this.events = [];
    this.stats = { drifts: 0, longest: 0, biggest: 0, clips: 0, crashes: 0, distance: 0 };
    this.boostGrant = 0;
  }

  emit(type, value = 0, extra = {}) { this.events.push({ type, value, ...extra }); }
  drain() { const e = this.events; this.events = []; return e; }

  /**
   * @param dt seconds
   * @param car the Car (beta, speed, surface)
   * @param impact lateral impact speed this frame (m/s), 0 if none
   * @param clipping true while a rear corner is within SCORE.clipDist of the rail
   */
  update(dt, car, impact, clipping) {
    const speed = car.speed;
    const slip = Math.abs(car.beta);
    const kmh = speed * 3.6;
    this.clipCooldown = Math.max(0, this.clipCooldown - dt);

    // ---- crash: a hard lateral hit drops the drift and the chain
    if (impact > SCORE.crashSpeed) {
      this.stats.crashes++;
      if (this.active && this.points > 40) {
        this.emit('crash', Math.round(this.points));
      } else {
        this.emit('bump', impact);
      }
      this.active = false; this.points = 0; this.mult = 1; this.time = 0; this.tier = 0;
      this.chain = 0; this.chainTimer = 0;
      return;
    }

    if (!this.active) {
      if (this.chainTimer > 0) {
        this.chainTimer -= dt;
        if (this.chainTimer <= 0) { this.chain = 0; this.emit('chainlost'); }
      }
      if (slip > SCORE.minSlip && speed > SCORE.minSpeed && car.surface > 0.3) {
        this.active = true;
        this.points = 0; this.time = 0; this.endTimer = 0; this.tier = 0; this.boostGiven = 0;
        this.dir = Math.sign(car.beta);
        this.chain = this.chainTimer > 0 ? this.chain + 1 : 1;
        this.mult = 1 + Math.min(4, (this.chain - 1) * 0.5);
        this.chainTimer = 0;
        this.stats.drifts++;
        this.bigT = 0; this.bigDone = false;
        this.emit('start', this.chain);
      }
      return;
    }

    // ---- active drift
    const sliding = slip > SCORE.endSlip && speed > SCORE.minSpeed * 0.8 && car.surface > 0.3;
    if (sliding) {
      this.endTimer = 0;
      this.time += dt;
      const angleFactor = clamp(slip / 0.55, 0.25, 1.5);
      const rate = SCORE.rate * kmh * angleFactor * this.mult;
      this.points += rate * dt;
      const climbed = 1 + Math.min(4, (this.chain - 1) * 0.5) + Math.floor(this.time / SCORE.multEvery) * SCORE.multStep;
      if (climbed > this.mult && climbed <= SCORE.multMax) { this.mult = climbed; this.emit('mult', this.mult); }
      // a transition: the slide changes side while still sliding
      const d = Math.sign(car.beta);
      if (d !== 0 && d !== this.dir && slip > SCORE.minSlip) {
        this.dir = d;
        this.chain++;
        this.points += 120 * this.mult;
        this.emit('switch', this.chain);
      }
      // clipping the rail without touching it
      if (clipping && this.clipCooldown <= 0) {
        this.clipCooldown = 1.4;
        this.points += SCORE.clipBonus * this.mult;
        this.stats.clips++;
        this.emit('clip', SCORE.clipBonus * this.mult);
      }
      const tier = this.tierOf(this.points);
      if (tier > this.tier) { this.tier = tier; this.emit('tier', tier); }
      // (for the HUD and the sound only, the points are untouched: a slide held past the angle that scores the most,
      // 0.825 rad where the angle factor above tops out, for most of a second is called out, once a drift)
      this.bigT = slip >= 0.825 ? (this.bigT || 0) + dt : Math.max(0, (this.bigT || 0) - dt * 2);
      if (this.bigT > 0.9 && !this.bigDone) { this.bigDone = true; this.emit('angle', slip); }
    } else {
      // the boost comes the moment the slide ends (the points still bank after the grace, in case it resumes)
      if (this.endTimer === 0) this.giveBoost();
      this.endTimer += dt;
      if (this.endTimer > SCORE.endGrace) this.bank();
    }
  }

  tierOf(p) {
    let t = 0;
    for (let i = 1; i < SCORE.tiers.length; i++) if (p >= SCORE.tiers[i]) t = i;
    return t;
  }

  bank() {
    const banked = Math.round(this.points);
    this.active = false;
    if (banked > 0) {
      this.total += banked;
      this.giveBoost();
      const boost = this.boostGiven;
      this.stats.longest = Math.max(this.stats.longest, this.time);
      this.stats.biggest = Math.max(this.stats.biggest, banked);
      this.emit('bank', banked, { tier: this.tier, boost, chain: this.chain, mult: this.mult });
      if (this.total > this.best) this.best = this.total;
    }
    this.chainTimer = SCORE.chainGrace;
    this.points = 0; this.mult = 1; this.time = 0; this.tier = 0; this.endTimer = 0; this.boostGiven = 0;
  }

  /** The boost the drift so far has earned, less what it has already been given. */
  giveBoost() {
    if (this.points <= 0) return;
    const due = clamp(this.points * SCORE.boostPerPoint, 0.35, SCORE.boostMax) - (this.boostGiven || 0);
    if (due < 0.05) return;
    this.boostGiven = (this.boostGiven || 0) + due;
    this.boostGrant += due;
    this.emit('boost', due);
  }

  /** Seconds of boost granted since the last call. */
  takeBoost() { const b = this.boostGrant; this.boostGrant = 0; return b; }
}
