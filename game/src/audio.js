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
 *
 * In NEO TOKYO the city itself is heard under all of that (cityUpdate): the far traffic's roar breathing slowly, a car
 * on the next street, a horn now and then, an ambulance going by, the elevated train's rumble and the ta-tan of its
 * wheels over the rail joints, and a crossing's chirp for the blind as the car passes a signal. Each is placed where it
 * is: quieter, duller and wetter (a street's own reverb) the further off, and panned to its side.
 */
import { clamp, smoothstep } from './config.js?v=202609232326';

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

// NEO TOKYO's sounds (see cityUpdate): how loud each part is at its nearest, set against the music by measurement
// (work/city_audio_level.json), all of it well under the music and the engine
const CITY = { roar: 0.026, air: 0.01, pass: 0.056, horn: 0.09, siren: 0.035, train: 0.063, chirp: 0.05 };
// the train's axles, metres back from a car's front (two bogies of two), and the rail between joints: a car and its
// gap, so every joint under the train is struck in step and the street hears one rhythm, ga-tan ... go-ton
const AXLES = [2.15, 4.25, 15.25, 17.35], RAIL = 20;
// roughly normal (four uniforms), for the slow random walks; and the noise generators' step
const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.732;
const lcg = (s) => (Math.imul(s, 1664525) + 1013904223) >>> 0;
// the city's signals (city.js, signalMaterial) run a 22 s cycle on the city's clock: green 10 s, amber 3, red 9. The
// crossing by one sings while its walkers go: from just after the cars' red until the walkers' light starts to blink
const walking = (clock, ph) => { const u = ((clock + ph * 22) % 22 + 22) % 22; return u >= 14 && u < 19.5; };

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

  /** Which map: each has its own song (a new one starts from its first phrase), and the city its own sounds. */
  setMap(city) {
    if (this.city === !!city) return;
    this.city = !!city;
    Object.assign(this.music, { step: 0, phrase: 0, chords: null, tune: null });
    if (!this.city && this.cy) this._cityDrop();
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

  // ------------------------------------------------------------------ the city

  /**
   * NEO TOKYO's own sound, every frame of a run on the city map, heard from (x, z) looking along yaw (0 faces +z, and
   * it grows turning left): the city far off, a car on the next street, a horn now and then, an ambulance going by,
   * the elevated train when it runs near (world._train.pos, from citytrain.js), and the chirp of a crossing's signal
   * for the blind when one is near (the signals' poles are in the world's collision grid). tunnel 0..1: inside a bore
   * the city outside goes quiet and dull. Built at the first call; should the calls stop (the title), it fades away.
   */
  cityUpdate(dt, x, z, yaw, world, tunnel = 0) {
    if (!this.ready || !this.city || this._cityOff) return;
    // (a sound that fails is only a sound missed: it must never cost the game its frame; and a city that could not be
    // built is not tried again every frame)
    try { this._cityFrame(dt, x, z, yaw, world, tunnel); } catch (e) {
      if (!this.cy) this._cityOff = true;
      if (!this._cityWarned) { this._cityWarned = true; console.warn('city sound', e); }
    }
  }

  _cityFrame(dt, x, z, yaw, world, tunnel) {
    if (!this.cy) this._cityBuild();
    const C = this.cy, t = this.ctx.currentTime;
    C.x = x; C.z = z; C.yaw = yaw;
    C.rx = -Math.cos(yaw); C.rz = Math.sin(yaw);             // the listener's right: a thing over there pans right
    C.tun += (tunnel - C.tun) * Math.min(1, dt * 4);
    const shut = C.tun > 0.5;                                 // (inside a tunnel nothing new starts out there)
    // now and then: a car on the next street, a horn (once in a while another answering it), an ambulance
    if ((C.passIn -= dt) <= 0) { C.passIn = 2.5 + Math.random() * 8; if (!shut) this._passBy(); }
    if ((C.hornIn -= dt) <= 0) { C.hornIn = 6 + Math.random() * 14; if (!shut) { this._horn(); if (Math.random() < 0.12) C.hornIn = 0.5 + Math.random(); } }
    if ((C.sirenIn -= dt) <= 0) { C.sirenIn = shut ? 6 : 45 + Math.random() * 55; if (!shut) this._siren(); }
    // the far city breathes: slow random walks (each drawn back toward the middle) in its level and its colour
    const k1 = dt / 6, k2 = dt / 10, k3 = dt / 4;
    C.w1 += -C.w1 * k1 + Math.sqrt(2 * k1) * gauss();
    C.w2 += -C.w2 * k2 + Math.sqrt(2 * k2) * gauss();
    C.w3 += -C.w3 * k3 + Math.sqrt(2 * k3) * gauss();
    // the train: the point of it nearest, and each wheel over a joint as it happens (a moment ahead, exactly in time)
    const P = world && world._train ? world._train.pos : null;
    let tg = 0;
    if (P) {
      const dx = P.x - x, dz = P.z - z, d = Math.sqrt(dx * dx + dz * dz + 36);    // (its deck is 8 m up)
      tg = Math.pow(Math.min(1, 14 / d), 0.85) * smoothstep(150, 95, d);
      C.tD = d; C.tP = (dx * C.rx + dz * C.rz) / d;
      if (tg > 0.004 && C.od !== null && P.od > C.od && P.od - C.od < 6) {
        const v = P.speed || 14;
        for (let i = 0; i < 4; i++) {
          const o = AXLES[i], n = Math.floor((P.od - o) / RAIL);
          if (n > Math.floor((C.od - o) / RAIL)) this._clack(Math.max(t, t + 0.05 - (P.od - o - n * RAIL) / v), i);
        }
      }
      C.od = P.od;
    } else C.od = null;
    // the crossing: the nearest signal's pole, looked for a few times a second
    if ((C.sigIn -= dt) <= 0 && world && world.near) {
      C.sigIn = 0.25;
      const px = C.sx, pz = C.sz, had = C.sOn;
      C.sd2 = 47 * 47; C.sOn = false;
      world.near(x, z, 47, C.sigFn);
      if (C.sOn && (!had || C.sx !== px || C.sz !== pz)) this._signal();     // a new one: its own voice and rhythm
    }
    let cg = 0;
    if (C.sOn) {
      const dx = C.sx - x, dz = C.sz - z, d = Math.sqrt(dx * dx + dz * dz + 4);    // (its speaker is up the pole)
      cg = Math.min(1, 7 / d) * smoothstep(46, 30, d);
      C.cD = d; C.cP = (dx * C.rx + dz * C.rz) / d;
      // it sings in spells (while the walkers' light is green), each call queued a moment ahead: in step with the
      // signal's lamps when its record carries the phase they run on, otherwise in spells of its own
      if (cg > 0.003) {
        if (C.chirpAt < t) C.chirpAt = t + 0.05;
        const clock = C.sPh !== undefined && world && world.cityClock ? world.cityClock.value - t : null;
        while (C.chirpAt < t + 0.12) {
          if (clock !== null ? walking(clock + C.chirpAt, C.sPh) : (C.chirpAt + C.sigPh) % C.sigCycle < C.sigOn) this._chirp(C.chirpAt, C.chirpN++);
          C.chirpAt += C.sigStep * (0.99 + Math.random() * 0.02);
        }
      }
    }
    // the levels, twenty times a second
    if ((C.tick += dt) < 0.05) return;
    C.tick = 0;
    const rain = this._rainV || 0;
    // the whole city: up as the run starts, down and dull inside a tunnel; and should these calls stop, away
    const g = C.bus.gain;
    g.cancelScheduledValues(t + 0.3);
    g.setTargetAtTime(1 - 0.85 * C.tun, t, 0.4);
    g.setTargetAtTime(0, t + 0.6, 0.5);
    C.muff.frequency.setTargetAtTime(700 + 17000 * Math.pow(1 - C.tun, 3), t, 0.08);
    // the far roar and the wash over it (the rain's hiss covers some of both)
    C.loG.gain.setTargetAtTime(CITY.roar * Math.exp(0.2 * C.w1) * (1 - 0.3 * rain), t, 0.3);
    C.lo.frequency.setTargetAtTime(230 * Math.exp(0.16 * C.w2), t, 0.3);
    C.midG.gain.setTargetAtTime(CITY.air * Math.exp(0.28 * C.w3) * (1 - 0.55 * rain), t, 0.3);
    C.mid.frequency.setTargetAtTime(720 * Math.exp(0.14 * C.w2), t, 0.3);
    C.bed.playbackRate.setTargetAtTime(Math.exp(0.04 * C.w2), t, 0.5);     // (and so the loop never quite repeats)
    // the train, and the crossing's speaker, only while they can be heard
    if (tg > 0 || C.tOn) {
      C.tOn = tg > 0;
      C.tG.gain.setTargetAtTime(CITY.train * tg, t, 0.15);
      C.tLP.frequency.setTargetAtTime(350 + 5200 * Math.pow(Math.min(1, 14 / C.tD), 1.2), t, 0.1);
      if (C.tPan.pan) C.tPan.pan.setTargetAtTime(clamp(C.tP, -1, 1) * 0.85, t, 0.08);
    }
    if (cg > 0 || C.cOn) {
      C.cOn = cg > 0;
      C.cG.gain.setTargetAtTime(CITY.chirp * cg, t, 0.1);
      C.cLP.frequency.setTargetAtTime(1800 + 7000 * Math.min(1, 7 / C.cD), t, 0.1);
      if (C.cPan.pan) C.cPan.pan.setTargetAtTime(clamp(C.cP, -1, 1) * 0.85, t, 0.08);
    }
    // an ambulance going by turns with the listener (its way past is fixed when it sets out)
    const S = C.siren;
    if (S) {
      const u = t - S.t0;
      if (u > S.D + 0.3) C.siren = null;
      else if (u > 0 && S.pan.pan) S.pan.pan.setTargetAtTime(Math.sin(S.a0 + S.dir * Math.atan2(S.v * (u - S.tc), S.d0) + yaw - S.yaw0) * 0.9, t, 0.06);
    }
  }

  /** The city's standing nodes: its bus and a street's reverb, the far roar, the train's voice, the crossing's. */
  _cityBuild() {
    const c = this.ctx, t = c.currentTime;
    const C = {
      x: 0, z: 0, yaw: 0, rx: -1, rz: 0, tun: 0, tick: 1, w1: 0, w2: 0, w3: 0, srcs: [],
      passIn: 1 + Math.random() * 3, hornIn: 4 + Math.random() * 8, sirenIn: 25 + Math.random() * 35, siren: null,
      od: null, tD: 1e3, tP: 0, tOn: false,
      sigIn: 0, sOn: false, sx: 0, sz: 0, sPh: undefined, sd2: 0, cD: 1e3, cP: 0, cOn: false,
      sigKind: 0, sigF: 2600, sigStep: 0.42, sigCycle: 10, sigOn: 6.5, sigPh: 0, chirpAt: 0, chirpN: 0,
    };
    // everything the city makes goes through one bus: faded in and out as a whole, muffled inside a tunnel
    C.bus = this._gain(0);
    C.muff = c.createBiquadFilter(); C.muff.type = 'lowpass'; C.muff.frequency.value = 18000; C.muff.Q.value = 0.5;
    C.bus.connect(C.muff); C.muff.connect(this.master);
    // a street's reverb: early echoes off the fronts, then a short dark tail
    if (!this.streetIR) this.streetIR = this._streetImpulse(1.8);
    C.verb = c.createConvolver(); C.verb.buffer = this.streetIR;
    const ret = this._gain(0.8); C.verb.connect(ret); ret.connect(C.bus);
    // the far city: brown noise (each side its own) in two bands, the traffic's low roar and a faint wash above it
    if (!this.brownBuf) this.brownBuf = this._brown(10);
    const bed = C.bed = c.createBufferSource(); bed.buffer = this.brownBuf; bed.loop = true; bed.start(t, Math.random() * 10);
    C.lo = c.createBiquadFilter(); C.lo.type = 'lowpass'; C.lo.frequency.value = 230; C.lo.Q.value = 0.4;
    C.loG = this._gain(0); bed.connect(C.lo); C.lo.connect(C.loG); C.loG.connect(C.bus);
    C.mid = c.createBiquadFilter(); C.mid.type = 'bandpass'; C.mid.frequency.value = 720; C.mid.Q.value = 0.55;
    C.midG = this._gain(0); bed.connect(C.mid); C.mid.connect(C.midG); C.midG.connect(C.bus);
    // the train: the viaduct's rumble (the brown noise as one point), the wheels' roll, and the joints' clacks
    // (_clack), all through one distance: its level, a low-pass that closes as it goes off, and its side
    const tr = c.createBufferSource(); tr.buffer = this.brownBuf; tr.loop = true; tr.start(t, Math.random() * 10);
    const tLow = c.createBiquadFilter(); tLow.type = 'lowpass'; tLow.frequency.value = 170; tLow.Q.value = 0.9;
    tLow.channelCount = 1; tLow.channelCountMode = 'explicit';
    const rumG = this._gain(0.7);
    const rn = c.createBufferSource(); rn.buffer = this.noiseBuf; rn.loop = true; rn.start(t, Math.random() * 1.9);
    const tRoll = c.createBiquadFilter(); tRoll.type = 'bandpass'; tRoll.frequency.value = 950; tRoll.Q.value = 0.8;
    const rollG = this._gain(0.22);
    C.tClack = this._gain(1); C.tG = this._gain(0);
    C.tLP = c.createBiquadFilter(); C.tLP.type = 'lowpass'; C.tLP.frequency.value = 1500; C.tLP.Q.value = 0.5;
    C.tPan = this._pan(); const tSend = this._gain(0.35);
    tr.connect(tLow); tLow.connect(rumG); rumG.connect(C.tG); rn.connect(tRoll); tRoll.connect(rollG); rollG.connect(C.tG); C.tClack.connect(C.tG);
    C.tG.connect(C.tLP); C.tLP.connect(C.tPan); C.tPan.connect(C.bus); C.tLP.connect(tSend); tSend.connect(C.verb);
    // the crossing's speaker on its pole (a small speaker's tone: a sine with a little of its second and third)
    C.cG = this._gain(0);
    C.cLP = c.createBiquadFilter(); C.cLP.type = 'lowpass'; C.cLP.frequency.value = 6000; C.cLP.Q.value = 0.5;
    C.cPan = this._pan(); const cSend = this._gain(0.25);
    C.cG.connect(C.cLP); C.cLP.connect(C.cPan); C.cPan.connect(C.bus); C.cLP.connect(cSend); cSend.connect(C.verb);
    C.wave = c.createPeriodicWave(new Float32Array([0, 0, 0, 0]), new Float32Array([0, 1, 0.1, 0.04]));
    C.srcs.push(bed, tr, rn);
    // (from the collision grid's records near the listener, the nearest signal's pole; the shopping streets' arches
    // stand in the grid as signals too, a little stouter, and have no crossing)
    C.sigFn = (rec) => {
      if (rec.name !== 'signal' || rec.r > 0.19) return;
      const d2 = (rec.x - C.x) * (rec.x - C.x) + (rec.z - C.z) * (rec.z - C.z);
      if (d2 < C.sd2) { C.sd2 = d2; C.sx = rec.x; C.sz = rec.z; C.sPh = rec.phase; C.sOn = true; }
    };
    this.cy = C;
  }

  /** Leaving the city: its sounds fade out and its standing nodes stop (whatever is still ringing dies away by itself). */
  _cityDrop() {
    const C = this.cy, t = this.ctx.currentTime;
    this.cy = null;
    C.bus.gain.cancelScheduledValues(t); C.bus.gain.setTargetAtTime(0, t, 0.1);
    setTimeout(() => { for (const s of C.srcs) { try { s.stop(); } catch {} } C.bus.disconnect(); }, 800);
  }

  _pan() { const c = this.ctx; return c.createStereoPanner ? c.createStereoPanner() : this._gain(1); }

  /** Brown noise for the city's roar, each side its own and looping without a seam; nothing high in it is kept. */
  _brown(sec) {
    const sr = 22050, n = Math.floor(sr * sec), F = Math.floor(sr * 0.5), b = this.ctx.createBuffer(2, n, sr);
    const a = Math.exp(-2 * Math.PI * 50 / sr), a1 = 1 - a, k = Math.exp(-2 * Math.PI * 35 / sr);
    const tmp = new Float32Array(n + F);
    for (let ch = 0; ch < 2; ch++) {
      // white noise through a gentle low-pass (the brown slope) and a DC blocker (no rumble below hearing); one flat
      // loop, as it runs on the first city frame
      let s = ch ? 4242 : 777, lo = 0, hp = 0, prev = 0, e = 0;
      for (let i = 0; i < n + F; i++) {
        s = lcg(s); lo = lo * a + (s / 2147483648 - 1) * a1;
        hp = k * (hp + lo - prev); prev = lo; tmp[i] = hp; e += hp * hp;
      }
      const g = 0.3 / Math.sqrt(e / (n + F) || 1), d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = tmp[i] * g;
      // the noise that would have followed the end fades in over the start, so the loop has no seam
      for (let i = 0; i < F; i++) { const u = i / F; d[i] = d[i] * Math.sqrt(u) + tmp[n + i] * g * Math.sqrt(1 - u); }
    }
    return b;
  }

  /**
   * A street's reverb for the city's sounds: a handful of early echoes off the fronts across the way and along it (each a
   * short smear of dull noise, as off rough walls), then a short tail, the highs dying first. Each side its own.
   */
  _streetImpulse(sec) {
    const c = this.ctx, sr = c.sampleRate, n = Math.floor(sr * sec), b = c.createBuffer(2, n, sr);
    const kLo = Math.exp(-3.6 / sr), kHi = Math.exp(-8 / sr), on = Math.floor(sr * 0.06), len = Math.floor(sr * 0.005);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let s = ch ? 313 : 1031, lo = 0, eLo = 0.63, eHi = 0.16;
      for (let i = 0; i < n; i++) {
        s = lcg(s); const w = s / 2147483648 - 1;
        lo += (w - lo) * 0.2;
        d[i] = (lo * eLo + (w - lo) * eHi) * (i < on ? i / on : 1);
        eLo *= kLo; eHi *= kHi;
      }
      for (let k = 0; k < 7; k++) {
        s = lcg(s); const at = Math.floor(sr * (0.012 + (s / 4294967296) * 0.1));
        s = lcg(s); const amp = (2.4 - k * 0.22) * (s < 2147483648 ? -1 : 1);
        let e = 0, dec = 1;
        const kd = Math.exp(-1 / (len * 0.3));
        for (let i = 0; i < len && at + i < n; i++) { s = lcg(s); e += (s / 2147483648 - 1 - e) * 0.3; d[at + i] += amp * e * dec; dec *= kd; }
      }
    }
    return b;
  }

  /** A signal's own voice and rhythm, the same each time it is passed (from where its pole stands). */
  _signal() {
    const C = this.cy;
    const h = (k) => { const v = Math.sin(C.sx * 12.9898 + C.sz * 78.233 + k * 37.719) * 43758.5453; return v - Math.floor(v); };
    C.sigKind = h(1) < 0.6 ? 0 : 1;                          // a chick's piyo-piyo, or the cuckoo's kak-koo
    C.sigF = C.sigKind ? 980 + 120 * h(2) : 2500 + 450 * h(2);
    C.sigStep = C.sigKind ? 1.1 : 0.42;
    C.sigCycle = 8 + 5 * h(3); C.sigOn = C.sigCycle * (0.62 + 0.12 * h(4)); C.sigPh = C.sigCycle * h(5);
    C.chirpAt = 0; C.chirpN = 0;
  }

  /**
   * One call of a crossing's signal at time tc: a chick's piyo (a quick rise and a fall, every other one from the far
   * side's speaker, a little lower), or the cuckoo's kak-koo (a short note and a longer one a third below).
   */
  _chirp(tc, n) {
    const c = this.ctx, C = this.cy;
    const notes = C.sigKind ? [[0, 1, 0.075], [0.19, 0.82, 0.26]] : [[0, n & 1 ? 0.94 : 1, 0.1]];
    for (const [at, mul, len] of notes) {
      const t = tc + at, f = C.sigF * mul;
      const o = c.createOscillator(); o.setPeriodicWave(C.wave);
      if (C.sigKind) { o.frequency.setValueAtTime(f * 1.02, t); o.frequency.exponentialRampToValueAtTime(f * 0.97, t + len); }
      else { o.frequency.setValueAtTime(f * 0.78, t); o.frequency.exponentialRampToValueAtTime(f * 1.1, t + 0.02); o.frequency.exponentialRampToValueAtTime(f * 0.8, t + len); }
      const g = this._gain(0); o.connect(g); g.connect(C.cG);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.006); g.gain.setValueAtTime(0.5, t + len - 0.03); g.gain.linearRampToValueAtTime(0, t + len);
      o.start(t); o.stop(t + len + 0.02);
      o.onended = () => g.disconnect();
    }
  }

  /** One wheel over a rail joint at time tc: the clunk of the steel, and a thump down through the viaduct. */
  _clack(tc, i) {
    const c = this.ctx, C = this.cy;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const hi = c.createBiquadFilter(); hi.type = 'bandpass'; hi.frequency.value = 900 + Math.random() * 700; hi.Q.value = 0.8;
    const lo = c.createBiquadFilter(); lo.type = 'lowpass'; lo.frequency.value = 240 + Math.random() * 90; lo.Q.value = 1.2;
    const gh = this._gain(0), gl = this._gain(0);
    s.connect(hi); hi.connect(gh); gh.connect(C.tClack); s.connect(lo); lo.connect(gl); gl.connect(C.tClack);
    // (a bogie's second wheel comes down a little harder than its first: ta-TAN)
    const k = (i & 1 ? 1 : 0.75) * (0.75 + Math.random() * 0.5);
    gh.gain.setValueAtTime(0, tc); gh.gain.linearRampToValueAtTime(2.6 * k, tc + 0.0015); gh.gain.setTargetAtTime(0, tc + 0.0015, 0.012);
    gl.gain.setValueAtTime(0, tc); gl.gain.linearRampToValueAtTime(10 * k, tc + 0.002); gl.gain.setTargetAtTime(0, tc + 0.002, 0.03);
    s.start(tc, Math.random() * 1.8); s.stop(tc + 0.2);
    s.onended = () => { gh.disconnect(); gl.disconnect(); };
  }

  /**
   * A horn somewhere off in the streets: a tap, two, a longer one, or a tap and then leaning on it; a kei car's one high
   * horn, a car's pair (a third apart) or a truck's low pair, each a buzzing voice through the horn's own band, dulled
   * and quietened by how far off it is, with the street's echo.
   */
  _horn() {
    const c = this.ctx, C = this.cy, t0 = c.currentTime + 0.03, r = Math.random();
    const kind = r < 0.35 ? 0 : r < 0.82 ? 1 : 2;
    const f = kind === 0 ? 420 + Math.random() * 100 : kind === 1 ? 350 + Math.random() * 70 : 200 + Math.random() * 60;
    const f2 = kind === 0 ? f * 1.003 : f * (1.19 + Math.random() * 0.07);
    const d = 45 + 255 * Math.sqrt(Math.random()), near = 45 / d;          // metres off (more streets far than near)
    const q = Math.random(), sc = 0.85 + Math.random() * 0.3;
    // [start, length] of each note
    const B = q < 0.34 ? [0, 0.12] : q < 0.72 ? [0, 0.1, 0.19, 0.12] : q < 0.92 ? [0, 0.34 + Math.random() * 0.3] : [0, 0.11, 0.21, 0.6 + Math.random() * 0.6];
    const att = kind === 2 ? 0.035 : 0.012;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(1900, f * 3.1); bp.Q.value = 0.8;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700 + 3600 * near * near; lp.Q.value = 0.5;
    const env = this._gain(0), pan = this._pan(), send = this._gain(0.35 + 0.45 * (1 - near));
    bp.connect(lp); lp.connect(env); env.connect(pan); pan.connect(C.bus); env.connect(send); send.connect(C.verb);
    if (pan.pan) pan.pan.value = (Math.random() * 2 - 1) * 0.9;
    const pk = CITY.horn * Math.pow(near, 0.9) * (0.6 + 0.4 * Math.random());
    const oscs = [];
    for (const [type, fv, v, det] of [['sawtooth', f, 0.6, 3], ['square', f2, 0.4, -4]]) {
      const o = c.createOscillator(); o.type = type; o.detune.value = det;
      const g = this._gain(v); o.connect(g); g.connect(bp);
      // each note starts a little flat, the diaphragm coming up to speed
      for (let i = 0; i < B.length; i += 2) { const tb = t0 + B[i] * sc; o.frequency.setValueAtTime(fv * 0.94, tb); o.frequency.exponentialRampToValueAtTime(fv, tb + 0.04); }
      oscs.push(o);
    }
    // the diaphragm's rattle: a burst of noise through the horn's band as each note catches, a little under it after
    const nz = c.createBufferSource(); nz.buffer = this.noiseBuf; nz.loop = true;
    const ng = this._gain(0); nz.connect(ng); ng.connect(bp);
    let end = t0;
    for (let i = 0; i < B.length; i += 2) {
      const tb = t0 + B[i] * sc, te = tb + B[i + 1] * sc;
      env.gain.setValueAtTime(0, tb); env.gain.linearRampToValueAtTime(pk, tb + att);
      env.gain.setTargetAtTime(pk * 0.88, tb + att, 0.25);
      env.gain.setTargetAtTime(0, te, 0.016);
      ng.gain.setValueAtTime(0, tb); ng.gain.linearRampToValueAtTime(0.5, tb + 0.004); ng.gain.setTargetAtTime(0.06, tb + 0.004, 0.012); ng.gain.setTargetAtTime(0, te, 0.01);
      end = te;
    }
    for (const o of oscs) { o.start(t0); o.stop(end + 0.15); }
    nz.start(t0, Math.random() * 1.5); nz.stop(end + 0.1);
    oscs[0].onended = () => { env.disconnect(); send.disconnect(); };
  }

  /**
   * An ambulance on another street: pee-po, pee-po (960 and 770 Hz, 0.65 s each), coming nearer then going away over
   * several seconds: louder and brighter as it nears, its pitch falling as it passes (the doppler, a few per cent), a
   * facade's echo combing with it as the path changes, and crossing from one side to the other.
   */
  _siren() {
    const c = this.ctx, C = this.cy, t0 = c.currentTime + 0.05;
    const D = 6.5 + Math.random() * 2.5, v = 11 + Math.random() * 6, d0 = 22 + Math.random() * 40, tc = D * (0.42 + Math.random() * 0.16);
    const S = C.siren = { t0, D, v, d0, tc, a0: (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.7, dir: Math.random() < 0.5 ? 1 : -1, yaw0: C.yaw, pan: this._pan() };
    const oA = c.createOscillator(), oB = c.createOscillator(); oA.type = 'square'; oB.type = 'triangle';
    const gA = this._gain(0.3), gB = this._gain(0.7);
    const spk = c.createBiquadFilter(); spk.type = 'lowpass'; spk.frequency.value = 2400; spk.Q.value = 0.8;   // its horn speaker
    const echo = c.createDelay(0.05), eg = this._gain(0.45);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5;
    const env = this._gain(0), send = this._gain(0);
    oA.connect(gA); oB.connect(gB); gA.connect(spk); gB.connect(spk);
    spk.connect(lp); spk.connect(echo); echo.connect(eg); eg.connect(lp);
    lp.connect(env); env.connect(S.pan); S.pan.connect(C.bus); lp.connect(send); send.connect(C.verb);
    // pee and po, starting part way through one (each change a few milliseconds' glide, not a kink)
    let hi = Math.random() < 0.5;
    for (let tt = t0 - Math.random() * 0.6; tt < t0 + D; tt += 0.65, hi = !hi) {
      const f = hi ? 960 : 770;
      if (tt <= t0) { oA.frequency.setValueAtTime(f, t0); oB.frequency.setValueAtTime(f, t0); } else { oA.frequency.setTargetAtTime(f, tt, 0.004); oB.frequency.setTargetAtTime(f, tt, 0.004); }
    }
    // the way past, as curves: level (and the reverb's, which falls off slower), brightness, doppler, the echo's delay
    const N = 64, L = new Float32Array(N), R = new Float32Array(N), F = new Float32Array(N), DA = new Float32Array(N), DB = new Float32Array(N), E = new Float32Array(N);
    const pk = CITY.siren * (0.7 + 0.3 * Math.random());
    for (let i = 0; i < N; i++) {
      const u = D * i / (N - 1), x = v * (u - tc), r = Math.hypot(x, d0);
      // (round a corner it goes behind the buildings: fainter still than its distance alone)
      const k = Math.min(1, 20 / r) / Math.sqrt(1 + (x / 40) * (x / 40)), win = Math.max(0, Math.min(1, u / 1.2, (D - u) / 1.6));
      L[i] = pk * k * win; R[i] = 0.45 * Math.sqrt(pk * L[i]);
      F[i] = 600 + 5200 * Math.pow(k, 1.5);
      DA[i] = 1200 * Math.log2(343 / (343 + v * x / r)); DB[i] = DA[i] + 7;
      E[i] = 0.004 + 0.012 * (1 - d0 / r);
    }
    env.gain.setValueCurveAtTime(L, t0, D); send.gain.setValueCurveAtTime(R, t0, D);
    lp.frequency.setValueCurveAtTime(F, t0, D); echo.delayTime.setValueCurveAtTime(E, t0, D);
    oA.detune.setValueCurveAtTime(DA, t0, D); oB.detune.setValueCurveAtTime(DB, t0, D);
    if (S.pan.pan) S.pan.pan.value = Math.sin(S.a0 + S.dir * Math.atan2(-v * tc, d0)) * 0.9;
    oA.start(t0); oB.start(t0); oA.stop(t0 + D + 0.05); oB.stop(t0 + D + 0.05);
    oA.onended = () => { env.disconnect(); send.disconnect(); S.pan.disconnect(); };
  }

  /** A car going by on the next street: tyre roar and a little engine rising and falling, from one side to the other. */
  _passBy() {
    const c = this.ctx, C = this.cy, t0 = c.currentTime + 0.05;
    const D = 4 + Math.random() * 4, v = 9 + Math.random() * 10, d0 = 22 + Math.random() * 40, tc = D * (0.4 + Math.random() * 0.2);
    const heavy = Math.random() < 0.2;                        // a truck or a bus: lower, and more engine
    // one broad roar, not bands: the engine's low end (a shelf) and the hump the tread sings in, dulled by distance
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const eng = c.createBiquadFilter(); eng.type = 'lowshelf'; eng.frequency.value = heavy ? 180 : 240; eng.gain.value = heavy ? 13 : 9;
    const tyre = c.createBiquadFilter(); tyre.type = 'peaking'; tyre.frequency.value = heavy ? 600 : 800 + Math.random() * 350; tyre.Q.value = 0.8; tyre.gain.value = 5;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5;
    const env = this._gain(0), pan = this._pan();
    s.connect(eng); eng.connect(tyre); tyre.connect(lp); lp.connect(env); env.connect(pan); pan.connect(C.bus);
    const N = 32, G = new Float32Array(N), F = new Float32Array(N), P = new Float32Array(N);
    const a0 = (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.8, dir = Math.random() < 0.5 ? 1 : -1;
    const pk = CITY.pass * (0.6 + 0.4 * Math.random()) * (heavy ? 1.3 : 1);
    for (let i = 0; i < N; i++) {
      // (heard round the buildings: it swells out of the roar and sinks back into it)
      const u = D * i / (N - 1), x = v * (u - tc), r = Math.hypot(x, d0);
      const k = Math.min(1, 16 / r) / Math.sqrt(1 + (x / 30) * (x / 30)), win = Math.pow(Math.max(0, Math.sin(Math.PI * i / (N - 1))), 1.2);
      G[i] = pk * k * win; F[i] = 450 + 3800 * Math.pow(k, 1.5); P[i] = Math.sin(a0 + dir * Math.atan2(x, d0)) * 0.85;
    }
    env.gain.setValueCurveAtTime(G, t0, D); lp.frequency.setValueCurveAtTime(F, t0, D);
    if (pan.pan) pan.pan.setValueCurveAtTime(P, t0, D);
    s.start(t0, Math.random() * 1.9); s.stop(t0 + D + 0.05);
    s.onended = () => { env.disconnect(); pan.disconnect(); };
  }
}
