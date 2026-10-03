// One thumb drift traced in the game (real touches, a phone): the finger held at --px into the turn after a handbrake
// flick on the pad. Every 6th frame: the input the car got, the slip, the drift's weight, the key's hold, the speed.
//   node work/qa_touch_trace.mjs [--px=45] [--game=<dir>]
import { open, arg, sleep } from './qa_lib.mjs';
const PX = Number(arg('px', 45));
const q = await open({ phone: true, out: 'work/shots/qa_touch', storage: { 'sundrift.drifted': '1' } });
const { page, ev, note } = q;
await q.tap('#startb');
await sleep(1500);
const stick = await ev(`(() => { const b = document.getElementById('stick').getBoundingClientRect(); return { x: b.x + b.width * 0.5, y: b.y + b.height * 0.6 }; })()`);
const pad = await ev(`(() => { const p = window.__DEBUG__.hud.boxes().pad; return { x: p.x + p.w / 2, y: p.y + p.h / 2 }; })()`);
await ev(`(() => { const D = window.__DEBUG__; D.teleport(300, 80); D.scoring.reset();
  // log what the car is given and what it does (wrapping the car's step)
  const car = D.car, st = car.step.bind(car); window.__TR__ = []; let f = 0;
  car.step = (dt, inp, surf) => { st(dt, inp, surf); if (f++ % 6 === 0) window.__TR__.push([+(performance.now() / 1000).toFixed(2), +inp.throttle.toFixed(2), +inp.steer.toFixed(2), inp.hand, inp.touch, +surf.toFixed(2), +(car.beta * 57.3).toFixed(1), +car.drifting.toFixed(2), +car._into.toFixed(2), +car.speed.toFixed(1), +(car.steer * 57.3).toFixed(1), inp.line ? +inp.line.curv.toFixed(4) : null]); };
  return true; })()`);
await sleep(250);
const finger = await page.touchscreen.touchStart(stick.x, stick.y);
const thumb = await page.touchscreen.touchStart(pad.x, pad.y);
for (let k = 1; k <= 4; k++) { await finger.move(stick.x - (PX * k) / 4, stick.y); await sleep(15); }
await sleep(240);
await thumb.end();
await sleep(3200);
await finger.end();
const tr = await ev('window.__TR__');
note('[t, throttle, steer, hand, touch, surface, beta, drifting, into, speed, wheel deg, line curv]');
const t0 = tr[0][0];
for (const r of tr) note(JSON.stringify([+(r[0] - t0).toFixed(2), ...r.slice(1)]));
await q.close();
