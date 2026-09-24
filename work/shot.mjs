// Screenshots of the game under a script, at full frame rate, headless.
//   node work/shot.mjs <script.json|inline-json> [--phone] [--out=work/shots]
// A script is a list of steps: { wait: ms } | { js: "code run in the page" } | { shot: "name" } | { click: "#sel" }
//   | { mouse: ['down' | 'move' | 'up', x, y, 'left' | 'right'] }
//   | { keys: ["KeyW"], ms: 800 } (hold keys for ms)
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { createRequire } from 'module';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const RECIPE = arg('recipe', 'C:/Users/liamk/404-game-recipe');
const require = createRequire(path.join(RECIPE, 'package.json'));
const puppeteer = require('puppeteer');
const target = path.resolve('game');
const OUT = path.resolve(arg('out', 'work/shots'));
const PHONE = process.argv.includes('--phone');
fs.mkdirSync(OUT, { recursive: true });
let steps = process.argv[2];
steps = fs.existsSync(steps) ? JSON.parse(fs.readFileSync(steps, 'utf8')) : JSON.parse(steps);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(target, rel);
  if (!file.startsWith(target) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL = `http://127.0.0.1:${server.address().port}/${arg('query', '')}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1280,720'] });
const page = await browser.newPage();
const VP = arg('vp', '');   // --vp=667x375: a phone of that size, touch, mobile (portrait or on its side)
if (VP) {
  const [vw, vh] = VP.split('x').map(Number);
  await page.setViewport({ width: vw, height: vh, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1');
} else if (PHONE) {
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36');
} else await page.setViewport({ width: Number(arg('w', 1280)), height: Number(arg('h', 720)), deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); if (m.type() === 'log' && process.argv.includes('--log')) console.log('page:', m.text().slice(0, 300)); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction('window.__READY__ === true', { timeout: 60000 });
for (const s of steps) {
  if (s.wait) await sleep(s.wait);
  if (s.js) { const r = await page.evaluate(s.js); if (r !== undefined) console.log(JSON.stringify(r)); }
  if (s.click) await page.click(s.click);
  if (s.mouse) { const [act, x, y, button] = s.mouse; if (act === 'down') { await page.mouse.move(x, y); await page.mouse.down({ button: button || 'left' }); } else if (act === 'move') await page.mouse.move(x, y, { steps: 12 }); else await page.mouse.up({ button: button || 'left' }); }
  if (s.keys) { for (const k of s.keys) await page.keyboard.down(k); await sleep(s.ms || 500); for (const k of s.keys) await page.keyboard.up(k); }
  if (s.shot) { await page.screenshot({ path: path.join(OUT, s.shot + '.png') }); console.log('shot', s.shot); }
}
if (errors.length) console.log('errors:', errors.slice(0, 5));
await browser.close(); server.close();
