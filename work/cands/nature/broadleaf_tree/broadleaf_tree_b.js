// broadleaf_tree — candidate B: profiles. Every part is a LatheGeometry: the trunk
// (7 sides, 0.28 m dia, straight with a small foot), five tapered 7-sided limbs
// spreading 14..45 degrees, and seven 7-sided canopy blobs of one rounded profile
// scaled to radii 0.8..1.2 m and hung on the limb ends with the tips buried, so
// the limbs show through the gaps. Every profile runs bottom -> top with the
// solid on the left of travel; the other way winds a lathe inside-out and the
// gate does not catch it. Crown a rough dome 5.2 m wide from 2.4 to 6.0 m.
export default function (THREE) {
  const g = new THREE.Group();

  // ONE foliage material for every blob: the game retints it per instance.
  const foliage = new THREE.MeshStandardMaterial({ color: 0xe8b52a, roughness: 0.9, metalness: 0, flatShading: true });
  foliage.name = 'foliage';
  const bark = new THREE.MeshStandardMaterial({ color: 0x5a3f2c, roughness: 0.85, metalness: 0 });
  bark.name = 'timber';

  const V2 = (a) => a.map(([x, y]) => new THREE.Vector2(x, y));
  const add = (geo, m, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh;
  };

  // --- trunk: 0..2.7 m, 0.30 m dia at the foot, 0.26 m at the fork
  add(new THREE.LatheGeometry(V2([[0, 0], [0.16, 0], [0.145, 0.35], [0.13, 2.7], [0, 2.7]]), 7), bark);

  // --- limbs: [azimuth deg, tilt from vertical deg, length], leaving the trunk at 2.55 m
  const FORK = new THREE.Vector3(0, 2.55, 0), up = new THREE.Vector3(0, 1, 0);
  const limbs = [[65, 45, 2.5], [150, 38, 2.4], [240, 45, 2.6], [325, 44, 2.3], [10, 14, 2.1]];
  const dirs = limbs.map(([az, tilt]) => {
    const a = az * Math.PI / 180, t = tilt * Math.PI / 180;
    return new THREE.Vector3(Math.sin(t) * Math.cos(a), Math.cos(t), Math.sin(t) * Math.sin(a));
  });
  const along = (k, s) => FORK.clone().addScaledVector(dirs[k], s);
  limbs.forEach(([, , len], k) => {
    const geo = new THREE.LatheGeometry(V2([[0, 0], [0.055, 0], [0.045, len * 0.6], [0.035, len], [0, len]]), 7);
    add(geo, bark, FORK.x, FORK.y, FORK.z).quaternion.setFromUnitVectors(up, dirs[k]);
  });

  // --- canopy: one rounded 7-sided blob, bottom pole -> out -> top pole
  const blobGeo = new THREE.LatheGeometry(V2([[0, -1], [0.55, -0.83], [0.9, -0.42], [1.0, 0.1], [0.75, 0.66], [0, 1]]), 7);
  // [limb, distance along it, radius, dx, dy, dz]
  const blobs = [
    [0, 2.2, 1.05, 0, 0, 0],
    [1, 2.1, 0.95, 0, 0, 0],
    [2, 2.3, 1.00, 0, 0, 0],
    [3, 2.0, 1.00, 0, 0, 0],
    [4, 2.2, 1.20, 0, 0, 0],               // the crown, top at 6.0
    [0, 1.1, 0.90, 0.10, -0.05, 0.05],     // hangs low off limb 1: bottom at 2.4
    [2, 1.3, 0.80, -0.9, -0.5, 0.9],       // small one in the gap between limbs 2 and 3
  ];
  blobs.forEach(([k, s, r, dx, dy, dz], i) => {
    const p = along(k, s);
    const m = add(blobGeo, foliage, p.x + dx, p.y + dy, p.z + dz);
    m.scale.setScalar(r);
    m.rotation.y = i * 0.6;
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
