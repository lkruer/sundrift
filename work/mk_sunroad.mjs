// Gameplay glare check: find the stretches of the course that head straight into the sun at an hour, teleport there and
// shoot the chase camera (and the road at bumper height), the way a player meets a low sun.
//   node work/mk_sunroad.mjs <moun|city> <out.json> [--hours=17.3,17.85] [--n=3]
import fs from 'fs';
const [map = 'moun', out = 'work/sunroad.json'] = process.argv.slice(2);
const opt = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const HOURS = opt('hours', '17.3,17.85').split(',').map(Number), N = Number(opt('n', 3));
const steps = [{ wait: 2500 }];
if (map === 'city') steps.push({ click: '.map[data-m=city]' }, { wait: 9000 });
steps.push({ js: "document.getElementById('startb').click()" }, { wait: 2500 }, { js: 'window.__DEBUG__.rainNow(0)' },
  { js: `(() => { const D = window.__DEBUG__;
    window.__HOUR__ = (h) => { D.G.dawnT = D.G.dawnT || 0.01; D.G.hour = h; D.G.hourShown = h; D.G.lastApplied = -9; };
    window.__SUNROAD__ = (k) => {
      const t = D.track, sd = D.rig.sunDir, sx = sd.x, sz = sd.z, sl = Math.hypot(sx, sz) || 1, L = Math.min(t.sFinal || 6000, 6000);
      const found = [];
      for (let s = 60; s < L; s += 15) {
        const a = t.sample(s), b = t.sample(s + 40);
        const fx = Math.sin(a.h), fz = Math.cos(a.h), dot = (fx * sx + fz * sz) / sl;
        // (straight enough that the sun stays ahead for the length of the shot)
        if (dot > 0.8 && Math.abs(a.k || 0) < 0.02 && !a.tunnel) found.push(s);
      }
      const picks = []; for (const s of found) if (!picks.length || s - picks[picks.length - 1] > 300) picks.push(s);
      const s = picks[k % Math.max(1, picks.length)] ?? 300;
      D.teleport(s, 0); window.__CAM__ = null;
      return { s, n: picks.length };
    }; })()` });
const hh = (h) => `${String(Math.floor(h)).padStart(2, '0')}${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
for (const h of HOURS) {
  steps.push({ js: `window.__HOUR__(${h})` }, { wait: 600 });
  for (let k = 0; k < N; k++) steps.push({ js: `window.__SUNROAD__(${k})` }, { wait: 2000 }, { shot: `${map}_${hh(h)}_sun${k}` });
}
fs.writeFileSync(out, JSON.stringify(steps, null, 1));
console.log('wrote', out);
