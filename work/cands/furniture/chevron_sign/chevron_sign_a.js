// chevron_sign — candidate A: assembled from primitives. A galvanised post with a dark foot sleeve, a board
// made of a maple-gold face plate over a galvanised back plate, a dark border of four thin bars raised
// 0.01 off the face, three chevrons each built from two rotated dark bars pointing +X, two dark clamp
// blocks and two horizontal stiffening rails on the back of the board.
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
  const galv = M(0xb9bcc0, { roughness: 0.5, metalness: 0.6 }, 'metal');
  const gold = M(0xe8b52a);
  const dark = M(0x2b2d31, { roughness: 0.4 });

  const PZ = -0.04;                                   // post axis, behind the board
  // post 0.06 dia x 1.35, dark foot sleeve, small cap
  put(new THREE.CylinderGeometry(0.03, 0.03, 1.35, 10), galv, [0, 0.675, PZ]);
  put(new THREE.CylinderGeometry(0.038, 0.038, 0.08, 10), dark, [0, 0.04, PZ]);
  put(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 10), galv, [0, 1.35, PZ]);
  // board 0.92 x 0.60 x 0.04, y 1.20..1.80: gold face plate (z 0.02..0.04) on a galvanised back plate (z 0..0.02)
  put(new THREE.BoxGeometry(0.92, 0.60, 0.02), gold, [0, 1.50, 0.03]);
  put(new THREE.BoxGeometry(0.92, 0.60, 0.02), galv, [0, 1.50, 0.01]);
  // dark border 0.03 wide, 0.01 proud of the face
  put(new THREE.BoxGeometry(0.92, 0.03, 0.01), dark, [0, 1.785, 0.045]);
  put(new THREE.BoxGeometry(0.92, 0.03, 0.01), dark, [0, 1.215, 0.045]);
  put(new THREE.BoxGeometry(0.03, 0.54, 0.01), dark, [-0.445, 1.50, 0.045]);
  put(new THREE.BoxGeometry(0.03, 0.54, 0.01), dark, [0.445, 1.50, 0.045]);
  // three chevrons 0.22 wide x 0.46 tall pointing +X: two bars 0.06 thick per chevron, meeting at the tip
  const ang = Math.atan2(0.23, 0.22);                 // slope of each arm
  const bar = new THREE.BoxGeometry(0.30, 0.06, 0.01);
  const ox = -0.03 * Math.sin(ang) - 0.01 * Math.cos(ang);       // bar centre offset from the outer-edge midpoint
  const oy = 0.115 - 0.03 * Math.cos(ang) + 0.01 * Math.sin(ang);
  for (const cx of [-0.29, 0, 0.29]) {
    put(bar, dark, [cx + ox, 1.50 + oy, 0.045], [0, 0, -ang]);
    put(bar, dark, [cx + ox, 1.50 - oy, 0.045], [0, 0, ang]);
  }
  // back of the board: two stiffening rails and two dark clamp blocks round the post
  for (const y of [1.42, 1.66]) put(new THREE.BoxGeometry(0.86, 0.05, 0.02), galv, [0, y, -0.01]);
  for (const y of [1.24, 1.32]) put(new THREE.BoxGeometry(0.10, 0.04, 0.07), dark, [0, y, -0.035]);

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
