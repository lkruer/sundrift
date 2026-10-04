/**
 * The valley's farmland (satoyama) and the woods between: terraced rice paddies flooded for planting, tea rows on the
 * gentler slopes, vegetable plots, and hamlets of farmhouses, out in the open land well away from the road.
 *
 * The land is cut into plots on lines 6 m apart. Each block of 72 m is split into three to six terraces 12 to 24 m deep
 * (narrower where the slope is steeper) running across the steeper of the two axes, and each terrace into plots 18 to
 * 36 m long, the pattern picked per block by a hash. A plot's edges so fall on the terrain's vertex lines at every level
 * of detail (1.5, 3 and 6 m: terrain.js), and the field it holds keeps its shape however far off it is drawn.
 *
 * A plot is farmed where the open-land noise says so, the slope is gentle and no road comes within ground.js's reach of
 * any of it (so a field never meets a cutting or an embankment, and the road's own ground is never touched). A paddy,
 * a vegetable plot or a house lot is levelled at the natural ground's height at its middle; a tea plot keeps its slope.
 * Where two plots meet, the ground on the line is the lower of the two and rises to each plot's own level within a few
 * decimetres, so the step between two terraces always lies inside the higher one, under its water and behind the bund
 * that terrain.js stands on the line.
 *
 * Pure maths, no Three.js, like ground.js, which asks it.
 */
import { clamp, smoothstep } from './config.js?v=202610040057';

export const KIND = { NONE: 0, PADDY: 1, VEG: 2, HOUSE: 3, TEA: 4 };
const FLAT = [false, true, true, true, false];
export const BLOCK = 72;
// the terraces of a block, across the slope (12 to 24 m): wide ones on the gentlest ground, narrow ones where it is
// steeper, so the step from one terrace down to the next stays within a metre or two
const ROWS = [
  [[24, 24, 24], [18, 18, 18, 18], [24, 18, 12, 18], [18, 24, 12, 18], [24, 12, 18, 18], [18, 18, 12, 24]],
  [[18, 18, 18, 18], [12, 18, 18, 24], [18, 12, 24, 18], [12, 24, 12, 24], [18, 18, 12, 24], [12, 18, 12, 18, 12]],
  [[12, 12, 12, 12, 12, 12], [12, 12, 18, 12, 18], [18, 12, 12, 18, 12], [12, 18, 12, 12, 18], [12, 12, 12, 18, 18]],
];
// and the plots along a terrace (18 to 36 m)
const COLS = [[36, 36], [24, 24, 24], [18, 18, 36], [18, 36, 18], [36, 18, 18], [24, 30, 18], [30, 24, 18], [18, 24, 30], [24, 18, 30], [18, 18, 18, 18], [24, 24, 24], [18, 30, 24]];
const BW = 0.6;                     // the ramp inside a plot's edge, metres
const CAP = 60000;                  // plots remembered before the memory starts again

function ih(a, b, c, seed) {
  let t = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1442695041) + seed) | 0;
  t = Math.imul(t ^ (t >>> 13), 1274126177);
  t = Math.imul(t ^ (t >>> 16), 0x85ebca6b);
  return (t ^ (t >>> 13)) >>> 0;
}
const u01 = (h) => h / 4294967296;

export class Farm {
  /**
   * track: the course (its final road keeps the fields away); ground: for the hill over a tunnel; reach: how far a road
   * shapes the ground (ground.js REACH), so a field stays out of it.
   */
  constructor(track, ground, reach) {
    this.track = track; this.ground = ground; this.field = track.field; this.reach = reach;
    this.seed = (track.field.seed ^ 0x5a7e) | 0;
    this.blocks = new Map(); this.plots = new Map();
    this._p = {}; this._q = {}; this._nr = {};
    // where each stretch of road that turned final lies ([the count of final samples after it, x0, z0, x1, z1]), so a
    // plot is checked against the road again only when new road came near it, not every time any road is laid
    this.marks = []; this.forgot = 0;
    track.onAdd((i0, i1) => {
      const pts = track.pts;
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity, pad = 0;
      for (let i = i0; i <= i1; i++) { const p = pts[i]; if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.z < z0) z0 = p.z; if (p.z > z1) z1 = p.z; if (p.tunnel) pad = 150; }
      this.marks.push([track.nFinal, x0 - pad, z0 - pad, x1 + pad, z1 + pad]);
      if (this.marks.length > 128) this.forgot = this.marks.shift()[0];
    });
  }

  /**
   * Whether no road turned final since version v anywhere within r of the plot (beyond its own reach): then what the
   * plot was at v it still is.
   */
  _fresh(I, v, r) {
    if (v === this.track.nFinal) return true;
    if (v < this.forgot) return false;
    const R = this.reach + Math.hypot(I.x1 - I.x0, I.z1 - I.z0) / 2 + r;
    for (const [ver, x0, z0, x1, z1] of this.marks) if (ver > v && I.cx > x0 - R && I.cx < x1 + R && I.cz > z0 - R && I.cz < z1 + R) return false;
    return true;
  }

  /**
   * Work out every plot round a box ahead of the terrain that will ask about them (terrain.js, a step of a tile's
   * build), a few milliseconds a step: classifying a plot near the road samples the road's ground at a dozen points,
   * and a tile's first row of samples, asking about thirty such plots and their neighbours at once, took 80 ms.
   */
  *prepare(x0, z0, x1, z1) {
    const list = [];
    this.plotsIn(x0, z0, x1, z1, (p) => list.push(p));
    let t = performance.now();
    for (const p of list) {
      this.info(p);
      if (performance.now() - t > 2) { yield; t = performance.now(); }
    }
    // (and whether each touches a levelled plot, which the ground asks at every plot's edge)
    for (const p of list) {
      const I = this._get(p);
      if (!I.flat) this._nearFlat(I);
      if (performance.now() - t > 2) { yield; t = performance.now(); }
    }
  }

  // ------------------------------------------------------------------ the plots

  _block(SX, SZ) {
    const k = (SX + 30000) * 60000 + (SZ + 30000);
    let b = this.blocks.get(k);
    if (b) return b;
    if (this.blocks.size > CAP) this.blocks.clear();
    const [gx, gz] = this.field.grad((SX + 0.5) * BLOCK, (SZ + 0.5) * BLOCK, 14);
    const s = Math.hypot(gx, gz), set = ROWS[s < 0.055 ? 0 : s < 0.1 ? 1 : 2];
    // (the terraces are cut across the steeper axis: a terrace runs along the contour as near as a grid allows)
    b = { tr: Math.abs(gx) > Math.abs(gz), rows: set[ih(SX, SZ, 3, this.seed) % set.length], SX, SZ };
    this.blocks.set(k, b);
    return b;
  }

  /** The plot whose ground (x, z) is: writes x0, x1, z0, z1 (x0 <= x < x1, z0 <= z < z1) and its key into out. */
  plotAt(x, z, out = {}) {
    const SX = Math.floor(x / BLOCK), SZ = Math.floor(z / BLOCK), b = this._block(SX, SZ);
    const bx = SX * BLOCK, bz = SZ * BLOCK;
    const ua = b.tr ? x - bx : z - bz, va = b.tr ? z - bz : x - bx;      // across the terraces, along them
    const rows = b.rows;
    let r = 0, a0 = 0;
    while (r < rows.length - 1 && ua >= a0 + rows[r]) { a0 += rows[r]; r++; }
    const cols = COLS[ih(SX, SZ, r + 11, this.seed) % COLS.length];
    let c = 0, v0 = 0;
    while (c < cols.length - 1 && va >= v0 + cols[c]) { v0 += cols[c]; c++; }
    this._rect(out, b, r, a0, a0 + rows[r], c, v0, v0 + cols[c]);
    return out;
  }

  _rect(out, b, r, a0, a1, c, v0, v1) {
    const bx = b.SX * BLOCK, bz = b.SZ * BLOCK;
    if (b.tr) { out.x0 = bx + a0; out.x1 = bx + a1; out.z0 = bz + v0; out.z1 = bz + v1; }
    else { out.z0 = bz + a0; out.z1 = bz + a1; out.x0 = bx + v0; out.x1 = bx + v1; }
    out.key = ((b.SX + 30000) * 60000 + (b.SZ + 30000)) * 64 + r * 8 + c;
    out.tr = b.tr;
    return out;
  }

  /** Every plot whose middle lies in the box [x0, x1) x [z0, z1): fn(plot) with a fresh object each. */
  plotsIn(x0, z0, x1, z1, fn) {
    for (let SX = Math.floor(x0 / BLOCK); SX * BLOCK < x1; SX++) for (let SZ = Math.floor(z0 / BLOCK); SZ * BLOCK < z1; SZ++) {
      const b = this._block(SX, SZ);
      let a0 = 0;
      b.rows.forEach((rw, r) => {
        const cols = COLS[ih(SX, SZ, r + 11, this.seed) % COLS.length];
        let v0 = 0;
        cols.forEach((cw, c) => {
          const p = this._rect({}, b, r, a0, a0 + rw, c, v0, v0 + cw);
          const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
          if (cx >= x0 && cx < x1 && cz >= z0 && cz < z1) fn(p);
          v0 += cw;
        });
        a0 += rw;
      });
    }
  }

  /**
   * What a plot is: { kind, level, flat, ... }, remembered. The noise and the slope decide what it would be (want); the
   * road decides whether it may (checked again whenever more road is final: new road only ever takes a field away).
   */
  info(p) {
    const I = this._get(p);
    if (I.want && I.ver !== this.track.nFinal) {
      const first = I.ver < 0;
      // (the plot and its neighbours, as far as the cluster rule below reaches)
      const fresh = !first && this._fresh(I, I.ver, 40);
      I.ver = this.track.nFinal;
      if (!fresh && (I.kind || first)) {
        let k = this._road(I);
        // and never a field alone: a plot is farmed only with farmed plots on at least two of its sides (a lone
        // levelled paddy out in the grass, its bunds standing up all round it, read as a concrete tank)
        if (k) {
          let n = 0;
          const q = this._q2 || (this._q2 = {});
          for (const [x, z] of [[I.x0 - 0.01, I.cz], [I.x1 + 0.01, I.cz], [I.cx, I.z0 - 0.01], [I.cx, I.z1 + 0.01]]) if (this._road(this._get(this.plotAt(x, z, q)))) n++;
          if (n < 2) k = 0;
        }
        I.kind = k; I.flat = FLAT[k];
      }
    }
    return I;
  }

  /** A plot's record, made the first time it is asked for (what it would be, before the road has its say). */
  _get(p) {
    let I = this.plots.get(p.key);
    if (!I) {
      if (this.plots.size > CAP) this.plots.clear();
      I = this._classify(p);
      this.plots.set(p.key, I);
    }
    return I;
  }

  /** What the road allows the plot to be (its kind, or nothing), kept up to date with the final road. */
  _road(I) {
    if (!I.want) return 0;
    if (I.rv !== this.track.nFinal) {
      const first = I.rv === undefined, fresh = !first && this._fresh(I, I.rv, 2);
      I.rv = this.track.nFinal;
      if (!fresh && (I.k0 || first)) I.k0 = this._clear(I) ? I.want : 0;
    }
    return I.k0;
  }

  _classify(p) {
    const f = this.field, cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
    const I = { key: p.key, x0: p.x0, x1: p.x1, z0: p.z0, z1: p.z1, cx, cz, tr: p.tr, want: 0, kind: 0, flat: false, level: 0, slope: 0, ver: -2, h: u01(ih(p.key % 1e6, Math.floor(p.key / 1e6), 5, this.seed)) };
    if (this.zone(cx, cz) < 0.5) return I;
    const [gx, gz] = f.grad(cx, cz, 6), s = Math.hypot(gx, gz);
    I.slope = s; I.gx = gx; I.gz = gz;
    let want = 0;
    const tea = f.vnoise(cx / 260, cz / 260, 44);
    // tea on the slopes too steep for a paddy (and, where its noise is strongest, on gentler ground as well)
    if ((s > 0.13 && s < 0.3 && tea > 0) || (tea > 0.5 && s > 0.04 && s < 0.3)) want = KIND.TEA;
    else if (s <= 0.13) {
      // a hamlet where its noise peaks (every other plot of its core a house lot), the vegetable plots round it,
      // paddies beyond
      const ham = f.vnoise(cx / 190, cz / 190, 43);
      if (ham > 0.55 && s < 0.11 && I.h < 0.5) want = KIND.HOUSE;
      else if (ham > 0.32 && I.h < 0.7) want = KIND.VEG;
      else want = I.h < 0.05 ? KIND.VEG : KIND.PADDY;
    }
    if (!want) return I;
    I.want = want; I.level = f.base(cx, cz); I.ver = -1;
    return I;
  }

  /**
   * Whether the road leaves the plot alone: none within reach of it, or, near one, the ground all over the plot well
   * clear of its corridor, verges and terraces and the level well inside what its cuttings and banks allow (ground.js
   * clamps the ground between them: here they never touch it). And no tunnel's hill over it.
   */
  _clear(I) {
    const t = this.track, g = this.ground, half = Math.hypot(I.x1 - I.x0, I.z1 - I.z0) / 2;
    I.level = this.field.base(I.cx, I.cz);
    t.nearestRoad(I.cx, I.cz, this.reach + half + 3, this._nr);
    if (this._nr.found) {
      if (this._nr.d < half + 14) return false;
      const fm = g.farm, s = this._s || (this._s = {});
      g.farm = null;                                   // (the ground as the road alone has it)
      let lo = -Infinity, hi = Infinity;
      try {
        for (let j = 0; j <= 3; j++) for (let i = 0; i <= 3; i++) {
          g.sample(I.x0 + (I.x1 - I.x0) * i / 3, I.z0 + (I.z1 - I.z0) * j / 3, 2.2, s);
          if (s.flat || s.tunnel || s.edge < 6) return false;
          lo = Math.max(lo, s.L); hi = Math.min(hi, s.U);
        }
      } finally { g.farm = fm; }
      // the level kept well inside what the road's cuttings and banks allow there (cut or filled up to two metres to get
      // there), or no field
      const a = lo + 2.6, b = hi - 2.6;
      if (a > b) return false;
      const lv = Math.min(b, Math.max(a, I.level));
      if (Math.abs(lv - I.level) > 2) return false;
      I.level = lv;
    }
    if (t.tunnels.length) {
      const f = this.field;
      for (const [x, z] of [[I.cx, I.cz], [I.x0, I.z0], [I.x1, I.z0], [I.x0, I.z1], [I.x1, I.z1]]) if (g.spur(x, z) > f.base(x, z) - 1.5) return false;
    }
    return true;
  }

  /** The farm's kind of the ground at (x, z). */
  kindAt(x, z) { return this.info(this.plotAt(x, z, this._p)).kind; }

  /** The plot's record at (x, z) (its kind, level and edges). */
  at(x, z) { return this.info(this.plotAt(x, z, this._p)); }

  /**
   * The ground as the farm has it, given the natural ground there: a levelled plot's level (stepping at its edges to the
   * lower of it and its neighbour, see the top), or the natural ground (stepping down the same way to a levelled
   * neighbour below it).
   */
  height(x, z, nat) {
    // (the plot of the last call first: the terrain asks row by row, and most samples fall in the same plot as the last)
    let I = this._last;
    if (!I || x < I.x0 || x >= I.x1 || z < I.z0 || z >= I.z1) I = this._last = this.info(this.plotAt(x, z, this._p));
    else if (I.want && I.ver !== this.track.nFinal) I = this._last = this.info(I);
    const own = I.flat ? I.level : nat;
    const dx0 = x - I.x0, dx1 = I.x1 - x, dz0 = z - I.z0, dz1 = I.z1 - z;
    if (dx0 >= BW && dx1 >= BW && dz0 >= BW && dz1 >= BW) return own;
    // (natural ground with no levelled plot beside it, most of the land: nothing to do at its edges)
    if (!I.flat && !this._nearFlat(I)) return own;
    const ex = dx0 < BW ? -1 : dx1 < BW ? 1 : 0, ez = dz0 < BW ? -1 : dz1 < BW ? 1 : 0;
    const dx = Math.max(0, ex < 0 ? dx0 : dx1), dz = Math.max(0, ez < 0 ? dz0 : dz1);
    const x0 = I.x0, x1 = I.x1, z0 = I.z0, z1 = I.z1, flat = I.flat;
    let h = own, hq;
    if (ex) { hq = this._nb(x0, x1, z0, z1, ex, 0, x, z, flat, nat); if (hq !== null && hq < own) h = Math.min(h, hq + (own - hq) * smoothstep(0, BW, dx)); }
    if (ez) { hq = this._nb(x0, x1, z0, z1, 0, ez, x, z, flat, nat); if (hq !== null && hq < own) h = Math.min(h, hq + (own - hq) * smoothstep(0, BW, dz)); }
    if (ex && ez) { hq = this._nb(x0, x1, z0, z1, ex, ez, x, z, flat, nat); if (hq !== null && hq < own) h = Math.min(h, hq + (own - hq) * smoothstep(0, BW, Math.max(dx, dz))); }
    return h;
  }

  /** The neighbour across (sx, sz) of a plot: its level, or the natural ground if it is not levelled but the plot is, or null. */
  _nb(x0, x1, z0, z1, sx, sz, x, z, flat, nat) {
    const J = this.info(this.plotAt(sx < 0 ? x0 - 0.01 : sx > 0 ? x1 + 0.01 : x, sz < 0 ? z0 - 0.01 : sz > 0 ? z1 + 0.01 : z, this._q));
    return J.flat ? J.level : flat ? nat : null;
  }

  /**
   * Whether any levelled plot touches this one (remembered: road only ever takes a field away, so a plot once found
   * with no levelled neighbour never gains one).
   */
  _nearFlat(I) {
    if (I.nf !== undefined) return I.nf;
    let nf = false;
    const q = this._q;
    for (const [sx, sz, dx, dz, ox, oz] of [[I.x0, I.z0, 0, 1, -1, 0], [I.x1, I.z0, 0, 1, 1, 0], [I.x0, I.z0, 1, 0, 0, -1], [I.x0, I.z1, 1, 0, 0, 1]]) {
      const len = dx ? I.x1 - I.x0 : I.z1 - I.z0;
      for (let a = 3; a < len && !nf; a += 6) if (this.info(this.plotAt(sx + dx * a + ox * 0.01, sz + dz * a + oz * 0.01, q)).flat) nf = true;
      // (and the plots across its corners)
      const ex = sx + dx * len, ez = sz + dz * len;
      if (!nf && this.info(this.plotAt(ex + dx * 0.01 + ox * 0.01, ez + dz * 0.01 + oz * 0.01, q)).flat) nf = true;
      if (!nf && this.info(this.plotAt(sx - dx * 0.01 + ox * 0.01, sz - dz * 0.01 + oz * 0.01, q)).flat) nf = true;
      if (nf) break;
    }
    I.nf = nf;
    return nf;
  }

  // ------------------------------------------------------------------ the land between: open fields and the woods

  /** The woods' own noise: stands where it is high, clearings where it is low, ragged at the edges. */
  wn(x, z) { const f = this.field; return f.vnoise(x / 150, z / 150, 8) + 0.3 * f.vnoise(x / 46, z / 46, 9); }

  /** Farm country (over 0.5): the clearings in the woods. Its fields are where the slope and the road allow (classify). */
  zone(x, z) { return this.zoneOf(this.wn(x, z)); }
  zoneOf(wn) { return 1 - smoothstep(-0.42, -0.14, wn); }

  /**
   * How much the woods hold the ground here (0..1): stands with ragged edges, and the clearings between them. (The
   * woods hold most of the land the fields leave: the farm country's clearings reach further than its fields, and
   * a clearing nobody farms, between two legs of the road, went back to woods; open meadow is the rarer thing.)
   */
  woods(x, z) { return this.woodsOf(this.wn(x, z)); }
  woodsOf(wn) { return smoothstep(-0.4, -0.27, wn); }
}
