# chochin — candidates and choice

- Winner: **chochin_a** (584 tris, 14 meshes, measured 0.346 x 0.548 x 0.329 m), shipped as
  `game/assets/chochin.js` with `chochin.expect.json` (0.34 x 0.55 x 0.34, tolerance 0.1). The paper is one
  SphereGeometry (10 x 12) scaled into an ellipsoid 0.34 m across and 0.47 m tall, its poles buried inside the
  caps. Nine bamboo hoops are open CylinderGeometry frusta, each cut to the ellipsoid's slope at its height and
  standing 3 mm proud, in an unnamed NON-emissive copy of the lantern red (DoubleSide, being open). The caps are
  closed 0.22 m cylinders, 0.045 m tall, lacquer black. The hanging loop is a torus in the YZ plane, so a rope run
  along X threads it; it sits on a six-sided boss, and its crown is the top at 0.55. Paper: `lantern`,
  0xd8342a, emissive 0xffb070 at 1.0. Through the game's own `ASSET()` it merges to 3 meshes: lantern 220 tris,
  hoops 180, lacquer 184, all position/normal/uv.
- Why A: it is the only rib treatment that survives the glow. The deciding test was a night preview (below).
  In it the red hoops read as the ribs of a red paper lantern at 5 and 15 m. They also carry the red when the paper
  tone-maps toward peach, and at the lock's emissive 1.0 the row reads orange-red with red ribs. By day (the
  verifier sheet) they are fine darker ridges on the paper, which is what a lit akachochin looks like.
- chochin_b (584 tris, 13 meshes, 0.322 x 0.55 x 0.339 m): profiles, the brief's natural build. The paper is
  nine LatheGeometry panels, one per gap between eight hoops, each a hoop/sag/hoop profile. Because each panel is
  its own lathe, normals break at every hoop. It has extruded 10-gon caps and an extruded ring-Shape loop. Thrown
  away: a ridge is shading and silhouette only, and the emissive paper swamps shading. Its interior edge density
  in the verifier is 0.025-0.031 against 0.15 for A and C. At night it is a plain glowing oval with a faintly
  scalloped outline, and no rib reads inside the silhouette.
- chochin_c (576 tris, 4 meshes, 0.329 x 0.55 x 0.346 m): hand-built. Paper panels and hoops are lofted
  together as two indexed BufferGeometries: a faceted paper profile with split normals, and nine 9 mm hoop bands
  in the lacquer black. Caps are hand-built cylinders, and the hanger is a half-elliptical tube bail. It is the
  only candidate in the brief's two colours. Thrown away: black hoops make a white lantern with black stripes (a
  coil spring) rather than a red lantern. The ribs read as well as A's, but the red is gone.
- Changed after the renders:
  - A was 660 tris at 12 segments; I cut it to 10.
  - At 10 segments SphereGeometry puts vertices on multiples of 36 degrees, and CylinderGeometry 18 degrees off
    them. The paper's vertices then poked through the middle of every hoop facet, and the hoops broke into
    dashes; only the 1080p night crop showed it. Fix: the hoops start at thetaStart = PI/10. Then 12 height rings
    instead of 10 for a smoother outline (584).
  - B: sag 7 mm -> 11 mm, because the scallop did not read at 7.
  - C: the first bail maths ran the arch 70 degrees past horizontal into a nearly closed ring. It is now a
    semi-ellipse whose feet sink 1 cm into the cap.
- Deliberate deviations:
  - A third material, the non-emissive hoop red. That makes 3 draws per pool, not 2.
  - Lacquer roughness is 0.4, not the lock's rubber 0.9, because the brief says lacquered.
  - The loop tube is 0.022 m thick, under the lock's 0.04 m minimum. The brief asks for a small loop on a
    0.34 m lantern, and a 0.04 m ring is a donut a third of the lantern's width.
  - The hoops are 9 mm bands: surface detail, not members.
- Night preview: `_night/night_sheet.png` (A/B/C at 5, 15, 30 m, emissive raised to 2.0) and
  `_night/chochin_a_glow1_vs_glow2.png`. It is a scratch harness, not part of the recipe: ACES at exposure 1.05,
  a dim cool fill, a moon, one warm street lamp and headlights, then the game's own Cel pass from
  `game/src/post.js`. It renders a crop of a virtual 1920x1080 frame at the game's 62 degree FOV, so pixel
  density matches what a player sees. It is a stand-in for the game's night, not the game.
- Final: 584 triangles, inside the 150-600 band.
