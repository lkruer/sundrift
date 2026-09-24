import { Track } from '../game/src/track.js';
const [map, dk, smax] = process.argv.slice(2);
const t = new Track(20260921, dk, map); t.ensure(Number(smax) + 500);
console.log('markers', JSON.stringify(t.markers.filter(m => m.s < Number(smax)).map(m => [m.kind, Math.round(m.s), m.side, m.s1 ? Math.round(m.s1) : ''])));
console.log('tunnels', JSON.stringify(t.tunnels.filter(m => m.s0 < Number(smax)).map(m => [Math.round(m.s0), Math.round(m.s1)])));
console.log('pads', JSON.stringify(t.pads.filter(m => m.s0 < Number(smax)).map(m => [m.kind, Math.round(m.s0), Math.round(m.s1), m.side])));
const ex = []; let on = false; for (const p of t.pts) { if (p.s > Number(smax)) break; if (!!p.express !== on) { on = !!p.express; ex.push([on ? 'express on' : 'off', Math.round(p.s)]); } }
console.log('express', JSON.stringify(ex));
