/**
 * Instancing for the world's repeated things.
 *
 * `instanceGroup` turns a template and a list of placements into one InstancedMesh per template part: used per
 * terrain tile for the forest, so a tile out of view culls its trees with it.
 *
 * `Pool` is one set of InstancedMeshes shared by the whole road: every lamp, post, pole, stud and roadside
 * tree of every built chunk lives in the same few draws, whatever the number of chunks. A chunk adds its
 * placements under its own id and removes them all at once when it is dropped (the last instance fills each
 * hole, so the live instances stay packed), and only the live range is uploaded.
 */
import * as THREE from 'three';

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _c = new THREE.Color(), _s = new THREE.Sphere();

/**
 * A subtree that never moves once placed (a road chunk's meshes, a terrain tile and its forest, a pool's group): its
 * matrices are made once here and three stops remaking them. It composes every object's matrix from its position,
 * rotation and scale and multiplies it into the parent's every frame otherwise, some 800 objects on a drive.
 * Anything added to the subtree later is left as it comes (updating itself), so it is always safe to freeze again.
 */
export function freezeStatic(root) {
  root.traverse((o) => { if (o.matrixAutoUpdate) { o.updateMatrix(); o.matrixAutoUpdate = false; } });
}

/** The meshes of a template (at the origin) with their transforms inside it. */
export function partsOf(tpl) {
  const parts = [];
  tpl.updateMatrixWorld(true);
  tpl.traverse((o) => { if (o.isMesh) parts.push({ geometry: o.geometry, material: o.material, local: o.matrixWorld.clone() }); });
  return parts;
}

/**
 * A geometry object of its own over a template's vertex buffers. An InstancedMesh drawn with the very geometry another
 * one uses (a kind of tree in every terrain tile) shares its vertex array with it, and three binds every attribute again
 * (a dozen GL calls) each time the two are drawn one after the other: some 350 to 550 GL calls a frame. With a geometry
 * of its own it keeps a vertex array of its own; the buffers are still the template's (nothing is copied). Let go of it
 * with releaseGeometry, never dispose(), which would delete the template's buffers.
 */
function shareGeometry(g) {
  const s = new THREE.BufferGeometry();
  for (const k in g.attributes) s.setAttribute(k, g.attributes[k]);
  s.setIndex(g.index);
  s.groups = g.groups; s.drawRange = g.drawRange;
  if (!g.boundingSphere) g.computeBoundingSphere();
  s.boundingBox = g.boundingBox; s.boundingSphere = g.boundingSphere;
  return s;
}

/** A shared geometry let go: its vertex arrays go with it, the template's buffers stay. */
export function releaseGeometry(g) {
  g.attributes = {}; g.index = null;
  g.dispose();
}

/** items: [{ m: Matrix4, colour? }]. Tinted parts (material named foliage_tinted) take the item colour. */
export function instanceGroup(parts, items, { castShadow = false, tint = false } = {}) {
  const g = new THREE.Group();
  if (!items.length) return g;
  for (const p of parts) {
    const im = new THREE.InstancedMesh(shareGeometry(p.geometry), p.material, items.length);
    im.userData.sharedGeometry = true;                // (released with releaseGeometry when its tile goes)
    const tinted = tint && (p.material.name === 'foliage_tinted' || p.material.userData.tinted);
    for (let i = 0; i < items.length; i++) {
      _m.multiplyMatrices(items[i].m, p.local);
      im.setMatrixAt(i, _m);
      if (tinted) im.setColorAt(i, _c.set(items[i].colour ?? 0xffffff));
    }
    im.castShadow = castShadow; im.receiveShadow = true;
    im.computeBoundingSphere();
    g.add(im);
  }
  return g;
}

export class Pool {
  constructor(parts, cap, { tint = false, castShadow = false } = {}) {
    this.group = new THREE.Group();
    this.cap = cap; this.n = 0;
    this.owner = new Int32Array(cap);
    this.ids = new Int32Array(cap); this.nextId = 1;   // every instance's own id, so one can be taken out (knocked over)
    this.base = new Float32Array(cap * 16);
    this.col = new Float32Array(cap * 3);
    this.dirty = false;
    this.lo = cap; this.hi = -1;                        // the slots written since the last flush: only they go to the GPU
    // A pool is culled like anything else when every one of its instances is out of view: it was drawn wherever the
    // camera looked, and on the pass about half of the pools' hundred draws had nothing in view (the torii, the shrine's
    // lanterns, the chevrons of a bend behind the car). The sphere round all its live instances is made again whenever
    // they change (flush); the template's own sphere (every part, at an instance's origin) is fixed.
    this.tpl = new THREE.Sphere(); this.sphere = new THREE.Sphere();
    this.tpl.makeEmpty();
    for (const p of parts) {
      if (!p.geometry.boundingSphere) p.geometry.computeBoundingSphere();
      this.tpl.union(_s.copy(p.geometry.boundingSphere).applyMatrix4(p.local));
    }
    this.parts = parts.map((p) => {
      const im = new THREE.InstancedMesh(p.geometry, p.material, cap);
      im.count = 0;
      im.frustumCulled = true; im.boundingSphere = this.sphere;       // (every part lies within the pool's sphere)
      im.castShadow = castShadow; im.receiveShadow = true;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const tinted = tint && (p.material.name === 'foliage_tinted' || p.material.userData.tinted);
      if (tinted) { im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); im.instanceColor.setUsage(THREE.DynamicDrawUsage); }
      this.group.add(im);
      return { im, local: p.local, tinted };
    });
  }

  /** Add one instance; returns its id (0 if the pool is full). */
  add(owner, m4, colour = null) {
    if (this.n >= this.cap) return 0;
    const k = this.n++;
    this.owner[k] = owner; this.ids[k] = this.nextId++;
    m4.toArray(this.base, k * 16);
    if (colour !== null) { _c.set(colour); this.col[k * 3] = _c.r; this.col[k * 3 + 1] = _c.g; this.col[k * 3 + 2] = _c.b; }
    else { this.col[k * 3] = this.col[k * 3 + 1] = this.col[k * 3 + 2] = 1; }
    this._write(k);
    this.dirty = true;
    return this.ids[k];
  }

  /** Move one instance (by its id) to a new transform: a bush squashed flat where it stands. */
  setById(id, m4) {
    for (let k = 0; k < this.n; k++) if (this.ids[k] === id) { m4.toArray(this.base, k * 16); this._write(k); this.dirty = true; return true; }
    return false;
  }

  /** Take one instance out by its id (the last one fills the hole). */
  removeId(id) {
    for (let k = 0; k < this.n; k++) {
      if (this.ids[k] !== id) continue;
      const last = --this.n;
      if (k !== last) {
        this.owner[k] = this.owner[last]; this.ids[k] = this.ids[last];
        this.base.copyWithin(k * 16, last * 16, last * 16 + 16);
        this.col.copyWithin(k * 3, last * 3, last * 3 + 3);
        this._write(k);
      }
      this.dirty = true;
      return true;
    }
    return false;
  }

  _write(k) {
    if (k < this.lo) this.lo = k;
    if (k > this.hi) this.hi = k;
    _m.fromArray(this.base, k * 16);
    for (const p of this.parts) {
      _m2.multiplyMatrices(_m, p.local);
      _m2.toArray(p.im.instanceMatrix.array, k * 16);
      if (p.tinted) { const a = p.im.instanceColor.array; a[k * 3] = this.col[k * 3]; a[k * 3 + 1] = this.col[k * 3 + 1]; a[k * 3 + 2] = this.col[k * 3 + 2]; }
    }
  }

  removeOwner(owner) {
    let k = 0, any = false;
    while (k < this.n) {
      if (this.owner[k] !== owner) { k++; continue; }
      any = true;
      const last = --this.n;
      if (k !== last) {
        this.owner[k] = this.owner[last]; this.ids[k] = this.ids[last];
        this.base.copyWithin(k * 16, last * 16, last * 16 + 16);
        this.col.copyWithin(k * 3, last * 3, last * 3 + 3);
        this._write(k);
      }
    }
    if (any) this.dirty = true;
  }

  clear() { this.n = 0; this.dirty = true; }

  /**
   * The GPU gets the slots written since the last flush, not the whole live range: a chunk laid down or taken up sent
   * every instance of every pool it touched again (the grass alone about 200 KB), frame after frame of a build. Ranges
   * add up until three sends them (the next time the mesh is drawn, which for a pool out of view may be a while); past
   * a couple of dozen they give way to the whole live range, which covers them all.
   */
  flush() {
    if (!this.dirty) return;
    const lo = this.lo, hi = Math.min(this.hi, this.n - 1);
    for (const p of this.parts) {
      p.im.count = this.n;
      if (hi < lo) continue;                            // (only the count changed: nothing to send)
      const im = p.im.instanceMatrix;
      if (im.updateRanges.length > 24) { im.clearUpdateRanges(); im.addUpdateRange(0, this.n * 16); }
      else im.addUpdateRange(lo * 16, (hi - lo + 1) * 16);
      im.needsUpdate = true;
      if (p.tinted) {
        const ic = p.im.instanceColor;
        if (ic.updateRanges.length > 24) { ic.clearUpdateRanges(); ic.addUpdateRange(0, this.n * 3); }
        else ic.addUpdateRange(lo * 3, (hi - lo + 1) * 3);
        ic.needsUpdate = true;
      }
    }
    this.lo = this.cap; this.hi = -1;
    this._bound();
    this.dirty = false;
  }

  /**
   * The sphere round every live instance: each instance's copy of the template's sphere (moved, and grown by its largest
   * scale), boxed, and the sphere round the box. Never smaller than the truth, so nothing in view is ever culled.
   */
  _bound() {
    const S = this.sphere, B = this.base, c = this.tpl.center, r = this.tpl.radius;
    if (this.n === 0 || r < 0) { S.makeEmpty(); return; }
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let k = 0, o = 0; k < this.n; k++, o += 16) {
      const x = B[o] * c.x + B[o + 4] * c.y + B[o + 8] * c.z + B[o + 12];
      const y = B[o + 1] * c.x + B[o + 5] * c.y + B[o + 9] * c.z + B[o + 13];
      const z = B[o + 2] * c.x + B[o + 6] * c.y + B[o + 10] * c.z + B[o + 14];
      const sc = Math.sqrt(Math.max(B[o] * B[o] + B[o + 1] * B[o + 1] + B[o + 2] * B[o + 2], B[o + 4] * B[o + 4] + B[o + 5] * B[o + 5] + B[o + 6] * B[o + 6], B[o + 8] * B[o + 8] + B[o + 9] * B[o + 9] + B[o + 10] * B[o + 10]));
      const rk = r * sc;
      if (x - rk < x0) x0 = x - rk; if (x + rk > x1) x1 = x + rk;
      if (y - rk < y0) y0 = y - rk; if (y + rk > y1) y1 = y + rk;
      if (z - rk < z0) z0 = z - rk; if (z + rk > z1) z1 = z + rk;
    }
    S.center.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    S.radius = 0.5 * Math.hypot(x1 - x0, y1 - y0, z1 - z0);
  }
}
