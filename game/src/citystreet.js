/**
 * NEO TOKYO, the furniture of the kerb and the paint on the road: what a Tokyo street has between its fronts and its
 * traffic besides the neon.
 *
 *     streetLoad(w, Pool);                      // once, with the city's pools (they compile at load)
 *     streetChunk(w, ch, S);                    // per chunk, after its lots and its wires, before the pavement's loose things
 *     roadPaint(w, ch, S);                      // per chunk, with its crossings: the paint and the covers in the road
 *
 * - Street trees along the avenues: zelkovas pruned to the pavement (cityprops.js), every 11 m or so on both sides of
 *   a straight, each in its pit with an iron grate, a trunk the car stops against (the first 1.3 m of pavement stays
 *   the car's, as for the utility poles). They keep clear of the lamps, the poles and the signals, of the signs and the
 *   LED towers that stand out from the fronts, and of anything strung over the street. Their leaves are the pass's
 *   broadleaf's own (its bark too), so the night tints them as it does the pass's trees, and no program is new.
 * - Pedestrian guard rails along the kerb: white bays of guard pipe (yellow now and then, by a school) along the
 *   approaches to every square corner, ending at its crossing as they do in Tokyo, and in runs along the straights.
 *   A bay is a knockable thing in a pool of its own: the car takes it out and it flies like the bollards.
 * - The power and telephone companies' grey boxes on the pavement against the fronts, solid.
 * - In the road: the city's cast manhole covers (where the road's texture has its covers, the ones the steam comes out
 *   of), white lane arrows before every corner, the speed limit painted after it, and on the avenues a blue cycle lane
 *   along each kerb with its bicycle and its arrows, broken at the crossings. All of it in the crossings' mesh, one
 *   draw a chunk as before (its material now takes a vertex colour, so the blue lane is the same paint).
 *
 * S, the chunk's own: { at, clearAt, h01, inFoot, nearSolid, solids, clutter, D, paint, tris, paveOK, cornersOf }.
 */
import * as THREE from 'three';
import { guardRailGeometry, streetTreeGeometry, utilityBoxProps, treePitProps, roadManholes } from './cityprops.js?v=202610032333';
import { overStreetAt } from './citydetail.js?v=202610032333';
import { railSkip } from './citytrain.js?v=202610032333';

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const LEAVES = [0x8cbf4f, 0x7cb048, 0x98c65a, 0x6f9e3e, 0x86b850];
const RAIL_WHITE = 0xeceae2, RAIL_YELLOW = 0xe6be1e;
const BLUE = new THREE.Color(0x1e4a92), WHITE = new THREE.Color(0xffffff);

/** The street's pools: the guard rails' bays (knockable) and the street trees. */
export function streetLoad(w, Pool) {
  // the guard rails: drawn in the tinted copy of the glossy material the bags and crates draw with, so the instance's
  // colour paints them and no program is new
  if (w.propMats && w.propMats.glossyTint) {
    const r = guardRailGeometry(THREE);
    const part = { geometry: r.geometry, material: w.propMats.glossyTint, local: new THREE.Matrix4() };
    w.pools.grail = new Pool([part], w.detail && w.detail.phone ? 380 : 620, { tint: true });
    w.root.add(w.pools.grail.group);
    w.parts.grail = [part];
    w.foot.grail = [1.0, 0.04, 0.86];
  }
  // the street trees: the broadleaf's own bark and leaves on a tree pruned to the pavement
  const bl = w.parts.broadleaf;
  const fol = bl && bl.find((p) => p.material.name === 'foliage_tinted'), bark = bl && bl.find((p) => p.material.name !== 'foliage_tinted');
  if (fol && bark) {
    const tg = streetTreeGeometry(THREE);
    w.pools.stree = new Pool([{ geometry: tg.trunk, material: bark.material, local: new THREE.Matrix4() },
      { geometry: tg.crown, material: fol.material, local: new THREE.Matrix4() }], w.detail && w.detail.phone ? 220 : 360, { tint: true });
    w.root.add(w.pools.stree.group);
  }
}

/**
 * A chunk's street furniture: its trees, its utility boxes and its guard rails, before the pavement's loose things
 * (which keep clear of all of them through S.solids). Generator: it yields between the three.
 */
export function* streetChunk(w, ch, S) {
  const t = w.track, g = w.ground, pts = t.pts, own = ch.c * 2;
  const s0 = pts[ch.i0].s, s1 = pts[ch.i1].s, CH = ch.i1 - ch.i0;
  const { h01, clearAt, inFoot, nearSolid, solids, clutter, D, paveOK } = S;
  const phone = !!(w.detail && w.detail.phone);
  // a straight here: no bend sharper than a gentle one within m metres, and the pavement plain on this side
  const straight = (s, side, m) => { for (let d = -m; d <= m; d += 4) { const q = t.sample(s + d); if (Math.abs(q.k) > 1 / 300 || !paveOK(s + d, side)) return false; } return true; };
  const lampAt = (s, m) => { const r = ((s % 30) + 30) % 30; return r < m || r > 30 - m; };
  const kerb = (s, side, u) => {
    const p = t.sample(s), wall = side > 0 ? p.wl : p.wr, lx = Math.cos(p.h) * side, lz = -Math.sin(p.h) * side;
    return { p, wall, lx, lz, fx: Math.sin(p.h), fz: Math.cos(p.h), x: p.x + lx * (wall + u), z: p.z + lz * (wall + u) };
  };

  // ---------------------------------------------------------------- the street trees, on the avenues
  if (w.pools.stree && t.half > 5.4) {
    const step = phone ? 16.5 : 11;
    for (const side of [1, -1]) {
      for (let s = Math.ceil(s0 / step) * step + (side > 0 ? 0 : step / 2); s < s1 - 1.5; s += step) {
        const sj = s + (h01(s * 0.37 + 1.1, side) - 0.5) * 2.2;
        if (sj < s0 + 1 || lampAt(sj, 4.2) || !straight(sj, side, 16) || railSkip(w, sj, side, 3)) continue;
        if (overStreetAt(w, ch.c, CH, sj, 5)) continue;
        const k = kerb(sj, side, 1.6);
        if (!clearAt(k.x, k.z, 1.5) || nearSolid(k.x, k.z, 2.4) || inFoot(k.x, k.z, 0.3)) continue;
        // (clear of a sign or an LED tower standing out over the pavement from the fronts)
        if (D.lots.some((l) => l.side === side && l.vEdge && Math.abs(l.s + l.vEdge * (l.W / 2 - 0.7) - sj) < 2.8)) continue;
        if (D.towers.some((q) => Math.hypot(q[0] - k.x, q[1] - k.z) < 3.4)) continue;
        const y = g.height(k.x, k.z), sc = 0.88 + h01(sj * 1.7, side) * 0.24, ry = k.p.h - Math.PI / 2 + (h01(sj * 2.3, side) - 0.5) * 0.24;
        const colour = LEAVES[Math.floor(h01(sj * 3.1, side) * LEAVES.length)];
        _q.setFromAxisAngle(_up, ry); _s.set(sc, sc * (0.95 + h01(sj * 4.3, side) * 0.12), sc);
        w.pools.stree.add(own, _m4.compose(_v.set(k.x, y - 0.02, k.z), _q, _s), colour);
        w._reg(own, { name: 'tree', kind: 'solid', x: k.x, y, z: k.z, r: 0.17 * sc, alive: true, colour });
        solids.push([k.x, k.z, 0.8]);
        treePitProps(THREE, { x: k.x, y, z: k.z, fx: k.fx, fz: k.fz, lx: k.lx, lz: k.lz, W: 1.3, D: 0.72 }, clutter);
      }
    }
  }
  yield;
  // ---------------------------------------------------------------- the utility boxes, against the fronts
  for (const side of [1, -1]) for (let s = Math.ceil(s0 / 26) * 26 + (side > 0 ? 9 : 22); s < s1 - 2; s += 26) {
    if (h01(s * 0.61 + 3.7, side) > (phone ? 0.22 : 0.34) || !paveOK(s, side) || railSkip(w, s, side, 1.5)) continue;
    const p = t.sample(s);
    if (Math.abs(p.k) > 1 / 90 || p.express) continue;
    // (only in front of a building of the street, whose front stands where a front should)
    if (!D.lots.some((l) => l.side === side && !l.up && Math.abs(l.s - s) < l.W / 2 - 0.9)) continue;
    const k = kerb(s, side, 2.9);
    const c = kerb(s, side, 2.45);
    if (!clearAt(c.x, c.z, 2.0) || nearSolid(c.x, c.z, 1.3) || inFoot(c.x, c.z, -0.2)) continue;
    const out = {};
    const [hw, hd, off] = utilityBoxProps(THREE, { x: k.x, y: g.height(k.x, k.z), z: k.z, fx: k.fx, fz: k.fz, lx: k.lx, lz: k.lz }, mulberryish(s, side), out);
    for (const [m, list] of Object.entries(out)) (clutter[m] || (clutter[m] = [])).push(...list);
    const bx = k.x - k.lx * off, bz = k.z - k.lz * off;
    w._reg(own, { name: 'ubox', kind: 'solid', x: bx, y: g.height(bx, bz), z: bz, ry: k.p.h - Math.PI / 2, box: true, hx: hw, hz: hd, r: Math.hypot(hw, hd), alive: true });
    solids.push([bx, bz, Math.max(hw, hd) + 0.15]);
  }
  yield;
  // ---------------------------------------------------------------- the guard rails along the kerb
  const rails = S.rails = [];
  const pool = w.pools.grail;
  if (pool) {
    // (a bay belongs to the chunk its middle is in, so a run across two chunks is laid by both, bay for bay)
    const run = (side, a, b, colour) => {
      for (let s = a; s + 2 <= b; s += 2.04) {
        const sm = s + 1;
        if (sm < s0 || sm >= s1) continue;
        if (!paveOK(sm, side) || lampAt(sm, 1.4) || railSkip(w, sm, side, 1.2)) continue;
        const k = kerb(sm, side, 0.22);
        if (Math.abs(k.p.k) > 1 / 60 || k.p.express) continue;
        if (!clearAt(k.x, k.z, 0.1) || nearSolid(k.x, k.z, 1.15) || inFoot(k.x, k.z, 0.05)) continue;
        const y = g.height(k.x, k.z), ry = k.p.h - Math.PI / 2;
        _q.setFromAxisAngle(_up, ry); _s.set(1, 1, 1);
        const id = pool.add(own, _m4.compose(_v.set(k.x, y, k.z), _q, _s), colour);
        if (!id) return;
        w._reg(own, { name: 'grail', pool: 'grail', id, owner: own, x: k.x, y, z: k.z, ry, sc: 1, colour, kind: 'knock', box: true, hx: 1.0, hz: 0.07, r: 1.0, m: 14, alive: true });
        rails.push([k.x, k.z]);
      }
    };
    // along the approaches to every square corner, both kerbs, ending at its crossing (2.1 m either side of its middle,
    // 7 m before the bend and 7 m after it); the corners either side of the chunk too, for their runs that reach into it
    for (const [sa, sb] of S.cornersOf(Math.max(1, ch.i0 - 40), Math.min(t.nFinal - 1, ch.i1 + 40))) {
      for (const side of [1, -1]) {
        const col = h01(sa * 0.7 + 2.3, side) < 0.12 ? RAIL_YELLOW : RAIL_WHITE;
        const L1 = 8 + Math.floor(h01(sa * 1.9, side) * 6) * 2.04, L2 = 8 + Math.floor(h01(sb * 1.3, side) * 6) * 2.04;
        run(side, sa - 7 - 2.4 - L1, sa - 7 - 2.4, col);
        run(side, sb + 7 + 2.4, sb + 7 + 2.4 + L2, col);
      }
    }
    // and in runs along the straights, now and then
    for (const side of [1, -1]) for (let s = Math.ceil(s0 / 30) * 30; s < s1 - 6; s += 30) {
      if (h01(s * 0.43 + 9.1, side) > (phone ? 0.18 : 0.3)) continue;
      const a = s + 2 + h01(s * 0.29, side) * 10, n = 3 + Math.floor(h01(s * 0.83, side) * 5);
      if (!straight(a + n, side, n + 4)) continue;
      run(side, a, a + n * 2.04, h01(s * 0.51, side) < 0.1 ? RAIL_YELLOW : RAIL_WHITE);
    }
  }
}

/** Whether a bollard at (x, z) would stand in a guard rail's bay. */
export function inRail(S, x, z) {
  for (const [rx, rz] of S.rails || []) if (Math.hypot(rx - x, rz - z) < 1.25) return true;
  return false;
}

// a small seeded random for a place (the street's own sequence is left as it was)
function mulberryish(s, side) {
  let a = (Math.floor(s * 131) * 2654435761 + (side > 0 ? 97 : 13)) >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- the paint in the road

// the digits of a speed limit as strokes of a seven-segment cell: a top, b upper right, c lower right, d bottom,
// e lower left, f upper left, g middle (a cell is 0..1 across, left to right as the driver reads it, 0..1 along)
const SEG = { a: [[0, 1], [1, 1]], b: [[1, 1], [1, 0.5]], c: [[1, 0.5], [1, 0]], d: [[0, 0], [1, 0]], e: [[0, 0.5], [0, 0]], f: [[0, 1], [0, 0.5]], g: [[0, 0.5], [1, 0.5]] };
const DIGIT = { 0: 'abcdef', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg' };

/**
 * A chunk's paint and covers in the road, added to S.paint ([s0, u0, s1, u1, half width, colour?] strokes) and S.tris
 * ([[s, u], [s, u], [s, u], colour?] triangles), which the chunk's crossings mesh draws, and the manhole covers to the
 * chunk's decals. u is across the road, positive on the left (the side the traffic going up the road keeps to).
 */
export function roadPaint(w, ch, S) {
  const t = w.track, pts = t.pts;
  const s0 = pts[ch.i0].s, s1 = pts[ch.i1].s, endS = pts[t.nFinal - 1].s - 8;
  const { paint, tris, clutter } = S;
  const avenue = t.half > 5.4;
  const lanes = avenue ? [t.half * 0.25, t.half * 0.75] : [t.half * 0.5];
  const plain = (s, m) => { for (let d = -m; d <= m; d += 2) { const q = t.sample(s + d); if (q.tunnel || q.express || t.nearTunnel(q.s, 10) || Math.abs(q.k) > 1 / 200) return false; } return true; };
  // a stroke in a lane's own frame: b along the way the lane runs, a across to its driver's left; dir +1 for the lanes
  // going up the road (u > 0), -1 for the ones coming down it
  const L = (sb, uc, dir) => (b, a) => [sb + b * dir, uc + a * dir];
  const stroke = (f, b0, a0, b1, a1, hw, col) => { const [sa, ua] = f(b0, a0), [sb2, ub] = f(b1, a1); paint.push([sa, ua, sb2, ub, hw, col]); };
  const tri = (f, p, q, r, col) => tris.push([f(...p), f(...q), f(...r), col]);
  // an arrow 5 m long: a straight one, or one that bends toward the turn (turn +1 left, -1 right) with its head along it
  const arrow = (f, turn) => {
    if (!turn) { stroke(f, 0, 0, 3.6, 0, 0.09); tri(f, [3.4, -0.36], [3.4, 0.36], [5.0, 0]); return; }
    stroke(f, 0, 0, 2.6, 0, 0.09); stroke(f, 2.5, 0, 3.4, 0.55 * turn, 0.09);
    const d = [0.9, 0.55 * turn], l = Math.hypot(d[0], d[1]), n = [d[0] / l, d[1] / l], m = [-n[1], n[0]];
    const tip = [3.4 + n[0] * 1.3, 0.55 * turn + n[1] * 1.3];
    tri(f, [3.3 + m[0] * 0.38, 0.55 * turn + m[1] * 0.38], [3.3 - m[0] * 0.38, 0.55 * turn - m[1] * 0.38], tip);
  };
  const number = (f, digits) => {
    const W = 0.85, H = 2.6, gap = 0.3, total = digits.length * W + (digits.length - 1) * gap;
    [...digits].forEach((d, i) => {
      const a0 = total / 2 - i * (W + gap);                    // its left edge, to the driver's left of the middle
      for (const k of DIGIT[d] || '') { const [[x0, y0], [x1, y1]] = SEG[k]; stroke(f, y0 * H, a0 - x0 * W, y1 * H, a0 - x1 * W, 0.085); }
    });
  };
  // ---- before every square corner: arrows in the lanes coming up to it; after it, the speed limit
  let i = ch.i0;
  while (i < ch.i1 && Math.abs(pts[i].k) >= 1 / 45) i++;
  while (i < ch.i1) {
    const p = pts[i];
    if (Math.abs(p.k) < 1 / 45 || p.tunnel) { i++; continue; }
    let j = i; while (j < t.nFinal - 1 && j < ch.i1 + 90 && Math.abs(pts[j].k) >= 1 / 45) j++;
    const turn = Math.sign(p.k), sa = p.s - 7, sb = pts[Math.min(j, pts.length - 1)].s + 7;
    // (the lanes going up the road turn the way the road does, the ones coming down it the other way; on an avenue the
    // lane that turns is the kerb's for a left turn and the middle's for a right, and the other goes straight on)
    for (const [sd, dir] of [[sa - 22, 1], [sb + 22, -1]]) {
      if (sd < 8 || sd > endS || !plain(sd + 2.5 * dir, 4)) continue;
      const td = turn * dir, turning = td > 0 ? 1 : 0;
      lanes.forEach((u, k) => arrow(L(sd, u * dir, dir), !avenue || k === turning ? td : 0));
    }
    for (const [sd, dir] of [[sb + 36, 1], [sa - 36, -1]]) {
      if (sd < 8 || sd > endS || !plain(sd + 1.3 * dir, 4)) continue;
      for (const u of lanes) number(L(sd, u * dir, dir), avenue ? '40' : '30');
    }
    i = j + 1;
  }
  // ---- the avenues' blue cycle lanes, inside each edge line, with a bicycle and an arrow every 25 m
  if (avenue) {
    const uIn = t.wall - 1.58, uOut = t.wall - 0.7, um = (uIn + uOut) / 2, hw = (uOut - uIn) / 2;
    // (the bends near the chunk, sampled once: the lane breaks within 14 m of one, its crossings)
    const bends = [];
    for (let s = Math.floor((s0 - 20) / 2) * 2; s <= s1 + 20; s += 2) if (Math.abs(t.sample(s).k) >= 1 / 45) bends.push(s);
    const zebra = (s) => bends.some((b) => Math.abs(b - s) <= 14);
    // (the bicycles and their arrows go on after all of the blue, which they are painted over)
    const marks = [];
    for (const dir of [1, -1]) {
      for (let s = Math.ceil(s0 / 2) * 2; s < s1; s += 2) {
        if (s < 8 || s > endS || zebra(s) || !plain(s + 1, 1)) continue;
        paint.push([s, um * dir, s + 2.02, um * dir, hw, BLUE]);
        if (((Math.round(s) % 25) + 25) % 25 < 2 && !zebra(s + 4) && plain(s + 4, 5)) marks.push([s, dir]);
      }
    }
    // the bicycle and its arrow, white on the blue, reading for its rider
    for (const [s, dir] of marks) {
      const f = L(s + (dir > 0 ? 0.5 : 2.5), um * dir, dir);
      for (const bc of [0.5, 1.75]) for (let q = 0; q < 8; q++) {
        const a0 = (q / 8) * Math.PI * 2, a1 = ((q + 1) / 8) * Math.PI * 2;
        stroke(f, bc + Math.cos(a0) * 0.36, Math.sin(a0) * 0.36, bc + Math.cos(a1) * 0.36, Math.sin(a1) * 0.36, 0.035, WHITE);
      }
      stroke(f, 0.5, 0, 1.12, 0, 0.035, WHITE); stroke(f, 1.12, 0, 1.75, 0, 0.035, WHITE); stroke(f, 1.12, 0, 0.95, 0.42, 0.035, WHITE);
      stroke(f, 0.5, 0, 0.95, 0.42, 0.035, WHITE); stroke(f, 1.65, 0.1, 1.75, 0, 0.035, WHITE);
      tri(f, [2.6, -0.3], [2.6, 0.3], [3.3, 0], WHITE); tri(f, [3.2, -0.3], [3.2, 0.3], [3.9, 0], WHITE);
    }
  }
  // ---- the manhole covers in the road, where its texture has them (39 m and 17 m into every 48: the steam's)
  const holes = [];
  for (const [off, uk] of [[39, 0.45], [17, -0.5]]) {
    for (let s = Math.ceil((s0 - off) / 48) * 48 + off; s < s1; s += 48) {
      const q = t.sample(s);
      if (q.tunnel || q.express || t.nearTunnel(s, 10)) continue;
      const u = t.half * uk, lx = Math.cos(q.h), lz = -Math.sin(q.h);
      holes.push([q.x + lx * u, q.y + 0.032 - u * Math.tan(q.bank || 0), q.z + lz * u, Math.sin(q.h), Math.cos(q.h)]);
    }
  }
  if (holes.length) roadManholes(THREE, holes, clutter);
}
