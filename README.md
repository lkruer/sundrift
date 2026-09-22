# SUNDRIFT

An endless autumn mountain pass at night, driven sideways under the street lamps. Chain drifts to bank score
and boost, clip the guardrail without touching it, and every banked drift pushes the night toward dawn: the
moonlight, the lamps, the sunrise and the golden hour that follows are driven by how well you drive, and the
whole cycle comes round again.

**The look:** a playable 90s drift anime. Sodium street lamps on a Japanese touge at night, a town of lights in
the valley, and the whole frame rendered as cel bands with ink outlines and halftone shade by one post pass
over the recipe's lighting rig.

**Play:** https://lkruer.github.io/sundrift/game/ (phone or laptop; one finger on a phone, WASD and Space on a keyboard)

Built for the [404 game jam 001](https://github.com/404-Repo/404-game-jam) with the
[404 game recipe](https://github.com/404-Repo/404-game-recipe): every 3D object in the game is Three.js code
generated through the recipe's loop (a written form brief, three independent candidates per object, a
four-sided verify render, a choice made by eye), and there is not one mesh file, texture file or audio file
in the shipped folder. The road markings, the ground grain, the particle sprite and every sound are made at
load time.

## Controls

| | keyboard | phone |
|---|---|---|
| drive / brake | `W` / `S` | hold the left half of the screen |
| steer | `A` / `D` | slide the finger left or right |
| handbrake | `Space` | hold the right half of the screen |
| camera zoom | mouse wheel, `+` / `-` | |
| reverse | hold `S` when stopped | pull the finger down |

Drift: lift or tap the handbrake into a corner, steer into the slide, hold it with the throttle. The car does
part of the counter-steer for you, more on a phone, and with no key held it follows the road; A and D commit
to a corner with as much lock as that corner needs.

## What is in the repo

| path | what |
|---|---|
| `game/` | the shipped folder: `index.html`, `src/`, `assets/` and the three recipe files (`assetlib.js`, `surfaces.js`, `rig.js`) copied in as the recipe asks |
| `game/assets/*.js` | twenty-two code assets, one module each, with `*.expect.json` sizes beside them |
| `STYLE_LOCK.md` | the locked style every asset agent was handed |
| `work/BRIEFS.md` | the form briefs the assets were written from (there were no reference images; this text was the reference) |
| `work/cands/` | every candidate that was written, the verifier sheets, and a `NOTES.md` per object saying which won and what was thrown away |
| `work/sim.mjs` | the physics sim the drift model was tuned with, before anyone drove it |
| `gate/drift-gate.mjs` | the gate this game needs: real keys or real touches, steers by telemetry, handbrakes into corners, asserts drifts were banked, writes a filmstrip |
| `NOTES.md` | the build log: what was measured, what was rejected, what is still wrong |

## Running it locally

```
git clone https://github.com/404-Repo/404-game-recipe && cd 404-game-recipe && npm install
node harness/serve.mjs ../sundrift/game        # then open the URL it prints
node ../sundrift/gate/drift-gate.mjs ../sundrift/game --recipe=.           # desktop gate
node ../sundrift/gate/drift-gate.mjs ../sundrift/game --recipe=. --phone   # phone gate, real touches
```

## The one hard rule

Every 3D object is Three.js code from constructors and operations. The road, terrain, guardrail beam and
tunnel lining are swept along the procedural centreline in `game/src/world.js`; every placed or instanced
object is a module under `game/assets/` written through the recipe loop. `harness/ship.mjs` from the recipe
flags nothing in this folder.

## Credits

Method and harness: [404](https://404.xyz), Apache 2.0. Three.js. Font: Rajdhani (Google Fonts, the only
non-code file the page loads besides Three.js). Built with Claude Code.
