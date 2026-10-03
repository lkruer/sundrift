# SUNDRIFT: a harsh critique (3 October 2026)

Asked for: "add detail to everything, make everything look better, lower glare from sun, make environment more detailed.
do a harsh self critique of EVERYTHING".

This is the critique, written against what the game looked like at the start of the round (`2cbb7b9`, live) and kept
honest after the fixes: what was wrong, what this round did about it, and what is still wrong. Every claim comes from a
screenshot or a measurement. The tools are listed at the end.

## Verdict, in one paragraph

From the chase camera at golden hour SUNDRIFT looks like the game it wants to be. Step off that camera and the illusion
thins. From any height the pass was an empty lime-green lawn with copy-pasted pine cones on it. The road was a clean
grey ribbon nobody had ever driven on. A low sun blew a white hole in the picture. The smoke, the genre's signature, was
a faint orange wisp. Fuji stood cold and grey in a golden sky. On the title screen a torii leg stood in the middle of
the hero shot. The city at night was black slabs with windows in them. The car is a faceted box with dots on it.

Most of that is fixed or improved this round. What is left is listed under **Still wrong**, and it is not short.

## Light, sky and the sun

| Problem | Severity | Status |
|---|---|---|
| **Sun glare.** The sun's disc was drawn at the key light's full strength (13 at golden hour), so the bloom spread it over a quarter of the sky. The light shafts reached across the whole frame and laid a bright veil over it. Cumulus near the sun had colours whose inverse tone curve came out at 14.7 for pure white, so they bloomed into blobs. Daytime bloom was as strong as dusk's. | major | **fixed**. Highlights roll off in the cel pass before the bloom. The disc is at half the key, never above 5. The shafts are gentler and stay close to the sun. Cloud colours are capped. Daytime bloom is 0.16 to 0.2. |
| **The boost flame lit the road.** By day it put a blazing yellow pool behind the car that read as a hole burnt in the picture. | major | **fixed** (dimmed to a fifth by day) |
| **A pale ghost ellipse on dry asphalt** under any lamp or headlight, in tunnels above all, and at sunrise. | major | **fixed**. Dry-road highlights are at a third; wet roads bring them back to full. |
| **Street lamps were on at sunrise** (at 30% of the night), lighting pools on a sunlit road. | minor | **fixed**. The lamps follow their own curve: on in the blue hour, off by sunrise. |
| **Fuji stayed cold and grey at golden hour.** | minor | **fixed**. Alpenglow: rose-gold snow when the sun is low, lilac just after it sets. |
| **Car parks were glossy enough to mirror a low sun.** | minor | **fixed** (matte, capped) |
| **Ink lines were full black at every distance**, so a far forest was a black scribble across the hills. | major | **fixed** (fades to 38% by 700 m) |

## The pass (YOZAKURA)

| Problem | Severity | Status |
|---|---|---|
| **The ground was one lime-green colour** with tan smudges on every hill. The smudges were the petal carpet's noise read as dirt. | critical | **improved**. The ground shader adds a lush and pale patchwork, straw drifts, earth bands on steep slopes, and drifts of small flowers up close. (The petal carpets went to the scenery round; see the merge notes.) |
| **The slope lattice was one tile on a smooth hill**: a grid painted on, the same square repeated a thousand times. | major | **fixed**. A 2 x 2 block of different pockets (grass, a slumped scar, moss and a fern, flowering weeds). Drain holes and stains, grass over the beams. The beams stand proud in the lighting and the ink. |
| **The road had never been driven on.** | major | **fixed**. Sealed cracks, an oil line in each lane, fresh and bleached patches with seams, worn paint, stones and grass at the shoulder edge. A weathered yellow centre line, the way Japanese mountain roads are marked. |
| **Forests were identical cones** evenly scattered on bare grass. No undergrowth, no edges, one shade of green. | critical | see "The scenery round" |
| **The valley floor was empty**: no farms, fields, paddies, houses or paths. Nothing gave scale. | critical | see "The scenery round" |
| **One shrub was a jarring magenta blob.** | minor | see "The scenery round" |
| **On the title screen, a great torii leg stood through the middle of the hero shot**: a shrine just past the start puts a torii over the waiting car. | major | **fixed**. It is hidden while the title is up. |

## The car, the smoke, the effects

| Problem | Severity | Status |
|---|---|---|
| **Tyre smoke**, the drift genre's signature, was a faint wisp in the sun's colour: an orange smear even at 34°. | critical | **fixed**. White, tinted by the light, billowing into a cloud that hangs behind a deep, fast slide. |
| **The car** is a faceted box with small dark dots across the body that read as rivets or dirt. No panel lines, mirror detail or brake detail; the lamps are flat. | major | see "The city and the car round" |

## Menus, HUD, first impression

| Problem | Severity | Status |
|---|---|---|
| **On a desktop, the first-run hint sat across the car's tail.** | major | **fixed**. It sits under the score, and steps aside for the off-road countdown. |
| **The loading screen cut straight to the title.** | polish | **fixed**. The set comes on: the picture opens out of a bright line, and quicker when the channel changes to the other map. |
| **Tunnels, dawn, the blue hour**: checked, and the ghost ellipse was the only fault found. | | |

## Still wrong (an honest list)

(filled in at the end of the round)

## Tools

- `work/mk_critique.mjs`: a course seen four ways at each place (chase, roadside, high, road level), at any hour.
- `work/mk_skycheck.mjs`: the camera toward the live sun, away and to the side.
- `work/mk_tour.mjs`: a run with the autopilot, a shot at each hour.
- `work/mk_sunroad.mjs`: the stretches that head into the sun.
- `work/sheet.py`: contact sheets.
- `work/shot.mjs --noready`: the loading screen.
