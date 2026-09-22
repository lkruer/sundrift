# Critic round 1: night phase, drift gate, 8 frames vs 9 night photographs

Materials: `frames/f0..f7.png` (1280x720), `refs/night/*.jpg`. Pairs built with `harness/pairs.mjs`
into `pairs/` (KEY.json never opened). Measurements: `measure/measure.py`, `measure/measure2.py`,
outputs in `measure/measure.txt`, `measure/measure2.txt`. Zoom sheets: `zoom_A_hero.png`
(car region, 50 px grid), `zoom_B_details.png` (lamps, road surface, sphere, dots, sky).

Caveat on blindness, stated before the table: every game frame carries the HUD (COMBO, SCORE,
speedometer), so the pairs are blind about quality but never about identity. The pairs tool also
leaks the aspect ratio (divider at x=960 when the 16:9 frame is on the left, x=924 when it is on
the right). I judged on picture content only. Next round: capture the critic frames without the
HUD and letterbox both sides to one frame.

## Blind pairs

| pair | winner | margin | the tell that decided it |
|---|---|---|---|
| 01 | right | decisive | Right: one sodium lamp owns the road and the trees fall to black. Left: every canopy lit in daylight red/orange/yellow under a starry sky. |
| 02 | left | decisive | Left: asphalt is one deep-orange pool that dies into black on both verges. Right: road is the same grey from bumper to horizon and the verges are lit like noon. |
| 03 | left | decisive | Right's street lamp is a checkerboard blob of 16 squares; left's is one soft flare with real fall-off. |
| 04 | left | clear | Right has drift angle, smoke and skid marks (the game's liveliest frame), but the dirt bank behind the car is floodlit ochre with no source anywhere; left's grass shows a lit strip and then nothing. |
| 05 | right | decisive | Left: car jammed nose-first into a guardrail under a giant noon-lit red canopy, pixel-grid lamp. Right: nearly black, one warm pool, a lit house window. |
| 06 | left | clear | Right is the game's best frame (hairpin, marker posts, glowing tail lights, warm lamp halo), but the road is flat grey with no sheen and the trees are noon-lit; the left's pool-into-black is exactly what it lacks. |
| 07 | right | decisive | Left: translucent dots floating in the foreground and a checkerboard lamp. Right: red-orange road under one lamp against a cool sky, a single coherent light decision. |
| 08 | right | decisive | Left: car on a dirt bank with a large translucent grey sphere sitting on the road. Right: a receding chain of lamp pools with black trees between them, depth made by light. |

Game wins: **0 of 8**. Losses scored: 6 decisive, 2 clear (pairs 04 and 06).

Guess of the game side, made after judging: left in 01, 05, 07, 08; right in 02, 03, 04, 06.
Tells: HUD; low-poly canopies at daylight saturation; the cream hero car; the grid lamp glare;
uniform grey asphalt. Confirmed afterwards by pixel-matching f0..f7 against the pair halves
(`measure/match.txt`: f0..f7 = pairs 01..08 in order), not by reading KEY.json.

## Claims

Numbers are on frames resampled to 1280 wide, bands inside the frame (HUD excluded). "refs" = the
nine night photographs.

| claim | result | evidence |
|---|---|---|
| N1 one pool owns the frame | **FAIL** (metric rejected) | The claim's own number, p95(road) / median(road 40 m), passes only 1 of 9 photographs (1.0 to 7.2; game 0.8 to 8.5, 2 of 8 pass): the "40 m" band lands inside the lamp pool in the photos and inside the headlight disc in the game, so it measures nothing. What does separate: verge band median luma game 62 to 87 in 7 of 8 frames vs refs 9 to 56 in 9 of 9; tree-band mean chroma game 25 to 83 in 8 of 8 vs refs 5 to 12 in 7 of 9 (the photos' far trees are grey-black silhouettes, the game's are coloured canopies); fraction of inner frame below luma 25: game median 17%, refs median 31%. The dark part does show shape (hill layers, tree outlines), so it is not the black-frame gaming case; it is the opposite failure. |
| N2 sky is a gradient | **PASS** | Column at x=0.62, f1: luma 34, 40, 43, 45, 47, 45, 49, 52 from y=0.02 to 0.30, max step 4, B-R falls from +18 at the zenith to +8 at the horizon (warmer); 54 to 272 star specks per frame; a lighter violet band at the horizon. The one thing in the frame that reads as a night sky. |
| N3 two colour temperatures | **PARTIAL** (metric rejected as a gate) | The number passes: brightest 5% of road B-R -50 to -72 in 7 of 8 frames, sky +10 to +17. But the asphalt away from the headlights is near-neutral, B-R -10 to -34 in 6 of 8, against -42 to -140 on the photos; the "warm surround" (B-R -27 to -61) is orange and red foliage albedo, not warm light. Any frame with a blue sky and a yellow headlight passes this metric; measure B-R on the road only, near vs far, and require the far road to go dark. |
| N4 the road has sheen | **FAIL** | Eye, `zoom_B_details.png`: asphalt is a matte grain; the only bright patch on the road is the headlight disc ahead of the car; no stretched highlight under any of the three visible lamps, nothing to move with the camera. |
| N5 light sources glow | **FAIL** | Lamp glare is a 4x4 grid of bright squares (three lamps zoomed, all the same), which is precisely a painted disc rather than a source; tail lights have a faint halo (acceptable); diffuse surfaces do not bloom (good). |
| 6 hero big and glossy | **FAIL** | Car height / frame height from the grid sheet: 0.13, 0.13, 0.12, 0.11 in the four frames at speed (f0 to f3); 0.28, 0.23, 0.23, 0.23 only in the four stalled frames where the camera is pushed in. Paint is matte cream, no sky or lamp reflection, windows black, no driver readable. |
| 7 speed is visible | **FAIL** | Only f3 shows angle, smoke and skid marks. Speedometer across the eight: 72, 105, 111, 104, 25, 40, 20, 31; the last four are a crawl (f4 nose into the guardrail, f7 on the dirt bank). No edge blur anywhere. Half the "frames in motion" are a stopped car. |
| 8 retro, not rough | **PARTIAL** | Shapes are clean and few-faceted, colours flat, edges crisp: yes. Against it: the grid lamp glare; large translucent grey icospheres resting on the road in f4 and f7 (smoke puffs at rest); pale floating dots in f6; asphalt grain at 2x; a scanline overlay over the whole frame, sky included. |

## Verdict

**RESULT: FAIL.** 0 of 8 pairs, six of them decisive. Both clear losses (04, 06) are the frames
where the game showed motion or a lamp halo, which says where the ceiling is.

**THE ONE PROPERTY:** the night ambient. The verges, banks and canopies are lit to daylight luma
and full chroma everywhere in the frame, so no lamp pool or headlight ever owns it; the frame is a
noon scene under a night sky.

Checkable moves:
1. Cut the night fill (hemisphere/ambient) until the verge band (x 0.02 to 0.20 and 0.80 to 0.98,
   y 0.50 to 0.75) has median luma at or below 40 outside a pool (now 62 to 87; photos 9 to 56).
2. Make the lamps the light: one warm point or spot per lamp with real fall-off, a pool about 15
   to 20 m across on road and verge, B-R at or below -60 inside it, so the brightest road pixels sit
   under a lamp and not in the headlight disc.
3. Foliage more than one pool away renders as near-black silhouette against the sky: tree band
   (x 0.02 to 0.25 and 0.75 to 0.98, y 0.15 to 0.45) mean chroma under 15 (now 25 to 83; photos
   5 to 12), outline kept so the dark part still shows shape. Leave the sky alone; it passes.

Next three, in order:
1. Light artefacts: replace the 4x4-grid lamp glare with a smooth radial glow; cull or fade the
   translucent grey smoke spheres when the car is slow; drop the floating dots. (N5, claim 8)
2. Hero: bring the chase camera in and down so the car spans 0.25 to 0.30 of the frame height at
   speed (now 0.11 to 0.13); give the paint a sky-gradient plus lamp-highlight reflection and a
   readable driver silhouette; a slightly larger tail-light halo. (claim 6)
3. Road sheen and the gate: a stretched specular streak under each lamp on the asphalt that moves
   with the camera; and fix the capture, since four of eight frames were a stopped or crashed car
   (only capture above a speed floor, or keep the run on the road). (N4, claim 7)
