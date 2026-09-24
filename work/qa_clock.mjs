// QA: the clock through a whole day on one map: midnight, sunrise, day, dusk; what relights; and the SUNRISE/SUNSET
// callouts when the clock crosses by distance and when a banked drift carries it across.
import fs from 'fs';
import path from 'path';
import { open, sleep, AP_SRC } from './qa_lib.mjs';

const MAP = (process.argv.find((a) => a.startsWith('--map=')) || '--map=mountain').slice(6);
const Q = await open({ out: 'work/qa_out/clock_' + MAP });
const { ev, note, shot, tap, waitBuilt } = Q;
if (MAP === 'city') { await tap('.map[data-m=city]'); await sleep(300); await waitBuilt(); await sleep(1500); }
await tap('#startb'); await sleep(1500);
await ev(`(() => { const D = window.__DEBUG__; window.__SUN__ = []; const oe = D.hud.onEvent.bind(D.hud); D.hud.onEvent = (e) => { if (e.type === 'sun') window.__SUN__.push([+D.G.hour.toFixed(2), e.value]); return oe(e); }; })()`);
await ev(`window.__QA_PLAN__ = 'none'; window.__QA_EVERY__ = 1e9;`);
await ev(AP_SRC);
await ev('window.__DEBUG__.rainNow(0)');
const state = `(() => { const D = window.__DEBUG__, G = D.G, sc = D.scene; let lampI = 0, stars = -1, heads = [];
  sc.traverse((o) => { if (o.isPointLight && o.color.getHex() !== 0xff3020) lampI += o.intensity; if (o.isPoints && o.material.size === 2.2) stars = +o.material.opacity.toFixed(2); if (o.isSpotLight && o.parent && o.parent.name === 'bodyPivot') heads.push(+o.intensity.toFixed(2)); });
  const w = D.world; return { hour: +G.hour.toFixed(2), shown: +G.hourShown.toFixed(2), clock: D.hud.clock.str, night: +G.night.toFixed(2), el: +D.rig.elevation.toFixed(1),
    lampLights: Math.round(lampI), heads, stars, glow: w.glowMat ? +w.glowMat.opacity.toFixed(2) : null, bldgNight: w.bldgMat && w.bldgMat.userData.uNight ? +w.bldgMat.userData.uNight.value.toFixed(2) : null,
    tex: D.renderer.info.memory.textures }; })()`;
const hours = [19.5, 21, 23.95, 0.3, 3, 5.0, 5.7, 6.2, 7, 9, 12, 15, 16.6, 17.5, 18.02, 19];
for (const h of hours) {
  await ev(`window.__DEBUG__.G.hour = ${h}`);
  await sleep(5000);
  const s = await ev(state);
  note('hour', h, JSON.stringify(s));
  await shot(`h${String(h).replace('.', '_')}`);
}
note('sun callouts while setting hours (by distance):', JSON.stringify(await ev('window.__SUN__.splice(0)')));
// crossings by distance alone
for (const [h, want] of [[23.97, 'wrap'], [5.93, 'SUNRISE'], [18.03, 'SUNSET']]) {
  await ev(`window.__DEBUG__.G.hour = ${h}`); await sleep(6000);
  note('crossing', want, 'hour now', await ev('window.__DEBUG__.G.hour.toFixed(2)'), 'callouts', JSON.stringify(await ev('window.__SUN__.splice(0)')));
}
// a banked drift carrying the clock across sunrise: 2,400 points is +0.4 h
await ev('window.__AUTOPILOT__ = null');
await ev(`(() => { const D = window.__DEBUG__, s = D.scoring; D.G.hour = 5.8; s.active = true; s.points = 2400; s.time = 3; s.bank(); })()`);
await sleep(1500);
note('bank across sunrise: hour', await ev('window.__DEBUG__.G.hour.toFixed(2)'), 'callouts', JSON.stringify(await ev('window.__SUN__.splice(0)')));
await ev(`(() => { const D = window.__DEBUG__, s = D.scoring; D.G.hour = 17.9; s.active = true; s.points = 2400; s.time = 3; s.bank(); })()`);
await sleep(1500);
note('bank across sunset: hour', await ev('window.__DEBUG__.G.hour.toFixed(2)'), 'callouts', JSON.stringify(await ev('window.__SUN__.splice(0)')));
note('errors', Q.errors.length, JSON.stringify(Q.errors.slice(0, 10)));
fs.writeFileSync(path.join(Q.OUT, 'clock.txt'), Q.log.join('\n'));
await Q.close();
