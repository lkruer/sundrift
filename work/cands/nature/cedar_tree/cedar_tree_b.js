// cedar_tree — candidate B: profiles. Each foliage tier is one 7-sided
// LatheGeometry whose profile is a slightly concave cone that turns DOWN past the
// rim (the drooping rim) and closes underneath, so nothing is open-ended. The
// trunk is a 7-sided lathe tapering from 0.5 m to 0.12 m dia. 14 m tall, 4.5 m wide.
export default function (THREE) {
  const g = new THREE.Group();

  // ONE foliage material shared by every tier: the game recolours it per instance.
  const foliage = new THREE.MeshStandardMaterial({ color: 0x2f5a3a, roughness: 0.9, metalness: 0, flatShading: true });
  foliage.name = 'foliage';
  const bark = new THREE.MeshStandardMaterial({ color: 0x5a3f2c, roughness: 0.85, metalness: 0 });
  bark.name = 'timber';

  const V2 = (a) => a.map(([x, y]) => new THREE.Vector2(x, y));
  const add = (geo, m, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh;
  };

  // --- trunk: 0.5 m dia at the foot, 0.12 m at 12 m, 7 sides, bare for the first 3.5 m
  add(new THREE.LatheGeometry(V2([[0, 0], [0.25, 0], [0.21, 3.0], [0.15, 7.0], [0.09, 10.0], [0.06, 12.0], [0, 12.0]]), 7), bark);

  // --- one tier: a shallow underside from the axis out to the drooping rim (D below
  //     the rim height), up over the rim and along a slightly concave flank to the
  //     apex at H. The profile runs underside -> rim -> apex, solid on the left of
  //     travel; run the other way the lathe is wound inside-out and renders as a dish.
  const tier = (R, H, D) => new THREE.LatheGeometry(V2([
    [0, 0.45], [0.72 * R, -D * 0.5], [0.95 * R, -D],
    [R, 0.02 * H], [0.76 * R, 0.22 * H], [0.40 * R, 0.56 * H], [0, H],
  ]), 7);

  // [rim width, rim height, apex height, droop]: 4.5 m wide at 3.5 m and 4 m tall, then
  // 3.6 m at 6.5 m, 2.8 m at 9.5 m, and the 1.4 m spire from 11.5 to 14 m. Each base sits
  // 0.6 m (1.0 m for the first) below the apex of the tier beneath it.
  const tiers = [[4.5, 3.5, 7.5, 0.35], [3.6, 6.5, 10.1, 0.30], [2.8, 9.5, 12.1, 0.25], [1.4, 11.5, 14.0, 0.20]];
  tiers.forEach(([w, y0, y1, d], k) => {
    add(tier(w / 2, y1 - y0, d), foliage, 0, y0, 0).rotation.y = k * 0.25;   // stagger the 7-gons
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
