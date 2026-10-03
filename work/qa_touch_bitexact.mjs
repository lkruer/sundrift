// The phone gate's finger is only ever at the middle or at full lock (steer -1, 0 or 1) with the throttle on or off,
// the brake pulled or not, the handbrake thumb on or off. Replays 200 random minutes of such touch input through two
// car.js files and compares every state bit for bit: the M1 fix must change nothing for the gate.
//   node work/qa_touch_bitexact.mjs <car.js A> <car.js B>
const load = async (p) => (await import(new URL('file:///' + p.replace(/\\/g, '/')).href)).Car;
const A = await load(process.argv[2]), B = await load(process.argv[3]);
let seed = 11;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
let diffs = 0, frames = 0;
for (let run = 0; run < 200; run++) {
  const a = new A(), b = new B(); a.reset(0, 0, 0); b.reset(0, 0, 0);
  a.vF = b.vF = 10 + rnd() * 25;
  let steer = 0, thr = 1, brake = 0, hand = 0, next = 0;
  for (let i = 0; i < 60 * 60; i++) {
    const t = i / 60;
    if (t >= next) { next = t + 0.07 + rnd() * 0.6; steer = [-1, 0, 1][Math.floor(rnd() * 3)]; thr = rnd() < 0.8 ? 1 : 0; brake = rnd() < 0.08 ? 0.66 : 0; hand = rnd() < 0.15 ? 1 : 0; }
    const inp = { throttle: brake ? 0 : thr, brake, steer, hand, reverse: brake > 0.5, touch: true, line: { curv: 0.01 * Math.sin(t * 0.3), here: 0.01 * Math.sin(t * 0.3) } };
    a.step(1 / 60, inp, 1); b.step(1 / 60, { ...inp, line: { ...inp.line } }, 1);
    frames++;
    if (a.x !== b.x || a.z !== b.z || a.yaw !== b.yaw || a.vF !== b.vF || a.vL !== b.vL || a.omega !== b.omega) { diffs++; break; }
  }
}
console.log(`${frames} frames of bang-bang touch input over 200 runs: ${diffs === 0 ? 'bit-identical in every frame' : diffs + ' runs diverged'}`);
