// Does the wheel ever point against the key the player is holding? And with the key held into a deep, fast turn,
// does the car still stay out of a spin?   node work/steer_test.mjs [path/to/car.js]
const src = process.argv[2] ? new URL('file:///' + process.argv[2].replace(/\\/g, '/')) : new URL('../game/src/car.js', import.meta.url);
const { Car } = await import(src.href);
const deg = (r) => (r * 180) / Math.PI;
const line = { curv: 0, here: 0 };

function run(label, seconds, control, setup, touch = false) {
  const car = new Car(); car.reset(0, 0, 0);
  if (setup) setup(car);
  const dt = 1 / 60; let against = 0, held = 0, maxB = 0, spun = false, minAgainst = 0;
  for (let i = 0; i < seconds * 60; i++) {
    const t = i * dt, c = control(t, car);
    const inp = { throttle: 0, brake: 0, steer: 0, hand: 0, reverse: false, touch, line, ...c };
    car.step(dt, inp, 1);
    if (Math.abs(inp.steer) > 0.3 && car.speed > 4) {
      held++;
      // the wheels pointing the other way from the key, by more than a degree
      if (car.steer * Math.sign(inp.steer) < -0.017) { against++; minAgainst = Math.min(minAgainst, car.steer * Math.sign(inp.steer)); }
    }
    maxB = Math.max(maxB, Math.abs(car.beta));
    if (Math.abs(car.beta) > 1.75) spun = true;
  }
  console.log(`${label.padEnd(48)} wheels against the key ${held ? ((100 * against) / held).toFixed(0).padStart(3) : '  -'}% of the time (worst ${deg(-minAgainst).toFixed(0)} deg)  max slip ${deg(maxB).toFixed(0).padStart(3)} deg  ${spun ? 'SPUN' : 'no spin'}  end ${car.kmh.toFixed(0)} km/h`);
}

for (const touch of [false, true]) {
  const tag = touch ? 'touch' : 'keys ';
  // a fast, deep turn: full lock at speed on the throttle, the rear stepping out
  run(`${tag} fast deep turn, 110 km/h, full lock 2.5 s`, 3, (t) => ({ steer: t < 2.5 ? 1 : 0, throttle: 0.8 }), (c) => { c.vF = 30.5; }, touch);
  run(`${tag} fast deep turn, 80 km/h, full lock 2.5 s`, 3, (t) => ({ steer: t < 2.5 ? 1 : 0, throttle: 1 }), (c) => { c.vF = 22; }, touch);
  // a drift with the key held into the turn throughout (after a handbrake flick)
  run(`${tag} drift, key held INTO the turn 3 s`, 3.5, (t) => ({ steer: t < 3 ? 1 : 0, throttle: t < 0.35 ? 0.4 : 1, hand: t < 0.35 ? 1 : 0 }), (c) => { c.vF = 20; }, touch);
  // the classic: flick, then let go of the key (the catch holds the slide)
  run(`${tag} drift, flick then keys off`, 3.5, (t) => ({ steer: t < 0.35 ? 1 : 0, throttle: t < 0.35 ? 0.4 : 1, hand: t < 0.35 ? 1 : 0 }), (c) => { c.vF = 20; }, touch);
  // a drift held with counter-steer (the key the way the car is travelling)
  run(`${tag} drift, flick then counter-steer`, 3.5, (t) => ({ steer: t < 0.35 ? 1 : t < 3 ? -0.6 : 0, throttle: t < 0.35 ? 0.4 : 1, hand: t < 0.35 ? 1 : 0 }), (c) => { c.vF = 20; }, touch);
}
