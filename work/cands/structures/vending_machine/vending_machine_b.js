// vending_machine — candidate B: profile route.
// The cabinet is ONE bevelled ExtrudeGeometry of the front elevation with two Path holes (the
// display window and the pick-up flap), corrected for the bevel: the rectangle is drawn 0.06 m
// smaller in width and height, the holes 0.06 m larger, and the depth 0.06 m shorter, so after
// bevelSize/bevelThickness 0.03 it measures 1.0 x 1.75 x 0.75 with 0.03 m rounded edges and
// 0.86 x 0.72 / 0.5 x 0.16 openings with rounded reveals. White plugs behind the holes close the
// through-cuts (the window plug stops 0.03 m short of the back, which reads as the service hatch);
// cans, dial, hood and conduit are lathes; every flat part is an extruded rectangle.
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (hex, rough, name, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: 0 }, extra || {}));
    if (name) m.name = name;
    return m;
  };
  const white = mat(0xe8e4da, 0.35);
  const dark = mat(0x2b2d31, 0.35);
  const darkDS = mat(0x2b2d31, 0.35, null, { side: THREE.DoubleSide });
  const galvDS = mat(0xb9bcc0, 0.5, 'metal', { metalness: 0.6, side: THREE.DoubleSide });
  const verm = mat(0xc9402b, 0.35);
  const glass = mat(0x1c2a33, 0.1, null, { transparent: true, opacity: 0.35 });
  const lamp = mat(0xffcf7a, 0.35, null, { emissive: 0xffcf7a, emissiveIntensity: 1.2 });
  const canCols = [0xc9402b, 0xe8b52a, 0x2f5a3a, 0xe8e4da, 0xd11c1c].map((c) => mat(c, 0.35, null, { side: THREE.DoubleSide }));

  const poly = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s; };
  const rect = (x0, y0, x1, y1) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  const hole = (x0, y0, x1, y1) => { const p = new THREE.Path(); p.moveTo(x0, y0); p.lineTo(x0, y1); p.lineTo(x1, y1); p.lineTo(x1, y0); p.closePath(); return p; };
  // a flat extrusion in the front elevation: z0 is its back plane, t its thickness toward +z
  const slab = (shapes, t, z0, m, ry) => {
    const n = new THREE.Mesh(new THREE.ExtrudeGeometry(shapes, { depth: t, bevelEnabled: false, curveSegments: 4 }), m);
    n.position.z = z0; if (ry) n.rotation.y = ry; g.add(n); return n;
  };
  const lathe = (pts, segs, m, x, y, z, rx) => {
    const n = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), segs), m);
    n.position.set(x, y, z); if (rx) n.rotation.x = rx; g.add(n); return n;
  };

  const B = 0.03, ZF = 0.375, ZB = -0.375, Y0 = 0.08, Y1 = 1.79;

  // --- cabinet: bevelled extrusion, drawn smaller by the bevel so it measures true ------
  const body = rect(-0.5 + B, Y0 + B, 0.5 - B, Y1 - B);
  body.holes.push(hole(-0.43 - B, 0.95 - B, 0.43 + B, 1.67 + B));      // display window, 0.86 x 0.72 after the bevel
  body.holes.push(hole(-0.25 - B, 0.30 - B, 0.25 + B, 0.46 + B));      // pick-up flap, 0.5 x 0.16 after the bevel
  const cab = new THREE.Mesh(new THREE.ExtrudeGeometry(body, {
    depth: (ZF - ZB) - 2 * B, bevelEnabled: true, bevelSize: B, bevelThickness: B, bevelOffset: 0, bevelSegments: 2, curveSegments: 4,
  }), white);
  cab.position.z = ZB + B;                     // bevel adds B beyond each cap: spans ZB..ZF
  g.add(cab);
  // plugs behind the through-cuts: the window plug ends 0.03 m inside the back (service hatch)
  slab(rect(-0.45, 0.93, 0.45, 1.69), 0.535, ZB + 0.03, white);
  slab(rect(-0.27, 0.28, 0.27, 0.48), 0.66, ZB + 0.03, white);

  // plinth (dark) and stepped top cap: plan rectangles extruded along y
  const plinth = slab(rect(-0.47, -0.345, 0.47, 0.345), 0.08, 0, dark); plinth.rotation.x = -Math.PI / 2; plinth.position.set(0, 0, 0);
  const capTop = slab(rect(-0.48, -0.355, 0.48, 0.355), 0.04, 0, white); capTop.rotation.x = -Math.PI / 2; capTop.position.set(0, Y1, 0);

  // --- display cavity: dark liner, two shelves, ten lathe cans, pane recessed 0.05 -----------
  const ZC = ZF - 0.19;
  slab(rect(-0.43, 0.95, 0.43, 1.67), 0.015, ZC, dark);
  for (const s of [1, -1]) slab(rect(s * 0.43 - (s > 0 ? 0.015 : 0), 0.95, s * 0.43 + (s > 0 ? 0 : 0.015), 1.67), 0.13, ZC, dark);
  for (const y of [0.95, 1.30]) slab(rect(-0.43, y, 0.43, y + 0.02), 0.12, ZC, dark);
  const can = [[0, 0], [0.03, 0], [0.0325, 0.012], [0.0325, 0.105], [0.028, 0.12], [0, 0.12]];
  for (let row = 0; row < 2; row++) for (let i = 0; i < 5; i++) {
    lathe(can, 8, canCols[(i + 2 * row) % 5], -0.32 + 0.16 * i, row ? 1.32 : 0.97, ZC + 0.07);
  }
  slab(rect(-0.43, 0.95, 0.43, 1.67), 0.01, ZF - 0.06, glass);
  slab(rect(-0.43, 1.67, 0.43, 1.73), 0.02, ZF - 0.02, lamp);

  // --- pick-up flap: dark liner inside the recess and a tilted lid ------------------------
  slab(rect(-0.25, 0.30, 0.25, 0.46), 0.01, ZF - 0.06, dark);
  const lid = slab(rect(-0.23, -0.065, 0.23, 0.065), 0.02, 0, white); lid.position.set(0, 0.385, ZF - 0.045); lid.rotation.x = 0.35;

  // --- control panel: rounded-corner plate with a hole for the lathe dial, coin plate ------
  const cp = new THREE.Shape();
  cp.moveTo(0.21, 0.57); cp.lineTo(0.39, 0.57); cp.quadraticCurveTo(0.41, 0.57, 0.41, 0.59);
  cp.lineTo(0.41, 0.85); cp.quadraticCurveTo(0.41, 0.87, 0.39, 0.87); cp.lineTo(0.21, 0.87);
  cp.quadraticCurveTo(0.19, 0.87, 0.19, 0.85); cp.lineTo(0.19, 0.59); cp.quadraticCurveTo(0.19, 0.57, 0.21, 0.57); cp.closePath();
  const dialHole = new THREE.Path(); dialHole.absarc(0.30, 0.80, 0.055, 0, Math.PI * 2, true); cp.holes.push(dialHole);
  slab(cp, 0.02, ZF, dark);
  lathe([[0, 0], [0.05, 0], [0.05, 0.015], [0.04, 0.03], [0.015, 0.035], [0, 0.035]], 12, galvDS, 0.30, 0.80, ZF - 0.005, Math.PI / 2);
  slab(rect(0.285, 0.60, 0.315, 0.70), 0.01, ZF + 0.02, white);

  // --- sides and back: vents, trim band, conduit -----------------------------------------
  const ventShapes = (u) => { const a = []; for (let k = 0; k < 6; k++) a.push(rect(u - 0.2, 0.27 + 0.05 * k, u + 0.2, 0.29 + 0.05 * k)); return a; };
  for (const s of [1, -1]) {
    const v1 = slab(ventShapes(0.05), 0.01, 0, dark, s * Math.PI / 2); v1.position.set(s * 0.5, 0, 0);
    const t = slab(rect(-0.345, 1.67, 0.345, 1.73), 0.01, 0, verm, s * Math.PI / 2); t.position.set(s * 0.5, 0, 0);
  }
  slab(rect(-0.47, 1.67, 0.47, 1.73), 0.01, ZB - 0.01, verm);
  slab(ventShapes(-0.2), 0.01, ZB - 0.01, dark);
  lathe([[0.02, 0], [0.02, 1.3]], 8, galvDS, 0.42, 0.10, ZB - 0.02);
  for (const y of [0.3, 1.2]) slab(rect(0.39, y - 0.02, 0.45, y + 0.02), 0.03, ZB - 0.03, galvDS);

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
