
  // ---- front end: bands swept round the nose, a real opening with the intercooler in it ----
  const nose = endPath(1, 2.16, 1.56, wrapF);
  const F = (v) => (typeof v === 'function' ? v : () => v);
  // a band profile with a chamfered top edge: outer face from y0 to y1 - ch, then in and up
  const bandProf = (y0, y1, t, ch) => { const Y0 = F(y0), Y1 = F(y1); return [[0, Y0], [0, (x, z) => Y1(x, z) - ch], [-ch * 0.8, Y1], [-t, Y1], [-t, Y0]]; };
  const plainProf = (y0, y1, t, n0) => [[n0 || 0, y0], [n0 || 0, y1], [-t, y1], [-t, y0]];
  // a small box tangent to a swept face at x, its back sunk into the face
  const onFace = (path, x, y, w, h, d, m, proud, ry) => {
    const f = faceAt(path, x), grp = new THREE.Group();
    grp.position.set(f.x, y, f.z); grp.rotation.y = f.yaw + (ry || 0); body.add(grp);
    add(grp, box(w, h, d), m, 0, 0, (proud || 0) + d / 2 - d);
    return grp;
  };
  const topF = (x, z) => lerp(0.605, 0.648, c01((1.96 - z) / 0.40));         // the hull floor rises over the arch
  add(body, sweep(nose, bandProf(0.40, topF, 0.10, 0.05)), PAINT);                                 // upper bumper
  add(body, sweep(nose, plainProf(0.165, 0.222, 0.10)), PAINT);                                     // lower bumper band
  add(body, sweep(clipX(nose, 0.50, 0.815), plainProf(0.20, 0.42, 0.10)), PAINT);                    // pillar beside the opening
  add(body, sweep(clipX(nose, -0.815, -0.50), plainProf(0.20, 0.42, 0.10)), PAINT);
  add(body, sweep(clipX(nose, -0.80, 0.80), plainProf(0.135, 0.168, 0.10, 0.055)), DARK);          // splitter lip, proud of the face
  add(body, sweep(clipX(nose, -0.80, 0.80), plainProf(0.578, 0.69, 0.10, 0.012)), DARK);           // lamp band
  add(body, box(1.02, 0.20, 0.10), DARK, 0, 0.31, 1.955);                                           // intercooler core
  for (let k = 0; k < 12; k++) add(body, box(0.94, 0.007, 0.05), GALV, 0, 0.226 + k * 0.0155, 1.985); // its fins
  add(body, box(1.40, 0.34, 0.02), DARK, 0, 0.31, 1.88);                                            // closes the bay behind it
  add(body, box(0.90, 0.05, 0.02), DARK, 0, 0.535, 2.155);                                          // mouth slot on the upper band
  for (const s of [-1, 1]) {
    const f = faceAt(nose, s * 0.655), fog = new THREE.Group();                                     // fog lamp in a cup
    fog.position.set(f.x, 0.31, f.z); fog.rotation.y = f.yaw; body.add(fog);
    add(fog, cyl(0.057, 0.057, 0.04, 24), DARK, 0, 0, -0.006, PI / 2);
    add(fog, cyl(0.043, 0.043, 0.012, 20), HEAD, 0, 0, 0.018, PI / 2);
    add(fog, new THREE.TorusGeometry(0.05, 0.006, 6, 24), DARK, 0, 0, 0.016);
    const c = faceAt(nose, s * 0.70), can = new THREE.Group();                                      // canard at the corner
    can.position.set(c.x, 0.245, c.z - 0.03); can.rotation.set(-0.32, c.yaw, 0, 'YXZ'); body.add(can);
    add(can, box(0.13, 0.008, 0.16), DARK, 0, 0, 0.06);
    add(can, box(0.008, 0.04, 0.16), DARK, s * 0.065, 0.02, 0.06);                                   // its little end plate
    onFace(nose, s * 0.31, 0.632, 0.34, 0.085, 0.024, HEAD, 0.028);                                 // inner headlamp lens
    onFace(nose, s * 0.545, 0.632, 0.13, 0.085, 0.024, HEAD, 0.028);                                // outer lens pair, following the corner
    onFace(nose, s * 0.685, 0.632, 0.12, 0.085, 0.024, HEAD, 0.028);
  }
  {                                                                                                  // tow hook, low on the right
    const f = faceAt(nose, -0.56), hook = new THREE.Group();
    hook.position.set(f.x, 0.20, f.z); hook.rotation.y = f.yaw; body.add(hook);
    add(hook, box(0.03, 0.03, 0.10), VERM, 0, 0, 0.0);
    add(hook, new THREE.TorusGeometry(0.036, 0.011, 8, 18), VERM, 0, 0, 0.055);
  }

  // ---- rear end: bumper, tail panel, four round lamps, garnish, diffuser, tips, flaps ------
  const tail = endPath(-1, -2.19, -1.56, wrapR).reverse();                                        // reversed so the swept normal faces out
  const topR = (x, z) => lerp(0.725, 0.80, c01((-1.60 - z) / 0.59));
  add(body, sweep(tail, bandProf(0.17, topR, 0.10, 0.05)), PAINT);                                   // rear bumper
  add(body, sweep(clipX(tail, -0.80, 0.80), plainProf(0.785, 0.955, 0.10, 0.015)), DARK);           // tail lamp panel
  for (const x of [-0.62, -0.44, 0.44, 0.62]) {
    const f = faceAt(tail, x), lamp = new THREE.Group();
    lamp.position.set(f.x, 0.87, f.z); lamp.rotation.y = f.yaw; body.add(lamp);
    add(lamp, cyl(0.073, 0.073, 0.018, 32), DARK, 0, 0, 0.022, PI / 2);                              // bezel
    add(lamp, cyl(0.058, 0.058, 0.014, 32), TAIL, 0, 0, 0.036, PI / 2);                              // lens
  }
  add(body, sweep(tail, plainProf(0.17, 0.31, 0.10, 0.006)), DARK);                                  // lower valance, wraps the corners
  add(body, sweep(tail, plainProf(0.495, 0.507, 0.03, 0.005)), DARK);                                // rubbing strip round the bumper
  add(body, box(0.44, 0.16, 0.024), DARK, 0, 0.60, -2.19);                                           // plate recess, blank
  for (const s of [-1, 1]) onFace(tail, s * 0.66, 0.42, 0.10, 0.035, 0.02, TAIL, 0.008);             // corner reflectors
  add(body, box(0.64, 0.13, 0.026), DARK, 0, 0.87, -2.212);                                          // centre garnish
  add(body, box(0.64, 0.012, 0.03), GALV, 0, 0.941, -2.213);                                         // its bright top trim
  add(body, box(0.32, 0.15, 0.02), DARK, 0.44, 0.27, -2.20);                                         // exhaust cut-out
  for (const x of [0.36, 0.52]) {
    add(body, cyl(0.0425, 0.0425, 0.17, 24, true), CHROME, x, 0.27, -2.15, PI / 2);                  // twin tips, left side
    add(body, cyl(0.036, 0.036, 0.01, 20), RUB, x, 0.27, -2.20, PI / 2);
  }
  add(body, box(1.30, 0.05, 0.42), DARK, 0, 0.155, -2.00);                                           // diffuser plate
  for (const x of [-0.60, -0.30, 0, 0.30, 0.60]) add(body, box(0.012, 0.11, 0.36), DARK, x, 0.155, -2.02);
  for (const s of [-1, 1]) add(body, box(0.20, 0.20, 0.016), RUB2, s * 0.75, 0.22, -1.60);           // mud flaps
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
  add(body, loft([foil(-0.71), foil(-0.30), foil(0.30), foil(0.71)], { capFront: 0, capBack: 0 }), DARK, 0, 1.245, -2.0, 0.12);
  for (const s of [-1, 1]) {
    add(body, loft([rect(1, [s * 0.45, 0.945, -1.85], [0.02, 0.08]), rect(1, [s * 0.45, 1.10, -1.93], [0.02, 0.075]), rect(1, [s * 0.45, 1.24, -1.98], [0.02, 0.07])], { capFront: 0, capBack: 0 }), DARK);
    add(body, box(0.012, 0.11, 0.28), DARK, s * 0.716, 1.255, -2.0, 0.12);                           // end plate
  }
  add(body, box(0.26, 0.024, 0.035), TAIL, 0, 1.252, -2.10, 0.12);                                   // high-mount brake lamp
  add(body, box(1.40, 0.022, 0.012), DARK, 0, 1.262, -2.108, 0.12);                                  // gurney flap on the trailing edge
  add(body, box(0.42, 0.14, 0.44), DARK, 0.44, 0.23, -1.66);                                         // muffler, seen under the rear bumper
  rod(body, [0.44, 0.23, -1.88], [0.44, 0.27, -2.12], 0.03, DARK, 10);                               // tailpipe into the tips
  for (const s of [-1, 1]) {                                                                         // bonnet pins at the front corners
    add(body, cyl(0.02, 0.02, 0.01, 12), DARK, s * 0.50, topY(s * 0.50, 1.68) + 0.004, 1.68);
    add(body, cyl(0.007, 0.007, 0.02, 8), GALV, s * 0.50, topY(s * 0.50, 1.68) + 0.014, 1.68);
  }

  // ---- flanks: skirts, tubs, plate, flares with rivets, pillars, trims, mirrors -------------
  for (const s of [-1, 1]) {
    add(body, box(0.07, 0.50, 1.80), PAINT, s * 0.765, 0.47, 0.02);                                  // door skin, sill to the hull's floor line
    add(body, box(0.06, 0.10, 1.78), DARK, s * 0.79, 0.19, 0.03);                                    // skirt blade
    add(body, box(0.11, 0.035, 1.78), DARK, s * 0.805, 0.152, 0.03);                                 // its step
    add(body, box(0.18, 0.04, 1.78), DARK, s * 0.71, 0.16, 0.03);
    add(body, box(0.18, 0.04, 0.46), DARK, s * 0.71, 0.16, 1.875);
    add(body, box(0.18, 0.04, 0.52), DARK, s * 0.71, 0.16, -1.89);
    for (const az of [1.275, -1.225]) {                                                              // wheel tubs
      add(body, box(0.04, 0.50, 0.80), DARK, s * 0.57, 0.47, az);
      const hf = az > 0 ? 0.44 : 0.50, hr = az > 0 ? 0.49 : 0.50;
      add(body, box(0.22, hf, 0.04), DARK, s * 0.68, 0.22 + hf / 2, az + 0.40);
      add(body, box(0.22, hr, 0.04), DARK, s * 0.68, 0.22 + hr / 2, az - 0.40);
    }
  }
  add(body, box(1.24, 0.04, 4.20), DARK, 0, 0.16, 0);                                                // underbody plate
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
    for (let k = 0; k < 8; k++) {                                                                    // rivet row on the flare face
      const th = (20 + 140 * k / 7) * PI / 180;
      add(body, new THREE.SphereGeometry(0.014, 10, 5, 0, PI * 2, 0, PI / 2), DARK, s * 0.86, 0.32 + 0.39 * Math.sin(th), az + 0.39 * Math.cos(th), 0, 0, -s * PI / 2);
    }
  }
  for (const s of [-1, 1]) {
    add(body, loft([rect(1, [s * 0.775, 0.865, 0.26], [0.03, 0.05]), rect(1, [s * 0.66, 1.245, -0.36], [0.03, 0.05])], { capFront: 0, capBack: 0 }), PAINT);   // A pillar
    add(body, loft([rect(1, [s * 0.78, 0.915, -0.825], [0.03, 0.045]), rect(1, [s * 0.663, 1.245, -0.825], [0.03, 0.045])], { capFront: 0, capBack: 0 }), PAINT); // B pillar
    add(body, loft([[[s * 0.75, 0.925, -1.47], [s * 0.81, 0.925, -1.47], [s * 0.81, 0.925, -1.21], [s * 0.75, 0.925, -1.21]],
                    [[s * 0.633, 1.24, -0.965], [s * 0.693, 1.24, -0.965], [s * 0.693, 1.24, -0.955], [s * 0.633, 1.24, -0.955]]], { capFront: 0, capBack: 0 }), PAINT); // C pillar
    add(body, box(0.03, 0.03, 1.66), RUB, s * 0.79, 0.935, -0.60);                                   // belt trim
    add(body, box(0.03, 0.03, 0.62), RUB, s * 0.67, 1.245, -0.65);                                   // drip rail
    add(body, box(0.024, 0.024, 0.34), RUB, s * 0.79, 0.915, -1.24);                                 // quarter window lower trim
    rod(body, [s * 0.77, 0.94, 0.20], [s * 0.85, 0.97, 0.17], 0.022, DARK, 10);                      // mirror stalk
    const head = new THREE.Group(); head.position.set(s * 0.885, 0.975, 0.16); head.rotation.y = s * 0.30; body.add(head);
    const shell = add(head, sph(1, 16, 10), DARK); shell.scale.set(0.088, 0.048, 0.062);
    add(head, box(0.13, 0.066, 0.008), MIRROR, 0, 0, -0.052);                                        // mirror face
  }
  add(body, box(1.52, 0.03, 0.03), RUB, 0, 0.875, 0.285);                                            // windscreen base trim
  add(body, box(1.44, 0.03, 0.03), RUB, 0, 0.965, -1.475);                                           // rear glass base trim
  for (const s of [-1, 1]) add(body, box(0.50, 0.014, 0.022), DARK, s * 0.30, 0.914, 0.22, 0.546, s * 0.30, 0);   // wipers, parked on the glass
