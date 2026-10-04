// A look at the verge close up: at each spot, from the middle of the road a little up, looking at the verge on one side
// a few metres ahead (the side gutters, the kilometre posts, the wayside shrines, the dry-stone walls).
//   node work/verge_tour.mjs <out.json> --at=500:1,1000:1,875:-1 [--hours=17.3] [--ahead=7] [--up=1.6]
import fs from 'fs';

const out = process.argv[2] || 'verge_tour.json';
const opt = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const AT = opt('at', '500:1').split(',').map((x) => x.split(':').map(Number));
const HOURS = opt('hours', '17.3').split(',').map(Number), AHEAD = Number(opt('ahead', 7)), UP = Number(opt('up', 1.6));
const steps = [{ wait: 2500 }, { js: "document.getElementById('startb').click()" }, { wait: 2500 }, { js: 'window.__DEBUG__.rainNow(0)' },
  { js: `(() => { const D = window.__DEBUG__;
    window.__VERGE__ = (s, side, h, ahead, up) => {
      D.G.dawnT = D.G.dawnT || 0.01; D.G.hour = h; D.G.hourShown = h; D.G.lastApplied = -9;
      D.teleport(s - 30, 0);
      const p = D.track.sample(s - ahead), q = D.track.sample(s), lx = Math.cos(q.h) * side, lz = -Math.sin(q.h) * side;
      const w = side > 0 ? q.wl : q.wr;
      window.__CAM__ = { pos: [p.x, p.y + up, p.z], look: [q.x + lx * (w + 1.5), q.y + 0.8, q.z + lz * (w + 1.5)], fov: 60 };
    }; })()` }];
const hh = (h) => `${String(Math.floor(h)).padStart(2, '0')}${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
for (const h of HOURS) for (const [s, side] of AT) steps.push({ js: `window.__VERGE__(${s}, ${side}, ${h}, ${AHEAD}, ${UP})` }, { wait: 1800 }, { shot: `verge_${hh(h)}_s${s}_${side > 0 ? 'L' : 'R'}` });
steps.push({ js: 'window.__CAM__ = null' });
fs.writeFileSync(out, JSON.stringify(steps, null, 1));
console.log('wrote', out, steps.filter((x) => x.shot).length, 'shots');
