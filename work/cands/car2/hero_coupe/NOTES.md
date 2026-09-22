# hero_coupe (round 2, "much more detailed") — candidate notes (receipts)

## Sporty tail pass (MINIDRIFT: "make the rear end less bulky, think more sporty end")

- Shipped: **30,050 triangles**, 427 meshes, 1.941 x 1.333 x 4.263 m (was 4.455: the tail face sits
  0.16 m closer to the rear axle, and the tips no longer stand out behind it). `game/assets` re-verified 22/22 clean. Joints, 'body', material names and palette
  unchanged. Re-checked at runtime: the hubs sit at the wheel centres (z +1.192 / -1.308 after
  recentring, wheelbase 2.50), steering moves the caliper with the hub and leaves the wheel centre fixed.
  expect.json left at the style-lock 4.45 depth, which the car passes at 4 % off.
- Construction: the hull loft gains eight rings behind the rear glass. Over the arch the skin carries on
  as before; behind it the rings drop to y 0.44 (a dark wall facing the wheel, a dark underside), pinch
  from 0.815 to 0.775, round their corners in plan (radius 0.17, five rings) and lean, so the loft's back
  cap IS the rear face, undercut 20 degrees (a point at height y sits (0.95 - y) tan 20 further forward).
  The deck dips to 0.917 and kicks up 0.035 into a ducktail lip at z -2.03. `ringAt` now finds rings by
  their crown point because the tail rings lean. New chunk `_parts/_tail.js` places every rear fitting
  from the same rings (`ringPt`, `outline`, `tailStrip`, `onTail`, `sideAt`), so it sits on the skin:
  a thin painted lip wrapping to the arches, a 0.105 dark garnish wrapping the corners, two slim lamp
  units a side (0.07 lens on a polished backing, white line; the outer unit wraps the corner), shallow
  plate pocket and lamp, vertical reflectors, side markers, fuel filler, a dark diffuser (ramp 0.17 to
  0.39, five fins, two side walls) ending just behind the lip, 0.09 tips on the left tucked into its
  left channel, and a 0.02 blade at y 1.10 on two lofted swan necks hooked over its top, with thin end
  plates, brake lamp and gurney. Rear flares widened to 0.905 with the top at 0.79 so they read as hips.
- Rounds: (1) the rebuild; the diffuser, fins and tips stuck 0.1 m out behind the lip like a comb, and
  the flare feet ran down to y 0.24 as white plates. (2) Diffuser cut back to z -1.89, fins to 0.17,
  tips only 0.04 proud, and the rear flares now end at the lip line (the sweep stops at y 0.40).
  (3) Lamps A/B'd at the chase camera (`_verify/lamps_ab.png`): four round units against slim wrap-
  around units; the slim ones read far better at distance and suit the pop-up nose (180SX/AE86), so
  they shipped. The first slim try buried the lens inside a prouder bezel slab (grey blocks); the
  bezel now sits behind the lens as a border. Before/after at the chase camera: `_verify/before_after.png`.
- For the game (not edited, main.js is outside this task): the tips' mouths are now at x 0.315 and
  0.435, y 0.253, z -2.013, so `flame.set(0.42, 0.28, -2.15)` wants about (0.375, 0.253, -2.01) and
  `car.point(0.42, -2.2)` about (0.375, -2.03); the car now spans z -2.132 to +2.132, so the rear
  `CORNERS` at -2.25 (and the front at 2.2) sit about 0.1 m outside the body.
- Receipts: `_parts/_sporty1.py`, `_sporty2.py` (and the lamp edits in `_tail.js`); the pre-pass
  chunks are in `_parts_bak_polish/`. Assembly order: `_hdr_c _core _paths _body_c _fit _tail _c5`.

## Polish pass ("the back side feels a little bulky", "perfection is the goal")

- Shipped from the same chunks (`_parts/_polish1.py`, `_polish2.py` are the receipts): **34,176 triangles**,
  431 meshes, 1.941 x 1.333 x 4.455 m; `game/assets` re-verified clean. Joints, 'body', names, palette
  unchanged. Judged on the verifier's five views at 560 px, the chase view (4 m back, 1.5 m up, three-quarter
  rear), a dead-rear low view and a side elevation under a strong top light (`_parts/_chase.mjs`;
  `_verify/polish1.png`, `polish2.png`, `polish_shipped.png`).
- Rear, slimmer: garnish 0.14 m tall (y 0.80-0.94), chamfered, proud 0.014, wrapping 0.07 m into the
  quarters; lamp units shrunk to fit it (cup r 0.06, lens r 0.048, polished ring, white inner ring);
  bumper painted face 0.34 m (y 0.46-0.80) with a soft horizontal crease at y 0.52 instead of the step, a
  painted chin tucking 0.06 m under it and a slim dark valance (y 0.17-0.31) inset below; plate pocket
  0.33 x 0.17 with a 0.015 rim proud 0.015 and the lamp under the garnish; boot deck lowered to 0.93 m
  (station 9 top 0.99 -> 0.93, station 8 0.975 -> 0.952) with a 0.04 m ducktail; wing blade 0.02 m thick
  on slimmer uprights at y 1.235 with 0.008 m end plates; fins 0.10 m and set back 0.09 m; tips 0.09 m dia.
- Hull: crown rebuilt as a parabola with four segments a side (16-point rings); glasshouse tumbles in
  0.18-0.19 m each side (roof edge 0.66 -> 0.60, pillars, drip rails, roof lip followed); belt line eased to
  0.85 -> 0.895 -> 0.915 -> 0.905 with the deck; bonnet crown halved (0.012) and the bulge 0.03; flares out
  to 0.875 / 0.89 so they sit over the tyres with the 0.03 m arch gap; shut lines 0.010 wide, proud 0.002.
- Changed after looking (round 1 -> 2): the taller valance made the lower rear a black slab, so the chin
  became painted and the valance slim; under the top light a hard line ran along the flanks at y 0.70 where
  the door-skin boxes met the hull's floor-edge crease, so the hull skin now drops to the sill (y 0.24)
  through the cabin with two extra stations at the door edges (z 0.90 and -0.87/-0.89) and the door boxes
  are gone: the flank is one surface from sill to belt. Round 3 only shortened the garnish wrap.
- Front: mouth lowered and widened (opening y 0.21-0.38, x +-0.58; intercooler 1.20 wide, 12 fins);
  lamp band 0.08 tall with 0.06 lenses; fog cups r 0.05; canards 0.005 thick.
- Wheels: machined galvanised ring at the lip's inner edge, dish reduced to 0.075, spokes with a peaked
  five-point cross-section, tread blocks 0.014 with narrower grooves.
- Interior checked against the new glass: cage roof and A bars stay 0.04 m inside, the parcel shelf was
  lowered to y 0.90 under the lower rear glass base, the binnacle hood clears the screen by 0.03 m.

## Rear pass (chase camera sees the tail all game)

- Shipped again from the same chunks: **33,000 triangles**, 431 meshes, 1.941 x 1.382 x 4.47 m (wing end
  plates and antenna set the height, the new tips the depth; both inside tolerance). `game/assets` re-verified
  22/22 clean. Joints, 'body', names, palette and the hierarchy are untouched.
- What changed, all real geometry: a full-width chrome-dark garnish swept round the tail with chamfered top
  and bottom edges (proud 0.03); each tail lamp is now a unit (open dark cup 0.03 deep, lens sunk below its
  rim, a polished galvanised rim ring at metalness 0.8, a lane-white inner ring at emissive 0.5); the rear
  bumper steps in 0.03 under the garnish (y 0.66-0.80); a number-plate pocket with a proud rim, a recessed
  floor and a blank lane-white plate, with a lamp-warm plate lamp in a housing under the step; two vertical
  tail-red reflector strips (emissive 0.6) on the corners, replacing the horizontal ones and the rubbing
  strip; a ducktail lofted across the boot lid (rises 0.062 over the last 0.29 m, vertical trailing face)
  with the boot shut lines run out through it; the wing raised to y 1.30 on taller, more swept lofted
  uprights with larger end plates, the brake lamp and gurney moved with it; twin tips 0.10 dia x 0.16 long,
  hollow (open chrome-dark cylinders, metalness 0.85 / roughness 0.25) with a dark inner pipe visible down
  each, both on the left; five diffuser fins deepened to 0.16; mud flaps enlarged to 0.22 x 0.22.
- Looked at from the chase camera (`_parts/_chase.mjs`: 4 m back, 1.5 m up, three-quarter rear, plus a
  dead-rear low view; `_verify/chase.png`, `chase_shipped.png`): nothing floats; the step under the garnish
  reads as a shadow line; the tips read as hollow. Trimmed the end plates from 0.15 to 0.12 tall after the
  first look because they made the wing look boxy and set the height at 1.407 m.
- Not done: rear glass defroster (not needed per the brief).

- Shipped: **hero_coupe_c.js** (loft hull + every fitting as its own part) as `game/assets/hero_coupe.js`
  with `hero_coupe.expect.json` {1.72 x 1.28 x 4.45, tolerance 0.25}. Final: **29,844 triangles**, 418 meshes,
  measured 1.941 x 1.335 x 4.45 m (width includes the mirrors, height the antenna and wing; the body is
  1.72 x 1.28), base at y = 0, centred, four sides all judged non-blank by the gate. `game/assets` re-verified
  22/22 clean after the copy. The previous car was 10,352 triangles / 174 meshes.
- Articulation unchanged and re-checked at runtime in headless Chrome: `g.userData.joints = { hubFL, hubFR,
  wheelFL, wheelFR, wheelRL, wheelRR }`, hubs are Groups at the wheel centres (FL at +X +Z) holding the brake
  disc (galvanised, metalness 0.7) and the vermilion caliper, each wheel Group is the hub's child holding tyre,
  tread blocks, rim, lip, spokes, cap and five lug nuts; everything static is under the Group named 'body'.
  Camber baked into hub rotation.z (4 deg front, 3 deg rear, tops in). The game's own baking in main.js
  (body per material, wheels per wheel) is unaffected because the hierarchy shape is the same as before.
- What won and why: the hull is the same ten-station, twelve-point loft as the previous winner (its
  proportions were right), read back through `ringAt / topY / flankX` so every fitting sits on the real
  surface: shut lines (0.012 wide, sunk 0.006, proud 0.003) are strips lofted along the crown, the pop-up lids
  are raised panels following the crown, louvres, pins, antenna, filler and handles are placed from the same
  readers. Bumpers, splitter, lamp band, tail panel, valance and rubbing strip are bands SWEPT along one
  plan path per end (`endPath / sweep / clipX / faceAt`), so the front opening is a real hole (upper band,
  lower band, two pillars) with the intercooler box and twelve galvanised fins visible behind it, and every
  lamp, lens, fog cup, canard, reflector and tow hook is placed tangent to the swept face by `faceAt`.
- Thrown away: candidates A (primitives) and B (profiles/extrudes) were written as body chunks
  (`_parts/_body_a.js`, `_parts/_body_b.js`, sharing `_parts/_fit.js` and `_parts/_c5.js`) but never
  assembled or verified; the coordinator called C the car and asked for it to ship before A and B were run,
  so their expect files were removed. They are kept in `_parts` only as a record.
- Changed after looking at the renders (three rounds on C):
  1. The whole door area showed the interior: the old winner's door-skin boxes had been dropped and the loft
     hull only reaches down to y 0.70. Door skins restored as paint boxes (x 0.73-0.80, y 0.22-0.72).
  2. The antenna set the height at 1.437 m; shortened twice (mast 0.20 -> 0.09) to 1.335 m total.
  3. The rear bumper was a blank 0.6 m slab: added a dark lower valance and a rubbing strip swept round the
     corners, a blank plate recess and two corner reflectors.
  4. Triangles were 24.5k against a 28k floor: tapered spoke lofts instead of boxes, tread blocks at six
     segments, rims at 40, rivets at 10x5, plus honest parts (intercooler end tanks and charge-pipe elbows,
     brake ducts, muffler and tailpipe, bonnet pins, gurney flap, pedals, handbrake, fire extinguisher).
  5. Wipers first lay along z and dived under the glass; re-laid across the screen base at the glass rake.
  6. The build-by-chunks step glued files without trailing newlines, which commented out `export default`
     (an "Illegal return" that looked like a brace error). Every chunk now ends with a newline.
- Deliberate deviations to flag: paint is named 'paint' and glass 'glass' (as instructed); glass is
  transparent at 0.55 so the interior reads; bronze rims carry metalness 0.25 and the polished lip 0.7;
  chrome-dark, bronze and galvanised are all named 'metal'; exhaust tips are chrome dark at metalness 0.85
  (0.085 m dia, two on the left, the flame point in main.js sits between them); fog lamps use the headlamp
  lens material; gauge faces are lamp-warm but do not emit (the style lock lets only lenses emit); the harness,
  stripes, calipers and tow hook are all vermilion (one accent colour). Shut lines are dark strips, not
  boolean recesses. Several brief parts are thinner than the style lock's 0.04 m floor (grooves, strips,
  fins, lug nuts, antenna) because the brief asks for them.
- Unresolved: the width with mirrors is 1.94 m and the height with wing/antenna 1.335 m (both inside the
  0.25 tolerance); the tail-red and lamp-warm lenses are still unnamed for surfaces.js; the bonnet-edge shut
  lines stop at the lids rather than wrapping the nose panel; the car has not been driven in the game after
  this change (only verified and joint-checked), so the in-game bake and clearcoat upgrade should be eyeballed
  once.
