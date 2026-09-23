// weeping_cherry — candidate A: arching lofted branches carrying hanging strands of stretched icosahedra.
// A gnarled trunk climbs to 4 m and opens into three scaffold limbs under a head of five lumped
// icosahedra. Thirteen branches leave the head, each at its own bearing, grown by integrating a direction
// under gravity: they rise, arc over and fall, and each fall is clothed in a strand of blossom, one
// icosahedron (detail 1) stretched over three times tall, tapered toward its foot, hash-lumped and given
// three knots down its length, hanging to a hem that wanders between 0.8 and 1.35 m, so the hem is
// scalloped. The dark 5-sided arcs show on the shoulder where the branches leave the head. All blossom is
// ONE merged geometry with faces buried in a neighbour dropped. 6.1 x 6.6 x 6.3 m, 1,847 triangles.
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

  // trunk: flared foot, a slight S, narrowing into the head
  loft([[0, 0, 0, 0.36], [0.03, 0.3, 0.0, 0.27], [0.12, 1.3, 0.05, 0.24], [0.16, 2.5, 0.0, 0.23], [0.1, 3.5, -0.05, 0.22], [0.05, 4.15, 0.0, 0.18]], 7, 1, 0.1, true);
  // three scaffold limbs rising out of the trunk top into the head
  [[40, 0.95], [160, 0.85], [280, 0.9]].forEach(([az, reach], i) => {
    const a = az * D, rings = [[0.05, 3.9, 0, 0.16], [0.05 + reach * 0.45 * Math.cos(a), 4.55, reach * 0.45 * Math.sin(a), 0.13], [0.05 + reach * Math.cos(a), 5.25, reach * Math.sin(a), 0.1]];
    loft(rings, 6, i + 11, 0.08, true);
  });

  // ---------------------------------------------------------------- blossom
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
  // a cluster; taper < 1 narrows it toward its foot (a hanging strand), flat < 1 flattens its underside,
  // knots > 0 raises that many bulges at different heights down its length, so a strand reads as a string
  // of clusters rather than one smooth spindle
  const blob = (x, y, z, rx, ry, seed, amount = 0.12, flat = 1, taper = 1, knots = 0) => {
    const a = hash(seed * 3 + 1) * 6.283, K = [];
    for (let k = 0; k < knots; k++) {
      const ky = 0.75 - 1.5 * (k + 0.5) / knots + (hash(seed * 13 + k) - 0.5) * 0.2, th = hash(seed * 19 + k) * 6.283, kr = Math.sqrt(1 - ky * ky);
      K.push([kr * Math.cos(th), ky, kr * Math.sin(th)]);
    }
    const W = ico.V.map(([vx, vy, vz], k) => {
      const px = vx * Math.cos(a) + vz * Math.sin(a), pz = -vx * Math.sin(a) + vz * Math.cos(a), py = vy;
      let f = 1 + (hash(seed * 977 + k * 131) - 0.5) * 2 * amount;
      for (const [lx, ly, lz] of K) { const d = px * lx + py * ly + pz * lz; if (d > 0.5) f += 0.5 * (d - 0.5); }
      const w = taper + (1 - taper) * (py + 1) * 0.5;        // 1 at the top, taper at the foot
      let oy = py * f * ry; if (oy < 0) oy *= flat;
      return [x + px * f * rx * w, y + oy, z + pz * f * rx * w];
    });
    blobs.push({ c: [x, y, z], W, R: 1.01 * Math.max(...W.map((q) => Math.hypot(q[0] - x, q[1] - y, q[2] - z))) });
  };
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

  // thirteen branches leave the head, each at its own bearing, grown under gravity: rise, arc over, fall
  const N = 13;
  for (let i = 0; i < N; i++) {
    const az = (i / N) * 360 + 12 * (hash(i + 90) - 0.5), a = az * D;
    let x = 0.05 + 0.7 * Math.cos(a), y = 5.15 + 0.1 * hash(i + 70), z = 0.7 * Math.sin(a), h = 0.62, v = 0.78;
    const path = [[x, y, z, 0.11]];
    for (let k = 0; k < 7 && v > -0.9; k++) {
      x += Math.cos(a) * h * 0.32; z += Math.sin(a) * h * 0.32; y += v * 0.32;
      v -= 0.36; const l = Math.hypot(h, v); h /= l; v /= l;
      path.push([x, y, z, 0.1 - 0.005 * k]);
    }
    loft(path, 5, i + 31, 0.06, true);
    // the strand hangs from where the branch turns down, to a hem between 0.8 and 1.35 m
    const top = y + 0.35, hem = 0.8 + 0.55 * hash(i + 50), ry = (top - hem) / 2, rx = 0.6 + 0.12 * hash(i + 60);
    blob(x + Math.cos(a) * 0.05, hem + ry, z + Math.sin(a) * 0.05, rx, ry, i + 1, 0.14, 1, 0.6, 3);
  }
  // the head: a crown clump and four round it, over the scaffold tips
  blob(0.1, 5.55, 0.0, 1.45, 0.95, 71, 0.1, 0.8);
  [[20, 1.35], [110, 1.3], [200, 1.4], [290, 1.3]].forEach(([az, r], i) =>
    blob(0.05 + r * Math.cos(az * D), 5.2 + 0.1 * hash(i + 80), r * Math.sin(az * D), 1.2, 0.9, i + 81, 0.12, 0.8));

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
