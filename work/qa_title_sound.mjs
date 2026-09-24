// QA: the title's sound after MAIN MENU mid-slide in the rain (the engine, the tyres, the rain), measured on the master bus.
import { open, sleep } from './qa_lib.mjs';

const Q = await open({ out: 'work/qa_out/title_sound' });
const { ev, note, tap } = Q;
const rmsJs = `(async () => { const a = window.__DEBUG__.audio; if (!a.ctx) return 'no ctx'; const c = a.ctx;
  if (!window.__AN__) { window.__AN__ = c.createAnalyser(); window.__AN__.fftSize = 2048; a.comp.connect(window.__AN__); }
  const an = window.__AN__, buf = new Float32Array(an.fftSize); let s = 0, n = 0;
  for (let k = 0; k < 20; k++) { await new Promise((r) => setTimeout(r, 50)); an.getFloatTimeDomainData(buf); for (const v of buf) { s += v * v; n++; } }
  return { state: c.state, rmsDb: +(20 * Math.log10(Math.sqrt(s / n) + 1e-9)).toFixed(1), eng: +a.engGain.gain.value.toFixed(3), screech: +a.screechGain.gain.value.toFixed(3), wind: +a.windGain.gain.value.toFixed(3), rain: +a.rainGain.gain.value.toFixed(3) }; })()`;
await tap('#startb'); await sleep(1500);
await ev('window.__DEBUG__.rainNow(0.9)');
await ev(`window.__AUTOPILOT__ = (dt) => ({ throttle: 1, brake: 0, steer: 1, hand: window.__DEBUG__.car.speed > 12 ? 1 : 0, reverse: false, touch: false })`);
await sleep(5000);
note('mid-slide in the rain:', JSON.stringify(await ev(rmsJs)));
await tap('#pauseb'); await sleep(400);
note('paused (button):', JSON.stringify(await ev(rmsJs)));
await Q.page.keyboard.press('KeyA'); await sleep(500);
note('paused, then a key:', JSON.stringify(await ev(rmsJs)));
await tap('#quitb'); await sleep(2000);
await ev('window.__AUTOPILOT__ = null');
note('title after MAIN MENU:', JSON.stringify(await ev(rmsJs)));
await sleep(5000);
note('title 5 s later:', JSON.stringify(await ev(rmsJs)));
await tap('#startb'); await sleep(1500);
await ev('window.__DEBUG__.rainNow(0)');
await Q.page.keyboard.down('KeyW'); await sleep(1500);
await Q.page.keyboard.press('Escape'); await Q.page.keyboard.up('KeyW'); await sleep(700);
note('new run, paused with Esc:', JSON.stringify(await ev(rmsJs)));
note('errors', Q.errors.length, JSON.stringify(Q.errors.slice(0, 5)));
await Q.close();
