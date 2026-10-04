// Where the draws and the triangles go: teleport along the pass, look the way the chase camera does (or from high), and
// hide one thing at a time (each prop pool, the farmland's, the terrain's forest and tiles, the road's chunks), reading
// the renderer's own count of draws and triangles for the frame without it. Shadow passes count, as in the gate.
//   node work/census.mjs [--s=300,1100,1900,2700] [--view=chase|high] [--phone] [--hour=17.3]
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { createRequire } from 'module';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const require = createRequire(path.join(arg('recipe', 'C:/Users/liamk/404-game-recipe'), 'package.json'));
const puppeteer = require('puppeteer');
const target = path.resolve(arg('game', 'game'));
const S = arg('s', '300,1100,1900,2700').split(',').map(Number);
const VIEW = arg('view', 'chase'), HOUR = Number(arg('hour', 17.3)), PHONE = process.argv.includes('--phone');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]); if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(target, rel);
  if (!file.startsWith(target) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1280,720'] });
const page = await browser.newPage();
if (PHONE) {
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36');
} else await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load' });
await page.waitForFunction('window.__READY__ === true', { timeout: 60000 });
// (--city: choose NEO TOKYO on the title first, as the gate does, and wait for it to build)
if (process.argv.includes('--city')) {
  await page.click('.map[data-m=city]'); await sleep(400);
  await page.waitForFunction("!document.getElementById('building').classList.contains('on')", { timeout: 60000 }); await sleep(1500);
}
await page.evaluate("document.getElementById('startb').click()");
await sleep(2500);
await page.evaluate('window.__DEBUG__.rainNow(0)');
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r([window.__GAME__.draws, window.__GAME__.tris])))));
const avg = async () => { let d = 0, t = 0; for (let i = 0; i < 4; i++) { const [a, b] = await frame(); d = Math.max(d, a); t = Math.max(t, b); } return [d, t]; };
for (const s of S) {
  await page.evaluate(({ s, view, h }) => {
    const D = window.__DEBUG__;
    D.G.dawnT = D.G.dawnT || 0.01; D.G.hour = h; D.G.hourShown = h; D.G.lastApplied = -9;
    const p = D.teleport(s, 0), fx = Math.sin(p.h), fz = Math.cos(p.h);
    // (--view=yaw<deg>: the chase camera's place, looking that many degrees off the road's heading, as in a slide)
    const yaw = view.startsWith('yaw') ? Number(view.slice(3)) * Math.PI / 180 : null;
    if (yaw !== null) { const hx = Math.sin(p.h + yaw), hz = Math.cos(p.h + yaw); window.__CAM__ = { pos: [p.x - fx * 4, p.y + 1.6, p.z - fz * 4], look: [p.x + hx * 40, p.y + 0.5, p.z + hz * 40], fov: 62 }; }
    else window.__CAM__ = view === 'high' ? { pos: [p.x - fx * 35, p.y + 30, p.z - fz * 35], look: [p.x + fx * 140, p.y - 6, p.z + fz * 140], fov: 62 } : null;
  }, { s, view: VIEW, h: HOUR });
  await sleep(2500);
  const base = await avg();
  // the things to hide one at a time: [label, js that returns the list of objects]
  const groups = await page.evaluate(() => {
    const D = window.__DEBUG__, W = D.world, T = W.terrain, out = [];
    for (const [k, p] of Object.entries(W.pools)) out.push(['pool:' + k, `window.__DEBUG__.world.pools['${k}'].group`]);
    if (T.farTrees) for (const k of Object.keys(T.farTrees)) out.push(['farTrees:' + k, `window.__DEBUG__.world.terrain.farTrees['${k}'].group`]);
    if (T.extra) for (const k of Object.keys(T.extra)) out.push(['extra:' + k, `window.__DEBUG__.world.terrain.extra['${k}'].group`]);
    out.push(['terrain tiles', '[...window.__DEBUG__.world.terrain.tiles.values()].map((t) => t.mesh).filter(Boolean)']);
    out.push(['forest (near tiles)', '[...window.__DEBUG__.world.terrain.tiles.values()].map((t) => t.trees).filter(Boolean)']);
    out.push(['far mesh', 'window.__DEBUG__.world.terrain.far']);
    out.push(['road chunks', '[...window.__DEBUG__.world.chunks.values()].map((c) => c.group)']);
    return out;
  });
  const rows = [];
  for (const [label, js] of groups) {
    await page.evaluate((js) => { let o = eval(js); if (!o) return; o = Array.isArray(o) ? o : [o]; window.__HID__ = o.filter((x) => x.visible); for (const x of window.__HID__) x.visible = false; }, js);
    const r = await avg();
    await page.evaluate(() => { for (const x of window.__HID__ || []) x.visible = true; window.__HID__ = []; });
    rows.push([label, base[0] - r[0], base[1] - r[1]]);
  }
  rows.sort((a, b) => b[2] - a[2]);
  console.log(`\ns=${s} ${VIEW}  total draws ${base[0]}  tris ${base[1].toLocaleString('en-US')}`);
  for (const [l, d, t] of rows) if (d || t) console.log(`  ${l.padEnd(26)} draws ${String(d).padStart(4)}  tris ${String(t.toLocaleString('en-US')).padStart(9)}`);
}
await browser.close(); server.close();
