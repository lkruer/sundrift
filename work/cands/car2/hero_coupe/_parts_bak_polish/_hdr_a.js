// hero_coupe — arm A: primitives. Every body mass is a BoxGeometry whose vertices are
// re-written after construction (taper in plan, crown across the top, shear for the
// glasshouse rake, the nose and tail corners pulled back by a plan function); the flares
// are seven slabs each, the wing a thinned box on slab uprights, the shut lines thin boxes
// lifted onto the skin. Wheels are revolved loops, tread blocks and calipers partial lathes.
// Nose = +Z, base y = 0. Body 1.72 W x 1.28 H x 4.45 L (mirrors stand outside the body).
//
// Moving parts: g.userData.joints = { hubFL, hubFR, wheelFL, wheelFR, wheelRL, wheelRR }.
// A hub is a Group at the wheel centre (steer about y, camber baked into rotation.z) and
// carries the brake disc and caliper; its child wheel Group (spin about x) carries the
// tyre, rim and lug nuts. Everything static is under the Group named 'body'.
