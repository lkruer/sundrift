import re
def rw(p, pairs, regex=None):
    s = open(p, encoding='utf-8').read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b)
    for a, b in (regex or []):
        s, n = re.subn(a, b, s)
        assert n, (p, a)
    open(p, 'w', encoding='utf-8', newline='\n').write(s)

rw('_paths.js', [
 ("  const tail = endPath(-1, -2.19, -1.56, wrapR).reverse();",
  "  const tail = endPath(-1, -2.19, -1.56, wrapR).reverse();\n"
  "  // the part of a tail path at or behind z = zl, with exact points inserted at the cuts\n"
  "  const clipZ = (path, zl) => { const out = []; for (let i = 0; i < path.length; i++) { const p = path[i], q = path[i + 1]; if (p[1] <= zl + 1e-9) out.push(p); if (q && (p[1] - zl) * (q[1] - zl) < 0) { const t = (zl - p[1]) / (q[1] - p[1]); out.push([lerp(p[0], q[0], t), zl]); } } return out; };"),
])

rw('_body_c.js', [
 # ring: crown as a parabola with four segments a side (16 points a ring)
 ("    const R = [[0, lo], [hwLo, lo], [hwMid, yMid], [hwBelt, yBelt], [hwRoof, yRoof], [hwRoof * 0.5, yRoof + (yTop - yRoof) * 0.75], [0, yTop]];\n"
  "    const out = [];\n"
  "    for (let i = 0; i < 7; i++) out.push([R[i][0], R[i][1], z]);\n"
  "    for (let i = 5; i >= 1; i--) out.push([-R[i][0], R[i][1], z]);\n"
  "    return out;",
  "    const R = [[0, lo], [hwLo, lo], [hwMid, yMid], [hwBelt, yBelt], [hwRoof, yRoof]];\n"
  "    for (let k = 1; k <= 4; k++) { const x = hwRoof * (1 - k / 4); R.push([x, yRoof + (yTop - yRoof) * (1 - Math.pow(x / hwRoof, 2))]); }   // crown: a parabola, four segments a side\n"
  "    const out = [];\n"
  "    for (let i = 0; i < R.length; i++) out.push([R[i][0], R[i][1], z]);\n"
  "    for (let i = R.length - 2; i >= 1; i--) out.push([-R[i][0], R[i][1], z]);\n"
  "    return out;"),
 ("  // rows: 0 floor centre, 1 floor edge, 2 flank, 3 belt, 4 roof edge, 5 roof mid, 6 crown,\n"
  "  // then 7..11 mirror rows 5..1. Bands 3-4 / 8-9 are the tumblehome (glass through the\n"
  "  // cabin), bands 4..8 the top (glass at the windscreen and rear glass segments).",
  "  // rows: 0 floor centre, 1 floor edge, 2 flank, 3 belt, 4 roof edge, 5-7 crown, 8 crown centre,\n"
  "  // then 9..15 mirror rows 7..1. Bands 3 / 12 are the tumblehome (glass through the cabin),\n"
  "  // bands 4..11 the top (glass at the windscreen and rear glass segments)."),
 ("    [2.12,  0.59, 0.72, 0.75,  0.615, 0.75,  0.655, 0.66, 0.68,  0.70],     // nose\n"
  "    [1.64,  0.59, 0.80, 0.815, 0.65,  0.80,  0.712, 0.70, 0.727, 0.752],    // front arch, front edge\n"
  "    [1.275, 0.70, 0.80, 0.815, 0.71,  0.80,  0.745, 0.70, 0.762, 0.787],    // front axle\n"
  "    [0.92,  0.70, 0.80, 0.815, 0.72,  0.80,  0.78,  0.70, 0.797, 0.822],    // front arch, rear edge\n"
  "    [0.275, 0.70, 0.80, 0.815, 0.76,  0.795, 0.85,  0.74, 0.86,  0.885],    // scuttle\n"
  "    [-0.35, 0.70, 0.80, 0.815, 0.78,  0.78,  0.92,  0.66, 1.235, 1.265],    // windscreen top\n"
  "    [-0.65, 0.70, 0.80, 0.815, 0.79,  0.78,  0.925, 0.66, 1.245, 1.28],     // roof peak\n"
  "    [-0.95, 0.70, 0.80, 0.815, 0.80,  0.78,  0.93,  0.65, 1.225, 1.255],    // rear glass top\n"
  "    [-1.48, 0.70, 0.80, 0.815, 0.80,  0.80,  0.94,  0.73, 0.96,  0.975],    // rear glass base\n"
  "    [-2.12, 0.78, 0.78, 0.79,  0.85,  0.78,  0.93,  0.71, 0.975, 0.99],     // tail, with a lip",
  "    [2.12,  0.59, 0.72, 0.75,  0.615, 0.75,  0.655, 0.66, 0.686, 0.698],    // nose\n"
  "    [1.64,  0.59, 0.80, 0.815, 0.65,  0.80,  0.712, 0.70, 0.733, 0.746],    // front arch, front edge\n"
  "    [1.275, 0.70, 0.80, 0.815, 0.71,  0.80,  0.745, 0.70, 0.768, 0.781],    // front axle\n"
  "    [0.92,  0.70, 0.80, 0.815, 0.72,  0.80,  0.78,  0.70, 0.803, 0.816],    // front arch, rear edge\n"
  "    [0.275, 0.70, 0.80, 0.815, 0.76,  0.795, 0.85,  0.74, 0.866, 0.88],     // scuttle\n"
  "    [-0.35, 0.70, 0.80, 0.815, 0.78,  0.78,  0.895, 0.60, 1.235, 1.265],    // windscreen top\n"
  "    [-0.65, 0.70, 0.80, 0.815, 0.79,  0.78,  0.905, 0.60, 1.245, 1.28],     // roof peak\n"
  "    [-0.95, 0.70, 0.80, 0.815, 0.80,  0.78,  0.912, 0.59, 1.225, 1.255],    // rear glass top\n"
  "    [-1.48, 0.70, 0.80, 0.815, 0.80,  0.80,  0.915, 0.70, 0.94,  0.952],    // rear glass base\n"
  "    [-2.12, 0.78, 0.78, 0.79,  0.85,  0.78,  0.905, 0.71, 0.915, 0.93],     // tail, deck lowered"),
 ("    creaseRows: [1, 3, 4, 8, 9, 11], creaseSecs: [4, 5, 7, 8], capFront: 0, capBack: 0,\n"
  "    matOf: (seg, row) => {\n"
  "      const top = row >= 4 && row <= 7, side = row === 3 || row === 8;",
  "    creaseRows: [1, 3, 4, 12, 13, 15], creaseSecs: [4, 5, 7, 8], capFront: 0, capBack: 0,\n"
  "    matOf: (seg, row) => {\n"
  "      const top = row >= 4 && row <= 11, side = row === 3 || row === 12;"),
 ("    const r = ringAt(z), pts = [r[3], r[4], r[5], r[6], r[7], r[8], r[9]];", "    const r = ringAt(z), pts = r.slice(3, 14);"),
 ("  // height of the top skin at (x, z): belt(+x), roof edge, mid, crown, mid, roof edge, belt(-x)", "  // height of the top skin at (x, z): belt(+x), roof edge, crown points, roof edge, belt(-x)"),
 # sharper shut lines: 0.010 wide, proud 0.002
 ("      return [[x - nx, y - 0.006, z - nz], [x + nx, y - 0.006, z + nz], [x + nx, y + 0.003, z + nz], [x - nx, y + 0.003, z - nz]];",
  "      return [[x - nx, y - 0.006, z - nz], [x + nx, y - 0.006, z + nz], [x + nx, y + 0.002, z + nz], [x - nx, y + 0.002, z - nz]];"),
 ("      const ny = dz * w / 2, nz = -dy * w / 2, o = s * 0.003, i2 = -s * 0.006;", "      const ny = dz * w / 2, nz = -dy * w / 2, o = s * 0.002, i2 = -s * 0.006;"),
 ("  // A shut line: a dark strip w wide, sunk 0.006 and proud 0.003, lofted along [x, z]", "  // A shut line: a dark strip w wide, sunk 0.006 and proud 0.002, lofted along [x, z]"),
 # subtle bulge, subtle ducktail
 ("h = 0.05 * Math.pow(e, 0.6);", "h = 0.03 * Math.pow(e, 0.6);"),
 ("h = 0.062 * Math.pow(c01((-1.90 - z) / 0.29), 1.6)", "h = 0.04 * Math.pow(c01((-1.90 - z) / 0.29), 1.6)"),
 # front: lower, wider mouth; slimmer lamp band
 ("  add(body, sweep(nose, bandProf(0.40, topF, 0.10, 0.05)), PAINT);", "  add(body, sweep(nose, bandProf(0.38, topF, 0.10, 0.05)), PAINT);"),
 ("  add(body, sweep(nose, plainProf(0.165, 0.222, 0.10)), PAINT);", "  add(body, sweep(nose, plainProf(0.16, 0.21, 0.10)), PAINT);"),
 ("  add(body, sweep(clipX(nose, 0.50, 0.815), plainProf(0.20, 0.42, 0.10)), PAINT);", "  add(body, sweep(clipX(nose, 0.58, 0.815), plainProf(0.19, 0.40, 0.10)), PAINT);"),
 ("  add(body, sweep(clipX(nose, -0.815, -0.50), plainProf(0.20, 0.42, 0.10)), PAINT);", "  add(body, sweep(clipX(nose, -0.815, -0.58), plainProf(0.19, 0.40, 0.10)), PAINT);"),
 ("plainProf(0.578, 0.69, 0.10, 0.012)), DARK);", "plainProf(0.585, 0.665, 0.10, 0.012)), DARK);"),
 # rear: soft crease instead of a step, valance up to it, garnish 0.14 tall wrapping into the quarters
 ("  add(body, sweep(tail, [[0, 0.17], [0, 0.66], [-0.03, 0.68], [-0.03, topR], [-0.10, topR], [-0.10, 0.17]]), PAINT);   // rear bumper, stepped in under the garnish",
  "  add(body, sweep(tail, [[0, 0.46], [0.012, 0.52], [0.004, topR], [-0.10, topR], [-0.10, 0.46]]), PAINT);   // rear bumper face, 0.34 tall with a soft crease"),
 ("  add(body, sweep(clipX(tail, -0.80, 0.80), [[0.005, 0.78], [0.03, 0.80], [0.03, 0.94], [0.005, 0.96], [-0.08, 0.96], [-0.08, 0.78]]), DARK);   // full-width garnish, chamfered edges",
  "  add(body, sweep(clipZ(tail, -1.86), [[0.0, 0.80], [0.014, 0.812], [0.014, 0.928], [0.0, 0.94], [-0.08, 0.94], [-0.08, 0.80]]), DARK);   // garnish, 0.14 tall, chamfered, wrapping into the quarters"),
 ("  add(body, sweep(tail, plainProf(0.17, 0.31, 0.10, 0.006)), DARK);", "  add(body, sweep(tail, plainProf(0.17, 0.47, 0.10, 0.006)), DARK);"),
 # wing: slender blade lower, slimmer uprights
 ("      const th = 0.018 * (1.2 * Math.sqrt(u) - 0.3 * u - 0.9 * u * u) / 0.50;", "      const th = 0.011 * (1.2 * Math.sqrt(u) - 0.3 * u - 0.9 * u * u) / 0.50;"),
 ("DARK, 0, 1.30, -2.02, 0.12);", "DARK, 0, 1.235, -2.02, 0.10);"),
 ("rect(1, [s * 0.45, 0.94, -1.83], [0.022, 0.10]), rect(1, [s * 0.45, 1.12, -1.92], [0.022, 0.085]), rect(1, [s * 0.45, 1.295, -2.01], [0.022, 0.07])",
  "rect(1, [s * 0.45, 0.905, -1.83], [0.018, 0.09]), rect(1, [s * 0.45, 1.08, -1.92], [0.018, 0.075]), rect(1, [s * 0.45, 1.232, -2.01], [0.018, 0.06])"),
 # flares hug the tyres
 ("      secs.push([[s * 0.785, iy, iz], [s * 0.86, iy, iz], [s * 0.86, oy, oz], [s * 0.785, oy, oz]]);",
  "      const ox = az > 0 ? 0.875 : 0.89;\n      secs.push([[s * 0.785, iy, iz], [s * ox, iy, iz], [s * ox, oy, oz], [s * 0.785, oy, oz]]);"),
 # pillars follow the deeper tumblehome and the lower belt
 ("rect(1, [s * 0.66, 1.245, -0.36], [0.03, 0.05])", "rect(1, [s * 0.60, 1.245, -0.36], [0.03, 0.05])"),
 ("rect(1, [s * 0.78, 0.915, -0.825], [0.03, 0.045]), rect(1, [s * 0.663, 1.245, -0.825], [0.03, 0.045])", "rect(1, [s * 0.78, 0.905, -0.825], [0.03, 0.045]), rect(1, [s * 0.603, 1.245, -0.825], [0.03, 0.045])"),
 ("[[s * 0.75, 0.925, -1.47], [s * 0.81, 0.925, -1.47], [s * 0.81, 0.925, -1.21], [s * 0.75, 0.925, -1.21]]", "[[s * 0.75, 0.915, -1.47], [s * 0.81, 0.915, -1.47], [s * 0.81, 0.915, -1.21], [s * 0.75, 0.915, -1.21]]"),
 ("[[s * 0.633, 1.24, -0.965], [s * 0.693, 1.24, -0.965], [s * 0.693, 1.24, -0.955], [s * 0.633, 1.24, -0.955]]", "[[s * 0.573, 1.24, -0.965], [s * 0.633, 1.24, -0.965], [s * 0.633, 1.24, -0.955], [s * 0.573, 1.24, -0.955]]"),
], regex=[(r"(Strip\([^\n]*?), 0\.012\);", r"\1, 0.010);")])

rw('_fit.js', [
 ("  add(body, box(1.22, 0.028, 0.10), PAINT, 0, 1.236, -0.995, 0.34);", "  add(body, box(1.10, 0.028, 0.10), PAINT, 0, 1.236, -0.995, 0.34);"),
 ("  add(body, box(1.22, 0.012, 0.04), DARK, 0, 1.243, -1.03, 0.34);", "  add(body, box(1.10, 0.012, 0.04), DARK, 0, 1.243, -1.03, 0.34);"),
 ("    add(body, box(0.012, 0.035, 0.09), TAIL, s * 0.822, 0.60, -1.86);", "    add(body, box(0.012, 0.035, 0.09), TAIL, s * 0.832, 0.60, -1.86);"),
 # front fittings for the lower, wider mouth
 ("  add(body, box(1.02, 0.20, 0.10), DARK, 0, 0.31, 1.955);", "  add(body, box(1.20, 0.19, 0.10), DARK, 0, 0.295, 1.955);"),
 ("add(body, box(0.94, 0.007, 0.05), GALV, 0, 0.226 + k * 0.0155, 1.985);", "add(body, box(1.12, 0.007, 0.05), GALV, 0, 0.215 + k * 0.0145, 1.985);"),
 ("    add(body, box(0.07, 0.22, 0.11), DARK, s * 0.545, 0.31, 1.955);", "    add(body, box(0.07, 0.21, 0.11), DARK, s * 0.635, 0.295, 1.955);"),
 ("DARK, s * 0.60, 0.36, 1.90, 0, s * PI / 2, 0);", "DARK, s * 0.69, 0.35, 1.90, 0, s * PI / 2, 0);"),
 ("    add(body, cyl(0.036, 0.036, 0.03, 24), DARK, s * 0.62, 0.194, 2.15, PI / 2);", "    add(body, cyl(0.02, 0.02, 0.03, 16), DARK, s * 0.62, 0.185, 2.15, PI / 2);"),
 ("    const f = faceAt(nose, s * 0.655), fog = new THREE.Group();", "    const f = faceAt(nose, s * 0.69), fog = new THREE.Group();"),
 ("    fog.position.set(f.x, 0.31, f.z); fog.rotation.y = f.yaw; body.add(fog);", "    fog.position.set(f.x, 0.295, f.z); fog.rotation.y = f.yaw; body.add(fog);"),
 ("    add(fog, cyl(0.057, 0.057, 0.04, 28), DARK, 0, 0, -0.006, PI / 2);", "    add(fog, cyl(0.05, 0.05, 0.04, 28), DARK, 0, 0, -0.006, PI / 2);"),
 ("    add(fog, cyl(0.043, 0.043, 0.012, 20), HEAD, 0, 0, 0.018, PI / 2);", "    add(fog, cyl(0.038, 0.038, 0.012, 20), HEAD, 0, 0, 0.018, PI / 2);"),
 ("    add(fog, new THREE.TorusGeometry(0.05, 0.006, 6, 24), DARK, 0, 0, 0.016);", "    add(fog, new THREE.TorusGeometry(0.044, 0.005, 6, 24), DARK, 0, 0, 0.016);"),
 ("    add(can, box(0.13, 0.008, 0.16), DARK, 0, 0, 0.06);", "    add(can, box(0.13, 0.005, 0.16), DARK, 0, 0, 0.06);"),
 ("    add(can, box(0.008, 0.04, 0.16), DARK, s * 0.065, 0.02, 0.06);", "    add(can, box(0.005, 0.035, 0.16), DARK, s * 0.065, 0.018, 0.06);"),
 ("    onFace(nose, s * 0.31, 0.632, 0.34, 0.085, 0.024, HEAD, 0.028);", "    onFace(nose, s * 0.31, 0.625, 0.34, 0.06, 0.024, HEAD, 0.028);"),
 ("    onFace(nose, s * 0.545, 0.632, 0.13, 0.085, 0.024, HEAD, 0.028);", "    onFace(nose, s * 0.545, 0.625, 0.13, 0.06, 0.024, HEAD, 0.028);"),
 ("    onFace(nose, s * 0.685, 0.632, 0.12, 0.085, 0.024, HEAD, 0.028);", "    onFace(nose, s * 0.685, 0.625, 0.12, 0.06, 0.024, HEAD, 0.028);"),
 # tail lamp units, smaller, in the 0.14 garnish
 ("    add(lamp, new THREE.CylinderGeometry(0.076, 0.076, 0.03, 32, 1, true), DARK2, 0, 0, 0.045, PI / 2);", "    add(lamp, new THREE.CylinderGeometry(0.06, 0.06, 0.024, 32, 1, true), DARK2, 0, 0, 0.026, PI / 2);"),
 ("    add(lamp, cyl(0.062, 0.062, 0.012, 32), TAIL, 0, 0, 0.036, PI / 2);", "    add(lamp, cyl(0.048, 0.048, 0.01, 32), TAIL, 0, 0, 0.019, PI / 2);"),
 ("    add(lamp, new THREE.TorusGeometry(0.076, 0.005, 8, 32), POLISH, 0, 0, 0.06);", "    add(lamp, new THREE.TorusGeometry(0.06, 0.004, 8, 32), POLISH, 0, 0, 0.038);"),
 ("    add(lamp, new THREE.TorusGeometry(0.031, 0.004, 6, 24), LANE, 0, 0, 0.043);", "    add(lamp, new THREE.TorusGeometry(0.024, 0.0035, 6, 24), LANE, 0, 0, 0.025);"),
 # plate pocket, shallow, 0.33 x 0.17; lamp above it under the garnish
 ("    for (const [w, h, x, y] of [[0.46, 0.022, 0, 0.635], [0.46, 0.022, 0, 0.415], [0.022, 0.24, -0.219, 0.525], [0.022, 0.24, 0.219, 0.525]]) add(body, box(w, h, 0.05), DARK, x, y, zf - 0.005);\n"
  "    add(body, box(0.42, 0.20, 0.008), DARK, 0, 0.525, zf - 0.008);                                   // pocket floor\n"
  "    add(body, box(0.33, 0.165, 0.008), LANE, 0, 0.525, zf - 0.014);                                  // blank plate\n"
  "    add(body, box(0.09, 0.024, 0.05), DARK, 0, 0.665, zf - 0.006);                                   // plate lamp housing under the step\n"
  "    add(body, box(0.05, 0.010, 0.012), HEAD, 0, 0.657, zf - 0.030);",
  "    for (const [w, h, x, y] of [[0.36, 0.015, 0, 0.7575], [0.36, 0.015, 0, 0.5725], [0.015, 0.20, -0.1725, 0.665], [0.015, 0.20, 0.1725, 0.665]]) add(body, box(w, h, 0.03), DARK, x, y, zf - 0.008);\n"
  "    add(body, box(0.33, 0.17, 0.006), LANE, 0, 0.665, zf - 0.011);                                   // blank plate, just inside the rim\n"
  "    add(body, box(0.08, 0.018, 0.04), DARK, 0, 0.787, zf - 0.012);                                   // plate lamp housing under the garnish\n"
  "    add(body, box(0.05, 0.008, 0.01), HEAD, 0, 0.78, zf - 0.033);"),
 ("  for (const s of [-1, 1]) onFace(tail, s * 0.70, 0.46, 0.03, 0.30, 0.024, REFL, 0.012);", "  for (const s of [-1, 1]) onFace(tail, s * 0.70, 0.63, 0.028, 0.24, 0.02, REFL, 0.014);"),
 ("  add(body, box(0.40, 0.17, 0.02), DARK, 0.42, 0.28, -2.20);                                         // exhaust cut-out\n", ""),
 ("  for (const x of [0.35, 0.49]) {\n"
  "    add(body, cyl(0.05, 0.05, 0.16, 28, true), CHROME, x, 0.28, -2.16, PI / 2);",
  "  for (const x of [0.36, 0.48]) {\n"
  "    add(body, cyl(0.045, 0.045, 0.16, 28, true), CHROME, x, 0.29, -2.16, PI / 2);"),
 ("    add(body, cyl(0.034, 0.034, 0.16, 20), DARK, x, 0.28, -2.14, PI / 2);", "    add(body, cyl(0.03, 0.03, 0.16, 20), DARK, x, 0.29, -2.14, PI / 2);"),
 ("add(body, box(0.012, 0.16, 0.40), DARK, x, 0.16, -2.03);   // five deep fins", "add(body, box(0.012, 0.10, 0.30), DARK, x, 0.13, -1.95);   // five fins, set back"),
 ("    add(body, box(0.012, 0.12, 0.32), DARK, s * 0.716, 1.30, -2.02, 0.12);", "    add(body, box(0.008, 0.09, 0.26), DARK, s * 0.714, 1.24, -2.02, 0.10);"),
 ("  add(body, box(0.26, 0.024, 0.035), TAIL, 0, 1.307, -2.12, 0.12);", "  add(body, box(0.24, 0.018, 0.03), TAIL, 0, 1.243, -2.115, 0.10);"),
 ("  add(body, box(1.40, 0.022, 0.012), DARK, 0, 1.317, -2.128, 0.12);", "  add(body, box(1.40, 0.016, 0.010), DARK, 0, 1.249, -2.126, 0.10);"),
 # rivets on the wider flares, trims on the deeper tumblehome and lower belt
 ("DARK, s * 0.86, 0.32 + 0.39 * Math.sin(th), az + 0.39 * Math.cos(th), 0, 0, -s * PI / 2);", "DARK, s * (az > 0 ? 0.875 : 0.89), 0.32 + 0.39 * Math.sin(th), az + 0.39 * Math.cos(th), 0, 0, -s * PI / 2);"),
 ("    add(body, box(0.03, 0.03, 1.66), RUB, s * 0.79, 0.935, -0.60);", "    add(body, box(0.03, 0.03, 1.66), RUB, s * 0.79, 0.905, -0.60);"),
 ("    add(body, box(0.03, 0.03, 0.62), RUB, s * 0.67, 1.245, -0.65);", "    add(body, box(0.03, 0.03, 0.62), RUB, s * 0.61, 1.245, -0.65);"),
 ("    add(body, box(0.024, 0.024, 0.34), RUB, s * 0.79, 0.915, -1.24);", "    add(body, box(0.024, 0.024, 0.34), RUB, s * 0.79, 0.912, -1.24);"),
 ("  add(body, box(1.44, 0.03, 0.03), RUB, 0, 0.965, -1.475);", "  add(body, box(1.40, 0.03, 0.03), RUB, 0, 0.945, -1.475);"),
])

rw('_c5.js', [
 ("  add(body, box(1.40, 0.04, 0.45), DARK, 0, 0.92, -1.26);", "  add(body, box(1.40, 0.04, 0.45), DARK, 0, 0.90, -1.26);"),
 ("      const geo = lathe([[0.300, -hw + 0.04], [0.32, -hw + 0.062], [0.32, hw - 0.062], [0.300, hw - 0.04]], 6, k * PI / 6 + 0.04, PI / 6 - 0.08);",
  "      const geo = lathe([[0.306, -hw + 0.04], [0.32, -hw + 0.058], [0.32, hw - 0.058], [0.306, hw - 0.04]], 6, k * PI / 6 + 0.03, PI / 6 - 0.06);"),
 ("    at(rv([[0.20, hw - 0.03], [0.238, hw - 0.03], [0.238, hw + 0.004], [0.20, hw + 0.004]], 40), LIP);            // polished lip",
  "    at(rv([[0.20, hw - 0.03], [0.238, hw - 0.03], [0.238, hw + 0.004], [0.20, hw + 0.004]], 40), LIP);            // polished lip\n"
  "    at(rv([[0.194, hw - 0.034], [0.206, hw - 0.034], [0.206, hw + 0.007], [0.194, hw + 0.007]], 40), GALV);       // machined ring at the lip's inner edge"),
 ("    const os = hw - 0.10;", "    const os = hw - 0.075;                                                                                       // a slight dish"),
 ("      at(loft([rect(1, [0, 0.045, 0], [0.025, 0.016]), rect(1, [0, 0.16, 0], [0.025, 0.026]), rect(1, [0, 0.228, 0], [0.022, 0.032])], { creaseRows: [0, 1, 2, 3], capFront: 0, capBack: 0 }), BRONZE, os - 0.015, 0, 0, a);   // tapered spoke",
  "      const spk = (y, t, w) => [[-t, y, -w], [-t, y, w], [t * 0.5, y, w * 0.72], [t * 1.15, y, 0], [t * 0.5, y, -w * 0.72]].map(([x, yy, z]) => [side * x, yy, z]);   // peaked cross-section\n"
  "      at(loft([spk(0.045, 0.02, 0.016), spk(0.16, 0.02, 0.026), spk(0.228, 0.018, 0.032)], { creaseRows: [0, 1, 2, 3, 4], capFront: 0, capBack: 0 }), BRONZE, os - 0.015, 0, 0, a);   // tapered spoke"),
])
print('polish 1 applied')
