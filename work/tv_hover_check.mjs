// Does a hover on the title come out on the TV as the page means it? pagetv.js reads a style once, when something
// changed (a pointerover is one): a CSS transition running then would be caught part way. The hovered course button's
// border is read back from the TV's canvas with the page's transitions on (as they were) and off (body.tv now).
//   node work/tv_hover_check.mjs
import { open, sleep } from './qa_lib.mjs';

const Q = await open({ out: 'work/qa_out/tv_hover' });
const { page, ev, note } = Q;
await sleep(1500);
// the HARD button's top border at the middle, through the tube onto the HUD canvas: the most orange pixel in a short
// column across the edge (a 1.5 px line, wherever the curve puts it)
const probe = `(() => { const D = window.__DEBUG__, h = D.hud, b = document.querySelector('.diff[data-d=hard]'), r = b.getBoundingClientRect();
  const [u, v] = h._toTex(r.left + r.width * 0.5, r.top); const c = h.canvas.getContext('2d');
  const x = Math.round(u * h.s), y0 = Math.round(v * h.s) - 6, d = c.getImageData(x, y0, 1, 13).data;
  let best = null, score = -1e9; for (let i = 0; i < 13; i++) { const p = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3]], s = p[0] - p[2] + p[1] * 0.2; if (s > score) { score = s; best = p; } } return best; })()`;
for (const [label, css] of [['transitions as they were (.15 s)', 'body.tv #title .diff { transition:border-color .15s, background .15s !important; }'], ['transitions off (body.tv now)', '']]) {
  await ev(`(() => { let s = document.getElementById('probe-css'); if (!s) { s = document.createElement('style'); s.id = 'probe-css'; document.head.appendChild(s); } s.textContent = ${JSON.stringify(css)}; })()`);
  await page.mouse.move(5, 5); await sleep(600);
  const before = await ev(probe);
  const r = await ev(`(() => { const b = document.querySelector('.diff[data-d=hard]').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
  await page.mouse.move(r[0], r[1]); await sleep(900);
  const after = await ev(probe), page2 = await ev(`getComputedStyle(document.querySelector('.diff[data-d=hard]')).borderTopColor`);
  note(`${label}: the TV's border before ${JSON.stringify(before)}, hovered ${JSON.stringify(after)}; the page's own, hovered: ${page2}`);
}
note('errors', Q.errors.length);
await Q.close();
