def rw(p, pairs):
    s = open(p, encoding='utf-8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (p, s.count(a), a[:90])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8', newline='\n').write(s)

rw('_tail.js', [
 # the diffuser stops just behind the lip, its fins shorter
 ("    const z0 = -1.56, z1 = -1.95, y0 = 0.165, y1 = 0.405, rampY = (z) => lerp(y0, y1, (z0 - z) / (z0 - z1));",
  "    const z0 = -1.56, z1 = -1.89, y0 = 0.17, y1 = 0.39, yb = 0.17, rampY = (z) => lerp(y0, y1, (z0 - z) / (z0 - z1));"),
 ("      add(body, loft([rect(2, [x, (0.15 + rampY(zf)) / 2, zf], [t, (rampY(zf) - 0.15) / 2]), rect(2, [x, (0.15 + y1) / 2, z1], [t, (y1 - 0.15) / 2])],",
  "      add(body, loft([rect(2, [x, (yb + rampY(zf)) / 2, zf], [t, (rampY(zf) - yb) / 2]), rect(2, [x, (yb + y1) / 2, z1], [t, (y1 - yb) / 2])],"),
 # tips stand only 0.04 proud of it
 ("    add(body, cyl(0.045, 0.045, 0.16, 28, true), CHROME, x, 0.245, -1.92, PI / 2);",
  "    add(body, cyl(0.045, 0.045, 0.16, 28, true), CHROME, x, 0.25, -1.85, PI / 2);"),
 ("    add(body, cyl(0.03, 0.03, 0.16, 20), DARK, x, 0.245, -1.90, PI / 2);", "    add(body, cyl(0.03, 0.03, 0.16, 20), DARK, x, 0.25, -1.83, PI / 2);"),
 ("  rod(body, [0.375, 0.235, -1.44], [0.375, 0.245, -1.86], 0.032, DARK, 10);", "  rod(body, [0.375, 0.235, -1.44], [0.375, 0.25, -1.79], 0.032, DARK, 10);"),
])
rw('_body_c.js', [
 ("duck = 0.03 * Math.pow(1 - d / TR, 1.5);", "duck = 0.035 * Math.pow(1 - d / TR, 1.5);"),
 # the rear flares end at the lip line behind the wheel instead of running down to the sill
 ("    const th0 = Math.atan2(-0.08, 0.50), secs = [];",
  "    const th0 = Math.atan2(-0.08, 0.50), th1 = az > 0 ? PI - th0 : PI - Math.asin(0.08 / 0.35), secs = [];"),
 ("      const th = th0 + (PI - 2 * th0) * k / 18, iz", "      const th = th0 + (th1 - th0) * k / 18, iz"),
])
print('sporty 2 applied')
