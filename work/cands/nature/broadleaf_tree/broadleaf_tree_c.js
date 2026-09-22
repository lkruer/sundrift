// broadleaf_tree — candidate C: a different breakdown and a more open reading.
// Trunk and all five limbs are ONE hand-built BufferGeometry loft (rings of seven
// swept along each member in loops, each limb's first ring buried in the trunk).
// The canopy is six icosahedra (detail 1) with every vertex pushed in or out by a
// hash, one per limb end plus one hanging low, with wide gaps so this reads as a
// zelkova rather than the maple's closed dome. 5.2 m wide, 2.4..6.0 m high.
export default function (THREE) {
  const g = new THREE.Group();

  // ONE foliage material for every blob: the game retints it per instance.
  const foliage = new THREE.MeshStandardMaterial({ color: 0xe8b52a, roughness: 0.9, metalness: 0, flatShading: true });
  foliage.name = 'foliage';
  const bark = new THREE.MeshStandardMaterial({ color: 0x5a3f2c, roughness: 0.85, metalness: 0 });
  bark.name = 'timber';

  // ---- loft: rings of N points around `axis`, quad strips between them, capped at the far end
  const pos = [], idx = [];
  const A = new THREE.Vector3(), B = new THREE.Vector3(), P = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
  const loft = (rings, axis, N) => {
    const base = pos.length / 3;
    A.crossVectors(axis, Math.abs(axis.y) < 0.99 ? Y : X).normalize();
    B.crossVectors(axis, A).normalize();                       // A x B = axis, so winding faces out
    for (const { c, r } of rings) for (let i = 0; i < N; i++) {
      const th = (i / N) * 2 * Math.PI;
      P.copy(c).addScaledVector(A, Math.cos(th) * r).addScaledVector(B, Math.sin(th) * r);
      pos.push(P.x, P.y, P.z);
    }
    for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < N; i++) {
      const j = (i + 1) % N, lo = base + k * N, hi = base + (k + 1) * N;
      idx.push(lo + i, hi + j, hi + i, lo + i, lo + j, hi + j);
    }
    const last = rings[rings.length - 1], hi = base + (rings.length - 1) * N, cap = pos.length / 3;
    pos.push(last.c.x, last.c.y, last.c.z);
    for (let i = 0; i < N; i++) idx.push(hi + i, hi + (i + 1) % N, cap);
  };
  const ring = (x, y, z, r) => ({ c: new THREE.Vector3(x, y, z), r });

  // trunk: 0.30 m dia at the foot, 0.28 m up the stem, closing above the fork at 2.85 m
  loft([ring(0, 0, 0, 0.15), ring(0, 0.4, 0, 0.14), ring(0, 1.8, 0, 0.135), ring(0, 2.55, 0, 0.12), ring(0, 2.85, 0, 0.08)], Y, 7);

  // limbs: [azimuth deg, tilt from vertical deg, length], 0.10 m dia, leaving the trunk at 2.55 m
  const FORK = new THREE.Vector3(0, 2.55, 0);
  const limbs = [[0, 45, 2.7], [80, 42, 2.5], [160, 45, 2.5], [235, 40, 2.6], [300, 20, 2.3]];
  const dirs = limbs.map(([az, tilt]) => {
    const a = az * Math.PI / 180, t = tilt * Math.PI / 180;
    return new THREE.Vector3(Math.sin(t) * Math.cos(a), Math.cos(t), Math.sin(t) * Math.sin(a));
  });
  const along = (k, s) => FORK.clone().addScaledVector(dirs[k], s);
  limbs.forEach(([, , len], k) => {
    const at = (s, r) => ({ c: along(k, s), r });
    loft([at(0, 0.06), at(len * 0.5, 0.05), at(len, 0.035)], dirs[k], 7);
  });
  const wood = new THREE.BufferGeometry();
  wood.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  wood.setIndex(idx);
  wood.computeVertexNormals();
  g.add(new THREE.Mesh(wood, bark));

  // ---- canopy: hash-lumped icosahedra, keyed on position (the geometry is unindexed)
  const hash = (n) => {
    let h = (n | 0) + 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const lumpy = (geo, amount, seed) => {
    const p = geo.attributes.position, ids = new Map();
    let next = 0;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const key = Math.round(x * 500) + ',' + Math.round(y * 500) + ',' + Math.round(z * 500);
      let id = ids.get(key);
      if (id === undefined) { id = next++; ids.set(key, id); }
      const f = 1 + (hash(id * 131 + seed) - 0.5) * 2 * amount;
      p.setXYZ(i, x * f, y * f, z * f);
    }
    geo.computeVertexNormals();
    return geo;
  };
  // [limb, distance along it, radius]: limb tips buried 0.3 m inside each blob
  const blobs = [[0, 2.4, 1.0], [1, 2.2, 0.9], [2, 2.2, 1.0], [3, 2.3, 0.9], [4, 2.5, 1.3], [0, 1.1, 0.9]];
  blobs.forEach(([k, s, r], i) => {
    const p = along(k, s);
    const m = new THREE.Mesh(lumpy(new THREE.IcosahedronGeometry(r, 1), 0.12, i + 7), foliage);
    m.position.copy(p);
    if (i === 5) m.position.y -= 0.05;   // the low one: bottom at 2.4
    m.rotation.y = i * 1.3;
    g.add(m);
  });

  // --- the six lines: measure vertices, ground at y = 0, centre on x/z ---------
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });

  return g;
}
