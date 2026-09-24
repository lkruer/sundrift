/**
 * NEO TOKYO clutter: what hangs off the buildings and what stands on the pavement, as geometry built once per chunk.
 *
 *     const mats = cityPropMaterials(THREE);             // once: { props, metal, glossy, fabric, lantern, decal, puddle }
 *     const out = {};
 *     for (const lot of lots) lotProps(THREE, lot, rng, out);
 *     for (const seg of pavements) streetProps(THREE, seg, rng, out);
 *     // out[name] = [BufferGeometry in world space, ...]: merge each list into one mesh with mats[name]
 *     // out.__bollards = [[x, y, z], ...]: knockable bollards, placed by the caller (bollardGeometry() gives one)
 *
 * On the buildings: air-conditioner units stacked up the facades with their pipes, downpipes, cable runs and the
 * yellow gas pipe, kitchen ducts climbing from the shops, steel fire-escape stairs, balconies with laundry and
 * futons over the rail, rooftop water tanks on stands, antenna masts, billboard frames, roof railings; over the
 * shop fronts striped awnings or noren, and red paper lanterns at the izakaya doors.
 * On the pavement: garbage bags (blue and black) and crates in clumps, cardboard, parked bicycles, traffic cones,
 * A-frame boards, manhole covers, drain grates along the kerb and puddles. The loose things (bags, crates, boxes,
 * cones, boards, bicycles) are not built into the chunk: their places go to out.__items for instanced pools the car
 * can knock them out of (streetItems() gives each one's geometry), and nothing is put where a road runs.
 *
 * Every piece is written straight into arrays, one BufferGeometry per material per call, with position, normal
 * and uv, indexed. Colours come from one small shared canvas (a palette of flat swatches plus a few patterns);
 * a face that samples one swatch has constant UVs, so it never blends with its neighbours at any mip level.
 * Budget: about 1,500 triangles a lot and 1,000 per 30 m of pavement on average.
 */
import * as THREE from 'three';

// ---------------------------------------------------------------- the shared canvas: swatches and patterns

const PALETTE = [
  // 0-15: neutrals and metal
  0x141416, 0x2a2b2e, 0x44464a, 0x5c6066, 0x74777c, 0x9a9da2, 0xb8bcc2, 0xd9d6ce, 0xf0eee8, 0xd8d2c0, 0xc9c2ae, 0x8a8478, 0x5a6068, 0x3a4048, 0x23262b, 0x0b0c0f,
  // 16-31: warm and rust
  0x7a3f22, 0x4e2a1a, 0x6a4a32, 0xa47c50, 0xb89a70, 0xc0282a, 0x7a1414, 0xe8641c, 0xf0c020, 0xefe2c0, 0xd8b020, 0xe89a3a, 0xc85a3a, 0x9a6a3a, 0x5a3a28, 0x3a2a20,
  // 32-47: cool and colour
  0x2e8a4a, 0x1e4a30, 0x2a8a8a, 0x2a5ab8, 0x1c2a52, 0x7ab0d8, 0x3a78c8, 0x1a3a7a, 0xe07aa8, 0x6a4aa0, 0xb0d8e8, 0x8ac070, 0x4a6a3a, 0x22343a, 0x9ab8c8, 0x5a8aa8,
  // 48-63: laundry, bikes, bags
  0xf6f2e8, 0xa8c8e8, 0xf0a8c0, 0xf0e070, 0x28305a, 0x9098a0, 0xd83a3a, 0x3aa860, 0xc8c8cc, 0x18181a, 0xb82a2a, 0x2a58c0, 0xe8e8ea, 0xe86aa0, 0x2a9a6a, 0x121418,
];
const C = {
  black: 15, charcoal: 1, darkgrey: 2, midgrey: 3, grey: 4, lightgrey: 5, silver: 6, offwhite: 7, white: 8, ivory: 9, beige: 10, concrete: 11, steel: 12, steelDark: 13, rubber: 14,
  rust: 16, rustDark: 17, brown: 18, cardboard: 19, tan: 20, red: 21, darkred: 22, orange: 23, yellow: 24, cream: 25, gas: 26, amber: 27, brick: 28,
  green: 32, darkgreen: 33, teal: 34, blue: 35, navy: 36, lightblue: 37, bagBlue: 38, deepblue: 39, pink: 40, purple: 41, paleblue: 42, leaf: 43, moss: 44, slate: 45,
  wWhite: 48, wBlue: 49, wPink: 50, wYellow: 51, wNavy: 52, wGrey: 53, wRed: 54, wGreen: 55,
  bSilver: 56, bBlack: 57, bRed: 58, bBlue: 59, bWhite: 60, bPink: 61, bGreen: 62, bagBlack: 63,
};
const TEX = 256;
const sw = (i) => [((i % 16) * 16 + 8) / TEX, 1 - (Math.floor(i / 16) * 16 + 8) / TEX];
// pattern cells, 64 px, rows 1-3 of the sheet: [u0, v0, u1, v1] inset a little
const cell = (col, row) => [(col * 64 + 2) / TEX, 1 - (row * 64 + 62) / TEX, (col * 64 + 62) / TEX, 1 - (row * 64 + 2) / TEX];
const PAT = {
  awning: [cell(0, 1), cell(1, 1), cell(2, 1), cell(3, 1)],
  norenBlue: cell(0, 2), norenRed: cell(1, 2), manhole: cell(2, 2), grate: cell(3, 2),
  chalk: cell(0, 3), menu: cell(1, 3), acFront: cell(2, 3), frp: cell(3, 3),
};

let SHEET = null;
function sheet(T) {
  if (SHEET) return SHEET;
  const cv = document.createElement('canvas'); cv.width = cv.height = TEX;
  const c = cv.getContext('2d');
  const hex = (h) => '#' + h.toString(16).padStart(6, '0');
  PALETTE.forEach((h, i) => { c.fillStyle = hex(h); c.fillRect((i % 16) * 16, Math.floor(i / 16) * 16, 16, 16); });
  // awnings: eight stripes each, and a darker hem
  const stripes = [[0xc8282a, 0xf2eee4], [0x1f4aa0, 0xf2eee4], [0x1f7a44, 0xf2eee4], [0xd8641c, 0x3a2a20]];
  stripes.forEach(([a, b], k) => {
    for (let i = 0; i < 8; i++) { c.fillStyle = hex(i % 2 ? b : a); c.fillRect(k * 64 + i * 8, 64, 8, 64); }
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(k * 64, 120, 64, 8);
  });
  // noren: indigo and red, a white mark, slits between the panels
  for (const [k, bg] of [[0, '#1c2a5a'], [1, '#b02424']]) {
    c.fillStyle = bg; c.fillRect(k * 64, 128, 64, 64);
    c.fillStyle = '#f2eee4'; c.beginPath(); c.arc(k * 64 + 32, 152, 10, 0, Math.PI * 2); c.fill();
    c.fillStyle = bg; c.beginPath(); c.arc(k * 64 + 32, 152, 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.5)'; for (const x of [16, 32, 48]) c.fillRect(k * 64 + x - 1, 166, 2, 26);
    c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(k * 64, 128, 64, 5);
  }
  // a manhole cover: a rim, rings and a hatch of cast lines
  { const x = 128 + 32, y = 160;
    c.fillStyle = '#3a3c40'; c.fillRect(128, 128, 64, 64);
    c.fillStyle = '#6a6c70'; c.beginPath(); c.arc(x, y, 30, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#4a4c50'; c.beginPath(); c.arc(x, y, 26, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#7a7c80'; c.lineWidth = 2;
    for (const r of [8, 16, 22]) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); }
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; c.beginPath(); c.moveTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); c.lineTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22); c.stroke(); } }
  // a drain grate: bars
  c.fillStyle = '#16171a'; c.fillRect(192, 128, 64, 64);
  c.fillStyle = '#5a5c60'; for (let i = 0; i < 9; i++) c.fillRect(192 + 2 + i * 7, 128, 3, 64);
  c.fillRect(192, 128, 64, 3); c.fillRect(192, 189, 64, 3);
  // A-frame boards: a chalkboard menu and a white board with a red head
  c.fillStyle = '#1b2a22'; c.fillRect(0, 192, 64, 64);
  c.strokeStyle = 'rgba(230,230,210,0.75)'; c.lineWidth = 2;
  for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(8, 204 + i * 8); c.lineTo(20 + ((i * 37) % 30), 204 + i * 8); c.stroke(); c.beginPath(); c.moveTo(44, 204 + i * 8); c.lineTo(56, 204 + i * 8); c.stroke(); }
  c.strokeStyle = '#f0a8c0'; c.beginPath(); c.moveTo(8, 198); c.lineTo(56, 198); c.stroke();
  c.fillStyle = '#f2eee4'; c.fillRect(64, 192, 64, 64);
  c.fillStyle = '#c8282a'; c.fillRect(64, 192, 64, 16);
  c.fillStyle = '#26282c'; for (let i = 0; i < 5; i++) { c.fillRect(72, 214 + i * 8, 24 + ((i * 13) % 20), 4); c.fillRect(106, 214 + i * 8, 14, 4); }
  // an air conditioner's front: the fan grille on an ivory case
  c.fillStyle = '#d6d0c0'; c.fillRect(128, 192, 64, 64);
  c.fillStyle = '#2a2b2e'; c.beginPath(); c.arc(128 + 26, 224, 22, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#8a8680'; c.lineWidth = 1.5;
  for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(128 + 4, 224 + i * 6); c.lineTo(128 + 48, 224 + i * 6); c.stroke(); }
  c.fillStyle = '#b8b2a2'; c.fillRect(128 + 52, 200, 8, 48);
  // FRP tank panels: cream squares with seams and bolts
  c.fillStyle = '#d8d2bc'; c.fillRect(192, 192, 64, 64);
  c.fillStyle = '#9a9482'; for (const v of [0, 31, 62]) { c.fillRect(192 + v, 192, 2, 64); c.fillRect(192, 192 + v, 64, 2); }
  c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(192, 236, 64, 20);
  const t = new T.CanvasTexture(cv);
  t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; t.name = 'city props';
  SHEET = t;
  return t;
}

/** The materials, made once. Keys are the names lotProps and streetProps write into `out`. */
export function cityPropMaterials(T = THREE) {
  const map = sheet(T);
  const m = {
    props: new T.MeshStandardMaterial({ map, roughness: 0.72, metalness: 0.05 }),
    metal: new T.MeshStandardMaterial({ map, roughness: 0.42, metalness: 0.55 }),
    glossy: new T.MeshStandardMaterial({ map, roughness: 0.2, metalness: 0.0 }),
    fabric: new T.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0.0, side: T.DoubleSide }),
    lantern: new T.MeshStandardMaterial({ color: 0xd8342a, emissive: 0xff4a24, emissiveIntensity: 1.7, roughness: 0.75, metalness: 0 }),
    decal: new T.MeshStandardMaterial({ map, roughness: 0.45, metalness: 0.35, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    puddle: new T.MeshStandardMaterial({ color: 0x06070a, roughness: 0.03, metalness: 0.0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }),
  };
  for (const [k, v] of Object.entries(m)) v.name = 'city ' + k;
  return m;
}

// ---------------------------------------------------------------- geometry, straight into arrays

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

class Mesher {
  constructor() { this.m = new Map(); this.tris = 0; }
  g(mat) { let g = this.m.get(mat); if (!g) { g = { p: [], n: [], uv: [], i: [] }; this.m.set(mat, g); } return g; }
  /** A quad, corners counter-clockwise seen from the front; one normal; uv a point or four corners. */
  quad(mat, P, n, uv) {
    const g = this.g(mat), b = g.p.length / 3;
    for (let k = 0; k < 4; k++) { const p = P[k]; g.p.push(p[0], p[1], p[2]); g.n.push(n[0], n[1], n[2]); const t = uv.length === 4 ? uv[k] : uv; g.uv.push(t[0], t[1]); }
    g.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
    this.tris += 2;
  }
  /** A quad turned to face `want` (its corners reversed if they wind the other way); the normal from the corners. */
  quadN(mat, P, want, uv) {
    let n = nrm(cross(sub(P[1], P[0]), sub(P[3], P[0])));
    if (dot(n, want) < 0) { P = [P[3], P[2], P[1], P[0]]; if (uv.length === 4) uv = [uv[3], uv[2], uv[1], uv[0]]; n = mul(n, -1); }
    this.quad(mat, P, n, uv);
  }
  tri(mat, P, n, uv) {
    const g = this.g(mat), b = g.p.length / 3;
    for (let k = 0; k < 3; k++) { const p = P[k]; g.p.push(p[0], p[1], p[2]); g.n.push(n[0], n[1], n[2]); const t = uv.length === 3 ? uv[k] : uv; g.uv.push(t[0], t[1]); }
    g.i.push(b, b + 1, b + 2);
    this.tris += 1;
  }
  /**
   * A box: centre c, half-axes ax, ay, az (world vectors, any handedness). uv is a swatch point, or faces is
   * { 0..5: uv } for single faces (0 +ax, 1 -ax, 2 +ay, 3 -ay, 4 +az, 5 -az) with a point or four corners.
   * `skip` lists faces to leave out (a bottom on the ground, a back against a wall).
   */
  box(mat, c, ax, ay, az, uv, faces = null, skip = null) {
    const A = [ax, ay, az];
    for (let k = 0; k < 3; k++) for (const s of [1, -1]) {
      const fi = k * 2 + (s > 0 ? 0 : 1);
      if (skip && skip.includes(fi)) continue;
      const n = mul(A[k], s);
      let u = A[(k + 1) % 3], v = A[(k + 2) % 3];
      if (dot(cross(u, v), n) < 0) [u, v] = [v, u];
      const fc = add(c, n);
      const P = [sub(sub(fc, u), v), sub(add(fc, u), v), add(add(fc, u), v), add(sub(fc, u), v)];
      this.quad(mat, P, nrm(n), (faces && faces[fi]) || uv);
    }
  }
  /** A beam between two points with a square section of side t (the section turned by `roll` round it). */
  beam(mat, p0, p1, t, uv, up = [0, 1, 0]) {
    const d = sub(p1, p0), L = Math.hypot(d[0], d[1], d[2]) || 1e-6, f = mul(d, 1 / L);
    let side = cross(f, up); if (Math.hypot(side[0], side[1], side[2]) < 1e-3) side = cross(f, [1, 0, 0]);
    side = nrm(side); const up2 = nrm(cross(side, f));
    this.box(mat, mul(add(p0, p1), 0.5), mul(f, L / 2), mul(side, t / 2), mul(up2, t / 2), uv);
  }
  /** A tube of n sides from p0 to p1, radius r0 to r1, smooth sides; caps optional. */
  cyl(mat, p0, p1, r0, r1, n, uv, capTop = false, capBottom = false) {
    const d = sub(p1, p0), dh = nrm(d);
    const ref = Math.abs(dh[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const e1 = nrm(cross(dh, ref)), e2 = cross(dh, e1);
    const g = this.g(mat), b = g.p.length / 3;
    const slope = (r0 - r1) / (Math.hypot(d[0], d[1], d[2]) || 1);
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const rad = [e1[0] * ca + e2[0] * sa, e1[1] * ca + e2[1] * sa, e1[2] * ca + e2[2] * sa];
      const nn = nrm(add(rad, mul(dh, slope)));
      for (const [p, r] of [[p0, r0], [p1, r1]]) { g.p.push(p[0] + rad[0] * r, p[1] + rad[1] * r, p[2] + rad[2] * r); g.n.push(nn[0], nn[1], nn[2]); g.uv.push(uv[0], uv[1]); }
    }
    for (let i = 0; i < n; i++) { const a = b + i * 2; g.i.push(a, a + 2, a + 3, a, a + 3, a + 1); }
    this.tris += n * 2;
    const cap = (p, r, s) => {
      const bc = g.p.length / 3;
      g.p.push(p[0], p[1], p[2]); g.n.push(dh[0] * s, dh[1] * s, dh[2] * s); g.uv.push(uv[0], uv[1]);
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        g.p.push(p[0] + (e1[0] * ca + e2[0] * sa) * r, p[1] + (e1[1] * ca + e2[1] * sa) * r, p[2] + (e1[2] * ca + e2[2] * sa) * r);
        g.n.push(dh[0] * s, dh[1] * s, dh[2] * s); g.uv.push(uv[0], uv[1]);
      }
      for (let i = 0; i < n; i++) { if (s > 0) g.i.push(bc, bc + 1 + i, bc + 2 + i); else g.i.push(bc, bc + 2 + i, bc + 1 + i); }
      this.tris += n;
    };
    if (capTop && r1 > 0) cap(p1, r1, 1);
    if (capBottom && r0 > 0) cap(p0, r0, -1);
  }
  /** A body of revolution about the vertical through c: profile [[r, h], ...] from the bottom up, n sides. */
  lathe(mat, c, prof, n, uv, sx = 1, sz = 1) {
    const g = this.g(mat), b = g.p.length / 3;
    for (let j = 0; j < prof.length; j++) {
      const [r, h] = prof[j];
      const [r0, h0] = prof[Math.max(0, j - 1)], [r1, h1] = prof[Math.min(prof.length - 1, j + 1)];
      const tr = r1 - r0, th = h1 - h0;                                  // the profile's tangent
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        g.p.push(c[0] + ca * r * sx, c[1] + h, c[2] - sa * r * sz);
        const nn = nrm([ca * th / sx, -tr, -sa * th / sz]);
        g.n.push(nn[0], nn[1], nn[2]); g.uv.push(uv[0], uv[1]);
      }
    }
    for (let j = 0; j < prof.length - 1; j++) for (let i = 0; i < n; i++) {
      const a = b + j * (n + 1) + i, a2 = a + n + 1;
      g.i.push(a, a + 1, a2 + 1, a, a2 + 1, a2);
    }
    this.tris += (prof.length - 1) * n * 2;
  }
  /** A flat polygon lying on the ground at height y, its outline from r(angle); uv mapped onto rect or one point. */
  flat(mat, cx, y, cz, rfn, n, rect, ax = [1, 0, 0], az = [0, 0, 1]) {
    const g = this.g(mat), b = g.p.length / 3;
    const U = (s, t) => rect.length === 4 ? [rect[0] + (rect[2] - rect[0]) * s, rect[1] + (rect[3] - rect[1]) * t] : rect;
    g.p.push(cx, y, cz); g.n.push(0, 1, 0); const u0 = U(0.5, 0.5); g.uv.push(u0[0], u0[1]);
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2, r = rfn(a), ca = Math.cos(a) * r, sa = Math.sin(a) * r;
      // counter-clockwise from above: +ax toward -az
      g.p.push(cx + ax[0] * ca - az[0] * sa, y, cz + ax[2] * ca - az[2] * sa); g.n.push(0, 1, 0);
      const t = U(0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a)); g.uv.push(t[0], t[1]);
    }
    // the outline runs counter-clockwise from above only if ax x az points down; otherwise wind it the other way
    const flip = (ax[2] * az[0] - ax[0] * az[2]) > 0;
    for (let i = 0; i < n; i++) { if (flip) g.i.push(b, b + 2 + i, b + 1 + i); else g.i.push(b, b + 1 + i, b + 2 + i); }
    this.tris += n;
  }
  flush(T, out) {
    for (const [mat, g] of this.m) {
      if (!g.i.length) continue;
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(g.p, 3));
      geo.setAttribute('normal', new T.Float32BufferAttribute(g.n, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(g.uv, 2));
      geo.setIndex(g.i);
      geo.computeBoundingSphere();
      (out[mat] || (out[mat] = [])).push(geo);
    }
  }
}

/** A local frame: origin, along, out (away from the wall, or toward the buildings on the pavement), up. */
function frame(o, a, b) {
  const up = [0, 1, 0];
  return {
    o, a, b, up,
    P: (x, z, h) => [o[0] + a[0] * x + b[0] * z, o[1] + h, o[2] + a[2] * x + b[2] * z],
    A: (s) => mul(a, s), B: (s) => mul(b, s), U: (s) => [0, s, 0],
    // axes turned by t about the vertical (for things set at an angle)
    turn(t) { const c = Math.cos(t), s = Math.sin(t); return [add(mul(a, c), mul(b, s)), add(mul(a, -s), mul(b, c))]; },
  };
}

const pick = (rng, arr) => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];

// ---------------------------------------------------------------- the buildings' clutter

const F0 = 3.7, FH = 3.4;         // the first upper floor, above the pavement (the game sinks each box 0.3 m), and floor to floor

/**
 * The clutter of one building. lot = { x, z, y, fx, fz, lx, lz, width, depth, height, shop, clear }: (x, y, z) the
 * middle of its front at the pavement, (fx, fz) along the road, (lx, lz) from the front into the building. clear
 * (optional, from citydetail.js) is what must stay free: boxes on the front [x0, x1, h0, h1] in the lot's own metres
 * (a screen, an LED tower, an arch's post, the end of a string of lanterns) and roof: true when a billboard stands on
 * the roof.
 */
export function lotProps(T, lot, rng, out) {
  const M = new Mesher();
  const W = lot.width, D = lot.depth, H = lot.height;
  // local: x along the front (-W/2..W/2), z out from the wall toward the road, h above the pavement
  const F = frame([lot.x, lot.y, lot.z], [lot.fx, 0, lot.fz], [-lot.lx, 0, -lot.lz]);
  const floors = Math.max(0, Math.floor((H + 0.3 - 4.6) / FH));        // the upper floors with windows
  const fl = (k) => F0 + (k - 1) * FH;                                   // floor k's level (k = 1 is the first upper floor)
  const halfW = W / 2;
  const residential = rng() < 0.55;
  const keep = (lot.clear && lot.clear.boxes) || [];
  const free = (x0, x1, h0, h1) => { for (const b of keep) if (x1 > b[0] && x0 < b[1] && h1 > b[2] && h0 < b[3]) return false; return true; };
  const roofFree = !(lot.clear && lot.clear.roof);

  // ---- air conditioners, stacked in columns up the front, each on its bracket with its pipe into the wall
  const cols = floors >= 2 ? 1 + Math.floor(rng() * Math.min(4, W / 3.5)) : 0;
  const acBody = pick(rng, [C.ivory, C.beige, C.offwhite, C.lightgrey]);
  for (let ci = 0; ci < cols; ci++) {
    const x = -halfW + 1.4 + rng() * Math.max(0.1, W - 2.8);
    const k0 = 2 + Math.floor(rng() * 2), k1 = Math.min(floors, k0 + 1 + Math.floor(rng() * 6));
    const pipeX = x + (rng() < 0.5 ? -0.55 : 0.55);
    for (let k = k0; k <= k1; k++) {
      if (rng() < 0.12) continue;
      if (!free(x - 0.55, x + 0.55, fl(k) - 0.1, fl(k) + 0.8)) continue;
      const h = fl(k) + 0.08;
      const c = F.P(x, 0.2, h + 0.3);
      const g = PAT.acFront;
      M.box('props', c, F.A(0.4), F.U(0.3), F.B(0.16), sw(acBody), { 4: [[g[0], g[1]], [g[2], g[1]], [g[2], g[3]], [g[0], g[3]]] }, [5]);
      // the bracket under it, the pipe from its side into the wall
      M.box('metal', F.P(x, 0.2, h - 0.03), F.A(0.36), F.U(0.03), F.B(0.18), sw(C.steelDark), null, [5]);
      M.box('props', F.P(pipeX > x ? x + 0.46 : x - 0.46, 0.08, h + 0.35), F.A(0.06), F.U(0.05), F.B(0.08), sw(C.offwhite), null, [5]);
    }
    // the pipe run down the wall beside the column
    const prx = pipeX > x ? x + 0.52 : x - 0.52;
    if (k1 >= k0 && free(prx - 0.1, prx + 0.1, fl(k0), fl(k1) + 0.7)) M.box('props', F.P(prx, 0.06, (fl(k0) + fl(k1) + 0.7) / 2), F.A(0.035), F.U((fl(k1) - fl(k0) + 0.7) / 2), F.B(0.035), sw(C.offwhite), null, [5]);
  }

  // ---- downpipes at the ends, cable runs, the yellow gas pipe, the meter boxes
  const pipeCol = pick(rng, [C.midgrey, C.grey, C.rustDark, C.charcoal]);
  for (const s of rng() < 0.5 ? [1] : [1, -1]) {
    const x = s * (halfW - 0.14);
    M.cyl('metal', F.P(x, 0.1, 0), F.P(x, 0.1, H + 0.05), 0.055, 0.055, 6, sw(pipeCol));
    M.box('metal', F.P(x, 0.16, H - 0.1), F.A(0.14), F.U(0.12), F.B(0.14), sw(pipeCol), null, [5]);      // the hopper under the scupper
  }
  for (let run = 0; run < (W > 9 ? 2 : 1); run++) {
    // cable runs climb the piers near the ends of the front, not across the shop glass
    const x = (run ? -1 : 1) * (rng() < 0.5 ? 1 : -1) * (halfW - 0.45 - rng() * 0.5);
    const top = Math.min(H - 0.5, fl(Math.max(1, floors)) + 2.5 - run * rng() * FH * 2);
    const nRun = 2 + Math.floor(rng() * 2);
    if (free(x - 0.1, x + 0.3, 0.4, top)) for (let j = 0; j < nRun; j++) M.box('props', F.P(x + j * 0.07, 0.05, (0.4 + top) / 2), F.A(0.018), F.U((top - 0.4) / 2), F.B(0.018), sw(C.black), null, [5]);
  }
  {
    // the gas pipe: up a pier at one end of the front to the first floor, and a short run along the foot
    const gs = rng() < 0.5 ? -1 : 1, gx = gs * (halfW - 0.36);
    if (free(gx - 2.4, gx + 2.4, 0, 3.1)) {
    M.box('metal', F.P(gx, 0.08, 1.6), F.A(0.035), F.U(1.4), F.B(0.035), sw(C.gas), null, [5]);
    const run = 0.6 + rng() * 1.6;
    M.box('metal', F.P(gx - gs * run / 2, 0.08, 0.28), F.A(run / 2 + 0.035), F.U(0.035), F.B(0.035), sw(C.gas), null, [5]);
    // meter boxes on the same pier
    M.box('props', F.P(gx - gs * 0.12, 0.13, 1.55), F.A(0.18), F.U(0.24), F.B(0.08), sw(C.lightgrey), null, [5]);
    if (rng() < 0.6) M.box('props', F.P(gx - gs * 0.1, 0.11, 0.95), F.A(0.14), F.U(0.16), F.B(0.06), sw(C.midgrey), null, [5]);
    }
  }

  // ---- a kitchen duct climbing from a shop to the roof
  if (lot.shop && rng() < 0.28 && floors >= 1) {
    const x = (rng() < 0.5 ? -1 : 1) * (halfW - 1.1 - rng() * 1.2);
    if (free(x - 0.35, x + 0.35, 4.0, H + 1)) {
      M.box('metal', F.P(x, 0.26, (4.1 + H + 0.6) / 2), F.A(0.2), F.U((H + 0.6 - 4.1) / 2), F.B(0.2), sw(C.silver), null, [5]);
      M.box('metal', F.P(x, 0.3, H + 0.75), F.A(0.3), F.U(0.12), F.B(0.3), sw(C.steel));
      for (let h = 5.5; h < H; h += 3.4) M.box('metal', F.P(x, 0.26, h), F.A(0.24), F.U(0.04), F.B(0.24), sw(C.steelDark));
    }
  }

  // ---- an old sign nobody took down: an empty steel frame, or a dead board, out from an upper floor
  if (floors >= 3 && W > 7 && rng() < 0.4) {
    const x = (rng() - 0.5) * (W - 4.5), k = 3 + Math.floor(rng() * Math.max(1, floors - 2));
    if (k <= floors && free(x - 0.3, x + 0.3, fl(k), fl(k) + 3.7)) {
      const h0 = fl(k) + 0.4, sh = 1.6 + rng() * 1.6, sw2 = 0.35 + rng() * 0.25, reach = 0.8 + rng() * 0.5;
      const col = sw(pick(rng, [C.rustDark, C.rust, C.steelDark]));
      for (const h of [h0, h0 + sh]) M.beam('metal', F.P(x, 0.0, h), F.P(x, reach, h), 0.05, col);
      M.beam('metal', F.P(x, reach, h0), F.P(x, reach, h0 + sh), 0.05, col);
      if (rng() < 0.55) M.box('props', F.P(x, (0.15 + reach) / 2, h0 + sh / 2), F.A(0.06), F.U(sh / 2 - 0.05), F.B((reach - 0.15) / 2), sw(pick(rng, [C.charcoal, C.darkgrey, C.rustDark])));
      else M.beam('metal', F.P(x, 0.15, h0), F.P(x, reach, h0 + sh), 0.03, col);
      void sw2;
    }
  }

  // ---- balconies with laundry and a futon over the rail, on some homes
  if (residential && floors >= 2 && rng() < 0.75) {
    const n = Math.max(1, Math.min(3, Math.floor(W / 4.2)));
    const bw = Math.min(2.6, W / n - 0.6);
    const railCol = pick(rng, [C.offwhite, C.lightgrey, C.concrete, C.steel]);
    for (let bi = 0; bi < n; bi++) {
      const x = -halfW + (bi + 0.5) * (W / n);
      for (let k = 2; k <= Math.min(floors, 12); k++) {                   // (above twelve floors nobody sees them)
        if (rng() < 0.25) continue;
        const h = fl(k);
        if (!free(x - bw / 2 - 0.1, x + bw / 2 + 0.1, h - 0.1, h + 2.2)) continue;
        M.box('props', F.P(x, 0.45, h + 0.05), F.A(bw / 2), F.U(0.07), F.B(0.45), sw(C.concrete), null, [5]);
        // the flat's air conditioner, on the balcony floor behind the rail
        if (rng() < 0.7) { const g = PAT.acFront; M.box('props', F.P(x + (rng() < 0.5 ? -1 : 1) * (bw / 2 - 0.5), 0.36, h + 0.42), F.A(0.38), F.U(0.3), F.B(0.14), sw(acBody), { 4: [[g[0], g[1]], [g[2], g[1]], [g[2], g[3]], [g[0], g[3]]] }, [5]); }
        M.box('props', F.P(x, 0.88, h + 0.62), F.A(bw / 2), F.U(0.5), F.B(0.035), sw(railCol));
        M.box('props', F.P(x - bw / 2 + 0.03, 0.45, h + 0.62), F.A(0.03), F.U(0.5), F.B(0.42), sw(railCol), null, [5]);
        M.box('props', F.P(x + bw / 2 - 0.03, 0.45, h + 0.62), F.A(0.03), F.U(0.5), F.B(0.42), sw(railCol), null, [5]);
        // the laundry pole and what hangs on it
        const r = rng();
        if (r < 0.7) {
          M.box('metal', F.P(x, 0.5, h + 1.95), F.A(bw / 2 - 0.1), F.U(0.015), F.B(0.015), sw(C.silver));
          let lx = x - bw / 2 + 0.3;
          while (lx < x + bw / 2 - 0.3) {
            const wide = rng() < 0.4, cw = wide ? 0.32 : 0.2, chh = wide ? 0.34 : 0.5;
            M.box('fabric', F.P(lx + cw, 0.5, h + 1.95 - chh), F.A(cw), F.U(chh), F.B(0.01), sw(pick(rng, [C.wWhite, C.wBlue, C.wPink, C.wYellow, C.wNavy, C.wGrey, C.wRed, C.wGreen, C.wWhite])));
            lx += cw * 2 + 0.08 + rng() * 0.25;
          }
        }
        if (r > 0.55) M.box('fabric', F.P(x + (rng() - 0.5) * 0.6, 0.9, h + 0.92), F.A(Math.min(0.7, bw / 2 - 0.1)), F.U(0.3), F.B(0.1), sw(pick(rng, [C.wWhite, C.wPink, C.wBlue, C.wYellow])));
      }
    }
  }

  // ---- the steel fire escape: landings and flights zigzagging up one end of the front
  if (floors >= 3 && W >= 10 && rng() < 0.3) {
    const s = rng() < 0.5 ? -1 : 1;
    const xa = s * (halfW - 1.3), xb = s * (halfW - 4.3);
    const col = pick(rng, [C.steel, C.rust, C.darkgreen, C.midgrey]);
    const fireOK = free(Math.min(xa, xb) - 0.8, Math.max(xa, xb) + 0.8, 5.4, fl(floors) + 1.6);
    for (let k = 2; fireOK && k <= floors; k++) {
      const h = fl(k), end = k % 2 ? xa : xb, other = k % 2 ? xb : xa;
      M.box('metal', F.P(end, 0.55, h), F.A(0.6), F.U(0.04), F.B(0.5), sw(col), null, [5]);
      M.box('metal', F.P(end, 1.05, h + 0.55), F.A(0.6), F.U(0.02), F.B(0.02), sw(col));          // the landing's rail
      M.box('metal', F.P(end + s * 0.6 * (k % 2 ? 1 : -1), 1.05, h + 0.28), F.A(0.02), F.U(0.3), F.B(0.02), sw(col));
      if (k < floors) {
        // the flight to the next landing, at the other end, and its handrail
        const dir = Math.sign(other - end);
        const xs = end + dir * 0.6, xe = other - dir * 0.6;
        const pa = F.P(xs, 0.55, h), pb = F.P(xe, 0.55, h + FH);
        const d = sub(pb, pa), Lf = Math.hypot(d[0], d[1], d[2]), fdir = mul(d, 1 / Lf);
        M.box('metal', mul(add(pa, pb), 0.5), mul(fdir, Lf / 2), F.B(0.42), mul(nrm(cross(fdir, F.b)), 0.03), sw(col));
        M.beam('metal', F.P(xs, 1.02, h + 0.9), F.P(xe, 1.02, h + FH + 0.9), 0.035, sw(col));
      }
    }
    // the ladder that drops toward the street
    if (fireOK) {
      M.beam('metal', F.P(xa, 0.85, fl(2)), F.P(xa, 0.85, 5.6), 0.04, sw(col));
      M.beam('metal', F.P(xa + s * 0.35, 0.85, fl(2)), F.P(xa + s * 0.35, 0.85, 5.6), 0.04, sw(col));
    }
  }

  // ---- over the shop front: a striped awning or noren, and red lanterns at an izakaya door
  if (lot.shop) {
    const r = rng();
    const door = (rng() - 0.5) * Math.max(0, W - 3.5);
    const doorFree = free(door - 2.9, door + 2.9, 0, 3.4);
    if (!doorFree) { /* (an arch post stands here) */ } else if (r < 0.45) {
      const aw = Math.min(W - 1.4, 2.4 + rng() * 3.2), x0 = door - aw / 2, x1 = door + aw / 2;
      const hi = 3.0, lo = 2.5, out = 1.1 + rng() * 0.4;
      const pat = pick(rng, PAT.awning);
      const Pa = F.P(x0, 0.02, hi), Pb = F.P(x1, 0.02, hi), Pc = F.P(x1, out, lo), Pd = F.P(x0, out, lo);
      const upOut = nrm(add([0, out, 0], F.B(hi - lo)));
      // the slope (the stripes run down it), the valance, the two side cheeks
      M.quadN('fabric', [Pd, Pc, Pb, Pa], upOut, [[pat[0], pat[1]], [pat[2], pat[1]], [pat[2], pat[3]], [pat[0], pat[3]]]);
      const Pe = F.P(x1, out, lo - 0.26), Pf = F.P(x0, out, lo - 0.26);
      M.quadN('fabric', [Pf, Pe, Pc, Pd], F.B(1), [[pat[0], pat[1]], [pat[2], pat[1]], [pat[2], pat[1] + 0.05], [pat[0], pat[1] + 0.05]]);
      for (const [x, s] of [[x0, -1], [x1, 1]]) {
        M.quadN('fabric', [F.P(x, 0.02, hi), F.P(x, 0.02, lo - 0.1), F.P(x, out, lo - 0.26), F.P(x, out, lo)], F.A(s), [pat[0] + 0.01, pat[1] + 0.02]);
      }
      M.beam('metal', F.P(x0, out, lo), F.P(x1, out, lo), 0.03, sw(C.steelDark));
    } else if (r < 0.72) {
      // noren: a short split curtain on a pole across the doorway
      const nw = 1.2 + rng() * 0.8, pat = rng() < 0.6 ? PAT.norenBlue : PAT.norenRed;
      M.beam('metal', F.P(door - nw / 2 - 0.1, 0.12, 2.62), F.P(door + nw / 2 + 0.1, 0.12, 2.62), 0.03, sw(C.brown));
      M.quadN('fabric', [F.P(door - nw / 2, 0.14, 1.85), F.P(door + nw / 2, 0.14, 1.85), F.P(door + nw / 2, 0.14, 2.6), F.P(door - nw / 2, 0.14, 2.6)], F.B(1),
        [[pat[0], pat[1]], [pat[2], pat[1]], [pat[2], pat[3]], [pat[0], pat[3]]]);
    }
    if (doorFree && r > 0.3 && r < 0.72 && rng() < 0.55) {
      // a pair of red paper lanterns flanking the door, on short brackets
      for (const s of [-1, 1]) {
        const x = door + s * (0.95 + rng() * 0.2), cy = 2.35;
        const c = F.P(x, 0.42, cy - 0.3);
        M.lathe('lantern', c, [[0.05, 0.0], [0.17, 0.08], [0.21, 0.3], [0.17, 0.52], [0.05, 0.6]], 8, [0, 0]);
        M.cyl('props', F.P(x, 0.42, cy - 0.33), F.P(x, 0.42, cy - 0.28), 0.1, 0.1, 8, sw(C.black), true, true);
        M.cyl('props', F.P(x, 0.42, cy + 0.29), F.P(x, 0.42, cy + 0.34), 0.08, 0.08, 8, sw(C.black), true, true);
        M.beam('metal', F.P(x, 0.0, cy + 0.42), F.P(x, 0.42, cy + 0.42), 0.03, sw(C.black));
        M.beam('metal', F.P(x, 0.42, cy + 0.42), F.P(x, 0.42, cy + 0.33), 0.015, sw(C.black));
      }
    }
  }

  // ---- the roof: a water tank on its stand, masts, a billboard frame, a railing
  const roofZ = (t) => -Math.min(D - 1.5, 1.5 + t * (D - 3));                       // set back from the front
  if (rng() < 0.65 && roofFree) {
    const x = (rng() - 0.5) * Math.max(0, W - 3.5), z = roofZ(0.3 + rng() * 0.5);
    const tw = 1.1 + rng() * 0.6, th = 0.9 + rng() * 0.5, stand = 0.8;
    const blue = rng() < 0.35;
    const frp = [[PAT.frp[0], PAT.frp[1]], [PAT.frp[2], PAT.frp[1]], [PAT.frp[2], PAT.frp[3]], [PAT.frp[0], PAT.frp[3]]];
    M.box(blue ? 'glossy' : 'props', F.P(x, z, H + stand + th), F.A(tw), F.U(th), F.B(tw * 0.8), blue ? sw(C.paleblue) : sw(C.cream), blue ? null : { 0: frp, 1: frp, 4: frp, 5: frp });
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.box('metal', F.P(x + sx * (tw - 0.1), z + sz * (tw * 0.8 - 0.1), H + stand / 2), F.A(0.05), F.U(stand / 2), F.B(0.05), sw(C.steelDark), null, [3]);
    M.box('metal', F.P(x, z, H + stand - 0.04), F.A(tw), F.U(0.04), F.B(tw * 0.8), sw(C.steelDark));
    M.cyl('metal', F.P(x + tw, z, H + stand + 0.3), F.P(x + tw + 0.3, z, H + stand + 0.3), 0.05, 0.05, 6, sw(C.midgrey));
  }
  if (rng() < 0.5 && roofFree) {
    const x = (rng() - 0.5) * (W - 2), z = roofZ(0.1 + rng() * 0.6), mh = 3 + rng() * 6;
    M.cyl('metal', F.P(x, z, H), F.P(x, z, H + mh), 0.04, 0.03, 5, sw(C.silver));
    for (let j = 0; j < 3; j++) M.box('metal', F.P(x, z, H + mh - 0.3 - j * 0.55), F.A(0.02), F.U(0.02), F.B(0.5 - j * 0.1), sw(C.silver));
    for (let j = 0; j < 2; j++) M.box('metal', F.P(x, z + (j - 0.5) * 0.5, H + mh - 0.3), F.A(0.25), F.U(0.012), F.B(0.012), sw(C.silver));
  }
  if (H > 14 && rng() < 0.22 && roofFree) {
    // a billboard frame on the roof, facing the road: a lattice of steel behind a dark board (or none)
    const bw = Math.min(W - 1, 5 + rng() * 5), bh = 2.5 + rng() * 2.5, z = -0.9, base = H + 1.2;
    const board = rng() < 0.6;
    if (board) M.box('props', F.P(0, z, base + bh / 2), F.A(bw / 2), F.U(bh / 2), F.B(0.06), sw(C.charcoal));
    const col = sw(pick(rng, [C.steelDark, C.rustDark, C.steel]));
    const n = Math.max(2, Math.round(bw / 1.6));
    for (let j = 0; j <= n; j++) {
      const x = -bw / 2 + (j / n) * bw;
      M.beam('metal', F.P(x, z - 0.2, H), F.P(x, z - 0.2, base + bh), 0.08, col);
      if (j < n) M.beam('metal', F.P(x, z - 0.2, base), F.P(x + bw / n, z - 0.2, base + bh), 0.05, col);
      M.beam('metal', F.P(x, z - 0.2, base + bh * 0.6), F.P(x, z - 1.6, H), 0.06, col);       // the raking strut
    }
    for (const h of [base, base + bh]) M.beam('metal', F.P(-bw / 2, z - 0.2, h), F.P(bw / 2, z - 0.2, h), 0.07, col);
  }
  if (rng() < 0.45 && roofFree) {
    // a railing along the roof's front edge
    const col = sw(pick(rng, [C.silver, C.steel, C.offwhite]));
    M.beam('metal', F.P(-halfW + 0.2, -0.25, H + 1.05), F.P(halfW - 0.2, -0.25, H + 1.05), 0.04, col);
    for (let x = -halfW + 0.2; x <= halfW - 0.1; x += 1.8) M.box('metal', F.P(x, -0.25, H + 0.52), F.A(0.02), F.U(0.52), F.B(0.02), col, null, [3]);
  }
  if (rng() < 0.5 && roofFree) {
    // a stair house or lift machine room on the roof
    const x = (rng() - 0.5) * Math.max(0, W - 4), z = roofZ(0.4 + rng() * 0.5);
    M.box('props', F.P(x, z, H + 1.4), F.A(1.4), F.U(1.4), F.B(1.2), sw(pick(rng, [C.concrete, C.lightgrey, C.beige])), null, [3]);
  }
  if (roofFree) {
    // a row of condensers on the roof, fans up
    const n = 2 + Math.floor(rng() * Math.min(7, W / 1.6));
    const z = roofZ(rng() * 0.6), x0 = -halfW + 0.9 + rng() * Math.max(0, W - 1.8 - n * 1.05);
    const top = [[PAT.acFront[0], PAT.acFront[1]], [PAT.acFront[2], PAT.acFront[1]], [PAT.acFront[2], PAT.acFront[3]], [PAT.acFront[0], PAT.acFront[3]]];
    for (let j = 0; j < n; j++) {
      const x = x0 + j * 1.05;
      if (x > halfW - 0.6) break;
      M.box('props', F.P(x, z, H + 0.42), F.A(0.45), F.U(0.4), F.B(0.38), sw(pick(rng, [C.ivory, C.offwhite, C.lightgrey])), { 2: top }, [3]);
    }
  }
  if (H > 24 && rng() < 0.45 && roofFree) {
    // a cooling tower: a round casing on legs with its fan housing
    const x = (rng() - 0.5) * Math.max(0, W - 5), z = roofZ(0.5 + rng() * 0.4), r = 1.0 + rng() * 0.5;
    M.cyl('props', F.P(x, z, H + 0.6), F.P(x, z, H + 2.6), r, r * 0.92, 10, sw(pick(rng, [C.paleblue, C.offwhite, C.lightgrey])), true, true);
    M.cyl('metal', F.P(x, z, H + 2.6), F.P(x, z, H + 3.0), r * 0.6, r * 0.6, 10, sw(C.midgrey), true);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.box('metal', F.P(x + sx * r * 0.6, z + sz * r * 0.6, H + 0.3), F.A(0.05), F.U(0.3), F.B(0.05), sw(C.steelDark), null, [3]);
  }
  if (rng() < 0.3 && roofFree) {
    // a satellite dish on the roof's edge
    const x = (rng() - 0.5) * (W - 1.5), z = roofZ(0.05);
    M.cyl('metal', F.P(x, z, H), F.P(x, z, H + 0.9), 0.03, 0.03, 5, sw(C.midgrey));
    const dc = F.P(x, z + 0.1, H + 1.1), ax = nrm(add(F.B(1), [0, 0.6, 0]));
    M.cyl('props', dc, add(dc, mul(ax, 0.12)), 0.08, 0.36, 8, sw(C.offwhite), true);
  }

  // ---- small things on the front: vent hoods, a wall AC on each balcony-less home floor, plants at the door
  for (let j = 0, n = Math.min(8, floors * 1.5); j < n; j++) {
    const k = 2 + Math.floor(rng() * Math.max(1, floors - 1));
    if (k > floors) continue;
    const x = -halfW + 1.2 + rng() * Math.max(0.1, W - 2.4), h = fl(k) + 2.7 + rng() * 0.3;
    if (!free(x - 0.2, x + 0.2, h - 0.2, h + 0.2)) continue;
    M.box('metal', F.P(x, 0.1, h), F.A(0.14), F.U(0.1), F.B(0.1), sw(pick(rng, [C.silver, C.lightgrey, C.offwhite])), null, [5]);
  }
  if (lot.shop) {
    const n = rng() < 0.55 ? 1 + Math.floor(rng() * 3) : 0;
    for (let j = 0; j < n; j++) {
      const x = -halfW + 0.8 + rng() * Math.max(0.1, W - 1.6), z = 0.35 + rng() * 0.15, s = 0.8 + rng() * 0.5;
      if (!free(x - 0.4, x + 0.4, 0, 1.2)) continue;
      M.cyl('props', F.P(x, z, 0), F.P(x, z, 0.38 * s), 0.16 * s, 0.2 * s, 7, sw(pick(rng, [C.brick, C.charcoal, C.concrete, C.offwhite])), true);
      M.lathe('props', F.P(x, z, 0.3 * s), [[0.05, 0], [0.26 * s, 0.12 * s], [0.3 * s, 0.4 * s], [0.18 * s, 0.7 * s], [0, 0.82 * s]], 6, sw(pick(rng, [C.leaf, C.moss, C.darkgreen])));
    }
  }

  M.flush(T, out);
  return M.tris;
}

/**
 * A coin parking (a lot with no building): the bays painted in white across it, a concrete wheel stop in each, the
 * yellow pay machine at the front, a block wall along the back, the lock plates in the bays, and a lamp on a pole.
 * lot as lotProps, plus bays: the number of bays across the lot (each 2.5 m). Returns the bays' centres in the lot's
 * own metres (x along the front, z into the lot to the bay's middle) for the cars.
 */
export function parkingProps(T, lot, rng, out) {
  const M = new Mesher();
  const W = lot.width, D = lot.depth;
  const F = frame([lot.x, lot.y, lot.z], [lot.fx, 0, lot.fz], [-lot.lx, 0, -lot.lz]);
  const n = Math.max(1, Math.floor((W - 0.6) / 2.5)), bw = 2.5, x0 = -n * bw / 2;
  const bayD = Math.min(5.6, D - 1.0), z0 = -0.6;                                   // the bays start 0.6 m in from the front
  const white = sw(C.white), y = 0.022;
  const line = (xa, za, xb, zb, t) => {
    const d = [xb - xa, zb - za], L = Math.hypot(d[0], d[1]) || 1, nx = -d[1] / L * t / 2, nz = d[0] / L * t / 2;
    M.quadN('decal', [F.P(xa + nx, za + nz, y), F.P(xb + nx, zb + nz, y), F.P(xb - nx, zb - nz, y), F.P(xa - nx, za - nz, y)], [0, 1, 0], white);
  };
  // the bays: a line between each and at both ends, and a line along their heads
  for (let i = 0; i <= n; i++) line(x0 + i * bw, z0, x0 + i * bw, z0 - bayD, 0.12);
  line(x0, z0 - bayD, x0 + n * bw, z0 - bayD, 0.12);
  const bays = [];
  for (let i = 0; i < n; i++) {
    const cx = x0 + (i + 0.5) * bw;
    bays.push([cx, z0 - bayD / 2]);
    // the wheel stop near the head of the bay, and the lock plate that rises under a parked car
    M.box('props', F.P(cx, z0 - bayD + 0.55, 0.06), F.A(0.62), F.U(0.06), F.B(0.1), sw(C.concrete), null, [3]);
    M.box('metal', F.P(cx, z0 - bayD * 0.52, 0.03), F.A(0.34), F.U(0.03), F.B(0.3), sw(C.steelDark), null, [3]);
  }
  // the block wall along the back, a little lower than a car's roof, with its concrete cap
  const back = z0 - bayD - 0.25;
  M.box('props', F.P(0, back, 0.8), F.A(W / 2 - 0.05), F.U(0.8), F.B(0.08), sw(C.lightgrey), null, [3]);
  M.box('props', F.P(0, back, 1.63), F.A(W / 2), F.U(0.03), F.B(0.11), sw(C.concrete));
  // the pay machine: a yellow cabinet on the front corner, facing the road, a lit slot and a sign on top
  const s = rng() < 0.5 ? -1 : 1, px = s * (W / 2 - 0.45);
  M.box('props', F.P(px, -0.35, 0.72), F.A(0.3), F.U(0.72), F.B(0.24), sw(C.yellow), { 4: sw(C.charcoal) }, [3]);
  M.box('props', F.P(px, -0.1, 1.05), F.A(0.2), F.U(0.14), F.B(0.02), sw(C.paleblue), null, [5]);
  M.box('props', F.P(px, -0.35, 1.6), F.A(0.34), F.U(0.12), F.B(0.26), sw(C.blue));
  // the lamp: a slim pole at the back corner with a head reaching over the bays
  const lx = -s * (W / 2 - 0.3);
  M.cyl('metal', F.P(lx, back + 0.3, 0), F.P(lx, back + 0.3, 4.6), 0.06, 0.05, 6, sw(C.steel));
  M.beam('metal', F.P(lx, back + 0.3, 4.55), F.P(lx + s * 1.3, back + 0.3, 4.55), 0.06, sw(C.steel));
  M.box('metal', F.P(lx + s * 1.3, back + 0.3, 4.5), F.A(0.26), F.U(0.06), F.B(0.16), sw(C.steelDark));
  M.flush(T, out);
  return { bays, bayD, lamp: F.P(lx + s * 1.3, back + 0.3, 4.3), sign: F.P(px, -0.35, 0), back };
}

/**
 * A building site on a lot: a white hoarding along the front with a blue band, its gate and a row of small lamps along
 * its top; the concrete frame of the building going up, its lower floors wrapped in the scaffold's sheet and the top
 * floor's columns bare; and a luffing-jib tower crane at a back corner, the jib raised steeply over the lot so all of
 * it stays over the lot (a jib swung out over the street's other buildings would run through the taller ones). lot as
 * lotProps. Returns the red lamps as [x, y, z, size] (the crane's, and the small ones along the hoarding) and flood,
 * the floodlight's place on the mast.
 */
export function siteProps(T, lot, rng, out) {
  const M = new Mesher();
  const W = lot.width, D = lot.depth;
  const F = frame([lot.x, lot.y, lot.z], [lot.fx, 0, lot.fz], [-lot.lx, 0, -lot.lz]);
  const lamps = [];
  const white = sw(C.white), off = sw(C.offwhite), blue = sw(C.bagBlue), grey = sw(C.midgrey), conc = sw(C.concrete);
  // ---- the hoarding: panels along the building line, a blue band at the foot and the top, seams, the gate
  M.box('props', F.P(0, -0.06, 1.5), F.A(W / 2), F.U(1.5), F.B(0.06), white, { 4: white }, [3]);
  M.box('props', F.P(0, 0.01, 0.2), F.A(W / 2), F.U(0.2), F.B(0.02), blue, null, [3, 5]);
  M.box('props', F.P(0, 0.01, 2.86), F.A(W / 2), F.U(0.08), F.B(0.02), blue, null, [5]);
  for (let x = -W / 2 + 1.8; x < W / 2 - 0.6; x += 1.8) M.box('props', F.P(x, 0.02, 1.55), F.A(0.025), F.U(1.2), F.B(0.02), sw(C.lightgrey), null, [5]);
  const gs = rng() < 0.5 ? -1 : 1, gx = gs * (W / 2 - 2.6);
  M.box('props', F.P(gx, 0.035, 1.35), F.A(2.05), F.U(1.3), F.B(0.03), grey, null, [5]);
  for (let x = -W / 2 + 1.5; x < W / 2 - 0.5; x += 3) lamps.push([...F.P(x, 0.06, 3.02), 0.07]);
  // ---- the frame going up: slabs every floor, columns round its edge, the scaffold's sheet over the lower floors
  const N = 3 + Math.floor(rng() * 4), x0 = -W / 2 + 1.0, x1 = W / 2 - 1.0, z0 = -1.9, z1 = -D + 1.0;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = (x1 - x0) / 2, hz = (z0 - z1) / 2;
  for (let k = 1; k < N; k++) M.box('props', F.P(cx, cz, k * 3.4 - 0.15), F.A(hx), F.U(0.15), F.B(hz), conc);
  const colsX = Math.max(1, Math.round((x1 - x0) / 4.5)), colsZ = Math.max(1, Math.round((z0 - z1) / 4.5)), top = N * 3.4 - 0.3;
  for (let i = 0; i <= colsX; i++) for (const z of [z0, z1]) M.box('props', F.P(x0 + (x1 - x0) * i / colsX, z, top / 2), F.A(0.25), F.U(top / 2), F.B(0.25), conc, null, [3]);
  for (let j = 1; j < colsZ; j++) for (const x of [x0, x1]) M.box('props', F.P(x, z0 - (z0 - z1) * j / colsZ, top / 2), F.A(0.25), F.U(top / 2), F.B(0.25), conc, null, [3]);
  // (the sheet on the scaffold, a metre out from the frame: over the front and both sides, up to the top floor)
  const hs = (N - 1) * 3.4 + 1.1, zs = z0 + 0.9, sheet = sw(C.lightgrey);
  M.box('props', F.P(cx, zs, hs / 2), F.A(hx + 0.9), F.U(hs / 2), F.B(0.03), sheet, null, [3]);
  for (const s of [-1, 1]) M.box('props', F.P(cx + s * (hx + 0.9), (zs + z1 - 0.9) / 2, hs / 2), F.A(0.03), F.U(hs / 2), F.B((zs - z1 + 0.9) / 2), sheet, null, [3]);
  for (let h = 1.8; h < hs; h += 1.8) M.box('props', F.P(cx, zs + 0.02, h), F.A(hx + 0.9), F.U(0.03), F.B(0.02), off, null, [5]);
  // the scaffold's poles and guard rail showing above the sheet round the top floor
  for (let x = x0 - 0.9; x <= x1 + 0.95; x += 1.8) M.box('metal', F.P(x, zs, hs + 0.9), F.A(0.03), F.U(0.9), F.B(0.03), sw(C.silver), null, [3]);
  M.beam('metal', F.P(x0 - 0.9, zs, hs + 1.7), F.P(x1 + 0.9, zs, hs + 1.7), 0.05, sw(C.silver));
  // ---- the crane: a lattice mast at a back corner, the slewing deck on top, the jib raised over the lot
  const cs = -gs, mx = cs * (W / 2 - 2.8), mz = -D + 2.8;
  const Hm = Math.max(top + 12, 30 + rng() * 14), mw = 0.85;
  const craneW = sw(C.white), craneR = sw(C.red);
  const leg = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [a, b] of leg) M.beam('metal', F.P(mx + a * mw, mz + b * mw, 0), F.P(mx + a * mw, mz + b * mw, Hm), 0.12, craneW);
  for (let f = 0; f < 4; f++) {
    const [a0, b0] = leg[f], [a1, b1] = leg[(f + 1) % 4];
    for (let h = 0, k = 0; h < Hm - 0.5; h += 2.4, k++) {
      const p = k % 2 ? [a0, b0] : [a1, b1], q = k % 2 ? [a1, b1] : [a0, b0];
      M.beam('metal', F.P(mx + p[0] * mw, mz + p[1] * mw, h), F.P(mx + q[0] * mw, mz + q[1] * mw, Math.min(Hm, h + 2.4)), 0.06, h > Hm - 7 ? craneR : craneW);
    }
  }
  // the jib points in over the lot: toward the middle of its front half, raised until its tip is over the lot
  let dx = cx - mx, dz = -D * 0.42 - mz;
  const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  const dir = nrm(add(F.A(dx), F.B(dz))), side = nrm(cross(dir, [0, 1, 0]));
  const mt = F.P(mx, mz, Hm), at = (base, a, s, u) => add(add(add(base, mul(dir, a)), mul(side, s)), [0, u, 0]);
  // the deck, the counterweight at its back, the cab at its front, the A-frame over it
  M.box('props', at(mt, -0.6, 0, 0.35), mul(dir, 2.3), [0, 0.35, 0], mul(side, 1.25), craneW);
  M.box('props', at(mt, -2.3, 0, 1.4), mul(dir, 0.65), [0, 0.7, 0], mul(side, 1.15), conc, null, [3]);
  M.box('props', at(mt, 0.9, 1.3, 1.35), mul(dir, 0.75), [0, 0.65, 0], mul(side, 0.55), craneW, { 0: sw(C.charcoal) }, [3]);
  const apex = at(mt, -1.0, 0, 6.2);
  for (const s of [-1, 1]) M.beam('metal', at(mt, -1.8, s * 1.0, 0.7), apex, 0.1, craneR), M.beam('metal', at(mt, 0.2, s * 1.0, 0.7), apex, 0.1, craneR);
  const reach = Math.min(dl * 0.95, 11), Lj = 26 + rng() * 7, th = Math.acos(Math.min(0.5, reach / Lj));
  const pivot = at(mt, 1.3, 0, 0.9), tip = add(add(pivot, mul(dir, Lj * Math.cos(th))), [0, Lj * Math.sin(th), 0]);
  // the jib: four chords tapering to the tip, braced along both sides
  const jd = nrm(sub(tip, pivot)), jn = nrm(cross(side, jd));
  const J = (u, a, b) => { const w = 0.55 * (1 - 0.55 * u); return add(add(add(pivot, mul(sub(tip, pivot), u)), mul(side, a * w)), mul(jn, b * w)); };
  for (const [a, b] of leg) M.beam('metal', J(0, a, b), J(1, a, b), 0.09, craneW);
  const nb = Math.round(Lj / 2);
  for (let k = 0; k < nb; k++) for (const a of [-1, 1]) M.beam('metal', J(k / nb, a, k % 2 ? 1 : -1), J((k + 1) / nb, a, k % 2 ? -1 : 1), 0.05, k >= nb - 2 ? craneR : craneW);
  // the luffing ropes from the A-frame to the tip, and the hook hanging from the tip
  for (const s of [-0.25, 0.25]) M.beam('metal', add(apex, mul(side, s)), add(tip, mul(side, s)), 0.03, sw(C.charcoal));
  const hookY = Math.max(top + 3, tip[1] - 16 - rng() * 10);
  M.beam('metal', tip, [tip[0], hookY, tip[2]], 0.03, sw(C.charcoal));
  M.box('props', [tip[0], hookY - 0.3, tip[2]], mul(dir, 0.25), [0, 0.3, 0], mul(side, 0.25), sw(C.yellow));
  // its red lamps: the jib's tip, the A-frame's top, the deck's corners
  lamps.push([...add(tip, [0, 0.35, 0]), 0.22], [...add(apex, [0, 0.3, 0]), 0.22], [...at(mt, -2.9, 1.2, 0.8), 0.16], [...at(mt, -2.9, -1.2, 0.8), 0.16]);
  M.flush(T, out);
  return { lamps, flood: F.P(mx, mz, Math.min(14, top + 2)), mast: F.P(mx, mz, 0) };
}

// ---------------------------------------------------------------- the pavement's clutter

/** A garbage bag: a lumpy body of revolution with its knot on top. */
function bag(M, P, x, z, s, h0, rng, colour) {
  const c = P(x, z, h0);
  const k = s * (0.85 + rng() * 0.3);
  M.lathe('glossy', c, [[0.0, 0.0], [0.26 * k, 0.05 * k], [0.3 * k, 0.26 * k], [0.2 * k, 0.46 * k], [0.05 * k, 0.55 * k], [0.07 * k, 0.62 * k], [0.0, 0.64 * k]], 6, sw(colour), 0.9 + rng() * 0.4, 0.8 + rng() * 0.3);
}

/** A parked bicycle (a mamachari: step-through frame, front basket), in the frame (a, b) at (x, z), turned by t. */
function bicycle(M, F, x, z, t, rng, paintIdx = null) {
  const [ax, bx] = F.turn(t);
  const base = F.P(x, z, 0);
  const Q = (u, h, w = 0) => [base[0] + ax[0] * u + bx[0] * w, base[1] + h, base[2] + ax[2] * u + bx[2] * w];
  const paint = sw(paintIdx ?? pick(rng, [C.bSilver, C.bBlack, C.bRed, C.bBlue, C.bWhite, C.bPink, C.bGreen, C.bSilver]));
  // the wheels: flat rings, drawn from both sides
  for (const u of [-0.52, 0.52]) {
    const cxz = Q(u, 0.33), n = 12;
    const g = M.g('fabric'), b0 = g.p.length / 3;
    const nn = nrm(cross(ax, [0, 1, 0]));                        // the side the ring's winding faces
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      for (const r of [0.33, 0.28]) { g.p.push(cxz[0] + ax[0] * ca * r, cxz[1] + sa * r, cxz[2] + ax[2] * ca * r); g.n.push(nn[0], nn[1], nn[2]); const uv = sw(C.rubber); g.uv.push(uv[0], uv[1]); }
    }
    for (let i = 0; i < n; i++) { const a = b0 + i * 2; g.i.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    M.tris += n * 2;
    M.box('metal', cxz, mul(ax, 0.04), [0, 0.04, 0], mul(bx, 0.05), sw(C.silver));
  }
  const tube = 0.035;
  const BB = Q(0, 0.3), seat = Q(-0.14, 0.82), head = Q(0.38, 0.86), headLo = Q(0.42, 0.66), rear = Q(-0.52, 0.33), front = Q(0.52, 0.33);
  M.beam('props', headLo, BB, tube, paint);                     // the step-through down tube
  M.beam('props', BB, seat, tube, paint);
  M.beam('props', BB, rear, tube * 0.8, paint);
  M.beam('props', seat, rear, tube * 0.7, paint);
  M.beam('props', head, front, tube * 0.8, paint);              // the fork
  M.beam('metal', head, Q(0.33, 1.02), 0.03, sw(C.silver));
  M.beam('metal', Q(0.3, 1.02, -0.28), Q(0.3, 1.02, 0.28), 0.025, sw(C.silver));           // the bars
  M.box('props', Q(-0.16, 0.88), mul(ax, 0.13), [0, 0.035, 0], mul(bx, 0.07), sw(C.black));  // the saddle
  M.box('metal', Q(0.62, 0.86), mul(ax, 0.16), [0, 0.12, 0], mul(bx, 0.17), sw(C.midgrey), null, [2]);   // the basket
  M.box('metal', Q(-0.5, 0.62), mul(ax, 0.18), [0, 0.015, 0], mul(bx, 0.1), sw(C.silver));  // the rear carrier
}

/** A traffic cone: a black base, orange with a white band. */
function cone(M, F, x, z) {
  const P = (h) => F.P(x, z, h);
  M.box('props', P(0.02), F.A(0.19), F.U(0.02), F.B(0.19), sw(C.black), null, [3]);
  M.cyl('glossy', P(0.04), P(0.3), 0.14, 0.095, 8, sw(C.orange));
  M.cyl('glossy', P(0.3), P(0.44), 0.095, 0.07, 8, sw(C.white));
  M.cyl('glossy', P(0.44), P(0.7), 0.07, 0.025, 8, sw(C.orange), true);
}

/**
 * The clutter of a stretch of pavement. seg = { x, z, y, fx, fz, lx, lz, length }: (x, y, z) its start at the
 * kerb line, running `length` metres along (fx, fz); (lx, lz) points from the road toward the buildings, and the
 * pavement is about 2.8 m deep. If the pavement climbs, give seg.y1 (the height at its end) or seg.heightAt(x, z); if
 * it bends, give seg.along(s), the kerb point and axes s metres along ({ x, z, fx, fz, lx, lz }).
 * Bollards are not built: their positions go to out.__bollards as [x, y, z]; nor are the loose things, which go to
 * out.__items as [name, x, y, z, ry, scale, stretch, colour]. seg.clear(x, z), if given, says a place is off every
 * road: at a square corner a stretch runs on straight past the turn, into the street across.
 */
export function streetProps(T, seg, rng, out) {
  const M = new Mesher();
  const L = seg.length;
  const yAt = (s) => (seg.y1 !== undefined ? seg.y + (seg.y1 - seg.y) * (s / Math.max(1e-6, L)) : seg.y);
  // every placement re-bases the frame at its own height (and, given seg.along(s), on the kerb there: the stretch
  // follows the road round a bend), so a sloping or a bending pavement keeps things on it
  const at = (s) => {
    const e = seg.along ? seg.along(s) : null;
    const f = e ? [e.fx, 0, e.fz] : [seg.fx, 0, seg.fz], l = e ? [e.lx, 0, e.lz] : [seg.lx, 0, seg.lz];
    const o = e ? [e.x, 0, e.z] : [seg.x + seg.fx * s, 0, seg.z + seg.fz * s];
    o[1] = seg.heightAt ? seg.heightAt(o[0], o[2]) : yAt(s);
    return frame([o[0] - f[0] * s, o[1], o[2] - f[2] * s], f, l);
  };
  const bollards = out.__bollards || (out.__bollards = []);
  const items = out.__items || (out.__items = []);
  const k = L / 30;
  const spot = (lo, hi) => lo + rng() * (hi - lo);
  const clear = (p, r = 0) => !seg.clear || seg.clear(p[0], p[2], r);
  // an item on the pavement: turned to run along it (local x along, z across), back against the fronts, and only
  // where it keeps clear of every road and its kerb zone (1.3 m of pavement a drift can use)
  const item = (name, F, s, z, turn = 0, sc = 1, sx = 1, colour = null, h = 0) => {
    const p = F.P(s, z, h);
    if (!clear(p, 0.35 + 1.15)) return;
    items.push([name, p[0], p[1], p[2], Math.atan2(-F.a[2], F.a[0]) + turn, sc, sx, colour]);
  };

  // drain grates along the kerb, manholes, puddles
  for (let s = spot(1, 5); s < L - 0.5; s += 5 + rng() * 4) {
    const F = at(s), g = PAT.grate;
    if (!clear(F.P(s, 0.2, 0), 0.4)) continue;
    M.quadN('decal', [F.P(s - 0.32, 0.05, 0.02), F.P(s + 0.32, 0.05, 0.02), F.P(s + 0.32, 0.37, 0.02), F.P(s - 0.32, 0.37, 0.02)], [0, 1, 0],
      [[g[0], g[1]], [g[2], g[1]], [g[2], g[3]], [g[0], g[3]]]);
  }
  for (let s = spot(3, 12); s < L - 1; s += 11 + rng() * 10) {
    const F = at(s), c = F.P(s, spot(0.9, 2.0), 0.02);
    if (!clear(c, 0.4)) continue;
    M.flat('decal', c[0], c[1], c[2], () => 0.32, 12, PAT.manhole, F.a, F.b);
  }
  for (let n = Math.round((1 + rng() * 2.5) * k), i = 0; i < n; i++) {
    const s = spot(0.5, L - 0.5), F = at(s), c = F.P(s, spot(0.25, 1.6), 0.018);
    const R = 0.35 + rng() * 0.8, p1 = rng() * 6, p2 = rng() * 6, st = 1.3 + rng() * 0.8;
    if (!clear(c, R * st)) continue;
    M.flat('puddle', c[0], c[1], c[2], (a) => R * (1 + 0.22 * Math.sin(2 * a + p1) + 0.12 * Math.sin(3 * a + p2)), 12, [0.5, 0.5], mul(F.a, st), F.b);
  }

  // bollards: a run of them at the kerb on some stretches
  if (rng() < 0.45) {
    const s0 = spot(1, Math.max(1.5, L - 8)), n = 3 + Math.floor(rng() * 5);
    for (let i = 0; i < n; i++) { const s = s0 + i * 1.6; if (s > L - 0.3) break; const F = at(s), p = F.P(s, 0.4, 0); if (clear(p, 0.3)) bollards.push(p); }
  }

  // garbage: clumps of blue and black bags, crates and cardboard against the buildings
  for (let n = Math.round((0.8 + rng() * 1.6) * k), i = 0; i < n; i++) {
    const s = spot(1, L - 1), F = at(s), wallSide = rng() < 0.7;
    const z0 = spot(1.95, 2.35);
    const bags = 2 + Math.floor(rng() * 6);
    const blue = rng() < 0.6;
    for (let j = 0; j < bags; j++) {
      const x = s + (rng() - 0.5) * 1.6, z = z0 + (rng() - 0.5) * 0.3;
      const colour = blue ? (rng() < 0.8 ? PALETTE[C.bagBlue] : PALETTE[C.bagBlack]) : (rng() < 0.7 ? PALETTE[C.bagBlack] : PALETTE[C.paleblue]);
      item('bag', F, x, z, rng() * 6.28, 0.8 + rng() * 0.45, 0.9 + rng() * 0.4, colour);
    }
    if (rng() < 0.5) {
      // beer crates, one or a stack of two
      const col = PALETTE[pick(rng, [C.yellow, C.red, C.blue, C.green])];
      const x = s + (rng() < 0.5 ? -1.3 : 1.3);
      item(rng() < 0.5 ? 'crate' : 'crates', F, x, z0, (rng() - 0.5) * 0.3, 1, 1, col);
    }
    if (rng() < 0.45) {
      // flattened cardboard leaning on the wall (part of the building's clutter), or a box
      const x = s + (rng() - 0.5) * 2;
      if (wallSide) { if (clear(F.P(x, 2.62, 0), 0.5)) M.box('props', F.P(x, 2.62, 0.45), F.A(0.4 + rng() * 0.2), F.U(0.45), F.B(0.03), sw(C.cardboard)); }
      else item('box', F, x, z0, (rng() - 0.5) * 0.6, 0.9 + rng() * 0.3);
    }
  }

  // parked bicycles, a row of them at an angle against the buildings
  const BIKES = [C.bSilver, C.bBlack, C.bRed, C.bBlue, C.bWhite, C.bPink, C.bGreen, C.bSilver];
  for (let n = Math.round((0.6 + rng() * 0.8) * k), i = 0; i < n; i++) {
    const s = spot(1.5, L - 3), bikes = 2 + Math.floor(rng() * 4), t = -(1.1 + rng() * 0.3);
    for (let j = 0; j < bikes; j++) {
      const ss = s + j * 0.6; if (ss > L - 0.5) break;
      item('bike', at(ss), ss, 1.9 + (rng() - 0.5) * 0.1, t + (rng() - 0.5) * 0.12, 1, 1, PALETTE[pick(rng, BIKES)]);
    }
  }

  // cones and A-frame boards
  for (let n = Math.round(rng() * 1.6 * k), i = 0; i < n; i++) {
    const s = spot(1, L - 1), F = at(s);
    const pair = 1 + Math.floor(rng() * 3);
    for (let j = 0; j < pair; j++) item('cone', F, s + j * 0.9, spot(1.95, 2.3), rng() * 6.28);
  }
  for (let n = Math.round((0.5 + rng()) * k), i = 0; i < n; i++) {
    const s = spot(1, L - 1);
    item('aboard', at(s), s, spot(1.9, 2.3), rng() < 0.5 ? 0 : Math.PI);
  }

  M.flush(T, out);
  return M.tris;
}

/**
 * The pavement's loose things, each built once at the origin on the ground (x along the pavement, z across it) for
 * the pools the car knocks them out of: { name: [{ geometry, material }] }, material a key into cityPropMaterials().
 * Bags, crates and bicycle frames are drawn white in the sheet, so each instance's colour tints them.
 */
export function streetItems(T = THREE) {
  const F = frame([0, 0, 0], [1, 0, 0], [0, 0, 1]);
  const P = (x, z, h) => F.P(x, z, h);
  let s = 4242;
  const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const one = (fn) => {
    const M = new Mesher(); fn(M);
    const out = {}; M.flush(T, out);
    return Object.keys(out).filter((k) => !k.startsWith('__') && out[k].length).map((k) => ({ geometry: out[k][0], material: k }));
  };
  const crate = (M, h) => M.box('glossy', P(0, 0, h), F.A(0.22), F.U(0.15), F.B(0.18), sw(C.white), { 2: sw(C.charcoal) });
  const board = (M) => {
    const tilt = 0.2;
    [PAT.chalk, PAT.menu].forEach((pat, i) => {
      const d = i ? 1 : -1, face = [[pat[0], pat[1]], [pat[2], pat[1]], [pat[2], pat[3]], [pat[0], pat[3]]];
      const c = F.P(0, d * 0.14, 0.42), up = add([0, Math.cos(tilt), 0], F.B(-d * Math.sin(tilt)));
      const outN = add(F.B(d * Math.cos(tilt)), [0, Math.sin(tilt), 0]);
      M.box('props', c, F.A(0.27), mul(up, 0.43), mul(outN, 0.015), sw(C.brown), { 4: face });
    });
  };
  return {
    bag: one((M) => bag(M, P, 0, 0, 1, 0, rng, C.white)),
    crate: one((M) => crate(M, 0.15)),
    crates: one((M) => { crate(M, 0.15); crate(M, 0.45); }),
    box: one((M) => M.box('props', P(0, 0, 0.2), F.A(0.25), F.U(0.2), F.B(0.2), sw(C.cardboard))),
    cone: one((M) => cone(M, F, 0, 0)),
    aboard: one((M) => board(M)),
    bike: one((M) => bicycle(M, F, 0, 0, 0, rng, C.white)),
  };
}

/**
 * One red and white striped bollard (0.8 m, on the ground at the origin), for the caller's knockable instances.
 * Returns { geometry, material }: material is the key into cityPropMaterials().
 */
export function bollardGeometry(T = THREE) {
  const M = new Mesher();
  const bands = [[0, 0.12, C.red], [0.12, 0.32, C.white], [0.32, 0.52, C.red], [0.52, 0.68, C.white], [0.68, 0.78, C.red]];
  for (const [h0, h1, col] of bands) M.cyl('glossy', [0, h0, 0], [0, h1, 0], 0.075, 0.075, 10, sw(col));
  M.lathe('glossy', [0, 0.78, 0], [[0.075, 0], [0.06, 0.03], [0.0, 0.045]], 10, sw(C.red));
  const out = {};
  M.flush(T, out);
  return { geometry: out.glossy[0], material: 'glossy' };
}
