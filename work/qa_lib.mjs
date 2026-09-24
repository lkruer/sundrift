// QA helpers: serve game/, launch Chrome, instrument, and small conveniences for scenario scripts.
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { createRequire } from 'module';

export const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const RECIPE = arg('recipe', 'C:/Users/liamk/404-game-recipe');
const require = createRequire(path.join(RECIPE, 'package.json'));
export const puppeteer = require('puppeteer');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
export async function serve(dir = 'game') {
  const target = path.resolve(dir);
  const server = createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(target, rel);
    if (!file.startsWith(target) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

/** A browser and a page on the game, instrumented; phone: 390x844 touch unless a viewport is given. */
export async function open({ phone = false, viewport = null, out = 'work/qa_out/flows', storage = null } = {}) {
  fs.mkdirSync(path.resolve(out), { recursive: true });
  const { server, url } = await serve();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1280,720', '--enable-precise-memory-info', '--js-flags=--expose-gc',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  if (phone) {
    await page.setViewport(viewport || { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36');
  } else await page.setViewport(viewport || { width: 1280, height: 720, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(['pageerror', String(e.message).slice(0, 300)]));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push([m.type(), m.text().slice(0, 300)]); });
  await page.evaluateOnNewDocument(fs.readFileSync(path.resolve('work/qa_instrument.js'), 'utf8'));
  if (storage) await page.evaluateOnNewDocument(`(() => { const s = ${JSON.stringify(storage)}; for (const k in s) try { localStorage.setItem(k, s[k]); } catch {} })()`);
  const cdp = await page.target().createCDPSession();
  const t0 = performance.now();
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction('window.__READY__ === true', { timeout: 90000 });
  const ready = (performance.now() - t0) / 1000;
  const OUT = path.resolve(out);
  const shot = async (name) => { await page.evaluate('window.__QA__.shots.push(performance.now()); window.__SHOT__ = performance.now();'); await page.screenshot({ path: path.join(OUT, name + '.png') }); return name; };
  const ev = (js) => page.evaluate(js);
  const log = [];
  const note = (...a) => { const s = a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); log.push(s); console.log(s); };
  const tap = async (sel) => {
    if (phone) { const b = await page.$(sel); const bb = await b.boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); }
    else await page.click(sel);
  };
  const waitBuilt = () => page.waitForFunction('!document.getElementById("building").classList.contains("on")', { timeout: 60000 });
  const close = async () => { await browser.close(); server.close(); };
  return { browser, page, cdp, ready, shot, ev, note, log, tap, waitBuilt, close, errors, OUT };
}

/** The QA autopilot (a plain road follower unless a plan is set). */
export const AP_SRC = fs.readFileSync(path.resolve('work/qa_autopilot.js'), 'utf8');
