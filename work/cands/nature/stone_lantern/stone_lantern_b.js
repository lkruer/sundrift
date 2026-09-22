// stone_lantern — candidate B: profiles. Every round part and every square part is
// a LatheGeometry: four segments started at 45 degrees make an axis-aligned square,
// so the plinth, the platform, both fire-box slabs and the roof are one sweep each.
// The roof profile is concave with the eave tip turned up, closed underneath. The
// fire-box middle band is an ExtrudeGeometry of a square Shape notched 0.16 x 0.03 m
// on each side (no bevel), so with the slabs above and below every face carries a
// true square recess. The pillar with its bead and the sphere finial are lathes too.
// Every profile runs bottom to top with the solid on the left of travel, so the
// faces point outward. Kasuga lantern, 1.8 m tall, 0.78 m across the eaves.
export default function (THREE) {
  const g = new THREE.Group();

  const stone = new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.95, metalness: 0, flatShading: true });
  stone.name = 'stone';
  const moss = new THREE.MeshStandardMaterial({ color: 0x5f7a3a, roughness: 0.9, metalness: 0, flatShading: true });
  moss.name = 'foliage';

  const V2 = (a) => a.map(([x, y]) => new THREE.Vector2(x, y));
  const lathe = (pts, seg, m, phi = 0) => {
    const mesh = new THREE.Mesh(new THREE.LatheGeometry(V2(pts), seg, phi), m); g.add(mesh); return mesh;
  };
  const SQ = Math.PI / 4;                          // four segments from 45 degrees: an axis-aligned square
  const r4 = (side) => (side / 2) * Math.SQRT2;    // corner radius of a square of that side

  // --- moss band: a closed ring 0.05 m tall, 0.01 m proud of the plinth
  lathe([[r4(0.72) - 0.01, 0], [r4(0.74), 0], [r4(0.74), 0.05], [r4(0.72) - 0.01, 0.05], [r4(0.72) - 0.01, 0]], 4, moss, SQ);
  // --- plinth: 0.72 m square, 0.16 m tall, chamfered top edge
  lathe([[0, 0], [r4(0.72), 0], [r4(0.72), 0.13], [r4(0.66), 0.16], [0, 0.16]], 4, stone, SQ);
  // --- pillar: 0.28 m dia at the foot to 0.24 m at the top, 0.62 m tall, a bead at its middle
  lathe([[0, 0.16], [0.14, 0.16], [0.135, 0.44], [0.152, 0.46], [0.152, 0.48], [0.135, 0.50], [0.12, 0.78], [0, 0.78]], 12, stone);
  // --- platform: 0.58 m square, 0.12 m tall, chamfered underneath
  lathe([[0, 0.78], [r4(0.52), 0.78], [r4(0.58), 0.81], [r4(0.58), 0.90], [0, 0.90]], 4, stone, SQ);

  // --- fire box: 0.42 m cube from 0.90 to 1.32. Two square slabs and a notched band between.
  lathe([[0, 0.90], [r4(0.42), 0.90], [r4(0.42), 1.03], [0, 1.03]], 4, stone, SQ);
  lathe([[0, 1.19], [r4(0.42), 1.19], [r4(0.42), 1.32], [0, 1.32]], 4, stone, SQ);
  const h = 0.21, n = 0.08, d = 0.03;    // half side, half recess width, recess depth
  const pts = [
    [-h, -h], [-n, -h], [-n, -h + d], [n, -h + d], [n, -h], [h, -h],
    [h, -n], [h - d, -n], [h - d, n], [h, n], [h, h],
    [n, h], [n, h - d], [-n, h - d], [-n, h], [-h, h],
    [-h, n], [-h + d, n], [-h + d, -n], [-h, -n],
  ];
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  const band = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false }), stone);
  band.rotation.x = -Math.PI / 2;        // the extrusion along local +z now runs up +y
  band.position.y = 1.03;                // 1.03..1.19: with the slabs, a 0.16 m square recess per face
  g.add(band);

  // --- roof: flat underside out to the eave, an eave edge 0.06 m tall rising to the
  //     turned-up tip at 0.78 m across, then a concave flank to the apex at 1.66
  const RC = r4(0.78);
  lathe([[0, 1.32], [0.30, 1.32], [0.52, 1.32], [RC, 1.38], [0.462, 1.37], [0.338, 1.405],
         [0.20, 1.473], [0.093, 1.541], [0.03, 1.60], [0, 1.66]], 4, stone, SQ);

  // --- finial: a neck and a 0.12 m sphere, top at 1.80 m
  lathe([[0, 1.66], [0.045, 1.66], [0.035, 1.685], [0.052, 1.71], [0.06, 1.74], [0.052, 1.77], [0.03, 1.792], [0, 1.80]], 8, stone);

  // --- the six lines: measure vertices, ground at y = 0, centre on x/z ---------
  const bb = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((o) => { const p = o.isMesh && o.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) bb.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld)); });
  const c = bb.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= bb.min.y; o.position.z -= c.z; });

  return g;
}
