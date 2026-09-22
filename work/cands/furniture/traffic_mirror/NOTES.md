# traffic_mirror — notes

- Winner: **B** (profile route: pole and base flange as one lathe, convex face as a lathe of a circular-arc profile, rim as a lathe of a 0.06 x 0.05 rectangular section, back as a lathe parabolic dish, hood as an extruded annular-sector Shape). 1292 triangles, measured 0.92 x 2.624 x 0.527 m.
- Why B: its rim is a crisp flat band and its hood a thin curved visor projecting forward over the top third, which is what a Japanese curve mirror looks like; A's torus rim and torus-sector hood read as a fat rubber bead and a rolled bar, and C's open-shell hood with a lip is thinner than the style lock likes.
- What changed after the render: the verifier flagged B's back face as featureless (a smooth dark dish behind a busy rim/hood front). A stepped galvanised mounting boss and two strap bars were added on the back of the dish, which is also what the real thing has; the second run was clean. A (848 tris) and C (714 tris) passed first time.
- Tilt checked: rotation.x = +12 degrees on the mirror sub-group pitches the face down toward the road (the top of the rim moves toward +Z), visible in the side views of the sheet.
- The mirror face is galvanised colour at metalness 0.85 / roughness 0.15 and unnamed; it renders dark in the verifier because there is no environment map, and will reflect the sky in the game. Pole and bracket are `metal`; rim and hood vermilion; back dish chrome dark.
- Placement note: the pole axis sits at z about -0.14 after centring, the mirror face at about +0.1.
