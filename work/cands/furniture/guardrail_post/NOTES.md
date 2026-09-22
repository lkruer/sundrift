# guardrail_post — notes

- Winner: **B** (profile route: C-channel as one extruded C Shape, extruded I-section spacer, lathe reflector and hex bolts). 336 triangles, measured 0.16 x 0.75 x 0.14 m (plate 0.16 wide and post 0.06 + spacer 0.08 deep, both inside the 0.2 tolerance of the brief's 0.14 x 0.12).
- Why B: from the sides and the three-quarter view the I-section spacer reads as a real bracket with flanges, where A and C's plain block spacer is just a bump; the domed lathe reflector catches a highlight instead of rendering as a flat disc.
- A (boxes, 264 tris) and C (lipped channel with gussets and a backing plate, 276 tris) both pass and read as the object, but at this scale the lips, gussets and backing plate are invisible, so C spends parts on nothing, and A is B without the bracket read.
- After the first render B's channel recess was almost invisible from the back (web 0.03 thick, recess 0.03 deep), so the profile was redrawn with a 0.02 web and 0.015 flanges, giving a 0.07 x 0.04 recess; the cap was trimmed from 0.064 to 0.06 deep so the depth is 0.14 rather than 0.142.
- Dark cap on the open channel top and dark bolt heads are the style lock's "strong dark line"; they are the only parts not named in the brief. Reflector is tail red with emissive 0.6 as the brief says. All steel is one `metal` material.
- Note for placement: the asset is centred on its bounding box, so the post axis sits at z about -0.04 (the spacer and reflector are on +Z, the road side).
