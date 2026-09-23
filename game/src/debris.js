/**
 * Debris: the things the car knocks over, for the few seconds they fly.
 *
 * A knocked prop leaves its instanced pool and comes back as a small rigid body: a box the size of the prop,
 * tumbling under gravity, its eight corners bouncing and sliding on the ground with a little restitution and
 * Coulomb friction, spinning from where it was struck. It sleeps when it settles, and after a while it sinks away.
 * It is drawn with the prop's own geometry and materials as an instanced mesh of one, so it uses the very programs
 * the pools already compiled (a plain Mesh with those materials would compile new ones mid-drive: a stall).
 *
 * Flattened things (bushes) are not bodies at all: their own instance is squashed in place, with a springy
 * overshoot, and stays flat.
 */
import * as THREE from 'three';

const _v = new THREE.Vector3(), _r = new THREE.Vector3(), _n = new THREE.Vector3(0, 1, 0), _t = new THREE.Vector3(), _w = new THREE.Vector3();
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _c = new THREE.Color();
const G = 16;                         // gravity, a touch strong: a little heavier than life reads as weight on screen

export class Debris {
  /** groundAt(x, z) -> height of the ground there */
  constructor(scene, groundAt, max = 24) {
    this.scene = scene; this.groundAt = groundAt; this.max = max;
    this.list = [];
    this.flats = [];
  }

  /**
   * parts: the prop's [{ geometry, material, local }]; foot: [half x, half z, height] at scale 1;
   * rec: { x, y, z, ry, sc, colour, m }; hit: { px, pz, dx, dz, speed, up } the push (a unit direction in the ground
   * plane), how hard (m/s), and how much of it goes upward.
   */
  spawn(parts, foot, rec, hit) {
    if (this.list.length >= this.max) this._remove(this.list[0]);
    const sc = rec.sc || 1, hx = Math.max(0.08, foot[0] * sc), hz = Math.max(0.08, foot[1] * sc), H = Math.max(0.2, foot[2] * sc);
    const hCom = H * 0.45;
    const outer = new THREE.Group(), inner = new THREE.Group();
    inner.position.set(0, -hCom, 0); inner.rotation.y = rec.ry || 0; inner.scale.setScalar(sc);
    outer.add(inner);
    for (const p of parts) {
      const im = new THREE.InstancedMesh(p.geometry, p.material, 1);
      im.setMatrixAt(0, p.local);
      if (p.material.name === 'foliage_tinted' || (p.material.userData && p.material.userData.tinted)) im.setColorAt(0, _c.set(rec.colour ?? 0xffffff));
      im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false;
      inner.add(im);
    }
    outer.position.set(rec.x, rec.y + hCom, rec.z);
    this.scene.add(outer);
    // the box's corners about the centre of mass, in the body's frame (the prop's own footprint, turned with it)
    const cs = [], ca = Math.cos(rec.ry || 0), sa = Math.sin(rec.ry || 0);
    for (const X of [-hx, hx]) for (const Z of [-hz, hz]) for (const Y of [-hCom, H - hCom]) cs.push(new THREE.Vector3(X * ca + Z * sa, Y, -X * sa + Z * ca));
    const m = Math.max(1, rec.m || 10);
    const I = m * (hx * hx * 4 + hz * hz * 4 + H * H) / 12 + m * 0.02;
    const b = { g: outer, cs, m, I, v: new THREE.Vector3(), w: new THREE.Vector3(), q: new THREE.Quaternion(), age: 0, still: 0, asleep: false, sink: 0, H, trail: !!hit.trail };
    // the push: struck at bumper height, so the base is kicked out and the top swings; light things fly
    const light = Math.min(1, 12 / m);
    // (swatted ahead at about half the car's speed and popped up high: the car catches it and passes under it)
    const J = new THREE.Vector3(hit.dx, 0, hit.dz).multiplyScalar(m * (hit.speed * (0.45 + 0.3 * light) + 1.2));
    J.y = m * (hit.up ?? (2 + 6.5 * light)) * (0.85 + 0.3 * Math.random());
    const at = new THREE.Vector3(hit.px - rec.x, Math.min(0.55, H * 0.5) - hCom, hit.pz - rec.z);
    b.v.copy(J).divideScalar(m);
    b.w.copy(at).cross(J).divideScalar(I);
    // and a little extra tumble, so no two fly alike
    b.w.x += (Math.random() - 0.5) * 6 * light; b.w.z += (Math.random() - 0.5) * 6 * light; b.w.y += (Math.random() - 0.5) * 8 * light;
    const wl = b.w.length(), wMax = 24 * light + 3; if (wl > wMax) b.w.multiplyScalar(wMax / wl);
    this.list.push(b);
    return b;
  }

  /** A bush, flattened where it stands: its pool instance squashed with a springy overshoot. */
  flatten(pool, id, rec, dx, dz) {
    this.flats.push({ pool, id, rec, dx, dz, t: 0 });
  }

  update(dt) {
    const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
    for (let k = this.list.length - 1; k >= 0; k--) {
      const b = this.list[k];
      b.age += dt;
      if (b.sink > 0 || b.age > 9 || (b.asleep && b.still > 3.5)) {
        // gone: it sinks into the ground and is taken away
        b.sink += dt;
        b.g.position.y -= dt * 0.9;
        if (b.sink > 1.2) this._remove(b);
        continue;
      }
      if (b.asleep) { b.still += dt; continue; }
      for (let i = 0; i < n; i++) this._step(b, h);
      b.g.quaternion.copy(b.q);
      // steel flying fast throws sparks behind it
      if (b.trail && this.onTrail && b.v.lengthSq() > 30 && Math.random() < 0.7) this.onTrail(b.g.position.x, b.g.position.y + (Math.random() - 0.5) * b.H * 0.6, b.g.position.z);
      const moving = b.v.lengthSq() > 0.09 || b.w.lengthSq() > 0.25;
      b.still = moving ? 0 : b.still + dt;
      if (!moving && b.still > 0.5 && b.touch) { b.asleep = true; b.still = 0; }
    }
    // the flattened: 0.22 s to flat, overshooting a little, then settling
    for (let k = this.flats.length - 1; k >= 0; k--) {
      const f = this.flats[k];
      f.t += dt;
      const t = Math.min(1, f.t / 0.26);
      const sy = 1 - 0.82 * (1 - Math.pow(1 - t, 3)) + 0.12 * Math.sin(t * Math.PI) * (1 - t);
      const sxz = 1 + 0.4 * (1 - Math.pow(1 - t, 2));
      const r = f.rec, sc = r.sc || 1;
      _q.setFromAxisAngle(_n, r.ry || 0);
      _m.compose(_v.set(r.x + f.dx * 0.35 * t, r.y, r.z + f.dz * 0.35 * t), _q, _s.set(sc * sxz, sc * sy, sc * sxz));
      f.pool.setById(f.id, _m);
      if (t >= 1) this.flats.splice(k, 1);
    }
  }

  _step(b, h) {
    b.v.y -= G * h;
    b.g.position.addScaledVector(b.v, h);
    // rotate by w h
    const wl = b.w.length();
    if (wl > 1e-6) { _q.setFromAxisAngle(_w.copy(b.w).divideScalar(wl), wl * h); b.q.premultiply(_q); }
    // the corners against the ground: push out, bounce, and slide with friction
    b.touch = false;
    for (const c of b.cs) {
      _r.copy(c).applyQuaternion(b.q);
      const px = b.g.position.x + _r.x, pz = b.g.position.z + _r.z, py = b.g.position.y + _r.y;
      const gy = this.groundAt(px, pz);
      const d = gy - py;
      if (d <= 0) continue;
      b.touch = true;
      b.g.position.y += d * 0.8;
      // the corner's velocity v + w x r
      _v.copy(b.w).cross(_r).add(b.v);
      const vn = _v.y;
      if (vn < 0) {
        const rxn = _t.copy(_r).cross(_n);
        const j = -(1.35) * vn / (1 / b.m + rxn.lengthSq() / b.I);
        b.v.y += j / b.m;
        b.w.addScaledVector(rxn, j / b.I);
        // friction along the ground, bounded by the normal impulse
        _v.copy(b.w).cross(_r).add(b.v); _v.y = 0;
        const vt = _v.length();
        if (vt > 1e-4) {
          _v.divideScalar(vt);
          const rxt = _t.copy(_r).cross(_v);
          const jt = Math.min(0.55 * j, vt / (1 / b.m + rxt.lengthSq() / b.I));
          b.v.addScaledVector(_v, -jt / b.m);
          b.w.addScaledVector(rxt, -jt / b.I);
        }
      }
    }
    if (b.touch) { b.w.multiplyScalar(Math.exp(-1.6 * h)); b.v.x *= Math.exp(-0.6 * h); b.v.z *= Math.exp(-0.6 * h); }
  }

  _remove(b) {
    const i = this.list.indexOf(b); if (i >= 0) this.list.splice(i, 1);
    this.scene.remove(b.g);
    b.g.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
  }

  clear() { for (const b of [...this.list]) this._remove(b); this.flats.length = 0; }
}
