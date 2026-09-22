// hero_coupe — arm B: profiles. The hull is the side-view silhouette (bonnet, belt, boot,
// tail, both arches as real arcs) drawn as a Shape and extruded across the doors; bumpers,
// bands, the splitter and the tail panel are plan polygons built from the nose and tail
// paths and extruded upward; the flares are the box-flare outline with an absarc opening;
// the wing is an aerofoil section extruded across. Bevels are never enabled and no
// extrusion is warped. Wheels are revolved loops, tread blocks and calipers partial lathes.
// Nose = +Z, base y = 0. Body 1.72 W x 1.28 H x 4.45 L (mirrors stand outside the body).
//
// Moving parts: g.userData.joints = { hubFL, hubFR, wheelFL, wheelFR, wheelRL, wheelRR }.
// A hub is a Group at the wheel centre (steer about y, camber baked into rotation.z) and
// carries the brake disc and caliper; its child wheel Group (spin about x) carries the
// tyre, rim and lug nuts. Everything static is under the Group named 'body'.
