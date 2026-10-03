// QA: the clock through a whole day on one map: midnight, dawn, day, the golden hour; what relights; and the night's
// phases said as the clock enters them (config.js PHASES), by distance and when a banked drift carries it across. The
// run completes the first time the clock reaches dawn: its results come up, and KEEP DRIVING carries it on.
import fs from 'fs';
import path from 'path';
import { open, sleep, AP_SRC } from './qa_lib.mjs';

const MAP = (process.argv.find((a) => a.startsWith('--map=')) || '--map=mountain').slice(6);
const Q = await open({ out: 'work/qa_out/clock_' + MAP });
const { ev, note, shot, tap, waitBuilt } = Q;
if (MAP === 'city') { await tap('.map[data-m=city]'); await sleep(300); await waitBuilt(); await sleep(1500); }
await tap('#startb'); await sleep(1500);
await ev(`(() => { const D = window.__DEBUG__; window.__SUN__ = []; const oe = D.hud.onEvent.bind(D.hud); D.hud.onEvent = (e) => { if (e.type === 'sun' || e.type === 'phase') window.__SUN__.push([+D.G.hour.toFixed(2), e.type === 'phase' ? e.value + (e.dawn ? ' (dawn: the run is complete)' : '') : e.value]); return oe(e); }; })()`);
await ev(`window.__QA_PLAN__ = 'none'; window.__QA_EVERY__ = 1e9;`);
await ev(AP_SRC);
await ev('window.__DEBUG__.rainNow(0)');
const state = `(() => { const D = window.__DEBUG__, G = D.G, sc = D.scene; let lampI = 0, stars = -1, heads = [];
  sc.traverse((o) => { if (o.isPointLight && o.color.getHex() !== 0xff3020) lampI += o.intensity; if (o.isPoints && o.material.size === 2.2) stars = +o.material.opacity.toFixed(2); if (o.isSpotLight && o.parent && o.parent.name === 'bodyPivot') heads.push(+o.intensity.toFixed(2)); });
  const w = D.world, v = D.hud.v; return { mode: G.mode, phase: G.phase, hour: +G.hour.toFixed(2), shown: +G.hourShown.toFixed(2), clock: String(v.hh).padStart(2, '0') + ':' + String(v.mm).padStart(2, '0'), night: +G.night.toFixed(2), el: +D.rig.elevation.toFixed(1),
    lampLights: Math.round(lampI), heads, stars, glow: w.glowMat ? +w.glowMat.opacity.toFixed(2) : null, bldgNight: w.bldgMat && w.bldgMat.userData.uNight ? +w.bldgMat.userData.uNight.value.toFixed(2) : null,
    tex: D.renderer.info.memory.textures }; })()`;
// (the results at the first dawn: noted, and the run carried on)
const carryOn = async () => { if ((await ev('window.__DEBUG__.G.mode')) === 'results') { note('  the run reached dawn: results up; KEEP DRIVING'); await shot('results_at_dawn'); await tap('#r-keep'); await sleep(800); } };
const hours = [19.5, 21, 23.95, 0.3, 3, 5.0, 5.7, 6.2, 7, 9, 12, 15, 16.6, 17.5, 18.02, 19];
for (const h of hours) {
  await ev(`window.__DEBUG__.clockTo(${h})`);
  await sleep(5000);
  await carryOn();
  const s = await ev(state);
  note('hour', h, JSON.stringify(s));
  await shot(`h${String(h).replace('.', '_')}`);
}
note('phases said while setting hours:', JSON.stringify(await ev('window.__SUN__.splice(0)')));
// crossings by the clock's own pace and the road
for (const [h, want] of [[23.97, 'midnight (no phase)'], [4.74, 'DAWN'], [5.99, 'DAY'], [16.99, 'GOLDEN HOUR'], [18.24, 'BLUE HOUR'], [19.24, 'NIGHT']]) {
  await ev(`window.__DEBUG__.clockTo(${h})`); await sleep(6000);
  await carryOn();
  note('crossing', want, 'hour now', await ev('window.__DEBUG__.G.hour.toFixed(2)'), 'said', JSON.stringify(await ev('window.__SUN__.splice(0)')));
}
// a banked drift carrying the clock across: 3,000 points is 11 minutes on the easy pass
await ev('window.__AUTOPILOT__ = null');
for (const [h, want] of [[4.6, 'DAWN'], [18.2, 'BLUE HOUR']]) {
  await ev(`(() => { const D = window.__DEBUG__, s = D.scoring; D.clockTo(${h}); s.active = true; s.points = 3000; s.time = 3; s.bank(); })()`);
  await sleep(1500);
  note('a bank across', want, ': hour', await ev('window.__DEBUG__.G.hour.toFixed(2)'), 'said', JSON.stringify(await ev('window.__SUN__.splice(0)')));
}
note('errors', Q.errors.length, JSON.stringify(Q.errors.slice(0, 10)));
fs.writeFileSync(path.join(Q.OUT, 'clock.txt'), Q.log.join('\n'));
await Q.close();
