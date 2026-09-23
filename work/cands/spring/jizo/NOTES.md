# jizo — candidates and choice

- Winner: **jizo_a** (1,424 tris, 24 meshes, measured 0.34 x 0.753 x 0.311 m), shipped as `game/assets/jizo.js`
  with `jizo.expect.json` (0.34 x 0.75 x 0.30, tolerance 0.1). All primitives, front +Z.
  - Base: two stepped box slabs, 0.34 x 0.30 and 0.28 x 0.25, on a recessed chrome-dark footing.
  - Robe: an oval CylinderGeometry frustum narrowing to the hem (0.27 x 0.20 at the shoulders, 0.22 x 0.165 at
    the hem) under a half-sphere of shoulders.
  - Sleeves and hands: capsule upper arms down the sides and capsule forearms bent forward to a tapered six-sided
    block of joined palms, fingertips up.
  - Head: a flat-shaded 0.2 m sphere with long ear lobes and a nose bump.
  - Bib: two open cone segments over the front 130 degrees, squashed like the robe and draped from under the neck
    tie over the shoulder dome and down the chest. Clearance was checked against the shoulders at r = 0.10 and
    0.125 and against the robe at 0.42.
  - Tie and cap: a torus neck tie with a knot and two tails at the back; a knitted cap made of a stretched sphere
    dome, a rolled torus cuff and a pompom for the peaked top.
  - Materials: `stone` 0x8a7f72 (flat), `fabric` 0xc9402b (flat, DoubleSide for the bib shell) and an unnamed
    chrome dark. Through the game's `ASSET()` it merges to 3 meshes: stone 916, fabric 496, dark 12.
- Why A: its hands are the only ones that read as praying hands, from the front, both sides and the
  three-quarter view: a pointed stone block standing in front of the red bib, with forearms meeting it. The rest
  stacks cleanly from the ground up: a dark line at the ground, stepped base, robe, big red bib, round head with
  ears, red cap with a pompom peak. At 20 m (about 34 px tall at 1080p) that is red cap, stone head, red chest,
  stone body and a stepped base, which is the whole identity.
- jizo_b (1,412 tris, 15 meshes, 0.34 x 0.75 x 0.318 m): profiles.
  - One lathe from hem to crown, squashed to an oval below the shoulders.
  - The bib is a partial lathe of a closed profile (13 mm thick) warped to a U hem; this is the best bib of the
    three.
  - An octagonal stepped lathe pedestal on a dark footing, and lathe cap and tie.
  - Tube sleeves ending inside an extruded side-profile of joined palms; lens-lathe ears; extruded tie tails.
  - Runner-up, thrown away because the forearm tubes and palm block read as a belt and buckle, not hands.
- jizo_c (1,416 tris, 10 meshes, 0.336 x 0.742 x 0.324 m): hand-built, one carved stone mass.
  - A loft of superellipse sections from hem to crown. Palms, forearms, elbows, ears and nose are relief lobes
    pushed out of the sections, with angular samples crowded at the front.
  - The bib slab follows the chest without the relief, so the palms come through it.
  - A ribbed knit-cap loft, and chamfered base blocks with a recessed dark joint between them.
  - Its cap and its dark line are the best of the three. Thrown away because the relief hands read as a keel or
    shelf even after being made deeper and narrower.
- Changed after the renders:
  - A: the first bib, a flat half-disc slab, stuck out like a tray in the three-quarter view; replaced by the
    draped cones. The cap's fat flared torus read as a hat brim; the cuff now hugs a 10 percent taller dome.
    The tie roll, tails, cuff and palm tip were brought up to 0.04 m. Head, tie and cuff segments were trimmed
    from 1,492 to 1,424 tris.
  - B: extruded-ellipse ears read as headphone cups and became lens lathes. It was 1,880 tris and 13 percent too
    deep; I trimmed segments and squashed the octagon to 0.9.
  - B's first draft, caught by hand before it rendered: the tie profile ran clockwise (inside-out), the tails were
    flipped into the body, and a sleeve's open end poked out of the shoulder.
  - C: the first draft counted about 2,100 tris; I cut rings and angles. Its bib edges were wound inward, and the
    figure was set 12 mm back on the base to bring the palms relief inside the depth.
- Deliberate deviations:
  - A third material, the chrome-dark footing (0x2b2d31, inset 1.5 cm, 0.035 m tall). The brief lists only stone
    and fabric, but the style lock says every object over 0.6 m carries a strong dark line against the ground.
    From the low chase camera it reads as a contact line. It is one line in the module if unwanted.
  - The bib is an open shell hugging the chest: surface detail, not a member.
  - Fabric is flat-shaded like the stone.
  - Width and depth (0.34 x 0.30) are my design; the lock gives the height only.
- Night preview: `_night/night_sheet.png` (A/B/C at 5, 12, 20 m). The scratch harness is described in
  `../chochin/NOTES.md`. At 12-20 m its stand-in lighting leaves the figures dim; only the silhouette and the reds
  carry, which is the point of the chunky masses.
- Final: 1,424 triangles, inside the 300-1,500 band.
