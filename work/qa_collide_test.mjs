// Collisions as the game does them (main.js step(): the car moves a whole frame, then its four corners are tested
// against the walls and three circles along its axis against the props): at 20, 30, 60 and 144 frames a second.
//   1. a solid prop (a tree trunk, r 0.3 to 0.85) straight ahead at 15 to 75 m/s: is the hit seen, or does the car
//      pass through it (tunnelling: the frame steps it past, and the contact found is behind the trunk)?
//   2. a guardrail met at 5 to 60 degrees: what is left of the speed, which way the car points after, the impact the
//      scoring sees (over 8 m/s drops the drift), and does it ever end up through the rail or stuck on it?
//   node work/qa_collide_test.mjs [path/to/car.js]
const arg = process.argv.find((a) => a.endsWith('.js') && !a.endsWith('qa_collide_test.mjs'));
const src = arg ? new URL('file:///' + arg.replace(/\\/g, '/')) : new URL('../game/src/car.js', import.meta.url);
const { Car } = await import(src.href);
const deg = (r) => (r * 180) / Math.PI;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const K = 0.62;   // CAR_SCALE
const CORNERS = [[0.97 * K, 2.08 * K], [-0.97 * K, 2.08 * K], [0.97 * K, -2.12 * K], [-0.97 * K, -2.12 * K]];
const HIT_F = [-1.16 * K, 0, 1.16 * K], HIT_R = 1.0 * K;
const FPS = [20, 30, 60, 144];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** main.js collideProps for one solid record { x, z, r }: returns the impact, or 0 */
function props(car, recs) {
  let worst = 0;
  const s = Math.sin(car.yaw), c = Math.cos(car.yaw);
  for (const rec of recs) {
    for (const f of HIT_F) {
      const px = car.x + s * f, pz = car.z + c * f;
      const dx = px - rec.x, dz = pz - rec.z, dist = Math.hypot(dx, dz) || 1e-4;
      const nx = dx / dist, nz = dz / dist, d = HIT_R + rec.r - dist;
      if (d <= 0) continue;
      const cxw = px - nx * HIT_R, czw = pz - nz * HIT_R, rx = cxw - car.x, rz = czw - car.z;
      const lC = rx * c - rz * s, fC = rx * s + rz * c;
      worst = Math.max(worst, car.hitWall(nx, nz, Math.min(d, 0.6), lC, fC));
      break;
    }
  }
  return worst;
}

// ---------------------------------------------------------------- 1. a trunk straight ahead
console.log('-- 1. a solid trunk dead ahead (or 0.5 m off the car\'s line), the car at speed, gas held');
console.log('   v m/s  r     off  ' + FPS.map((f) => `${f} fps`.padEnd(22)).join(''));
let tunnels = 0, cases = 0;
for (const r of [0.28, 0.42, 0.85]) for (const off of [0, 0.5, 0.9]) for (const v of [15, 30, 45, 60, 75]) {
  const cells = [];
  for (const fps of FPS) {
    const car = new Car(); car.reset(off, -30, 0); car.vF = v;
    const dt = 1 / fps; let hit = 0, through = false, firstImpact = 0;
    const rec = { x: 0, z: 0, r };
    for (let i = 0; i < fps * 2; i++) {
      car.step(dt, { throttle: 1, brake: 0, steer: 0, hand: 0, reverse: false, touch: false, line: { curv: 0, here: 0 } }, 1);
      const imp = props(car, [rec]);
      if (imp > 0 && !firstImpact) firstImpact = imp;
      hit = Math.max(hit, imp);
      // through: the car's centre is past the trunk and it is still going on
      if (car.z > rec.r + 1.5 && Math.abs(car.x) < 2) { through = true; break; }
    }
    cases++;
    if (through) tunnels++;
    cells.push((through ? `THROUGH (hit ${hit.toFixed(1)})` : `stopped, hit ${hit.toFixed(1)}`).padEnd(22));
  }
  console.log(`   ${String(v).padStart(4)}  ${r.toFixed(2)}  ${off.toFixed(1)}  ${cells.join('')}`);
}
console.log(`   ${tunnels} of ${cases} runs went through the trunk`);

// ---------------------------------------------------------------- 2. a guardrail at an angle
console.log('\n-- 2. a rail met at an angle (gas held, the wheel straight): speed kept, heading after, impact, contact frames');
const WALL = 6;   // a rail at x = +6, the road along +z (left is +x)
function railRun(fps, v, angDeg, keys = () => ({ throttle: 1, steer: 0 })) {
  const car = new Car(); const a = angDeg * Math.PI / 180;
  car.reset(WALL - 4, 0, a); car.vF = v;
  const dt = 1 / fps; let impMax = 0, contact = 0, maxIn = 0, t = 0, through = false, vMin = v;
  for (let i = 0; i < fps * 3; i++) {
    const k = keys(t, car);
    car.step(dt, { throttle: k.throttle ?? 0, brake: 0, steer: k.steer ?? 0, hand: k.hand ?? 0, reverse: false, touch: false, line: { curv: 0, here: 0 } }, 1);
    let touched = false;
    for (const [l, f] of CORNERS) {
      const [cx] = car.point(l, f);
      if (cx > WALL) { maxIn = Math.max(maxIn, cx - WALL); impMax = Math.max(impMax, car.hitWall(-1, 0, cx - WALL, l, f)); touched = true; }
    }
    if (touched) contact++;
    if (car.x > WALL) through = true;
    vMin = Math.min(vMin, car.speed);
    t += dt;
  }
  return { v: car.speed, head: deg(wrap(car.yaw)), impMax, contact: contact / fps, maxIn, through, vMin, x: car.x };
}
console.log('   v m/s ang  ' + FPS.map((f) => `${f} fps`.padEnd(36)).join(''));
for (const v of [15, 30, 45]) for (const ang of [5, 15, 30, 60]) {
  const cells = FPS.map((fps) => { const r = railRun(fps, v, ang); return `${r.through ? 'THROUGH ' : ''}v ${r.v.toFixed(1)} hd ${r.head.toFixed(0)} imp ${r.impMax.toFixed(1)} in ${r.maxIn.toFixed(2)}`.padEnd(36); });
  console.log(`   ${String(v).padStart(4)}  ${String(ang).padStart(3)}  ${cells.join('')}`);
}
// a slide into the rail: a flick toward the wall at 80 km/h, the key held into the turn (the tail swings into the rail)
console.log('\n-- 3. a drift that swings its tail into the rail (flick right at 80 km/h with the rail on the left), held 3 s');
for (const fps of FPS) {
  const r = railRun(fps, 22, 8, (t) => ({ throttle: t < 0.3 ? 0.3 : 1, steer: t < 3 ? -Math.min(1, t / 0.14) : 0, hand: t < 0.3 ? 1 : 0 }));
  console.log(`   ${String(fps).padStart(3)} fps: v ${r.v.toFixed(1)} (min ${r.vMin.toFixed(1)}), heading ${r.head.toFixed(0)}, impact ${r.impMax.toFixed(1)}, ${r.contact.toFixed(2)} s on the rail, deepest ${r.maxIn.toFixed(2)} m${r.through ? ', THROUGH' : ''}`);
}
