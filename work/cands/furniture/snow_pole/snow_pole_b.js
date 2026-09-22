// snow_pole — candidate B: profile route. The pole is ONE red LatheGeometry (8 sides) with a slight foot
// flare and a shallow domed top; the two white bands are closed lathe sleeves just proud of it; the arrow
// plate is an ExtrudeGeometry of a triangle Shape (apex down, no bevel); the reflector is a lathe of a
// domed lens profile; the clamp ring and the boss behind the plate are open lathes (DoubleSide).
export default function (THREE) {
  const g = new THREE.Group();
  const M = (color, o = {}, name) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.0, ...o });
    if (name) m.name = name;
    return m;
  };
  const put = (geo, mat, p, r) => {
    const m = new THREE.Mesh(geo, mat);
    if (p) m.position.set(p[0], p[1], p[2]);
    if (r) m.rotation.set(r[0], r[1], r[2]);
    g.add(m);
    return m;
  };
  const lathe = (pts, segs) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), segs);
  const red   = M(0xd11c1c, { side: THREE.DoubleSide });
  const white = M(0xe8e4da, { side: THREE.DoubleSide });
  const dark  = M(0x2b2d31, { roughness: 0.6, side: THREE.DoubleSide });

  // pole: red lathe, foot flare to 0.068 dia, 0.06 dia shaft, domed cap at 1.30
  put(lathe([[0, 0], [0.034, 0], [0.03, 0.04], [0.03, 1.29], [0.022, 1.30], [0, 1.30]], 8), red);
  // white bands 0.26..0.52 and 0.78..1.04 as sleeves 0.002 proud of the shaft
  for (const y0 of [0.26, 0.78]) put(lathe([[0.028, y0], [0.032, y0], [0.032, y0 + 0.26], [0.028, y0 + 0.26]], 8), white);
  // arrow plate: extruded triangle 0.14 wide x 0.16 tall, apex down, 0.02 thick, on the +Z face
  const tri = new THREE.Shape();
  tri.moveTo(-0.07, 0.08); tri.lineTo(0, -0.08); tri.lineTo(0.07, 0.08); tri.closePath();
  put(new THREE.ExtrudeGeometry(tri, { depth: 0.02, bevelEnabled: false }), red, [0, 1.32, 0.03]);
  // reflector: domed lens 0.05 dia, axis turned to +Z, on the plate face
  put(lathe([[0, 0], [0.025, 0], [0.025, 0.003], [0.018, 0.007], [0, 0.009]], 8), white, [0, 1.352, 0.05], [Math.PI / 2, 0, 0]);
  // dark clamp ring round the pole and a round boss between pole and plate
  put(lathe([[0.035, -0.015], [0.035, 0.015]], 8), dark, [0, 1.27, 0]);
  put(lathe([[0.02, 0], [0.02, 0.03]], 6), dark, [0, 1.27, 0], [Math.PI / 2, 0, 0]);

  // ground and centre by measuring vertices
  const box = new THREE.Box3(), v = new THREE.Vector3(), m4 = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const add = (mat) => { for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); add(m4.multiplyMatrices(n.matrixWorld, im)); } return; }
    add(n.matrixWorld);
  });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });
  return g;
}
