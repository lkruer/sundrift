// Hunt for the car stopping dead: random key sequences (as a keyboard gives them) from random starting states, on
// open flat ground (no walls, so nothing SHOULD stop it hard), flagging any 0.1 s in which the car loses more speed
// than its tyres could take off it (about 1.3 g sliding, more with the brakes on), or stops a spin faster than its
// tyres could (about 8 rad/s^2).
//   node work/stop_hunt.mjs [path/to/car.js] [-v]
const arg = process.argv.find((a) => a.endsWith('.js') && !a.endsWith('stop_hunt.mjs'));
const src = arg ? new URL('file:///' + arg.replace(/\\/g, '/')) : new URL('../game/src/car.js', import.meta.url);
const { Car } = await import(src.href);
let seed = 7;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const events = {};
const examples = [];
const dt = 1 / 60;
// --trace=run,t0,t1 prints that run frame by frame
const tr = (process.argv.find((a) => a.startsWith('--trace=')) || '').slice(8).split(',').map(Number);
for (let run = 0; run < 600; run++) {
  const car = new Car(); car.reset(0, 0, 0);
  const kind = run % 5;
  // starting states: rolling forward, a drift, reversing, a spin going backwards, a fast spin
  if (kind === 0) car.vF = 5 + rnd() * 25;
  if (kind === 1) { car.vF = 12 + rnd() * 15; car.vL = (rnd() - 0.5) * 12; car.omega = (rnd() - 0.5) * 3; }
  if (kind === 2) car.vF = -(2 + rnd() * 15);
  if (kind === 3) { car.vF = -(rnd() * 4); car.vL = (rnd() < 0.5 ? -1 : 1) * (3 + rnd() * 9); car.omega = (rnd() - 0.5) * 4; }
  if (kind === 4) { car.vF = 8 + rnd() * 10; car.vL = (rnd() < 0.5 ? -1 : 1) * (6 + rnd() * 8); car.omega = (rnd() < 0.5 ? -1 : 1) * (2 + rnd() * 2); }
  let keys = { W: 0, S: 0, A: 0, D: 0, SP: 0 }, kSteer = 0, next = 0;
  const hist = [];
  for (let i = 0; i < 60 * 6; i++) {
    const t = i * dt;
    if (t >= next) {
      next = t + 0.15 + rnd() * 0.9;
      for (const k of Object.keys(keys)) if (rnd() < 0.35) keys[k] = keys[k] ? 0 : 1;
      if (keys.A && keys.D) keys[rnd() < 0.5 ? 'A' : 'D'] = 0;
    }
    const sk = keys.A - keys.D;
    const rate = sk !== 0 ? 7.2 : 12;
    kSteer += Math.max(-rate * dt, Math.min(rate * dt, sk - kSteer));
    const inp = { throttle: keys.W, brake: keys.S, steer: kSteer, hand: keys.SP, reverse: !!keys.S, touch: false, line: { curv: 0, here: 0 } };
    car.step(dt, inp, 1);
    if (tr.length === 3 && run === tr[0] && t >= tr[1] && t <= tr[2]) console.log(`  t ${t.toFixed(2)} keys ${Object.entries(keys).filter(([, v]) => v).map(([k]) => k).join('+') || '-'} steer ${kSteer.toFixed(2)}  speed ${car.speed.toFixed(2)} vF ${car.vF.toFixed(2)} vL ${car.vL.toFixed(2)} omega ${car.omega.toFixed(2)} beta ${car.beta.toFixed(2)} wheel ${car.steer.toFixed(2)} D ${car._donut.toFixed(2)} spin ${car.spin.toFixed(2)}`);
    hist.push({ t, inp: { ...keys }, speed: car.speed, vF: car.vF, vL: car.vL, omega: car.omega, beta: car.beta, jt: car.jt });
    if (hist.length > 7) {
      const h0 = hist[hist.length - 7], h1 = hist[hist.length - 1];
      const drop = h0.speed - h1.speed;
      // what the brakes add in 0.1 s at most (the brake pedal or the handbrake held)
      const braking = hist.slice(-6).some((h) => h.inp.S || h.inp.SP) ? 1.0 : 0;
      const jt = hist.slice(-7).some((h) => h.jt);
      let why = null;
      if (drop > 1.5 + braking && h0.speed > 2.5) why = jt ? 'jturn' : h0.vF < 0 && h0.vF > -3.8 ? 'slow-backwards' : Math.abs(h0.vL) > Math.abs(h0.vF) ? 'sideways' : 'other';
      else if (!jt && Math.abs(h0.omega) > 1.5 && Math.abs(h0.omega) - Math.abs(h1.omega) > 1.6) why = 'spin-stopped';
      if (why) {
        events[why] = (events[why] || 0) + 1;
        if (examples.length < 14 && !examples.some((e) => e.run === run)) examples.push({ run, kind, why, t: +t.toFixed(2), from: +h0.speed.toFixed(1), to: +h1.speed.toFixed(1), vF0: +h0.vF.toFixed(1), vL0: +h0.vL.toFixed(1), w0: +h0.omega.toFixed(2), w1: +h1.omega.toFixed(2), keys: h1.inp });
        hist.length = 0;
      }
    }
  }
}
console.log('sudden stops by kind:', JSON.stringify(events));
if (process.argv.includes('-v')) for (const e of examples) console.log(JSON.stringify(e));
