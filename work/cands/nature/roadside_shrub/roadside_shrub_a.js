// roadside_shrub — candidate A: primitives. Three icosahedron blobs (detail 1),
// radii 0.75 / 0.55 / 0.50 m, each squashed a little so the cluster is 1.8 m wide
// and 1.1 m tall, every one touching the ground, offset so the bush is not
// symmetric. Three blobs, not four, because a fourth icosahedron would put it
// over the 260-triangle ceiling. No stub: nothing floats, so nothing needs one.
export default function (THREE) {
  const g = new THREE.Group();

  // ONE foliage material for every blob: the game retints it per instance.
  const foliage = new THREE.MeshStandardMaterial({ color: 0x9a8a3c, roughness: 0.9, metalness: 0, flatShading: true });
  foliage.name = 'foliage';

  // x, z, radius, vertical squash, depth squash, turn
  const blobs = [
    [-0.15,  0.00, 0.75, 0.72, 0.90, 0.0],   // main: 1.5 m wide, 1.08 m tall
    [ 0.35, -0.30, 0.55, 0.85, 1.00, 0.9],
    [ 0.10,  0.35, 0.50, 0.80, 0.95, 1.7],
  ];
  for (const [x, z, r, sy, sz, turn] of blobs) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), foliage);
    m.scale.set(1, sy, sz);
    m.position.set(x, r * sy, z);   // the bottom pole vertex sits on the ground
    m.rotation.y = turn;
    g.add(m);
  }

  // --- the six lines: measure vertices, ground at y = 0, centre on x/z ---------
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });

  return g;
}
