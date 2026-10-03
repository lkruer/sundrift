// Every car sim run against two car.js files (before and after a change), and their outputs compared line by line.
// The sims that take a car.js path get it; the ones that import ../game/src/car.js are copied beside the other tree.
//   node work/qa_ab_sims.mjs <before game dir> [after game dir = game] [-v]
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const before = path.resolve(process.argv[2]);
const after = path.resolve(process.argv[3] && !process.argv[3].startsWith('-') ? process.argv[3] : 'game');
const V = process.argv.includes('-v');
const WITH_PATH = ['feel_test', 'steer_test', 'stop_hunt', 'reverse_release_test', 'unstick_test', 'qa_fps_test', 'qa_collide_test', 'qa_touch_parity'];
const FIXED = ['power_test', 'jturn_test', 'reverse_test', 'wall_test'];
const run = (file, args) => { try { return execFileSync(process.execPath, [file, ...args], { encoding: 'utf8', maxBuffer: 64 << 20 }); } catch (e) { return 'ERROR ' + e.message; } };
// the fixed-import sims, copied into a work/ folder beside each tree so ../game/src/car.js is that tree's
const beside = (tree, name) => {
  const dir = path.join(path.dirname(tree), 'work');
  fs.mkdirSync(dir, { recursive: true });
  const dst = path.join(dir, name + '.mjs');
  fs.copyFileSync(path.resolve('work', name + '.mjs'), dst);
  return dst;
};
let same = 0, diff = 0;
for (const name of [...WITH_PATH, ...FIXED]) {
  const extra = name === 'stop_hunt' ? ['-v'] : [];
  const a = WITH_PATH.includes(name) ? run(path.resolve('work', name + '.mjs'), [path.join(before, 'src/car.js'), ...extra]) : run(beside(before, name), extra);
  const b = WITH_PATH.includes(name) ? run(path.resolve('work', name + '.mjs'), [path.join(after, 'src/car.js'), ...extra]) : run(path.resolve(after, '..', 'work', name + '.mjs'), extra);
  if (a === b) { same++; console.log(`${name.padEnd(22)} identical`); continue; }
  diff++;
  const la = a.split('\n'), lb = b.split('\n');
  const changed = [];
  for (let i = 0; i < Math.max(la.length, lb.length); i++) if (la[i] !== lb[i]) changed.push([la[i] || '', lb[i] || '']);
  console.log(`${name.padEnd(22)} ${changed.length} line(s) differ`);
  for (const [x, y] of changed.slice(0, V ? 99 : 6)) console.log(`   before: ${x}\n   after:  ${y}`);
}
console.log(`\n${same} identical, ${diff} differ`);
