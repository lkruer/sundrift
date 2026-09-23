// J-turns: reverse up to speed, full lock with the reverse released, then drive away. Does the car come round
// cleanly, facing the way it was travelling, and leave on (roughly) the same line?
import { Car } from '../game/src/car.js';
const deg = (r) => r * 180 / Math.PI;
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
function run(label, revSecs, steerSecs, steer = 1, withBrakeTap = false, gasInTurn = 0) {
  const car = new Car(); car.reset(0, 0, 0);
  const dt = 1 / 60; let t = 0, peakRev = 0, turnDone = null;
  const log = [];
  for (let i = 0; i < 60 * 9; i++) {
    t = i * dt;
    let inp = { throttle: 0, brake: 0, steer: 0, hand: 0, reverse: false, touch: false, line: { curv: 0 } };
    if (t < revSecs) inp = { ...inp, brake: 1, reverse: true };
    else if (t < revSecs + steerSecs) inp = { ...inp, steer, throttle: gasInTurn, hand: withBrakeTap && t < revSecs + 0.2 ? 1 : 0 };
    else inp = { ...inp, throttle: 1 };
    car.step(dt, inp, 1);
    peakRev = Math.max(peakRev, -car.vF);
    const vx = Math.sin(car.yaw) * car.vF + Math.cos(car.yaw) * car.vL, vz = Math.cos(car.yaw) * car.vF - Math.sin(car.yaw) * car.vL;
    const travel = Math.atan2(vx, vz);
    if (!turnDone && t > revSecs && car.vF > 3 && Math.abs(wrap(car.yaw - Math.PI)) < 0.35) turnDone = t - revSecs;
    if (i % 30 === 0 && t > revSecs - 0.6 && t < revSecs + steerSecs + 2.2) log.push(`    t ${t.toFixed(1)}  yaw ${deg(wrap(car.yaw)).toFixed(0).padStart(5)}  vF ${car.vF.toFixed(1).padStart(6)}  vL ${car.vL.toFixed(1).padStart(5)}  travel ${deg(travel).toFixed(0).padStart(5)}  steer ${deg(car.steer).toFixed(0).padStart(4)}`);
  }
  const lateral = car.x;   // started on x = 0 reversing along -z; a clean J-turn leaves along -z near x = 0
  console.log(`${label}: peak reverse ${(peakRev * 3.6).toFixed(0)} km/h; ${turnDone ? 'turned round and driving forward after ' + turnDone.toFixed(2) + ' s' : 'NO clean turn'}; final heading ${deg(wrap(car.yaw)).toFixed(0)} deg (180 = reversed), ${car.kmh.toFixed(0)} km/h, drifted ${lateral.toFixed(1)} m sideways`);
  if (process.argv.includes('-v')) console.log(log.join('\n'));
}
run('J-turn, 4 s reverse, 0.9 s full lock', 4, 0.9);
run('J-turn, 4 s reverse, 0.6 s full lock', 4, 0.6);
run('J-turn, 4 s reverse, 1.2 s full lock', 4, 1.2);
run('J-turn right, 4 s reverse, 0.9 s', 4, 0.9, -1);
run('J-turn, 2 s reverse (slower), 1.1 s full lock', 2, 1.1);
run('J-turn with a handbrake tap', 4, 0.9, 1, true);
run('J-turn, flick + gas (the game way)', 4, 0.9, 1, false, 1);
run('J-turn right, flick + gas', 4, 0.9, -1, false, 1);
run('J-turn, short 0.5 s flick + gas', 4, 0.5, 1, false, 1);
run('J-turn from 2 s of reverse, flick + gas', 2, 0.9, 1, false, 1);
