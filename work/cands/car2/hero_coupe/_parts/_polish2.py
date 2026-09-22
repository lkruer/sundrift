def rw(p, pairs):
    s = open(p, encoding='utf-8').read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8', newline='\n').write(s)

rw('_body_c.js', [
 # the skin drops to the sill through the cabin: one flank surface from sill to belt, no door boxes
 ("    [0.92,  0.70, 0.80, 0.815, 0.72,  0.80,  0.78,  0.70, 0.803, 0.816],    // front arch, rear edge\n"
  "    [0.275, 0.70, 0.80, 0.815, 0.76,  0.795, 0.85,  0.74, 0.866, 0.88],     // scuttle\n"
  "    [-0.35, 0.70, 0.80, 0.815, 0.78,  0.78,  0.895, 0.60, 1.235, 1.265],    // windscreen top\n"
  "    [-0.65, 0.70, 0.80, 0.815, 0.79,  0.78,  0.905, 0.60, 1.245, 1.28],     // roof peak\n"
  "    [-0.95, 0.70, 0.80, 0.815, 0.80,  0.78,  0.912, 0.59, 1.225, 1.255],    // rear glass top\n",
  "    [0.92,  0.70, 0.80, 0.815, 0.72,  0.80,  0.78,  0.70, 0.803, 0.816],    // front arch, rear edge\n"
  "    [0.90,  0.24, 0.80, 0.815, 0.72,  0.80,  0.78,  0.70, 0.803, 0.816],    // door front edge: the skin drops to the sill\n"
  "    [0.275, 0.24, 0.80, 0.815, 0.76,  0.795, 0.85,  0.74, 0.866, 0.88],     // scuttle\n"
  "    [-0.35, 0.24, 0.80, 0.815, 0.78,  0.78,  0.895, 0.60, 1.235, 1.265],    // windscreen top\n"
  "    [-0.65, 0.24, 0.80, 0.815, 0.79,  0.78,  0.905, 0.60, 1.245, 1.28],     // roof peak\n"
  "    [-0.87, 0.24, 0.80, 0.815, 0.80,  0.78,  0.910, 0.593, 1.230, 1.262],   // door rear edge\n"
  "    [-0.89, 0.70, 0.80, 0.815, 0.80,  0.78,  0.911, 0.592, 1.229, 1.260],   // quarter: the skin ends above the arch\n"
  "    [-0.95, 0.70, 0.80, 0.815, 0.80,  0.78,  0.912, 0.59, 1.225, 1.255],    // rear glass top\n"),
 ("    creaseRows: [1, 3, 4, 12, 13, 15], creaseSecs: [4, 5, 7, 8], capFront: 0, capBack: 0,\n"
  "    matOf: (seg, row) => {\n"
  "      const top = row >= 4 && row <= 11, side = row === 3 || row === 12;\n"
  "      if (top && (seg === 4 || seg === 7)) return 1;\n"
  "      if (side && seg >= 4 && seg <= 7) return 1;",
  "    creaseRows: [1, 3, 4, 12, 13, 15], creaseSecs: [5, 6, 10, 11], capFront: 0, capBack: 0,\n"
  "    matOf: (seg, row) => {\n"
  "      const top = row >= 4 && row <= 11, side = row === 3 || row === 12;\n"
  "      if (top && (seg === 5 || seg === 10)) return 1;\n"
  "      if (side && seg >= 5 && seg <= 10) return 1;"),
 # rear bumper: painted chin tucking under, slim dark valance
 ("  add(body, sweep(tail, [[0, 0.46], [0.012, 0.52], [0.004, topR], [-0.10, topR], [-0.10, 0.46]]), PAINT);   // rear bumper face, 0.34 tall with a soft crease",
  "  add(body, sweep(tail, [[-0.06, 0.30], [0, 0.46], [0.012, 0.52], [0.004, topR], [-0.10, topR], [-0.10, 0.30]]), PAINT);   // rear bumper: 0.34 face with a soft crease, chin tucked under"),
 ("  add(body, sweep(tail, plainProf(0.17, 0.47, 0.10, 0.006)), DARK);", "  add(body, sweep(tail, plainProf(0.17, 0.31, 0.10, -0.054)), DARK);"),
])
rw('_fit.js', [
 ("    add(body, box(0.07, 0.50, 1.80), PAINT, s * 0.765, 0.47, 0.02);                                  // door skin, sill to the hull's floor line\n", ""),
])
print('polish 2 applied')
