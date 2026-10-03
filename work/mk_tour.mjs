// A time-of-day tour: start a run on a map, let the autopilot drive, and take a shot at each hour.
//   node work/mk_tour.mjs <moun|city> <out.json> [hours comma-separated] [--hold=ms] [--rain=0..1 (held)]
import fs from 'fs';

const [map = 'moun', out = 'work/tour.json', hoursArg] = process.argv.slice(2);
const hold = Number((process.argv.find((a) => a.startsWith('--hold=')) || '--hold=3500').split('=')[1]);
const HOURS = hoursArg && !hoursArg.startsWith('--') ? hoursArg.split(',').map(Number)
  : [17.3, 17.85, 18.2, 18.62, 19.05, 21.5, 5.0, 5.55, 6.05, 6.75, 8.6, 12.0, 14.8, 16.4];
const base = JSON.parse(fs.readFileSync('work/shots_timetour_moun.json', 'utf8'));
// the autopilot step and the sun camera step, taken from the old tour
const autopilot = base.find((s) => s.js && s.js.includes('__AUTOPILOT__ = (dt)'));
const steps = [{ wait: 2500 }];
if (map === 'city') steps.push({ click: '.map[data-m=city]' }, { wait: 9000 });
const rainArg = process.argv.find((a) => a.startsWith('--rain='));
steps.push({ js: "document.getElementById('startb').click()" }, { wait: 1200 }, autopilot,
  ...(rainArg ? [{ js: `window.__DEBUG__.rainNow(${Number(rainArg.split('=')[1])})` }] : []),
  // (as if dawn were already behind: a jump across 06:00 would end the run and bring up its results)
  { js: '(() => { window.__SUNCAM__ = (h) => { const D = window.__DEBUG__; D.G.dawnT = D.G.dawnT || 0.01; D.G.hour = h; D.G.hourShown = h; D.G.lastApplied = -9; }; })()' });
const name = (h) => `${map}_${String(Math.floor(h)).padStart(2, '0')}${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
for (const h of HOURS) steps.push({ js: `window.__SUNCAM__(${h})` }, { wait: hold }, { shot: name(h) });
steps.push({ js: 'window.__AUTOPILOT__ = null' });
fs.writeFileSync(out, JSON.stringify(steps, null, 1));
console.log('wrote', out, HOURS.length, 'hours');
