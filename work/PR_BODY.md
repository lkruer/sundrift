## Entry

- Play link: https://lkruer.github.io/sundrift/game/
- Source repo: https://github.com/lkruer/sundrift
- Commit the verdict names: FINAL_SHA
- Team (GitHub handles): lkruer

## Verdict block

Paste the block `harness/jam.mjs` printed, unedited, from `=== 404 JAM VERDICT ===` to `=== END ===`.

```
VERDICT_BLOCK
```

## What I found

The clock is the score: every drift you bank pushes the time of day forward, so a run starts at sunset and your driving carries the pass through the night to sunrise, the sky and the light on the road turning with every good slide. Leave the road and there is no reset button: a giant horseshoe magnet swoops down, grabs the car and carries it back to where it left. On a phone it is one finger (hold to drive, slide to steer, pull down to brake) with the other thumb on the handbrake.

## Declarations

- [x] Every 3D object is Three.js code written through the recipe; nothing is a mesh or a vertex array smuggled in as data. (`harness/ship.mjs` flags nothing in the folder.)
- [x] Images and sound are from Atlas on jam credits, or my own, listed in the entry file. (There are none: every texture and every sound is generated in code at load; the only files the page loads besides its own are Three.js from jsdelivr and subsets of Google Fonts.)
- [x] The source repo is public and its first commit is on or after 11 Sep 2026 00:00 UTC. (First commit 22 Sep 2026 00:15 UTC.)
- [x] Nothing here copies a 404 reference game's assets or code. (The three harness files `assetlib.js`, `surfaces.js`, `rig.js` are copied in as the recipe instructs.)
- [x] I have read the rules in README.md and I am eligible.
