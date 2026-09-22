// vending_machine — candidate A: primitives.
// A lane-white cabinet from crossing boxes with 8-sided corner cylinders giving the 0.03 m
// rounded vertical edges; the front is a separate 0.19 m layer built in pieces around a real
// window cavity (dark liner, two shelves, ten cans behind a tinted pane set 0.05 m back) and a
// real pick-up recess with a tilted flap; chrome-dark plinth, control panel with a dial, lamp
// strip over the window, a stepped top cap; side vents, a trim band and a back conduit so the
// sides and back are modelled too.
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (hex, rough, name, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: 0 }, extra || {}));
    if (name) m.name = name;
    return m;
  };
  const white = mat(0xe8e4da, 0.35);
  const dark = mat(0x2b2d31, 0.35);
  const galv = mat(0xb9bcc0, 0.5, 'metal', { metalness: 0.6 });
  const verm = mat(0xc9402b, 0.35);
  const glass = mat(0x1c2a33, 0.1, null, { transparent: true, opacity: 0.35 });
  const lamp = mat(0xffcf7a, 0.35, null, { emissive: 0xffcf7a, emissiveIntensity: 1.2 });
  const canCols = [0xc9402b, 0xe8b52a, 0x2f5a3a, 0xe8e4da, 0xd11c1c].map((c) => mat(c, 0.35));

  const box = (w, h, d, x, y, z, m) => {
    const n = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    n.position.set(x, y, z); g.add(n); return n;
  };
  const cyl = (r, h, segs, x, y, z, m, rx) => {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segs), m);
    n.position.set(x, y, z); if (rx) n.rotation.x = rx; g.add(n); return n;
  };

  const W = 1.0, D = 0.75, R = 0.03;
  const Y0 = 0.08, Y1 = 1.79, H = Y1 - Y0, YC = (Y0 + Y1) / 2;
  const ZF = D / 2, ZB = -D / 2, ZC = ZF - 0.19;          // front face, back face, core front plane

  // --- plinth, top cap ----------------------------------------------------------------
  box(0.94, 0.08, 0.69, 0, 0.04, 0, dark);
  box(0.96, 0.04, 0.71, 0, 1.81, 0, white);

  // --- core: crossing boxes, rounded back corners --------------------------------------
  box(W - 2 * R, H, ZC - ZB, 0, YC, (ZC + ZB) / 2, white);
  box(W, H, ZC - ZB - R, 0, YC, (ZC + ZB + R) / 2, white);
  for (const s of [1, -1]) cyl(R, H, 8, s * (W / 2 - R), YC, ZB + R, white);

  // --- front layer: piers with rounded front corners, bands around the openings ----------
  for (const s of [1, -1]) {
    box(0.04, H, ZF - ZC, s * 0.45, YC, (ZC + ZF) / 2, white);
    box(0.07, H, ZF - R - ZC, s * 0.465, YC, (ZC + ZF - R) / 2, white);
    cyl(R, H, 8, s * (W / 2 - R), YC, ZF - R, white);
  }
  const band = (y0, y1, x0, x1, zf) => box(x1 - x0, y1 - y0, zf - ZC, (x0 + x1) / 2, (y0 + y1) / 2, (ZC + zf) / 2, white);
  band(Y0, 0.30, -0.43, 0.43, ZF);                       // bottom
  band(0.30, 0.46, -0.43, -0.25, ZF); band(0.30, 0.46, 0.25, 0.43, ZF);
  band(0.30, 0.46, -0.25, 0.25, ZF - 0.06);              // flap recess back
  band(0.46, 0.95, -0.43, 0.43, ZF);                     // control band
  band(1.67, 1.73, -0.43, 0.43, ZF - 0.02);              // lamp strip seat
  band(1.73, Y1, -0.43, 0.43, ZF);                       // top band
  box(0.86, 0.06, 0.02, 0, 1.70, ZF - 0.01, lamp);

  // --- display cavity: liner, shelves, cans, tinted pane recessed 0.05 -------------------
  box(0.86, 0.72, 0.015, 0, 1.31, ZC + 0.0075, dark);
  for (const s of [1, -1]) box(0.015, 0.72, 0.13, s * 0.4225, 1.31, ZC + 0.065, dark);
  box(0.86, 0.015, 0.13, 0, 1.6625, ZC + 0.065, dark);
  for (const y of [0.96, 1.31]) box(0.86, 0.02, 0.12, 0, y, ZC + 0.06, dark);
  for (let row = 0; row < 2; row++) for (let i = 0; i < 5; i++) {
    cyl(0.0325, 0.12, 10, -0.32 + 0.16 * i, (row ? 1.32 : 0.97) + 0.06, ZC + 0.07, canCols[(i + 2 * row) % 5]);
  }
  box(0.86, 0.72, 0.01, 0, 1.31, ZF - 0.055, glass);

  // --- pick-up flap, control panel with dial and coin plate -----------------------------
  box(0.5, 0.16, 0.01, 0, 0.38, ZF - 0.055, dark);
  const lid = box(0.46, 0.13, 0.02, 0, 0.385, ZF - 0.035, white); lid.rotation.x = 0.35;
  box(0.22, 0.30, 0.02, 0.30, 0.72, ZF + 0.01, dark);
  cyl(0.05, 0.02, 12, 0.30, 0.80, ZF + 0.03, galv, Math.PI / 2);
  box(0.03, 0.10, 0.01, 0.30, 0.65, ZF + 0.025, white);

  // --- sides and back: vents, trim band, hatch outline, conduit ------------------------
  for (const s of [1, -1]) {
    for (let k = 0; k < 6; k++) box(0.01, 0.02, 0.4, s * (W / 2 + 0.005), 0.28 + 0.05 * k, -0.05, dark);
    box(0.01, 0.06, 0.69, s * (W / 2 + 0.005), 1.70, 0, verm);
  }
  box(0.94, 0.06, 0.01, 0, 1.70, ZB - 0.005, verm);
  for (const y of [0.50, 1.50]) box(0.70, 0.03, 0.01, -0.05, y, ZB - 0.005, dark);
  for (const x of [-0.40, 0.30]) box(0.03, 1.03, 0.01, x, 1.0, ZB - 0.005, dark);
  cyl(0.02, 1.3, 8, 0.42, 0.75, ZB - 0.02, galv);
  for (const y of [0.3, 1.2]) box(0.06, 0.04, 0.03, 0.42, y, ZB - 0.015, galv);
  for (let k = 0; k < 6; k++) box(0.3, 0.02, 0.01, -0.2, 0.22 + 0.05 * k, ZB - 0.005, dark);

  // --- ground and centre by measuring vertices -----------------------------------
  const bb = new THREE.Box3(), v = new THREE.Vector3(), m4 = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const put = (mt) => { for (let i = 0; i < p.count; i++) bb.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mt)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); put(m4.multiplyMatrices(n.matrixWorld, im)); } return; }
    put(n.matrixWorld);
  });
  const ctr = bb.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= ctr.x; o.position.y -= bb.min.y; o.position.z -= ctr.z; });
  return g;
}
