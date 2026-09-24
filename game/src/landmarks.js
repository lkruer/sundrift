/**
 * NEO TOKYO landmarks, seen from far away: Tokyo Tower lit orange, and a ring of far skyscrapers.
 *
 *     const tower = tokyoTower(THREE);                  // base at y = 0, 333 m tall
 *     const ring = citySkyline(THREE, { radius: 2600, count: 180, seed: 7 });
 *     ring.position.copy(camera.position);             // the ring travels with the camera
 *     ring.userData.aviation.material.opacity = blink; // red aircraft lights
 *
 * Both are unlit MeshBasicMaterials with fog: false (the game fogs far things by hand); their materials are in
 * group.userData.materials so the game can tint or fade them. No fonts, no textures from files.
 */
import * as THREE from 'three';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Collects triangles (position, uv, optional colour) and turns them into one BufferGeometry. */
class Builder {
  constructor(colours = false) { this.p = []; this.uv = []; this.c = colours ? [] : null; }
  get tris() { return this.p.length / 9; }
  quad(a, b, c, d, uv = [[0, 0], [1, 0], [1, 1], [0, 1]], col = null) {
    // a b c d counter-clockwise seen from the front
    for (const [v, t] of [[a, uv[0]], [b, uv[1]], [c, uv[2]], [a, uv[0]], [c, uv[2]], [d, uv[3]]]) {
      this.p.push(v[0], v[1], v[2]); this.uv.push(t[0], t[1]);
      if (this.c) this.c.push(col[0], col[1], col[2]);
    }
  }
  /** A box between two points with a square section of side t (a beam); `cap` adds the end faces. */
  beam(p0, p1, t, cap = false, t1 = t) {
    const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const L = Math.hypot(d[0], d[1], d[2]) || 1;
    const f = [d[0] / L, d[1] / L, d[2] / L];
    const ref = Math.abs(f[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let u = [f[1] * ref[2] - f[2] * ref[1], f[2] * ref[0] - f[0] * ref[2], f[0] * ref[1] - f[1] * ref[0]];
    const ul = Math.hypot(u[0], u[1], u[2]); u = [u[0] / ul, u[1] / ul, u[2] / ul];
    const v = [f[1] * u[2] - f[2] * u[1], f[2] * u[0] - f[0] * u[2], f[0] * u[1] - f[1] * u[0]];
    const ring = (p, s) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [p[0] + (u[0] * a + v[0] * b) * s / 2, p[1] + (u[1] * a + v[1] * b) * s / 2, p[2] + (u[2] * a + v[2] * b) * s / 2]);
    const r0 = ring(p0, t), r1 = ring(p1, t1);
    for (let k = 0; k < 4; k++) this.quad(r0[k], r0[(k + 1) % 4], r1[(k + 1) % 4], r1[k]);
    if (cap) { this.quad(r0[3], r0[2], r0[1], r0[0]); this.quad(r1[0], r1[1], r1[2], r1[3]); }
  }
  /** A prism of n sides round the y axis from y0 to y1, radius r0 to r1; `top` closes it. */
  prism(cx, cz, y0, y1, r0, r1, n, rot = 0, top = true, uvScale = null) {
    for (let i = 0; i < n; i++) {
      const a0 = rot + (i / n) * Math.PI * 2, a1 = rot + ((i + 1) / n) * Math.PI * 2;
      const P = (a, r, y) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
      const uvq = uvScale ? [[i * uvScale[0], y0 * uvScale[1]], [(i + 1) * uvScale[0], y0 * uvScale[1]], [(i + 1) * uvScale[0], y1 * uvScale[1]], [i * uvScale[0], y1 * uvScale[1]]] : undefined;
      this.quad(P(a1, r0, y0), P(a0, r0, y0), P(a0, r1, y1), P(a1, r1, y1), uvq);
      if (top) this.tri([cx, y1, cz], P(a1, r1, y1), P(a0, r1, y1));
    }
  }
  tri(a, b, c, col = null) {
    for (const v of [a, b, c]) { this.p.push(v[0], v[1], v[2]); this.uv.push(0, 0); if (this.c) this.c.push(col[0], col[1], col[2]); }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.c) g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
}

/** Several builders' triangles as one geometry, each part in its own colour (a colour attribute): one draw. */
function mergeLit(T, parts) {
  const p = [], uv = [], c = [];
  for (const [b, hex, k] of parts) {
    const col = new T.Color(hex).multiplyScalar(k);
    for (let i = 0; i < b.p.length; i++) p.push(b.p[i]);
    for (let i = 0; i < b.uv.length; i++) uv.push(b.uv[i]);
    for (let i = 0; i < b.p.length / 3; i++) c.push(col.r, col.g, col.b);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new T.Float32BufferAttribute(c, 3));
  g.computeBoundingSphere();
  return g;
}

/** A red aircraft-light layer the game can blink through material.opacity. */
function aviationPoints(T, pts, size = 3.2) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
  g.computeBoundingSphere();
  const m = new T.PointsMaterial({ color: new T.Color(0xff2418).multiplyScalar(3.2), size, sizeAttenuation: false, transparent: true, opacity: 1, depthWrite: false, fog: false });
  const p = new T.Points(g, m);
  p.name = 'aviation lights'; p.renderOrder = 2;
  return p;
}

// ---------------------------------------------------------------- Tokyo Tower

/**
 * A lattice seen from both sides, as two meshes of one side each: the far faces, then the near ones, which is how three
 * draws a double-sided transparent material, but without flipping the material's side between its two passes (each flip
 * made three work the material's shader program out again: twice a frame for each tower).
 */
function latticeMat(T, color, alphaMap, side) {
  return new T.MeshBasicMaterial({ color, alphaMap, transparent: true, depthWrite: false, side, fog: false });
}
function latticeMeshes(T, g, geometry, mats, name) {
  // (the back faces' mesh made and added first: the same place and draw order, so it is drawn just before the front's)
  for (const [mat, n] of [[mats.latticeBack, name + ' back'], [mats.lattice, name]]) {
    const l = new T.Mesh(geometry, mat);
    l.name = n; l.castShadow = false; l.receiveShadow = false; l.renderOrder = 1; g.add(l);
  }
}

/** The lattice between the members: a square cell with an X, drawn into an alpha map. */
function latticeAlpha(T) {
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  c.fillStyle = '#000'; c.fillRect(0, 0, S, S);
  c.strokeStyle = '#fff'; c.lineCap = 'square';
  c.lineWidth = 11; c.beginPath(); c.moveTo(0, 0); c.lineTo(S, S); c.moveTo(S, 0); c.lineTo(0, S); c.stroke();
  c.lineWidth = 5; c.beginPath(); c.moveTo(0, S / 2); c.lineTo(S, S / 2); c.stroke();
  c.lineWidth = 3; c.beginPath(); c.moveTo(S / 2, 0); c.lineTo(0, S / 2); c.lineTo(S / 2, S); c.lineTo(S, S / 2); c.closePath(); c.stroke();
  c.lineWidth = 8; c.strokeRect(0, 0, S, S);
  const t = new T.CanvasTexture(cv);
  t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
  return t;
}

/**
 * Tokyo Tower at night, about 333 m: four legs curving in from an 80 m base with an arch between them, lattice
 * faces with X bracing, bands at every panel, the two-storey main deck at 145 to 160 m and the top deck at
 * 250 m with their windows lit white, and the antenna to the top. Orange and warm white, bright enough to bloom.
 * Base at y = 0, centred on x and z. Under 6000 triangles.
 */
export function tokyoTower(T = THREE) {
  const g = new T.Group(); g.name = 'tokyo tower';
  const hw = (y) => 40 * Math.exp(-y / 116);                 // half-width of the tower at height y
  const orange = new Builder(), white = new Builder(), lattice = new Builder(), windows = new Builder();
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  const C = (k, y, grow = 0) => [corners[k][0] * (hw(y) + grow), y, corners[k][1] * (hw(y) + grow)];

  // panel levels up the body: the arch panel, then bands closer together as the tower narrows
  const levels = [0, 48, 72, 94, 114, 131, 145, 160, 176, 191, 205, 218, 230, 241, 250];
  // the legs: four corner members, thick at the foot
  for (let k = 0; k < 4; k++) {
    for (let i = 0; i < levels.length - 1; i++) {
      const y0 = levels[i], y1 = levels[i + 1];
      const t0 = Math.max(1.6, 7.5 * Math.exp(-y0 / 55)), t1 = Math.max(1.6, 7.5 * Math.exp(-y1 / 55));
      orange.beam(C(k, y0), C(k, y1), t0, false, t1);
    }
  }
  // the bands: a square frame at every level above the arch; white above the main deck, as the paint is
  levels.forEach((y, i) => {
    if (i === 0 || y === 145 || y === 160 || y === 250) return;
    const b = y > 160 && i % 2 === 0 ? white : orange;
    for (let k = 0; k < 4; k++) b.beam(C(k, y), C((k + 1) % 4, y), y < 100 ? 2.4 : 1.8);
  });
  // the lattice faces (a textured alpha map), panel by panel; the lowest panel is cut by the arch
  const arch = (s) => 44 * Math.pow(Math.max(0, 1 - Math.abs(s)), 0.55);    // s = -1..1 across a face
  for (let k = 0; k < 4; k++) {
    const k2 = (k + 1) % 4;
    for (let i = 0; i < levels.length - 1; i++) {
      const y0 = levels[i], y1 = levels[i + 1];
      if (y0 === 145) continue;                                  // the main deck covers this one
      const w = 2 * hw((y0 + y1) / 2), nx = Math.max(1, Math.round(w / (y1 - y0)));
      if (i === 0) {
        // the arch panel: columns across, from the arch up to the first band
        const N = 12;
        for (let j = 0; j < N; j++) {
          const s0 = j / N, s1 = (j + 1) / N;
          const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
          const top0 = lerp(C(k, y1), C(k2, y1), s0), top1 = lerp(C(k, y1), C(k2, y1), s1);
          const ya = arch(s0 * 2 - 1), yb = arch(s1 * 2 - 1);
          const bot0 = lerp(C(k, ya), C(k2, ya), s0), bot1 = lerp(C(k, yb), C(k2, yb), s1);
          lattice.quad(bot0, bot1, top1, top0, [[s0 * 3, ya / y1], [s1 * 3, yb / y1], [s1 * 3, 1], [s0 * 3, 1]]);
          orange.beam(bot0, bot1, 2.6);                          // the arch rib
        }
        continue;
      }
      lattice.quad(C(k, y0), C(k2, y0), C(k2, y1), C(k, y1), [[0, 0], [nx, 0], [nx, 1], [0, 1]]);
    }
  }
  // the main deck: two storeys of windows between white bands, a little wider than the tower
  const deckR = 17.5;
  white.prism(0, 0, 144, 146, deckR * 0.92, deckR, 8, Math.PI / 8, false);
  windows.prism(0, 0, 146, 150.5, deckR, deckR, 8, Math.PI / 8, false);
  orange.prism(0, 0, 150.5, 152.5, deckR, deckR * 1.04, 8, Math.PI / 8, false);
  windows.prism(0, 0, 152.5, 157, deckR * 1.04, deckR * 1.04, 8, Math.PI / 8, false);
  white.prism(0, 0, 157, 160.5, deckR * 1.04, deckR * 0.7, 8, Math.PI / 8, true);
  white.prism(0, 0, 143.2, 144, deckR * 0.7, deckR * 0.92, 8, Math.PI / 8, false);
  // the top deck
  const topR = 7.2;
  white.prism(0, 0, 248.5, 250, topR * 0.8, topR, 8, Math.PI / 8, false);
  windows.prism(0, 0, 250, 254, topR, topR, 8, Math.PI / 8, false);
  white.prism(0, 0, 254, 256, topR, topR * 0.6, 8, Math.PI / 8, true);
  // the antenna: a narrow lattice mast to 292 m, then the pole in orange and white bands to the top
  const aw = (y) => 3.6 - (y - 256) * 0.055;
  const AC = (k, y) => [corners[k][0] * aw(y), y, corners[k][1] * aw(y)];
  for (let k = 0; k < 4; k++) {
    orange.beam(AC(k, 256), AC(k, 292), 1.3, false, 0.9);
    lattice.quad(AC(k, 256), AC((k + 1) % 4, 256), AC((k + 1) % 4, 292), AC(k, 292), [[0, 0], [1, 0], [1, 5], [0, 5]]);
  }
  for (const y of [268, 280, 292]) for (let k = 0; k < 4; k++) white.beam(AC(k, y), AC((k + 1) % 4, y), 1.1);
  for (let i = 0; i < 8; i++) {
    const y0 = 292 + i * 5, y1 = y0 + 5, r0 = 1.7 - i * 0.14, r1 = 1.7 - (i + 1) * 0.14;
    (i % 2 ? white : orange).prism(0, 0, y0, y1, r0, r1, 6, 0, i === 7);
  }
  orange.beam([0, 332, 0], [0, 333.5, 0], 0.5, true);

  const K = 3.0;                                              // bright enough to bloom
  // (the orange and white members and the lit windows are one mesh in their own colours: one draw, not three)
  const towerAlpha = latticeAlpha(T);
  const mats = {
    lit: new T.MeshBasicMaterial({ vertexColors: true, fog: false }),
    lattice: latticeMat(T, new T.Color(0xff8a2a).multiplyScalar(K * 0.9), towerAlpha, T.FrontSide),
    latticeBack: latticeMat(T, new T.Color(0xff8a2a).multiplyScalar(K * 0.9), towerAlpha, T.BackSide),
  };
  {
    const m = new T.Mesh(mergeLit(T, [[orange, 0xff8a2a, K], [white, 0xffe0b0, K * 0.85], [windows, 0xfff6e6, K * 1.1]]), mats.lit);
    m.name = 'tower lit'; m.castShadow = false; m.receiveShadow = false; g.add(m);
    latticeMeshes(T, g, lattice.geometry(), mats, 'tower lattice');
  }
  // the red aviation lights: the top, the antenna, the decks' corners
  const av = [0, 333.8, 0];
  for (let k = 0; k < 4; k++) {
    const [sx, sz] = corners[k];
    av.push(sx * aw(292), 292.5, sz * aw(292));
    av.push(sx * topR * 0.72, 256.4, sz * topR * 0.72);
    av.push(sx * deckR * 0.72, 161, sz * deckR * 0.72);
  }
  const aviation = aviationPoints(T, av, 3.4);
  g.add(aviation);
  g.userData.aviation = aviation;
  g.userData.materials = mats;
  g.userData.triangles = orange.tris + white.tris + lattice.tris + windows.tris;
  return g;
}

// ---------------------------------------------------------------- Tokyo Skytree

/**
 * Tokyo Skytree at night, 634 m, lit the way it is on most nights ("Iki"): a pale blue lattice with a white core.
 * The shaft starts on a triangle 68 m a side and becomes round by 300 m, narrowing to the two observation decks (the
 * Tembo Deck at 350 m, the Galleria at 450 m, their glass lit white, a band of purple under each), then the gain
 * tower, a slim mast, to the top; a lit ring every 50 m up the shaft, white lights running up its three edges.
 * Base at y = 0, centred. About 3,000 triangles.
 */
export function tokyoSkytree(T = THREE) {
  const g = new T.Group(); g.name = 'tokyo skytree';
  const lattice = new Builder(), core = new Builder(), glass = new Builder(), trim = new Builder();
  const N = 18;
  // the shaft's section at height y: a rounded triangle (y = 0) morphing into a circle (y >= 300)
  const R = (y) => y < 350 ? 39 - 22 * Math.pow(y / 350, 0.8) : 17 - 4 * Math.min(1, (y - 350) / 150);
  const tri = (y) => Math.max(0, 1 - y / 300);
  const P = (a, y, grow = 0) => {
    const r = R(y) + grow;
    // a triangle's radius at angle a (its corners at 90, 210 and 330 degrees), blended toward the circle
    const k = Math.cos(Math.PI / 3) / Math.cos(((((a - Math.PI / 2) % (2 * Math.PI / 3)) + 2 * Math.PI / 3) % (2 * Math.PI / 3)) - Math.PI / 3);
    const rr = r * (1 + (k * 1.25 - 1) * tri(y));
    return [Math.cos(a) * rr, y, Math.sin(a) * rr];
  };
  const levels = []; for (let y = 0; y <= 340; y += 20) levels.push(y);
  for (let i = 0; i < levels.length - 1; i++) {
    const y0 = levels[i], y1 = levels[i + 1];
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2;
      lattice.quad(P(a1, y0), P(a0, y0), P(a0, y1), P(a1, y1), [[0, 0], [1, 0], [1, 1], [0, 1]]);
      // the core inside the lattice, dimmer and solid
      core.quad(P(a1, y0, -6), P(a0, y0, -6), P(a0, y1, -6), P(a1, y1, -6));
    }
  }
  // the three edges lit white all the way up to the first deck, and a lit ring every 50 m
  for (const a of [Math.PI / 2, Math.PI / 2 + 2.094, Math.PI / 2 + 4.189]) {
    for (let i = 0; i < levels.length - 1; i++) trim.beam(P(a, levels[i], 0.6), P(a, levels[i + 1], 0.6), 1.6);
  }
  for (let y = 50; y < 340; y += 50) for (let k = 0; k < N; k++) {
    const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2;
    trim.beam(P(a0, y, 0.8), P(a1, y, 0.8), 1.4);
  }
  // the decks: the Tembo Deck (340 to 358 m, three storeys of glass) and the Galleria (440 to 452 m), each a
  // wider drum of glass between dark rims, with a purple band under
  const drum = (y0, y1, r, rim) => {
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2;
      const Q = (a, y, rr) => [Math.cos(a) * rr, y, Math.sin(a) * rr];
      glass.quad(Q(a1, y0, r), Q(a0, y0, r), Q(a0, y1, r), Q(a1, y1, r));
      core.quad(Q(a1, y0 - rim, r * 0.8), Q(a0, y0 - rim, r * 0.8), Q(a0, y0, r), Q(a1, y0, r));
      core.quad(Q(a1, y1, r), Q(a0, y1, r), Q(a0, y1 + rim, r * 0.85), Q(a1, y1 + rim, r * 0.85));
      trim.quad(Q(a1, y0 - rim - 3, r * 0.78), Q(a0, y0 - rim - 3, r * 0.78), Q(a0, y0 - rim, r * 0.8), Q(a1, y0 - rim, r * 0.8));
    }
  };
  drum(342, 358, 22, 4);
  // the shaft between the decks, then the Galleria
  for (let k = 0; k < N; k++) {
    const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2;
    const Q = (a, y, rr) => [Math.cos(a) * rr, y, Math.sin(a) * rr];
    lattice.quad(Q(a1, 362, 15), Q(a0, 362, 15), Q(a0, 438, 13.5), Q(a1, 438, 13.5), [[0, 0], [1, 0], [1, 4], [0, 4]]);
    core.quad(Q(a1, 362, 10), Q(a0, 362, 10), Q(a0, 438, 9), Q(a1, 438, 9));
  }
  drum(442, 452, 16, 3);
  // the gain tower: a lattice mast narrowing to the top, a white light strip up it, and the antenna
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2;
    const Q = (a, y, rr) => [Math.cos(a) * rr, y, Math.sin(a) * rr];
    lattice.quad(Q(a1, 455, 7), Q(a0, 455, 7), Q(a0, 590, 4.2), Q(a1, 590, 4.2), [[0, 0], [1, 0], [1, 8], [0, 8]]);
    core.quad(Q(a1, 455, 4), Q(a0, 455, 4), Q(a0, 610, 2.4), Q(a1, 610, 2.4));
  }
  trim.beam([0, 590, 0], [0, 634, 0], 1.8, true, 0.7);
  for (let y = 470; y < 590; y += 24) trim.prism(0, 0, y, y + 2, 6.8 - (y - 455) * 0.02, 6.8 - (y - 455) * 0.02, 8, 0, false);
  const K = 2.6;
  const treeAlpha = latticeAlpha(T);
  const mats = {
    lit: new T.MeshBasicMaterial({ vertexColors: true, fog: false }),
    lattice: latticeMat(T, new T.Color(0x7cc4ff).multiplyScalar(K), treeAlpha, T.FrontSide),
    latticeBack: latticeMat(T, new T.Color(0x7cc4ff).multiplyScalar(K), treeAlpha, T.BackSide),
  };
  {
    const m = new T.Mesh(mergeLit(T, [[core, 0x2a4a7a, 1.2], [glass, 0xf4f8ff, K * 1.1], [trim, 0xe8f4ff, K * 1.15]]), mats.lit);
    m.name = 'skytree lit'; m.castShadow = false; m.receiveShadow = false; g.add(m);
    latticeMeshes(T, g, lattice.geometry(), mats, 'skytree lattice');
  }
  const av = [0, 635, 0, 0, 598, 0];
  for (let k = 0; k < 3; k++) { const a = Math.PI / 2 + k * 2.094; av.push(Math.cos(a) * 23, 461, Math.sin(a) * 23, Math.cos(a) * 27, 362, Math.sin(a) * 27); }
  const aviation = aviationPoints(T, av, 3.2);
  g.add(aviation);
  g.userData.aviation = aviation;
  g.userData.materials = mats;
  g.userData.triangles = lattice.tris + core.tris + glass.tris + trim.tris;
  return g;
}

// ---------------------------------------------------------------- the far skyline

/**
 * One texel a window: a 256 x 256 facade sheet in four quarters, office floors (lit floor by floor), homes
 * (a warm scatter), a dark tower (sparse) and glass (lit floors with mullion lines). A face picks a quarter and
 * an offset into it; the dark body colour lives in the same sheet, so the sheet is the whole look.
 */
function skylineSheet(T, rng) {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const img = c.createImageData(S, S), d = img.data;
  const body = [20, 18, 34];
  const warm = [255, 214, 150], cool = [196, 218, 255], fluo = [226, 255, 240];
  for (let y = 0; y < S; y++) {
    const q = y < 128 ? 0 : 2, fl = y & 127;
    const floorLit = rng();
    for (let x = 0; x < S; x++) {
      const quarter = q + (x < 128 ? 0 : 1);
      let col = body, k = 0;
      const r = rng();
      if (quarter === 0) { if (floorLit < 0.42 ? r < 0.85 : r < 0.06) { col = r < 0.5 ? fluo : cool; k = 0.55 + 0.45 * rng(); } }
      else if (quarter === 1) { if (r < 0.34) { col = rng() < 0.75 ? warm : cool; k = 0.45 + 0.55 * rng(); } }
      else if (quarter === 2) { if (r < 0.12) { col = rng() < 0.5 ? warm : fluo; k = 0.5 + 0.5 * rng(); } }
      else { if (floorLit < 0.5 ? r < 0.8 : r < 0.1) { col = cool; k = 0.5 + 0.4 * rng(); } if ((x & 3) === 0) { col = body; k = 0; } }
      const i = (y * S + x) * 4;
      const v = k ? col.map((ch) => ch * k + body[0] * (1 - k) * 0.3) : body.map((ch) => ch * (0.85 + 0.3 * rng()));
      d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = 255;
      void fl;
    }
  }
  // a plain block of body colour for roofs (bottom-left corner of quarter 2 kept dark)
  for (let y = 250; y < 256; y++) for (let x = 0; x < 6; x++) { const i = (y * S + x) * 4; d[i] = body[0] * 0.8; d[i + 1] = body[1] * 0.8; d[i + 2] = body[2] * 0.8; }
  c.putImageData(img, 0, 0);
  const t = new T.CanvasTexture(cv);
  t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.ClampToEdgeWrapping;
  t.magFilter = T.LinearFilter; t.minFilter = T.LinearMipmapLinearFilter; t.anisotropy = 4;
  return t;
}

/**
 * A ring of far skyscrapers round the origin: `count` towers 60 to 260 m tall and 25 to 70 m wide at
 * radius +- 300 m, a few landmarks among them (stepped tops, spires, round towers, twin tops), a band of low
 * city in front so the towers stand on something, lit crowns and rooftop signs, and red aircraft lights on the
 * tallest roofs (group.userData.aviation, a Points object: blink it through material.opacity).
 * The buildings run from y = -80 up, so a raised camera never sees them float. Under 20k triangles.
 */
export function citySkyline(T = THREE, { radius = 2600, count = 180, seed = 7 } = {}) {
  const rng = mulberry32(seed);
  const g = new T.Group(); g.name = 'city skyline';
  const body = new Builder(true), lights = new Builder(true);
  const sheet = skylineSheet(T, mulberry32(seed * 31 + 5));
  const CELL_W = 3.2, CELL_H = 4.0, TEX = 256;
  const av = [];
  const BASE = -80;
  // facing brightness: faces toward the glow of the city centre read lighter, so each tower has form
  const shadeOf = (nx, nz) => 0.72 + 0.28 * Math.max(0, nx * 0.6 + nz * -0.8) + 0.12 * Math.max(0, -nx * 0.4 + nz * 0.5);
  const tintOf = () => { const k = 0.8 + rng() * 0.45; return [k * (0.95 + rng() * 0.1), k * (0.92 + rng() * 0.1), k * (1.0 + rng() * 0.15)]; };

  /** Four walls of a box (and its roof), UVs into the sheet so the windows keep their size. */
  const block = (cx, cz, w, dpt, rot, y0, y1, quarter, tint, withRoof = true) => {
    const ca = Math.cos(rot), sa = Math.sin(rot);
    const P = (lx, lz, y) => [cx + lx * ca - lz * sa, y, cz + lx * sa + lz * ca];
    const hw = w / 2, hd = dpt / 2;
    const qx = (quarter & 1) * 128, qy = (quarter >> 1) * 128;
    const faces = [[[-hw, hd], [hw, hd], [0, 1]], [[hw, hd], [hw, -hd], [1, 0]], [[hw, -hd], [-hw, -hd], [0, -1]], [[-hw, -hd], [-hw, hd], [-1, 0]]];
    for (const [a, b, n] of faces) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const cols = len / CELL_W, rows0 = (Math.max(y0, 0)) / CELL_H, rows1 = y1 / CELL_H;
      const ox = qx + 2 + Math.floor(rng() * Math.max(1, 124 - cols)), oy = qy + 2 + Math.floor(rng() * Math.max(1, 124 - rows1));
      const u0 = ox / TEX, u1 = (ox + cols) / TEX;
      const v0 = 1 - (oy + rows1) / TEX, v1 = 1 - (oy + rows0) / TEX;
      const wn = [n[0] * ca - n[1] * sa, n[0] * sa + n[1] * ca];
      const s = shadeOf(wn[0], wn[1]);
      const col = [tint[0] * s, tint[1] * s, tint[2] * s];
      // below ground level the wall has no windows: it uses the roof block of the sheet
      if (y0 < 0) body.quad(P(a[0], a[1], y0), P(b[0], b[1], y0), P(b[0], b[1], 0), P(a[0], a[1], 0), [[0.005, 0.005], [0.02, 0.005], [0.02, 0.02], [0.005, 0.02]], col);
      body.quad(P(a[0], a[1], Math.max(y0, 0)), P(b[0], b[1], Math.max(y0, 0)), P(b[0], b[1], y1), P(a[0], a[1], y1), [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], col);
    }
    if (withRoof) {
      const rc = [tint[0] * 0.55, tint[1] * 0.55, tint[2] * 0.6];
      body.quad(P(-hw, hd, y1), P(hw, hd, y1), P(hw, -hd, y1), P(-hw, -hd, y1), [[0.005, 0.005], [0.02, 0.005], [0.02, 0.02], [0.005, 0.02]], rc);
    }
  };
  /** A lit band round the top of a tower (a crown), in its own material. */
  const crown = (cx, cz, w, dpt, rot, y0, y1, colour) => {
    const ca = Math.cos(rot), sa = Math.sin(rot);
    const P = (lx, lz, y) => [cx + lx * ca - lz * sa, y, cz + lx * sa + lz * ca];
    const hw = w / 2, hd = dpt / 2;
    for (const [a, b] of [[[-hw, hd], [hw, hd]], [[hw, hd], [hw, -hd]], [[hw, -hd], [-hw, -hd]], [[-hw, -hd], [-hw, hd]]]) lights.quad(P(a[0], a[1], y0), P(b[0], b[1], y0), P(b[0], b[1], y1), P(a[0], a[1], y1), undefined, colour);
  };
  const LIT = [[1.6, 1.6, 1.7], [2.2, 0.35, 0.3], [0.5, 1.4, 2.2], [2.0, 0.5, 1.6], [2.0, 1.5, 0.5], [0.6, 2.0, 1.2]];

  // the towers
  const towers = [];
  for (let i = 0; i < count; i++) {
    const a = ((i + rng() * 0.8) / count) * Math.PI * 2;
    const r = radius + (rng() * 2 - 1) * 300;
    const cx = Math.sin(a) * r, cz = Math.cos(a) * r;
    const h = 60 + 200 * Math.pow(rng(), 2.1);
    const w = 25 + 45 * rng(), dpt = 25 + 45 * rng();
    const rot = -a + (rng() - 0.5) * 0.5;
    towers.push({ cx, cz, h, w, dpt, rot, r });
  }
  towers.sort((p, q) => q.h - p.h);
  towers.forEach((t, i) => {
    const { cx, cz, w, dpt, rot } = t;
    let h = t.h;
    const tint = tintOf();
    const quarter = rng() < 0.4 ? 0 : rng() < 0.55 ? 1 : rng() < 0.6 ? 2 : 3;
    const kind = i < 3 ? ['spire', 'twin', 'round'][i] : i < 10 ? ['stepped', 'spire', 'round', 'stepped', 'pyramid', 'stepped', 'twin'][i - 3] : rng() < 0.12 ? 'stepped' : 'box';
    if (kind === 'round') {
      const R = Math.min(w, dpt) / 2, n = 16;
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
        const x0 = cx + Math.cos(a0) * R, z0 = cz + Math.sin(a0) * R, x1 = cx + Math.cos(a1) * R, z1 = cz + Math.sin(a1) * R;
        const s = shadeOf(Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2));
        const col = [tint[0] * s, tint[1] * s, tint[2] * s];
        const u0 = (2 + k * (2 * Math.PI * R / n / CELL_W)) / TEX, u1 = (2 + (k + 1) * (2 * Math.PI * R / n / CELL_W)) / TEX;
        const v0 = 1 - (130 + h / CELL_H) / TEX, v1 = 1 - 130 / TEX;
        body.quad([x1, BASE, z1], [x0, BASE, z0], [x0, h - 6, z0], [x1, h - 6, z1], [[u1 * 0 + 0.005, 0.005], [0.02, 0.005], [0.02, 0.02], [0.005, 0.02]], col);
        body.quad([x1, 0, z1], [x0, 0, z0], [x0, h - 6, z0], [x1, h - 6, z1], [[u1, v1], [u0, v1], [u0, v0], [u1, v0]], col);
        lights.quad([x1, h - 6, z1], [x0, h - 6, z0], [x0, h, z0], [x1, h, z1], undefined, LIT[2]);
        body.tri([cx, h, cz], [x1, h, z1], [x0, h, z0], [tint[0] * 0.5, tint[1] * 0.5, tint[2] * 0.55]);
      }
      av.push(cx, h + 1, cz);
      return;
    }
    if (kind === 'stepped' || kind === 'spire') {
      // setbacks: three tiers, each narrower
      const h1 = h * 0.62, h2 = h * 0.84;
      block(cx, cz, w, dpt, rot, BASE, h1, quarter, tint);
      block(cx, cz, w * 0.78, dpt * 0.78, rot, h1, h2, quarter, tint);
      if (kind === 'spire') {
        block(cx, cz, w * 0.52, dpt * 0.52, rot, h2, h, quarter, tint, false);
        crown(cx, cz, w * 0.52, dpt * 0.52, rot, h - 5, h, LIT[0]);
        // the spire itself: a slim four-sided needle
        const sp = 0.35 * h, ca = Math.cos(rot), sa = Math.sin(rot), hw2 = w * 0.26, hd2 = dpt * 0.26;
        const P = (lx, lz, y) => [cx + lx * ca - lz * sa, y, cz + lx * sa + lz * ca];
        const base = [P(-hw2, hd2, h), P(hw2, hd2, h), P(hw2, -hd2, h), P(-hw2, -hd2, h)], tip = [cx, h + sp, cz];
        for (let k = 0; k < 4; k++) body.tri(base[k], base[(k + 1) % 4], tip, [tint[0] * 0.7, tint[1] * 0.7, tint[2] * 0.8]);
        av.push(cx, h + sp + 1, cz);
      } else {
        block(cx, cz, w * 0.56, dpt * 0.56, rot, h2, h, quarter, tint);
        if (rng() < 0.6) crown(cx, cz, w * 0.78, dpt * 0.78, rot, h2 - 4, h2, LIT[Math.floor(rng() * LIT.length)]);
      }
    } else if (kind === 'twin') {
      const h1 = h * 0.7;
      block(cx, cz, w, dpt, rot, BASE, h1, quarter, tint);
      const ca = Math.cos(rot), sa = Math.sin(rot);
      for (const s of [-1, 1]) {
        const ox = s * w * 0.27;
        block(cx + ox * ca, cz + ox * sa, w * 0.38, dpt * 0.8, rot, h1, h, quarter, tint);
        av.push(cx + ox * ca, h + 1, cz + ox * sa);
      }
    } else if (kind === 'pyramid') {
      block(cx, cz, w, dpt, rot, BASE, h, quarter, tint, false);
      const ca = Math.cos(rot), sa = Math.sin(rot), hw2 = w / 2, hd2 = dpt / 2;
      const P = (lx, lz, y) => [cx + lx * ca - lz * sa, y, cz + lx * sa + lz * ca];
      const base = [P(-hw2, hd2, h), P(hw2, hd2, h), P(hw2, -hd2, h), P(-hw2, -hd2, h)], tip = [cx, h + Math.min(w, dpt) * 0.6, cz];
      for (let k = 0; k < 4; k++) lights.tri(base[k], base[(k + 1) % 4], tip, k % 2 ? [1.2, 1.25, 1.4] : [0.8, 0.85, 1.0]);
      av.push(cx, tip[1] + 1, cz);
    } else {
      // a plain tower: sometimes a lit crown, sometimes a rooftop sign, often a plant room on top
      const lit = rng() < 0.22 && h > 110;
      block(cx, cz, w, dpt, rot, BASE, lit ? h - 5 : h, quarter, tint, !lit);
      if (lit) { crown(cx, cz, w, dpt, rot, h - 5, h, LIT[Math.floor(rng() * LIT.length)]); body.quad(...(() => { const ca = Math.cos(rot), sa = Math.sin(rot), P = (lx, lz) => [cx + lx * ca - lz * sa, h, cz + lx * sa + lz * ca]; return [P(-w / 2, dpt / 2), P(w / 2, dpt / 2), P(w / 2, -dpt / 2), P(-w / 2, -dpt / 2)]; })(), [[0.005, 0.005], [0.02, 0.005], [0.02, 0.02], [0.005, 0.02]], [tint[0] * 0.5, tint[1] * 0.5, tint[2] * 0.55]); }
      else if (rng() < 0.6) block(cx + (rng() - 0.5) * w * 0.3, cz + (rng() - 0.5) * dpt * 0.3, w * 0.4, dpt * 0.35, rot, h, h + 4 + rng() * 6, 2, tint);
      if (!lit && h < 150 && rng() < 0.2) {
        // a rooftop sign facing the middle of the ring
        const sw = w * (0.5 + rng() * 0.3), sh = 6 + rng() * 5, ang = Math.atan2(-cx, -cz);
        const px = Math.cos(ang), pz = -Math.sin(ang);
        const col = LIT[Math.floor(rng() * LIT.length)].map((v) => v * 1.3);
        const fx = -Math.sin(ang) * 0.5, fz = -Math.cos(ang) * 0.5;
        lights.quad([cx - px * sw / 2 - fx, h + 1, cz - pz * sw / 2 - fz], [cx + px * sw / 2 - fx, h + 1, cz + pz * sw / 2 - fz], [cx + px * sw / 2 - fx, h + 1 + sh, cz + pz * sw / 2 - fz], [cx - px * sw / 2 - fx, h + 1 + sh, cz - pz * sw / 2 - fz], undefined, col);
      }
    }
    if (h > 150 && kind !== 'spire' && kind !== 'twin' && kind !== 'pyramid') {
      const ca = Math.cos(rot), sa = Math.sin(rot);
      for (const [lx, lz] of [[-w * 0.42, dpt * 0.42], [w * 0.42, -dpt * 0.42]]) av.push(cx + lx * ca - lz * sa, h + 1, cz + lx * sa + lz * ca);
    }
  });

  // the low city in front: a jagged band of mid-rise blocks, facing the middle
  const N = 220, R0 = radius - 420;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
    const r = R0 + (rng() - 0.5) * 60;
    const h = 14 + Math.pow(rng(), 1.5) * 40;
    const p0 = [Math.sin(a0) * r, 0, Math.cos(a0) * r], p1 = [Math.sin(a1) * r, 0, Math.cos(a1) * r];
    const len = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
    const quarter = rng() < 0.6 ? 1 : 2;
    const qx = (quarter & 1) * 128, qy = (quarter >> 1) * 128;
    const ox = qx + 2 + Math.floor(rng() * (124 - len / CELL_W)), oy = qy + 2 + Math.floor(rng() * 100);
    const u0 = ox / TEX, u1 = (ox + len / CELL_W) / TEX, v1 = 1 - oy / TEX, v0 = 1 - (oy + h / CELL_H) / TEX;
    const k = 0.75 + rng() * 0.3, col = [k * 0.95, k * 0.9, k * 1.05];
    // wound to face the centre
    body.quad([p1[0], BASE, p1[2]], [p0[0], BASE, p0[2]], [p0[0], 0, p0[2]], [p1[0], 0, p1[2]], [[0.005, 0.005], [0.02, 0.005], [0.02, 0.02], [0.005, 0.02]], col);
    body.quad([p1[0], 0, p1[2]], [p0[0], 0, p0[2]], [p0[0], h, p0[2]], [p1[0], h, p1[2]], [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], col);
  }

  const mats = {
    body: new T.MeshBasicMaterial({ map: sheet, vertexColors: true, fog: false }),
    lights: new T.MeshBasicMaterial({ vertexColors: true, fog: false }),
  };
  // the sheet is drawn for the night: by day it left the far towers dark with their windows lit. uDay (0 night .. 1
  // day) turns them pale, their windows darker glass, half into the haze (uHaze, the fog's colour), as a far city is
  const uDay = { value: 0 }, uHaze = { value: new T.Color(0.62, 0.66, 0.74) };
  mats.body.onBeforeCompile = (sh) => {
    sh.uniforms.uDay = uDay; sh.uniforms.uHaze = uHaze;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uDay;\nuniform vec3 uHaze;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      if (uDay > 0.001) {
        vec3 sk = texture2D(map, vMapUv).rgb;
        float lit = smoothstep(0.03, 0.15, max(sk.r, max(sk.g, sk.b)));
        vec3 dayC = mix(vec3(0.58, 0.6, 0.66), vec3(0.24, 0.28, 0.35), 0.3 + 0.35 * lit) * vColor.rgb;
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(dayC, uHaze, 0.45), uDay);
      }`);
  };
  mats.body.customProgramCacheKey = () => 'city-skyline-day1';
  g.userData.day = uDay; g.userData.haze = uHaze;
  const mb = new T.Mesh(body.geometry(), mats.body); mb.name = 'skyline towers';
  const ml = new T.Mesh(lights.geometry(), mats.lights); ml.name = 'skyline lights';
  for (const m of [mb, ml]) { m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; g.add(m); }
  const aviation = aviationPoints(T, av, 2.6);
  aviation.frustumCulled = false;
  g.add(aviation);
  g.userData.aviation = aviation;
  g.userData.materials = { ...mats, aviation: aviation.material };
  g.userData.triangles = body.tris + lights.tris;
  return g;
}
