# cedar_tree — candidates and choice

- Winner: **cedar_tree_c** (301 tris, 2 meshes, measured 4.39 x 14.0 x 4.28 m). All four tiers are one hand-built
  BufferGeometry: apex, two rings for a concave flank, then a 14-point rim where the seven corner tips droop
  0.22–0.40 m below the seven mid-edge points, so every rim is scalloped and drooping and the tiers overlap into
  one continuous cryptomeria silhouette with a peaked top. Trunk is a 7-sided loft, bare to about 3.1 m. ONE
  shared `foliage` material. Tier heights read from the brief as rims at 3.5 / 6.5 / 9.5 / 11.5 m and apexes at
  7.5 / 10.1 / 12.1 / 14.0 m, so each base sits 0.6 m (1.0 m for the first) below the apex beneath it.
- cedar_tree_a (252 tris, ConeGeometry tiers with a frustum skirt under each rim) interpenetrates as asked, but
  the flat cone undersides and the skirts read as four separate hats with the trunk showing in the gaps.
- cedar_tree_b (420 tris, 7-sided lathe tiers) first rendered as concave dishes: the tier profile ran apex-to-rim,
  which winds a LatheGeometry inside-out, so the culled near flank showed the far inner wall. Reversed the profile
  (underside -> rim -> apex, solid on the left of travel) and re-rendered before judging. Fixed, it is a sound
  stacked-bell conifer, but its rims are flat rings, so it reads generic-pine next to C's feathered tiers.
- After the render: the B winding fix; nothing changed on A or C, all three pass the gate from every side.
- Final: 301 triangles, inside the 200–700 band.
