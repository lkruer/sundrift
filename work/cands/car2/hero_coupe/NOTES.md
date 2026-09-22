# hero_coupe (round 2, "much more detailed") — candidate notes (receipts)

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
