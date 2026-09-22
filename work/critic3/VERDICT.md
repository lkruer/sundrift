# Critic round 3 — night build, drift gate frames

Fresh critic. Earlier rounds' verdicts not read before this was written.
Pairs: `pairs/pair_01..08.png`, seed 29, eight game frames (`frames/f0..f7.png`, 1280x720) against nine night
references. CONTACT.png came out as a flat black strip and was ignored; every pair was judged from the pair
image itself. KEY.json was not opened; the frame ids below come from an image-diff match of each half against
`frames/` (`measure.py`, MAD 1.5–5.7 on the game side, 31–39 on the photo side).

Standard applied: not "is it photographic" but "does it read as an intentional, finished, art-directed
illustration next to a real night photograph". The HUD gives the game side away in every pair; light, colour,
composition, material and motion were judged regardless.

## Blind pairs

| pair | left | right | winner | margin | the one tell |
|---|---|---|---|---|---|
| 01 | game f0 | photo | photo | clear | In the photo the road *is* the light: a warm sheen fills the lower half. In f0 the pool is a distant ellipse left of a black road and the hero is a flat tan block. |
| 02 | photo | game f1 | photo | clear | f1 is 53% crushed black with a coin-sized pool 40 m out; the photo's sodium wash reaches the camera and its sky is a lit gradient. |
| 03 | photo | game f2 | photo | clear | f2's lamp halo is a pale mauve disc pasted behind the trees; the photo's glow is the lamp's own colour bleeding along the wires and the road. |
| 04 | photo | game f3 | photo | decisive | HUD text sits on top of the car, the smoke is two opaque grey blobs covering the road, the composition collapses. |
| 05 | photo | game f4 | photo | clear | The strongest game frame: the pool finally touches the hero. But tan car on tan pool is one value; the photo's white house, lamp flare and asphalt sheen all separate. |
| 06 | game f5 | photo | photo | slight | f5 has a drift angle, valley lights and a horizon gradient; it loses on the road, a matte black plane against the photo's lit asphalt. |
| 07 | photo | game f6 | photo | slight | Closest call: the photo has an odd red cast. f6's lamp halo is the size of a moon and its pool is a chain of hard-edged ellipses. |
| 08 | game f7 | photo | photo | clear | f7's only light lands on a bank of shrubs left of the road; the road itself is black to the horizon. The photo has four lamps receding and a glowing road. |

**Wins: 0 of 8. Margins: 1 decisive, 5 clear, 2 slight.**

## Claims

Numbers from `measure.py`, `measure2.py`, `measure3.py` (JSON alongside). Reference numbers are the eight
sodium-road photos; the Table Mountain shot is a wide landscape and is quoted separately where it matters.

| claim | result | evidence (one sentence) |
|---|---|---|
| N1 one pool owns the frame | PARTIAL | Brightest 5% of road vs road ~40 m out is 5.5–21x (passes in 7/8; f3 3.7 because smoke is the "pool"), but the gameable failure is exactly what happened: 45–57% of every frame is below luma 6 (refs 12–30%), the unlit road is RGB (8,4,3) and shows no shape. |
| N2 sky is a gradient | PARTIAL | Continuous, but invisible: sky luma runs 26 -> 31 across the visible band (RGB ~ (22,22,30), B-R +8 -> +7); refs run 37 -> 90 and 88 -> 142; stars present (18–57 per frame); a horizon glow exists only where the valley shows (f1, f5 left). |
| N3 two colour temperatures | FAIL | Pools are decisively warm (B-R -62 to -130) but there is no cool surround: dark ground away from lamps is brown-black RGB (28,14,9), B-R -10 to -27; the sky is barely blue at +8. Only the sky-vs-pool pair differs; the moonlit surround the claim describes does not exist. |
| N4 road has sheen | FAIL | Eye check: pools are Lambertian ellipses directly under lamps with jagged horizontal cel streaks, identical in placement relative to the lamp in f0 and f7, no streak toward the camera, unlit asphalt (8,4,3.5) matte. The top-5%-PCA metric was rejected: it measured lane markings and headlight spill, not sheen. |
| N5 light sources glow | PARTIAL | Lamp lenses do bloom and diffuse surfaces do not, but the halo is inconsistent (4 px in f5, 12–32 px in f0/f1/f7, ~100 px pale disc behind the trees in f6) and mauve-grey rather than sodium orange; tail lights do not glow at all (L ~ 100, darker than the paint; ring redness = body redness). |
| 6 hero big and glossy | FAIL | Car height 0.16–0.19 of the frame (f4 0.26, the one slow close-up) against 0.25–0.4; paint is a mid tan (188,123,73)/(166,110,89), L 105–170, the same tone as the pool so the car does not separate from the light; two flat cel bands, no sky or lamp reflection; tail lights are salmon discs darker than the body; the driver is a pale blob through the rear window, not readable. |
| 7 speed is visible | PARTIAL | f3 (smoke, crash) and f5 (drift angle) show motion; f0, f1, f2, f4, f6, f7 read as a parked car: no edge blur, no skid marks, no smoke, and f0 at 0.0 km is literally a standing start. |
| 8 retro not rough | PASS | Clean low-poly silhouettes, crisp wobbly ink, 372–546 quantised colours (refs 543–1800); the 2-px screen tone (period 2.1 px, peak/median 25–29) has ~2 levels of amplitude and reads as tone, not noise. One rough thing: the aliased horizontal streaks at pool edges. |

Value structure, game vs references (the numbers behind the verdict):

| metric | game f0–f7 | refs (8 sodium roads) |
|---|---|---|
| bottom-third median luma | 3–7 (f3 27, f4 24) | 36–103 |
| bottom-third p90 luma | 9–23 (f3 129, f4 112) | 97–146 |
| warm-pool area (L>60, B-R<-30) | 3–7% (f4 18%) | 21–38% |
| frame median luma | 5–7 (f3 14, f4 17) | 30–72 |
| frame p98 luma | 106–159 | 138–175 (Table Mtn 211) |
| crushed (L<6) fraction | 31–57% | 12–30% (Table Mtn 1%) |
| lit-asphalt luma p10–p90 | 77–137 (a 40-level plateau) | continuous falloff to the frame edge |

## RESULT: FAIL

0 of 8 blind pairs. Every loss but one was scored on the same thing.

## THE ONE PROPERTY to change first

**The lamp pool is a small distant decal and the road under the camera and the hero is black: the pool must
own the bottom half of the frame, with continuous falloff, and the hero inside it.**

Checkable suggestions:

1. Put the camera inside the light. Lamp spacing, beam radius or headlight spill such that the bottom third
   of the frame has median luma >= 40 (now 3–7, refs 36–103) and the warm-pool area is >= 20% of the frame
   (now 3–7%, refs 21–38%) for most of a lap, not only in f4-style close-ups.
2. Replace the 40-level plateau with a falloff. Lit asphalt should run from ~30 to ~140 luma over >= 250 px of
   road (four or more cel bands, inverse-square spacing), ending in a soft edge, not a jagged ellipse rim; and
   add a stretched specular streak from the lamp's foot toward the camera (vertical elongation >= 2 in the
   brightest 5% of asphalt) that moves when the camera does.
3. Whatever stays unlit must still show shape and be cool: unlit road and banks at roughly RGB (12,16,30),
   B-R >= +10, luma 12–25 (now brown-black (8,4,3), B-R negative), so the crushed fraction drops under 25%.

## Next three properties, in priority order

2. **The dark remainder and the sky.** The unlit world is warm brown-black and the sky is a flat near-black
   navy (26 -> 31). Make the sky a real gradient (>= 25 luma levels zenith to horizon, warmer and lighter at
   the ridge line) and the moonlit surround cool, so silhouettes read against it (N2, N3).
3. **The hero's own surfaces.** Car at >= 0.28 of frame height in the chase view; paint one step lighter and
   cooler than the pool (a cool sky-reflection band on the roof and boot, a lamp specular that moves); tail
   lights the brightest red in the frame with a 3–4 px halo; a driver silhouette with a readable head and
   shoulders (claim 6).
4. **Motion and glow scale.** Edge blur or speed lines above ~80 km/h, skid marks and smoke under lateral load
   so six of eight frames stop reading as parked (claim 7); one halo rule for all lamps (20–30 px, the
   lamp's own colour, not a 100 px mauve fog disc behind the trees) and reflectors that bloom 2 px (N5).

## Against a first-pass night build

Clearly better than a first pass: this is a finished, coherent illustration style (ink, cel bands, stars, warm
pools, valley lights, a hand-drawn wobble on the outlines) and five of the eight losses are "clear" rather
than "decisive". It still loses every pair, and it loses them on one property, which is what a round should
be spent on.
