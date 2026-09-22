def rw(p, pairs):
    s = open(p, encoding='utf-8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (p, s.count(a), a[:90])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8', newline='\n').write(s)

def cut(p, start, end_incl):
    """remove from the line containing `start` through the line containing `end_incl`"""
    ls = open(p, encoding='utf-8').read().split('\n')
    a = next(i for i, l in enumerate(ls) if start in l)
    b = next(i for i, l in enumerate(ls) if i >= a and end_incl in l)
    del ls[a:b + 1]
    open(p, 'w', encoding='utf-8', newline='\n').write('\n'.join(ls))

# ---- hull: new rear rings, a third material for the drop wall and the tail's underside -------------
rw('_body_c.js', [
 ("    [-1.48, 0.70, 0.80, 0.815, 0.80,  0.80,  0.915, 0.70, 0.94,  0.952],    // rear glass base\n"
  "    [-2.12, 0.78, 0.78, 0.79,  0.85,  0.78,  0.905, 0.71, 0.915, 0.93],     // tail, deck lowered\n"
  "  ];\n"
  "  const rings = stations.map((s) => ring(...s));\n",
  "    [-1.48, 0.70, 0.80, 0.815, 0.80,  0.80,  0.915, 0.70, 0.935, 0.946],   // rear glass base\n"
  "  ];\n"
  "  const rings = stations.map((s) => ring(...s));\n"
  "  // ---- the tail: short, pinched in plan, rounded at the corners, its face undercut ----------\n"
  "  // Behind the rear arch the skin drops to y TLO (the bottom of the rear face), the flank pinches\n"
  "  // from 0.815 to TW, the corners round in plan with radius TR, the deck kicks up into a ducktail\n"
  "  // lip at z TZ, and every ring leans so the face (the loft's back cap) is undercut 20 degrees:\n"
  "  // a ring point at height y sits at z = zTop + g (TY - y) RAKE, lower points further forward.\n"
  "  const RAKE = Math.tan(20 * PI / 180), TY = 0.95, TZ = -2.03, TR = 0.17, TW = 0.775, TLO = 0.44;\n"
  "  const tailRing = (zTop, W, g, sx, duck, yBelt, yRoof, yTop) =>\n"
  "    ring(0, TLO, W - 0.015, W, TLO + (yBelt - TLO) * 0.55, W - 0.015, yBelt, W - 0.115, yRoof + duck * 0.8, yTop + duck)\n"
  "      .map(([x, y]) => [x * sx, y, zTop + g * (TY - y) * RAKE]);\n"
  "  rings.push(ring(-1.555, 0.70, 0.80, 0.815, 0.80, 0.80, 0.912, 0.70, 0.930, 0.942));           // the last ring over the rear arch\n"
  "  rings.push(tailRing(-1.56, 0.815, 0, 1, 0, 0.910, 0.925, 0.937));                                 // the skin drops to the face's bottom edge\n"
  "  rings.push(tailRing(-1.70, 0.800, 0.45, 1, 0, 0.905, 0.914, 0.926));                              // pinching in, starting to lean\n"
  "  const TAIL0 = rings.length;                                                                         // the first ring of the rounded corner\n"
  "  for (let k = 0; k <= 4; k++) {\n"
  "    const ph = k * PI / 8, d = TR * (1 - Math.sin(ph)), duck = 0.03 * Math.pow(1 - d / TR, 1.5);\n"
  "    rings.push(tailRing(TZ + d, TW, 1, (TW - TR + TR * Math.cos(ph)) / TW, duck, 0.90, 0.905, 0.917));\n"
  "  }\n"
  "  const TAILN = rings.length - 1;                                                                     // the face ring: the cap inside it is the rear face\n"),
 ("      if (side && seg >= 5 && seg <= 10) return 1;\n"
  "      return 0;\n"
  "    },\n"
  "  }), [PAINT, GLASS]);",
  "      if (side && seg >= 5 && seg <= 10) return 1;\n"
  "      if (seg >= 12 && (row === 0 || row === 15)) return 2;     // the wall behind the rear wheel and the tail's underside\n"
  "      return 0;\n"
  "    },\n"
  "  }), [PAINT, GLASS, DARK]);"),
 # the tail rings lean, so find a ring by its crown point, which sits at the top
 ("    let i = 0; while (i < rings.length - 2 && z < rings[i + 1][0][2]) i++;\n"
  "    const a = rings[i], b = rings[i + 1], t = c01((a[0][2] - z) / (a[0][2] - b[0][2]));",
  "    let i = 0; while (i < rings.length - 2 && z < rings[i + 1][8][2]) i++;\n"
  "    const a = rings[i], b = rings[i + 1], t = c01((a[8][2] - z) / ((a[8][2] - b[8][2]) || 1e-9));"),
 ("    topStrip(linePts([s * 0.60, -1.52], [s * 0.60, -2.13], 7), 0.010);                        // boot edges, run out through the ducktail",
  "    topStrip([[s * 0.688, -1.52]].concat([12, TAIL0 - 1, TAIL0, TAIL0 + 1, TAIL0 + 2, TAIL0 + 3].map((k) => [s * (rings[k][4][0] - 0.012), rings[k][8][2]])), 0.010);   // boot lid edges, round the deck's corners"),
 ("  topStrip(linePts([-0.60, -1.52], [0.60, -1.52], 12), 0.010);                                // boot front edge",
  "  topStrip(linePts([-0.688, -1.52], [0.688, -1.52], 12), 0.010);                              // boot front edge"),
 ("  for (const s of [-1, 1]) for (const [az, top] of [[1.275, 0.74], [-1.225, 0.78]]) {",
  "  for (const s of [-1, 1]) for (const [az, top] of [[1.275, 0.74], [-1.225, 0.79]]) {"),
 ("      const ox = az > 0 ? 0.875 : 0.89;", "      const ox = az > 0 ? 0.875 : 0.905;                                                        // the rear flares stand out as hips"),
])
cut('_body_c.js', '// ducktail: the boot lid trailing edge kicks up', "add(body, loft(secs, { creaseRows: [0, 6, 7, 13], capBack: 0 }), PAINT);")
ls = open('_body_c.js', encoding='utf-8').read().split('\n')        # the old ducktail block's closing brace is now orphaned
i = next(k for k, l in enumerate(ls) if 'add(body, loft(secs, { creaseRows: [0, 1, 4, 5] }), PAINT);' in l)
assert ls[i + 1] == '  }' and ls[i + 2] == '  }', ls[i:i + 3]
del ls[i + 2]
open('_body_c.js', 'w', encoding='utf-8', newline='\n').write('\n'.join(ls))
cut('_body_c.js', 'const topR = (x, z)', "// taller swept uprights")

# ---- shared fittings: the old rear goes, the plate stops where the diffuser starts -------------------
rw('_fit.js', [
 ("    add(body, box(0.012, 0.035, 0.09), TAIL, s * 0.832, 0.60, -1.86);                          // rear side marker\n", ""),
 ("    add(body, box(0.18, 0.04, 0.52), DARK, s * 0.71, 0.16, -1.89);\n", ""),
 ("  add(body, box(1.24, 0.04, 4.20), DARK, 0, 0.16, 0);                                                // underbody plate",
  "  add(body, box(1.24, 0.04, 3.61), DARK, 0, 0.16, 0.245);                                            // underbody plate, ending where the diffuser starts"),
 ("s * (az > 0 ? 0.875 : 0.89), 0.32", "s * (az > 0 ? 0.875 : 0.905), 0.32"),
])
cut('_fit.js', '// fuel filler on the left rear quarter', "add(body, cyl(0.048, 0.048, 0.008, 24), DARK, fx + 0.006")
ls = open('_fit.js', encoding='utf-8').read().split('\n')           # its closing brace
i = next(k for k, l in enumerate(ls) if 'rubber mast, raked back' in l)
assert ls[i + 1] == '  }', ls[i + 1]
del ls[i + 1]
open('_fit.js', 'w', encoding='utf-8', newline='\n').write('\n'.join(ls))
cut('_fit.js', '// ---- rear end: bumper, tail panel, four round lamps', '// tailpipe into the tips')

# ---- the old tail path is gone -----------------------------------------------------------------
cut('_paths.js', 'const tail = endPath(-1', 'const tail = endPath(-1')
cut('_paths.js', '// the part of a tail path at or behind z = zl', 'const clipZ = (path, zl)')
cut('_core.js', 'const wrapR = (x)', 'const wrapR = (x)')
rw('_core.js', [("  // The nose and tail in plan: a straight middle and corners that sweep back.", "  // The nose in plan: a straight middle and corners that sweep back.")])

open('_hdr_c.js', 'w', encoding='utf-8', newline='\n').write(
"// hero_coupe — a hand-built loft hull (sixteen-point rings skinned into one surface, the\n"
"// glasshouse a second material group inside the same skin) carrying every fitting as its own\n"
"// part. Behind the rear arch the rings pinch in plan, round their corners and lean, so the tail\n"
"// is short, tapered and ends in a ducktail lip over a rear face (the loft's back cap) undercut\n"
"// 20 degrees; a thin lip, a finned diffuser and a swan-neck wing sit on it. The front bumper,\n"
"// splitter and lamp band are bands swept along a plan path; flares are a four-point loop swept\n"
"// around each arch; shut lines and the rear garnish are strips lofted along the skin; tyres,\n"
"// rims, discs, helmet and torso are revolved loops; tread blocks, calipers and the binnacle\n"
"// hood are partial lathes. Nose = +Z, base y = 0. Body 1.72 W x 1.28 H, about 4.3 L.\n"
"//\n"
"// Moving parts: g.userData.joints = { hubFL, hubFR, wheelFL, wheelFR, wheelRL, wheelRR }.\n"
"// A hub is a Group at the wheel centre (steer about y, camber baked into rotation.z) and\n"
"// carries the brake disc and caliper; its child wheel Group (spin about x) carries the\n"
"// tyre, rim and lug nuts. Everything static is under the Group named 'body'.\n")
print('sporty 1 applied')
