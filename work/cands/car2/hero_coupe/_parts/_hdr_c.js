// hero_coupe — arm C: a hand-built loft hull (ten 12-point stations skinned into one
// surface, the glasshouse a second material group inside the same skin) carrying every
// fitting as its own part. Bumpers, lip, lamp band, tail panel and skirts are bands
// SWEPT along a plan path so they follow the nose and tail corners; flares are a
// four-point loop swept around each arch; shut lines are thin dark strips lofted along
// the hull's own surface; tyres, rims, discs, helmet and torso are revolved loops;
// tread blocks, calipers and the binnacle hood are partial lathes.
// Nose = +Z, base y = 0. Body 1.72 W x 1.28 H x 4.45 L (mirrors stand outside the body).
//
// Moving parts: g.userData.joints = { hubFL, hubFR, wheelFL, wheelFR, wheelRL, wheelRR }.
// A hub is a Group at the wheel centre (steer about y, camber baked into rotation.z) and
// carries the brake disc and caliper; its child wheel Group (spin about x) carries the
// tyre, rim and lug nuts. Everything static is under the Group named 'body'.