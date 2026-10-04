// The boot's stages as the game logs them (window.__BOOT__), on the desktop gate's viewport with no throttling: for
// comparing two builds' ready time stage by stage (--game=<dir> for the other one).
//   node work/boot_stages.mjs [--game=game] [--runs=2] [--phone]
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { createRequire } from 'module';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const require = createRequire(path.join(arg('recipe', 'C:/Users/liamk/404-game-recipe'), 'package.json'));
const puppeteer = require('puppeteer');
const target = path.resolve(arg('game', 'game')), RUNS = Number(arg('runs', 2)), PHONE = process.argv.includes('--phone');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]); if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(target, rel);
  if (!file.startsWith(target) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
for (let run = 0; run < RUNS; run++) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,720'] });
  const page = await browser.newPage();
  if (PHONE) {
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36');
  } else await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load' });
  await page.waitForFunction('window.__READY__ === true', { timeout: 90000 });
  const ready = (Date.now() - t0) / 1000;
  const boot = await page.evaluate(() => window.__BOOT__);
  let prev = 0;
  console.log(`run ${run}: ready ${ready.toFixed(1)} s   ` + boot.map(([m, t]) => { const d = t - prev; prev = t; return `${m || '?'} +${d}`; }).join('  '));
  await browser.close();
}
server.close();
