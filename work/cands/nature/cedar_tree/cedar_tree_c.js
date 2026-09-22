// cedar_tree — candidate C: hand-built. All four foliage tiers are ONE
// BufferGeometry made in loops: apex, two rings for a concave flank, then a
// 14-point rim where the seven corner tips droop well below the seven mid-edge
// points, so each tier has a scalloped, drooping rim rather than a flat one, and a
// closed underside. The trunk is a 7-sided loft of six rings. 14 m tall, 4.5 m wide.
export default function (THREE) {
  const g = new THREE.Group();

  // ONE foliage material shared by every tier: the game recolours it per instance.
  const foliage = new THREE.MeshStandardMaterial({ color: 0x2f5a3a, roughness: 0.9, metalness: 0, flatShading: true });
  foliage.name = 'foliage';
  const bark = new THREE.MeshStandardMaterial({ color: 0x5a3f2c, roughness: 0.85, metalness: 0 });
  bark.name = 'timber';

  const N = 7;   // sides, as the brief says
  const mesh = (pos, idx, m) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const o = new THREE.Mesh(geo, m); g.add(o); return o;
  };

  // ---- foliage: one tier = apex + ring1 (7) + ring2 (7) + rim (14) + underside centre
  const fp = [], fi = [];
  const tier = (R, H, y0, D, twist) => {
    const b = fp.length / 3;
    const P = (r, y, th) => fp.push(r * Math.sin(th + twist), y0 + y, r * Math.cos(th + twist));
    P(0, H, 0);                                                          // apex
    for (let i = 0; i < N; i++) P(0.30 * R, 0.64 * H, (i / N) * 2 * Math.PI);        // ring1, concave flank
    for (let i = 0; i < N; i++) P(0.66 * R, 0.30 * H, (i / N) * 2 * Math.PI);        // ring2
    for (let k = 0; k < 2 * N; k++) {                                                // rim: tips droop
      const tip = k % 2 === 0;
      P(tip ? R : 0.9 * R, tip ? -D : 0.04 * H, (k / (2 * N)) * 2 * Math.PI);
    }
    P(0, 0.45, 0);                                                       // underside centre
    const A = b, R1 = b + 1, R2 = R1 + N, T = R2 + N, C = T + 2 * N;
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      fi.push(A, R1 + i, R1 + j);
      fi.push(R1 + i, R2 + i, R2 + j, R1 + i, R2 + j, R1 + j);
      const t0 = T + 2 * i, t1 = T + 2 * i + 1, t2 = T + (2 * i + 2) % (2 * N);
      fi.push(R2 + i, t0, t1, R2 + i, t1, R2 + j, R2 + j, t1, t2);
    }
    for (let k = 0; k < 2 * N; k++) fi.push(T + k, C, T + (k + 1) % (2 * N));
  };
  // [rim width, rim height, apex height, droop]: 4.5 m wide at 3.5 m and 4 m tall, then
  // 3.6 m at 6.5 m, 2.8 m at 9.5 m, the 1.4 m spire from 11.5 to 14 m. Every base sits
  // 0.6 m (1.0 m for the first) below the apex of the tier under it, so they interpenetrate.
  [[4.5, 3.5, 7.5, 0.40], [3.6, 6.5, 10.1, 0.35], [2.8, 9.5, 12.1, 0.30], [1.4, 11.5, 14.0, 0.22]]
    .forEach(([w, y0, y1, d], k) => tier(w / 2, y1 - y0, y0, d, k * 0.3));
  mesh(fp, fi, foliage);

  // ---- trunk: a 7-sided loft, 0.54 m dia at the foot, 0.5 m at the knee, 0.12 m at 12 m
  const tp = [], ti = [];
  const rings = [[0.27, 0], [0.25, 0.6], [0.21, 3.5], [0.15, 7.5], [0.10, 10.5], [0.06, 12.2]];
  rings.forEach(([r, y]) => { for (let i = 0; i < N; i++) { const th = (i / N) * 2 * Math.PI; tp.push(r * Math.sin(th), y, r * Math.cos(th)); } });
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < N; i++) {
    const j = (i + 1) % N, lo = k * N, hi = (k + 1) * N;
    ti.push(lo + i, hi + j, hi + i, lo + i, lo + j, hi + j);
  }
  const top = tp.length / 3, hi = (rings.length - 1) * N;
  tp.push(0, rings[rings.length - 1][1], 0);
  for (let i = 0; i < N; i++) ti.push(hi + i, hi + (i + 1) % N, top);
  mesh(tp, ti, bark);

  // --- the six lines: measure vertices, ground at y = 0, centre on x/z ---------
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });

  return g;
}
