# Critic round two: night phase, eight frames from the drift gate

Fresh critic. Round one's verdict was not read before this was written.

Setup: `pairs.mjs --seed 13` produced eight pairs from f0..f7 against the nine night photographs.
`CONTACT.png` is broken (98 percent of its pixels are at luma 12 or below; a flat dark strip), so the
pairs were checked directly: each pair file is 1928x540 with content on both halves (mean luma 33 to
58 per side). KEY.json was not opened. The game side is obvious in every pair (HUD, car); the quality
judgement below ignores that and asks which side looks like a real, art-directed, made thing.

Frame to pair mapping by pixel match (not from the key): 01=f0, 02=f1, 03=f2, 04=f3, 05=f4, 06=f5,
07=f6, 08=f7. Measurements: `measure.py` (region boxes hand-placed per frame), crops in `crops/`.

## Blind pairs

| pair | winner | margin | the single tell that decided it |
|---|---|---|---|
| 01 (f0) | photo | decisive | The lamp pool is beige warm-white and the unlit ground is warm brown; nothing in the frame is cool except the sky. The photo is one orange pool in a blue-black night. |
| 02 (f1) | photo | decisive | A translucent grey blob floats at the bottom-left and a grey-green dome sits ahead of the car; beyond the headlights the road is a flat dark slab the lamp never reaches. |
| 03 (f2) | photo | decisive | The translucent dome sits on the road between the lamp and the car, and the right-hand hillside is a flat warm-brown plane with no light source. |
| 04 (f3) | photo | decisive | The crash smoke is a neutral light-grey cloud over a third of the frame that takes none of the scene's light (not warm from the lamp, not cool from the sky), with score text through it. |
| 05 (f4) | photo | decisive | The bank at the right measures luma 125 with no lamp over it, the same brightness as the pool; the photo's lawn goes black three metres from its pool. |
| 06 (f5) | photo | clear | The game's best frame: real drift angle, skid marks, the car a quarter of the frame. Loses on the dome in the centre of the frame and a golden tree at the left lit from nowhere. |
| 07 (f6) | photo | clear | The ugliest photo (heavy red cast) still wins: the game's right shoulder is a bright flat cream slab (luma 104, no lamp) competing with the pool. |
| 08 (f7) | photo | decisive | The photo's chain of lamps makes pools that shrink and dim with distance; the game's lamps light the bank and the trees but barely the road under them. |

Game wins: 0 of 8. Losses: 6 decisive, 2 clear, 0 slight.

## Claims

Measured on the frames (luma 0 to 255; B-R = blue minus red, sRGB). Reference photographs measured the
same way with rough relative boxes for calibration.

| claim | result | evidence |
|---|---|---|
| N1 one pool owns the frame | PARTIAL | Pool p95 / road-40 m ratio is 1.4, 3.7, 5.0, 3.9, 2.0, 1.5, 2.4, 9.1 (f0..f7): at least 4 in 2 of 8. The number measures the wrong thing: on a lamp-lined road the road 40 m on is under the next lamp, and the reference photos themselves score 0.7 to 1.6. Measured against the intent (off-road surround), the far trees do fall to luma 15 to 48 with shape, but unlit verges and banks sit at 30 to 125 (f4 125, f6 104) and the whole dark part is warm brown, so the pool does not own anything. |
| N2 sky is a gradient | PASS | Clean sky columns (f0, f1, f3, f7): luma rises monotonically from 33 to 42 at the top to 48 to 63 at the horizon with no 8-row step above 1.8; B-R falls from +14 to +18 at the top to +2 to +11 at the horizon (warmer low); stars visible. Continuous, not banded. |
| N3 two colour temperatures | FAIL | Pools pass the number (B-R -42 to -68 on the pool box; -61 to -108 on the brightest 5 percent), but they are beige: G/R 0.89 to 0.93 against the photos' 0.66 to 0.77 sodium orange. The surround fails outright: unlit asphalt (grey albedo, so it shows the ambient colour) is RGB about (28,18,11) to (49,39,33), B-R -11 to -24 in every frame; verges -26 to -108; far trees -41 to -86. Only the sky is cool. The claim's threshold of -40 admits warm-white; it should also bound G/R. |
| N4 road has sheen | PASS | A stretched warm highlight runs from under each lamp toward the camera (f0 under the lamp at x 380-490, f6 at x 720-830, f7 at x 420-560) and stays under the lamp as the camera moves. Caveat: it is a wide soft beige smear of the same colour as the headlight pool, so lamp and headlights read as one light. |
| N5 light sources glow | PARTIAL | Lamp lenses have a small soft halo and read as sources. Tail lights are flat red discs with no halo (crop f5_taillights). The headlight glow volume is a flat translucent grey dome about 150 px across with a hard silhouette floating ahead of the car in every frame (crops f0_ball_car, f5_lamp_ball, f6_ball); diffuse surfaces do not bloom. |
| 6 hero big and glossy | FAIL | Car height hand-read from the frames: 0.20, 0.16, 0.18, 0.28, 0.24, 0.26, 0.19, 0.20 of frame height; 2 of 8 reach 0.25. Body is a flat tan (about 184,145,86) with no sky or lamp reflection; tail lights do not glow; the driver is a dark blob under the roll cage, barely readable. |
| 7 speed is visible | PARTIAL | Drift angle in f2, f5, f6; skid marks behind the car in f5, f6, f7; smoke in f3 and a puff in f6; no blur at the frame edges anywhere (lane lines are pixel-crisp in the corners). |
| 8 retro, not rough | PARTIAL | Geometry and colours are clean low-poly. But a scanline post-effect covers everything: adjacent-row luma difference is 2.5 to 5 times the adjacent-column difference in sky and road boxes (f0 sky 2.24 vs 0.88, f7 sky 2.46 vs 0.50) and turns the flat car body into corduroy (crop f0_body_texture); the road carries a mottled noise grain (crop f0_road_grain); the grey dome is noise of another kind. |

## RESULT: FAIL

0 of 8 pairs, N3 fails, N1 and N5 partial, the hero claim fails.

## THE ONE PROPERTY

The ground has one colour temperature: the lamp pool is beige warm-white and everything unlit is warm
brown at up to half the pool's brightness, so there is no cool dark for a pool of light to own.

Checkable suggestions:

1. Make the fill light cool and weak. The unlit asphalt (road away from any lamp) should measure
   luma at most 30 and B-R between +8 and +25 (now 14 to 49 and -11 to -24). Unlit verges and banks
   should measure luma at most 30 and B-R at least 0 (now 30 to 125 and -26 to -108). That is an
   ambient or moon colour near (40,55,90) at low intensity, and no warm directional light at night.
2. Make the lamp sodium. The brightest 5 percent of a pool should sit near RGB (225,155,80), G/R
   about 0.70, B-R at most -120 (now (210-230, 185-210, 140-155), G/R 0.9, B-R -61 to -108). Leave
   the headlights warm-white so the two sources read as different lights on the same road.
3. Let foliage lose its hue with the light. A red or gold tree 30 m from any lamp should read as a
   near-black cool silhouette (tree-band B-R at least -10; now -41 to -86); only trees inside a pool
   keep their colour.

## Next three, in priority order

2. The dome. The headlight glow volume is a flat translucent grey sphere about 150 px across with a
   hard edge, ahead of the car in every frame. Hide it when seen from behind, or make it additive,
   warm, and a quarter of the size with no silhouette.
3. Hero scale and surfaces. The car fills 0.16 to 0.28 of the frame height; bring the camera in and
   down until it holds 0.30 in a straight, add a lamp and sky reflection band on the flat tan body,
   and give the tail lights a halo so they read as sources.
4. Post-process noise. Drop the scanlines (row-to-row difference should be within 1.2 times the
   column-to-column difference on flat sky) and reduce the road grain until it is invisible at 1x.

## Against a first-pass night build

Clearly better than a flat dark scene with one grey light: a continuous starry gradient sky, warm
pools with a stretched sheen on the asphalt, silhouetted far trees. It is a night scene with the right
bones lit with the wrong palette.
