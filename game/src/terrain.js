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
import { PAL, clamp, lerp, smoothstep, mulberry32 } from './config.js?v=202609231752';
import { REACH } from './ground.js?v=202609231752';
import { instanceGroup } from './instancing.js?v=202609231752';

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
  grass: new THREE.Color(PAL.springGrass), moss: new THREE.Color(PAL.moss), floor: new THREE.Color(0x3d5233), petal: new THREE.Color(0xe9bccb),
  stone: new THREE.Color(PAL.stone), shot: new THREE.Color(0x9c978b), gravel: new THREE.Color(0x77716a),
  // the city: pavement by the road, dark lots and yards beyond, and the far ground a dull grey
  pave: new THREE.Color(0x8c8a85), lot: new THREE.Color(0x3b3c41), yard: new THREE.Color(0x4c4b48), cityFar: new THREE.Color(0x26272c),
  deep: new THREE.Color(0x2f4130), far: new THREE.Color(0x33463a),
};
const FACADE = [0x55565c, 0x6b6a66, 0x7a746a, 0x3c3f47, 0x4a4e57, 0x8a8478, 0x5c5048, 0x2f3440, 0x6e6a74, 0x44474d];
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
    if (t.trunks && this.o.colliders) { this.o.colliders.drop('tile' + t.i + ',' + t.j); t.trunks = null; }
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
        H[k] = s.h; E[k] = s.edge; F[k] = (s.flat ? 1 : 0) | (s.tunnel ? 2 : 0) | (s.mouth ? 4 : 0); S[k] = s.s;
      }
      if (j % rowsPerStep === rowsPerStep - 1) yield;
    }
    const geo = this._geometry(tile, seg, H, E, F, S);
    yield;
    const trees = this.o.city ? this._blocks(tile, lod, seg, H, E, F) : lod <= 1 ? this._forest(tile, lod, seg, H, E, F) : null;
    // swap
    this._dispose(tile);
    const mesh = new THREE.Mesh(geo, this.o.mat);
    mesh.receiveShadow = true; mesh.castShadow = false;
    mesh.name = 'tile';
    this.root.add(mesh);
    tile.mesh = mesh;
    if (trees) { this.root.add(trees); tile.trees = trees; }
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
    // fallen petals: a carpet under the cherry groves, and drifts blown against the verge
    if (!(flags & 2) && steep < 0.5) {
      const grove = smoothstep(0.3, 0.62, f.vnoise(x / 70, z / 70, 11));
      const drift = smoothstep(0.1, 0.55, f.vnoise(x / 4.3, z / 4.3, 13)) * (flags & 1 ? 0.75 : edge < 8 ? 0.45 : 0.18);
      out.lerp(C.petal, Math.min(0.62, grove * (0.28 + 0.3 * nz) + drift * (0.35 + 0.4 * grove)));
    }
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
    // at a tunnel mouth, a cell that would stretch from the road up to the hill over the bore stays open: it
    // is the sheet a heightfield would hang across the opening (see ground.js); the portal face hides the cut
    const flag = (v) => F[(Math.floor(v / row) + 1) * n + (v % row) + 1];
    const mouth = (v) => (flag(v) & 4) !== 0;
    const straddles = (a, b, c, d) => {
      if (!(mouth(a) || mouth(b) || mouth(c) || mouth(d))) return false;
      const t = (flag(a) & 2) + (flag(b) & 2) + (flag(c) & 2) + (flag(d) & 2);
      return t > 0 && t < 8;
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
      if ((mouth(tp) || mouth(tq)) && ((flag(tp) & 2) !== (flag(tq) & 2))) continue;
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

  /** The forest on a tile: cedars, with groves of cherry in blossom and fresh broadleaf; clearings between. */
  _forest(tile, lod, seg, H, E, F) {
    const f = this.field, P = this.o.parts;
    const n = seg + 3, sp = TILE / seg;
    const rng = mulberry32(((tile.i * 73856093) ^ (tile.j * 19349663) ^ (this.o.seed || 0)) >>> 0);
    const spacing = (lod === 0 ? 8.8 : 11.5) / (this.o.density || 1);
    const cedars = [], sakura = [], broad = [], bare = [], trunks = (this._trunks = []);
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
      trunks.push([x, z, 0.36 * sc, y]);
      const patch = f.vnoise(x / 70, z / 70, 11);
      const pick = rng();
      // a grove: mostly cherry in blossom with fresh broadleaf through it (the far ring keeps only the cherry,
      // so a hillside reads pink in patches from across the valley)
      if (patch > 0.42 && (lod === 0 || pick < 0.62)) {
        if (lod === 0 && pick < 0.04) bare.push({ m });
        else if (lod === 0 && pick < 0.3) broad.push({ m, colour: pick < 0.17 ? PAL.youngLeaf : PAL.leafDeep });
        else sakura.push({ m, colour: pick < 0.62 ? PAL.sakuraPale : pick < 0.86 ? PAL.sakuraPink : PAL.sakuraWhite });
      } else cedars.push({ m });
    }
    const g = new THREE.Group(); g.name = 'forest';
    // the forest casts no shadow: at night the moon's tree shadows barely read, and drawing a forest twice was a
    // quarter of the frame's triangles
    const cast = false;
    if (cedars.length && P.cedar) g.add(instanceGroup(P.cedar, cedars, { castShadow: cast }));
    // (the far ring draws its cherries with the lighter maple, tinted the same: at 200 m nobody can tell, and it
    // is a third fewer triangles across a whole hillside)
    const cherry = lod === 0 ? (P.sakura || P.maple) : (P.sakuraFar || P.maple || P.sakura);
    if (sakura.length && cherry) g.add(instanceGroup(cherry, sakura, { castShadow: cast, tint: true }));
    if (broad.length && P.broadleaf) g.add(instanceGroup(P.broadleaf, broad, { castShadow: cast, tint: true }));
    if (bare.length && P.bare) g.add(instanceGroup(P.bare, bare, { castShadow: cast }));
    return g;
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
    for (let j = 0; j <= seg; j++) {
      for (let i = 0; i <= seg; i++) {
        const x = x0 + i * sp, z = z0 + j * sp, v = j * row + i;
        const r = Math.hypot(x - cx, z - cz);
        const sink = 3 + 32 * (1 - smoothstep(340, 560, r));
        pos[v * 3] = x; pos[v * 3 + 1] = f.base(x, z) - sink; pos[v * 3 + 2] = z;
        const nz = f.vnoise(x / 140, z / 140, 8);
        if (this.o.city) _c.copy(C.cityFar).multiplyScalar(0.85 + 0.3 * (nz * 0.5 + 0.5));
        else _c.copy(C.far).lerp(C.deep, smoothstep(-0.3, 0.4, nz) * 0.8).lerp(C.grass, 0.12 * (1 - smoothstep(-0.6, 0, nz)));
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
