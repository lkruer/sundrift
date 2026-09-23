// Wedged against a wall, got out the way a player (and the jam gate's driver) does: throttle and steer for the road;
// stopped for 1.2 s, reverse for 1.3 s with the wheel turned the other way, then throttle again. How long until
// the car is driving along the road, and how many times did it have to back out?
//   node work/unstick_test.mjs [path/to/car.js]
const arg = process.argv.find((a) => a.endsWith('.js') && !a.endsWith('unstick_test.mjs'));
const src = arg ? new URL('file:///' + arg.replace(/\\/g, '/')) : new URL('../game/src/car.js', import.meta.url);
const { Car } = await import(src.href);
const K = 0.75;
const CORNERS = [[0.97 * K, 2.08 * K], [-0.97 * K, 2.08 * K], [0.97 * K, -2.12 * K], [-0.97 * K, -2.12 * K]];
const WALL = 5.5;                       // walls at x = +-5.5, the road along +z
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
function run(ang, touch, v0 = 0) {
  const car = new Car();
  const yaw = ang * Math.PI / 180;
  car.reset(WALL - 1.6 * Math.abs(Math.sin(yaw)) - 0.05, 0, yaw);
  car.vF = v0;
  const dt = 1 / 60; let t = 0, kSteer = 0, stuckSince = -1, reverseUntil = -1, backs = 0, freeAt = null, stall = 0, spins = 0, lastYaw = yaw, turned = 0;
  for (let i = 0; i < 60 * 14; i++) {
    t += dt;
    const kmh = car.speed * 3.6;
    const headErr = wrap(0 - car.yaw);
    const cmd = headErr * 1.3 - car.x * 0.12;
    const want = { gas: true, brake: false, left: cmd > 0.05, right: cmd < -0.05 };
    if (kmh < 4 && t > 1.4) { if (stuckSince < 0) stuckSince = t; } else if (kmh > 8) stuckSince = -1;
    if (stuckSince >= 0 && t - stuckSince > 1.2) { reverseUntil = t + 1.3; stuckSince = -1; backs++; }
    if (t < reverseUntil) { want.gas = false; want.brake = true; want.left = cmd < 0; want.right = cmd > 0; }
    const key = (want.left ? 1 : 0) - (want.right ? 1 : 0);
    if (touch) kSteer = key; else { const rate = key !== 0 ? 7.2 : 12; kSteer += Math.max(-rate * dt, Math.min(rate * dt, key - kSteer)); }
    car.step(dt, { throttle: want.gas ? 1 : 0, brake: want.brake ? 1 : 0, steer: kSteer, hand: 0, reverse: want.brake, touch, line: { curv: 0, here: 0 } }, 1);
    for (const [l, f] of CORNERS) {
      const [cx] = car.point(l, f);
      if (cx > WALL) car.hitWall(-1, 0, cx - WALL, l, f);
      if (cx < -WALL) car.hitWall(1, 0, -WALL - cx, l, f);
    }
    turned += wrap(car.yaw - lastYaw); lastYaw = car.yaw;
    if (kmh < 3 && t > 2.8) stall++;
    if (freeAt === null && car.vF > 5 && Math.abs(wrap(car.yaw)) < 0.45) freeAt = t;
  }
  return `${touch ? 'touch' : 'keys '} nose ${String(ang).padStart(3)} deg in: ${freeAt === null ? 'NOT free after 14 s' : 'free after ' + freeAt.toFixed(1) + ' s'}, backed out ${backs}x, stalled ${(stall / 60).toFixed(1)} s, turned ${(turned * 180 / Math.PI).toFixed(0)} deg in all, ends ${(car.vF * 2.237).toFixed(0)} mph heading ${(wrap(car.yaw) * 180 / Math.PI).toFixed(0)}`;
}
for (const touch of [false, true]) for (const ang of [30, 60, 85, 120, 150]) console.log(run(ang, touch));
