// The share card and the share itself, checked headless: cards drawn for runs that ended at four hours on both maps
// (saved as PNGs to look at), the share text, and the fallback a browser without a share sheet takes (the text on the
// clipboard and the card saved as a download), driven from a real SHARE press on the results.
//   node work/share_check.mjs [--out=work/shots/share]
import fs from 'fs';
import path from 'path';
import { open, sleep, arg } from './qa_lib.mjs';

const OUT = path.resolve(arg('out', 'work/shots/share'));
fs.mkdirSync(OUT, { recursive: true });
const Q = await open({ out: OUT });
const { page, ev, note } = Q;
const base = { v: 1, id: 1, at: Date.parse('2026-10-03T21:00:00Z'), diff: 'easy', score: 123456, drifts: 34, biggest: 12345, longest: 6.4, combo: 7,
  clips: 5, crashes: 2, jturns: 1, driftTime: 214.5, angle: 52, topKmh: 158, smashes: 9, distance: 14230, hours: 12.7, time: 552, dawn: true, dawnTime: 548 };
const runs = {
  dawn_pass: { ...base, map: 'mountain', course: 'YOZAKURA PASS · EASY', clock: 6.02 },
  night_pass: { ...base, map: 'mountain', course: 'YOZAKURA PASS · HARD', clock: 2.23, dawn: false, dawnTime: null, score: 48210, drifts: 21, combo: 4 },
  golden_city: { ...base, map: 'city', course: 'NEO TOKYO · EASY', clock: 17.8, dawn: false, dawnTime: null, score: 3120, drifts: 3, combo: 1 },
  night_city: { ...base, map: 'city', course: 'NEO TOKYO · HARD', clock: 23.4, dawn: false, dawnTime: null, score: 71890, drifts: 40, combo: 9 },
  day_city: { ...base, map: 'city', course: 'NEO TOKYO · EASY', clock: 9.7 },
};
for (const [name, run] of Object.entries(runs)) {
  const r = await ev(`(async () => { const m = await import('./src/share.js?v=202609242220'); const cv = await m.drawCard(${JSON.stringify(run)}, 'mph'); return { url: cv.toDataURL('image/png'), text: m.shareText(${JSON.stringify(run)}, 'mph'), w: cv.width, h: cv.height }; })()`);
  fs.writeFileSync(path.join(OUT, `card_${name}.png`), Buffer.from(r.url.split(',')[1], 'base64'));
  note(`${name}: ${r.w}x${r.h}\n${r.text}\n`);
}
// the real press: a run quit at once, its results, SHARE (no share sheet headless: the clipboard and a download)
const cdp = Q.cdp;
await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: OUT }).catch(() => cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: OUT }));
await page.browserContext().overridePermissions(new URL(page.url()).origin, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']).catch(() => {});
await Q.tap('#startb'); await sleep(1500);
await page.keyboard.down('KeyW'); await sleep(2500); await page.keyboard.up('KeyW');
await page.keyboard.press('Escape'); await sleep(400);
await Q.tap('#quitb'); await sleep(1200);
note('share api in this browser:', await ev('({ share: typeof navigator.share, canShare: typeof navigator.canShare, clipboard: !!(navigator.clipboard && navigator.clipboard.writeText) })'));
// (as this browser has it; then as a browser with no share sheet: the clipboard and a download)
for (const how of ['as it is', 'with no share sheet']) {
  if (how !== 'as it is') await ev('(() => { try { delete Navigator.prototype.share; delete Navigator.prototype.canShare; } catch {} return typeof navigator.share; })()');
  const before = new Set(fs.readdirSync(OUT));
  await Q.tap('#r-share'); await sleep(1200);
  note(`${how}: the button says`, await ev("document.getElementById('r-share').textContent"));
  await Q.shot('results_share_' + how.replace(/\s+/g, '_'));
  await sleep(1800);
  note(`${how}: the clipboard holds`, await ev('navigator.clipboard.readText().catch((e) => "(unreadable: " + e.message + ")")'));
  note(`${how}: saved`, fs.readdirSync(OUT).filter((f) => !before.has(f)));
}
note('errors', Q.errors.length, JSON.stringify(Q.errors.slice(0, 5)));
fs.writeFileSync(path.join(OUT, 'share_check.txt'), Q.log.join('\n'));
await Q.close();
