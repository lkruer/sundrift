// mountain_hut — candidate B: profile route.
// Each wall is an ExtrudeGeometry of its elevation: the front outline carries the door notch, the
// back a square Path hole for its window, and each side is ONE pentagon (wall + eave band zone +
// gable) with a Path hole for its window. The roof is a single extruded gable band (both slopes
// and the fascia in one profile), the ridge cap an extruded V, the grooves one multi-Shape
// extrusion per face, window and door frames extrusions with Path holes, the chimney hood a
// lathe. Every wall feature is built in a per-wall group whose local z = 0 is the outer face.
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (hex, rough, name, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: 0 }, extra || {}));
    if (name) m.name = name;
    return m;
  };
  const timber = mat(0x7a5a3a, 0.85, 'timber');
  const bark = mat(0x5a3f2c, 0.85, 'timber');
  const tile = mat(0x4a4f5a, 0.8, 'tile');
  const stone = mat(0x8a7f72, 0.95, 'stone', { flatShading: true });
  const glass = mat(0x1c2a33, 0.1);
  const darkDS = mat(0x2b2d31, 0.35, null, { side: THREE.DoubleSide });

  const extrude = (shapes, depth, m) => new THREE.Mesh(
    new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments: 8 }), m);
  const poly = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s; };
  const rect = (x0, y0, x1, y1) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  const hole = (x0, y0, x1, y1) => { const p = new THREE.Path(); p.moveTo(x0, y0); p.lineTo(x0, y1); p.lineTo(x1, y1); p.lineTo(x1, y0); p.closePath(); return p; };
  // an extrusion in a wall group: outer surface `proud` of the face plane (local z = 0), thickness t inward
  const skin = (parent, shapes, t, proud, m) => { const n = extrude(shapes, t, m); n.geometry.translate(0, 0, proud - t); parent.add(n); return n; };

  const FLOOR = 0.32, WALL_H = 2.2, WT = 0.12;
  const X0 = -1.6, X1 = 1.6, Z0 = -1.25, Z1 = 0.95;
  const EAVE_Y = 2.35, RIDGE_Y = 3.55, OVER = 0.5, RT = 0.12;
  const halfSpan = (Z1 - Z0) / 2, RIDGE_Z = (Z0 + Z1) / 2;
  const SLOPE = (RIDGE_Y - EAVE_Y) / (halfSpan + OVER);
  const a = Math.atan(SLOPE);
  const UNDER = EAVE_Y + OVER * SLOPE;
  const EB = UNDER - (FLOOR + WALL_H);
  const gabH = RIDGE_Y - UNDER;
  const RX = (X1 - X0) + 2 * OVER;

  // per-wall frames: local x along the wall, y from the floor, +z outward
  const wallGroup = (which) => {
    const gr = new THREE.Group();
    if (which === 'front') gr.position.set(0, FLOOR, Z1);
    if (which === 'back') { gr.position.set(0, FLOOR, Z0); gr.rotation.y = Math.PI; }
    if (which === 'left') { gr.position.set(X1, FLOOR, RIDGE_Z); gr.rotation.y = Math.PI / 2; }
    if (which === 'right') { gr.position.set(X0, FLOOR, RIDGE_Z); gr.rotation.y = -Math.PI / 2; }
    g.add(gr); return gr;
  };
  const front = wallGroup('front'), back = wallGroup('back'), left = wallGroup('left'), right = wallGroup('right');

  // --- walls ---------------------------------------------------------------------
  const DX0 = -0.25, DX1 = 0.85, DOOR_H = 2.0, DXC = (DX0 + DX1) / 2;
  const WY0 = 1.2;
  const winHole = () => hole(-0.35, WY0 - 0.35, 0.35, WY0 + 0.35);
  skin(front, poly([[X0, 0], [DX0, 0], [DX0, DOOR_H], [DX1, DOOR_H], [DX1, 0], [X1, 0], [X1, WALL_H], [X0, WALL_H]]), WT, 0, timber);
  const bk = rect(X0, 0, X1, WALL_H); bk.holes.push(winHole()); skin(back, bk, WT, 0, timber);
  for (const gr of [left, right]) {
    const s = poly([[-0.98, 0], [0.98, 0], [0.98, WALL_H], [1.1, WALL_H], [1.1, WALL_H + EB],
      [0, WALL_H + EB + gabH], [-1.1, WALL_H + EB], [-1.1, WALL_H], [-0.98, WALL_H]]);
    s.holes.push(winHole());
    skin(gr, s, WT, 0, timber);
    skin(gr, rect(-1.1, WALL_H, 1.1, WALL_H + EB), WT + 0.02, 0.02, bark);
    for (const h of [0.25, 0.5]) {                          // groove lines across the gable
      const hw = 1.1 * (1 - h / gabH) - 0.05;
      skin(gr, rect(-hw, WALL_H + EB + h - 0.015, hw, WALL_H + EB + h + 0.015), 0.02, 0.01, bark);
    }
  }
  for (const gr of [front, back]) skin(gr, rect(X0 - 0.01, WALL_H, X1 + 0.01, WALL_H + EB), WT + 0.02, 0.02, bark);

  // --- windows: frame with a hole, glass set flush, sill --------------------------
  const windowAt = (gr) => {
    const fr = rect(-0.35, WY0 - 0.35, 0.35, WY0 + 0.35);
    fr.holes.push(hole(-0.29, WY0 - 0.29, 0.29, WY0 + 0.29));
    skin(gr, fr, 0.10, 0.04, bark);
    skin(gr, rect(-0.3, WY0 - 0.3, 0.3, WY0 + 0.3), 0.04, 0.0, glass);
    skin(gr, rect(-0.41, WY0 - 0.43, 0.41, WY0 - 0.38), 0.14, 0.10, bark);
  };
  windowAt(left); windowAt(right); windowAt(back);

  // --- sliding door: panel 0.1 m back, four-pane frame, head rail -----------------
  skin(front, rect(DX0, 0.02, DX1, DOOR_H / 2), 0.05, -0.10, timber);
  skin(front, rect(DX0, DOOR_H / 2, DX1, DOOR_H - 0.02), 0.05, -0.10, glass);
  const df = rect(DX0, 0, DX1, DOOR_H);
  for (const [x0, x1] of [[DX0 + 0.06, DXC - 0.025], [DXC + 0.025, DX1 - 0.06]]) {
    df.holes.push(hole(x0, 0.06, x1, DOOR_H / 2 - 0.04));
    df.holes.push(hole(x0, DOOR_H / 2 + 0.04, x1, DOOR_H - 0.06));
  }
  skin(front, df, 0.06, -0.09, bark);
  skin(front, rect(DX0 - 0.15, DOOR_H + 0.01, DX1 + 0.15, DOOR_H + 0.09), 0.14, 0.08, bark);

  // --- plank grooves: one multi-shape extrusion per face, split around openings ---
  const grooveShapes = (u0, u1, openings) => {
    const shapes = [];
    for (let k = 1; k <= 8; k++) {
      const y = 0.25 * k;
      let segs = [[u0 + 0.03, u1 - 0.03]];
      for (const o of openings) {
        if (y < o.y0 - 0.05 || y > o.y1 + 0.05) continue;
        const next = [];
        for (const [p, q] of segs) {
          if (o.u1 + 0.05 <= p || o.u0 - 0.05 >= q) { next.push([p, q]); continue; }
          if (p < o.u0 - 0.05) next.push([p, o.u0 - 0.05]);
          if (q > o.u1 + 0.05) next.push([o.u1 + 0.05, q]);
        }
        segs = next;
      }
      for (const [p, q] of segs) if (q - p > 0.12) shapes.push(rect(p, y - 0.015, q, y + 0.015));
    }
    return shapes;
  };
  const win = { u0: -0.41, u1: 0.41, y0: WY0 - 0.41, y1: WY0 + 0.41 };
  skin(front, grooveShapes(X0, X1, [{ u0: DX0, u1: DX1, y0: 0, y1: DOOR_H }]), 0.02, 0.01, bark);
  skin(back, grooveShapes(X0, X1, [win]), 0.02, 0.01, bark);
  skin(left, grooveShapes(-0.98, 0.98, [win]), 0.02, 0.01, bark);
  skin(right, grooveShapes(-0.98, 0.98, [win]), 0.02, 0.01, bark);

  // --- roof: one extruded gable band, an extruded V ridge cap -------------------------
  const roof = new THREE.Group();
  roof.position.set(X0 - OVER, 0, RIDGE_Z); roof.rotation.y = Math.PI / 2;   // local z runs along world x
  g.add(roof);
  const lift = RT / Math.cos(a), hs = halfSpan + OVER, top = RIDGE_Y + lift;
  roof.add(extrude(poly([[-hs, EAVE_Y], [0, RIDGE_Y], [hs, EAVE_Y], [hs, EAVE_Y + lift], [0, top], [-hs, EAVE_Y + lift]]), RX, tile));
  const cap = extrude(poly([[-0.16, top - 0.10], [0, top + 0.02], [0.16, top - 0.10], [0.16, top], [0, top + 0.12], [-0.16, top]]), RX + 0.1, bark);
  cap.position.z = -0.05; roof.add(cap);

  // chimney: extruded stack with a lathe hood
  const ch = extrude(rect(-1.05, 2.8, -0.75, 3.65), 0.3, stone); ch.position.z = -0.9; g.add(ch);
  const hood = new THREE.Mesh(new THREE.LatheGeometry(
    [[0, 0], [0.25, 0], [0.25, 0.03], [0.08, 0.10], [0, 0.10]].map(([r, y]) => new THREE.Vector2(r, y)), 8), darkDS);
  hood.position.set(-0.9, 3.65, -0.75); g.add(hood);

  // --- deck, footings, dark skirt, bench ---------------------------------------------
  const deck = extrude(rect(-1.8, FLOOR - 0.08, 1.8, FLOOR), 2.7, timber); deck.position.z = -1.35; g.add(deck);
  for (const x of [-1.5, 0, 1.5]) for (const z of [-1.05, 1.05]) {
    const f = extrude(rect(x - 0.15, 0, x + 0.15, 0.3), 0.3, stone); f.position.z = z - 0.15; g.add(f);
  }
  for (const s of [1, -1]) {
    const k = extrude(rect(-1.84, FLOOR - 0.10, 1.84, FLOOR), 0.04, bark); k.position.z = s * 1.37 - 0.02; g.add(k);
    const k2 = extrude(rect(-1.35, FLOOR - 0.10, 1.35, FLOOR), 0.04, bark); k2.rotation.y = Math.PI / 2; k2.position.x = s * 1.82 - 0.02; g.add(k2);
  }
  const BX = -0.95, BZ = Z1 + 0.2;
  const seat = extrude(rect(BX - 0.6, FLOOR + 0.36, BX + 0.6, FLOOR + 0.42), 0.4, timber); seat.position.z = BZ - 0.2; g.add(seat);
  for (const s of [1, -1]) {
    const lg = extrude(rect(BX + s * 0.5 - 0.04, FLOOR, BX + s * 0.5 + 0.04, FLOOR + 0.36), 0.34, timber); lg.position.z = BZ - 0.17; g.add(lg);
  }
  const st = extrude(rect(BX - 0.5, FLOOR + 0.10, BX + 0.5, FLOOR + 0.15), 0.05, bark); st.position.z = BZ - 0.025; g.add(st);

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
