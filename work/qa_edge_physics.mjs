// The car at the edges of what a player can ask of it: high speed with boost, spins and what comes after them, and
// landings (the car leaves the ground over a crest and comes down turned or turning).
//   node work/qa_edge_physics.mjs [path/to/car.js]
const arg = process.argv.find((a) => a.endsWith('.js') && !a.endsWith('qa_edge_physics.mjs'));
const src = arg ? new URL('file:///' + arg.replace(/\\/g, '/')) : new URL('../game/src/car.js', import.meta.url);
const { Car } = await import(src.href);
const deg = (r) => (r * 180) / Math.PI;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function sim(seconds, keys, setup, { touch = false } = {}) {
  const car = new Car(); car.reset(0, 0, 0);
  if (setup) setup(car);
  const dt = 1 / 60; let kSteer = 0, t = 0, maxB = 0, maxW = 0, spun = 0, turned = 0, lastYaw = car.yaw, vMax = 0;
  const trace = [];
  for (let i = 0; i < seconds * 60; i++) {
    const k = keys(t, car);
    if (k.air !== undefined) car.air = k.air;
    let steer = k.steer;
    if (steer === undefined) { const sk = (k.A ? 1 : 0) - (k.D ? 1 : 0); const rate = sk !== 0 ? 7.2 : 12; kSteer += Math.max(-rate * dt, Math.min(rate * dt, sk - kSteer)); steer = kSteer; }
    if (k.boost) car.boost = Math.max(car.boost, k.boost);
    car.step(dt, { throttle: typeof k.W === 'number' ? k.W : k.W ? 1 : 0, brake: k.S ? 1 : 0, steer, hand: k.SP ? 1 : 0, reverse: !!k.S, touch, line: { curv: 0, here: 0 } }, 1);
    t += dt;
    turned += wrap(car.yaw - lastYaw); lastYaw = car.yaw;
    maxB = Math.max(maxB, Math.abs(car.beta)); maxW = Math.max(maxW, Math.abs(car.omega)); vMax = Math.max(vMax, car.speed);
    if (Math.abs(car.beta) > 1.75) spun++;
    if (i % 15 === 14) trace.push(`t ${t.toFixed(2)} v ${car.speed.toFixed(1)} vF ${car.vF.toFixed(1)} beta ${deg(car.beta).toFixed(0)} omega ${car.omega.toFixed(2)} wheel ${deg(car.steer).toFixed(0)}`);
  }
  return { car, maxB: deg(maxB), maxW, spunS: spun / 60, turned: deg(turned), vMax, trace };
}
const show = (label, r, extra = '') => console.log(`${label.padEnd(60)} max slip ${r.maxB.toFixed(0).padStart(4)}  max yaw ${r.maxW.toFixed(2)}  ${r.spunS > 0 ? 'past 100 deg for ' + r.spunS.toFixed(2) + ' s' : 'no spin'}  turned ${r.turned.toFixed(0).padStart(5)}  ends ${(r.car.speed * 3.6).toFixed(0)} km/h vF ${r.car.vF.toFixed(1)} heading ${deg(wrap(r.car.yaw)).toFixed(0)}  ${extra}`);
const V = process.argv.includes('-v');

console.log('-- high speed');
for (const v of [40, 50, 60]) {
  show(`flick at ${(v * 3.6).toFixed(0)} km/h, key held, gas`, sim(4, (t) => ({ W: t < 0.3 ? 0.3 : 1, SP: t < 0.3, A: true }), (c) => { c.vF = v; }));
  show(`flick at ${(v * 3.6).toFixed(0)} km/h, key held, gas + boost`, sim(4, (t) => ({ W: t < 0.3 ? 0.3 : 1, SP: t < 0.3, A: true, boost: t > 0.3 && t < 3.4 ? 1 : 0 }), (c) => { c.vF = v; }));
  show(`full lock at ${(v * 3.6).toFixed(0)} km/h, no handbrake, gas + boost`, sim(4, (t) => ({ W: true, A: true, boost: 2 }), (c) => { c.vF = v; }));
  show(`switch L-R-L at ${(v * 3.6).toFixed(0)} km/h, boost`, sim(4, (t) => ({ W: true, SP: t < 0.3, A: t < 1.2 || t > 2.4, D: t >= 1.2 && t <= 2.4, boost: 2 }), (c) => { c.vF = v; }));
  show(`touch: full lock flick back and forth at ${(v * 3.6).toFixed(0)} km/h`, sim(4, (t) => ({ W: true, steer: Math.floor(t / 0.25) % 2 ? -1 : 1 }), (c) => { c.vF = v; }, { touch: true }));
}
console.log('-- spins, and getting going again');
{
  // a spin: handbrake and full lock held at 100 km/h for 1.5 s, then nothing, then the gas
  const r = sim(6, (t) => (t < 1.5 ? { SP: true, A: true, W: 0.5 } : t < 2.5 ? {} : { W: true }), (c) => { c.vF = 28; });
  show('handbrake + full lock 1.5 s at 100, let go 1 s, then gas', r, `(drives off: ${r.car.vF > 5 ? 'yes' : 'NO'})`);
  if (V) console.log(r.trace.join('\n'));
  const r2 = sim(6, (t) => (t < 1.5 ? { SP: true, A: true, W: 0.5 } : { S: true }), (c) => { c.vF = 28; });
  show('the same spin, then S held (brake/reverse)', r2);
  const r3 = sim(6, (t) => (t < 1.5 ? { SP: true, A: true, W: 1 } : { W: true, D: true }), (c) => { c.vF = 28; });
  show('the same spin, then gas + the wheel the other way', r3, `(drives off: ${r3.car.vF > 5 ? 'yes' : 'NO'})`);
  // rolling backwards fast after a spin, gas held
  const r4 = sim(5, () => ({ W: true }), (c) => { c.vF = -18; });
  show('rolling backwards at 65 km/h, gas held', r4, `(drives off: ${r4.car.vF > 5 ? 'yes' : 'NO'})`);
  const r5 = sim(5, () => ({ W: true, A: true }), (c) => { c.vF = -18; });
  show('rolling backwards at 65 km/h, gas + full lock', r5, `(drives off: ${r5.car.vF > 5 ? 'yes' : 'NO'})`);
  const r6 = sim(5, () => ({ W: true }), (c) => { c.vF = -2; c.vL = 14; c.omega = 3; });
  show('sliding sideways at 50 km/h, spinning, gas held', r6, `(drives off: ${r6.car.vF > 5 ? 'yes' : 'NO'})`);
}
console.log('-- landings: off a crest at speed, in the air 0.6 s, coming down turned');
for (const [w0, b0] of [[0, 0], [1.5, 0], [-2.5, 0.3], [3, -0.5]]) {
  // in the air: car.air true for 0.6 s (the game sets it), with a yaw rate and a slip at take-off
  const r = sim(4, (t) => ({ W: true, A: t > 0.6 && t < 2, air: t < 0.6 }), (c) => { c.vF = 30 * Math.cos(b0); c.vL = 30 * Math.sin(b0); c.omega = w0; });
  show(`take-off with yaw ${w0} rad/s, slip ${deg(b0).toFixed(0)}, key in after landing`, r);
}
