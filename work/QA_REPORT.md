# SUNDRIFT QA: physics, gameplay and scoring, HUD

A critical pass over the jam build (`07eeabf`, the third-place entry) for a games platform where many players will
play long sessions. Everything below was measured: the car model in Node (the game's own `car.js`, `scoring.js` and
`config.js` driven by scripted keys and thumbs), and the game itself in headless Chrome (puppeteer, real keys and
real touches, the game's own `__AUTOPILOT__` and `__DEBUG__` hooks). Before/after comparisons run the shipped build
(extracted from `HEAD` into a scratch folder) against this branch, served side by side with `--game=<dir>`.

The machine is shared (a live trading process holds one core at 100%), so frame times here are only comparable run to
run, not with NOTES.md's rounds; no conclusion below rests on a frame time. Every number has its raw output in
`work/qa_evidence/` (committed) and every screenshot is under `work/shots/qa_*` (which the repo ignores; regenerate
with the tools at the end).

## Summary

| # | severity | area | finding | status |
|---|---|---|---|---|
| C1 | critical | scoring | A run never ends and the score only grows, so a best measures time played; J-turns farmed in place pay 11.7k points a minute with no risk (a keyboard macro can do it), and the city's pavement clutter pays more than drifting | proposal |
| M1 | major | physics, phone | A thumb held into the turn at half to two-thirds of its reach closed the slide as if it had let go (the drift's 30% dead band sat behind the stick's quadratic curve: 44% of the thumb's travel) | **fixed** in car.js |
| M2 | major | physics | Nosed into a rail with the gas held, the car stays stuck: main.js's scrape-free pivot breaks the very contact it waits for and starts over every 0.4 s | proposal, patch verified |
| M3 | major | scoring | Wiggling the wheel on a straight pays like a chain of S-bends: each side change adds 120 x the multiplier and a chain step, which climbs the multiplier | proposal, measured |
| M4 | major | scoring | NEO TOKYO: weaving between the road and the pavement out-scores drifting through the corners (32 to 35k against 26 to 28k points a minute); 90% of it is slides scored on the pavement and their side changes, 10% the clutter | proposal |
| m1 | minor | physics | A car on the verge where a guardrail run (or a tunnel portal) begins is moved through the rail onto the road, 1.2 to 3.2 m in one frame | proposal, patch verified |
| m2 | minor | scoring | CLIP pays wherever the rear corner is near the road's edge line, rail or not: on the pass's open edges (two thirds of them) and at the city's kerb there is nothing to clip | proposal |
| m3 | minor | gameplay | The boost a big drift earns fires on its own at the exit (+35 km/h after a 3,000-point drift), whether or not the next bend allows it | proposal |
| m4 | minor | HUD | The thumb's knob reads REVERSE whenever the pull is past half, at any speed, while the car is still braking | proposal |
| m5 | minor | HUD | COMBO reads x0 whenever no chain is running (every run's start, after every crash) | proposal |
| m6 | minor | HUD | The clock's gain reads "+1:05" for 65 minutes (a minute and five seconds, to anyone reading it) | proposal |
| p1 | polish | docs | README: "or just push a fast corner on the throttle" does not start a drift (4 to 5 degrees at most) | proposal |
| p2-p7 | polish | HUD | SWITCH! is called on every side change (every 1.7 to 2.5 s in a city run); the off-road countdown pops up every ~11 s in good city driving; the telltales are 9 px at 1280 x 720; the 8-digit score wraps past 99,999,999; nothing on screen says what makes points | proposals |

What is sound, measured and left alone: the car model is frame-rate independent (20 to 144 fps), nothing tunnels
through rails or trunks at any speed or frame rate tested, the car cannot be spun even when asked to, it always
recovers and drives off, landings are caught, J-turns, reverse and donuts measure as the build log says. See
"Checked and sound".

## How the scoring was measured

`work/qa_score_bench.mjs` drives a real run with the game's own scoring for 60 or 90 s per behaviour (keys ramped as
input.js ramps them) and reports points a minute. The references are two drivers:

- **gate**: the drift gate's own policy (steer for the road's heading and curve ahead, the handbrake into tight
  corners, counter-steer past 38 degrees). An honest, weak driver: it crashes (a hit over 8 m/s) four to six times a
  minute.
- **drifter**: every bend tighter than about 110 m taken sideways (a handbrake flick into it, the key held through it,
  the gas eased when the slide carries toward the outside edge, the key let go as it opens out), speed set by the
  tightest bend within braking reach. Noisy (one bad rail hit loses a whole chain), so it is quoted as a range.

| points a minute | pass EASY | NEO TOKYO EASY |
|---|---|---|
| gate driver (90 s) | 4,541 (8 crashes) | 12,112 (9 crashes) |
| drifter (five runs on the pass, two in the city) | 812, 12,987, 22,690, 33,516, 49,549: median 22,690 | 25,634, 27,867 |
| gate driver + wiggling on every straight (90 s) | 23,207 (5x the same driver without) | |
| **J-turns, one after another, where the car stands** (90 s) | **11,669** (25 J-turns, 0 crashes, 214 m driven) | **11,772** (25, 0 crashes, 215 m) |
| **weaving between the road and the pavement** (90 s, city) | | **32,359** and **35,251** (67 and 40 things knocked over) |
| the gate driver hugging the outside edge (clips; 60 to 90 s) | 4,996 to 11,284 (11 to 23 clips) | 20,335 and 22,661 (26 and 27 clips) |

The open-ground sim (`work/qa_exploit_sim.mjs`, the same Car and Scoring, a minute each) gives the clean numbers:

| move (60 s, open ground) | points a minute | what it needs |
|---|---|---|
| a 5 s held drift, 3 s straight, repeated | 45,936 | a road that bends every 8 s |
| one held drift, 20 s | 34,983 | a 38 m circle |
| S-bends: a held drift each way, 1.6 s a side | 127,683 | 36 transitions |
| **the wheel thrown side to side every 0.7 s, gas held** | **136,179** | once settled, within 1.0 m of a straight line (a player steers the line itself by eye: M3) |
| the same every 1.0 s, held near 100 km/h | 97,719 | within 3.5 m of a line |
| J-turns in place (back up to 8 m/s, let go, wheel over, gas, brake, again) | 11,897 | a 7.9 m circle |
| donuts (full lock, full throttle from rest) | 49 | (they run under the 6 m/s minimum: no exploit) |
| the tightest circle that scores anything real | 19,622 | a 23.6 m circle: not on any road |

Circling on the spot does not pay (a scoring drift needs at least 6 m/s and that needs a 24 m circle), donuts do not
pay, and the slide cannot be held in a circle small enough for a road. The holes are elsewhere: C1, M3, M4.

## Critical

### C1. A run never ends and the score only grows, so a best measures time played; two loops pay without the game's skill

**What.** A run has no end: nothing finishes it (sunrise is a callout, not a finish), a crash takes only the drift in
hand (`scoring.js:54-62`), the magnet takes only the drift in hand (`main.js startMagnet`), and `scoring.total` never
goes down. So a best score is points a minute times minutes played, and anything that pays steadily without risk wins
a long session. Two such loops exist:

- **J-turns in place.** `main.js:977-982` adds a flat 500 for every clean J-turn, with no cooldown and no need to go
  anywhere; a J-turn's own slide also banks ~200. Back up to 8 m/s, let go of S, wheel over and gas, brake, repeat:
  25 J-turns in 90 s, 11.7k points a minute on both maps, 0 crashes, 215 m of progress (in-game bench above; in the
  sim, 10.0 to 11.9k, the car's path inside an 8 to 10 m radius). The car's J-turn assist makes every one clean, so a
  keyboard macro can run it for hours: 0.7 M points an hour, as much as the skilled drifter's median on the pass HARD
  (6.9k, 10.2k and 36.7k a minute in three runs: see "EASY and HARD"), with no attention at all.
- **NEO TOKYO's pavement** (M4): weaving on and off it pays 32 to 35k a minute, more than the skilled drifter's 26 to
  28k. Not riskless (the bot crashed 2 to 3 times and met the magnet), but it needs none of the corner craft the game
  is about.

The gate's own driver makes 4.5k a minute on the pass: J-turn farming already pays it two and a half times as much.

**Repro.** Keys: hold S until the speedometer reads ~18 mph backwards, let go of S, hold A and W for a second, brake
with S to a stop, repeat with D. `node work/qa_score_bench.mjs --modes=jturn` (and `--city`).

**Proposals** (main.js, scoring.js; not edited here):
1. *A score of record bounded in real time.* A timed run (5:00, say: the clock on the HUD counting down beside the
   time of day), its banked score the best, the endless drive kept as free play without one. Bounded by the clock on
   the wall, a best measures points a minute, which is skill. (Not "dusk to sunrise", tempting as it is with DRIFT
   UNTIL DAWN on the title: the time of day moves with banked points and distance, so a slow farmer gets a longer
   night. The J-turn loop banks ~5,000 drift points and drives 214 m every 90 s and reaches sunrise after ~20 min
   with ~230k; the skilled drifter reaches it after 1.5 to 5 min with 60 to 75k.)
2. *J-turn pay that needs progress* (main.js:977): pay the 500 only once the car has driven 250 m along the course
   since the last one that paid (`G.dist - G.jtPaidAt >= 250`). Measured in the sim (P2 in
   `work/qa_scoring_proposals.mjs`): J-turn farming 11.9k to 4.4k a minute (2 of 17 J-turns paid), every J-turn made
   on the way down a course still pays.
3. Short of 1, the platform's leaderboard (if any) should rank something bounded: best single banked drift, or the
   best five minutes.

## Major

### M1. Fixed: on a phone, a thumb held into the turn at half to two-thirds of its reach closed the slide

**What.** The held drift (car.js, "the drift, held") reads how far the wheel is held into the slide: under 30% of the
wheel (`driftDead`) holds nothing, and past it the angle grows with the wheel. With a key that is fine: a key ramps
from 0 to 1 in 0.14 s and is past 30% in 40 ms. A thumb is not a key. input.js bends the thumb's travel into the
wheel on a curve (`0.45 n + 0.55 n^2`, so small corrections stay small), and measured on that curve the 30% dead band
was 44% of the thumb's reach, and the angle grew with the square of the travel. A thumb held into the turn short of
44% got a target angle of zero, which the controller steers toward actively, closing the slide as if the thumb had
let go, and anything short of about 70% held a slide that collapsed as the car gathered speed. The phone gate never
saw it: its finger is only ever at the middle or at full lock.

**Fix** (car.js, the drift controller only, 9 lines): for a touch, the wheel is read back as the thumb's travel (the
curve inverted, `thumbOf`, with input.js's 0.45 as `CAR.touchLin`) before the same 30% dead band is applied, so the
dead band is 30% of the thumb's reach as it is 30% of a key, and the angle follows the thumb linearly. Keys, the
assists, the yield, the J-turns and everything else are untouched; a thumb at the middle or at full lock gives exactly
0 and exactly 1 as before (bit for bit: the gate's finger, which only uses those two, drives the same physics).

**Before and after.** Real touches in the game (`work/qa_touch_game.mjs`: a phone, a NEO TOKYO avenue at 80 km/h, the
thumb on the HAND BRAKE pad 0.3 s while the finger slides out and stays; the slide's mean angle 0.6 to 1.8 s after
the flick; three runs each, within 0.5 degrees of each other):

| finger held into the turn | shipped | fixed |
|---|---|---|
| 35 px (50% of the 70 px reach) | 8.0 deg | 13.4 deg |
| 45 px (64%) | 17.1 deg | 22.1 deg |
| 55 px (79%) | 27.2 deg | 30.6 deg |
| 70 px (full lock) | 40.6 deg | 40.6 deg |

And held longer, as the car gathers speed (`work/qa_touch_parity.mjs`, the car sim, 1.5 to 5 s after the flick; a
key held gives 40 degrees and 287 points a second either way):

| thumb | shipped: holds, points/s | fixed: holds, points/s |
|---|---|---|
| 40 px (57%) | 4 deg, 12 | 9 deg, 76 |
| 45 px (64%) | 5 deg, 26 (9% of a key) | 17 deg, 162 (56%) |
| 50 px (71%) | 14 deg, 141 | 22 deg, 197 |
| 55 px (79%) | 21 deg, 188 | 27 deg, 223 |
| 60 px (86%) | 28 deg, 223 | 32 deg, 246 |
| 70 px | 40 deg, 287 | 40 deg, 287 |

Every other car sim is unchanged (`work/qa_ab_sims.mjs` against the shipped car.js: feel, stop hunt, reverse release,
unstick, J-turns, reverse, power and donuts, walls, frame rates and collisions all byte-identical; only the touch
partial-thumb rows differ). `work/steer_test.mjs` on touch: still no spin, the wheels never against the thumb.

### M2. Nosed into a rail with the gas held, the car stays stuck: the scrape-free pivot starts over every 0.4 s

**What.** main.js:945-953 (`G.pinned`): a car with its nose against a wall, slower than 3 m/s, on the gas, is meant to
pivot back toward the road after 0.3 s "rather than sitting there until the player thinks to reverse". The timer is
reset to zero on any frame without a front corner in the wall, and the pivot itself turns the nose away from the
wall: so it breaks the contact it waits for, the timer goes back to zero, the car pushes into the wall again, waits
0.3 s, turns a degree, and so on. Traced frame by frame (`work/qa_pinned_trace.mjs`, 60 degrees in, wheel straight):
`G.pinned` climbs 0 to 0.4 and drops to 0 eight times in 4 s; the heading goes 60 to 53 degrees, the speed stays
0.04 m/s. (The car model itself is fine: at walking pace it is held to its wheels, and a car pressing straight into a
wall has nowhere to go but back; the escape is main.js's job, and it fails.)

**Evidence** (`work/qa_wall_game.mjs`: a pass guardrail, the car set nose-in at 30 to 150 degrees, from rest or at
5 m/s, the gas held for 9 s; output in work/shots/qa_wall_shipped.txt and qa_wall_patched.txt):

| wheel | shipped: drives off within 3.5 s / within 9 s | with patch A: within 3.5 s / within 9 s |
|---|---|---|
| turned away from the rail | 2 of 10 / 6 of 10 (60 deg: 5.2 s, 85 deg: 6.6 s, 120 and 150 deg: never) | 10 of 10 (0.4 to 2.5 s) / 10 of 10 |
| straight | 1 of 10 / 2 of 10 (60 deg and beyond: never) | 9 of 10 (1.0 to 3.5 s) / 9 of 10 |
| turned into the rail | 0 of 10 / 0 of 10 | 0 of 10 / 0 of 10 (the player is steering into it) |

A player who spins into a rail and ends up facing it, and holds the gas (the natural thing), sits there until they
think of S. Measured on a pass guardrail; the city's street fronts and the tunnels' linings go through the same code
(the same hard line, the same `noseIn`).

**Proposal, patch A** (main.js:947; tested on a patched copy, `node work/qa_patch_main.mjs <dir> A`):

```js
  // (the pivot below turns the nose away from the wall, which breaks the very contact it waits for: the contact is
  // remembered for 0.4 s, or the pivot started over every time it began to work and a nosed-in car sat there)
  G.noseT = noseIn ? 0.4 : Math.max(0, (G.noseT || 0) - dt);
  G.pinned = G.noseT > 0 && car.speed < 3 && inp.throttle > 0.5 ? (G.pinned || 0) + dt : 0;
```

(I tried the car.js side first: a 5 mm contact slop in `hitWall`, so a resting contact stays one, as physics engines
do. It changed nothing that matters, 60 to 41 degrees in 4 s instead of 53, because the reset comes from the pivot,
not from the contact flickering; reverted.)

### M3. Wiggling the wheel pays like a chain of S-bends

**What.** scoring.js:96-102: every change of the slide's side while sliding (past 8.6 degrees) adds 120 x the current
multiplier and a step of the chain, and the chain feeds the multiplier at once (`climbed`, scoring.js:93: +0.5 a step,
up to +4). Nothing asks that the slide on the side being left was a real one, or that the road turned. With the
assists holding every slide (the car will not spin), throwing the key from side to side on a straight is safe, and
it climbs the multiplier as fast as the hands can wiggle: 8 side changes take it from x1 to x5, where holding a slide
takes 11 s to get there.

**Evidence.** Open ground (`work/qa_exploit_sim.mjs`): the wheel thrown every 0.7 s (each side held 0.7 s) with the
gas held, 136k points a minute, the path settling within 1.0 m of a straight line (which way that line runs is the
player's to steer, by holding a side a moment longer); every 1.0 s held near 100 km/h, 98k a minute, within 3.5 m.
A held drift scores 35k a minute; a drift every 8 s, 46k. In the game, the gate driver wiggling on every straight made
23.2k a minute against its own 4.5k without (`work/qa_score_bench.mjs --modes=wiggle`), with about the same number of
crashes (6 against 8 in 90 s). Like for like over the 7 s a 200 m straight takes, from the same
speed (sim): the wheel thrown every 0.7 s makes 5,900 to 6,400 points and leaves the car ~60 km/h faster (x6.5);
the same 7 s held through a bend make 2,400 to 3,000 and leave it ~20 km/h slower (x3).

On the real road (`work/qa_wiggle_game.mjs`, a wiggle steered by eye the way a player would: the key thrown the
other way whenever the direction of travel swings 3 degrees past the road's): on NEO TOKYO's straight avenues, 637
to 797 points a second over 6.5 s in four runs of five, no crash, never off the road (the car uses the avenue's whole
16 m). The pass has no straight of 200 m (its straightest are R 90 to 140 m bends) and there my bot mostly lost the
road (1 clean run in 10, 665 points a second): on the pass the wiggle needs a player's eye that my bot lacks.

Real S-bends (a held drift each way, 1.6 s a side) score as much as the wiggle (128k), so the rule cannot simply
punish switches; what is cheap is the switch without a bend. Measured in the sim (`work/qa_scoring_proposals.mjs`,
scoring.js untouched, the rules as subclasses):

| points a minute | shipped | P1: a side counts after 0.6 s at 20 deg, 1 a second | P1b: switches no longer step the chain | **P1c: P1b + a flat 120 a switch** |
|---|---|---|---|---|
| wiggle every 0.7 s | 136,179 | 86,099 | 118,116 | **63,396** |
| wiggle every 1.0 s near 100 km/h | 97,719 | 94,678 | 86,529 | **46,929** |
| S-bends, 1.6 s a side | 127,683 | 127,683 | 118,789 | 94,009 |
| S-bends, 2.5 s a side | 113,839 | 113,839 | 108,181 | 91,981 |
| a 5 s drift every 8 s | 45,936 | 45,936 | 45,936 | 45,936 |

**Proposal.** The cheapest fix is P1c (scoring.js:99-101): a switch pays a flat 120 (`this.points += 120`, not
`120 * this.mult`) and does not step the chain (drop `this.chain++`; the chain then counts chained drifts only). That
halves the wiggle and costs real transitions a fifth to a quarter. The better
fix is to pay a switch only when the road turned under the side being left: main.js passes the road's curvature at
the car (`track.sample(G.s).k`) to `scoring.update`, which keeps the curvature's integral over the current side, and a
switch pays (and steps the chain) only if the road turned at least 0.15 rad the slide's way meanwhile. That leaves
S-bend transitions exactly as they are and makes a straight pay only the slide itself.

### M4. NEO TOKYO: a run along the pavement out-scores drifting

**What.** In the city the pavement (the 2.75 m between the kerb and the street fronts) counts as off the road for the
countdown, but a slide there still scores (scoring.js only asks `car.surface > 0.3`; off the road it is 0.6), the
clutter on it pays per thing with the chain's x5 inside 1.8 s (main.js `smashScore`: a bag 15 to a bike 80, a vending
machine 300, times up to 5), and a moment back on the road (the car's centre 0.4 m inside the kerb, main.js
`offRoad`) resets the countdown. So weaving between road and pavement pays three ways at once: the clutter, the
slides, and the side changes (M3).

**Evidence.** The bench's pavement run (the gate driver, 3.6 s on the pavement at 45 km/h, 1.1 s back on the road,
again), twice: 32,359 and 35,251 points a minute, against 27,867 and 25,634 for the skilled drifter and 12,112 for the
gate driver on the same course (90 s each). The second run counted where the points came from: the 40 things knocked
over paid 5,360 of its 51,349 points (10%); the rest was slides scored on and off the pavement and the side changes
of weaving between the two (46 in 87 s: M3 again), with its biggest single drift 23,220. So the clutter is a garnish;
what pays is that the pavement scores like the road.

**Proposal.** Pay the drift only on the road: scoring.update gets the surface already; ask `car.surface >= 0.85`
(the gravel shoulder is 0.88, the verge and the pavement 0.6) for a drift to start and to keep accruing (scoring.js:71
and :86), so a slide that runs onto the pavement stops adding to its points (and banks if it stays there 0.8 s). The
same rule would stop slides on the pass's verges paying, which fits "back to the road" but is the owner's call. And
let the smash chain's x5 decay with repetition (the n-th thing of a kind in the last minute pays 1/n of it), so a
pavement of bags is a bonus, not a mine.

## Minor

### m1. A car on the verge where a guardrail run or a tunnel portal begins is moved through the rail onto the road

**What.** main.js:924-930 tests each corner against its side's hard line (a rail, a lining, 12 m either side of a
portal: the road's edge; open ground: none). Off the road on an open edge the car is past where the edge is. Where
a rail run begins (or a portal's 12 m zone), the hard line appears under a car already beyond it, every corner counts
as deep inside the rail, and `car.hitWall` moves the car out by the whole depth, through the rail, in one frame.

**Evidence** (`work/qa_railstart_game.mjs --near`: the six places where a rail or a portal zone begins in the first
2.4 km of the pass EASY, the car on the verge 1.2 or 2.5 m past the edge, 4 m before the rail, at 12 m/s alongside
the road): shipped, 12 of 12 moved through the rail, 1.2 to 3.2 m sideways in one frame (onto the shoulder at
u = 6.7 m: the rail is at 7.3 m); patched, 0 of 12 (the largest step 0.4 m, at a portal's wing wall), the car stays
on its side of the rail and runs along it.

**Proposal, patch B** (main.js:928-930; `node work/qa_patch_main.mjs <dir> B`): measure the car's centre on each
corner's own stretch of road; a centre already beyond a side's hard line got there over open ground, and that rail
holds it out instead of letting it through:

```js
      const hL = hardLine(q, 1), hR = hardLine(q, -1);
      // (the car's centre measured on this corner's own stretch of road: a centre already beyond a side's hard line got
      // there over open ground, or the rail begins beside it, and that rail holds it out rather than moving it through)
      const sa = track.pts[q.j], sb = track.pts[q.j + 1], sex = sb.x - sa.x, sez = sb.z - sa.z, sL = Math.hypot(sex, sez) || 1;
      const uc = ((car.x - sa.x) * sez - (car.z - sa.z) * sex) / sL, behindL = uc > hL, behindR = uc < -hR;
      if (behindL && q.u < hL) { impact = Math.max(impact, car.hitWall(lx, lz, hL - q.u, l, f)); if (f > 0) noseIn = true; }
      else if (behindR && q.u > -hR) { impact = Math.max(impact, car.hitWall(-lx, -lz, q.u + hR, l, f)); if (f > 0) noseIn = true; }
      else if (!behindL && q.u > hL) { /* as now */ }
      else if (!behindR && q.u < -hR) { /* as now */ }
```

With both patches applied the nose-in and rail-start probes give the numbers above; open edges (hard line Infinity)
and the city's fronts (2.75 m out, never crossed) are unaffected by B.

### m2. CLIP pays where there is nothing to clip

**What.** main.js:940-943 calls it a clip when a rear corner, still on the road, is within `SCORE.clipDist` (0.55 m)
of the road's edge line `q.wl`/`q.wr` while sliding, and scoring.js pays 250 x the multiplier for it, once every
1.4 s. The README says "clip the guardrail without touching it" and config.js "metres from the rail", but the test
never asks whether a rail is there: on the pass two thirds of the edges are open ground (going past the line costs
nothing but the countdown), and in the city the line is the kerb, 2.75 m short of the street fronts.

**Evidence** (`work/qa_score_bench.mjs`, each clip's side looked up when it paid): the gate driver hugging the outside
of the bends on the pass clipped 11 times in 60 s, 10 of them on open edges; the skilled drifter's own clips, 5 open
and 2 at a rail. In the city, the pavement run's 18 clips were all at the kerb, the skilled drifter's 11 of 13, the
edge-hugging run's 19 of 26.

**Proposal** (main.js:940-943): measure the gap to the side's hard line, and only where there is one:
`const side = q.u >= 0 ? 1 : -1, hl = hardLine(q, side); if (hl !== Infinity && hl - Math.abs(q.u) < SCORE.clipDist) clipping = true;`.
On the pass a clip is then a rail clip (worth its 250 x the multiplier). In the city the fronts are 2.75 m out across
the pavement, so this removes city clips unless the kerb clip is wanted, in which case it deserves its own, smaller
pay (KERB!, 100 x the multiplier).


### m3. The boost a big drift earns fires on its own at the exit

**What.** scoring.js `giveBoost` grants a second of boost per 900 points (0.35 to 3.4 s) the moment a slide ends, and
main.js puts it on the car at once (6,200 N: +5 m/s^2). The bigger the drift, the bigger the kick, right where the
bend ends; only a pull of the handbrake cancels it, which the README says and the title's help and the in-game hint
do not. Measured from 80 km/h with the gas held (car sim): a 500-point drift adds 4 km/h within 4 s, a 1,500-point
one 13 km/h, a 3,000-point one 35 km/h and 26 m. On HARD (legs of 120 to 240 m between hairpins of 11.5 to 15 m) that
is the speed and the distance a player has to brake back out of before the next hairpin.

**Proposal.** Keep the boost earned but let the player fire it (a key, Shift or E, and on a phone a flick up of the
steering thumb or a third pad), with the BOOST bar already on the dash showing what is banked; or keep it automatic
but only while the road ahead is straight (`track.sample(G.s + 40).k` small), holding it otherwise.

### m4. HUD: the thumb's knob reads REVERSE while the car is still braking hard

hud.js:1202 labels the knob `t.brake > 0.5 ? 'REVERSE' : 'BRAKE'`, but reverse only engages below 1 m/s (car.js:
`inp.reverse && this.vF < 1.0`): pulling the thumb well down at 60 mph shows REVERSE for the whole stop. **Proposal:**
keep the car's forward speed from `update(dt, s, car, ...)` (`this.carVF = car.vF`) and label it REVERSE only when
`t.brake > 0.5 && this.carVF < 1`.

### m5. HUD: COMBO reads x0 whenever no chain is running

At every run's start and after every crash or lost chain (screenshots `work/shots/qa_hud/qa_1280x720_0_start.png`,
`qa_1280x720_6_magnet.png`, `qa_390x844_0_start.png`) the panel says COMBO x0, which reads as a broken counter.
**Proposal** (hud.js:829): draw `Math.max(1, v.combo)` (it is already dimmed below 2), or a dash.

### m6. HUD: the clock's gain reads "+1:05" for an hour and five minutes

hud.js:605 writes a gain of 60 minutes or more as `H:MM` next to a clock that shows `HH:MM`: "+1:05" beside "18:41"
reads as a minute and five seconds (`work/shots/qa_hud/qa_844x390_2_bank.png`). **Proposal:** `+1H05` or `+65 MIN`.

## Polish

- **p1. README overclaims a drift entry.** "or just push a fast corner on the throttle": in the car sim, the key held
  into a 40 to 80 m bend with the gas, from 50 to 80 km/h, peaks at 4 to 5 degrees and accelerates through on grip
  (the power-over was limited on purpose in the build log, to stop the phone gate's weave). Either drop the phrase or
  say "lift off and turn in" only.
- **p2. SWITCH! is called on every side change.** In the city the gate driver changed sides 51 times in 90 s and the
  skilled drifter 35 times: a SWITCH! callout every 1.7 to 2.5 s, over the road, all run long. The combo panel already
  punches on a switch. Proposal (hud.js:652): call it out from the third side change in one drift, or at most once
  in 3 s.
- **p3. The telltales and labels are small on a desktop.** DRIFT, CLIP and BOOST under the dial are 4.5 units (9 CSS
  px at 1280 x 720), dim when off; the CLIP lamp is the only place a clip is shown besides its callout. Proposal: 5.5
  units (`SIZES.roomy.labS`).
- **p4. The 8-digit score wraps past 99,999,999** (hud.js:818 `slice(-8)`): unreachable by honest play in a session,
  reachable by a farming macro overnight (C1). Cap it at 99,999,999.
- **p5. Nothing says what makes points.** The first-run hint says how to drift (`qa_coach_first_run.png`,
  `qa_coach_first_run_390x844.png`); nothing says that angle and speed pay, that a drift banks after the car
  straightens, that chaining multiplies, what CLIP is. Proposal: a second hint after the first bank ("THE DEEPER AND
  FASTER, THE MORE IT PAYS · CHAIN THEM WITHIN 2.6 S"). On a phone the hint could also say that the slide's depth is
  how far the thumb is out (true since M1): "SLIDE FURTHER OUT FOR MORE ANGLE".
- **p6. The phone on its side stacks four things in the top middle** (the live count, the tier word inline, the angle
  meter, the callout) within about 60 px (`qa_844x390_1_drift.png`). Legible, busy.
- **p7. The off-road countdown comes up all the time in the city.** A drift run wide onto the pavement counts as off
  the road from 0.35 m past the kerb, so the skilled drifter set the countdown off 8 times in 88 s on NEO TOKYO EASY
  (4 to 7 times a minute on the pass), and each time the live drift count steps down out of its way (hud.js `coY`)
  and back. Proposal (main.js `offRoad`): show the panel only after 1 s off the road (the 5 s still run from the
  start), so a slide that brushes the pavement and comes back never raises it.

## Checked and sound

Measured and left alone (all against this branch's car.js; the shipped one gives the same, `work/qa_ab_sims.mjs`):

- **Frame-rate independence** (`work/qa_fps_test.mjs`: eleven scripted moves stepped at 20, 30, 60 and 144 fps with
  the keys ramped per frame as input.js does). Worst spread against 60 fps over 4 to 8 s runs: 1.8 m of position
  (lift-off at 90 km/h, after ~100 m), 2.7 degrees of heading, 0.4 m/s. A held drift holds 40.1 degrees at every
  rate; J-turns, donuts and the line assist agree. The car sub-steps at 1/240 s or finer whatever the frame rate.
- **Sudden stops** (`work/stop_hunt.mjs --fps=N`, 600 runs of random keys from rolling, drifting, reversing and
  spinning starts): 5, 2, 4 and 5 events at 20, 30, 60 and 144 fps, all walking-pace pirouettes coming to rest (the
  residue NOTES.md already accepts); nothing else stops faster than tyres can.
- **Tunnelling** (`work/qa_collide_test.mjs`, main.js's own per-frame tests replayed: four corners against the rail
  as a half-plane, three circles along the car against a prop, the rear one first). Head-on into a trunk (r 0.28 to
  0.85 m) at 15 to 75 m/s: the hit is seen at 20, 30, 60 and 144 fps, every time; the "through" rows are glancing
  hits deflected past the trunk. Rails cannot be tunnelled: each corner is measured on its own nearest stretch of road
  and pushed out by its whole depth (which is what m1 is about when the car is on the wrong side).
- **Spins and getting going again** (`work/qa_edge_physics.mjs`). The car cannot be spun: the handbrake and full lock
  held 1.5 s at 100 km/h peak at 51 degrees. From that, the gas drives off; rolling backwards at 65 km/h, the gas
  (with or without full lock) drives off; sliding sideways at 50 km/h spinning at 3 rad/s, the gas catches it and
  drives off. No state was found that the gas or S does not get out of, except M2's nose-in on a wall.
- **High speed** (144 to 216 km/h, with and without boost): flicks hold 39 to 44 degrees, switchbacks swing through,
  full lock at 216 km/h with boost slides to 42 degrees and is caught; a phone's full-lock flicks back and forth at
  speed do nothing alarming (5 to 7 degrees).
- **Landings** (the car in the air 0.6 s, taking off at 30 m/s with up to 3 rad/s of yaw and 29 degrees of slip, the
  key in after landing): caught at 35 to 41 degrees, never past.
- **Reverse, J-turns, donuts, wall escapes**: `jturn_test`, `reverse_test`, `reverse_release_test`, `power_test`,
  `unstick_test`, `wall_test`, `feel_test`, `steer_test` (keys) all byte-identical to the shipped car.
- **Circling and donuts do not pay** (C1's table): a scoring drift needs 6 m/s, which needs a 24 m circle.
- **Off the edges, in the air, and the magnet, in the game** (`work/qa_air_game.mjs`: ten open edges of the pass, off
  at 60 and 100 km/h at an angle, then the countdown let run out): up to 0.63 s and 1.2 m in the air, landings at
  2.4 m/s down at most, the slide on landing caught; every one of the 12 magnets set the car down on the asphalt
  (u = +-1.6 m), facing along the road (0 degrees off), at 7 m/s. (Two runs flagged the car 10 m "under the ground":
  replayed with `work/qa_under_trace.mjs`, both were the car on the road inside a tunnel, the ground being the hill
  over it. A false alarm of the probe's, not the game's.)
- **Magnet and shortcut abuse**: none found. The magnet carries the car back to where it left, with the drift in hand
  lost; a shortcut across a switchback off the road moves the car to the other leg but pays nothing (the odometer
  skips a jump of more than 50 m; the clock moves 0.1 h at most).
- **HUD layout**: the three viewports (`work/shots/qa_hud/qa_1280x720_*`, `qa_390x844_*`, `qa_844x390_*`, and
  `qa_1280x720_city_*`) at a drift, a bank, the countdown, the magnet and a smash: nothing overlaps, every callout sits
  over the road ahead and clear of the car, the outlined type reads over the brightest neon, the countdown and the
  magnet panels say what to do. The findings above are about what it says and when, not where.

## EASY and HARD

Points a minute, `work/qa_score_bench.mjs` (60 s runs unless marked; each drifter run listed, lowest to highest):

| | pass EASY | pass HARD | NEO TOKYO EASY | NEO TOKYO HARD |
|---|---|---|---|---|
| gate driver | 4,541 (90 s) | 13,261 | 12,112 (90 s) | 11,955, 63% of it pavement clutter (65 things) |
| drifter, each run | 812, 12,987 (90 s), 22,690, 33,516, 49,549 | 6,865, 10,187, 36,740 | 25,634 (90 s), 27,867 (90 s) | 8,730, 19,562, 23,691 |
| drifter, median | 22,690 | 10,187 | ~26,700 (mean of two) | 19,562 |
| J-turns in place | 11,669 (90 s) | (not run: it needs only 20 m of road) | 11,772 (90 s) | (not run) |

- **A skilled run and a poor run are separated on EASY, barely on the pass HARD.** On EASY the drifter's median is 5x
  the gate driver on the pass and 2x in the city. On the pass HARD the gate driver, crashing four times a minute,
  scored 13.3k, more than the drifter's median: HARD's bends come every 32 m (the median gap, below), the gate
  driver's handbrake fires at every tight one, and a crash there costs only a short drift, while the drifter's long
  chains are all or nothing
  (6.9k to 36.7k). A crash taking only the drift in hand (and resetting the chain) is fine on EASY; on HARD it makes
  careless pay as well as careful. In a timed run (C1) a crash could also cost a few seconds of the clock, which
  would separate the two.
- **HARD does not pay more than EASY** (the drifter's median is lower on both maps, by 1.4x in the city and 2.2x on
  the pass). Bests are kept per course, so this only matters if courses ever share a board; then HARD needs a factor.
- **The city's clutter carries the weak driver** (M4): on NEO TOKYO HARD, 63% of the gate driver's points were things
  it knocked over on the pavement.

**The chain's grace.** A chain survives only if the next slide begins within the bank's 0.8 s and the chain's 2.6 s,
3.4 s: 66 m of road at 70 km/h, 94 m at 100. Measured on the courses themselves (`work/qa_bend_gaps.mjs`, the game's
generator and seed, 12 km of each, bends tighter than 110 m):

| course | bends a km | gaps between bends: median (p25 to p75) | gaps a chain can cross at 70 / 100 km/h |
|---|---|---|---|
| pass EASY | 6.3 | 68 m (26 to 166) | 50% / 64% |
| pass HARD | 13.7 | 32 m (20 to 48) | 91% / 94% |
| NEO TOKYO EASY | 6.7 | 66 m (52 to 150) | 51% / 70% |
| NEO TOKYO HARD | 13.3 | 36 m (30 to 50) | 83% / 89% |

On HARD the grace is about right: nearly every gap can be carried by driving it well. On EASY a third to a half of
the gaps cannot be crossed without a slide in between, so the only way to keep an EASY chain is to keep sliding down
the straights: the grace is what turns M3's wiggle from a trick into the best line on EASY. With M3's fix, a grace
scaled by the gap (or 3.5 to 4 s on EASY) would keep EASY's chains reachable by driving.

## Proposals by file (for the people reworking them)

| file | change | finding | measured effect |
|---|---|---|---|
| main.js:947 | patch A: remember the nose's contact 0.4 s | M2 | nosed-in escapes with the gas, wheel straight or away: 3 of 20 within 3.5 s to 19 of 20 |
| main.js:928-930 | patch B: a rail met from behind holds the car out | m1 | rail-start snaps 12 of 12 to 0 of 12 |
| main.js:977-982 | the J-turn's 500 only after 250 m of progress since the last paid | C1 | J-turn farm 11.9k to 4.4k a minute (sim) |
| main.js + scoring.js | a timed run of record (5:00), the endless drive as free play | C1 | bounds a best by points a minute |
| scoring.js:99-101 | a switch: a flat 120, no chain step (or: only when the road turned under the side left) | M3 | wiggle 136k to 63k a minute, real S-bends 128k to 94k (sim) |
| scoring.js:71, :86 | a drift starts and accrues only at `surface >= 0.85` | M4 | the pavement's slides stop paying |
| main.js:1431-1439 | the smash chain's value decays with repetition of a kind | M4 | (not measured) |
| main.js:940-943 | a clip only against a hard line (rail), measured to it | m2 | would not have paid 10 of the edge-hugging run's 11 pass clips, nor 5 of the drifter's 7 |
| main.js:971-972 | the earned boost fired by the player, or held while the road ahead bends | m3 | |
| main.js `offRoad` | the countdown panel shown after 1 s off the road | p7 | |
| hud.js:1202 | REVERSE on the knob only when the car is slower than 1 m/s | m4 | |
| hud.js:829 | COMBO shows at least x1 | m5 | |
| hud.js:605 | the clock's gain as `+1H05` or `+65 MIN` | m6 | |
| hud.js:652 | SWITCH! from the third side change of a drift, or once in 3 s | p2 | |
| hud.js:818 | the score capped at 99,999,999 | p4 | |
| README | drop "or just push a fast corner on the throttle" | p1 | |

## Gates (this branch)

`node gate/drift-gate.mjs game` on this branch (each with another of my browsers and two other sessions' game bots
running on the machine, so a stray slow frame is load, not the game):

| gate | result |
|---|---|
| pass, desktop | PASS: 8 banked, 601 m, peak slip 79 deg; 3 frames over 34 ms (world build 99 to 126 ms at 110 m, under load) |
| pass, phone (real touches), four runs | banked 2, 1, 6, 3: three PASS, one FAIL (the gate wants 2); 0 slow frames |
| pass, phone, the shipped build, three runs beside them | banked 2, 5, 8: three PASS |
| NEO TOKYO, desktop | PASS: 17 banked, 601 m; 6 frames of 50 to 84 ms (render, under load) |
| NEO TOKYO, phone | PASS: 15 banked, 601 m, 0 slow frames |

The phone gate's finger is only ever at the middle or at full lock, and there this branch computes exactly what the
shipped car does: `work/qa_touch_bitexact.mjs` replays 720,000 frames of such touch input (0 or full lock, gas,
brake, handbrake, at random) through both car.js files and every frame is bit-identical. So the two builds' gate runs
differ only by the gate's own timing, and its spread (1 to 8 here) is the bot's: NOTES.md already records "this bot's
count runs from 1 to 20". Two things about the gate itself, for its owner: it counts any score increase as a drift
banked, so in the city most of its count is the pavement's clutter (score steps of 400: a bike at x5) and its "2
banked" on the phone pass run above were two bollards; and it can fail a build for the bot's luck. Counting the
`bank` events (main.js already drains them every frame and could keep a count on `__GAME__`) and asking for 2 in
the best of three runs would make it a sharper check.

## What changed on this branch

- `game/src/car.js`: M1 (the drift controller reads a touch's wheel back as the thumb's travel: `thumbOf`,
  `CAR.touchLin`). Nothing else in the game.
- `work/`: the tools below, `work/stop_hunt.mjs --fps=N` (default unchanged), `work/qa_lib.mjs --game=<dir>` (serve
  another copy of the game, for before/after), the raw outputs in `work/qa_evidence/`, and this report.

## The tools (all in `work/`, all rerunnable)

| tool | what it does |
|---|---|
| `qa_fps_test.mjs [car.js]` | eleven moves stepped at 20, 30, 60, 144 fps, the spread against 60 |
| `qa_collide_test.mjs [car.js]` | main.js's per-frame wall and prop tests replayed at four frame rates: tunnelling, glancing hits |
| `qa_edge_physics.mjs [car.js]` | high speed with boost, spins and recovering, landings |
| `qa_touch_parity.mjs [car.js]` | a drift held by a key and by a thumb at 15 to 70 px |
| `qa_exploit_sim.mjs` | circling, donuts, wiggling, J-turns, held drifts: points a minute and the room each needs |
| `qa_scoring_proposals.mjs` | the scoring rules proposed in M3 and C1, as subclasses of Scoring, against the shipped one |
| `qa_ab_sims.mjs <before game> [after game]` | every car sim on two car.js files, outputs compared line by line |
| `qa_score_bench.mjs [--city] [--course=hard] [--modes=...]` | points a minute in the game: gate driver, drifter, wiggle, J-turns, pavement, clips |
| `qa_wiggle_game.mjs [--city]` | the wiggle on the course's straightest stretches |
| `qa_touch_game.mjs [--game=dir]` | a thumb drift with real touches on a phone, at 35 to 70 px |
| `qa_wall_game.mjs [--city] [--fps=30]` | nosed into a rail at 30 to 150 degrees with the gas held; slides into a rail |
| `qa_railstart_game.mjs [--near]` | a car on the verge where a rail or a portal begins |
| `qa_air_game.mjs` | off the open edges at speed: air, landing, and where the magnet sets the car down |
| `qa_hud_shots.mjs [--vp=WxH] [--city]` | the HUD at a drift, a bank, the countdown, the magnet, a smash |
| `qa_patch_main.mjs <dir> A,B` | a copy of the game with this report's main.js patches, for `--game=` |
| `qa_pinned_trace.mjs`, `qa_touch_trace.mjs`, `qa_verge_trace.mjs`, `qa_under_trace.mjs` | frame-by-frame traces behind M2, M1 and two probe artifacts |
| `qa_touch_bitexact.mjs <car.js A> <car.js B>` | 720,000 frames of the gate's kind of touch input through two car.js files, compared bit for bit |
| `qa_gate_repeat.mjs <game> N [flags]` | the drift gate N times on one build, the spread of its counts |
| `qa_bend_gaps.mjs` | how far apart each course's bends are, against the chain's reach |
| `qa_wiggle_tune.mjs` | (a dead end, kept for the record) a lane-holding open-loop wiggle searched for in the sim |
| `qa_shots_coach.json` | for `shot.mjs`: the first-run hint, 10 s into a first run |

Screenshots and raw outputs are under `work/shots/qa_*` (the repo ignores `work/shots/`; the text evidence is copied
into `work/qa_evidence/`).
