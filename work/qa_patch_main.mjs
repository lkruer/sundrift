// Builds a patched copy of the game folder with the main.js changes this QA pass proposes (main.js itself is being
// reworked by others and is not edited here), so each proposal can be measured before it is adopted:
//   A  scrape free: the nose's contact with the wall is remembered for 0.4 s, so the pivot that turns the nose away
//      from the wall (and so breaks the contact) is not started over every time it begins to work
//   B  a hard line met from behind: a car whose centre is already beyond a side's rail (it got there over open ground,
//      or the rail begins beside it) is held out by that rail instead of being moved through it onto the road
//   node work/qa_patch_main.mjs <out dir> [A,B]
import fs from 'fs';
import path from 'path';

const out = path.resolve(process.argv[2]);
const which = (process.argv[3] || 'A,B').split(',');
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.resolve('game'), path.join(out, 'game'), { recursive: true });
const file = path.join(out, 'game/src/main.js');
let s = fs.readFileSync(file, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';
const swap = (from, to, tag) => {
  from = from.replace(/\r?\n/g, nl); to = to.replace(/\r?\n/g, nl);
  if (!s.includes(from)) throw new Error(`patch ${tag}: the text to replace was not found`);
  s = s.replace(from, to);
  console.log(`patch ${tag} applied`);
};
if (which.includes('A')) swap(
  `  G.pinned = noseIn && car.speed < 3 && inp.throttle > 0.5 ? (G.pinned || 0) + dt : 0;`,
  `  // (the pivot below turns the nose away from the wall, which breaks the very contact it waits for: the contact is
  // remembered for 0.4 s, or the pivot started over every time it began to work and a nosed-in car sat there)
  G.noseT = noseIn ? 0.4 : Math.max(0, (G.noseT || 0) - dt);
  G.pinned = G.noseT > 0 && car.speed < 3 && inp.throttle > 0.5 ? (G.pinned || 0) + dt : 0;`, 'A');
if (which.includes('B')) swap(
  `      const hL = hardLine(q, 1), hR = hardLine(q, -1);
      if (q.u > hL) { impact = Math.max(impact, car.hitWall(-lx, -lz, q.u - hL, l, f)); if (f > 0) noseIn = true; }
      else if (q.u < -hR) { impact = Math.max(impact, car.hitWall(lx, lz, -hR - q.u, l, f)); if (f > 0) noseIn = true; }`,
  `      const hL = hardLine(q, 1), hR = hardLine(q, -1);
      // (the car's centre measured on this corner's own stretch of road: a centre already beyond a side's hard line got
      // there over open ground, or the rail begins beside it, and that rail holds it out rather than moving it through)
      const sa = track.pts[q.j], sb = track.pts[q.j + 1], sex = sb.x - sa.x, sez = sb.z - sa.z, sL = Math.hypot(sex, sez) || 1;
      const uc = ((car.x - sa.x) * sez - (car.z - sa.z) * sex) / sL, behindL = uc > hL, behindR = uc < -hR;
      if (behindL && q.u < hL) { impact = Math.max(impact, car.hitWall(lx, lz, hL - q.u, l, f)); if (f > 0) noseIn = true; }
      else if (behindR && q.u > -hR) { impact = Math.max(impact, car.hitWall(-lx, -lz, q.u + hR, l, f)); if (f > 0) noseIn = true; }
      else if (!behindL && q.u > hL) { impact = Math.max(impact, car.hitWall(-lx, -lz, q.u - hL, l, f)); if (f > 0) noseIn = true; }
      else if (!behindR && q.u < -hR) { impact = Math.max(impact, car.hitWall(lx, lz, -hR - q.u, l, f)); if (f > 0) noseIn = true; }`, 'B');
fs.writeFileSync(file, s);
console.log('patched copy at', path.join(out, 'game'));
