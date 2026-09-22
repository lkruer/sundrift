// guardrail_post — candidate C: a different part breakdown. The post is a LIPPED channel (web, two flanges
// and two inward lips, five boxes) so the -Z face shows a narrow slot with the web deep inside; the base
// plate carries two gusset ribs against the post; the reflector sits on a small square backing plate; the
// spacer block is a plain block; anchor bolts and the channel cap are dark.
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

  const H = 0.73;
  // lipped channel 0.10 x 0.06: web on the road side, flanges back, lips turned inward at the rear edge
  put(new THREE.BoxGeometry(0.10, H, 0.03), galv, [0, H / 2, 0.015]);
  for (const sx of [-1, 1]) {
    put(new THREE.BoxGeometry(0.02, H, 0.03), galv, [sx * 0.04, H / 2, -0.015]);
    put(new THREE.BoxGeometry(0.015, H, 0.012), galv, [sx * 0.0225, H / 2, -0.024]);
  }
  put(new THREE.BoxGeometry(0.104, 0.02, 0.064), dark, [0, H + 0.01, 0]);
  // base plate with two gusset ribs against the web sides
  put(new THREE.BoxGeometry(0.16, 0.02, 0.12), galv, [0, 0.01, 0.03]);
  for (const sx of [-1, 1]) put(new THREE.BoxGeometry(0.012, 0.06, 0.05), galv, [sx * 0.055, 0.05, 0.025]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    put(new THREE.CylinderGeometry(0.012, 0.012, 0.016, 6), dark, [sx * 0.068, 0.028, 0.03 + sz * 0.045]);
  }
  // spacer block on the road face
  put(new THREE.BoxGeometry(0.10, 0.14, 0.08), galv, [0, 0.55, 0.07]);
  // reflector on a square backing plate
  put(new THREE.BoxGeometry(0.09, 0.09, 0.006), galv, [0, 0.66, 0.033]);
  put(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 12), red, [0, 0.66, 0.041], [Math.PI / 2, 0, 0]);

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
