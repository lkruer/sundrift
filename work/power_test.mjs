// Power and traction: can the throttle break the rear loose and hold it there (donuts, power oversteer out of a
// drift), without the car spinning on its own on a straight or in a fast bend?
//   node work/power_test.mjs [-v]
import { Car } from '../game/src/car.js';
const deg = (r) => (r * 180) / Math.PI;
const inp0 = { throttle: 0, brake: 0, steer: 0, hand: 0, reverse: false, touch: false, line: { curv: 0, here: 0 } };

function sim(label, seconds, control, setup) {
  const car = new Car(); car.reset(0, 0, 0);
  if (setup) setup(car);
  const dt = 1 / 60; let yaw0 = car.yaw, maxB = 0, spins = 0, lastYaw = car.yaw, turned = 0;
  const trace = [];
  const W = []; // yaw rate over the last 5 s
  for (let i = 0; i < seconds * 60; i++) {
    const t = i * dt;
    const inp = { ...inp0, ...control(t, car) };
    car.step(dt, inp, 1);
    const dy = car.yaw - lastYaw; lastYaw = car.yaw; turned += dy;
    maxB = Math.max(maxB, Math.abs(car.beta));
    if (t > seconds - 5) W.push(Math.abs(car.omega));
    if (process.argv.includes('-v') && i % 30 === 0) trace.push(`    t ${t.toFixed(1)} v ${car.speed.toFixed(1)} beta ${deg(car.beta).toFixed(0)} omega ${car.omega.toFixed(2)} steer ${deg(car.steer).toFixed(0)}`);
  }
  const wAvg = W.length ? W.reduce((a, b) => a + b, 0) / W.length : 0;
  const r = { label, turns: +(Math.abs(turned) / (2 * Math.PI)).toFixed(2), yawRateLast5: +wAvg.toFixed(2), maxBetaDeg: Math.round(deg(maxB)), endKmh: Math.round(car.speed * 3.6), endBetaDeg: Math.round(deg(car.beta)) };
  console.log(JSON.stringify(r));
  if (trace.length) console.log(trace.join('\n'));
  return r;
}

// 1. donuts: from rest, full lock and full throttle for 10 s (keyboard: A held, W held)
sim('donut left, from rest', 10, () => ({ steer: 1, throttle: 1 }));
sim('donut right, from rest', 10, () => ({ steer: -1, throttle: 1 }));
// 1b. a donut started with a handbrake flick at 25 km/h, then full lock + full throttle
sim('donut, handbrake start', 10, (t) => ({ steer: 1, throttle: t < 0.4 ? 0.3 : 1, hand: t < 0.4 ? 1 : 0 }), (c) => { c.vF = 7; });
// 2. power oversteer out of a drift: a handbrake-started slide, straightened, then full throttle with the wheel
//    straight: does the power re-break the rear (the slide grows again) or does it just drive out?
sim('exit: straight wheel, full throttle', 4, (t) => (t < 0.35 ? { steer: 1, hand: 1, throttle: 0.4 } : { steer: 0, throttle: 1 }), (c) => { c.vF = 14; });
sim('exit: wheel into the bend, full throttle', 4, (t) => (t < 0.35 ? { steer: 1, hand: 1, throttle: 0.4 } : { steer: 0.5, throttle: 1 }), (c) => { c.vF = 14; });
// 3. the checks: a straight at full throttle, and a fast bend on the throttle, must not spin the car
sim('straight, full throttle 8 s', 8, () => ({ throttle: 1 }));
sim('fast bend, 0.35 lock, full throttle', 5, () => ({ steer: 0.35, throttle: 1 }), (c) => { c.vF = 25; });
sim('city speed bend, 0.6 lock, full throttle', 5, () => ({ steer: 0.6, throttle: 1 }), (c) => { c.vF = 14; });
