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
- The music is a loop that opens up while drifting; it is not the eurobeat the subject deserves.
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
