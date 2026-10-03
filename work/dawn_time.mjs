// How long a run takes to reach dawn, driven by an autopilot, headless and in real time (the clock is the score:
// distance and banked drift points move it, see CLOCK in game/src/config.js).
//   node work/dawn_time.mjs [--bot=mediocre|keen] [--map=mountain|city] [--course=easy|hard] [--minutes=15] [--phone]
// mediocre: the road follower of work/shots_hud_desk.json (a handbrake flick into the tight corners only), the
// "mediocre driver" the clock is tuned against. keen: the same follower flicking into every real bend; it banks hardly
// more (78 points a second to the mediocre one's 70 on the easy pass, over four minutes), so a skilled player's time
// is worked out from the points rate instead (NOTES.md, 3 October). Prints a line every 30 s and, at the end, the
// rates, how the clock was moved, and the time to dawn if the run got there.
import fs from 'fs';
import path from 'path';
import { open, sleep, arg } from './qa_lib.mjs';

const BOT = arg('bot', 'mediocre'), MAP = arg('map', 'mountain'), COURSE = arg('course', ''), MINUTES = Number(arg('minutes', 15));
const PHONE = process.argv.includes('--phone');
const Q = await open({ phone: PHONE, out: `work/qa_out/dawn_${BOT}_${MAP}${COURSE ? '_' + COURSE : ''}${PHONE ? '_phone' : ''}` });
const { ev, note, tap, waitBuilt } = Q;
if (MAP === 'city') { await tap('.map[data-m=city]'); await sleep(300); await waitBuilt(); await sleep(1500); }
if (COURSE) { await tap('.diff[data-d=' + COURSE + ']'); await sleep(300); await waitBuilt(); await sleep(1200); }
await tap('#startb');
await sleep(1200);

const BOTS = {
  // (work/shots_hud_desk.json's, word for word, with a watchdog: no progress for 20 s and it is carried on 60 m)
  mediocre: { handK: 1 / 32, handKmh: 42, handS: 0.38, cool: 3.2, grip: 11, hold: false },
  keen: { handK: 1 / 55, handKmh: 46, handS: 0.34, cool: 1.8, grip: 13, hold: false },
};
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
        // (keen: the key held into the turn while the slide lasts, and the gas kept on, so the slide holds and scores)
        want.left = turn > 0; want.right = turn < 0; want.gas = true; want.brake = false;
      }
      if (Math.abs(slip) > 38) { want.left = slip > 0; want.right = slip < 0; }
    }
    const steer = want.left ? 0.94 : want.right ? -0.94 : 0;
    return { throttle: want.gas && !want.brake ? 1 : 0, brake: want.brake ? 1 : 0, steer, hand: want.hand ? 1 : 0, reverse: false, touch: false };
  };
})()`);

const sample = () => ev(`(() => { const D = window.__DEBUG__, G = D.G, s = D.scoring; return { mode: G.mode, runT: +(G.runT ?? G.playT ?? 0).toFixed(1),
  dist: Math.round(G.dist), score: Math.round(s.total), hour: +G.hour.toFixed(3), clock: G.clockRun !== undefined ? +G.clockRun.toFixed(3) : null,
  fromPts: G.clockPts !== undefined ? +G.clockPts.toFixed(3) : null, dawnT: G.dawnT || 0, drifts: s.stats.drifts, teleports: window.__DT__.teleports,
  C: D.CLOCK ? { ptsPerMin: D.ptsPerMin || D.CLOCK.ptsPerMin, mPerHour: D.mPerHour || D.CLOCK.mPerHour } : null }; })()`);
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
const v = last.dist / Math.max(1, last.runT), p = last.score / Math.max(1, last.runT);
note(`bot ${BOT}  map ${MAP}${COURSE ? ' ' + COURSE : ''}${PHONE ? ' phone' : ''}: ${last.runT} s of play, ${last.dist} m (${v.toFixed(2)} m/s, ${(v * 3.6).toFixed(1)} km/h), ${last.score} pts (${p.toFixed(1)} pts/s), ${last.drifts} drifts`);
const at = dawnAt || last;
if (at.clock !== null) {
  const hPts = at.fromPts, hDist = at.clock - at.fromPts;
  note(`clock${dawnAt ? ' at dawn' : ''}: ${at.clock.toFixed(2)} h driven (${hPts.toFixed(2)} h from banked points at ${at.C ? at.C.ptsPerMin : '?'} a minute, ${(hPts * (at.C ? at.C.ptsPerMin : 240) * 60 / Math.max(1, (dawnAt || last).runT)).toFixed(0)} a second; ${hDist.toFixed(2)} h by distance at ${at.C ? at.C.mPerHour : '?'} m/h); ${(100 * hPts / Math.max(1e-6, at.clock)).toFixed(0)}% from points`);
}
if (dawnAt) note(`time to dawn ${Math.floor(dawnAt.dawnT / 60)}:${String(Math.round(dawnAt.dawnT % 60)).padStart(2, '0')} (${dawnAt.dawnT.toFixed(0)} s of play, ${dawnAt.dist} m, ${dawnAt.score} pts)`);
else if (at.clock) note(`no dawn in ${last.runT} s: at this rate (${(at.clock / Math.max(1, last.runT) * 3600).toFixed(1)} clock h per real hour) dawn would take ${((12.7 / Math.max(1e-6, at.clock / last.runT)) / 60).toFixed(1)} min`);
note('errors', Q.errors.length, JSON.stringify(Q.errors.slice(0, 5)));
fs.writeFileSync(path.join(Q.OUT, 'samples.json'), JSON.stringify({ bot: BOT, map: MAP, course: COURSE, rows }, null, 1));
fs.writeFileSync(path.join(Q.OUT, 'log.txt'), Q.log.join('\n'));
await Q.close();
