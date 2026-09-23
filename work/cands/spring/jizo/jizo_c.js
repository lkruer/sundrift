// jizo_c — hand-built, a different breakdown: the figure is ONE carved stone mass, the way weathered roadside
// Jizo are, lofted as an indexed BufferGeometry from superellipse cross-sections between the hem (0.132 m)
// and the crown. Hands, forearms, sleeves, ears and nose are not parts but relief: lobes pushed out of the
// sections (the joined palms a narrow blade on the chest front, the forearms a band round the front half,
// the elbows bulges at the sides, the ear lobes fins on the head). The angular samples crowd the front so the
// palms stay crisp. The bib is a hand-built slab (outer face, inner face, four edges) following the chest
// WITHOUT the relief, 3-16 mm off it, with a U-shaped hem, so the palms come out through it in front. The
// knitted cap is a loft with eight rib ridges, a rolled cuff and a pompom; the neck tie is a hand-built torus
// with a knot and two tails at the back. The base is two lofted chamfered blocks with a recessed chrome-dark
// joint between them. Front faces +Z.
export default function (THREE) {
  const g = new THREE.Group();

  const stone = new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.95, metalness: 0, flatShading: true });
  stone.name = 'stone';
  const fabric = new THREE.MeshStandardMaterial({ color: 0xc9402b, roughness: 0.9, metalness: 0, flatShading: true });
  fabric.name = 'fabric';
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.6, metalness: 0, flatShading: true });

  const TAU = Math.PI * 2, D2R = Math.PI / 180;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const build = (pos, uv, idx, m) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const n = new THREE.Mesh(geo, m); g.add(n); return n;
  };
  // skin rings (each an array of Vector3, same length, ordered by angle from +Z toward +X) into a solid;
  // close the bottom and/or top with a fan
  const loft = (rings, m, closeBottom, closeTop) => {
    const N = rings[0].length, R = rings.length, pos = [], uv = [], idx = [];
    rings.forEach((ring, j) => ring.forEach((p, i) => { pos.push(p.x, p.y, p.z); uv.push(i / N, j / (R - 1)); }));
    for (let j = 0; j < R - 1; j++) for (let i = 0; i < N; i++) {
      const a = j * N + i, b = j * N + (i + 1) % N, c = (j + 1) * N + (i + 1) % N, d = (j + 1) * N + i;
      idx.push(a, b, c, a, c, d);
    }
    const fan = (j, up) => {
      const ring = rings[j], ctr = V3(0, 0, 0);
      ring.forEach((p) => ctr.add(p)); ctr.multiplyScalar(1 / N);
      const cI = pos.length / 3; pos.push(ctr.x, ctr.y, ctr.z); uv.push(0.5, up ? 1 : 0);
      for (let i = 0; i < N; i++) {
        const a = j * N + i, b = j * N + (i + 1) % N;
        if (up) idx.push(cI, a, b); else idx.push(cI, b, a);
      }
    };
    if (closeBottom) fan(0, false);
    if (closeTop) fan(R - 1, true);
    return build(pos, uv, idx, m);
  };
  // a superellipse ring: half-width a on X, half-depth b on Z, exponent p, at height y, over the given angles
  const se = (a, b, p, y, angles) => angles.map((t) => {
    const s = Math.sin(t), c = Math.cos(t), e = 2 / p;
    return V3(a * Math.sign(s) * Math.pow(Math.abs(s), e), y, b * Math.sign(c) * Math.pow(Math.abs(c), e));
  });
  const uniform = (n) => Array.from({ length: n }, (_, i) => (i / n) * TAU);
  // piecewise-linear lookup in a table of [y, ...values]
  const lerpKeys = (keys, y) => {
    if (y <= keys[0][0]) return keys[0].slice(1);
    for (let i = 1; i < keys.length; i++) {
      const A = keys[i - 1], B = keys[i];
      if (y <= B[0]) { const t = (y - A[0]) / (B[0] - A[0]); return A.slice(1).map((v, k) => v + (B[k + 1] - v) * t); }
    }
    return keys[keys.length - 1].slice(1);
  };

  // --- base: a chamfered block, a recessed dark joint, a rounded plinth
  const A12 = uniform(12).map((t) => t + Math.PI / 12);
  loft([se(0.17, 0.15, 6, 0, A12), se(0.17, 0.15, 6, 0.058, A12), se(0.16, 0.14, 6, 0.07, A12)], stone, true, true);
  loft([se(0.146, 0.126, 6, 0.066, A12), se(0.146, 0.126, 6, 0.099, A12)], dark, false, false);
  loft([se(0.14, 0.12, 4, 0.095, A12), se(0.153, 0.133, 4, 0.106, A12), se(0.153, 0.133, 4, 0.122, A12),
    se(0.136, 0.117, 4, 0.134, A12)], stone, true, true);
  const nBase = g.children.length;                            // everything after this stands on the base

  // --- the figure. Angles crowd the front (0) where the palms and nose are; 90 and 270 carry the ears.
  const DEG = [0, 11, 26, 46, 68, 90, 118, 149, 180, 211, 242, 270, 292, 314, 334, 349];
  const ANG = DEG.map((d) => d * D2R);
  // body section keys: y, half-width, half-depth, exponent
  const BODY = [[0.132, 0.112, 0.088, 2.6], [0.22, 0.12, 0.093, 2.6], [0.3, 0.128, 0.097, 2.5], [0.36, 0.134, 0.1, 2.4],
    [0.41, 0.134, 0.1, 2.3], [0.435, 0.126, 0.096, 2.2], [0.452, 0.108, 0.086, 2.1], [0.466, 0.08, 0.07, 2.0],
    [0.476, 0.061, 0.058, 2.0], [0.49, 0.057, 0.057, 2.0]];
  const HY = 0.575, HR = 0.1;
  const sectAt = (y) => {
    if (y <= 0.49) return lerpKeys(BODY, y);
    const r = Math.sqrt(Math.max(0, HR * HR - (y - HY) ** 2));
    return [Math.max(r, 0.057 * (y < 0.5 ? 1 : 0)), Math.max(r, 0.057 * (y < 0.5 ? 1 : 0)), 2.0];
  };
  // relief keys: y, amount
  const HANDS = [[0.285, 0], [0.3, 0.04], [0.33, 0.072], [0.37, 0.078], [0.4, 0.062], [0.425, 0.032], [0.442, 0]];
  const ARMS = [[0.285, 0], [0.3, 0.016], [0.318, 0.024], [0.34, 0.012], [0.355, 0]];
  const ELBOW = [[0.28, 0], [0.3, 0.014], [0.33, 0.022], [0.37, 0.013], [0.4, 0.005], [0.42, 0]];
  const EARS = [[0.505, 0], [0.52, 0.026], [0.56, 0.034], [0.595, 0.022], [0.612, 0]];
  const NOSE = [[0.543, 0], [0.555, 0.013], [0.571, 0.01], [0.58, 0]];
  const amt = (keys, y) => (y <= keys[0][0] || y >= keys[keys.length - 1][0] ? 0 : lerpKeys(keys, y)[0]);
  const wrap = (t) => { let d = t % TAU; if (d > Math.PI) d -= TAU; return d; };   // -PI..PI, 0 at the front
  const figRing = (y, relief) => {
    const [a, b, p] = sectAt(y);
    return se(a, b, p, y, ANG).map((P, i) => {
      if (!relief) return P;
      const t = wrap(ANG[i]), side = Math.abs(Math.abs(t) - Math.PI / 2);
      const rx = P.x, rz = P.z, rl = Math.hypot(rx, rz) || 1;
      let push = amt(ARMS, y) * Math.pow(Math.max(0, Math.cos(t)), 0.6)
        + amt(ELBOW, y) * Math.exp(-((side / 0.55) ** 2))
        + amt(EARS, y) * Math.exp(-((side / 0.22) ** 2));
      const out = V3(P.x + (rx / rl) * push, y, P.z + (rz / rl) * push);
      out.z += amt(HANDS, y) * Math.exp(-((t / 0.22) ** 2)) + amt(NOSE, y) * Math.exp(-((t / 0.2) ** 2));
      return out;
    });
  };
  const FY = [0.132, 0.21, 0.28, 0.3, 0.33, 0.355, 0.38, 0.405, 0.425, 0.442, 0.456, 0.468, 0.478, 0.49, 0.508,
    0.53, 0.555, 0.575, 0.6, 0.64, 0.672];
  loft(FY.map((y) => figRing(y, true)), stone, true, true);

  // --- bib: over +-60 degrees from the neck (0.477) to a U-shaped hem (0.345 at the centre, 0.42 at the sides),
  //     following the section WITHOUT relief; outer face 16 mm off, inner face 3 mm off, closed by four edges
  {
    const TB = 60 * D2R, YT = 0.477, NI = 7, NJ = 5;
    const pos = [], uv = [], idx = [];
    const at = (i, j, off) => {
      const t = -TB + (i / (NI - 1)) * 2 * TB, u = t / TB;
      const yb = 0.345 + 0.075 * u * u, y = YT - (j / (NJ - 1)) * (YT - yb);
      const [a, b, p] = sectAt(y);
      const P = se(a, b, p, y, [t])[0], rl = Math.hypot(P.x, P.z);
      return V3(P.x + (P.x / rl) * off, y, P.z + (P.z / rl) * off);
    };
    const grid = (off) => { const b0 = pos.length / 3; for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) { const P = at(i, j, off); pos.push(P.x, P.y, P.z); uv.push(i / (NI - 1), j / (NJ - 1)); } return b0; };
    const O = grid(0.016), I = grid(0.003);
    const id = (b0, i, j) => b0 + j * NI + i;
    for (let j = 0; j < NJ - 1; j++) for (let i = 0; i < NI - 1; i++) {
      // rows run downward and columns toward +X, so (i,j) (i,j+1) (i+1,j+1) is counter-clockwise from outside
      const a = id(O, i, j), b = id(O, i, j + 1), c = id(O, i + 1, j + 1), d = id(O, i + 1, j);
      idx.push(a, b, c, a, c, d);
      const e = id(I, i, j), f = id(I, i, j + 1), h = id(I, i + 1, j + 1), k = id(I, i + 1, j);
      idx.push(e, h, f, e, k, h);
    }
    const edge = (list) => { for (let n = 0; n < list.length - 1; n++) { const [i0, j0] = list[n], [i1, j1] = list[n + 1];
      // the loop runs clockwise seen from the front, so (outer n, outer n+1, inner n+1) faces out of the slab
      const a = id(O, i0, j0), b = id(O, i1, j1), c = id(I, i1, j1), d = id(I, i0, j0); idx.push(a, b, c, a, c, d); } };
    const loop = [];
    for (let i = 0; i < NI; i++) loop.push([i, 0]);              // top edge, toward +X
    for (let j = 1; j < NJ; j++) loop.push([NI - 1, j]);         // right edge, down
    for (let i = NI - 2; i >= 0; i--) loop.push([i, NJ - 1]);    // hem, back toward -X
    for (let j = NJ - 2; j >= 0; j--) loop.push([0, j]);         // left edge, up
    edge(loop);
    build(pos, uv, idx, fabric);
  }

  // --- neck tie: a torus (major 0.062, tube 0.015) at the base of the neck; a knot and two tails at the back
  {
    const pos = [], uv = [], idx = [], NA = 12, NB = 5, Y = 0.472;
    for (let i = 0; i <= NA; i++) for (let j = 0; j <= NB; j++) {
      const a = (i / NA) * TAU, b = (j / NB) * TAU, r = 0.062 + 0.015 * Math.cos(b);
      pos.push(r * Math.sin(a), Y + 0.015 * Math.sin(b), r * Math.cos(a) * 0.98); uv.push(i / NA, j / NB);
    }
    for (let i = 0; i < NA; i++) for (let j = 0; j < NB; j++) {
      const a = i * (NB + 1) + j, b = (i + 1) * (NB + 1) + j;
      idx.push(a, b, b + 1, a, b + 1, a + 1);
    }
    build(pos, uv, idx, fabric);
  }
  const knot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.026, 0), fabric);
  knot.position.set(0, 0.47, -0.074); knot.scale.set(1.2, 0.9, 0.8); g.add(knot);
  for (const s of [1, -1]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.014), fabric);
    tail.position.set(s * 0.025, 0.426, -0.09); tail.rotation.set(0.42, 0, s * 0.3); g.add(tail);
  }

  // --- knitted cap: ribbed cuff, ribbed dome, pompom. 12 angles; ribs are every other angle pushed out.
  {
    const A = uniform(12), rib = (k, amp) => (1 + amp * (k % 2 ? -1 : 1));
    const ring = (y, r, amp) => A.map((t, k) => V3(Math.sin(t) * r * rib(k, amp), y, Math.cos(t) * r * rib(k, amp)));
    loft([ring(0.599, 0.097, 0), ring(0.597, 0.116, 0.02), ring(0.61, 0.126, 0.03), ring(0.627, 0.124, 0.03),
      ring(0.636, 0.1, 0.03), ring(0.657, 0.088, 0.04), ring(0.675, 0.064, 0.04), ring(0.687, 0.032, 0),
      ring(0.7, 0.042, 0), ring(0.722, 0.043, 0), ring(0.742, 0.02, 0)], fabric, false, true);
  }
  // the palms relief stands 0.078 m proud of the chest: set the figure 12 mm back on its base to balance it
  g.children.forEach((o, i) => { if (i >= nBase) o.position.z -= 0.012; });

  // --- ground at y = 0 and centre on x/z by measuring vertices
  const bb = new THREE.Box3(), v = new THREE.Vector3(), m4 = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const put = (mt) => { for (let i = 0; i < p.count; i++) bb.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mt)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); put(m4.multiplyMatrices(n.matrixWorld, im)); } return; }
    put(n.matrixWorld);
  });
  const ctr = bb.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= ctr.x; o.position.y -= bb.min.y; o.position.z -= ctr.z; });
  return g;
}
