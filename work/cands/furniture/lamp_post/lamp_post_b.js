// lamp_post — candidate B: profile route. The column is ONE 12-sided LatheGeometry (foot collar, taper,
// cap), the base plate an extruded chamfered square, the bolts 6-segment lathes, the arm a TubeGeometry
// along a QuadraticBezierCurve3 that leaves the column top and sweeps out to +X rising 0.5 m, the head an
// ExtrudeGeometry of a rounded-rectangle Shape (no bevel) with a smaller rounded cap and a rounded lens
// plate underneath, the access door an extruded frame (Shape with a hole) with the panel set inside it.
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
  const poly = (pts) => { const s = new THREE.Shape(); pts.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]))); s.closePath(); return s; };
  const rrect = (w, h, r) => {
    const s = new THREE.Shape(), x = w / 2, y = h / 2;
    s.moveTo(-x + r, -y); s.lineTo(x - r, -y); s.quadraticCurveTo(x, -y, x, -y + r);
    s.lineTo(x, y - r); s.quadraticCurveTo(x, y, x - r, y);
    s.lineTo(-x + r, y); s.quadraticCurveTo(-x, y, -x, y - r);
    s.lineTo(-x, -y + r); s.quadraticCurveTo(-x, -y, -x + r, -y);
    return s;
  };
  const extrude = (shape, depth, cs = 3) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: cs });
  const galv = M(0xb9bcc0, { roughness: 0.5, metalness: 0.6 }, 'metal');
  const dark = M(0x2b2d31, { roughness: 0.4 });
  const lens = M(0xffcf7a, { roughness: 0.3, emissive: 0xffcf7a, emissiveIntensity: 1.2 });

  // column: foot collar 0.25 dia, taper 0.18 -> 0.10 dia at 5.38, cap sleeve to 5.46
  put(lathe([[0, 0.03], [0.125, 0.03], [0.125, 0.22], [0.10, 0.30], [0.09, 0.34], [0.05, 5.38], [0.065, 5.40], [0.065, 5.46], [0, 5.46]], 12), galv);
  // base plate: chamfered 0.36 square, 0.03 thick (extruded along +Y via rotation.x = -PI/2)
  put(extrude(poly([[-0.15, -0.18], [0.15, -0.18], [0.18, -0.15], [0.18, 0.15], [0.15, 0.18], [-0.15, 0.18], [-0.18, 0.15], [-0.18, -0.15]]), 0.03),
    galv, [0, 0, 0], [-Math.PI / 2, 0, 0]);
  const bolt = lathe([[0, 0], [0.016, 0], [0.016, 0.03], [0.012, 0.04], [0, 0.04]], 6);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(bolt, galv, [sx * 0.14, 0.03, sz * 0.14]);
  // arm: tube along a quadratic Bezier, start buried in the column cap, end inside the head
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.02, 5.26, 0), new THREE.Vector3(0.30, 5.95, 0), new THREE.Vector3(1.0, 5.89, 0));
  put(new THREE.TubeGeometry(curve, 12, 0.045, 8, false), galv);
  // head: rounded rectangle 0.62 x 0.32 in plan, 0.16 tall (y 5.78..5.94), smaller rounded cap to 6.00
  put(extrude(rrect(0.62, 0.32, 0.06), 0.16), dark, [1.10, 5.78, 0], [-Math.PI / 2, 0, 0]);
  put(extrude(rrect(0.54, 0.26, 0.05), 0.06), dark, [1.10, 5.94, 0], [-Math.PI / 2, 0, 0]);
  // lens plate 0.50 x 0.24 on the underside, lamp warm emissive
  put(extrude(rrect(0.50, 0.24, 0.04), 0.02), lens, [1.10, 5.765, 0], [-Math.PI / 2, 0, 0]);
  // arm socket ring on the head's inner end
  put(lathe([[0.05, -0.06], [0.06, -0.06], [0.06, 0.06], [0.05, 0.06], [0.05, -0.06]], 10), galv, [0.80, 5.88, 0], [0, 0, Math.PI / 2]);
  // access door at 1.0 m on +Z: extruded frame with a hole, panel 0.005 back from the frame face, dark knob
  const frame = poly([[-0.07, -0.16], [0.07, -0.16], [0.07, 0.16], [-0.07, 0.16]]);
  const hole = new THREE.Path();
  hole.moveTo(-0.05, -0.14); hole.lineTo(-0.05, 0.14); hole.lineTo(0.05, 0.14); hole.lineTo(0.05, -0.14); hole.closePath();
  frame.holes.push(hole);
  put(extrude(frame, 0.03), galv, [0, 1.0, 0.07]);
  put(extrude(poly([[-0.05, -0.14], [0.05, -0.14], [0.05, 0.14], [-0.05, 0.14]]), 0.02), galv, [0, 1.0, 0.075]);
  put(lathe([[0, 0], [0.012, 0], [0.012, 0.012], [0, 0.012]], 6), dark, [0.035, 1.0, 0.095], [Math.PI / 2, 0, 0]);

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
