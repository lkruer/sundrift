// Sky check: stop the car, hold a debug camera a few metres up, look toward the sun and away from it at each hour.
//   node work/mk_skycheck.mjs <moun|city> <out.json> [hours comma-separated] [--el=6]
import fs from 'fs';

const [map = 'moun', out = 'work/skycheck.json', hoursArg] = process.argv.slice(2);
const el = Number((process.argv.find((a) => a.startsWith('--el=')) || '--el=6').split('=')[1]);
const HOURS = hoursArg && !hoursArg.startsWith('--') ? hoursArg.split(',').map(Number) : [17.3, 17.85, 18.2, 18.62, 5.55, 6.05, 12.0];
const steps = [{ wait: 2500 }];
if (map === 'city') steps.push({ click: '.map[data-m=city]' }, { wait: 9000 });
steps.push({ js: "document.getElementById('startb').click()" }, { wait: 2500 },
  { js: 'window.__DEBUG__.rainNow(0)' },
  { js: `(() => { const D = window.__DEBUG__; window.__HOUR__ = (h) => { D.G.hour = h; D.G.hourShown = h; D.G.lastApplied = -9; };
    window.__SKY__ = (off, el) => { const c = D.car, s = D.rig.sunDir, az = Math.atan2(s.x, -s.z) + off * Math.PI / 180;
    const p = [c.x, (D.G.carY || 0) + 9, c.z], e = el * Math.PI / 180;
    window.__CAM__ = { pos: p, look: [p[0] + Math.sin(az) * Math.cos(e) * 100, p[1] + Math.sin(e) * 100, p[2] - Math.cos(az) * Math.cos(e) * 100], fov: 62 }; }; })()` });
const name = (h, tag) => `${map}_${String(Math.floor(h)).padStart(2, '0')}${String(Math.round((h % 1) * 60)).padStart(2, '0')}_${tag}`;
for (const h of HOURS) {
  steps.push({ js: `window.__HOUR__(${h})` }, { wait: 700 });
  for (const [tag, off] of [['sun', 0], ['away', 180], ['side', 90]]) steps.push({ js: `window.__SKY__(${off}, ${el})` }, { wait: 2200 }, { shot: name(h, tag) });
}
fs.writeFileSync(out, JSON.stringify(steps, null, 1));
console.log('wrote', out, HOURS.length * 3, 'shots');
