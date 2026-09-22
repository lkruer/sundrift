// snow_pole — WINNER (candidate A): assembled from primitives. Five stacked 8-sided cylinder bands (red, white, red,
// white, red from the ground), a 3-sided prism scaled into the down-pointing arrow plate on the +Z face,
// a short round white reflector on the plate, a dark clamp band and a small bracket block holding the
// plate to the pole. 8 radial segments everywhere: it is instanced hundreds of times.
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
  const red   = M(0xd11c1c);
  const white = M(0xe8e4da);
  const dark  = M(0x2b2d31, { roughness: 0.6 });

  // pole: five 0.26 m bands, 0.06 dia, red at the bottom
  const band = new THREE.CylinderGeometry(0.03, 0.03, 0.26, 8);
  for (let i = 0; i < 5; i++) put(band, i % 2 ? white : red, [0, 0.13 + i * 0.26, 0]);

  // arrow plate: a 3-sided prism scaled to 0.14 wide x 0.16 tall, apex DOWN, 0.02 thick, on the +Z face.
  // Vertex 0 of a 3-segment cylinder sits on local +z; rotation.x = +PI/2 sends local +z to world -Y.
  const tri = new THREE.CylinderGeometry(1, 1, 0.02, 3);
  tri.scale(0.07 / Math.sin(Math.PI / 3), 1, 0.16 / 1.5);
  put(tri, red, [0, 1.40 - 0.16 / 3, 0.04], [Math.PI / 2, 0, 0]);          // top edge at 1.40, apex at 1.24
  // round white reflector 0.05 dia on the arrow
  put(new THREE.CylinderGeometry(0.025, 0.025, 0.008, 10), white, [0, 1.352, 0.054], [Math.PI / 2, 0, 0]);
  // dark clamp band round the pole and the bracket block behind the plate
  put(new THREE.CylinderGeometry(0.034, 0.034, 0.03, 8), dark, [0, 1.27, 0]);
  put(new THREE.BoxGeometry(0.04, 0.05, 0.02), dark, [0, 1.27, 0.02]);

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
