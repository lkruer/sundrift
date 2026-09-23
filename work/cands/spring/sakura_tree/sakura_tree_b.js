// sakura_tree — candidate B: a recursive branch generator. From a seeded stream the trunk forks at 1.8 m
// into four limbs; every limb splits into three branches (two that swing out and droop past horizontal,
// one that climbs), and every branch ends in two short spurs, each spur carrying one small blossom puff.
// Every member bends toward horizontal as it grows, which is what spreads a Somei-Yoshino into an
// umbrella; the climbing branches and a short leader carry the flat top. The puffs are small 6-sided
// lathes (36 triangles, profile bottom -> top, each ring turned half a segment, every vertex hashed), so
// the crown is many little clusters along the wood rather than a few big balls, and the dark branches
// show between them. All blossom is ONE geometry; bark buried in a puff is dropped. 9.2 x 7.0 x 9.6 m,
// 1,316 triangles.
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
  let s = 0x2b7e1516;                      // the seed of this tree
  const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rr = (a, b) => a + (b - a) * rnd();
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

  // ---------------------------------------------------------------- blossom puffs
  const fp = [], puffs = [];
  const PROF = [[0, -0.55], [0.76, -0.46], [1.0, 0.04], [0.66, 0.62], [0, 0.9]];   // bottom pole -> top pole
  const puff = (x, y, z, rad, hgt, seed) => {
    const sides = 6, rot = hash(seed * 11 + 3) * 6.283;
    const ring = PROF.map(([pr, py], k) => {
      const n = pr === 0 ? 1 : sides, pts = [];
      for (let i = 0; i < n; i++) {
        const j = seed * 1013 + k * 97 + i;
        const phi = rot + ((i + 0.5 * k) / sides) * 2 * Math.PI + (hash(j) - 0.5) * 0.3;
        const r = pr * rad * (1 + (hash(j + 5) - 0.5) * 0.24), yy = py * hgt + (pr === 0 ? 0 : (hash(j + 9) - 0.5) * 0.14 * hgt);
        pts.push([x + r * Math.sin(phi), y + yy, z + r * Math.cos(phi)]);
      }
      return pts;
    });
    const tri = (a, b, c) => fp.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let k = 0; k < PROF.length - 1; k++) {
      const A = ring[k], B = ring[k + 1];
      for (let i = 0; i < sides; i++) {
        const i1 = (i + 1) % sides;
        if (A.length === 1) tri(B[i1], B[i], A[0]);
        else if (B.length === 1) tri(A[i], A[i1], B[0]);
        else { tri(A[i], A[i1], B[i]); tri(B[i1], B[i], A[i1]); }
      }
    }
    puffs.push([x, y, z, rad, hgt]);
  };

  // ---------------------------------------------------------------- the generator
  let nSeed = 1;
  // one member that bends toward horizontal as it grows; returns its rings
  const member = (p, az, el, len, r0, r1, segs, flatten) => {
    const rings = [[p[0], p[1], p[2], r0]];
    let x = p[0], y = p[1], z = p[2];
    const eEnd = el * flatten - (flatten < 0.3 ? 10 : 0);
    for (let k = 1; k <= segs; k++) {
      const e = (el + (eEnd - el) * ((k - 0.5) / segs)) * D, a = (az + rr(-6, 6)) * D, st = len / segs;
      x += Math.cos(e) * Math.cos(a) * st; y += Math.sin(e) * st; z += Math.cos(e) * Math.sin(a) * st;
      rings.push([x, y, z, r0 + (r1 - r0) * (k / segs)]);
    }
    return rings;
  };
  // depth 0: limb -> three branches; depth 1: branch -> two spurs, each ending in a puff
  const grow = (p, az, el, len, r0, depth, climb) => {
    if (depth === 2) {
      // a spur: too short to be worth bark of its own. The puff sits over the branch end it grows from,
      // close enough that the end is always inside its underside, so nothing floats
      const a = az * D, h = climb ? 0.34 : 0.4;
      const rad = climb ? rr(1.2, 1.34) : rr(0.95, 1.08);
      puff(p[0] + Math.cos(a) * h, p[1] + (climb ? 0.36 : 0.22), p[2] + Math.sin(a) * h, rad, rad * (climb ? 0.9 : 0.8), nSeed++);
      return;
    }
    const segs = depth === 0 ? 3 : (climb ? 1 : 2), r1 = depth === 0 ? 0.105 : 0.055;
    const rings = member(p, az, el, len, r0, r1, segs, depth === 0 ? 0.55 : (climb ? 0.78 : 0.2));
    loft(rings, depth === 0 ? 6 : 4, nSeed++, 0.08, true);
    const tip = rings[rings.length - 1], endEl = el * (depth === 0 ? 0.55 : 0.3);
    if (depth === 0) {
      const sw = rr(34, 42);
      grow(tip, az - sw, rr(18, 24), rr(2.0, 2.25), r1 * 0.85, 1, false);    // out and down: the rim
      grow(tip, az + sw, rr(18, 24), rr(2.0, 2.25), r1 * 0.85, 1, false);
      grow(tip, az + rr(-10, 10), rr(70, 76), rr(2.55, 2.75), r1 * 0.8, 1, true);   // up: the crown
    } else {
      for (const sgn of [-1, 1]) grow(tip, az + sgn * rr(30, 44), climb ? endEl + 22 : endEl - 4, rr(0.5, 0.65), 0, 2, climb);
    }
  };

  // trunk: 0.8 m root flare, a waist, a knuckle below the fork
  loft([[0, 0, 0, 0.4], [0.02, 0.3, 0.01, 0.3], [0.07, 1.0, -0.02, 0.28], [0.11, 1.55, 0.01, 0.31], [0.12, 1.9, 0.0, 0.25]], 7, 1, 0.1, true);
  const FORK = [0.12, 1.72, 0.0];
  const az0 = rr(0, 90);
  for (let i = 0; i < 4; i++) {
    const az = az0 + i * 90 + rr(-12, 12);
    grow([FORK[0] + 0.1 * Math.cos(az * D), FORK[1], FORK[2] + 0.1 * Math.sin(az * D)], az, rr(54, 60), rr(1.75, 1.95), 0.16, 0, false);
  }
  // a short leader up the middle, carrying the centre of the flat top
  loft([[FORK[0], FORK[1], FORK[2], 0.12], [FORK[0] + 0.1, 3.4, FORK[2] - 0.05, 0.1], [FORK[0] + 0.05, 5.0, FORK[2] + 0.05, 0.07]], 5, nSeed++, 0.08, true);
  puff(FORK[0] + 0.05, 5.85, FORK[2] + 0.05, 1.3, 1.15, nSeed++);

  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  fg.computeVertexNormals();
  g.add(new THREE.Mesh(fg, foliage));

  // bark faces buried in a puff (inside its inner ellipsoid) are dropped
  const buried = (p) => puffs.some(([x, y, z, rad, hgt]) => {
    const dy = p[1] - y, ry = dy > 0 ? 0.72 * hgt : 0.42 * hgt;
    return ((p[0] - x) ** 2 + (p[2] - z) ** 2) / (0.8 * rad) ** 2 + (dy * dy) / (ry * ry) < 1;
  });
  const keep = [];
  for (let f = 0; f < bi.length; f += 3) {
    const P = [bi[f], bi[f + 1], bi[f + 2]].map((k) => [bp[k * 3], bp[k * 3 + 1], bp[k * 3 + 2]]);
    if (P.every(buried)) continue;
    keep.push(bi[f], bi[f + 1], bi[f + 2]);
  }
  const wood = new THREE.BufferGeometry();
  wood.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
  wood.setIndex(keep);
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
