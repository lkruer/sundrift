# maple_tree — candidates and choice

- Winner: **maple_tree_c** (752 tris, 8 meshes, measured 6.17 x 6.88 x 6.12 m). Seven icosahedron (detail 1) blobs,
  radii 1.3–2.05 m, each vertex pushed in/out by a hash (12 %) so the dome outline is irregular the way a maple is;
  the two low blobs on the +X side read as the asymmetric sag from the front and right views. Trunk, root flare and
  the three 30-degree limbs are one hand-built loft (rings of 8 swept in loops). ONE shared `foliage` material.
- maple_tree_a (752 tris) is the plain-icosahedron version: clean and correct, but the unlumped blobs read as a
  bunch of balls on a stick from the side views; runner-up, kept as the fallback if the lumps ever look wrong in-game.
- maple_tree_b (876 tris, 7-sided lathe blobs): the first render was stripy with dark specks, and that turned out
  to be a silent bug, not a look: the blob profile ran top-to-bottom, which winds a LatheGeometry inside-out, so
  the culled near side let the far inner wall show through. Reversed the profile (bottom pole -> out -> top, solid
  on the left of travel, as the oil drum does) and re-rendered before judging. Fixed, it reads as a stack of
  ringed pumpkins: the horizontal lathe bands are visible from every side. Still third.
- After the render: the B winding fix above; nothing changed on A or C. All three pass the gate (base at 0,
  centred, all sides busy). The limbs sit almost entirely inside the canopy (fork at 2.1 m, canopy bottom at
  2.4 m), which is what the brief's numbers give.
- Final: 752 triangles, inside the 300–1,200 band.
