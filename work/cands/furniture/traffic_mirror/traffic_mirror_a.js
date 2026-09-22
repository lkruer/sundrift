// traffic_mirror — candidate A: assembled from primitives. Galvanised pole on a small square base plate with
// four bolts and a dark clamp collar; the mirror is a tilted sub-group (rotation.x = +12 deg pitches the
// face DOWN toward the road): a SphereGeometry cap for the convex face (0.80 chord, 0.06 deep), a torus
// rim in vermilion, a chrome-dark cone dish for the back, a torus-sector hood over the top third, and a
// short box bracket from the pole to the dish.
export default function (THREE) {
  const g = new THREE.Group();
  const M = (color, o = {}, name) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.0, ...o });
    if (name) m.name = name;
    return m;
  };
  const mesh = (parent, geo, mat, p, r) => {
    const m = new THREE.Mesh(geo, mat);
    if (p) m.position.set(p[0], p[1], p[2]);
    if (r) m.rotation.set(r[0], r[1], r[2]);
    parent.add(m);
    return m;
  };
  const put = (geo, mat, p, r) => mesh(g, geo, mat, p, r);
  const galv = M(0xb9bcc0, { roughness: 0.5, metalness: 0.6 }, 'metal');
  const face = M(0xb9bcc0, { roughness: 0.15, metalness: 0.85, side: THREE.DoubleSide });
  const verm = M(0xc9402b, { side: THREE.DoubleSide });
  const dark = M(0x2b2d31, { roughness: 0.4 });

  const PZ = -0.16;                                  // pole axis sits behind the mirror
  // pole 0.07 dia x 2.15 on a 0.26 base plate with bolts, dark clamp collar at the top, cap disc
  put(new THREE.BoxGeometry(0.26, 0.02, 0.26), galv, [0, 0.01, PZ]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    put(new THREE.CylinderGeometry(0.012, 0.012, 0.016, 6), dark, [sx * 0.10, 0.028, PZ + sz * 0.10]);
  }
  put(new THREE.CylinderGeometry(0.035, 0.035, 2.15, 10), galv, [0, 1.075, PZ]);
  put(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 10), dark, [0, 2.10, PZ]);
  put(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 10), galv, [0, 2.16, PZ]);
  // bracket from the pole to the back of the dish at mirror-centre height
  put(new THREE.BoxGeometry(0.06, 0.08, 0.13), galv, [0, 2.15, PZ + 0.065]);

  // the mirror itself, centred 2.15 m up, tilted 12 degrees down
  const mir = new THREE.Group();
  mir.position.set(0, 2.15, 0);
  mir.rotation.x = 12 * Math.PI / 180;
  g.add(mir);
  const R = (0.4 * 0.4 + 0.06 * 0.06) / (2 * 0.06);          // sphere radius for a 0.80 chord, 0.06 sagitta
  const th = Math.asin(0.4 / R);
  mesh(mir, new THREE.SphereGeometry(R, 16, 4, 0, Math.PI * 2, 0, th), face, [0, 0, 0.06 - R], [Math.PI / 2, 0, 0]);
  mesh(mir, new THREE.TorusGeometry(0.43, 0.03, 6, 24), verm);                         // rim 0.40..0.46
  mesh(mir, new THREE.CylinderGeometry(0.12, 0.40, 0.06, 16), dark, [0, 0, -0.03], [-Math.PI / 2, 0, 0]);   // back dish
  mesh(mir, new THREE.TorusGeometry(0.44, 0.05, 6, 12, 2 * Math.PI / 3), verm, [0, 0, 0.08], [0, 0, Math.PI / 6]);   // hood, 30..150 deg

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
