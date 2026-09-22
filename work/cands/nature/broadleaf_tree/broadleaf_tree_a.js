// broadleaf_tree — candidate A: primitives. A straight 7-sided cylinder trunk to
// 2.7 m, five 7-sided cylinder limbs spreading 12..45 degrees to 4.3..4.7 m, and
// seven icosahedron blobs (detail 1, radii 0.8..1.2 m) hung on the limb ends with
// the tips buried 0.3 m inside, so the limbs show through the gaps. Crown a rough
// dome 5.2 m wide from 2.4 to 6.0 m; a low blob hangs off the middle of limb 3.
export default function (THREE) {
  const g = new THREE.Group();

  // ONE foliage material for every blob: the game retints it per instance.
  const foliage = new THREE.MeshStandardMaterial({ color: 0xe8b52a, roughness: 0.9, metalness: 0, flatShading: true });
  foliage.name = 'foliage';
  const bark = new THREE.MeshStandardMaterial({ color: 0x5a3f2c, roughness: 0.85, metalness: 0 });
  bark.name = 'timber';

  const add = (geo, m, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh;
  };

  // --- trunk: 0.28 m dia, straight, 7 sides, 0..2.7 m
  add(new THREE.CylinderGeometry(0.13, 0.15, 2.7, 7, 1), bark, 0, 1.35, 0);

  // --- limbs: [azimuth deg, tilt from vertical deg, length]. They leave the trunk at 2.55 m.
  const FORK = new THREE.Vector3(0, 2.55, 0), up = new THREE.Vector3(0, 1, 0);
  const limbs = [[15, 45, 2.5], [100, 40, 2.3], [190, 45, 2.7], [275, 42, 2.4], [60, 12, 2.2]];
  const dirs = limbs.map(([az, tilt]) => {
    const a = az * Math.PI / 180, t = tilt * Math.PI / 180;
    return new THREE.Vector3(Math.sin(t) * Math.cos(a), Math.cos(t), Math.sin(t) * Math.sin(a));
  });
  const along = (k, s) => FORK.clone().addScaledVector(dirs[k], s);
  limbs.forEach(([, , len], k) => {
    const mid = along(k, len / 2);
    add(new THREE.CylinderGeometry(0.04, 0.055, len, 7, 1), bark, mid.x, mid.y, mid.z)
      .quaternion.setFromUnitVectors(up, dirs[k]);
  });

  // --- canopy: [limb, distance along it, radius, dx, dy, dz]. Ends are 0.3 m inside a blob.
  const blobs = [
    [0, 2.2, 1.05, 0, 0, 0],
    [1, 2.0, 1.00, 0, 0, 0],
    [2, 2.4, 1.00, 0, 0, 0],
    [3, 2.1, 1.00, 0, 0, 0],
    [4, 2.3, 1.20, 0, 0, 0],         // the crown, top at 6.0
    [2, 1.2, 0.90, -0.05, -0.10, 0.10],   // hangs low off limb 3: bottom at 2.4
    [0, 1.4, 0.80, 0.30, -0.70, -1.50],   // small one in the gap between limbs 1 and 4
  ];
  blobs.forEach(([k, s, r, dx, dy, dz], i) => {
    const p = along(k, s);
    add(new THREE.IcosahedronGeometry(r, 1), foliage, p.x + dx, p.y + dy, p.z + dz).rotation.y = i * 0.8;
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
