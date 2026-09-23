# weeping_cherry — candidates and choice

- Winner: **weeping_cherry_b** (1,711 tris: 1,544 blossom + 167 bark, 2 meshes, measured 6.64 x 6.60 x 6.45 m),
  shipped as `game/assets/weeping_cherry.js`. A fountain generator: twenty branchlets leave a rounded head of
  four 7-sided lathe puffs (profile bottom -> top), each at its own bearing, and are stepped under gravity in
  fine steps so each rises, arcs over and falls straight. Each is clothed in a tassel of blossom, a 6-sided loft
  resampled to six rings along the same curve, swelling after the arc and tapering to a blunt foot, every ring
  hash-lumped and turned half a side from the last so the facets zigzag. Alternate tassels reach further (two
  staggered ranks), girths vary 0.8-1.2x, and hems wander between 0.78 and 1.3 m with a few stopping short
  near 2 m, so the hem is ragged, not a skirt. A gnarled trunk climbs to 4 m and opens into three scaffold
  limbs; it shows under the hem and between the strands. ONE `foliage` material (sakura deep, flatShading,
  roughness 0.9) and ONE `timber` (cherry bark 0x3b2a27).
- Why B: from the low three-quarter night view (the game's own `makePost` cel/ink/bloom chain, sodium lamp,
  moon; `_night/*.png` here) it reads at once as a weeping cherry: a rounded head, strands arcing over the
  shoulder and falling as a pink curtain, the dark trunk between them, a ragged hem about a metre up. It keeps
  that read from 10 m to 38 m and in a row tinted deep / pink.
- weeping_cherry_a (1,847 tris, 1,362 + 485): lofted gravity arcs, each carrying one stretched, tapered,
  knotted icosahedron strand (13), under a head of five icosahedra; buried faces culled. It reads as weeping
  too, but the strands are fat spindles (a pink mop, or banana leaves in its first version), the dark arcs
  show as thin eyebrows on the head from above, and it is the heaviest. Runner-up.
- weeping_cherry_c (998 tris, 928 + 70): one closed lathe shell with thickness, the outer wall run bottom ->
  top, an inner wall wound the other way, a downward band round the hem, sixteen deep star pleats of uneven
  width, a scalloped and ragged hem, and four lathe puffs on the dome. It is the cheapest and needs no
  DoubleSide, but it reads as a pleated lampshade or a jellyfish, not a tree: the trunk only shows under the
  hem. Third.
- Second tone: tried the outer (long-reach) rank of tassels in `foliage_b` (sakura pink, as the brief allows
  for the outer curtain). It separates the strands a little more, but half the curtain would then ignore the
  game's per-instance tint, so the winner keeps all blossom in `foliage`. To restore it, route the loft of
  alternate tassels into a second geometry with a `foliage_b` material.
- After the render (B): the arcs now start on a ring round the head (they started at three scaffold tips and
  the spread came out lopsided, 6.3 x 5.9 m); the bare-wood arcs were dropped, because they lay wholly inside
  the head (256 hidden triangles), and the budget went into 20 tassels in two ranks; the head was lowered
  0.25 m and the reach trimmed to bring the tree to 6.6 m; a broader centre puff makes the top read as a dome
  rather than a starburst from above; the twist triangulation splits each skewed quad on its short
  diagonal. A: strands given knots and a lighter taper, arcs thickened. C: pleats deepened to a star and
  made uneven. All three pass the gate (base at 0, centred, no blank side, sizes inside the 0.2 tolerance
  of 6.5 x 6.5 x 6.5).
- Final: 1,711 triangles, inside the 600-2,000 band.
