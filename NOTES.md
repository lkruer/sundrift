# MINIDRIFT build notes (the game was called SUNDRIFT until 22 September)

The receipts: what was decided, what was measured, what was thrown away, what is still wrong. Dates are UTC.
Everything was built between 21 and 25 September 2026 for the 404 game jam 001, by one person driving Claude
Code (Claude Fable 5.1) with sub-agents for the asset loop and the critic rounds.

## The plan, before anything was generated

- **Subject.** An endless autumn Japanese mountain pass (touge), golden hour, stylised low-detail objects with
  a locked palette. Chosen because a chase-camera drift game lives or dies on the hero and the light, and a
  stylised set is one a code-asset pipeline can actually finish to a consistent standard in four days; the
  recipe's own warning about printed text pushed the subject away from anything that needs signage.
- **The find.** The sun is a score: every banked drift pushes the time of day forward, so the lighting, the
  shadow direction and the palette of the whole pass are driven by the player. A long chain visibly swings the
  shadows across the road. The clock also creeps with distance, fast through the night and the flat middle of
  the day, slow through the golden hour the game is about.
- **Controls.** WASD plus Space on a keyboard. On a phone, one finger: touching the left half is the throttle,
  sliding it sideways is the wheel, pulling it down is the brake; the other thumb holds the handbrake. The
  car does part of the counter-steer for the player, more on a phone, and past about 45 degrees of slip the
  assist takes over almost entirely, which gives the car a natural maximum angle instead of a spin.
- **Style lock** written first (STYLE_LOCK.md), then form briefs for fourteen objects (work/BRIEFS.md). There
  were no reference images; the briefs are the reference, written as shape, parts, proportion and count.

## Physics, tuned by numbers before anyone drove it

`game/src/car.js` is a two-axle bicycle model with saturating tyres, longitudinal weight transfer and a
friction circle on the driven rear axle. `work/sim.mjs` drives it with scripted inputs and prints slip angle,
yaw rate and speed. First run: a handbrake entry at 80 km/h spun to 87 degrees and the counter-steer assist
made it worse. The assist's sign was inverted: it steered the front wheels away from the direction of travel.
Fixed, plus yaw inertia 2300 to 2650, front grip 1.45 to 1.35, handbrake rear grip 0.42 to 0.55, sliding
grip 0.74 to 0.80 of peak: the same entry now reaches 49 degrees and is caught, counter-steer swings it into
a transition, and a lift-off entry at 100 km/h gives 41 degrees. Then, in the browser, holding full lock
through a slide still spun the car, so the assist now scales with slip (0.48 at small angles, 0.95 past 45
degrees) and steering into a big slide is damped.

| scenario | before | after |
|---|---|---|
| 0 to 100 km/h | 5.0 s | 5.0 s |
| 70 km/h, full lock, throttle | grip, 5 deg slip | grip, 4 deg |
| handbrake entry at 80, assist only | 87 deg, spun | 49 deg, held |
| handbrake entry, counter-steer 0.6 | spun | 32 deg then a transition |
| lift-off entry at 100 | (not run) | 41 deg, held |

## Assets: the loop, and what it caught

Four agents, fourteen objects, three independent candidates each (primitives, profiles, a different part
breakdown), verified with `harness/verify.mjs` from four sides plus a three-quarter view, chosen by eye on the
sheet. The per-object notes are in `work/cands/<group>/<object>/NOTES.md`; the rejected candidates are kept
beside the winners.

- **A trap the verifier does not catch, found on the sheet:** a `LatheGeometry` whose profile runs top to
  bottom winds every face inward, so with back-face culling the far inner wall shows and a cedar tier reads as
  a concave dish. Both lathe candidates of the tree agent rendered inside-out at first and passed every gate
  check; the render is what caught it. Profiles must run bottom to top (solid on the left of travel).
- Boulder: two extra rounds spent only on the moss cap (it hung over the edge, then a vertex poked through).
- Stone lantern: the hand-built roof with real upturned corners (candidate c) beat the lathe and the
  primitives on the three-quarter view, which is the view that shows a roof.

## World

- The road is a seeded centreline grown feature by feature (straight, sweeper, hairpin, S-bend, kink) with
  linear curvature ramps, elevation from a drifting grade, and `mount`, which side the mountain is on and
  which changes through ridges. Terrain height is a function of (distance along, offset across), so trees,
  walls, terraces for shrines and lay-bys, and the hill that covers a tunnel all come from one profile.
- Draw calls: statics baked per 120 m chunk with the recipe's `bakeStatic`, trees as per-chunk InstancedMesh
  so frustum culling still works, far trees do not cast shadows. Measured on the desktop gate: 110 to 150
  draws, 0.8 to 0.93 M triangles peak with the cedar forest in view (budget 900 and 1.5 M); phone tier 51
  draws, 0.38 M.
- Terrain first rendered inside-out (index winding), which showed as the hillside missing from above. Fixed by
  swapping the winding per side.
- Far mountains as rings of jittered cones read as floating white polygons through the haze. Replaced with
  three continuous skyline strips with a crested top edge, which is what a range looks like at that distance.
- The rig's `setTime` rebuilds the sky (about 25 ms), so the sun is applied at most every 2.5 s, or sooner
  after a large bank. All shader variants are compiled once after the first chunks are built, which removed
  130 to 170 ms first-frame spikes.

## Gate

`gate/drift-gate.mjs`: serves only the game folder, presses the real `#startb` (touch tap on the phone run),
drives with real key events or one real finger plus a handbrake thumb, steers by telemetry toward the
centreline, holds the handbrake into tight corners, brakes for corners it is too fast for, and asserts drifts
were banked, slip angle peaked, distance covered, no 404s, no console errors, draws and triangles under
budget. Eight frames into a filmstrip.

First phone run: real touches drove the car at 76 km/h and produced 49-degree slides, but banked nothing,
because the driver entered a hairpin at 110 km/h and hit the rail, which drops the drift. The driver got
corner speed control; the game was right.

## Measured on the live URL (22 Sep, before the hero car landed)

`harness/jam.mjs https://lkruer.github.io/sundrift/game/`, phone viewport, 4G profile: ready 6.1 s (budget 20),
weight 1.1 MB (budget 10), started from a real tap, moved 60 m in the hold, 150 peak draws, 635 k peak
triangles, 0 console errors. Desktop gate with the full forest and verge in view: 338 draws, 1.21 M triangles
after thinning the cedar grid from 12/14 m to 13/15.5 m spacing (it had reached 1.53 M).

## The turn to night (22 Sep)

The owner's direction after the first playable: less rough, more retro, at night with headlights and street
lights. The mechanic survived the turn inverted: the run now starts at 20:36 and every banked drift pushes the
night toward dawn; the flat middle of the day runs seven times faster on the clock so the golden hour comes
round again. What was added, all code, no files:

- a moon key (cool, with a 68 m shadow box snapped to texels around the car) because the recipe's rig is a
  sky, a haze and one cool fill below the horizon, and a night lit by that alone has one colour temperature;
- street lamps every 36 m on alternating sides (the recipe-loop lamp asset), each with an additive pool of
  warm light on the asphalt so the string reads at any distance, and a pool of five real point lights that
  follows the car; reflectors on the snow poles and guardrail posts made emissive;
- two spotlights for headlights plus two additive cones for the beams, the way arcade racers draw them;
- stars, a moon disc with a halo, and a horizon-glow band around the camera; the rig's hemisphere fill dimmed
  by 55 percent at night so the pools and the headlights own the frame;
- terrain noise halved and the ground normal map weakened, the road's roughness lowered so the lamps show as
  sheen, and a subtle scanline-and-vignette overlay for the retro cabinet feel.

Measured after the turn, on the live URL under the jam gate: ready 9.1 s, 1.1 MB, 211 draws, 545 k
triangles, 0 errors, 0 404s, RESULT PASS. Desktop gate: 321 draws, 0.89 M triangles, five drifts banked over
600 m.

## Critic rounds, and the turn to a drift anime (22 Sep)

Two blind rounds against nine night photographs, a fresh critic each time (work/critic1, work/critic2). Both
lost 0 of 8, and each named one property.

| round | the property the critic named | pairs | margins |
|---|---|---|---|
| 1 | the night ambient: verges and canopies lit to daylight luma, so no lamp pool owns the frame | 0 of 8 | 6 decisive, 2 clear |
| 2 | one colour temperature: unlit ground warm brown, pools beige, only the sky cool | 0 of 8 | 6 decisive, 2 clear ("clearly better, right bones, wrong palette") |

Round 1's fix: the rig's fill cut to a fifth at night, a faint moon, lamps as the light with real fall-off,
headlights narrowed to the road. Round 2's fix: a blue moon, a night tint on the ground and foliage materials
(skylight drowns warm albedo), sodium-orange lamps and pools, cool-white headlights, beams that fade along
their length, tail lights over the bloom line. Round 1 also caught a grid of squares in the lamp glare, which
was the per-texel noise in the road's roughness map showing in the highlight: replaced with smooth variation.

Then the owner's second direction: a much more detailed car, easier and cleaner drifting, more retro, and an
environment that is not low-poly trees and rocks; "decide on a unique art direction and go into it fully".
The direction chosen: **a playable 90s drift anime**. The night pass in the mood of the late-90s arcade racers
(sodium lamps, deep-blue gradient sky, a town of lights in the valley) and the drift-anime touge (guardrails,
chevrons, power lines, a lit convenience store at the pass), rendered as cel bands with ink outlines and
halftone shade. The cel look is one full-screen pass (`game/src/post.js`) over the normally lit frame: ink
from relative depth discontinuities plus a luma sobel for creases, six luminance bands applied as a ratio so
hue survives, halftone dots in the shade, grain and a faint scanline veneer. Giving the composer's ping-pong
buffers a shared depth texture rendered one black frame a second; the scene now renders into its own target
that owns the depth. Measured after: median 60 fps headless on the RTX 3060, 336 draws, 0.88 M triangles.

Drift assists added for the same request: counter-steer assist 0.48 to 0.62 (0.78 on touch) rising to 0.97
past 45 degrees of slip, an anti-spin throttle ease past 40 degrees, extra yaw damping while a slide is
coming back, more lock at speed, a gentler grip curve and a slightly lighter handbrake. The sim scenarios all
still hold (work/sim.mjs).

## Set dressing for the night (22 Sep)

Six more objects through the loop, in two agents: a concrete power pole (the game strings two sagging wires
between poles as tubes along a three-point curve, 44 m apart on the mountain side), a cat's-eye road stud
(instanced every 12 m on the centre line, white lens toward the driver, red at the edges), a bamboo clump, a
bare tree for the skyline, a lit convenience store at a lay-by with its own lamps, and a bus shelter. Notes and
rejected candidates under `work/cands/night` and `work/cands/night2`. The agent reports worth keeping: the
bamboo brief was over its own triangle budget as written (27 blobs alone were 2,160 triangles), so node bulges
became six-triangle skirts; the store's interior read as a black mirror from an elevated camera until pendant
lamps were added inside; a cat's-eye housing built on a regular octagon floated past its own facet.

A town of lights sits in the valley (900 warm points on the far plane that follows the car), and lay-bys are
gravel. The pane in the desktop app stopped repainting its canvas at one point and returned the same frame
for three different lighting states; the headless gate on the real GPU is the check that counts.

## The hero, second time (22 Sep)

The owner asked for a much more detailed car. One agent, a brief with every part named (shut lines, bonnet
louvres, an intercooler behind the bumper opening, fog lamps, canards, a tow hook, riveted box flares, mirrors
with faces, four round tail lamps, a five-fin diffuser, twin tips, a wing with end plates and a brake lamp,
deep-dish wheels with lug nuts, brake discs and vermilion calipers on the hubs, a dashboard with gauges, a
right-hand wheel, bucket seats with harnesses, a cage, a helmeted driver), three construction strategies
planned, and the loft candidate was good enough on its first clean render that the other two were dropped to
save the afternoon: 29,844 triangles, 418 meshes, baked per joint at load into a few dozen draws, verified
clean in the shipped folder with the other 21 assets. Notes and the unassembled parts of the two rejected
strategies are under `work/cands/car2`.

## Round 3, and the owner's second list (22 Sep)

Critic round 3 (fresh critic, `work/critic3`): 0 of 8 again, but 1 decisive, 5 clear and 2 slight, and it
called the build "a finished illustration style" that loses "on one property": the lamp pool was a distant
decal and the road under the camera was black, so the hero never sat inside light. Fixed by giving the car its
own spill (a point light at the nose and a red one at the tail), widening the headlight cones, lamps every
30 m with 15 m pools, a brighter blue moon and a third of the day fill at night instead of a fifth, a
stronger horizon glow, and a radial speed smear at the frame's edge so a frame at 100 km/h no longer reads as
parked.

The owner's list at the same time, all done: the road must never clip into itself or the mountain (the
generator was crossing its own earlier road at 2.8 km; it now snapshots every feature and, on running within
15 m of road older than 200 m, rolls back up to three features and plans the other way; measured 0 overlaps in
8 km; the road's shoulder now follows the wall through a widened hairpin, which had left a strip of ditch the
car drove on); the rear of the car reworked (garnish with rimmed lamp units, plate pocket, reflector strips,
ducktail, taller wing, hollow twin tips, five-fin diffuser, 33 k triangles); a line-following steering assist
(hands off the keys the car follows the road; A and D commit to a corner with as much lock as the corner
needs, a hairpin full and a gentle curve about half, so a slide stays on the road and the chain keeps going);
reverse steers like a car and the camera stays behind it; the mouse wheel and the plus and minus keys zoom the
chase camera; props placed by rule (chevrons on a corner's outside facing traffic, mirrors at hairpin apexes,
snow poles and power poles on the mountain side, lamps alternating, shrines cut into the mountain side, the
store, hut and bus stop on lay-bys on the valley side, boulders at the foot of the cutting, nothing on the road).

## The owner's third list (22 Sep): coherency, hitches, a wider road

- Void patches and trees through the road: the pass doubles back on itself, and chunks were kept only by
  index (two behind, five ahead), so road laid ten chunks ago could sit 20 m away as a hole. Chunks are now
  kept while within 330 m of the car and old road that comes back into view is rebuilt; the generator keeps new
  road 40 m from old road. Trees are no longer placed where another stretch of road is nearer than their own
  (that terrain is folded away, which is where trees floated), nor within a lamp's station.
- Hitches: a chunk build is now a generator advanced one phase per frame (road, terrain left, terrain right
  and tunnel, statics, bake half, bake half, trees; the bake was 15 ms, the rest 1 to 3 ms); every shader
  program is compiled at boot after the rig has patched the materials, which is what the one-second stall on
  the first convenience store was; the sky is not rebuilt (30 ms) while the sun is below the rig's clamp;
  the sun's two cascaded shadow maps stop refreshing once the sun is down; pixel ratio capped at 1.5 and the
  moon shadow at 1536. Generator rollbacks used to leave stale grid entries behind; pruned.
- Road 8.8 m wide (was 7.2), the wall 5.5 m out (was 4.55), hairpins 2.4 m wider on the outside, and a wall
  hit drops a drift only above 6 m/s of lateral impact (was 4.5).

## Final measurements (22 Sep, commit 254e54b)

`harness/jam.mjs` on the live URL, after the polished car: ready 13.0 s, 1.2 MB, started from a real tap,
501 peak draws, 637 k peak triangles, 0 errors, 0 404s, RESULT PASS. Desktop gate: 600 m, 550 draws, 0.82 M
triangles, median 60 fps. The car is 34,176 triangles in 431 meshes, baked per joint at load.

## Still wrong, or not attempted

- The blind pairs against night photographs never went above 0 of 8; the margins moved from six decisive
  losses to one, and the last critic said the losses were on one property. Another round would spend on that
  property (the pool owning the bottom of the frame at every point of a lap, not only under a lamp).
- Never measured on a real phone. The phone tier drops bloom and halves the trees; the headless phone
  viewport runs on a desktop GPU.
- Tyre smoke near the camera still reads as discs in stills. It should be sprites that stretch with velocity.
- The far ridges are one silhouette strip per ring; a real range has layers that slide past each other.
- The music is ambient, not the eurobeat the subject deserves (by the owner's choice: more like an open-world game's).
- No traffic, no ghosts, no leaderboards beyond a local best score.


## 22 September, evening: MINIDRIFT, one mountain

Asked for: no jitter, no freezes, no terrain that clips or road that floats, the name MINIDRIFT, a smaller car
with a sportier tail, a bigger 90s JDM dash, easier clean drifting, easy/medium/hard courses, a title screen
with paint (white by default) and a pause menu, more retro, softer headlights, and no hands-off autosteer.

- **The world, rebuilt on one height field.** The old road-relative terrain strips folded where two legs of a
  switchback met and left voids between them. Now `field.js` is the mountain; `track.js` grows the pass as a
  switchback ladder up it (each leg held above a floor built from the legs below), tests every candidate
  feature against the road already laid, and backs up over the last four provisional features when it paints
  itself into a corner. Measured: 0 dead ends and 0 overlaps over 12 seeds x 30 km x 3 courses (before the
  backtracking: 24 dead ends and 380 overlapping pairs), about 15 ms to generate 30 km. `ground.js` carves the
  field to the road with ceilings and floors (cut 1.25, fill 0.8, retaining faces where two legs cannot both be
  met); `work/tile_test.mjs` probes ~50,000 points on the road per course and the finest terrain triangles sit
  at most 2.6 cm above the ribbon's shoulder (the first version: 15 cm, from the shrine terrace starting inside
  the verge).
- **Freezes, each found by measurement.** (1) The boost flame's light toggled visibility: a light-count
  change recompiles every material. (2) The rig rebuilt its sky PMREM with a fresh generator and dome material
  on every `setTime`, a few compiles every few seconds from dusk on: now cached. (3) The sun's cascades
  rendered their shadow maps all night at zero intensity (the rig switched them off only in `setTime`, before
  the cascades existed) and switching `castShadow` at dawn would have recompiled everything: now castShadow is
  constant and the maps stop updating. (4) A second shadowed directional light (the moon) broke three's cascade
  shader (`CSM_cascades[2]` out of range): the moon is a far spot light. (5) Shaders were compiled for the
  canvas and then again for the post chain's linear target: now compiled once, in parallel, into the real
  target, with nothing drawn during loading. Ready went from 20.8 s to 5.0 s. (6) A 100 ms stall at the first
  drift of every run: a Chrome trace put it in the GPU process, bisecting the page put it on the full-screen
  vignette and hit-flash layers over the canvas; both are now drawn by the post pass. `work/jitter.mjs` drives
  a scripted run: every frame 16.7-17.2 ms after the first.
- **Jitter.** The chase camera chased a damped position (a lag that depends on the frame time), shook with
  `Math.random()`, and rolled about the world's z axis from raw lateral g. Now it is rigid on the car with a
  critically damped spring on its heading, rolls about the view axis from filtered g, and shakes with smooth
  noise. The body rolls and pitches on springs driven by low-passed accelerations; the counter-steer assist is
  filtered (the front wheels chattered); wheels never turn more than half a spoke a frame. Measured on screen:
  the car's position wobbles 0.25-0.4 px RMS frame to frame.
- **Drifting.** The hands-off line assist is gone (the user did not like the car steering itself). A drift
  hold gives the rear a little grip back past 35 degrees and takes a little away below it on the throttle; the
  yaw that would take the car past ~50 degrees is damped; the catch is damped continuously instead of by an
  on/off switch; a drift starts at 8.6 degrees, survives 0.7 s straight and chains within 2.2 s. Wall contact is
  an impulse with Coulomb friction along the wall, so a glancing touch keeps its speed.
- **Look.** Car drawn at 0.75 scale with the new tail (the agent's diffuser fins read as teeth from the chase
  camera and were cut). No fake headlight beams; the lamps throw an even soft pool (decay 0) instead of a white
  blob at the bumper. The car's white spill light shone through the body onto the road behind it and was
  removed. Concrete slope lattices on steep cuttings (mapped by distance along the road: mapped by world
  position through the face normal they smeared into streaks). The store and vending machines glow. Bloom runs
  after the cel bands so halos stay round. A faint tube colour fringe at the frame's edges.
- **Measured on commit after this section** (desktop gate / phone gate): ready 5.3 s / 4.4 s, 60 fps, peak
  463 / 367 draws, peak 1.30 M / 0.91 M triangles, 0 console errors, drifts banked every run.


## 22 September, late: reverse and J-turns, leeway, tunnels, miles

Asked for: a reverse good enough for clean J-turns, more leeway and easier smooth driving, a tunnel overhaul,
a slightly smaller car, miles per hour, and a little more retro.

- **Reverse.** Before: the tyre slip angles assumed forward travel, so the whole reverse range was handed to a
  kinematic blend, and the reverse gear pulled 0.45 of the engine and cut out at 5 m/s. A reversing car could
  not slide, so a J-turn could not happen. Now the slip angles are measured in each wheel's own frame (valid
  both ways), the gear pulls 0.72 of the engine up to 12 m/s (27 mph) with full lock available, and while the
  reverse gear is held the car follows its wheels at any speed with the lateral g capped. `work/reverse_test.mjs`:
  backing up at 12-20 mph on the gear, a 0.12 s tap on the wheel turns the car 7-9 degrees, a 1 s hold 65, and
  it stops turning when the wheel is let go. (The first version left fast reversing to the tyres: a 0.5 s hold at
  20 mph ended 117 degrees round, and any tap over 0.12 s started a J-turn nobody asked for.)
- **J-turn.** Let the reverse gear go above about 10 mph with the wheel past 70 % and it starts: the tyres let go
  a little, the drive waits until the nose is within 40 degrees of the direction of travel, and the yaw is
  steered to bring the car round to face the way it is moving, then settled. `work/jturn_test.mjs`, ten
  variants (steer only, with gas, with a handbrake tap, left and right, 14-20 mph): round and driving forward in
  0.80-0.83 s, within 7 degrees of the reverse heading. In the game, scripted keys: about 175 degrees in a
  second, then away at 16 m/s. A clean one pays 500 with a J-TURN! toast (the first build lost the bonus: the
  flag was cleared a substep before the game read it). The camera looks along the direction of travel while
  backing up fast (so the car's face is in frame and the road behind it is visible) and swings round with it;
  the old 2.2 rad snap is gone.
- **Leeway.** Walls from the centre line: easy 6.3 to 6.9 m, medium 5.5 to 6.1, hard 4.9 to 5.4 (the
  generator's clearance grows with them: still 0 overlaps and 0 squeezes over 5 seeds x 30 km x 3 courses). The
  edge line counts as asphalt, and the gravel to the wall keeps 0.88 of the grip (was 0.7 for 0.9 m, then 0.35).
  A wall hit keeps 55 % of its yaw kick and scrubs less speed; a held drift drops only at 8 m/s into a wall (was
  6); a drift survives 0.8 s straight (was 0.7) and chains within 2.6 s (was 2.2). The wheel eases over a
  little slower (7.2 per s, was 9), the lock falls off a touch more with speed, yaw is always lightly damped
  (0.5 per s, was 0.35), and the rear has a little more grip (1.33, was 1.30) and gives less of it to the
  throttle (circle gain 0.46, was 0.50).
- **Tunnels.** The bore is 1.5 m wider than the road each side: kerb, walkway, a tiled wall, and a 20-segment
  arch, 6.45 m to the crown, lined with a 1024 x 512 canvas texture (kerb, walkway, seven courses of tile, a green
  band, the arch with water stains). Fittings are merged per material per chunk: sodium lamps every 3 m (a real
  lamp light every 12 m), cable trays, amber reflectors every 6 m, green exit signs every 60 m, alarm cabinets
  and red lamps every 50 m, jet fan pairs every 120 m. Each portal is a concrete face with a bore-shaped hole,
  a hood ring, a coping, a lamp, wing walls stepping down the hill, and a nameplate in kanji and romaji (eight
  names, romaji alone where the font has no kanji). A height field cannot overhang, so the terrain was a sheet
  across each mouth and the bore looked black from outside: the terrain now leaves the cells that straddle a
  mouth open, and the portal face hides the cut. Inside, the lining glows sodium orange, the headlights drop to
  40 %, and the engine and tyres go through a short feedback echo.
- **Car and units.** Drawn at 0.68 scale (was 0.75). Speed in mph, distance in miles, reverse and J-turn hints
  on the title screen.
- **Retro.** One more pass, last, in display space: a barrel curve (0.045) with rounded corners, colour cut to
  32 levels a channel with a 4 x 4 Bayer dither, and a 6 % aperture grille (off above 1.6 device pixels per CSS
  pixel, where it would moire). Scanlines 0.075 (was 0.06).
- **Measured** (desktop gate / phone gate): ready 5.5 s / 5.1 s, 60 fps, 0 frames over 34 ms, peak 497 / 380
  draws, peak 1.06 M / 0.76 M triangles. A 1.5 km desktop run through the first tunnel: peak 553 draws, 1.22 M
  triangles, 0 slow frames.


## 23 September: a Japan aesthetic, NEO TOKYO, rain, a smooth day

Asked for, in three messages: the Japan aesthetic with cherry blossom; a slightly smaller car, a slightly wider
road and a more detailed car in the same shape; a CRT border that bends at the edges and corners; a second map, a
Tokyo downtown with neon; a faster reverse; smooth gradients between night, dawn, day and dusk; weather with rain.

- **Blossom.** New recipe-loop assets: a Somei-Yoshino cherry and a weeping cherry, red paper lanterns (chochin)
  and jizo statues (three candidates each, verify renders, a night render through the game's own cel pass for
  the lanterns). The forest's autumn patches became cherry groves (the far ring keeps only the cherries, so a
  hillside reads pink across the valley); the verge is cherry, fresh broadleaf, bamboo, azalea. Blossom holds a
  little light of its own and is tinted less blue by night than leaves. Petals: a GPU shower of 800 petals in a
  box that travels with the camera, each placed by the vertex shader from its seed and the clock, tumbling, pushed
  aside by the car's wind, drawn without depth so the cel pass does not ink a three-pixel petal into a black
  speck (the first version did). Fallen petals on the asphalt in drifts against the edges, and a petal carpet on
  the ground under the groves.
- **Japan.** Cherry avenues (170 m in every 640): trees at an even step both sides and a string of lanterns on
  timber posts, sagging between them, with a warm pool under each span. A great torii over the road before every
  shrine (legs down to whatever ground is there, a plaque in gold kanji). Jizo in rows at shrines, at bus stops,
  at viewpoints. Blue guide signs with kanji over romaji. 徐行 painted before hairpins. Fuji across the valley
  under a lower moon, drawn unlit in the night's colours. A koto plays an eight-bar tune in the hirajoshi scale
  over the loop. The title carries 夜桜峠 as a vertical strip with a red seal. The Japanese is drawn with web
  fonts fetched as subsets of only the characters used, and every canvas checks that its font really draws the
  glyphs by comparing pixels with the missing-glyph box (comparing widths said "no kanji" on a machine that had
  them: a Japanese face's box is a full em wide).
- **The car.** Drawn at 0.62 (was 0.68). A detail pass that kept the outline: working pop-up headlamps, joints
  of their own that flip up (with a little overshoot) when a run starts at night and fold away by day, the
  headlights moving up into them; a Japanese number plate (群馬 330 た 86-86) front and rear; split tail lamps
  with amber and reverse cells; three-piece wheels with sixteen bolts and a valve; fender gills and side
  markers; burnt titanium tips; a tow strap; a wakaba mark; an omamori on the mirror; shaped wing end plates.
  34.1 k triangles.
- **Road.** Half a metre wider each side on every course (the wall too); 0 overlaps over 5 seeds x 30 km x 3.
- **CRT.** The picture now bends like a tube's: nearly flat in the middle, more toward the edges, most into the
  corners (a quadratic and a quartic term), with rounded corners, a darkening into the rim and a faint sheen.
- **Reverse.** The full engine in reverse, fading on the square of the speed toward 45 mph: 18 mph in 1.5 s
  (was 12). J-turns still come round in 0.77-0.78 s from twice the speed.
- **Time of day.** Why it was abrupt: the sun was applied at most every 3 s or 0.15 h, and a banked drift moved
  the clock half an hour in one frame. Now the clock shown eases after the real one, the sun, sky, haze and fill
  are set whenever the shown hour moves (a few uniforms), and only the environment map (a PMREM build) waits,
  every 2.5 s. A scripted dawn at 0.28 h/s: every frame 16-17 ms.
- **Rain.** Spells of clear and rain that come on and clear over seconds, and a road that stays wet a while
  after. The rain is 2,400 streaks placed by the shader like the petals and lit by the shader itself: a cone for
  the headlights and the five real lamp lights near the car. Wet road and ground turn dark and glossy (the lamps'
  pools on them brighten), the sky clouds over (the rig greys and darkens its atmosphere row and takes most of
  the sun), stars and moon fade, tyres throw spray, grip drops 7 %, and the rain has its own sound.
- **NEO TOKYO.** A second map on the title. The track generator's ladder laid on a flat field: legs are avenues,
  switchbacks are the way round a block, S-bends are dog-legs; 0 overlaps over 5 seeds x 12 km x 3 courses.
  Street fronts, neon, light on the wet street, crossings, signals, 止まれ, white fences, LED street lamps,
  blocks of buildings behind (their windows drawn by a shader from world position), a skyline with blinking
  aviation lights and Tokyo Tower, a magenta horizon, rain more often and streets that never quite dry, and the
  synth arpeggio in place of the koto. Best scores are kept per map.
- **Triangles, found and cut.** With the real cherries in, a census by object at three spots on the medium
  pass rendered 1.54-1.63 M triangles (budget 1.5 M). The shared prop pools draw every instance wherever the camera
  looks (that is the price of a few draws for the whole road): 226 cherries at 1,223 triangles, 237 lanterns at
  584, 132 lamps at 944. Now an avenue's cherries and lanterns and every street lamp have a near and a far model:
  a chunk is built with the far ones (a 120-triangle cherry in the same blossom and bark materials, a glowing
  20-triangle lantern, a 36-triangle lamp) and swaps to the full ones while it is dressed, within 150 m; the far
  forest ring draws its cherries the same way; shrubs and the near forest are a little thinner. The same three
  spots now render 0.93-1.23 M.
- **Measured** (desktop gate / phone gate, 600 m, 0 frames over 34 ms in every run): the pass, ready 7.2 s /
  6.5 s, peak 590 / 462 draws, 1.18 M / 0.80 M triangles; the pass in a held downpour on the phone, 467 draws,
  0.81 M; NEO TOKYO, ready 6.8 s / 6.2 s, peak 604 / 478 draws, 0.89 M / 0.82 M triangles, drifts banked through
  the square corners in both. Ready rose from 5.5 s with the city's atlas and materials (both maps load both).
  Jitter probe: frames p50 16.7 ms, p99 16.8; the car on screen wobbles 0.3-0.5 thousandths of the view.


## 25 September, the last pass: ready to enter

- **The jam gate, run as the organisers will** (`harness/jam.mjs` against the live URL: phone, real touch, 4G, CPU
  slowed 2x): PASS, ready 13.8 s of 20, 2.3 MB of 10, 379 draws, 0.64 M triangles, no errors, no 404s; the recipe's
  `ship.mjs` flags nothing (no literal vertex arrays, no base64). Where the load goes, under the same conditions
  (work/boot_probe.mjs reads the game's own boot log): 3.6 s of network, 2.1 s of assets, 2.0 s for NEO TOKYO (loaded
  at boot although a run starts on the pass), 0.5 s the car, 0.8 s the mountain, 3.5 s the shaders and the first
  build.
- **Runs start at dusk.** 20:36 was already full night: the first drifts moved a clock nobody could see move. A run
  (and the title) now starts at 18:12, the sky still warm and the lamps lit, and the first minute's drifting carries
  it on into the night (at 18:36 it reads as night), so the find is on screen before it is read about. By sunrise a
  judge has driven through a whole night: about 45 km, or less with good drifting, within a half-hour session.
- **The clock says it moved.** A banked drift's minutes (one for every hundred points) fly off the TIME panel as the
  clock rolls forward (transform and opacity only, drawn once at the title like every other effect). SUNRISE is a
  big callout now: YOU DROVE THROUGH THE NIGHT.
- **The title says the find**: NIGHT TOUGE · DRIFT UNTIL DAWN, and EVERY DRIFT YOU BANK MOVES THE CLOCK; the J-turn
  hint says to let go of S first (the rule since the reverse round). The drift hint in a run waits nine seconds, so
  the first seconds of a run (the frames a gate or a judge grabs first) are the road. A favicon, drawn in SVG like
  everything else (the logo's M in its sunset gradient), and a description.
- **A judge's thirty minutes** (a sub-agent drove the build for 80 minutes over five sessions on both maps, plus every
  flow, the phone and the clock). Critical: every sky rebuild (every 2.5 s while the sky changes: dusk, dawn, all day,
  every shower) leaked its environment map's render target, about 11 MB of GPU memory each (textures 80 to 260 in a
  20-minute run): a phone would have lost its WebGL context well inside half an hour. The sky is now redrawn into the
  same texture (rig.js); 60 rebuilds: textures 64 to 64, GPU memory flat. Also found and fixed: a 390 to 570 ms freeze
  about a minute into most pass runs (each tunnel's name plate made a new material mid-drive, compiled on the spot
  before the rig had patched it; new chunks' materials are now patched before they join the scene); terrain tiles
  getting dearer the further the course ran (every terrace of the whole course tested per sample; now kept sorted and
  searched, bit-identical output); pausing never silenced the game, and the car's sounds (and the rain) droned on
  under the title after a run; the magnet left hanging in the sky after a restart mid-flight; small phones on their
  side (568 to 720 px wide) got the portrait layout with START below the screen; SUNRISE and SUNSET missed when a
  banked drift carried the clock over; the road studs' buffers never freed; Enter or Space could not start a run.
- **Every device a judge might hold** (a sub-agent audited every web feature used against iOS Safari 16.4+, Safari,
  Firefox and Android): the petals and the rain were placed by the wind times the clock, so as the wind changed they
  slid sideways faster and faster, 78 to 117 m/s after twenty minutes (now the drift is integrated: the wind's own
  speed); keys follow the printed letter on AZERTY, QWERTZ and the like (W A S D where they are printed, ZQSD too);
  trackpad zoom proportional; on iPhone the sound plays with the silent switch on (an audio session for playback),
  restarts after a call, sleeps while the page is hidden; pinch zoom, pull to refresh and the long-press callout
  blocked while playing; a message instead of a frozen bar if the browser lacks import maps or WebGL 2 or the CDN is
  blocked, and a reload panel if the GPU context is lost; touch laptops no longer take the phone tier; the canvas no
  longer multisampled for nothing (it only ever shows the post chain's quads); reduced motion respected.
- **Phone performance** (a sub-agent; every change proven pixel-identical by reading frames back): the shared prop
  pools culled when out of view and uploaded only where they changed, each terrain tile's forest with its own vertex
  array, static objects' matrices frozen, the moon's shadow pass skipped by day, far-terrain normals spread over four
  steps (a 7 to 10 ms step every 4 s), the scene copy pass gone, double-sided transparent meshes split in two (three
  re-derived their programs twice a frame), idle particles and trails not uploaded, skid marks uploading only the slots
  touched. Per-frame JS at CPU 2x: 19.5 to 15.9 ms on the pass at night, 21 to 16.3 by day; phone 16.9 to 13.3;
  at dusk (where a run starts) 34.6 to 47.7 fps. The jam gate's median fps under CPU 2x: pass 51 to 55 before, 60
  after; city 46 to 48 before, 54 to 55 after. And NEO TOKYO now loads only when it is chosen: the pass boot fetches
  no city file and compiles 75 programs instead of 98, ready 14.1 s to 10.9 s under the gate's 4G and CPU 2x; the
  first switch to the city takes 4 to 6 s behind LAYING THE ROAD, and a START pressed meanwhile is kept and the run
  starts the moment the road is ready (it was lost: the city probe, pressing START 3 s after choosing the city, never
  started). Checked on the final tree: 10 minutes on the pass and 8 in the city (frames p99 16.8 ms, GPU textures flat,
  no shader compiled in play, no errors); 60 sky rebuilds with textures 64 to 64; all four gates (drifts banked 7, 7,
  9, 12; no frame over 34 ms); the 45 s probes p99 17 ms on both maps; ready 10.8 s under the gate's conditions.

## 25 September: drifting that holds, rain that behaves by day

- **The drift, held.** The owner: "rework some of the drifting physics if needed. SATISFYING PLEASE". Measured first
  (work/feel_test.mjs drives the car sim through the moves a drift is made of, with a keyboard's ramped wheel): a
  handbrake flick at 80 km/h with the throttle floored and the key held into the turn reached 49 degrees and then
  unwound on its own to grip in a second and a half (held angle 26 +- 17 degrees), because past 35 degrees the rear's
  grip came back (the old spin guard) and outpulled the front; with the key let go the slide died as fast; and no
  lift-off, feint or power-over could start a slide at all (9 degrees at most): only the handbrake could.
  Now, once the car is well sideways (over 6 to 11 degrees, going forwards at speed, not a donut or a J-turn; over
  10 to 17 above 120 km/h), its angle is steered toward the one the hands ask for (car.js, the drift held; a spring on
  the angle with damping on its rate, at most 6.5 rad/s^2 of yaw): the key held into the turn holds the slide (40
  degrees with the throttle down, 16 off it; a small correction, under 30% of the key, holds nothing), the throttle
  sets how deep, a key against the slide closes it, the handbrake throws it wide, and letting the key go (its hold
  eases off over half a second, so a keyboard's taps keep a slide alive) brings the car straight in about a second
  without a lurch. The old grip tricks give way to it inside a drift; the spin guard past 50
  degrees stays. Measured: held angle 40 +- 0.4 degrees; lift-off and feint entries now work (40 and 39 degrees);
  a switchback swings from 43 degrees one way to 42 the other in about a second; letting go of the key: straight by
  1.2 s, accelerating away.
- **A held slide carries its speed**: on the throttle, 65% of what the tyres dragged sideways would take off the car's
  speed is given back, along its way only (the line is the tyres' own). Held drifts lost 2.4 to 3.6 m/s^2; now 0.6 to
  0.9. Lift, and the scrub is all there.
- **Power over**: cornering at the limit on the throttle with the wheel held into the bend in the low gears (under about
  75 km/h), the rear lets go of a third of its grip. Not above: the gate's phone driver, swinging between full locks
  four times a second at 140 km/h, had every swing step the rear out and the hold grow it into a weave that never ended,
  so no drift banked (0 in one run); a player's quick corrections on a fast sweeper would have felt the same. With both
  fixes a full-lock turn at 110 km/h is grip again (8 degrees), and the phone driver banks as before. A handbrake pull
  with the wheel over kicks the tail out at once (20 degrees at 0.5 s from the pull, was 0.7).
- Checked: steering (work/steer_test.mjs: no spins, keys and touch), donuts (power_test), J-turns, reverse, the stop
  hunt, wall escapes; in the game, hairpins (work/hairpin_test.json: 7 of 7 exited, the old code 6, no touches, no
  spins) and the city's square corners (work/corner_city.json: 10 of 10, 4 wall touches where the old code had 6).
- **Rain by day.** "the rain looks a little janky, fix it. especially at day". Everything in it was added light: the
  far curtain (900 even columns of long dashes round the camera) read as a barcode across a bright sky, the near
  streaks as glowing white scratches (and at speed, raked fully by the car's velocity, as long bars swinging round in
  a drift), the splashes as white hoops on the road, the drops on the lens as grey balls with a dark rim and a glint.
  Now all of it is premultiplied: by night a drop is only the light it catches (it glitters as before), by day a pale
  sliver of the grey sky laid over what is behind it (lighter than the trees, a touch darker than the sky). The near
  streaks are at least a pixel wide (a thinner one shimmered) and fainter by as much, lean back with speed by less,
  and thin away before the lens; the curtain is a column every ten centimetres, short dashes, most of them dark,
  coming in gusts, over a faint veil; the splashes are smaller and quiet by day; fewer drops on the lens by day, and
  a weaker rim and glint. The exhaust's pops light the exhaust's own cone of fire for a blink (a puff of sprites read
  as a yellow disc on the road), with only a flash of its light on the road; the tyres' spray is a finer, greyer mist.

- **The pass, gone over end to end** (a sub-agent; before/after pairs in work/shots/pass_qa/compare). It was at the
  jam's limits further along than the gate drives: by day 3 km in, 1.49 M triangles (the limit is 1.5 M) and 834 draws
  at the viewpoint (900). Now 1.31 M and 762 at the worst places measured, and lighter everywhere, desktop and phone:
  simpler cedars in the second forest ring, no light pools or towns drawn by day, the tunnel plate one draw, no
  shadows from sign faces, no 1 cm bolts on 1,400 guardrail posts. Fixed: the lamps' pools lay on the ground 15 cm
  under the asphalt (only the verge half showed); a wavy roughness map drew lamp reflections as wobbling puddles and
  black blotches by day; the road texture smeared into grit streaks where the road widens; tunnel portals burned flat
  white, with a trench beside the mouth showing the lining glowing through, and black roof stains; every chevron
  pointing the other way was inside out (a negative scale), now a mirrored model; boulders, bushes, cherries and
  poles floating over banks (a raycast check at five places: 28 flagged, now 1); the forest grew into the viewpoint's
  view; the convenience store's lot read as snow; paper lanterns glowed at noon; a 12 to 15 ms step in the chunk build
  (the tunnel and its portals now build in separate steps, 6 ms at worst); guardrail runs ended in a bare cut. Added:
  yellow warning diamonds (bends, winding road, falling rocks, deer; one draw, knockable, SIGN DOWN! 90), a wayside
  shrine every 830 m or so (a small torii, a lit stone lantern and its pool of light, two jizo), pairs of lit vending
  machines in the long empty stretches, a railing, bench and coin telescope at the viewpoint, a woodpile and postbox at
  the hut, steps and a dressed-stone wall at the shrines, lit windows in the stone lanterns.
- **By day the shade keeps its colour**: under the cel bands the darkest band was black, so a face in shade at noon
  went black (a pagoda's shaded side); by day it is now the first band up (post.js uLift), at night as it was.
- **The HUD, the rewards, the sounds of scoring** (a sub-agent): a banked drift flashes where the live count was, flies
  up into the score and the score pulses as it lands and rolls up; callouts come one at a time (a bigger one cuts in);
  the multiplier, the tier and the combo punch as they climb; BIG ANGLE! for a slide held past 47 degrees; NEW BEST as
  a callout and a glow; a first-run hint on how to drift, and a line on the title; the pause screen a run card; on
  Android a short vibration on the big moments (after a first tap); the off-road panel no longer wraps into a blob
  over the drift count on phones and says HOLD ON TIGHT while the magnet has the car; phone portrait and landscape
  layouts of their own (the title no longer taller than a landscape phone). Sounds: a cash-in for a bank that climbs
  with the tier and the chain, combo steps, a multiplier tick, tier stings, a clip ting, a big-angle shing, a new-best
  fanfare, a J-turn sting, a bell that rises with each hit in a smash chain, UI clicks.
- **NEO TOKYO, gone over end to end** (a sub-agent; before and after in work/shots/city_qa, and in-page audits of
  buildings against roads and each other, loose things against buildings, poles and signals, people against
  buildings, and how full every pool gets: work/city_qa_audit.json, all clear on EASY and HARD). Fixed: the street
  fronts z-fought at every chunk seam (the last lot of a chunk ran into the next one's first: 39 overlapping pairs in
  1.2 km, up to 27 of them sharing a face; now none share a face); building corners came within a metre of the road
  at dog-legs (only six points of a footprint were tested; now eleven round the box as it stands); bags, bikes, crates
  and cones stood inside buildings on bends (the pavement's 30 m stretches ran on straight; now they follow the kerb)
  and inside poles, signals and vending machines; people stood inside buildings where an alley was closed off; coin
  parkings' cars had corners in the neighbour's wall; the pools of bags, bikes, cones and vending machines filled up,
  so chunks built ahead of the car had nothing on their pavements (some things now thinned by a hash of their place,
  every pool under 83%); by day the skyline showed its night (dark towers, lit windows); the insides of square
  corners were bare ground (a building on the corner facing the crossing, pavers round it); dark empty lots behind
  the convenience stores; manhole steam beside the car read as a white pillar in the rain; a chunk's last build step
  had grown to 13.5 ms (split; the worst world update is 9.2 ms, 10.4 before). Added: blue direction boards over the
  corners (the turn's arrow, place names in kanji and romaji, a route shield), pedestrian signals whose green man
  blinks before it ends and runs with the crossing's chirps, stop lines and crossing-ahead diamonds, podium towers
  (a tall one set back on a block of shops), lit signs on steel frames on the low roofs, lit tower crowns and red
  aviation lights, building sites (a hoarding with its lamps, a frame in scaffold sheet, a floodlit luffing crane),
  JR-style station name boards, amber and white delineators along the Shuto's barriers, the vending machines' pools of
  light, paler tiles on some fronts so the street is not all dark grey by day. Budget, a 26-point night tour of
  5 km: desktop draws at most 754 (747 before), triangles at most 1.09 M (1.13 M); phone 570 (567), 0.92 M (1.00 M).
- **A lamp's highlight on the wet road beside the car** spread into a white pill the cel pass inked round like a
  solid thing; the road's specular is now let go within a few metres of the lens, and its knee is harder (a soft glint,
  not a disc).
- **The camera in a slide** eases back about 35 cm and opens 3 degrees as the slide deepens, so the car's angle and
  the bend both fit the frame; it settles back as the slide ends. Tyre smoke is shaded (lit from above, darker
  underneath) and thins away right at the lens.

## 25 September, early: nothing stops dead, reverse that behaves, a city that lives

- **The car no longer stops dead.** The owner: "sometimes some inputs make the car just stop dead. For instance,
  sometimes reverse will be funky". The cause was the kinematic blend that keeps a slowly reversing car on its
  wheels: it was fully on whenever the car rolled backwards slower than 3 m/s, whatever else it was doing, and it
  killed the sideways speed at 25 per second. A slide braked on S (the brake is also reverse, so the car goes a
  little backwards) and every spin passing 90 degrees are exactly that, and stopped dead: 2.8 to 0.7 m/s in five
  frames, sliding sideways with no key held. work/stop_hunt.mjs drives the car sim with 600 runs of random keyboard
  sequences from rolling, drifting, reversing and spinning starts on open ground, and flags any 0.1 s in which the
  car loses more speed than its tyres could take (1.5 m/s, 2.5 with a brake held) or a spin stops faster than tyres
  could stop it: 390 at the old code (105 going slowly backwards, 231 sliding sideways, 54 spins), 5 now, all of them
  pirouettes at walking pace coming to rest. The blend now holds the car to its wheels only while it is rolling
  straight on them (slip under 10 to 25 degrees, sideways speed under 1.2 to 3.5 m/s, yaw within 1 to 2 rad/s of
  what the wheels ask); sliding or spinning, it is capped at what tyres could do. Backing up on the gear measures
  exactly as before (work/reverse_test.mjs).
- **Reverse that behaves.** Letting go of S while backing up faster than about 9 mph with the wheel turned, or a
  tap on the wheel just after letting go, started a J-turn: the car whipped round 170 degrees and more
  (work/reverse_release_test.mjs: backing round a corner on S and A for 2 s and letting go of both, 167 degrees; a
  0.12 s tap on A after letting go at 16 mph, 171). A J-turn now takes what a J-turn is: S let go at speed after
  backing up roughly straight (the wheel's average over the last fifth of a second on the gear under half), then
  the wheel thrown over and held a tenth of a second. Let go with the wheel still over and the car rolls on
  following its wheels, as if still on the gear. Every J-turn in work/jturn_test.mjs is still clean (round in
  0.87 s, was 0.77: the tenth of a second the flick is held). One thing left as designed: full lock and full
  throttle from a standstill is a donut (asked for in the power round), so W with the wheel over straight after
  reversing spins the car round.
- **Steam** (citysteam.js): out of a third of the manhole covers (the city road's texture has one 39 m and one 17 m
  into every 48, so the steam comes out of a cover), out of a vent in one shop front in five (a grille on the front,
  the puffs pushed out over the pavement and lit by the shop's sign), and in slow tall plumes off one building in
  eight over 40 m. Every puff is a quad turned to the camera and moved by the clock in the vertex shader, one mesh a
  chunk; the cel pass bands it into painted clouds. It shows most on a wet night and thins out before the lens.
- **Neon that lives.** One sign in eleven is a failing tube (steady for most of an 8 to 20 s cycle, then a
  stutter, and one time in three dark for a second before it catches) and one in twenty-five blinks; the light it
  throws on the pavement and its streak down the wet road go with it (a per-vertex seed on the signs, the pools and
  the streaks, and the city's clock). The signals cycle, green ten seconds, amber three, red nine, each on its own
  phase, from one mesh a chunk (it was four).
- **An airship** over the skyline, 64 m long, with an LED screen along each flank showing the street's ads (the
  screens' own shader), a pulsing red beacon and a white strobe. It circles a point that follows the camera 12 s
  behind, 170 m up, so it drifts across the sky and shifts as the car sets off or stops.
- **People**, where a car cannot reach them: in the rooms behind the glass (customers from behind at the ramen and
  bar counters, a shopper at the end of a convenience store aisle, a player at an arcade machine, someone at an
  office desk late), and standing in the light at the mouths of the alleys and by their cars in the coin parkings,
  always past the building line, where the car's wall is (2.75 m past the kerb). Figures are drawn once into an
  atlas, turned to the camera about their upright and cut out into the depth buffer, so the cel pass inks them;
  in the rain they have umbrellas up (clear convenience-store ones, mostly).
- **The city's sound** (a sub-agent, audio.js cityUpdate, only on NEO TOKYO): the far city (stereo brown noise in a
  low roar and a faint mid wash, both drifting), a car or bus passing on the next street every few seconds, horns
  (a kei car's one, a car's pair, a truck's; taps or leaning on it; now and then answered), an ambulance's pee-po
  going by with its doppler every minute or so, the elevated train's rumble with its wheels' clacks timed exactly
  from the train you see (pairs 0.15 s apart, ga-tan go-ton), and the crossings' chirps for the blind, piyo or
  kak-koo, while the walkers have green (each signal's record carries the phase its lamps run on). A short street
  reverb (the fronts' early echoes, a 1.8 s tail) and a muffle inside a bore. Measured against the music (work/
  city_audio_level.json): the bed 19 dB under, the siren at its nearest 16 dB under, the train's clacks 12 dB under
  up close; driving at 108 km/h the whole of it is 24 dB under the engine. 0.05 ms a frame, about 25 standing nodes,
  built on the first city frame; should the calls stop (the title) it fades away on its own.
- Gates, city: peak 628 draws (was 596), 0.90 M triangles, no slow frames; on a phone 501 draws.

## 24 September, night: the wheel is the player's

- **The counter-steer assist no longer overrides the player.** In a deep slide the assist (which steers the front
  wheels toward the way the car is travelling, the catch that keeps a thumb from spinning the car) grew to 97% and
  cut a key held into the turn to a third, so the wheels pointed against the key: measured in the car sim, a drift
  with the key held into the turn had the wheels pointing the other way 42% of the time on keys and 48% on touch,
  by up to 19 degrees. Now a key held into the turn takes the help away in proportion (half a key or more: all of
  it; P.assistYield), the key is cut by at most a quarter in a deep slide, and a key held firmly never has the
  wheels pointing the other way: 0% on both, and still no spin (the rear's grip past the comfortable angle and the
  yaw damping past 50 degrees hold it). With no key held, or a key held the catch's way, the help is all there, as
  before (a flicked slide let go of is caught exactly as it was). Donuts, J-turns and reversing measure as before;
  hairpins at a sensible speed: no wall hits; entered 40% too fast with full lock: 8 touches in 7 (it was 14,
  because full lock now turns the car). The owner may later want EASY left as it was and HARD with lesser assists:
  the knobs are all in car.js CAR (assist, assistTouch, assistYield, lineAssist), so a per-course override is small.

## 24 September, evening: power, donuts, boost, glare

- **Motion blur** (the cel pass): each pixel's world position from the depth, through the last frame's camera,
  gives where it was on the screen; the picture is averaged along that path (six samples, a 180-degree shutter,
  at most 3% of the screen). Nothing within 9 m (the car, which rides with the lens) is blurred or blurred in, and
  none across a camera cut. Off on phones. The render time with it on and off: the same within noise.
- **What looked unrendered in the distance** was mostly the sea of cloud: by day it laid a flat white sheet over the
  far valley (switching it off showed the rolling hills it hid), and at night a flat pale band that read as a lake.
  It is now a thing of the night and the dawn only, capped at 60% (never hides what is behind), and it fades out
  between 500 m and 1.7 km, so it lies in the nearer valleys. And the forest stopped at the second ring of terrain
  tiles, about 360 m out: the hills beyond were bare and the trees appeared as the tiles came nearer. The third ring
  (to 560 m) now has a far forest: each tree a cone or a blossom blob in two pools shared by every tile (two draws),
  on the very cells the near forest uses (each cell now has its own random numbers), with the near trees' own
  materials, so a tree coming nearer turns into the full model where it stood.
- **Lamps**: the five real lamp lights go to the lamps round a point 34 m ahead of the car instead of round the car,
  and fade in over a longer reach, so a lamp's pool of light is up well before the car gets there.
- **Rain**: showers now, not spells: on the pass 30 to 60 s of rain every two to four minutes (it was 50 to 110 s in
  every two to four), lighter (40 to 85%); in the city a 30% chance of starting in the rain (was 55%), 35 to 65 s
  of it, then one and a half to three minutes clear.
- **Measured under load**: other work on this machine was taking the CPU (a python process near the top of the
  list), and every build dropped frames: the committed build 2,120 frames in the 45 s probe, this one 2,291. Frame
  times this round are only comparable build to build, not with earlier rounds.

- **Power and wheelspin** (car.js). The engine gives 17% more (9,600 N, fading to nothing at 245 km/h: 0 to 153 km/h
  in 8 s where it was 136). The drive was clamped to what the rear had left after cornering, so the throttle could
  never break the rear loose: out of a drift the car simply straightened, and a donut died on the spot (full lock,
  full throttle from rest: under one turn in 10 s, the car rolling off in a circle at 117 km/h). Now the drive is
  limited by the tyre's whole grip, and past what the rear can take it spins the tyres: a spinning tyre loses up to
  68% of its cornering grip (less at speed), in the low gears or when already sideways, so the power re-breaks
  traction out of a slide (the slide grows to 26-47 degrees again under full throttle) but never spins the car on a
  fast straight or in a fast bend. Asked for a donut (low speed, full lock into the turn, the throttle floored) the
  helpers that stop a spin step aside, the tyres break loose sooner, and the spinning keeps the car going round:
  3.3 turns in 10 s from rest, and from a handbrake flick. Reversing and J-turns measure as before. The scripted
  hairpin drifter: at a sensible speed still no wall hits; entered 40% too fast with bang-bang full lock, the extra
  power carries it wide more often (14 touches in 7 hairpins).
- **Boost** now comes the moment a slide ends (it used to wait for the 0.8 s grace in which a slide may resume
  before the points bank; the boost earned is given then, and any more if the slide resumes and grows), with its
  whoosh; a pull on the handbrake cancels a boost, with a short falling hiss.
- **The street lamps' glare.** The lamp heads glow less (emissive 2.1 to 1.3), their lights are 20% dimmer and 30%
  dimmer again in the rain, their pools and the city's no longer brighten in the wet, and the rain catches less of
  them. The worst of it was not the lamps but their reflections: on the glossy wet road a lamp's specular peak ran to
  many times white, and the bloom made each one a capsule of glare (found by switching each source off in turn). The
  road's direct specular now has a soft ceiling (x / (1 + 2.6x), in its own shader hook): a lamp still streaks down
  the wet asphalt, lit, never blown out. The neon's wet-road streaks top out at 60% of what they were.

## 24 September: tight corners, the city's trash, rain, detail

- **NEO TOKYO, in detail** (a sub-agent, on the city's files). Rooms behind every lit window: buildings.js looks
  into an interior atlas made at load (rooms.js) with a parallax, walls, floor, ceiling and furniture shifting with
  the camera; eateries, boutiques, konbini, arcades and bars at street level, offices, flats and tatami rooms above,
  a TV flickering in some dark flats; shops stay lit by day. A first version drew the rooms in the shader and added
  3.7 s to the shader compile at load; from an atlas it is about 0.4 s. LED screens from one ad atlas (twelve wide
  ads, seven tall, two tickers), animated in the shader, on fronts, towers and low roofs, their light on the wet road
  changing with the ad. Concrete poles with sagging power and telecom lines, drops to the fronts, lines across the
  street. Shopping-street arches with chasing bulbs, red lantern strings across the road. Glass skybridges with
  people crossing (rare: they need tall fronts on both sides). Kerb stones, two-colour pavers and the yellow tactile
  strip. An elevated railway along some long avenues, shops in its arches, masts, stations, and a six-car lit train.
  Coin parkings with parked cars. Tokyo Skytree. White lane dashes on the wide EASY avenues. Nothing it added stands
  within 1.3 m of a road's edge (the poles at 1.35 m, solid; parked cars 2.3 m and beyond the fronts' hard edge).

- **Tight corners.** Measured first: a scripted handbrake drifter through ten HARD hairpins (R 11.5-15 m) already
  made every one at a sensible speed with no wall hits; entered 40% too fast with keyboard-style full-lock
  steering it made them all too, but hit the outside wall twice in each. Two changes. Every tight arc is now wider
  on its own outside (the pass's hairpins 3.0 m, up from 2.4; the city's square corners and dog-legs 2.2 m, where
  before they had nothing). And a hand on the line (car.js): held in a slide the bend's way round through a bend
  tighter than about 55 m, the car's direction of travel and its nose are helped round toward the bend's own rate
  where the sliding tyres fall short (75% of what is missing), and a slide too fast for the bend sheds a little
  speed. Too fast into the same ten: wall hits 14 to 7, the corner made 0.6 s sooner; at a sensible speed the same
  ten with no hits and 0.25 s sooner. J-turns and reversing measure exactly as before.
- **The city's trash** is no longer built into the chunk: bags, boxes, beer crates (one or two high), cones, menu
  boards and bicycles are instanced pools (tinted per instance) the car knocks out like the bollards, each with
  points (TRASH! 15, CRATE! 25, CONE! 25, MENU BOARD! 40, BIKE! 80), a burst of scraps and its own sound. Nothing on
  the pavement is placed where a road runs: at a square corner a stretch of pavement ran on straight past the turn
  into the street across, and its bags and cones ended up in the road.
- **Rain**: splashes ringing the road ahead (instanced, placed on the road a few a frame), streaks that rake back
  past the camera with the car's speed, a curtain of rain further off (a cylinder round the camera with its streaks
  in the shader), the headlights' beams in the rain (the searchlights' ray-distance shader), drops beading and
  running on the tube's glass (the retro pass; at speed they rake sideways), and the car's paint going glossier in
  the wet. Measured: a 45 s run in a downpour, worst frame 17 ms.
- **The pass**: grass tufts and spring flowers along the verges (two new code assets, drawn after the solid world
  and writing no depth, so the cel pass does not ink them into scribble); a five-storey pagoda at every shrine,
  lanterns under its eaves. The tunnel portals, twenty-odd boxes each, are merged into one mesh per material: that
  took back 38 draws at night and 65 by day at the busiest place measured (the sun's shadow cascades drew each box
  again).
- **Small things**: the tube's colour fringe is a little less (it gave everything a rainbow edge).
- **The pavement**, after the owner still saw "bikes and stuff on the street": every loose item now stands back
  against the fronts, and none within 1.3 m of any road's edge (the kerb zone a drift uses); only the bollards
  stand at the kerb, as they did. Checked over 6,500 items on both city courses: none in a road.
- **Light trails** (fx.js LightTrails): while a slide is held, a thin red streak of light hangs in the air behind
  each tail lamp, curving with the car's path and dying in 0.42 s, with a faint horizontal flare on the lamp; the
  lamps' positions come from the lamp geometry itself. Low-key on purpose: 4.4 cm wide, as bright as the slide is
  deep, fainter by day.
- **The engine**, rewritten because the owner found it "AI-like": the detuned sawtooth stack is now a fallback, and
  the note comes from an AudioWorklet that fires an inline four's pulses (sharper under load, per-cylinder bias,
  per-firing jitter, burn noise riding each pulse) into six fixed exhaust resonances (92 Hz to 3.1 kHz), DC-blocked
  and saturated. Around it: induction roar that opens with the throttle, straight-cut gear whine with the road
  speed, the turbo whistle, a flutter (compressor surge, nine decaying chirps) and a softer valve sigh on a lift, a
  75 ms ignition cut and a clunk on each upshift, a bouncing limiter, and pops with a flame from the exhaust for a
  moment after a lift from high revs (the game decides the pops, so each has its flame). The revs flare with the
  rear tyres' slip in a slide (the tach shows it). Tyres squeal in three narrow wandering bands over a broad scrub,
  and a wall hit crunches. Measured in the browser: the firing pitch tracks the revs (about 230 Hz at 7,400 rpm),
  the pops land in the lift, the level is within a couple of dB of the old engine.
- **Brake lights**: the tail lamps burn brighter on the brake and the handbrake.

## 23 September, night: the skid marks, the bump, the music, the air

- **Skid marks.** The ring buffer draws a quad between every pair of neighbouring points, and two of those quads
  were never meant to be seen: the one from the newest point to the slot about to be written (stale data, or the
  world's origin before the ring first wrapped) and the one joining the end of one slide to the start of the next.
  Both faded from the mark's alpha to nothing across whatever distance lay between: long faint streaks across the
  road and off into the landscape. Every stroke is now fenced by invisible points at both ends and the ring's
  seam is fenced too. The marks also sat at the height of the car's centre, so on a grade, the crown or the
  Shuto's camber one wheel's mark floated and the other's was buried and flickered; each is now laid on the road's
  own surface under that wheel (grade, crown and bank). The width is laid across the stroke's direction, not
  across the car (at a big drift angle the car's own axis runs along the mark and pinched it to a sliver), and
  nothing is drawn while the car flies or hangs from the magnet (the stale wheel state had been throwing dust off
  the car all the way through the magnet's flight).
- **The bump.** Off the road the car took its vertical speed from how far the floor moved between two frames, so a
  step (the verge sits 6 cm under the asphalt, the lip of a bank is sharp) handed it its whole height as speed, and
  the next frame's launch test threw it into the air: 5 to 6 m high off a small bank. It now moves as a thrown
  body that the floor holds up, and on the ground it rises with the floor at the rate the floor's slope gives
  along its travel (capped at 5 m/s, the springs taking a little). It is airborne only where the floor falls away
  faster than gravity can follow and more than a hand's width. Driving off the free edges at 60 and 100 km/h at
  16 places: 33 take-offs, 7.5 s in the air and a highest of 6.0 m before; 6, 2.7 s and 1.5 m after (the remaining
  ones are real crests and steep banks taken fast).
- **The deep-night sky and the rain.** Deep in the night (the sun more than 12 degrees down, the whole start of a
  run) the sky was not updated at all, so a storm came and went under a clear starry sky. The rain and the map now
  always update it.
- **The music**, rewritten to be more like an open-world game's (slow, airy, no drums) and still retro: see the
  README. Measured in the browser: no clicks, the pass all in D major, the city in A flat major with its one
  borrowed D natural, about 3 dB under the old loop's level.
- **The air** (atmos.js, and the cel pass). The sea of cloud began as three flat sheets of mist lying below the
  road: where they cut the hillsides they drew hard contour lines, and from above it read as lakes or snow. It is
  now a height fog in the cel pass: each pixel's world position comes back from the depth buffer, and the cloud
  below a billowing top (following the car's height slowly, never over it) is integrated along its ray, a ramp and
  then solid. The valleys fill softly and the ridges fade into it. Light shafts are the same pass marching 22
  steps toward the moon or a low sun on the screen and counting open sky. The city's light pollution is a glow
  added to the rig's lower sky stops, so the far towers stand against it and the haze takes its colour; the koi
  are one instanced draw, their swimming a wave down the body in the vertex shader, and they face the way they
  really move. A lightning flash is a term in the rig's atmosphere itself (the dome, the haze on every far thing
  and the environment all flare with it) and a lift of the fill light; the environment is never rebuilt mid-flash.
- **A stall found and fixed.** A 83-117 ms frame once a run, one run in two, just as the off-road countdown went
  red. A trace put it in the browser's compositor (a 55 ms Skia/Dawn render pass on the GPU process), not in the
  game. Disabling the panel removed it (four runs of four); the countdown's SVG filters, its blur sizes, an
  animated filter and the ring were each ruled out in turn; freezing every change of the panel's style after it
  first shows did it (three of three). The ring, the number and all three moods (normal, red, the magnet) are
  now drawn by script into a canvas, and the panel never changes once shown. The smash popup and the countdown
  are drawn once at the title, with the rest of the HUD.
- **Measured.** Gates (600 m): pass EASY desktop 603 draws, 1.08 M triangles, 3 drifts banked; phone 476-484 draws, 0.72-0.74 M (1, then 8 drifts: the bot's luck with the slope walls); NEO TOKYO desktop 527-603 draws, 0.80-0.88 M (1, then 6 drifts, as many as the commit before on the same gate); phone 458 draws, 0.73 M, 2 drifts; ready 7.1-8.4 s; no slow frame in any gate (worst 17 ms). The 45 s autopilot run on HARD, three times after the fix: worst 16.9-18.1 ms.

## 23 September, later: off the road, things to smash, the Shuto, and fixes

Asked for, in two messages: reflective studs down the road so the way ahead shows in the dark; hold a mouse button
to orbit the car; no hard barrier where there is no guardrail, a five-second countdown and then a magnet (as in
Mario Kart) that takes the car back to where it left; bollards, lamps and bushes that fly and flatten, absurdly
satisfyingly; a much more detailed and grimier Tokyo; an elevated road that weaves between the buildings, banked.
Then: a huge sun glare; remove MEDIUM; reversing out of a slide should not stop the car; the distant mountains are
not rendering; keep improving.

- **Road studs.** White on the centre line every 12 m, amber at both edges every 8 m: points of light drawn by one
  shader per chunk, a few pixels across at any distance, bright wherever the car points (a retroreflector sends
  the headlights straight back) and dim elsewhere. They replace the old 208-triangle cat's-eye models.
- **Orbit.** Either mouse button held on the scene turns the camera round the car (yaw free, pitch clamped); let go
  and it eases home the short way round. The lens is kept out of street fronts and tunnel linings.
- **Off the road.** Each sample of road now says how hard each edge is: a guardrail or a tunnel's lining (and 12 m
  either side of a portal), a city's street fronts 2.75 m past the edge, or nothing. On the medium pass about two
  thirds of the edges are open. Past the edge the car rides the ground: its height and its tilt from the ground under
  its wheels, a slope's gravity along the car, less grip on steep ground, a face rising more than 0.9 m at a corner
  is a wall, and where the ground falls away faster than the car can follow it takes off, flies, and lands with a
  thump, dust and a bounce on its springs. From the moment the car's centre is 0.35 m past the edge a countdown
  runs in a panel under the score (a draining ring and a seven-segment digit, a tick every second, red for the last
  two); 0.4 m back on the road and it folds away. At zero a big red horseshoe magnet swoops in from the road's side,
  the car leaps up and clanks onto it, and it is carried along an arc (with one full turn for fun, the camera
  holding the line of flight) to the road where the car left it, and dropped, squash and all, with a ring of dust,
  in 2.15 s. The magnet and the rain are drawn once in the load's warm-up frame: their first draw mid-drive was a
  stall.
- **Things to hit.** Every prop the car can meet is a record in a spatial hash (about 1,600 of them near the car:
  the forest's trunks, registered by each near terrain tile, and every pooled prop). Trees, boulders, huts,
  shrines, torii legs, jizo, the city's signal poles: solid, hit like a wall (a trunk shakes out a burst of
  blossom). Snow poles and the city's bollards, lamp posts, chevrons, traffic mirrors, vending machines: knocked
  out of their pool and thrown as rigid bodies (the prop's own model, drawn as an instanced mesh of one so it uses
  the pool's compiled program): a box of eight corners bouncing and sliding on the ground with restitution and
  Coulomb friction, spun from where the bumper struck, sleeping when settled and sinking away after a few seconds.
  First version: the car's full speed went into them and a lamp left the frame at 22 m/s; now they are swatted
  ahead at half the car's speed and popped high, so the car passes under them. Steel throws a spark trail; a lamp
  goes out (its light, its bulb and its pool of light); the world stops for a blink (hit-stop, heavier things
  longer) and the camera kicks; a counter punches in (BOLLARD!, LIGHTS OUT!, FLATTENED!, JACKPOT!) with the chain.
  Bushes are squashed flat in place with a springy overshoot and a leaf burst. The roadside trees were moved back
  to 3.2 m past the edge: at 1.8 m the gate's driver hit one mid-drift at 86 km/h.
- **Tokyo, grimier** (buildings.js and the new cityprops.js, by a sub-agent): rain streaks from every sill, slab and
  roof edge, a wet band at the foot of every wall, stains, roller shutters on a quarter of the shops, older tiled
  buildings; air conditioners, downpipes, cable runs, gas risers, fire escapes, balconies with laundry and futons,
  roof tanks, masts, billboard frames, awnings, noren and lantern pairs; on the pavement bin bags, crates, bicycles,
  cones, A-boards, manholes, drain grates and puddles (about 37 k triangles a chunk, one draw per material, the
  chunk built a few lots per frame). The walls darken and gloss in the rain.
- **The Shuto.** The city's generator now lays an expressway two to five times every 12 km: a 150 m ramp up to 11.5
  to 14.5 m, two pairs of S-bends (R 70-115 m) that net no turn, and a ramp down. The road banks into its bends
  (up to 12 degrees, once it is up), everything that sits on the road follows the camber, and gravity along the
  camber helps the car round. The ground ignores the viaduct, so the street runs on underneath; the deck's sides
  run down to the street while it is low and stop at a girder once it is up, with a pier every 30 m, Jersey
  barriers with a lit strip along both edges, and a green gantry at the top of the ramp (首都高速 環状線, C1,
  銀座 2 km, 新宿 7 km). The towers beside it are at least ten metres taller than the deck.
- **The glare.** The sky's glow round the sun was being cut into cel bands: one great flat disc. The cel pass now
  leaves the sky (nothing written to depth) out of its bands, dots and creases, and the glow is tighter.
- **MEDIUM is gone** from both maps; an old MEDIUM choice opens as EASY. The gate takes --course=easy|hard.
- **Reverse out of a slide.** Holding reverse used to lock the car onto its wheels (the kinematic blend meant for
  backing up) and a sideways slide stopped dead. The lock now only comes in once the car is rolling nearly
  straight: backwards at 9 m/s and sliding at 5, holding reverse, the car carries on to 14 m/s as the slide settles.
- **The far mountains.** The two skyline rings were lit and fogged like anything else, and at 2.4 and 3.4 km the
  haze took them to exactly the sky's colour; only their ink outlines showed. They are now unlit silhouettes,
  each mixed toward the haze by hand (the nearer less) and a little darker than it, and the haze is a little
  thinner (0.0012 to 0.00095).
- **Measured.** Gates (600 m, desktop / phone): pass EASY 590 / 480 draws, 1.01 M / 0.72 M triangles; pass HARD
  589 draws, 1.04 M; NEO TOKYO 564 / 455 draws, 0.81 M / 0.73 M; ready 6.8-7.6 s. The gates showed an occasional
  single 83-100 ms frame just after one of their own screenshots; the same drive with no screenshots (an
  autopilot hook, 45 s): 2,641 frames on HARD and 2,640 in a Tokyo downpour over the expressway, the worst 17 and
  18 ms.
