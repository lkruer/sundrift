
  // ---- A: every body mass is a BoxGeometry whose vertices are re-written after construction
  const warp = (geo, fn) => {
    const p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v); p.setXYZ(i, v.x, v.y, v.z); }
    p.needsUpdate = true; geo.computeVertexNormals(); return geo;
  };
  const bx = (w, h, d, sx, sy, sz) => new THREE.BoxGeometry(w, h, d, sx || 1, sy || 1, sz || 1);
  // A box placed in world coordinates first, then warped with a world-space function.
  const piece = (parent, geo, m, x, y, z, fn) => { geo.translate(x, y, z); if (fn) warp(geo, fn); return add(parent, geo, m); };
  const dropFaces = (geo, faces) => {                     // BoxGeometry groups: 0 px, 1 nx, 2 py, 3 ny, 4 pz, 5 nz
    const idx = geo.index.array, keep = [];
    geo.groups.forEach((gr, i) => { if (!faces.includes(i)) for (let k = gr.start; k < gr.start + gr.count; k++) keep.push(idx[k]); });
    geo.setIndex(keep); geo.clearGroups(); return geo;
  };
  const bonnetY = (z) => 0.68 + 0.18 * c01((2.10 - z) / 1.825);
  // the top skin, piecewise: bonnet, windscreen, roof, rear glass, boot (fittings sit on it)
  const topY = (x, z) => {
    const cx = Math.max(0, 1 - Math.pow(x / 0.805, 2));
    if (z >= 0.275) return bonnetY(z) + 0.025 * cx;
    if (z >= -0.35) return lerp(0.885, 1.24, (0.275 - z) / 0.625);
    if (z >= -0.95) return 1.235 + 0.03 * Math.max(0, 1 - Math.pow(x / 0.67, 2)) + 0.015 * (1 - Math.pow((z + 0.65) / 0.32, 2));
    if (z >= -1.48) return lerp(1.235, 0.975, (-0.95 - z) / 0.53);
    return 0.96 + 0.012 * cx + 0.03 * c01((-2.10 - z) / 0.065);
  };
  const flankX = (s, y, z) => s * 0.80;
  // a thin box that follows the top skin: made flat at y = 0, then every vertex lifted onto the surface
  const onTop = (w, h, d, x, z, m, lift, sx, sz) => piece(body, bx(w, h, d, sx || 1, 1, sz || 1), m, x, 0, z, (v) => { v.y += topY(v.x, v.z) + (lift || 0); });

  // bonnet and front fenders: one crowned, tapered box, its corners pulled back in plan by wrapF
  piece(body, bx(1.61, 0.20, 1.845, 8, 2, 10), PAINT, 0, 0.76, 1.1975, (v) => {
    const t = (v.y - 0.66) / 0.20, yTop = bonnetY(v.z) + 0.025 * (1 - Math.pow(v.x / 0.805, 2));
    const yBot = 0.70 - 0.10 * c01((v.z - 1.70) / 0.40), w = wrapF(v.x) * c01((v.z - 1.90) / 0.22);
    v.y = lerp(yBot, yTop, t); v.x *= lerp(1, 0.955, c01((v.z - 1.0) / 1.1)); v.z -= w;
  });
  piece(body, bx(0.50, 0.03, 1.22, 6, 1, 6), PAINT, 0, 0.885, 1.11, (v) => {                       // centre bulge
    const top = v.y > 0.885, e = c01((v.z - 0.50) / 0.25) * c01((1.72 - v.z) / 0.25);
    v.y = topY(v.x, v.z) - 0.012 + (top ? 0.012 + 0.05 * e * (1 - Math.pow(v.x / 0.25, 2)) : 0);
  });
  // front bumper: five warped boxes leaving the opening for the intercooler
  const noseFn = (v) => { v.z -= wrapF(v.x) * c01((v.z - 1.62) / 0.54); };
  piece(body, bx(1.63, 0.205, 0.60, 16, 1, 4), PAINT, 0, 0.5025, 1.86, noseFn);                     // upper band
  piece(body, bx(1.63, 0.057, 0.60, 16, 1, 4), PAINT, 0, 0.1935, 1.86, noseFn);                     // lower band
  for (const s of [-1, 1]) piece(body, bx(0.315, 0.22, 0.60, 4, 1, 4), PAINT, s * 0.6575, 0.31, 1.86, noseFn);   // pillars beside the opening
  piece(body, bx(1.60, 0.033, 0.20, 16, 1, 2), DARK, 0, 0.1515, 2.115, (v) => { v.z -= wrapF(v.x); });          // splitter lip
  piece(body, bx(1.60, 0.112, 0.112, 16, 1, 1), DARK, 0, 0.634, 2.116, (v) => { v.z -= wrapF(v.x); });          // lamp band
  // glasshouse: one warped box (rake, tumblehome) with top and bottom faces dropped, a crowned roof panel
  const cab = bx(1.56, 0.36, 1.755, 1, 2, 4);
  warp(cab, (v) => {
    const u = (v.z + 0.8775) / 1.755, t = (v.y + 0.18) / 0.36;
    v.z = lerp(lerp(-1.48, -0.95, t), lerp(0.275, -0.35, t), u); v.y = lerp(0.88, 1.24, t); v.x *= lerp(1, 0.846, t);
  });
  dropFaces(cab, [2, 3]); add(body, cab, GLASS);
  piece(body, bx(1.34, 0.045, 0.64, 6, 1, 4), PAINT, 0, 1.2275, -0.65, (v) => { const top = v.y > 1.2275, y = topY(v.x, v.z); v.y = top ? y : y - 0.045; });
  for (const s of [-1, 1]) {
    const ap = bx(0.06, 0.38, 0.10, 1, 3, 1);                                                        // A pillar along the rake
    warp(ap, (v) => { const t = (v.y + 0.19) / 0.38, sx = v.x > 0 ? 1 : -1, sz = v.z > 0 ? 0.01 : -0.09;
      v.y = lerp(0.865, 1.245, t); v.z = lerp(0.275, -0.35, t) + sz; v.x = s * lerp(0.775, 0.66, t) + sx * 0.03; });
    add(body, ap, PAINT);
    const bp = bx(0.06, 0.32, 0.09, 1, 2, 1);                                                        // B pillar, tumbled in
    warp(bp, (v) => { const t = (v.y + 0.16) / 0.32, sx = v.x > 0 ? 1 : -1; v.y = lerp(0.915, 1.245, t); v.z = -0.825 + v.z; v.x = s * lerp(0.78, 0.663, t) + sx * 0.03; });
    add(body, bp, PAINT);
    const cp = bx(0.06, 0.32, 0.50, 1, 2, 2);                                                        // C pillar, a triangle in side view
    warp(cp, (v) => { const t = (v.y + 0.16) / 0.32, u = (v.z + 0.25) / 0.5, sx = v.x > 0 ? 1 : -1;
      v.z = lerp(lerp(-1.47, -0.955, t), lerp(-1.21, -0.965, t), u); v.y = lerp(0.925, 1.245, t); v.x = s * lerp(0.78, 0.663, t) + sx * 0.03; });
    add(body, cp, PAINT);
    add(body, bx(0.07, 0.24, 1.75), PAINT, s * 0.765, 0.82, -0.595);                                 // upper door and quarter band, sill box below is shared
  }
  // boot: a crowned box with a lip, tail panel, rear bumper, valance and rubbing strip, all pulled in by wrapR
  piece(body, bx(1.61, 0.26, 0.70, 4, 1, 4), PAINT, 0, 0.83, -1.815, (v) => {
    if (v.y > 0.83) v.y = topY(v.x, v.z); v.x *= lerp(1, 0.97, c01((-1.9 - v.z) / 0.265));
  });
  const tailFn = (v) => { v.z += wrapR(v.x) * c01((-1.62 - v.z) / 0.57); };
  piece(body, bx(1.63, 0.61, 0.63, 16, 1, 4), PAINT, 0, 0.475, -1.875, tailFn);                      // rear bumper
  piece(body, bx(1.60, 0.17, 0.115, 16, 1, 1), DARK, 0, 0.87, -2.1475, (v) => { v.z += wrapR(v.x); }); // tail lamp panel
  piece(body, bx(1.632, 0.14, 0.64, 16, 1, 4), DARK, 0, 0.24, -1.876, tailFn);                       // lower valance
  piece(body, bx(1.64, 0.012, 0.65, 16, 1, 4), DARK, 0, 0.501, -1.87, tailFn);                       // rubbing strip
  // rear wing: a box thinned into an aerofoil, slab uprights
  const blade = bx(1.42, 0.03, 0.22, 8, 1, 6);
  warp(blade, (v) => { const u = (0.11 - v.z) / 0.22, sc = u < 0.25 ? lerp(0.5, 1, u / 0.25) : lerp(1, 0.22, (u - 0.25) / 0.75); v.y = v.y * sc + 0.012 * (1 - Math.pow(2 * u - 1, 2)); });
  add(body, blade, DARK, 0, 1.25, -2.0, 0.12);
  for (const s of [-1, 1]) slab(body, [s * 0.45, 0.93, -1.85], [s * 0.45, 1.25, -1.98], 0.16, 0.04, DARK, [s, 0, 0], 0);
  // flares: seven slabs each, a polygonal arch with a flat top; the rivets on their outer face are shared
  for (const s of [-1, 1]) for (const [az, R] of [[1.275, 0.42], [-1.225, 0.46]]) {
    const th0 = Math.asin(-0.08 / R), dth = (PI - 2 * th0) / 7;
    for (let k = 0; k < 7; k++) {
      const a1 = th0 + k * dth, a2 = a1 + dth;
      slab(body, [s * 0.825, 0.32 + R * Math.sin(a1), az + R * Math.cos(a1)], [s * 0.825, 0.32 + R * Math.sin(a2), az + R * Math.cos(a2)], 0.10, 0.07, PAINT, [s, 0, 0], 0.025);
    }
  }
  // panel map: shut lines are thin dark boxes lifted onto the skin, lids are raised boxes
  for (const s of [-1, 1]) {
    onTop(0.012, 0.009, 1.40, s * 0.60, 1.04, DARK, 0.0015, 1, 8);                                    // bonnet edges
    onTop(0.32, 0.006, 0.26, s * 0.46, 1.92, PAINT, 0.0, 4, 2);                                       // pop-up lamp lid, closed
    onTop(0.012, 0.009, 0.26, s * 0.30, 1.92, DARK, 0.0015, 1, 2); onTop(0.012, 0.009, 0.26, s * 0.62, 1.92, DARK, 0.0015, 1, 2);
    onTop(0.32, 0.009, 0.012, s * 0.46, 1.79, DARK, 0.0015, 4, 1); onTop(0.32, 0.009, 0.012, s * 0.46, 2.05, DARK, 0.0015, 4, 1);
    onTop(0.012, 0.009, 0.54, s * 0.60, -1.79, DARK, 0.0015, 1, 3);                                   // boot edges
    add(body, bx(0.009, 0.47, 0.012), DARK, s * 0.8015, 0.485, 0.42);                                 // door front edge
    add(body, bx(0.009, 0.47, 0.012), DARK, s * 0.8015, 0.485, -0.93);                                // door rear edge
  }
  onTop(1.20, 0.009, 0.012, 0, 1.74, DARK, 0.0015, 12, 1);                                            // bonnet front edge
  onTop(1.20, 0.009, 0.012, 0, 0.34, DARK, 0.0015, 12, 1);                                            // bonnet rear edge
  onTop(1.20, 0.009, 0.012, 0, -1.52, DARK, 0.0015, 12, 1);                                           // boot front edge
