// Critique shots: teleport along a course and look at it four ways at each place (the chase camera, the roadside from
// the other verge, the landscape from high behind, the road at bumper height), at the hours given.
//   node work/mk_critique.mjs <moun|city> <out.json> [--s=300,900,1500] [--hours=17.3,22] [--views=chase,side,high,low]
import fs from 'fs';

const [map = 'moun', out = 'work/critique.json'] = process.argv.slice(2);
const opt = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const S = opt('s', '300,900,1500,2100,2700').split(',').map(Number);
const HOURS = opt('hours', '17.3,22').split(',').map(Number);
const VIEWS = opt('views', 'chase,side,high,low').split(',');
const steps = [{ wait: 2500 }];
if (map === 'city') steps.push({ click: '.map[data-m=city]' }, { wait: 9000 });
steps.push({ js: "document.getElementById('startb').click()" }, { wait: 2500 }, { js: 'window.__DEBUG__.rainNow(0)' },
  { js: `(() => { const D = window.__DEBUG__;
    window.__CRIT__ = (s, view, h) => {
      // (as if dawn were already behind: a jump across 06:00 would end the run and bring up its results)
      D.G.dawnT = D.G.dawnT || 0.01; D.G.hour = h; D.G.hourShown = h; D.G.lastApplied = -9;
      const p = D.teleport(s, 0), fx = Math.sin(p.h), fz = Math.cos(p.h), lx = Math.cos(p.h), lz = -Math.sin(p.h);
      let pos = null, look = null, fov = 62;
      if (view === 'side') { pos = [p.x + lx * 10, p.y + 2.4, p.z + lz * 10]; look = [p.x - lx * 8 + fx * 8, p.y + 1.2, p.z - lz * 8 + fz * 8]; fov = 58; }
      else if (view === 'high') { pos = [p.x - fx * 35, p.y + 30, p.z - fz * 35]; look = [p.x + fx * 140, p.y - 6, p.z + fz * 140]; fov = 62; }
      else if (view === 'low') { pos = [p.x + lx * 2.2, p.y + 0.7, p.z + lz * 2.2]; look = [p.x + fx * 40 + lx * 2.2, p.y + 0.9, p.z + fz * 40 + lz * 2.2]; fov = 55; }
      window.__CAM__ = pos ? { pos, look, fov } : null;
      if (!pos) { const cam = D.scene.children.find((o) => o.isPerspectiveCamera); cam.fov = 62; cam.updateProjectionMatrix(); }
    }; })()` });
const hh = (h) => `${String(Math.floor(h)).padStart(2, '0')}${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
for (const h of HOURS) for (const s of S) for (const v of VIEWS) {
  steps.push({ js: `window.__CRIT__(${s}, '${v}', ${h})` }, { wait: v === VIEWS[0] ? 2200 : 1300 }, { shot: `${map}_${hh(h)}_s${s}_${v}` });
}
steps.push({ js: 'window.__CAM__ = null' });
fs.writeFileSync(out, JSON.stringify(steps, null, 1));
console.log('wrote', out, HOURS.length * S.length * VIEWS.length, 'shots');
