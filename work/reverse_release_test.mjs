// Backing away from something: S held with the wheel over, then S let go (and W, or nothing, or the wheel
// straightened). The car should just stop backing up and carry on: no J-turn, no whip round, no dead stop.
// And a real J-turn (reverse straight, let go, then flick and hold) must still happen.
//   node work/reverse_release_test.mjs [path/to/car.js]
const arg = process.argv.find((a) => a.endsWith('.js') && !a.endsWith('reverse_release_test.mjs'));
const src = arg ? new URL('file:///' + arg.replace(/\\/g, '/')) : new URL('../game/src/car.js', import.meta.url);
const { Car } = await import(src.href);
const deg = (r) => (r * 180) / Math.PI;
function run(label, revSecs, steerWhileRev, after, afterSteer, flickDelay = 0, flickSecs = 9) {
  const car = new Car(); car.reset(0, 0, 0);
  const dt = 1 / 60; let kSteer = 0, jt = false, yawRel = 0, vRel = 0, maxW = 0, minSpeed = 99, dead = 0, prevSpeed = 0;
  for (let i = 0; i < 60 * 5; i++) {
    const t = i * dt;
    const rev = t < revSecs;
    let key = rev ? steerWhileRev : (t >= revSecs + flickDelay && t < revSecs + flickDelay + flickSecs ? afterSteer : 0);
    const rate = key !== 0 ? 7.2 : 12;
    kSteer += Math.max(-rate * dt, Math.min(rate * dt, key - kSteer));
    const inp = { throttle: !rev && after === 'W' ? 1 : 0, brake: rev ? 1 : 0, steer: kSteer, hand: 0, reverse: rev, touch: false, line: { curv: 0, here: 0 } };
    if (!rev && !vRel) { vRel = car.speed; yawRel = car.yaw; }
    car.step(dt, inp, 1);
    if (car.jt) jt = true;
    if (!rev) { maxW = Math.max(maxW, Math.abs(car.omega)); minSpeed = Math.min(minSpeed, car.speed); }
    if (!rev && prevSpeed - car.speed > 0.3) dead++;   // more than 18 m/s^2 in one frame
    prevSpeed = car.speed;
  }
  console.log(`${label.padEnd(58)} at ${(vRel * 2.237).toFixed(0).padStart(2)} mph: J-turn ${jt ? 'YES' : 'no '}  turned ${deg(car.yaw - yawRel).toFixed(0).padStart(5)} deg after let-go, peak yaw ${maxW.toFixed(2)} rad/s, hard-stop frames ${dead}, ends ${(car.vF * 2.237).toFixed(0)} mph`);
}
for (const T of [0.7, 1.2, 2.0]) {
  run(`S+A ${T}s, let go of both`, T, 1, 'none', 0);
  run(`S+A ${T}s, let go of S, keep A`, T, 1, 'none', 1);
  run(`S+A ${T}s, let go of S, W + keep A`, T, 1, 'W', 1);
  run(`S+A ${T}s, let go of S, W + D (wheel the other way)`, T, 1, 'W', -1);
  run(`S ${T}s straight, let go, W`, T, 0, 'W', 0);
}
console.log('-- J-turns that must still happen');
for (const T of [1.2, 2.0, 4.0]) {
  run(`S ${T}s straight, let go, flick A and hold`, T, 0, 'none', 1);
  run(`S ${T}s straight, let go, flick A and hold + W`, T, 0, 'W', 1);
  run(`S ${T}s straight, let go, 0.1 s later flick D + W`, T, 0, 'W', -1, 0.1);
}
console.log('-- a quick correction right after letting go');
for (const T of [1.2, 2.0]) run(`S ${T}s straight, let go, W, tap A 0.12 s`, T, 0, 'W', 1, 0, 0.12);
