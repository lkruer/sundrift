// hero_coupe — arm B: profiles. The hull is the side-view silhouette (bonnet, belt,
// boot, tail, and both wheel arches cut as real arcs) drawn as a Shape and extruded
// across the width of the doors. The bumpers, lip and lamp band are plan-view shapes
// with the nose corners curved, extruded upward. The flares are the box-flare outline
// with an absarc opening, swept 0.07 m. The glass is three trapezoid panes; the roof is
// a crowned side profile. Tyres, rim shells, brake discs, helmet and torso are lathes.
// Bevels are never enabled. Narrowing of the cabin is separate masses, never a warped
// extrusion. Nose = +Z, base y = 0. 1.72 W x 1.28 H x 4.45 L.
//
// Moving parts: g.userData.joints = { hubFL, hubFR, wheelFL, wheelFR, wheelRL, wheelRR }.
export default function (THREE) {
  const g = new THREE.Group();
  const body = new THREE.Group(); body.name = 'body'; g.add(body);
  const PI = Math.PI, DS = THREE.DoubleSide;
  const c01 = (t) => Math.max(0, Math.min(1, t));

  // ---- materials: every hex from STYLE_LOCK.md -----------------------------------
  const mk = (color, o) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0 }, o || {}));
  const PAINT  = mk(0xf2f0ea, { roughness: 0.35 });                                    PAINT.name = 'paint';
  const GLASS  = mk(0x1c2a33, { roughness: 0.1, transparent: true, opacity: 0.55 });   GLASS.name = 'glass';
  const DARK   = mk(0x2b2d31, { roughness: 0.5 });                                     DARK.name = 'metal';
  const DARK2  = mk(0x2b2d31, { roughness: 0.5, side: DS });                           DARK2.name = 'metal';
  const EXH    = mk(0x2b2d31, { roughness: 0.3, metalness: 0.8, side: DS });           EXH.name = 'metal';
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
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r1, r2, h, s, open) => new THREE.CylinderGeometry(r1, r2, h, s, 1, !!open);
  const poly = (pts) => { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); return s; };
  const extrude = (sh, depth, seg) => new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: seg || 8, steps: 1 });
  // side profile: shape x = car z, shape y = car y, swept across x and centred on x = 0
  const sideX = (sh, width, seg) => { const geo = extrude(sh, width, seg); geo.translate(0, 0, -width / 2); geo.rotateY(-PI / 2); return geo; };
  // plan profile: shape x = car x, shape y = -car z, swept upward from y = 0
  const planY = (sh, height, seg) => { const geo = extrude(sh, height, seg); geo.rotateX(-PI / 2); return geo; };
  // pane profile: shape x = car x, shape y = distance up the pane; extruded `t` thick
  // along the pane normal, then tilted by the mesh's rotation.x
  const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg);
  // Extrusions come out flat shaded per facet. Average the normals of faces meeting at a
  // vertex when they differ by less than `deg`, so arcs shade smoothly and creases stay.
  const smooth = (geo, deg) => {
    const p = geo.attributes.position, n = p.count, fn = new Float32Array(n * 3);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), cb = new THREE.Vector3(), ab = new THREE.Vector3();
    for (let i = 0; i < n; i += 3) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
      cb.subVectors(c, b); ab.subVectors(a, b); cb.cross(ab).normalize();
      for (let k = 0; k < 3; k++) { fn[(i + k) * 3] = cb.x; fn[(i + k) * 3 + 1] = cb.y; fn[(i + k) * 3 + 2] = cb.z; }
    }
    const key = (i) => Math.round(p.getX(i) * 1e4) + ',' + Math.round(p.getY(i) * 1e4) + ',' + Math.round(p.getZ(i) * 1e4);
    const buckets = new Map();
    for (let i = 0; i < n; i++) { const k = key(i); let l = buckets.get(k); if (!l) buckets.set(k, l = []); l.push(i); }
    const cos = Math.cos(deg * PI / 180), out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const nx = fn[i * 3], ny = fn[i * 3 + 1], nz = fn[i * 3 + 2]; let x = 0, y = 0, z = 0;
      for (const j of buckets.get(key(i))) {
        if (nx * fn[j * 3] + ny * fn[j * 3 + 1] + nz * fn[j * 3 + 2] >= cos) { x += fn[j * 3]; y += fn[j * 3 + 1]; z += fn[j * 3 + 2]; }
      }
      const L = Math.hypot(x, y, z) || 1; out[i * 3] = x / L; out[i * 3 + 1] = y / L; out[i * 3 + 2] = z / L;
    }
    geo.setAttribute('normal', new THREE.BufferAttribute(out, 3));
    return geo;
  };
  const rod = (parent, p1, p2, r, m, seg) => {
    const a = new THREE.Vector3().fromArray(p1), b = new THREE.Vector3().fromArray(p2);
    const d = b.clone().sub(a); const len = d.length();
    const o = new THREE.Mesh(cyl(r, r, len, seg || 10), m);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    o.position.copy(a).add(b).multiplyScalar(0.5);
    parent.add(o); return o;
  };
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
  // the nose and tail in plan: a straight middle and corners that sweep back
  const noseWrap = (x) => 0.16 * Math.pow(c01((Math.abs(x) - 0.45) / 0.37), 1.5);
  const tailWrap = (x) => 0.10 * Math.pow(c01((Math.abs(x) - 0.50) / 0.33), 1.5);
  // plan outline between a straight back edge zb and a curved front edge z0 - wrap(x)
  const planShape = (hw, zb, z0, wrapFn, notch) => {
    const xs = [];
    for (let k = 0; k <= 12; k++) xs.push(-hw + (2 * hw * k) / 12);
    if (notch) xs.push(-notch[0] - 0.001, -notch[0], notch[0], notch[0] + 0.001);   // crisp slot ends
    xs.sort((a, b) => a - b);
    const pts = [[-hw, -zb]];
    for (const x of xs) {
      let z = z0 - wrapFn(x);
      if (notch && Math.abs(x) <= notch[0]) z -= notch[1];
      pts.push([x, -z]);
    }
    pts.push([hw, -zb]);
    return poly(pts);
  };

  // ---- hull: the side silhouette with both arches, swept across the doors ---------
  const hull = new THREE.Shape();
  hull.moveTo(2.00, 0.585);
  hull.lineTo(2.00, 0.69);
  hull.lineTo(0.275, 0.86);          // bonnet up to the scuttle
  hull.lineTo(0.17, 0.92);           // belt line
  hull.lineTo(-1.48, 0.945);
  hull.lineTo(-2.09, 0.965);         // boot deck
  hull.lineTo(-2.12, 0.995);         // lip
  hull.lineTo(-2.12, 0.575);
  hull.lineTo(-1.62, 0.575);
  hull.lineTo(-1.62, 0.24);
  hull.lineTo(-1.566, 0.24);
  hull.absarc(-1.225, 0.32, 0.35, PI + 0.2306, -0.2306, true);   // rear arch
  hull.lineTo(0.934, 0.24);
  hull.absarc(1.275, 0.32, 0.35, PI + 0.2306, -0.2306, true);    // front arch
  hull.lineTo(1.64, 0.24);
  hull.lineTo(1.64, 0.585);
  hull.closePath();
  add(body, smooth(sideX(hull, 1.58, 10), 40), PAINT);
  // nose cone: fills the bonnet's corners in plan ahead of the hull, under the lamp band
  add(body, planY(planShape(0.79, 1.90, 2.10, noseWrap), 0.105), PAINT, 0, 0.585, 0);
  add(body, planY(planShape(0.80, 2.03, 2.16, noseWrap), 0.11), DARK, 0, 0.575, 0);     // lamp band
  for (const s of [-1, 1]) {
    add(body, box(0.34, 0.09, 0.03), HEAD, s * 0.31, 0.63, 2.17);                       // inner lens
    add(body, box(0.34, 0.09, 0.03), HEAD, s * 0.66, 0.63, 2.085, 0, s * 0.42, 0);     // outer lens follows the corner
  }
  // front bumper: three plan bands, the middle one notched 0.06 for the intake
  add(body, planY(planShape(0.82, 1.62, 2.145, noseWrap), 0.06), PAINT, 0, 0.16, 0);
  add(body, planY(planShape(0.82, 1.62, 2.145, noseWrap, [0.55, 0.06]), 0.12), PAINT, 0, 0.22, 0);
  add(body, planY(planShape(0.82, 1.62, 2.145, noseWrap), 0.245), PAINT, 0, 0.34, 0);
  add(body, box(1.14, 0.12, 0.02), DARK, 0, 0.28, 2.075);                               // dark back of the slot
  add(body, box(0.90, 0.06, 0.02), DARK, 0, 0.53, 2.148);                               // mouth slot
  add(body, planY(planShape(0.80, 1.90, 2.225, noseWrap), 0.03), DARK, 0, 0.14, 0);    // splitter lip
  for (const s of [-1, 1]) {
    add(body, cyl(0.05, 0.05, 0.02, 20), DARK, s * 0.66, 0.30, 2.09, PI / 2);
    add(body, cyl(0.032, 0.032, 0.012, 16), HEAD, s * 0.66, 0.30, 2.102, PI / 2);
  }
  // bonnet centre bulge: a side profile, gently domed, 0.5 wide
  const bulge = poly([[2.00, 0.69], [1.85, 0.735], [1.0, 0.815], [0.45, 0.875], [0.35, 0.86], [1.0, 0.79], [1.85, 0.70]]);
  add(body, smooth(sideX(bulge, 0.50), 40), PAINT);
  // rear: lamp panel, bumper, diffuser, fins, exhaust
  add(body, planY(planShape(0.80, 2.05, 2.16, tailWrap), 0.16), DARK, 0, 0.78, 0, 0, PI, 0); // lamp panel (plan mirrored to the tail)
  for (const s of [-1, 1]) for (const x of [0.44, 0.62]) add(body, cyl(0.055, 0.055, 0.03, 24), TAIL, s * x, 0.86, -2.165, PI / 2);
  add(body, planY(planShape(0.83, 1.62, 2.21, tailWrap), 0.30), PAINT, 0, 0.275, 0, 0, PI, 0);    // bumper 0.275-0.575
  add(body, planY(planShape(0.83, 1.62, 2.18, tailWrap), 0.115), DARK, 0, 0.16, 0, 0, PI, 0);     // diffuser band
  for (const x of [-0.55, -0.20, 0.20, 0.55]) add(body, box(0.04, 0.12, 0.28), DARK, x, 0.20, -2.07);
  add(body, cyl(0.045, 0.045, 0.12, 20, true), EXH, 0.50, 0.24, -2.20, PI / 2);
  add(body, cyl(0.036, 0.036, 0.012, 20), RUB, 0.50, 0.24, -2.25, PI / 2);
  add(body, cyl(0.045, 0.036, 0.012, 20), EXH, 0.50, 0.24, -2.26, PI / 2);

  // ---- flares: the box-flare outline with the arch opening, swept 0.07 outward ------
  for (const s of [-1, 1]) for (const [az, top] of [[1.275, 0.74], [-1.225, 0.78]]) {
    const f = new THREE.Shape();
    f.moveTo(-0.50, 0.24); f.lineTo(-0.30, top); f.lineTo(0.30, top); f.lineTo(0.50, 0.24); f.lineTo(0.341, 0.24);
    f.absarc(0, 0.32, 0.35, -0.2306, PI + 0.2306, false);
    f.closePath();
    const geo = smooth(sideX(f, 0.07, 10), 40); geo.translate(s * 0.825, 0, az);
    add(body, geo, PAINT);
  }
  // skirts, underbody plate, wheel tubs, floor
  for (const s of [-1, 1]) {
    add(body, box(0.06, 0.10, 1.78), DARK, s * 0.79, 0.19, 0.03);
    add(body, box(0.18, 0.04, 1.78), DARK, s * 0.71, 0.16, 0.03);
    add(body, box(0.18, 0.04, 0.46), DARK, s * 0.71, 0.16, 1.875);
    add(body, box(0.18, 0.04, 0.52), DARK, s * 0.71, 0.16, -1.89);
    for (const az of [1.275, -1.225]) {
      add(body, box(0.04, 0.50, 0.80), DARK, s * 0.57, 0.47, az);
      add(body, box(0.22, 0.50, 0.04), DARK, s * 0.68, 0.47, az + 0.40);
      add(body, box(0.22, 0.50, 0.04), DARK, s * 0.68, 0.47, az - 0.40);
    }
  }
  add(body, box(1.24, 0.04, 4.20), DARK, 0, 0.16, 0);

  // ---- glasshouse: three panes, a crowned roof profile, pillars, trims ------------
  const phi = Math.atan2(0.12, 0.32);                                                   // tumblehome, about 20.6 degrees
  const pane = (w0, w1, L, thick) => extrude(poly([[-w0 / 2, 0], [w0 / 2, 0], [w1 / 2, L], [-w1 / 2, L]]), thick);
  const ws = add(body, pane(1.52, 1.30, 0.721, 0.02), GLASS, 0, 0.86, 0.275, -PI / 3);  // windscreen, 30 degrees
  ws.geometry.translate(0, 0, -0.01);
  const rg = add(body, pane(1.46, 1.28, 0.595, 0.02), GLASS, 0, 0.96, -1.48, 1.10);    // rear glass, 28 degrees, up toward the roof
  rg.geometry.translate(0, 0, -0.01);
  for (const s of [-1, 1]) {
    const tilt = new THREE.Group(); tilt.position.set(s * 0.78, 0.92, 0); tilt.rotation.z = s * phi; body.add(tilt);
    const sg = poly([[0.176, 0], [-0.35, 0.335], [-0.95, 0.335], [-1.47, 0.02]]);
    add(tilt, sideX(sg, 0.02), GLASS);                                                  // door plus quarter glass, one pane
    const cp = poly([[-1.21, 0.0], [-1.47, 0.0], [-0.955, 0.34]]);                     // C-pillar, a triangle in side view
    add(tilt, sideX(cp, 0.06), PAINT);
    add(tilt, box(0.06, 0.34, 0.09), PAINT, 0, 0.165, -0.825);                          // B-pillar
    add(tilt, box(0.03, 0.03, 1.66), RUB, 0, 0.0, -0.64);                               // belt trim
    slab(body, [s * 0.775, 0.865, 0.27], [s * 0.665, 1.245, -0.36], 0.08, 0.06, PAINT, [s * 0.6, 0.75, 0.3], 0.04); // A-pillar
    add(body, box(0.03, 0.03, 0.62), RUB, s * 0.67, 1.245, -0.65);                      // roof rail
    rod(body, [s * 0.77, 0.94, 0.20], [s * 0.85, 0.97, 0.17], 0.02, DARK, 10);          // mirror stalk
    const head = new THREE.Group(); head.position.set(s * 0.885, 0.975, 0.16); head.rotation.y = s * 0.30; body.add(head);
    add(head, box(0.16, 0.09, 0.05), DARK);
    add(head, box(0.13, 0.07, 0.008), GALV, 0, 0, -0.027);
  }
  add(body, box(1.52, 0.03, 0.03), RUB, 0, 0.875, 0.285);
  add(body, box(1.44, 0.03, 0.03), RUB, 0, 0.965, -1.475);
  const roof = poly([[-0.33, 1.235], [-0.45, 1.262], [-0.65, 1.28], [-0.85, 1.262], [-0.97, 1.235],
                     [-0.97, 1.19], [-0.85, 1.217], [-0.65, 1.235], [-0.45, 1.217], [-0.33, 1.19]]);
  add(body, smooth(sideX(roof, 1.34), 40), PAINT);

  // ---- rear wing: an aerofoil section swept across, on two swept uprights ----------
  const foil = poly([[0.11, 0], [0.095, 0.011], [0.06, 0.017], [0.0, 0.015], [-0.06, 0.009], [-0.11, 0.002],
                     [-0.11, -0.002], [-0.06, -0.009], [0.0, -0.014], [0.06, -0.015], [0.095, -0.009]]);
  add(body, smooth(sideX(foil, 1.42), 50), DARK, 0, 1.255, -2.0, -0.14);
  for (const s of [-1, 1]) {
    const up = poly([[-1.78, 0.95], [-1.94, 0.95], [-2.06, 1.25], [-1.90, 1.25]]);
    add(body, sideX(up, 0.04), DARK, s * 0.45, 0, 0);
  }

  // ---- interior: bucket seats from a side profile, driver, wheel, cage ------------
  add(body, box(1.40, 0.04, 1.80), DARK, 0, 0.30, -0.45);
  add(body, box(0.24, 0.14, 1.30), DARK, 0, 0.39, -0.45);
  add(body, box(1.46, 0.24, 0.36), DARK, 0, 0.72, 0.16);
  add(body, box(1.40, 0.04, 0.45), DARK, 0, 0.92, -1.26);
  const seatP = poly([[0.25, 0], [0.25, 0.13], [0.20, 0.16], [-0.14, 0.16], [-0.24, 0.55], [-0.34, 0.56], [-0.30, 0.20], [-0.26, 0]]);
  const stripeP = poly([[0.24, 0.165], [-0.13, 0.165], [-0.235, 0.55], [-0.22, 0.55], [-0.12, 0.155], [0.24, 0.155]]);
  for (const s of [-1, 1]) {
    add(body, sideX(seatP, 0.46), SEAT, s * 0.36, 0.32, -0.50);
    add(body, sideX(stripeP, 0.10), STRIPE, s * 0.36, 0.32, -0.50);
    add(body, box(0.06, 0.40, 0.14), SEAT, s * 0.36 + 0.23, 0.68, -0.72, -0.24);         // bolsters
    add(body, box(0.06, 0.40, 0.14), SEAT, s * 0.36 - 0.23, 0.68, -0.72, -0.24);
  }
  const torso = lathe([[0.10, 0], [0.17, 0.05], [0.19, 0.25], [0.17, 0.38], [0.11, 0.44], [0.02, 0.47]], 14);
  add(body, torso, SUIT, -0.36, 0.44, -0.55, -0.15);
  const helm = [];
  for (let k = 0; k <= 10; k++) { const t = -1.25 + (PI / 2 + 1.25) * k / 10; helm.push([Math.max(0.001, 0.13 * Math.cos(t)), 0.13 * Math.sin(t)]); }
  add(body, lathe(helm, 20), HELMET, -0.36, 1.00, -0.52);
  const visor = new THREE.TorusGeometry(0.115, 0.03, 8, 14, 2.4); visor.rotateZ(PI / 2 - 1.2); visor.rotateX(PI / 2);
  add(body, visor, DARK, -0.36, 1.01, -0.52);
  for (const s of [-1, 1]) {
    rod(body, [-0.36 + s * 0.17, 0.83, -0.53], [-0.36 + s * 0.14, 0.85, -0.10], 0.035, SUIT, 10);
    add(body, new THREE.SphereGeometry(0.045, 10, 8), SUIT, -0.36 + s * 0.14, 0.85, -0.10);
  }
  const sw = new THREE.Group(); sw.position.set(-0.36, 0.84, -0.08); sw.rotation.x = -0.29; body.add(sw);
  add(sw, new THREE.TorusGeometry(0.15, 0.022, 10, 24), DARK);
  const dish = lathe([[0.12, 0], [0.045, 0.09], [0.045, 0.11], [0.001, 0.11]], 14); dish.rotateX(PI / 2);
  add(sw, dish, DARK2);
  for (const p of [[0.14, 0, 0], [-0.14, 0, 0], [0, -0.14, 0]]) rod(sw, [0, 0, 0.085], p, 0.016, DARK, 8);
  for (const s of [-1, 1]) rod(body, [s * 0.66, 0.32, -0.98], [s * 0.60, 1.12, -0.98], 0.02, DARK, 12);
  rod(body, [-0.60, 1.12, -0.98], [0.60, 1.12, -0.98], 0.02, DARK, 12);
  rod(body, [-0.62, 0.90, -0.98], [0.62, 0.90, -0.98], 0.02, DARK, 12);
  rod(body, [0.62, 0.40, -0.99], [-0.58, 1.10, -0.99], 0.02, DARK, 12);

  // ---- wheels: lathe tyre, lathe rim shell (barrel, lip, flange), spokes, disc -----
  function wheel(side, w) {
    const wh = new THREE.Group(), hw = w / 2;
    const ax = (geo) => geo.rotateZ(-side * PI / 2);          // lathe axis Y -> the axle, +a outboard
    const at = (geo, m, o, y, z, rx) => {
      const mesh = new THREE.Mesh(geo, m); mesh.position.set(side * o, y || 0, z || 0);
      if (rx) mesh.rotation.x = rx; wh.add(mesh); return mesh;
    };
    at(ax(lathe([[0.235, -hw + 0.03], [0.30, -hw + 0.005], [0.32, -hw + 0.05], [0.32, hw - 0.05], [0.30, hw - 0.005], [0.235, hw - 0.03]], 36)), RUB, 0);
    at(ax(lathe([[0.245, -hw + 0.02], [0.225, -hw + 0.05], [0.225, hw - 0.07], [0.245, hw - 0.01], [0.215, hw - 0.01]], 28)), BRONZ2, 0);
    const os = hw - 0.10;                                                              // spoke face, 0.09 inside the lip
    at(ax(cyl(0.075, 0.075, 0.06, 16)), BRONZE, os - 0.03);
    at(ax(cyl(0.042, 0.042, 0.016, 12)), DARK, os + 0.008);
    for (let k = 0; k < 5; k++) {
      const a = k * PI * 2 / 5 + PI / 2;
      at(box(0.03, 0.17, 0.05), BRONZE, os - 0.015, 0.135 * Math.cos(a), 0.135 * Math.sin(a), a);
      at(ax(cyl(0.011, 0.011, 0.02, 6)), DARK, os + 0.008, 0.056 * Math.cos(a), 0.056 * Math.sin(a));
    }
    at(ax(lathe([[0.07, -0.012], [0.165, -0.012], [0.165, 0.012], [0.07, 0.012]], 28)), GALV, -(hw - 0.08));
    at(ax(cyl(0.06, 0.06, 0.07, 12)), DARK, (os - 0.06 - (hw - 0.08)) / 2);
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
