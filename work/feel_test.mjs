// Drift feel, by numbers: a keyboard player's inputs (keys ramp the wheel as the game's input does) through the moves
// a drift is made of, and what a player feels in each: how fast the slide comes, the angle it settles at and how
// steady it is, how much speed it bleeds, what the throttle does to the angle, how a switchback swings, and spins.
//   node work/feel_test.mjs [path/to/car.js] [-v]
const arg = process.argv.find((a) => a.endsWith('.js') && !a.endsWith('feel_test.mjs'));
const src = arg ? new URL('file:///' + arg.replace(/\\/g, '/')) : new URL('../game/src/car.js', import.meta.url);
const { Car } = await import(src.href);
const V = process.argv.includes('-v');
const deg = (r) => (r * 180) / Math.PI;
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

/** keys(t, car) -> { W, S, A, D, SP } (booleans, or W as a number for part throttle) */
function run(v0, seconds, keys, curv = 0) {
  const car = new Car(); car.reset(0, 0, 0); car.vF = v0;
  const dt = 1 / 60; let kSteer = 0;
  const tr = [];
  let lastTravel = 0;
  for (let i = 0; i < seconds * 60; i++) {
    const t = i * dt;
    const k = keys(t, car);
    const sk = (k.A ? 1 : 0) - (k.D ? 1 : 0);
    const rate = sk !== 0 ? 7.2 : 12;
    kSteer += Math.max(-rate * dt, Math.min(rate * dt, sk - kSteer));
    const throttle = typeof k.W === 'number' ? k.W : k.W ? 1 : 0;
    car.step(dt, { throttle, brake: k.S ? 1 : 0, steer: kSteer, hand: k.SP ? 1 : 0, reverse: !!k.S, touch: false, line: { curv, here: curv } }, 1);
    const vx = Math.sin(car.yaw) * car.vF + Math.cos(car.yaw) * car.vL, vz = Math.cos(car.yaw) * car.vF - Math.sin(car.yaw) * car.vL;
    const travel = Math.atan2(vx, vz);
    const turnRate = wrap(travel - lastTravel) / dt; lastTravel = travel;
    tr.push({ t: t + dt, beta: deg(car.beta), v: car.speed, w: deg(car.omega), turn: deg(turnRate), steer: deg(car.steer), key: kSteer });
  }
  return tr;
}
const at = (tr, t) => tr[Math.min(tr.length - 1, Math.max(0, Math.round(t * 60) - 1))];
const firstT = (tr, f) => { const s = tr.find(f); return s ? s.t : null; };
const span = (tr, t0, t1) => tr.filter((s) => s.t >= t0 && s.t <= t1);
const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) * (x - m)))); };
const f1 = (x) => (x === null ? '  -  ' : x.toFixed(1).padStart(5));
function report(label, tr, hold = [1.5, 3.5]) {
  const h = span(tr, hold[0], hold[1]);
  const b = h.map((s) => Math.abs(s.beta));
  const peak = Math.max(...tr.map((s) => Math.abs(s.beta)));
  const spun = peak > 100;
  const t20 = firstT(tr, (s) => Math.abs(s.beta) > 20);
  const dv = h.length > 1 ? (h[h.length - 1].v - h[0].v) / (h[h.length - 1].t - h[0].t) : 0;
  console.log(`${label.padEnd(46)} 20deg at ${f1(t20)} s  peak ${peak.toFixed(0).padStart(3)}  held ${mean(b).toFixed(0).padStart(3)} +-${sd(b).toFixed(1).padStart(4)}  speed ${at(tr, hold[0]).v.toFixed(1)}->${at(tr, hold[1]).v.toFixed(1)} (${dv >= 0 ? '+' : ''}${dv.toFixed(1)} m/s2)  turn ${mean(h.map((s) => Math.abs(s.turn))).toFixed(0).padStart(3)} deg/s${spun ? '  SPUN' : ''}`);
  if (V) for (const s of tr.filter((_, i) => i % 12 === 11)) console.log(`   t ${s.t.toFixed(1)} beta ${s.beta.toFixed(0).padStart(4)} v ${s.v.toFixed(1)} yaw ${s.w.toFixed(0).padStart(4)} turn ${s.turn.toFixed(0).padStart(4)} wheel ${s.steer.toFixed(0).padStart(4)} key ${s.key.toFixed(2)}`);
  return { peak, held: mean(b), wob: sd(b), dv, t20, spun };
}

console.log('-- entering: a handbrake flick at 80 km/h, then throttle and the key held into the turn');
const flick = (keyUntil = 99, thr = 1) => (t) => ({ W: t < 0.3 ? 0.3 : thr, SP: t < 0.3, A: t < keyUntil });
report('flick, key held into the turn', run(22, 4, flick()));
report('flick, key let go at 0.8 s (the assist holds it)', run(22, 4, flick(0.8)));
report('flick, key into the turn, 60% throttle', run(22, 4, flick(99, 0.6)));
report('flick at 110 km/h, key held', run(30.5, 4, flick()));
report('flick at 55 km/h, key held', run(15, 4, flick()));
console.log('-- without the handbrake');
report('lift-off: 90 km/h, key in, off the gas 0.4 s, gas', run(25, 4, (t) => ({ W: t > 0.4, A: true })));
report('power-over: 60 km/h, key in, gas', run(16.5, 4, (t) => ({ W: true, A: true })));
report('feint: key the other way 0.25 s, then in, gas', run(24, 4, (t) => ({ W: t > 0.25 ? 1 : 0.2, D: t < 0.25, A: t >= 0.25 && t < 99 })));
console.log('-- in the slide');
report('throttle off at 1.5 s (angle should close)', run(22, 4, (t) => ({ W: t < 0.3 ? 0.3 : t < 1.5 ? 1 : 0.15, SP: t < 0.3, A: true })), [1.6, 2.6]);
report('counter-steer at 1.5 s (straighten out)', run(22, 4, (t) => ({ W: t < 0.3 ? 0.3 : 1, SP: t < 0.3, A: t < 1.5, D: t >= 1.5 && t < 1.9 })), [1.9, 3.0]);
// a switchback: left drift, then the key thrown the other way and held: how long to the other side, and does it hold
{
  const tr = run(24, 5, (t) => ({ W: t < 0.3 ? 0.3 : 1, SP: t < 0.3, A: t < 1.6, D: t >= 1.6 }));
  const t0 = firstT(tr, (s) => s.t > 1.6 && s.beta < -20), tBack = firstT(tr, (s) => s.t > 1.6 && s.beta > 20);
  report('switchback: left, then the key right at 1.6 s', tr, [2.8, 4.5]);
  console.log(`   (from the key thrown to 20 deg the other way: ${tBack !== null && t0 !== null ? 'left ' : ''}${t0 !== null ? (t0 - 1.6).toFixed(2) + ' s' : 'never'})`);
}
console.log('-- a long bend, 60 m radius, held on the line assist');
report('flick into a 60 m bend, key held, gas', run(22, 5, flick(), 1 / 60), [1.5, 4.5]);
report('flick into a 30 m bend, key held, gas', run(18, 5, flick(), 1 / 30), [1.5, 4.5]);
