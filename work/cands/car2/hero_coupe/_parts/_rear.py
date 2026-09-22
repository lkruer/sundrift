def rw(p, pairs):
    s = open(p, encoding='utf-8').read()
    for a, b in pairs:
        assert a in s, (p, a[:70])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8', newline='\n').write(s)

rw('_body_c.js', [
 ("  add(body, sweep(tail, bandProf(0.17, topR, 0.10, 0.05)), PAINT);                                   // rear bumper",
  "  add(body, sweep(tail, [[0, 0.17], [0, 0.66], [-0.03, 0.68], [-0.03, topR], [-0.10, topR], [-0.10, 0.17]]), PAINT);   // rear bumper, stepped in under the garnish"),
 ("  add(body, sweep(clipX(tail, -0.80, 0.80), plainProf(0.785, 0.955, 0.10, 0.015)), DARK);           // tail lamp panel",
  "  add(body, sweep(clipX(tail, -0.80, 0.80), [[0.005, 0.78], [0.03, 0.80], [0.03, 0.94], [0.005, 0.96], [-0.08, 0.96], [-0.08, 0.78]]), DARK);   // full-width garnish, chamfered edges"),
 ("  add(body, sweep(tail, plainProf(0.495, 0.507, 0.03, 0.005)), DARK);                                // rubbing strip round the bumper\n", ""),
 ("DARK, 0, 1.245, -2.0, 0.12);", "DARK, 0, 1.30, -2.02, 0.12);"),
 ("  for (const s of [-1, 1]) add(body, loft([rect(1, [s * 0.45, 0.945, -1.85], [0.02, 0.08]), rect(1, [s * 0.45, 1.10, -1.93], [0.02, 0.075]), rect(1, [s * 0.45, 1.24, -1.98], [0.02, 0.07])], { capFront: 0, capBack: 0 }), DARK);",
  "  for (const s of [-1, 1]) add(body, loft([rect(1, [s * 0.45, 0.94, -1.83], [0.022, 0.10]), rect(1, [s * 0.45, 1.12, -1.92], [0.022, 0.085]), rect(1, [s * 0.45, 1.295, -2.01], [0.022, 0.07])], { capFront: 0, capBack: 0 }), DARK);   // taller swept uprights"),
 ("    topStrip(linePts([s * 0.60, -1.52], [s * 0.60, -2.06], 6), 0.012);                        // boot edges",
  "    topStrip(linePts([s * 0.60, -1.52], [s * 0.60, -2.13], 7), 0.012);                        // boot edges, run out through the ducktail"),
 ("    add(body, loft(secs, { creaseRows: [0, 1, 4, 5] }), PAINT);\n  }",
  "    add(body, loft(secs, { creaseRows: [0, 1, 4, 5] }), PAINT);\n  }\n"
  "  {                                                                                            // ducktail: the boot lid trailing edge kicks up\n"
  "    const secs = [];\n"
  "    for (let k = 0; k <= 7; k++) {\n"
  "      const z = lerp(-1.90, -2.19, k / 7), h = 0.062 * Math.pow(c01((-1.90 - z) / 0.29), 1.6), lo = [], hi = [];\n"
  "      for (let j = 0; j <= 6; j++) { const x = lerp(-0.58, 0.58, j / 6), y = topY(x, z); lo.push([x, y - 0.012, z]); hi.push([x, y + h + 0.002, z]); }\n"
  "      secs.push(lo.concat(hi.reverse()));\n"
  "    }\n"
  "    add(body, loft(secs, { creaseRows: [0, 6, 7, 13], capBack: 0 }), PAINT);\n"
  "  }"),
])

rw('_fit.js', [
 ("  // ---- shared fittings: everything below is the same in all three candidates ------------",
  "  // ---- shared fittings: everything below is the same in all three candidates ------------\n"
  "  const POLISH = mk(0xb9bcc0, { roughness: 0.2, metalness: 0.8 });                                POLISH.name = 'metal';\n"
  "  const LANE   = mk(0xe8e4da, { roughness: 0.4, emissive: new THREE.Color(0xe8e4da), emissiveIntensity: 0.5 });\n"
  "  const REFL   = mk(0xd11c1c, { roughness: 0.4, emissive: new THREE.Color(0xd11c1c), emissiveIntensity: 0.6 });"),
 ("    add(lamp, cyl(0.073, 0.073, 0.018, 32), DARK, 0, 0, 0.022, PI / 2);                              // bezel\n"
  "    add(lamp, cyl(0.058, 0.058, 0.014, 32), TAIL, 0, 0, 0.036, PI / 2);                              // lens",
  "    add(lamp, new THREE.CylinderGeometry(0.076, 0.076, 0.03, 32, 1, true), DARK2, 0, 0, 0.045, PI / 2);   // cup, open, the lamp sits down inside it\n"
  "    add(lamp, cyl(0.062, 0.062, 0.012, 32), TAIL, 0, 0, 0.036, PI / 2);                              // lens, sunk below the rim\n"
  "    add(lamp, new THREE.TorusGeometry(0.076, 0.005, 8, 32), POLISH, 0, 0, 0.06);                     // polished rim ring\n"
  "    add(lamp, new THREE.TorusGeometry(0.031, 0.004, 6, 24), LANE, 0, 0, 0.043);                      // white inner ring"),
 ("  add(body, box(0.44, 0.16, 0.024), DARK, 0, 0.60, -2.19);                                           // plate recess, blank\n"
  "  for (const s of [-1, 1]) onFace(tail, s * 0.66, 0.42, 0.10, 0.035, 0.02, TAIL, 0.008);             // corner reflectors\n"
  "  add(body, box(0.64, 0.13, 0.026), DARK, 0, 0.87, -2.212);                                          // centre garnish\n"
  "  add(body, box(0.64, 0.012, 0.03), GALV, 0, 0.941, -2.213);                                         // its bright top trim\n"
  "  add(body, box(0.32, 0.15, 0.02), DARK, 0.44, 0.27, -2.20);                                         // exhaust cut-out\n"
  "  for (const x of [0.36, 0.52]) {\n"
  "    add(body, cyl(0.0425, 0.0425, 0.17, 24, true), CHROME, x, 0.27, -2.15, PI / 2);                  // twin tips, left side\n"
  "    add(body, cyl(0.036, 0.036, 0.01, 20), RUB, x, 0.27, -2.20, PI / 2);\n"
  "  }\n"
  "  add(body, box(1.30, 0.05, 0.42), DARK, 0, 0.155, -2.00);                                           // diffuser plate\n"
  "  for (const x of [-0.60, -0.30, 0, 0.30, 0.60]) add(body, box(0.012, 0.11, 0.36), DARK, x, 0.155, -2.02);\n"
  "  for (const s of [-1, 1]) add(body, box(0.20, 0.20, 0.016), RUB2, s * 0.75, 0.22, -1.60);           // mud flaps",
  "  {                                                                                                  // number-plate pocket: proud rim, blank plate, lamp above\n"
  "    const zf = -2.19;\n"
  "    for (const [w, h, x, y] of [[0.46, 0.022, 0, 0.635], [0.46, 0.022, 0, 0.415], [0.022, 0.24, -0.219, 0.525], [0.022, 0.24, 0.219, 0.525]]) add(body, box(w, h, 0.05), DARK, x, y, zf - 0.005);\n"
  "    add(body, box(0.42, 0.20, 0.008), DARK, 0, 0.525, zf - 0.008);                                   // pocket floor\n"
  "    add(body, box(0.33, 0.165, 0.008), LANE, 0, 0.525, zf - 0.014);                                  // blank plate\n"
  "    add(body, box(0.09, 0.024, 0.05), DARK, 0, 0.665, zf - 0.006);                                   // plate lamp housing under the step\n"
  "    add(body, box(0.05, 0.010, 0.012), HEAD, 0, 0.657, zf - 0.030);\n"
  "  }\n"
  "  for (const s of [-1, 1]) onFace(tail, s * 0.70, 0.46, 0.03, 0.30, 0.024, REFL, 0.012);             // vertical corner reflector strips\n"
  "  add(body, box(0.40, 0.17, 0.02), DARK, 0.42, 0.28, -2.20);                                         // exhaust cut-out\n"
  "  for (const x of [0.35, 0.49]) {\n"
  "    add(body, cyl(0.05, 0.05, 0.16, 28, true), CHROME, x, 0.28, -2.16, PI / 2);                      // twin tips, left side, hollow\n"
  "    add(body, cyl(0.034, 0.034, 0.16, 20), DARK, x, 0.28, -2.14, PI / 2);                            // the dark inner pipe seen down the tip\n"
  "  }\n"
  "  add(body, box(1.30, 0.05, 0.42), DARK, 0, 0.155, -2.00);                                           // diffuser plate\n"
  "  for (const x of [-0.60, -0.30, 0, 0.30, 0.60]) add(body, box(0.012, 0.16, 0.40), DARK, x, 0.16, -2.03);   // five deep fins\n"
  "  for (const s of [-1, 1]) add(body, box(0.22, 0.22, 0.016), RUB2, s * 0.75, 0.21, -1.60);           // mud flaps"),
 ("    add(body, box(0.012, 0.11, 0.28), DARK, s * 0.716, 1.255, -2.0, 0.12);                           // end plate",
  "    add(body, box(0.012, 0.15, 0.32), DARK, s * 0.716, 1.31, -2.02, 0.12);                           // end plate"),
 ("  add(body, box(0.26, 0.024, 0.035), TAIL, 0, 1.252, -2.10, 0.12);                                   // high-mount brake lamp\n"
  "  add(body, box(1.40, 0.022, 0.012), DARK, 0, 1.262, -2.108, 0.12);                                  // gurney flap on the trailing edge",
  "  add(body, box(0.26, 0.024, 0.035), TAIL, 0, 1.307, -2.12, 0.12);                                   // high-mount brake lamp\n"
  "  add(body, box(1.40, 0.022, 0.012), DARK, 0, 1.317, -2.128, 0.12);                                  // gurney flap on the trailing edge"),
])
print('edits applied')
