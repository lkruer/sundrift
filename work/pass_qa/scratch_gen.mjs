// A budget tour (teleport, shot, draws and triangles at each s): node work/pass_qa/scratch_gen.mjs <out.json> <hour> <rain> s1 s2 ...
import fs from 'fs';
const [out, hour, rain, ...ss] = process.argv.slice(2);
const steps = [
  { click: '#startb' }, { wait: 1200 },
  { js: `(() => { const D = window.__DEBUG__; D.rainNow(${rain}); D.G.hour = ${hour}; D.G.hourShown = ${hour}; D.G.lastApplied = -9; window.__AUTOPILOT__ = () => ({ throttle: 0, brake: 1, steer: 0, hand: 0, reverse: false, touch: false }); })()` },
];
for (const s of ss) {
  steps.push({ js: `window.__DEBUG__.teleport(${s}, 0); 1` }, { wait: 2600 }, { shot: `h${hour}_r${rain}_s${s}` },
    { js: `(() => { const g = window.__GAME__; return 's${s} draws ' + g.draws + ' tris ' + Math.round(g.tris / 1000) + 'k'; })()` });
}
fs.writeFileSync(out, JSON.stringify(steps, null, 1));
