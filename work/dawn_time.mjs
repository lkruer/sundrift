// How long a run takes to reach dawn, driven by an autopilot, headless and in real time (the clock keeps its own pace
// on the wall, and the road and the banked drift points move it on top: see CLOCK in game/src/config.js).
//   node work/dawn_time.mjs [--bot=mediocre|drifter|cruise|parked] [--map=mountain|city] [--course=easy|hard] [--minutes=16] [--phone]
// mediocre: the road follower of work/shots_hud_desk.json (a handbrake flick into the tight corners only), the
// "mediocre driver" the clock is tuned against. drifter: work/qa_score_bench.mjs's skilled driver (every bend tighter
// than about 110 m taken sideways, the key held through it, the gas eased toward the outside edge), word for word; it
// is noisy (one bad rail hit loses a whole chain), so one run is one sample. cruise: the follower with no handbrake and
// a little less speed into the bends, a driver who never drifts on purpose. parked: no input at all, the clock's own
// pace. Prints a line every 30 s and, at the end, the rates, how the clock was moved, and the time to dawn.
import fs from 'fs';
import path from 'path';
import { open, sleep, arg } from './qa_lib.mjs';

const BOT = arg('bot', 'mediocre'), MAP = arg('map', 'mountain'), COURSE = arg('course', ''), MINUTES = Number(arg('minutes', 16));
const PHONE = process.argv.includes('--phone');
const Q = await open({ phone: PHONE, out: `work/qa_out/dawn_${BOT}_${MAP}${COURSE ? '_' + COURSE : ''}${PHONE ? '_phone' : ''}`, storage: { 'sundrift.drifted': '1' } });
const { ev, note, tap, waitBuilt } = Q;
if (MAP === 'city') { await tap('.map[data-m=city]'); await sleep(300); await waitBuilt(); await sleep(1500); }
if (COURSE) { await tap('.diff[data-d=' + COURSE + ']'); await sleep(300); await waitBuilt(); await sleep(1200); }
await tap('#startb');
await sleep(1200);

const BOTS = {
  // (work/shots_hud_desk.json's, word for word, with a watchdog: no progress for 20 s and it is carried on 60 m)
  mediocre: { handK: 1 / 32, handKmh: 42, handS: 0.38, cool: 3.2, grip: 11, hold: false },
  cruise: { handK: 99, handKmh: 999, handS: 0, cool: 99, grip: 8, hold: false },
};
if (BOT === 'parked') {
  await ev(`(() => { window.__DT__ = { teleports: 0 }; window.__AUTOPILOT__ = () => ({ throttle: 0, brake: 0, steer: 0, hand: 0, reverse: false, touch: false }); })()`);
} else if (BOT === 'drifter') {
  // work/qa_score_bench.mjs, mode 'drift': the gate's road follower under it, the skilled drifter on top, the keys ramped
  // as input.js ramps them; stuck against something it backs out, and the same watchdog as the others
  await ev(`(() => {
    const D = window.__DEBUG__, G = D.G, t = D.track;
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const B = { T: 0, k: 0, handUntil: 0, handCool: 0, stuck: 0, revUntil: 0, inBend: 0, lastS: 0, still: 0 };
    window.__DT__ = { teleports: 0 };
    window.__AUTOPILOT__ = (dt) => {
      B.T += dt;
      const car = D.car, v = car.speed, kmh = car.kmh, slip = car.beta * 180 / Math.PI, mag = D.magnet.active;
      if (G.s > B.lastS + 12) { B.lastS = G.s; B.still = 0; } else if (!mag) B.still += dt;
      if (B.still > 20) { B.still = 0; B.lastS = G.s + 60; window.__DT__.teleports++; D.teleport(G.s + 60, 40); }
      const headErr = wrap((G.roadH ?? t.pts[G.idx].h) - car.yaw);
      const k0 = t.sample(G.s + 22).k;
      const cmd = headErr * 1.3 - G.u * 0.12 + k0 * 9;
      let throttle = 1, brake = 0, hand = 0, reverse = false, key = cmd > 0.05 ? 1 : cmd < -0.05 ? -1 : 0;
      if (Math.abs(slip) > 38) key = slip > 0 ? 1 : -1;
      const look = 6 + v * 0.45, kA = t.sample(G.s + look).k, kH = t.sample(G.s + 3).k;
      const bend = Math.abs(kA) > 1 / 110 ? Math.sign(kA) : Math.abs(kH) > 1 / 130 ? Math.sign(kH) : 0;
      let kMax = 0;
      for (let ds = 0; ds <= 12 + v * 1.6; ds += 3) kMax = Math.max(kMax, Math.abs(t.sample(G.s + ds).k));
      const vIn = kMax > 0.002 ? Math.min(150, Math.sqrt(9.5 / kMax) * 3.6) : 150;
      const wl = t.sample(G.s + 4), edgeOut = bend ? (bend > 0 ? -(wl.wr) : wl.wl) : 0;
      const toOut = bend ? (edgeOut - G.u) * -bend : 9;
      if (bend && !B.inBend && kmh > 40 && Math.abs(slip) < 12) { B.inBend = bend; B.handUntil = B.T + 0.25; }
      if (B.inBend && (Math.abs(kA) < 1 / 200 && Math.abs(kH) < 1 / 160 || Math.sign(kA) === -B.inBend && Math.abs(kA) > 1 / 110)) B.inBend = 0;
      if (B.inBend) {
        key = B.inBend;
        hand = B.T < B.handUntil ? 1 : 0;
        throttle = toOut < 1.8 ? 0.15 : toOut < 3.2 ? 0.55 : 1; brake = 0;
        if (kmh > vIn * 1.25 && Math.abs(slip) < 25) throttle = 0;
        const lead = wrap(car.yaw + Math.atan2(car.vL, Math.max(0.5, car.vF)) - (G.roadH ?? 0)) * B.inBend;
        if (lead > 0.3) key = 0;
        if (Math.abs(slip) > 50) key = -B.inBend;
      } else {
        throttle = kmh > vIn ? 0 : 1; brake = kmh > vIn * 1.08 && Math.abs(slip) < 10 ? 1 : 0;
      }
      if (v < 1.1 && !mag) B.stuck += dt; else B.stuck = 0;
      if (B.stuck > 1.2) { B.revUntil = B.T + 1.3; B.stuck = 0; }
      if (B.T < B.revUntil) { throttle = 0; brake = 1; reverse = true; hand = 0; key = cmd < 0 ? 1 : -1; }
      const rate = key !== 0 ? 7.2 : 12;
      B.k += Math.max(-rate * dt, Math.min(rate * dt, key - B.k));
      return { throttle, brake, steer: B.k, hand, reverse, touch: false };
    };
  })()`);
} else {
  const P = BOTS[BOT];
  await ev(`(() => {
    const P = ${JSON.stringify(P)};
    const D = window.__DEBUG__, G = D.G, car = D.car; const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    let T = 0, next = 0, want = { gas: true }, handUntil = 0, handCool = 0, lastS = 0, stuck = 0, turn = 0;
    window.__DT__ = { teleports: 0, results: 0 };
    window.__AUTOPILOT__ = (dt) => {
      const t = D.track;
      T += dt;
      if (G.s > lastS + 12) { lastS = G.s; stuck = 0; } else if (!D.magnet.active) stuck += dt;
      if (stuck > 20) { stuck = 0; lastS = G.s + 60; window.__DT__.teleports++; D.teleport(G.s + 60, 40); }
      if (T >= next) {
        next = T + 0.085;
        const slip = car.beta * 180 / Math.PI, kmh = car.kmh;
        const headErr = wrap((G.roadH ?? t.pts[G.idx].h) - car.yaw);
        const k0 = t.sample(G.s + 22).k;
        const cmd = headErr * 1.3 - G.u * 0.12 + k0 * 9;
        const k = Math.abs(k0);
        const vmax = k > 0.002 ? Math.sqrt(P.grip / k) * 3.6 : 999;
        const tooFast = kmh > vmax * 1.15;
        const tight = k > P.handK && kmh > P.handKmh;
        if (tight && T > handCool) { handUntil = T + P.handS; handCool = T + P.cool; turn = Math.sign(k0); }
        want = { gas: !tooFast, brake: tooFast && Math.abs(slip) < 15, hand: T < handUntil, left: cmd > 0.05, right: cmd < -0.05 };
        if (P.hold && Math.abs(slip) > 8 && Math.abs(slip) < 42 && turn) {
          want.left = turn > 0; want.right = turn < 0; want.gas = true; want.brake = false;
        }
        if (Math.abs(slip) > 38) { want.left = slip > 0; want.right = slip < 0; }
      }
      const steer = want.left ? 0.94 : want.right ? -0.94 : 0;
      return { throttle: want.gas && !want.brake ? 1 : 0, brake: want.brake ? 1 : 0, steer, hand: want.hand ? 1 : 0, reverse: false, touch: false };
    };
  })()`);
}

const sample = () => ev(`(() => { const D = window.__DEBUG__, G = D.G, s = D.scoring; return { mode: G.mode, runT: +(G.runT ?? G.playT ?? 0).toFixed(1),
  dist: Math.round(G.dist), score: Math.round(s.total), hour: +G.hour.toFixed(3), clock: G.clockRun !== undefined ? +G.clockRun.toFixed(3) : null,
  fromPts: G.clockPts !== undefined ? +G.clockPts.toFixed(3) : null, fromPace: G.clockFloor !== undefined ? +G.clockFloor.toFixed(3) : 0,
  dawnT: G.dawnT || 0, drifts: s.stats.drifts, jturns: s.stats.jturns, crashes: s.stats.crashes, teleports: window.__DT__.teleports,
  C: D.CLOCK ? { ptsPerMin: D.ptsPerMin || D.CLOCK.ptsPerMin, mPerHour: D.mPerHour || D.CLOCK.mPerHour, stillMin: D.CLOCK.stillMin } : null }; })()`);
const t0 = Date.now(), rows = [];
let last = null, dawnAt = null;
while ((Date.now() - t0) / 60000 < MINUTES) {
  await sleep(5000);
  const s = await sample();
  rows.push(s); last = s;
  if (rows.length % 6 === 0) note(`${((Date.now() - t0) / 1000).toFixed(0)} s  run ${s.runT} s  ${s.dist} m  ${s.score} pts  hour ${s.hour}  drifts ${s.drifts}  mode ${s.mode}${s.teleports ? '  teleports ' + s.teleports : ''}`);
  if (s.dawnT && !dawnAt) { dawnAt = s; note(`DAWN at ${s.dawnT.toFixed(1)} s of play: ${s.dist} m, ${s.score} pts`); }
  if (s.mode === 'results') break;
}
// (the rates up to dawn when it came: the results freeze the run, and the seconds after it would only dilute them)
const at = dawnAt || last;
const v = at.dist / Math.max(1, at.runT), p = at.score / Math.max(1, at.runT);
note(`bot ${BOT}  map ${MAP}${COURSE ? ' ' + COURSE : ''}${PHONE ? ' phone' : ''}: ${at.runT} s of play, ${at.dist} m (${v.toFixed(2)} m/s, ${(v * 3.6).toFixed(1)} km/h), ${at.score} pts (${p.toFixed(1)} pts/s), ${at.drifts} drifts, ${at.crashes} crashes, ${at.jturns} J-turns paid${at.teleports ? ', carried on ' + at.teleports + ' times' : ''}`);
if (at.clock !== null) {
  const hPts = at.fromPts, hPace = at.fromPace || 0, hDist = at.clock - hPts - hPace;
  // (the score has more in it than the banked drifts: what was knocked over, the J-turns; only the banks move the clock)
  const banked = hPts * (at.C ? at.C.ptsPerMin : 300) * 60 / Math.max(1, at.runT);
  note(`clock${dawnAt ? ' at dawn' : ''}: ${at.clock.toFixed(2)} h (${hPace.toFixed(2)} h its own pace, ${hPts.toFixed(2)} h from banked points at ${at.C ? at.C.ptsPerMin : '?'} a minute, ${banked.toFixed(1)} banked a second, ${hDist.toFixed(2)} h by distance at ${at.C ? at.C.mPerHour : '?'} m/h); ${(100 * hPace / Math.max(1e-6, at.clock)).toFixed(0)}% its own pace, ${(100 * hPts / Math.max(1e-6, at.clock)).toFixed(0)}% from points, ${(100 * hDist / Math.max(1e-6, at.clock)).toFixed(0)}% from the road`);
}
if (dawnAt) note(`time to dawn ${Math.floor(dawnAt.dawnT / 60)}:${String(Math.round(dawnAt.dawnT % 60)).padStart(2, '0')} (${dawnAt.dawnT.toFixed(0)} s of play, ${dawnAt.dist} m, ${dawnAt.score} pts)`);
else if (at.clock) note(`no dawn in ${last.runT} s: at this rate (${(at.clock / Math.max(1, last.runT) * 3600).toFixed(1)} clock h per real hour) dawn would take ${((12.7 / Math.max(1e-6, at.clock / last.runT)) / 60).toFixed(1)} min`);
note('errors', Q.errors.length, JSON.stringify(Q.errors.slice(0, 5)));
fs.writeFileSync(path.join(Q.OUT, 'samples.json'), JSON.stringify({ bot: BOT, map: MAP, course: COURSE, rows }, null, 1));
fs.writeFileSync(path.join(Q.OUT, 'log.txt'), Q.log.join('\n'));
await Q.close();
