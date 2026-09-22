// guardrail_post — candidate A: assembled from primitives (Box / Cylinder only).
// C-channel = a solid web box on the road side (+Z) plus two flange boxes running back from it, so the
// channel recess on the -Z face is real geometry. The base plate is centred under the post+spacer footprint
// so the whole post stays inside the depth band (post 0.06 + spacer 0.08 = 0.14 m). Steel is galvanised,
// the anchor bolts, flange bolts and the cap that closes the channel top are dark, the reflector is red.
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
  const dark = M(0x2b2d31, { roughness: 0.6 });
  const red  = M(0xd11c1c, { roughness: 0.35, emissive: 0xd11c1c, emissiveIntensity: 0.6 });

  const H = 0.73;                                                   // steel to 0.73, cap takes it to 0.75
  // C-channel 0.10 wide x 0.06 deep: web fills z 0..0.03, flanges run back to z -0.03 leaving the recess
  put(new THREE.BoxGeometry(0.10, H, 0.03), galv, [0, H / 2, 0.015]);
  put(new THREE.BoxGeometry(0.02, H, 0.03), galv, [-0.04, H / 2, -0.015]);
  put(new THREE.BoxGeometry(0.02, H, 0.03), galv, [0.04, H / 2, -0.015]);
  // dark cap closing the open channel top
  put(new THREE.BoxGeometry(0.104, 0.02, 0.064), dark, [0, H + 0.01, 0]);
  // base plate 0.16 x 0.12 x 0.02 under the post + spacer footprint
  put(new THREE.BoxGeometry(0.16, 0.02, 0.12), galv, [0, 0.01, 0.03]);
  // four anchor bolts, hex heads
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    put(new THREE.CylinderGeometry(0.012, 0.012, 0.016, 6), dark, [sx * 0.065, 0.028, 0.03 + sz * 0.045]);
  }
  // spacer block 0.10 x 0.14 x 0.08 on the road face, 0.48..0.62 m up
  put(new THREE.BoxGeometry(0.10, 0.14, 0.08), galv, [0, 0.55, 0.07]);
  // through-bolt heads on both flanges at spacer height
  for (const sx of [-1, 1]) {
    put(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 6), dark, [sx * 0.056, 0.55, -0.015], [0, 0, Math.PI / 2]);
  }
  // round red reflector 0.07 dia x 0.01 on the front face at 0.66 m
  put(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 12), red, [0, 0.66, 0.035], [Math.PI / 2, 0, 0]);

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
