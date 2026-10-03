// The QA round's changes to the scoring (work/QA_REPORT.md: C1's J-turn, M3, M4), checked on scoring.js alone, in node:
//   node work/scoring_check.mjs
// a J-turn pays only once the car has driven 250 m since the last one that paid; a slide starts a drift on the road and
// its shoulder, not off it; a switch pays a flat 120 and leaves the chain and the multiplier alone; a drift that leaves
// the road pays nothing more and banks after the grace.
import path from 'path';
import { pathToFileURL } from 'url';

const { Scoring } = await import(pathToFileURL(path.resolve('game/src/scoring.js')).href);
let bad = 0;
const ok = (what, cond, got) => { if (!cond) bad++; console.log((cond ? 'ok   ' : 'FAIL ') + what + (got !== undefined ? '  ' + JSON.stringify(got) : '')); };
const car = (beta, speed, surface = 1) => ({ beta, speed, surface });
const DT = 1 / 60;

{
  const s = new Scoring();
  const v = [s.jturn(10), s.jturn(110), s.jturn(270), s.jturn(300)].map((e) => e.value);
  ok('a J-turn pays once the car has driven 250 m since the last one that paid', v.join() === '500,0,500,0' && s.total === 1000 && s.stats.jturns === 2, [v, s.total, s.stats.jturns]);
}
{
  const s = new Scoring();
  s.update(DT, car(0.4, 15), 0, false, 0.6);
  ok('off the road (the verge, the pavement: 0.6) a slide starts no drift', !s.active);
  s.update(DT, car(0.4, 15), 0, false, 0.88);
  ok('on the shoulder (0.88) it does', s.active);
}
{
  const s = new Scoring();
  s.update(DT, car(0.4, 15), 0, false, 1);
  const chain = s.chain, mult = s.mult, p0 = s.points;
  s.update(DT, car(-0.4, 15), 0, false, 1);
  const n = s.drain().filter((e) => e.type === 'switch').length, gained = s.points - p0;
  ok('a switch pays a flat 120 (and the frame\'s slide), the chain and the multiplier untouched', n === 1 && s.chain === chain && s.mult === mult && gained > 120 && gained < 140, { chain: s.chain, mult: s.mult, gained: +gained.toFixed(1) });
}
{
  const s = new Scoring();
  for (let i = 0; i < 60; i++) s.update(DT, car(0.4, 15), 0, false, 1);
  const p = s.points;
  for (let i = 0; i < 30; i++) s.update(DT, car(0.4, 15), 0, false, 0.6);
  ok('a drift that leaves the road pays nothing more', Math.abs(s.points - p) < 1e-9, [+p.toFixed(1), +s.points.toFixed(1)]);
  for (let i = 0; i < 40; i++) s.update(DT, car(0.4, 15), 0, false, 0.6);
  ok('...and banks what it had after the grace', !s.active && s.total === Math.round(p), [s.active, s.total]);
}
{
  const s = new Scoring();
  s.update(DT, car(0.4, 15, 0.6), 0, false);
  ok('with no ground given, the car\'s own surface decides', !s.active);
}
if (bad) { console.log(`\n${bad} wrong`); process.exit(1); }
console.log('\nthe scoring as the QA round asked');
