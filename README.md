# MINIDRIFT

Endless night drifting in Japan, on two maps: a mountain pass in cherry-blossom season (夜桜峠, Yozakura Pass)
or the rain-slick neon streets of NEO TOKYO (ネオ東京). Chain drifts to bank score and boost, clip the guardrail
without touching it, and every banked drift pushes the night toward dawn. Where there is no guardrail the car can
leave the road: take out the bollards, the lamp posts and the signs, flatten the bushes, and get back on within
five seconds, or a giant magnet comes down and carries you back.

**The look:** a playable 90s drift anime.
- **The pass.** Cherry trees in blossom line the road and dot the cedar forest, and petals drift on the air and
  lie on the asphalt. Red paper lanterns are strung along the cherry avenues. A great vermilion torii spans the
  road at every shrine, with jizo in red bibs beside the path. Blue guide signs carry kanji. Fuji stands under
  the moon across the valley. The pass also has sodium lamps, slope lattices and tunnels through the spurs.
  Grass and spring flowers tuft the verges, and a five-storey pagoda stands at every shrine, lanterns glowing
  under its eaves. At night and at dawn the nearer valleys below the road lie under a sea of cloud (unkai), silver
  under the moon and rose at dawn; by day it has burned off. Fireflies pulse over the verges, thin cloud drifts across the stars,
  now and then a shooting star falls, and the moon (or a low sun) throws shafts of light through the trees.
- **The city.** Grimy street fronts line the road, with rain streaks, roller shutters, air conditioners, fire
  escapes, laundry and roof tanks. Behind every lit window there is a room: shelves in the convenience stores,
  counters and stools in the eateries, arcades, bars, offices, flats and tatami rooms, some dark but for the flicker
  of a TV. Animated LED screens and tickers hang on the fronts and stand on the roofs, concrete poles carry sagging
  power and telecom lines across the streets, a lit arch and strings of red lanterns mark a shopping street, glass
  skybridges cross between towers, a commuter train rolls along an elevated line with shops in its arches, coin
  parkings sit between the buildings, and Tokyo Skytree stands lit on the skyline beside Tokyo Tower. Stacked neon signs hang over the street, and their light lies on the pavement
  and streaks across the wet asphalt. The corners are square, with crossings and signals. Now and then the road
  climbs onto an elevated expressway (the Shuto) and weaves between the towers on banked bends, and Tokyo Tower
  glows orange on the skyline. The sky over it all is the city's own light thrown back by the haze, magenta and
  sodium, under a low cloud deck lit from beneath; searchlights sweep it from the rooftops, and two holographic koi,
  a red-and-white and a gold, swim slow circles over the street ahead.
- **Weather and time.** Rain comes and goes: the sky clouds over, the road turns glossy, and the lamps and signs
  streak across it. Drops ring the asphalt ahead of the car, the rain rakes back past the camera at speed, a
  curtain of it falls further off, the headlights' beams show in it, beads gather and run down the tube's glass,
  and the car's paint goes glossy. In a heavy storm lightning strikes on the horizon ahead, the sky and the haze
  flare, and the thunder rolls in after it. The time of day moves smoothly from night through dawn and day to dusk and back.
- **The music** is in the manner of an open-world game's soundtrack, slow and airy with no drums: a soft felt
  piano in D over warm analog pads on the pass (a koto figure now and then), an 80s FM electric piano in A flat
  in the city, all of it through a little old tape (a slow wow, a low-pass, a long reverb). A pulse-wave 8-bit
  arpeggio comes up under it while a drift is held. Each song is a sixteen-bar form of four-bar phrases, and each
  phrase picks one of its tunes or leaves the chords alone, so it never plays the same way twice.
- **The frame.** It is drawn as cel bands with ink outlines, halftone shade and scanlines, with a camera motion blur
  (the world streaks as the lens swings through a drift; the car stays sharp), then shown on a curved CRT whose
  picture bends at the edges and rounds into the corners, in a 90s console's dithered colour.
- **The dash** is a 90s tuner's: a tach with a redline, amber seven-segment mph and score.
- **The car.** Held in a drift, its tail lamps leave thin red light trails hanging in the air behind it, the way a
  drift anime draws a slide at night; the lamps burn brighter on the brakes. The engine is an inline four built
  from its firing pulses (see below), the revs flare as the rear tyres spin up in a slide, it cuts for a moment on
  every upshift and bounces off the limiter, and on a lift from high revs the exhaust pops and spits flame.

**Play:** https://lkruer.github.io/sundrift/game/ (phone or laptop; one finger on a phone, WASD and Space on a
keyboard). Pick a course and a paint on the title screen, or just press START.

Built for the [404 game jam 001](https://github.com/404-Repo/404-game-jam) with the
[404 game recipe](https://github.com/404-Repo/404-game-recipe): every 3D object in the game is Three.js code.
The car and the props came through the recipe's loop (a written form brief, three independent candidates per
object, a four-sided verify render, a choice made by eye); the road, terrain, rails and tunnels are built
procedurally. There is not one mesh file, texture file or audio file in the shipped folder. The road
markings, the ground grain, the slope lattice, the tunnel tiles, the particle sprite and every sound are made
at load time.

## How it was made (the receipts)

- **Who and what.** One person (lkruer) directing Claude Code, from 22 to 25 September 2026 (UTC). The code, the
  assets and the critic rounds were written by Claude Fable 5.1 and then Claude Opus 5.5, with sub-agents for the
  asset loop, the critic rounds and the late QA passes (each commit names its model). No image or audio model: the
  folder has no image or sound files at all.
- **The history is the work.** Every round is a commit, and [NOTES.md](NOTES.md) is the log of each one, newest
  first: what the owner asked for, what was measured, what was changed and what was rejected, with the numbers.
- **Gate runs.** The jam gate (`harness/jam.mjs`, phone, 4G, CPU slowed 2x) against the live URL, and this game's
  own gate (`gate/drift-gate.mjs`: real keys or real touches, steering by telemetry, asserting that drifts were
  banked), run on both maps, desktop and phone, before every push; each round's numbers are in NOTES.md.
- **What was thrown away,** each with its reason in NOTES.md: the first plan (an autumn pass at golden hour) for a
  night touge in cherry-blossom season; the first name (SUNDRIFT); the first hero car, and the losing candidates of
  every asset (`work/cands/`); the MEDIUM course; a counter-steer assist that overrode the player's key; a reversing
  aid that stopped a sliding car dead; a drift that unwound on its own after a second and a half (a slide now holds
  for as long as it is held); rain drawn as added light, which glowed white by day; a DOM countdown panel that
  stalled the compositor (it is a canvas now); and the 20:36 start (runs now begin at dusk, so the first drifts
  visibly carry the sky into the night).

## Courses

The difference between them is the road.

| pass | road | road edge to road edge | corners |
|---|---|---|---|
| EASY | 10.8 m of asphalt | 14.6 m | long legs, wide switchbacks, flowing sweepers |
| HARD | 8.6 m | 11.6 m | short legs, tight hairpins, relentless |

| NEO TOKYO | road | road edge to road edge | corners |
|---|---|---|---|
| EASY | 12.0 m | 16.4 m | broad avenues, wide square corners, the expressway |
| HARD | 9.6 m | 13.4 m | tight back streets, the expressway |

In the city the same generator lays its switchbacks flat: a leg is an avenue, a switchback is the way round a
block (two square corners with the block between), and an S-bend is a dog-leg onto a cross street and back.

The gravel between the edge line and the road's edge keeps most of its grip: running wide costs a little, not
the run. Past the edge the pass has a guardrail only where the ground falls away or on the outside of a tight
bend; everywhere else (about two thirds of it) the car can drive off onto the verge, up a bank, into a field, and
over a crest at speed it leaves the ground. Trunks, boulders, huts and shrines stop it. In the city the street
fronts are the edge, so the car can mount the pavement.

Each is one fixed, endless course (same seed every run), so best scores compare.

## Controls

| | keyboard | phone |
|---|---|---|
| start | `Enter`, or the START button | tap START |
| drive / brake | `W` / `S` | hold the left half of the screen |
| steer | `A` / `D` | slide the finger left or right |
| handbrake | `Space` | hold the right half of the screen |
| pause | `Esc` or `P` | the pause button |
| camera zoom | mouse wheel, `+` / `-` | |
| orbit the camera | hold either mouse button and drag (let go: back to the chase view) | |
| mute | `M` | the note button |
| reverse | hold `S` when stopped (a strong gear, to about 40 mph) | pull the finger down |
| J-turn | reverse straight and fast, let go of `S`, then full lock (held) and `W` | pull down, then push up and slide over |

The keys follow what is printed on them, so on an AZERTY or a QWERTZ keyboard W, A, S and D are where the keyboard
says (the arrow keys work too).

Drift: tap the handbrake into a corner (or lift off and turn in, or flick the wheel the other way first, or just
push a fast corner on the throttle) and keep the key held into the turn: the slide holds for as long as you hold it,
at the angle your hands ask for. The throttle sets how deep (lift and it tightens up), the key held into the turn
opens it, a tap the other way closes it, the handbrake throws it wide; let go of the key and the car comes straight
and pulls away. Throw the key the other way mid-slide and the car swings through into a drift the other way. A held
slide carries its speed. The car does part of the counter-steer for you (more on a phone), and
A and D ask for as much lock as the corner ahead needs. Nothing steers the car when no key is held, and the help
never overrides you: steer into the turn and the wheels go where you steer, the counter-steer stepping aside as
the key goes down. In a tight
bend (a hairpin, a square corner) a slide that is held gets a hand on the line: where the sliding tyres fall
short of the bend, the car is helped round the rest of the way and a slide too fast for the bend sheds a little
speed, so a held drift makes the corner. Tight corners are also wider on their outside.

Power: floor it and the rear tyres break loose, out of a slide or from a standstill: hold full lock and the throttle
at low speed and the car spins donuts on the spot for as long as you hold them. Boost is earned by a drift and
comes the moment the slide ends; a pull on the handbrake cancels it, to set up the next corner without it.

Off the road: a countdown comes up under the score. Get back on the road before it runs out; at zero a big red
horseshoe magnet swoops down, the car clanks onto it, and it is carried back to where it left the road and set
down facing the right way. Knocking things over scores (a bollard 50, a sign 90, a lamp post 150, a vending machine
300, chained within two seconds for up to five times as much). A lamp you knock down goes out. In the city the
pavement's clutter goes flying too: trash bags and boxes (TRASH!), beer crates, traffic cones, menu boards and
parked bicycles, each with its own burst and sound.

J-turn: back up straight past about 10 mph, let go of the reverse, throw the wheel to full lock, hold it, and get on
the gas. The nose swings out, the car comes round to face the way it is travelling and pulls away; the camera looks
where you are going while you reverse and swings round with the car. A clean one scores 500. It takes that: back
up round something with the wheel turned and let go of `S`, and the car just rolls to a stop following its wheels;
a quick tap on the wheel is only ever a correction. Whatever you press, the car never stops dead: a slide or a spin
is always slowed by its tyres, even when it is going a little backwards (braking on `S` in a slide, or a spin
passing 90 degrees).

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
  their lantern strings, the great torii, the guide signs and the paint on the road, the yellow warning diamonds
  before the hairpins and cuttings, a wayside shrine (a small torii, a lit stone lantern, two jizo) every kilometre
  or so and lit vending machines in the long stretches between the set pieces, and every repeated prop as one shared
  instanced pool.
- `game/src/city.js`: NEO TOKYO beside the road: street-front buildings on their lots, neon signs from one atlas
  (`neon.js`), the light they throw on the pavement and the wet road, crossings and signals at the corners, the
  far skyline with Tokyo Tower and the Skytree (`landmarks.js`); `buildings.js` draws every building's windows
  from world position, so a floor is a floor at any size, and behind each lit one a room from `rooms.js` (an atlas
  of interiors drawn at load, looked into with a parallax so the room has depth). `citydetail.js`: the LED screens
  (one ad atlas, animated in the shader), the overhead wires and their poles, the shopping arches and lantern
  strings, the skybridges, the pavement's paving. `citytrain.js`: the elevated line, its stations and its train.
  `citycars.js`: the coin parkings' cars. `citysteam.js`: steam out of the manholes in the road, the kitchens'
  vents and the tall roofs, lit by the light nearest it. `citypeople.js`: people where a car cannot reach them, at
  the mouths of the alleys and in the coin parkings, umbrellas up in the rain (and in the rooms' atlas, customers
  at the counters, shoppers, players at the machines, someone working late). A few neon tubes are failing and
  stutter, a few signs blink, the signals cycle green, amber, red (with the walkers' own signals, the green man
  blinking before it ends), and an airship with an LED screen along its flanks drifts over the skyline. Blue
  direction boards hang over the corners, stop lines and diamonds mark the crossings, towers stand back on podiums
  of shops with their crowns lit at night, a building site has its floodlit tower crane, the stations their name
  boards, the Shuto its amber delineators.
- `game/src/offroad.js`: the countdown panel and the magnet (its swoop, the flight, the drop, every beat of it).
- `game/src/atmos.js`: the air: the cloud deck (moonlit wisps on the pass, lit from beneath over the city), the
  searchlights, the holographic koi, the fireflies, the shooting stars, and lightning with its bolt. The sea of
  cloud and the light shafts are drawn by the cel pass in `post.js`, from the depth buffer.
- `game/src/debris.js`: what the car knocks over, as rigid bodies for a few seconds: the prop's own model and
  materials, a box of corners bouncing and sliding on the ground with restitution and friction, spun from where
  it was struck; bushes are flattened in place instead.
- `game/src/fx.js`: skid marks, smoke, spray and sparks, and two GPU showers placed entirely by the vertex shader
  in a box that travels with the camera: cherry petals (pushed aside by the car's wind) and rain (lit where the
  headlights and lamps catch it); the rain's splashes on the road, its curtain further off, and the headlights'
  beams in it. The drops on the lens are drawn by the tube pass in `post.js`.
- `game/src/audio.js`: every sound, synthesised. The engine is an AudioWorklet (its code a string, loaded from a
  blob) that fires an inline four's pressure pulses, each a little different and the four cylinders never quite
  equal, into the exhaust's fixed resonances, so the harmonics sweep through the formants as the revs climb, the
  way a real engine sounds and a bank of oscillators does not; around it the intake roar, the straight-cut gears'
  whine, the turbo's whistle and its flutter on a lift, tyres that squeal in narrow wandering bands over the
  tread's scrub; and the music. In NEO TOKYO, under it all and heard from the camera: the far city's roar, a car or
  a bus going by on the next street, horns now and then, an ambulance passing, the elevated train with its wheels
  clacking over the rail joints in time with the train you see, and the crossings' bird-call chirps (piyo or the
  cuckoo's kak-koo) while the walkers have green, with a short street echo off the fronts.

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
| `work/feel_test.mjs`, `work/steer_test.mjs`, `work/power_test.mjs` | the drift's feel by numbers (entries, the held angle, speed kept, switchbacks), the wheel against the key, donuts |
| `work/stop_hunt.mjs`, `work/reverse_release_test.mjs`, `work/unstick_test.mjs` | 600 runs of random keys hunting for the car stopping dead; letting go of reverse; getting off a wall |
| `work/hairpin_test.json`, `work/corner_city.json`, `work/gatebot_phone.json` | in the game: hairpins and square corners taken sideways by an autopilot; the jam gate's phone driver replayed |
| `work/pass_qa/`, `work/city_qa_audit.json`, `work/city_qa_measure.json` | the maps' placement audits (floating props, things inside buildings, full pools) and draw and triangle tours |
| `work/qa_*.mjs` | a judge's half hour, scripted: long autopilot sessions sampling memory, GPU textures, programs and frame times; the sky-rebuild leak test; every flow (pause, restart, map switches, the phone) |
| `work/perf/`, `work/boot_probe.mjs` | the phone performance probes (JS per frame under CPU throttling, CPU profiles, a pixel A/B that proves a change invisible) and where the load time goes under the jam gate's 4G |
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
