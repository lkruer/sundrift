// Nose into a wall at a standstill, then throttle and steer away: does the car get out without reversing?
import { Car } from '../game/src/car.js';
const K = 0.75;
const CORNERS = [[0.97 * K, 2.08 * K], [-0.97 * K, 2.08 * K], [0.97 * K, -2.12 * K], [-0.97 * K, -2.12 * K]];
for (const ang of [30, 50, 70, 85]) {
  const car = new Car();
  // road along +z, left wall at x = +5.5 (left is +x), the car pointing left of the road by ang degrees, nose at the wall
  const yaw = ang * Math.PI / 180;
  car.reset(5.5 - 1.6 * Math.sin(yaw) - 0.05, 0, yaw);
  let t = 0, out = null;
  for (let i = 0; i < 360; i++) {
    const dt = 1 / 60; t += dt;
    car.step(dt, { throttle: 1, brake: 0, steer: -1, hand: 0, reverse: false, touch: false, line: { curv: 0 } }, 1);
    for (const [l, f] of CORNERS) {
      const [cx] = car.point(l, f);
      if (cx > 5.5) car.hitWall(-1, 0, cx - 5.5, l, f);
    }
    const along = Math.abs(((car.yaw + Math.PI) % (2 * Math.PI)) - Math.PI) * 180 / Math.PI;
    if (!out && car.vF > 4 && along < 25) out = t;
  }
  console.log(`nose ${ang} deg into the wall: ${out ? 'drives away along the road after ' + out.toFixed(2) + ' s' : 'STUCK'} (final ${car.kmh.toFixed(0)} km/h, heading ${(car.yaw * 57.3).toFixed(0)} deg, x ${car.x.toFixed(2)})`);
}
