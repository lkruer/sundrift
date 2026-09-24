## Entry

- Play link: https://lkruer.github.io/sundrift/game/
- Source repo: https://github.com/lkruer/sundrift
- Commit the verdict names: 83f608b4ee71cd503b329dc0e0073cef07f9ec45
- Team (GitHub handles): lkruer

## Verdict block

Paste the block `harness/jam.mjs` printed, unedited, from `=== 404 JAM VERDICT ===` to `=== END ===`.

```
=== 404 JAM VERDICT ===
url             https://lkruer.github.io/sundrift/game/
utc             2026-09-24T08:11:04.501Z
commit          83f608b4ee71cd503b329dc0e0073cef07f9ec45
viewport        390x844 @3x phone, real touch, Android Chrome UA
network         4G: 4 Mbps down, 1 Mbps up, 60 ms latency, CPU 2x slower
ready           10.0 s   budget 20 s   PASS
weight          1.9 MB   budget 10 MB   PASS
started         yes (tap on #startb)
moved           96.8 m   needs 1 m   PASS
peak draws      336   budget 900   PASS
peak tris       596,797   budget 1,500,000   PASS
median fps      60 (ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11))
errors          0   PASS
404s            0   PASS
external deps   none   cdn: fonts.googleapis.com, fonts.gstatic.com, cdn.jsdelivr.net
outside folder  none, every file came from the game folder
RESULT: PASS
=== END ===
```

## What I found

The clock is the score: every drift you bank pushes the time of day forward, so a run starts at sunset and your driving carries the pass through the night to sunrise, the sky and the light on the road turning with every good slide. Leave the road and there is no reset button: a giant horseshoe magnet swoops down, grabs the car and carries it back to where it left. On a phone it is one finger (hold to drive, slide to steer, pull down to brake) with the other thumb on the handbrake.

## Declarations

- [x] Every 3D object is Three.js code written through the recipe; nothing is a mesh or a vertex array smuggled in as data. (`harness/ship.mjs` flags nothing in the folder.)
- [x] Images and sound are from Atlas on jam credits, or my own, listed in the entry file. (There are none: every texture and every sound is generated in code at load; the only files the page loads besides its own are Three.js from jsdelivr and subsets of Google Fonts.)
- [x] The source repo is public and its first commit is on or after 11 Sep 2026 00:00 UTC. (First commit 22 Sep 2026 00:15 UTC.)
- [x] Nothing here copies a 404 reference game's assets or code. (The three harness files `assetlib.js`, `surfaces.js`, `rig.js` are copied in as the recipe instructs.)
- [x] I have read the rules in README.md and I am eligible.
