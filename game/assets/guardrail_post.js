// guardrail_post — WINNER (candidate B): profile route. The C-channel is one ExtrudeGeometry of a C-shaped Shape
// swept up the height (no bevel), the base plate is an extruded chamfered rectangle, the spacer is an
// extruded I-section (so its flanges read from the sides), the reflector and the four anchor bolts are
// LatheGeometry (a domed lens, hex bolt heads with 6 lathe segments).
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
  const V2 = (x, y) => new THREE.Vector2(x, y);
  const poly = (pts) => { const s = new THREE.Shape(); pts.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]))); s.closePath(); return s; };
  const extrude = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });

  const galv = M(0xb9bcc0, { roughness: 0.5, metalness: 0.6 }, 'metal');
  const dark = M(0x2b2d31, { roughness: 0.6 });
  const red  = M(0xd11c1c, { roughness: 0.35, emissive: 0xd11c1c, emissiveIntensity: 0.6 });

  const H = 0.73;
  // Shapes drawn in (x, y) and extruded along local +z; rotation.x = -PI/2 turns that into world +Y
  // and maps shape y onto world -Z, so the web (world z 0.01..0.03) is drawn at shape y -0.03..-0.01 and
  // the flanges (world z -0.03..0.01) at shape y -0.01..0.03: a 0.07 x 0.04 recess open to the back.
  const cShape = poly([[-0.05, -0.03], [0.05, -0.03], [0.05, 0.03], [0.035, 0.03], [0.035, -0.01], [-0.035, -0.01], [-0.035, 0.03], [-0.05, 0.03]]);
  put(extrude(cShape, H), galv, [0, 0, 0], [-Math.PI / 2, 0, 0]);
  // dark cap closing the channel top
  put(new THREE.BoxGeometry(0.104, 0.02, 0.06), dark, [0, H + 0.01, 0]);
  // base plate: chamfered 0.16 x 0.12 rectangle, centred under the post + spacer footprint (world z 0.03)
  const plate = poly([[-0.06, -0.09], [0.06, -0.09], [0.08, -0.07], [0.08, 0.01], [0.06, 0.03], [-0.06, 0.03], [-0.08, 0.01], [-0.08, -0.07]]);
  put(extrude(plate, 0.02), galv, [0, 0, 0], [-Math.PI / 2, 0, 0]);
  // hex anchor bolts: 6-segment lathe of a bolt-head profile
  const bolt = new THREE.LatheGeometry([V2(0, 0), V2(0.013, 0), V2(0.013, 0.014), V2(0, 0.014)], 6);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(bolt, dark, [sx * 0.065, 0.02, 0.03 + sz * 0.045]);
  // spacer block 0.10 x 0.14 x 0.08 as an I-section extruded toward the road (+Z)
  const iSec = poly([[-0.05, -0.07], [0.05, -0.07], [0.05, -0.045], [0.016, -0.045], [0.016, 0.045], [0.05, 0.045],
    [0.05, 0.07], [-0.05, 0.07], [-0.05, 0.045], [-0.016, 0.045], [-0.016, -0.045], [-0.05, -0.045]]);
  put(extrude(iSec, 0.08), galv, [0, 0.55, 0.03]);
  // reflector: lathe of a shallow domed lens, 0.07 dia, axis turned to +Z
  const lens = new THREE.LatheGeometry([V2(0, 0), V2(0.035, 0), V2(0.035, 0.005), V2(0.022, 0.011), V2(0, 0.012)], 10);
  put(lens, red, [0, 0.66, 0.03], [Math.PI / 2, 0, 0]);

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
