// After switching from the pass to the city on the title (as the city gates do), list every pool that still holds
// instances, and the terrain's extra pools, so anything the pass left behind shows up.
//   node work/city_leftovers.mjs [--phone]
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { createRequire } from 'module';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const require = createRequire(path.join(arg('recipe', 'C:/Users/liamk/404-game-recipe'), 'package.json'));
const puppeteer = require('puppeteer');
const target = path.resolve(arg('game', 'game'));
const PHONE = process.argv.includes('--phone');
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
const list = () => page.evaluate(() => {
  const W = window.__DEBUG__.world, out = {};
  for (const [k, p] of Object.entries(W.pools)) if (p.n) out[k] = p.n;
  const T = W.terrain;
  for (const [k, p] of Object.entries(T.extra || {})) if (p.n) out['extra:' + k] = p.n;
  for (const [k, p] of Object.entries(T.farTrees || {})) if (p.n) out['far:' + k] = p.n;
  return out;
});
console.log('pass at ready', JSON.stringify(await list()));
await page.click('.map[data-m=city]'); await sleep(400);
await page.waitForFunction("!document.getElementById('building').classList.contains('on')", { timeout: 60000 }); await sleep(1500);
console.log('city after switch', JSON.stringify(await list()));
await browser.close(); server.close();
