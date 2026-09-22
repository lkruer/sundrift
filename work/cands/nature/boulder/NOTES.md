# boulder — candidates and choice

- Winner: **boulder_a** (160 tris, 2 meshes, measured 1.50 x 1.16 x 1.30 m). Exactly the brief's recipe: one
  IcosahedronGeometry (detail 1), every unique vertex pushed in or out by a hash of its index (18 %), fitted to
  1.5 x 1.1 x 1.3 m, the vertices below the ground clamped to y = 0 so it sits in the earth; a squashed, lightly
  lumped icosahedron in moss green (`foliage`) sunk into the crown. Reads as clean weathered granite in the locked
  style from all five views. The hash keys on position, not on the attribute index: the icosahedron is unindexed,
  so hashing the raw index would tear every face apart.
- boulder_b (192 tris, an 8-sided lathe with hashed radial/vertical jitter) reads as a boulder but pinches at the
  crown, and with the moss dome on top it looks like a muffin.
- boulder_c (212 tris, hand-built lat/long ball plus a shoulder lobe, 16 % hash) went crumpled and spiky: too many
  concave facets for a granite boulder; it reads as slag.
- After the render, two small rounds on A's moss cap only: the hash leaves the rock's highest vertex off-centre,
  and a cap centred on it hung over the edge (round 1: moved it toward the plan centre; a grey sliver of the high
  vertex then poked through the cap's thin edge), so round 2 put it halfway to the high point and sank it 0.08 m.
  Clean in every view now. The gate passed on every run.
- Height: the rock body is the brief's 1.1 m; the moss sitting proud adds 0.06 m, so the whole prop measures
  1.16 m against the 1.1 m header (5 % over). The verifier's floor is 150 tris, so 160 is the low end of the
  120–500 band by design.
