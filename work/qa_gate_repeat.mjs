// The drift gate run N times on one build, one after another, and its counts summed up: the gate's bot is noisy (its
// banked drifts swing from run to run), so a build is judged on the spread, not on one run.
//   node work/qa_gate_repeat.mjs <game dir> <N> [gate flags...]      e.g. node work/qa_gate_repeat.mjs game 3 --phone
import { execFileSync } from 'child_process';
import path from 'path';

const dir = path.resolve(process.argv[2] || 'game'), N = Number(process.argv[3] || 3), flags = process.argv.slice(4);
const rows = [];
for (let i = 0; i < N; i++) {
  let out = '';
  try { out = execFileSync(process.execPath, [path.resolve('gate/drift-gate.mjs'), dir, '--recipe=C:/Users/liamk/404-game-recipe', ...flags], { encoding: 'utf8', maxBuffer: 64 << 20 }); }
  catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); }
  const num = (re) => { const m = out.match(re); return m ? Number(m[1]) : null; };
  const r = { banks: num(/drifts banked\s+(\d+)/), score: num(/score\s+(\d+)/), slip: num(/peak slip\s+(\d+)/), slow: num(/slow frames\s+(\d+)/), worst: num(/worst (\d+) ms/), pass: /it drifts/.test(out) };
  rows.push(r);
  console.log(`run ${i + 1}: banked ${r.banks}, score ${r.score}, peak slip ${r.slip}, slow frames ${r.slow} (worst ${r.worst} ms), ${r.pass ? 'PASS' : 'FAIL'}`);
}
const banks = rows.map((r) => r.banks).filter((x) => x !== null);
console.log(`${path.basename(path.dirname(dir))}/${path.basename(dir)} ${flags.join(' ')}: banked ${banks.join(', ')} (mean ${(banks.reduce((a, b) => a + b, 0) / Math.max(1, banks.length)).toFixed(1)}), passed ${rows.filter((r) => r.pass).length} of ${rows.length}`);
