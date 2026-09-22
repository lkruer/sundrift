// bus_shelter — candidate B: profiles. The gabled roof is ONE extruded chevron section (a thick inverted V)
// swept along X with a smaller chevron ridge cap; the three walls are extruded weatherboard sawtooth
// profiles, so every plank is a real overlapping board with its bottom edge standing proud; triangular
// gable boards close the ends; the bench is a swept seat-and-apron section on two trapezoid leg boards;
// the sign disc is a 16-segment lathe with a raised rim and dished face on a lathe post with its base
// plate in the profile; the lamp is an extruded rounded rectangle. Timber frame from boxes.
export default function (THREE) {
  const g = new THREE.Group();
  const M = (color, o = {}, name) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0, ...o }); if (name) m.name = name; return m; };
  const put = (geo, mat, p, r) => { const m = new THREE.Mesh(geo, mat); if (p) m.position.set(p[0], p[1], p[2]); if (r) m.rotation.set(r[0], r[1], r[2]); g.add(m); return m; };
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
  const extrude = (shape, depth, cs = 1) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: cs });
  // a section (world z, y) swept along +X from x0: rotation.y = PI/2 sends the depth to +X and shape x to -Z
  const alongX = (pts, len, x0, mat) => put(extrude(poly(pts.map(([z, y]) => [-z, y])), len), mat, [x0, 0, 0], [0, Math.PI / 2, 0]);
  // a section (world x, y) swept along +Z from z0
  const alongZ = (pts, len, z0, mat) => put(extrude(poly(pts), len), mat, [0, 0, z0]);
  const timber = M(0x7a5a3a, { roughness: 0.85 }, 'timber');
  const tile = M(0x4a4f5a, { roughness: 0.8 }, 'tile');
  const galv = M(0xb9bcc0, { roughness: 0.5, metalness: 0.6 }, 'metal');
  const dark = M(0x2b2d31, { roughness: 0.4 });
  const lamp = M(0xffcf7a, { roughness: 0.3, emissive: 0xffcf7a, emissiveIntensity: 1.2 });
  const box = (w, h, d, x, y, z, m) => put(new THREE.BoxGeometry(w, h, d), m, [x, y, z]);

  // frame
  for (const x of [-1.25, 1.25]) for (const z of [-0.55, 0.55]) box(0.1, 2.3, 0.1, x, 1.15, z, timber);
  for (const z of [-0.55, 0.55]) box(2.6, 0.1, 0.1, 0, 2.3, z, timber);
  for (const x of [-1.25, 1.25]) box(0.1, 0.1, 1.2, x, 2.3, 0, timber);
  for (const x of [-1.25, 1.25]) box(0.1, 0.3, 0.1, x, 2.5, 0, timber);
  box(2.6, 0.1, 0.1, 0, 2.62, 0, timber);
  box(2.6, 0.1, 0.1, 0, 0.05, -0.55, dark);
  for (const x of [-1.25, 1.25]) box(0.1, 0.1, 1.2, x, 0.05, 0, dark);
  // roof: chevron section and ridge cap swept along X, gable boards at the ends
  alongX([[-0.8, 2.17], [0, 2.67], [0.8, 2.17], [0.8, 2.23], [0, 2.73], [-0.8, 2.23]], 3.0, -1.5, tile);
  alongX([[-0.13, 2.65], [0, 2.73], [0.13, 2.65], [0.13, 2.71], [0, 2.79], [-0.13, 2.71]], 3.0, -1.5, tile);
  for (const x of [-1.275, 1.225]) alongX([[-0.72, 2.35], [0.72, 2.35], [0, 2.7]], 0.05, x, timber);
  // walls: weatherboard sawtooth profiles, outer face proud at the bottom of every board
  const boards = (inner, outer, mid) => {
    const pts = [[inner, 0.1], [outer, 0.1]];
    for (let y = 0.1; y < 2.25; y += 0.2) { pts.push([mid, Math.min(y + 0.2, 2.3)]); if (y + 0.2 < 2.25) pts.push([outer, y + 0.2]); }
    pts.push([inner, 2.3]);
    return pts;
  };
  alongX(boards(-0.52, -0.58, -0.55), 2.4, -1.2, timber);                 // back wall, outer face toward -Z
  alongZ(boards(-1.22, -1.28, -1.25), 1.0, -0.5, timber);                 // left wall, outer face toward -X
  alongZ(boards(1.22, 1.28, 1.25), 1.0, -0.5, timber);                    // right wall, outer face toward +X
  // inside rail across the back wall
  box(2.4, 0.08, 0.05, 0, 1.05, -0.495, timber);
  // bench: seat-and-apron section swept along X on two trapezoid legs
  alongX([[-0.42, 0.42], [0, 0.42], [0, 0.3], [-0.05, 0.3], [-0.05, 0.36], [-0.42, 0.36]], 2.4, -1.2, timber);
  for (const x of [-1.13, 1.07]) alongX([[-0.38, 0], [-0.06, 0], [-0.1, 0.36], [-0.34, 0.36]], 0.06, x, timber);
  // sign: lathe post with base plate, lathe disc with rim and dished face, facing +Z
  put(lathe([[0, 0], [0.09, 0], [0.09, 0.02], [0.03, 0.02], [0.03, 2.4], [0, 2.4]], 8), galv, [1.65, 0, 0.35]);
  put(lathe([[0, 0], [0.25, 0], [0.25, 0.04], [0.21, 0.04], [0.21, 0.025], [0, 0.025]], 16), dark, [1.65, 2.1, 0.38], [Math.PI / 2, 0, 0]);
  // bar lamp: dark fitting and rounded lens plate under the ridge beam
  put(extrude(rrect(0.96, 0.12, 0.03), 0.05), dark, [0, 2.545, 0], [-Math.PI / 2, 0, 0]);
  put(extrude(rrect(0.9, 0.06, 0.02), 0.06), lamp, [0, 2.485, 0], [-Math.PI / 2, 0, 0]);

  // ground and centre by measuring vertices
  const bx = new THREE.Box3(), v = new THREE.Vector3(), m4 = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const add = (mat) => { for (let i = 0; i < p.count; i++) bx.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); add(m4.multiplyMatrices(n.matrixWorld, im)); } return; }
    add(n.matrixWorld);
  });
  const c = bx.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= bx.min.y; o.position.z -= c.z; });
  return g;
}
