// Frame-rate independence: the same scripted inputs (keys ramped the way input.js ramps them, per frame) stepped at
// 20, 30, 60 and 144 frames a second. A car model that does not depend on the frame rate ends every run in the same
// place, at the same speed and heading; every number here should agree across a row.
//   node work/qa_fps_test.mjs [path/to/car.js] [-v]
const arg = process.argv.find((a) => a.endsWith('.js') && !a.endsWith('qa_fps_test.mjs'));
const src = arg ? new URL('file:///' + arg.replace(/\\/g, '/')) : new URL('../game/src/car.js', import.meta.url);
const { Car } = await import(src.href);
const deg = (r) => (r * 180) / Math.PI;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** keys(t, car) -> { W, S, A, D, SP } ; touch: steer is the raw value (no ramp) */
function run(fps, seconds, keys, { v0 = 0, curv = 0, touch = false, setup } = {}) {
  const car = new Car(); car.reset(0, 0, 0); car.vF = v0;
  if (setup) setup(car);
  const dt = 1 / fps; let kSteer = 0, t = 0, maxB = 0, jt = false, jturns = 0, sumB = 0, nB = 0, minV = 1e9;
  const n = Math.round(seconds * fps);
  for (let i = 0; i < n; i++) {
    const k = keys(t, car);
    let steer;
    if (touch) steer = k.steer ?? 0;
    else {
      const sk = (k.A ? 1 : 0) - (k.D ? 1 : 0);
      const rate = sk !== 0 ? 7.2 : 12;
      kSteer += Math.max(-rate * dt, Math.min(rate * dt, sk - kSteer));
      if (Math.abs(kSteer) < 0.01 && sk === 0) kSteer = 0;
      steer = kSteer;
    }
    const throttle = typeof k.W === 'number' ? k.W : k.W ? 1 : 0;
    car.step(dt, { throttle, brake: k.S ? 1 : 0, steer, hand: k.SP ? 1 : 0, reverse: !!k.S, touch, line: { curv, here: curv } }, 1);
    if (car.jturnDone) { jturns++; car.jturnDone = false; }
    t += dt;
    maxB = Math.max(maxB, Math.abs(car.beta));
    if (t > seconds * 0.4 && t < seconds * 0.9) { sumB += Math.abs(car.beta); nB++; }
    minV = Math.min(minV, car.speed);
  }
  return { x: car.x, z: car.z, yaw: car.yaw, v: car.speed, maxB, heldB: nB ? sumB / nB : 0, jturns, minV };
}

const SC = [
  ['flick 80 km/h, key held into the turn', 4, (t) => ({ W: t < 0.3 ? 0.3 : 1, SP: t < 0.3, A: true }), { v0: 22 }],
  ['flick, key let go at 0.8 s', 4, (t) => ({ W: t < 0.3 ? 0.3 : 1, SP: t < 0.3, A: t < 0.8 }), { v0: 22 }],
  ['lift-off 90 km/h, key in', 4, (t) => ({ W: t > 0.4, A: true }), { v0: 25 }],
  ['switchback at 1.6 s', 5, (t) => ({ W: t < 0.3 ? 0.3 : 1, SP: t < 0.3, A: t < 1.6, D: t >= 1.6 }), { v0: 24 }],
  ['flick into a 30 m bend (line assist)', 5, (t) => ({ W: t < 0.3 ? 0.3 : 1, SP: t < 0.3, A: true }), { v0: 18, curv: 1 / 30 }],
  ['donut from rest, 6 s', 6, () => ({ W: true, A: true }), {}],
  ['J-turn: 2 s reverse, flick + gas', 5, (t) => (t < 2 ? { S: true } : { W: true, A: t < 2.9 }), {}],
  ['straight, full throttle 8 s', 8, () => ({ W: true }), {}],
  ['fast bend 0.35 lock, touch', 5, () => ({ W: true, steer: 0.35 }), { v0: 25, touch: true }],
  ['handbrake spin at 60 km/h, nothing held', 4, (t) => ({ SP: t < 1.0, A: t < 1.0 }), { v0: 17 }],
  ['brake in a slide (S held)', 4, (t) => ({ W: t < 0.3 ? 0.3 : t < 1.2 ? 1 : 0, SP: t < 0.3, A: t < 1.2, S: t >= 1.2 }), { v0: 22 }],
];
const FPS = [20, 30, 60, 144];
const V = process.argv.includes('-v');
let worst = { pos: 0, yaw: 0, v: 0 };
console.log('scenario'.padEnd(42) + FPS.map((f) => `${f} fps`.padStart(31)).join(''));
for (const [label, secs, keys, opt] of SC) {
  const rs = FPS.map((f) => run(f, secs, keys, opt));
  const ref = rs[2];
  const cells = rs.map((r) => `${r.x.toFixed(1).padStart(6)},${r.z.toFixed(1).padStart(6)} ${deg(wrap(r.yaw)).toFixed(0).padStart(4)}d ${r.v.toFixed(1).padStart(5)}m/s ${deg(r.heldB).toFixed(0).padStart(3)}`.padStart(31));
  console.log(label.padEnd(42) + cells.join(''));
  for (const r of rs) {
    const dp = Math.hypot(r.x - ref.x, r.z - ref.z), dy = Math.abs(deg(wrap(r.yaw - ref.yaw))), dv = Math.abs(r.v - ref.v);
    if (dp > worst.pos) worst = { ...worst, pos: dp, posAt: label };
    if (dy > worst.yaw) worst = { ...worst, yaw: dy, yawAt: label };
    if (dv > worst.v) worst = { ...worst, v: dv, vAt: label };
  }
  if (V) for (let i = 0; i < FPS.length; i++) console.log(`    ${FPS[i]} fps: maxB ${deg(rs[i].maxB).toFixed(0)} held ${deg(rs[i].heldB).toFixed(1)} jturns ${rs[i].jturns} minV ${rs[i].minV.toFixed(2)}`);
}
console.log(`\nworst spread against 60 fps: position ${worst.pos.toFixed(2)} m (${worst.posAt}), heading ${worst.yaw.toFixed(1)} deg (${worst.yawAt}), speed ${worst.v.toFixed(2)} m/s (${worst.vAt})`);
