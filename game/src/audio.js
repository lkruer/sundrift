/**
 * Sound, all of it synthesised in Web Audio at runtime. No audio files: the engine, the turbo, the tyres,
 * the wind, the chimes and the music are oscillators and filtered noise, which keeps the game inside the
 * jam's weight budget and lets every sound follow the car exactly (the engine note is the rpm, the screech
 * is the slip, the music opens up when a drift is held).
 *
 * The engine is four detuned voices at the four-cylinder firing frequency (rpm / 30 Hz) through a low-pass
 * whose cutoff follows the throttle, with a noise rasp on top and a turbo whistle that climbs with load and
 * blows off when the throttle lifts. Tyres are band-passed noise whose centre wanders with slip. The music
 * is a scheduled 128 bpm loop in A minor pentatonic: kick, hat, snare, a filtered saw bass, a chord pad, a koto
 * playing an eight-bar tune in the hirajoshi scale over it, and a delayed arpeggio that only joins while a drift
 * is held.
 */
import { clamp } from './config.js?v=202609230440';

const NOTES = { A2: 110, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196, A3: 220, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880 };
// the koto's tune: eight bars in A hirajoshi (A B C E F), which sits on the Am-F-C-G loop; one note per 16th, 0 a rest
const KOTO = (() => {
  const N = { A4: NOTES.A4, B4: NOTES.B4, C5: NOTES.C5, E5: NOTES.E5, F5: NOTES.F5, A5: NOTES.A5, E4: NOTES.E4 };
  const bars = [
    'E5 . . . C5 . B4 . A4 . . . . . . .', 'F5 . E5 . C5 . . . A4 . C5 . . . . .',
    'E5 . . . C5 . E5 . F5 . E5 . C5 . . .', 'B4 . . . C5 . B4 . A4 . . . . . . .',
    'A5 . . . F5 . E5 . C5 . . . E5 . . .', 'F5 . . . E5 . C5 . A4 . . . . . . .',
    'C5 . E5 . F5 . E5 . C5 . B4 . C5 . . .', 'B4 . . . . . . . E4 . . . . . . .',
  ];
  return bars.flatMap((b) => b.split(' ').map((n) => N[n] || 0));
})();
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
    try { this.muted = localStorage.getItem('minidrift.mute') === '1'; } catch {}
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
    // the tunnel's echo: a short feedback delay the engine and the tyres are sent into while the car is inside
    this.echoIn = ctx.createGain(); this.echoIn.gain.value = 0;
    this.echoDelay = ctx.createDelay(0.5); this.echoDelay.delayTime.value = 0.09;
    this.echoFb = ctx.createGain(); this.echoFb.gain.value = 0.45;
    this.echoLP = ctx.createBiquadFilter(); this.echoLP.type = 'lowpass'; this.echoLP.frequency.value = 2200;
    this.echoIn.connect(this.echoDelay); this.echoDelay.connect(this.echoLP); this.echoLP.connect(this.echoFb); this.echoFb.connect(this.echoDelay);
    this.echoLP.connect(this.master);
    this._engine(); this._tyres(); this._wind(); this._rain(); this._musicBus();
    for (const g of [this.engGain, this.raspGain, this.turboGain, this.screechGain]) if (g) g.connect(this.echoIn);
    this.ready = true;
  }

  /** Inside a tunnel (0..1): the echo comes up, and the wind drops. */
  setTunnel(x) {
    if (!this.ctx || this._tunnel === x) return;
    this._tunnel = x;
    const t = this.ctx.currentTime;
    this.echoIn.gain.setTargetAtTime(x * 0.75, t, 0.12);
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

  /** Rain: a hiss of high noise over a soft low roar, both following how hard it rains. */
  _rain() {
    const c = this.ctx;
    this.rainSrc = this._noiseSource();
    const hi = c.createBiquadFilter(); hi.type = 'bandpass'; hi.frequency.value = 3200; hi.Q.value = 0.35;
    const lo = c.createBiquadFilter(); lo.type = 'lowpass'; lo.frequency.value = 420;
    this.rainGain = this._gain(0);
    this.rainSrc.connect(hi); hi.connect(this.rainGain);
    const lg = this._gain(0.9); this.rainSrc.connect(lo); lo.connect(lg); lg.connect(this.rainGain);
    this.rainGain.connect(this.master);
  }

  /** Which map: the city drops the koto for the synth arpeggio. */
  setMap(city) { this.city = !!city; }

  /** How hard it rains, 0..1 (and 0 inside a tunnel). */
  setRain(x) {
    if (!this.ready || Math.abs((this._rainV ?? -1) - x) < 0.01) return;
    this._rainV = x;
    this.rainGain.gain.setTargetAtTime(0.16 * x, this.ctx.currentTime, 0.4);
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
    this.kotoGain = this._gain(0.7); this.kotoGain.connect(this.musicGain); this.kotoGain.connect(this.delay);
    this.music.next = c.currentTime + 0.1;
  }

  /** Pause: the whole audio clock stops, so the engine, the tyres and the music all hold where they are. */
  pause(on) {
    if (!this.ctx) return;
    try { if (on) this.ctx.suspend(); else this.ctx.resume(); } catch {}
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('minidrift.mute', m ? '1' : '0'); } catch {}
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
    // in the city the arpeggio always runs under the loop (a synth night, not a koto one); drifting lifts it
    this.arpGain.gain.setTargetAtTime(0.18 * clamp(this.music.intensity + (this.city ? 0.4 : 0), 0, 1), t, 0.2);
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
      // the koto, always, over the top: a pluck that bends in from a touch sharp, and now and then a pressed bend
      const kf = KOTO[step % KOTO.length];
      if (kf && !this.city) this._koto(t, kf, step % 32 === 16);
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
  /** A plucked koto string: a bright attack falling away over a second, pitch settling from a touch sharp. */
  _koto(t, f, press) {
    const c = this.ctx, out = this._gain(0);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(1400, t + 0.6);
    out.connect(lp); lp.connect(this.kotoGain);
    for (const [type, mul, vol] of [['triangle', 1, 1], ['sawtooth', 1, 0.28], ['sine', 2, 0.35]]) {
      const o = c.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f * mul * 1.012, t); o.frequency.exponentialRampToValueAtTime(f * mul, t + 0.05);
      if (press) { o.frequency.setValueAtTime(f * mul, t + 0.22); o.frequency.exponentialRampToValueAtTime(f * mul * 1.0595, t + 0.36); }
      const g = this._gain(vol); o.connect(g); g.connect(out);
      o.start(t); o.stop(t + 1.6);
    }
    this._env(out, t, 0.002, 1.2, 0.2, 0, 0.2);
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
  /** One-shots for smashing things, landing, the countdown and the magnet; k scales the loudness. */
  sfx(name, k = 1) {
    if (!this.ready || !this.ctx) return;
    const c = this.ctx, t = c.currentTime, out = this.master;
    const noise = (dur, type, f, q, peak, a = 0.002, f1 = 0) => {
      const s = c.createBufferSource(); s.buffer = this.noiseBuf;
      const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
      if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = this._gain(0); s.connect(fl); fl.connect(g); g.connect(out);
      this._env(g, t, a, dur, peak * k, 0, 0.04); s.start(t, Math.random()); s.stop(t + dur + a + 0.1);
    };
    const tone = (type, f0, f1, dur, peak, a = 0.002) => {
      const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      const g = this._gain(0); o.connect(g); g.connect(out);
      this._env(g, t, a, dur, peak * k, 0, 0.04); o.start(t); o.stop(t + dur + a + 0.1);
    };
    switch (name) {
      case 'pole': case 'bollard':            // a plastic post: a crack and a hollow tok
        noise(0.08, 'bandpass', 1500, 1.3, 0.55); tone('triangle', 460, 170, 0.13, 0.4); break;
      case 'shrub':                           // a bush going flat: a soft whump and a rustle
        noise(0.24, 'lowpass', 520, 0.7, 0.5); noise(0.4, 'bandpass', 3400, 0.8, 0.2, 0.02); break;
      case 'lamp': case 'chevron': case 'mirror': {   // steel: a crack, then a bell of partials
        noise(0.05, 'highpass', 2600, 0.7, 0.45);
        for (const [f, p, d] of [[392, 0.24, 1.2], [1046, 0.15, 0.85], [1733, 0.1, 0.6], [2598, 0.06, 0.45]]) tone('sine', f * (0.97 + Math.random() * 0.06), f * 0.98, d, p);
        if (name === 'lamp') { tone('square', 130, 55, 0.3, 0.07); noise(0.34, 'highpass', 5200, 0.5, 0.14, 0.01); }
        break;
      }
      case 'vending':                         // a fridge falling over: a thump, a crash, cans
        tone('sine', 88, 42, 0.45, 0.8); noise(0.55, 'lowpass', 1000, 0.8, 0.55);
        for (let i = 0; i < 7; i++) setTimeout(() => this.sfx('can', 0.6), 70 + i * 60);
        break;
      case 'can': tone('sine', 1700 + Math.random() * 1100, 1400, 0.11, 0.09); break;
      case 'tree':                            // a trunk: a woody thunk and the canopy shaking
        tone('sine', 125, 60, 0.26, 0.65); noise(0.3, 'lowpass', 420, 0.8, 0.45); noise(0.55, 'bandpass', 3000, 0.7, 0.16, 0.04); break;
      case 'land': tone('sine', 98, 46, 0.3, 0.75); noise(0.26, 'lowpass', 520, 0.7, 0.5); break;
      case 'tick': tone('square', 1900, 1900, 0.03, 0.08); break;
      case 'tickHot': tone('square', 2700, 2700, 0.045, 0.13); tone('square', 1350, 1350, 0.045, 0.06); break;
      case 'grab': {                          // the magnet's field coming up: a rising, resonant buzz
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(820, t + 0.6);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(380, t); f.frequency.exponentialRampToValueAtTime(3400, t + 0.6); f.Q.value = 7;
        const g = this._gain(0); o.connect(f); f.connect(g); g.connect(out); this._env(g, t, 0.06, 0.6, 0.2 * k, 0.5, 0.18); o.start(t); o.stop(t + 1.0);
        tone('square', 57, 63, 0.65, 0.05, 0.06);
        break;
      }
      case 'clank':                           // the car striking the magnet
        noise(0.04, 'highpass', 3000, 0.7, 0.55); for (const [f, p, d] of [[622, 0.32, 0.7], [1488, 0.18, 0.5], [2317, 0.1, 0.34]]) tone('sine', f, f * 0.99, d, p); break;
      case 'fly': noise(0.9, 'bandpass', 300, 1.1, 0.34, 0.25, 1600); break;
      case 'drop': noise(0.3, 'bandpass', 1400, 1.0, 0.18, 0.02, 300); break;
      case 'done': this.chime([1047, 1319, 1568, 2093], t + 0.02, 0.07, 0.32, 0.14); break;
      default: break;
    }
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
