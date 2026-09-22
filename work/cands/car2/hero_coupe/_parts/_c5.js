
  // ---- interior: dash, binnacle, gauges, seats, harness, cage, driver, wheel, shifter ------
  add(body, box(1.40, 0.04, 1.80), DARK, 0, 0.30, -0.45);                                            // floor
  add(body, box(0.24, 0.14, 1.30), DARK, 0, 0.39, -0.45);                                            // tunnel
  add(body, box(1.46, 0.24, 0.36), DARK, 0, 0.72, 0.16);                                             // dashboard
  add(body, box(1.46, 0.05, 0.22), DARK, 0, 0.855, 0.18);                                            // its upper pad
  add(body, box(1.40, 0.04, 0.45), DARK, 0, 0.92, -1.26);                                            // parcel shelf
  add(body, new THREE.CylinderGeometry(0.095, 0.095, 0.30, 12, 1, true, 0, PI), DARK2, -0.36, 0.86, 0.10, 0, 0, PI / 2);   // binnacle hood
  {
    const gz = new THREE.Group(); gz.position.set(-0.36, 0.87, 0.11); gz.rotation.x = -PI / 2 + 0.28; body.add(gz);      // gauges face the driver
    for (const dx of [-0.085, 0, 0.085]) {
      add(gz, cyl(0.036, 0.036, 0.03, 18), DARK, dx, 0, 0);
      add(gz, cyl(0.029, 0.029, 0.008, 18), GAUGE, dx, 0.016, 0);
      add(gz, box(0.004, 0.006, 0.026), DARK, dx, 0.022, 0.003);                                     // needle
    }
  }
  add(body, cyl(0.045, 0.055, 0.05, 12), DARK, -0.05, 0.47, -0.30);                                  // shifter boot
  rod(body, [-0.05, 0.48, -0.30], [-0.04, 0.64, -0.27], 0.012, DARK, 10);
  add(body, sph(0.03, 12, 8), GALV, -0.04, 0.655, -0.265);                                           // shift knob
  rod(body, [-0.05, 0.46, -0.48], [-0.05, 0.60, -0.62], 0.012, DARK, 8);                            // handbrake lever
  add(body, sph(0.022, 10, 6), DARK, -0.05, 0.61, -0.63);
  for (const px of [-0.46, -0.36, -0.26]) add(body, box(0.06, 0.07, 0.012), DARK, px, 0.40, 0.02, -0.6);   // pedals
  add(body, cyl(0.045, 0.045, 0.26, 12), VERM, 0.38, 0.365, 0.05, 0, 0, PI / 2);                    // fire extinguisher on the passenger floor
  add(body, cyl(0.016, 0.02, 0.05, 8), DARK, 0.53, 0.365, 0.05, 0, 0, PI / 2);
  for (const s of [-1, 1]) {
    const x = s * 0.36;
    add(body, loft([rect(2, [x, 0.39, -0.25], [0.22, 0.07]), rect(2, [x, 0.40, -0.75], [0.24, 0.08])], { capFront: 0, capBack: 0 }), SEAT);      // cushion
    add(body, loft([rect(1, [x, 0.44, -0.75], [0.24, 0.05]), rect(1, [x, 0.70, -0.79], [0.25, 0.05]), rect(1, [x, 0.88, -0.83], [0.19, 0.04])],
                   { capFront: 0, capBack: 0 }), SEAT);                                                                                           // backrest
    for (const b of [-1, 1]) {
      add(body, box(0.07, 0.11, 0.42), SEAT, x + b * 0.215, 0.475, -0.50);                            // cushion bolsters
      add(body, box(0.07, 0.34, 0.11), SEAT, x + b * 0.21, 0.66, -0.735, -0.18);                     // backrest bolsters
    }
    add(body, box(0.10, 0.012, 0.46), VERM, x, 0.475, -0.50);                                        // stripe
    add(body, box(0.10, 0.40, 0.012), VERM, x, 0.66, -0.735, -0.18);
    if (s > 0) {                                                                                     // passenger harness lies on the seat
      for (const b of [-1, 1]) {
        slab(body, [x + b * 0.07, 0.87, -0.815], [x + b * 0.07, 0.47, -0.705], 0.05, 0.008, VERM, [0, 0.2, 1]);
        slab(body, [x + b * 0.07, 0.49, -0.70], [x + b * 0.08, 0.47, -0.40], 0.05, 0.008, VERM, [0, 1, 0]);
        slab(body, [x + b * 0.21, 0.50, -0.56], [x + b * 0.03, 0.49, -0.40], 0.045, 0.008, VERM, [0, 1, 0]);   // lap straps
      }
      add(body, box(0.06, 0.025, 0.05), DARK, x, 0.50, -0.39);                                       // buckle
    }
  }
  // driver: torso (revolved, flattened front to back), helmet, visor band, arms, gloves
  const torso = add(body, revolve(1, [[0.10, 0], [0.17, 0.05], [0.19, 0.25], [0.17, 0.38], [0.11, 0.44], [0.001, 0.47]], 16), SUIT, -0.36, 0.44, -0.55, -0.15);
  torso.scale.z = 0.68;
  for (const b of [-1, 1]) {                                                                         // driver harness over the chest
    slab(body, [-0.36 + b * 0.07, 0.87, -0.455], [-0.36 + b * 0.08, 0.50, -0.385], 0.05, 0.008, VERM, [0, 0.2, 1]);
    slab(body, [-0.36 + b * 0.21, 0.50, -0.56], [-0.36 + b * 0.03, 0.50, -0.39], 0.045, 0.008, VERM, [0, 1, 0]);
  }
  add(body, box(0.06, 0.025, 0.05), DARK, -0.36, 0.505, -0.385);
  const helm = [];
  for (let k = 0; k <= 12; k++) { const t = -1.25 + (PI / 2 + 1.25) * k / 12; helm.push([0.13 * Math.cos(t), 0.13 * Math.sin(t)]); }
  add(body, revolve(1, helm, 32), HELMET, -0.36, 1.00, -0.52);
  const visor = new THREE.TorusGeometry(0.118, 0.032, 8, 16, 2.4); visor.rotateZ(PI / 2 - 1.2); visor.rotateX(PI / 2);
  add(body, visor, DARK, -0.36, 1.01, -0.52);
  for (const b of [-1, 1]) {
    rod(body, [-0.36 + b * 0.17, 0.83, -0.53], [-0.36 + b * 0.14, 0.85, -0.10], 0.035, SUIT, 10);
    add(body, sph(0.045, 12, 8), DARK, -0.36 + b * 0.14, 0.85, -0.10);                              // gloved hands
  }
  const sw = new THREE.Group(); sw.position.set(-0.36, 0.84, -0.08); sw.rotation.x = -0.29; body.add(sw);
  add(sw, new THREE.TorusGeometry(0.15, 0.022, 10, 28), DARK);
  add(sw, revolve(2, [[0.12, 0], [0.045, 0.09], [0.045, 0.11], [0.001, 0.11]], 16), DARK2);          // deep dish
  for (const p of [[0.14, 0, 0], [-0.14, 0, 0], [0, -0.14, 0]]) rod(sw, [0, 0, 0.085], p, 0.016, DARK, 8);
  // roll cage: main hoop, rear cross bar, diagonal, roof bars, A bars, door bars
  for (const s of [-1, 1]) {
    rod(body, [s * 0.66, 0.32, -0.98], [s * 0.60, 1.12, -0.98], 0.02, DARK, 12);
    rod(body, [s * 0.60, 1.12, -0.98], [s * 0.60, 1.10, -0.38], 0.02, DARK, 12);
    rod(body, [s * 0.60, 1.10, -0.38], [s * 0.70, 0.88, 0.22], 0.02, DARK, 12);
    rod(body, [s * 0.63, 0.42, -0.95], [s * 0.69, 0.70, 0.18], 0.02, DARK, 12);
  }
  rod(body, [-0.60, 1.12, -0.98], [0.60, 1.12, -0.98], 0.02, DARK, 12);
  rod(body, [-0.62, 0.90, -0.98], [0.62, 0.90, -0.98], 0.02, DARK, 12);
  rod(body, [0.62, 0.40, -0.99], [-0.58, 1.10, -0.99], 0.02, DARK, 12);

  // ---- wheels: revolved tyre, 12 tread blocks, bead ring, rim shell and polished lip,
  //      five spokes, hub, cap, five lug nuts; the disc and caliper live on the hub -----------
  function wheel(side, w) {
    const wh = new THREE.Group(), hw = w / 2;
    const rv = (prof, seg, off) => revolve(0, prof.map(([r, a]) => [r, side * a]), seg, off);   // +a outboard
    const at = (geo, m, o, y, z, rx, rz) => {
      const mesh = new THREE.Mesh(geo, m); mesh.position.set(side * (o || 0), y || 0, z || 0);
      if (rx) mesh.rotation.x = rx; if (rz) mesh.rotation.z = rz; wh.add(mesh); return mesh;
    };
    at(rv([[0.25, -hw + 0.03], [0.292, -hw + 0.006], [0.306, -hw + 0.045], [0.306, hw - 0.045], [0.292, hw - 0.006], [0.25, hw - 0.03]], 48), RUB);
    for (let k = 0; k < 12; k++) {
      const geo = lathe([[0.300, -hw + 0.04], [0.32, -hw + 0.062], [0.32, hw - 0.062], [0.300, hw - 0.04]], 4, k * PI / 6 + 0.04, PI / 6 - 0.08);
      geo.rotateZ(-PI / 2); at(geo, RUB2);
    }
    const bead = at(new THREE.TorusGeometry(0.262, 0.008, 6, 44), RUB, hw - 0.012); bead.rotation.y = PI / 2;
    at(rv([[0.24, -hw + 0.02], [0.222, -hw + 0.05], [0.222, hw - 0.07], [0.215, hw - 0.03]], 32), BRONZ2);        // barrel
    at(rv([[0.20, hw - 0.03], [0.238, hw - 0.03], [0.238, hw + 0.004], [0.20, hw + 0.004]], 32), LIP);            // polished lip
    const os = hw - 0.10;
    at(rv([[0.001, os - 0.06], [0.08, os - 0.06], [0.08, os], [0.05, os], [0.05, os + 0.012], [0.001, os + 0.012]], 16), BRONZE);
    at(rv([[0.001, os + 0.012], [0.040, os + 0.012], [0.040, os + 0.020], [0.001, os + 0.020]], 16), DARK);         // centre cap
    for (let k = 0; k < 5; k++) {
      const a = k * PI * 2 / 5 + PI / 2;
      at(box(0.034, 0.17, 0.05), BRONZE, os - 0.015, 0.135 * Math.cos(a), 0.135 * Math.sin(a), a);
      at(cyl(0.011, 0.011, 0.014, 6), DARK, os + 0.016, 0.058 * Math.cos(a + PI / 5), 0.058 * Math.sin(a + PI / 5), 0, PI / 2);   // lug nut
    }
    at(rv([[0.062, -0.05], [0.062, os - 0.06]], 16), DARK2);                                                       // hub bell
    return wh;
  }
  const VERM2 = mk(0xc9402b, { roughness: 0.6, side: DS });
  const corner = (name, side, z, w, camberDeg) => {
    const hub = new THREE.Group(); hub.name = 'hub' + name;
    hub.position.set(side * 0.75, 0.32, z); hub.rotation.z = side * camberDeg * PI / 180;
    const wh = wheel(side, w); wh.name = 'wheel' + name; hub.add(wh);
    const disc = new THREE.Mesh(revolve(0, [[0.075, -0.062], [0.160, -0.062], [0.160, -0.038], [0.075, -0.038]].map(([r, a]) => [r, side * a]), 40), DISC); hub.add(disc);
    const cal = new THREE.Mesh(lathe([[0.105, -0.028], [0.168, -0.028], [0.168, 0.028], [0.105, 0.028], [0.105, -0.028]], 8, -1.25, 1.0), VERM2);
    cal.geometry.rotateZ(-PI / 2); cal.position.x = side * -0.05; hub.add(cal);
    g.add(hub);
    return { hub, wh };
  };
  const FL = corner('FL', 1, 1.275, 0.24, 4), FR = corner('FR', -1, 1.275, 0.24, 4);
  const RL = corner('RL', 1, -1.225, 0.27, 3), RR = corner('RR', -1, -1.225, 0.27, 3);
  g.userData.joints = { hubFL: FL.hub, hubFR: FR.hub, wheelFL: FL.wh, wheelFR: FR.wh, wheelRL: RL.wh, wheelRR: RR.wh };

  // ---- ground and centre by measuring vertices, shifting the CHILDREN of g -------------
  const bb = new THREE.Box3(), v = new THREE.Vector3(), m = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const put = (mat) => { for (let i = 0; i < p.count; i++) bb.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); put(m.multiplyMatrices(n.matrixWorld, im)); } return; }
    put(n.matrixWorld);
  });
  const c = bb.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= bb.min.y; o.position.z -= c.z; });
  return g;
}
