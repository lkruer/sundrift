// A wiggle that holds a lane (car sim, open ground, the road along +z): the key thrown left and right on a fast rhythm,
// each side held a little longer or shorter by the heading error filtered over about a swing and the distance from the
// middle of the lane. Searches the gains for the tightest wiggle that keeps its rhythm, and prints what it scores.
//   node work/qa_wiggle_tune.mjs
import { Car } from '../game/src/car.js';
import { Scoring } from '../game/src/scoring.js';
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function wiggle(car, st, dt, { H = 0.35, Kh = 2.5, Ku = 0.08, tau = 0.7, u = car.x, head = 0 }) {
  const travel = car.yaw + Math.atan2(car.vL, Math.max(1, car.vF));
  const e = wrap(travel - head);
  st.ef = (st.ef ?? 0) + (e - (st.ef ?? 0)) * Math.min(1, dt / tau);
  // d > 0: hold the right longer (the car is heading left of the road, or is left of the middle)
  const d = Math.max(-0.6, Math.min(0.6, Kh * st.ef + Ku * u));
  st.phT = (st.phT ?? 0) + dt;
  st.side = st.side ?? 1;
  const len = H * (1 + (st.side < 0 ? d : -d));
  if (st.phT > len) { st.side = -st.side; st.phT = 0; }
  return st.side;
}

function run(opts, v0 = 25, secs = 10) {
  const car = new Car(); car.reset(0, 0, 0); car.vF = v0;
  const sc = new Scoring(); const st = {};
  let k = 0, t = 0, sw = 0, umax = 0;
  const dt = 1 / 60;
  for (let i = 0; i < secs * 60; i++) {
    const key = t < 0.3 ? 1 : wiggle(car, st, dt, opts);
    const r = key ? 7.2 : 12; k += Math.max(-r * dt, Math.min(r * dt, key - k));
    car.step(dt, { throttle: t < 0.3 ? 0.3 : car.speed < 33 ? 1 : 0.6, brake: 0, steer: k, hand: t < 0.3 ? 1 : 0, reverse: false, touch: false, line: { curv: 0, here: 0 } }, 1);
    sc.update(dt, car, 0, false);
    for (const e of sc.drain()) if (e.type === 'switch') sw++;
    t += dt;
    if (t > 1) umax = Math.max(umax, Math.abs(car.x));
  }
  return { pts: sc.points + sc.total, sw, umax, kmh: car.kmh, mult: sc.mult };
}

if (process.argv[1] && process.argv[1].endsWith('qa_wiggle_tune.mjs')) {
  const res = [];
  for (const H of [0.6, 0.7, 0.85]) for (const Kh of [0.2, 0.5, 1, 2]) for (const Ku of [0.005, 0.01, 0.02, 0.04]) for (const tau of [1.5, 2.5, 4]) {
    const r = run({ H, Kh, Ku, tau });
    res.push({ H, Kh, Ku, tau, ...r });
  }
  res.sort((a, b) => a.umax - b.umax);
  console.log("cases", res.length, "max switches", Math.max(...res.map((x) => x.sw))); for (const r of res.filter((x) => x.sw >= 9).slice(0, 10)) console.log(`H ${r.H} Kh ${r.Kh} Ku ${r.Ku} tau ${r.tau}: strays ${r.umax.toFixed(1)} m, ${r.sw} switches in 10 s, ${Math.round(r.pts)} points (${Math.round(r.pts / 10)}/s), x${r.mult}, ends ${Math.round(r.kmh)} km/h`);
}
