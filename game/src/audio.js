/**
 * Sound, all of it synthesised in Web Audio at runtime. No audio files: the engine, the turbo, the tyres,
 * the wind, the chimes and the music are oscillators and filtered noise, which keeps the game inside the
 * jam's weight budget and lets every sound follow the car exactly (the engine note is the rpm, the screech
 * is the slip, the music opens up when a drift is held).
 *
 * The engine is four detuned voices at the four-cylinder firing frequency (rpm / 30 Hz) through a low-pass
 * whose cutoff follows the throttle, with a noise rasp on top and a turbo whistle that climbs with load and
 * blows off when the throttle lifts. Tyres are band-passed noise whose centre wanders with slip. The music
 * is a scheduled 128 bpm loop in A minor pentatonic: kick, hat, snare, a filtered saw bass, a chord pad and
 * a delayed arpeggio that only joins while a drift is held.
 */
import { clamp } from './config.js?v=202609220418';

const NOTES = { A2: 110, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196, A3: 220, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880 };
// four bars: Am, F, C, G, as bass roots and pad triads
const PROG = [
  { root: NOTES.A2, pad: [NOTES.A3, NOTES.C4, NOTES.E4], arp: [NOTES.A4, NOTES.C5, NOTES.E5, NOTES.A5] },
  { root: NOTES.F3 / 2, pad: [NOTES.F3, NOTES.A3, NOTES.C4], arp: [NOTES.A4, NOTES.C5, NOTES.F3 * 4, NOTES.A5] },
  { root: NOTES.C3, pad: [NOTES.G3, NOTES.C4, NOTES.E4], arp: [NOTES.G4, NOTES.C5, NOTES.E5, NOTES.G5] },
  { root: NOTES.G3 / 2, pad: [NOTES.G3, NOTES.D4, NOTES.G4 / 2 * 2], arp: [NOTES.G4, NOTES.D5, NOTES.G5, NOTES.D5] },
];

export class Audio {
  constructor() {
    this.ctx = null; this.ready = false;
    this.muted = false;
    try { this.muted = localStorage.getItem('sundrift.mute') === '1'; } catch {}
    this.rpm = 900; this.throttle = 0; this.lastThrottle = 0; this.lastRpm = 900;
    this.music = { on: true, next: 0, step: 0, tempo: 128, intensity: 0 };
  }

  /** Create everything on the first real gesture; browsers refuse audio before one. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC({ latencyHint: 'interactive' });
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.9;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.knee.value = 18; this.comp.ratio.value = 4; this.comp.attack.value = 0.004; this.comp.release.value = 0.18;
    this.master.connect(this.comp); this.comp.connect(ctx.destination);
    this.noiseBuf = this._noise(2.0);
    this._engine(); this._tyres(); this._wind(); this._musicBus();
    this.ready = true;
  }

  _noise(seconds) {
    const n = Math.floor(this.ctx.sampleRate * seconds);
    const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    let s = 1;
    for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 4294967296) * 2 - 1; }
    return b;
  }
  _noiseSource() { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; s.start(); return s; }
  _gain(v = 0) { const g = this.ctx.createGain(); g.gain.value = v; return g; }
  _osc(type, f) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; }

  _engine() {
    const c = this.ctx;
    this.engGain = this._gain(0);
    this.engFilter = c.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 600; this.engFilter.Q.value = 1.2;
    this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
    this.voices = [];
    const mk = (type, mul, gain, detune) => {
      const o = this._osc(type, 30 * mul); o.detune.value = detune;
      const g = this._gain(gain); o.connect(g); g.connect(this.engFilter);
      this.voices.push({ o, mul });
    };
    mk('sawtooth', 1, 0.22, 0); mk('sawtooth', 1, 0.18, 9); mk('square', 0.5, 0.16, -4); mk('sine', 0.5, 0.35, 0); mk('sawtooth', 2, 0.06, 5);
    // exhaust rasp
    this.rasp = this._noiseSource();
    const rf = c.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 900; rf.Q.value = 1.4;
    this.raspGain = this._gain(0); this.rasp.connect(rf); rf.connect(this.raspGain); this.raspGain.connect(this.master);
    // turbo whistle
    this.turbo = this._osc('sine', 1400); this.turboGain = this._gain(0);
    const tf = c.createBiquadFilter(); tf.type = 'highpass'; tf.frequency.value = 900;
    this.turbo.connect(tf); tf.connect(this.turboGain); this.turboGain.connect(this.master);
  }

  _tyres() {
    const c = this.ctx;
    this.screech = this._noiseSource();
    this.screechF = c.createBiquadFilter(); this.screechF.type = 'bandpass'; this.screechF.frequency.value = 1500; this.screechF.Q.value = 6;
    const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 2600; f2.Q.value = 5;
    this.screechGain = this._gain(0);
    this.screech.connect(this.screechF); this.screechF.connect(this.screechGain);
    this.screech.connect(f2); f2.connect(this.screechGain);
    this.screechGain.connect(this.master);
    // gravel: low rumble when off the asphalt
    this.gravel = this._noiseSource();
    const gf = c.createBiquadFilter(); gf.type = 'lowpass'; gf.frequency.value = 380;
    this.gravelGain = this._gain(0); this.gravel.connect(gf); gf.connect(this.gravelGain); this.gravelGain.connect(this.master);
  }

  _wind() {
    const c = this.ctx;
    this.wind = this._noiseSource();
    const wf = c.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 500; wf.Q.value = 0.5;
    this.windGain = this._gain(0); this.wind.connect(wf); wf.connect(this.windGain); this.windGain.connect(this.master);
  }

  _musicBus() {
    const c = this.ctx;
    this.musicGain = this._gain(0.55); this.musicGain.connect(this.master);
    this.padFilter = c.createBiquadFilter(); this.padFilter.type = 'lowpass'; this.padFilter.frequency.value = 900; this.padFilter.Q.value = 0.8;
    this.padFilter.connect(this.musicGain);
    this.bassFilter = c.createBiquadFilter(); this.bassFilter.type = 'lowpass'; this.bassFilter.frequency.value = 700; this.bassFilter.Q.value = 2;
    this.bassFilter.connect(this.musicGain);
    this.arpGain = this._gain(0);
    this.delay = c.createDelay(1.0); this.delay.delayTime.value = (60 / this.music.tempo) * 0.75;
    this.delayFb = this._gain(0.38); this.delay.connect(this.delayFb); this.delayFb.connect(this.delay);
    const df = c.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 2400;
    this.arpGain.connect(this.musicGain); this.arpGain.connect(this.delay); this.delay.connect(df); df.connect(this.musicGain);
    this.drumGain = this._gain(0.9); this.drumGain.connect(this.musicGain);
    this.music.next = c.currentTime + 0.1;
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('sundrift.mute', m ? '1' : '0'); } catch {}
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  /** Per frame. */
  update(dt, car, rpm, drifting, boost01, surface) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const thr = car.throttle;
    // engine
    const f = rpm / 30;
    for (const v of this.voices) v.o.frequency.setTargetAtTime(f * v.mul, t, 0.03);
    const load = 0.35 + 0.65 * thr + boost01 * 0.4;
    this.engFilter.frequency.setTargetAtTime(380 + 2600 * load * (0.4 + 0.6 * rpm / 8000), t, 0.05);
    this.engGain.gain.setTargetAtTime(0.30 + 0.22 * load, t, 0.05);
    this.raspGain.gain.setTargetAtTime(0.02 + 0.10 * thr * (rpm / 8000), t, 0.05);
    // turbo: spools with rpm and throttle, whistles at high pitch
    const spool = clamp((rpm - 2500) / 5000, 0, 1) * (0.3 + 0.7 * thr);
    this.turbo.frequency.setTargetAtTime(1500 + spool * 3200, t, 0.12);
    this.turboGain.gain.setTargetAtTime(0.012 * spool + boost01 * 0.02, t, 0.1);
    // blow-off on a lift at load
    if (this.lastThrottle > 0.6 && thr < 0.2 && rpm > 3500) this.bov(spool);
    this.lastThrottle = thr; this.rpm = rpm;
    // tyres
    const slip = Math.max(car.slipRear, car.slipFront * 0.7) * clamp((car.speed - 3) / 8, 0, 1) * surface;
    this.screechGain.gain.setTargetAtTime(slip * 0.26, t, 0.04);
    this.screechF.frequency.setTargetAtTime(1200 + 700 * Math.abs(car.beta) + 300 * Math.sin(t * 9), t, 0.06);
    this.gravelGain.gain.setTargetAtTime((1 - surface) * clamp(car.speed / 12, 0, 1) * 0.5, t, 0.05);
    // wind
    this.windGain.gain.setTargetAtTime(clamp(car.speed / 60, 0, 1) ** 2 * 0.35 + boost01 * 0.15, t, 0.1);
    // music
    this.music.intensity += ((drifting ? 1 : 0) + boost01 * 0.5 - this.music.intensity) * Math.min(1, dt * 2);
    this.padFilter.frequency.setTargetAtTime(700 + 2200 * this.music.intensity, t, 0.2);
    this.arpGain.gain.setTargetAtTime(0.18 * clamp(this.music.intensity, 0, 1), t, 0.2);
    this._schedule();
  }

  /** Lookahead scheduler: keep notes queued 0.25 s ahead of the audio clock. */
  _schedule() {
    const c = this.ctx, m = this.music;
    const spb = 60 / m.tempo, s16 = spb / 4;
    while (m.next < c.currentTime + 0.25) {
      const step = m.step;
      const bar = Math.floor(step / 16) % 4, beat = step % 16;
      const ch = PROG[bar];
      const t = m.next;
      if (beat % 4 === 0) this._kick(t);
      if (beat % 4 === 2 && beat !== 14) this._hat(t, 0.5); else if (beat % 2 === 1) this._hat(t, 0.22);
      if (beat === 4 || beat === 12) this._snare(t);
      if (beat % 2 === 0) this._bass(t, ch.root * (beat === 14 ? 1.5 : 1), s16 * 1.7);
      if (beat === 0) this._pad(t, ch.pad, spb * 4);
      // arpeggio, sixteenths, only audible while drifting through arpGain
      this._arp(t, ch.arp[(beat + (bar % 2)) % 4] * (beat % 8 >= 4 ? 1 : 0.5), s16 * 0.9);
      m.next += s16; m.step++;
    }
  }

  _env(node, t, a, d, peak, sus = 0, r = 0.05, hold = 0) {
    const g = node.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(peak, t + a);
    g.exponentialRampToValueAtTime(Math.max(0.0001, sus * peak || 0.0001), t + a + d);
    if (hold) g.setValueAtTime(Math.max(0.0001, sus * peak || 0.0001), t + a + d + hold);
    g.exponentialRampToValueAtTime(0.0001, t + a + d + hold + r);
  }
  _kick(t) {
    const o = this.ctx.createOscillator(), g = this._gain(0);
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    o.connect(g); g.connect(this.drumGain); this._env(g, t, 0.002, 0.2, 0.9, 0, 0.05);
    o.start(t); o.stop(t + 0.32);
  }
  _hat(t, v) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
    const g = this._gain(0); s.connect(f); f.connect(g); g.connect(this.drumGain);
    this._env(g, t, 0.001, 0.035, 0.22 * v, 0, 0.02); s.start(t); s.stop(t + 0.08);
  }
  _snare(t) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.9;
    const g = this._gain(0); s.connect(f); f.connect(g); g.connect(this.drumGain);
    this._env(g, t, 0.001, 0.11, 0.5, 0, 0.06); s.start(t); s.stop(t + 0.2);
    const o = this.ctx.createOscillator(); o.frequency.value = 190; const g2 = this._gain(0);
    o.connect(g2); g2.connect(this.drumGain); this._env(g2, t, 0.001, 0.06, 0.35); o.start(t); o.stop(t + 0.1);
  }
  _bass(t, f, len) {
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const g = this._gain(0); o.connect(g); g.connect(this.bassFilter);
    this._env(g, t, 0.004, len, 0.34, 0.5, 0.05); o.start(t); o.stop(t + len + 0.1);
  }
  _pad(t, notes, len) {
    for (const f of notes) for (const det of [-7, 6]) {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      const g = this._gain(0); o.connect(g); g.connect(this.padFilter);
      this._env(g, t, 0.08, len * 0.7, 0.045, 0.8, 0.25); o.start(t); o.stop(t + len + 0.3);
    }
  }
  _arp(t, f, len) {
    if (f < 30) return;
    const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
    const g = this._gain(0); o.connect(g); g.connect(this.arpGain);
    this._env(g, t, 0.003, len, 0.5, 0.2, 0.03); o.start(t); o.stop(t + len + 0.05);
  }

  // ------------------------------------------------------------------ one-shots
  bov(strength = 1) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5;
    f.frequency.setValueAtTime(3800, t); f.frequency.exponentialRampToValueAtTime(700, t + 0.32);
    const g = this._gain(0); s.connect(f); f.connect(g); g.connect(this.master);
    this._env(g, t, 0.005, 0.3, 0.16 * strength, 0, 0.05); s.start(t); s.stop(t + 0.4);
  }
  chime(freqs, t0, gap, len, vol = 0.18, type = 'triangle') {
    const c = this.ctx;
    freqs.forEach((f, i) => {
      const t = t0 + i * gap;
      const o = c.createOscillator(); o.type = type; o.frequency.value = f;
      const g = this._gain(0); o.connect(g); g.connect(this.master);
      this._env(g, t, 0.004, len, vol, 0.25, 0.12); o.start(t); o.stop(t + len + 0.2);
      const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2; const g2 = this._gain(0);
      o2.connect(g2); g2.connect(this.master); this._env(g2, t, 0.004, len * 0.6, vol * 0.35, 0.1, 0.1); o2.start(t); o2.stop(t + len + 0.2);
    });
  }
  whoosh(len = 1.2) {
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2600, t + len * 0.5); f.frequency.exponentialRampToValueAtTime(500, t + len);
    const g = this._gain(0); s.connect(f); f.connect(g); g.connect(this.master);
    this._env(g, t, 0.08, len * 0.6, 0.3, 0.3, len * 0.4); s.start(t); s.stop(t + len + 0.1);
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(900, t + len * 0.5);
    const g2 = this._gain(0); o.connect(g2); g2.connect(this.master); this._env(g2, t, 0.05, len * 0.5, 0.12, 0, 0.2); o.start(t); o.stop(t + len);
  }
  impact(v) {
    const c = this.ctx, t = c.currentTime, k = clamp(v / 12, 0.2, 1);
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200 + 2000 * k;
    const g = this._gain(0); s.connect(f); f.connect(g); g.connect(this.master);
    this._env(g, t, 0.002, 0.18 * k + 0.05, 0.6 * k, 0, 0.08); s.start(t); s.stop(t + 0.4);
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(35, t + 0.25);
    const g2 = this._gain(0); o.connect(g2); g2.connect(this.master); this._env(g2, t, 0.002, 0.25, 0.7 * k); o.start(t); o.stop(t + 0.35);
    // a metallic ring for the guardrail
    for (const [fr, vol] of [[2200, 0.08], [3100, 0.05], [4700, 0.03]]) {
      const r = c.createOscillator(); r.type = 'sine'; r.frequency.value = fr * (0.95 + Math.random() * 0.1);
      const g3 = this._gain(0); r.connect(g3); g3.connect(this.master); this._env(g3, t, 0.002, 0.5 * k, vol * k, 0.05, 0.3); r.start(t); r.stop(t + 1);
    }
  }
  tick() { if (this.ready) this.chime([NOTES.E5, NOTES.A5], this.ctx.currentTime, 0.05, 0.12, 0.12, 'sine'); }

  /** React to scoring events. */
  onEvent(e) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    switch (e.type) {
      case 'bank': {
        const up = [NOTES.A4, NOTES.C5, NOTES.E5, NOTES.A5, NOTES.C5 * 2];
        const n = 2 + Math.min(3, e.tier + (e.chain > 1 ? 1 : 0));
        this.chime(up.slice(0, n), t, 0.07, 0.3, 0.16 + 0.03 * e.tier);
        this.whoosh(0.7 + Math.min(1.6, e.boost) * 0.5);
        break;
      }
      case 'tier': this.chime([NOTES.E5, NOTES.G5, NOTES.A5].slice(0, e.value + 1), t, 0.06, 0.2, 0.13); break;
      case 'switch': this.chime([NOTES.D5, NOTES.G5], t, 0.06, 0.15, 0.12, 'square'); break;
      case 'clip': this.tick(); break;
      case 'crash': this.impact(12); this.chime([NOTES.E3, NOTES.C3], t, 0.12, 0.35, 0.14, 'sawtooth'); break;
      case 'bump': this.impact(e.value); break;
      case 'sun': this.chime([NOTES.A3, NOTES.E4, NOTES.A4], t, 0.16, 0.6, 0.1, 'sine'); break;
    }
  }
}
