// QA: the sound while paused, by each way into the pause (Esc, P, the button, a hidden tab), and after keys pressed in it.
import { open, sleep } from './qa_lib.mjs';

const Q = await open({ out: 'work/qa_out/pause_audio' });
const { page, ev, note, tap } = Q;
const st = () => ev('({ mode: window.__DEBUG__.G.mode, ctx: window.__DEBUG__.audio.ctx ? window.__DEBUG__.audio.ctx.state : "-" })');
await tap('#startb'); await sleep(1500);
await page.keyboard.down('KeyW'); await sleep(2000);
// trace every suspend/resume the page makes
await ev(`(() => { const c = window.__DEBUG__.audio.ctx; window.__AUDLOG__ = []; const s = c.suspend.bind(c), r = c.resume.bind(c);
  c.suspend = () => { window.__AUDLOG__.push(['suspend', c.state, new Error().stack.split('\\n').slice(2, 5).map((x) => x.trim().replace(/https?:\\/\\/[^/]+\\//, '')).join(' < ')]); return s(); };
  c.resume = () => { window.__AUDLOG__.push(['resume', c.state, new Error().stack.split('\\n').slice(2, 5).map((x) => x.trim().replace(/https?:\\/\\/[^/]+\\//, '')).join(' < ')]); return r(); }; })()`);
await page.keyboard.press('Escape'); await page.keyboard.up('KeyW');
for (const ms of [30, 300, 1000]) { await sleep(ms); note(`Esc +${ms}ms`, await st()); }
note('log', await ev('window.__AUDLOG__.splice(0)'));
await page.keyboard.press('KeyD'); await sleep(500);
note('paused, pressed D', await st(), await ev('window.__AUDLOG__.splice(0)'));
await page.keyboard.press('Escape'); await sleep(500);
note('Esc (resume)', await st(), await ev('window.__AUDLOG__.splice(0)'));
await page.keyboard.press('KeyP'); await sleep(500);
note('P', await st(), await ev('window.__AUDLOG__.splice(0)'));
await page.keyboard.press('KeyP'); await sleep(500);
await tap('#pauseb'); await sleep(500);
note('pause button', await st(), await ev('window.__AUDLOG__.splice(0)'));
await page.keyboard.press('KeyW'); await sleep(500);
note('paused (button), pressed W', await st(), await ev('window.__AUDLOG__.splice(0)'));
await tap('#resumeb'); await sleep(500);
// a hidden tab: the page is told it is hidden
await ev(`(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); })()`);
await sleep(500);
note('hidden', await st(), await ev('window.__AUDLOG__.splice(0)'));
await ev(`(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); })()`);
await sleep(500);
note('shown again', await st(), await ev('window.__AUDLOG__.splice(0)'));
await page.mouse.click(100, 100); await sleep(400);
note('shown, clicked the pause screen', await st(), await ev('window.__AUDLOG__.splice(0)'));
note('errors', Q.errors);
await Q.close();
