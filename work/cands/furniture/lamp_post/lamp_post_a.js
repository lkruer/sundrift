// lamp_post — candidate A: assembled from primitives. Square base plate with four hex bolts, a cast foot
// collar, a 12-sided tapered column (0.18 -> 0.10 dia at 5.4 m), a top sleeve, the curved arm as THREE
// cylinder segments with sphere knuckles reaching +X and rising 0.5 m, a stepped chrome-dark head with the
// lamp-warm emissive lens on its underside, and a framed access door at 1.0 m on the +Z face.
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
  // a cylinder running from point a (radius r0) to point b (radius r1)
  const tube = (a, b, r0, r1, mat, segs = 10) => {
    const A = new THREE.Vector3(a[0], a[1], a[2]), B = new THREE.Vector3(b[0], b[1], b[2]);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, A.distanceTo(B), segs), mat);
    m.position.copy(A).lerp(B, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    g.add(m);
    return m;
  };
  const galv = M(0xb9bcc0, { roughness: 0.5, metalness: 0.6 }, 'metal');
  const dark = M(0x2b2d31, { roughness: 0.4 });
  const lens = M(0xffcf7a, { roughness: 0.3, emissive: 0xffcf7a, emissiveIntensity: 1.2 });

  // base plate 0.36 square, four hex bolts, cast foot collar
  put(new THREE.BoxGeometry(0.36, 0.03, 0.36), galv, [0, 0.015, 0]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    put(new THREE.CylinderGeometry(0.015, 0.015, 0.04, 6), galv, [sx * 0.14, 0.05, sz * 0.14]);
  }
  put(new THREE.CylinderGeometry(0.11, 0.125, 0.25, 12), galv, [0, 0.155, 0]);
  // tapered column 0.18 -> 0.10 dia, 12 sides, top at 5.40; sleeve where the arm is socketed
  put(new THREE.CylinderGeometry(0.05, 0.09, 5.37, 12), galv, [0, 0.03 + 5.37 / 2, 0]);
  put(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 12), galv, [0, 5.38, 0]);
  // access door at 1.0 m on +Z: proud frame of four rails, panel set 0.005 back inside it, dark latch
  put(new THREE.BoxGeometry(0.14, 0.02, 0.03), galv, [0, 1.15, 0.085]);
  put(new THREE.BoxGeometry(0.14, 0.02, 0.03), galv, [0, 0.85, 0.085]);
  put(new THREE.BoxGeometry(0.02, 0.32, 0.03), galv, [-0.06, 1.0, 0.085]);
  put(new THREE.BoxGeometry(0.02, 0.32, 0.03), galv, [0.06, 1.0, 0.085]);
  put(new THREE.BoxGeometry(0.10, 0.28, 0.02), galv, [0, 1.0, 0.085]);
  put(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 6), dark, [0.035, 1.0, 0.10], [Math.PI / 2, 0, 0]);
  // arm: three segments from the column top out to +X, rising 0.5 m, tapering 0.09 -> 0.07 dia
  const P0 = [0.02, 5.34, 0], P1 = [0.40, 5.63, 0], P2 = [0.76, 5.83, 0], P3 = [1.02, 5.89, 0];
  tube(P0, P1, 0.045, 0.042, galv);
  tube(P1, P2, 0.042, 0.038, galv);
  tube(P2, P3, 0.038, 0.035, galv);
  put(new THREE.SphereGeometry(0.042, 8, 6), galv, P1);
  put(new THREE.SphereGeometry(0.038, 8, 6), galv, P2);
  // head 0.62 x 0.22 x 0.32: stepped chrome-dark box, galvanised arm socket, lens on the underside
  put(new THREE.BoxGeometry(0.62, 0.16, 0.32), dark, [1.10, 5.86, 0]);
  put(new THREE.BoxGeometry(0.54, 0.06, 0.26), dark, [1.10, 5.97, 0]);
  put(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 10), galv, [0.80, 5.88, 0], [0, 0, Math.PI / 2]);
  put(new THREE.BoxGeometry(0.50, 0.02, 0.24), lens, [1.10, 5.775, 0]);

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
