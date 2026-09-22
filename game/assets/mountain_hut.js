// mountain_hut — candidate C: a different breakdown, clapboard construction.
// The plank grooves are real: every wall is a thin backing board skinned with overlapping
// weatherboards 0.25 m apart, each 0.27 m tall and tilted 6 degrees so its bottom edge stands
// proud and throws the shadow line. Boards are split around the openings. The roof is two tile
// panels carried on exposed cedar rafters whose tails show under the eaves, a ridge beam under a
// ridge cap and bargeboards on the gables. The sliding door is two overlapping leaves on a
// double track, the windows have cross mullions, the bench is a slab on two log rounds and the
// chimney is a stone stack with a dark flue pipe.
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
  const dark = mat(0x2b2d31, 0.35);

  const box = (w, h, d, x, y, z, m, parent) => {
    const n = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    n.position.set(x, y, z); (parent || g).add(n); return n;
  };

  const FLOOR = 0.32, WALL_H = 2.2, WT = 0.08;
  const X0 = -1.6, X1 = 1.6, Z0 = -1.25, Z1 = 0.95;
  const EAVE_Y = 2.35, RIDGE_Y = 3.55, OVER = 0.5, RT = 0.12;
  const halfSpan = (Z1 - Z0) / 2, RIDGE_Z = (Z0 + Z1) / 2;
  const SLOPE = (RIDGE_Y - EAVE_Y) / (halfSpan + OVER);
  const a = Math.atan(SLOPE);
  const UNDER = EAVE_Y + OVER * SLOPE;
  const EB = UNDER - (FLOOR + WALL_H);
  const gabH = RIDGE_Y - UNDER;
  const RX = (X1 - X0) + 2 * OVER;
  const L = Math.hypot(halfSpan + OVER, RIDGE_Y - EAVE_Y);

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

  // --- backing walls -------------------------------------------------------------------
  const DX0 = -0.85, DX1 = 0.25, DOOR_H = 2.0, DXC = (DX0 + DX1) / 2, DW = DX1 - DX0;
  const WY0 = 1.2;
  box(X1 - DX1, WALL_H, WT, (X1 + DX1) / 2, WALL_H / 2, -WT / 2, timber, front);
  box(DX0 - X0, WALL_H, WT, (X0 + DX0) / 2, WALL_H / 2, -WT / 2, timber, front);
  box(DW, WALL_H - DOOR_H, WT, DXC, DOOR_H + (WALL_H - DOOR_H) / 2, -WT / 2, timber, front);
  box(X1 - X0, WALL_H, WT, 0, WALL_H / 2, -WT / 2, timber, back);
  for (const gr of [left, right]) box(2 * (halfSpan - 0.12), WALL_H, WT, 0, WALL_H / 2, -WT / 2, timber, gr);

  // --- weatherboards: 0.27 tall every 0.25, tilted so the bottom edge stands proud ------
  const TILT = 6 * Math.PI / 180;
  const boards = (gr, y0, yTop, extent, openings) => {
    for (let y = y0; y < yTop - 0.02; y += 0.25) {
      const h = Math.min(0.27, yTop - y);
      const [u0, u1] = extent(y, h);
      let segs = [[u0, u1]];
      for (const o of openings) {
        if (y + h <= o.y0 || y >= o.y1) continue;
        const next = [];
        for (const [p, q] of segs) {
          if (o.u1 <= p || o.u0 >= q) { next.push([p, q]); continue; }
          if (p < o.u0) next.push([p, o.u0]);
          if (q > o.u1) next.push([o.u1, q]);
        }
        segs = next;
      }
      for (const [p, q] of segs) if (q - p > 0.05) {
        const b = box(q - p, h, 0.03, (p + q) / 2, y + h / 2, 0.028, timber, gr);
        b.rotation.x = -TILT;
      }
    }
  };
  const door = { u0: DX0, u1: DX1, y0: 0, y1: DOOR_H };
  const win = { u0: -0.35, u1: 0.35, y0: WY0 - 0.35, y1: WY0 + 0.35 };
  boards(front, 0, WALL_H, () => [X0, X1], [door]);
  boards(back, 0, WALL_H, () => [X0, X1], [win]);
  for (const gr of [left, right]) {
    boards(gr, 0, WALL_H, () => [-halfSpan + 0.12, halfSpan - 0.12], [win]);
    // eave band, gable board and short boards following the slope
    box(2 * halfSpan, EB, WT + 0.06, 0, WALL_H + EB / 2, 0.03 - WT / 2, bark, gr);
    const tri = new THREE.Shape();
    tri.moveTo(-halfSpan, WALL_H + EB); tri.lineTo(halfSpan, WALL_H + EB); tri.lineTo(0, WALL_H + EB + gabH); tri.closePath();
    const gb = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: WT, bevelEnabled: false }), timber);
    gb.geometry.translate(0, 0, -WT); gr.add(gb);
    boards(gr, WALL_H + EB, WALL_H + EB + gabH - 0.04, (y, h) => {
      const hw = halfSpan * (1 - (y + h - WALL_H - EB) / gabH) - 0.02; return [-hw, hw];
    }, []);
  }
  for (const gr of [front, back]) box(X1 - X0 + 0.02, EB, WT + 0.06, 0, WALL_H + EB / 2, 0.03 - WT / 2, bark, gr);

  // --- roof: panels, rafters with visible tails, ridge beam and cap, bargeboards ------
  const cy = (EAVE_Y + RIDGE_Y) / 2;
  for (const s of [1, -1]) {
    const cz = RIDGE_Z + s * (halfSpan + OVER) / 2;
    const p = box(RX, RT, L, 0, cy + (RT / 2) * Math.cos(a), cz + s * (RT / 2) * Math.sin(a), tile);
    p.rotation.x = s * a;
    for (let i = 0; i < 7; i++) {
      const r = box(0.08, 0.10, L - 0.05, -1.8 + 0.6 * i, cy - 0.05 * Math.cos(a), cz - s * 0.05 * Math.sin(a), bark);
      r.rotation.x = s * a;
    }
    for (const e of [1, -1]) {
      const bb = box(0.06, 0.20, L, e * (RX / 2 + 0.03), cy + 0.02 * Math.cos(a), cz + s * 0.02 * Math.sin(a), bark);
      bb.rotation.x = s * a;
    }
  }
  box(RX + 0.1, 0.14, 0.14, 0, RIDGE_Y - 0.09, RIDGE_Z, bark);
  box(RX + 0.1, 0.12, 0.30, 0, RIDGE_Y + RT / Math.cos(a) + 0.02, RIDGE_Z, bark);
  box(0.3, 0.9, 0.3, -0.9, 3.2, -0.75, stone);
  const flue = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 10), dark);
  flue.position.set(-0.9, 3.73, -0.75); g.add(flue);

  // --- sliding door: two overlapping leaves in the recess, double track above ------
  const leaf = (x0, x1, proud) => {
    const w = x1 - x0, xc = (x0 + x1) / 2, zc = proud - 0.025;
    box(w, DOOR_H / 2 - 0.02, 0.05, xc, DOOR_H / 4, zc, timber, front);
    box(w, DOOR_H / 2 - 0.02, 0.05, xc, 3 * DOOR_H / 4, zc, glass, front);
    const fz = proud + 0.01;
    for (const x of [x0 + 0.03, x1 - 0.03]) box(0.06, DOOR_H - 0.02, 0.06, x, DOOR_H / 2, fz, bark, front);
    for (const [y, h] of [[0.04, 0.06], [DOOR_H / 2, 0.08], [DOOR_H - 0.04, 0.06]]) box(w, h, 0.06, xc, y, fz, bark, front);
  };
  leaf(DX0, DX0 + 0.58, -0.10);
  leaf(DX1 - 0.58, DX1, -0.16);
  box(DW + 0.3, 0.10, 0.16, DXC, DOOR_H + 0.06, 0.02, bark, front);
  box(DW, 0.04, 0.12, DXC, 0.02, -0.10, bark, front);

  // --- windows with cross mullions -----------------------------------------------------
  const windowAt = (gr) => {
    box(0.6, 0.6, 0.04, 0, WY0, 0.01, glass, gr);
    for (const s of [1, -1]) {
      box(0.7, 0.06, 0.08, 0, WY0 + s * 0.32, 0.04, bark, gr);
      box(0.06, 0.58, 0.08, s * 0.32, WY0, 0.04, bark, gr);
    }
    box(0.04, 0.58, 0.06, 0, WY0, 0.03, bark, gr);
    box(0.58, 0.04, 0.06, 0, WY0, 0.03, bark, gr);
    box(0.82, 0.05, 0.14, 0, WY0 - 0.38, 0.07, bark, gr);
  };
  windowAt(left); windowAt(right); windowAt(back);

  // --- deck, footings, skirt, bench on log rounds ------------------------------------
  for (const x of [-1.5, 0, 1.5]) for (const z of [-1.05, 1.05]) box(0.3, 0.3, 0.3, x, 0.15, z, stone);
  box(3.6, 0.08, 2.7, 0, FLOOR - 0.04, 0, timber);
  for (const s of [1, -1]) {
    box(3.68, 0.10, 0.04, 0, FLOOR - 0.05, s * 1.37, bark);
    box(0.04, 0.10, 2.7, s * 1.82, FLOOR - 0.05, 0, bark);
  }
  const BX = 0.95, BZ = Z1 + 0.2;
  box(1.2, 0.08, 0.4, BX, FLOOR + 0.38, BZ, timber);
  for (const s of [1, -1]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.4, 10), bark);
    log.rotation.x = Math.PI / 2;
    log.position.set(BX + s * 0.45, FLOOR + 0.17, BZ);
    g.add(log);
  }

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
