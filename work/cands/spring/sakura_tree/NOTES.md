# sakura_tree — candidates and choice

- Winner: **sakura_tree_c** (1,223 tris: 820 blossom + 403 bark, 2 meshes, measured 9.00 x 6.88 x 8.80 m),
  shipped as `game/assets/sakura_tree.js`. Lathe-shell cloud layers: twenty hand-built lathe puffs, each a
  cumulus profile run bottom -> top with every ring turned half a segment from the one below (so the facets
  zigzag instead of stacking into pumpkin bands) and every vertex hashed. Ten 6-sided puffs (36 tris) sit on
  drooping twig tips and make the ragged skirt of the umbrella, five 6-sided fillers bridge the waist, and
  five 7-sided puffs (56 tris) at nearly one height make the flat top. Short gnarled trunk (0.8 m root
  flare, 0.56 m waist, a knuckle under the fork) forking at 1.75 m into five limbs that leave at 46-52
  degrees and flatten out, each splitting into two twigs that droop 2-22 degrees. Bark faces buried inside a
  puff are dropped and the buffer compacted. ONE `foliage` material (sakura pale, flatShading, roughness 0.9)
  and ONE `timber` (cherry bark 0x3b2a27, smooth, 0.85).
- Why C: judged on the verifier sheet and on a night preview built from the game's own `makePost` chain
  (cel bands, ink, bloom) with the sodium lamp (PointLight 0xffa040, 330, 26 m), a moon spot and a low chase
  camera at about 12, 21 and 41 m plus a roadside row tinted pale / pink / deep (`_night/*.png` here). C is
  the only one that reads as a Somei-Yoshino rather than a generic cloud tree: wider than tall, flat-topped,
  the crown coming low at the edge on drooping twigs, and near-black limbs running out under and between the
  clouds. Smaller, more numerous puffs give a billowing cloud instead of a few balls, and cost less than
  the icosahedron versions.
- sakura_tree_a (1,245 tris, 870 + 375): lofted limbs with icosahedron (detail 1) clusters placed along the
  limb ends from a table, each turned, lobed and hash-lumped, faces buried in a neighbour culled. Six layouts
  were tried: a ring of eggs, pads on sticks, stacked sprays, a mushroom cap on stilts, and finally rim
  clusters on the tips with risers carrying a broad top. The last is a sound, chunky cloud tree, but at 80
  triangles a cluster only eleven fit, so the rim clusters still hang like separate balls and it reads as a
  generic broadleaf. Runner-up.
- sakura_tree_b (1,316 tris, 900 + 416): recursive branch generator from a seeded stream (4 limbs, each
  splitting into two drooping branches and one climbing branch, each ending in two spurs), a small 6-sided
  lathe puff on every spur plus one on a leader. Its first version, with squashed icosahedron pads, read as an
  acacia. The lathe-puff version is an airy cotton-ball dome with plenty of visible wood: pleasant, but rounder
  than a Somei-Yoshino and the most expensive. Third.
- Measured null: culling faces buried inside neighbouring icosahedra only saved 4-7 %, because a detail-1
  face is about 0.65 m across and few sit wholly inside a neighbour. The budget lever is cluster count and
  cluster cost, not overlap, which is what pushed the winner onto cheaper lathe puffs.
- Second tone: tried the five waist fillers in `foliage_b` (sakura pink, kept as authored by the game). No
  visible gain under the sodium lamp, and those clusters would stop following the per-instance tint, so the
  winner keeps all blossom in `foliage`.
- After the render (C): twig swing widened to 34-54 degrees so the ten tips ring the crown instead of
  bunching in pairs; waist fillers 3 -> 5 so the skirt stops reading as a necklace from the verifier's raised
  views; skirt undersides rounded so from below they read as puffs, not dark pads; bark compacted so no
  orphan vertices sit in the buffer. All three pass the gate (base at 0, centred, no blank side, sizes
  inside the 0.2 tolerance of 9.0 x 7.0 x 9.0).
- Final: 1,223 triangles, inside the 500-1,400 band.
