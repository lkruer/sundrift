// torii_gate — candidate B: profile route.
// Lathe drums with a flared foot, lathe pillars with a slight entasis, the nuki and the kasagi as
// ExtrudeGeometry of front-elevation Shapes: the kasagi is ONE curved sweep whose bottom and top
// edges are quadratic curves that rise 0.25 m at the ends, and the chrome-dark cap is a second
// extrusion on the same curve. Kusabi are extruded tapered wedges, the tablet an extruded
// rectangle hung on a strut. No bevels anywhere.
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (hex, rough, name, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: 0 }, extra || {}));
    if (name) m.name = name;
    return m;
  };
  const verm = mat(0xc9402b, 0.6);
  const vermDS = mat(0xc9402b, 0.6, null, { side: THREE.DoubleSide });          // lathes
  const stone = mat(0x8a7f72, 0.95, 'stone', { flatShading: true, side: THREE.DoubleSide });
  const dark = mat(0x2b2d31, 0.35);
  const darkDS = mat(0x2b2d31, 0.35, null, { side: THREE.DoubleSide });

  const lathe = (pts, segs, m) => new THREE.Mesh(
    new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs), m);
  const extrude = (shape, depth, m, segs) => new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: segs || 12 }), m);

  const LEAN = 3 * Math.PI / 180, PX = 2.2, PLINTH_H = 0.22;

  // --- stone drums: 0.72 m dia body, flared 0.9 m foot, a bead below the top ---
  for (const s of [1, -1]) {
    const d = lathe([[0, 0], [0.45, 0], [0.45, 0.05], [0.38, 0.10], [0.37, 0.16], [0.38, 0.18], [0.36, 0.22], [0, 0.22]], 16, stone);
    d.position.set(s * PX, 0, 0); g.add(d);
  }

  // --- pillars: 0.42 m at the foot easing to 0.39 m at the top, leaning 3 degrees ---
  for (const s of [1, -1]) {
    const hub = new THREE.Group();
    hub.position.set(s * PX, PLINTH_H, 0); hub.rotation.z = s * LEAN; g.add(hub);
    hub.add(lathe([[0, -0.06], [0.21, -0.06], [0.21, 0.5], [0.207, 2.4], [0.195, 4.62], [0, 4.62]], 20, vermDS));
    hub.add(lathe([[0.235, 0], [0.235, 0.15], [0.215, 0.19]], 20, darkDS));   // dark foot collar
  }
  const pillarX = (y) => PX - (y - PLINTH_H) * Math.tan(LEAN);

  // --- nuki: an extruded elevation with its ends cut back a little ------------
  const nk = new THREE.Shape();
  nk.moveTo(-2.8, 3.36); nk.lineTo(-2.72, 3.30); nk.lineTo(2.72, 3.30); nk.lineTo(2.8, 3.36);
  nk.lineTo(2.8, 3.48); nk.lineTo(2.72, 3.54); nk.lineTo(-2.72, 3.54); nk.lineTo(-2.8, 3.48); nk.closePath();
  const nuki = extrude(nk, 0.20, verm); nuki.position.z = -0.10; g.add(nuki);

  // --- kusabi: tapered wedges through the nuki, front and back of each pillar ---
  const NY = 3.42;
  for (const s of [1, -1]) for (const f of [1, -1]) {
    const w = new THREE.Shape();                       // side profile: (outward, up)
    w.moveTo(0, -0.21); w.lineTo(0.12, -0.14); w.lineTo(0.12, 0.14); w.lineTo(0, 0.21); w.closePath();
    const geo = new THREE.ExtrudeGeometry(w, { depth: 0.16, bevelEnabled: false });
    geo.translate(0, 0, -0.08);
    const k = new THREE.Mesh(geo, verm);
    k.rotation.y = -f * Math.PI / 2;                   // local x (outward) -> world f*z
    k.position.set(s * pillarX(NY), NY, f * 0.19);
    g.add(k);
  }

  // --- kasagi: one curved sweep, 6.4 m, ends 0.25 m higher than the middle ----
  const ks = new THREE.Shape();
  ks.moveTo(-3.2, 4.90); ks.quadraticCurveTo(0, 4.40, 3.2, 4.90);
  ks.lineTo(3.2, 5.26); ks.quadraticCurveTo(0, 4.76, -3.2, 5.26); ks.closePath();
  const kas = extrude(ks, 0.34, verm, 16); kas.position.z = -0.17; g.add(kas);
  const cp = new THREE.Shape();
  cp.moveTo(-3.2, 5.26); cp.quadraticCurveTo(0, 4.76, 3.2, 5.26);
  cp.lineTo(3.2, 5.32); cp.quadraticCurveTo(0, 4.82, -3.2, 5.32); cp.closePath();
  const cap = extrude(cp, 0.34, dark, 16); cap.position.z = -0.17; g.add(cap);

  // --- strut and tablet ------------------------------------------------------------
  const st = new THREE.Shape(); st.moveTo(-0.07, 3.50); st.lineTo(0.07, 3.50); st.lineTo(0.07, 4.70); st.lineTo(-0.07, 4.70); st.closePath();
  const strut = extrude(st, 0.14, verm); strut.position.z = -0.07; g.add(strut);
  const tb = new THREE.Shape(); tb.moveTo(-0.15, 4.12); tb.lineTo(0.15, 4.12); tb.lineTo(0.15, 4.62); tb.lineTo(-0.15, 4.62); tb.closePath();
  const tab = extrude(tb, 0.10, verm); tab.position.z = 0.04; g.add(tab);

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
