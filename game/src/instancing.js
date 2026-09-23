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

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _c = new THREE.Color();

/** The meshes of a template (at the origin) with their transforms inside it. */
export function partsOf(tpl) {
  const parts = [];
  tpl.updateMatrixWorld(true);
  tpl.traverse((o) => { if (o.isMesh) parts.push({ geometry: o.geometry, material: o.material, local: o.matrixWorld.clone() }); });
  return parts;
}

/** items: [{ m: Matrix4, colour? }]. Tinted parts (material named foliage_tinted) take the item colour. */
export function instanceGroup(parts, items, { castShadow = false, tint = false } = {}) {
  const g = new THREE.Group();
  if (!items.length) return g;
  for (const p of parts) {
    const im = new THREE.InstancedMesh(p.geometry, p.material, items.length);
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
    this.parts = parts.map((p) => {
      const im = new THREE.InstancedMesh(p.geometry, p.material, cap);
      im.count = 0;
      im.frustumCulled = false;
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

  flush() {
    if (!this.dirty) return;
    for (const p of this.parts) {
      p.im.count = this.n;
      const im = p.im.instanceMatrix;
      im.clearUpdateRanges(); im.addUpdateRange(0, Math.max(16, this.n * 16)); im.needsUpdate = true;
      if (p.tinted) { const ic = p.im.instanceColor; ic.clearUpdateRanges(); ic.addUpdateRange(0, Math.max(3, this.n * 3)); ic.needsUpdate = true; }
    }
    this.dirty = false;
  }
}
