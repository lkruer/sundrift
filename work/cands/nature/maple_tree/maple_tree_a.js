// maple_tree — candidate A: primitives. Seven icosahedron blobs (detail 1) on an
// 8-sided cylinder trunk with three leaning cylinder limbs. 7.0 m tall, 6.0 m canopy.
// Two of the blobs sag on the +X side so the dome is not symmetric.
export default function (THREE) {
  const g = new THREE.Group();

  // ONE foliage material for every blob: the game recolours it per instance.
  const foliage = new THREE.MeshStandardMaterial({ color: 0xe07a1a, roughness: 0.9, metalness: 0, flatShading: true });
  foliage.name = 'foliage';
  const bark = new THREE.MeshStandardMaterial({ color: 0x5a3f2c, roughness: 0.85, metalness: 0 });
  bark.name = 'timber';

  const add = (geo, m, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh;
  };

  // --- trunk: 0.36 m dia at the foot with a root flare, 8 sides, to the fork at 2.1 m
  add(new THREE.CylinderGeometry(0.18, 0.23, 0.25, 8, 1), bark, 0, 0.125, 0);       // root flare 0..0.25
  add(new THREE.CylinderGeometry(0.15, 0.18, 1.85, 8, 1), bark, 0, 0.25 + 0.925, 0); // 0.25..2.1
  add(new THREE.CylinderGeometry(0.10, 0.15, 0.30, 8, 1), bark, 0, 2.1 + 0.15, 0);   // fork collar

  // --- three limbs, 0.16 m dia, leaning out 30 degrees, from the fork at 2.1 m up to 3.8 m
  const FORK = 2.1, TOP = 3.8, LEAN = Math.PI / 6;
  const L = (TOP - FORK) / Math.cos(LEAN);
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  for (let i = 0; i < 3; i++) {
    const az = i * (2 * Math.PI / 3) + 0.5;
    dir.set(Math.sin(LEAN) * Math.cos(az), Math.cos(LEAN), Math.sin(LEAN) * Math.sin(az));
    const limb = add(new THREE.CylinderGeometry(0.06, 0.08, L, 8, 1), bark,
                     dir.x * L / 2, FORK + dir.y * L / 2, dir.z * L / 2);
    limb.quaternion.setFromUnitVectors(up, dir);   // no rotation sign to get wrong
  }

  // --- canopy: seven blobs, radii 1.3..2.1 m, a dome 6 m wide from 2.4 m up to 7.0 m.
  //     The last two sit low on the +X side: that is the asymmetry the brief asks for.
  const blobs = [
    [ 0.00, 4.90,  0.00, 2.10],   // crown, top at 7.0
    [ 1.35, 4.60, -0.90, 1.70],
    [-1.40, 4.70,  0.80, 1.60],
    [ 0.50, 4.50,  1.50, 1.50],
    [-0.60, 4.60, -1.50, 1.50],
    [ 1.60, 3.80,  0.90, 1.40],   // sagging, bottom at 2.4
    [ 1.20, 3.70, -1.00, 1.30],   // sagging, bottom at 2.4
  ];
  blobs.forEach(([x, y, z, r], i) => {
    const b = add(new THREE.IcosahedronGeometry(r, 1), foliage, x, y, z);
    b.rotation.y = i * 0.9;       // facets should not line up blob to blob
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
