# lamp_post — notes

- Winner: **B** (profile route: the whole column as one 12-sided lathe with foot collar and cap, arm as a TubeGeometry along a QuadraticBezierCurve3, head and lens as extruded rounded-rectangle Shapes with no bevel, door as an extruded frame with a hole). 944 triangles, measured 1.59 x 6.0 x 0.36 m.
- Why B: the continuous Bezier arm is the only one of the three that reads as a Japanese cobra-head road lamp at a glance; A's three cylinder segments with sphere knuckles show as a kinked arm in the front view, and C's quarter-torus elbow plus strut reads as a braced industrial bracket rather than a curved arm. B's head is rounded in plan as the brief asks; A's is a stepped box, C's a pill.
- A (692 tris) and C (872 tris, height 6.035 with its photocell dome) both pass and would be usable; nothing was wrong with them beyond the arm silhouette.
- Nothing changed after the render: all three passed first time, the arm reaches +X (right-hand side in the front view), the lens sits under the head, the door sits at 1.0 m on +Z.
- Width: the brief's 1.4 m reach plus a 0.62 m head would make the object 1.89 m wide against a 1.6 m brief, so the arm's end is at x = 1.0 and the head's outer end at 1.41, giving 1.59 m overall.
- Placement note: the asset is centred on its bounding box, so the column axis sits at x about -0.70 and the head at about +0.40; a level that wants the column on the kerb line offsets by +0.70.
- Column, arm, plate and bolts are one `metal` material; the head is chrome dark; the lens is lamp warm with emissive 0xffcf7a at 1.2 and left unnamed.
