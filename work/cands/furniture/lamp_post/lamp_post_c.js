// lamp_post — candidate C: a different reading of the arm and head. The column is two tapered 12-sided
// sections joined by a sleeve; the curved arm is a quarter-torus elbow (R 0.5 m) rising off the column
// top into a straight tapered run, braced by a diagonal strut; the head is a pill (box plus two round
// ends, axis along Z) with the emissive lens under it and a small photocell dome on top; base plate with a
// raised foot ring and four bolts; the access door is a proud plate with a dark keyhole.
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
  const tube = (a, b, r0, r1, mat, segs = 8) => {
    const A = new THREE.Vector3(a[0], a[1], a[2]), B = new THREE.Vector3(b[0], b[1], b[2]);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, A.distanceTo(B), segs), mat);
    m.position.copy(A).lerp(B, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    g.add(m);
    return m;
  };
  const galv   = M(0xb9bcc0, { roughness: 0.5, metalness: 0.6 }, 'metal');
  const galvDS = M(0xb9bcc0, { roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide }, 'metal');
  const dark   = M(0x2b2d31, { roughness: 0.4 });
  const lens   = M(0xffcf7a, { roughness: 0.3, emissive: 0xffcf7a, emissiveIntensity: 1.2 });

  // base plate, raised foot ring, four hex bolts
  put(new THREE.BoxGeometry(0.36, 0.03, 0.36), galv, [0, 0.015, 0]);
  put(new THREE.CylinderGeometry(0.12, 0.13, 0.08, 12), galv, [0, 0.07, 0]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    put(new THREE.CylinderGeometry(0.015, 0.015, 0.04, 6), galv, [sx * 0.14, 0.05, sz * 0.14]);
  }
  // column in two tapered sections (0.18 -> 0.144 -> 0.10 dia) with a joint sleeve and a top cap sleeve
  put(new THREE.CylinderGeometry(0.072, 0.09, 2.60, 12), galv, [0, 1.33, 0]);
  put(new THREE.CylinderGeometry(0.082, 0.082, 0.20, 12), galv, [0, 2.63, 0]);
  put(new THREE.CylinderGeometry(0.05, 0.072, 2.77, 12), galv, [0, 2.63 + 2.77 / 2, 0]);
  put(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12), galv, [0, 5.40, 0]);
  // access door at 1.0 m on +Z: proud plate with a dark keyhole
  put(new THREE.BoxGeometry(0.12, 0.30, 0.02), galv, [0, 1.0, 0.085]);
  put(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 6), dark, [0.035, 1.0, 0.10], [Math.PI / 2, 0, 0]);
  // arm: quarter-torus elbow centred at (0.5, 5.4) from the column top (0, 5.4) up to (0.5, 5.9),
  // then a straight tapered run to the head, with a diagonal strut from the column
  const elbow = new THREE.Mesh(new THREE.TorusGeometry(0.50, 0.045, 8, 10, Math.PI / 2), galvDS);
  elbow.position.set(0.50, 5.40, 0);
  elbow.rotation.z = Math.PI / 2;
  g.add(elbow);
  put(new THREE.CylinderGeometry(0.045, 0.038, 0.56, 10), galv, [0.76, 5.90, 0], [0, 0, Math.PI / 2]);
  tube([0.05, 5.00, 0], [0.62, 5.87, 0], 0.022, 0.022, galv);
  put(new THREE.SphereGeometry(0.03, 8, 6), galv, [0.62, 5.87, 0]);
  // head: pill 0.62 x 0.22 x 0.32 (box plus two round ends), lens under it, photocell dome on top
  put(new THREE.BoxGeometry(0.40, 0.22, 0.32), dark, [1.10, 5.89, 0]);
  for (const x of [0.90, 1.30]) put(new THREE.CylinderGeometry(0.11, 0.11, 0.32, 12), dark, [x, 5.89, 0], [Math.PI / 2, 0, 0]);
  put(new THREE.BoxGeometry(0.50, 0.02, 0.24), lens, [1.10, 5.775, 0]);
  put(new THREE.SphereGeometry(0.04, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), galvDS, [1.10, 5.995, 0]);

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
