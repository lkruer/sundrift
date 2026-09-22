/**
 * The HUD, dressed as a 90s tuner's dash: amber seven-segment readouts with their unlit segments ghosting
 * through, a round tachometer with a redline and an orange needle, a gear digit, a row of boost LEDs and three
 * telltales. Score top centre, combo and distance top left, a digital clock top right, the cluster bottom right,
 * the drift-angle meter bottom centre while a slide is on.
 *
 * Everything is DOM and SVG, written only when a value changes (the needle, which moves every frame, is one
 * attribute), so a phone is not re-laying out text sixty times a second.
 */
import { SCORE, clamp, damp } from './config.js?v=202609222301';

const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const fmt = (n) => Math.round(n).toLocaleString('en-US');

const SEGS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '', r: 'eg', n: 'ceg', P: 'abefg' };

/** Seven-segment digits drawn as SVG polygons. */
class Seg7 {
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
      lampdrift: $('lampdrift'), lampclip: $('lampclip'), lampboost: $('lampboost'), angle: $('angle'), anglef: $('anglef'), angledeg: $('angledeg'),
    };
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
    this.rpm = 900; this.lastNeedle = ''; this.clipT = 0; this.hitFlash = 0; this.vignette = 0; this.lastAngle = '';
    this.perfOn = new URLSearchParams(location.search).has('perf') || new URLSearchParams(location.search).has('prof');
    if (this.perfOn) this.el.perf.classList.add('on');
    this.score.set(''); this.speed.set('0'); this.gear.set('n'); this.clock.set('0000'); this.dist.set('0');
  }

  show(on) { this.el.hud.classList.toggle('on', on); this.el.btns.classList.toggle('on', on); }

  /**
   * Draw every effect the HUD will ever use, once, nearly invisibly, while the title is up: the browser compiles
   * a raster shader the first time it draws a blurred text shadow or a glow, and doing that mid-drift was a
   * 100 ms stall at the first slide of the first run.
   */
  warm(on) {
    const el = this.el;
    el.hud.classList.toggle('warm', on);
    for (const e of [el.drift, el.angle, el.lampdrift, el.lampclip, el.lampboost]) e.classList.toggle('on', on);
    if (on) {
      el.driftpts.textContent = '+1,234'; el.mult.textContent = '×2.0'; el.tier.textContent = 'GREAT'; el.tier.className = 't3';
      this.toast('WARM', 'good', true); this.toast('WARM', 'bad'); this.toast('WARM');
      this.leds.forEach((l) => l.classList.add('on'));
    } else {
      el.driftpts.textContent = ''; el.tier.textContent = '';
      this.leds.forEach((l) => l.classList.remove('on'));
      this._drifting = this._clip = this._boosting = this._slide = false; this.lastLeds = 0; this.lastTier = -1;
    }
  }

  reset() { this.shown = 0; this.score.set(''); this.lastCombo = -1; }

  toast(text, cls = '', big = false) {
    const t = document.createElement('div');
    t.className = 'toast' + (cls ? ' ' + cls : '') + (big ? ' big' : '');
    t.textContent = text;
    const n = this.el.toasts.childElementCount;
    t.style.top = (n % 3) * 44 + 'px';
    this.el.toasts.appendChild(t);
    setTimeout(() => t.remove(), 1300);
  }

  onEvent(e) {
    switch (e.type) {
      case 'bank': {
        const tierWord = SCORE.tierNames[e.tier] || '';
        this.toast(`+${fmt(e.value)}${e.chain > 1 ? `  ×${e.chain}` : ''}`, 'good', e.tier >= 2);
        if (tierWord) setTimeout(() => this.toast(tierWord + ' DRIFT', e.tier >= 3 ? 'bad' : ''), 260);
        break;
      }
      case 'tier': this.toast(SCORE.tierNames[e.value] || '', e.value >= 3 ? 'bad' : ''); break;
      case 'switch': this.toast('SWITCH!', 'good'); break;
      case 'clip': this.toast(`CLIP +${fmt(e.value)}`, ''); this.clipT = 0.9; break;
      case 'crash': this.toast(`CRASH  -${fmt(e.value)}`, 'bad', true); this.hitFlash = 1; break;
      case 'bump': this.hitFlash = Math.max(this.hitFlash, 0.5); break;
      case 'sun': this.toast(e.value, ''); break;
      case 'best': this.toast('NEW BEST!', 'good', true); break;
    }
  }

  /**
   * @param s Scoring; car; rpm and gear from the gearbox; hour 0..24; distance m; boost seconds left and max
   */
  update(dt, s, car, gb, hour, dist, boostLeft, boostMax, perf) {
    const el = this.el;
    this.shown = this.shown + (s.total - this.shown) * Math.min(1, dt * 9);
    if (Math.abs(this.shown - s.total) < 1) this.shown = s.total;
    const sc = Math.round(this.shown);
    this.score.set(sc > 0 ? String(sc) : '0');

    // live drift
    const active = s.active && s.points > 1;
    el.drift.classList.toggle('on', active);
    if (active) {
      const p = Math.round(s.points);
      if (p !== this.lastPts) { el.driftpts.textContent = '+' + fmt(p); this.lastPts = p; }
      if (s.mult !== this.lastMult) { el.mult.textContent = '×' + s.mult.toFixed(1); this.lastMult = s.mult; }
      if (s.tier !== this.lastTier) { el.tier.textContent = SCORE.tierNames[s.tier] || ''; el.tier.className = 't' + s.tier; this.lastTier = s.tier; }
    } else this.lastTier = -1;

    // combo
    const combo = s.active ? s.chain : (s.chainTimer > 0 ? s.chain : 0);
    if (combo !== this.lastCombo) { el.combon.textContent = String(combo); this.lastCombo = combo; }
    const chainFrac = s.active ? 1 : (s.chainTimer > 0 ? s.chainTimer / SCORE.chainGrace : 0);
    el.chainf.style.transform = `scaleX(${chainFrac.toFixed(3)})`;

    // the cluster
    const kmh = Math.round(car.kmh);
    this.speed.set(String(kmh));
    const g = car.vF < -0.3 ? 'r' : (kmh < 2 && car.throttle < 0.1 ? 'n' : String(gb.gear + 1));
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

    // drift angle
    const slide = Math.abs(car.beta) > 0.1 && car.speed > 5;
    if (slide !== this._slide) { this._slide = slide; el.angle.classList.toggle('on', slide); }
    if (slide) {
      const d = clamp(car.beta * 180 / Math.PI, -70, 70);
      const w = (Math.abs(d) / 70 * 50).toFixed(1);
      const key = w + (d > 0 ? 'r' : 'l');
      if (key !== this.lastAngle) {
        this.lastAngle = key;
        el.anglef.style.width = w + '%';
        el.anglef.style.left = d > 0 ? '50%' : (50 - Number(w)) + '%';
        el.angledeg.textContent = Math.round(Math.abs(d)) + '°';
      }
    }

    // clock and distance
    const hh = Math.floor(hour) % 24, mm = Math.floor((hour % 1) * 60);
    this.clock.set(String(hh).padStart(2, '0') + String(mm).padStart(2, '0'));
    this.dist.set(String(Math.floor(dist / 100)).padStart(2, '0'));

    // the vignette and the hit flash are drawn by the post pass (main reads these two)
    this.hitFlash = Math.max(0, this.hitFlash - dt * 2.2);
    this.vignette = damp(this.vignette, active ? 1 : 0, 3, dt);
    if (this.perfOn && perf) el.perf.textContent = perf;
  }
}
