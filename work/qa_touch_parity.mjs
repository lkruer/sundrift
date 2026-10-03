// Keys against the thumb. The same drift (a handbrake flick at 80 km/h, then the wheel held into the turn and the gas)
// asked for by a key (A: the wheel ramps to full lock in 0.14 s, input.js) and by a thumb held still at a share of the
// stick's reach (input.js: past 3 px of dead centre, steer = 0.45 n + 0.55 n^2 of the slide past it), with the game's
// assist for each (CAR.assist on keys, CAR.assistTouch on a touch). How deep does the slide hold, and what does it
// score a second (scoring.js), at each thumb position?
//   node work/qa_touch_parity.mjs [path/to/car.js]
const arg = process.argv.find((a) => a.endsWith('.js') && !a.endsWith('qa_touch_parity.mjs'));
const src = arg ? new URL('file:///' + arg.replace(/\\/g, '/')) : new URL('../game/src/car.js', import.meta.url);
const { Car } = await import(src.href);
const { Scoring } = await import(new URL('../game/src/scoring.js', import.meta.url).href);
const deg = (r) => (r * 180) / Math.PI;
const R = 70;   // the reach on a 390 px phone (input.js: 18% of the short side, 62..84 px)
const thumb = (px) => { const n = Math.max(0, Math.abs(px) - 3) / (R - 3); return Math.sign(px) * Math.min(1, 0.45 * n + 0.55 * n * n); };

function drift(steerOf, touch, secs = 5, v0 = 22) {
  const car = new Car(); car.reset(0, 0, 0); car.vF = v0;
  const sc = new Scoring();
  const dt = 1 / 60; let t = 0, sum = 0, n = 0, s0 = 0, n0 = 0;
  for (let i = 0; i < secs * 60; i++) {
    const steer = steerOf(t);
    car.step(dt, { throttle: t < 0.3 ? 0.3 : 1, brake: 0, steer, hand: t < 0.3 ? 1 : 0, reverse: false, touch, line: { curv: 0, here: 0 } }, 1);
    sc.update(dt, car, 0, false);
    t += dt;
    if (t > 1.5) { sum += Math.abs(car.beta); n++; }
    // (the window the in-game test measures, work/qa_touch_game.mjs: before the slide's own turn crosses the road)
    if (t > 0.6 && t < 1.8) { s0 += Math.abs(car.beta); n0++; }
  }
  const pts = sc.points + sc.total;
  return { held: deg(sum / n), settle: deg(s0 / n0), pps: pts / secs, v: car.speed * 3.6 };
}

let kSteer = 0;
const key = (t) => { kSteer = t === 0 ? 0 : kSteer; kSteer = Math.min(1, kSteer + 7.2 / 60); return kSteer; };
const K = drift((t) => { if (t === 0) kSteer = 0; kSteer = Math.min(1, kSteer + 7.2 / 60); return kSteer; }, false);
console.log(`keys: A held                       settles ${K.settle.toFixed(0).padStart(3)} deg, holds ${K.held.toFixed(0).padStart(3)} deg  ${K.pps.toFixed(0).padStart(5)} pts/s  ends ${K.v.toFixed(0)} km/h`);
const Kt = drift((t) => { if (t === 0) kSteer = 0; kSteer = Math.min(1, kSteer + 7.2 / 60); return kSteer; }, true);
console.log(`keys, touch assist (a phone with a keyboard)  holds ${Kt.held.toFixed(0).padStart(3)} deg  ${Kt.pps.toFixed(0).padStart(5)} pts/s`);
console.log('thumb held still, out to the side by (settles: mean slip 0.6-1.8 s; holds: 1.5-5 s, as the car gathers speed):');
for (const px of [15, 25, 31, 35, 40, 45, 50, 55, 60, 70]) {
  const s = thumb(px);
  const r = drift((t) => (t < 0.02 ? 0 : s), true);
  console.log(`  ${String(px).padStart(3)} px (${(px / R * 100).toFixed(0).padStart(3)}% of the reach, wheel ${s.toFixed(2)})   settles ${r.settle.toFixed(0).padStart(3)} deg, holds ${r.held.toFixed(0).padStart(3)} deg  ${r.pps.toFixed(0).padStart(5)} pts/s  (${(r.pps / K.pps * 100).toFixed(0).padStart(3)}% of the key)  ends ${r.v.toFixed(0)} km/h`);
}
