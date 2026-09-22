// cedar_tree — candidate A: primitives. A tapered 7-sided cylinder trunk, bare to
// 3.5 m, and four 7-sided ConeGeometry tiers; under each rim a short frustum skirt
// drops the rim so it droops. Tiers interpenetrate: each base sits below the apex
// of the one under it. 14 m tall, 4.5 m wide at the lowest tier.
export default function (THREE) {
  const g = new THREE.Group();

  // ONE foliage material shared by every tier: the game recolours it per instance.
  const foliage = new THREE.MeshStandardMaterial({ color: 0x2f5a3a, roughness: 0.9, metalness: 0, flatShading: true });
  foliage.name = 'foliage';
  const bark = new THREE.MeshStandardMaterial({ color: 0x5a3f2c, roughness: 0.85, metalness: 0 });
  bark.name = 'timber';

  const add = (geo, m, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh;
  };

  // --- trunk: 0.5 m dia at the foot tapering to 0.12 m at 12 m, 7 sides
  add(new THREE.CylinderGeometry(0.06, 0.25, 12, 7, 3), bark, 0, 6, 0);

  // --- foliage tiers: [rim width, rim height, apex height]. Base cone 4.5 m wide at
  //     3.5 m and 4 m tall; the next rims at 6.5 and 9.5 m; a 1.4 m spire from 11.5 to 14 m.
  //     Every base is 0.6 m (1.0 m for the first) below the apex of the tier beneath it.
  const tiers = [[4.5, 3.5, 7.5], [3.6, 6.5, 10.1], [2.8, 9.5, 12.1], [1.4, 11.5, 14.0]];
  tiers.forEach(([w, y0, y1], k) => {
    const r = w / 2, h = y1 - y0, twist = k * 0.22;
    add(new THREE.ConeGeometry(r, h, 7, 2), foliage, 0, y0 + h / 2, 0).rotation.y = twist;
    // drooping rim: a short skirt below the rim that tapers in a little
    const d = Math.min(0.35, h * 0.1 + 0.05);
    add(new THREE.CylinderGeometry(r, r * 0.9, d, 7, 1), foliage, 0, y0 - d / 2, 0).rotation.y = twist;
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
