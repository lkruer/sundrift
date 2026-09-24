/**
 * The HUD, on the TV.
 *
 * Everything a run shows (the score, the combo and the distance, the clock, the dash, the drift count and its cash-in,
 * the callouts, the angle meter, the off-road countdown, the first-run hint, the two buttons, and on a phone where the
 * thumbs go) is drawn by script into a canvas the size of the screen, and the tube pass (post.js) lays it over the
 * picture before the glass does anything to it: so it bends with the screen's curve, darkens into the rim, takes the
 * scanlines, the colour steps and the grille, and glows a little the way a CRT's phosphor bleeds. It is the set's own
 * display rather than a sticker on the glass. The type is the 90s dash's and the arcade's (amber seven-segment digits,
 * the title's racing italic with a hard outline) drawn at the screen's own resolution: the tube makes it retro, not
 * big pixels.
 *
 * Layout is in units of about 2 CSS px (a desktop is 360 units tall, a phone 195 wide), so every screen gets the same
 * proportions. Every string with its outline is drawn once and kept as a sprite, and the canvas is redrawn (and sent
 * to the GPU) only when something on it has changed or is moving, thirty times a second at most.
 *
 * The rewards are as they were: a banked drift flashes where the live count was and flies up into the score, which
 * pulses as it lands and only then rolls up; a bigger drift gets its tier called out; the multiplier, the tier and the
 * combo punch as they climb; past the angle that scores the most the angle meter burns pink; a banked drift's minutes
 * fly off the clock it moved. On a phone that can (Android), a short buzz goes with the big moments.
 */
import * as THREE from 'three';
import { SCORE, clamp, damp } from './config.js?v=202609242150';

const $ = (id) => document.getElementById(id);
// the slide angle past which a drift scores the most: scoring.js's angle factor tops out at 1.5 x 0.55 rad, 47 degrees
const MAX_ANGLE = 47;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- the type

const MONO = '"Share Tech Mono", ui-monospace, Consolas, monospace';
const ARC = '"Racing Sans One", Rajdhani, sans-serif';
const JPF = '"Dela Gothic One", "Hiragino Sans", "Yu Gothic", sans-serif';
/** A face: family, size in units, italic, letter spacing in units, weight. */
const face = (fam, sz, it = false, ls = 0, wt = 400) => ({ fam, sz, it, ls, wt, key: `${it ? 'i' : ''}${wt}|${sz}|${ls}|${fam}` });
const fontAt = (f, k) => `${f.it ? 'italic ' : ''}${f.wt} ${(f.sz * k).toFixed(2)}px ${f.fam}`;

// the sizes, in units: a phone (compact) and a desktop (roomy)
const SIZES = {
  compact: {
    lab: face(MONO, 4.6, false, 1.4), labS: face(MONO, 4.2, false, 0.6), num: face(MONO, 5.2, false, 0.3),
    sc: 11, cl: 8.5, ds: 6.5, spd: 12, gear: 8.5,
    combo: face(ARC, 12.5, true), x: face(ARC, 8, true),
    pts: face(ARC, 15, true), mult: face(ARC, 9, true), tier: face(ARC, 8, true, 0.8),
    toast: face(ARC, 9.5, true, 0.6), toastBig: face(ARC, 12.5, true, 0.6), sub: face(ARC, 6, true, 1),
    smash: face(ARC, 11.5, true), smashSub: face(ARC, 6.5, true, 0.3), deg: face(ARC, 8, true),
    coach: face(MONO, 5.6, false, 0.6), jp: face(JPF, 8), coLine: face(MONO, 5, false, 1.2), coSub: face(MONO, 4.4, false, 0.8),
    ch: face(MONO, 8.5, false, 0.6), chLab: face(MONO, 4.6, false, 0.9), co: 9,
  },
  roomy: {
    lab: face(MONO, 5, false, 2), labS: face(MONO, 4.5, false, 0.6), num: face(MONO, 6, false, 0.3),
    sc: 17, cl: 11, ds: 8, spd: 17, gear: 8.5,
    combo: face(ARC, 17, true), x: face(ARC, 9, true),
    pts: face(ARC, 24, true), mult: face(ARC, 14, true), tier: face(ARC, 11, true, 1.1),
    toast: face(ARC, 14, true, 1), toastBig: face(ARC, 20, true, 1.4), sub: face(ARC, 7, true, 1.5),
    smash: face(ARC, 19, true), smashSub: face(ARC, 9.5, true, 0.4), deg: face(ARC, 10, true),
    coach: face(MONO, 6.5, false, 0.9), jp: face(JPF, 9.5), coLine: face(MONO, 5.5, false, 1.5), coSub: face(MONO, 4.5, false, 0.9),
    ch: face(MONO, 10, false, 1), chLab: face(MONO, 5, false, 1.2), co: 10,
  },
};

const C = {
  amber: '#ffb347', gold: '#ffd23f', orange: '#ff8a2a', pink: '#ff5fa0', rose: '#ff9ccb', cyan: '#5ad1ff', ice: '#c9f1ff',
  teal: '#8ff5e6', mint: '#9ff0b8', red: '#ff4a3a', ink: '#f6efe2', dim: '#a79f95', olc: 'rgba(18,8,28,0.96)', green: '#7dff8a',
  panel: 'rgba(12,10,18,0.74)', edge: 'rgba(255,179,71,0.3)', ghost: 'rgba(255,179,71,0.2)',
};
// the callouts' colours and glows, as the old page's (a class per kind)
const TOAST = { '': [C.gold, 'rgba(255,138,42,0.5)'], good: ['#7ff0e0', 'rgba(111,227,214,0.5)'], bad: ['#ff5a48', 'rgba(255,59,48,0.55)'],
  calm: ['#ffd9e8', 'rgba(255,127,174,0.45)'], t1: ['#8ff5e6', 'rgba(111,227,214,0.5)'], t2: ['#ffd23f', 'rgba(255,138,42,0.5)'],
  t3: ['#ff5fa0', 'rgba(255,79,154,0.6)'], clip: ['#9ff0b8', 'rgba(159,240,184,0.5)'] };
const TIER = ['', '#8ff5e6', '#ffd23f', '#ff5fa0'];
// (the callouts are drawn in faces without a middle dot or a times sign in every browser's fallback)
const clean = (s) => String(s).replace(/×/g, 'x').replace(/—/g, '-');

// the seven segments of a digit cell 12 x 22 (bars 2.3 thick, gaps 0.45), as the old dash's
const SEGS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '', R: 'eg', N: 'ceg' };
const SEG_PATHS = (() => {
  const w = 12, h = 22, t = 2.3, g = 0.45, L = t / 2, R = w - t / 2, T = t / 2, M = h / 2, B = h - t / 2;
  const H = (x0, x1, y) => [[x0, y], [x0 + t / 2, y - t / 2], [x1 - t / 2, y - t / 2], [x1, y], [x1 - t / 2, y + t / 2], [x0 + t / 2, y + t / 2]];
  const V = (x, y0, y1) => [[x, y0], [x + t / 2, y0 + t / 2], [x + t / 2, y1 - t / 2], [x, y1], [x - t / 2, y1 - t / 2], [x - t / 2, y0 + t / 2]];
  const poly = { a: H(L + g, R - g, T), g: H(L + g, R - g, M), d: H(L + g, R - g, B), f: V(L, T + g, M - g), b: V(R, T + g, M - g), e: V(L, M + g, B - g), c: V(R, M + g, B - g) };
  const out = {};
  if (typeof Path2D === 'undefined') return out;
  for (const k in poly) { const p = new Path2D(); poly[k].forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); out[k] = p; }
  return out;
})();
const SKEW = Math.tan(7 * Math.PI / 180);
// the most pixels the OSD's canvas may have: a phone half a million (1.2 canvas px to its CSS px: sharp, and sent to
// the GPU thirty times a second without costing a phone its frame), a desktop 1.2 million (1280 x 720 at full size)
const HUD_PIXELS = { phone: 0.5e6, desktop: 1.2e6 };

const outBack = (p) => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
/** A punch: s0 at the start, settling on 1 with a little overshoot. */
const pop = (p, s0) => 1 + (s0 - 1) * (1 - outBack(clamp(p, 0, 1)));

export class Hud {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 4; this.canvas.height = 4;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    // (canvas pixels are premultiplied: kept so, the edges of the type filter cleanly over the picture)
    this.texture.premultiplyAlpha = true;
    this.mc = document.createElement('canvas').getContext('2d');       // for measuring
    this.cache = new Map(); this.fmc = new Map();
    this.U = null; this.input = null; this.courseOut = null; this.page = null;
    this.tube = { curve: 0.022, edge: 0.055, zoom: 1 };
    this.vw = 1; this.vh = 1; this.W = 4; this.H = 4; this.kx = 1; this.ky = 1; this.pr = 1; this.s = 1;
    this.el = { hud: $('hud'), perf: $('perf'), btns: $('hbtns'), mute: $('mute'), pauseb: $('pauseb'), pause: $('pause') };
    this.visible = false; this.pageOn = false; this.warming = false; this.dirty = true; this.sig = '';
    this.shown = 0; this.rpm = 900; this.clipT = 0; this.hitFlash = 0; this.vignette = 0;
    this.perfOn = new URLSearchParams(location.search).has('perf') || new URLSearchParams(location.search).has('prof');
    if (this.perfOn && this.el.perf) this.el.perf.classList.add('on');
    // the callout showing ({ text, cls, big, sub, prio, t0 }), the one leaving, and the ones waiting their turn
    this.cur = null; this.prev = null; this.queue = [];
    this.anims = new Map();
    this.holdScore = 0;                  // the score's roll waits for the banked points to fly in
    this.bank = null; this.smashS = null; this.clockAddS = null; this.tv = null;
    this.canBuzz = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    this._buzzT = 0;
    try { this.coached = localStorage.getItem('sundrift.drifted') === '1'; } catch { this.coached = false; }
    this.run = { t: 0, smashN: 0, smashLast: 0, newBest: false, best0: 0 };
    this.scoring = null;
    this.v = { score: 0, combo: 0, chain: 0, mph: 0, gear: 'N', rpm: 900, leds: 0, boosting: false, drifting: false, clip: false,
               slide: false, deg: 0, side: 1, hot: false, hh: 18, mm: 0, day: true, dist: 0, pts: 0, mult: 1, tier: 0, active: false, colon: true };
    this.driftA = 0; this.angleA = 0; this.coachA = 0; this.coY = 0;
    // the run card on the pause screen is filled in the moment the pause opens (main.js adds the class)
    if (this.el.pause && typeof MutationObserver !== 'undefined') {
      new MutationObserver(() => { if (this.el.pause.classList.contains('on')) this.fillCard(); }).observe(this.el.pause, { attributes: true, attributeFilter: ['class'] });
    }
    this._safeProbe();
    this._loadFonts();
  }

  /** The tube pass's uniforms (the OSD is drawn there), the input (for the thumbs' marks) and the glass's curve. */
  attach(uniforms, input, tube) {
    this.U = uniforms; this.input = input;
    if (tube) this.tube = { zoom: 1, ...tube };
    if (uniforms) { uniforms.tHud.value = this.texture; this._on(); }
  }

  _on() { if (this.U) this.U.uHudOn.value = this.visible || this.pageOn ? 1 : 0; }

  // ---------------------------------------------------------------- the screen

  /** The phone's notch and home bar, as CSS reports them. */
  _safeProbe() {
    const p = document.createElement('div');
    p.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    document.body.appendChild(p);
    this._probe = p;
  }

  _safe() {
    const cs = this._probe ? getComputedStyle(this._probe) : null;
    const n = (v) => (cs ? parseFloat(cs[v]) || 0 : 0);
    return { t: n('paddingTop'), r: n('paddingRight'), b: n('paddingBottom'), l: n('paddingLeft') };
  }

  /**
   * The layout's units: about 2 CSS px (a desktop 360 units tall, 3 CSS px at 1080; a phone 2 CSS px either way up). The
   * canvas itself is drawn at the screen's drawing resolution (pr, the renderer's pixel ratio), so the type is sharp.
   */
  resize(vw, vh, pr = 1) {
    this.vw = Math.max(1, vw); this.vh = Math.max(1, vh); this.pr = pr;
    const k = Math.max(2, Math.round(Math.min(this.vw / 195, this.vh / 360)));
    this.W = Math.ceil(this.vw / k); this.H = Math.ceil(this.vh / k);
    this.kx = this.vw / this.W; this.ky = this.vh / this.H;
    // canvas px per unit: the screen's own resolution, within a budget of pixels (the canvas goes to the GPU up to thirty
    // times a second while a run is on)
    const budget = this.W < 300 || this.H < 250 ? HUD_PIXELS.phone : HUD_PIXELS.desktop;
    this.s = Math.min(this.kx * pr, Math.sqrt(budget / (this.W * this.H)));
    const cw = Math.round(this.W * this.s), ch = Math.round(this.H * this.s);
    // (a canvas of a new size needs a new texture: three keeps the one it made at the old size and only writes into it)
    if (cw !== this.canvas.width || ch !== this.canvas.height) { this.canvas.width = cw; this.canvas.height = ch; this.texture.dispose(); }
    if (this.U) { this.U.uHudSize.value.set(this.canvas.width, this.canvas.height); this.U.uHudScale.value = 1; }
    this.cache.clear();
    this.touch = document.body.classList.contains('touch');
    this._layout();
    if (this.page) this.page.dirty = true;
    this.dirty = true; this.sig = '';
  }

  /** Where a point on the screen (CSS px) has to be drawn on the OSD to be seen there, through the tube's curve (post.js). */
  _toTex(sx, sy) {
    const u = sx / this.vw, v = 1 - sy / this.vh, cx = u * 2 - 1, cy = v * 2 - 1, r2 = (cx * cx + cy * cy) * 0.5;
    const kk = this.tube.curve * r2 + this.tube.edge * r2 * r2, z = this.tube.zoom;
    return [(0.5 + (u - 0.5 + cx * kk) * z) * this.W, (1 - (0.5 + (v - 0.5 + cy * kk) * z)) * this.H];
  }

  /** Where a point of the OSD (units) is seen on the screen (CSS px): the curve undone, a few steps of fixed point. */
  _toScreen(tx, ty) {
    const z = this.tube.zoom, tu = (tx / this.W - 0.5) / z + 0.5, tv = (1 - ty / this.H - 0.5) / z + 0.5;
    let u = tu, v = tv;
    for (let i = 0; i < 6; i++) {
      const cx = u * 2 - 1, cy = v * 2 - 1, r2 = (cx * cx + cy * cy) * 0.5, kk = this.tube.curve * r2 + this.tube.edge * r2 * r2;
      u = tu - cx * kk; v = tv - cy * kk;
    }
    return [u * this.vw, (1 - v) * this.vh];
  }

  // ---------------------------------------------------------------- type

  _loadFonts() {
    if (!document.fonts) return;
    const redo = () => { this.cache.clear(); this.fmc.clear(); this._layout(); this.dirty = true; this.sig = ''; if (this.page) this.page.dirty = true; };
    const want = [['16px "Share Tech Mono"', 'SCORE'], ['italic 16px "Racing Sans One"', 'DRIFT'], ['16px "Dela Gothic One"', 'コースアウトマグネット']];
    if (document.fonts.load) Promise.all(want.map(([f, t]) => document.fonts.load(f, t).catch(() => null))).then(redo);
    // (and whenever any other face the page uses arrives: the title's)
    if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', redo);
  }

  /** A face's measures, in units: its capitals' height, its ascent and descent, a digit's width. */
  _fm(f) {
    let m = this.fmc.get(f.key);
    if (m) return m;
    const c = this.mc; c.font = fontAt(f, 1);
    const a = c.measureText('HO08'), d = c.measureText('gjpy,');
    m = { cap: a.actualBoundingBoxAscent || f.sz * 0.7, asc: Math.max(a.fontBoundingBoxAscent || 0, f.sz * 0.95), dsc: Math.max(a.fontBoundingBoxDescent || 0, d.actualBoundingBoxDescent || 0, f.sz * 0.3),
          dw: c.measureText('0').width };
    this.fmc.set(f.key, m);
    return m;
  }

  /** A string's width in units, its letter spacing counted. */
  _tw(text, f) {
    const c = this.mc; c.font = fontAt(f, 1);
    if (!f.ls) return c.measureText(text).width;
    let w = 0;
    for (const ch of text) w += c.measureText(ch).width + f.ls;
    return w - f.ls;
  }

  /** Fill a string on c (whose transform is in units) at the baseline point (x, y), letter by letter if it is spaced. */
  _fill(c, text, f, x, y) {
    if (!f.ls) { c.fillText(text, x, y); return; }
    for (const ch of text) { c.fillText(ch, x, y); x += c.measureText(ch).width + f.ls; }
  }

  /**
   * A string drawn once and kept: ol, a hard dark outline all round in units (and a drop shadow twice as far under
   * it, the anime popups' ink); glow, a soft light round it in the colour given.
   */
  _spr(text, f, color, ol = 0, glow = '') {
    const key = f.key + '|' + color + '|' + ol + '|' + glow + '|' + text;
    let s = this.cache.get(key);
    if (s) return s;
    if (this.cache.size > 500) this.cache.clear();
    const k = this.s, m = this._fm(f), w = Math.max(0.5, this._tw(text, f)), pad = ol * 2 + (glow ? 6 : 0) + 1;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil((w + 2 * pad) * k)); cv.height = Math.max(1, Math.ceil((m.asc + m.dsc + 2 * pad) * k));
    const c = cv.getContext('2d');
    c.setTransform(k, 0, 0, k, 0, 0);
    c.font = fontAt(f, 1); c.textBaseline = 'alphabetic';
    const bx = pad, by = pad + m.asc;
    if (glow) { c.shadowColor = glow; c.shadowBlur = 5 * k; c.fillStyle = color; this._fill(c, text, f, bx, by); c.shadowBlur = 0; c.shadowColor = 'transparent'; }
    if (ol > 0) {
      c.fillStyle = C.olc;
      this._fill(c, text, f, bx, by + ol * 2);
      const d = ol * 0.7;
      for (const [dx, dy] of [[ol, 0], [-ol, 0], [0, ol], [0, -ol], [d, d], [-d, d], [d, -d], [-d, -d]]) this._fill(c, text, f, bx + dx, by + dy);
    }
    c.fillStyle = color; this._fill(c, text, f, bx, by);
    s = { c: cv, w, h: m.cap, ox: pad, oy: pad + m.asc - m.cap, k };
    this.cache.set(key, s);
    return s;
  }

  /** Draw a sprite so the point (ax, ay) of its text box (fractions of its width and cap height) lands on (x, y). */
  _put(s, x, y, ax = 0, ay = 0, sc = 1, a = 1) {
    if (a <= 0.01 || sc <= 0.02) return;
    const c = this.ctx, k = this.s;
    if (a < 1) c.globalAlpha = a;
    let dx = x - (ax * s.w + s.ox) * sc, dy = y - (ay * s.h + s.oy) * sc;
    if (Math.abs(sc - 1) < 0.01) { dx = Math.round(dx * k) / k; dy = Math.round(dy * k) / k; }
    c.drawImage(s.c, dx, dy, s.c.width / k * sc, s.c.height / k * sc);
    if (a < 1) c.globalAlpha = 1;
  }

  _txt(text, f, color, x, y, ax = 0, ay = 0, sc = 1, a = 1, ol = 0, glow = '') {
    const s = this._spr(text, f, color, ol, glow);
    this._put(s, x, y, ax, ay, sc, a);
    return s;
  }

  /**
   * Seven-segment digits, the 90s dash's amber readout, with every unlit segment ghosting through. (x, y): the top left
   * of the first digit (or its right end, right). h: the digits' height in units. sc: a punch, about their middle.
   */
  _seg(str, x, y, h, color, { ghost = 0.09, right = false, center = false, colon = -1, colonOn = true, dot = -1, sc = 1, a = 1 } = {}) {
    const c = this.ctx, q = h / 22 * sc, pitch = 15 * q, extra = colon >= 0 ? 5 * q : 0, n = str.length, k = this.s;
    const w = n * pitch - 3 * q + extra;
    const x0 = right ? x - w : center ? x - w / 2 : x, y0 = y - (h * sc - h) / 2;
    c.save();
    c.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const ox = x0 + i * pitch + (colon >= 0 && i > colon ? extra : 0);
      c.setTransform(k * q, 0, -SKEW * k * q, k * q, k * (ox + SKEW * 11 * q), k * y0);
      const on = SEGS[str[i]] ?? '';
      for (const s of 'abcdefg') {
        const lit = on.includes(s);
        if (!lit && ghost <= 0) continue;
        c.globalAlpha = a * (lit ? 1 : ghost);
        c.fill(SEG_PATHS[s]);
      }
      c.globalAlpha = a;
      if (i === colon && colonOn) { c.fillRect(13.45, 6.5, 2.2, 2.2); c.fillRect(13.45, 15, 2.2, 2.2); }
      if (i === dot) c.fillRect(12.05, 18.55, 2.2, 2.2);
    }
    c.restore();
    return w;
  }

  /** The width of n seven-segment digits h tall (with a colon's gap). */
  _segW(n, h, colon = false) { const q = h / 22; return n * 15 * q - 3 * q + (colon ? 5 * q : 0); }

  /** A path round a rounded rectangle, in units. */
  _rr(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
  }

  /** A panel of the OSD: dark glass, a hairline amber rule, brighter ticks at two corners. */
  _panel(x, y, w, h, edge = C.edge, a = 1) {
    const c = this.ctx;
    if (a < 1) c.globalAlpha = a;
    this._rr(c, x, y, w, h, 1.5);
    c.fillStyle = C.panel; c.fill();
    c.lineWidth = 0.5; c.strokeStyle = edge;
    this._rr(c, x + 0.25, y + 0.25, w - 0.5, h - 0.5, 1.4); c.stroke();
    c.fillStyle = 'rgba(255,214,150,0.55)';
    c.fillRect(x + 1.5, y, 4, 0.5); c.fillRect(x, y + 1.5, 0.5, 4);
    c.fillRect(x + w - 5.5, y + h - 0.5, 4, 0.5); c.fillRect(x + w - 0.5, y + h - 5.5, 0.5, 4);
    if (a < 1) c.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- the layout

  _layout() {
    const W = this.W, H = this.H, mn = Math.min(W, H);
    const P = this.portrait = this.vh > this.vw;
    const S = this.compact = W < 300 || H < 250;
    const Z = this.Z = S ? SIZES.compact : SIZES.roomy;
    const m = Math.max(5, Math.round(0.035 * mn)), sa = this._safe();
    // (clear of the notch and the home bar, as the tube shows them)
    const top = Math.max(m, Math.ceil(this._toTex(this.vw / 2, sa.t + 4)[1]));
    const bot = Math.min(H - m, Math.floor(this._toTex(this.vw / 2, this.vh - sa.b - 4)[1]));
    const left = Math.max(m, Math.ceil(this._toTex(sa.l + 4, this.vh / 2)[0]));
    const right = Math.min(W - m, Math.floor(this._toTex(this.vw - sa.r - 4, this.vh / 2)[0]));
    const L = this.L = { top, bot, left, right, S, P };
    const lab = this.labCap = this._fm(Z.lab).cap;

    // the top row: the combo and the distance on the left, the score in the middle, the clock on the right
    this.scH = Z.sc;
    let sw = this._segW(8, this.scH) + 12;
    const phs = () => 3 + lab + 4 + this.scH + 4;
    L.score = { x: 0, y: top, w: sw, h: phs() };
    const comboCap = this._fm(Z.combo).cap;
    const cw = Math.max(this._tw('COMBO', Z.lab) + 12, S ? 44 : 64);
    L.combo = { x: left, y: top, w: cw, h: 3 + lab + 4 + comboCap + 4 + (S ? 2 : 2.5) + 4 + Z.ds + 4 };
    const ph = 3 + lab + 4 + Z.cl + 4;
    const tw = Math.max(this._segW(4, Z.cl, true) + 14, this._tw('TIME', Z.lab) + 6 + 4 + 7 + 5);
    L.time = { x: right - tw, y: top, w: tw, h: ph };
    // the buttons: sound and pause, a thumb's width each on a phone
    const bs = S ? 18 : 16, gap = 4;
    if (S && !P) L.btns = [{ x: L.time.x - gap - 2 * bs - 3, y: top, w: bs, h: bs }, { x: L.time.x - gap - bs, y: top, w: bs, h: bs }];
    else L.btns = [{ x: right - 2 * bs - 3, y: top + ph + gap, w: bs, h: bs }, { x: right - bs, y: top + ph + gap, w: bs, h: bs }];
    // (a narrow screen whose middle is crowded: the score keeps clear of its neighbours, in smaller digits if it must)
    const lo = L.combo.x + L.combo.w + 3, hi = (S && !P ? L.btns[0].x : L.time.x) - 3;
    if (hi - lo < sw) { this.scH = Math.max(7, (hi - lo - 12) / (8 * 15 - 3) * 22); sw = this._segW(8, this.scH) + 12; L.score.w = sw; L.score.h = phs(); }
    L.score.x = clamp(Math.round(W / 2 - sw / 2), lo, Math.max(lo, hi - sw));
    L.clockAdd = S ? { x: right, y: Math.max(L.btns[0].y + bs, L.time.y + L.time.h) + 5, ax: 1, ay: 0 } : { x: L.time.x - 6, y: top + ph / 2, ax: 1, ay: 0.5 };
    L.tv = { x: left, y: L.combo.y + L.combo.h + 6 };

    // the drift stack under the score
    const capB = this._fm(Z.pts).cap, capT = this._fm(Z.tier).cap;
    L.drift = { cx: Math.round(W / 2), y: top + L.score.h + (S ? 6 : 8) };
    const strip = L.strip0 = S || this.touch;
    L.tierInline = strip && !P;
    L.driftBot = L.drift.y + capB + 4 + (L.tierInline ? 0 : capT + 4);

    // the dash: a round bar-graph tach on a desktop, a strip along the bottom on a phone or a tablet (the dial sat
    // where the right thumb goes)
    if (!strip) {
      const R = Math.round(clamp(H * 0.13, 38, 56));
      L.dial = { cx: right - R - 4, cy: bot - 13 - R, R, t: Math.max(4.5, R * 0.13) };
      L.leds = { x: L.dial.cx - R, y: L.dial.cy - R - 11, w: 2 * R, h: 4 };
      L.dash = { x: L.dial.cx - R - 4, y: L.leds.y - 9, w: 2 * R + 8, h: bot - L.leds.y + 9 };
    } else {
      const w = P ? right - left : Math.min(S ? 210 : 260, Math.round(W * 0.5)), h = S ? 26 : 28;
      L.strip = { x: P ? left : Math.round(W / 2 - w / 2), y: bot - h, w, h };
      L.dash = L.strip;
    }

    // the angle meter, small: bottom middle on a desktop, under the drift count on a phone (beside it on its side)
    const N = S ? 9 : 10, bw = S ? 3 : 4, rh = S ? 3.5 : 4.5, aw = 2 * N * (bw + 1) - 1, degCap = this._fm(Z.deg).cap;
    if (!strip) {
      const cx = Math.max(left + aw / 2 + 8, Math.min(Math.round(W / 2), L.dash.x - 10 - aw / 2));
      L.angle = { cx: Math.round(cx), y: bot - 18 - degCap, n: N, bw, h: rh, w: aw };
    } else if (P) L.angle = { cx: Math.round(W / 2), y: L.driftBot + 5, n: N, bw, h: rh, w: aw };
    else L.angle = { cx: Math.round(W / 2) - 8, y: L.driftBot + 3, n: N, bw, h: rh, w: aw, inline: true };
    L.angleBot = L.angle.inline ? L.angle.y + rh + 3 : L.angle.y + rh + 3 + degCap + 4;

    // the off-road countdown: under the score (the drift count steps down out of its way), or on a phone held upright,
    // under the angle meter, where nothing has to move (its width is its words'; its third line only where it fits)
    const jcap = this._fm(Z.jp).cap, coSub = !(S && P), coLab = this._fm(Z.coLine).cap, coSubCap = this._fm(Z.coSub).cap;
    const coH = 4 + jcap + 4 + coLab + (coSub ? 3 + coSubCap : 0) + 5;
    if (S && P) L.co = { y: L.angleBot + 6, h: coH, shift: 0, sub: coSub, jcap };
    else L.co = { y: top + L.score.h + 5, h: coH, shift: coH + 6, sub: coSub, jcap };

    // the callouts, above the road ahead and clear of the drift count; the smash counter just above the car
    L.toastY = Math.max(Math.round(H * (P ? 0.3 : 0.33)), (strip && !P ? L.angleBot : L.driftBot) + 8);
    L.smashY = Math.round(H * (P ? 0.45 : 0.5));
    // the first-run hint: under the top row upright, in the drift count's place on its side, above the angle meter
    if (S && P) L.coach = { cx: Math.round(W / 2), y: L.combo.y + L.combo.h + 6, w: right - left };
    else if (strip) L.coach = { cx: Math.round(W / 2), y: L.drift.y, w: Math.round(W * 0.62) };
    else L.coach = { cx: Math.round(W / 2), y: L.angle.y - 44, w: Math.round(W * 0.7) };

    // the thumbs (a phone): the handbrake's pad in the right thumb's corner, clear of the dash; the steering hint left
    const pr = Math.round((S ? 46 : 52) / this.kx);
    L.pad = { x: right - pr - 2, y: P ? L.dash.y - 8 - pr : bot - pr - 2, r: pr };
    L.hint = { x: left + 4, y: P ? L.dash.y - 8 : bot - 2 };
    this._placeButtons();
  }

  /** The buttons are drawn on the OSD; the page's own buttons lie invisibly over where the tube shows them. */
  _placeButtons() {
    const els = [this.el.mute, this.el.pauseb];
    this.L.btns.forEach((r, i) => {
      const e = els[i];
      if (!e) return;
      const [x0, y0] = this._toScreen(r.x - 2, r.y - 2), [x1, y1] = this._toScreen(r.x + r.w + 2, r.y + r.h + 2);
      e.style.left = x0.toFixed(1) + 'px'; e.style.top = y0.toFixed(1) + 'px';
      e.style.width = (x1 - x0).toFixed(1) + 'px'; e.style.height = (y1 - y0).toFixed(1) + 'px';
    });
  }

  /** Where everything is on the OSD, in its units (for the overlap check in work/: exact, where a screen box is not). */
  rects() {
    const L = this.L, a = L.angle, out = { score: L.score, combo: L.combo, time: L.time, btn0: L.btns[0], btn1: L.btns[1], dash: L.dash };
    out.co = { x: this.W / 2 - 80, y: L.co.y, w: 160, h: L.co.h };
    out.angle = a.inline ? { x: a.cx - a.w / 2 - 5, y: a.y - 3, w: a.w + 10 + this._tw('00', this.Z.deg) + 6, h: a.h + 6 } : { x: a.cx - a.w / 2 - 6, y: a.y - 4, w: a.w + 12, h: L.angleBot - a.y + 4 };
    if (this.touch) out.pad = { x: L.pad.x - L.pad.r, y: L.pad.y - L.pad.r, w: 2 * L.pad.r, h: 2 * L.pad.r };
    out.W = this.W; out.H = this.H;
    return out;
  }

  /** Where everything is on the screen, in CSS px (for the checks in work/). */
  boxes() {
    const L = this.L, out = {};
    const box = (r) => { const [x0, y0] = this._toScreen(r.x, r.y), [x1, y1] = this._toScreen(r.x + r.w, r.y + r.h); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };
    for (const k of ['score', 'combo', 'time', 'dash']) if (L[k]) out[k] = box(L[k]);
    out.btn0 = box(L.btns[0]); out.btn1 = box(L.btns[1]);
    out.angle = box({ x: L.angle.cx - L.angle.w / 2, y: L.angle.y, w: L.angle.w, h: L.angle.h + 12 });
    out.pad = box({ x: L.pad.x - L.pad.r, y: L.pad.y - L.pad.r, w: 2 * L.pad.r, h: 2 * L.pad.r });
    return out;
  }

  // ---------------------------------------------------------------- showing, warming, resetting

  show(on) {
    this.visible = on;
    this._on();
    if (this.el.hud) this.el.hud.classList.toggle('on', on);
    if (this.el.btns) this.el.btns.classList.toggle('on', on);
    this.dirty = true; this.sig = '';
  }

  /** A page's menu drawn on the TV (pagetv.js: the title, the pause menu) or not: the OSD is on for it too. */
  showPage(on) { this.pageOn = on; this._on(); }

  /** Once a frame, whatever is going on: the page's menu drawn when it changed, and sent to the GPU. */
  pageFrame() { if (this.page && this.page.frame()) this.texture.needsUpdate = true; }

  /**
   * Every look drawn once while the title is up (not shown): the sprites are made and the texture is sized on the GPU
   * before a run needs them.
   */
  warm(on) {
    this.warming = on;
    const now = performance.now();
    if (on) {
      Object.assign(this.v, { active: true, pts: 1234, mult: 2, tier: 2, slide: true, deg: 55, hot: true, drifting: true, clip: true, boosting: true, leds: 12 });
      this.driftA = this.angleA = 1;
      this._showToast('WARM', 'good', true, 'COMBO x2', 1);
      this.smash('SMASH!', 1234, 2); this._bankFly(1234, 2); this._clockAdd(1234);
      for (const k of ['mult', 'tier', 'combo', 'deg', 'boost']) this._anim(k, 300);
      this.tv = { n: 1, label: 'WARM', t0: now };
      this._coachOn = true; this.coachA = 1;
      const was = this.visible; this.visible = true;
      this._draw(now);
      this.visible = was;
      // (the title's own drawing takes the canvas back on its next frame)
      if (this.page) this.page.dirty = true;
    } else {
      this.anims.clear(); this.cur = this.prev = null; this.queue = [];
      this.bank = this.smashS = this.clockAddS = this.tv = null;
      Object.assign(this.v, { active: false, pts: 0, slide: false, hot: false, drifting: false, clip: false, boosting: false, leds: 0 });
      this.driftA = this.angleA = this.coachA = 0; this._coachOn = false; this.holdScore = 0;
      this.dirty = true; this.sig = '';
    }
  }

  /** A new run (or back to the title): the score from zero, the run's own records cleared, the course's best as it stands. */
  reset() {
    this.shown = 0; this.holdScore = 0;
    // (nothing from the last run carries over: its callouts, its cash-in, its smash counter)
    this.anims.clear(); this.cur = this.prev = null; this.queue = [];
    this.bank = this.smashS = this.clockAddS = null;
    this.run = { t: 0, smashN: 0, smashLast: 0, newBest: false, best0: this._storedBest() };
    this._coachOn = false; this._coachGone = false; this.coachA = 0;
    this.newBestLab = false;
    this.dirty = true; this.sig = '';
  }

  /** The best kept for the course picked on the title (main.js keeps it under sundrift.best.<city.>easy|hard). */
  _storedBest() {
    try {
      const m = document.querySelector('.map.sel'), d = document.querySelector('.diff.sel');
      const key = (m && m.dataset.m === 'city' ? 'city.' : '') + (d ? d.dataset.d : 'easy');
      return Number(localStorage.getItem('sundrift.best.' + key)) || 0;
    } catch { return 0; }
  }

  /**
   * A short buzz on a phone that can (Android; iOS has no vibration for the web), never more than one in 0.2 s, and only
   * in a run the player has touched (before a first tap the browser refuses it and says so in the console).
   */
  buzz(p) {
    if (!this.canBuzz || !document.body.classList.contains('touch') || !document.body.classList.contains('playing')) return;
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    const now = performance.now();
    if (now - this._buzzT < 200) return;
    this._buzzT = now;
    try { navigator.vibrate(p); } catch {}
  }

  // ---------------------------------------------------------------- the moments

  _anim(name, ms, delay = 0) { this.anims.set(name, { t0: performance.now() + delay, ms }); this.dirty = true; }

  /** How far through its run an animation is (0..1), or -1 when it is not playing (yet, or any more). */
  _p(name, now) {
    const a = this.anims.get(name);
    if (!a) return -1;
    const p = (now - a.t0) / a.ms;
    if (p >= 1) { this.anims.delete(name); return -1; }
    return p < 0 ? -1 : p;
  }

  /** The smash counter: one label, punched in on every hit, the chain and its points under it, just above the car. */
  smash(label, total, n) {
    this.smashS = { label: clean(label), sub: (n > 1 ? 'SMASH ×' + n + ' · ' : '') + '+' + Math.round(total).toLocaleString('en-US'), t0: performance.now() };
    // (the card counts what was knocked over; a chain's total grows with each hit)
    this.run.smashN++; this.run.smashLast = total;
    this.buzz(12);
    this.dirty = true;
  }

  /**
   * A callout in the lane above the road, one at a time, so two never pile up over the road or the smash counter. prio
   * decides who gives way while a callout is fresh (its first 0.65 s): a more important one cuts in (the other leaves
   * quickly), an equally important one (2 and up) waits its turn, a lesser one is dropped (its sound and its lamp still
   * say it). 3: a new best, a crash; 2: a banked drift's tier, a J-turn; 1: a clip, a switch, the course; 0: the weather.
   * sub is a smaller second line (the points, the combo).
   */
  toast(text, cls = '', big = false, sub = '', prio = 1) {
    const cur = this.cur;
    if (cur && performance.now() - cur.t0 < 650 && prio <= cur.prio) {
      if (prio >= 2 && this.queue.length < 3) this.queue.push([text, cls, big, sub, prio]);
      return;
    }
    this._showToast(text, cls, big, sub, prio);
  }

  _showToast(text, cls, big, sub, prio) {
    const now = performance.now(), cur = this.cur;
    // (the one showing leaves quickly; one already fading just goes)
    this.prev = cur && now - cur.t0 < 1000 ? { ...cur, out0: now } : null;
    this.cur = { text: clean(text), cls: cls || '', big, sub: clean(sub || ''), prio, t0: now };
    this.dirty = true;
  }

  /** The next queued callout, once the one showing has had its moment. */
  _nextToast(now) {
    if (!this.queue.length || (this.cur && now - this.cur.t0 < 650)) return;
    this._showToast(...this.queue.shift());
  }

  /** The TV's own caption as a run starts: the channel and what is on it, in the set's green, for a few seconds. */
  channel(n, label) { this.tv = { n, label: String(label), t0: performance.now() }; this.dirty = true; }

  /**
   * The clock is the score: a banked drift pushes the hour on (a minute for every hundred points, main.js), and says so
   * here, the minutes flying off the clock as it rolls forward, so the find is seen and not only read about.
   */
  _clockAdd(points) {
    const min = Math.round(points / 100);
    if (min < 1) return;
    this.clockAddS = { text: '+' + (min < 60 ? min + ' MIN' : Math.floor(min / 60) + ':' + String(min % 60).padStart(2, '0')), t0: performance.now() };
    this._anim('clock', 480);
  }

  /** The cash-in: the banked points flash where the live count was, then fly up into the score, which pulses as they land. */
  _bankFly(v, tier) {
    const now = performance.now();
    this.bank = { v: Math.round(v), tier, t0: now };
    // (it lands at 0.47 s: the score pulses and starts to roll then, and audio.js rings its bell then)
    this.holdScore = now + 470;
    // (a slide of a few points, a wiggle, only flies in; the score's pulse and flash are for a drift)
    if (v >= 100) { this._anim('score', 340, 470); this._anim('sflash', 640, 460); }
    this.dirty = true;
  }

  /** First run only (until a drift has been banked once, ever): how to drift, a moment after the start. */
  _coach(dt) {
    if (this.coached || this._coachGone) return;
    this.run.t += dt;
    // (not before nine seconds in: the title has already said how, and the first seconds of a run are the road's)
    const want = this.run.t > 9 && this.run.t < 36;
    if (want === !!this._coachOn) return;
    this._coachOn = want;
    if (!want) this._coachGone = true;
  }

  _coachDone() { this._coachOn = false; this._coachGone = true; }

  onEvent(e) {
    switch (e.type) {
      case 'start': if (e.value > 1) this._anim('combo', 340); this._coachDone(); break;
      case 'mult': this._anim('mult', 300); break;
      // the boost a slide has earned, the moment it ends: the bar that just filled flashes
      case 'boost': this._anim('boost', 360); break;
      case 'tier': this._anim('tier', 420); break;
      // a slide held past the angle that scores the most: said once a drift, and the degrees punch
      case 'angle': this.toast('BIG ANGLE!', 't3', false, '', 1); this._anim('deg', 320); break;
      case 'bank': {
        this._bankFly(e.value, e.tier);
        this._clockAdd(e.value);
        // a bigger drift is called out by its tier, with the combo it was part of
        const word = SCORE.tierNames[e.tier] || '';
        if (word) this.toast(word + ' DRIFT!', 't' + e.tier, e.tier >= 2, e.chain > 1 ? 'COMBO ×' + e.chain : '', 2);
        if (e.value >= 100) this.buzz(e.tier >= 3 ? [26, 40, 26, 40, 50] : e.tier === 2 ? [20, 40, 24] : e.tier === 1 ? 18 : 10);
        if (!this.coached) { this.coached = true; try { localStorage.setItem('sundrift.drifted', '1'); } catch {} }
        break;
      }
      case 'switch': this._anim('combo', 340); this.toast('SWITCH!', 'good', false, '', 1); break;
      case 'clip': this.toast('CLIP!', 'clip', false, '+' + Math.round(e.value).toLocaleString('en-US'), 1); this.clipT = 0.9; this.buzz(14); break;
      case 'crash': this.toast('CRASH', 'bad', true, '-' + Math.round(e.value).toLocaleString('en-US') + ' LOST', 3); this.hitFlash = 1; this.buzz(70); break;
      case 'bump': this.hitFlash = Math.max(this.hitFlash, 0.5); break;
      // (a run starts at dusk: sunrise is the night driven through, the find's own reward, and is called out as one)
      case 'sun':
        if (e.value === 'SUNRISE') { this.toast('SUNRISE!', 't3', true, 'YOU DROVE THROUGH THE NIGHT', 3); this.buzz([30, 60, 30, 60, 90]); }
        else this.toast(e.value, 'calm', false, '', 0);
        break;
      case 'best': {
        this.run.newBest = true; this.newBestLab = true;
        this.toast('NEW BEST!', 't2', true, '', 3);
        this._anim('sflash', 1300); this._anim('score', 460);
        this.buzz([30, 50, 30, 50, 80]);
        // (main.js hands a new best to the HUD alone; the sound hears of it from this)
        dispatchEvent(new CustomEvent('sundrift:best'));
        break;
      }
      case 'jturn': this.toast('J-TURN!', 'good', true, '+' + Math.round(e.value), 2); this.buzz([20, 30, 30]); break;
    }
  }

  /** The run so far, on the pause screen: the course, the score against the best, and the run's records. */
  fillCard() {
    const s = this.scoring;
    if (!s) return;
    const fmt = (n) => Math.round(n).toLocaleString('en-US');
    const st = s.stats, set = (id, v, hi) => { const e = $(id); if (e) { e.textContent = v; if (hi !== undefined) e.classList.toggle('hi', hi); } };
    const m = document.querySelector('.map.sel span'), d = document.querySelector('.diff.sel b');
    set('pc-course', (m ? m.textContent : '') + (d ? ' · ' + d.textContent : ''));
    set('pc-score', fmt(s.total), this.run.newBest);
    set('pc-bestl', this.run.newBest ? 'NEW BEST' : 'BEST', this.run.newBest);
    // (a new best shows by how much it beat the old one)
    set('pc-best', this.run.newBest ? (this.run.best0 > 0 ? '+' + fmt(s.total - this.run.best0) : fmt(s.total)) : this.run.best0 > 0 ? fmt(this.run.best0) : '—', this.run.newBest);
    set('pc-drifts', String(st.drifts));
    set('pc-big', fmt(st.biggest));
    set('pc-long', st.longest.toFixed(1) + ' s');
    set('pc-clips', String(st.clips));
    set('pc-smash', String(this.run.smashN));
    set('pc-dist', (st.distance / 1609.344).toFixed(1) + ' MI');
  }

  // ---------------------------------------------------------------- every frame

  /**
   * @param s Scoring; car; rpm and gear from the gearbox; hour 0..24; distance m; boost seconds left and max
   */
  update(dt, s, car, gb, hour, dist, boostLeft, boostMax, perf) {
    this.scoring = s;
    const now = performance.now(), v = this.v;
    const touch = document.body.classList.contains('touch');
    if (touch !== this.touch) { this.touch = touch; this._layout(); this.dirty = true; }
    // the score rolls up to the total, once the banked points have flown into it
    if (now >= this.holdScore || s.total < this.shown) {
      this.shown = this.shown + (s.total - this.shown) * Math.min(1, dt * 9);
      if (Math.abs(this.shown - s.total) < 1) this.shown = s.total;
    }
    if (this.warming) { this.rpm = damp(this.rpm, gb.rpm, 16, dt); return; }
    v.score = Math.round(this.shown);

    // the live drift (its count is redrawn at most twenty times a second: digits that change every frame are harder to
    // read than ones that tick)
    const active = s.active && s.points > 1;
    if (active) {
      const p = Math.round(s.points);
      if (!v.active || now - (this._ptsT || 0) > 48) { v.pts = p; this._ptsT = now; }
      v.mult = s.mult; v.tier = s.tier;
    }
    v.active = active;
    this.driftA = active ? Math.min(1, this.driftA + dt / 0.18) : 0;
    // the combo, and what is left of the time to chain the next drift on
    v.combo = s.active ? s.chain : (s.chainTimer > 0 ? s.chain : 0);
    v.chain = Math.round((s.active ? 1 : (s.chainTimer > 0 ? s.chainTimer / SCORE.chainGrace : 0)) * 20) / 20;
    // the dash
    v.mph = Math.round(car.kmh / 1.609344);
    v.gear = car.vF < -0.3 ? 'R' : (v.mph < 2 && car.throttle < 0.1 ? 'N' : String(gb.gear + 1));
    this.rpm = damp(this.rpm, gb.rpm, 16, dt);
    v.rpm = Math.round(clamp(this.rpm, 0, 9200) / 250) * 250;
    v.leds = Math.round(clamp(boostLeft / boostMax, 0, 1) * 12);
    v.boosting = car.boost > 0.02; v.drifting = active;
    this.clipT = Math.max(0, this.clipT - dt); v.clip = this.clipT > 0;
    // the drift angle
    const slide = Math.abs(car.beta) > 0.1 && car.speed > 5;
    if (slide && !v.slide) this._coachDone();         // (a slide: the coach has done its job, and its place is the meter's)
    v.slide = slide;
    this.angleA = slide ? Math.min(1, this.angleA + dt / 0.25) : Math.max(0, this.angleA - dt / 0.25);
    if (slide) {
      const d = clamp(car.beta * 180 / Math.PI, -70, 70);
      v.deg = Math.round(Math.abs(d)); v.side = d > 0 ? 1 : -1; v.hot = Math.abs(d) >= MAX_ANGLE;
    }
    // the clock (its colon blinks every half second, as a clock's did) and the distance
    v.hh = Math.floor(hour) % 24; v.mm = Math.floor((hour % 1) * 60); v.day = hour >= 6 && hour < 18;
    v.colon = Math.floor(now / 500) % 2 === 0;
    v.dist = Math.floor(dist / 160.9344);
    this._coach(dt);
    this.coachA = this._coachOn ? Math.min(1, this.coachA + dt / 0.45) : Math.max(0, this.coachA - dt / 0.45);
    this._nextToast(now);
    // (the drift count steps down out of the off-road countdown's way)
    const co = this.courseOut;
    this.coY = damp(this.coY, co && co.shown ? this.L.co.shift : 0, 14, dt);

    // the vignette and the hit flash are drawn by the post pass (main reads these two)
    this.hitFlash = Math.max(0, this.hitFlash - dt * 2.2);
    this.vignette = damp(this.vignette, active ? 1 : 0, 3, dt);
    if (this.perfOn && perf && this.el.perf) this.el.perf.textContent = perf;

    if (!this.visible || this.pageOn) return;
    // redrawn only when something on it has changed or is moving
    const t = this.input && this.input.t;
    const sig = [v.score, v.active ? v.pts + '/' + v.mult + '/' + v.tier : '', v.combo, v.chain, v.mph, v.gear, v.rpm, v.leds, v.boosting, v.clip,
      v.slide ? v.deg + '/' + v.side + '/' + v.hot : '', this.angleA > 0 && this.angleA < 1 ? this.angleA.toFixed(2) : this.angleA > 0,
      v.hh, v.mm, v.colon, v.dist, this.driftA < 1 && this.driftA > 0 ? this.driftA.toFixed(2) : this.driftA > 0,
      this.coachA > 0 && this.coachA < 1 ? this.coachA.toFixed(2) : this.coachA > 0, this.newBestLab, Math.round(this.coY),
      co && co.shown ? co.sig() : '', this.el.mute && this.el.mute.classList.contains('off'),
      touch && t ? [t.active, Math.round(t.x0), Math.round(t.y0), Math.round(t.x || 0), Math.round(t.y || 0), t.hand, t.lift, t.brake > 0.05, t.used].join(',') : '',
      this._coachOn ? Math.floor(now / 400) % 2 : ''].join('|');
    const moving = this.anims.size > 0 || this.bank || this.smashS || this.clockAddS || this.tv || this.cur || this.prev;
    // (thirty times a second at most, as a set's display was drawn: half the work, and nobody reads a digit faster)
    if ((sig !== this.sig || moving || this.dirty) && (this.dirty || now - (this._drawT || 0) > 30)) {
      this.sig = sig; this.dirty = false; this._drawT = now;
      this._draw(now);
      this.texture.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------- drawing

  _draw(now) {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.visible && !this.warming) return;
    c.setTransform(this.s, 0, 0, this.s, 0, 0);
    c.imageSmoothingEnabled = true;
    this._drawTop(now);
    this._drawDash(now);
    this._drawAngle(now);
    this._drawDrift(now);
    this._drawCourseOut(now);
    this._drawSmash(now);
    this._drawToast(now);
    this._drawCoach(now);
    this._drawTV(now);
    if (this.touch) this._drawThumbs(now);
    // (a callout, a cash-in, a smash done: dropped, so the canvas can rest)
    if (this.bank && now - this.bank.t0 > 700) this.bank = null;
    if (this.smashS && now - this.smashS.t0 > 1700) this.smashS = null;
    if (this.clockAddS && now - this.clockAddS.t0 > 1700) this.clockAddS = null;
    if (this.tv && now - this.tv.t0 > 3000) this.tv = null;
    if (this.cur && now - this.cur.t0 > 1400) this.cur = null;
    if (this.prev && now - this.prev.out0 > 180) this.prev = null;
  }

  _drawTop(now) {
    const c = this.ctx, L = this.L, v = this.v, Z = this.Z, lab = this.labCap;
    // the score: eight digits, the unlit ones ghosting through, a gold flash round it as a drift lands in it
    {
      const r = L.score, fl = this._p('sflash', now), pk = this._p('score', now);
      this._panel(r.x, r.y, r.w, r.h);
      if (fl >= 0) {
        const a = clamp(fl < 0.15 ? fl / 0.15 : 1 - (fl - 0.15) / 0.85, 0, 1);
        c.save(); c.globalAlpha = a; c.lineWidth = 1; c.strokeStyle = C.gold; c.shadowColor = 'rgba(255,190,60,0.8)'; c.shadowBlur = 6 * this.s;
        this._rr(c, r.x - 0.5, r.y - 0.5, r.w + 1, r.h + 1, 2); c.stroke(); c.restore();
      }
      this._txt(this.newBestLab ? 'NEW BEST' : 'SCORE', Z.lab, this.newBestLab ? C.gold : C.dim, r.x + r.w / 2, r.y + 3, 0.5, 0);
      const str = String(Math.max(0, v.score)).slice(-8).padStart(8, ' ');
      const sc = pk >= 0 ? 1 + 0.1 * Math.sin(pk * Math.PI) : 1;
      this._seg(str, r.x + r.w / 2, r.y + 3 + lab + 4, this.scH, C.amber, { center: true, sc });
    }
    // the combo, the chain's time left, and the distance
    {
      const r = L.combo, pk = this._p('combo', now), S = L.S;
      this._panel(r.x, r.y, r.w, r.h);
      this._txt('COMBO', Z.lab, C.dim, r.x + 6, r.y + 3);
      const cap = this._fm(Z.combo).cap, y = r.y + 3 + lab + 4;
      const xs = this._txt('×', Z.x, C.amber, r.x + 6, y + cap, 0, 1);
      this._txt(String(v.combo), Z.combo, v.combo > 1 ? C.ink : C.dim, r.x + 6 + xs.w + 1.5, y + cap, 0, 1, pk >= 0 ? pop(pk, 1.9) : 1);
      const by = y + cap + 4, bh = S ? 2 : 2.5, bw = r.w - 12;
      c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(r.x + 6, by, bw, bh);
      if (v.chain > 0) {
        const g = c.createLinearGradient(r.x + 6, 0, r.x + 6 + bw, 0); g.addColorStop(0, C.orange); g.addColorStop(1, C.gold);
        c.fillStyle = g; c.fillRect(r.x + 6, by, bw * v.chain, bh);
      }
      const dy = by + bh + 4;
      this._txt('MI', Z.lab, C.dim, r.x + 6, dy + Z.ds, 0, 1);
      const miles = String(v.dist).padStart(2, '0').slice(-4).padStart(4, ' ');
      this._seg(miles, r.x + r.w - 5, dy, Z.ds, C.amber, { right: true, dot: 2 });
    }
    // the clock: the hour the run has reached, a sun or a moon by it, its colon blinking
    {
      const r = L.time, pk = this._p('clock', now);
      this._panel(r.x, r.y, r.w, r.h);
      this._txt('TIME', Z.lab, C.dim, r.x + 6, r.y + 3);
      this._sunMoon(r.x + r.w - 8.5, r.y + 3 + lab / 2, v.day);
      const sc = pk >= 0 ? 1 + 0.12 * Math.sin(pk * Math.PI) : 1;
      const str = String(v.hh).padStart(2, '0') + String(v.mm).padStart(2, '0');
      this._seg(str, r.x + r.w - 6, r.y + 3 + lab + 4, Z.cl, C.amber, { right: true, colon: 1, colonOn: v.colon, sc });
    }
    // a banked drift's minutes, flying off the clock it just moved
    if (this.clockAddS) {
      const p = (now - this.clockAddS.t0) / 1700, a = L.clockAdd;
      if (p < 1) {
        const al = p < 0.14 ? p / 0.14 : p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
        const dx = p < 0.14 ? 7 * (1 - p / 0.14) : -2 * (p - 0.14) / 0.56 - (p > 0.7 ? 4 * (p - 0.7) / 0.3 : 0);
        const dy = p < 0.14 ? 2 * (1 - p / 0.14) : -5 * Math.max(0, p - 0.14);
        const sc = p < 0.14 ? 0.8 + 0.28 * p / 0.14 : p < 0.7 ? 1.08 - 0.08 * (p - 0.14) / 0.56 : 1;
        this._txt(this.clockAddS.text, Z.mult, C.gold, a.x + dx, a.y + dy, a.ax, a.ay, sc, al, 0.8);
      }
    }
    // the buttons
    const muted = this.el.mute && this.el.mute.classList.contains('off');
    this._btn(L.btns[0], 'mute', muted);
    this._btn(L.btns[1], 'pause', false);
  }

  /** A little sun (day) or a crescent moon (night). */
  _sunMoon(cx, cy, day) {
    const c = this.ctx;
    c.save();
    if (day) {
      c.fillStyle = C.gold; c.beginPath(); c.arc(cx, cy, 2.1, 0, TAU); c.fill();
      c.strokeStyle = C.gold; c.lineWidth = 0.6; c.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8; c.moveTo(cx + Math.cos(a) * 3, cy + Math.sin(a) * 3); c.lineTo(cx + Math.cos(a) * 4, cy + Math.sin(a) * 4); }
      c.stroke();
    } else {
      c.fillStyle = '#fff2c0'; c.beginPath(); c.arc(cx, cy, 3, 0, TAU); c.fill();
      c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(cx + 1.6, cy - 1.1, 2.6, 0, TAU); c.fill();
    }
    c.restore();
  }

  _btn(r, kind, off) {
    const c = this.ctx;
    this._panel(r.x, r.y, r.w, r.h);
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    c.fillStyle = off ? C.dim : C.ink;
    if (kind === 'pause') { c.fillRect(cx - 3.5, cy - 4.5, 2.6, 9); c.fillRect(cx + 0.9, cy - 4.5, 2.6, 9); return; }
    // a quaver: its head, its stem and its flag
    c.beginPath(); c.ellipse(cx - 2.2, cy + 3.2, 2.3, 1.7, -0.35, 0, TAU); c.fill();
    c.fillRect(cx - 0.3, cy - 5.5, 1.1, 8.8);
    c.beginPath(); c.moveTo(cx + 0.8, cy - 5.5); c.quadraticCurveTo(cx + 4.5, cy - 3.5, cx + 3.2, cy - 0.5); c.quadraticCurveTo(cx + 3.4, cy - 3, cx + 0.8, cy - 3.4); c.fill();
    if (off) { c.strokeStyle = C.red; c.lineWidth = 1; c.beginPath(); c.moveTo(cx - 5.5, cy - 5.5); c.lineTo(cx + 5.5, cy + 5.5); c.stroke(); }
  }

  // the dash ------------------------------------------------------------------------------------------------

  _drawDash(now) {
    if (this.L.dial) this._drawDial(now); else this._drawStrip(now);
  }

  /** The round tach, a bar graph of blocks from 0 to 9,000 r/min round three quarters of a circle, the speed inside. */
  _drawDial(now) {
    const c = this.ctx, L = this.L, v = this.v, d = L.dial, Z = this.Z, R = d.R, t = d.t;
    c.fillStyle = C.panel; c.beginPath(); c.arc(d.cx, d.cy, R + 3, 0, TAU); c.fill();
    c.strokeStyle = C.edge; c.lineWidth = 0.5; c.beginPath(); c.arc(d.cx, d.cy, R + 3, 0, TAU); c.stroke();
    const N = 36, a0 = 0.75 * Math.PI, span = 1.5 * Math.PI, gap = 0.011 * Math.PI, lit = v.rpm / 9000 * N;
    for (let i = 0; i < N; i++) {
      const s0 = a0 + span * i / N + gap, s1 = a0 + span * (i + 1) / N - gap, rr = (i + 0.5) / N * 9000, on = i + 0.5 <= lit;
      c.beginPath(); c.arc(d.cx, d.cy, R, s0, s1); c.arc(d.cx, d.cy, R - t, s1, s0, true); c.closePath();
      c.fillStyle = on ? (rr >= 7500 ? C.red : rr >= 6000 ? C.orange : C.amber) : rr >= 7500 ? 'rgba(255,74,58,0.2)' : 'rgba(255,179,71,0.12)';
      c.fill();
    }
    // the numerals, the thousands, red past the redline
    for (let k = 0; k <= 9; k++) {
      const a = a0 + span * k / 9, rr = R - t - 5.5;
      this._txt(String(k), Z.labS, k >= 8 ? '#ff6a5a' : C.dim, d.cx + Math.cos(a) * rr, d.cy + Math.sin(a) * rr, 0.5, 0.5);
    }
    // the shift light, the gear, the speed and its unit
    c.fillStyle = v.rpm > 7700 ? C.red : 'rgba(255,74,58,0.18)'; c.beginPath(); c.arc(d.cx, d.cy - R + t + 5, 1.8, 0, TAU); c.fill();
    this._seg(v.gear, d.cx, d.cy - R * 0.4, Z.gear, v.gear === 'R' ? C.red : C.ink, { center: true, ghost: 0.06 });
    const spd = String(v.mph).padStart(3, ' ');
    this._seg(spd, d.cx, d.cy - Z.spd * 0.35, Z.spd, C.amber, { center: true });
    this._txt('MPH', Z.lab, C.dim, d.cx, d.cy + Z.spd * 0.65 + 3, 0.5, 0);
    // the three telltales under it, and the boost it has banked above it
    const lamps = [['DRIFT', v.drifting, C.amber], ['CLIP', v.clip, C.mint], ['BOOST', v.boosting, C.cyan]];
    const lw = lamps.reduce((s, l) => s + this._tw(l[0], Z.labS) + 5 + 2.5, -2.5);
    let lx = d.cx - lw / 2;
    for (const [tx, on, col] of lamps) lx += this._lamp(tx, lx, d.cy + R + 0.5, on, col) + 2.5;
    this._leds(L.leds.x, L.leds.y, L.leds.w, L.leds.h, now, true);
  }

  /** A telltale: its word in a box, dark, or lit in its colour. Returns its width. */
  _lamp(text, x, y, on, col) {
    const c = this.ctx, Z = this.Z, w = this._tw(text, Z.labS) + 5, h = this._fm(Z.labS).cap + 4;
    this._rr(c, x, y, w, h, 1);
    if (on) { c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 4 * this.s; c.fill(); c.shadowBlur = 0; c.shadowColor = 'transparent'; }
    else { c.fillStyle = 'rgba(0,0,0,0.4)'; c.fill(); c.lineWidth = 0.5; c.strokeStyle = 'rgba(255,255,255,0.14)'; c.stroke(); }
    this._txt(text, Z.labS, on ? '#1a0f1f' : 'rgba(255,255,255,0.3)', x + 2.5, y + 2, 0, 0);
    return w;
  }

  /** The boost banked: twelve cyan blocks, the last three whiter; they flash as a slide's boost comes in. */
  _leds(x, y, w, h, now, label) {
    const c = this.ctx, v = this.v, n = 12, fl = this._p('boost', now), Z = this.Z;
    let x0 = x;
    if (label) { const s = this._txt('BOOST', Z.labS, C.dim, x, y + h / 2, 0, 0.5); x0 = x + s.w + 3; }
    const bw = (x + w - x0 - (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const on = i < v.leds, bx = x0 + i * (bw + 1);
      c.fillStyle = on ? (fl >= 0 && Math.floor(fl * 8) % 2 === 0 ? '#ffffff' : i >= 9 ? C.ice : C.cyan) : 'rgba(90,209,255,0.12)';
      c.beginPath(); c.moveTo(bx + h * 0.25, y); c.lineTo(bx + bw + h * 0.25, y); c.lineTo(bx + bw - h * 0.25, y + h); c.lineTo(bx - h * 0.25, y + h); c.closePath(); c.fill();
    }
  }

  /** On a phone: the dash as a strip along the bottom, the gear, the speed, a bar-graph tach and the boost under it. */
  _drawStrip(now) {
    const c = this.ctx, v = this.v, r = this.L.strip, Z = this.Z, lab = this.labCap;
    this._panel(r.x, r.y, r.w, r.h);
    // the gear, boxed, the box red at the shift point
    const gx = r.x + 4, gy = r.y + 3, gw = 12, gh = r.h - 6;
    this._rr(c, gx, gy, gw, gh, 1); c.lineWidth = 0.6; c.strokeStyle = v.rpm > 7700 ? C.red : 'rgba(255,179,71,0.45)'; c.stroke();
    this._seg(v.gear, gx + gw / 2, gy + (gh - Z.gear) / 2, Z.gear, v.gear === 'R' ? C.red : C.ink, { center: true, ghost: 0.06 });
    // the speed, three digits, and its unit under it
    const sw = this._segW(3, Z.spd), sx = gx + gw + 4 + sw, top = r.y + (r.h - Z.spd - lab - 2.5) / 2;
    this._seg(String(v.mph).padStart(3, ' '), sx, top, Z.spd, C.amber, { right: true });
    this._txt('MPH', Z.lab, C.dim, sx, top + Z.spd + 2.5, 1, 0);
    // the tach: a row of blocks, amber to the orange band to the red line
    const tx = sx + 6, tw = r.x + r.w - 5 - tx, n = Math.max(12, Math.floor((tw + 1) / 5)), bw = (tw - (n - 1)) / n, ty = r.y + 4, th = 7;
    const lit = v.rpm / 9000 * n;
    for (let i = 0; i < n; i++) {
      const rr = (i + 0.5) / n * 9000, on = i + 0.5 <= lit;
      c.fillStyle = rr >= 7500 ? (on ? C.red : 'rgba(255,74,58,0.2)') : rr >= 6000 ? (on ? C.orange : 'rgba(255,138,42,0.15)') : (on ? C.amber : 'rgba(255,179,71,0.13)');
      c.fillRect(tx + i * (bw + 1), ty, bw, th);
    }
    // the boost under it, and the drift telltale beside it
    const ly = ty + th + 4, lw = this._tw('DRIFT', Z.labS) + 5;
    this._leds(tx, ly + 1, tw - lw - 5, 3.5, now, false);
    this._lamp('DRIFT', r.x + r.w - 5 - lw, ly - 0.5, v.drifting, C.amber);
  }

  // the angle meter ---------------------------------------------------------------------------------------

  /** A rail of blocks lit from the middle out to the side the car slides to; the far ends, pink, are the angle that scores the most. */
  _drawAngle(now) {
    const a = this.angleA;
    if (a <= 0.01) return;
    const c = this.ctx, v = this.v, r = this.L.angle, N = r.n, bw = r.bw, x0 = r.cx - r.w / 2, Z = this.Z;
    const degW = r.inline ? this._tw('00', Z.deg) + 6 : 0, edge = v.hot ? 'rgba(255,95,160,0.75)' : C.edge;
    // (on its own dark glass, so it reads over a pale dusk sky as well as the night)
    if (r.inline) this._panel(x0 - 5, r.y - 3, r.w + 10 + degW, r.h + 6, edge, a);
    else this._panel(x0 - 6, r.y - 4, r.w + 12, this.L.angleBot - r.y + 4, edge, a);
    c.globalAlpha = a;
    const lit = v.deg / 70 * N;
    for (let i = 0; i < 2 * N; i++) {
      const side = i < N ? -1 : 1, j = i < N ? N - 1 - i : i - N, deg = (j + 1) / N * 70, zone = deg > MAX_ANGLE + 1;
      const on = side === v.side && j + 0.5 <= lit;
      c.fillStyle = on ? (zone ? C.pink : j < N * 0.3 ? C.orange : C.gold) : zone ? 'rgba(255,95,160,0.22)' : 'rgba(255,179,71,0.15)';
      c.fillRect(x0 + i * (bw + 1), r.y, bw, r.h);
    }
    // the middle, and the ticks where the pink begins
    c.fillStyle = C.ink; c.fillRect(r.cx - 0.3, r.y - 1.5, 0.6, r.h + 3);
    c.fillStyle = C.pink;
    const zt = Math.round(MAX_ANGLE / 70 * N) * (bw + 1);
    c.fillRect(r.cx - zt - 0.8, r.y - 1.5, 0.6, r.h + 3); c.fillRect(r.cx + zt - 0.3, r.y - 1.5, 0.6, r.h + 3);
    c.globalAlpha = 1;
    const pk = this._p('deg', now), sc = pk >= 0 ? pop(pk, 1.8) : 1, col = v.hot ? C.pink : C.amber;
    if (r.inline) this._txt(v.deg + '°', Z.deg, col, x0 + r.w + 4, r.y + r.h / 2, 0, 0.5, sc, a);
    else {
      this._txt(v.deg + '°', Z.deg, col, r.cx, r.y + r.h + 3, 0.5, 0, sc, a);
      this._txt('L', Z.labS, C.dim, x0, r.y + r.h + 3, 0, 0, 1, a);
      this._txt('R', Z.labS, C.dim, x0 + r.w, r.y + r.h + 3, 1, 0, 1, a);
    }
  }

  // the drift count and its cash-in ------------------------------------------------------------------------

  _drawDrift(now) {
    const v = this.v, L = this.L, Z = this.Z, y = L.drift.y + this.coY, cx = L.drift.cx;
    if (this.driftA > 0.01 && v.active) {
      const a = this.driftA, pm = this._p('mult', now), pt = this._p('tier', now);
      const ps = this._spr('+' + v.pts.toLocaleString('en-US'), Z.pts, C.gold, 1), ms = this._spr('×' + v.mult.toFixed(1), Z.mult, C.orange, 0.8);
      const w = ps.w + 5 + ms.w, x0 = cx - w / 2, capB = ps.h;
      this._put(ps, x0, y, 0, 0, 1, a);
      this._put(ms, x0 + ps.w + 5, y + capB, 0, 1, pm >= 0 ? pop(pm, 1.7) : 1, a);
      const word = SCORE.tierNames[v.tier] || '';
      if (word) {
        let sc = 1, ta = a;
        if (pt >= 0) { sc = pt < 0.55 ? 2.2 - 1.26 * pt / 0.55 : 0.94 + 0.06 * (pt - 0.55) / 0.45; ta *= Math.min(1, pt / 0.3); }
        const col = TIER[v.tier] || C.ink;
        if (L.tierInline) this._txt(word, Z.tier, col, x0 + w + 6, y + capB, 0, 1, sc, ta, 0.8);
        else this._txt(word, Z.tier, col, cx, y + capB + 4, 0.5, 0, sc, ta, 0.8);
      }
    }
    // the cash-in: the banked points pop where the count was, then fly up into the score and shrink away
    if (this.bank) {
      const p = (now - this.bank.t0) / 700;
      if (p < 1) {
        const r = L.score, ty = r.y + r.h / 2, t = this.bank.tier, col = t === 1 ? '#c9fff6' : t === 2 ? '#ffe066' : t === 3 ? '#ffc2dc' : '#fff1b8';
        let a, sc, yy;
        if (p < 0.2) { const q = p / 0.2; a = q; sc = 1.5 - 0.5 * outBack(q); yy = y + 3 * (1 - q); }
        else if (p < 0.44) { a = 1; sc = 1 + 0.03 * (p - 0.2) / 0.24; yy = y; }
        else { const q = (p - 0.44) / 0.56, e = q * q; a = 1 - q; sc = 1.03 - 0.58 * e; yy = y + (ty - y - 6) * e; }
        this._txt('+' + this.bank.v.toLocaleString('en-US'), Z.pts, col, cx, yy, 0.5, 0, sc, a, 1, 'rgba(255,200,80,0.7)');
      }
    }
  }

  // the off-road countdown ----------------------------------------------------------------------------------

  _drawCourseOut(now) {
    const co = this.courseOut;
    if (!co || (!co.shown && !this.warming)) return;
    const c = this.ctx, L = this.L, Z = this.Z, r = L.co;
    const col = co.mode === 'hot' ? C.red : co.mode === 'mag' ? '#6ff0ff' : C.amber;
    const rr = Math.min(11, r.h / 2 - 4);
    const tw = Math.max(this._tw(co.head, Z.jp), this._tw(co.line, Z.coLine), r.sub ? this._tw(co.sub, Z.coSub) : 0);
    const w = 5 + 2 * rr + 7 + tw + 8 + 14 + 5, x = this.W / 2 - w / 2;
    // (the panel's glass, with a rose rule: the magnet's in cyan)
    this._rr(c, x, r.y, w, r.h, r.h / 2); c.fillStyle = 'rgba(30,10,26,0.82)'; c.fill();
    c.lineWidth = 0.6; c.strokeStyle = co.mode === 'mag' ? 'rgba(111,240,255,0.7)' : 'rgba(255,95,180,0.7)'; c.stroke();
    // the ring, going out a second at a time round the number
    const ox = x + 5 + rr, oy = r.y + r.h / 2;
    c.lineCap = 'round';
    c.lineWidth = 2.6; c.strokeStyle = 'rgba(255,255,255,0.1)'; c.beginPath(); c.arc(ox, oy, rr - 1.5, 0, TAU); c.stroke();
    if (co.f > 0.002) {
      c.strokeStyle = col; c.globalAlpha = co.mode === 'hot' ? 0.7 + 0.3 * co.glow : 1;
      c.beginPath(); c.arc(ox, oy, rr - 1.5, -Math.PI / 2, -Math.PI / 2 + co.f * TAU); c.stroke(); c.globalAlpha = 1;
    }
    c.lineCap = 'butt';
    if (co.mode === 'mag') this._magnet(ox + (co.glow - 0.5) * 1.5, oy, 0.75);
    else if (co.n !== null) this._seg(String(co.n), ox, oy - Z.co / 2, Z.co, col, { center: true, ghost: 0.08, sc: 1 + 0.9 * co.p * co.p });
    // the words: the Japanese racing term, what to do, and what happens if not
    const tx = ox + rr + 7;
    this._txt(co.head, Z.jp, '#ffc2d9', tx, r.y + 4, 0, 0);
    this._txt(co.line, Z.coLine, C.ink, tx, r.y + 4 + r.jcap + 4, 0, 0);
    if (r.sub) this._txt(co.sub, Z.coSub, C.dim, tx, r.y + 4 + r.jcap + 4 + this._fm(Z.coLine).cap + 3, 0, 0);
    this._magnet(x + w - 11, oy, 1);
  }

  /** The horseshoe magnet: a red U with steel tips. */
  _magnet(cx, cy, s) {
    const c = this.ctx, R = 5 * s, T = 2.1 * s;
    c.save();
    c.lineWidth = T * 2; c.strokeStyle = '#e8262c';
    c.beginPath(); c.moveTo(cx - R, cy - 5 * s); c.lineTo(cx - R, cy); c.arc(cx, cy, R, Math.PI, 0, true); c.lineTo(cx + R, cy - 5 * s); c.stroke();
    c.fillStyle = '#dde2e8'; c.fillRect(cx - R - T, cy - 7.5 * s, 2 * T, 2.6 * s); c.fillRect(cx + R - T, cy - 7.5 * s, 2 * T, 2.6 * s);
    c.restore();
  }

  // the smash counter, the callouts, the hint, the caption ----------------------------------------------------

  _drawSmash(now) {
    const sm = this.smashS;
    if (!sm) return;
    const p = (now - sm.t0) / 1700;
    if (p >= 1) return;
    const Z = this.Z, sc = p < 0.2 ? 1.75 - 0.75 * outBack(p / 0.2) : 1, a = p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2, dy = p < 0.8 ? 0 : -5 * (p - 0.8) / 0.2;
    const y = this.L.smashY + dy, subCap = this._fm(Z.smashSub).cap;
    this._txt(sm.label, Z.smash, C.gold, this.L.drift.cx, y - 3 - subCap, 0.5, 1, sc, a, 1, 'rgba(255,150,40,0.6)');
    this._txt(sm.sub, Z.smashSub, C.rose, this.L.drift.cx, y, 0.5, 1, 1, a, 0.8);
  }

  _drawToast(now) {
    const y0 = this.L.toastY, cx = this.L.drift.cx, Z = this.Z;
    const one = (t, p, out) => {
      const [col, glow] = TOAST[t.cls] || TOAST[''], f = t.big ? Z.toastBig : Z.toast;
      let a, sc, dy;
      if (out !== undefined) { a = 1 - out; sc = 1 - 0.1 * out; dy = -9 * out; }
      else {
        a = p < 0.1 ? p / 0.1 : p < 0.78 ? 1 : 1 - (p - 0.78) / 0.22;
        sc = p < 0.1 ? 0.8 + 0.28 * p / 0.1 : p < 0.24 ? 1.08 - 0.08 * (p - 0.1) / 0.14 : 1;
        dy = p < 0.1 ? 6 * (1 - p / 0.1) : p < 0.24 ? 0 : -13 * (p - 0.24) / 0.76;
      }
      const h = this._txt(t.text, f, col, cx, y0 + dy, 0.5, 0, sc, a, 1, glow);
      if (t.sub) this._txt(t.sub, Z.sub, C.ink, cx, y0 + dy + h.h * sc + 4, 0.5, 0, 1, a, 0.8);
    };
    if (this.prev) { const q = (now - this.prev.out0) / 180; if (q < 1) one(this.prev, 0, q); }
    if (this.cur) { const p = (now - this.cur.t0) / 1350; if (p < 1) one(this.cur, p); }
  }

  /** The first-run hint, as a 90s game's dialogue box: the words, and a cursor blinking in its corner. */
  _drawCoach(now) {
    const a = this.coachA;
    if (a <= 0.01) return;
    const c = this.ctx, r = this.L.coach, f = this.Z.coach;
    const words = this.touch
      ? [['DRIFT', C.amber], ['TAP', C.ink], ['THE', C.ink], ['HANDBRAKE', C.amber], ['INTO', C.ink], ['A', C.ink], ['CORNER,', C.ink], ['STEER', C.ink], ['INTO', C.ink], ['THE', C.ink], ['SLIDE', C.ink]]
      : [['DRIFT', C.amber], ['TAP', C.ink], ['SPACE', C.amber], ['INTO', C.ink], ['A', C.ink], ['CORNER', C.ink], ['·', C.dim], ['STEER', C.ink], ['INTO', C.ink], ['THE', C.ink], ['SLIDE', C.ink], ['·', C.dim], ['HOLD', C.ink], ['W', C.amber]];
    const sp = this._tw(' ', f) + f.ls, maxW = r.w - 16, lines = [[]];
    let lw = 0;
    for (const [t, col] of words) {
      const w = this._tw(t, f);
      if (lw > 0 && lw + sp + w > maxW) { lines.push([]); lw = 0; }
      lines[lines.length - 1].push([t, col, lw + (lw > 0 ? sp : 0)]); lw += (lw > 0 ? sp : 0) + w;
    }
    const cap = this._fm(f).cap, lh = cap + 4.5;
    const bw = Math.min(r.w, Math.max(...lines.map((l) => { const e = l[l.length - 1]; return e[2] + this._tw(e[0], f); })) + 16);
    const bh = lines.length * lh + 8, bx = r.cx - bw / 2, by = r.y;
    this._panel(bx, by, bw, bh, 'rgba(255,179,71,0.6)', a);
    lines.forEach((l, i) => { for (const [t, col, x] of l) this._txt(t, f, col, bx + 8 + x, by + 5 + i * lh, 0, 0, 1, a); });
    if (Math.floor(now / 400) % 2 === 0) {
      c.globalAlpha = a; c.fillStyle = C.amber;
      const tx = bx + bw - 7, ty = by + bh - 5;
      c.beginPath(); c.moveTo(tx - 2.5, ty - 2); c.lineTo(tx + 2.5, ty - 2); c.lineTo(tx, ty + 1); c.closePath(); c.fill();
      c.globalAlpha = 1;
    }
  }

  /** The set's caption as a run starts: the channel in its green, what is on under it. */
  _drawTV(now) {
    const tv = this.tv;
    if (!tv) return;
    const p = (now - tv.t0) / 3000;
    if (p >= 1) return;
    // (it comes on at once and blinks off at the end, as a set's caption did)
    if (p > 0.82 && Math.floor(p * 40) % 2 === 1) return;
    const r = this.L.tv, Z = this.Z;
    const s = this._txt('CH ' + String(tv.n).padStart(2, '0'), Z.ch, C.green, r.x + 1, r.y, 0, 0, 1, 1, 0.7, 'rgba(125,255,138,0.5)');
    this._txt(tv.label, Z.chLab, C.green, r.x + 1, r.y + s.h + 4, 0, 0, 1, 1, 0.6);
  }

  // the thumbs ------------------------------------------------------------------------------------------------

  /**
   * On a phone: where the thumbs go and what they are doing, drawn where the tube shows the finger (the OSD point is
   * the finger's point pushed through the glass's curve): the handbrake's pad in the right-hand corner, and under the
   * left thumb the wheel it holds, the knob red while it pulls down to brake and grey while it lifts off the gas.
   */
  _drawThumbs(now) {
    const c = this.ctx, L = this.L, t = this.input && this.input.t, Z = this.Z;
    if (!t) return;
    // the handbrake pad
    {
      const x = L.pad.x, y = L.pad.y, r = L.pad.r;
      c.fillStyle = t.hand ? 'rgba(255,59,48,0.55)' : 'rgba(12,8,20,0.38)';
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.lineWidth = 1; c.strokeStyle = t.hand ? C.red : 'rgba(246,239,226,0.5)';
      c.beginPath(); c.arc(x, y, r - 0.5, 0, TAU); c.stroke();
      const col = t.hand ? '#ffffff' : 'rgba(246,239,226,0.92)';
      this._txt('HAND', Z.lab, col, x, y - 1.5, 0.5, 1);
      this._txt('BRAKE', Z.lab, col, x, y + 1.5, 0.5, 0);
    }
    // the wheel under the left thumb
    if (t.active) {
      const R = t.R || 72, sx = t.x0, sy = t.y0, n = 13;
      for (let i = 0; i <= n; i++) {
        const [x, y] = this._toTex(sx - R + 2 * R * i / n, sy);
        c.fillStyle = i === n / 2 ? 'rgba(246,239,226,0.8)' : 'rgba(246,239,226,0.38)';
        c.beginPath(); c.arc(x, y, 0.9, 0, TAU); c.fill();
      }
      const [cx0, cy0] = this._toTex(sx, sy);
      c.fillStyle = 'rgba(246,239,226,0.7)'; c.fillRect(cx0 - 0.4, cy0 - 5, 0.8, 10);
      const kx = clamp((t.x || sx) - sx, -R, R);
      const [nx, ny] = this._toTex(sx + kx, sy);
      const state = t.brake > 0.05 ? 'brake' : t.lift ? 'lift' : 'gas';
      const fill = state === 'brake' ? 'rgba(255,59,48,0.75)' : state === 'lift' ? 'rgba(170,170,180,0.65)' : 'rgba(255,179,71,0.5)';
      const kr = 15 / this.kx;
      c.fillStyle = fill; c.beginPath(); c.arc(nx, ny, kr, 0, TAU); c.fill();
      c.lineWidth = 1; c.strokeStyle = state === 'brake' ? C.red : 'rgba(246,239,226,0.9)'; c.beginPath(); c.arc(nx, ny, kr - 0.5, 0, TAU); c.stroke();
      this._txt(state === 'brake' ? (t.brake > 0.5 ? 'REVERSE' : 'BRAKE') : state === 'lift' ? 'LIFT' : 'GAS', Z.lab, state === 'brake' ? '#ff7a6a' : C.ink, nx, ny + kr + 3, 0.5, 0, 1, 1, 0.6);
    } else if (!t.used) {
      // before the first touch of a session: what the thumbs do
      const x = L.hint.x, y = L.hint.y, lh = this.labCap + 5;
      const rows = [['HOLD', 'TO DRIVE'], ['SLIDE', 'TO STEER'], ['PULL DOWN', 'TO BRAKE']];
      rows.forEach(([a, b], i) => {
        const yy = y - (rows.length - i) * lh;
        const s = this._txt(a, Z.lab, C.amber, x, yy, 0, 0, 1, 1, 0.6);
        this._txt(b, Z.lab, C.ink, x + s.w + 4, yy, 0, 0, 1, 1, 0.6);
      });
    }
  }
}
