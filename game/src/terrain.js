/**
 * The terrain: the ground (ground.js) meshed as square tiles in three levels of detail around the car, a coarse
 * far mesh under and beyond them out to the horizon, the woods scattered per tile with their brush and rocks, and
 * the farmland's fields put in with each tile (farm.js lays them out, farmland.js draws them).
 *
 * Every tile samples the same ground function, so tiles agree with each other, with the road ribbon and with
 * every prop; where two levels of detail meet, a skirt hangs from each tile's edge so no crack shows. Coarser
 * tiles keep a wider level verge beside the road, so their bigger triangles can never reach up over its edge.
 * Tiles are built a few rows per step inside a per-frame time budget, nearest first, and a tile that needs
 * rebuilding (new road beside it, or a new level of detail) keeps its old mesh until the new one is ready.
 */
import * as THREE from 'three';
import { PAL, clamp, lerp, smoothstep, mulberry32 } from './config.js?v=202610032044';
import { REACH } from './ground.js?v=202610032044';
import { instanceGroup, Pool, freezeStatic, releaseGeometry } from './instancing.js?v=202610032044';
import { KIND } from './farm.js?v=202610032044';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TILE = 96;
export const LODS = [
  { seg: 64, r: 200 },       // 1.5 m
  { seg: 32, r: 360 },       // 3 m
  { seg: 16, r: 560 },       // 6 m
];
const DROP_R = 640;
const FAR_SPAN = 3400, FAR_SEG = 136, FAR_RECENTER = 96;
let farIndex = null;                                      // the far mesh's triangles, the same every time (see _buildFar)
const tkey = (i, j) => (i + 50000) * 100000 + (j + 50000);

const C = {
  grass: new THREE.Color(PAL.springGrass), moss: new THREE.Color(PAL.moss), floor: new THREE.Color(0x3d5233), petal: new THREE.Color(0xf0b4c9),
  stone: new THREE.Color(PAL.stone), shot: new THREE.Color(0x9c978b), gravel: new THREE.Color(0x77716a),
  // the city: pavement by the road, dark lots and yards beyond, and the far ground a dull grey
  pave: new THREE.Color(0x8c8a85), lot: new THREE.Color(0x3b3c41), yard: new THREE.Color(0x4c4b48), cityFar: new THREE.Color(0x26272c),
  deep: new THREE.Color(0x2f4130), far: new THREE.Color(0x33463a),
  // the fields (farm.js): a paddy's mud under its water, a vegetable plot's soil, a house lot's beaten yard, the ground
  // between the tea rows (and a tea plot seen from too far for its rows: the rows' own green); far off, the fields as a
  // patchwork of water, young green and soil
  mud: new THREE.Color(0x4a4535), soil: new THREE.Color(0x6a4e36), yard2: new THREE.Color(0x9b8b6d), teaGround: new THREE.Color(0x4b4a31), tea: new THREE.Color(0x3f6a33),
  farWater: new THREE.Color(0x7c8e8c), farGreen: new THREE.Color(0x7f9f4f), farSoil: new THREE.Color(0x7a6a50),
};
// the trees' own colours (the forest tints every instance): Japanese cedar (sugi) and cypress (hinoki) in the
// plantations, the spring greens of the broadleaf woods (a few evergreen oaks darker, a chinquapin in its cream flower),
// young maples in their red spring leaf or fresh green, bamboo
const T = {
  cedar: [0x2f5a3a, 0x335f3c, 0x2a5236, 0x37643f, 0x2c5639, 0x31583a],
  hinoki: [0x3d6a52, 0x44705a, 0x3a654c],
  broad: [0x8cbf4f, 0x9cc85a, 0x7ab04a, 0x6f9e45, 0x5f8f3e, 0x4f7a3a, 0xa9c35a, 0xc4bf62, 0x86b84c],
  // (most maples in their fresh spring green; one in five in the red some keep their young leaves in: more read autumnal)
  maple: [0x9cc85a, 0xb3c95c, 0x8fbf55, 0xa3c45a, 0xa8473a],
  bamboo: [0x7da34a, 0x86ab4e, 0x739a44],
  cherry: [PAL.sakuraPale, PAL.sakuraPale, PAL.sakuraPink, PAL.sakuraWhite],
  // the low brush at the woods' edge and in the clearings: sasa, shrubs, ferns, and a few in flower (a soft azalea pink,
  // the yellow of yamabuki, white)
  brush: [0x7cab45, 0x6e9e3e, 0x86b34c, 0x4f7a38, 0x5d8f3a, 0x6f9a40, 0x7cab45, 0xd88aa6, 0xe0c048, 0xeae6da],
};
const pick = (list, r) => list[Math.min(list.length - 1, Math.floor(r * list.length))];
const FACADE = [0x55565c, 0x6b6a66, 0x7a746a, 0x3c3f47, 0x4a4e57, 0x8a8478, 0x5c5048, 0x2f3440, 0x6e6a74, 0x44474d];
const _c = new THREE.Color(), _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

export class Terrain {
  /**
   * @param opts { scene, ground, mat, farMat, parts: { cedar, maple, broadleaf, bare, ... }, density, seed, city, building,
   *   colliders, farmland (farmland.js: a tile's fields, planned while it builds and put in with it) }
   */
  constructor(opts) {
    this.o = opts;
    this.ground = opts.ground;
    this.field = opts.ground.field;
    this.root = new THREE.Group(); this.root.name = 'terrain';
    this.root.matrixAutoUpdate = false;                  // (it never moves: see freezeStatic)
    opts.scene.add(this.root);
    this.tiles = new Map();
    this.job = null;
    this.far = null; this.farAt = null; this.farJob = null;
    this.cx = 0; this.cz = 0;
    this.stats = { built: 0, ms: 0 };
    this.nextId = 1;
    this._farForest();
  }

  /**
   * The far forest: on the third ring of tiles (out to 560 m), where the trees used to stop and the hills went bare,
   * each tree is a single cone (a cedar) or a single blob (a cherry), in two pools shared by every tile: two draws.
   * They stand on the very cells the near forest uses (per-cell random numbers), with the near trees' own
   * materials, so a tree coming nearer turns into the full model where it stood.
   */
  _farForest() {
    const P = this.o.parts; if (!P || this.o.city) return;
    const foliageOf = (parts, re) => parts && parts.find((p) => re.test(p.material.name));
    const ced = foliageOf(P.cedar, /foliage/), chr = foliageOf(P.sakuraFar || P.maple || P.sakura, /foliage_tinted|foliage/);
    const brd = foliageOf(P.broadleaf, /foliage_tinted|foliage/);
    if (!ced || !chr) return;
    const size = (parts) => { const b = new THREE.Box3(), t = new THREE.Box3(); for (const p of parts) { p.geometry.computeBoundingBox(); t.copy(p.geometry.boundingBox).applyMatrix4(p.local); b.union(t); } return b; };
    const cb = size(P.cedar), kb = size(P.sakuraFar || P.maple || P.sakura);
    const cH = cb.max.y - cb.min.y, cR = Math.max(cb.max.x - cb.min.x, cb.max.z - cb.min.z) * 0.42;
    const cone = new THREE.ConeGeometry(cR, cH * 0.86, 6, 1); cone.translate(0, cb.min.y + cH * 0.14 + cH * 0.43, 0);
    const kW = Math.max(kb.max.x - kb.min.x, kb.max.z - kb.min.z), kH = kb.max.y - kb.min.y;
    const blob = new THREE.IcosahedronGeometry(0.5, 0); blob.scale(kW * 0.95, kH * 0.62, kW * 0.95); blob.translate(0, kb.min.y + kH * 0.62, 0);
    const I = new THREE.Matrix4();
    // (every far tree its own colour, as the near ones: the cone and the broadleaf's blob are tinted; the cherry was)
    this.farTrees = {
      cedar: new Pool([{ geometry: cone, material: ced.material, local: I }], 7000, { tint: true }),
      cherry: new Pool([{ geometry: blob, material: chr.material, local: I }], 4000, { tint: true }),
    };
    // (a phone draws the far broadleaf as the cedar's cones: a pool fewer)
    if (brd && (this.o.density || 1) >= 0.9) {
      const bb = size(P.broadleaf), bW = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z), bH = bb.max.y - bb.min.y;
      const b2 = new THREE.IcosahedronGeometry(0.5, 0); b2.scale(bW * 0.9, bH * 0.6, bW * 0.9); b2.translate(0, bb.min.y + bH * 0.66, 0);
      this.farTrees.broad = new Pool([{ geometry: b2, material: brd.material, local: I }], 4000, { tint: true });
    }
    // the shared pools of what every tile scatters besides its trees: the brush at the woods' edges (two lobes of
    // forty triangles, tinted: sasa, shrubs, ferns, a few in flower) and rocks on the steep ground (the boulder near,
    // a lumpy twenty-sided stone further off)
    this.extra = {};
    const shrubFol = foliageOf(P.shrub, /foliage_tinted|foliage/);
    if (shrubFol) {
      const a = new THREE.IcosahedronGeometry(1, 0); a.scale(1, 0.62, 0.85); a.translate(0, 0.3, 0);
      const b = new THREE.IcosahedronGeometry(0.72, 0); b.scale(1, 0.7, 1); b.translate(0.55, 0.26, 0.28);
      const geo = mergeGeometries([a.toNonIndexed(), b.toNonIndexed()]);
      const p = geo.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, 0);
      geo.computeVertexNormals();
      this.extra.brush = new Pool([{ geometry: geo, material: shrubFol.material, local: I }], this.o.density < 0.9 ? 2200 : 3600, { tint: true });
    }
    if (P.boulder) {
      this.extra.rockNear = new Pool(P.boulder, 900);
      const stone = P.boulder.find((p) => p.material.name === 'stone') || P.boulder[0];
      const g = new THREE.IcosahedronGeometry(0.75, 0).toNonIndexed();
      const q = g.attributes.position;
      for (let i = 0; i < q.count; i++) { const k = 1 + 0.18 * Math.sin(q.getX(i) * 7.1 + q.getZ(i) * 5.3); q.setXYZ(i, q.getX(i) * k, Math.max(0, q.getY(i) * k * 0.75 + 0.3), q.getZ(i) * k); }
      g.computeVertexNormals();
      this.extra.rockFar = new Pool([{ geometry: g, material: stone.material, local: I }], 2400);
    }
    for (const p of [...Object.values(this.farTrees), ...Object.values(this.extra)]) { this.root.add(p.group); freezeStatic(p.group); }
  }

  /** Forget every tile (a new course). */
  reset(ground) {
    if (ground) { this.ground = ground; this.field = ground.field; }
    for (const t of this.tiles.values()) this._dispose(t);
    this.tiles.clear();
    if (this.farTrees) for (const p of [...Object.values(this.farTrees), ...Object.values(this.extra || {})]) p.clear();
    // (a map with no forest has no far forest; the pass builds it again if it had none)
    if (this.o.city && this.farTrees) { for (const p of [...Object.values(this.farTrees), ...Object.values(this.extra || {})]) this.root.remove(p.group); this.farTrees = null; this.extra = null; }
    else if (!this.o.city && !this.farTrees) this._farForest();
    this.job = null; this.farJob = null; this.farAt = null;
    if (this.far) { this.root.remove(this.far); this.far.geometry.dispose(); this.far = null; }
  }

  /** New final road in a box: tiles it can reach rebuild. */
  markDirty(x0, z0, x1, z1, pad = REACH + 4) {
    const i0 = Math.floor((x0 - pad) / TILE), i1 = Math.floor((x1 + pad) / TILE);
    const j0 = Math.floor((z0 - pad) / TILE), j1 = Math.floor((z1 + pad) / TILE);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const t = this.tiles.get(tkey(i, j));
      if (t) t.dirty = true;
    }
  }

  /** The level a tile should be at, with a little hysteresis so a car on a boundary does not thrash it. */
  _want(t, x, z) {
    const d = Math.hypot((t.i + 0.5) * TILE - x, (t.j + 0.5) * TILE - z);
    t.d = d;
    for (let k = 0; k < LODS.length; k++) {
      const r = LODS[k].r + (t.lod === k ? 24 : 0);
      if (d <= r) return k;
    }
    return -1;
  }

  /** Keep the tiles around (x, z) built; work until the deadline (performance.now() ms). */
  update(x, z, deadline) {
    this.cx = x; this.cz = z;
    const R = LODS[LODS.length - 1].r;
    const i0 = Math.floor((x - R) / TILE), i1 = Math.floor((x + R) / TILE);
    const j0 = Math.floor((z - R) / TILE), j1 = Math.floor((z + R) / TILE);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = tkey(i, j);
      if (!this.tiles.has(k)) {
        const d = Math.hypot((i + 0.5) * TILE - x, (j + 0.5) * TILE - z);
        if (d <= R) this.tiles.set(k, { i, j, lod: -1, mesh: null, trees: null, dirty: false, d });
      }
    }
    for (const [k, t] of this.tiles) {
      t.want = this._want(t, x, z);
      if (t.d > DROP_R && !(this.job && this.job.tile === t)) { this._dispose(t); this.tiles.delete(k); }
    }
    let worked = false;
    while (performance.now() < deadline) {
      if (!this.job) this.job = this._nextJob();
      if (!this.job) break;
      worked = true;
      const r = this.job.it.next();
      if (r.done) this.job = null;
    }
    if (this.farTrees) for (const p of [...Object.values(this.farTrees), ...Object.values(this.extra || {})]) { p.flush(); for (const part of p.parts) part.im.visible = p.n > 0; }
    // the far mesh follows the car in steps
    if (!this.farAt || Math.hypot(x - this.farAt[0], z - this.farAt[1]) > FAR_RECENTER) {
      if (!this.farJob) {
        const fx = Math.round(x / FAR_RECENTER) * FAR_RECENTER, fz = Math.round(z / FAR_RECENTER) * FAR_RECENTER;
        this.farJob = this._buildFar(fx, fz);
      }
    }
    if (this.farJob && (performance.now() < deadline || !this.far)) {
      const r = this.farJob.next();
      if (r.done) this.farJob = null;
      worked = true;
    }
    return worked;
  }

  /** Build everything within `r` of (x, z) now (the loading screen). */
  prime(x, z, r = LODS[1].r) {
    for (let guard = 0; guard < 4000; guard++) {
      this.update(x, z, performance.now() + 1000);
      let pending = false;
      for (const t of this.tiles.values()) if (t.d <= r && (t.lod !== t.want || t.dirty)) { pending = true; break; }
      if (!pending && !this.job && !this.farJob && this.far) break;
    }
  }

  /** Tiles still to build near the car, for the loading bar. */
  pendingNear(r = LODS[0].r) {
    let n = 0;
    for (const t of this.tiles.values()) if (t.d <= r && (t.lod !== t.want || t.dirty)) n++;
    return n;
  }

  _nextJob() {
    let best = null, bestScore = Infinity;
    for (const t of this.tiles.values()) {
      if (t.want < 0) continue;
      const need = t.lod < 0 ? 0 : t.dirty ? 1 : t.lod !== t.want ? 2 : -1;
      if (need < 0) continue;
      // missing tiles first, nearest first; a rebuild waits behind any missing tile within 250 m
      const score = t.d + need * 250;
      if (score < bestScore) { bestScore = score; best = t; }
    }
    if (!best) return null;
    const lod = best.want;
    best.dirty = false;
    return { tile: best, it: this._build(best, lod) };
  }

  _dispose(t) {
    if (t.mesh) { this.root.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh = null; }
    if (t.farId && this.farTrees) { for (const p of Object.values(this.farTrees)) p.removeOwner(t.farId); t.farId = 0; }
    if (t.extraId && this.extra) { for (const p of Object.values(this.extra)) p.removeOwner(t.extraId); t.extraId = 0; }
    if (this.o.farmland) this.o.farmland.drop(t);
    if (t.trunks && this.o.colliders) { this.o.colliders.drop('tile' + t.i + ',' + t.j); t.trunks = null; }
    // (a tile's forest draws with geometries of its own over the templates' buffers: releaseGeometry, not dispose)
    if (t.trees) { this.root.remove(t.trees); t.trees.traverse((o) => { if (o.isInstancedMesh) { o.dispose(); if (o.userData.sharedGeometry) releaseGeometry(o.geometry); } }); t.trees = null; }
  }

  *_build(tile, lod) {
    const t0 = performance.now();
    const seg = LODS[lod].seg, sp = TILE / seg, n = seg + 3;
    const verge = Math.max(2.2, sp * 1.45);
    const H = new Float32Array(n * n), E = new Float32Array(n * n), F = new Uint8Array(n * n), S = new Float32Array(n * n);
    const x0 = tile.i * TILE - sp, z0 = tile.j * TILE - sp;
    const s = {};
    const g = this.ground;
    // the farmland's plots round the tile worked out first, a few at a time (farm.js prepare)
    if (!this.o.city && g.farm) yield* g.farm.prepare(tile.i * TILE - 40, tile.j * TILE - 40, (tile.i + 1) * TILE + 40, (tile.j + 1) * TILE + 40);
    const rowsPerStep = lod === 0 ? 9 : lod === 1 ? 18 : n;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        g.sample(x0 + i * sp, z0 + j * sp, verge, s);
        const k = j * n + i;
        H[k] = s.h; E[k] = s.edge; F[k] = (s.flat ? 1 : 0) | (s.tunnel ? 2 : 0) | (s.mouth ? 4 : 0); S[k] = s.s;
      }
      if (j % rowsPerStep === rowsPerStep - 1) yield;
    }
    const geo = this._geometry(tile, seg, H, E, F, S, lod);
    yield;
    // the fields of the plots whose middles are on this tile (farmland.js), worked out a few plots a step
    const plan = !this.o.city && this.o.farmland ? yield* this.o.farmland.plan(tile, lod, this.ground.farm, this.ground, TILE) : null;
    this._extraList = null; this._cherries = null;
    // (the far ring's trees go into the shared pools, and so do the second ring's on a phone: see _forest)
    const shared = !this.o.city && this.farTrees && (lod === 2 || (lod === 1 && (this.o.density || 1) < 0.9));
    const trees = this.o.city ? this._blocks(tile, lod, seg, H, E, F) : lod <= 1 && !shared ? this._forest(tile, lod, seg, H, E, F) : null;
    // swap
    this._dispose(tile);
    if (shared) this._forest(tile, lod, seg, H, E, F);
    // petals under the cherries just placed (the near rings only)
    if (!this.o.city && lod <= 1 && this._cherries) this._carpets(tile, seg, geo, this._cherries);
    if (plan) this.o.farmland.commit(tile, plan);
    if (this._extraList && this.extra) {
      const id = tile.extraId = this.nextId++;
      for (const [k, m, c] of this._extraList) { const pool = this.extra[k]; if (pool) pool.add(id, m, c); }
      this._extraList = null;
    }
    const mesh = new THREE.Mesh(geo, this.o.mat);
    mesh.receiveShadow = true; mesh.castShadow = false;
    mesh.name = 'tile';
    this.root.add(mesh);
    tile.mesh = mesh;
    if (trees) { this.root.add(trees); tile.trees = trees; }
    // (a tile and its forest never move once built: their matrices are made once, see freezeStatic)
    freezeStatic(mesh); if (trees) freezeStatic(trees);
    // the trunks the car can hit (the near ring only: the car is never out in the far one)
    if (this._trunks && this._trunks.length && this.o.colliders && lod === 0) { this.o.colliders.add('tile' + tile.i + ',' + tile.j, this._trunks); tile.trunks = true; }
    this._trunks = null;
    tile.lod = lod;
    this.stats.built++; this.stats.ms += performance.now() - t0;
  }

  /** Height on a tile's own surface (its triangles), for placing things exactly on it. */
  static surf(H, n, sp, lx, lz) {
    const gx = lx / sp + 1, gz = lz / sp + 1;
    const i = Math.min(n - 2, Math.max(0, Math.floor(gx))), j = Math.min(n - 2, Math.max(0, Math.floor(gz)));
    const fx = gx - i, fz = gz - j;
    const a = H[j * n + i], b = H[j * n + i + 1], c = H[(j + 1) * n + i], d = H[(j + 1) * n + i + 1];
    return fx + fz <= 1 ? a + (b - a) * fx + (c - a) * fz : d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
  }

  _colour(x, z, y, ny, edge, flags, lod, out) {
    const f = this.field;
    if (this.o.city) {
      const nz = f.vnoise(x / 17, z / 17, 7) * 0.5 + 0.5;
      out.copy(C.lot).lerp(C.yard, nz * 0.6);
      // the pavement: a band beyond each wall, where the street fronts stand back from the kerb
      if (edge > -0.2 && edge < 3.2) out.copy(C.pave).multiplyScalar(0.92 + 0.08 * nz);
      if (flags & 1) out.lerp(C.pave, 0.3);
      return out;
    }
    const nz = f.vnoise(x / 23, z / 23, 7) * 0.5 + 0.5;
    const farm = this.ground.farm;
    out.copy(C.grass).lerp(C.moss, clamp(nz * 1.3 - 0.2, 0, 1));
    // under the woods the ground is darker (where the woods stand: farm.js, the forest's own density)
    const woods = farm ? farm.woods(x, z) : smoothstep(-0.35, 0.35, f.vnoise(x / 140, z / 140, 8));
    out.lerp(C.floor, woods * 0.75 * smoothstep(3, 10, edge));
    const steep = smoothstep(0.62, 0.8, 1 - ny * ny);       // sin^2 of the slope: faces steeper than about 40 degrees
    if (steep > 0) {
      // cut faces by the road are sprayed concrete, the ones further off are bare rock
      const shot = 1 - smoothstep(6, 16, edge);
      _c.copy(C.stone).lerp(C.shot, shot * 0.8);
      out.lerp(_c, steep);
    }
    if (flags & 1) out.lerp(C.gravel, 0.55 + 0.25 * nz);    // the verge: gravel with grass coming through
    else if (edge < 5) out.lerp(C.gravel, 0.3 * (1 - edge / 5));
    if (flags & 2) out.lerp(C.floor, 0.4);
    // the fields: a paddy's mud (under its water), a vegetable plot's soil, a house lot's beaten yard, the shaded ground
    // between the tea rows, or, too far off for the rows, the tea's own green
    if (farm && !(flags & 3)) {
      const kind = farm.kindAt(x, z);
      if (kind === KIND.PADDY) out.copy(C.mud);
      else if (kind === KIND.VEG) out.copy(C.soil).multiplyScalar(0.92 + 0.16 * nz);
      else if (kind === KIND.HOUSE) out.lerp(C.yard2, 0.75);
      else if (kind === KIND.TEA) out.copy(lod <= 1 ? C.teaGround : C.tea).multiplyScalar(0.94 + 0.12 * nz);
    }
    // fallen petals blown into drifts against the verge (the carpets under the cherries are laid under the trees
    // themselves, _carpets: a carpet laid by a noise of its own lay out on open ground too and read as tan smudges)
    if (!(flags & 2) && steep < 0.5 && edge < 8) {
      const drift = smoothstep(0.1, 0.55, f.vnoise(x / 4.3, z / 4.3, 13)) * (flags & 1 ? 0.75 : 0.45 * (1 - edge / 8));
      out.lerp(C.petal, Math.min(0.45, drift * 0.42));
    }
    return out;
  }

  _geometry(tile, seg, H, E, F, S, lod = 0) {
    const n = seg + 3, sp = TILE / seg, row = seg + 1, V = row * row, per = 4 * seg;
    const total = V + per;
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3), uv = new Float32Array(total * 2);
    const wall = new Float32Array(total), wallS = new Float32Array(total);
    const ox = tile.i * TILE, oz = tile.j * TILE;
    for (let j = 0; j <= seg; j++) for (let i = 0; i <= seg; i++) {
      const k = (j + 1) * n + (i + 1), v = j * row + i;
      const x = ox + i * sp, z = oz + j * sp, y = H[k];
      let nx = (H[k - 1] - H[k + 1]) / (2 * sp), nz = (H[k - n] - H[k + n]) / (2 * sp), ny = 1;
      const il = 1 / Math.hypot(nx, ny, nz); nx *= il; ny *= il; nz *= il;
      pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
      nor[v * 3] = nx; nor[v * 3 + 1] = ny; nor[v * 3 + 2] = nz;
      this._colour(x, z, y, ny, E[k], F[k], lod, _c);
      col[v * 3] = _c.r; col[v * 3 + 1] = _c.g; col[v * 3 + 2] = _c.b;
      uv[v * 2] = x / 7; uv[v * 2 + 1] = z / 7;
      // slope protection on a steep face near the road (a cutting, or the face between two legs); not on a face that
      // looks along the road (the end of the hill over a tunnel): the lattice is laid out by distance along the road,
      // and there that runs down the slope, which stretched its beams into long pale scribbles across the hill
      wall[v] = (F[k] & 3) ? 0 : smoothstep(0.42, 0.58, 1 - ny * ny) * (1 - smoothstep(14, 24, E[k]));
      if (wall[v] > 0) {
        // (one-sided differences, the smaller: the nearest road can change between two legs, and S jumps there)
        const one = (a, b) => (Math.abs(a) < Math.abs(b) ? a : b);
        const sx = one(S[k + 1] - S[k], S[k] - S[k - 1]), sz = one(S[k + n] - S[k], S[k] - S[k - n]);
        const ls = Math.hypot(sx, sz), lh = Math.hypot(nx, nz);
        if (ls > 1e-3 && lh > 1e-3) wall[v] *= 1 - smoothstep(0.5, 0.8, Math.abs(sx * nx + sz * nz) / (ls * lh));
      }
      wallS[v] = S[k];                               // along the lattice: the distance along the road beside it
    }
    // the perimeter, walked once round, and a skirt hanging from it
    const perim = [];
    for (let i = 0; i < seg; i++) perim.push(i);                          // z = min, +x
    for (let j = 0; j < seg; j++) perim.push(j * row + seg);              // x = max, +z
    for (let i = seg; i > 0; i--) perim.push(seg * row + i);              // z = max, -x
    for (let j = seg; j > 0; j--) perim.push(j * row);                    // x = min, -z
    const drop = 1.5 + sp * 1.2;
    for (let p = 0; p < per; p++) {
      const src = perim[p], v = V + p;
      pos[v * 3] = pos[src * 3]; pos[v * 3 + 1] = pos[src * 3 + 1] - drop; pos[v * 3 + 2] = pos[src * 3 + 2];
      nor[v * 3] = nor[src * 3]; nor[v * 3 + 1] = nor[src * 3 + 1]; nor[v * 3 + 2] = nor[src * 3 + 2];
      col[v * 3] = col[src * 3] * 0.8; col[v * 3 + 1] = col[src * 3 + 1] * 0.8; col[v * 3 + 2] = col[src * 3 + 2] * 0.8;
      uv[v * 2] = uv[src * 2]; uv[v * 2 + 1] = uv[src * 2 + 1] + drop / 7;
      wall[v] = wall[src]; wallS[v] = wallS[src];
    }
    const idx = new (total > 65535 ? Uint32Array : Uint16Array)(seg * seg * 6 + per * 6);
    let o = 0;
    // at a tunnel mouth, a cell that would stretch from the road up to the hill over the bore stays open: it
    // is the sheet a heightfield would hang across the opening (see ground.js); the portal face hides the cut
    // (only where the cell really hangs from the road up to the hill: along the bore's sides, where the hill meets the
    // ground beside it at much the same height, an open cell was a trench beside the portal that showed the lining's
    // back glowing orange from any higher road)
    const flag = (v) => F[(Math.floor(v / row) + 1) * n + (v % row) + 1];
    const mouth = (v) => (flag(v) & 4) !== 0;
    const Y = (v) => pos[v * 3 + 1];
    const straddles = (a, b, c, d) => {
      if (!(mouth(a) || mouth(b) || mouth(c) || mouth(d))) return false;
      const t = (flag(a) & 2) + (flag(b) & 2) + (flag(c) & 2) + (flag(d) & 2);
      return t > 0 && t < 8 && Math.max(Y(a), Y(b), Y(c), Y(d)) - Math.min(Y(a), Y(b), Y(c), Y(d)) > 2.5;
    };
    for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) {
      const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
      if (straddles(a, b, c, d)) continue;
      idx[o++] = a; idx[o++] = c; idx[o++] = b;
      idx[o++] = b; idx[o++] = c; idx[o++] = d;
    }
    for (let p = 0; p < per; p++) {
      const q = (p + 1) % per;
      const tp = perim[p], tq = perim[q], bp = V + p, bq = V + q;
      if ((mouth(tp) || mouth(tq)) && ((flag(tp) & 2) !== (flag(tq) & 2)) && Math.abs(Y(tp) - Y(tq)) > 2.5) continue;
      idx[o++] = tp; idx[o++] = tq; idx[o++] = bp;
      idx[o++] = tq; idx[o++] = bq; idx[o++] = bp;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('wall', new THREE.BufferAttribute(wall, 1));
    geo.setAttribute('wallS', new THREE.BufferAttribute(wallS, 1));
    geo.setIndex(new THREE.BufferAttribute(idx.subarray(0, o), 1));
    geo.computeBoundingSphere();
    return geo;
  }

  /**
   * The view from each viewpoint lay-by near a tile: a wedge of the hillside below it opening out from the lay-by's
   * edge, clear of trees, so a viewpoint looks out over the valley (the forest grew right up to its railing, and
   * the view was a wall of cedar trunks). [cx, cz, outward x, z, forward x, z, half width]
   */
  _views(tile) {
    const t = this.ground.track, out = [];
    const mx = (tile.i + 0.5) * TILE, mz = (tile.j + 0.5) * TILE;
    for (const m of t.markers) {
      if (m.kind !== 'vista' || m.fi >= t.nFinalF) continue;
      const p = t.sample(m.s + m.len * 0.45), lx = Math.cos(p.h) * m.side, lz = -Math.sin(p.h) * m.side;
      const u = m.wlay + 1 + m.depth, cx = p.x + lx * u, cz = p.z + lz * u;
      if (Math.hypot(cx - mx, cz - mz) > 260) continue;
      out.push([cx, cz, lx, lz, Math.sin(p.h), Math.cos(p.h), m.len * 0.5 + 6]);
    }
    return out;
  }

  /**
   * The forest on a tile. The woods stand in stands with ragged edges and clearings between (farm.js woods): cedar and
   * cypress plantations where one slow noise says so, broadleaf woods of fresh spring greens and young maples in red
   * leaf where it says the other, mixed between, groves of cherry in blossom, and bamboo thickets at the margins of the
   * farm country. Near a stand's edge the trees are younger and smaller and the edge is crowded with low brush (sasa,
   * shrubs, a few in flower); out in a clearing a lone tree stands now and then. No tree stands in a field. Every tree
   * has its own colour and its own proportions. On the steep faces where no tree holds, rocks.
   */
  _forest(tile, lod, seg, H, E, F) {
    const f = this.field, P = this.o.parts, farm = this.ground.farm;
    const n = seg + 3, sp = TILE / seg;
    const far = lod >= 2;
    const views = this._views(tile);
    const inView = (x, z) => {
      for (const [cx, cz, ox, oz, fx, fz, hw] of views) {
        const dx = x - cx, dz = z - cz, along = dx * ox + dz * oz;
        if (along > -3 && along < 130 && Math.abs(dx * fx + dz * fz) < hw + along * 0.7) return true;
      }
      return false;
    };
    const dens0 = this.o.density || 1, phone = dens0 < 0.9;
    // the far ring's trees, and on a phone the second ring's too, are single cones and blobs in pools shared by every
    // tile: a draw or two in all, where a tile's own trees are a draw a kind a tile (a phone's budget is in draws)
    const shared = far || (phone && lod === 1);
    const spacing = (lod === 0 ? 8.8 : 11.5) / dens0;
    const cedars = [], sakura = [], broad = [], bare = [], bamboo = [], trunks = (this._trunks = lod > 0 ? null : []);
    const extra = this._extraList = [];
    this._cherries = lod <= 1 ? [] : null;
    const cells = Math.floor(TILE / spacing);
    const step = TILE / cells;
    let farId = 0;
    if (shared) { farId = tile.farId = this.nextId++; }
    for (let gz = 0; gz < cells; gz++) for (let gx = 0; gx < cells; gx++) {
      // (each cell its own random numbers, so a tree stands on the same spot at every level of detail; what only the
      // nearest ring adds, the brush, draws on a second stream so it never moves a tree)
      const seed = ((tile.i * 73856093) ^ (tile.j * 19349663) ^ (gx * 83492791) ^ (gz * 29765729) ^ (this.o.seed || 0)) >>> 0;
      const rng = mulberry32((seed ^ (lod === 0 ? 0x5bd1e995 : 0)) >>> 0), r2 = mulberry32((seed ^ 0x27d4eb2f) >>> 0);
      const lx = (gx + 0.15 + rng() * 0.7) * step, lz = (gz + 0.15 + rng() * 0.7) * step;
      const x = tile.i * TILE + lx, z = tile.j * TILE + lz;
      const gi = Math.round(lx / sp) + 1, gj = Math.round(lz / sp) + 1;
      const k = gj * n + gi;
      if (F[k] || E[k] < 4.5) continue;
      if (views.length && inView(x, z)) continue;
      const y = Terrain.surf(H, n, sp, lx, lz);
      // slope from the grid: no trees on cut faces, but rocks, of every size
      const sx = (H[k + 1] - H[k - 1]) / (2 * sp), sz = (H[k + n] - H[k - n]) / (2 * sp);
      if (sx * sx + sz * sz > 0.8) {
        // (past the cuttings' lattice: on it, a rock sat stuck to the concrete)
        if (E[k] > 22 && rng() < 0.34) {
          const rs = 0.45 + rng() * rng() * 2.4, ry = rng() * 6.28;
          _q.setFromAxisAngle(_up, ry); _s.set(rs * (0.8 + r2() * 0.5), rs * (0.6 + r2() * 0.5), rs);
          // (on a phone the plain stone everywhere: the boulder's two materials were two more draws)
          extra.push([lod === 0 && !phone ? 'rockNear' : 'rockFar', _m4.compose(_v.set(x, y - 0.3 * rs, z), _q, _s).clone(), null]);
          if (trunks) trunks.push([x, z, 0.62 * rs, y]);
        }
        continue;
      }
      // no tree in a field (a paddy, a house lot, the tea rows...)
      if (farm && farm.kindAt(x, z)) continue;
      const wn = farm ? farm.wn(x, z) : 0;
      const woods = farm ? farm.woodsOf(wn) : smoothstep(-0.55, 0.05, f.vnoise(x / 140, z / 140, 8));
      // scrub: a clearing by the road that nobody farms (too steep, or the road's banks in the way) grows young trees
      // and brush, not a lawn
      const scrub = farm && woods < 0.6 ? (1 - woods) * smoothstep(48, 20, E[k]) : 0;
      const lone = woods < 0.05 && rng() < 0.035;
      if (!lone && rng() > Math.max(woods, 0.45 * scrub)) {
        // a stand's edge and the clearings: brush, thick along the edge and in the scrub, scattered out in the open
        // (the nearest ring)
        if (lod === 0 && r2() < (woods > 0.04 || scrub > 0.3 ? 0.75 : 0.16) * (phone ? 0.55 : 1)) this._brush(extra, x, y, z, r2, Math.max(woods, scrub));
        continue;
      }
      const ry = rng() * Math.PI * 2;
      // a younger, smaller tree toward a stand's edge and in the scrub
      const sc = (0.72 + rng() * 0.6) * (lone ? 1.12 : 0.6 + 0.4 * Math.min(1, woods * 1.5));
      const syk = 0.86 + rng() * 0.3, sxk = 0.88 + rng() * 0.24, tint = rng();
      const patch = f.vnoise(x / 70, z / 70, 11);
      const spz = f.vnoise(x / 260, z / 260, 23) + 0.25 * f.vnoise(x / 90, z / 90, 24);
      const zone = farm ? farm.zoneOf(wn) : 0;
      const pk = rng();
      let kind;
      if (lone) kind = pk < 0.4 ? 'cherry' : pk < 0.55 ? 'maple' : 'broad';
      else if (scrub > woods) kind = pk < 0.5 ? 'broad' : pk < 0.72 ? 'maple' : pk < 0.92 ? 'cherry' : 'cedar';
      else if (zone > 0.15 && zone < 0.5 && f.vnoise(x / 60, z / 60, 25) > 0.3 && pk < 0.75) kind = 'bamboo';
      else if (patch > 0.42 && pk < 0.7) kind = pk < 0.28 ? 'broad' : 'cherry';
      else if (spz > 0.0) kind = pk < 0.2 ? 'hinoki' : 'cedar';                          // the plantations
      else if (spz < -0.12) kind = pk < 0.6 ? 'broad' : pk < 0.8 ? 'maple' : pk < 0.9 ? 'cherry' : 'cedar';
      else kind = pk < 0.55 ? 'cedar' : pk < 0.86 ? 'broad' : pk < 0.94 ? 'maple' : 'cherry';
      // (a cypress squatter and rounder than a cedar; a maple wide and low; bamboo tall and narrow)
      // (and the broadleaf crowns a little wider than the model's, so a wood of them closes over instead of standing as a
      // park of separate trees)
      let kx = sxk, ky = syk;
      if (kind === 'hinoki') { kx *= 1.2; ky *= 0.82; } else if (kind === 'cedar') kx *= 1.12; else if (kind === 'maple') { kx *= 1.3; ky *= 0.92; } else if (kind === 'bamboo') { kx *= 0.85; ky *= 1.05; } else if (kind === 'broad') { kx *= 1.32; ky *= 1.0; }
      _q.setFromAxisAngle(_up, ry); _s.set(sc * kx, sc * ky, sc * kx);
      const m = _m4.compose(_v.set(x, y - 0.35, z), _q, _s).clone();
      const colour = kind === 'cedar' ? pick(T.cedar, tint) : kind === 'hinoki' ? pick(T.hinoki, tint) : kind === 'maple' ? pick(T.maple, tint)
        : kind === 'bamboo' ? pick(T.bamboo, tint) : kind === 'cherry' ? pick(T.cherry, tint) : pick(T.broad, tint);
      if (shared) {
        if (kind === 'cherry') this.farTrees.cherry.add(farId, m, colour);
        else if (kind === 'cedar' || kind === 'hinoki' || !this.farTrees.broad) this.farTrees.cedar.add(farId, m, kind === 'cedar' || kind === 'hinoki' ? colour : pick(T.cedar, tint));
        else if (kind !== 'bare') this.farTrees.broad.add(farId, m, colour);
        continue;
      }
      if (trunks) trunks.push([x, z, (kind === 'bamboo' ? 0.8 : 0.36) * sc, y]);
      if (kind === 'cherry') { sakura.push({ m, colour }); this._cherries.push([x, z, sc]); }
      else if (kind === 'cedar' || kind === 'hinoki') cedars.push({ m, colour });
      else if (kind === 'bare') { if (lod === 0) bare.push({ m }); }
      else if (kind === 'bamboo' && lod === 0 && P.bamboo && !phone) bamboo.push({ m });
      else broad.push({ m, colour });
      // undergrowth among the trees along a stand's edge
      if (lod === 0 && woods < 0.85 && r2() < (phone ? 0.25 : 0.45)) {
        const a = r2() * 6.28, d = 2.2 + r2() * 1.8, bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d;
        if (!farm || !farm.kindAt(bx, bz)) this._brush(extra, bx, Terrain.surf(H, n, sp, clamp(bx - tile.i * TILE, 0, TILE), clamp(bz - tile.j * TILE, 0, TILE)), bz, r2, woods);
      }
    }
    if (shared) return null;
    const g = new THREE.Group(); g.name = 'forest';
    // the forest casts no shadow: at night the moon's tree shadows barely read, and drawing a forest twice was a
    // quarter of the frame's triangles
    const cast = false;
    // (the second ring's cedars are the plain-coned middle model: nobody can see a drooping rim at 250 m)
    if (cedars.length && P.cedar) g.add(instanceGroup(lod === 0 ? (P.cedarLite || P.cedar) : (P.cedarMid || P.cedar), cedars, { castShadow: cast, tint: true }));
    // (the far ring draws its cherries with the lighter maple, tinted the same: at 200 m nobody can tell, and it
    // is a third fewer triangles across a whole hillside)
    const cherry = lod === 0 ? (P.sakura || P.maple) : (P.sakuraFar || P.maple || P.sakura);
    if (sakura.length && cherry) g.add(instanceGroup(cherry, sakura, { castShadow: cast, tint: true }));
    // (the second ring's broadleaf, maples and bamboo too: a few flattened clouds and a stub, one draw)
    const bl = lod === 0 ? (P.broadleafLite || P.broadleaf) : (P.broadleafMid || P.broadleaf);
    if (broad.length && bl) g.add(instanceGroup(bl, broad, { castShadow: cast, tint: true }));
    if (bare.length && P.bare) g.add(instanceGroup(P.bare, bare, { castShadow: cast }));
    if (bamboo.length && P.bamboo) g.add(instanceGroup(P.bamboo, bamboo, { castShadow: cast }));
    return g;
  }

  /** A clump of brush: sasa spread wide and low, a shrub rounder, a few in flower; a little smaller out in the open. */
  _brush(list, x, y, z, r, woods) {
    const t = r(), sasa = t < 0.45, k = 0.75 + 0.25 * Math.min(1, woods * 3);
    const w = (sasa ? 1.3 + r() * 1.1 : 0.7 + r() * 0.6) * k, h = (sasa ? 0.45 + r() * 0.3 : 0.75 + r() * 0.5) * k;
    _q.setFromAxisAngle(_up, r() * 6.28); _s.set(w, h, w * (0.8 + r() * 0.4));
    const c = sasa ? T.brush[Math.floor(r() * 3)] : pick(T.brush, r());
    list.push(['brush', _m4.compose(_v.set(x, y - 0.08, z), _q, _s).clone(), c]);
  }

  /**
   * Petals fallen under the cherries just placed: each tree lays a carpet on the vertices under its crown, thickest
   * near the trunk and broken by a noise at its rim. (Only under real trees: see _colour.)
   */
  _carpets(tile, seg, geo, list) {
    if (!list.length) return;
    const f = this.field, sp = TILE / seg, row = seg + 1, ox = tile.i * TILE, oz = tile.j * TILE;
    const col = geo.attributes.color.array;
    for (const [cx, cz, sc] of list) {
      const R = 3.6 * sc;
      const i0 = Math.max(0, Math.floor((cx - R - ox) / sp)), i1 = Math.min(seg, Math.ceil((cx + R - ox) / sp));
      const j0 = Math.max(0, Math.floor((cz - R - oz) / sp)), j1 = Math.min(seg, Math.ceil((cz + R - oz) / sp));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = ox + i * sp, z = oz + j * sp, d = Math.hypot(x - cx, z - cz);
        if (d > R) continue;
        const k = 0.55 * smoothstep(R, R * 0.35, d) * (0.6 + 0.4 * (f.vnoise(x / 2.6, z / 2.6, 13) * 0.5 + 0.5));
        const v = (j * row + i) * 3;
        col[v] += (C.petal.r - col[v]) * k; col[v + 1] += (C.petal.g - col[v + 1]) * k; col[v + 2] += (C.petal.b - col[v + 2]) * k;
      }
    }
  }

  /**
   * The city behind the street fronts: blocks of buildings on a lot grid wherever the ground is well clear of
   * every road (the street fronts themselves are the world's), taller where a noise says downtown. One instanced
   * draw per tile; the building shader draws the windows.
   */
  _blocks(tile, lod, seg, H, E, F) {
    const f = this.field, B = this.o.building;
    if (!B) return null;
    const n = seg + 3, sp = TILE / seg;
    const rng = mulberry32(((tile.i * 73856093) ^ (tile.j * 19349663) ^ ((this.o.seed || 0) + 99)) >>> 0);
    const lot = lod === 2 ? 24 : 19, cells = Math.floor(TILE / lot), step = TILE / cells;
    const items = [];
    for (let gz = 0; gz < cells; gz++) for (let gx = 0; gx < cells; gx++) {
      const lx = (gx + 0.5) * step, lz = (gz + 0.5) * step;
      const x = tile.i * TILE + lx, z = tile.j * TILE + lz;
      const gi = Math.round(lx / sp) + 1, gj = Math.round(lz / sp) + 1;
      const k = gj * n + gi;
      const w = step * (0.62 + rng() * 0.3), d = step * (0.62 + rng() * 0.3);
      if (E[k] < 30 + Math.max(w, d) * 0.5 || F[k]) { rng(); rng(); continue; }
      if (rng() < 0.08) { rng(); continue; }                                  // a gap: a car park, a yard
      const down = f.vnoise(x / 260, z / 260, 21) * 0.5 + 0.5;
      const r = rng();
      const hgt = (8 + r * r * 34) * (0.7 + down * 1.6) + (r > 0.96 ? 40 + rng() * 60 : 0);
      const y = Terrain.surf(H, n, sp, lx, lz) - 0.3;
      _q.setFromAxisAngle(_up, 0); _s.set(w, hgt, d);
      const m = _m4.compose(_v.set(x, y + hgt / 2, z), _q, _s).clone();
      items.push({ m, colour: FACADE[Math.floor(rng() * FACADE.length)] });
    }
    if (!items.length) return null;
    const g = instanceGroup([{ geometry: B.geometry, material: B.material, local: new THREE.Matrix4() }], items, { castShadow: false, tint: true });
    g.name = 'blocks';
    return g;
  }

  /** The far mesh: the natural mountain out to the horizon, sunk under the tiles near its centre. */
  *_buildFar(cx, cz) {
    const f = this.field;
    const seg = FAR_SEG, sp = FAR_SPAN / seg, row = seg + 1, V = row * row;
    const pos = new Float32Array(V * 3), col = new Float32Array(V * 3);
    const x0 = cx - FAR_SPAN / 2, z0 = cz - FAR_SPAN / 2;
    const farm = this.o.city ? null : this.ground.farm, q = {};
    for (let j = 0; j <= seg; j++) {
      for (let i = 0; i <= seg; i++) {
        const x = x0 + i * sp, z = z0 + j * sp, v = j * row + i;
        const r = Math.hypot(x - cx, z - cz);
        const sink = 3 + 32 * (1 - smoothstep(340, 560, r));
        pos[v * 3] = x; pos[v * 3 + 1] = f.base(x, z) - sink; pos[v * 3 + 2] = z;
        if (this.o.city) _c.copy(C.cityFar).multiplyScalar(0.85 + 0.3 * (f.vnoise(x / 140, z / 140, 8) * 0.5 + 0.5));
        else if (farm) {
          // the woods dark where they stand (the forest's own density), the clearings lighter; the farm country's fields
          // a patchwork of water, young green and soil, one plot to a vertex
          const wn = farm.wn(x, z), w = farm.woodsOf(wn);
          _c.copy(C.far).lerp(C.deep, w * 0.8).lerp(C.grass, 0.14 * (1 - w));
          const zn = farm.zoneOf(wn);
          if (zn > 0.5) {
            farm.plotAt(x, z, q);
            const h = ((Math.imul((q.key % 1048576) | 0, 2654435761) ^ Math.imul(Math.floor(q.key / 1048576) | 0, 40503)) >>> 0) / 4294967296;
            _c.lerp(h < 0.5 ? C.farWater : h < 0.8 ? C.farGreen : C.farSoil, 0.55 * smoothstep(0.5, 0.65, zn));
          }
        } else {
          const nz = f.vnoise(x / 140, z / 140, 8);
          _c.copy(C.far).lerp(C.deep, smoothstep(-0.3, 0.4, nz) * 0.8).lerp(C.grass, 0.12 * (1 - smoothstep(-0.6, 0, nz)));
        }
        col[v * 3] = _c.r; col[v * 3 + 1] = _c.g; col[v * 3 + 2] = _c.b;
      }
      if (j % 34 === 33) yield;
    }
    // (the grid's triangles are the same for every far mesh: made once)
    if (!farIndex) {
      farIndex = new Uint32Array(seg * seg * 6);
      let o = 0;
      for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) {
        const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
        farIndex[o++] = a; farIndex[o++] = c; farIndex[o++] = b; farIndex[o++] = b; farIndex[o++] = c; farIndex[o++] = d;
      }
    }
    // The normals, as geometry.computeVertexNormals() makes them, operation for operation (so the very same numbers),
    // but a quarter of the triangles a step: done at once it was a 7 to 10 ms step (twice that on a slow phone) every
    // time the far mesh moved on, about every four seconds of driving
    const nor = new Float32Array(V * 3), idx = farIndex, nIdx = idx.length, per = Math.ceil(nIdx / 12) * 3;
    for (let q = 0; q < 4; q++) {
      const e = Math.min(nIdx, per * (q + 1));
      for (let i = per * q; i < e; i += 3) {
        const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
        const cbx = pos[c] - pos[b], cby = pos[c + 1] - pos[b + 1], cbz = pos[c + 2] - pos[b + 2];
        const abx = pos[a] - pos[b], aby = pos[a + 1] - pos[b + 1], abz = pos[a + 2] - pos[b + 2];
        const x = cby * abz - cbz * aby, y = cbz * abx - cbx * abz, z = cbx * aby - cby * abx;
        const ax = nor[a] + x, ay = nor[a + 1] + y, az = nor[a + 2] + z;
        const bx = nor[b] + x, by = nor[b + 1] + y, bz = nor[b + 2] + z;
        const qx = nor[c] + x, qy = nor[c + 1] + y, qz = nor[c + 2] + z;
        nor[a] = ax; nor[a + 1] = ay; nor[a + 2] = az;
        nor[b] = bx; nor[b + 1] = by; nor[b + 2] = bz;
        nor[c] = qx; nor[c + 1] = qy; nor[c + 2] = qz;
      }
      yield;
    }
    for (let v = 0; v < V * 3; v += 3) {
      const x = nor[v], y = nor[v + 1], z = nor[v + 2], s = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
      nor[v] = x * s; nor[v + 1] = y * s; nor[v + 2] = z * s;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    yield;
    geo.computeBoundingSphere();
    yield;
    if (this.far) { this.root.remove(this.far); this.far.geometry.dispose(); }
    const m = new THREE.Mesh(geo, this.o.farMat);
    m.frustumCulled = false; m.receiveShadow = false; m.castShadow = false; m.name = 'far';
    m.renderOrder = -1;
    this.root.add(m); freezeStatic(m);
    this.far = m; this.farAt = [cx, cz];
  }
}
