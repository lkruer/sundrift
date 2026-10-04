// The forest's make-up round a spot: every near tile's instanced trees by model, how many and how many triangles,
// and the shared pools' instance counts (world and terrain). For tuning the woods' density and mix against the budget.
//   node work/forest_mix.mjs [--s=280] [--phone]
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { createRequire } from 'module';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const require = createRequire(path.join(arg('recipe', 'C:/Users/liamk/404-game-recipe'), 'package.json'));
const puppeteer = require('puppeteer');
const target = path.resolve(arg('game', 'game'));
const S = arg('s', '280').split(',').map(Number), PHONE = process.argv.includes('--phone');
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
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load' });
await page.waitForFunction('window.__READY__ === true', { timeout: 60000 });
await page.evaluate("document.getElementById('startb').click()");
await sleep(2500);
for (const s of S) {
  await page.evaluate((s) => window.__DEBUG__.teleport(s, 0), s);
  await sleep(2500);
  const r = await page.evaluate(() => {
    const W = window.__DEBUG__.world, T = W.terrain, by = {};
    const tri = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
    for (const t of T.tiles.values()) if (t.trees) t.trees.traverse((o) => {
      if (!o.isInstancedMesh) return;
      const k = 'lod' + t.lod + ' ' + (o.material.name || '?') + ' ' + tri(o.geometry);
      const e = by[k] || (by[k] = { n: 0, tris: 0, meshes: 0 }); e.n += o.count; e.tris += o.count * tri(o.geometry); e.meshes++;
    });
    const pools = {};
    for (const [k, p] of Object.entries(W.pools)) if (p.n) pools[k] = p.n;
    for (const [k, p] of Object.entries(T.farTrees || {})) pools['far:' + k] = p.n;
    for (const [k, p] of Object.entries(T.extra || {})) pools['extra:' + k] = p.n;
    const tiles = [0, 0, 0]; for (const t of T.tiles.values()) if (t.lod >= 0) tiles[t.lod]++;
    return { by, pools, tiles };
  });
  console.log(`\ns=${s}  tiles by lod ${r.tiles.join('/')}`);
  for (const [k, e] of Object.entries(r.by).sort((a, b) => b[1].tris - a[1].tris)) console.log(`  ${k.padEnd(34)} trees ${String(e.n).padStart(5)}  tris ${String(e.tris).padStart(8)}  meshes ${e.meshes}`);
  console.log('  pools', JSON.stringify(r.pools));
}
await browser.close(); server.close();
