# bamboo_clump — candidates and choice

- Winner: **bamboo_clump_c** (1,376 tris, 2 meshes, measured 2.49 x 7.16 x 2.47 m), shipped as
  `game/assets/bamboo_clump.js`. All nine culms and every node ring are ONE BufferGeometry: each culm a
  6-sided loft through foot, knee and top on a two-piece kinked path (knee height 50–65 % and its outward
  offset varied per culm), tapering 30 %; a 6-vertex rim plus an axis apex every 0.45 m makes the node
  skirt in the same mesh. Leaves are a second BufferGeometry of 32 four-sided spindles (apex, fat ring,
  narrow ring, apex; 0.34 x 0.9 x 0.34 m): three per culm plus a fourth drooping inward on every other
  culm. Nine heights 5.5–7.0 m, all different, feet inside a 1.2 m circle, tops leaning 2–8 degrees out.
  ONE stem material (moss green, `foliage`, DoubleSide for the skirts), ONE flat-shaded leaf material
  (cedar green, `foliage`).
- Why C: the spindles read as pointed bamboo fronds from every side, where A's icosahedra read as chunky
  pods and B's extruded kites as cardboard cut-outs; the kinked culms give the clump a sheaf silhouette
  rather than a fan of rods. The whole thing is two draw calls before the loader merges anything.
- bamboo_clump_a (1,350 tris, 135 meshes): straight CylinderGeometry culms, ConeGeometry skirts,
  icosahedron (detail 0) blobs. Clean and correct; runner-up, kept as the fallback.
- bamboo_clump_b (1,314 tris): hexagon Shapes extruded along QuadraticBezierCurve3 culms (the bow near
  the top is the best culm shape of the three) with cup-shaped node rings and 12-triangle kite leaves.
  The kites are slabs from every angle and the cup rims catch the light as bright specks; thrown away.
- Budget arithmetic, which the brief did not do: 27 blobs at icosahedron detail 1 are 2,160 triangles on
  their own, and nine culms with a 6-sided, two-ring node bulge every 0.45 m are about 3,000. Both are
  above the 1,400 cap. So every candidate uses a 6-triangle skirt (one rim, one apex) per node, the only
  6-sided ring that fits ~100 nodes, and 16–20-triangle leaf blobs instead of detail 1. Nodes stop 1.0 m
  below each top, inside the tuft.
- Naming: the brief names the stems `foliage`, so both materials carry that name. Checked
  `game/src/world.js`: only maple, shrub and broadleaf get their `foliage` materials whitened for
  per-instance tint, and the night tint grabs maple/shrub/broadleaf/cedar only, so the bamboo ships in its
  own two colours.
- After the render: added the fourth frond on five culms (1,296 -> 1,376 tris) to fill the crown without
  widening the footprint. Nothing changed on A or B. All three pass the gate from every side.
