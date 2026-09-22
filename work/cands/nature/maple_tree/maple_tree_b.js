// maple_tree — candidate B: profiles. Every canopy blob is a 7-sided LatheGeometry
// of a lumpy rounded profile (the style lock's "lathe of 6 to 8 sides"); the trunk
// with its root flare and the three limbs are 8-sided lathes too. 7.0 m tall,
// 6.0 m canopy, two blobs sagging on the +X side.
export default function (THREE) {
  const g = new THREE.Group();

  // ONE foliage material for every blob: the game recolours it per instance.
  const foliage = new THREE.MeshStandardMaterial({ color: 0xe07a1a, roughness: 0.9, metalness: 0, flatShading: true });
  foliage.name = 'foliage';
  const bark = new THREE.MeshStandardMaterial({ color: 0x5a3f2c, roughness: 0.85, metalness: 0 });
  bark.name = 'timber';

  const V2 = (a) => a.map(([x, y]) => new THREE.Vector2(x, y));
  const add = (geo, m, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh;
  };

  // --- trunk: one lathe, 8 sides. 0.46 m dia at the flared foot, 0.36 m dia at the knee,
  //     0.30 m at the fork, a short stub above the fork so the limbs leave from something.
  const trunkP = V2([[0, 0], [0.23, 0], [0.19, 0.30], [0.175, 1.20], [0.15, 2.10], [0.11, 2.40], [0, 2.40]]);
  add(new THREE.LatheGeometry(trunkP, 8), bark);

  // --- three limbs: tapered 8-sided lathes, 0.16 m dia, leaning out 30 degrees, 2.1 -> 3.8 m
  const FORK = 2.1, LEAN = Math.PI / 6, L = (3.8 - FORK) / Math.cos(LEAN);
  const limbGeo = new THREE.LatheGeometry(V2([[0, 0], [0.08, 0], [0.07, L * 0.5], [0.05, L], [0, L]]), 8);
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  for (let i = 0; i < 3; i++) {
    const az = i * (2 * Math.PI / 3) + 1.1;
    dir.set(Math.sin(LEAN) * Math.cos(az), Math.cos(LEAN), Math.sin(LEAN) * Math.sin(az));
    add(limbGeo, bark, 0, FORK - 0.05, 0).quaternion.setFromUnitVectors(up, dir);
  }

  // --- canopy: a unit blob profile, rounded on top and a little flatter underneath,
  //     swept with 7 sides. Scaled per blob to radii 1.3..2.1 m. The profile runs
  //     bottom pole -> out -> up -> top pole (solid on the left of travel, as the
  //     oil drum does); run it the other way and the lathe is wound inside-out.
  const blobGeo = new THREE.LatheGeometry(
    V2([[0, -1.0], [0.5, -0.86], [0.86, -0.5], [1.0, 0.0], [0.88, 0.45], [0.55, 0.84], [0, 1.0]]), 7);
  const blobs = [
    [ 0.00, 4.90,  0.00, 2.10, 2.10],   // crown, top at 7.0
    [ 1.40, 4.60, -0.95, 1.70, 1.60],
    [-1.45, 4.70,  0.85, 1.65, 1.55],
    [ 0.55, 4.50,  1.55, 1.55, 1.45],
    [-0.65, 4.60, -1.55, 1.55, 1.45],
    [ 1.65, 3.80,  0.95, 1.45, 1.40],   // sagging, bottom at 2.4
    [ 1.25, 3.70, -1.05, 1.35, 1.30],   // sagging, bottom at 2.4
  ];
  blobs.forEach(([x, y, z, r, ry], i) => {
    const b = add(blobGeo, foliage, x, y, z);
    b.scale.set(r, ry, r);
    b.rotation.y = i * 0.45;   // offset the 7-gons so the facets do not stack
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
