# SUNDRIFT build notes

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

## Final measurements (22 Sep, commit c43c9d0)

`harness/jam.mjs` on the live URL: ready 12.4 s, 1.2 MB, started from a real tap, 75.8 m moved in the hold,
413 peak draws, 751 k peak triangles, 0 errors, 0 404s, RESULT PASS. Desktop gate: 600 m, seven drifts banked,
458 draws, 1.05 M triangles, 60 fps. Phone gate: 424 draws, 0.86 M triangles, 60 fps.

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
