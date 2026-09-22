// roadside_shrub — candidate B: profiles. Four 6-sided LatheGeometry blobs of one
// rounded profile, scaled to radii 0.45..0.78 m and squashed, the cluster 1.8 m
// wide and 1.1 m tall. Three touch the ground; the fourth is lifted 0.15 m on a
// tiny cedar-bark stub (0.08 m dia) that shows in the gap under it. The profile
// runs bottom pole -> out -> top pole (solid on the left of travel): the other
// way round winds a lathe inside-out, which the gate does not catch.
export default function (THREE) {
  const g = new THREE.Group();

  // ONE foliage material for every blob: the game retints it per instance.
  const foliage = new THREE.MeshStandardMaterial({ color: 0x9a8a3c, roughness: 0.9, metalness: 0, flatShading: true });
  foliage.name = 'foliage';
  const bark = new THREE.MeshStandardMaterial({ color: 0x5a3f2c, roughness: 0.85, metalness: 0 });
  bark.name = 'timber';

  const V2 = (a) => a.map(([x, y]) => new THREE.Vector2(x, y));
  const blobGeo = new THREE.LatheGeometry(V2([[0, -1], [0.78, -0.58], [1.0, 0.02], [0.8, 0.6], [0, 1]]), 6);

  // x, centre y, z, radius, vertical squash, turn (a 6-gon is r wide only across its corners)
  const blobs = [
    [-0.15, 0.546, 0.00, 0.78, 0.70, Math.PI / 6],   // main: top at 1.09, bottom on the ground
    [ 0.40, 0.468, -0.30, 0.55, 0.85, 0.4],
    [-0.45, 0.360, -0.45, 0.45, 0.80, 1.2],
    [ 0.10, 0.550,  0.35, 0.50, 0.80, 0.8],          // lifted: bottom at 0.15, on the stub
  ];
  for (const [x, y, z, r, sy, turn] of blobs) {
    const m = new THREE.Mesh(blobGeo, foliage);
    m.scale.set(r, r * sy, r);
    m.position.set(x, y, z);
    m.rotation.y = turn;
    g.add(m);
  }
  const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.3, 6), bark);
  stub.position.set(0.10, 0.15, 0.35);
  g.add(stub);

  // --- the six lines: measure vertices, ground at y = 0, centre on x/z ---------
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });

  return g;
}
