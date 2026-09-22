
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
    topStrip(linePts([s * 0.60, -1.52], [s * 0.60, -2.13], 7), 0.012);                        // boot edges, run out through the ducktail
    flankStrip(s, linePts([0.25, 0.42], [0.80, 0.42], 6), 0.012);                             // door front edge
    flankStrip(s, linePts([0.25, -0.93], [0.80, -0.93], 6), 0.012);                           // door rear edge
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
  {                                                                                            // ducktail: the boot lid trailing edge kicks up
    const secs = [];
    for (let k = 0; k <= 7; k++) {
      const z = lerp(-1.90, -2.19, k / 7), h = 0.062 * Math.pow(c01((-1.90 - z) / 0.29), 1.6), lo = [], hi = [];
      for (let j = 0; j <= 6; j++) { const x = lerp(-0.58, 0.58, j / 6), y = topY(x, z); lo.push([x, y - 0.012, z]); hi.push([x, y + h + 0.002, z]); }
      secs.push(lo.concat(hi.reverse()));
    }
    add(body, loft(secs, { creaseRows: [0, 6, 7, 13], capBack: 0 }), PAINT);
  }


  const topF = (x, z) => lerp(0.605, 0.648, c01((1.96 - z) / 0.40));         // the hull floor rises over the arch
  add(body, sweep(nose, bandProf(0.40, topF, 0.10, 0.05)), PAINT);                                 // upper bumper
  add(body, sweep(nose, plainProf(0.165, 0.222, 0.10)), PAINT);                                     // lower bumper band
  add(body, sweep(clipX(nose, 0.50, 0.815), plainProf(0.20, 0.42, 0.10)), PAINT);                    // pillar beside the opening
  add(body, sweep(clipX(nose, -0.815, -0.50), plainProf(0.20, 0.42, 0.10)), PAINT);
  add(body, sweep(clipX(nose, -0.80, 0.80), plainProf(0.135, 0.168, 0.10, 0.055)), DARK);          // splitter lip, proud of the face
  add(body, sweep(clipX(nose, -0.80, 0.80), plainProf(0.578, 0.69, 0.10, 0.012)), DARK);           // lamp band
  const topR = (x, z) => lerp(0.725, 0.80, c01((-1.60 - z) / 0.59));
  add(body, sweep(tail, [[0, 0.17], [0, 0.66], [-0.03, 0.68], [-0.03, topR], [-0.10, topR], [-0.10, 0.17]]), PAINT);   // rear bumper, stepped in under the garnish
  add(body, sweep(clipX(tail, -0.80, 0.80), [[0.005, 0.78], [0.03, 0.80], [0.03, 0.94], [0.005, 0.96], [-0.08, 0.96], [-0.08, 0.78]]), DARK);   // full-width garnish, chamfered edges
  add(body, sweep(tail, plainProf(0.17, 0.31, 0.10, 0.006)), DARK);                                  // lower valance, wraps the corners
  // rear wing: aerofoil lofted across, swept uprights, end plates, high-mount brake lamp
  const foil = (x) => {
    const out = [];
    for (let k = 0; k < 14; k++) {
      const t = k / 14, u = 0.5 - 0.5 * Math.cos(2 * PI * t);
      const th = 0.018 * (1.2 * Math.sqrt(u) - 0.3 * u - 0.9 * u * u) / 0.50;
      out.push([x, t < 0.5 ? th + 0.006 : -th * 0.9 + 0.006, 0.11 - 0.22 * u]);
    }
    return out;
  };
  add(body, loft([foil(-0.71), foil(-0.30), foil(0.30), foil(0.71)], { capFront: 0, capBack: 0 }), DARK, 0, 1.30, -2.02, 0.12);
  for (const s of [-1, 1]) add(body, loft([rect(1, [s * 0.45, 0.94, -1.83], [0.022, 0.10]), rect(1, [s * 0.45, 1.12, -1.92], [0.022, 0.085]), rect(1, [s * 0.45, 1.295, -2.01], [0.022, 0.07])], { capFront: 0, capBack: 0 }), DARK);   // taller swept uprights
  for (const s of [-1, 1]) for (const [az, top] of [[1.275, 0.74], [-1.225, 0.78]]) {
    const th0 = Math.atan2(-0.08, 0.50), secs = [];
    const outer = (th) => {
      const sn = Math.sin(th), cs = Math.abs(Math.cos(th)), sg = Math.sign(Math.cos(th)) || 1;
      let t = sn > 1e-6 ? (top - 0.32) / sn : 1e9;
      if (t * cs > 0.30) t = (top - 0.32 + 1.5 * (top - 0.24)) / (sn + cs * (top - 0.24) / 0.20);
      return [az + sg * t * cs, 0.32 + t * sn];
    };
    for (let k = 0; k <= 18; k++) {
      const th = th0 + (PI - 2 * th0) * k / 18, iz = az + 0.35 * Math.cos(th), iy = 0.32 + 0.35 * Math.sin(th), [oz, oy] = outer(th);
      secs.push([[s * 0.785, iy, iz], [s * 0.86, iy, iz], [s * 0.86, oy, oz], [s * 0.785, oy, oz]]);
    }
    add(body, loft(secs, { creaseRows: [0, 1, 2, 3], capFront: 0, capBack: 0 }), PAINT);
  }
  for (const s of [-1, 1]) {
    add(body, loft([rect(1, [s * 0.775, 0.865, 0.26], [0.03, 0.05]), rect(1, [s * 0.66, 1.245, -0.36], [0.03, 0.05])], { capFront: 0, capBack: 0 }), PAINT);   // A pillar
    add(body, loft([rect(1, [s * 0.78, 0.915, -0.825], [0.03, 0.045]), rect(1, [s * 0.663, 1.245, -0.825], [0.03, 0.045])], { capFront: 0, capBack: 0 }), PAINT); // B pillar
    add(body, loft([[[s * 0.75, 0.925, -1.47], [s * 0.81, 0.925, -1.47], [s * 0.81, 0.925, -1.21], [s * 0.75, 0.925, -1.21]],
                    [[s * 0.633, 1.24, -0.965], [s * 0.693, 1.24, -0.965], [s * 0.693, 1.24, -0.955], [s * 0.633, 1.24, -0.955]]], { capFront: 0, capBack: 0 }), PAINT); // C pillar
  }
