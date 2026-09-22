// hero_coupe — arm A: primitives. Every body mass is a BoxGeometry whose vertices are
// re-written after construction (taper in plan, crown across the top, shear for the
// glasshouse rake), the wheels are cylinders and tori, the driver a sphere and a
// capsule. Nose = +Z, base y = 0. 1.72 W x 1.28 H x 4.45 L (mirrors and the tyre
// poke stand slightly outside the body width).
//
// Moving parts: g.userData.joints = { hubFL, hubFR, wheelFL, wheelFR, wheelRL, wheelRR }.
// Each hub is a Group at the wheel centre (steer about y, camber baked into z), each
// wheel a Group at the same origin (spin about x). Everything else is under 'body'.
export default function (THREE) {
  const g = new THREE.Group();
  const body = new THREE.Group(); body.name = 'body'; g.add(body);
  const PI = Math.PI, DS = THREE.DoubleSide;
  const lerp = (a, b, t) => a + (b - a) * t;
  const c01 = (t) => Math.max(0, Math.min(1, t));

  // ---- materials: every hex from STYLE_LOCK.md -----------------------------------
  const mk = (color, o) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0 }, o || {}));
  const PAINT  = mk(0xf2f0ea, { roughness: 0.35 });                                    PAINT.name = 'paint';
  const GLASS  = mk(0x1c2a33, { roughness: 0.1, transparent: true, opacity: 0.55 });   GLASS.name = 'glass';
  const DARK   = mk(0x2b2d31, { roughness: 0.5 });                                     DARK.name = 'metal';
  const DARK2  = mk(0x2b2d31, { roughness: 0.5, side: DS });                           DARK2.name = 'metal';
  const EXH    = mk(0x2b2d31, { roughness: 0.3, metalness: 0.8 });                     EXH.name = 'metal';
  const RUB    = mk(0x1a1a1c, { roughness: 0.9 });
  const BRONZE = mk(0xb8843a, { roughness: 0.4, metalness: 0.25 });                    BRONZE.name = 'metal';
  const BRONZ2 = mk(0xb8843a, { roughness: 0.4, metalness: 0.25, side: DS });          BRONZ2.name = 'metal';
  const GALV   = mk(0xb9bcc0, { roughness: 0.5, metalness: 0.6 });                     GALV.name = 'metal';
  const HEAD   = mk(0xffcf7a, { roughness: 0.3, emissive: new THREE.Color(0xfff1d6), emissiveIntensity: 0.8 });
  const TAIL   = mk(0xd11c1c, { roughness: 0.4, emissive: new THREE.Color(0xd11c1c), emissiveIntensity: 1.5 });
  const SEAT   = mk(0x1a1a1c, { roughness: 0.9 });
  const STRIPE = mk(0xc9402b, { roughness: 0.8 });
  const HELMET = mk(0xf2f0ea, { roughness: 0.3 });
  const SUIT   = mk(0x2b2d31, { roughness: 0.85 });

  // ---- helpers --------------------------------------------------------------------
  const add = (parent, geo, m, x, y, z, rx, ry, rz) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0);
    if (rx || ry || rz) o.rotation.set(rx || 0, ry || 0, rz || 0);
    parent.add(o); return o;
  };
  const box = (w, h, d, sx, sy, sz) => new THREE.BoxGeometry(w, h, d, sx || 1, sy || 1, sz || 1);
  const cyl = (r1, r2, h, s, open) => new THREE.CylinderGeometry(r1, r2, h, s, 1, !!open);
  // Rewrite every vertex, then recompute normals. Box faces do not share vertices
  // across their edges, so the edges stay crisp and each face shades smoothly.
  // Every mapping below is monotonic (no reflection), so the winding survives.
  const warp = (geo, fn) => {
    const p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v); p.setXYZ(i, v.x, v.y, v.z); }
    p.needsUpdate = true; geo.computeVertexNormals(); return geo;
  };
  // A box placed in world coordinates first, then warped with a world-space function,
  // so several pieces can share one shaping function and stay flush with each other.
  const piece = (parent, geo, m, x, y, z, fn) => { geo.translate(x, y, z); if (fn) warp(geo, fn); return add(parent, geo, m); };
  // BoxGeometry groups: 0 px, 1 nx, 2 py, 3 ny, 4 pz, 5 nz.
  const dropFaces = (geo, faces) => {
    const idx = geo.index.array, keep = [];
    geo.groups.forEach((gr, i) => { if (!faces.includes(i)) for (let k = gr.start; k < gr.start + gr.count; k++) keep.push(idx[k]); });
    geo.setIndex(keep); geo.clearGroups(); return geo;
  };
  // A box whose long axis runs p1 -> p2, `thick` along the surface normal n, `width` across.
  const slab = (parent, p1, p2, width, thick, m, n, extra) => {
    const a = new THREE.Vector3().fromArray(p1), b = new THREE.Vector3().fromArray(p2);
    const d = b.clone().sub(a); const len = d.length() + (extra || 0); d.normalize();
    const nn = new THREE.Vector3().fromArray(n).normalize();
    const t = new THREE.Vector3().crossVectors(d, nn).normalize();
    nn.crossVectors(t, d).normalize();
    const o = new THREE.Mesh(box(width, len, thick), m);
    o.setRotationFromMatrix(new THREE.Matrix4().makeBasis(t, d, nn));
    o.position.copy(a).add(b).multiplyScalar(0.5);
    parent.add(o); return o;
  };
  const rod = (parent, p1, p2, r, m, seg) => {
    const a = new THREE.Vector3().fromArray(p1), b = new THREE.Vector3().fromArray(p2);
    const d = b.clone().sub(a); const len = d.length();
    const o = new THREE.Mesh(cyl(r, r, len, seg || 10), m);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    o.position.copy(a).add(b).multiplyScalar(0.5);
    parent.add(o); return o;
  };
  // plan-view rounding of the nose corners, shared by every piece at the front
  const wrap = (x) => 0.12 * Math.pow(c01((Math.abs(x) - 0.45) / 0.36), 1.5);
  const bonnetY = (z) => 0.68 + 0.18 * c01((2.10 - z) / 1.825);

  // ---- underbody plate, skirts, doors, tubs ---------------------------------------
  piece(body, box(1.24, 0.04, 4.20), DARK, 0, 0.16, 0);
  for (const s of [-1, 1]) {
    piece(body, box(0.18, 0.04, 1.78), DARK, s * 0.71, 0.16, 0.03);
    piece(body, box(0.18, 0.04, 0.46), DARK, s * 0.71, 0.16, 1.875);
    piece(body, box(0.18, 0.04, 0.52), DARK, s * 0.71, 0.16, -1.89);
    piece(body, box(0.06, 0.10, 1.78), DARK, s * 0.79, 0.19, 0.03);            // side skirt
    piece(body, box(0.06, 0.69, 1.80), PAINT, s * 0.76, 0.585, 0.025);         // door, sill to belt
    piece(body, box(0.06, 0.26, 0.78), PAINT, s * 0.76, 0.83, -1.265);         // rear quarter over the arch
    for (const az of [1.275, -1.225]) {                                        // wheel tubs
      piece(body, box(0.04, 0.50, 0.80), DARK, s * 0.57, 0.47, az);
      piece(body, box(0.24, 0.50, 0.04), DARK, s * 0.68, 0.47, az + 0.40);
      piece(body, box(0.24, 0.50, 0.04), DARK, s * 0.68, 0.47, az - 0.40);
    }
    piece(body, box(0.22, 0.04, 0.80), DARK, s * 0.68, 0.72, -1.225);          // rear tub roof
  }

  // ---- nose: bumper split around a real intake recess, lip, lamp band -------------
  const noseFn = (v) => {
    const u = c01((v.z - 1.625) / 0.52), w = wrap(v.x);
    v.x *= lerp(1, 0.93, u * u);
    v.z -= w * u + 0.04 * u * c01((0.30 - v.y) / 0.14);
  };
  piece(body, box(1.68, 0.24, 0.52, 8, 1, 3), PAINT, 0, 0.46, 1.885, noseFn);          // upper band  y 0.34-0.58
  piece(body, box(1.68, 0.06, 0.52, 8, 1, 3), PAINT, 0, 0.19, 1.885, noseFn);          // lower band  y 0.16-0.22
  for (const s of [-1, 1]) piece(body, box(0.29, 0.12, 0.52, 2, 1, 3), PAINT, s * 0.695, 0.28, 1.885, noseFn);
  piece(body, box(1.16, 0.14, 0.04), DARK, 0, 0.28, 2.06);                              // intake back plate, 0.065 deep
  piece(body, box(0.90, 0.06, 0.02), DARK, 0, 0.53, 2.148);                             // mouth slot
  piece(body, box(1.60, 0.03, 0.17, 8, 1, 2), DARK, 0, 0.155, 2.14, (v) => { v.z -= wrap(v.x); }); // splitter lip
  for (const s of [-1, 1]) {
    add(body, cyl(0.05, 0.05, 0.02, 20), DARK, s * 0.66, 0.30, 2.10, PI / 2);          // fog recess
    add(body, cyl(0.032, 0.032, 0.012, 16), HEAD, s * 0.66, 0.30, 2.112, PI / 2);      // fog lens
  }
  piece(body, box(1.62, 0.11, 0.06, 8, 1, 1), DARK, 0, 0.63, 2.13, (v) => { v.z -= wrap(v.x); }); // lamp band
  for (const s of [-1, 1]) {
    add(body, box(0.34, 0.09, 0.03), HEAD, s * 0.31, 0.63, 2.17);                       // inner lens
    add(body, box(0.34, 0.09, 0.03), HEAD, s * 0.66, 0.63, 2.10, 0, s * 0.36, 0);      // outer lens wraps the corner
  }

  // ---- bonnet and front fenders: one crowned, tapered box ------------------------
  piece(body, box(1.60, 0.20, 1.845, 8, 2, 10), PAINT, 0, 0.76, 1.1975, (v) => {
    const t = (v.y - 0.66) / 0.20;
    const yTop = bonnetY(v.z) + 0.025 * (1 - Math.pow(v.x / 0.80, 2));
    const yBot = 0.70 - 0.10 * c01((v.z - 1.70) / 0.40);
    const w = wrap(v.x) * c01((v.z - 1.90) / 0.22);
    v.y = lerp(yBot, yTop, t);
    v.x *= lerp(1, 0.955, c01((v.z - 1.0) / 1.1));
    v.z -= w;
  });
  piece(body, box(0.50, 0.03, 1.60, 6, 1, 6), PAINT, 0, 0.885, 1.20, (v) => {           // centre bulge
    const top = v.y > 0.885, e = c01((v.z - 0.42) / 0.25) * c01((1.98 - v.z) / 0.25);
    v.y = bonnetY(v.z) + 0.02 + (top ? 0.03 * e * (1 - Math.pow(v.x / 0.25, 2)) : 0);
  });

  // ---- glasshouse: one warped box (rake, tumblehome), top and bottom faces dropped --
  const cab = box(1.56, 0.36, 1.755, 1, 2, 4);
  warp(cab, (v) => {
    const u = (v.z + 0.8775) / 1.755, t = (v.y + 0.18) / 0.36;
    v.z = lerp(lerp(-1.48, -0.95, t), lerp(0.275, -0.35, t), u);
    v.y = lerp(0.88, 1.24, t);
    v.x *= lerp(1, 0.846, t);
  });
  dropFaces(cab, [2, 3]);
  add(body, cab, GLASS);
  // roof panel, crowned both ways, peak 1.28 at z = -0.65
  piece(body, box(1.34, 0.045, 0.64, 6, 1, 4), PAINT, 0, 1.2275, -0.65, (v) => {
    const top = v.y > 1.2275;
    const y = 1.235 + 0.03 * (1 - Math.pow(v.x / 0.67, 2)) + 0.015 * (1 - Math.pow((v.z + 0.65) / 0.32, 2));
    v.y = top ? y : y - 0.045;
  });
  for (const s of [-1, 1]) {
    const ap = box(0.06, 0.38, 0.10, 1, 3, 1);                                          // A-pillar along the rake
    warp(ap, (v) => { const t = (v.y + 0.19) / 0.38, sx = v.x > 0 ? 1 : -1, sz = v.z > 0 ? 0.01 : -0.09;
      v.y = lerp(0.865, 1.245, t); v.z = lerp(0.275, -0.35, t) + sz; v.x = s * lerp(0.775, 0.66, t) + sx * 0.03; });
    add(body, ap, PAINT);
    const bp = box(0.06, 0.32, 0.09, 1, 2, 1);                                          // B-pillar, tumbled in
    warp(bp, (v) => { const t = (v.y + 0.16) / 0.32, sx = v.x > 0 ? 1 : -1;
      v.y = lerp(0.915, 1.245, t); v.z = -0.825 + v.z; v.x = s * lerp(0.78, 0.663, t) + sx * 0.03; });
    add(body, bp, PAINT);
    const cp = box(0.06, 0.32, 0.50, 1, 2, 2);                                          // C-pillar: a triangle in side view
    warp(cp, (v) => { const t = (v.y + 0.16) / 0.32, u = (v.z + 0.25) / 0.5, sx = v.x > 0 ? 1 : -1;
      v.z = lerp(lerp(-1.47, -0.955, t), lerp(-1.21, -0.965, t), u);
      v.y = lerp(0.925, 1.245, t); v.x = s * lerp(0.78, 0.663, t) + sx * 0.03; });
    add(body, cp, PAINT);
    // rubber trim: belt line and roof rail
    add(body, box(0.03, 0.03, 1.66), RUB, s * 0.79, 0.935, -0.60);
    add(body, box(0.03, 0.03, 0.62), RUB, s * 0.67, 1.245, -0.65);
    // mirror on a stalk at the A-pillar base
    rod(body, [s * 0.77, 0.94, 0.20], [s * 0.85, 0.97, 0.17], 0.02, DARK, 10);
    const head = new THREE.Group(); head.position.set(s * 0.885, 0.975, 0.16); head.rotation.y = s * 0.30; body.add(head);
    add(head, box(0.16, 0.09, 0.05), DARK);
    add(head, box(0.13, 0.07, 0.008), GALV, 0, 0, -0.027);
  }
  add(body, box(1.52, 0.03, 0.03), RUB, 0, 0.875, 0.285);                               // windscreen base trim
  add(body, box(1.44, 0.03, 0.03), RUB, 0, 0.965, -1.475);                              // rear glass base trim

  // ---- boot, rear panel, bumper, diffuser, exhaust --------------------------------
  piece(body, box(1.60, 0.26, 0.70, 4, 1, 4), PAINT, 0, 0.83, -1.815, (v) => {
    if (v.y > 0.83) v.y = 0.96 + 0.012 * (1 - Math.pow(v.x / 0.80, 2)) + 0.03 * c01((-2.10 - v.z) / 0.065);
    v.x *= lerp(1, 0.97, c01((-1.9 - v.z) / 0.265));
  });
  piece(body, box(1.58, 0.16, 0.05), DARK, 0, 0.86, -2.165);                            // tail lamp panel
  for (const s of [-1, 1]) for (const x of [0.44, 0.62]) add(body, cyl(0.055, 0.055, 0.03, 24), TAIL, s * x, 0.86, -2.195, PI / 2);
  piece(body, box(1.62, 0.22, 0.52, 4, 1, 3), PAINT, 0, 0.67, -1.93, (v) => { v.x *= lerp(1, 0.96, c01((-1.9 - v.z) / 0.29)); });
  piece(body, box(1.68, 0.40, 0.58, 4, 2, 3), PAINT, 0, 0.36, -1.92, (v) => {
    const u = c01((-1.9 - v.z) / 0.31); v.x *= lerp(1, 0.94, u * u); v.z += 0.04 * u * c01((0.30 - v.y) / 0.14);
  });
  piece(body, box(1.30, 0.10, 0.025), DARK, 0, 0.21, -2.20);                            // diffuser panel
  for (const x of [-0.55, -0.20, 0.20, 0.55]) piece(body, box(0.04, 0.12, 0.28), DARK, x, 0.20, -2.07);
  add(body, cyl(0.045, 0.045, 0.12, 20), EXH, 0.50, 0.24, -2.20, PI / 2);              // exhaust, left side
  add(body, cyl(0.036, 0.036, 0.012, 20), RUB, 0.50, 0.24, -2.255, PI / 2);
  // rear wing: aerofoil blade on two swept uprights
  const blade = box(1.42, 0.03, 0.22, 8, 1, 6);
  warp(blade, (v) => {
    const u = (0.11 - v.z) / 0.22;
    const s = u < 0.25 ? lerp(0.5, 1, u / 0.25) : lerp(1, 0.22, (u - 0.25) / 0.75);
    v.y = v.y * s + 0.012 * (1 - Math.pow(2 * u - 1, 2));
  });
  add(body, blade, DARK, 0, 1.255, -2.0, -0.14);
  for (const s of [-1, 1]) slab(body, [s * 0.45, 0.93, -1.86], [s * 0.45, 1.25, -1.99], 0.16, 0.04, DARK, [s, 0, 0], 0);

  // ---- flares: seven boxes each, a polygonal arch with a flat top ----------------
  for (const s of [-1, 1]) for (const [az, R] of [[1.275, 0.40], [-1.225, 0.42]]) {
    const th0 = Math.asin(-0.08 / R), dth = (PI - 2 * th0) / 7;
    for (let k = 0; k < 7; k++) {
      const a1 = th0 + k * dth, a2 = a1 + dth;
      slab(body, [s * 0.825, 0.32 + R * Math.sin(a1), az + R * Math.cos(a1)],
                 [s * 0.825, 0.32 + R * Math.sin(a2), az + R * Math.cos(a2)], 0.10, 0.07, PAINT, [s, 0, 0], 0.025);
    }
  }

  // ---- interior ---------------------------------------------------------------------
  add(body, box(1.40, 0.04, 1.80), DARK, 0, 0.30, -0.45);                               // floor at 0.32
  add(body, box(0.24, 0.14, 1.30), DARK, 0, 0.39, -0.45);                               // tunnel
  add(body, box(1.46, 0.24, 0.36), DARK, 0, 0.72, 0.16);                                // dash
  add(body, box(1.40, 0.04, 0.45), DARK, 0, 0.92, -1.26);                               // parcel shelf
  for (const s of [-1, 1]) {
    const seat = new THREE.Group(); seat.position.set(s * 0.36, 0.32, -0.50); body.add(seat);
    add(seat, box(0.46, 0.14, 0.50), SEAT, 0, 0.07, 0);
    add(seat, box(0.10, 0.012, 0.46), STRIPE, 0, 0.146, 0);
    const back = new THREE.Group(); back.position.set(0, 0.14, -0.26); back.rotation.x = -0.20; seat.add(back);
    add(back, box(0.46, 0.42, 0.10), SEAT, 0, 0.21, 0);
    add(back, box(0.07, 0.40, 0.16), SEAT, 0.215, 0.20, 0.05);
    add(back, box(0.07, 0.40, 0.16), SEAT, -0.215, 0.20, 0.05);
    add(back, box(0.10, 0.36, 0.012), STRIPE, 0, 0.21, 0.056);
  }
  // driver, right seat, helmet with a visor band, arms to the wheel
  add(body, new THREE.CapsuleGeometry(0.15, 0.20, 4, 12), SUIT, -0.36, 0.66, -0.55, -0.15);
  add(body, new THREE.SphereGeometry(0.13, 20, 14), HELMET, -0.36, 1.00, -0.52);
  const visor = new THREE.TorusGeometry(0.115, 0.03, 8, 14, 2.4); visor.rotateZ(PI / 2 - 1.2); visor.rotateX(PI / 2);
  add(body, visor, DARK, -0.36, 1.01, -0.52);
  for (const s of [-1, 1]) {
    rod(body, [-0.36 + s * 0.17, 0.83, -0.53], [-0.36 + s * 0.14, 0.85, -0.10], 0.035, SUIT, 10);
    add(body, new THREE.SphereGeometry(0.045, 10, 8), SUIT, -0.36 + s * 0.14, 0.85, -0.10);
  }
  const sw = new THREE.Group(); sw.position.set(-0.36, 0.84, -0.08); sw.rotation.x = -0.29; body.add(sw);
  add(sw, new THREE.TorusGeometry(0.15, 0.022, 10, 24), DARK);
  const dish = cyl(0.045, 0.12, 0.09, 12, true); dish.rotateX(PI / 2); dish.translate(0, 0, 0.045); add(sw, dish, DARK2);
  add(sw, cyl(0.05, 0.05, 0.02, 12), DARK, 0, 0, 0.095, PI / 2);
  for (const p of [[0.14, 0, 0], [-0.14, 0, 0], [0, -0.14, 0]]) rod(sw, [0, 0, 0.085], p, 0.016, DARK, 8);
  // roll cage: main hoop, harness bar and the diagonal, behind the seats
  for (const s of [-1, 1]) rod(body, [s * 0.66, 0.32, -0.98], [s * 0.60, 1.12, -0.98], 0.02, DARK, 12);
  rod(body, [-0.60, 1.12, -0.98], [0.60, 1.12, -0.98], 0.02, DARK, 12);
  rod(body, [-0.62, 0.90, -0.98], [0.62, 0.90, -0.98], 0.02, DARK, 12);
  rod(body, [0.62, 0.40, -0.99], [-0.58, 1.10, -0.99], 0.02, DARK, 12);

  // ---- wheels: tyre (tread + torus sidewalls), deep-dish rim, brake ----------------
  function wheel(side, w) {
    const wh = new THREE.Group();
    const ax = (geo) => geo.rotateZ(-side * PI / 2);        // cylinder Y -> the axle, its top face outboard
    const at = (geo, m, o, y, z, rx) => {
      const mesh = new THREE.Mesh(geo, m); mesh.position.set(side * o, y || 0, z || 0);
      if (rx) mesh.rotation.x = rx; wh.add(mesh); return mesh;
    };
    at(ax(cyl(0.32, 0.32, w - 0.09, 32, true)), RUB, 0);                              // tread
    for (const s of [-1, 1]) { const t = new THREE.TorusGeometry(0.275, 0.045, 8, 32); t.rotateY(PI / 2); at(t, RUB, s * (w / 2 - 0.045)); }
    at(ax(cyl(0.225, 0.225, w - 0.06, 24, true)), BRONZ2, 0);                          // barrel (the dish wall)
    at(ax(cyl(0.245, 0.225, 0.06, 24, true)), BRONZ2, w / 2 - 0.04);                   // polished lip, wide end out
    at(ax(cyl(0.225, 0.245, 0.04, 24, true)), BRONZ2, -(w / 2 - 0.05));                // inner flange
    const os = w / 2 - 0.10;                                                            // spoke face, 0.09 inside the lip
    at(ax(cyl(0.075, 0.075, 0.06, 16)), BRONZE, os - 0.03);                            // hub
    at(ax(cyl(0.042, 0.042, 0.016, 12)), DARK, os + 0.008);                            // centre cap
    for (let k = 0; k < 5; k++) {
      const a = k * PI * 2 / 5 + PI / 2;
      at(box(0.03, 0.17, 0.05), BRONZE, os - 0.015, 0.135 * Math.cos(a), 0.135 * Math.sin(a), a);
      at(ax(cyl(0.011, 0.011, 0.02, 6)), DARK, os + 0.008, 0.056 * Math.cos(a), 0.056 * Math.sin(a));
    }
    at(ax(cyl(0.165, 0.165, 0.024, 24)), GALV, -(w / 2 - 0.08));                       // brake disc
    at(ax(cyl(0.06, 0.06, 0.06, 12)), DARK, (os - 0.06 - (w / 2 - 0.08)) / 2);         // axle stub
    return wh;
  }
  const corner = (name, side, z, w, camberDeg) => {
    const hub = new THREE.Group(); hub.name = 'hub' + name;
    hub.position.set(side * 0.75, 0.32, z); hub.rotation.z = side * camberDeg * PI / 180;
    const wh = wheel(side, w); wh.name = 'wheel' + name; hub.add(wh);
    const cal = new THREE.Mesh(box(0.05, 0.12, 0.17), DARK); cal.position.set(side * -(w / 2 - 0.08), 0.10, 0.11); hub.add(cal);
    g.add(hub);
    return { hub, wh };
  };
  const FL = corner('FL', 1, 1.275, 0.24, 4), FR = corner('FR', -1, 1.275, 0.24, 4);
  const RL = corner('RL', 1, -1.225, 0.27, 3), RR = corner('RR', -1, -1.225, 0.27, 3);
  g.userData.joints = { hubFL: FL.hub, hubFR: FR.hub, wheelFL: FL.wh, wheelFR: FR.wh, wheelRL: RL.wh, wheelRR: RR.wh };

  // ---- ground and centre by measuring vertices, shifting the CHILDREN of g ---------
  // (body and the four hubs move together, so every pivot stays at its wheel centre)
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
