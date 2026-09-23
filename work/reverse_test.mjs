// Backing up fast with S held: taps and holds of the wheel. No J-turn may start, and the car must stay
// controllable (the yaw follows the wheel and stops when it is let go). With S released: a J-turn.
// node work/reverse_test.mjs
import { Car } from '../game/src/car.js';
const deg = (r) => r * 180 / Math.PI;
function run(revSecs, tap, holdS) {
  const car = new Car(); car.reset(0, 0, 0);
  const dt = 1 / 60; let steer = 0, started = false, vAt = 0, maxW = 0, yawAtRel = null;
  for (let i = 0; i < 60 * 6; i++) {
    const t = i * dt;
    const key = t >= revSecs && t < revSecs + tap ? 1 : 0;
    const rate = key !== 0 ? 7.2 : 12;
    steer += Math.max(-rate * dt, Math.min(rate * dt, key - steer));
    const rev = t < revSecs || holdS;
    const inp = { throttle: !rev && t >= revSecs ? 1 : 0, brake: rev ? 1 : 0, steer, hand: 0, reverse: rev, touch: false, line: { curv: 0 } };
    if (t >= revSecs && !vAt) vAt = -car.vF;
    car.step(dt, inp, 1);
    if (car.jt) started = true;
    if (t >= revSecs) maxW = Math.max(maxW, Math.abs(car.omega));
    if (yawAtRel === null && t >= revSecs + tap) yawAtRel = deg(car.yaw);
  }
  return `reverse ${(vAt * 2.237).toFixed(0)} mph, wheel ${tap}s, S ${holdS ? 'held' : 'released'}: J-turn ${started ? 'YES' : 'no '}, yaw at let-go ${yawAtRel.toFixed(0)}, final yaw ${deg(car.yaw).toFixed(0)}, peak yaw rate ${maxW.toFixed(2)} rad/s, final speed ${(car.vF * 2.237).toFixed(0)} mph`;
}
for (const revSecs of [1.5, 4]) for (const tap of [0.12, 0.25, 0.5, 1.0]) console.log(run(revSecs, tap, true));
for (const revSecs of [1.0, 1.5, 4]) for (const tap of [0.25, 0.5, 1.0]) console.log(run(revSecs, tap, false));
