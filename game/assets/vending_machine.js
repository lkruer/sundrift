// vending_machine — candidate C: a different breakdown, a hollow cabinet with a door.
// The cabinet is a U-shaped PLAN (back and two sides, 0.04 m walls, the four vertical outer
// edges rounded with 0.03 m arcs) extruded down from the top, so the rounding is only on the
// vertical edges, as the brief reads; a top plate and bottom plate close it; the whole front is a
// separate 0.06 m door panel (an extruded elevation with Path holes for the window and the flap)
// set flush between the jambs, with the display cavity and the flap recess built inside the
// hollow. Cans are 8-sided cylinders on two shelves, the dial a cylinder, the top stepped.
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
  const extrude = (shape, depth, m) => new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 3 }), m);

  const W = 1.0, D = 0.75, R = 0.03, T = 0.04;
  const Y0 = 0.08, Y1 = 1.79, H = Y1 - Y0;
  const ZF = D / 2, ZB = -D / 2, ZC = ZF - 0.19;
  const hx = W / 2, hz = D / 2;

  // --- shell: U-shaped plan with rounded outer corners, extruded down from the top -------
  // plan coordinates (x, z); rotation.x = PI/2 sends shape y to world +z and the extrusion to -y
  const roundedOuter = (s) => {
    s.moveTo(-hx + R, hz);
    s.absarc(-hx + R, hz - R, R, Math.PI / 2, Math.PI, false);
    s.lineTo(-hx, -hz + R);
    s.absarc(-hx + R, -hz + R, R, Math.PI, 1.5 * Math.PI, false);
    s.lineTo(hx - R, -hz);
    s.absarc(hx - R, -hz + R, R, 1.5 * Math.PI, 2 * Math.PI, false);
    s.lineTo(hx, hz - R);
    s.absarc(hx - R, hz - R, R, 0, Math.PI / 2, false);
  };
  const u = new THREE.Shape();
  roundedOuter(u);
  u.lineTo(hx - T, hz); u.lineTo(hx - T, -hz + T); u.lineTo(-hx + T, -hz + T); u.lineTo(-hx + T, hz);
  u.closePath();
  const shell = extrude(u, H, white); shell.rotation.x = Math.PI / 2; shell.position.y = Y1; g.add(shell);
  const plate = new THREE.Shape(); roundedOuter(plate); plate.closePath();
  const topPlate = extrude(plate, T, white); topPlate.rotation.x = Math.PI / 2; topPlate.position.y = Y1 + T; g.add(topPlate);
  const botPlate = extrude(plate, T, white); botPlate.rotation.x = Math.PI / 2; botPlate.position.y = Y0 + T; g.add(botPlate);
  box(0.94, 0.08, 0.69, 0, 0.04, 0, dark);                                  // plinth
  box(0.6, 0.02, 0.5, 0, Y1 + T + 0.01, -0.05, white);                       // raised top panel: the stepped silhouette

  // --- door panel: extruded elevation with the window and flap as Path holes ---------------
  const door = new THREE.Shape();
  door.moveTo(-hx + T, Y0 + T); door.lineTo(hx - T, Y0 + T); door.lineTo(hx - T, Y1); door.lineTo(-hx + T, Y1); door.closePath();
  const winHole = new THREE.Path(); winHole.moveTo(-0.43, 0.95); winHole.lineTo(-0.43, 1.67); winHole.lineTo(0.43, 1.67); winHole.lineTo(0.43, 0.95); winHole.closePath();
  const flapHole = new THREE.Path(); flapHole.moveTo(-0.25, 0.30); flapHole.lineTo(-0.25, 0.46); flapHole.lineTo(0.25, 0.46); flapHole.lineTo(0.25, 0.30); flapHole.closePath();
  door.holes.push(winHole, flapHole);
  const dp = extrude(door, 0.06, white); dp.position.z = ZF - 0.06; g.add(dp);

  // --- display cavity inside the hollow: liner box, shelves, cans, pane recessed 0.05 -------
  box(0.90, 0.76, 0.015, 0, 1.31, ZC + 0.0075, dark);
  for (const s of [1, -1]) box(0.015, 0.76, 0.16, s * 0.4425, 1.31, ZC + 0.08, dark);
  box(0.90, 0.015, 0.16, 0, 1.6825, ZC + 0.08, dark);
  box(0.90, 0.015, 0.16, 0, 0.9375, ZC + 0.08, dark);
  for (const y of [0.955, 1.305]) box(0.86, 0.02, 0.12, 0, y, ZC + 0.06, dark);
  for (let row = 0; row < 2; row++) for (let i = 0; i < 5; i++) {
    cyl(0.0325, 0.12, 8, -0.32 + 0.16 * i, (row ? 1.315 : 0.965) + 0.06, ZC + 0.07, canCols[(i + 2 * row) % 5]);
  }
  box(0.86, 0.72, 0.01, 0, 1.31, ZF - 0.055, glass);
  box(0.86, 0.06, 0.02, 0, 1.70, ZF + 0.01, lamp);

  // --- pick-up recess inside the hollow and its tilted flap ---------------------------------
  box(0.54, 0.20, 0.015, 0, 0.38, ZF - 0.0675, dark);
  for (const s of [1, -1]) box(0.015, 0.20, 0.08, s * 0.2625, 0.38, ZF - 0.04, dark);
  box(0.54, 0.015, 0.08, 0, 0.4725, ZF - 0.04, dark);
  box(0.54, 0.015, 0.08, 0, 0.2875, ZF - 0.04, dark);
  const lid = box(0.46, 0.13, 0.02, 0, 0.385, ZF - 0.035, white); lid.rotation.x = 0.35;

  // --- control panel, dial, coin plate -----------------------------------------------------
  box(0.22, 0.30, 0.02, 0.30, 0.72, ZF + 0.01, dark);
  cyl(0.05, 0.02, 12, 0.30, 0.80, ZF + 0.03, galv, Math.PI / 2);
  box(0.03, 0.10, 0.01, 0.30, 0.65, ZF + 0.025, white);

  // --- sides and back: vents, trim band, hatch frame, conduit ------------------------------
  for (const s of [1, -1]) {
    for (let k = 0; k < 6; k++) box(0.01, 0.02, 0.4, s * (hx + 0.005), 0.28 + 0.05 * k, -0.05, dark);
    box(0.01, 0.06, 0.69, s * (hx + 0.005), 1.70, 0, verm);
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
