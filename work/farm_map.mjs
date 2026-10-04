// The land round a stretch of the pass seen from above: the road, the farmland by kind (farm.js), the woods' density,
// and the ground's slope, one pixel every few metres. Writes a PPM (work/farm_map.py turns it into a PNG).
//   node work/farm_map.mjs <easy|medium|hard> <s0> <s1> <out.ppm> [--px=3] [--pad=500]
import fs from 'fs';
import { Track } from '../game/src/track.js';
import { Ground } from '../game/src/ground.js';
import { KIND } from '../game/src/farm.js';

const [dk = 'easy', s0 = '0', s1 = '3000', out = 'farm_map.ppm'] = process.argv.slice(2);
const opt = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? Number(a.split('=')[1]) : d; };
const PX = opt('px', 3), PAD = opt('pad', 500);
const t = new Track(20260921, dk); t.ensure(Number(s1) + 2400);
const g = new Ground(t), F = g.farm, f = t.field;
let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
for (const p of t.pts) if (p.s >= Number(s0) && p.s <= Number(s1)) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
x0 -= PAD; z0 -= PAD; x1 += PAD; z1 += PAD;
// --at=fx,fz: a window of --win metres centred at that fraction of the whole map (0..1 each way)
{
  const at = process.argv.find((a) => a.startsWith('--at='));
  if (at) {
    const [fx, fz] = at.slice(5).split(',').map(Number), win = opt('win', 300);
    const cx = x0 + (x1 - x0) * fx, cz = z0 + (z1 - z0) * fz;
    x0 = cx - win / 2; x1 = cx + win / 2; z0 = cz - win / 2; z1 = cz + win / 2;
  }
}
const W = Math.ceil((x1 - x0) / PX), H = Math.ceil((z1 - z0) / PX);
const img = Buffer.alloc(W * H * 3);
const counts = {}, s = {};
const t0 = performance.now();
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const x = x0 + (i + 0.5) * PX, z = z0 + (j + 0.5) * PX;
  g.sample(x, z, 2.2, s);
  const k = F.kindAt(x, z);
  const [gx, gz] = f.grad(x, z, 3), sl = Math.hypot(gx, gz);
  let c;
  if (s.edge < 0) c = [40, 40, 46];
  else if (s.flat) c = [150, 140, 120];
  else if (k === KIND.PADDY) c = [90, 150, 200];
  else if (k === KIND.VEG) c = [150, 105, 60];
  else if (k === KIND.HOUSE) c = [210, 60, 50];
  else if (k === KIND.TEA) c = [20, 140, 120];
  else {
    const w = F.woods(x, z, sl);
    c = [120 - 80 * w, 170 - 60 * w, 70 - 30 * w];
    if (sl > 0.8) c = [130, 120, 110];
  }
  // contour lines every 5 m
  if (Math.abs(((s.h % 5) + 5) % 5 - 2.5) > 2.35) c = c.map((v) => v * 0.8);
  counts[k] = (counts[k] || 0) + 1;
  img.set(c.map((v) => Math.max(0, Math.min(255, v | 0))), (j * W + i) * 3);
}
const ms = performance.now() - t0;
fs.writeFileSync(out, Buffer.concat([Buffer.from(`P6\n${W} ${H}\n255\n`), img]));
const tot = W * H;
console.log(`${W}x${H} px at ${PX} m, ${(ms / tot * 1000).toFixed(2)} us a pixel;`, Object.entries(counts).map(([k, n]) => `${Object.keys(KIND)[k]} ${(100 * n / tot).toFixed(1)}%`).join(', '));
