// The run's whole loop and every screen it has, driven with real input (keys and clicks on a desktop, touches on a
// phone) and checked at each step, photographed at the size given:
//   node work/platform_flow.mjs                  desktop 1280 x 720, keys and clicks
//   node work/platform_flow.mjs --phone          390 x 844, touches
//   node work/platform_flow.mjs --vp=844x390     a phone on its side, touches
// Steps: the title (RECORDS and SETTINGS beside START), the records empty, the settings (KM/H and LIGHT chosen and
// seen on the HUD), a run with its phase captions, the pause's settings, MAIN MENU to RUN OVER, the records with that
// run, a run carried to dawn (SUNRISE, the results with KEEP DRIVING), KEEP DRIVING into the day, a quit after dawn,
// NEW RUN. Fails loudly on a state that is wrong or a console error.
import fs from 'fs';
import path from 'path';
import { open, sleep, arg } from './qa_lib.mjs';

const VP = arg('vp', ''), PHONE = process.argv.includes('--phone') || !!VP;
const viewport = VP ? { width: +VP.split('x')[0], height: +VP.split('x')[1], deviceScaleFactor: 2, isMobile: true, hasTouch: true } : null;
const tag = VP ? 'land' : PHONE ? 'phone' : 'desk';
const Q = await open({ phone: PHONE, viewport, out: arg('out', 'work/shots/platform_' + tag) });
const { page, ev, note, tap, shot } = Q;
const problems = [];
const expect = (what, ok, got) => { note(`${ok ? 'ok  ' : 'FAIL'} ${what}${got !== undefined ? '  (' + JSON.stringify(got) + ')' : ''}`); if (!ok) problems.push(what); };
const state = () => ev(`(() => { const D = window.__DEBUG__, G = D.G; const on = (id) => document.getElementById(id).classList.contains('on');
  return { mode: G.mode, title: on('title'), pause: on('pause'), results: on('results'), records: on('records'), settings: on('settings'),
    hour: +G.hour.toFixed(2), phase: G.phase, dawnT: G.dawnT, completed: G.completed, units: D.hud.units, curve: +D.post.retro.uniforms.uCurve.value.toFixed(4) }; })()`);
const press = async (key) => { await page.keyboard.press(key); await sleep(350); };
// (a real finger on a phone, a real click on a desktop)
const hit = async (sel, wait = 450) => { await tap(sel); await sleep(wait); };

await sleep(1500);
await shot('01_title');
let s = await state();
expect('the title is up, START visible', s.title && await ev(`(() => { const r = document.getElementById('startb').getBoundingClientRect(); return r.width > 0 && r.bottom <= innerHeight && r.top >= 0; })()`));

// the records, empty
await hit('#recordsb');
s = await state(); expect('RECORDS opens its panel', s.records);
await shot('02_records_empty');
if (PHONE) await hit('#rec-back'); else await press('Escape');
s = await state(); expect('the records close', !s.records && s.title);

// the settings: KM/H and LIGHT
await hit('#settingsb');
s = await state(); expect('SETTINGS opens its panel', s.settings);
await hit('.seg[data-k=units] button[data-v=kmh]', 250);
await hit('.seg[data-k=tv] button[data-v=light]', 250);
await hit('.vol[data-k=music] .vstep[data-d="-1"]', 250);
await shot('03_settings_title');
s = await state(); expect('KM/H and LIGHT taken', s.units === 'kmh' && s.curve < 0.02, { units: s.units, curve: s.curve });
expect('the settings kept', await ev(`JSON.parse(localStorage.getItem('sundrift.settings')).music === 9`));
await hit('#set-back');
s = await state(); expect('the settings close', !s.settings && s.title);
await shot('04_title_light');

// a run: the channel's caption, then the golden hour's
await hit('#startb', 1200);
s = await state(); expect('START starts a run', s.mode === 'playing' && !s.title, s.mode);
if (PHONE) {
  const st = await ev(`(() => { const r = document.getElementById('stick').getBoundingClientRect(); return [r.x + r.width * 0.45, r.y + r.height * 0.6]; })()`);
  await page.touchscreen.touchStart(st[0], st[1]); await sleep(300); await page.touchscreen.touchMove(st[0], st[1] - 30);
  await sleep(2600); await page.touchscreen.touchEnd();
} else { await page.keyboard.down('KeyW'); await sleep(2900); await page.keyboard.up('KeyW'); }
await shot('05_run_golden_hour');
await ev('window.__DEBUG__.clockTo(18.26)');
await sleep(1200);
s = await state(); expect('the clock entered the blue hour', s.phase === 'blue', s.phase);
await shot('06_run_blue_hour');
// a bank that carries the clock into the next phase says it too (2,400 points: ten minutes over 19:15)
await ev('(() => { const D = window.__DEBUG__, s = D.scoring; D.clockTo(19.2); s.active = true; s.points = 2400; s.time = 3; s.bank(); })()');
await sleep(2600);
s = await state(); expect('a banked drift carried the clock into the night', s.phase === 'night' && s.hour > 19.25, s);
await shot('06b_run_night_by_bank');

// pause, its settings, MAIN MENU: RUN OVER
if (PHONE) await hit('#pauseb'); else await press('Escape');
s = await state(); expect('paused', s.mode === 'paused' && s.pause);
await shot('07_pause');
await hit('#psetb');
s = await state(); expect('the pause menu opens the settings', s.settings && s.pause);
await shot('08_settings_pause');
await hit('.seg[data-k=units] button[data-v=mph]', 250);
await hit('.seg[data-k=tv] button[data-v=full]', 250);
if (PHONE) await hit('#set-back'); else await press('Escape');
s = await state(); expect('back to the pause menu', !s.settings && s.pause && s.units === 'mph' && s.curve > 0.02);
await hit('#quitb', 1200);
s = await state(); expect('MAIN MENU shows the results first (RUN OVER)', s.mode === 'results' && s.results && !s.title);
expect('RUN OVER, no KEEP DRIVING', await ev(`document.getElementById('r-title').textContent === 'RUN OVER' && getComputedStyle(document.getElementById('r-keep')).display === 'none'`));
await shot('09_results_run_over');
// (on a desktop the keys: Escape is the way out, MAIN MENU on RUN OVER)
if (PHONE) await hit('#r-menu', 900); else { await press('Escape'); await sleep(550); }
s = await state(); expect('MAIN MENU from the results: the title', s.mode === 'title' && s.title && !s.results);
await hit('#recordsb');
expect('the records hold that run as the last', await ev(`!document.getElementById('rc-last').classList.contains('empty') && !document.getElementById('rc-best').classList.contains('empty')`));
await shot('10_records_last_run');
await hit('#rec-back');

// a run to dawn: SUNRISE, the results with KEEP DRIVING
await hit('#startb', 1500);
await ev('(() => { const s = window.__DEBUG__.scoring; s.total = 15000; s.stats.drifts = 12; s.stats.biggest = 4200; s.stats.combo = 5; window.__DEBUG__.clockTo(6.0); })()');
await sleep(700);
s = await state(); expect('dawn reached', s.dawnT > 0, s.dawnT);
await shot('11_sunrise');
await sleep(3200);
s = await state(); expect('the run complete: the results', s.mode === 'results' && s.completed && s.results);
expect('DAWN, with KEEP DRIVING', await ev(`document.getElementById('r-title').textContent === 'DAWN' && getComputedStyle(document.getElementById('r-keep')).display !== 'none'`));
expect('a new best score and the fastest dawn marked', await ev(`document.getElementById('r-score').classList.contains('hi') && document.getElementById('r-dawn').classList.contains('hi')`));
await shot('12_results_dawn');
// (on a desktop the keys: Enter takes the first choice, KEEP DRIVING at dawn)
if (PHONE) await hit('#r-keep', 1200); else { await press('Enter'); await sleep(850); }
s = await state(); expect('KEEP DRIVING: the same run, on into the day', s.mode === 'playing' && s.completed && s.phase === 'day', s);
await shot('13_keep_driving');
if (PHONE) await hit('#pauseb'); else await press('Escape');
await hit('#quitb', 1200);
s = await state(); expect('a quit after dawn: its results, DAWN, no KEEP DRIVING', s.mode === 'results' && await ev(`document.getElementById('r-title').textContent === 'DAWN' && getComputedStyle(document.getElementById('r-keep')).display === 'none'`));
await shot('14_results_after_day');
await hit('#r-new', 1200);
s = await state(); expect('NEW RUN: a run from the golden hour again', s.mode === 'playing' && s.hour < 17.5 && s.hour > 17.2 && !s.completed, s);
if (PHONE) await hit('#pauseb'); else await press('Escape');
await hit('#quitb', 1200); await hit('#r-menu', 900);
await hit('#recordsb');
expect('the records: best, fastest dawn and last all kept', await ev(`['best', 'fast', 'last'].every((k) => !document.getElementById('rc-' + k).classList.contains('empty'))`));
await shot('15_records_full');
note('records', await ev(`(() => { const r = window.__DEBUG__.records; return { best: r.best && r.best.score, fastest: r.fastest && r.fastest.dawnTime, last: r.last && r.last.score }; })()`));
note('errors', Q.errors.length, JSON.stringify(Q.errors.slice(0, 6)));
if (Q.errors.some((e) => e[0] !== 'warning')) problems.push('console errors');
fs.writeFileSync(path.join(Q.OUT, 'flow.txt'), Q.log.join('\n'));
await Q.close();
if (problems.length) { console.log('\nproblems:\n  ' + problems.join('\n  ')); process.exit(1); }
console.log('\nevery step as it should be');
