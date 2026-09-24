/**
 * The HUD, dressed as a 90s tuner's dash: amber seven-segment readouts with their unlit segments ghosting
 * through, a round tachometer with a redline and an orange needle, a gear digit, a row of boost LEDs and three
 * telltales. Score top centre, combo and distance top left, a digital clock top right, the cluster bottom right,
 * the drift-angle meter bottom centre while a slide is on.
 *
 * Everything is DOM and SVG, written only when a value changes (the needle, which moves every frame, is one
 * attribute), so a phone is not re-laying out text sixty times a second.
 *
 * The rewards: a banked drift flashes where the live count was and flies up into the score, which pulses as it lands
 * and only then rolls up; a bigger drift gets its tier called out (NICE, GREAT, INSANE DRIFT!); the multiplier, the
 * tier and the combo punch as they climb; past the angle that scores the most the angle meter burns pink. Every one
 * of those is a Web Animation of transform and opacity (the compositor runs it; nothing is restyled or laid out
 * mid-drift, which is what stalled the browser before), and every look is drawn once at the title (warm) so its
 * raster pipeline is compiled before a run. On a phone that can (Android), a short buzz goes with the big moments.
 */
import { SCORE, clamp, damp } from './config.js?v=202609240808';

const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const fmt = (n) => Math.round(n).toLocaleString('en-US');
// the slide angle past which a drift scores the most: scoring.js's angle factor tops out at 1.5 x 0.55 rad, 47 degrees
const MAX_ANGLE = 47;
// an overshoot, for the punches
const POP = 'cubic-bezier(.2,1.7,.4,1)';

/** Restart a short animation on el (transform and opacity only), dropping the one it was running. */
function play(el, frames, ms, easing = 'ease-out', delay = 0) {
  if (!el || !el.animate) return null;
  if (el._anim) el._anim.cancel();
  el._anim = el.animate(frames, { duration: ms, easing, delay });
  return el._anim;
}

const SEGS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '', r: 'eg', n: 'ceg', P: 'abefg' };

/** Seven-segment digits drawn as SVG polygons. */
export class Seg7 {
  constructor(svg, n, { dotAfter = -1, colonAfter = -1 } = {}) {
    this.svg = svg; this.n = n; this.cells = []; this.str = null;
    const pitch = 15, w = 12, h = 22, t = 2.3, g = 0.45;
    const extra = colonAfter >= 0 ? 5 : 0;
    const W = n * pitch + extra;
    svg.setAttribute('viewBox', `-2 -1 ${W + 2} ${h + 2}`);
    svg.style.aspectRatio = `${W + 2} / ${h + 2}`;
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const H = (x0, x1, y) => `${x0},${y} ${x0 + t / 2},${y - t / 2} ${x1 - t / 2},${y - t / 2} ${x1},${y} ${x1 - t / 2},${y + t / 2} ${x0 + t / 2},${y + t / 2}`;
    const V = (x, y0, y1) => `${x},${y0} ${x + t / 2},${y0 + t / 2} ${x + t / 2},${y1 - t / 2} ${x},${y1} ${x - t / 2},${y1 - t / 2} ${x - t / 2},${y0 + t / 2}`;
    const grp = document.createElementNS(NS, 'g');
    grp.setAttribute('transform', 'skewX(-7)');
    svg.appendChild(grp);
    for (let i = 0; i < n; i++) {
      const ox = i * pitch + (colonAfter >= 0 && i > colonAfter ? extra : 0) + 2;
      const L = ox + t / 2, R = ox + w - t / 2, T = t / 2, M = h / 2, B = h - t / 2;
      const polys = { a: H(L + g, R - g, T), g: H(L + g, R - g, M), d: H(L + g, R - g, B), f: V(L, T + g, M - g), b: V(R, T + g, M - g), e: V(L, M + g, B - g), c: V(R, M + g, B - g) };
      const cell = {};
      for (const k of 'abcdefg') { const p = document.createElementNS(NS, 'polygon'); p.setAttribute('points', polys[k]); p.setAttribute('class', 's'); grp.appendChild(p); cell[k] = p; }
      this.cells.push(cell);
      if (i === dotAfter) { const d = document.createElementNS(NS, 'rect'); d.setAttribute('x', R + 1.2); d.setAttribute('y', B - 1.2); d.setAttribute('width', 2.2); d.setAttribute('height', 2.2); d.setAttribute('class', 's on'); grp.appendChild(d); }
      if (i === colonAfter) for (const y of [6.5, 15]) { const d = document.createElementNS(NS, 'rect'); d.setAttribute('x', R + 2.6); d.setAttribute('y', y); d.setAttribute('width', 2.2); d.setAttribute('height', 2.2); d.setAttribute('class', 's on'); grp.appendChild(d); }
    }
  }

  set(str) {
    if (str === this.str) return;
    this.str = str;
    const s = String(str).padStart(this.n, ' ').slice(-this.n);
    for (let i = 0; i < this.n; i++) {
      const on = SEGS[s[i]] ?? '';
      const cell = this.cells[i];
      for (const k of 'abcdefg') { const want = on.includes(k); if (cell[k]._on !== want) { cell[k]._on = want; cell[k].classList.toggle('on', want); } }
    }
  }
}

/** The tachometer face: ticks, numerals, redline arc, and the needle group. */
function buildTach(svg) {
  const cx = 100, cy = 100, R = 92;
  const ang = (rpm) => (135 + 270 * rpm / 9000) * Math.PI / 180;
  const el = (tag, attrs, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
  el('circle', { cx, cy, r: 97, fill: 'rgba(10,8,16,.82)', stroke: 'rgba(255,179,71,.32)', 'stroke-width': 1.5 });
  el('circle', { cx, cy, r: 90, fill: 'none', stroke: 'rgba(255,255,255,.06)', 'stroke-width': 1 });
  // redline
  const a0 = ang(7500), a1 = ang(9000);
  el('path', { d: `M ${cx + Math.cos(a0) * 86} ${cy + Math.sin(a0) * 86} A 86 86 0 0 1 ${cx + Math.cos(a1) * 86} ${cy + Math.sin(a1) * 86}`,
               fill: 'none', stroke: '#ff3b30', 'stroke-width': 6, opacity: 0.85 });
  for (let rpm = 0; rpm <= 9000; rpm += 250) {
    const a = ang(rpm), major = rpm % 1000 === 0, half = rpm % 500 === 0;
    const r0 = major ? 74 : half ? 79 : 82, red = rpm >= 7500;
    el('line', { x1: cx + Math.cos(a) * r0, y1: cy + Math.sin(a) * r0, x2: cx + Math.cos(a) * 89, y2: cy + Math.sin(a) * 89,
                 stroke: red ? '#ff5a4f' : major ? '#f6efe2' : 'rgba(246,239,226,.5)', 'stroke-width': major ? 2.6 : 1.4 });
    if (major) {
      const t = el('text', { x: cx + Math.cos(a) * 62, y: cy + Math.sin(a) * 62 + 4.5, 'text-anchor': 'middle', fill: red ? '#ff5a4f' : '#f6efe2',
                             'font-family': 'Share Tech Mono, monospace', 'font-size': 14 });
      t.textContent = String(rpm / 1000);
    }
  }
  const lab = el('text', { x: cx, y: cy - 14, 'text-anchor': 'middle', fill: 'rgba(246,239,226,.45)', 'font-family': 'Share Tech Mono, monospace', 'font-size': 7.5, 'letter-spacing': 1.2 });
  lab.textContent = 'x1000r/min';
  const shift = el('circle', { cx, cy: 30, r: 4, fill: 'rgba(255,59,48,.15)', stroke: 'rgba(255,59,48,.4)', 'stroke-width': 1 });
  const needle = el('g', { transform: `rotate(135 ${cx} ${cy})` });
  el('polygon', { points: `${cx - 12},${cy - 2.2} ${cx + 86},${cy - 0.8} ${cx + 88},${cy} ${cx + 86},${cy + 0.8} ${cx - 12},${cy + 2.2}`, fill: '#ff8a2a',
                  style: 'filter:drop-shadow(0 0 3px rgba(255,138,42,.9))' }, needle);
  el('circle', { cx, cy, r: 7, fill: '#1a1420', stroke: '#ff8a2a', 'stroke-width': 1.5 });
  return { needle, shift, cx, cy };
}

export class Hud {
  constructor() {
    this.el = {
      hud: $('hud'), drift: $('drift'), driftpts: $('driftpts'), mult: $('mult'), tier: $('tier'), combon: $('combon'), chainf: $('chainf'),
      toasts: $('toasts'), perf: $('perf'), btns: $('hbtns'),
      lampdrift: $('lampdrift'), lampclip: $('lampclip'), lampboost: $('lampboost'), angle: $('angle'), angledeg: $('angledeg'),
      anglecl: $('anglecl'), anglecr: $('anglecr'), anglehot: $('anglehot'),
      scorebox: $('scorebox'), scorelab: $('scorelab'), sflash: $('sflash'), bank: $('bank'), coach: $('coach'), pause: $('pause'),
      clockbox: $('clockbox'), clockadd: $('clockadd'),
      boostbar: $('boostbar'),
    };
    this.el.bankb = this.el.bank && this.el.bank.querySelector('b');
    this.score = new Seg7($('score7'), 8);
    this.speed = new Seg7($('spd7'), 3);
    this.gear = new Seg7($('gear'), 1);
    this.clock = new Seg7($('clock7'), 4, { colonAfter: 1 });
    this.dist = new Seg7($('dist7'), 4, { dotAfter: 2 });
    this.tach = buildTach($('tach'));
    const leds = $('leds');
    this.leds = [];
    for (let i = 0; i < 12; i++) { const l = document.createElement('i'); if (i >= 9) l.classList.add('hi'); leds.appendChild(l); this.leds.push(l); }
    this.shown = 0; this.lastPts = -1; this.lastMult = -1; this.lastTier = -1; this.lastCombo = -1; this.lastLeds = -1;
    this.rpm = 900; this.lastNeedle = ''; this.clipT = 0; this.hitFlash = 0; this.vignette = 0; this.lastAngle = ''; this.lastDeg = -1;
    this.perfOn = new URLSearchParams(location.search).has('perf') || new URLSearchParams(location.search).has('prof');
    if (this.perfOn) this.el.perf.classList.add('on');
    this.score.set(''); this.speed.set('0'); this.gear.set('n'); this.clock.set('0000'); this.dist.set('0');
    // the callout showing ({ el, t, prio }) and the ones waiting their turn
    this.cur = null; this.queue = [];
    this.holdScore = 0;                  // the score's roll waits for the banked points to fly in
    this.canBuzz = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    this._buzzT = 0;
    try { this.coached = localStorage.getItem('minidrift.drifted') === '1'; } catch { this.coached = false; }
    this.run = { t: 0, smashN: 0, smashLast: 0, newBest: false, best0: 0 };
    this.scoring = null;
    // the run card on the pause screen is filled in the moment the pause opens (main.js adds the class)
    if (this.el.pause && typeof MutationObserver !== 'undefined') {
      new MutationObserver(() => { if (this.el.pause.classList.contains('on')) this.fillCard(); }).observe(this.el.pause, { attributes: true, attributeFilter: ['class'] });
    }
  }

  show(on) { this.el.hud.classList.toggle('on', on); this.el.btns.classList.toggle('on', on); }

  /**
   * Draw every effect the HUD will ever use, once, nearly invisibly, while the title is up: the browser compiles
   * a raster shader the first time it draws a blurred text shadow or a glow, and doing that mid-drift was a
   * 100 ms stall at the first slide of the first run. The punches and the cash-in are played here too, at the scale
   * they reach in a run, and so are the angle meter's burn and the score's flash.
   */
  warm(on) {
    const el = this.el;
    el.hud.classList.toggle('warm', on);
    for (const e of [el.drift, el.angle, el.lampdrift, el.lampclip, el.lampboost]) e.classList.toggle('on', on);
    if (on) {
      el.driftpts.textContent = '+1,234'; el.mult.textContent = '×2.0'; el.tier.textContent = 'GREAT'; el.tier.className = 't2';
      this._showToast('WARM', 'good', true, 'COMBO ×2', 1); this._showToast('WARM', 'bad', false, '', 1);   // (the first leaves: its exit too)
      this.smash('SMASH!', 1234, 2);                  // (the smash popup and its glow, drawn once here too)
      this._bankFly(1234, 2); this._punch('mult'); this._punch('tier'); this._punch('combo'); this._clockAdd(1234);
      play(el.angledeg, [{ transform: 'scale(1.8)' }, { transform: 'scale(1)' }], 320, POP);
      play(el.boostbar, [{ transform: 'scale(1.14)' }, { transform: 'scale(1)' }], 320, POP);
      // (each started where it is plainly on screen, not at its invisible first frame or in its delay: a harness presses
      // START the moment the title is up, and the very first frame of the title has to draw every look)
      const seek = (e, ms) => { if (e && e._anim) try { e._anim.currentTime = ms; } catch {} };
      seek(el.bank, 150); seek(el.scorebox, 565); seek(el.sflash, 556); seek(el.smash, 200); seek(el.clockadd, 400); seek(el.clockbox, 140);
      for (const e of [el.mult, el.tier, el.combon, el.angledeg, el.boostbar]) seek(e, 90);
      for (const t of el.toasts.children) if (t.getAnimations) for (const a of t.getAnimations()) try { a.currentTime = 140; } catch {}
      this._angleTo(55); el.anglehot.style.opacity = '1';
      el.scorelab.classList.add('best');
      el.coach.innerHTML = '<b>DRIFT</b> WARM'; el.coach.style.opacity = '1';
      this.leds.forEach((l) => l.classList.add('on'));
    } else {
      el.driftpts.textContent = ''; el.tier.textContent = '';
      for (const e of [el.bank, el.scorebox, el.sflash, el.mult, el.tier, el.combon, el.smash, el.angledeg, el.boostbar, el.clockadd, el.clockbox]) if (e && e._anim) { e._anim.cancel(); e._anim = null; }
      el.toasts.textContent = ''; this.cur = null; this.queue = [];
      el.anglehot.style.opacity = '0'; el.angledeg.style.color = ''; this._hot = false; this.lastAngle = ''; this.lastDeg = -1;
      el.scorelab.classList.remove('best');
      el.coach.style.opacity = '0'; this._coachOn = false;
      this.leds.forEach((l) => l.classList.remove('on'));
      this._drifting = this._clip = this._boosting = this._slide = false; this.lastLeds = 0; this.lastTier = -1;
    }
  }

  /** A new run (or back to the title): the score from zero, the run's own records cleared, the course's best as it stands. */
  reset() {
    this.shown = 0; this.score.set(''); this.lastCombo = -1; this.holdScore = 0;
    // (nothing from the last run carries over: its callouts, its cash-in, its smash counter)
    for (const e of [this.el.bank, this.el.scorebox, this.el.sflash, this.el.smash]) if (e && e._anim) { e._anim.cancel(); e._anim = null; }
    if (this.cur && this.cur.el.isConnected) this.cur.el.remove();
    this.cur = null; this.queue = [];
    this.run = { t: 0, smashN: 0, smashLast: 0, newBest: false, best0: this._storedBest() };
    this._coachOn = false; this._coachGone = false;
    if (this.el.coach) this.el.coach.style.opacity = '0';
    if (this.el.scorelab) { this.el.scorelab.textContent = 'SCORE'; this.el.scorelab.classList.remove('best'); }
  }

  /** The best kept for the course picked on the title (main.js keeps it under minidrift.best.<city.>easy|hard). */
  _storedBest() {
    try {
      const m = document.querySelector('.map.sel'), d = document.querySelector('.diff.sel');
      const key = (m && m.dataset.m === 'city' ? 'city.' : '') + (d ? d.dataset.d : 'easy');
      return Number(localStorage.getItem('minidrift.best.' + key)) || 0;
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

  /** The smash counter: one label, punched in on every hit, the chain and its points under it, just above the car. */
  smash(label, total, n) {
    let el = this.el.smash;
    if (!el) {
      el = this.el.smash = document.createElement('div'); el.id = 'smash'; el.innerHTML = '<b></b><span></span>';
      el._b = el.firstChild; el._s = el.lastChild; this.el.hud.appendChild(el);
    }
    el._b.textContent = label;
    el._s.textContent = (n > 1 ? 'SMASH ×' + n + ' · ' : '') + '+' + fmt(total);
    play(el, [
      { opacity: 1, transform: 'translate(-50%,0) rotate(-11deg) scale(1.75)', easing: 'cubic-bezier(.2,1.5,.45,1)' },
      { opacity: 1, transform: 'translate(-50%,0) rotate(-4deg) scale(1)', offset: 0.2 },
      { opacity: 1, transform: 'translate(-50%,0) rotate(-4deg) scale(1)', offset: 0.8 },
      { opacity: 0, transform: 'translate(-50%,-10px) rotate(-4deg) scale(.96)' },
    ], 1700, 'linear');
    // (the card counts what was knocked over; a chain's total grows with each hit)
    this.run.smashN++; this.run.smashLast = total;
    this.buzz(12);
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
    if (cur && cur.el.isConnected && performance.now() - cur.t < 650 && prio <= cur.prio) {
      if (prio >= 2 && this.queue.length < 3) this.queue.push([text, cls, big, sub, prio]);
      return;
    }
    this._showToast(text, cls, big, sub, prio);
  }

  _showToast(text, cls, big, sub, prio) {
    const cur = this.cur;
    // (the one showing leaves quickly; one already fading just goes)
    if (cur && cur.el.isConnected) { if (performance.now() - cur.t < 1000) cur.el.classList.add('out'); else cur.el.remove(); }
    const t = document.createElement('div');
    t.className = 'toast' + (cls ? ' ' + cls : '') + (big ? ' big' : '');
    if (sub) { const b = document.createElement('b'), s = document.createElement('span'); b.textContent = text; s.textContent = sub; t.append(b, s); }
    else t.textContent = text;
    this.el.toasts.appendChild(t);
    this.cur = { el: t, t: performance.now(), prio };
    setTimeout(() => t.remove(), 1400);
  }

  /** The next queued callout, once the one showing has had its moment. */
  _nextToast() {
    if (!this.queue.length || (this.cur && this.cur.el.isConnected && performance.now() - this.cur.t < 650)) return;
    this._showToast(...this.queue.shift());
  }

  /** The punches: the multiplier as it climbs, the tier as it goes up, the combo as it grows. */
  /**
   * The clock is the score: a banked drift pushes the hour on (a minute for every hundred points, main.js), and says so
   * here, the minutes flying off the clock as it rolls forward, so the find is seen and not only read about.
   */
  _clockAdd(points) {
    const el = this.el, min = Math.round(points / 100);
    if (!el.clockadd || min < 1) return;
    el.clockadd.textContent = '+' + (min < 60 ? min + ' MIN' : Math.floor(min / 60) + ':' + String(min % 60).padStart(2, '0'));
    play(el.clockadd, [{ opacity: 0, transform: 'translate(14px, 4px) scale(0.8)' }, { opacity: 1, transform: 'translate(0, 0) scale(1.08)', offset: 0.14 },
      { opacity: 1, transform: 'translate(-4px, -2px) scale(1)', offset: 0.7 }, { opacity: 0, transform: 'translate(-12px, -10px) scale(0.96)' }], 1700, 'ease-out');
    play(el.clockbox, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.3 }, { transform: 'scale(1)' }], 480, 'ease-out');
  }

  _punch(which) {
    const el = this.el;
    if (which === 'mult') play(el.mult, [{ transform: 'scale(1.7)' }, { transform: 'scale(1)' }], 300, POP);
    else if (which === 'tier') play(el.tier, [{ opacity: 0, transform: 'scale(2.2) rotate(-7deg)' }, { opacity: 1, transform: 'scale(.94) rotate(0deg)', offset: 0.55 }, { opacity: 1, transform: 'scale(1)' }], 420, 'ease-out');
    else if (which === 'combo') play(el.combon, [{ transform: 'scale(1.9)' }, { transform: 'scale(1)' }], 340, POP);
  }

  /** The cash-in: the banked points flash where the live count was, then fly up into the score, which pulses as they land. */
  _bankFly(v, tier) {
    const el = this.el;
    if (!el.bank) return;
    el.bankb.textContent = '+' + fmt(v);
    el.bank.className = tier ? 't' + tier : '';
    // (it lands at 0.47 s: the score pulses and starts to roll then, and audio.js rings its bell then)
    play(el.bank, [
      { opacity: 0, transform: 'translateY(6px) scale(1.5)', easing: 'cubic-bezier(.2,1.4,.4,1)' },
      { opacity: 1, transform: 'translateY(0) scale(1)', offset: 0.2 },
      { opacity: 1, transform: 'translateY(0) scale(1.03)', offset: 0.44, easing: 'cubic-bezier(.5,0,.8,.6)' },
      { opacity: 0, transform: 'translateY(-60px) scale(.45)' },
    ], 700, 'linear');
    this.holdScore = performance.now() + 470;
    // (a slide of a few points, a wiggle, only flies in; the score's pulse and flash are for a drift)
    if (v < 100) return;
    play(el.scorebox, [{ transform: 'translateX(-50%) scale(1)' }, { transform: 'translateX(-50%) scale(1.1)', offset: 0.28 }, { transform: 'translateX(-50%) scale(1)' }], 340, 'ease-out', 470);
    play(el.sflash, [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 0 }], 640, 'ease-out', 460);
  }

  /** The angle meter: uncover the side the car slides to, from the middle out, a fraction of 70 degrees. */
  _angleTo(d) {
    const f = Math.round(Math.min(70, Math.abs(d)) / 70 * 200) / 200;
    const key = f + (d > 0 ? 'r' : 'l');
    if (key === this.lastAngle) return;
    this.lastAngle = key;
    this.el.anglecr.style.transform = `scaleX(${d > 0 ? 1 - f : 1})`;
    this.el.anglecl.style.transform = `scaleX(${d > 0 ? 1 : 1 - f})`;
  }

  /** First run only (until a drift has been banked once, ever): how to drift, a moment after the start. */
  _coach(dt) {
    if (this.coached || this._coachGone || !this.el.coach) return;
    this.run.t += dt;
    // (not before nine seconds in: the title has already said how, and the first seconds of a run are the road's)
    const want = this.run.t > 9 && this.run.t < 36;
    if (want === !!this._coachOn) return;
    this._coachOn = want;
    if (want) {
      this.el.coach.innerHTML = document.body.classList.contains('touch')
        ? '<b>DRIFT</b> TAP THE HANDBRAKE INTO A CORNER<span class="br"> AND STEER INTO THE SLIDE</span>'
        : '<b>DRIFT</b> TAP <b>SPACE</b> INTO A CORNER · STEER INTO THE SLIDE · HOLD <b>W</b>';
    } else this._coachGone = true;
    this.el.coach.style.opacity = want ? '1' : '0';
  }

  _coachDone() {
    if (this._coachOn) { this._coachOn = false; this.el.coach.style.opacity = '0'; }
    this._coachGone = true;
  }

  onEvent(e) {
    const el = this.el;
    switch (e.type) {
      case 'start': if (e.value > 1) this._punch('combo'); this._coachDone(); break;
      case 'mult': this._punch('mult'); break;
      // the boost a slide has earned, the moment it ends: the bar that just filled punches
      case 'boost': play(el.boostbar, [{ transform: 'scale(1.14)' }, { transform: 'scale(1)' }], 320, POP); break;
      case 'tier': this._punch('tier'); break;
      // a slide held past the angle that scores the most: said once a drift, and the degrees punch
      case 'angle': this.toast('BIG ANGLE!', 't3', false, '', 1); play(el.angledeg, [{ transform: 'scale(1.8)' }, { transform: 'scale(1)' }], 320, POP); break;
      case 'bank': {
        this._bankFly(e.value, e.tier);
        this._clockAdd(e.value);
        // a bigger drift is called out by its tier, with the combo it was part of
        const word = SCORE.tierNames[e.tier] || '';
        if (word) this.toast(word + ' DRIFT!', 't' + e.tier, e.tier >= 2, e.chain > 1 ? 'COMBO ×' + e.chain : '', 2);
        if (e.value >= 100) this.buzz(e.tier >= 3 ? [26, 40, 26, 40, 50] : e.tier === 2 ? [20, 40, 24] : e.tier === 1 ? 18 : 10);
        if (!this.coached) { this.coached = true; try { localStorage.setItem('minidrift.drifted', '1'); } catch {} }
        break;
      }
      case 'switch': this._punch('combo'); this.toast('SWITCH!', 'good', false, '', 1); break;
      case 'clip': this.toast('CLIP!', 'clip', false, '+' + fmt(e.value), 1); this.clipT = 0.9; this.buzz(14); break;
      case 'crash': this.toast('CRASH', 'bad', true, '-' + fmt(e.value) + ' LOST', 3); this.hitFlash = 1; this.buzz(70); break;
      case 'bump': this.hitFlash = Math.max(this.hitFlash, 0.5); break;
      // (a run starts at dusk: sunrise is the night driven through, the find's own reward, and is called out as one)
      case 'sun':
        if (e.value === 'SUNRISE') { this.toast('SUNRISE!', 't3', true, 'YOU DROVE THROUGH THE NIGHT', 3); this.buzz([30, 60, 30, 60, 90]); }
        else this.toast(e.value, 'calm', false, '', 0);
        break;
      case 'best': {
        this.run.newBest = true;
        this.toast('NEW BEST!', 't2', true, '', 3);
        el.scorelab.textContent = 'NEW BEST'; el.scorelab.classList.add('best');
        play(el.sflash, [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 0.85, offset: 0.6 }, { opacity: 0 }], 1300, 'ease-out');
        play(el.scorebox, [{ transform: 'translateX(-50%) scale(1)' }, { transform: 'translateX(-50%) scale(1.14)', offset: 0.25 }, { transform: 'translateX(-50%) scale(1)' }], 460, 'ease-out');
        this.buzz([30, 50, 30, 50, 80]);
        // (main.js hands a new best to the HUD alone; the sound hears of it from this)
        dispatchEvent(new CustomEvent('minidrift:best'));
        break;
      }
      case 'jturn': this.toast('J-TURN!', 'good', true, '+' + fmt(e.value), 2); this.buzz([20, 30, 30]); break;
    }
  }

  /** The run so far, on the pause screen: the course, the score against the best, and the run's records. */
  fillCard() {
    const s = this.scoring;
    if (!s) return;
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

  /**
   * @param s Scoring; car; rpm and gear from the gearbox; hour 0..24; distance m; boost seconds left and max
   */
  update(dt, s, car, gb, hour, dist, boostLeft, boostMax, perf) {
    const el = this.el;
    this.scoring = s;
    // the score rolls up to the total, once the banked points have flown into it
    if (performance.now() >= this.holdScore || s.total < this.shown) {
      this.shown = this.shown + (s.total - this.shown) * Math.min(1, dt * 9);
      if (Math.abs(this.shown - s.total) < 1) this.shown = s.total;
    }
    const sc = Math.round(this.shown);
    this.score.set(sc > 0 ? String(sc) : '0');

    // live drift
    const active = s.active && s.points > 1;
    el.drift.classList.toggle('on', active);
    if (active) {
      // (the count is redrawn at most twenty times a second: its outline and glow are redrawn with it, and digits that
      // change every frame are harder to read than ones that tick)
      const p = Math.round(s.points), now = performance.now();
      if (p !== this.lastPts && (now - (this._ptsT || 0) > 48 || !this._drifting)) { el.driftpts.textContent = '+' + fmt(p); this.lastPts = p; this._ptsT = now; }
      if (s.mult !== this.lastMult) { el.mult.textContent = '×' + s.mult.toFixed(1); this.lastMult = s.mult; }
      if (s.tier !== this.lastTier) { el.tier.textContent = SCORE.tierNames[s.tier] || ''; el.tier.className = 't' + s.tier; this.lastTier = s.tier; }
    } else this.lastTier = -1;

    // combo
    const combo = s.active ? s.chain : (s.chainTimer > 0 ? s.chain : 0);
    if (combo !== this.lastCombo) { el.combon.textContent = String(combo); this.lastCombo = combo; }
    const chainFrac = s.active ? 1 : (s.chainTimer > 0 ? s.chainTimer / SCORE.chainGrace : 0);
    el.chainf.style.transform = `scaleX(${chainFrac.toFixed(3)})`;

    // the cluster
    const mph = Math.round(car.kmh / 1.609344);
    this.speed.set(String(mph));
    const g = car.vF < -0.3 ? 'r' : (mph < 2 && car.throttle < 0.1 ? 'n' : String(gb.gear + 1));
    this.gear.set(g);
    this.rpm = damp(this.rpm, gb.rpm, 16, dt);
    const deg = (135 + 270 * clamp(this.rpm, 0, 9200) / 9000).toFixed(1);
    if (deg !== this.lastNeedle) { this.tach.needle.setAttribute('transform', `rotate(${deg} ${this.tach.cx} ${this.tach.cy})`); this.lastNeedle = deg; }
    const shiftOn = this.rpm > 7700;
    if (shiftOn !== this._shift) { this._shift = shiftOn; this.tach.shift.setAttribute('fill', shiftOn ? '#ff3b30' : 'rgba(255,59,48,.15)'); }

    const bf = clamp(boostLeft / boostMax, 0, 1);
    const nl = Math.round(bf * 12);
    if (nl !== this.lastLeds) { this.leds.forEach((l, i) => l.classList.toggle('on', i < nl)); this.lastLeds = nl; }
    const boosting = car.boost > 0.02;
    if (boosting !== this._boosting) { this._boosting = boosting; el.lampboost.classList.toggle('on', boosting); }
    if (active !== this._drifting) { this._drifting = active; el.lampdrift.classList.toggle('on', active); }
    this.clipT = Math.max(0, this.clipT - dt);
    const clip = this.clipT > 0;
    if (clip !== this._clip) { this._clip = clip; el.lampclip.classList.toggle('on', clip); }

    // drift angle: the meter, the degrees, and past the angle that scores the most, the burn
    const slide = Math.abs(car.beta) > 0.1 && car.speed > 5;
    if (slide !== this._slide) { this._slide = slide; el.angle.classList.toggle('on', slide); if (slide) this._coachDone(); }   // (a slide: the coach has done its job, and its place is the meter's)
    if (slide) {
      const d = clamp(car.beta * 180 / Math.PI, -70, 70), a = Math.abs(d);
      this._angleTo(d);
      const dg = Math.round(a);
      if (dg !== this.lastDeg) { this.lastDeg = dg; el.angledeg.textContent = dg + '°'; }
      const hot = a >= MAX_ANGLE;
      if (hot !== !!this._hot) { this._hot = hot; el.anglehot.style.opacity = hot ? '1' : '0'; el.angledeg.style.color = hot ? '#ff6fae' : ''; }
    }

    // clock and distance
    const hh = Math.floor(hour) % 24, mm = Math.floor((hour % 1) * 60);
    this.clock.set(String(hh).padStart(2, '0') + String(mm).padStart(2, '0'));
    this.dist.set(String(Math.floor(dist / 160.9344)).padStart(2, '0'));   // miles, one decimal

    this._coach(dt);
    this._nextToast();

    // the vignette and the hit flash are drawn by the post pass (main reads these two)
    this.hitFlash = Math.max(0, this.hitFlash - dt * 2.2);
    this.vignette = damp(this.vignette, active ? 1 : 0, 3, dt);
    if (this.perfOn && perf) el.perf.textContent = perf;
  }
}
