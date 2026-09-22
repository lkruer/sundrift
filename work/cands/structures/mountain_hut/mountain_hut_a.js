// mountain_hut — candidate A: primitives.
// Six stone cubes, a plank deck, box walls (the front in three pieces around the door opening),
// a cedar-bark eave band, gable triangles from three-segment prisms, two tilted box roof panels
// with a dark ridge cap, a stone chimney, a recessed sliding door with a glazed upper half, three
// framed windows, a bench on the deck to the right of the door, and thin dark strips as plank
// grooves every 0.25 m split around every opening. Walls 3.2 x 2.2 m, roof 4.2 x 3.2 m
// overhanging 0.5 m all round, eaves at 2.35 m, ridge at 3.55 m under a 0.14 m cap.
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (hex, rough, name, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: 0 }, extra || {}));
    if (name) m.name = name;
    return m;
  };
  const timber = mat(0x7a5a3a, 0.85, 'timber');
  const timberFlat = mat(0x7a5a3a, 0.85, 'timber', { flatShading: true });
  const bark = mat(0x5a3f2c, 0.85, 'timber');
  const tile = mat(0x4a4f5a, 0.8, 'tile');
  const stone = mat(0x8a7f72, 0.95, 'stone', { flatShading: true });
  const glass = mat(0x1c2a33, 0.1);
  const dark = mat(0x2b2d31, 0.35);

  const box = (w, h, d, x, y, z, m) => {
    const n = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    n.position.set(x, y, z); g.add(n); return n;
  };

  const FLOOR = 0.32, WALL_H = 2.2, WT = 0.12;
  const X0 = -1.6, X1 = 1.6, Z0 = -1.25, Z1 = 0.95;          // wall outer faces
  const TOP = FLOOR + WALL_H;
  const EAVE_Y = 2.35, RIDGE_Y = 3.55, OVER = 0.5, RT = 0.12;
  const halfSpan = (Z1 - Z0) / 2, RIDGE_Z = (Z0 + Z1) / 2;
  const SLOPE = (RIDGE_Y - EAVE_Y) / (halfSpan + OVER);
  const UNDER = EAVE_Y + OVER * SLOPE;                        // roof underside at the wall line
  const EB = UNDER - TOP;                                     // eave band height
  const gabH = RIDGE_Y - UNDER;

  // --- footings, deck, dark skirt ------------------------------------------------
  for (const x of [-1.5, 0, 1.5]) for (const z of [-1.05, 1.05]) box(0.3, 0.3, 0.3, x, 0.15, z, stone);
  box(3.6, 0.08, 2.7, 0, FLOOR - 0.04, 0, timber);
  for (const s of [1, -1]) {
    box(3.68, 0.10, 0.04, 0, FLOOR - 0.05, s * 1.37, bark);
    box(0.04, 0.10, 2.7, s * 1.82, FLOOR - 0.05, 0, bark);
  }

  // --- walls: front in three pieces around the door, back, two sides ------------
  const WY = FLOOR + WALL_H / 2;
  const DX0 = -0.25, DX1 = 0.85, DOOR_H = 2.0, DXC = (DX0 + DX1) / 2, DW = DX1 - DX0;
  box(X1 - DX1, WALL_H, WT, (X1 + DX1) / 2, WY, Z1 - WT / 2, timber);
  box(DX0 - X0, WALL_H, WT, (X0 + DX0) / 2, WY, Z1 - WT / 2, timber);
  box(DW, WALL_H - DOOR_H, WT, DXC, FLOOR + DOOR_H + (WALL_H - DOOR_H) / 2, Z1 - WT / 2, timber);
  box(X1 - X0, WALL_H, WT, 0, WY, Z0 + WT / 2, timber);
  for (const s of [1, -1]) box(WT, WALL_H, Z1 - Z0 - 2 * WT, s * (X1 - WT / 2), WY, RIDGE_Z, timber);

  // eave band (the dark line under the roof) and the gable triangles
  box(X1 - X0 + 0.02, EB, WT + 0.02, 0, TOP + EB / 2, Z1 - WT / 2 + 0.01, bark);
  box(X1 - X0 + 0.02, EB, WT + 0.02, 0, TOP + EB / 2, Z0 + WT / 2 - 0.01, bark);
  for (const s of [1, -1]) box(WT + 0.02, EB, Z1 - Z0, s * (X1 - WT / 2 + 0.01), TOP + EB / 2, RIDGE_Z, bark);
  const R = 2 * halfSpan / Math.sqrt(3);
  for (const s of [1, -1]) {
    const geo = new THREE.CylinderGeometry(R, R, WT, 3, 1);
    geo.rotateX(-Math.PI / 2); geo.rotateY(Math.PI / 2); geo.scale(1, gabH / (1.5 * R), 1);
    const gb = new THREE.Mesh(geo, timberFlat);
    gb.position.set(s * (X1 - WT / 2), UNDER + gabH / 3, RIDGE_Z);
    g.add(gb);
    for (const h of [0.25, 0.5]) {
      const hw = halfSpan * (1 - h / gabH) - 0.05;
      box(0.02, 0.03, 2 * hw, s * (X1 + 0.01), UNDER + h, RIDGE_Z, bark);
    }
  }

  // --- roof: two tilted panels, ridge cap, chimney --------------------------------
  const a = Math.atan(SLOPE);
  const L = Math.hypot(halfSpan + OVER, RIDGE_Y - EAVE_Y);
  const RX = (X1 - X0) + 2 * OVER;
  for (const s of [1, -1]) {
    const cz = RIDGE_Z + s * (halfSpan + OVER) / 2, cy = (EAVE_Y + RIDGE_Y) / 2;
    const p = box(RX, RT, L, 0, cy + (RT / 2) * Math.cos(a), cz + s * (RT / 2) * Math.sin(a), tile);
    p.rotation.x = s * a;                                     // positive pitches the +Z edge down
  }
  box(RX + 0.1, 0.14, 0.32, 0, RIDGE_Y + RT / Math.cos(a) - 0.01, RIDGE_Z, bark);
  box(0.3, 0.9, 0.3, -0.9, 3.25, -0.75, stone);
  box(0.4, 0.05, 0.4, -0.9, 3.725, -0.75, dark);

  // --- sliding door, recessed 0.1 m, glazed upper half, dark frame, head rail -----
  const DZ = Z1 - 0.1;
  box(DW, DOOR_H / 2, 0.05, DXC, FLOOR + DOOR_H / 4, DZ - 0.025, timber);
  box(DW, DOOR_H / 2, 0.05, DXC, FLOOR + 3 * DOOR_H / 4, DZ - 0.025, glass);
  const FZ = DZ - 0.02;
  for (const x of [DX0 + 0.03, DX1 - 0.03]) box(0.06, DOOR_H, 0.06, x, FLOOR + DOOR_H / 2, FZ, bark);
  box(DW, 0.06, 0.06, DXC, FLOOR + 0.04, FZ, bark);
  box(DW, 0.08, 0.06, DXC, FLOOR + DOOR_H / 2, FZ, bark);
  box(DW, 0.06, 0.06, DXC, FLOOR + DOOR_H - 0.03, FZ, bark);
  box(0.05, DOOR_H / 2, 0.06, DXC, FLOOR + 3 * DOOR_H / 4, FZ, bark);
  box(DW + 0.3, 0.08, 0.14, DXC, FLOOR + DOOR_H + 0.05, Z1 + 0.01, bark);

  // --- faces: windows and plank grooves ---------------------------------------------
  const faces = {
    front: { axis: 'z', sign: 1, plane: Z1, u0: X0, u1: X1 },
    back: { axis: 'z', sign: -1, plane: Z0, u0: X0, u1: X1 },
    left: { axis: 'x', sign: 1, plane: X1, u0: Z0, u1: Z1 },
    right: { axis: 'x', sign: -1, plane: X0, u0: Z0, u1: Z1 },
  };
  const onFace = (f, u, y, w, h, t, proud, m) => {
    const n = f.plane + f.sign * (proud - t / 2);
    return f.axis === 'z' ? box(w, h, t, u, y, n, m) : box(t, h, w, n, y, u, m);
  };
  const windowAt = (f, u, y) => {
    onFace(f, u, y, 0.6, 0.6, 0.04, 0.02, glass);
    onFace(f, u, y + 0.32, 0.7, 0.06, 0.06, 0.04, bark);
    onFace(f, u, y - 0.32, 0.7, 0.06, 0.06, 0.04, bark);
    onFace(f, u - 0.32, y, 0.06, 0.58, 0.06, 0.04, bark);
    onFace(f, u + 0.32, y, 0.06, 0.58, 0.06, 0.04, bark);
    onFace(f, u, y - 0.38, 0.82, 0.05, 0.12, 0.10, bark);
  };
  const WY0 = FLOOR + 1.2;
  windowAt(faces.left, RIDGE_Z, WY0);
  windowAt(faces.right, RIDGE_Z, WY0);
  windowAt(faces.back, 0, WY0);

  const grooves = (f, openings) => {
    for (let k = 1; k <= 8; k++) {
      const y = FLOOR + 0.25 * k;
      let segs = [[f.u0 + 0.03, f.u1 - 0.03]];
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
      for (const [p, q] of segs) if (q - p > 0.12) onFace(f, (p + q) / 2, y, q - p, 0.03, 0.02, 0.01, bark);
    }
  };
  const win = (u) => ({ u0: u - 0.41, u1: u + 0.41, y0: WY0 - 0.41, y1: WY0 + 0.41 });
  grooves(faces.front, [{ u0: DX0, u1: DX1, y0: FLOOR, y1: FLOOR + DOOR_H }]);
  grooves(faces.back, [win(0)]);
  grooves(faces.left, [win(RIDGE_Z)]);
  grooves(faces.right, [win(RIDGE_Z)]);

  // --- bench on the deck, under the eave, right of the door --------------------------
  const BX = -0.95, BZ = Z1 + 0.2;
  box(1.2, 0.06, 0.4, BX, FLOOR + 0.39, BZ, timber);
  for (const s of [1, -1]) box(0.08, 0.36, 0.34, BX + s * 0.5, FLOOR + 0.18, BZ, timber);
  box(1.0, 0.05, 0.05, BX, FLOOR + 0.12, BZ, bark);

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
