
  // ---- the hull: ten stations, twelve points each --------------------------------------
  // rows: 0 floor centre, 1 floor edge, 2 flank, 3 belt, 4 roof edge, 5 roof mid, 6 crown,
  // then 7..11 mirror rows 5..1. Bands 3-4 / 8-9 are the tumblehome (glass through the
  // cabin), bands 4..8 the top (glass at the windscreen and rear glass segments).
  const ring = (z, lo, hwLo, hwMid, yMid, hwBelt, yBelt, hwRoof, yRoof, yTop) => {
    const R = [[0, lo], [hwLo, lo], [hwMid, yMid], [hwBelt, yBelt], [hwRoof, yRoof], [hwRoof * 0.5, yRoof + (yTop - yRoof) * 0.75], [0, yTop]];
    const out = [];
    for (let i = 0; i < 7; i++) out.push([R[i][0], R[i][1], z]);
    for (let i = 5; i >= 1; i--) out.push([-R[i][0], R[i][1], z]);
    return out;
  };
  const stations = [
    [2.12,  0.59, 0.72, 0.75,  0.615, 0.75,  0.655, 0.66, 0.68,  0.70],     // nose
    [1.64,  0.59, 0.80, 0.815, 0.65,  0.80,  0.712, 0.70, 0.727, 0.752],    // front arch, front edge
    [1.275, 0.70, 0.80, 0.815, 0.71,  0.80,  0.745, 0.70, 0.762, 0.787],    // front axle
    [0.92,  0.70, 0.80, 0.815, 0.72,  0.80,  0.78,  0.70, 0.797, 0.822],    // front arch, rear edge
    [0.275, 0.70, 0.80, 0.815, 0.76,  0.795, 0.85,  0.74, 0.86,  0.885],    // scuttle
    [-0.35, 0.70, 0.80, 0.815, 0.78,  0.78,  0.92,  0.66, 1.235, 1.265],    // windscreen top
    [-0.65, 0.70, 0.80, 0.815, 0.79,  0.78,  0.925, 0.66, 1.245, 1.28],     // roof peak
    [-0.95, 0.70, 0.80, 0.815, 0.80,  0.78,  0.93,  0.65, 1.225, 1.255],    // rear glass top
    [-1.48, 0.70, 0.80, 0.815, 0.80,  0.80,  0.94,  0.73, 0.96,  0.975],    // rear glass base
    [-2.12, 0.78, 0.78, 0.79,  0.85,  0.78,  0.93,  0.71, 0.975, 0.99],     // tail, with a lip
  ];
  const rings = stations.map((s) => ring(...s));
  add(body, loft(rings, {
    creaseRows: [1, 3, 4, 8, 9, 11], creaseSecs: [4, 5, 7, 8], capFront: 0, capBack: 0,
    matOf: (seg, row) => {
      const top = row >= 4 && row <= 7, side = row === 3 || row === 8;
      if (top && (seg === 4 || seg === 7)) return 1;
      if (side && seg >= 4 && seg <= 7) return 1;
      return 0;
    },
  }), [PAINT, GLASS]);

  // ---- reading the hull's own surface, so fittings sit ON it ---------------------------
  const ringAt = (z) => {
    let i = 0; while (i < rings.length - 2 && z < rings[i + 1][0][2]) i++;
    const a = rings[i], b = rings[i + 1], t = c01((a[0][2] - z) / (a[0][2] - b[0][2]));
    return a.map((p, k) => [lerp(p[0], b[k][0], t), lerp(p[1], b[k][1], t), z]);
  };
  // height of the top skin at (x, z): belt(+x), roof edge, mid, crown, mid, roof edge, belt(-x)
  const topY = (x, z) => {
    const r = ringAt(z), pts = [r[3], r[4], r[5], r[6], r[7], r[8], r[9]];
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      if (x <= a[0] + 1e-9 && x >= b[0] - 1e-9) return lerp(a[1], b[1], (a[0] - x) / ((a[0] - b[0]) || 1e-9));
    }
    return r[6][1];
  };
  // x of the flank skin at (y, z) on side s: floor edge, flank, belt, roof edge
  const flankX = (s, y, z) => {
    const r = ringAt(z), pts = [r[1], r[2], r[3], r[4]];
    for (let k = 0; k < 3; k++) {
      const a = pts[k], b = pts[k + 1];
      if (y >= a[1] - 1e-9 && y <= b[1] + 1e-9) return s * lerp(a[0], b[0], (y - a[1]) / ((b[1] - a[1]) || 1e-9));
    }
    return s * (y < pts[0][1] ? pts[0][0] : pts[3][0]);
  };
  const linePts = (a, b, n) => { const out = []; for (let k = 0; k <= n; k++) out.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]); return out; };
  // A shut line: a dark strip w wide, sunk 0.006 and proud 0.003, lofted along [x, z]
  // points on the top skin. Sample enough points that it follows the crown.
  const topStrip = (pts, w, m) => {
    const secs = pts.map(([x, z], i) => {
      const y = topY(x, z), q = pts[Math.min(i + 1, pts.length - 1)], p = pts[Math.max(i - 1, 0)];
      let dx = q[0] - p[0], dz = q[1] - p[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      const nx = dz * w / 2, nz = -dx * w / 2;
      return [[x - nx, y - 0.006, z - nz], [x + nx, y - 0.006, z + nz], [x + nx, y + 0.003, z + nz], [x - nx, y + 0.003, z - nz]];
    });
    return add(body, loft(secs, { creaseRows: [0, 1, 2, 3], capFront: 0, capBack: 0 }), m || DARK);
  };
  // The same along [y, z] points on the flank of side s.
  const flankStrip = (s, pts, w, m) => {
    const secs = pts.map(([y, z], i) => {
      const x = flankX(s, y, z), q = pts[Math.min(i + 1, pts.length - 1)], p = pts[Math.max(i - 1, 0)];
      let dy = q[0] - p[0], dz = q[1] - p[1]; const L = Math.hypot(dy, dz) || 1; dy /= L; dz /= L;
      const ny = dz * w / 2, nz = -dy * w / 2, o = s * 0.003, i2 = -s * 0.006;
      return [[x + i2, y - ny, z - nz], [x + i2, y + ny, z + nz], [x + o, y + ny, z + nz], [x + o, y - ny, z - nz]];
    });
    return add(body, loft(secs, { creaseRows: [0, 1, 2, 3], capFront: 0, capBack: 0 }), m || DARK);
  };
  // A raised panel on the top skin over x0..x1, z0..z1, h proud, following the crown.
  const topPanel = (x0, x1, z0, z1, h, m, nz) => {
    const secs = [];
    for (let k = 0; k <= (nz || 4); k++) {
      const z = lerp(z0, z1, k / (nz || 4)), lo = [], hi = [];
      for (let j = 0; j <= 4; j++) { const x = lerp(x0, x1, j / 4), y = topY(x, z); lo.push([x, y - 0.01, z]); hi.push([x, y + h, z]); }
      secs.push(lo.concat(hi.reverse()));
    }
    return add(body, loft(secs, { creaseRows: [0, 4, 5, 9], capFront: 0, capBack: 0 }), m || PAINT);
  };

  // ---- panel map: shut lines, pop-up lids, bulge, vents, roof furniture ---------------
  for (const s of [-1, 1]) {
    topStrip(linePts([s * 0.60, 0.34], [s * 0.60, 1.74], 8), 0.012);                          // bonnet edges
    topPanel(s * 0.30, s * 0.62, 1.79, 2.05, 0.003, PAINT, 3);                                 // pop-up lamp lid, closed
    const lid = [[s * 0.30, 1.79], [s * 0.62, 1.79], [s * 0.62, 2.05], [s * 0.30, 2.05], [s * 0.30, 1.79]];
    for (let k = 0; k < 4; k++) topStrip(linePts(lid[k], lid[k + 1], 4), 0.012);
    topStrip(linePts([s * 0.60, -1.52], [s * 0.60, -2.06], 6), 0.012);                        // boot edges
    flankStrip(s, linePts([0.25, 0.42], [0.80, 0.42], 6), 0.012);                             // door front edge
    flankStrip(s, linePts([0.25, -0.93], [0.80, -0.93], 6), 0.012);                           // door rear edge
    for (let k = 0; k < 3; k++) {                                                              // bonnet louvres, three per side
      const z = 1.14 + 0.17 * k, x = s * 0.40, y = topY(x, z);
      add(body, box(0.17, 0.012, 0.038), DARK, x, y + 0.002, z, 0.10);
      add(body, box(0.17, 0.006, 0.014), PAINT, x, y + 0.009, z + 0.016, 0.10);                // the louvre's raised lip
    }
    const hx = flankX(s, 0.72, -0.62);                                                         // door handle, flush
    add(body, box(0.006, 0.05, 0.16), DARK, hx + s * 0.003, 0.72, -0.62);
    add(body, box(0.014, 0.028, 0.12), DARK, hx + s * 0.010, 0.725, -0.62);
    add(body, box(0.012, 0.035, 0.09), TAIL, s * 0.822, 0.60, -1.86);                          // rear side marker
  }
  topStrip(linePts([-0.60, 1.74], [0.60, 1.74], 12), 0.012);                                  // bonnet front edge
  topStrip(linePts([-0.60, 0.34], [0.60, 0.34], 12), 0.012);                                  // bonnet rear edge (scuttle)
  topStrip(linePts([-0.60, -1.52], [0.60, -1.52], 12), 0.012);                                // boot front edge
  {                                                                                            // bonnet bulge, riding the crown
    const secs = [];
    for (let k = 0; k <= 8; k++) {
      const z = lerp(0.50, 1.72, k / 8), e = Math.sin(PI * k / 8), h = 0.05 * Math.pow(e, 0.6);
      const y = (x) => topY(x, z);
      secs.push([[0.25, y(0.25) - 0.012, z], [0.25, y(0.25) + 0.002, z], [0.13, y(0.13) + h, z], [-0.13, y(-0.13) + h, z], [-0.25, y(-0.25) + 0.002, z], [-0.25, y(-0.25) - 0.012, z]]);
    }
    add(body, loft(secs, { creaseRows: [0, 1, 4, 5] }), PAINT);
  }
  add(body, box(1.22, 0.028, 0.10), PAINT, 0, 1.236, -0.995, 0.34);                            // roof spoiler lip, trailing edge up
  add(body, box(1.22, 0.012, 0.04), DARK, 0, 1.243, -1.03, 0.34);                              // its rubber edge
  add(body, cyl(0.022, 0.026, 0.024, 12), DARK, 0.50, topY(0.50, -0.88) + 0.008, -0.88);      // antenna base
  add(body, cyl(0.007, 0.011, 0.09, 8), RUB, 0.50, topY(0.50, -0.88) + 0.048, -0.90, -0.45);   // rubber mast, raked back
  {                                                                                            // fuel filler on the left rear quarter
    const fx = flankX(1, 0.80, -1.72);
    add(body, new THREE.TorusGeometry(0.055, 0.009, 8, 24), DARK, fx + 0.004, 0.80, -1.72, 0, PI / 2, 0);
    add(body, cyl(0.048, 0.048, 0.008, 24), DARK, fx + 0.006, 0.80, -1.72, 0, 0, PI / 2);
  }
