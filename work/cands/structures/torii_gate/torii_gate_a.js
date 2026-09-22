// torii_gate — candidate A: primitives.
// Two leaning cylinders on flared stone drums, a box nuki through both, a kasagi made of three
// boxes (a straight middle and two angled ends rising 0.25 m) with a chrome-dark cap on the same
// plan, a tablet hung under the kasagi on a strut, and four kusabi wedges front and back where the
// nuki meets each pillar. Every size from the brief; the drum foot flares to 0.9 m so the plan
// depth matches the brief's envelope.
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (hex, rough, name, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: 0 }, extra || {}));
    if (name) m.name = name;
    return m;
  };
  const verm = mat(0xc9402b, 0.6);                                   // vermilion, brief roughness
  const stone = mat(0x8a7f72, 0.95, 'stone', { flatShading: true }); // warm stone
  const dark = mat(0x2b2d31, 0.35);                                  // chrome dark cap

  const box = (w, h, d, x, y, z, m) => {
    const n = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    n.position.set(x, y, z); g.add(n); return n;
  };

  const LEAN = 3 * Math.PI / 180;
  const PX = 2.2;                                   // pillar centres at the foot
  const PLINTH_H = 0.22, PIL_R = 0.21, PIL_H = 4.3;
  const NUKI_Y0 = 3.3, NUKI_H = 0.24, NUKI_D = 0.20, NUKI_L = 5.6;
  const KAS_Y0 = 4.65, KAS_H = 0.36, KAS_D = 0.34, KAS_L = 6.4, RISE = 0.25, CAP_H = 0.06;

  // --- stone drums: 0.72 m across the top, flaring to 0.9 m at the foot --------
  for (const s of [1, -1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.45, PLINTH_H, 16), stone);
    p.position.set(s * PX, PLINTH_H / 2, 0); g.add(p);
  }

  // --- pillars: pivot on the drum top, lean inward 3 degrees, shaft runs up into the kasagi ---
  for (const s of [1, -1]) {
    const hub = new THREE.Group();
    hub.position.set(s * PX, PLINTH_H, 0); hub.rotation.z = s * LEAN; g.add(hub);
    const L = PIL_H + 0.36;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(PIL_R, PIL_R, L, 20), verm);
    c.position.y = L / 2 - 0.06; hub.add(c);
    // a dark collar at the foot: the strong dark line that parts the gate from the ground
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(PIL_R + 0.02, PIL_R + 0.02, 0.18, 20), dark);
    collar.position.y = 0.09; hub.add(collar);
  }
  const pillarX = (y) => PX - (y - PLINTH_H) * Math.tan(LEAN);       // pillar centre at height y

  // --- nuki through both pillars, kusabi wedges front and back -----------------
  const NY = NUKI_Y0 + NUKI_H / 2;
  box(NUKI_L, NUKI_H, NUKI_D, 0, NY, 0, verm);
  for (const s of [1, -1]) for (const f of [1, -1]) {
    box(0.16, NUKI_H + 0.18, 0.12, s * pillarX(NY), NY, f * (PIL_R + 0.04), verm);
  }

  // --- kasagi: straight middle, two angled ends, chrome dark cap following it --
  const KY = KAS_Y0 + KAS_H / 2;
  const XM = 1.75;                                   // half length of the straight middle
  const X0 = 1.65;                                   // the angled ends start buried 0.1 m inside it
  const run = KAS_L / 2 - X0;
  const ang = Math.atan2(RISE, run);
  const len = Math.hypot(run, RISE);
  const sn = Math.sin(ang), cs = Math.cos(ang);
  box(2 * XM, KAS_H, KAS_D, 0, KY, 0, verm);
  box(2 * XM, CAP_H, KAS_D, 0, KY + KAS_H / 2 + CAP_H / 2, 0, dark);
  for (const s of [1, -1]) {
    // place the end so its outermost corner lands exactly on the 6.4 m span
    const cx = KAS_L / 2 - (len / 2) * cs - (KAS_H / 2) * sn;
    const cy = KY + (len / 2) * sn;
    const e = box(len, KAS_H, KAS_D, s * cx, cy, 0, verm); e.rotation.z = s * ang;
    const off = KAS_H / 2 + CAP_H / 2;
    const c = box(len, CAP_H, KAS_D, s * (cx - off * sn), cy + off * cs, 0, dark); c.rotation.z = s * ang;
  }

  // --- tablet on its strut between the beams -----------------------------------
  const strutH = KAS_Y0 - (NUKI_Y0 + NUKI_H);
  box(0.14, strutH + 0.04, 0.14, 0, NUKI_Y0 + NUKI_H + strutH / 2, 0, verm);
  box(0.3, 0.5, 0.1, 0, KAS_Y0 - 0.27, 0.09, verm);

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
