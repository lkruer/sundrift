// power_pole — candidate B: profiles. The column is ONE 10-segment LatheGeometry (taper 0.30 -> 0.19 m dia)
// over a separate dark lathe base collar and under a galvanised lathe cap sleeve; every insulator is a
// 6-segment lathe with a real petticoat profile (galvanised pin, skirt, waist, head); the cross-arms are
// extruded C-channel Shapes (0.08 m square section) clamped by boxes; the transformer can is one lathe with
// a bottom rim, a lid lip and a domed top carrying two lathe bushings; the step bolts are lathes with a
// foot-stop knob. Every profile runs bottom to top. Two insulators per arm and one on the cap.
export default function (THREE) {
  const g = new THREE.Group();
  const M = (color, o = {}, name) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0, ...o }); if (name) m.name = name; return m; };
  const put = (geo, mat, p, r) => { const m = new THREE.Mesh(geo, mat); if (p) m.position.set(p[0], p[1], p[2]); if (r) m.rotation.set(r[0], r[1], r[2]); g.add(m); return m; };
  const lathe = (pts, segs) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), segs);
  const poly = (pts) => { const s = new THREE.Shape(); pts.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]))); s.closePath(); return s; };
  const extrude = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  const concrete = M(0xa8a49c, { roughness: 0.9 }, 'plaster');
  const galv = M(0xb9bcc0, { roughness: 0.5, metalness: 0.6 }, 'metal');
  const white = M(0xe8e4da, { roughness: 0.35 });
  const dark = M(0x2b2d31, { roughness: 0.4 });
  const rAt = (y) => 0.15 - 0.055 * (y / 9);

  // column: 0.30 dia at the foot to 0.19 dia at the top; dark collar; galvanised cap sleeve
  put(lathe([[0, 0], [0.15, 0], [0.095, 8.95], [0.095, 9.0], [0, 9.0]], 10), concrete);
  put(lathe([[0, 0], [0.17, 0], [0.165, 0.33], [0.15, 0.36], [0, 0.36]], 10), dark);
  put(lathe([[0.09, 8.9], [0.105, 8.9], [0.105, 9.02], [0, 9.02]], 10), galv);

  // insulator: galvanised pin and a white petticoat body, 6 segments
  const insulator = (x, y) => {
    put(lathe([[0, 0], [0.018, 0], [0.018, 0.035], [0, 0.035]], 6), galv, [x, y, 0]);
    put(lathe([[0, 0.03], [0.042, 0.045], [0.03, 0.065], [0.04, 0.095], [0.028, 0.12], [0, 0.125]], 6), white, [x, y, 0]);
  };
  // cross-arm: C-channel section 0.08 x 0.08 with a 0.02 web, extruded along X
  const channel = (len) => extrude(poly([[-0.04, -0.04], [0.04, -0.04], [0.04, -0.02], [-0.02, -0.02], [-0.02, 0.02], [0.04, 0.02], [0.04, 0.04], [-0.04, 0.04]]), len);
  const arm = (y, len, xs) => {
    put(channel(len), galv, [-len / 2, y, 0], [0, Math.PI / 2, 0]);
    const r = rAt(y) + 0.03;
    put(new THREE.BoxGeometry(0.06, 0.18, 0.16), galv, [r, y, 0]);
    put(new THREE.BoxGeometry(0.06, 0.18, 0.16), galv, [-r, y, 0]);
    for (const x of xs) insulator(x, y + 0.04);
  };
  arm(8.4, 0.9, [-0.36, 0.36]);
  arm(7.6, 0.6, [-0.22, 0.22]);
  insulator(0, 9.02);

  // transformer can: one 8-segment lathe hung on +X at 7 m by two straps, two bushings on the dome
  const cx = 0.29;
  put(lathe([[0, 0], [0.19, 0], [0.19, 0.03], [0.175, 0.03], [0.175, 0.57], [0.19, 0.57], [0.19, 0.6], [0.14, 0.63], [0, 0.63]], 8), dark, [cx, 6.7, 0]);
  put(lathe([[0, 0], [0.025, 0], [0.02, 0.06], [0.025, 0.1], [0, 0.1]], 6), white, [cx - 0.08, 7.32, 0]);
  put(lathe([[0, 0], [0.025, 0], [0.02, 0.06], [0.025, 0.1], [0, 0.1]], 6), white, [cx + 0.08, 7.32, 0]);
  put(new THREE.BoxGeometry(0.22, 0.05, 0.08), galv, [rAt(7.2) + 0.06, 7.22, 0]);
  put(new THREE.BoxGeometry(0.22, 0.05, 0.08), galv, [rAt(6.8) + 0.06, 6.78, 0]);

  // step bolts: a lathe built along +Y then laid along X, foot-stop knob at the end
  const bolt = lathe([[0, 0], [0.02, 0], [0.02, 0.2], [0.035, 0.2], [0.035, 0.25], [0, 0.25]], 6);
  put(bolt, galv, [0.04, 2.0, 0], [0, 0, -Math.PI / 2]);
  put(bolt, galv, [-0.04, 2.5, 0], [0, 0, Math.PI / 2]);

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
