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
 */
export class Input {
  constructor() {
    this.keys = new Set();
    this.kSteer = 0;              // ramped keyboard steer, -1..1, left positive
    this.t = { active: false, id: null, x0: 0, y0: 0, steer: 0, throttle: 0, brake: 0, hand: false };
    this.touchMode = false;
    this.anyKey = false;
    this.zoom = 1;                // chase camera distance factor, mouse wheel or plus and minus
    try { this.zoom = Math.min(2.6, Math.max(0.7, Number(localStorage.getItem('minidrift.zoom')) || 1)); } catch {}
    addEventListener('wheel', (e) => this.setZoom(this.zoom * (1 + Math.sign(e.deltaY) * 0.12)), { passive: true });
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
    try { localStorage.setItem('minidrift.zoom', String(this.zoom)); } catch {}
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
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.preventDefault();
      if (e.code === 'Equal' || e.code === 'NumpadAdd') this.setZoom(this.zoom / 1.12);
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') this.setZoom(this.zoom * 1.12);
      if ((e.code === 'Escape' || e.code === 'KeyP') && this.onPause) { this.onPause(); e.preventDefault(); }
      if (e.code === 'KeyM' && this.onMute) this.onMute();
      this.anyKey = true;
      if (this.onAny) this.onAny();
    };
    const up = (e) => this.keys.delete(e.code);
    addEventListener('keydown', down, { passive: false });
    addEventListener('keyup', up);
    addEventListener('blur', () => this.keys.clear());
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
      const c = e.changedTouches[0];
      if (t.active) return;
      t.active = true; t.id = c.identifier; t.x0 = c.clientX; t.y0 = c.clientY;
      t.steer = 0; t.throttle = 1; t.brake = 0;
      place(c.clientX, c.clientY);
      wheel.style.opacity = '1'; nub.style.transform = 'translateX(0px)';
      layer.classList.add('used');
      if (!this.touchMode) this.setTouchMode(true);
      if (this.onAny) this.onAny();
      e.preventDefault();
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
