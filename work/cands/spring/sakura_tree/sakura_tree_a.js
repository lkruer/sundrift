// sakura_tree — candidate A: lofted limbs with icosahedron clusters placed along the limb ends, from a
// table. A short gnarled trunk forks at 1.8 m into five limbs that leave steep (50-57 degrees) and ease to
// just past horizontal at the tips, the longest drooping most. Each limb carries one cluster on its tip
// (the rim) and throws a riser up from 40 % of its length that carries one broad cluster of the flat top;
// a short leader carries a sixth over the middle. Every member is one hand-built loft (rings swept along
// the curve with parallel-transported frames). The eleven clusters are icosahedra (detail 1), each turned
// to a hash orientation, given two or three low bulges and a per-vertex hash lump, squashed and flattened
// underneath. All blossom is ONE merged geometry; faces buried inside a neighbouring cluster are dropped,
// and so are buried bark faces. 8.4 x 6.9 x 8.7 m, 1,245 triangles.
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
  // rings [[x, y, z, r], ...] along a member, N sides. Frames are parallel-transported so a curved limb
  // stays round; ring point = c + u cos + v sin with v = t x u, so the quads wind outward.
  const bp = [], bi = [];
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
        const th = (i / N) * 2 * Math.PI, rr = r * (1 + gnarl * (hash(seed * 7919 + k * 131 + i) - 0.5) * 2);
        const cs = Math.cos(th) * rr, sn = Math.sin(th) * rr;
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
  // a member leaving p0 at azimuth az (degrees, x = cos, z = sin), its elevation easing e0 -> e1
  const member = (p0, az, e0, e1, len, r0, r1, segs, seed) => {
    const rings = [[p0[0], p0[1], p0[2], r0]];
    let x = p0[0], y = p0[1], z = p0[2];
    for (let s = 1; s <= segs; s++) {
      const t = (s - 0.5) / segs, e = (e0 + (e1 - e0) * t) * D, a = (az + 16 * (hash(seed * 31 + s) - 0.5)) * D, st = len / segs;
      x += Math.cos(e) * Math.cos(a) * st; y += Math.sin(e) * st; z += Math.cos(e) * Math.sin(a) * st;
      rings.push([x, y, z, r0 + (r1 - r0) * (s / segs)]);
    }
    return rings;
  };
  const at = (rings, t) => {
    const f = t * (rings.length - 1), k = Math.min(rings.length - 2, Math.floor(f)), u = f - k, a = rings[k], b = rings[k + 1];
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u];
  };

  // trunk: 0.80 m root flare, 0.56 m waist, a knuckle below the fork, leaning a little to +x
  loft([[0, 0, 0, 0.40], [0.03, 0.3, 0, 0.3], [0.08, 1.0, 0.02, 0.28], [0.13, 1.58, 0.0, 0.31], [0.14, 1.9, 0.02, 0.25]], 7, 1, 0.1, true);

  // five limbs from the fork; the first ring of each is buried in the trunk
  const LIMBS = [ // az, e0, e1, len, r0, riser swing (degrees)
    [8, 55, -6, 3.5, 0.16, 12],
    [80, 52, -9, 3.4, 0.15, -10],
    [152, 57, -3, 3.35, 0.16, 14],
    [226, 50, -12, 3.75, 0.17, -12],
    [298, 54, -5, 3.45, 0.15, 10],
  ];
  const limbs = [], risers = [];
  LIMBS.forEach(([az, e0, e1, len, r0, swing], i) => {
    const p0 = [0.14 + 0.1 * Math.cos(az * D), 1.7, 0.02 + 0.1 * Math.sin(az * D)];
    const rings = member(p0, az, e0, e1, len, r0, 0.07, 3, i + 11);
    loft(rings, 6, i + 21, 0.08, true);
    limbs.push({ rings, az });
    // a riser leaves the limb 40 % of the way out and climbs into the flat top
    const rs = member(at(rings, 0.4), az + swing, 70, 55, 2.9, 0.09, 0.06, 2, i + 41);
    loft(rs, 5, i + 31, 0.06, true);
    risers.push(rs[rs.length - 1]);
  });
  // a short leader up the middle for the centre of the top
  loft([[0.14, 1.75, 0.02, 0.13], [0.2, 3.5, -0.04, 0.1], [0.16, 5.3, 0.04, 0.07]], 5, 81, 0.06, true);

  // ---------------------------------------------------------------- blossom
  // unique vertices and faces of an icosahedron, detail 1: 42 vertices, 80 outward faces
  const ico = (() => {
    const geo = new THREE.IcosahedronGeometry(1, 1), p = geo.attributes.position, V = [], F = [], ids = new Map();
    for (let i = 0; i < p.count; i++) {
      const key = Math.round(p.getX(i) * 1000) + ',' + Math.round(p.getY(i) * 1000) + ',' + Math.round(p.getZ(i) * 1000);
      let id = ids.get(key);
      if (id === undefined) { id = V.length; ids.set(key, id); V.push([p.getX(i), p.getY(i), p.getZ(i)]); }
      F.push(id);
    }
    geo.dispose();
    return { V, F };
  })();
  const blobs = [];
  // one cluster: the icosahedron turned to a hash orientation, two or three broad bulges (biased up and
  // out) so the outline is a lumpy potato rather than an egg, a per-vertex hash lump, squashed, and the
  // underside flattened like a cumulus
  const blob = (x, y, z, rx, ry, seed, amount = 0.1, flat = 0.72) => {
    const a = hash(seed * 3 + 1) * 6.283, b = (hash(seed * 3 + 2) - 0.5) * 1.4, cr = (hash(seed * 3 + 3) - 0.5) * 1.4;
    const rz = rx * (0.88 + 0.24 * hash(seed * 17 + 3));
    const out = Math.atan2(z, x), L = [];
    for (let k = 0; k < 2 + (hash(seed * 5 + 1) > 0.5 ? 1 : 0); k++) {
      const th = out + (hash(seed * 29 + k * 7 + 1) - 0.5) * 3.4, ly = 0.1 + 0.75 * hash(seed * 29 + k * 7 + 2), lr = Math.sqrt(1 - ly * ly);
      L.push([lr * Math.cos(th), ly, lr * Math.sin(th), 0.16 + 0.12 * hash(seed * 29 + k * 7 + 3)]);
    }
    const W = ico.V.map(([vx, vy, vz], k) => {
      let px = vx * Math.cos(cr) - vy * Math.sin(cr), py = vx * Math.sin(cr) + vy * Math.cos(cr), pz = vz;
      [py, pz] = [py * Math.cos(b) - pz * Math.sin(b), py * Math.sin(b) + pz * Math.cos(b)];
      [px, pz] = [px * Math.cos(a) + pz * Math.sin(a), -px * Math.sin(a) + pz * Math.cos(a)];
      let f = 0.93 + (hash(seed * 977 + k * 131) - 0.5) * 2 * amount;
      for (const [lx, ly, lz, la] of L) { const d = px * lx + py * ly + pz * lz; if (d > 0) f += la * d * d * d; }
      let oy = py * f * ry; if (oy < 0) oy *= flat;
      return [x + px * f * rx, y + oy, z + pz * f * rz];
    });
    blobs.push({ c: [x, y, z], W, R: 1.01 * Math.max(...W.map((w) => Math.hypot(w[0] - x, w[1] - y, w[2] - z))) });
  };
  // is a point inside a cluster: find the face whose cone from the centre holds it, compare with its plane
  const inside = (b, px, py, pz, m) => {
    const cx = b.c[0], cy = b.c[1], cz = b.c[2], dx = px - cx, dy = py - cy, dz = pz - cz;
    if (dx * dx + dy * dy + dz * dz > b.R * b.R) return false;
    const F = ico.F, W = b.W;
    for (let f = 0; f < F.length; f += 3) {
      const A = W[F[f]], B = W[F[f + 1]], C = W[F[f + 2]];
      const ax = A[0] - cx, ay = A[1] - cy, az = A[2] - cz, bx = B[0] - cx, by = B[1] - cy, bz = B[2] - cz;
      const qx = C[0] - cx, qy = C[1] - cy, qz = C[2] - cz;
      if ((ay * bz - az * by) * dx + (az * bx - ax * bz) * dy + (ax * by - ay * bx) * dz < -1e-9) continue;
      if ((by * qz - bz * qy) * dx + (bz * qx - bx * qz) * dy + (bx * qy - by * qx) * dz < -1e-9) continue;
      if ((qy * az - qz * ay) * dx + (qz * ax - qx * az) * dy + (qx * ay - qy * ax) * dz < -1e-9) continue;
      const e1x = bx - ax, e1y = by - ay, e1z = bz - az, e2x = qx - ax, e2y = qy - ay, e2z = qz - az;
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      return ((nx * ax + ny * ay + nz * az) / (nx * dx + ny * dy + nz * dz)) * m > 1;
    }
    return false;
  };

  // the rim: one cluster on each limb tip, sitting on the wood so the dark limb runs along its underside
  limbs.forEach(({ rings, az }, i) => {
    const t = rings[rings.length - 1], ox = Math.cos(az * D), oz = Math.sin(az * D);
    blob(t[0] + 0.12 * ox, t[1] + 0.5, t[2] + 0.12 * oz, 1.2 + 0.12 * hash(i + 5), 0.88, i + 1);
  });
  // the flat top: a broad cluster on every riser tip and one on the leader, overlapping into one cloud
  risers.forEach((p, i) => blob(p[0], p[1] + 0.5, p[2], 1.42 + 0.1 * hash(i + 51), 1.0, i + 51, 0.09, 0.78));
  blob(0.16, 5.85, 0.04, 1.45, 0.95, 71, 0.09, 0.8);

  const fp = [];
  blobs.forEach((b, i) => {
    const near = blobs.filter((o, j) => j !== i && Math.hypot(o.c[0] - b.c[0], o.c[1] - b.c[1], o.c[2] - b.c[2]) < o.R + b.R);
    for (let f = 0; f < ico.F.length; f += 3) {
      const A = b.W[ico.F[f]], B = b.W[ico.F[f + 1]], C = b.W[ico.F[f + 2]];
      const gx = (A[0] + B[0] + C[0]) / 3, gy = (A[1] + B[1] + C[1]) / 3, gz = (A[2] + B[2] + C[2]) / 3;
      if (near.some((o) => inside(o, A[0], A[1], A[2], 0.97) && inside(o, B[0], B[1], B[2], 0.97) &&
                           inside(o, C[0], C[1], C[2], 0.97) && inside(o, gx, gy, gz, 0.97))) continue;
      fp.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]);
    }
  });
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  fg.computeVertexNormals();
  g.add(new THREE.Mesh(fg, foliage));

  // bark faces buried in a cluster are dropped too
  const keep = [];
  for (let f = 0; f < bi.length; f += 3) {
    const P = [bi[f], bi[f + 1], bi[f + 2]].map((k) => [bp[k * 3], bp[k * 3 + 1], bp[k * 3 + 2]]);
    const gx = (P[0][0] + P[1][0] + P[2][0]) / 3, gy = (P[0][1] + P[1][1] + P[2][1]) / 3, gz = (P[0][2] + P[1][2] + P[2][2]) / 3;
    if (blobs.some((o) => P.every((p) => inside(o, p[0], p[1], p[2], 0.97)) && inside(o, gx, gy, gz, 0.97))) continue;
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
