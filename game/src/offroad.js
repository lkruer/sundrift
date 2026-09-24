/**
 * Off the road: the countdown, and the magnet that brings the car back.
 *
 * Where a stretch of road has no guardrail the car can leave it: onto the verge, up a bank, into a field. From
 * the moment its centre crosses the road's edge a five-second countdown runs in a panel under the score. Back
 * on the road, the panel folds away. At zero, a big red horseshoe magnet swoops down out of the sky, the car
 * leaps up and clanks onto it, and the magnet swings it back along an arc, spinning it round to face the way the
 * road runs, and drops it on the road where it left, with a thump, a ring of dust and sparkle, and a chime.
 *
 * The panel is part of the HUD, drawn on the TV (hud.js); the magnet, its beam and its rings are a handful of meshes
 * made once and parked out of sight.
 */
import * as THREE from 'three';
import { clamp, lerp, smoothstep } from './config.js?v=202609242050';

export const COURSE_OUT_S = 5;

// ---------------------------------------------------------------- the countdown panel

/**
 * The countdown's state; the HUD draws it on the TV (hud.js), under the score: a ring of blocks going out a second at a
 * time round the number, red in the last two, then the magnet's own mark shivering in it while the magnet has the car.
 */
export class CourseOutUI {
  constructor(hud) {
    this.hud = hud; hud.courseOut = this;
    this.shown = false; this.lastN = -1; this.mode = ''; this.punch = -1e9;
    this.f = 1; this.n = null; this.p = 0; this.glow = 0.24;
    this.head = 'コースアウト'; this.line = 'BACK TO THE ROAD'; this.sub = 'OR THE MAGNET TAKES YOU';
  }

  /** What the HUD has to redraw for: changes whenever the panel does. */
  sig() { return this.mode + (this.n === null ? '-' : this.n) + Math.round(this.f * 20) + Math.round(this.p * 8) + Math.round(this.glow * 6); }

  /** t: seconds left (null to hide); magnet: the magnet has taken over. */
  update(t, magnet = false) {
    const want = t !== null || magnet;
    if (want !== this.shown) { this.shown = want; if (!want) this.lastN = -1; this.hud.dirty = true; }
    if (!want) return;
    const mode = magnet ? 'mag' : t < 2 ? 'hot' : '';
    if (mode !== this.mode) {
      // (the magnet's words are what is happening, not an order)
      this.mode = mode;
      this.head = magnet ? 'マグネット' : 'コースアウト';
      this.line = magnet ? 'HOLD ON TIGHT' : 'BACK TO THE ROAD';
      this.sub = magnet ? 'BACK TO WHERE YOU LEFT' : mode === 'hot' ? 'THE MAGNET IS COMING' : 'OR THE MAGNET TAKES YOU';
      if (magnet) buzz([40, 60, 30]);
    }
    const now = performance.now() / 1000;
    if (magnet) { this.f = 1; this.n = null; this.p = 0; this.glow = 0.5 + 0.5 * Math.sin(now * 40); return; }
    const n = Math.max(0, Math.ceil(t - 1e-3));
    if (n !== this.lastN) { this.lastN = n; this.punch = now; if (mode === 'hot' && n > 0) buzz(16); }
    this.p = Math.max(0, 1 - (now - this.punch) / 0.32);
    // the last two seconds: the ring throbs
    this.glow = mode === 'hot' ? 0.5 + 0.5 * Math.sin(now * 14) : 0.24;
    this.f = clamp(t / COURSE_OUT_S, 0, 1); this.n = n;
  }
}

/** A short buzz on a phone that can (Android), for the last two seconds and the magnet: in a run, after a first tap. */
function buzz(p) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  if (!document.body.classList.contains('touch') || !document.body.classList.contains('playing')) return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try { navigator.vibrate(p); } catch {}
}

// ---------------------------------------------------------------- the magnet

const ease = {
  outBack: (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inOut: (t) => t * t * (3 - 2 * t),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
};
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * The magnet rig: a horseshoe magnet (red, steel tips), a soft beam from its tips down to the car, and three rings
 * that climb the beam. play(from, to) runs the sequence; update(dt) returns the car's pose while it runs and
 * reports its events ('grab', 'clank', 'fly', 'drop', 'land', 'done') so the game can play sounds and shake.
 */
export class Magnet {
  constructor(scene) {
    const g = new THREE.Group(); g.name = 'magnet';
    const red = new THREE.MeshStandardMaterial({ color: 0xe0262b, roughness: 0.32, metalness: 0.15, emissive: 0x5a0a0c, emissiveIntensity: 1 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xe4e8ee, roughness: 0.2, metalness: 0.85, emissive: 0x30343a, emissiveIntensity: 1 });
    const R = 0.95, T = 0.34;
    const arc = new THREE.TorusGeometry(R, T, 14, 30, Math.PI);
    const leg = new THREE.CylinderGeometry(T, T, 0.9, 20); leg.translate(0, -0.45, 0);
    const tip = new THREE.CylinderGeometry(T * 1.04, T * 1.04, 0.42, 20); tip.translate(0, -1.1, 0);
    const body = new THREE.Group();
    body.add(new THREE.Mesh(arc, red));
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(leg, red); l.position.x = s * R; body.add(l);
      const t = new THREE.Mesh(tip, steel); t.position.x = s * R; body.add(t);
    }
    // a handle cord on top, so it reads as a thing being lowered on a line
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 30, 6), new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.8 }));
    cord.position.y = R + T + 15; body.add(cord);
    body.scale.setScalar(1.05);
    g.add(body);
    // the beam: a soft additive cone from the tips down to the car, and the rings that climb it
    const beamMat = new THREE.MeshBasicMaterial({ color: 0x6ff0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.35, 1, 24, 1, true), beamMat);
    g.add(beam);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff5fb4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const rings = [];
    for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 6, 40), ringMat.clone()); r.rotation.x = Math.PI / 2; g.add(r); rings.push(r); }
    // the landing ring on the road
    const dustMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const dust = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.0, 40), dustMat); dust.rotation.x = -Math.PI / 2;
    g.add(dust);
    g.position.set(0, -600, 0);                 // parked out of sight (but drawn, so its programs compile at load)
    scene.add(g);
    this.g = g; this.body = body; this.beam = beam; this.rings = rings; this.dust = dust;
    this.mats = [red, steel, beamMat, ringMat, dustMat, cord.material];
    this.run = null;
  }

  get active() { return !!this.run; }

  get run() { return this._run; }
  /**
   * A run let go of before its end (RESTART or MAIN MENU while the magnet has the car: the game sets run to null) parks
   * the rig out of sight again with its beam, rings and dust dark; it used to hang in the sky where it was, beam lit.
   */
  set run(r) {
    this._run = r;
    if (!r && this.g) {
      this.g.position.set(0, -600, 0);
      this.beam.material.opacity = 0; this.dust.material.opacity = 0;
      for (const ring of this.rings) ring.material.opacity = 0;
    }
  }

  /** from, to: { x, y, z, yaw }. */
  play(from, to) {
    // the arc: up from where the car is, over, and down onto the road; its height grows with the distance
    const d = Math.hypot(to.x - from.x, to.z - from.z);
    const apex = Math.max(from.y, to.y) + 5 + Math.min(10, d * 0.35);
    let dyaw = wrapA(to.yaw - from.yaw);
    dyaw += (dyaw >= 0 ? 1 : -1) * Math.PI * 2;          // and one full turn on the way, for the fun of it
    this.run = { t: 0, from, to, apex, dyaw, events: new Set() };
  }

  /** Advance; returns { x, y, z, yaw, roll, pitch, squash, events[] } for the car, or null when not running. */
  update(dt, camPos) {
    const r = this.run;
    if (!r) return null;
    r.t += dt;
    const t = r.t, out = { events: [] };
    const fire = (e) => { if (!r.events.has(e)) { r.events.add(e); out.events.push(e); } };
    const { from, to } = r;
    const T_SWOOP = 0.38, T_SNAP = 0.62, T_FLY = 1.5, T_DROP = 1.78, T_END = 2.15;
    let cx, cy, cz, yaw, roll = 0, pitch = 0, squash = 1;
    let mx, my, mz, beamK = 0;
    const hang = 2.15;                                     // the car's origin hangs this far under the magnet's (roof to tips)
    if (t < T_SNAP) {
      // the magnet swoops down to the car; the car strains up, then leaps and clanks onto it
      fire('grab');
      // it comes in from the side of the road it will carry the car to, high, and settles over the roof
      const k = ease.outCubic(clamp(t / T_SWOOP, 0, 1));
      const ax = to.x - from.x, az = to.z - from.z, al = Math.hypot(ax, az) || 1, reach = Math.min(12, al * 0.5 + 4);
      mx = from.x + (ax / al) * reach * (1 - k); mz = from.z + (az / al) * reach * (1 - k); my = lerp(from.y + 11, from.y + 3.9, k);
      const snap = clamp((t - T_SWOOP) / (T_SNAP - T_SWOOP), 0, 1);
      cx = from.x; cz = from.z; yaw = from.yaw;
      const strain = t < T_SWOOP ? 0.06 * Math.sin(t * 60) * smoothstep(0.1, T_SWOOP, t) : 0;
      cy = from.y + strain + (my - hang - from.y) * ease.outBack(snap) * (snap > 0 ? 1 : 0);
      roll = Math.sin(t * 38) * 0.06 * (1 - snap);
      squash = snap > 0 ? 1 + 0.18 * Math.sin(snap * Math.PI) : 1;
      beamK = smoothstep(0.05, T_SWOOP, t);
      if (snap >= 1) fire('clank');
    } else if (t < T_FLY) {
      // the flight: an arc to above the road, the car swinging under the magnet and turning to face the road
      fire('fly');
      const k = ease.inOut((t - T_SNAP) / (T_FLY - T_SNAP));
      const x0 = from.x, z0 = from.z, y0 = from.y + 3.9, x1 = to.x, z1 = to.z, y1 = to.y + 4.2;
      mx = lerp(x0, x1, k); mz = lerp(z0, z1, k);
      my = lerp(y0, y1, k) + (r.apex - Math.max(y0, y1)) * Math.sin(k * Math.PI);
      cx = mx; cz = mz; cy = my - hang;
      yaw = from.yaw + r.dyaw * ease.inOut(k);
      // it swings: lagging back as it speeds up, forward as it slows
      pitch = Math.sin(k * Math.PI * 2) * 0.22;
      roll = Math.sin(k * Math.PI * 3) * 0.1;
      beamK = 1;
    } else if (t < T_DROP) {
      // let go: the car drops the last metres onto the road
      fire('drop');
      const k = (t - T_FLY) / (T_DROP - T_FLY);
      mx = to.x; mz = to.z; my = to.y + 4.2 + ease.inCubic(k) * 1.2;
      cx = to.x; cz = to.z; yaw = to.yaw;
      cy = to.y + (4.2 - hang) * (1 - ease.inCubic(k));
      beamK = 1 - k;
      if (k >= 0.98) fire('land');
    } else {
      // landed: a squash and a bounce; the magnet whips away upward
      fire('land');
      const k = (t - T_DROP) / (T_END - T_DROP);
      cx = to.x; cz = to.z; yaw = to.yaw;
      cy = to.y + Math.abs(Math.sin(k * Math.PI * 2)) * 0.25 * (1 - k);
      squash = 1 - 0.16 * Math.sin(Math.min(1, k * 2.5) * Math.PI) * (1 - k);
      mx = to.x; mz = to.z; my = to.y + 5.4 + ease.inCubic(k) * 40;
      if (t >= T_END) { fire('done'); this.run = null; this.g.position.set(0, -600, 0); out.x = cx; out.y = to.y; out.z = cz; out.yaw = yaw; out.roll = 0; out.pitch = 0; out.squash = 1; out.done = true; return out; }
    }
    // the rig follows the magnet; the magnet swings a little about its cord and faces the camera side-on
    this.g.position.set(mx, my, mz);
    const face = camPos ? Math.atan2(camPos.x - mx, camPos.z - mz) : 0;          // its face (the U) toward the camera
    this.body.rotation.set(0, face, Math.sin(t * 9) * 0.08);
    // the beam spans from the tips down to the car's roof
    const top = -1.25, bot = cy + 1.0 - my, len = Math.max(0.2, top - bot);
    this.beam.scale.set(1, len, 1); this.beam.position.set(cx - mx, (top + bot) / 2, cz - mz);
    this.beam.material.opacity = 0.16 * beamK * (0.8 + 0.2 * Math.sin(t * 30));
    this.rings.forEach((ring, i) => {
      const ph = ((t * 1.8 + i / 3) % 1);
      ring.position.set((cx - mx) * (1 - ph), bot + (top - bot) * ph, (cz - mz) * (1 - ph));
      const sc = lerp(1.5, 0.55, ph); ring.scale.set(sc, sc, sc);
      ring.material.opacity = 0.9 * beamK * Math.sin(ph * Math.PI);
    });
    // the landing ring spreads on the road
    if (t >= T_DROP) {
      const k = clamp((t - T_DROP) / 0.4, 0, 1);
      this.dust.position.set(cx - mx, to.y + 0.05 - my, cz - mz);
      const s = lerp(1.2, 5.5, ease.outCubic(k)); this.dust.scale.set(s, s, s);
      this.dust.material.opacity = 0.85 * (1 - k);
    } else this.dust.material.opacity = 0;
    Object.assign(out, { x: cx, y: cy, z: cz, yaw, roll, pitch, squash, k: t / T_END, toYaw: to.yaw });
    return out;
  }
}
