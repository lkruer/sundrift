// A look at the farmland close up: from a spot on the pass, finds the nearest plots of each kind (a paddy, a tea plot,
// a vegetable plot, a house lot) and photographs each from a few dozen metres off and a few metres up, at the hours given.
//   node work/farm_tour.mjs <out.json> [--s=900] [--hours=17.3,12,22] [--dist=26] [--up=7]
import fs from 'fs';

const out = process.argv[2] || 'farm_tour.json';
const opt = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const S = opt('s', '900').split(',').map(Number), HOURS = opt('hours', '17.3').split(',').map(Number);
const DIST = Number(opt('dist', 26)), UP = Number(opt('up', 7));
const steps = [{ wait: 2500 }, { js: "document.getElementById('startb').click()" }, { wait: 2500 }, { js: 'window.__DEBUG__.rainNow(0)' },
  { js: `(() => { const D = window.__DEBUG__;
    window.__FARM__ = (s, kind, h, dist, up) => {
      D.G.dawnT = D.G.dawnT || 0.01; D.G.hour = h; D.G.hourShown = h; D.G.lastApplied = -9;
      const p = D.teleport(s, 0), F = D.world.ground.farm;
      let best = null, bd = Infinity;
      for (const I of F.plots.values()) if (I.kind === kind) { const d = Math.hypot(I.cx - p.x, I.cz - p.z); if (d < bd) { bd = d; best = I; } }
      if (!best) { window.__CAM__ = null; return 'none'; }
      // the camera on the side of the plot toward the road, looking at its middle
      const dx = p.x - best.cx, dz = p.z - best.cz, dl = Math.hypot(dx, dz) || 1;
      const cx = best.cx + dx / dl * dist, cz = best.cz + dz / dl * dist, gy = D.world.ground.height(cx, cz);
      window.__CAM__ = { pos: [cx, Math.max(gy, best.level) + up, cz], look: [best.cx, best.level, best.cz], fov: 55 };
      return Math.round(bd) + ' m from the road point';
    }; })()` }];
const KIND = { paddy: 1, veg: 2, house: 3, tea: 4 };
const hh = (h) => `${String(Math.floor(h)).padStart(2, '0')}${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
for (const h of HOURS) for (const s of S) for (const [name, k] of Object.entries(KIND)) {
  steps.push({ js: `window.__FARM__(${s}, ${k}, ${h}, ${DIST}, ${UP})` }, { wait: 2000 }, { shot: `farm_${hh(h)}_s${s}_${name}` });
}
steps.push({ js: 'window.__CAM__ = null' });
fs.writeFileSync(out, JSON.stringify(steps, null, 1));
console.log('wrote', out, steps.filter((x) => x.shot).length, 'shots');
