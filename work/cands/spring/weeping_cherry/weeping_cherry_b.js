// weeping_cherry (shidare-zakura) — candidate B: a fountain generator. A gnarled dark trunk climbs to 4 m
// and opens into three scaffold limbs under a rounded head of four 7-sided lathe puffs (profile bottom ->
// top). Twenty branchlets leave the head, each at its own bearing, and are grown by stepping a direction
// under gravity in fine steps, so each rises, arcs over and falls straight to its own hem height; alternate
// ones reach further, so the curtain hangs in two staggered ranks. Each branchlet is clothed in a tassel of
// blossom: a 6-sided loft resampled to six rings along the same curve, swelling after the arc and tapering
// to a blunt point at the foot, every ring lumped by a hash and turned half a side from the last so the
// facets zigzag. Hems wander between 0.78 and 1.3 m and a few tassels stop short near 2 m, so the hem is
// ragged; tassels differ in girth. The dark trunk shows under the hem and between the strands. All
// blossom is ONE geometry in ONE material (`foliage`). 6.6 x 6.6 x 6.4 m, 1,711 triangles.
export default function (THREE) {
  const g = new THREE.Group();

  // ONE blossom material: the game turns it white and recolours it per instance.
  const foliage = new THREE.MeshStandardMaterial({ color: 0xdd6f98, roughness: 0.9, metalness: 0, flatShading: true });
  foliage.name = 'foliage';
  const bark = new THREE.MeshStandardMaterial({ color: 0x3b2a27, roughness: 0.85, metalness: 0 });
  bark.name = 'timber';

  const hash = (n) => {
    let h = (n | 0) + 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const D = Math.PI / 180;

  // one loft routine for bark and blossom: rings [[x, y, z, r], ...], N sides, parallel-transported
  // frames (v = t x u, so the quads wind outward), optional pointed cap at the far end
  const loft = (P, I, rings, N, seed, gnarl, cap, capLen = 0.6) => {
    const base = P.length / 3, n = rings.length;
    let ux = 0, uy = 0, uz = 0, tx = 0, ty = 0, tz = 0;
    for (let k = 0; k < n; k++) {
      const a = rings[Math.max(0, k - 1)], b = rings[Math.min(n - 1, k + 1)];
      tx = b[0] - a[0]; ty = b[1] - a[1]; tz = b[2] - a[2];
      const tl = Math.hypot(tx, ty, tz); tx /= tl; ty /= tl; tz /= tl;
      if (k === 0) { if (Math.abs(ty) < 0.9) { ux = -tz; uy = 0; uz = tx; } else { ux = 1; uy = 0; uz = 0; } }
      const d = ux * tx + uy * ty + uz * tz; ux -= d * tx; uy -= d * ty; uz -= d * tz;
      const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
      const vx = ty * uz - tz * uy, vy = tz * ux - tx * uz, vz = tx * uy - ty * ux;
      const [cx, cy, cz, r] = rings[k];
      const twist = (k % 2) * Math.PI / N;                  // alternate rings turned half a side: zigzag facets
      for (let i = 0; i < N; i++) {
        const th = (i / N) * 2 * Math.PI + twist, q = r * (1 + gnarl * (hash(seed * 7919 + k * 131 + i) - 0.5) * 2);
        const cs = Math.cos(th) * q, sn = Math.sin(th) * q;
        P.push(cx + ux * cs + vx * sn, cy + uy * cs + vy * sn, cz + uz * cs + vz * sn);
      }
    }
    for (let k = 0; k < n - 1; k++) for (let i = 0; i < N; i++) {
      const j = (i + 1) % N, lo = base + k * N, hi = base + (k + 1) * N;
      // the upper ring sits half a side round from the lower one: split each skewed quad along its short diagonal
      if (k % 2 === 0) I.push(lo + i, lo + j, hi + i, lo + j, hi + j, hi + i);
      else I.push(lo + i, hi + j, hi + i, lo + i, lo + j, hi + j);
    }
    if (cap) {
      const [cx, cy, cz, r] = rings[n - 1], hi = base + (n - 1) * N, c = P.length / 3;
      P.push(cx + tx * r * capLen, cy + ty * r * capLen, cz + tz * r * capLen);
      for (let i = 0; i < N; i++) I.push(hi + i, hi + (i + 1) % N, c);
    }
  };
  const bp = [], bi = [], fp = [], fi = [];

  // trunk: flared foot, a slight S, narrowing into the head
  loft(bp, bi, [[0, 0, 0, 0.36], [0.03, 0.3, 0.0, 0.27], [0.12, 1.3, 0.05, 0.24], [0.16, 2.5, 0.0, 0.23], [0.1, 3.5, -0.05, 0.22], [0.05, 4.15, 0.0, 0.18]], 7, 1, 0.1, true);
  // three scaffold limbs from the trunk top up into the head (they show inside the curtain below it)
  [[40, 0.8], [160, 0.75], [280, 0.8]].forEach(([az, reach], i) => {
    const a = az * D, rings = [[0.05, 3.9, 0, 0.16], [0.05 + reach * 0.45 * Math.cos(a), 4.6, reach * 0.45 * Math.sin(a), 0.13], [0.05 + reach * Math.cos(a), 5.3, reach * Math.sin(a), 0.1]];
    loft(bp, bi, rings, 6, i + 11, 0.08, true);
  });

  // ---------------------------------------------------------------- the fountain
  const N = 20;
  for (let i = 0; i < N; i++) {
    const az = (i / N) * 360 + 14 * (hash(i + 90) - 0.5), a = az * D;
    const s0 = [0.05 + 0.6 * Math.cos(a), 5.0 + 0.1 * hash(i + 70), 0.6 * Math.sin(a)];   // each leaves the head at its own bearing
    const hem = 0.78 + 0.5 * hash(i + 50) + (hash(i + 55) > 0.8 ? 0.75 : 0);   // the ragged hem: a few stop short
    const girth = 0.8 + 0.4 * hash(i + 57);                                 // and no two are the same thickness
    const lift = 0.7 + 0.15 * hash(i + 20), reach = (i % 2 ? 0.28 : 0.322) + 0.03 * hash(i + 30);   // two staggered ranks
    let x = s0[0], y = s0[1], z = s0[2], h = Math.sqrt(1 - lift * lift), v = lift;
    const path = [[x, y, z]];
    // rise and arc over: step the direction under gravity (fine steps) until it points nearly straight down
    while (v > -0.94 && path.length < 40) {
      x += Math.cos(a) * h * reach * 0.5; z += Math.sin(a) * h * reach * 0.5; y += v * reach * 0.5;
      v -= 0.17; const l = Math.hypot(h, v); h /= l; v /= l;
      path.push([x, y, z]);
    }
    // then fall straight to the hem
    path.push([x + Math.cos(a) * 0.12, hem, z + Math.sin(a) * 0.12]);
    // resample a stretch of the polyline at fractions of its length
    const cum = [0];
    for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1], path[k][2] - path[k - 1][2]));
    const len = cum[cum.length - 1];
    const along = (f) => {
      const d = f * len; let k = 1;
      while (k < path.length - 1 && cum[k] < d) k++;
      const u = (d - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1]), p = path[k - 1], q = path[k];
      return [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, p[2] + (q[2] - p[2]) * u];
    };
    // blossom from 18 % of the way along the arc to the hem; the bare start of each branchlet lies wholly
    // inside the head, so it gets no bark of its own
    const arcEnd = cum[path.length - 2] / len, s0f = 0.18 * arcEnd;
    const FR = [s0f, s0f + 0.2 * (arcEnd - s0f), s0f + 0.55 * (arcEnd - s0f), arcEnd + 0.12 * (1 - arcEnd), arcEnd + 0.5 * (1 - arcEnd), 1];
    const SW = [0.22, 0.36, 0.45, 0.42, 0.34, 0.2];
    loft(fp, fi, FR.map((f, k) => {
      const p = along(f);
      return [p[0] + 0.06 * (hash(i * 31 + k) - 0.5), p[1], p[2] + 0.06 * (hash(i * 37 + k) - 0.5), SW[k] * girth * (0.85 + 0.3 * hash(i * 17 + k))];
    }), 6, i + 61, 0.18, true, 0.8);
  }

  // ---------------------------------------------------------------- the head: lathe puffs
  const PROF = [[0, -0.6], [0.7, -0.56], [1.0, -0.12], [0.86, 0.42], [0.5, 0.82], [0, 0.96]];
  const puff = (x, y, z, rad, hgt, seed) => {
    const sides = 7, rot = hash(seed * 11 + 3) * 6.283, base = fp.length / 3, ids = [];
    PROF.forEach(([pr, py], k) => {
      const n = pr === 0 ? 1 : sides, row = [];
      for (let i = 0; i < n; i++) {
        const j = seed * 1013 + k * 97 + i;
        const phi = rot + ((i + 0.5 * k) / sides) * 2 * Math.PI + (hash(j) - 0.5) * 0.25;
        const r = pr * rad * (1 + (hash(j + 5) - 0.5) * 0.22), yy = py * hgt + (pr === 0 ? 0 : (hash(j + 9) - 0.5) * 0.12 * hgt);
        row.push(fp.length / 3); fp.push(x + r * Math.sin(phi), y + yy, z + r * Math.cos(phi));
      }
      ids.push(row);
    });
    for (let k = 0; k < PROF.length - 1; k++) {
      const A = ids[k], B = ids[k + 1];
      for (let i = 0; i < sides; i++) {
        const i1 = (i + 1) % sides;
        if (A.length === 1) fi.push(B[i1], B[i], A[0]);
        else if (B.length === 1) fi.push(A[i], A[i1], B[0]);
        else fi.push(A[i], A[i1], B[i], B[i1], B[i], A[i1]);
      }
    }
    return base;
  };
  puff(0.08, 5.6, 0.0, 1.8, 1.0, 1);
  [[30, 1.25], [150, 1.3], [270, 1.2]].forEach(([az, r], i) => puff(0.05 + r * Math.cos(az * D), 5.15 + 0.1 * hash(i + 7), r * Math.sin(az * D), 1.3, 0.92, i + 2));

  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  fg.setIndex(fi);
  const flat = fg.toNonIndexed(); fg.dispose();
  flat.computeVertexNormals();
  g.add(new THREE.Mesh(flat, foliage));

  const wood = new THREE.BufferGeometry();
  wood.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
  wood.setIndex(bi);
  wood.computeVertexNormals();
  g.add(new THREE.Mesh(wood, bark));

  // --- the six lines: measure vertices, ground at y = 0, centre on x/z ---------
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });

  return g;
}
