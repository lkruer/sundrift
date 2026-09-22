# bare_tree — candidates and choice

- Winner: **bare_tree_b** (1,003 tris, 51 meshes, measured 5.32 x 7.52 x 4.98 m), shipped as
  `game/assets/bare_tree.js`. Trunk is a 7-segment LatheGeometry (0.48 m root flare, 0.40 m at the knee,
  0.24 m at the fork, profile bottom to top) leaning 3 degrees; every limb, branch and twig is a
  TubeGeometry along a QuadraticBezierCurve3 that leaves its joint at one angle and curls upward, tapered
  by scaling each ring about its own centre after construction, closed with a 6-sided cone tip.
  SphereGeometry balls at the 2.2 m fork (7 x 4) and the three limb ends (6 x 4) so nothing gaps. Three
  limbs (0.16 m dia) at 25/135/255 degrees and 38/40/30 degree tilts end at about 4.5 m; three, two and
  three branches (0.08 -> 0.04 m dia), tallest tip at 7.5 m; twelve 0.5 m twigs on the upper halves of
  the branches at hash angles. Cedar bark, material `timber`. No leaves.
- Why B: the upswept curves are what make it read as a deciduous tree rather than a diagram of one. A's
  straight members are stiff and its limb-end balls show as bulges; C's per-ring wobble reads as kinked,
  broken sticks at this segment count. B's joints disappear into the curves, and it is recognisable and
  different from all four sides (edge density 0.24–0.44, no side blank).
- bare_tree_a (764 tris, 30 meshes, 5.00 x 7.49 x 4.73 m): tapered CylinderGeometry members end to end
  with sphere joints, exactly as the brief lists them. Correct and the closest to the stated box; runner-up.
- bare_tree_c (912 tris, 5 meshes, 4.51 x 7.93 x 4.53 m): one recursive BufferGeometry loft with a
  hash-lumped icosahedron burl at the fork and knuckles at the limb forks, children starting inside their
  parents. Organic idea, but the 4–5 degree bends every ring look like kinks; thrown away.
- After the render: B first measured 5.78 x 7.98 x 5.42 m because the upward curl lengthens every member
  past its straight-line figure; limb and branch lengths were trimmed about 8 % (limbs 2.4/2.4/2.25 m,
  tallest branch 2.75 m) and it re-verified at 5.32 x 7.52 x 4.98 m. Nothing changed on A or C.
- Deliberate deviation: twigs are 0.04 m dia, not the brief's 0.03 m, because the style lock says nothing
  is thinner than 0.04 m at any scale; branch tips also stop at 0.04 m. Invisible at any game distance.
- Final: 1,003 triangles, inside the 300–1,200 band.
