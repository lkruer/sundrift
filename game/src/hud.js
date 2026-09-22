/**
 * The HUD: score at the top, the live drift under it, the chain top-left, the day dial top-right, the
 * speedometer bottom-right with the boost bar above it. Everything is DOM and SVG, updated only when a value
 * changes so a phone is not re-laying out text sixty times a second.
 */
import { SCORE, clamp, damp } from './config.js?v=202609220418';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('en-US');

export class Hud {
  constructor() {
    this.el = {
      hud: $('hud'), scoren: $('scoren'), drift: $('drift'), driftpts: $('driftpts'), mult: $('mult'), tier: $('tier'),
      combon: $('combon'), chainf: $('chainf'), sundot: $('sundot'), distn: $('distn'),
      kmh: $('kmh'), needle: $('needle'), speedarc: $('speedarc'), boost: $('boost'), boostf: $('boostf'),
      toasts: $('toasts'), vign: $('vign'), hit: $('hit'), perf: $('perf'), best: $('best'), tools: $('tools'),
    };
    this.shown = 0; this.lastScore = -1; this.lastPts = -1; this.lastMult = -1; this.lastTier = -1;
    this.lastKmh = -1; this.lastCombo = -1; this.lastBoost = -1; this.lastDist = -1;
    this.hitFlash = 0; this.vignette = 0;
    this.perfOn = new URLSearchParams(location.search).has('perf');
    if (this.perfOn) this.el.perf.classList.add('on');
  }

  show(on) { this.el.hud.classList.toggle('on', on); this.el.tools.classList.toggle('on', on); }

  toast(text, cls = '', big = false) {
    const t = document.createElement('div');
    t.className = 'toast' + (cls ? ' ' + cls : '') + (big ? ' big' : '');
    t.textContent = text;
    // stack a little so two toasts in one second do not overprint
    const n = this.el.toasts.childElementCount;
    t.style.top = (n % 3) * 40 + 'px';
    this.el.toasts.appendChild(t);
    setTimeout(() => t.remove(), 1300);
  }

  /** React to scoring events. */
  onEvent(e) {
    switch (e.type) {
      case 'bank': {
        const tierWord = SCORE.tierNames[e.tier] || '';
        this.toast(`+${fmt(e.value)}${e.chain > 1 ? `  ×${e.chain} CHAIN` : ''}`, 'good', e.tier >= 2);
        if (tierWord) setTimeout(() => this.toast(tierWord + ' DRIFT', e.tier >= 3 ? 'bad' : ''), 260);
        break;
      }
      case 'tier': this.toast(SCORE.tierNames[e.value] || '', e.value >= 3 ? 'bad' : ''); break;
      case 'switch': this.toast('TRANSITION', 'good'); break;
      case 'clip': this.toast(`CLIP +${fmt(e.value)}`, ''); break;
      case 'crash': this.toast(`CRASH  -${fmt(e.value)}`, 'bad', true); this.hitFlash = 1; break;
      case 'bump': this.hitFlash = Math.max(this.hitFlash, 0.5); break;
      case 'sun': this.toast(e.value, ''); break;
    }
  }

  /**
   * @param s Scoring, car, hour (0..24), distance metres, boost seconds remaining, boost max
   */
  update(dt, s, car, hour, dist, boostLeft, boostMax, perf) {
    const el = this.el;
    // score counts up toward the total, fast, so a bank reads as a burst
    this.shown = this.shown + (s.total - this.shown) * Math.min(1, dt * 9);
    if (Math.abs(this.shown - s.total) < 1) this.shown = s.total;
    const sc = Math.round(this.shown);
    if (sc !== this.lastScore) { el.scoren.textContent = fmt(sc); this.lastScore = sc; }

    // live drift
    const active = s.active && s.points > 1;
    el.drift.classList.toggle('on', active);
    if (active) {
      const p = Math.round(s.points);
      if (p !== this.lastPts) { el.driftpts.textContent = '+' + fmt(p); this.lastPts = p; }
      if (s.mult !== this.lastMult) { el.mult.textContent = '×' + s.mult.toFixed(1); this.lastMult = s.mult; }
      if (s.tier !== this.lastTier) { el.tier.textContent = SCORE.tierNames[s.tier] || ''; el.tier.className = 't' + s.tier; this.lastTier = s.tier; }
    } else { this.lastTier = -1; }

    // chain
    const combo = s.active ? s.chain : (s.chainTimer > 0 ? s.chain : 0);
    if (combo !== this.lastCombo) { el.combon.textContent = String(combo); this.lastCombo = combo; }
    const chainFrac = s.active ? 1 : (s.chainTimer > 0 ? s.chainTimer / SCORE.chainGrace : 0);
    el.chainf.style.transform = `scaleX(${chainFrac.toFixed(3)})`;

    // speedometer: 0..240 km/h over 270 degrees
    const kmh = Math.round(car.kmh);
    if (kmh !== this.lastKmh) {
      el.kmh.textContent = String(kmh);
      const f = clamp(kmh / 240, 0, 1);
      el.needle.style.transform = `rotate(${(-135 + 270 * f).toFixed(1)}deg)`;
      el.speedarc.style.strokeDashoffset = String(306 - 306 * f);
      el.speedarc.style.stroke = kmh > 150 ? '#e8892a' : '#f0c24a';
      this.lastKmh = kmh;
    }

    // boost
    const bf = clamp(boostLeft / boostMax, 0, 1);
    if (Math.abs(bf - this.lastBoost) > 0.005) { el.boostf.style.width = (bf * 100).toFixed(1) + '%'; el.boost.classList.toggle('hot', bf > 0.01); this.lastBoost = bf; }

    // day dial: the sun travels the arc from 6 h to 18 h and sits below the line at night
    const a = Math.PI * clamp((hour - 6) / 12, -0.15, 1.15);
    el.sundot.setAttribute('cx', (32 - 28 * Math.cos(a)).toFixed(1));
    el.sundot.setAttribute('cy', (32 - 28 * Math.sin(a)).toFixed(1));
    el.sundot.setAttribute('fill', hour > 17 || hour < 7 ? '#e8892a' : '#f0c24a');

    // distance
    const km = Math.floor(dist / 100) / 10;
    if (km !== this.lastDist) { el.distn.textContent = km.toFixed(1); this.lastDist = km; }

    // flashes
    this.hitFlash = Math.max(0, this.hitFlash - dt * 2.2);
    el.hit.style.opacity = this.hitFlash.toFixed(2);
    const vt = active ? 0.55 : 0;
    this.vignette = damp(this.vignette, vt, 3, dt);
    el.vign.style.opacity = this.vignette.toFixed(2);

    if (this.perfOn && perf) el.perf.textContent = perf;
  }

  setBest(best) { this.el.best.textContent = best > 0 ? `BEST ${fmt(best)}` : ''; }
}
