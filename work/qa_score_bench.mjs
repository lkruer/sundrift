// Points a minute in the real game, by way of play: the gate's own driving policy (follow the road, the handbrake into
// tight corners, the key held into the turn, counter-steer past 38 degrees) as the reference, and the same driver doing
// one thing more: wiggling the wheel on the straights, J-turns one after another, running along the city's pavement
// through its clutter, hugging the road's edge through the bends. The keys are ramped as input.js ramps them.
//   node work/qa_score_bench.mjs [--city] [--course=hard] [--secs=90] [--modes=drive,wiggle,jturn,smash,clip] [--fps=30]
// --fps=N throttles requestAnimationFrame to about N frames a second (the game's own dt follows).
import fs from 'fs';
import path from 'path';
import { open, arg, sleep } from './qa_lib.mjs';

const CITY = process.argv.includes('--city');
const COURSE = arg('course', 'easy');
const SECS = Number(arg('secs', 90));
const MODES = arg('modes', 'drive,drift,wiggle,jturn' + (CITY ? ',smash' : '') + ',clip').split(',');
const FPS = Number(arg('fps', 0));
const OUT = arg('out', 'work/shots/qa_bench');

const q = await open({ out: OUT, storage: { 'sundrift.drifted': '1' } });
const { page, ev, note } = q;
if (FPS) await ev(`(() => { const raf = window.requestAnimationFrame.bind(window); let last = 0; window.requestAnimationFrame = (f) => raf(function g(t) { if (t - last < ${1000 / FPS} - 2) return raf(g); last = t; f(t); }); })()`);
if (CITY) { await q.tap('.map[data-m=city]'); await sleep(500); await q.waitBuilt(); await sleep(1200); }
if (COURSE === 'hard') { await q.tap('.diff[data-d=hard]'); await sleep(500); await q.waitBuilt(); await sleep(1200); }
await q.tap('#startb');
await sleep(1500);

// the driver, installed once; window.__BENCH__.mode picks what it does on top of driving
await ev(`(() => {
  const D = window.__DEBUG__, G = D.G, t = D.track;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const B = window.__BENCH__ = { mode: 'drive', T: 0, k: 0, ev: {}, smash: 0, jt: 0, mag: 0, wasMag: false, handUntil: 0, handCool: 0, ph: 0, phT: 0, side: 1, pinned: 0, stuck: 0, revUntil: 0 };
  const hud = D.hud;
  if (!hud.__bench) {
    hud.__bench = true;
    const oe = hud.onEvent.bind(hud); hud.onEvent = (e) => { B.ev[e.type] = (B.ev[e.type] || 0) + 1; if (e.type === 'clip') { const pt = t.pts[G.idx], hd = G.u >= 0 ? pt.hardL : pt.hardR; const kind = hd === 0 ? 'rail' : hd === Infinity ? 'open' : 'kerb'; B.clipAt = B.clipAt || {}; B.clipAt[kind] = (B.clipAt[kind] || 0) + 1; } if (e.type === 'crash' || e.type === 'bump') { (B.crashLog = B.crashLog || []).push([e.type, +B.T.toFixed(1), Math.round(G.s), +G.u.toFixed(1), Math.round(D.car.kmh), Math.round(D.car.beta * 57.3), B.inBend, +(B.lastToOut || 0).toFixed(1), Math.round(1 / Math.max(1e-4, Math.abs(t.sample(G.s).k)))]); } return oe(e); };
    const sm = hud.smash.bind(hud); hud.smash = (label, total, n) => { B.smash++; B.smashPts = (B.smashPts || 0) + (n === 1 ? total : total - (B.smashLast || 0)); B.smashLast = total; return sm(label, total, n); };
  }
  window.__AUTOPILOT__ = (dt) => {
    B.T += dt; B.phT += dt;
    const car = D.car, v = car.speed, kmh = car.kmh, slip = car.beta * 180 / Math.PI;
    const mag = D.magnet.active; if (mag && !B.wasMag) B.mag++; B.wasMag = mag; if (G.off && !B.wasOff) B.offs = (B.offs || 0) + 1; B.wasOff = !!G.off;
    const n = t.nearest(car.x, car.z, G.idx);
    // the gate's policy: aim along the road, anticipate the curve, speed for the corner, handbrake into tight ones
    let uT = 0;
    const headErr = wrap((G.roadH ?? t.pts[G.idx].h) - car.yaw);
    const k0 = t.sample(G.s + 22).k, k = Math.abs(k0);
    let vmax = k > 0.002 ? Math.sqrt(11 / k) * 3.6 : 999;
    let throttle = 1, brake = 0, hand = 0, reverse = false, key = 0;
    if (B.mode === 'smash' || B.mode === 'clip') {
      // the pavement (smash) or the edge (clip): a lateral target on the outside of the road
      const p = t.sample(G.s + 10), w = p.wl;
      if (B.mode === 'smash') {
        // 3.6 s along the pavement, 1.1 s back on the road (the countdown resets), at 45 km/h
        const cyc = B.T % 4.7; uT = cyc < 3.6 ? (w + 1.6) : 0; vmax = Math.min(vmax, 45);
      } else {
        // the outside of every bend, the rear 0.3 m from the edge (the car's half-length past its centre puts its corner there)
        const side = Math.sign(-k0) || 1; uT = side * (w - 1.3);
      }
    }
    const cmd = headErr * 1.3 - (G.u - uT) * 0.12 + k0 * 9;
    const tooFast = kmh > vmax * 1.15;
    const tight = k > 1 / 32 && kmh > 42;
    if (tight && B.T > B.handCool && B.mode !== 'jturn' && B.mode !== 'drift' && B.mode !== 'driftwiggle') { B.handUntil = B.T + 0.38; B.handCool = B.T + 3.2; }
    key = cmd > 0.05 ? 1 : cmd < -0.05 ? -1 : 0;
    throttle = tooFast ? 0 : 1; brake = tooFast && Math.abs(slip) < 15 ? 1 : 0;
    hand = B.T < B.handUntil ? 1 : 0;
    if (Math.abs(slip) > 38) key = slip > 0 ? 1 : -1;
    // the skilled drifter: every bend tighter than about 110 m is taken sideways. A flick of the handbrake with the key
    // into the bend as it begins, the key held into it while the bend lasts (the game holds the angle), the gas eased
    // when the slide carries the car toward the outside edge, the key let go as the bend opens out.
    if (B.mode === 'drift' || B.mode === 'driftwiggle') {
      const look = 6 + v * 0.45, kA = t.sample(G.s + look).k, kH = t.sample(G.s + 3).k;
      const bend = Math.abs(kA) > 1 / 110 ? Math.sign(kA) : Math.abs(kH) > 1 / 130 ? Math.sign(kH) : 0;
      // the speed for what is coming: the tightest bend within braking reach, taken sideways (a held slide carries
      // a little more than grip)
      let kMax = 0;
      for (let ds = 0; ds <= 12 + v * 1.6; ds += 3) kMax = Math.max(kMax, Math.abs(t.sample(G.s + ds).k));
      const vIn = kMax > 0.002 ? Math.min(150, Math.sqrt(9.5 / kMax) * 3.6) : 150;
      const wl = t.sample(G.s + 4), edgeOut = bend ? (bend > 0 ? -(wl.wr) : wl.wl) : 0;   // the outside edge's u
      const toOut = bend ? (edgeOut - G.u) * -bend : 9;     // metres from the car to the outside edge (positive: room)
      B.lastToOut = toOut;
      if (bend && !B.inBend && kmh > 40 && Math.abs(slip) < 12) { B.inBend = bend; B.handUntil = B.T + 0.25; }
      if (B.inBend && (Math.abs(kA) < 1 / 200 && Math.abs(kH) < 1 / 160 || Math.sign(kA) === -B.inBend && Math.abs(kA) > 1 / 110)) B.inBend = 0;
      if (B.inBend) {
        key = B.inBend;
        hand = B.T < B.handUntil ? 1 : 0;
        // off the line toward the outside: lift (the slide closes and the tyres bite, the line tightens); plenty of room: gas
        throttle = toOut < 1.8 ? 0.15 : toOut < 3.2 ? 0.55 : 1; brake = 0;
        if (kmh > vIn * 1.25 && Math.abs(slip) < 25) { throttle = 0; }
        // the nose already pointing inside the bend's own way: open out (let the key go a moment)
        const lead = wrap(car.yaw + Math.atan2(car.vL, Math.max(0.5, car.vF)) - (G.roadH ?? 0)) * B.inBend;
        if (lead > 0.3) key = 0;
        if (Math.abs(slip) > 50) key = -B.inBend;
      } else {
        throttle = kmh > vIn ? 0 : 1; brake = kmh > vIn * 1.08 && Math.abs(slip) < 10 ? 1 : 0;
      }
    }
    // the wiggle: on a straight, the key thrown from side to side, each side held longer the way the road wants
    if ((B.mode === 'wiggle' || B.mode === 'driftwiggle' && !B.inBend) && k < 1 / 150 && Math.abs(t.sample(G.s + 50).k) < 1 / 150 && kmh > 50 && !G.off) {
      const P = 0.7 * (1 + 0.8 * clamp(B.side * cmd, -0.9, 0.9));
      if (B.phT > P) { B.side = -B.side; B.phT = 0; }
      key = B.side; throttle = 1; brake = 0;
    }
    // J-turns one after another where the car stands: back up straight, let go, the wheel over and the gas, brake, again
    if (B.mode === 'jturn') {
      throttle = 0; brake = 0; key = 0;
      if (B.ph === 0) { brake = 1; reverse = true; if (car.vF < -8) { B.ph = 1; B.phT = 0; } }
      else if (B.ph === 1) { throttle = 1; key = B.side; if (B.phT > 1.0 && !car.jt) { B.ph = 2; B.phT = 0; } }
      else { brake = 1; if (car.speed < 0.4 || car.vF < 0) { B.ph = 0; B.phT = 0; B.side = -B.side; } }
      if (car.jturnDone) B.jt++;
      // back to the middle of the road now and then (the magnet would take it if it wandered off)
      if (Math.abs(G.u) > 3 && B.ph === 2) { /* brake anyway */ }
    }
    // stuck against something: back out, the way the gate does
    if (B.mode !== 'jturn') {
      if (v < 1.1 && !mag) B.stuck += dt; else B.stuck = 0;
      if (B.stuck > 1.2) { B.revUntil = B.T + 1.3; B.stuck = 0; }
      if (B.T < B.revUntil) { throttle = 0; brake = 1; reverse = true; hand = 0; key = cmd < 0 ? 1 : -1; }
    }
    // the key, ramped as input.js ramps it
    const rate = key !== 0 ? 7.2 : 12;
    B.k += clamp(key - B.k, -rate * dt, rate * dt);
    return { throttle, brake, steer: B.k, hand, reverse, touch: false };
  };
  return true;
})()`);

const results = [];
for (const mode of MODES) {
  if (CITY ? false : mode === 'smash') continue;
  // a fresh run for each mode, from the start of the course
  await ev(`(() => { const D = window.__DEBUG__; D.scoring.reset(); D.hud.reset(); D.teleport(40, 60); const B = window.__BENCH__; Object.assign(B, { mode: '${mode}', T: 0, ev: {}, smash: 0, jt: 0, mag: 0, ph: 0, phT: 0, side: 1, stuck: 0, revUntil: 0, handCool: 0, handUntil: 0, inBend: 0, smashPts: 0, smashLast: 0, offs: 0, wasOff: false }); D.G.dist = 0; D.G.longFrames = 0; window.__F0__ = D.G.longFrames; return true; })()`);
  const t0 = Date.now();
  let frames0 = await ev('window.__QA__ ? window.__QA__.frames.length : 0');
  await sleep(SECS * 1000);
  const r = await ev(`(() => { const D = window.__DEBUG__, s = D.scoring, B = window.__BENCH__; if (s.active) s.bank(); const out = { mode: B.mode, T: +B.T.toFixed(1), total: Math.round(s.total), stats: s.stats, ev: B.ev, smashHits: B.smash, jturns: B.jt, magnets: B.mag, dist: Math.round(D.G.dist), fps: D.G.fps, crashLog: B.crashLog || [], smashPts: B.smashPts || 0, offs: B.offs || 0, clipAt: B.clipAt || {} }; B.clipAt = {}; B.crashLog = []; return out; })()`);
  r.ppm = Math.round(r.total / (r.T / 60));
  results.push(r);
  if (process.argv.includes('-v')) note('  crash log [type, t, s, u, kmh, slip, bend, toOut, R]:', JSON.stringify(r.crashLog));
  note(`${CITY ? 'city' : 'pass'} ${COURSE} ${mode.padEnd(7)} ${String(r.ppm).padStart(8)} pts/min over ${r.T} s game time  total ${r.total}  banks ${r.ev.bank || 0} switches ${r.ev.switch || 0} clips ${r.ev.clip || 0} ${JSON.stringify(r.clipAt)} crashes ${r.ev.crash || 0} jturns ${r.ev.jturn || 0} smash hits ${r.smashHits} (${r.smashPts} pts) countdowns ${r.offs} magnets ${r.magnets} dist ${r.dist} m  biggest ${r.stats.biggest}  fps ${r.fps}`);
}
fs.mkdirSync(path.resolve(OUT), { recursive: true });
fs.writeFileSync(path.resolve(OUT, `bench_${CITY ? 'city' : 'pass'}_${COURSE}${FPS ? '_' + FPS + 'fps' : ''}.json`), JSON.stringify(results, null, 1));
if (q.errors.length) note('errors', q.errors.slice(0, 5));
await q.close();
