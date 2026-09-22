## Entry

- Play link: https://lkruer.github.io/sundrift/game/
- Source repo: https://github.com/lkruer/sundrift
- Commit the verdict names: 254e54b1d59aceaf0328d2905bafb6cccd63977b
- Team (GitHub handles): lkruer

## Verdict block

Paste the block `harness/jam.mjs` printed, unedited, from `=== 404 JAM VERDICT ===` to `=== END ===`.

```
=== 404 JAM VERDICT ===
url             https://lkruer.github.io/sundrift/game/
utc             2026-09-22T04:19:42.674Z
commit          254e54b1d59aceaf0328d2905bafb6cccd63977b
viewport        390x844 @3x phone, real touch, Android Chrome UA
network         4G: 4 Mbps down, 1 Mbps up, 60 ms latency, CPU 2x slower
ready           13.0 s   budget 20 s   PASS
weight          1.2 MB   budget 10 MB   PASS
started         yes (tap on #startb)
moved           73.6 m   needs 1 m   PASS
peak draws      501   budget 900   PASS
peak tris       636,717   budget 1,500,000   PASS
median fps      60 (ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11))
errors          0   PASS
404s            0   PASS
external deps   none   cdn: fonts.googleapis.com, cdn.jsdelivr.net, fonts.gstatic.com
outside folder  none, every file came from the game folder
RESULT: PASS
=== END ===
```

## What I found

The clock is a score: every banked drift pushes the night toward dawn, so the moonlight, the street lamps, the sunrise and the golden hour that follows are driven by how well you drive, and a long chain visibly swings the light across the pass. Also: one-finger phone drifting, with counter-steer that scales with slip so a thumb can hold a 50-degree angle without spinning.

## Declarations

- [x] Every 3D object is Three.js code written through the recipe; nothing is a mesh or a vertex array smuggled in as data.
- [x] Images and sound are from Atlas on jam credits, or my own, listed in the entry file. (There are none: every texture and sound is generated in code at load; the only files the page loads besides its own are Three.js from jsdelivr and one Google font.)
- [x] The source repo is public and its first commit is on or after 11 Sep 2026 00:00 UTC.
- [x] Nothing here copies a 404 reference game's assets or code. (The three harness files `assetlib.js`, `surfaces.js`, `rig.js` are copied in as the recipe instructs.)
- [x] I have read the rules in README.md and I am eligible.
