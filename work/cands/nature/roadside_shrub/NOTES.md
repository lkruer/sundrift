# roadside_shrub — candidates and choice

- Winner: **roadside_shrub_a** (240 tris, 3 meshes, measured 1.77 x 1.08 x 1.69 m). Three icosahedron blobs
  (detail 1), radii 0.75 / 0.55 / 0.50 m, each squashed a little, every one touching the ground, the big one
  off-centre so the bush is asymmetric. Reads as a low autumn bush from all five views and matches the maple's
  blob language, which matters when the two sit on the same verge. ONE `foliage` material, dry grass, ready
  to be retinted per instance. Three blobs rather than four because a fourth icosahedron (80 tris) would put it
  over the 260 ceiling; no stub because nothing floats.
- roadside_shrub_b (216 tris, four 6-sided lathe blobs, one lifted on a cedar-bark stub) is cheaper and carries
  the dark stub, but six sides is too few for a blob this squat: the lathes read as faceted gems or crates from
  every side, not foliage. The profile was written bottom -> top from the start (the lathe winding trap), so it
  rendered right side out first time.
- roadside_shrub_c (192 tris, one hand-built BufferGeometry of four hash-jittered domes rising from the ground)
  is the cheapest and a fair idea, but the jitter reads as a crumpled boulder in dry-grass colour, and once the
  game retints it moss green it would read as a mossy rock next to the real boulder.
- After the render: nothing changed. All three passed the gate first time (base at 0, centred, no blank side).
- Final: 240 triangles, inside the 90–260 band (the verifier's own floor is 150, so 150–260 in practice).
