/**
 * The HUD, on the TV.
 *
 * Everything a run shows (the score, the combo and the distance, the clock, the dash, the drift count and its cash-in,
 * the callouts, the angle meter, the off-road countdown, the first-run hint, the two buttons, and on a phone where the
 * thumbs go) is drawn by script into a small canvas at about the resolution of a 90s set, 360 lines on a desktop, in
 * pixel type. The tube pass (post.js) lays it over the picture before the glass does anything to it, so it bends with
 * the screen's curve, darkens into the rim, takes the scanlines, the colour grain and the aperture grille, and glows a
 * little the way a CRT's phosphor bleeds: the set's own on-screen display rather than a sticker on the glass.
 *
 * Every string, with its hard outline and drop shadow, is drawn once and kept as a sprite, and the canvas is redrawn
 * (and sent to the GPU) only when something on it has changed or is moving.
 *
 * The rewards are as they were: a banked drift flashes where the live count was and flies up into the score, which
 * pulses as it lands and only then rolls up; a bigger drift gets its tier called out; the multiplier, the tier and the
 * combo punch as they climb; past the angle that scores the most the angle meter burns pink; a banked drift's minutes
 * fly off the clock it moved. On a phone that can (Android), a short buzz goes with the big moments.
 */
import * as THREE from 'three';
import { SCORE, clamp, damp } from './config.js?v=202609242050';

const $ = (id) => document.getElementById(id);
// the slide angle past which a drift scores the most: scoring.js's angle factor tops out at 1.5 x 0.55 rad, 47 degrees
const MAX_ANGLE = 47;
const TAU = Math.PI * 2;

// the type: pixel faces at the sizes they were drawn for, so every stroke lands on whole texels
const F = {
  lab: '700 8px Silkscreen, "Share Tech Mono", monospace',
  s10: '10px "Jersey 10", "Share Tech Mono", monospace',
  s15: '15px "Jersey 15", "Share Tech Mono", monospace',
  s20: '20px "Jersey 10", "Share Tech Mono", monospace',
  s30: '30px "Jersey 15", "Share Tech Mono", monospace',
  jp: '16px DotGothic16, "Hiragino Sans", "Yu Gothic", sans-serif',
};
const C = {
  amber: '#ffb347', gold: '#ffd23f', orange: '#ff8a2a', pink: '#ff5fa0', rose: '#ff9ccb', cyan: '#5ad1ff', ice: '#c9f1ff',
  teal: '#8ff5e6', mint: '#9ff0b8', red: '#ff4a3a', ink: '#f6efe2', dim: '#b3aa9f', dark: '#140a1e', green: '#7dff8a',
  panel: 'rgba(12,8,20,0.76)', edge: 'rgba(255,179,71,0.45)', ghost: 'rgba(255,179,71,0.2)',
};
const TOAST = { '': C.gold, good: C.teal, bad: C.red, calm: '#ffd9e8', t1: C.teal, t2: C.gold, t3: C.pink, clip: C.mint };
const TIER = ['', C.teal, C.gold, C.pink];
// (the pixel faces have no middle dot or times sign)
const clean = (s) => String(s).replace(/·/g, '-').replace(/×/g, 'x').replace(/—/g, '-');

const W2 = (h) => h.W / 2;
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
    this.U = null; this.input = null; this.courseOut = null;
    this.tube = { curve: 0.022, edge: 0.055 };
    this.vw = 1; this.vh = 1; this.W = 4; this.H = 4; this.kx = 1; this.ky = 1; this.pr = 1;
    this.el = { hud: $('hud'), perf: $('perf'), btns: $('hbtns'), mute: $('mute'), pauseb: $('pauseb'), pause: $('pause') };
    this.visible = false; this.warming = false; this.dirty = true; this.sig = '';
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
    this.v = { score: 0, combo: 0, chain: 0, mph: 0, gear: 'n', rpm: 900, leds: 0, boosting: false, drifting: false, clip: false,
               slide: false, deg: 0, side: 1, hot: false, hh: 18, mm: 0, day: true, dist: 0, pts: 0, mult: 1, tier: 0, active: false };
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
    if (tube) this.tube = tube;
    if (uniforms) { uniforms.tHud.value = this.texture; uniforms.uHudOn.value = this.visible ? 1 : 0; }
  }

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
   * The set's resolution for this window: about 360 lines on a desktop (a texel is 2 CSS px at 720 tall, 3 at 1080), and
   * 2 CSS px a texel on a phone either way up, so the type is big enough for a thumb's-length look.
   */
  resize(vw, vh, pr = 1) {
    this.vw = Math.max(1, vw); this.vh = Math.max(1, vh); this.pr = pr;
    const k = Math.max(2, Math.round(Math.min(this.vw / 195, this.vh / 360)));
    this.W = Math.ceil(this.vw / k); this.H = Math.ceil(this.vh / k);
    this.kx = this.vw / this.W; this.ky = this.vh / this.H;
    this.canvas.width = this.W; this.canvas.height = this.H;
    this.ctx.imageSmoothingEnabled = false;
    if (this.U) { this.U.uHudSize.value.set(this.W, this.H); this.U.uHudScale.value = this.kx * pr; }
    this.touch = document.body.classList.contains('touch');
    this._layout();
    this.dirty = true; this.sig = '';
  }

  /** Where a point on the screen (CSS px) has to be drawn on the OSD to be seen there, through the tube's curve (post.js). */
  _toTex(sx, sy) {
    const u = sx / this.vw, v = 1 - sy / this.vh, cx = u * 2 - 1, cy = v * 2 - 1, r2 = (cx * cx + cy * cy) * 0.5;
    const kk = this.tube.curve * r2 + this.tube.edge * r2 * r2;
    return [(u + cx * kk) * this.W, (1 - (v + cy * kk)) * this.H];
  }

  /** Where a texel of the OSD is seen on the screen (CSS px): the curve undone, a few steps of fixed point. */
  _toScreen(tx, ty) {
    const tu = tx / this.W, tv = 1 - ty / this.H;
    let u = tu, v = tv;
    for (let i = 0; i < 6; i++) {
      const cx = u * 2 - 1, cy = v * 2 - 1, r2 = (cx * cx + cy * cy) * 0.5, kk = this.tube.curve * r2 + this.tube.edge * r2 * r2;
      u = tu - cx * kk; v = tv - cy * kk;
    }
    return [u * this.vw, (1 - v) * this.vh];
  }

  // ---------------------------------------------------------------- type

  _loadFonts() {
    if (!document.fonts || !document.fonts.load) return;
    const want = [[F.lab, 'SCORE'], [F.s10, '0'], [F.s15, '0'], [F.jp, 'コースアウトマグネット']];
    Promise.all(want.map(([f, t]) => document.fonts.load(f, t).catch(() => null))).then(() => {
      // (what was drawn before the faces came was drawn in the fallback: all of it again)
      this.cache.clear(); this.fmc.clear(); this._layout(); this.dirty = true; this.sig = '';
    });
  }

  /** A face's measures: the height of its capitals, its descent, and the width of a digit. */
  _fm(font) {
    let f = this.fmc.get(font);
    if (f) return f;
    const m = this.mc; m.font = font;
    const px = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)[1]);
    const a = m.measureText('HO08'), d = m.measureText('gjpy,');
    f = { px, cap: Math.max(1, Math.round(a.actualBoundingBoxAscent || px * 0.7)), desc: Math.max(1, Math.round(d.actualBoundingBoxDescent || px * 0.2)),
          dw: Math.max(1, Math.round(m.measureText('0').width)) };
    this.fmc.set(font, f);
    return f;
  }

  _w(text, font) { this.mc.font = font; return Math.ceil(this.mc.measureText(text).width); }

  /** A string with a hard dark outline and a drop shadow under it (ol 0: bare), drawn once and kept. */
  _spr(text, font, color, ol = 1) {
    const key = font + '|' + color + '|' + ol + '|' + text;
    let s = this.cache.get(key);
    if (s) return s;
    if (this.cache.size > 700) this.cache.clear();
    const fm = this._fm(font), w = Math.max(1, this._w(text, font)), pad = ol + 2;
    const cv = document.createElement('canvas');
    cv.width = w + pad * 2; cv.height = fm.cap + fm.desc + pad * 2;
    const c = cv.getContext('2d');
    c.font = font; c.textBaseline = 'alphabetic';
    const bx = pad, by = pad + fm.cap;
    if (ol > 0) {
      c.fillStyle = C.dark;
      c.fillText(text, bx + 1, by + 2); c.fillText(text, bx, by + 2); c.fillText(text, bx + 2, by + 2);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) c.fillText(text, bx + dx, by + dy);
    }
    c.fillStyle = color; c.fillText(text, bx, by);
    s = { c: cv, w, h: fm.cap, ox: pad, oy: pad };
    this.cache.set(key, s);
    return s;
  }

  /** Draw a sprite so the point (ax, ay) of its text box (fractions of its width and cap height) lands on (x, y). */
  _put(s, x, y, ax = 0, ay = 0, sc = 1, a = 1) {
    if (a <= 0.01 || sc <= 0.02) return;
    const c = this.ctx;
    if (a < 1) c.globalAlpha = a;
    const dx = Math.round(x - (ax * s.w + s.ox) * sc), dy = Math.round(y - (ay * s.h + s.oy) * sc);
    if (Math.abs(sc - 1) < 0.01) c.drawImage(s.c, dx, dy);
    else c.drawImage(s.c, dx, dy, Math.max(1, Math.round(s.c.width * sc)), Math.max(1, Math.round(s.c.height * sc)));
    if (a < 1) c.globalAlpha = 1;
  }

  _txt(text, font, color, x, y, ax = 0, ay = 0, sc = 1, a = 1, ol = 1) {
    const s = this._spr(text, font, color, ol);
    this._put(s, x, y, ax, ay, sc, a);
    return s;
  }

  /** A panel of the OSD: dark glass, a one-texel amber rule with its corners rounded off, brighter brackets at the corners. */
  _panel(x, y, w, h, edge = C.edge, a = 1) {
    const c = this.ctx;
    if (a < 1) c.globalAlpha = a;
    c.fillStyle = C.panel; c.fillRect(x + 1, y + 1, w - 2, h - 2);
    c.fillStyle = edge;
    c.fillRect(x + 2, y, w - 4, 1); c.fillRect(x + 2, y + h - 1, w - 4, 1); c.fillRect(x, y + 2, 1, h - 4); c.fillRect(x + w - 1, y + 2, 1, h - 4);
    c.fillRect(x + 1, y + 1, 1, 1); c.fillRect(x + w - 2, y + 1, 1, 1); c.fillRect(x + 1, y + h - 2, 1, 1); c.fillRect(x + w - 2, y + h - 2, 1, 1);
    c.fillStyle = 'rgba(255,214,150,0.75)';
    c.fillRect(x + 2, y, 3, 1); c.fillRect(x, y + 2, 1, 3); c.fillRect(x + w - 5, y + h - 1, 3, 1); c.fillRect(x + w - 1, y + h - 5, 1, 3);
    if (a < 1) c.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- the layout

  _layout() {
    const W = this.W, H = this.H, mn = Math.min(W, H);
    const P = this.portrait = this.vh > this.vw;
    const S = this.compact = W < 300 || H < 250;
    const m = Math.max(6, Math.round(0.045 * mn)), sa = this._safe();
    // (clear of the notch and the home bar, as the tube shows them)
    const top = Math.max(m, Math.ceil(this._toTex(this.vw / 2, sa.t + 4)[1]));
    const bot = Math.min(H - m, Math.floor(this._toTex(this.vw / 2, this.vh - sa.b - 4)[1]));
    const left = Math.max(m, Math.ceil(this._toTex(sa.l + 4, this.vh / 2)[0]));
    const right = Math.min(W - m, Math.floor(this._toTex(this.vw - sa.r - 4, this.vh / 2)[0]));
    const L = this.L = { top, bot, left, right, S, P };
    this.fScore = S ? F.s15 : F.s30;             // the score
    this.fS = S ? F.s15 : F.s20;                 // the combo, the clock
    this.fBig = S ? F.s20 : F.s30;               // the drift count, a big callout
    this.fMid = S ? F.s15 : F.s20;               // the multiplier, a callout
    this.fSm = S ? F.s10 : F.s15;                // the distance, the degrees
    const lab = this._fm(F.lab).cap, capS = this._fm(this.fS).cap;
    this.labCap = lab;

    // the top row: the combo and the distance on the left, the score in the middle, the clock on the right
    const ph = 3 + lab + 3 + capS + 5;
    let phs = 3 + lab + 3 + this._fm(this.fScore).cap + 5;
    const sw = 8 * this._fm(this.fScore).dw + 12;
    L.score = { x: Math.round(W / 2 - sw / 2), y: top, w: sw, h: phs };
    const cw = Math.max(this._w('COMBO', F.lab) + 12, S ? 44 : 62);
    const capM = this._fm(this.fS).cap, capSm = this._fm(this.fSm).cap;
    L.combo = { x: left, y: top, w: cw, h: 3 + lab + 3 + capM + 4 + (S ? 2 : 3) + 5 + capSm + 5 };
    const tw = Math.max(this._w('00:00', this.fS) + 12 + (S ? 0 : 4), this._w('TIME', F.lab) + 6 + 4 + 7 + 5);
    L.time = { x: right - tw, y: top, w: tw, h: ph };
    // the buttons: sound and pause, a thumb's width each on a phone
    const bs = S ? 18 : 16, gap = 4;
    if (S && !P) L.btns = [{ x: L.time.x - gap - 2 * bs - 3, y: top, w: bs, h: bs }, { x: L.time.x - gap - bs, y: top, w: bs, h: bs }];
    else L.btns = [{ x: right - 2 * bs - 3, y: top + ph + gap, w: bs, h: bs }, { x: right - bs, y: top + ph + gap, w: bs, h: bs }];
    // (a narrow screen whose middle is crowded: the score keeps clear of its neighbours, in smaller digits if it must)
    const lo = L.combo.x + L.combo.w + 3, hi = (S && !P ? L.btns[0].x : L.time.x) - 3;
    if (hi - lo < sw) {
      this.fScore = F.s10;
      L.score.w = 8 * this._fm(F.s10).dw + 12; L.score.h = 3 + lab + 3 + this._fm(F.s10).cap + 5;
    }
    L.score.x = clamp(Math.round(W / 2 - L.score.w / 2), lo, Math.max(lo, hi - L.score.w));
    phs = L.score.h;
    L.clockAdd = S ? { x: right, y: Math.max(L.btns[0].y + bs, L.time.y + L.time.h) + 5, ax: 1, ay: 0 } : { x: L.time.x - 6, y: top + Math.round(ph / 2), ax: 1, ay: 0.5 };
    L.tv = { x: left, y: L.combo.y + L.combo.h + 6 };

    // the drift stack under the score
    const capB = this._fm(this.fBig).cap, capT = this._fm(F.s15).cap;
    L.drift = { cx: Math.round(W / 2), y: top + phs + (S ? 6 : 8) };
    L.tierInline = (S || this.touch) && !P;
    L.driftBot = L.drift.y + capB + 4 + (L.tierInline ? 0 : capT + 4);

    // the dash: a round bar-graph tach on a desktop, a strip along the bottom on a phone or a tablet (the dial sat
    // where the right thumb goes)
    const strip = L.strip0 = S || this.touch;
    if (!strip) {
      const R = Math.round(clamp(H * 0.14, 40, 60));
      L.dial = { cx: right - R - 4, cy: bot - 14 - R, R, t: Math.max(5, Math.round(R * 0.14)) };
      L.leds = { x: L.dial.cx - R, y: L.dial.cy - R - 12, w: 2 * R, h: 5 };
      L.dash = { x: L.dial.cx - R - 4, y: L.leds.y - 10, w: 2 * R + 8, h: bot - L.leds.y + 10 };
    } else {
      const w = P ? right - left : Math.min(S ? 210 : 260, Math.round(W * 0.5)), h = S ? 28 : 30;
      L.strip = { x: P ? left : Math.round(W / 2 - w / 2), y: bot - h, w, h };
      L.dash = L.strip;
    }

    // the angle meter: bottom middle on a desktop, above the dash on a phone on its side, under the drift count upright
    const N = S ? (P ? 12 : 11) : 14, bw = S ? 4 : 5, rh = S ? 5 : 7, aw = 2 * N * (bw + 1) - 1;
    if (!strip) {
      // (bottom middle, clear of the dial in a squarish window)
      const cx = Math.max(left + aw / 2 + 8, Math.min(Math.round(W / 2), L.dash.x - 10 - aw / 2));
      L.angle = { cx: Math.round(cx), y: bot - 26, n: N, bw, h: rh, w: aw };
    } else if (P) L.angle = { cx: Math.round(W / 2), y: L.driftBot + 6, n: N, bw, h: rh, w: aw };
    // (on its side, the car fills the bottom middle: the meter goes under the drift count, its degrees beside it)
    else L.angle = { cx: Math.round(W / 2) - 8, y: L.driftBot + 4, n: N, bw, h: rh, w: aw, inline: true };
    L.angleBot = L.angle.inline ? L.angle.y + rh + 4 : L.angle.y + rh + 4 + this._fm(this.fSm).cap + 5;

    // the off-road countdown: under the score (the drift count steps down out of its way), or on a phone held upright,
    // under the angle meter, where nothing has to move
    // (its width is its words'; its third line only where there is room for it)
    const jcap = 13, coSub = !(S && P), coH = 3 + jcap + 4 + lab + (coSub ? 3 + lab : 0) + 5, coW = 150;
    if (S && P) L.co = { x: Math.round(W / 2 - coW / 2), y: L.angleBot + 6, w: coW, h: coH, shift: 0, sub: coSub, jcap };
    else L.co = { x: Math.round(W / 2 - coW / 2), y: top + phs + 5, w: coW, h: coH, shift: coH + 6, sub: coSub, jcap };

    // the callouts, above the road ahead and clear of the drift count; the smash counter just above the car
    L.toastY = Math.max(Math.round(H * (P ? 0.3 : 0.33)), (strip && !P ? L.angleBot : L.driftBot) + 8);
    L.smashY = Math.round(H * (P ? 0.45 : 0.5));
    // the first-run hint: under the top row upright, in the drift count's place on its side, above the angle meter
    if (S && P) L.coach = { cx: Math.round(W / 2), y: L.combo.y + L.combo.h + 6, w: right - left };
    else if (strip) L.coach = { cx: Math.round(W / 2), y: L.drift.y, w: Math.round(W * 0.62) };
    else L.coach = { cx: Math.round(W / 2), y: L.angle.y - 58, w: Math.round(W * 0.7) };

    // the thumbs (a phone): the handbrake's pad in the right thumb's corner, clear of the dash; the steering hint left
    const pr = Math.round((S ? 46 : 52) / this.kx);
    L.pad = { x: right - pr - 2, y: P ? L.dash.y - 8 - pr : bot - pr - 2, r: pr };
    L.hint = { x: left + 4, y: P ? L.dash.y - 8 : bot - 2 };
    this._faceKey = '';
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

  /** Where everything is on the OSD, in its texels (for the overlap check in work/: exact, where a screen box is not). */
  rects() {
    const L = this.L, a = L.angle, out = { score: L.score, combo: L.combo, time: L.time, btn0: L.btns[0], btn1: L.btns[1], dash: L.dash, co: L.co };
    out.angle = a.inline ? { x: a.cx - a.w / 2 - 5, y: a.y - 4, w: a.w + 12 + this._w('00', this.fSm) + 8, h: a.h + 8 } : { x: a.cx - a.w / 2 - 7, y: a.y - 6, w: a.w + 14, h: L.angleBot - a.y + 6 };
    if (this.touch) out.pad = { x: L.pad.x - L.pad.r, y: L.pad.y - L.pad.r, w: 2 * L.pad.r, h: 2 * L.pad.r };
    out.W = this.W; out.H = this.H;
    return out;
  }

  /** Where everything is on the screen, in CSS px (for the checks in work/). */
  boxes() {
    const L = this.L, out = {};
    const box = (r) => { const [x0, y0] = this._toScreen(r.x, r.y), [x1, y1] = this._toScreen(r.x + r.w, r.y + r.h); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };
    for (const k of ['score', 'combo', 'time', 'dash', 'co']) if (L[k]) out[k] = box(L[k]);
    out.btn0 = box(L.btns[0]); out.btn1 = box(L.btns[1]);
    out.angle = box({ x: L.angle.cx - L.angle.w / 2, y: L.angle.y, w: L.angle.w, h: L.angle.h + 14 });
    out.pad = box({ x: L.pad.x - L.pad.r, y: L.pad.y - L.pad.r, w: 2 * L.pad.r, h: 2 * L.pad.r });
    return out;
  }

  // ---------------------------------------------------------------- showing, warming, resetting

  show(on) {
    this.visible = on;
    if (this.U) this.U.uHudOn.value = on ? 1 : 0;
    if (this.el.hud) this.el.hud.classList.toggle('on', on);
    if (this.el.btns) this.el.btns.classList.toggle('on', on);
    this.dirty = true; this.sig = '';
  }

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
      this._draw(now); this.texture.needsUpdate = true;
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
    this.smashS = { label: clean(label), sub: (n > 1 ? 'SMASH x' + n + ' - ' : '') + '+' + Math.round(total), t0: performance.now() };
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
  channel(n, label) { this.tv = { n, label: clean(label), t0: performance.now() }; this.dirty = true; }

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
        if (word) this.toast(word + ' DRIFT!', 't' + e.tier, e.tier >= 2, e.chain > 1 ? 'COMBO x' + e.chain : '', 2);
        if (e.value >= 100) this.buzz(e.tier >= 3 ? [26, 40, 26, 40, 50] : e.tier === 2 ? [20, 40, 24] : e.tier === 1 ? 18 : 10);
        if (!this.coached) { this.coached = true; try { localStorage.setItem('sundrift.drifted', '1'); } catch {} }
        break;
      }
      case 'switch': this._anim('combo', 340); this.toast('SWITCH!', 'good', false, '', 1); break;
      case 'clip': this.toast('CLIP!', 'clip', false, '+' + Math.round(e.value), 1); this.clipT = 0.9; this.buzz(14); break;
      case 'crash': this.toast('CRASH', 'bad', true, '-' + Math.round(e.value) + ' LOST', 3); this.hitFlash = 1; this.buzz(70); break;
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

    if (!this.visible) return;
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
    c.clearRect(0, 0, this.W, this.H);
    c.imageSmoothingEnabled = false;
    if (!this.visible && !this.warming) return;
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
    const c = this.ctx, L = this.L, v = this.v, lab = this.labCap;
    // the score: eight digits, the unlit leading ones ghosting through, a gold flash round it as a drift lands in it
    {
      const r = L.score, fl = this._p('sflash', now), pk = this._p('score', now);
      this._panel(r.x, r.y, r.w, r.h);
      if (fl >= 0) {
        const a = fl < 0.15 ? fl / 0.15 : 1 - (fl - 0.15) / 0.85;
        c.globalAlpha = clamp(a, 0, 1);
        c.fillStyle = C.gold;
        c.fillRect(r.x, r.y - 1, r.w, 1); c.fillRect(r.x, r.y + r.h, r.w, 1); c.fillRect(r.x - 1, r.y, 1, r.h); c.fillRect(r.x + r.w, r.y, 1, r.h);
        c.fillStyle = 'rgba(255,210,63,0.5)';
        c.fillRect(r.x, r.y, r.w, 1); c.fillRect(r.x, r.y + r.h - 1, r.w, 1); c.fillRect(r.x, r.y, 1, r.h); c.fillRect(r.x + r.w - 1, r.y, 1, r.h);
        c.globalAlpha = 1;
      }
      this._txt(this.newBestLab ? 'NEW BEST' : 'SCORE', F.lab, this.newBestLab ? C.gold : C.dim, r.x + r.w / 2, r.y + 3, 0.5, 0, 1, 1, 0);
      const str = String(Math.max(0, v.score)).slice(-8), pad = 8 - str.length;
      const sc = pk >= 0 ? 1 + 0.1 * Math.sin(pk * Math.PI) : 1;
      const xr = r.x + r.w - 6, y = r.y + 3 + lab + 3;
      const n = this._txt(str, this.fScore, C.amber, xr, y, 1, 0, sc);
      if (pad > 0) this._txt('0'.repeat(pad), this.fScore, C.ghost, xr - n.w * sc, y, 1, 0, sc, 1, 0);
    }
    // the combo, the chain's time left, and the distance
    {
      const r = L.combo, pk = this._p('combo', now), S = L.S;
      this._panel(r.x, r.y, r.w, r.h);
      this._txt('COMBO', F.lab, C.dim, r.x + 6, r.y + 3, 0, 0, 1, 1, 0);
      const y = r.y + 3 + lab + 3;
      const xs = this._txt('x', this.fS, C.amber, r.x + 6, y);
      this._txt(String(v.combo), this.fS, v.combo > 1 ? C.ink : C.dim, r.x + 6 + xs.w + 1, y + this._fm(this.fS).cap, 0, 1, pk >= 0 ? pop(pk, 1.9) : 1);
      const by = y + this._fm(this.fS).cap + 4, bh = S ? 2 : 3, n = 10, bw = (r.w - 12 - (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        const on = (i + 0.5) / n <= v.chain;
        c.fillStyle = on ? (i >= 7 ? C.gold : C.orange) : 'rgba(255,255,255,0.12)';
        c.fillRect(Math.round(r.x + 6 + i * (bw + 1)), by, Math.max(1, Math.round(bw)), bh);
      }
      const dy = by + bh + 5;
      this._txt('MI', F.lab, C.dim, r.x + 6, dy + this._fm(this.fSm).cap, 0, 1, 1, 1, 0);
      const miles = (v.dist / 10).toFixed(1);
      this._txt(miles, this.fSm, C.amber, r.x + r.w - 6, dy, 1, 0);
    }
    // the clock: the hour the run has reached, a sun or a moon by it, its colon blinking
    {
      const r = L.time, pk = this._p('clock', now);
      this._panel(r.x, r.y, r.w, r.h);
      this._txt('TIME', F.lab, C.dim, r.x + 6, r.y + 3, 0, 0, 1, 1, 0);
      this._sunMoon(r.x + r.w - 9, r.y + 3 + (lab >> 1), v.day);
      const y = r.y + 3 + lab + 3, sc = pk >= 0 ? 1 + 0.12 * Math.sin(pk * Math.PI) : 1;
      const colW = this._w(':', this.fS), cx = r.x + r.w / 2 + 1;
      this._txt(String(v.hh).padStart(2, '0'), this.fS, C.amber, cx - colW / 2 - 1, y, 1, 0, sc);
      if (v.colon) this._txt(':', this.fS, C.amber, cx, y, 0.5, 0, sc);
      this._txt(String(v.mm).padStart(2, '0'), this.fS, C.amber, cx + colW / 2 + 1, y, 0, 0, sc);
    }
    // a banked drift's minutes, flying off the clock it just moved
    if (this.clockAddS) {
      const p = (now - this.clockAddS.t0) / 1700, a = L.clockAdd;
      if (p < 1) {
        const al = p < 0.14 ? p / 0.14 : p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
        const dx = p < 0.14 ? 7 * (1 - p / 0.14) : -2 * (p - 0.14) / 0.56 - (p > 0.7 ? 4 * (p - 0.7) / 0.3 : 0);
        const dy = p < 0.14 ? 2 * (1 - p / 0.14) : -5 * Math.max(0, p - 0.14);
        const sc = p < 0.14 ? 0.8 + 0.28 * p / 0.14 : p < 0.7 ? 1.08 - 0.08 * (p - 0.14) / 0.56 : 1;
        this._txt(this.clockAddS.text, this.fS, C.gold, a.x + dx, a.y + dy, a.ax, a.ay, sc, al);
      }
    }
    // the buttons
    const muted = this.el.mute && this.el.mute.classList.contains('off');
    this._btn(L.btns[0], 'mute', muted);
    this._btn(L.btns[1], 'pause', false);
  }

  /** A little sun (day) or a crescent moon (night), 7 texels across, a pixel at a time. */
  _sunMoon(cx, cy, day) {
    const c = this.ctx;
    c.fillStyle = day ? C.gold : '#fff2c0';
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
      const d = i * i + j * j;
      if (day ? d <= 5 || (d === 9 && (i === 0 || j === 0)) : d <= 9 && (i - 1.6) * (i - 1.6) + (j + 1) * (j + 1) > 6) c.fillRect(cx + i, cy + j, 1, 1);
    }
  }

  _btn(r, kind, off) {
    const c = this.ctx;
    this._panel(r.x, r.y, r.w, r.h);
    const cx = r.x + (r.w >> 1), cy = r.y + (r.h >> 1);
    c.fillStyle = off ? C.dim : C.ink;
    if (kind === 'pause') { c.fillRect(cx - 4, cy - 5, 3, 10); c.fillRect(cx + 1, cy - 5, 3, 10); return; }
    // a quaver: its head, its stem and its flag
    c.fillRect(cx - 5, cy + 2, 4, 3); c.fillRect(cx - 4, cy + 1, 2, 5);
    c.fillRect(cx - 1, cy - 6, 1, 10);
    c.fillRect(cx, cy - 6, 2, 1); c.fillRect(cx + 1, cy - 5, 2, 1); c.fillRect(cx + 2, cy - 4, 1, 2);
    if (off) { c.fillStyle = C.red; for (let i = -6; i <= 6; i++) c.fillRect(cx + i, cy + i, 1, 1); }
  }

  // the dash ------------------------------------------------------------------------------------------------

  _drawDash(now) {
    if (this.L.dial) this._drawDial(now); else this._drawStrip(now);
  }

  /** The round tach, a bar graph of blocks from 0 to 9,000 r/min round three quarters of a circle, the speed inside. */
  _drawDial(now) {
    const c = this.ctx, L = this.L, v = this.v, d = L.dial;
    const key = d.cx + ',' + d.cy + ',' + d.R + ',' + this.fS;
    if (this._faceKey !== key) this._buildFace(key);
    c.drawImage(this._face, d.cx - this._face.width / 2, d.cy - this._face.height / 2);
    const lit = v.rpm / 9000 * this._segs.length;
    for (let i = 0; i < this._segs.length; i++) {
      if (i + 0.5 > lit) break;
      const r = (i + 0.5) / this._segs.length * 9000;
      c.fillStyle = r >= 7500 ? C.red : r >= 6000 ? C.orange : C.amber;
      c.fill(this._segs[i]);
    }
    // the shift light, the gear, the speed
    if (v.rpm > 7700) { c.fillStyle = C.red; c.fillRect(d.cx - 3, d.cy - d.R + d.t + 4, 6, 3); }
    this._txt(v.gear, F.s15, v.gear === 'R' ? C.red : C.ink, d.cx, d.cy - Math.round(d.R * 0.32), 0.5, 0.5);
    this._txt(String(v.mph), F.s30, C.amber, d.cx, d.cy + Math.round(d.R * 0.18), 0.5, 0.5);
    // the three telltales under it, and the boost it has banked above it
    const ly = d.cy + d.R + 1, lamps = [['DRIFT', v.drifting, C.amber], ['CLIP', v.clip, C.mint], ['BOOST', v.boosting, C.cyan]];
    let lx = d.cx - this._lampsW / 2;
    for (const [t, on, col] of lamps) { lx += this._lamp(t, lx, ly, on, col) + 3; }
    this._leds(L.leds.x, L.leds.y, L.leds.w, L.leds.h, now, true);
  }

  _buildFace(key) {
    const d = this.L.dial, R = d.R, t = d.t, size = 2 * R + 8;
    const cv = this._face = this._face || document.createElement('canvas');
    cv.width = size; cv.height = size;
    const c = cv.getContext('2d'), o = size / 2;
    c.clearRect(0, 0, size, size);
    c.fillStyle = C.panel; c.beginPath(); c.arc(o, o, R + 3, 0, TAU); c.fill();
    c.strokeStyle = C.edge; c.lineWidth = 1; c.beginPath(); c.arc(o, o, R + 3.5, 0, TAU); c.stroke();
    // the unlit blocks, in the colour of their zone
    const segs = this._segs = [], N = 36, a0 = 0.75 * Math.PI, span = 1.5 * Math.PI, gap = 0.012 * Math.PI;
    for (let i = 0; i < N; i++) {
      const s0 = a0 + span * i / N + gap, s1 = a0 + span * (i + 1) / N - gap, rr = (i + 0.5) / N * 9000;
      const mk = (ox, oy) => { const p = new Path2D(); p.arc(ox, oy, R, s0, s1); p.arc(ox, oy, R - t, s1, s0, true); p.closePath(); return p; };
      c.fillStyle = rr >= 7500 ? 'rgba(255,74,58,0.22)' : 'rgba(255,179,71,0.14)';
      c.fill(mk(o, o));
      segs.push(mk(d.cx, d.cy));
    }
    // the numerals, the thousands, red past the redline
    for (let k = 0; k <= 9; k++) {
      const a = a0 + span * k / 9, rr = R - t - 6;
      const s = this._spr(String(k), F.lab, k >= 8 ? C.red : C.dim, 0);
      c.drawImage(s.c, Math.round(o + Math.cos(a) * rr - s.w / 2 - s.ox), Math.round(o + Math.sin(a) * rr - s.h / 2 - s.oy));
    }
    const u = this._spr('MPH', F.lab, C.dim, 0);
    c.drawImage(u.c, Math.round(o - u.w / 2 - u.ox), Math.round(o + R * 0.18 + this._fm(F.s30).cap / 2 + 3 - u.oy));
    this._lampsW = ['DRIFT', 'CLIP', 'BOOST'].reduce((a, s) => a + this._w(s, F.lab) + 6 + 3, -3);
    this._faceKey = key;
  }

  /** A telltale: its word in a box, dark, or lit in its colour. Returns its width. */
  _lamp(text, x, y, on, col) {
    const c = this.ctx, w = this._w(text, F.lab) + 6, h = this.labCap + 5;
    x = Math.round(x);
    if (on) { c.fillStyle = col; c.fillRect(x, y, w, h); }
    else { c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(x, y, w, h); c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(x, y, w, 1); c.fillRect(x, y + h - 1, w, 1); c.fillRect(x, y, 1, h); c.fillRect(x + w - 1, y, 1, h); }
    this._txt(text, F.lab, on ? C.dark : 'rgba(255,255,255,0.3)', x + 3, y + 3, 0, 0, 1, 1, 0);
    return w;
  }

  /** The boost banked: twelve cyan blocks, the last three whiter; they flash as a slide's boost comes in. */
  _leds(x, y, w, h, now, label) {
    const c = this.ctx, v = this.v, n = 12, fl = this._p('boost', now);
    let x0 = x;
    if (label) { const s = this._txt('BOOST', F.lab, C.dim, x, y + h / 2, 0, 0.5, 1, 1, 0); x0 = x + s.w + 4; }
    const bw = (x + w - x0 - (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const on = i < v.leds;
      c.fillStyle = on ? (fl >= 0 && Math.floor(fl * 8) % 2 === 0 ? '#ffffff' : i >= 9 ? C.ice : C.cyan) : 'rgba(90,209,255,0.14)';
      c.fillRect(Math.round(x0 + i * (bw + 1)), y, Math.max(1, Math.round(bw)), h);
    }
  }

  /** On a phone: the dash as a strip along the bottom, the gear, the speed, a bar-graph tach and the boost under it. */
  _drawStrip(now) {
    const c = this.ctx, v = this.v, r = this.L.strip, fS = F.s20, cap = this._fm(fS).cap, lab = this.labCap;
    this._panel(r.x, r.y, r.w, r.h);
    // the gear, boxed, the box red at the shift point
    const gx = r.x + 4, gy = r.y + 3, gw = 14, gh = r.h - 6;
    c.fillStyle = v.rpm > 7700 ? C.red : 'rgba(255,179,71,0.5)';
    c.fillRect(gx, gy, gw, 1); c.fillRect(gx, gy + gh - 1, gw, 1); c.fillRect(gx, gy, 1, gh); c.fillRect(gx + gw - 1, gy, 1, gh);
    this._txt(v.gear, F.s15, v.gear === 'R' ? C.red : C.ink, gx + gw / 2, gy + gh / 2, 0.5, 0.5);
    // the speed, three digits, and its unit under it
    const dw = this._fm(fS).dw, sx = gx + gw + 4 + 3 * dw;
    const top = r.y + Math.round((r.h - cap - lab - 3) / 2);
    const mph = String(v.mph);
    this._txt(mph, fS, C.amber, sx, top, 1, 0);
    if (mph.length < 3) this._txt('0'.repeat(3 - mph.length), fS, C.ghost, sx - this._w(mph, fS), top, 1, 0, 1, 1, 0);
    this._txt('MPH', F.lab, C.dim, sx, top + cap + 3, 1, 0, 1, 1, 0);
    // the tach: a row of blocks, amber to the orange band to the red line
    const tx = sx + 6, tw = r.x + r.w - 5 - tx, n = Math.max(12, Math.floor((tw + 1) / 5)), bw = (tw - (n - 1)) / n, ty = r.y + 4, th = 8;
    const lit = v.rpm / 9000 * n;
    for (let i = 0; i < n; i++) {
      const rr = (i + 0.5) / n * 9000, on = i + 0.5 <= lit;
      c.fillStyle = rr >= 7500 ? (on ? C.red : 'rgba(255,74,58,0.22)') : rr >= 6000 ? (on ? C.orange : 'rgba(255,138,42,0.16)') : (on ? C.amber : 'rgba(255,179,71,0.14)');
      c.fillRect(Math.round(tx + i * (bw + 1)), ty, Math.max(1, Math.round(bw)), th);
    }
    // the boost under it, and the drift telltale beside it
    const ly = ty + th + 4, lw = this._w('DRIFT', F.lab) + 6;
    this._leds(tx, ly + 1, tw - lw - 5, 4, now, false);
    this._lamp('DRIFT', r.x + r.w - 5 - lw, ly - 1, v.drifting, C.amber);
  }

  // the angle meter ---------------------------------------------------------------------------------------

  /** A rail of blocks lit from the middle out to the side the car slides to; the far ends, pink, are the angle that scores the most. */
  _drawAngle(now) {
    const a = this.angleA;
    if (a <= 0.01) return;
    const c = this.ctx, v = this.v, r = this.L.angle, N = r.n, bw = r.bw, x0 = r.cx - r.w / 2;
    // (on its own dark glass, so it reads over a pale dusk sky as well as the night)
    const degW = r.inline ? this._w('00', this.fSm) + 8 : 0;
    if (r.inline) this._panel(Math.round(x0 - 5), r.y - 4, r.w + 12 + degW, r.h + 8, v.hot ? 'rgba(255,95,160,0.7)' : C.edge, a);
    else this._panel(Math.round(x0 - 7), r.y - 6, r.w + 14, r.h + 11 + this._fm(this.fSm).cap + 5, v.hot ? 'rgba(255,95,160,0.7)' : C.edge, a);
    c.globalAlpha = a;
    const lit = v.deg / 70 * N;
    for (let i = 0; i < 2 * N; i++) {
      const side = i < N ? -1 : 1, j = i < N ? N - 1 - i : i - N, deg = (j + 1) / N * 70, zone = deg > MAX_ANGLE + 1;
      const on = side === v.side && j + 0.5 <= lit;
      c.fillStyle = on ? (zone ? C.pink : j < N * 0.3 ? C.orange : C.gold) : zone ? 'rgba(255,95,160,0.22)' : 'rgba(255,179,71,0.16)';
      c.fillRect(Math.round(x0 + i * (bw + 1)), r.y, bw, r.h);
    }
    // the middle, and the ticks where the pink begins
    c.fillStyle = C.ink; c.fillRect(Math.round(r.cx) - 1, r.y - 2, 1, r.h + 4);
    c.fillStyle = C.pink;
    const zt = Math.round(MAX_ANGLE / 70 * N) * (bw + 1);
    c.fillRect(Math.round(r.cx - zt) - 1, r.y - 2, 1, r.h + 4); c.fillRect(Math.round(r.cx + zt) - 1, r.y - 2, 1, r.h + 4);
    // past the angle that scores the most, the rail burns
    if (v.hot) {
      c.fillStyle = C.pink;
      c.fillRect(x0 - 2, r.y - 3, r.w + 4, 1); c.fillRect(x0 - 2, r.y + r.h + 2, r.w + 4, 1); c.fillRect(x0 - 3, r.y - 2, 1, r.h + 4); c.fillRect(x0 + r.w + 2, r.y - 2, 1, r.h + 4);
    }
    const pk = this._p('deg', now), sc = pk >= 0 ? pop(pk, 1.8) : 1, col = v.hot ? C.pink : C.amber;
    let s, dx, dy;
    if (r.inline) {
      dy = r.y + r.h / 2 - this._fm(this.fSm).cap / 2;
      s = this._txt(String(v.deg), this.fSm, col, x0 + r.w + 5, dy, 0, 0, sc, a);
      dx = Math.round(x0 + r.w + 5 + s.w + 1);
    } else {
      dy = r.y + r.h + 4;
      s = this._txt(String(v.deg), this.fSm, col, r.cx, dy, 0.5, 0, sc, a);
      dx = Math.round(r.cx + s.w / 2 + 2);
      this._txt('L', F.lab, C.dim, x0, dy, 0, 0, 1, a, 0);
      this._txt('R', F.lab, C.dim, x0 + r.w, dy, 1, 0, 1, a, 0);
    }
    // (the degree sign, drawn: the pixel faces have none)
    c.globalAlpha = a; c.fillStyle = col;
    dy = Math.round(dy);
    c.fillRect(dx, dy, 3, 1); c.fillRect(dx, dy + 2, 3, 1); c.fillRect(dx, dy, 1, 3); c.fillRect(dx + 2, dy, 1, 3);
    c.globalAlpha = 1;
  }

  // the drift count and its cash-in ------------------------------------------------------------------------

  _drawDrift(now) {
    const v = this.v, L = this.L, y = L.drift.y + Math.round(this.coY), cx = L.drift.cx;
    if (this.driftA > 0.01 && v.active) {
      const a = this.driftA, pm = this._p('mult', now), pt = this._p('tier', now);
      const ps = this._spr('+' + v.pts, this.fBig, C.gold), ms = this._spr('x' + v.mult.toFixed(1), this.fMid, C.orange);
      const w = ps.w + 5 + ms.w, x0 = cx - w / 2, capB = this._fm(this.fBig).cap;
      this._put(ps, x0, y, 0, 0, 1, a);
      this._put(ms, x0 + ps.w + 5, y + capB, 0, 1, pm >= 0 ? pop(pm, 1.7) : 1, a);
      const word = SCORE.tierNames[v.tier] || '';
      if (word) {
        let sc = 1, ta = a;
        if (pt >= 0) { sc = pt < 0.55 ? 2.2 - 1.26 * pt / 0.55 : 0.94 + 0.06 * (pt - 0.55) / 0.45; ta *= Math.min(1, pt / 0.3); }
        if (L.tierInline) this._txt(word, F.s15, TIER[v.tier] || C.ink, x0 + w + 6, y + capB, 0, 1, sc, ta);
        else this._txt(word, F.s15, TIER[v.tier] || C.ink, cx, y + capB + 4, 0.5, 0, sc, ta);
      }
    }
    // the cash-in: the banked points pop where the count was, then fly up into the score and shrink away
    if (this.bank) {
      const p = (now - this.bank.t0) / 700;
      if (p < 1) {
        const r = L.score, ty = r.y + r.h / 2, col = this.bank.tier === 1 ? '#c9fff6' : this.bank.tier === 2 ? '#ffe066' : this.bank.tier === 3 ? '#ffc2dc' : '#fff1b8';
        let a, sc, yy;
        if (p < 0.2) { const q = p / 0.2; a = q; sc = 1.5 - 0.5 * outBack(q); yy = y + 3 * (1 - q); }
        else if (p < 0.44) { a = 1; sc = 1 + 0.03 * (p - 0.2) / 0.24; yy = y; }
        else { const q = (p - 0.44) / 0.56, e = q * q; a = 1 - q; sc = 1.03 - 0.58 * e; yy = y + (ty - y - 6) * e; }
        this._txt('+' + this.bank.v, this.fBig, col, cx, yy, 0.5, 0, sc, a);
      }
    }
  }

  // the off-road countdown ----------------------------------------------------------------------------------

  _drawCourseOut(now) {
    const co = this.courseOut;
    if (!co || (!co.shown && !this.warming)) return;
    const c = this.ctx, L = this.L, r = { ...L.co }, lab = this.labCap;
    const col = co.mode === 'hot' ? C.red : co.mode === 'mag' ? '#6ff0ff' : C.amber;
    const rr = Math.min(12, Math.round(r.h / 2 - 4));
    const tw = Math.max(this._w(co.head, F.jp), this._w(co.line, F.lab), r.sub ? this._w(co.sub, F.lab) : 0);
    r.w = 5 + 2 * rr + 7 + tw + 8 + 14 + 5;
    r.x = Math.round(W2(this) - r.w / 2);
    this._panel(r.x, r.y, r.w, r.h, co.mode === 'mag' ? 'rgba(111,240,255,0.6)' : 'rgba(255,95,180,0.7)');
    // the ring: twenty blocks round the number, going out one by one
    const ox = r.x + 5 + rr, oy = r.y + Math.round(r.h / 2), n = 20;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + TAU * (i + 0.5) / n, on = (i + 0.5) / n <= co.f;
      c.fillStyle = on ? col : 'rgba(255,255,255,0.12)';
      c.globalAlpha = on && co.mode === 'hot' ? 0.6 + 0.4 * co.glow : 1;
      c.fillRect(Math.round(ox + Math.cos(a) * rr) - 1, Math.round(oy + Math.sin(a) * rr) - 1, 3, 3);
    }
    c.globalAlpha = 1;
    if (co.mode === 'mag') this._magnet(ox + Math.round((co.glow - 0.5) * 2), oy, 0.8);
    else if (co.n !== null) this._txt(String(co.n), F.s15, col, ox, oy, 0.5, 0.5, 1 + 0.9 * co.p * co.p);
    // the words: the Japanese racing term, what to do, and what happens if not
    const tx = ox + rr + 7, jcap = r.jcap;
    this._txt(co.head, F.jp, '#ffc2d9', tx, r.y + 3, 0, 0);
    this._txt(co.line, F.lab, C.ink, tx, r.y + 3 + jcap + 4, 0, 0, 1, 1, 0);
    if (r.sub) this._txt(co.sub, F.lab, C.dim, tx, r.y + 3 + jcap + 4 + lab + 3, 0, 0, 1, 1, 0);
    this._magnet(r.x + r.w - 11, oy, 1);
  }

  /** The horseshoe magnet: a red U with steel tips, a pixel at a time. */
  _magnet(cx, cy, s) {
    const c = this.ctx, k = Math.max(1, Math.round(s * 2)) / 2;
    for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
      const x = i / k, y = j / k;
      const out = y < 0 ? Math.abs(x) <= 6 : x * x + y * y <= 36, inn = y < 0 ? Math.abs(x) <= 2 : x * x + y * y <= 4;
      if (!out || inn || y < -6) continue;
      c.fillStyle = y < -3 ? '#dde2e8' : '#e8262c';
      c.fillRect(cx + i, cy + j, 1, 1);
    }
  }

  // the smash counter, the callouts, the hint, the caption ----------------------------------------------------

  _drawSmash(now) {
    const sm = this.smashS;
    if (!sm) return;
    const p = (now - sm.t0) / 1700;
    if (p >= 1) return;
    const sc = p < 0.2 ? 1.75 - 0.75 * outBack(p / 0.2) : 1, a = p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2, dy = p < 0.8 ? 0 : -5 * (p - 0.8) / 0.2;
    const y = this.L.smashY + dy;
    this._txt(sm.label, this.fBig, C.gold, this.L.drift.cx, y - 3 - this._fm(this.fSm).cap, 0.5, 1, sc, a);
    this._txt(sm.sub, this.fSm, C.rose, this.L.drift.cx, y, 0.5, 1, 1, a);
  }

  _drawToast(now) {
    const y0 = this.L.toastY, cx = this.L.drift.cx;
    const one = (t, p, out) => {
      const col = TOAST[t.cls] || C.gold, fH = t.big ? this.fBig : this.fMid;
      let a, sc, dy;
      if (out !== undefined) { a = 1 - out; sc = 1 - 0.1 * out; dy = -9 * out; }
      else {
        a = p < 0.1 ? p / 0.1 : p < 0.78 ? 1 : 1 - (p - 0.78) / 0.22;
        sc = p < 0.1 ? 0.8 + 0.28 * p / 0.1 : p < 0.24 ? 1.08 - 0.08 * (p - 0.1) / 0.14 : 1;
        dy = p < 0.1 ? 6 * (1 - p / 0.1) : p < 0.24 ? 0 : -13 * (p - 0.24) / 0.76;
      }
      const h = this._txt(t.text, fH, col, cx, y0 + dy, 0.5, 0, sc, a);
      if (t.sub) this._txt(t.sub, F.lab, C.ink, cx, y0 + dy + h.h * sc + 4, 0.5, 0, 1, a);
    };
    if (this.prev) { const q = (now - this.prev.out0) / 180; if (q < 1) one(this.prev, 0, q); }
    if (this.cur) { const p = (now - this.cur.t0) / 1350; if (p < 1) one(this.cur, p); }
  }

  /** The first-run hint, as a 90s game's dialogue box: the words, and a cursor blinking in its corner. */
  _drawCoach(now) {
    const a = this.coachA;
    if (a <= 0.01) return;
    const c = this.ctx, r = this.L.coach;
    const words = this.touch
      ? [['DRIFT', C.amber], ['TAP', C.ink], ['THE', C.ink], ['HANDBRAKE', C.amber], ['INTO', C.ink], ['A', C.ink], ['CORNER,', C.ink], ['STEER', C.ink], ['INTO', C.ink], ['THE', C.ink], ['SLIDE', C.ink]]
      : [['DRIFT', C.amber], ['TAP', C.ink], ['SPACE', C.amber], ['INTO', C.ink], ['A', C.ink], ['CORNER,', C.ink], ['STEER', C.ink], ['INTO', C.ink], ['THE', C.ink], ['SLIDE,', C.ink], ['HOLD', C.ink], ['W', C.amber]];
    const sp = this._w(' ', F.lab) + 1, maxW = r.w - 16, lines = [[]];
    let lw = 0;
    for (const [t, col] of words) {
      const w = this._w(t, F.lab);
      if (lw > 0 && lw + sp + w > maxW) { lines.push([]); lw = 0; }
      lines[lines.length - 1].push([t, col, lw + (lw > 0 ? sp : 0)]); lw += (lw > 0 ? sp : 0) + w;
    }
    const lh = this.labCap + 4, bw = Math.min(r.w, Math.max(...lines.map((l) => { const e = l[l.length - 1]; return e[2] + this._w(e[0], F.lab); })) + 16);
    const bh = lines.length * lh + 9, bx = Math.round(r.cx - bw / 2), by = r.y;
    c.globalAlpha = a;
    this._panel(bx, by, bw, bh, 'rgba(255,179,71,0.7)');
    c.fillStyle = 'rgba(255,179,71,0.3)';
    c.fillRect(bx + 2, by + 2, bw - 4, 1); c.fillRect(bx + 2, by + bh - 3, bw - 4, 1);
    lines.forEach((l, i) => { for (const [t, col, x] of l) this._txt(t, F.lab, col, bx + 8 + x, by + 5 + i * lh, 0, 0, 1, a, 0); });
    if (Math.floor(now / 400) % 2 === 0) { c.fillStyle = C.amber; const tx = bx + bw - 8, ty = by + bh - 6; c.fillRect(tx - 2, ty - 2, 5, 1); c.fillRect(tx - 1, ty - 1, 3, 1); c.fillRect(tx, ty, 1, 1); }
    c.globalAlpha = 1;
  }

  /** The set's caption as a run starts: the channel in its green, what is on under it. */
  _drawTV(now) {
    const tv = this.tv;
    if (!tv) return;
    const p = (now - tv.t0) / 3000;
    if (p >= 1) return;
    // (it comes on at once and blinks off at the end, as a set's caption did)
    if (p > 0.82 && Math.floor(p * 40) % 2 === 1) return;
    const r = this.L.tv;
    const s = this._txt('CH ' + String(tv.n).padStart(2, '0'), this.fS, C.green, r.x + 1, r.y);
    this._txt(tv.label, F.lab, C.green, r.x + 1, r.y + s.h + 5, 0, 0, 1, 1, 1);
  }

  // the thumbs ------------------------------------------------------------------------------------------------

  /**
   * On a phone: where the thumbs go and what they are doing, drawn where the tube shows the finger (the OSD point is
   * the finger's point pushed through the glass's curve): the handbrake's pad in the right-hand corner, and under the
   * left thumb the wheel it holds, the knob red while it pulls down to brake and grey while it lifts off the gas.
   */
  _drawThumbs(now) {
    const c = this.ctx, L = this.L, t = this.input && this.input.t;
    if (!t) return;
    // the handbrake pad
    {
      const x = L.pad.x, y = L.pad.y, r = L.pad.r;
      c.fillStyle = t.hand ? 'rgba(255,59,48,0.62)' : 'rgba(12,8,20,0.42)';
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.lineWidth = 2; c.strokeStyle = t.hand ? C.red : 'rgba(246,239,226,0.55)';
      c.beginPath(); c.arc(x, y, r - 1, 0, TAU); c.stroke();
      const col = t.hand ? '#ffffff' : 'rgba(246,239,226,0.9)';
      this._txt('HAND', F.lab, col, x, y - 2, 0.5, 1, 1, 1, 1);
      this._txt('BRAKE', F.lab, col, x, y + 2, 0.5, 0, 1, 1, 1);
    }
    // the wheel under the left thumb
    if (t.active) {
      const R = t.R || 72, sx = t.x0, sy = t.y0;
      const n = 13;
      for (let i = 0; i <= n; i++) {
        const [x, y] = this._toTex(sx - R + 2 * R * i / n, sy);
        c.fillStyle = i === n / 2 ? 'rgba(246,239,226,0.8)' : 'rgba(246,239,226,0.4)';
        c.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      }
      const [cx0, cy0] = this._toTex(sx, sy);
      c.fillStyle = 'rgba(246,239,226,0.7)'; c.fillRect(Math.round(cx0) - 1, Math.round(cy0) - 5, 1, 10);
      const kx = clamp((t.x || sx) - sx, -R, R);
      const [nx, ny] = this._toTex(sx + kx, sy);
      const state = t.brake > 0.05 ? 'brake' : t.lift ? 'lift' : 'gas';
      const fill = state === 'brake' ? 'rgba(255,59,48,0.8)' : state === 'lift' ? 'rgba(170,170,180,0.7)' : 'rgba(255,179,71,0.55)';
      const kr = Math.round(15 / this.kx);
      c.fillStyle = fill; c.beginPath(); c.arc(nx, ny, kr, 0, TAU); c.fill();
      c.lineWidth = 2; c.strokeStyle = state === 'brake' ? C.red : 'rgba(246,239,226,0.9)'; c.beginPath(); c.arc(nx, ny, kr - 1, 0, TAU); c.stroke();
      this._txt(state === 'brake' ? (t.brake > 0.5 ? 'REVERSE' : 'BRAKE') : state === 'lift' ? 'LIFT' : 'GAS', F.lab, state === 'brake' ? C.red : C.ink, nx, ny + kr + 3, 0.5, 0, 1, 1, 1);
    } else if (!t.used) {
      // before the first touch of a session: what the thumbs do
      const x = L.hint.x, y = L.hint.y, lh = this.labCap + 5;
      const rows = [['HOLD', 'TO DRIVE'], ['SLIDE', 'TO STEER'], ['PULL DOWN', 'TO BRAKE']];
      rows.forEach(([a, b], i) => {
        const yy = y - (rows.length - i) * lh;
        const s = this._txt(a, F.lab, C.amber, x, yy, 0, 0, 1, 1, 1);
        this._txt(b, F.lab, C.ink, x + s.w + 4, yy, 0, 0, 1, 1, 1);
      });
    }
  }
}
