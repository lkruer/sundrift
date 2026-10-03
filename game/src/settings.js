/**
 * The player's settings: the sound's three levels (the master, the music, the effects), the units the speed and the
 * distance are read in, the camera's shake, how much of the TV's tube there is, and the graphics tier.
 *
 * Kept under sundrift.settings as one JSON object with a version; whatever does not read back (no storage, a value from
 * elsewhere) falls back to the defaults, which are the game as it shipped: every level at full (the mix as it was), MPH,
 * the shake on, the whole tube, the tier the machine is detected as. The graphics tier is read once, as the page loads
 * (main.js picks the renderer's tier before anything is built), so a change to it takes effect the next time the game
 * loads; everything else takes effect at once, through onChange.
 *
 * The panel is page elements like the other menus (index.html #settings, drawn on the TV by pagetv.js): a level is a
 * row of ten pips between a minus and a plus, a choice a row of buttons, one of them lit.
 */
const KEY = 'sundrift.settings';
export const SETTINGS_V = 1;
export const LEVELS = 10;
const DEFAULTS = { master: LEVELS, music: LEVELS, fx: LEVELS, units: 'mph', shake: 'on', tv: 'full', gfx: 'auto' };
const CHOICES = { units: ['mph', 'kmh'], shake: ['on', 'off'], tv: ['full', 'light'], gfx: ['auto', 'performance', 'quality'] };
const isLevel = (k) => k === 'master' || k === 'music' || k === 'fx';

function load() {
  const v = { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    const r = raw ? JSON.parse(raw) : null;
    if (r && typeof r === 'object' && r.v === SETTINGS_V) {
      for (const k of Object.keys(DEFAULTS)) {
        if (isLevel(k) && Number.isFinite(r[k])) v[k] = Math.max(0, Math.min(LEVELS, Math.round(r[k])));
        else if (CHOICES[k] && CHOICES[k].includes(r[k])) v[k] = r[k];
      }
    }
  } catch {}
  return v;
}

export class Settings {
  constructor() {
    this.v = load();
    this.onChange = null;          // (key, value, all)
    this.root = null;
  }

  /** A level as a gain, 0..1. */
  level(k) { return this.v[k] / LEVELS; }

  set(k, val) {
    if (isLevel(k)) val = Math.max(0, Math.min(LEVELS, Math.round(val)));
    else if (!CHOICES[k] || !CHOICES[k].includes(val)) return;
    if (this.v[k] === val) return;
    this.v[k] = val;
    try { localStorage.setItem(KEY, JSON.stringify({ v: SETTINGS_V, ...this.v })); } catch {}
    this.render();
    if (this.onChange) this.onChange(k, val, this.v);
  }

  /** The panel's controls: .vol[data-k] (a .vstep[data-d] each side of .pips), .seg[data-k] (buttons with data-v). */
  bind(root) {
    this.root = root;
    if (!root) return;
    for (const vol of root.querySelectorAll('.vol[data-k]')) {
      const k = vol.dataset.k, pips = vol.querySelector('.pips');
      if (pips && !pips.children.length) for (let i = 0; i < LEVELS; i++) pips.appendChild(document.createElement('i'));
      for (const b of vol.querySelectorAll('.vstep')) b.addEventListener('click', () => this.set(k, this.v[k] + Number(b.dataset.d)));
      // (a pip sets the level to itself; the first pip again, when it is the only one lit, turns the level off)
      if (pips) [...pips.children].forEach((p, i) => p.addEventListener('click', () => this.set(k, this.v[k] === 1 && i === 0 ? 0 : i + 1)));
      // the arrow keys, on either of the row's buttons
      vol.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : 0;
        if (d) { this.set(k, this.v[k] + d); e.preventDefault(); }
      });
    }
    for (const seg of root.querySelectorAll('.seg[data-k]')) {
      const k = seg.dataset.k;
      for (const b of seg.querySelectorAll('button[data-v]')) b.addEventListener('click', () => this.set(k, b.dataset.v));
    }
    this.render();
  }

  /** The panel as the settings stand: the lit pips and the number beside them, the chosen buttons. */
  render() {
    const root = this.root;
    if (!root) return;
    for (const vol of root.querySelectorAll('.vol[data-k]')) {
      const n = this.v[vol.dataset.k];
      const pips = vol.querySelector('.pips');
      if (pips) [...pips.children].forEach((p, i) => p.classList.toggle('on', i < n));
      const val = vol.querySelector('.sval');
      if (val && val.textContent !== String(n)) val.textContent = String(n);
      // (an end of the scale dims its button rather than disabling it: a disabled button drops the keyboard's focus)
      for (const b of vol.querySelectorAll('.vstep')) b.classList.toggle('end', (Number(b.dataset.d) < 0 && n <= 0) || (Number(b.dataset.d) > 0 && n >= LEVELS));
    }
    for (const seg of root.querySelectorAll('.seg[data-k]')) {
      for (const b of seg.querySelectorAll('button[data-v]')) {
        const on = b.dataset.v === this.v[seg.dataset.k];
        b.classList.toggle('sel', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    }
  }
}
