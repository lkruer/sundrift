// sakura_tree (Somei-Yoshino) — candidate C: lathe-shell cloud layers. Every cluster is a small
// hand-built lathe with a cumulus profile run bottom -> top (low underside, widest just below the middle,
// domed top), each ring turned half a segment from the one below so the facets zigzag instead of stacking
// into pumpkin bands, every vertex nudged by a hash. They are cheap (36 triangles for a 6-sided puff, 56
// for a 7-sided one), so the crown is twenty smaller clouds in layers: a skirt of ten 6-sided puffs on
// drooping twig tips (the ragged lower edge of the umbrella), five 6-sided fillers round the waist, and
// five big 7-sided puffs at nearly one height for the flat top. A short gnarled trunk forks at 1.75 m into
// five limbs that leave at 46-52 degrees, flatten out and split into two twigs each, so the near-black
// wood runs out under and between the clouds. All blossom is ONE geometry in ONE material (`foliage`);
// bark faces buried in a puff are dropped. 9.0 x 6.9 x 8.8 m, 1,223 triangles.
export default function (THREE) {
  const g = new THREE.Group();

  // ONE blossom material: the game turns it white and recolours it per instance.
  const foliage = new THREE.MeshStandardMaterial({ color: 0xf6d3de, roughness: 0.9, metalness: 0, flatShading: true });
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

  // ---------------------------------------------------------------- bark
  const bp = [], bi = [];
  // rings [[x, y, z, r], ...], N sides, parallel-transported frames; v = t x u winds the quads outward
  const loft = (rings, N, seed, gnarl, cap) => {
    const base = bp.length / 3, n = rings.length;
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
      for (let i = 0; i < N; i++) {
        const th = (i / N) * 2 * Math.PI, q = r * (1 + gnarl * (hash(seed * 7919 + k * 131 + i) - 0.5) * 2);
        const cs = Math.cos(th) * q, sn = Math.sin(th) * q;
        bp.push(cx + ux * cs + vx * sn, cy + uy * cs + vy * sn, cz + uz * cs + vz * sn);
      }
    }
    for (let k = 0; k < n - 1; k++) for (let i = 0; i < N; i++) {
      const j = (i + 1) % N, lo = base + k * N, hi = base + (k + 1) * N;
      bi.push(lo + i, hi + j, hi + i, lo + i, lo + j, hi + j);
    }
    if (cap) {
      const [cx, cy, cz, r] = rings[n - 1], hi = base + (n - 1) * N, c = bp.length / 3;
      bp.push(cx + tx * r * 0.6, cy + ty * r * 0.6, cz + tz * r * 0.6);
      for (let i = 0; i < N; i++) bi.push(hi + i, hi + (i + 1) % N, c);
    }
  };
  const member = (p0, az, e0, e1, len, r0, r1, segs, seed) => {
    const rings = [[p0[0], p0[1], p0[2], r0]];
    let x = p0[0], y = p0[1], z = p0[2];
    for (let s = 1; s <= segs; s++) {
      const t = (s - 0.5) / segs, e = (e0 + (e1 - e0) * t) * D, a = (az + 14 * (hash(seed * 31 + s) - 0.5)) * D, st = len / segs;
      x += Math.cos(e) * Math.cos(a) * st; y += Math.sin(e) * st; z += Math.cos(e) * Math.sin(a) * st;
      rings.push([x, y, z, r0 + (r1 - r0) * (s / segs)]);
    }
    return rings;
  };

  // trunk: root flare, waist, a knuckle below the fork
  loft([[0, 0, 0, 0.4], [0.03, 0.3, 0.0, 0.3], [0.06, 1.0, 0.03, 0.28], [0.1, 1.5, 0.0, 0.31], [0.12, 1.85, 0.02, 0.25]], 7, 1, 0.1, true);
  // five limbs; each flattens out and splits into two drooping twigs, 34-54 degrees either side
  const LIMBS = [[18, 50, 10, 2.45, 0.16], [92, 46, 6, 2.55, 0.15], [160, 52, 12, 2.35, 0.16], [232, 47, 4, 2.6, 0.17], [304, 49, 9, 2.45, 0.15]];
  const twigTips = [];
  LIMBS.forEach(([az, e0, e1, len, r0], i) => {
    const p0 = [0.12 + 0.1 * Math.cos(az * D), 1.65, 0.02 + 0.1 * Math.sin(az * D)];
    const rings = member(p0, az, e0, e1, len, r0, 0.1, 3, i + 11);
    loft(rings, 6, i + 21, 0.08, true);
    const end = rings[rings.length - 1];
    [-1, 1].forEach((sgn, k) => {
      const sw = sgn * (34 + 20 * hash(i * 7 + k));   // wide enough that the ten tips ring the crown, unevenly
      const droop = -2 - 20 * hash(i * 3 + k + 70);   // some tips hang lower than others: a ragged hem
      const tw = member(end, az + sw, droop, droop, 1.25 + 0.55 * hash(i * 5 + k), 0.09, 0.05, 1, i * 2 + k + 41);
      loft(tw, 5, i * 2 + k + 51, 0.06, true);
      twigTips.push(tw[tw.length - 1]);
    });
  });

  // ---------------------------------------------------------------- blossom: lathe puffs
  const fp = [], puffs = [];
  // profiles (radius, height) from the bottom pole to the top pole, for a unit puff
  const BIG = [[0, -0.6], [0.7, -0.56], [1.0, -0.12], [0.86, 0.42], [0.5, 0.82], [0, 0.96]];   // 7 sides: 56 tris
  const SMALL = [[0, -0.7], [0.64, -0.56], [1.0, -0.04], [0.66, 0.6], [0, 0.9]];               // 6 sides: 36 tris, a rounder underside
  const puff = (x, y, z, rad, hgt, sides, prof, seed) => {
    const tilt = (hash(seed * 11 + 1) - 0.5) * 0.3, tdir = hash(seed * 11 + 2) * 6.283, rot = hash(seed * 11 + 3) * 6.283;
    const ct = Math.cos(tilt), st = Math.sin(tilt), cd = Math.cos(tdir), sd = Math.sin(tdir);
    const ring = prof.map(([pr, py], k) => {
      const n = pr === 0 ? 1 : sides, pts = [];
      for (let i = 0; i < n; i++) {
        const j = seed * 1013 + k * 97 + i;
        const phi = rot + ((i + 0.5 * k) / sides) * 2 * Math.PI + (hash(j) - 0.5) * 0.25;
        const r = pr * rad * (1 + (hash(j + 5) - 0.5) * 0.22), yy = py * hgt + (pr === 0 ? 0 : (hash(j + 9) - 0.5) * 0.12 * hgt);
        let px = r * Math.sin(phi), pz = r * Math.cos(phi);
        const ax = cd * px + sd * pz, nx = ax * ct - yy * st, ny = ax * st + yy * ct;   // tilt about a hashed horizontal axis
        px += (nx - ax) * cd; pz += (nx - ax) * sd;
        pts.push([x + px, y + ny, z + pz]);
      }
      return pts;
    });
    const tri = (a, b, c) => fp.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let k = 0; k < prof.length - 1; k++) {
      const A = ring[k], B = ring[k + 1];
      for (let i = 0; i < sides; i++) {
        const i1 = (i + 1) % sides;
        if (A.length === 1) tri(B[i1], B[i], A[0]);              // bottom fan
        else if (B.length === 1) tri(A[i], A[i1], B[0]);         // top fan
        else { tri(A[i], A[i1], B[i]); tri(B[i1], B[i], A[i1]); }
      }
    }
    puffs.push([x, y, z, rad, hgt]);
  };

  // lower layer: a skirt of puffs on the twig tips, sitting on the wood
  twigTips.forEach((p, i) => puff(p[0], p[1] + 0.32, p[2], 1.0 + 0.2 * hash(i + 3), 0.74, 6, SMALL, i + 1));
  // the waist: five fillers, one between each pair of limbs, bridging the skirt and the top
  [[55, 2.95, 4.55, 1.25], [126, 3.0, 4.65, 1.2], [196, 2.9, 4.5, 1.3], [268, 3.05, 4.6, 1.2], [341, 2.95, 4.55, 1.25]].forEach(([az, rr, y, rad], i) =>
    puff(0.12 + rr * Math.cos(az * D), y, rr * Math.sin(az * D), rad, 0.88, 6, SMALL, i + 21));
  // upper layer: four round a centre at nearly one height, for the flat top
  [[20, 2.4], [110, 2.5], [200, 2.35], [290, 2.45]].forEach(([az, rr], i) =>
    puff(0.12 + rr * Math.cos(az * D), 5.35 + 0.15 * hash(i + 40), rr * Math.sin(az * D), 1.45 + 0.12 * hash(i + 44), 1.05, 7, BIG, i + 31));
  puff(0.2, 5.75, 0.05, 1.55, 1.15, 7, BIG, 51);

  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  fg.computeVertexNormals();
  g.add(new THREE.Mesh(fg, foliage));

  // bark faces buried in a puff (inside its inner ellipsoid) are dropped
  const buried = (p) => puffs.some(([x, y, z, rad, hgt]) => {
    const dy = p[1] - y, ry = dy > 0 ? 0.75 * hgt : 0.45 * hgt;
    return ((p[0] - x) ** 2 + (p[2] - z) ** 2) / (0.82 * rad) ** 2 + (dy * dy) / (ry * ry) < 1;
  });
  // keep the rest, renumbered so no orphan vertex is left in the buffer
  const kp = [], ki = [], remap = new Map();
  const use = (k) => { if (!remap.has(k)) { remap.set(k, kp.length / 3); kp.push(bp[k * 3], bp[k * 3 + 1], bp[k * 3 + 2]); } return remap.get(k); };
  for (let f = 0; f < bi.length; f += 3) {
    const P = [bi[f], bi[f + 1], bi[f + 2]].map((k) => [bp[k * 3], bp[k * 3 + 1], bp[k * 3 + 2]]);
    if (P.every(buried)) continue;
    ki.push(use(bi[f]), use(bi[f + 1]), use(bi[f + 2]));
  }
  const wood = new THREE.BufferGeometry();
  wood.setAttribute('position', new THREE.Float32BufferAttribute(kp, 3));
  wood.setIndex(ki);
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
