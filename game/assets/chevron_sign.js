// chevron_sign — WINNER (candidate B): profile route. The board is two ExtrudeGeometry rounded rectangles (gold face
// over a galvanised back, no bevel), the border an extruded frame (a Shape with a rectangular hole), each
// chevron an extruded ">" Shape pointing +X, the post a LatheGeometry with a foot flare and domed top, the
// clamps lathe rings with small blocks to the board, the back stiffeners extruded C-channels along X.
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
  const gold = M(0xe8b52a);
  const dark = M(0x2b2d31, { roughness: 0.4 });

  const PZ = -0.04;
  // post: foot flare 0.076 dia, 0.06 shaft, domed top at 1.35
  put(lathe([[0, 0], [0.038, 0], [0.038, 0.06], [0.03, 0.08], [0.03, 1.33], [0.02, 1.35], [0, 1.35]], 10), galv, [0, 0, PZ]);
  // board: galvanised back 0.02 (z 0..0.02) and gold face 0.02 (z 0.02..0.04), rounded corners r 0.04
  put(extrude(rrect(0.92, 0.60, 0.04), 0.02), galv, [0, 1.50, 0]);
  put(extrude(rrect(0.92, 0.60, 0.04), 0.02), gold, [0, 1.50, 0.02]);
  // border: 0.03 frame with a hole, 0.01 proud of the face
  const frame = poly([[-0.46, -0.30], [0.46, -0.30], [0.46, 0.30], [-0.46, 0.30]]);
  const hole = new THREE.Path();
  hole.moveTo(-0.43, -0.27); hole.lineTo(-0.43, 0.27); hole.lineTo(0.43, 0.27); hole.lineTo(0.43, -0.27); hole.closePath();
  frame.holes.push(hole);
  put(extrude(frame, 0.01), dark, [0, 1.50, 0.04]);
  // three chevrons: ">" 0.22 wide x 0.46 tall, stroke 0.06 across the arm, pointing +X
  const tw = 0.06 / Math.sin(Math.atan2(0.23, 0.22));            // horizontal width of the stroke
  const chev = poly([[-0.11, 0.23], [-0.11 + tw, 0.23], [0.11, 0], [-0.11 + tw, -0.23], [-0.11, -0.23], [0.11 - tw, 0]]);
  const chevGeo = extrude(chev, 0.01);
  for (const cx of [-0.29, 0, 0.29]) put(chevGeo, dark, [cx, 1.50, 0.04]);
  // clamps: dark lathe rings round the post with blocks to the board back
  const ring = lathe([[0.03, -0.02], [0.042, -0.02], [0.042, 0.02], [0.03, 0.02], [0.03, -0.02]], 10);
  for (const y of [1.24, 1.32]) {
    put(ring, dark, [0, y, PZ]);
    put(new THREE.BoxGeometry(0.08, 0.04, 0.04), dark, [0, y, -0.02]);
  }
  // back stiffeners: C-channel section extruded 0.86 along +X (rotation.y = PI/2 sends local +z to +X and
  // local +x to -Z, so the open side faces away from the board)
  const cSec = poly([[0, -0.025], [0.02, -0.025], [0.02, -0.015], [0.006, -0.015], [0.006, 0.015], [0.02, 0.015], [0.02, 0.025], [0, 0.025]]);
  const rail = extrude(cSec, 0.86);
  for (const y of [1.42, 1.66]) put(rail, galv, [-0.43, y, 0], [0, Math.PI / 2, 0]);

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
