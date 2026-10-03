/**
 * The hour by ear: the creatures of a Japanese spring, each at its own time of day, made on the spot (no recordings).
 *
 *   golden hour to blue hour   higurashi, the evening cicada: kana-kana-kana, a falling run of chirps, near and far
 *   night                      suzumushi, the bell cricket: riiin, a trilled bell, a few of them; frogs in the paddies
 *   first light to morning     uguisu, the bush warbler: hoooo... ho-ke-kyo; sparrows; crows over the city at dawn
 *
 * Quiet, under everything, out in the stereo field; gone in a tunnel and in the rain, and nothing but crows over the
 * city. `update()` each frame with the hour; each voice is a handful of nodes scheduled a little ahead and let go.
 */

const R = Math.random;
const rr = (a, b) => a + (b - a) * R();
const bell = (h, a, b, c, d) => {
  // 0 before a, up to 1 from a to b, 1 to c, down to 0 by d (hours, round midnight allowed)
  const x = (h - a + 24) % 24, B = (b - a + 24) % 24, C = (c - a + 24) % 24, D = (d - a + 24) % 24;
  if (x <= B) return B > 0 ? x / B : 1;
  if (x <= C) return 1;
  if (x <= D) return 1 - (x - C) / Math.max(1e-3, D - C);
  return 0;
};

export class Ambience {
  /** ctx: the AudioContext; dest: where to send it (the sound effects' bus, or the master). */
  constructor(ctx, dest) {
    this.ctx = ctx;
    this.out = ctx.createGain(); this.out.gain.value = 0;
    // a touch of air between the creatures and the listener: the highest of their highs taken off
    this.air = ctx.createBiquadFilter(); this.air.type = 'lowpass'; this.air.frequency.value = 9000; this.air.Q.value = 0.3;
    this.air.connect(this.out); this.out.connect(dest);
    this.level = 0;
    this.t = { cicada: rr(1, 4), cricket: 0, frog: rr(1, 3), warbler: rr(2, 6), sparrow: rr(1, 3), crow: rr(3, 8) };
    this.crickets = null;
  }

  /** A voice out in the field: its own pan and a little distance (lower and duller further off). */
  _voice(pan, far) {
    const c = this.ctx;
    const g = c.createGain(); g.gain.value = 0;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 12000 - 7000 * far; lp.Q.value = 0.4;
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    g.connect(lp);
    if (p) { p.pan.value = pan; lp.connect(p); p.connect(this.air); } else lp.connect(this.air);
    return { g, lp, p, k: 1 - 0.75 * far };
  }

  _osc(type, f, t0, t1) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0);
    o.start(t0); o.stop(t1 + 0.05);
    return o;
  }

  /** Let a voice's nodes go when it has finished. */
  _free(o, v) { o.onended = () => { try { v.g.disconnect(); v.lp.disconnect(); if (v.p) v.p.disconnect(); } catch {} }; }

  /** Higurashi: twelve to twenty-four chirps, each a quick fall in pitch, the run slowing, falling and fading. */
  _cicada(t0) {
    const far = R(), v = this._voice(rr(-0.9, 0.9), far);
    const n = Math.floor(rr(12, 24)), f0 = rr(4300, 5200), gap0 = rr(0.11, 0.14);
    let t = t0;
    const o = this._osc('triangle', f0, t0, t0 + n * 0.24 + 0.4);
    const o2 = this._osc('sine', f0 * 1.5, t0, t0 + n * 0.24 + 0.4);
    const g2 = this.ctx.createGain(); g2.gain.value = 0.35; o2.connect(g2); g2.connect(v.g);
    o.connect(v.g);
    const peak = 0.05 * v.k;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), f = f0 * (1 - 0.16 * u), a = peak * (u < 0.15 ? 0.5 + u / 0.3 : 1 - 0.65 * Math.max(0, u - 0.35) / 0.65);
      o.frequency.setValueAtTime(f * 1.06, t); o.frequency.exponentialRampToValueAtTime(f * 0.94, t + 0.07);
      o2.frequency.setValueAtTime(f * 1.59, t); o2.frequency.exponentialRampToValueAtTime(f * 1.41, t + 0.07);
      v.g.gain.setValueAtTime(0, t); v.g.gain.linearRampToValueAtTime(a, t + 0.012); v.g.gain.exponentialRampToValueAtTime(Math.max(1e-4, a * 0.05), t + 0.085);
      t += gap0 * (1 + 0.6 * u);
    }
    v.g.gain.setValueAtTime(0, t + 0.1);
    this._free(o, v);
  }

  /** Suzumushi: a few crickets, each a bell-like tone trilled forty-odd times a second in short rings. */
  _cricketsOn() {
    if (this.crickets) return;
    const c = this.ctx;
    this.crickets = [];
    for (let i = 0; i < 3; i++) {
      const v = this._voice(rr(-0.8, 0.8), 0.3 + 0.6 * R());
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = rr(4300, 4900);
      const am = c.createGain(); am.gain.value = 0;
      const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = rr(38, 50);
      const lg = c.createGain(); lg.gain.value = 0.5; const off = c.createConstantSource ? c.createConstantSource() : null;
      lfo.connect(lg); lg.connect(am.gain);
      if (off) { off.offset.value = 0.5; off.connect(am.gain); off.start(); }
      o.connect(am); am.connect(v.g);
      o.start(); lfo.start();
      this.crickets.push({ v, o, lfo, off, next: rr(0, 2) });
    }
  }
  _cricketsOff() {
    if (!this.crickets) return;
    for (const k of this.crickets) { try { k.o.stop(); k.lfo.stop(); if (k.off) k.off.stop(); k.v.g.disconnect(); } catch {} }
    this.crickets = null;
  }

  /** A frog: two to four croaks, each a buzz through the throat's resonance. */
  _frog(t0) {
    const v = this._voice(rr(-1, 1), 0.5 + 0.5 * R());
    const n = Math.floor(rr(2, 5)), f = rr(150, 260);
    const o = this._osc('sawtooth', f, t0, t0 + n * 0.16 + 0.2);
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = rr(700, 1100); bp.Q.value = 4;
    o.connect(bp); bp.connect(v.g);
    let t = t0;
    for (let i = 0; i < n; i++) {
      const a = 0.05 * v.k * rr(0.7, 1);
      v.g.gain.setValueAtTime(0, t); v.g.gain.linearRampToValueAtTime(a, t + 0.015); v.g.gain.linearRampToValueAtTime(0, t + 0.07);
      o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 1.15, t + 0.07);
      t += rr(0.11, 0.16);
    }
    this._free(o, v);
  }

  /** Uguisu: a long rising whistle, a breath, then ho-ke-kyo. */
  _warbler(t0) {
    const v = this._voice(rr(-0.7, 0.7), 0.25 + 0.5 * R());
    const base = rr(1250, 1450), a = 0.06 * v.k;
    const o = this._osc('sine', base, t0, t0 + 2.6);
    o.connect(v.g);
    const F = o.frequency, G = v.g.gain;
    // hoooo
    F.setValueAtTime(base * 0.96, t0); F.linearRampToValueAtTime(base * 1.08, t0 + 1.1);
    G.setValueAtTime(0, t0); G.linearRampToValueAtTime(a * 0.7, t0 + 0.25); G.linearRampToValueAtTime(a, t0 + 1.0); G.linearRampToValueAtTime(0, t0 + 1.18);
    // ho
    let t = t0 + 1.32;
    F.setValueAtTime(base * 1.25, t); G.setValueAtTime(0, t); G.linearRampToValueAtTime(a * 0.9, t + 0.02); G.linearRampToValueAtTime(0, t + 0.13);
    // ke
    t += 0.17;
    F.setValueAtTime(base * 1.9, t); G.setValueAtTime(0, t); G.linearRampToValueAtTime(a * 0.8, t + 0.015); G.linearRampToValueAtTime(0, t + 0.08);
    // kyo: a quick rise and fall
    t += 0.12;
    F.setValueAtTime(base * 1.35, t); F.exponentialRampToValueAtTime(base * 2.45, t + 0.12); F.exponentialRampToValueAtTime(base * 1.7, t + 0.34);
    G.setValueAtTime(0, t); G.linearRampToValueAtTime(a, t + 0.03); G.setValueAtTime(a, t + 0.22); G.linearRampToValueAtTime(0, t + 0.36);
    this._free(o, v);
  }

  /** Sparrows: a few quick falling chirps. */
  _sparrow(t0) {
    const v = this._voice(rr(-1, 1), 0.3 + 0.6 * R());
    const n = Math.floor(rr(2, 6));
    const o = this._osc('sine', 4000, t0, t0 + n * 0.22 + 0.2);
    o.connect(v.g);
    let t = t0;
    for (let i = 0; i < n; i++) {
      const f = rr(3600, 5200), a = 0.03 * v.k;
      o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.62, t + 0.06);
      v.g.gain.setValueAtTime(0, t); v.g.gain.linearRampToValueAtTime(a, t + 0.008); v.g.gain.linearRampToValueAtTime(0, t + 0.065);
      t += rr(0.1, 0.24);
    }
    this._free(o, v);
  }

  /** Crows over the city at first light: two or three rough caws. */
  _crow(t0) {
    const v = this._voice(rr(-1, 1), 0.4 + 0.5 * R());
    const n = Math.floor(rr(2, 4));
    const o = this._osc('sawtooth', 380, t0, t0 + n * 0.55 + 0.3);
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1150; bp.Q.value = 2.2;
    o.connect(bp); bp.connect(v.g);
    let t = t0;
    for (let i = 0; i < n; i++) {
      const a = 0.05 * v.k;
      o.frequency.setValueAtTime(420, t); o.frequency.linearRampToValueAtTime(340, t + 0.32);
      v.g.gain.setValueAtTime(0, t); v.g.gain.linearRampToValueAtTime(a, t + 0.04); v.g.gain.linearRampToValueAtTime(a * 0.7, t + 0.24); v.g.gain.linearRampToValueAtTime(0, t + 0.34);
      t += rr(0.45, 0.6);
    }
    this._free(o, v);
  }

  /**
   * Each frame. s: { hour, city, rain 0..1, tunnel 0..1, on (false: fade out, nothing new), level (a volume, 0..1) }.
   */
  update(dt, s) {
    const c = this.ctx, now = c.currentTime;
    const want = s.on ? (1 - s.rain) * (1 - (s.tunnel || 0)) * (s.level ?? 1) : 0;
    if (Math.abs(want - this.level) > 0.01) { this.level = want; this.out.gain.setTargetAtTime(want, now, 0.6); }
    const h = s.hour, city = !!s.city, live = want > 0.02;
    // how much of each creature this hour holds
    const cicada = city ? 0 : bell(h, 16.6, 17.4, 18.6, 19.3);
    const cricket = city ? 0 : bell(h, 18.7, 19.6, 3.8, 4.9);
    const frog = city ? 0 : bell(h, 19.0, 20.0, 3.0, 4.6) * 0.8;
    const warbler = city ? 0 : bell(h, 4.9, 5.6, 7.4, 9.5);
    const sparrow = bell(h, 5.3, 6.2, 9.0, 11.0) * (city ? 0.5 : 1);
    const crow = city ? bell(h, 4.6, 5.3, 6.6, 8.0) : bell(h, 5.0, 5.6, 6.2, 7.0) * 0.4;
    // the crickets ring on their own while the night holds
    if (live && cricket > 0.05) {
      this._cricketsOn();
      for (const k of this.crickets) {
        k.next -= dt;
        if (k.next <= 0) {
          const t = now + 0.05, len = rr(0.25, 0.5), a = 0.022 * k.v.k * cricket;
          k.v.g.gain.setValueAtTime(0, t); k.v.g.gain.linearRampToValueAtTime(a, t + 0.04); k.v.g.gain.setValueAtTime(a, t + len - 0.06); k.v.g.gain.linearRampToValueAtTime(0, t + len);
          k.next = len + rr(0.9, 2.6);
        }
      }
    } else if (this.crickets && !live) this._cricketsOff();
    else if (this.crickets && cricket <= 0.05) this._cricketsOff();
    if (!live) return;
    const T = this.t, at = now + 0.05;
    const tick = (k, amt, lo, hi, fn) => {
      T[k] -= dt;
      if (T[k] > 0) return;
      // (a creature that this hour does not hold waits and asks again)
      if (R() < amt) fn(at);
      T[k] = rr(lo, hi) / Math.max(0.35, amt);
    };
    tick('cicada', cicada, 2.5, 7, (t) => this._cicada(t));
    tick('frog', frog, 0.6, 2.2, (t) => this._frog(t));
    tick('warbler', warbler, 7, 14, (t) => this._warbler(t));
    tick('sparrow', sparrow, 1.5, 5, (t) => this._sparrow(t));
    tick('crow', crow, 6, 14, (t) => this._crow(t));
  }

  dispose() { this._cricketsOff(); try { this.out.disconnect(); } catch {} }
}

