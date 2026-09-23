/**
 * Sound, all of it synthesised in Web Audio at runtime. No audio files: the engine, the turbo, the tyres,
 * the wind, the chimes and the music are oscillators and filtered noise, which keeps the game inside the
 * jam's weight budget and lets every sound follow the car exactly (the engine note is the rpm, the screech
 * is the slip, the music opens up when a drift is held).
 *
 * The engine is four detuned voices at the four-cylinder firing frequency (rpm / 30 Hz) through a low-pass
 * whose cutoff follows the throttle, with a noise rasp on top and a turbo whistle that climbs with load and
 * blows off when the throttle lifts. Tyres are band-passed noise whose centre wanders with slip.
 *
 * The music is two slow songs in the manner of an open-world game's soundtrack: lots of air, no drums, a soft
 * piano (on the pass, in D, with a koto figure now and then) or an FM electric piano (in the city, in A flat) over
 * warm analog pads, all of it played through a little old tape: a slow wow, a low-pass and a long reverb. The one
 * piece of 8-bit in it, a pulse-wave arpeggio, comes up under the tune while a drift is held. Each song is a
 * sixteen-bar form (A A B A) of four-bar phrases, and every phrase picks one of its section's tunes or leaves the
 * chords to themselves for a while, so it never plays the same way twice.
 */
import { clamp } from './config.js?v=202609232110';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const NOTE_I = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = (n) => { const r = /^([A-G])([#b]?)(\d)$/.exec(n); return 12 * (+r[3] + 1) + NOTE_I[r[1]] + (r[2] === '#' ? 1 : r[2] === 'b' ? -1 : 0); };
// a tune: bars split by '|', each note 'name step length' in sixteenths from the start of its bar
const tune = (str) => str.split('|').flatMap((bar, b) => bar.split(',').map((x) => x.trim()).filter(Boolean)
  .map((x) => { const [n, at, len] = x.split(/\s+/); return { at: b * 16 + +at, m: midi(n), len: +len }; }));
const chord = (bass, pad, arp) => ({ bass, pad, arp });
const SONGS = {
  // Yozakura Pass, in D: Gmaj7, D/F#, Em7, Asus4 | Bm7(11), Gmaj9, Dmaj9, A6sus
  pass: {
    tempo: 80, voice: 'piano', koto: true,
    A: [chord(43, [55, 59, 62, 66], [67, 71, 74, 78]), chord(42, [57, 62, 66, 69], [66, 69, 74, 76]),
      chord(40, [55, 59, 62, 64], [64, 67, 71, 74]), chord(45, [57, 62, 64, 67], [69, 74, 76, 79])],
    B: [chord(47, [54, 57, 62, 64], [66, 69, 71, 76]), chord(43, [57, 59, 62, 66], [67, 71, 74, 78]),
      chord(38, [54, 57, 61, 64], [66, 69, 73, 76]), chord(45, [57, 62, 64, 66], [69, 71, 74, 78])],
    tunesA: [
      tune('F#5 0 6, E5 6 2, D5 8 8 | E5 0 4, D5 4 4, A4 8 8 | B4 0 6, D5 6 2, E5 8 8 | D5 0 12'),
      tune('B5 0 4, A5 4 4, F#5 8 8 | A5 0 6, F#5 6 2, E5 8 8 | G5 0 4, F#5 4 4, E5 8 4, D5 12 4 | E5 0 8, A4 8 8'),
      tune('D5 4 4, E5 8 4, F#5 12 4 | A5 0 16 | G5 4 4, F#5 8 4, E5 12 4 | E5 0 16'),
      tune('D6 0 2, B5 2 2, A5 4 4, D6 8 2, B5 10 2, A5 12 4 | A5 0 8, F#5 8 8 | B5 0 2, A5 2 2, G5 4 4, F#5 8 8 | E5 0 16'),
    ],
    tunesB: [
      tune('F#5 0 8, E5 8 4, D5 12 4 | B4 0 8, D5 8 8 | C#5 0 8, E5 8 4, F#5 12 4 | E5 0 16'),
      tune('D5 0 4, E5 4 4, F#5 8 8 | B5 0 12, A5 12 4 | A5 0 8, F#5 8 8 | E5 0 8, D5 8 8'),
      tune('B5 0 16 | A5 4 4, G5 8 4, F#5 12 4 | F#5 0 12, E5 12 4 | E5 0 16'),
    ],
    pent: [74, 76, 78, 81, 83, 86], tonic: [62, 66, 69],
  },
  // NEO TOKYO, in A flat: Dbmaj9, Cm9, Bbm9, Eb9sus | Fm9, Dbmaj7, Abmaj7/C, Eb9sus
  city: {
    tempo: 76, voice: 'ep', koto: false,
    A: [chord(37, [53, 56, 60, 63], [65, 68, 72, 75]), chord(36, [51, 55, 58, 62], [67, 70, 74, 75]),
      chord(34, [53, 56, 60, 61], [65, 68, 72, 73]), chord(39, [53, 56, 58, 61], [65, 70, 73, 77])],
    B: [chord(41, [56, 60, 63, 67], [68, 72, 75, 79]), chord(37, [53, 56, 60, 65], [65, 68, 72, 77]),
      chord(36, [55, 60, 63, 68], [67, 72, 75, 80]), chord(39, [53, 56, 58, 61], [65, 70, 73, 77])],
    tunesA: [
      tune('F5 0 4, Eb5 4 4, C5 8 8 | Eb5 0 6, D5 6 2, Bb4 8 8 | Ab4 0 4, Bb4 4 4, C5 8 8 | Bb4 0 16'),
      tune('C5 2 2, Eb5 4 4, Ab5 8 6, G5 14 2 | G5 0 8, Eb5 8 8 | F5 0 4, Eb5 4 4, Db5 8 4, C5 12 4 | Eb5 0 12'),
      tune('C6 0 12 | Bb5 0 4, G5 4 4, Eb5 8 8 | F5 0 16 | Eb5 0 8, C5 8 8'),
    ],
    tunesB: [
      tune('Ab5 0 8, G5 8 4, Eb5 12 4 | F5 0 8, C5 8 8 | Eb5 0 6, C5 6 2, Bb4 8 8 | Db5 0 8, Bb4 8 8'),
      tune('C5 0 4, Eb5 4 4, F5 8 4, G5 12 4 | Ab5 0 16 | G5 0 8, Eb5 8 8 | F5 0 16'),
    ],
    pent: [72, 75, 77, 80, 82, 84], tonic: [68, 72, 75],
  },
};
// the engine's own processor (see _engine): loaded from a blob, so there is no file to ship
const ENGINE_WORKLET = "\n/**\n * The engine, sample by sample: an inline four firing every half turn of the crank, each firing a sharp pressure\n * pulse (harder under load, softer off it, never two alike, the four cylinders never quite equal) with the noise of\n * the burn riding on it, ringing through the exhaust's fixed resonances, then a DC blocker and a little saturation.\n * A pop (the 'pop' parameter rising): unburnt fuel lighting off in the hot pipe on the overrun, a crack and a boom.\n */\nclass MinidriftEngine extends AudioWorkletProcessor {\n  static get parameterDescriptors() {\n    return [\n      { name: 'rpm', defaultValue: 900, minValue: 200, maxValue: 12000, automationRate: 'k-rate' },\n      { name: 'load', defaultValue: 0.2, minValue: 0, maxValue: 1, automationRate: 'k-rate' },\n      { name: 'cut', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },\n      { name: 'pop', defaultValue: 0, minValue: 0, maxValue: 2, automationRate: 'k-rate' },\n    ];\n  }\n  constructor() {\n    super();\n    this.ph = 0; this.cyl = 0; this.t = 1; this.amp = 0; this.pop = 0; this.popT = 1; this.popIn = 0;\n    this.bias = [1.0, 0.9, 1.07, 0.95];\n    this.s = 22222; this.dc = 0;\n    // the exhaust's and the body's resonances: frequency, Q, gain (two-pole band-passes, unity at the peak)\n    const R = [[92, 3.0, 1.0], [205, 4.5, 0.85], [430, 6.0, 0.6], [860, 5.5, 0.38], [1620, 4.5, 0.22], [3100, 3.0, 0.1]];\n    this.r = R.map(([f, q, g]) => {\n      const w = 2 * Math.PI * f / sampleRate, al = Math.sin(w) / (2 * q), a0 = 1 + al;\n      return { b0: al / a0, b2: -al / a0, a1: -2 * Math.cos(w) / a0, a2: (1 - al) / a0, g, x1: 0, x2: 0, y1: 0, y2: 0 };\n    });\n  }\n  rnd() { this.s = (this.s * 1664525 + 1013904223) >>> 0; return this.s / 4294967296; }\n  process(inputs, outputs, P) {\n    const out = outputs[0] && outputs[0][0];\n    if (!out) return true;\n    const rpm = P.rpm[0], load = P.load[0], cut = P.cut[0];\n    const sr = sampleRate, dph = rpm / 60 / sr, dt = 1 / sr;\n    const tau = 0.0008 + 0.0024 * (1 - load);\n    const popIn = P.pop[0];\n    if (popIn > 0.05 && this.popIn <= 0.05) { this.pop = popIn * (0.8 + 0.4 * this.rnd()); this.popT = 0; }\n    this.popIn = popIn;\n    for (let i = 0; i < out.length; i++) {\n      this.ph += dph;\n      if (this.ph >= 0.5) {\n        this.ph -= 0.5;\n        const c = this.cyl; this.cyl = (c + 1) & 3;\n        const fired = cut > 0 && this.rnd() < cut ? 0 : 1;\n        this.amp = fired * (0.22 + 0.78 * load) * this.bias[c] * (0.86 + 0.28 * this.rnd());\n        this.t = 0;\n      }\n      this.t += dt; this.popT += dt;\n      const env = Math.exp(-this.t / tau) * (1 - Math.exp(-this.t / 0.00016));\n      const nz = this.rnd() * 2 - 1;\n      let x = this.amp * env * (1 + 0.5 * nz);\n      if (this.popT < 0.07) { const pe = Math.exp(-this.popT / 0.011); x += this.pop * pe * (nz * 0.95 + Math.sin(this.popT * 440) * 0.7); }\n      let y = x * 0.22;\n      for (let k = 0; k < this.r.length; k++) {\n        const r = this.r[k];\n        const v = r.b0 * x + r.b2 * r.x2 - r.a1 * r.y1 - r.a2 * r.y2;\n        r.x2 = r.x1; r.x1 = x; r.y2 = r.y1; r.y1 = v;\n        y += v * r.g;\n      }\n      this.dc += (y - this.dc) * 0.0015;\n      out[i] = Math.tanh((y - this.dc) * 2.4) * 0.6;\n    }\n    return true;\n  }\n}\nregisterProcessor('minidrift-engine', MinidriftEngine);\n";

// the left hand breaks the chord in quarters: the bass, then three of the pad's notes
const LH = { 0: -1, 4: 1, 8: 2, 12: 3 };

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

  /**
   * The engine. Its note comes from an AudioWorklet that fires an inline four's pulses into the exhaust's resonances
   * (ENGINE_WORKLET, above): the harmonics sweep through fixed formants as the revs rise, which is what an engine
   * sounds like and a bank of oscillators does not. Round it: the induction roar (noise the throttle opens), the
   * straight-cut gears' whine under load, and the turbo's whistle. Where there is no AudioWorklet, the oscillators.
   */
  _engine() {
    const c = this.ctx;
    this.engGain = this._gain(0);
    this.engFilter = c.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 2400; this.engFilter.Q.value = 0.6;
    this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
    // the induction roar
    this.rasp = this._noiseSource();
    this.intakeF = c.createBiquadFilter(); this.intakeF.type = 'bandpass'; this.intakeF.frequency.value = 480; this.intakeF.Q.value = 1.1;
    this.raspGain = this._gain(0); this.rasp.connect(this.intakeF); this.intakeF.connect(this.raspGain); this.raspGain.connect(this.master);
    // the gears' whine, with the road speed
    this.whine = this._osc('triangle', 300); this.whineGain = this._gain(0);
    const wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 900; wf.Q.value = 0.8;
    this.whine.connect(wf); wf.connect(this.whineGain); this.whineGain.connect(this.master);
    // the turbo's whistle
    this.turbo = this._osc('sine', 1400); this.turboGain = this._gain(0);
    const tf = c.createBiquadFilter(); tf.type = 'highpass'; tf.frequency.value = 900;
    this.turbo.connect(tf); tf.connect(this.turboGain); this.turboGain.connect(this.master);
    this.engNode = null; this.voices = [];
    this.gearShown = -1; this.cutUntil = 0;
    if (c.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
      const url = URL.createObjectURL(new Blob([ENGINE_WORKLET], { type: 'application/javascript' }));
      c.audioWorklet.addModule(url).then(() => {
        this.engNode = new AudioWorkletNode(c, 'minidrift-engine', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
        this.engNode.connect(this.engFilter);
      }).catch(() => this._engineOsc());
    } else this._engineOsc();
  }

  /** A pop from the exhaust on the overrun, k its size (0.5 to 1.5); the game shows the flame. */
  pop(k = 1) {
    if (!this.ready || !this.engNode) return;
    const P = this.engNode.parameters.get('pop'), t = this.ctx.currentTime;
    P.setValueAtTime(k, t); P.setValueAtTime(0, t + 0.03);
  }

  /** The old engine, for a browser with no AudioWorklet: detuned voices at the firing frequency. */
  _engineOsc() {
    const mk = (type, mul, gain, detune) => {
      const o = this._osc(type, 30 * mul); o.detune.value = detune;
      const g = this._gain(gain); o.connect(g); g.connect(this.engFilter);
      this.voices.push({ o, mul });
    };
    mk('sawtooth', 1, 0.22, 0); mk('sawtooth', 1, 0.18, 9); mk('square', 0.5, 0.16, -4); mk('sine', 0.5, 0.35, 0); mk('sawtooth', 2, 0.06, 5);
  }

  /**
   * The tyres: a slide's squeal is rubber stick-slipping on the asphalt, and it sings in narrow bands that wander as
   * the load and the angle change: three narrow band-passes on noise, each drifting on its own, over the broad scrub of
   * the tread across the surface.
   */
  _tyres() {
    const c = this.ctx;
    this.screech = this._noiseSource();
    this.screechGain = this._gain(0);
    this.squeal = [[760, 15, 3.2], [1180, 18, 2.4], [1940, 13, 1.4]].map(([f, q, g]) => {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const gg = this._gain(g); this.screech.connect(bp); bp.connect(gg); gg.connect(this.screechGain);
      return { bp, f, w: 0 };
    });
    this.screechF = this.squeal[0].bp;
    this.screechGain.connect(this.master);
    const sc = c.createBiquadFilter(); sc.type = 'bandpass'; sc.frequency.value = 560; sc.Q.value = 0.6;
    this.scrubGain = this._gain(0); this.screech.connect(sc); sc.connect(this.scrubGain); this.scrubGain.connect(this.master);
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

  /** Which map: each has its own song (a new one starts from its first phrase). */
  setMap(city) {
    if (this.city === !!city) return;
    this.city = !!city;
    Object.assign(this.music, { step: 0, phrase: 0, chords: null, tune: null });
  }

  /** How hard it rains, 0..1 (and 0 inside a tunnel). */
  setRain(x) {
    if (!this.ready || Math.abs((this._rainV ?? -1) - x) < 0.01) return;
    this._rainV = x;
    this.rainGain.gain.setTargetAtTime(0.16 * x, this.ctx.currentTime, 0.4);
  }

  _musicBus() {
    const c = this.ctx;
    this.musicGain = this._gain(0.95); this.musicGain.connect(this.master);
    // everything in the music goes in here, and through a little old tape: a slow wow and a faster flutter on a
    // short modulated delay, a gentle low-pass, then dry and into a long dark reverb
    this.musicIn = this._gain(1);
    const wow = c.createDelay(0.1); wow.delayTime.value = 0.02;
    const w1 = this._osc('sine', 0.43), w1g = this._gain(0.0017); w1.connect(w1g); w1g.connect(wow.delayTime);
    const w2 = this._osc('sine', 5.1), w2g = this._gain(0.00007); w2.connect(w2g); w2g.connect(wow.delayTime);
    const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 5200; tone.Q.value = 0.4;
    this.musicIn.connect(wow); wow.connect(tone);
    const dry = this._gain(0.78); tone.connect(dry); dry.connect(this.musicGain);
    this.verb = c.createConvolver(); this.verb.buffer = this._impulse(3.4);
    const send = this._gain(0.5), ret = this._gain(0.85);
    tone.connect(send); send.connect(this.verb); this.verb.connect(ret); ret.connect(this.musicGain);
    // the pads, through a low-pass that breathes on a slow LFO and opens while a drift is held
    this.padFilter = c.createBiquadFilter(); this.padFilter.type = 'lowpass'; this.padFilter.frequency.value = 650; this.padFilter.Q.value = 0.9;
    const pl = this._osc('sine', 0.07), plg = this._gain(450); pl.connect(plg); plg.connect(this.padFilter.detune);
    this.padFilter.connect(this.musicIn);
    // the 8-bit arpeggio: a 25% pulse wave, filtered, with a dotted-eighth echo
    const N = 24, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
    for (let n = 1; n <= N; n++) re[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.25);
    this.pulse = c.createPeriodicWave(re, im);
    this.arpGain = this._gain(0);
    const alp = c.createBiquadFilter(); alp.type = 'lowpass'; alp.frequency.value = 2600;
    this.arpGain.connect(alp); alp.connect(this.musicIn);
    this.delay = c.createDelay(1.5); this.delay.delayTime.value = (60 / 80) * 0.75;
    this.delayFb = this._gain(0.36); this.delay.connect(this.delayFb); this.delayFb.connect(this.delay);
    const df = c.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 1900;
    alp.connect(this.delay); this.delay.connect(df); df.connect(this.musicIn);
    this.kotoGain = this._gain(0.4); this.kotoGain.connect(this.musicIn); this.kotoGain.connect(this.delay);
    Object.assign(this.music, { next: c.currentTime + 0.15, step: 0, phrase: 0, chords: null, tune: null, oct: 0, orn: false });
  }

  /** A room for the music: stereo noise dying away, the highs faster than the lows, with a soft onset. */
  _impulse(sec) {
    const c = this.ctx, sr = c.sampleRate, n = Math.floor(sr * sec), b = c.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let s = ch ? 91 : 17, lo = 0;
      for (let i = 0; i < n; i++) {
        s = (s * 1664525 + 1013904223) >>> 0;
        const w = (s / 4294967296) * 2 - 1;
        lo += (w - lo) * 0.18;
        const t = i / sr;
        d[i] = (lo * 2.2 * Math.exp(-t * 2.1) + (w - lo) * Math.exp(-t * 5.5)) * Math.min(1, t / 0.03);
      }
    }
    return b;
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
  update(dt, car, rpm, drifting, boost01, surface, gear = -1) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const thr = car.throttle;
    // an upshift: the ignition cut for a moment (the revs fall on their own, into the next gear) and the box's clunk
    if (gear >= 0 && this.gearShown >= 0 && gear !== this.gearShown) {
      if (gear > this.gearShown && thr > 0.3) { this.cutUntil = t + 0.075; this.sfx('shift', 0.8); }
      else if (gear < this.gearShown) this.sfx('shift', 0.45);
    }
    if (gear >= 0) this.gearShown = gear;
    // at the limiter, the fuel cut bounces off it
    const limiter = rpm > 8150 && thr > 0.7 ? (Math.floor(t * 15) % 2 ? 0.8 : 0) : 0;
    const cut = t < this.cutUntil ? 1 : limiter;
    const load = clamp(0.12 + 0.88 * thr + boost01 * 0.25, 0, 1) * (1 - cut * 0.6);
    if (this.engNode) {
      const P = this.engNode.parameters;
      P.get('rpm').setTargetAtTime(rpm, t, 0.028);
      P.get('load').setTargetAtTime(thr < 0.05 ? 0.02 : load, t, 0.03);
      P.get('cut').setTargetAtTime(cut, t, 0.004);
      this.engFilter.frequency.setTargetAtTime(1500 + 3800 * (0.3 + 0.7 * load) * (0.35 + 0.65 * rpm / 8000), t, 0.05);
      this.engGain.gain.setTargetAtTime(0.8 + 0.36 * load, t, 0.05);
    } else {
      const f = rpm / 30;
      for (const v of this.voices) v.o.frequency.setTargetAtTime(f * v.mul, t, 0.03);
      this.engFilter.frequency.setTargetAtTime(380 + 2600 * load * (0.4 + 0.6 * rpm / 8000), t, 0.05);
      this.engGain.gain.setTargetAtTime(0.30 + 0.22 * load, t, 0.05);
    }
    // the intake roars as the throttle opens, higher with the revs
    this.intakeF.frequency.setTargetAtTime(320 + 420 * rpm / 8000, t, 0.05);
    this.raspGain.gain.setTargetAtTime(thr * (0.03 + 0.11 * rpm / 8000) * (1 - cut * 0.8), t, 0.04);
    // the gears whine with the road speed, under load
    const sp = Math.abs(car.vF);
    this.whine.frequency.setTargetAtTime(Math.max(40, sp * 21), t, 0.05);
    this.whineGain.gain.setTargetAtTime(clamp((sp - 6) / 20, 0, 1) * (0.006 + 0.014 * thr), t, 0.08);
    // turbo: spools with rpm and throttle, whistles at high pitch
    const spool = clamp((rpm - 2500) / 5000, 0, 1) * (0.3 + 0.7 * thr);
    this.turbo.frequency.setTargetAtTime(1500 + spool * 3200, t, 0.12);
    this.turboGain.gain.setTargetAtTime(0.012 * spool + boost01 * 0.02, t, 0.1);
    // blow-off on a lift at load
    if (this.lastThrottle > 0.6 && thr < 0.2 && rpm > 3500) this.bov(spool);
    this.lastThrottle = thr; this.rpm = rpm;
    // tyres: the squeal with the slip, its bands wandering; the scrub under it
    const slip = Math.max(car.slipRear, car.slipFront * 0.7) * clamp((car.speed - 3) / 8, 0, 1) * surface;
    this.screechGain.gain.setTargetAtTime(slip * 0.2 * (0.8 + 0.4 * Math.random()), t, 0.03);
    this.scrubGain.gain.setTargetAtTime(slip * 0.1 * (0.6 + 0.4 * clamp(car.speed / 20, 0, 1)), t, 0.05);
    const ang = Math.abs(car.beta);
    for (const s of this.squeal) {
      s.w = s.w * 0.94 + (Math.random() - 0.5) * 0.05;
      s.bp.frequency.setTargetAtTime(s.f * (0.9 + 0.35 * clamp(ang, 0, 0.8) + s.w), t, 0.035);
    }
    this.gravelGain.gain.setTargetAtTime((1 - surface) * clamp(car.speed / 12, 0, 1) * 0.5, t, 0.05);
    // wind
    this.windGain.gain.setTargetAtTime(clamp(car.speed / 60, 0, 1) ** 2 * 0.35 + boost01 * 0.15, t, 0.1);
    // music
    this.music.intensity += ((drifting ? 1 : 0) + boost01 * 0.5 - this.music.intensity) * Math.min(1, dt * 2);
    this.padFilter.frequency.setTargetAtTime(650 + 1500 * this.music.intensity, t, 0.3);
    // the arpeggio comes up while a drift is held (and in the city it murmurs under the tune all the time)
    const arp = 0.11 * clamp(this.music.intensity + (this.city ? 0.28 : 0), 0, 1);
    this.arpGain.gain.setTargetAtTime(arp, t, 0.25);
    this._arpOn = arp > 0.004;
    this._schedule();
  }

  /** Lookahead scheduler: keep notes queued 0.3 s ahead of the audio clock. */
  _schedule() {
    const c = this.ctx, m = this.music, song = SONGS[this.city ? 'city' : 'pass'];
    const spb = 60 / song.tempo, s16 = spb / 4;
    // (back from a hidden tab or a stall: start again from now rather than play everything missed at once)
    if (m.next < c.currentTime - 0.3) m.next = c.currentTime + 0.05;
    const hum = (t) => Math.max(c.currentTime, t + (Math.random() - 0.5) * 0.014);
    const vj = () => 0.85 + Math.random() * 0.3;
    while (m.next < c.currentTime + 0.3) {
      const t = m.next, ps = m.step % 64;
      if (ps === 0 || !m.chords) this._phrase(song);
      const bar = ps >> 4, b16 = ps & 15, ch = m.chords[bar];
      if (b16 === 0) { this._pad(t, ch.pad, spb * 4); this._sub(t, ch.bass - 12, spb * 4); }
      // the left hand, a note now and then left out
      const lh = LH[b16];
      if (lh !== undefined && (b16 === 0 || Math.random() < 0.85)) {
        this._voice(song, hum(t), lh < 0 ? ch.bass : ch.pad[lh], (lh < 0 ? 0.5 : 0.3) * vj(), spb * (lh < 0 ? 3.5 : 2), -0.25 + 0.12 * (lh < 0 ? 0 : lh));
      }
      // the tune
      if (m.tune) for (const n of m.tune) if (n.at === ps) this._voice(song, hum(t), n.m + m.oct, 0.6 * vj(), n.len * s16, 0.18);
      // the 8-bit arpeggio, only while it can be heard: up the chord, then again an octave higher
      if (this._arpOn) this._arp(t, ch.arp[b16 & 3] - (b16 & 4 ? 0 : 12), s16 * 0.85);
      // the end of some phrases: a music-box twinkle, or on the pass a koto figure
      if (ps === 50 && m.orn) {
        if (song.koto && Math.random() < 0.6) {
          const p = song.pent; [p[4], p[3], p[2], p[3]].forEach((q, i) => this._koto(t + i * s16 * 1.5, mtof(q), i === 3));
        } else { const p = song.pent; [p[5] + 12, p[3] + 12, p[4] + 12].forEach((q, i) => this._bell(t + i * s16 * 2, q, 0.05)); }
      }
      m.next += s16; m.step++;
    }
  }

  /** A new four-bar phrase: its chords, and a tune three times in four (never the same one twice running). */
  _phrase(song) {
    const m = this.music;
    const sec = 'AABA'[m.phrase % 4]; m.phrase++;
    m.chords = song[sec];
    const tunes = song['tunes' + sec];
    let tn = Math.random() < 0.75 ? tunes[Math.floor(Math.random() * tunes.length)] : null;
    if (tn && tn === m.lastTune && tunes.length > 1) tn = tunes[(tunes.indexOf(tn) + 1) % tunes.length];
    m.tune = tn; if (tn) m.lastTune = tn;
    m.oct = tn && Math.random() < 0.2 && Math.max(...tn.map((n) => n.m)) <= 81 ? 12 : 0;   // now and then up an octave
    m.orn = Math.random() < 0.4;
  }

  _voice(song, t, m, vel, len, pan) { if (song.voice === 'ep') this._ep(t, m, vel, len, pan); else this._piano(t, m, vel, len, pan); }

  _out(pan) {
    const c = this.ctx, g = this._gain(0);
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); p.connect(this.musicIn); } else g.connect(this.musicIn);
    return g;
  }

  /**
   * A soft felt piano: four partials, the upper ones a little out of tune and dying first, a low note ringing
   * longer than a high one, a felt thump at the strike, and the damper coming down at the end of the note.
   */
  _piano(t, m, vel, len, pan = 0) {
    const c = this.ctx, f = mtof(m);
    const out = this._out(pan);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(7000, 900 + f * 4); lp.Q.value = 0.2;
    lp.connect(out);
    const tau = clamp(1.5 * Math.pow(440 / f, 0.35), 0.7, 2.6);
    const ring = Math.max(len, 0.25) + 1.4;
    for (const [mul, v, k, det] of [[1, 1, 1, 0], [2, 0.3, 0.45, 3], [3, 0.1, 0.25, -4], [4.03, 0.04, 0.14, 0]]) {
      const o = c.createOscillator(); o.frequency.value = f * mul; o.detune.value = det;
      const g = this._gain(0); o.connect(g); g.connect(lp);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.setTargetAtTime(0, t + 0.006, tau * k);
      o.start(t); o.stop(t + ring + 0.05);
    }
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const nf = c.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 600;
    const ng = this._gain(0); s.connect(nf); nf.connect(ng); ng.connect(out);
    ng.gain.setValueAtTime(0.35, t); ng.gain.setTargetAtTime(0, t, 0.012); s.start(t, Math.random()); s.stop(t + 0.1);
    const pk = 0.2 * vel;
    out.gain.setValueAtTime(pk, t); out.gain.setValueAtTime(pk, t + len); out.gain.setTargetAtTime(0, t + len, 0.3);
  }

  /** An FM electric piano, the 80s kind: a sine bent by another at the same pitch, and a bright tine at the strike. */
  _ep(t, m, vel, len, pan = 0) {
    const c = this.ctx, f = mtof(m);
    const out = this._out(pan);
    const car = c.createOscillator(); car.frequency.value = f;
    const mod = c.createOscillator(); mod.frequency.value = f;
    const mg = this._gain(0); mod.connect(mg); mg.connect(car.frequency);
    mg.gain.setValueAtTime(f * (0.9 + 1.1 * vel), t); mg.gain.setTargetAtTime(f * 0.18, t, 0.3);
    const tine = c.createOscillator(); tine.frequency.value = f * 14;
    const tg = this._gain(0); tine.connect(tg); tg.connect(car.frequency);
    tg.gain.setValueAtTime(f * 8 * vel, t); tg.gain.setTargetAtTime(0, t, 0.025);
    const g = this._gain(0); car.connect(g); g.connect(out);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.004); g.gain.setTargetAtTime(0, t + 0.004, clamp(1.4 * Math.pow(440 / f, 0.3), 0.6, 2.2));
    const ring = Math.max(len, 0.25) + 1.3;
    for (const o of [car, mod, tine]) { o.start(t); o.stop(t + ring + 0.05); }
    const pk = 0.2 * vel;
    out.gain.setValueAtTime(pk, t); out.gain.setValueAtTime(pk, t + len); out.gain.setTargetAtTime(0, t + len, 0.28);
  }

  /** The pad: two detuned saws a note, swelling in slowly and dying away slowly into the next chord. */
  _pad(t, notes, len) {
    for (const m of notes) for (const det of [-6, 7]) {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
      const g = this._gain(0); o.connect(g); g.connect(this.padFilter);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.026, t + Math.min(1.2, len * 0.4));
      g.gain.setValueAtTime(0.026, t + len * 0.85); g.gain.linearRampToValueAtTime(0, t + len + 1.1);
      o.start(t); o.stop(t + len + 1.2);
    }
  }

  /** A sine under the bass, felt more than heard. */
  _sub(t, m, len) {
    const o = this._osc('sine', mtof(m)), g = this._gain(0);
    o.stop(t + len + 0.9);
    o.connect(g); g.connect(this.musicIn);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.5); g.gain.setValueAtTime(0.07, t + len * 0.8); g.gain.linearRampToValueAtTime(0, t + len + 0.8);
  }

  /** A music-box bell: a sine with two inharmonic partials that die quickly. */
  _bell(t, m, vol) {
    const c = this.ctx, f = mtof(m), out = this._out((Math.random() - 0.5) * 0.8);
    for (const [mul, v, tau] of [[1, 1, 0.7], [2.76, 0.35, 0.22], [5.4, 0.15, 0.09]]) {
      const o = c.createOscillator(); o.frequency.value = f * mul;
      const g = this._gain(0); o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.003); g.gain.setTargetAtTime(0, t + 0.003, tau);
      o.start(t); o.stop(t + 3);
    }
    out.gain.value = vol;
  }

  /** A plucked koto string: a bright attack falling away over a second, pitch settling from a touch sharp. */
  _koto(t, f, press) {
    const c = this.ctx, out = this._gain(0);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(1200, t + 0.6);
    out.connect(lp); lp.connect(this.kotoGain);
    for (const [type, mul, vol] of [['triangle', 1, 1], ['sawtooth', 1, 0.22], ['sine', 2, 0.3]]) {
      const o = c.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f * mul * 1.012, t); o.frequency.exponentialRampToValueAtTime(f * mul, t + 0.05);
      if (press) { o.frequency.setValueAtTime(f * mul, t + 0.22); o.frequency.exponentialRampToValueAtTime(f * mul * 1.0595, t + 0.36); }
      const g = this._gain(vol); o.connect(g); g.connect(out);
      o.start(t); o.stop(t + 1.6);
    }
    this._env(out, t, 0.002, 1.2, 0.2, 0, 0.2);
  }

  _env(node, t, a, d, peak, sus = 0, r = 0.05, hold = 0) {
    const g = node.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(peak, t + a);
    g.exponentialRampToValueAtTime(Math.max(0.0001, sus * peak || 0.0001), t + a + d);
    if (hold) g.setValueAtTime(Math.max(0.0001, sus * peak || 0.0001), t + a + d + hold);
    g.exponentialRampToValueAtTime(0.0001, t + a + d + hold + r);
  }

  /** One note of the 8-bit arpeggio. */
  _arp(t, m, len) {
    const o = this.ctx.createOscillator(); o.setPeriodicWave(this.pulse); o.frequency.value = mtof(m);
    const g = this._gain(0); o.connect(g); g.connect(this.arpGain);
    this._env(g, t, 0.003, len, 0.5, 0.25, 0.04); o.start(t); o.stop(t + len + 0.1);
  }

  /** The current song's notes for the chimes, so a fanfare is always in the music's key. */
  _key(i, oct = 0) { const p = SONGS[this.city ? 'city' : 'pass'].pent; return mtof(p[i % p.length] + 12 * (oct + Math.floor(i / p.length))); }
  _tonic(oct = 0) { return SONGS[this.city ? 'city' : 'pass'].tonic.map((m) => mtof(m + 12 * oct)); }

  // ------------------------------------------------------------------ one-shots
  bov(strength = 1) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    // the valve's sigh, softer than it was
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5;
    f.frequency.setValueAtTime(3400, t); f.frequency.exponentialRampToValueAtTime(800, t + 0.3);
    const g = this._gain(0); s.connect(f); f.connect(g); g.connect(this.master);
    this._env(g, t, 0.005, 0.26, 0.07 * strength, 0, 0.05); s.start(t, Math.random()); s.stop(t + 0.4);
    // the flutter: the compressor surging against the shut throttle, chu-tu-tu-tu, slowing as it dies
    const s2 = c.createBufferSource(); s2.buffer = this.noiseBuf;
    const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1500; f2.Q.value = 1.6;
    const g2 = this._gain(0); s2.connect(f2); f2.connect(g2); g2.connect(this.master);
    let tt = t + 0.015;
    for (let k = 0; k < 9; k++) {
      const a = 0.17 * strength * Math.exp(-k / 3.4);
      g2.gain.setValueAtTime(0, tt); g2.gain.linearRampToValueAtTime(a, tt + 0.004); g2.gain.setTargetAtTime(0, tt + 0.006, 0.009);
      tt += 0.042 + k * 0.004;
    }
    s2.start(t, Math.random()); s2.stop(tt + 0.1);
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
      case 'boostCut':                        // the boost let go: a short falling hiss
        noise(0.22, 'bandpass', 2400, 1.2, 0.2, 0.004, 500); break;
      case 'shift':                           // the gearbox: a dull clunk and a click of the linkage
        tone('sine', 150, 80, 0.06, 0.2); noise(0.025, 'bandpass', 2600, 1.4, 0.14); break;
      case 'bag': case 'box':                 // a soft thump, and paper and plastic rustling
        noise(0.16, 'lowpass', 600, 0.7, 0.5); noise(0.34, 'bandpass', 2800, 0.8, 0.2, 0.015); tone('sine', 150, 70, 0.14, 0.3); break;
      case 'crate': case 'crates':            // hollow plastic clattering over
        noise(0.1, 'bandpass', 1500, 1.6, 0.4); tone('square', 520, 280, 0.07, 0.12);
        for (let i = 0; i < (name === 'crates' ? 3 : 2); i++) setTimeout(() => this.sfx('clack', 0.7), 60 + i * 75);
        break;
      case 'clack': noise(0.05, 'bandpass', 1900 + Math.random() * 700, 2, 0.28); tone('triangle', 420 + Math.random() * 160, 260, 0.05, 0.12); break;
      case 'cone':                            // a hollow bonk of soft plastic
        tone('triangle', 340, 170, 0.13, 0.42); noise(0.05, 'bandpass', 2100, 1.2, 0.28); break;
      case 'aboard':                          // a wooden board clapping down
        noise(0.07, 'bandpass', 1100, 1.1, 0.45); tone('square', 230, 130, 0.08, 0.2); setTimeout(() => this.sfx('clack', 0.6), 110); break;
      case 'bike':                            // a bicycle going over: steel rattling and its bell
        noise(0.18, 'highpass', 2400, 0.7, 0.36); tone('square', 170, 90, 0.12, 0.12);
        for (const [f, p, d] of [[2780, 0.12, 0.55], [3350, 0.06, 0.4]]) tone('sine', f, f * 0.995, d, p);
        setTimeout(() => this.sfx('clack', 0.8), 90); break;
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
      case 'done': { const [a, b2, c2] = this._tonic(2); this.chime([a, b2, c2, a * 2], t + 0.02, 0.07, 0.32, 0.14); break; }
      default: break;
    }
  }

  /** Thunder, after the light: a crack for a near strike, then a long rumble that rolls a few times off the hills. */
  thunder(delay = 1, k = 1) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(260 + 1100 * k, t); lp.frequency.exponentialRampToValueAtTime(80, t + 3.4);
    const g = this._gain(0); s.connect(lp); lp.connect(g); g.connect(this.master);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.55 * k, t + 0.06 + (1 - k) * 0.3);
    for (let i = 1; i <= 3; i++) g.gain.linearRampToValueAtTime((0.5 - i * 0.1) * k * (0.7 + Math.random() * 0.6), t + 0.4 * i + Math.random() * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.8);
    s.start(t, Math.random()); s.stop(t + 4);
    const o = c.createOscillator(); o.frequency.setValueAtTime(58, t); o.frequency.exponentialRampToValueAtTime(27, t + 2.2);
    const og = this._gain(0); o.connect(og); og.connect(this.master);
    og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.4 * k, t + 0.12); og.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    o.start(t); o.stop(t + 2.7);
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
    // the crunch: panels and plastic giving, a few small breaks after the first
    for (let i = 1; i <= 3; i++) {
      const tt = t + 0.025 * i + Math.random() * 0.02;
      const sN = c.createBufferSource(); sN.buffer = this.noiseBuf;
      const fN = c.createBiquadFilter(); fN.type = 'bandpass'; fN.frequency.value = 1400 + Math.random() * 1800; fN.Q.value = 1.3;
      const gN = this._gain(0); sN.connect(fN); fN.connect(gN); gN.connect(this.master);
      this._env(gN, tt, 0.001, 0.035, 0.3 * k / i, 0, 0.02); sN.start(tt, Math.random()); sN.stop(tt + 0.1);
    }
    // a metallic ring for the guardrail
    for (const [fr, vol] of [[2200, 0.08], [3100, 0.05], [4700, 0.03]]) {
      const r = c.createOscillator(); r.type = 'sine'; r.frequency.value = fr * (0.95 + Math.random() * 0.1);
      const g3 = this._gain(0); r.connect(g3); g3.connect(this.master); this._env(g3, t, 0.002, 0.5 * k, vol * k, 0.05, 0.3); r.start(t); r.stop(t + 1);
    }
  }
  tick() { if (this.ready) this.chime([this._key(1), this._key(3)], this.ctx.currentTime, 0.05, 0.12, 0.12, 'sine'); }

  /** React to scoring events. */
  onEvent(e) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    switch (e.type) {
      case 'bank': {
        const up = [this._key(0), this._key(2), this._key(3), this._key(5), this._key(7)];
        const n = 2 + Math.min(3, e.tier + (e.chain > 1 ? 1 : 0));
        this.chime(up.slice(0, n), t, 0.07, 0.3, 0.16 + 0.03 * e.tier);
        break;
      }
      case 'boost': this.whoosh(0.7 + Math.min(1.6, e.value) * 0.5); break;
      case 'tier': this.chime([this._key(1), this._key(2), this._key(3)].slice(0, e.value + 1), t, 0.06, 0.2, 0.13); break;
      case 'switch': this.chime([this._key(0), this._key(3)], t, 0.06, 0.15, 0.12, 'square'); break;
      case 'clip': this.tick(); break;
      case 'crash': this.impact(12); { const [a] = this._tonic(-2); this.chime([a * 1.5, a], t, 0.12, 0.35, 0.14, 'sawtooth'); } break;
      case 'bump': this.impact(e.value); break;
      case 'sun': { const [a, , c2] = this._tonic(-1); this.chime([a, c2, a * 2], t, 0.16, 0.6, 0.1, 'sine'); break; }
    }
  }
}
