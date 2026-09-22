
  // ---- the tail's fittings: lip, garnish and lamps, plate, reflectors, markers, filler, the ----
  //      diffuser with five fins, twin tips tucked into it, mud flaps, and the swan-neck wing -----
  const RA = Math.atan(RAKE), FN = new THREE.Vector3(0, -Math.sin(RA), -Math.cos(RA));            // the face's outward normal: back and down
  const faceZ = (y) => TZ + (TY - y) * RAKE;                                                       // the rear face is the plane z = faceZ(y)
  // a group standing on the rear face at (x, y), `lift` out along its normal; its local +z is that
  // normal and its local +y runs up the face
  const onTail = (x, y, lift) => {
    const grp = new THREE.Group(); grp.rotation.set(RA, PI, 0, 'YXZ');
    grp.position.set(x, y, faceZ(y)).addScaledVector(FN, lift || 0); body.add(grp); return grp;
  };
  // the point of ring k at height y on side s, interpolated along its flank rows
  const ringPt = (k, y, s) => {
    const r = rings[k], idx = s > 0 ? [1, 2, 3, 4] : [15, 14, 13, 12];
    for (let j = 0; j < 3; j++) {
      const a = r[idx[j]], b = r[idx[j + 1]];
      if (y >= a[1] - 1e-9 && y <= b[1] + 1e-9) { const t = (y - a[1]) / ((b[1] - a[1]) || 1e-9); return [lerp(a[0], b[0], t), y, lerp(a[2], b[2], t)]; }
    }
    const e = y < r[idx[0]][1] ? r[idx[0]] : r[idx[3]];
    return [e[0], y, e[2]];
  };
  // the tail's outline at height y: back along the +x side from ring k0, across the face in nf
  // steps, and forward along the -x side
  const outline = (y, k0, nf) => {
    const pts = [];
    for (let k = k0; k <= TAILN; k++) pts.push(ringPt(k, y, 1));
    const a = ringPt(TAILN, y, 1), b = ringPt(TAILN, y, -1);
    for (let j = 1; j < nf; j++) pts.push([lerp(a[0], b[0], j / nf), y, lerp(a[2], b[2], j / nf)]);
    for (let k = TAILN; k >= k0; k--) pts.push(ringPt(k, y, -1));
    return pts;
  };
  const unit = (v) => { const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const off = (p, n, d, dy) => [p[0] + n[0] * d, p[1] + n[1] * d + (dy || 0), p[2] + n[2] * d];
  const along = (P, i) => { const q = P[Math.min(i + 1, P.length - 1)], p = P[Math.max(i - 1, 0)]; return [q[0] - p[0], 0, q[2] - p[2]]; };
  // a strip lying on the tail between heights y0 and y1, `proud` out along the skin's normal and
  // sunk 0.004 into it, over the run of the outline where keep(point, index, count) holds
  const tailStrip = (y0, y1, proud, mat, k0, nf, keep) => {
    const P0 = outline(y0, k0, nf), P1 = outline(y1, k0, nf), secs = [];
    P0.forEach((p, i) => {
      if (keep && !keep(p, i, P0.length)) return;
      const n = unit(cross(along(P0, i), [P1[i][0] - p[0], P1[i][1] - p[1], P1[i][2] - p[2]]));
      secs.push([off(p, n, -0.004), off(p, n, proud), off(P1[i], n, proud), off(P1[i], n, -0.004)]);
    });
    return add(body, loft(secs, { creaseRows: [0, 1, 2, 3], capFront: 0, capBack: 0 }), mat);
  };
  {                                                                                                 // the thin lip under the face, wrapping round to the arches
    const P = outline(TLO, TAIL0 - 1, 16), secs = [];
    P.forEach((p, i) => {
      const a = unit(along(P, i)), n = [-a[2], 0, a[0]];                                           // outward and level
      secs.push([off(p, n, -0.03), off(p, n, 0.028), off(p, n, 0.028, -0.014), off(p, n, -0.03, -0.014)]);
    });
    add(body, loft(secs, { creaseRows: [0, 1, 2, 3], capFront: 0, capBack: 0 }), PAINT);
  }
  tailStrip(0.80, 0.905, 0.010, DARK, TAIL0, 16);                                                 // slim garnish high under the lip, wrapping the corners
  // two slim lamp units a side on it, the outer one wrapping round the corner: a polished backing
  // plate showing as a border, the lens 0.07 tall standing on it, a thin white line on the lens.
  // The outline runs +x corner (samples 0-4), across the face (5-19), -x corner (20-24).
  for (const [i0, i1] of [[1, 6], [18, 23], [7, 10], [14, 17]]) {
    const run = (p, i) => i >= i0 && i <= i1;
    tailStrip(0.8085, 0.8965, 0.012, POLISH, TAIL0, 16, run);
    tailStrip(0.8175, 0.8875, 0.016, TAIL, TAIL0, 16, run);
    tailStrip(0.829, 0.835, 0.0175, LANE, TAIL0, 16, run);
  }
  {                                                                                                 // number-plate pocket: proud rim, blank plate, lamp above
    const pl = onTail(0, 0.60, 0);
    for (const [w, h, x, y] of [[0.36, 0.015, 0, 0.0925], [0.36, 0.015, 0, -0.0925], [0.015, 0.20, -0.1725, 0], [0.015, 0.20, 0.1725, 0]]) add(pl, box(w, h, 0.02), DARK, x, y, 0.006);
    add(pl, box(0.33, 0.17, 0.006), LANE, 0, 0, 0.001);                                            // blank plate, shallow
    add(pl, box(0.08, 0.016, 0.03), DARK, 0, 0.115, 0.011);                                        // plate lamp housing
    add(pl, box(0.05, 0.006, 0.012), HEAD, 0, 0.105, 0.012);
  }
  for (const s of [-1, 1]) add(onTail(s * 0.53, 0.56, 0), box(0.026, 0.13, 0.012), REFL, 0, 0, 0.004);   // slim vertical reflectors at the lower corners
  // the tail's side skin at height y and depth z, on side s
  const sideAt = (s, y, z) => {
    let prev = ringPt(11, y, s);
    for (let k = 12; k <= TAILN; k++) {
      const p = ringPt(k, y, s);
      if (z >= p[2]) { const t = (prev[2] - z) / ((prev[2] - p[2]) || 1e-9); return [lerp(prev[0], p[0], t), y, z]; }
      prev = p;
    }
    return prev;
  };
  for (const s of [-1, 1]) { const sm = sideAt(s, 0.66, -1.72); add(body, box(0.012, 0.03, 0.08), TAIL, sm[0] + s * 0.003, 0.66, -1.72); }   // side markers
  {                                                                                                 // fuel filler on the left rear quarter
    const fl = sideAt(1, 0.80, -1.64);
    add(body, new THREE.TorusGeometry(0.052, 0.008, 8, 24), DARK, fl[0] + 0.004, 0.80, -1.64, 0, PI / 2, 0);
    add(body, cyl(0.045, 0.045, 0.008, 24), DARK, fl[0] + 0.005, 0.80, -1.64, 0, 0, PI / 2);
  }
  {                                                                                                 // diffuser: a ramp rising to the back, five fins, two side walls
    const z0 = -1.56, z1 = -1.89, y0 = 0.17, y1 = 0.39, yb = 0.17, rampY = (z) => lerp(y0, y1, (z0 - z) / (z0 - z1));
    add(body, box(1.24, 0.016, Math.hypot(z0 - z1, y1 - y0)), DARK, 0, (y0 + y1) / 2, (z0 + z1) / 2, Math.atan2(y1 - y0, z0 - z1));
    for (const x of [-0.62, -0.50, -0.25, 0, 0.25, 0.50, 0.62]) {
      const t = Math.abs(x) > 0.6 ? 0.008 : 0.006, zf = -1.62;
      add(body, loft([rect(2, [x, (yb + rampY(zf)) / 2, zf], [t, (rampY(zf) - yb) / 2]), rect(2, [x, (yb + y1) / 2, z1], [t, (y1 - yb) / 2])],
                     { creaseRows: [0, 1, 2, 3], capFront: 0, capBack: 0 }), DARK);
    }
  }
  for (const x of [0.315, 0.435]) {                                                                 // twin tips on the left, tucked into the diffuser
    add(body, cyl(0.045, 0.045, 0.16, 28, true), CHROME, x, 0.25, -1.85, PI / 2);
    add(body, cyl(0.03, 0.03, 0.16, 20), DARK, x, 0.25, -1.83, PI / 2);                            // the dark inner pipe seen down each tip
  }
  rod(body, [0.375, 0.235, -1.44], [0.375, 0.25, -1.79], 0.032, DARK, 10);                        // tailpipe, out of the ramp into the tips
  add(body, box(0.30, 0.11, 0.32), DARK, 0.375, 0.235, -1.28);                                      // muffler, under the boot floor
  for (const s of [-1, 1]) add(body, box(0.22, 0.22, 0.016), RUB2, s * 0.75, 0.21, -1.60);          // mud flaps
  {                                                                                                 // the wing: a thin blade low over the deck on two swan necks
    const wing = new THREE.Group(); wing.position.set(0, 1.10, -1.93); wing.rotation.x = 0.10; body.add(wing);
    const foil = (x) => {
      const out = [];
      for (let k = 0; k < 14; k++) {
        const t = k / 14, u = 0.5 - 0.5 * Math.cos(2 * PI * t), th = 0.010 * (1.2 * Math.sqrt(u) - 0.3 * u - 0.9 * u * u) / 0.50;
        out.push([x, t < 0.5 ? th + 0.006 : -th * 0.9 + 0.006, 0.10 - 0.20 * u]);
      }
      return out;
    };
    add(wing, loft([foil(-0.62), foil(-0.22), foil(0.22), foil(0.62)], { capFront: 0, capBack: 0 }), DARK);
    for (const s of [-1, 1]) add(wing, box(0.006, 0.08, 0.23), DARK, s * 0.623, 0.004, 0);         // thin end plates
    add(wing, box(0.20, 0.010, 0.02), TAIL, 0, 0.0138, -0.08);                                     // high-mount brake lamp
    add(wing, box(1.24, 0.014, 0.006), DARK, 0, 0.012, -0.099);                                    // gurney flap
    const neck = [[0.915, -1.715], [0.99, -1.725], [1.06, -1.748], [1.112, -1.785], [1.142, -1.83], [1.153, -1.88], [1.145, -1.925], [1.122, -1.955]];
    for (const s of [-1, 1]) {
      const secs = neck.map(([y, z], i) => {
        const q = neck[Math.min(i + 1, neck.length - 1)], p = neck[Math.max(i - 1, 0)];
        const [ty, tz] = unit([q[0] - p[0], q[1] - p[1], 0]), hd = lerp(0.022, 0.016, i / (neck.length - 1)), ny = -tz * hd, nz = ty * hd, x = s * 0.40;
        return [[x - 0.007, y - ny, z - nz], [x + 0.007, y - ny, z - nz], [x + 0.007, y + ny, z + nz], [x - 0.007, y + ny, z + nz]];
      });
      add(body, loft(secs, { creaseRows: [0, 1, 2, 3], capFront: 0, capBack: 0 }), DARK);         // swan neck, hooked over onto the blade
      add(body, box(0.03, 0.01, 0.07), DARK, s * 0.40, topY(s * 0.40, -1.72) + 0.003, -1.72);     // its foot on the deck
    }
  }
