# stone_lantern — candidates and choice

- Winner: **stone_lantern_c** (528 tris, 9 meshes, measured 0.78 x 1.80 x 0.78 m). The roof is one hand-built loft
  over eight rays and six rings of a concave curve, with the corner rays turned up 0.09 m and the mid-edge rays
  0.025 m, so the corners genuinely curl while the eave line between them stays low: the kasuga silhouette. It has
  a 0.06 m eave edge and a closed soffit. The fire box is one indexed BufferGeometry, each side face carrying a
  frame, four recess walls and a recessed back (0.16 m square, 0.03 m deep, no holes). Plinth, moss band, pillar
  with torus bead, platform and neck are primitives; the finial is a faceted icosahedron ball. All `stone`, band
  `foliage`.
- stone_lantern_b (572 tris, lathes with 4 segments started at 45 degrees for every square part, an extruded
  notched Shape for the recess band, no bevel) is the cleanest build and exactly on size, but a 4-segment lathe
  can only raise the whole eave line at once, so its roof reads as a shallow plate with a straight edge.
- stone_lantern_a (512 tris, primitives) gets the concave flank from a shallow frustum under a steeper cone, but the
  upturned corners are separate tilted blocks that read as tacked-on horns from every side, and their far corners
  push the width to 0.876 m (17 % over, still inside tolerance).
- After the render: nothing changed; all three passed the gate first time from every side.
- Final: 528 triangles, inside the 400–2,000 band. Width is 0.78 m (the brief's eave width) against the 0.75 m
  header, 4 % over.
