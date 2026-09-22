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

## Still wrong, or not attempted

(kept up to date at the end)
