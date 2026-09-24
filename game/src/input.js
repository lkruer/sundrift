/**
 * Input: keyboard, and one-finger touch.
 *
 * Touch is REAL input on real DOM elements, never a debug hook. The left zone (#stick) is the one-finger
 * control: touching it is the throttle, sliding the finger left or right from where it landed is the
 * steering wheel (a virtual wheel appears under the finger), pulling it down past a threshold is the brake.
 * The right zone (#brake) is the handbrake for the other thumb. The jam gate lands in the middle of #stick,
 * drags up and holds, which here means "full throttle, straight", and the car moves.
 *
 * Keyboard steering is ramped rather than instant: a key is a switch, and a car steered by a switch darts.
 * The ramp is fast (about 0.12 s to full lock) and the return is faster, so it reads as responsive.
 *
 * A key means what is printed on it where that is one of the letters the game binds (W A S D, P, M), so the hints
 * hold on AZERTY and QWERTZ; any other key means where it sits (KeyboardEvent.code), so ZQSD by position on an AZERTY
 * board and every non-Latin layout still drive. One meaning per key, so no key does two things.
 */
const LABELS = { w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD', p: 'KeyP', m: 'KeyM' };
const meaning = (e) => (typeof e.key === 'string' && e.key.length === 1 && LABELS[e.key.toLowerCase()]) || e.code;
const DRIVE = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);

export class Input {
  constructor() {
    this.keys = new Set();          // what the held keys mean (see meaning)
    this.held = new Map();          // physical key (code) -> its meaning, so a key lets go of what it pressed
    this.kSteer = 0;              // ramped keyboard steer, -1..1, left positive
    this.t = { active: false, id: null, x0: 0, y0: 0, steer: 0, throttle: 0, brake: 0, hand: false };
    this.touchMode = false;
    this.anyKey = false;
    this.zoom = 1;                // chase camera distance factor, mouse wheel or plus and minus
    try { this.zoom = Math.min(2.6, Math.max(0.7, Number(localStorage.getItem('sundrift.zoom')) || 1)); } catch {}
    // A wheel's notch (a line or a page, or 40 px and more) is one 12% step, as it was; a trackpad sends a stream of a few
    // pixels at a time (dozens a swipe), which moves the zoom in proportion instead of throwing it end to end. A pinch
    // on a trackpad arrives as ctrl + wheel (Chrome, Firefox): the camera's zoom too, never the page's.
    // (deltaMode is read before deltaY: Firefox reports lines only to a page that asks what unit it is using)
    addEventListener('wheel', (e) => {
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1, px = e.deltaY * unit;
      if (!px) return;
      const step = unit > 1 || Math.abs(px) >= 40 ? 0.12 : Math.min(0.12, Math.abs(px) * (e.ctrlKey ? 0.01 : 0.0025));
      this.setZoom(this.zoom * (1 + Math.sign(px) * step));
    }, { passive: true });
    // (held only over the play surfaces, the canvas and the thumbs' layer, so the title menu's own scrolling stays passive)
    for (const id of ['c', 'touch']) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
    }
    // (Safari's own pinch, on a Mac trackpad and on an iPhone or iPad, comes as gesture events: the page does not zoom
    // under the game; and iOS ignores user-scalable=no, so two thumbs on the glass could otherwise zoom the page)
    for (const g of ['gesturestart', 'gesturechange']) addEventListener(g, (e) => e.preventDefault(), { passive: false });
    this.onAny = null;            // called on the first real input, to unlock audio
    this.onPause = null;          // Escape or P
    this.onMute = null;           // M
    // the orbit camera: hold either mouse button on the scene and drag; let go and the chase view comes back
    this.orbit = { held: false, dx: 0, dy: 0 };
    this._bindOrbit();
    this._bindKeys();
    this._bindTouch();
    this.setTouchMode(this.detectTouch());
  }

  setZoom(z) {
    this.zoom = Math.min(2.6, Math.max(0.7, z));
    try { localStorage.setItem('sundrift.zoom', String(this.zoom)); } catch {}
  }

  detectTouch() {
    const hasTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return hasTouch && (coarse || !(window.matchMedia && window.matchMedia('(pointer: fine)').matches));
  }

  setTouchMode(on) {
    this.touchMode = !!on;
    const layer = document.getElementById('touch');
    if (layer) layer.classList.toggle('on', this.touchMode);
    document.body.classList.toggle('touch', this.touchMode);
  }

  _bindKeys() {
    const down = (e) => {
      if (e.repeat) return;
      const k = meaning(e);
      this.held.set(e.code, k);
      this.keys.add(k);
      if (DRIVE.has(k)) e.preventDefault();
      // zoom: the keys printed + and - on any layout (on QWERTZ + is where QWERTY has ], and - where it has /), or the pad's
      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') this.setZoom(this.zoom / 1.12);
      else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') this.setZoom(this.zoom * 1.12);
      if ((k === 'Escape' || k === 'KeyP') && this.onPause) { this.onPause(); e.preventDefault(); }
      if (k === 'KeyM' && this.onMute) this.onMute();
      // Enter or Space on the title starts a run (main.js decides whether the title is up), also straight after a
      // click on a map, a course or a paint (the focus stays on that button, and its own Enter would only choose it
      // again); not while START or a pause-menu button has the focus, whose own Enter and Space already press it
      if ((e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') && this.onStart) {
        const f = document.activeElement;
        const choice = f && f.closest && f.closest('.map, .diff, .sw');
        if (choice || !(f && f.closest && f.closest('button, a, input, select, textarea'))) {
          if (this.onStart() && choice) e.preventDefault();
        }
      }
      this.anyKey = true;
      if (this.onAny) this.onAny();
    };
    const up = (e) => {
      const k = this.held.has(e.code) ? this.held.get(e.code) : e.code;
      this.held.delete(e.code);
      // (another key still held with the same meaning keeps it: on AZERTY both Q and A are left)
      for (const v of this.held.values()) if (v === k) return;
      this.keys.delete(k);
    };
    addEventListener('keydown', down, { passive: false });
    addEventListener('keyup', up);
    addEventListener('blur', () => { this.keys.clear(); this.held.clear(); });
  }

  _bindOrbit() {
    const ui = (t) => !!(t && t.closest && t.closest('button, a, input, #title .menu, #pause, #touch'));
    const o = this.orbit;
    addEventListener('mousedown', (e) => {
      if ((e.button !== 0 && e.button !== 2) || ui(e.target)) return;
      o.held = true; o.dx = 0; o.dy = 0;
      document.body.classList.add('orbiting');
      e.preventDefault();
    });
    addEventListener('mousemove', (e) => { if (o.held) { o.dx += e.movementX || 0; o.dy += e.movementY || 0; } });
    const release = (e) => { if (!e || (e.buttons & 3) === 0) { o.held = false; document.body.classList.remove('orbiting'); } };
    addEventListener('mouseup', release);
    addEventListener('blur', () => release(null));
    // the right button orbits, so it must not open the browser's menu over the game
    addEventListener('contextmenu', (e) => { if (!ui(e.target)) e.preventDefault(); });
  }

  /** The drag since the last call, in pixels, and whether a button is held. */
  takeOrbit() {
    const o = this.orbit, r = { held: o.held, dx: o.dx, dy: o.dy };
    o.dx = 0; o.dy = 0;
    return r;
  }

  _bindTouch() {
    const stick = document.getElementById('stick');
    const brake = document.getElementById('brake');
    const wheel = document.getElementById('wheel');
    const nub = wheel && wheel.querySelector('.nub');
    const layer = document.getElementById('touch');
    if (!stick || !brake) return;
    const R = 64;                              // px of slide for full lock
    const t = this.t;
    const place = (x, y) => {
      const r = stick.getBoundingClientRect();
      wheel.style.left = (x - r.left) + 'px';
      wheel.style.top = (y - r.top) + 'px';
    };
    stick.addEventListener('touchstart', (e) => {
      // (first, for every finger that lands here: a second thumb on the stick is ignored, but left to the browser it
      // could still start a pinch-zoom, a double-tap zoom or iOS's long-press magnifier)
      e.preventDefault();
      const c = e.changedTouches[0];
      if (t.active) return;
      t.active = true; t.id = c.identifier; t.x0 = c.clientX; t.y0 = c.clientY;
      t.steer = 0; t.throttle = 1; t.brake = 0;
      place(c.clientX, c.clientY);
      wheel.style.opacity = '1'; nub.style.transform = 'translateX(0px)';
      layer.classList.add('used');
      if (!this.touchMode) this.setTouchMode(true);
      if (this.onAny) this.onAny();
    }, { passive: false });
    stick.addEventListener('touchmove', (e) => {
      for (const c of e.changedTouches) {
        if (c.identifier !== t.id) continue;
        const dx = c.clientX - t.x0, dy = c.clientY - t.y0;
        const s = Math.max(-1, Math.min(1, dx / R));
        t.steer = -s;                                       // slide right = steer right = negative
        // pulling down is the brake; a small dead zone so a wobbly thumb does not brake by accident
        const down = Math.max(0, dy - 48) / 60;
        t.brake = Math.min(1, down);
        t.throttle = t.brake > 0.05 ? 0 : 1;
        nub.style.transform = `translateX(${s * (wheel.clientWidth * 0.5 - 17)}px)`;
        // the nub goes red while the finger is pulled down into the brake, so the brake zone can be seen
        const braking = t.brake > 0.05;
        if (braking !== t.braking) { t.braking = braking; nub.style.background = braking ? 'rgba(255,59,48,.75)' : ''; nub.style.borderColor = braking ? '#ff3b30' : ''; }
        // the wheel follows the finger vertically a little so it never sits far from the thumb
        if (Math.abs(dy) > 90) { t.y0 = c.clientY - Math.sign(dy) * 90; place(t.x0, t.y0); }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const c of e.changedTouches) {
        if (c.identifier !== t.id) continue;
        t.active = false; t.id = null; t.steer = 0; t.throttle = 0; t.brake = 0;
        wheel.style.opacity = '0';
        if (t.braking) { t.braking = false; nub.style.background = ''; nub.style.borderColor = ''; }
      }
    };
    stick.addEventListener('touchend', end);
    stick.addEventListener('touchcancel', end);

    // (a light tick under the thumb as the handbrake goes on, where the phone can: Android; the first touch of a
    // second finger on the pad does not tick again)
    const bd = (e) => {
      if (!t.hand && typeof navigator.vibrate === 'function' && !(navigator.userActivation && !navigator.userActivation.hasBeenActive)) { try { navigator.vibrate(10); } catch {} }
      t.hand = true; brake.classList.add('dn'); layer.classList.add('used'); if (!this.touchMode) this.setTouchMode(true); if (this.onAny) this.onAny(); e.preventDefault();
    };
    const bu = (e) => { if (e.touches && e.touches.length && [...e.touches].some((x) => brake.contains(x.target))) return; t.hand = false; brake.classList.remove('dn'); };
    brake.addEventListener('touchstart', bd, { passive: false });
    brake.addEventListener('touchend', bu);
    brake.addEventListener('touchcancel', bu);
    // a phone that reports a fine pointer (some tablets with a stylus) still gets the layer on first touch
    addEventListener('touchstart', () => { if (!this.touchMode) this.setTouchMode(true); }, { passive: true, once: true });
  }

  /** Once per frame. Returns the car's input object. */
  sample(dt) {
    const k = this.keys;
    const t = this.t;
    let steerKey = (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) - (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0);
    const rate = steerKey !== 0 ? 7.2 : 12;              // a key eases the wheel over (0.14 s to full lock) and back
    this.kSteer += Math.max(-rate * dt, Math.min(rate * dt, steerKey - this.kSteer));
    if (Math.abs(this.kSteer) < 0.01 && steerKey === 0) this.kSteer = 0;
    const gasKey = k.has('KeyW') || k.has('ArrowUp');
    const brakeKey = k.has('KeyS') || k.has('ArrowDown');
    const handKey = k.has('Space') || k.has('ShiftLeft') || k.has('ShiftRight');
    const usingTouch = t.active || t.hand;
    return {
      throttle: t.active ? t.throttle : (gasKey ? 1 : 0),
      brake: t.active ? t.brake : (brakeKey ? 1 : 0),
      steer: t.active ? t.steer : this.kSteer,
      hand: (t.hand || handKey) ? 1 : 0,
      reverse: t.active ? t.brake > 0.5 : brakeKey,
      touch: usingTouch || (this.touchMode && !this.anyKey),
    };
  }
}
