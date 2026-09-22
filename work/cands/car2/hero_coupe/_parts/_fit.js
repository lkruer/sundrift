
  // ---- shared fittings: everything below is the same in all three candidates ------------
  const POLISH = mk(0xb9bcc0, { roughness: 0.2, metalness: 0.8 });                                POLISH.name = 'metal';
  const LANE   = mk(0xe8e4da, { roughness: 0.4, emissive: new THREE.Color(0xe8e4da), emissiveIntensity: 0.5 });
  const REFL   = mk(0xd11c1c, { roughness: 0.4, emissive: new THREE.Color(0xd11c1c), emissiveIntensity: 0.6 });
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {                                                              // bonnet louvres, three per side
      const z = 1.14 + 0.17 * k, x = s * 0.40, y = topY(x, z);
      add(body, box(0.17, 0.012, 0.038), DARK, x, y + 0.002, z, 0.10);
      add(body, box(0.17, 0.006, 0.014), PAINT, x, y + 0.009, z + 0.016, 0.10);                // the louvre's raised lip
    }
    const hx = flankX(s, 0.72, -0.62);                                                         // door handle, flush
    add(body, box(0.006, 0.05, 0.16), DARK, hx + s * 0.003, 0.72, -0.62);
    add(body, box(0.014, 0.028, 0.12), DARK, hx + s * 0.010, 0.725, -0.62);
    add(body, box(0.012, 0.035, 0.09), TAIL, s * 0.832, 0.60, -1.86);                          // rear side marker
  }
  add(body, box(1.10, 0.028, 0.10), PAINT, 0, 1.236, -0.995, 0.34);                            // roof spoiler lip, trailing edge up
  add(body, box(1.10, 0.012, 0.04), DARK, 0, 1.243, -1.03, 0.34);                              // its rubber edge
  add(body, cyl(0.022, 0.026, 0.024, 12), DARK, 0.50, topY(0.50, -0.88) + 0.008, -0.88);      // antenna base
  add(body, cyl(0.007, 0.011, 0.09, 8), RUB, 0.50, topY(0.50, -0.88) + 0.048, -0.90, -0.45);   // rubber mast, raked back
  {                                                                                            // fuel filler on the left rear quarter
    const fx = flankX(1, 0.80, -1.72);
    add(body, new THREE.TorusGeometry(0.055, 0.009, 8, 24), DARK, fx + 0.004, 0.80, -1.72, 0, PI / 2, 0);
    add(body, cyl(0.048, 0.048, 0.008, 24), DARK, fx + 0.006, 0.80, -1.72, 0, 0, PI / 2);
  }

  // ---- front end: bands swept round the nose, a real opening with the intercooler in it ----
  add(body, box(1.20, 0.19, 0.10), DARK, 0, 0.295, 1.955);                                           // intercooler core
  for (let k = 0; k < 12; k++) add(body, box(1.12, 0.007, 0.05), GALV, 0, 0.215 + k * 0.0145, 1.985); // its fins
  for (const s of [-1, 1]) {
    add(body, box(0.07, 0.21, 0.11), DARK, s * 0.635, 0.295, 1.955);                                   // intercooler end tanks
    add(body, new THREE.TorusGeometry(0.05, 0.022, 8, 12, PI / 2), DARK, s * 0.69, 0.35, 1.90, 0, s * PI / 2, 0);   // charge pipe elbows
    add(body, cyl(0.02, 0.02, 0.03, 16), DARK, s * 0.62, 0.185, 2.15, PI / 2);                     // brake duct in the lower band
  }
  add(body, box(1.40, 0.34, 0.02), DARK, 0, 0.31, 1.88);                                            // closes the bay behind it
  add(body, box(0.90, 0.05, 0.02), DARK, 0, 0.535, 2.155);                                          // mouth slot on the upper band
  for (const s of [-1, 1]) {
    const f = faceAt(nose, s * 0.69), fog = new THREE.Group();                                     // fog lamp in a cup
    fog.position.set(f.x, 0.295, f.z); fog.rotation.y = f.yaw; body.add(fog);
    add(fog, cyl(0.05, 0.05, 0.04, 28), DARK, 0, 0, -0.006, PI / 2);
    add(fog, cyl(0.038, 0.038, 0.012, 20), HEAD, 0, 0, 0.018, PI / 2);
    add(fog, new THREE.TorusGeometry(0.044, 0.005, 6, 24), DARK, 0, 0, 0.016);
    const c = faceAt(nose, s * 0.70), can = new THREE.Group();                                      // canard at the corner
    can.position.set(c.x, 0.245, c.z - 0.03); can.rotation.set(-0.32, c.yaw, 0, 'YXZ'); body.add(can);
    add(can, box(0.13, 0.005, 0.16), DARK, 0, 0, 0.06);
    add(can, box(0.005, 0.035, 0.16), DARK, s * 0.065, 0.018, 0.06);                                   // its little end plate
    onFace(nose, s * 0.31, 0.625, 0.34, 0.06, 0.024, HEAD, 0.028);                                 // inner headlamp lens
    onFace(nose, s * 0.545, 0.625, 0.13, 0.06, 0.024, HEAD, 0.028);                                // outer lens pair, following the corner
    onFace(nose, s * 0.685, 0.625, 0.12, 0.06, 0.024, HEAD, 0.028);
  }
  {                                                                                                  // tow hook, low on the right
    const f = faceAt(nose, -0.56), hook = new THREE.Group();
    hook.position.set(f.x, 0.20, f.z); hook.rotation.y = f.yaw; body.add(hook);
    add(hook, box(0.03, 0.03, 0.10), VERM, 0, 0, 0.0);
    add(hook, new THREE.TorusGeometry(0.036, 0.011, 8, 18), VERM, 0, 0, 0.055);
  }

  // ---- rear end: bumper, tail panel, four round lamps, garnish, diffuser, tips, flaps ------
  for (const x of [-0.62, -0.44, 0.44, 0.62]) {
    const f = faceAt(tail, x), lamp = new THREE.Group();
    lamp.position.set(f.x, 0.87, f.z); lamp.rotation.y = f.yaw; body.add(lamp);
    add(lamp, new THREE.CylinderGeometry(0.06, 0.06, 0.024, 32, 1, true), DARK2, 0, 0, 0.026, PI / 2);   // cup, open, the lamp sits down inside it
    add(lamp, cyl(0.048, 0.048, 0.01, 32), TAIL, 0, 0, 0.019, PI / 2);                              // lens, sunk below the rim
    add(lamp, new THREE.TorusGeometry(0.06, 0.004, 8, 32), POLISH, 0, 0, 0.038);                     // polished rim ring
    add(lamp, new THREE.TorusGeometry(0.024, 0.0035, 6, 24), LANE, 0, 0, 0.025);                      // white inner ring
  }
  {                                                                                                  // number-plate pocket: proud rim, blank plate, lamp above
    const zf = -2.19;
    for (const [w, h, x, y] of [[0.36, 0.015, 0, 0.7575], [0.36, 0.015, 0, 0.5725], [0.015, 0.20, -0.1725, 0.665], [0.015, 0.20, 0.1725, 0.665]]) add(body, box(w, h, 0.03), DARK, x, y, zf - 0.008);
    add(body, box(0.33, 0.17, 0.006), LANE, 0, 0.665, zf - 0.011);                                   // blank plate, just inside the rim
    add(body, box(0.08, 0.018, 0.04), DARK, 0, 0.787, zf - 0.012);                                   // plate lamp housing under the garnish
    add(body, box(0.05, 0.008, 0.01), HEAD, 0, 0.78, zf - 0.033);
  }
  for (const s of [-1, 1]) onFace(tail, s * 0.70, 0.63, 0.028, 0.24, 0.02, REFL, 0.014);             // vertical corner reflector strips
  for (const x of [0.36, 0.48]) {
    add(body, cyl(0.045, 0.045, 0.16, 28, true), CHROME, x, 0.29, -2.16, PI / 2);                      // twin tips, left side, hollow
    add(body, cyl(0.03, 0.03, 0.16, 20), DARK, x, 0.29, -2.14, PI / 2);                            // the dark inner pipe seen down the tip
  }
  add(body, box(1.30, 0.05, 0.42), DARK, 0, 0.155, -2.00);                                           // diffuser plate
  for (const x of [-0.60, -0.30, 0, 0.30, 0.60]) add(body, box(0.012, 0.10, 0.30), DARK, x, 0.13, -1.95);   // five fins, set back
  for (const s of [-1, 1]) add(body, box(0.22, 0.22, 0.016), RUB2, s * 0.75, 0.21, -1.60);           // mud flaps
  for (const s of [-1, 1]) {
    add(body, box(0.008, 0.09, 0.26), DARK, s * 0.714, 1.24, -2.02, 0.10);                           // end plate
  }
  add(body, box(0.24, 0.018, 0.03), TAIL, 0, 1.243, -2.115, 0.10);                                   // high-mount brake lamp
  add(body, box(1.40, 0.016, 0.010), DARK, 0, 1.249, -2.126, 0.10);                                  // gurney flap on the trailing edge
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
  for (const s of [-1, 1]) for (const az of [1.275, -1.225]) for (let k = 0; k < 8; k++) {                                                                    // rivet row on the flare face
      const th = (20 + 140 * k / 7) * PI / 180;
      add(body, new THREE.SphereGeometry(0.014, 10, 5, 0, PI * 2, 0, PI / 2), DARK, s * (az > 0 ? 0.875 : 0.89), 0.32 + 0.39 * Math.sin(th), az + 0.39 * Math.cos(th), 0, 0, -s * PI / 2);
    }
  for (const s of [-1, 1]) {
    add(body, box(0.03, 0.03, 1.66), RUB, s * 0.79, 0.905, -0.60);                                   // belt trim
    add(body, box(0.03, 0.03, 0.62), RUB, s * 0.61, 1.245, -0.65);                                   // drip rail
    add(body, box(0.024, 0.024, 0.34), RUB, s * 0.79, 0.912, -1.24);                                 // quarter window lower trim
    rod(body, [s * 0.77, 0.94, 0.20], [s * 0.85, 0.97, 0.17], 0.022, DARK, 10);                      // mirror stalk
    const head = new THREE.Group(); head.position.set(s * 0.885, 0.975, 0.16); head.rotation.y = s * 0.30; body.add(head);
    const shell = add(head, sph(1, 20, 12), DARK); shell.scale.set(0.088, 0.048, 0.062);
    add(head, box(0.13, 0.066, 0.008), MIRROR, 0, 0, -0.052);                                        // mirror face
  }
  add(body, box(1.52, 0.03, 0.03), RUB, 0, 0.875, 0.285);                                            // windscreen base trim
  add(body, box(1.40, 0.03, 0.03), RUB, 0, 0.945, -1.475);                                           // rear glass base trim
  for (const s of [-1, 1]) add(body, box(0.50, 0.014, 0.022), DARK, s * 0.30, 0.914, 0.22, 0.546, s * 0.30, 0);   // wipers, parked on the glass
