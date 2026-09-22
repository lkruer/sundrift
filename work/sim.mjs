// Drives the car model with scripted inputs and prints what it does, so the drift feel can be tuned by
// numbers before anyone drives it. node work/sim.mjs
import { Car, CAR } from '../game/src/car.js';

const deg = (r) => (r * 180 / Math.PI).toFixed(0).padStart(4);
const f1 = (v) => v.toFixed(1).padStart(6);

function run(name, secs, inputAt, start = {}) {
  const car = new Car();
  car.reset(0, 0, 0);
  if (start.kmh) car.vF = start.kmh / 3.6;
  const dt = 1 / 120;
  const rows = [];
  let maxBeta = 0, spun = false, t = 0;
  for (let i = 0; i < secs * 120; i++) {
    t = i * dt;
    const inp = { throttle: 0, brake: 0, steer: 0, hand: 0, reverse: false, touch: false, ...inputAt(t, car) };
    car.step(dt, inp, 1);
    maxBeta = Math.max(maxBeta, Math.abs(car.beta));
    if (Math.abs(car.beta) > 1.5) spun = true;
    if (i % 30 === 0) rows.push(`  t ${t.toFixed(2).padStart(5)}  kmh ${f1(car.kmh)}  beta ${deg(car.beta)}  yawRate ${deg(car.omega)}/s  steer ${deg(car.steer)}  aR ${deg(car.alphaR)}  slipR ${car.slipRear.toFixed(2)}  x ${f1(car.x)} z ${f1(car.z)}`);
  }
  console.log(`\n== ${name}   maxBeta ${deg(maxBeta)} deg   ${spun ? 'SPUN' : 'held'}   final ${f1(car.kmh)} km/h`);
  console.log(rows.join('\n'));
}

run('A straight, full throttle', 12, () => ({ throttle: 1 }));
run('B grip turn: 70 km/h, full left, throttle', 4, () => ({ throttle: 1, steer: 1 }), { kmh: 70 });
run('B2 grip turn: 110 km/h, full left, throttle', 4, () => ({ throttle: 1, steer: 1 }), { kmh: 110 });
run('C handbrake init 80 km/h, then throttle, assist only', 5,
    (t) => (t < 0.5 ? { hand: 1, steer: 1, throttle: 0 } : { throttle: 1, steer: 0 }), { kmh: 80 });
run('D handbrake init, then throttle + player counter-steer 0.6', 5,
    (t) => (t < 0.5 ? { hand: 1, steer: 1, throttle: 0 } : { throttle: 1, steer: -0.6 }), { kmh: 80 });
run('D2 handbrake init, then throttle + steer INTO the drift 0.5 (more angle)', 5,
    (t) => (t < 0.5 ? { hand: 1, steer: 1, throttle: 0 } : { throttle: 1, steer: 0.5 }), { kmh: 80 });
run('E flick at 90: steer right 0.4 s, then hard left + throttle', 5,
    (t) => (t < 0.4 ? { steer: -1, throttle: 0.3 } : { steer: 1, throttle: 1 }), { kmh: 90 });
run('F lift-off: 100 km/h, brake 0.5 s + full left, then throttle', 5,
    (t) => (t < 0.5 ? { brake: 1, steer: 1 } : { throttle: 1, steer: 0.3 }), { kmh: 100 });
run('G braking from 120', 5, () => ({ brake: 1 }), { kmh: 120 });
