// power_pole — candidate A: primitives. A 10-sided tapered CylinderGeometry column (0.30 -> 0.19 m dia over
// 9 m, concrete, name plaster) with a chrome-dark base collar, two box cross-arms (0.08 m square, 0.9 m at
// 8.4 m and 0.6 m at 7.6 m) with clamp blocks against the column, five insulators (tapered white 6-sided
// skirt under a low-segment sphere head: two per arm and one pin insulator on the column cap, since the
// middle of a symmetric arm is inside the column), a transformer can (0.35 m dia, 0.6 m tall, chrome dark)
// hung on the +X side at 7 m by two straps with lid and bottom rims and two white bushings, and two step
// bolts (2.0 m on +X, 2.5 m on -X) with foot-stop blocks. The game strings the wires itself.
export default function (THREE) {
  const g = new THREE.Group();
  const M = (color, o = {}, name) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0, ...o }); if (name) m.name = name; return m; };
  const put = (geo, mat, p, r) => { const m = new THREE.Mesh(geo, mat); if (p) m.position.set(p[0], p[1], p[2]); if (r) m.rotation.set(r[0], r[1], r[2]); g.add(m); return m; };
  const concrete = M(0xa8a49c, { roughness: 0.9 }, 'plaster');
  const galv = M(0xb9bcc0, { roughness: 0.5, metalness: 0.6 }, 'metal');
  const white = M(0xe8e4da, { roughness: 0.35 });
  const dark = M(0x2b2d31, { roughness: 0.4 });
  const rAt = (y) => 0.15 - 0.055 * (y / 9);   // column radius at height y

  // column, dark base collar, galvanised cap
  put(new THREE.CylinderGeometry(0.095, 0.15, 9.0, 10), concrete, [0, 4.5, 0]);
  put(new THREE.CylinderGeometry(0.16, 0.165, 0.35, 10), dark, [0, 0.175, 0]);
  put(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 10), galv, [0, 9.0, 0]);

  // an insulator: tapered white skirt under a sphere head
  const insulator = (x, y) => {
    put(new THREE.CylinderGeometry(0.02, 0.04, 0.07, 6), white, [x, y + 0.035, 0]);
    put(new THREE.SphereGeometry(0.04, 5, 3), white, [x, y + 0.095, 0]);
  };
  // a cross-arm: box, two clamp blocks against the column, insulators along the top
  const arm = (y, len, xs) => {
    put(new THREE.BoxGeometry(len, 0.08, 0.08), galv, [0, y, 0]);
    const r = rAt(y) + 0.03;
    put(new THREE.BoxGeometry(0.06, 0.18, 0.16), galv, [r, y, 0]);
    put(new THREE.BoxGeometry(0.06, 0.18, 0.16), galv, [-r, y, 0]);
    for (const x of xs) insulator(x, y + 0.04);
  };
  arm(8.4, 0.9, [-0.36, 0.36]);
  arm(7.6, 0.6, [-0.22, 0.22]);
  insulator(0, 9.02);

  // transformer can on the +X side at 7 m
  const cx = 0.29;
  put(new THREE.CylinderGeometry(0.175, 0.175, 0.6, 10), dark, [cx, 7.0, 0]);
  put(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 8), dark, [cx, 7.31, 0]);
  put(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 8), dark, [cx, 6.69, 0]);
  put(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6), white, [cx - 0.08, 7.37, 0]);
  put(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6), white, [cx + 0.08, 7.37, 0]);
  put(new THREE.BoxGeometry(0.22, 0.05, 0.08), galv, [rAt(7.2) + 0.06, 7.22, 0]);
  put(new THREE.BoxGeometry(0.22, 0.05, 0.08), galv, [rAt(6.8) + 0.06, 6.78, 0]);

  // step bolts: 0.04 m dia, out to 0.29 m from the axis, foot-stop block on the end
  put(new THREE.CylinderGeometry(0.02, 0.02, 0.26, 6), galv, [0.14, 2.0, 0], [0, 0, Math.PI / 2]);
  put(new THREE.BoxGeometry(0.05, 0.06, 0.06), galv, [0.27, 2.0, 0]);
  put(new THREE.CylinderGeometry(0.02, 0.02, 0.26, 6), galv, [-0.14, 2.5, 0], [0, 0, Math.PI / 2]);
  put(new THREE.BoxGeometry(0.05, 0.06, 0.06), galv, [-0.27, 2.5, 0]);

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
