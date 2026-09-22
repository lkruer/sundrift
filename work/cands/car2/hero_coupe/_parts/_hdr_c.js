// hero_coupe — a hand-built loft hull (sixteen-point rings skinned into one surface, the
// glasshouse a second material group inside the same skin) carrying every fitting as its own
// part. Behind the rear arch the rings pinch in plan, round their corners and lean, so the tail
// is short, tapered and ends in a ducktail lip over a rear face (the loft's back cap) undercut
// 20 degrees; a thin lip, a finned diffuser and a swan-neck wing sit on it. The front bumper,
// splitter and lamp band are bands swept along a plan path; flares are a four-point loop swept
// around each arch; shut lines and the rear garnish are strips lofted along the skin; tyres,
// rims, discs, helmet and torso are revolved loops; tread blocks, calipers and the binnacle
// hood are partial lathes. Nose = +Z, base y = 0. Body 1.72 W x 1.28 H, about 4.3 L.
//
// Moving parts: g.userData.joints = { hubFL, hubFR, wheelFL, wheelFR, wheelRL, wheelRR }.
// A hub is a Group at the wheel centre (steer about y, camber baked into rotation.z) and
// carries the brake disc and caliper; its child wheel Group (spin about x) carries the
// tyre, rim and lug nuts. Everything static is under the Group named 'body'.
