// Sky check: stop the car, hold a debug camera a few metres up, look toward the sun and away from it at each hour.
//   node work/mk_skycheck.mjs <moun|city> <out.json> [hours comma-separated] [--el=6]
import fs from 'fs';
import { sunAt } from '../game/src/daylight.js';

const [map = 'moun', out = 'work/skycheck.json', hoursArg] = process.argv.slice(2);
const el = Number((process.argv.find((a) => a.startsWith('--el=')) || '--el=6').split('=')[1]);
const HOURS = hoursArg && !hoursArg.startsWith('--') ? hoursArg.split(',').map(Number) : [17.3, 17.85, 18.2, 18.62, 5.55, 6.05, 12.0];
const steps = [{ wait: 2500 }];
if (map === 'city') steps.push({ click: '.map[data-m=city]' }, { wait: 9000 });
steps.push({ js: "document.getElementById('startb').click()" }, { wait: 2500 },
  { js: 'window.__DEBUG__.rainNow(0)' },
  { js: `(() => { const D = window.__DEBUG__; window.__SKY__ = (h, az, el) => { D.G.hour = h; D.G.hourShown = h; D.G.lastApplied = -9; const c = D.car;
    const p = [c.x, (D.G.carY || 0) + 9, c.z], a = az * Math.PI / 180, e = el * Math.PI / 180;
    window.__CAM__ = { pos: p, look: [p[0] + Math.sin(a) * Math.cos(e) * 100, p[1] + Math.sin(e) * 100, p[2] - Math.cos(a) * Math.cos(e) * 100], fov: 62 }; }; })()` });
const name = (h, tag) => `${map}_${String(Math.floor(h)).padStart(2, '0')}${String(Math.round((h % 1) * 60)).padStart(2, '0')}_${tag}`;
for (const h of HOURS) {
  const az = sunAt(h).az;
  for (const [tag, a] of [['sun', az], ['away', az + 180], ['side', az + 90]]) steps.push({ js: `window.__SKY__(${h}, ${a}, ${el})` }, { wait: 2600 }, { shot: name(h, tag) });
}
fs.writeFileSync(out, JSON.stringify(steps, null, 1));
console.log('wrote', out, HOURS.length * 3, 'shots');
