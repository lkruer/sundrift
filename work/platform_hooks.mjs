// The platform's hooks (game/src/platform.js), checked against a stub platform that records every call: the loading,
// a run started, paused (and by hiding the tab), resumed, carried to dawn (runComplete with its breakdown), KEEP
// DRIVING, a share taken over by the platform, and a hook that throws (a warning, never an error, and the game goes on).
// And the old best score key read as before (a best from before the records, shown on the title and in RECORDS).
//   node work/platform_hooks.mjs
import fs from 'fs';
import path from 'path';
import { open, sleep } from './qa_lib.mjs';

const stub = `window.__CALLS__ = []; window.SUNDRIFT_PLATFORM = {
  init() { __CALLS__.push(['init']); }, loadingProgress(f) { __CALLS__.push(['loadingProgress', +f.toFixed(2)]); }, loadingDone() { __CALLS__.push(['loadingDone']); },
  gameplayStart() { __CALLS__.push(['gameplayStart']); }, gameplayStop() { __CALLS__.push(['gameplayStop']); },
  runComplete(s) { __CALLS__.push(['runComplete', s]); }, share(p) { __CALLS__.push(['share', { text: p.text, url: p.url, card: p.card ? p.card.type + ' ' + p.card.size : null }]); return true; },
};`;
// (a player who had a best of 54,321 on the easy pass before the records existed; records for the hard pass that do
// not parse; settings from a version that does not exist)
const Q = await open({ out: 'work/qa_out/platform_hooks', init: stub,
  storage: { 'sundrift.best.easy': '54321', 'sundrift.records.hard': '{not json', 'sundrift.settings': '{"v":99,"units":"kmh","master":3}' } });
const { page, ev, note, tap } = Q;
// (console.warn arrives as 'warn' here; qa_lib keeps errors and 'warning's, so the host's warning is listened for here)
const consoleSaid = [];
page.on('console', (m) => consoleSaid.push([m.type(), m.text()]));
const problems = [];
const expect = (what, ok, got) => { note(`${ok ? 'ok  ' : 'FAIL'} ${what}${got !== undefined ? '  ' + JSON.stringify(got).slice(0, 400) : ''}`); if (!ok) problems.push(what); };
const calls = () => ev('window.__CALLS__.splice(0)');
let c = await calls();
const names = (cs) => cs.map((x) => x[0]);
expect('init, then the loading as it goes, then loadingDone', c[0][0] === 'init' && c.some((x) => x[0] === 'loadingProgress' && x[1] === 1) && c[c.length - 1][0] === 'loadingDone', names(c).filter((n, i, a) => a.indexOf(n) === i));
expect('the old best key still read: the title says BEST 54,321', (await ev(`document.getElementById('best-easy').textContent`)) === 'BEST 54,321');
await tap('#recordsb'); await sleep(400);
expect('RECORDS shows the old best, with no breakdown', (await ev(`document.getElementById('rc-best-big').textContent`)) === '54,321' && await ev(`document.getElementById('rc-best').classList.contains('noshare')`));
await tap('#rec-back'); await sleep(300);
expect('settings of an unknown version: the defaults (MPH, full volume)', (await ev('JSON.stringify([window.__DEBUG__.settings.v.units, window.__DEBUG__.settings.v.master, window.__DEBUG__.hud.units])')) === '["mph",10,"mph"]');
// the hard pass's records do not parse: no records, no error
await tap('.diff[data-d=hard]'); await sleep(300); await Q.waitBuilt(); await sleep(500);
await tap('#recordsb'); await sleep(400);
expect('records that do not parse: empty cards', await ev(`['best', 'fast', 'last'].every((k) => document.getElementById('rc-' + k).classList.contains('empty'))`));
await tap('#rec-back'); await sleep(300);
await tap('.diff[data-d=easy]'); await sleep(300); await Q.waitBuilt(); await sleep(500);
await calls();
await tap('#startb'); await sleep(1500);
c = await calls(); expect('START: gameplayStart', names(c).join() === 'gameplayStart', names(c));
await page.keyboard.press('Escape'); await sleep(400);
await page.keyboard.press('Escape'); await sleep(400);
c = await calls(); expect('pause and resume: gameplayStop, gameplayStart', names(c).join() === 'gameplayStop,gameplayStart', names(c));
// the tab hidden: the run pauses itself
await ev(`(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); })()`);
await sleep(300);
c = await calls(); expect('the tab hidden: the run paused, gameplayStop', names(c).join() === 'gameplayStop' && (await ev('window.__DEBUG__.G.mode')) === 'paused', names(c));
await ev(`(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); })()`);
await page.keyboard.press('Escape'); await sleep(400);
c = await calls(); expect('resumed by the player: gameplayStart', names(c).join() === 'gameplayStart', names(c));
// dawn
await ev('(() => { const s = window.__DEBUG__.scoring; s.total = 60000; s.stats.drifts = 20; window.__DEBUG__.clockTo(6.0); })()');
await sleep(3800);
c = await calls();
const rc = c.find((x) => x[0] === 'runComplete');
expect('dawn: runComplete once, with the breakdown, then gameplayStop', rc && names(c).join() === 'runComplete,gameplayStop' && rc[1].dawn === true && rc[1].score === 60000 && rc[1].course === 'YOZAKURA PASS · EASY' && 'smashes' in rc[1] && 'topKmh' in rc[1], c);
await tap('#r-share'); await sleep(1500);
c = await calls();
expect('SHARE handed to the platform (text, url, the PNG card); the button says SHARED', c.length === 1 && c[0][0] === 'share' && /reached dawn in/.test(c[0][1].text) && c[0][1].url === 'https://lkruer.github.io/sundrift/game/' && /image\/png/.test(c[0][1].card || '') && (await ev(`document.getElementById('r-share').textContent`)) === 'SHARED!', c);
await tap('#r-keep'); await sleep(800);
c = await calls(); expect('KEEP DRIVING: gameplayStart, and no second runComplete', names(c).join() === 'gameplayStart', names(c));
await ev('window.__DEBUG__.clockTo(5.999)'); await sleep(600); await ev('window.__DEBUG__.clockTo(6.01)'); await sleep(3500);
c = await calls(); expect('a second dawn (a day later) does not complete the run again', !c.some((x) => x[0] === 'runComplete') && (await ev('window.__DEBUG__.G.mode')) === 'playing', names(c));
// a hook that throws: a warning once, the game goes on
await ev(`window.SUNDRIFT_PLATFORM.gameplayStop = () => { throw new Error('the host broke'); }`);
await page.keyboard.press('Escape'); await sleep(400);
await page.keyboard.press('Escape'); await sleep(400);
expect('a throwing hook: the game goes on', (await ev('window.__DEBUG__.G.mode')) === 'playing');
const warns = consoleSaid.filter((e) => /the host broke/.test(e[1]));
expect('...and it is a warning, once, not an error', warns.length === 1 && /^warn/.test(warns[0][0]), warns);
// RESTART: the run left behind is the last run (as it ended, carried on past dawn), with no results screen
const runId = await ev('window.__DEBUG__.G.runId');
await page.keyboard.press('Escape'); await sleep(400);
await tap('#restartb'); await sleep(800);
const last = await ev('window.__DEBUG__.records.last');
expect('RESTART: the abandoned run recorded as the last run, no results, a new run under way', last && last.id === runId && last.dawn === true && last.clock > 6 && (await ev('window.__DEBUG__.G.mode')) === 'playing' && (await ev('window.__DEBUG__.G.runId')) !== runId, last && { id: last.id, runId, clock: last.clock });
note('errors', JSON.stringify(Q.errors.filter((e) => e[0] !== 'warning').slice(0, 5)));
if (Q.errors.some((e) => e[0] !== 'warning')) problems.push('console errors');
fs.writeFileSync(path.join(Q.OUT, 'hooks.txt'), Q.log.join('\n'));
await Q.close();
if (problems.length) { console.log('\nproblems:\n  ' + problems.join('\n  ')); process.exit(1); }
console.log('\nevery hook as it should be');
