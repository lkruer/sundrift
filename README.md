# MINIDRIFT

Endless night drifting in Japan, on two maps: a mountain pass in cherry-blossom season (夜桜峠, Yozakura Pass)
or the rain-slick neon streets of NEO TOKYO (ネオ東京). Chain drifts to bank score and boost, clip the guardrail
without touching it, and every banked drift pushes the night toward dawn.

**The look:** a playable 90s drift anime.
- **The pass.** Cherry trees in blossom line the road and dot the cedar forest, and petals drift on the air and
  lie on the asphalt. Red paper lanterns are strung along the cherry avenues. A great vermilion torii spans the
  road at every shrine, with jizo in red bibs beside the path. Blue guide signs carry kanji. Fuji stands under
  the moon across the valley. The pass also has sodium lamps, slope lattices and tunnels through the spurs.
- **The city.** Street fronts line the road with stacked neon signs, and the neon's light lies on the pavement
  and streaks across the wet asphalt. The corners are square, with crossings and signals, and Tokyo Tower glows
  orange on the skyline.
- **Weather and time.** Rain comes and goes: the sky clouds over, the road turns glossy, and the lamps and signs
  streak across it. The time of day moves smoothly from night through dawn and day to dusk and back.
- **The frame.** It is drawn as cel bands with ink outlines, halftone shade and scanlines, then shown on a curved
  CRT whose picture bends at the edges and rounds into the corners, in a 90s console's dithered colour.
- **The dash** is a 90s tuner's: a tach with a redline, amber seven-segment mph and score.

**Play:** https://lkruer.github.io/sundrift/game/ (phone or laptop; one finger on a phone, WASD and Space on a
keyboard). Pick a course and a paint on the title screen, or just press START.

Built for the [404 game jam 001](https://github.com/404-Repo/404-game-jam) with the
[404 game recipe](https://github.com/404-Repo/404-game-recipe): every 3D object in the game is Three.js code.
The car and the props came through the recipe's loop (a written form brief, three independent candidates per
object, a four-sided verify render, a choice made by eye); the road, terrain, rails and tunnels are built
procedurally. There is not one mesh file, texture file or audio file in the shipped folder. The road
markings, the ground grain, the slope lattice, the tunnel tiles, the particle sprite and every sound are made
at load time.

## Courses

The difference between them is the road.

| pass | road | wall to wall | corners |
|---|---|---|---|
| EASY | 10.8 m of asphalt | 14.6 m | long legs, wide switchbacks, flowing sweepers |
| MEDIUM | 9.6 m | 13.0 m | the pass: hairpins and S-bends |
| HARD | 8.6 m | 11.6 m | short legs, tight hairpins, relentless |

| NEO TOKYO | road | wall to wall | corners |
|---|---|---|---|
| EASY | 12.0 m | 16.4 m | broad avenues, wide square corners |
| MEDIUM | 10.8 m | 15.0 m | square corners, turns round a block, dog-legs |
| HARD | 9.6 m | 13.4 m | tight back streets |

In the city the same generator lays its switchbacks flat: a leg is an avenue, a switchback is the way round a
block (two square corners with the block between), and an S-bend is a dog-leg onto a cross street and back.

The gravel between the edge line and the wall keeps most of its grip: running wide costs a little, not the run.

Each is one fixed, endless course (same seed every run), so best scores compare.

## Controls

| | keyboard | phone |
|---|---|---|
| drive / brake | `W` / `S` | hold the left half of the screen |
| steer | `A` / `D` | slide the finger left or right |
| handbrake | `Space` | hold the right half of the screen |
| pause | `Esc` or `P` | the pause button |
| camera zoom | mouse wheel, `+` / `-` | |
| mute | `M` | the note button |
| reverse | hold `S` when stopped (a strong gear, to about 40 mph) | pull the finger down |
| J-turn | reverse fast, full lock, then `W` | pull down, slide over, push up |

Drift: tap the handbrake into a corner (or lift and turn), steer into the slide, hold it with the throttle.
The car does part of the counter-steer for you (more on a phone), holds a slide at a comfortable angle, and
A and D ask for as much lock as the corner ahead needs. Nothing steers the car when no key is held.

J-turn: back up past about 10 mph, throw the wheel to full lock and get on the gas. The nose swings out, the
car comes round to face the way it is travelling and pulls away; the camera looks where you are going while
you reverse and swings round with the car. A clean one scores 500.

## How the world is made

- `game/src/field.js`: the mountain, one smooth height field.
- `game/src/track.js`: the pass, grown feature by feature as a switchback ladder up the field; every candidate
  is tested against the road already laid, and when it runs itself into a corner it backs up and lays the last
  few features again (no dead ends and no overlaps over 12 seeds x 30 km x 3 courses).
- `game/src/ground.js`: the field carved to the road: level under the corridor, cut and fill faces beyond,
  retaining faces between close switchback legs, and a hill over every tunnel. The terrain, every prop and the
  camera ask this one function, so nothing floats and nothing is buried.
- `game/src/terrain.js`: that ground as tiles in three levels of detail, a far mesh to the horizon, the forest.
- `game/src/world.js`: the road chunks chosen by distance from the car, the rails where the ground falls away,
  the lamps, the set pieces, the tunnels (a tiled bore with walkways, sodium lamps every 3 m, cable trays,
  reflectors, exit signs, alarm cabinets, jet fans, and a named portal at each end), the cherry avenues with
  their lantern strings, the great torii, the guide signs and the paint on the road, and every repeated prop as
  one shared instanced pool.
- `game/src/city.js`: NEO TOKYO beside the road: street-front buildings on their lots, neon signs from one atlas
  (`neon.js`), the light they throw on the pavement and the wet road, crossings and signals at the corners, the
  far skyline and Tokyo Tower (`landmarks.js`); `buildings.js` draws every building's windows from world
  position, so a floor is a floor at any size.
- `game/src/fx.js`: skid marks, smoke, spray and sparks, and two GPU showers placed entirely by the vertex shader
  in a box that travels with the camera: cherry petals (pushed aside by the car's wind) and rain (lit where the
  headlights and lamps catch it).

## What is in the repo

| path | what |
|---|---|
| `game/` | the shipped folder: `index.html`, `src/`, `assets/` and the three recipe files (`assetlib.js`, `surfaces.js`, `rig.js`) copied in as the recipe asks |
| `game/assets/*.js` | twenty-two code assets, one module each, with `*.expect.json` sizes beside them |
| `STYLE_LOCK.md` | the locked style every asset agent was handed |
| `work/BRIEFS.md` | the form briefs the assets were written from (there were no reference images; this text was the reference) |
| `work/cands/` | every candidate that was written, the verifier sheets, and a `NOTES.md` per object saying which won and what was thrown away |
| `work/sim.mjs` | the physics sim the drift model was tuned with, before anyone drove it |
| `work/track_test.mjs`, `work/tile_test.mjs` | the generator and terrain checks (overlaps, dead ends, ground above the road) |
| `work/city_track_test.mjs` | the same checks for the NEO TOKYO layouts |
| `work/jturn_test.mjs`, `work/reverse_test.mjs` | the J-turn and reversing, simulated |
| `work/jitter.mjs`, `work/shot.mjs` | a frame-time and on-screen jitter probe, and scripted screenshots |
| `gate/drift-gate.mjs` | the gate this game needs: real keys or real touches, steers by telemetry, handbrakes into corners, asserts drifts were banked, writes a filmstrip |
| `NOTES.md` | the build log: what was measured, what was rejected, what is still wrong |

## Running it locally

```
git clone https://github.com/404-Repo/404-game-recipe && cd 404-game-recipe && npm install
node harness/serve.mjs ../sundrift/game        # then open the URL it prints
node ../sundrift/gate/drift-gate.mjs ../sundrift/game --recipe=.           # desktop gate
node ../sundrift/gate/drift-gate.mjs ../sundrift/game --recipe=. --phone   # phone gate, real touches
node ../sundrift/gate/drift-gate.mjs ../sundrift/game --recipe=. --city    # on NEO TOKYO (add --rain for a downpour)
```

## The one hard rule

Every 3D object is Three.js code from constructors and operations. The road, terrain, guardrail beam and
tunnels (bore, fittings and portals) are built procedurally in `game/src/`; the car and every other placed or
instanced object is a module under `game/assets/` written through the recipe loop. `harness/ship.mjs` from the recipe flags nothing in this folder.

## Credits

Method and harness: [404](https://404.xyz), Apache 2.0. Three.js. Fonts: Racing Sans One, Rajdhani and Share
Tech Mono, with Dela Gothic One, Noto Serif JP and M PLUS Rounded 1c for the Japanese, fetched as subsets of only
the characters the game draws (Google Fonts, the only non-code files the page loads besides Three.js). Built
with Claude Code.
