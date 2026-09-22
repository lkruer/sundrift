# SUNDRIFT asset briefs

Every object below is described as FORM, not function: shape, parts, proportions, counts, colours from the
style lock. There are no reference images for this set, so this file is the reference. Read
`STYLE_LOCK.md` (repo root) first and keep it open; every hex value and size in it is fixed.

Rules that apply to every object (from the recipe's `docs/asset-contract.md`, do not skip them):

- One module, `export default function (THREE) { ... return group; }`. No imports, no files, no network,
  no timers.
- Geometry only from Three.js constructors and operations (Box, Cylinder, Sphere, Cone, Torus, Lathe,
  Extrude, Shape, Capsule, Icosahedron, BufferGeometry built in loops). Never a literal vertex array with more
  than a few numbers, never base64. `harness/ship.mjs` flags arrays of more than 64 numbers and a judge
  reads the file.
- `MeshStandardMaterial` with explicit colours. Name a material after its recipe only where the style lock
  says so (`stone`, `timber`, `tile`, `metal`, `foliage`, `ground`).
- Anything open-ended (an open cylinder, a lathe, a plane) needs `side: THREE.DoubleSide`.
- Metres. Base at y = 0, centred on x and z, front faces +Z. Measure VERTICES to centre and ground the
  object (the six-line snippet in the contract), never `Box3.setFromObject` on rotated parts.
- Recognisable from all four sides. `userData.mounts` is only for a face that genuinely mounts against a wall.
- `rotation.x = +a` pitches the FRONT DOWN. Render before you trust any tilt.
- `ExtrudeGeometry` with a bevel grows the shape by `bevelSize` on every side and `bevelThickness` at both
  ends; subtract it from the profile or do not bevel.
- Write an `<name>.expect.json` next to each candidate with the width, height and depth from the style lock,
  `tolerance` 0.2.
- Three genuinely independent candidates per object: `<name>_a.js` from primitives, `<name>_b.js` from
  profiles (Lathe / Extrude / Shape), `<name>_c.js` from a different part breakdown or a different reading of
  the brief (a hand-built BufferGeometry loft is welcome). Not three edits of one file.

---

## hero_coupe  (4.45 L x 1.72 W x 1.28 H, the only object that gets a high triangle budget: 9,000 to 30,000)

A low two-door coupe in the proportions of a late-1990s Japanese rear-drive sports coupe, built as a drift
car. No badges, no lettering, no number plate characters.

Body massing, front to back along +Z (nose at +Z):
- Front bumper: full width, 0.42 m tall from 0.16 m off the ground, a wide dark lower intake slot
  (1.1 x 0.12 m, chrome dark, recessed 0.06 m) and two round fog-lamp recesses (0.10 m dia) near the corners;
  a small mouth slot above (0.9 x 0.06 m). A front lip/splitter plate (chrome dark, 0.03 m thick) protrudes
  0.08 m ahead of the bumper at 0.14 m off the ground.
- Bonnet: long and low. Nose edge at 0.68 m high, rising to 0.86 m at the base of the windscreen, which is
  1.95 m behind the nose. A shallow raised centre bulge (0.5 m wide, 0.03 m tall) runs down the bonnet.
  Two thin rectangular headlamp lenses per side (each 0.34 x 0.09 m, lamp warm, emissive 0.8) wrap slightly
  around the corner, with a chrome-dark surround.
- Cabin: windscreen raked at about 30 degrees from horizontal, A-pillars 0.06 m thick, roof peak 1.28 m at
  2.55 m from the nose, roof width 1.32 m (narrower than the body: the glasshouse tumbles in). Side glass
  runs from the A-pillar to a B-pillar 1.1 m further back; the rear quarter glass is a small triangle. Rear
  glass slopes at 28 degrees down to a boot deck at 0.96 m.
- Boot: short (0.55 m), a lip at its trailing edge. A high rear wing: an aerofoil blade 1.42 x 0.22 x 0.03 m
  (chrome dark) on two swept uprights 0.26 m tall, blade centre 1.26 m off the ground, 0.15 m from the tail.
- Rear panel: two round tail lamps per side (0.11 m dia, tail red, emissive 1.5) set in a chrome-dark panel
  0.16 m tall; a rear bumper 0.40 m tall with a diffuser of four vertical fins (chrome dark); one large
  exhaust tip (0.09 m dia, 0.12 m long, chrome dark, metalness 0.8, roughness 0.3) on the LEFT side.
- Flanks: box-flared wheel arches over all four wheels, 0.07 m proud of the doors, with a flat top edge;
  side skirts 0.10 m tall, chrome dark; a door seam line is optional. Small aero mirrors on 0.08 m stalks at
  the A-pillar base (chrome dark, 0.16 x 0.09 m).
- Paint: pearl white, roughness 0.35, metalness 0.0. Glass: tint glass, roughness 0.1, with a 0.02 m
  rubber trim around every window.
- Wheels: four, radius 0.32 m (tyres rubber, 0.24 m wide front, 0.27 m rear), deep-dish rims in bronze
  (rim dia 0.46 m, five straight spokes 0.05 m wide, a 0.06 m polished lip, a 0.08 m centre cap in chrome
  dark, the dish recessed 0.09 m inside the rim). Wheelbase 2.50 m, track 1.50 m, front axle 0.95 m
  behind the nose. Camber the rears in by 3 degrees, the fronts by 4 degrees, so the tops lean inward.
  Ground clearance 0.14 m to the sills.
- Interior, visible through the glass: two bucket seats (0.55 m tall from the floor, dark rubber colour with
  a vermilion stripe), a diagonal roll-cage bar behind them (0.04 m dia, chrome dark), a small deep-dish
  steering wheel on the RIGHT side (right-hand drive), and a driver: a white helmet (0.26 m sphere, pearl
  white, with a dark visor band) on a dark torso (0.44 m tall) in the right seat, arms toward the wheel.
  Cabin floor at 0.32 m off the ground.
- Underbody: a flat plate in chrome dark 0.14 m off the ground covering the whole footprint.

Moving parts, and this is required or the car cannot drive: each wheel is a `THREE.Group` whose origin is
the wheel's own centre (so it can spin about its axle) inside a hub group at the same origin (so the fronts
can steer about a vertical axis). Declare them:

```js
g.userData.joints = { hubFL, hubFR, wheelFL, wheelFR, wheelRL, wheelRR };
```
where `hubFL` is the steering pivot of the front-left wheel and `wheelFL` (a child of `hubFL`) spins. FL is
the wheel at +X (left), +Z (front). Give the body a group named `body` for everything that does not move.

Candidate strategies: (a) primitives: boxes with scaled and slightly tapered geometry (`geometry.scale`,
writing to `attributes.position` to taper a box is fine), cylinders for wheels, torus for the tyre sidewall;
(b) profile: an `ExtrudeGeometry` of the side-view silhouette (a `Shape` traced from the bumper up the
bonnet, over the roof and down the tail) extruded across the width, with the bonnet and roof narrowing done
by separate masses rather than by warping the extrusion; (c) a hand-built loft: six to nine cross-sections
along the length (each a closed loop of a few points, built in a loop) skinned into a `BufferGeometry` with
computed normals, plus separate parts for lamps, wing, wheels and interior.

Triangle count 9,000 to 30,000 in total; wheels are a third of it.

## maple_tree  (7.0 H, canopy 6.0 W)

A broad autumn maple: a short trunk (0.36 m dia at the base, cedar bark, 8 sides, slightly flared) rising to
2.1 m, forking into three main limbs (0.16 m dia) that lean outward at 30 degrees and reach 3.8 m. The canopy
is a cluster of six or seven flat-shaded blobs (icosahedron detail 1, radii 1.3 to 2.1 m) overlapping so the
outline is a broad rounded dome 6.0 m wide whose lowest edge is 2.4 m off the ground and whose top is 7.0 m;
two blobs sag lower on one side so the tree is not symmetric. Foliage colour maple orange, material name
`foliage`, `flatShading: true`; ONE foliage material shared by every blob (the game recolours it per
instance). Trunk material name `timber`. 300 to 1,200 triangles. No leaf cards.

## cedar_tree  (14.0 H, 4.5 W)

A tall straight Japanese cedar: trunk 0.5 m dia at the base tapering to 0.12 m at 12 m (cedar bark, 7
sides), bare for the first 3.5 m. Foliage is a stack of four flat-shaded cones (7 sides, `side: DoubleSide`
not needed since they are closed) with slightly drooping rims: base cone 4.5 m wide at 3.5 m height and 4 m
tall, then 3.6 m wide at 6.5 m, 2.8 m wide at 9.5 m, and a narrow spire cone 1.4 m wide from 11.5 m to 14 m.
Each cone's base sits 0.6 m below the rim of the one under it so they interpenetrate. Cedar green, material
name `foliage`, ONE foliage material shared. 200 to 700 triangles.

## boulder  (1.5 W x 1.1 H x 1.3 D)

A weathered granite boulder: an icosahedron (detail 1) with every vertex pushed in or out deterministically
(a hash of its index, up to 18 percent), scaled to 1.5 x 1.1 x 1.3 m, the bottom vertices flattened to y = 0
so it sits in the ground; warm stone, `flatShading: true`, material name `stone`. A second, smaller blob
(0.9 x 0.3 x 0.8 m, moss green, name `foliage`) sits on the top as a moss cap, sunk 0.1 m into the rock.
120 to 500 triangles.

## stone_lantern  (0.75 W x 1.8 H x 0.75 D)

A Japanese stone lantern (kasuga style): a square plinth 0.72 m wide and 0.16 m tall; a round tapered pillar
0.28 m dia at the bottom and 0.24 m at the top, 0.62 m tall, with a subtle ring bead at its middle; a square
platform 0.58 m wide and 0.12 m tall; the fire box, a 0.42 m cube with a square recess 0.16 m wide and
0.03 m deep on each of its four faces (so it reads as windows without being holes); a roof that is a
four-sided concave pyramid 0.78 m wide at the eaves and 0.34 m tall with upturned corners (a
`LatheGeometry` with 4 segments and a slightly concave profile does this in one piece); a small sphere
finial 0.12 m dia on top. Everything warm stone, material name `stone`; a moss green band (name `foliage`)
0.05 m tall around the base of the plinth. 400 to 2,000 triangles.

## guardrail_post  (0.14 W x 0.75 H x 0.12 D)

One galvanised guardrail post, instanced every two metres in the game (the beam itself is generated along
the road). A C-channel post 0.10 m wide, 0.06 m deep, 0.75 m tall (a box with a recessed channel on its
back face, or two thin flanges and a web), sitting on a small square base plate 0.16 x 0.16 x 0.02 m; a
rectangular spacer block 0.10 x 0.14 x 0.08 m on the FRONT face (+Z is the road side) at 0.48 m to 0.62 m
height; a round red reflector 0.07 m dia, 0.01 m thick, on the front face at 0.66 m (tail red, emissive
0.6). Galvanised, roughness 0.5, metalness 0.6, material name `metal`. Keep the whole thing under 400
triangles: it is instanced hundreds of times.

## snow_pole  (0.14 W x 1.4 H x 0.08 D)

A Japanese roadside snow pole: a straight pole 0.06 m dia, 1.30 m tall, with alternating bands, from the
bottom: tail red 0.26 m, lane white 0.26 m, red, white, red (five bands). On top a downward-pointing
arrow plate 0.14 m wide, 0.16 m tall and 0.02 m thick (a triangular prism pointing DOWN, tail red) facing
+Z, and a round white reflector 0.05 m dia on the arrow. Under 300 triangles: instanced.

## lamp_post  (1.6 W x 6.0 H x 0.4 D)

A galvanised road lamp: a square base plate 0.36 m with four bolt cylinders (0.03 m), a tapered round column
0.18 m dia at the base to 0.10 m at 5.4 m height (12 sides), a curved arm that leaves the top of the column
at +X and reaches 1.4 m outward while rising 0.5 m (three cylinder segments or a tube along a
`QuadraticBezierCurve3`), ending in a lamp head: a rounded rectangular box 0.62 x 0.22 x 0.32 m, chrome
dark on top, with a lamp warm emissive lens (0.5 x 0.24 m, emissiveIntensity 1.2) on its underside. A small
access door rectangle (0.12 x 0.3 m, recessed 0.005 m) on the column at 1.0 m. The arm reaches +X so the game
can face the lamp over the road. Column and arm material name `metal`. 600 to 2,000 triangles.

## traffic_mirror  (0.9 W x 2.6 H x 0.5 D)

A Japanese convex traffic mirror: a galvanised pole 0.07 m dia, 2.15 m tall on a small base plate; a round
mirror 0.80 m dia that is a shallow dome (a `SphereGeometry` slice or a lathe: 0.06 m deep at the centre)
facing +Z, tilted 12 degrees down, mounted by a short bracket at the top of the pole; the mirror face is
galvanised colour with metalness 0.85 and roughness 0.15; a vermilion round rim 0.06 m wide and 0.05 m
deep around it; a curved hood (a quarter-torus or a bent thin box) in vermilion over the top third. The back
of the mirror is a chrome dark shallow dish. 500 to 2,000 triangles.

## chevron_sign  (0.95 W x 1.8 H x 0.12 D)

A curve-warning chevron board: a galvanised post 0.06 m dia, 1.35 m tall; on top a board 0.92 m wide,
0.60 m tall and 0.04 m thick, maple gold face on +Z, galvanised back, with three chevron arrows in chrome
dark raised 0.01 m off the face, each a "greater-than" shape 0.22 m wide and 0.46 m tall pointing to +X (the
board can be flipped in the game), built from two thin rotated boxes or an extruded `Shape`. A thin chrome
dark border 0.03 m wide around the face. Under 800 triangles.

## torii_gate  (5.4 W x 5.0 H x 0.9 D)

A shrine gate: two round pillars 0.42 m dia, 4.3 m tall, leaning inward by 3 degrees, standing on round
stone plinths 0.72 m dia and 0.22 m tall (warm stone, name `stone`); a lower cross beam (nuki) 0.24 m tall,
0.20 m deep and 5.6 m long passing through both pillars at 3.3 m; a top beam (kasagi) 0.36 m tall, 0.34 m
deep, 6.4 m long at 4.65 m to 5.0 m, whose ends sweep upward by 0.25 m (three boxes: a straight middle and
two angled ends, or a single extruded curved shape), with a thin darker cap on top (chrome dark, 0.06 m
tall, same plan); a short central tablet block (0.3 W x 0.5 H x 0.1 D) between the two beams; two small
wedge blocks where the nuki meets each pillar. Pillars, beams and tablet vermilion, roughness 0.6. 500 to
2,500 triangles.

## tunnel_portal  (10.0 W x 6.8 H x 3.0 D)

A concrete tunnel mouth for a 7.2 m road: a face wall 10.0 m wide and 6.8 m tall, 0.6 m thick, with a
round-topped opening 8.2 m wide (vertical sides 2.4 m tall, then a semicircle of radius 4.1 m), built as an
`ExtrudeGeometry` of a `Shape` with a `Path` hole, no bevel; a parapet coping along the top 0.4 m tall and
0.8 m deep in roof tile colour; two wing walls 3.0 m long, 0.6 m thick, angled back at 30 degrees from
each end of the face, stepping down from 5.0 m to 3.0 m tall; a lining tube 3.0 m deep behind the opening
(a half-cylinder of radius 4.1 m over vertical walls, chrome dark, `side: DoubleSide`, 16 segments) so the
mouth reads as a hole; a concrete kerb 0.3 m tall along each side of the floor inside. Concrete, roughness
0.9, material name `plaster`. The BACK of the face (the -Z side) is the same portal seen from inside, so it
is not blank. The road passes through at y = 0. 800 to 4,000 triangles.

## mountain_hut  (4.0 W x 3.6 H x 3.0 D)

A small timber rest shelter: a plank floor 3.6 x 2.7 m at 0.30 m on six stone footings (0.3 m cubes, warm
stone); plank walls (timber, name `timber`) 2.2 m tall with a horizontal plank groove every 0.25 m
(thin recessed boxes); a gabled roof (ridge along X, 4.0 m span, eaves at 2.35 m overhanging 0.5 m all
round, ridge at 3.6 m) in roof tile colour with a ridge cap beam 0.12 m; the front (+Z) has a sliding door
opening 1.1 x 2.0 m recessed 0.1 m with the door panel's upper half tint glass, and a bench 1.2 x 0.4 x
0.42 m under the eave to the right of the door; one square window 0.7 m on each side wall and the back;
a short chimney stack 0.3 m square through the roof at the back. 700 to 4,000 triangles.

## vending_machine  (1.0 W x 1.83 H x 0.75 D)

A Japanese roadside drinks machine: a lane white box 1.0 x 1.83 x 0.75 m with slightly rounded vertical
edges (0.03 m chamfer via a bevelled extrude, corrected for the bevel growth); the front (+Z) has a
recessed display window 0.86 x 0.72 m starting at 0.95 m up (tint glass, 0.05 m deep) containing two rows
of five small can cylinders (0.065 m dia, 0.12 m tall) alternating vermilion, maple gold, cedar green, lane
white and tail red; a lamp warm emissive strip 0.86 x 0.06 m along the top of the window (emissive 1.2);
a small chrome dark control panel 0.22 x 0.30 m to the right below the window with a round dial; a
pick-up flap opening 0.5 x 0.16 m recessed at 0.30 m; a chrome dark plinth 0.08 m tall. 300 to 1,500
triangles.
