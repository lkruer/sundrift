
  // ---- B: the hull is the side silhouette (arches cut as arcs) extruded across the doors;
  //      bumpers, bands and the tail panel are plan polygons built from the nose and tail
  //      paths and extruded upward; flares are the box-flare outline with an absarc opening.
  const poly = (pts) => { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); return s; };
  const extrude = (sh, depth, seg) => new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: seg || 8, steps: 1 });
  // side profile: shape x = car z, shape y = car y, swept across x and centred on x = 0
  const sideX = (sh, width, seg) => { const geo = extrude(sh, width, seg); geo.translate(0, 0, -width / 2); geo.rotateY(-PI / 2); return geo; };
  // plan profile: shape x = car x, shape y = -car z, swept upward from y = 0
  const planY = (sh, height, seg) => { const geo = extrude(sh, height, seg); geo.rotateX(-PI / 2); return geo; };
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
  // a plan polygon: the outer edge is a run of path points (x, z), closed along a straight back edge at zb
  const planPoly = (pts, zb, dz) => { const p = pts.map(([x, z]) => [x, -(z + (dz || 0))]); p.push([pts[pts.length - 1][0], -zb], [pts[0][0], -zb]); return poly(p); };
  const band = (pts, zb, y0, y1, m, dz) => add(body, smooth(planY(planPoly(pts, zb, dz), y1 - y0), 40), m, 0, y0, 0);
  const topY = (x, z) => {
    if (z >= 2.00) return 0.69;
    if (z >= 0.275) return lerp(0.69, 0.86, (2.00 - z) / 1.725);
    if (z >= -0.33) return lerp(0.885, 1.235, (0.275 - z) / 0.605);
    if (z >= -0.97) return 1.235 + 0.045 * Math.max(0, 1 - Math.pow((z + 0.65) / 0.32, 2));
    if (z >= -1.48) return lerp(1.235, 0.965, (-0.97 - z) / 0.51);
    return lerp(0.945, 0.965, c01((-1.48 - z) / 0.61)) + 0.03 * c01((-2.09 - z) / 0.03);
  };
  const flankX = (s, y, z) => s * (y <= 0.72 ? 0.80 : 0.79);

  // hull: the side silhouette with both arches, swept across the doors
  const hull = new THREE.Shape();
  hull.moveTo(2.00, 0.585); hull.lineTo(2.00, 0.69); hull.lineTo(0.275, 0.86); hull.lineTo(0.17, 0.92);
  hull.lineTo(-1.48, 0.945); hull.lineTo(-2.09, 0.965); hull.lineTo(-2.12, 0.995); hull.lineTo(-2.12, 0.575);
  hull.lineTo(-1.62, 0.575); hull.lineTo(-1.62, 0.24); hull.lineTo(-1.566, 0.24);
  hull.absarc(-1.225, 0.32, 0.35, PI + 0.2306, -0.2306, true);
  hull.lineTo(0.934, 0.24);
  hull.absarc(1.275, 0.32, 0.35, PI + 0.2306, -0.2306, true);
  hull.lineTo(1.64, 0.24); hull.lineTo(1.64, 0.585); hull.closePath();
  add(body, smooth(sideX(hull, 1.58, 10), 40), PAINT);
  // nose cone fills the bonnet's corners in plan, then the lamp band and the bumper bands
  band(clipX(nose, -0.80, 0.80), 1.90, 0.585, 0.69, PAINT, -0.05);
  band(clipX(nose, -0.80, 0.80), 2.03, 0.578, 0.69, DARK, 0.012);                                    // lamp band
  band(nose, 1.56, 0.165, 0.222, PAINT);                                                              // lower band
  band(nose, 1.56, 0.40, 0.605, PAINT);                                                               // upper band
  band(clipX(nose, 0.50, 0.815), 1.56, 0.20, 0.42, PAINT);                                            // pillars beside the opening
  band(clipX(nose, -0.815, -0.50), 1.56, 0.20, 0.42, PAINT);
  band(clipX(nose, -0.80, 0.80), 1.96, 0.135, 0.168, DARK, 0.055);                                    // splitter lip
  band(tail, -1.56, 0.17, 0.78, PAINT);                                                               // rear bumper
  band(clipX(tail, -0.80, 0.80), -2.09, 0.785, 0.955, DARK, -0.015);                                  // tail lamp panel
  band(tail, -1.56, 0.17, 0.31, DARK, -0.006);                                                        // lower valance
  band(tail, -1.56, 0.495, 0.507, DARK, -0.005);                                                      // rubbing strip
  // bonnet centre bulge: a side profile, gently domed, 0.5 wide
  add(body, smooth(sideX(poly([[1.72, 0.716], [1.55, 0.78], [1.0, 0.845], [0.50, 0.895], [0.50, 0.85], [1.0, 0.79], [1.72, 0.70]]), 0.50), 40), PAINT);
  // flares: the box-flare outline with the arch opening, swept 0.07 outward
  for (const s of [-1, 1]) for (const [az, top] of [[1.275, 0.74], [-1.225, 0.78]]) {
    const f = new THREE.Shape();
    f.moveTo(-0.50, 0.24); f.lineTo(-0.30, top); f.lineTo(0.30, top); f.lineTo(0.50, 0.24); f.lineTo(0.341, 0.24);
    f.absarc(0, 0.32, 0.35, -0.2306, PI + 0.2306, false);
    f.closePath();
    const geo = smooth(sideX(f, 0.07, 10), 40); geo.translate(s * 0.825, 0, az);
    add(body, geo, PAINT);
  }
  // glasshouse: three panes, a crowned roof profile, pillars
  const phi = Math.atan2(0.12, 0.32);
  const pane = (w0, w1, L, thick) => extrude(poly([[-w0 / 2, 0], [w0 / 2, 0], [w1 / 2, L], [-w1 / 2, L]]), thick);
  const ws = add(body, pane(1.52, 1.30, 0.721, 0.02), GLASS, 0, 0.86, 0.275, -PI / 3); ws.geometry.translate(0, 0, -0.01);
  const rg = add(body, pane(1.46, 1.28, 0.595, 0.02), GLASS, 0, 0.96, -1.48, 1.10); rg.geometry.translate(0, 0, -0.01);
  for (const s of [-1, 1]) {
    const tilt = new THREE.Group(); tilt.position.set(s * 0.78, 0.92, 0); tilt.rotation.z = s * phi; body.add(tilt);
    add(tilt, sideX(poly([[0.176, 0], [-0.35, 0.335], [-0.95, 0.335], [-1.47, 0.02]]), 0.02), GLASS);   // door plus quarter glass
    add(tilt, sideX(poly([[-1.21, 0.0], [-1.47, 0.0], [-0.955, 0.34]]), 0.06), PAINT);                 // C pillar
    add(tilt, box(0.06, 0.34, 0.09), PAINT, 0, 0.165, -0.825);                                          // B pillar
    slab(body, [s * 0.775, 0.865, 0.27], [s * 0.665, 1.245, -0.36], 0.08, 0.06, PAINT, [s * 0.6, 0.75, 0.3], 0.04);   // A pillar
  }
  add(body, smooth(sideX(poly([[-0.33, 1.235], [-0.45, 1.262], [-0.65, 1.28], [-0.85, 1.262], [-0.97, 1.235], [-0.97, 1.19], [-0.85, 1.217], [-0.65, 1.235], [-0.45, 1.217], [-0.33, 1.19]]), 1.34), 40), PAINT);
  // rear wing: the aerofoil section extruded across, parallelogram uprights extruded thin
  const foilPts = [];
  for (let k = 0; k < 14; k++) { const t = k / 14, u = 0.5 - 0.5 * Math.cos(2 * PI * t), th = 0.018 * (1.2 * Math.sqrt(u) - 0.3 * u - 0.9 * u * u) / 0.50; foilPts.push([0.11 - 0.22 * u, t < 0.5 ? th + 0.006 : -th * 0.9 + 0.006]); }
  add(body, smooth(sideX(poly(foilPts), 1.42), 40), DARK, 0, 1.245, -2.0, 0.12);
  for (const s of [-1, 1]) { const g2 = sideX(poly([[-1.77, 0.945], [-1.93, 0.945], [-2.05, 1.24], [-1.91, 1.24]]), 0.04); g2.translate(s * 0.45, 0, 0); add(body, g2, DARK); }
  // panel map: the hull's top is flat across, so shut lines are plain thin boxes tilted to the bonnet and boot slopes
  const bon = Math.atan2(0.17, 1.725), bootA = Math.atan2(0.02, 0.61);
  for (const s of [-1, 1]) {
    add(body, box(0.012, 0.009, 1.40), DARK, s * 0.60, topY(0.6, 1.04) + 0.0015, 1.04, bon);           // bonnet edges
    add(body, box(0.32, 0.006, 0.26), PAINT, s * 0.46, topY(0.46, 1.92) + 0.0, 1.92, bon);             // pop-up lamp lid, closed
    for (const lx of [0.30, 0.62]) add(body, box(0.012, 0.009, 0.26), DARK, s * lx, topY(lx, 1.92) + 0.0015, 1.92, bon);
    for (const lz of [1.79, 2.05]) add(body, box(0.32, 0.009, 0.012), DARK, s * 0.46, topY(0.46, lz) + 0.0015, lz, bon);
    add(body, box(0.012, 0.009, 0.54), DARK, s * 0.60, topY(0.6, -1.79) + 0.0015, -1.79, bootA);       // boot edges
    add(body, box(0.009, 0.47, 0.012), DARK, s * 0.8015, 0.485, 0.42);                                 // door front edge
    add(body, box(0.009, 0.47, 0.012), DARK, s * 0.8015, 0.485, -0.93);                                // door rear edge
  }
  add(body, box(1.20, 0.009, 0.012), DARK, 0, topY(0, 1.74) + 0.0015, 1.74, bon);                      // bonnet front edge
  add(body, box(1.20, 0.009, 0.012), DARK, 0, topY(0, 0.34) + 0.0015, 0.34, bon);                      // bonnet rear edge
  add(body, box(1.20, 0.009, 0.012), DARK, 0, topY(0, -1.52) + 0.0015, -1.52, bootA);                  // boot front edge
