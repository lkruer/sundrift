// maple_tree — candidate C: a different part breakdown. The trunk, its root flare
// and the three limbs are ONE hand-built BufferGeometry, rings of eight points
// swept along each member in loops. The seven canopy blobs are icosahedra
// (detail 1) whose vertices are pushed in or out by a hash so no two blobs are
// the same shape. 7.0 m tall, 6.0 m canopy, two blobs sagging on the +X side.
export default function (THREE) {
  const g = new THREE.Group();

  // ONE foliage material for every blob: the game recolours it per instance.
  const foliage = new THREE.MeshStandardMaterial({ color: 0xe07a1a, roughness: 0.9, metalness: 0, flatShading: true });
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

  // trunk: 0.46 m dia root flare, 0.36 m dia at the knee, narrowing to the fork at 2.1 m
  loft([ring(0, 0, 0, 0.23), ring(0, 0.3, 0, 0.19), ring(0, 1.2, 0, 0.175), ring(0, 2.0, 0, 0.16), ring(0, 2.4, 0, 0.11)], Y, 8);

  // three limbs, 0.16 m dia, leaning out 30 degrees from the fork, reaching 3.8 m
  const FORK = 2.05, LEAN = Math.PI / 6, L = (3.8 - FORK) / Math.cos(LEAN);
  for (let i = 0; i < 3; i++) {
    const az = i * (2 * Math.PI / 3) + 2.0;
    const d = new THREE.Vector3(Math.sin(LEAN) * Math.cos(az), Math.cos(LEAN), Math.sin(LEAN) * Math.sin(az));
    const at = (s, r) => ({ c: new THREE.Vector3(0, FORK, 0).addScaledVector(d, s), r });
    loft([at(0, 0.09), at(L * 0.5, 0.075), at(L, 0.05)], d, 8);   // first ring is buried in the trunk
  }
  const wood = new THREE.BufferGeometry();
  wood.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  wood.setIndex(idx);
  wood.computeVertexNormals();
  g.add(new THREE.Mesh(wood, bark));

  // ---- canopy: icosahedra (detail 1), each vertex pushed in or out by a hash of its
  //      unique-vertex index (the geometry is unindexed, so key on the position)
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
  const blobs = [
    [ 0.10, 4.95, -0.10, 2.05],   // crown, top at 7.0
    [ 1.50, 4.50,  0.60, 1.60],
    [-1.50, 4.65, -0.70, 1.55],
    [-0.40, 4.55,  1.60, 1.45],
    [ 0.30, 4.70, -1.60, 1.45],
    [ 1.70, 3.75, -0.70, 1.35],   // sagging, bottom near 2.4
    [ 1.30, 3.65,  1.20, 1.30],   // sagging, bottom near 2.4
  ];
  blobs.forEach(([x, y, z, r], i) => {
    const m = new THREE.Mesh(lumpy(new THREE.IcosahedronGeometry(r, 1), 0.12, i + 1), foliage);
    m.position.set(x, y, z);
    m.rotation.y = i * 1.1;
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
