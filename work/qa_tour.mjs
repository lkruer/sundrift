// QA: a look at NEO TOKYO's set pieces (the Shuto, the train line, steam, the airship, people) in rain and dry, and a
// desktop window resized mid-run.
import fs from 'fs';
import path from 'path';
import { open, sleep, AP_SRC } from './qa_lib.mjs';

const Q = await open({ out: 'work/qa_out/tour_city' });
const { page, ev, note, shot, tap, waitBuilt } = Q;
await tap('.map[data-m=city]'); await sleep(300); await waitBuilt(); await sleep(1500);
await tap('#startb'); await sleep(1500);
await ev(`window.__QA_PLAN__ = 'none'; window.__QA_EVERY__ = 1e9;`); await ev(AP_SRC);
// the expressway: the first stretch of it
const ex = await ev(`(() => { const t = window.__DEBUG__.track; t.ensure(12000); let s0 = null; for (const p of t.pts) { if (p.express && p.elev > 8 && s0 === null) s0 = p.s; } return s0; })()`);
note('Shuto at s', ex);
if (ex) {
  await ev(`window.__DEBUG__.teleport(${ex} - 160, 60)`); await sleep(9000); await shot('shuto_ramp');
  await sleep(4000); await shot('shuto_up');
  note('on the Shuto:', await ev('({ s: Math.round(window.__DEBUG__.G.s), y: window.__DEBUG__.G.carY.toFixed(1), express: window.__DEBUG__.track.sample(window.__DEBUG__.G.s).express })'));
}
// the train line: where the rail runs, and the train on it
const rail = await ev(`(() => { const w = window.__DEBUG__.world; return w._train ? { hidden: w._train.hidden, ids: w._train.ids.length } : null; })()`);
note('train', rail);
// rain by night on the avenue, then clearing
await ev('window.__DEBUG__.rainNow(0.9)'); await sleep(6000); await shot('rain_night');
await ev('window.__DEBUG__.rainNow(0)'); await sleep(6000); await shot('dry_night');
// the airship and the skyline: a look up from the car
await ev(`(() => { const D = window.__DEBUG__, c = D.car; window.__CAM__ = { pos: [c.x - Math.sin(c.yaw) * 6, D.G.carY + 3, c.z - Math.cos(c.yaw) * 6], look: [c.x + Math.sin(c.yaw) * 200, D.G.carY + 120, c.z + Math.cos(c.yaw) * 200], fov: 70 }; })()`);
await sleep(1500); await shot('sky_airship'); await ev('window.__CAM__ = null');
// daytime in the city
await ev('window.__DEBUG__.G.hour = 12'); await sleep(6000); await shot('city_noon');
await ev('window.__DEBUG__.G.hour = 22'); await sleep(6000);
// resize the window mid-run
for (const [w, h] of [[1920, 1080], [800, 600], [1024, 1366], [1280, 720]]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 }); await sleep(2000);
  const c = await ev('({ canvas: [document.getElementById("c").width, document.getElementById("c").height], aspect: +window.__DEBUG__.chase.cam.aspect.toFixed(3), inner: [innerWidth, innerHeight] })');
  note('resize', w, h, JSON.stringify(c));
  await shot(`resize_${w}x${h}`);
}
await ev('window.__AUTOPILOT__ = null');
note('errors', Q.errors.length, JSON.stringify(Q.errors.slice(0, 6)));
fs.writeFileSync(path.join(Q.OUT, 'tour.txt'), Q.log.join('\n'));
await Q.close();
