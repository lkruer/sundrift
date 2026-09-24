// QA flows: pause/resume (Esc, button), keys while paused, restart, main menu and the title's sound after it, mute,
// switching map/course/paint between runs three times over (leaks), orbit, zoom.
import fs from 'fs';
import path from 'path';
import { open, sleep, AP_SRC } from './qa_lib.mjs';

const Q = await open({ out: 'work/qa_out/flows' });
const { page, ev, note, shot, tap, waitBuilt } = Q;
note('ready', Q.ready.toFixed(1), 's');

// ---- the title's sound level, measured on the master bus (dBFS RMS over 1 s)
const rmsJs = `(async () => { const a = window.__DEBUG__.audio; if (!a.ctx) return 'no ctx'; const c = a.ctx;
  if (!window.__AN__) { window.__AN__ = c.createAnalyser(); window.__AN__.fftSize = 2048; a.comp.connect(window.__AN__); }
  const an = window.__AN__, buf = new Float32Array(an.fftSize); let s = 0, n = 0, pk = 0;
  for (let k = 0; k < 20; k++) { await new Promise((r) => setTimeout(r, 50)); an.getFloatTimeDomainData(buf); for (const v of buf) { s += v * v; n++; pk = Math.max(pk, Math.abs(v)); } }
  const rms = Math.sqrt(s / n); return { state: c.state, rmsDb: +(20 * Math.log10(rms + 1e-9)).toFixed(1), peak: +pk.toFixed(3),
    eng: +a.engGain.gain.value.toFixed(3), wind: +a.windGain.gain.value.toFixed(3), screech: +a.screechGain.gain.value.toFixed(3), rasp: +a.raspGain.gain.value.toFixed(3), rain: +a.rainGain.gain.value.toFixed(3),
    rpm: a.engNode ? Math.round(a.engNode.parameters.get('rpm').value) : -1, muted: a.muted }; })()`;
const census = async (label) => {
  await ev('window.__QA__.gcs.push(performance.now()); window.gc(); window.gc();');
  await sleep(400);
  const r = await ev(`(() => { const D = window.__DEBUG__, r = D.renderer; let objs = 0; D.scene.traverse(() => objs++);
    return { heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1), geo: r.info.memory.geometries, tex: r.info.memory.textures, progs: r.info.programs.length,
      objs, chunks: D.world.chunks.size, tiles: D.world.terrain.tiles.size, cols: D.world.cols.size, lamps: D.world.lamps.length, dom: document.getElementsByTagName('*').length,
      debris: D.debris.list.length, aud: window.__QA__.aud.started - window.__QA__.aud.ended, audLive: window.__QA__.aud.live, mode: D.G.mode, map: D.G.map, diff: D.G.diff }; })()`);
  const dom = await Q.cdp.send('Memory.getDOMCounters');
  note('census', label, { ...r, listeners: dom.jsEventListeners, nodes: dom.nodes });
  return r;
};
const drive = async (sec, plan = null) => {
  if (plan) await ev(`window.__QA_PLAN__ = ${JSON.stringify(plan)}; window.__QA_EVERY__ = 6;`); else await ev('window.__QA_PLAN__ = "none"; window.__QA_EVERY__ = 1e9;');
  await ev(AP_SRC);
  await sleep(sec * 1000);
  await ev('window.__AUTOPILOT__ = null');
};

// before any gesture
await shot('00_title');
// wake the sound with a click on a title button (the paint swatch), then measure the title with nothing played yet
await tap('.sw:nth-child(2)'); await sleep(300); await tap('.sw:nth-child(1)');
note('title before any run:', await ev(rmsJs));
await census('title0');
await tap('#startb'); await sleep(1500);
note('mode after start', await ev('window.__DEBUG__.G.mode'));
await drive(12);
note('driving:', await ev(rmsJs));
await shot('01_driving');

// ---- pause with Escape, then a key while paused
await ev('window.__QA__.marks.push(performance.now())');
// hold W so the engine is under load at the moment of the pause (as a player would be)
await page.keyboard.down('KeyW'); await sleep(1500);
await page.keyboard.press('Escape'); await page.keyboard.up('KeyW'); await sleep(600);
note('after Esc:', await ev('({ mode: window.__DEBUG__.G.mode, pauseOn: document.getElementById("pause").classList.contains("on") })'), await ev(rmsJs));
await shot('02_paused');
await page.keyboard.press('KeyA'); await sleep(700);
note('paused + key A:', await ev('({ mode: window.__DEBUG__.G.mode })'), await ev(rmsJs));
await page.keyboard.press('KeyM'); await sleep(400); await page.keyboard.press('KeyM'); await sleep(700);
note('paused + M twice:', await ev(rmsJs));
// the pause menu: move the mouse and click on the card (not a button)
await page.mouse.click(640, 650); await sleep(500);
note('paused + click on the card:', await ev('({ mode: window.__DEBUG__.G.mode })'));
await page.keyboard.press('Escape'); await sleep(600);
note('Esc again:', await ev('({ mode: window.__DEBUG__.G.mode, pauseOn: document.getElementById("pause").classList.contains("on") })'), await ev(rmsJs));

// ---- the pause button, resume button
await tap('#pauseb'); await sleep(500);
note('pause button:', await ev('window.__DEBUG__.G.mode'));
await tap('#resumeb'); await sleep(500);
note('resume button:', await ev('window.__DEBUG__.G.mode'));
// P toggles too
await page.keyboard.press('KeyP'); await sleep(300);
note('P:', await ev('window.__DEBUG__.G.mode'));
await page.keyboard.press('KeyP'); await sleep(300);
note('P again:', await ev('window.__DEBUG__.G.mode'));

// ---- restart mid-drift
await drive(10, 'smash,offroad');
note('before restart:', await ev('({ s: Math.round(window.__DEBUG__.G.s), score: Math.round(window.__DEBUG__.scoring.total), hour: window.__DEBUG__.G.hour.toFixed(2), debris: window.__DEBUG__.debris.list.length, off: !!window.__DEBUG__.G.off, mag: window.__DEBUG__.magnet.active })'));
await tap('#pauseb'); await sleep(400); await tap('#restartb'); await sleep(1200);
note('after restart:', await ev('({ mode: window.__DEBUG__.G.mode, s: Math.round(window.__DEBUG__.G.s), score: Math.round(window.__DEBUG__.scoring.total), hour: window.__DEBUG__.G.hour.toFixed(2), shown: window.__DEBUG__.G.hourShown.toFixed(2), debris: window.__DEBUG__.debris.list.length, off: !!window.__DEBUG__.G.off, mag: window.__DEBUG__.magnet.active, kmh: Math.round(window.__DEBUG__.car.kmh), boost: window.__DEBUG__.car.boost })'));
await shot('03_after_restart');

// ---- main menu mid-slide, and what the title sounds like after it
await ev(`window.__AUTOPILOT__ = (dt) => ({ throttle: 1, brake: 0, steer: 1, hand: 1, reverse: false, touch: false })`);
await sleep(2500);
note('mid-slide:', await ev(rmsJs));
await ev('window.__AUTOPILOT__ = null');
await tap('#pauseb'); await sleep(400); await tap('#quitb'); await sleep(1500);
note('title after MAIN MENU:', await ev('({ mode: window.__DEBUG__.G.mode, title: document.getElementById("title").classList.contains("on") })'), await ev(rmsJs));
await sleep(4000);
note('title 5 s later:', await ev(rmsJs));
await shot('04_title_after_quit');
await census('title after run 1');

// ---- three rounds of switching map, course and paint between runs
const rounds = [['city', 'hard', 3], ['mountain', 'hard', 5], ['city', 'easy', 7], ['mountain', 'easy', 0]];
let k = 0;
for (const [m, d, paint] of rounds) {
  k++;
  await tap(`.map[data-m=${m}]`); await sleep(300); await waitBuilt();
  await tap(`.diff[data-d=${d}]`); await sleep(300); await waitBuilt();
  await tap(`.sw:nth-child(${paint + 1})`); await sleep(1500);
  await shot(`05_title_${k}_${m}_${d}`);
  await census(`title ${k} ${m} ${d}`);
  await tap('#startb'); await sleep(1500);
  note(`run ${k}:`, await ev('({ mode: window.__DEBUG__.G.mode, map: window.__DEBUG__.G.map, diff: window.__DEBUG__.G.diff, paint: window.__DEBUG__.G.paint, toast: document.getElementById("toasts").textContent })'));
  await drive(20, 'smash,offroad,crash');
  await shot(`06_run_${k}_${m}_${d}`);
  await census(`run ${k} ${m} ${d}`);
  await tap('#pauseb'); await sleep(400); await tap('#quitb'); await sleep(1200);
}
await census('final title');

// ---- mute
await tap('#startb'); await sleep(1200);
await drive(4);
await page.keyboard.press('KeyM'); await sleep(600);
note('M:', await ev('({ muted: window.__DEBUG__.audio.muted, btnOff: document.getElementById("mute").classList.contains("off"), master: window.__DEBUG__.audio.master.gain.value.toFixed(3) })'), await ev(rmsJs));
await tap('#mute'); await sleep(600);
note('mute button:', await ev('({ muted: window.__DEBUG__.audio.muted, btnOff: document.getElementById("mute").classList.contains("off"), master: window.__DEBUG__.audio.master.gain.value.toFixed(3) })'));

// ---- orbit and zoom
await ev('window.__QA_PLAN__ = "none"; window.__QA_EVERY__ = 1e9;'); await ev(AP_SRC);
await page.mouse.move(640, 360); await page.mouse.down({ button: 'left' });
for (let i = 0; i < 20; i++) { await page.mouse.move(640 + i * 25, 360 - i * 6); await sleep(30); }
await sleep(300);
note('orbit held:', await ev('({ oYaw: window.__DEBUG__.chase.oYaw.toFixed(2), oPitch: window.__DEBUG__.chase.oPitch.toFixed(2), orbiting: document.body.classList.contains("orbiting") })'));
await shot('07_orbit');
await page.mouse.up({ button: 'left' }); await sleep(1500);
note('orbit released 1.5 s:', await ev('({ oYaw: window.__DEBUG__.chase.oYaw.toFixed(3), oPitch: window.__DEBUG__.chase.oPitch.toFixed(3) })'));
// the right button too
await page.mouse.down({ button: 'right' }); for (let i = 0; i < 10; i++) { await page.mouse.move(640 - i * 30, 360); await sleep(30); } await sleep(200);
note('right-button orbit:', await ev('({ oYaw: window.__DEBUG__.chase.oYaw.toFixed(2) })'));
await page.mouse.up({ button: 'right' }); await sleep(800);
for (let i = 0; i < 12; i++) { await page.mouse.wheel({ deltaY: 120 }); await sleep(40); }
await sleep(800);
note('zoom out x12:', await ev('({ zoom: window.__DEBUG__.chase.zoom, stored: localStorage.getItem("minidrift.zoom") })'));
await shot('08_zoom_out');
for (let i = 0; i < 24; i++) { await page.mouse.wheel({ deltaY: -120 }); await sleep(40); }
await sleep(800);
note('zoom in x24:', await ev('({ zoom: window.__DEBUG__.chase.zoom })'));
await shot('09_zoom_in');
for (let i = 0; i < 12; i++) { await page.mouse.wheel({ deltaY: 120 }); await sleep(30); }
await page.keyboard.press('Equal'); await page.keyboard.press('Minus');
await ev('window.__AUTOPILOT__ = null');
note('errors', Q.errors.length, JSON.stringify(Q.errors.slice(0, 10)));
fs.writeFileSync(path.join(Q.OUT, 'flows.txt'), Q.log.join('\n'));
await Q.close();
