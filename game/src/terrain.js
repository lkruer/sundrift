/**
 * The terrain: the ground (ground.js) meshed as square tiles in three levels of detail around the car, a coarse
 * far mesh under and beyond them out to the horizon, and the forest scattered per tile.
 *
 * Every tile samples the same ground function, so tiles agree with each other, with the road ribbon and with
 * every prop; where two levels of detail meet, a skirt hangs from each tile's edge so no crack shows. Coarser
 * tiles keep a wider level verge beside the road, so their bigger triangles can never reach up over its edge.
 * Tiles are built a few rows per step inside a per-frame time budget, nearest first, and a tile that needs
 * rebuilding (new road beside it, or a new level of detail) keeps its old mesh until the new one is ready.
 */
import * as THREE from 'three';
import { PAL, clamp, lerp, smoothstep, mulberry32 } from './config.js?v=202609222255';
import { REACH } from './ground.js?v=202609222255';
import { instanceGroup } from './instancing.js?v=202609222255';

export const TILE = 96;
export const LODS = [
  { seg: 64, r: 200 },       // 1.5 m
  { seg: 32, r: 360 },       // 3 m
  { seg: 16, r: 560 },       // 6 m
];
const DROP_R = 640;
const FAR_SPAN = 3400, FAR_SEG = 136, FAR_RECENTER = 96;
const tkey = (i, j) => (i + 50000) * 100000 + (j + 50000);

const C = {
  grass: new THREE.Color(PAL.dryGrass), moss: new THREE.Color(PAL.moss), floor: new THREE.Color(0x3d5233),
  stone: new THREE.Color(PAL.stone), shot: new THREE.Color(0x9c978b), gravel: new THREE.Color(0x77716a),
  deep: new THREE.Color(0x2f4130), far: new THREE.Color(0x33463a),
};
const _c = new THREE.Color(), _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

export class Terrain {
  /**
   * @param opts { scene, ground, mat, farMat, parts: { cedar, maple, broadleaf, bare }, density, seed }
   */
  constructor(opts) {
    this.o = opts;
    this.ground = opts.ground;
    this.field = opts.ground.field;
    this.root = new THREE.Group(); this.root.name = 'terrain';
    opts.scene.add(this.root);
    this.tiles = new Map();
    this.job = null;
    this.far = null; this.farAt = null; this.farJob = null;
    this.cx = 0; this.cz = 0;
    this.stats = { built: 0, ms: 0 };
  }

  /** Forget every tile (a new course). */
  reset(ground) {
    if (ground) { this.ground = ground; this.field = ground.field; }
    for (const t of this.tiles.values()) this._dispose(t);
    this.tiles.clear();
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
    if (t.trees) { this.root.remove(t.trees); t.trees.traverse((o) => { if (o.isInstancedMesh) o.dispose(); }); t.trees = null; }
  }

  *_build(tile, lod) {
    const t0 = performance.now();
    const seg = LODS[lod].seg, sp = TILE / seg, n = seg + 3;
    const verge = Math.max(2.2, sp * 1.45);
    const H = new Float32Array(n * n), E = new Float32Array(n * n), F = new Uint8Array(n * n), S = new Float32Array(n * n);
    const x0 = tile.i * TILE - sp, z0 = tile.j * TILE - sp;
    const s = {};
    const g = this.ground;
    const rowsPerStep = lod === 0 ? 9 : lod === 1 ? 18 : n;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        g.sample(x0 + i * sp, z0 + j * sp, verge, s);
        const k = j * n + i;
        H[k] = s.h; E[k] = s.edge; F[k] = (s.flat ? 1 : 0) | (s.tunnel ? 2 : 0); S[k] = s.s;
      }
      if (j % rowsPerStep === rowsPerStep - 1) yield;
    }
    const geo = this._geometry(tile, seg, H, E, F, S);
    yield;
    const trees = lod <= 1 ? this._forest(tile, lod, seg, H, E, F) : null;
    // swap
    this._dispose(tile);
    const mesh = new THREE.Mesh(geo, this.o.mat);
    mesh.receiveShadow = true; mesh.castShadow = false;
    mesh.name = 'tile';
    this.root.add(mesh);
    tile.mesh = mesh;
    if (trees) { this.root.add(trees); tile.trees = trees; }
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
    const nz = f.vnoise(x / 23, z / 23, 7) * 0.5 + 0.5;
    const big = f.vnoise(x / 140, z / 140, 8);
    out.copy(C.grass).lerp(C.moss, clamp(nz * 1.3 - 0.2, 0, 1));
    // under the forest the ground is darker
    out.lerp(C.floor, smoothstep(-0.35, 0.35, big) * 0.75 * smoothstep(3, 10, edge));
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
    return out;
  }

  _geometry(tile, seg, H, E, F, S) {
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
      this._colour(x, z, y, ny, E[k], F[k], 0, _c);
      col[v * 3] = _c.r; col[v * 3 + 1] = _c.g; col[v * 3 + 2] = _c.b;
      uv[v * 2] = x / 7; uv[v * 2 + 1] = z / 7;
      // slope protection on a steep face near the road (a cutting, or the face between two legs)
      wall[v] = (F[k] & 3) ? 0 : smoothstep(0.42, 0.58, 1 - ny * ny) * (1 - smoothstep(14, 24, E[k]));
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
    for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) {
      const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
      idx[o++] = a; idx[o++] = c; idx[o++] = b;
      idx[o++] = b; idx[o++] = c; idx[o++] = d;
    }
    for (let p = 0; p < per; p++) {
      const q = (p + 1) % per;
      const tp = perim[p], tq = perim[q], bp = V + p, bq = V + q;
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
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    return geo;
  }

  /** The forest on a tile: cedars, with patches of autumn broadleaf and the odd bare tree; clearings between. */
  _forest(tile, lod, seg, H, E, F) {
    const f = this.field, P = this.o.parts;
    const n = seg + 3, sp = TILE / seg;
    const rng = mulberry32(((tile.i * 73856093) ^ (tile.j * 19349663) ^ (this.o.seed || 0)) >>> 0);
    const spacing = (lod === 0 ? 8.2 : 11.5) / (this.o.density || 1);
    const cedars = [], maples = [], broad = [], bare = [];
    const cells = Math.floor(TILE / spacing);
    const step = TILE / cells;
    for (let gz = 0; gz < cells; gz++) for (let gx = 0; gx < cells; gx++) {
      const lx = (gx + 0.15 + rng() * 0.7) * step, lz = (gz + 0.15 + rng() * 0.7) * step;
      const x = tile.i * TILE + lx, z = tile.j * TILE + lz;
      const gi = Math.round(lx / sp) + 1, gj = Math.round(lz / sp) + 1;
      const k = gj * n + gi;
      if (F[k] || E[k] < 4.5) { rng(); rng(); rng(); continue; }
      // slope from the grid: no trees on cut faces
      const sx = (H[k + 1] - H[k - 1]) / (2 * sp), sz = (H[k + n] - H[k - n]) / (2 * sp);
      if (sx * sx + sz * sz > 0.8) { rng(); rng(); rng(); continue; }
      const big = f.vnoise(x / 140, z / 140, 8);
      const dens = smoothstep(-0.55, 0.05, big);
      if (rng() > dens) { rng(); rng(); continue; }
      const y = Terrain.surf(H, n, sp, lx, lz) - 0.35;
      const ry = rng() * Math.PI * 2, sc = 0.72 + rng() * 0.6;
      _q.setFromAxisAngle(_up, ry); _s.set(sc, sc, sc);
      const m = _m4.compose(_v.set(x, y, z), _q, _s).clone();
      const patch = f.vnoise(x / 70, z / 70, 11);
      const pick = rng();
      if (patch > 0.5 && lod === 0) {
        if (pick < 0.12) bare.push({ m });
        else if (pick < 0.55) broad.push({ m, colour: pick < 0.3 ? PAL.mapleGold : PAL.dryGrass });
        else maples.push({ m, colour: pick < 0.75 ? PAL.mapleOrange : pick < 0.9 ? PAL.mapleRed : PAL.mapleGold });
      } else cedars.push({ m });
    }
    const g = new THREE.Group(); g.name = 'forest';
    // the forest casts no shadow: at night the moon's tree shadows barely read, and drawing a forest twice was a
    // quarter of the frame's triangles
    const cast = false;
    if (cedars.length && P.cedar) g.add(instanceGroup(P.cedar, cedars, { castShadow: cast }));
    if (maples.length && P.maple) g.add(instanceGroup(P.maple, maples, { castShadow: cast, tint: true }));
    if (broad.length && P.broadleaf) g.add(instanceGroup(P.broadleaf, broad, { castShadow: cast, tint: true }));
    if (bare.length && P.bare) g.add(instanceGroup(P.bare, bare, { castShadow: cast }));
    return g;
  }

  /** The far mesh: the natural mountain out to the horizon, sunk under the tiles near its centre. */
  *_buildFar(cx, cz) {
    const f = this.field;
    const seg = FAR_SEG, sp = FAR_SPAN / seg, row = seg + 1, V = row * row;
    const pos = new Float32Array(V * 3), col = new Float32Array(V * 3);
    const x0 = cx - FAR_SPAN / 2, z0 = cz - FAR_SPAN / 2;
    for (let j = 0; j <= seg; j++) {
      for (let i = 0; i <= seg; i++) {
        const x = x0 + i * sp, z = z0 + j * sp, v = j * row + i;
        const r = Math.hypot(x - cx, z - cz);
        const sink = 3 + 32 * (1 - smoothstep(340, 560, r));
        pos[v * 3] = x; pos[v * 3 + 1] = f.base(x, z) - sink; pos[v * 3 + 2] = z;
        const nz = f.vnoise(x / 140, z / 140, 8);
        _c.copy(C.far).lerp(C.deep, smoothstep(-0.3, 0.4, nz) * 0.8).lerp(C.grass, 0.12 * (1 - smoothstep(-0.6, 0, nz)));
        col[v * 3] = _c.r; col[v * 3 + 1] = _c.g; col[v * 3 + 2] = _c.b;
      }
      if (j % 34 === 33) yield;
    }
    const idx = new Uint32Array(seg * seg * 6);
    let o = 0;
    for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) {
      const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
      idx[o++] = a; idx[o++] = c; idx[o++] = b; idx[o++] = b; idx[o++] = c; idx[o++] = d;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    yield;
    if (this.far) { this.root.remove(this.far); this.far.geometry.dispose(); }
    const m = new THREE.Mesh(geo, this.o.farMat);
    m.frustumCulled = false; m.receiveShadow = false; m.castShadow = false; m.name = 'far';
    m.renderOrder = -1;
    this.root.add(m);
    this.far = m; this.farAt = [cx, cz];
  }
}
