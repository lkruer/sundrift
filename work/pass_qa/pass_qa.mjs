// Pass QA shot scripts from a compact list: node work/pass_qa/pass_qa.mjs <out.json> <spec.json>, then
//   node work/shot.mjs <out.json> --out=work/shots/pass_qa/<dir>
// spec: { setup: {hour, rain}, shots: [ { name, s, kmh?, hour?, rain?, cam?: [s, u, dy, ls, lu, ldy, fov], wait?, keys?: [...], ms? } ] }
// cam: place a free camera at road sample s, lateral u (left +), dy above the road, looking at sample ls, lu, ldy.
import fs from 'fs';
const [out, specPath] = process.argv.slice(2);
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const H = `window.__Q__ = { at(s, u, dy) { const t = __DEBUG__.track, p = t.sample(s); return [p.x + Math.cos(p.h) * u, p.y + dy, p.z - Math.sin(p.h) * u]; },
  cam(s, u, dy, ls, lu, ldy, fov) { window.__CAM__ = { pos: this.at(s, u, dy), look: this.at(ls, lu, ldy), fov: fov || 60 }; },
  hour(h) { const G = __DEBUG__.G; G.hour = h; G.hourShown = h; G.lastApplied = -9; },
  // a free camera looking at the k-th instance (nearest the car first) of a pool, from dist metres, dy up, turned by ang
  prop(name, k, dist, dy, ang, fov) { const D = __DEBUG__, P = D.world.pools[name], c = D.car; if (!P || !P.n) return 'none'; const L = []; for (let i = 0; i < P.n; i++) { const b = P.base; L.push([Math.hypot(b[i * 16 + 12] - c.x, b[i * 16 + 14] - c.z), b[i * 16 + 12], b[i * 16 + 13], b[i * 16 + 14]]); } L.sort((a, b) => a[0] - b[0]); const q = L[Math.min(k, L.length - 1)]; const t = D.track, n = t.nearest(q[1], q[3], D.G.idx); const r = t.sample(n.s); const a = r.h + (ang || 0); window.__CAM__ = { pos: [q[1] - Math.sin(a) * dist + Math.cos(r.h) * 0, q[2] + dy, q[3] - Math.cos(a) * dist], look: [q[1], q[2] + (dy > 3 ? 0 : 0.8), q[3]], fov: fov || 50 }; return name + ' at ' + q.slice(1).map(Math.round).join(',') + ' s' + Math.round(n.s) + ' u' + n.u.toFixed(1); },
  // a free camera in front of the first pool instance whose tint's red channel is in [r0, r1) (the warn sign's kind)
  kind(name, r0, r1, dist, dy) { const D = __DEBUG__, P = D.world.pools[name]; if (!P) return 'none'; for (let i = 0; i < P.n; i++) { const r = P.col[i * 3]; if (r < r0 || r >= r1) continue; const b = P.base, x = b[i * 16 + 12], y = b[i * 16 + 13], z = b[i * 16 + 14]; const fx = b[i * 16 + 8], fz = b[i * 16 + 10]; const l = Math.hypot(fx, fz) || 1; window.__CAM__ = { pos: [x + fx / l * dist, y + dy, z + fz / l * dist], look: [x, y + 2.2, z], fov: 40 }; return name + ' kind ' + r.toFixed(3) + ' at ' + [x, y, z].map(Math.round).join(','); } return 'no kind'; },
  // a free camera in front of the first chevron mirrored (sx < 0) or not
  chev(mirrored, dist, dy) { const D = __DEBUG__, P = D.world.pools[mirrored === 'M' ? 'chevronM' : 'chevron']; mirrored = mirrored === true; if (!P) return 'none'; for (let i = 0; i < P.n; i++) { const b = P.base; const det = b[i * 16] * b[i * 16 + 10] - b[i * 16 + 2] * b[i * 16 + 8]; if ((det < 0) !== mirrored) continue; const x = b[i * 16 + 12], y = b[i * 16 + 13], z = b[i * 16 + 14]; const fx = b[i * 16 + 8], fz = b[i * 16 + 10]; const l = Math.hypot(fx, fz) || 1; window.__CAM__ = { pos: [x + fx / l * dist, y + dy, z + fz / l * dist], look: [x, y + 1.2, z], fov: 40 }; return 'chevron det ' + det.toFixed(2); } return 'none found'; },
  stat(n) { const g = window.__GAME__; return n + ' draws ' + g.draws + ' tris ' + Math.round(g.tris / 1000) + 'k'; } }; 1`;
const st = spec.setup || {};
const steps = [...(st.hard ? [{ click: '.diff[data-d="hard"]' }, { wait: 2500 }] : []), { click: '#startb' }, { wait: 1200 }, { js: H },
  { js: `(() => { const D = __DEBUG__; D.rainNow(${st.rain ?? 0}); __Q__.hour(${st.hour ?? 22}); window.__AUTOPILOT__ = ${st.drive ? 'null' : `() => ({ throttle: 0, brake: 1, steer: 0, hand: 0, reverse: false, touch: false })`}; })()` }];
let lastHour = st.hour ?? 22, lastRain = st.rain ?? 0;
for (const sh of spec.shots) {
  const js = [];
  if (sh.hour !== undefined && sh.hour !== lastHour) { js.push(`__Q__.hour(${sh.hour})`); lastHour = sh.hour; }
  if (sh.rain !== undefined && sh.rain !== lastRain) { js.push(`__DEBUG__.rainNow(${sh.rain})`); lastRain = sh.rain; }
  if (sh.s !== undefined) js.push(`__DEBUG__.teleport(${sh.s}, ${sh.kmh || 0})`);
  js.push(sh.cam ? `__Q__.cam(${sh.cam.join(',')})` : 'window.__CAM__ = null');
  steps.push({ js: js.join('; ') + '; 1' });
  if (sh.js) steps.push({ js: sh.js });
  steps.push({ wait: sh.wait || 2600 });
  if (sh.keys) steps.push({ keys: sh.keys, ms: sh.ms || 1000 });
  steps.push({ shot: sh.name }, { js: `__Q__.stat('${sh.name}')` });
}
fs.writeFileSync(out, JSON.stringify(steps, null, 1));
