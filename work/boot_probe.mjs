// Where the load time goes, under the jam gate's conditions (phone viewport, 4G: 4 Mbps down, 60 ms latency, CPU
// slowed 2x, empty cache): the network's share (the module graph and its CDN files) and each boot stage the game
// logs (window.__BOOT__), from a local server or a URL.
//   node work/boot_probe.mjs [url] [--cpu=2] [--runs=2]
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { createRequire } from 'module';
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const require = createRequire(path.join('C:/Users/liamk/404-game-recipe', 'package.json'));
const puppeteer = require('puppeteer');
let URL = process.argv.find((a) => /^https?:/.test(a));
let server = null;
if (!URL) {
  const target = path.resolve(arg('dir', 'game'));
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
  server = createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]); if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(target, rel);
    if (!file.startsWith(target) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  URL = `http://127.0.0.1:${server.address().port}/`;
}
const CPU = Number(arg('cpu', 2)), RUNS = Number(arg('runs', 2));
for (let run = 0; run < RUNS; run++) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36');
  await page.setCacheEnabled(false);
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 4 * 1024 * 1024 / 8, uploadThroughput: 1024 * 1024 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const t0 = Date.now();
  await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
  const tLoad = (Date.now() - t0) / 1000;
  await page.waitForFunction('window.__READY__ === true', { timeout: 90000 });
  const tReady = (Date.now() - t0) / 1000;
  const info = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const res = performance.getEntriesByType('resource');
    const lastRes = Math.max(...res.map((r) => r.responseEnd));
    const byHost = {};
    for (const r of res) { const h = new URL(r.name).host || 'local'; byHost[h] = (byHost[h] || 0) + (r.transferSize || r.encodedBodySize || 0); }
    return { domContentLoaded: Math.round(nav.domContentLoadedEventEnd), lastResource: Math.round(lastRes), nRes: res.length, byHost, boot: window.__BOOT__ };
  });
  console.log(`run ${run + 1}: load event ${tLoad.toFixed(1)} s, ready ${tReady.toFixed(1)} s, DOMContentLoaded ${(info.domContentLoaded / 1000).toFixed(1)} s, last resource ${(info.lastResource / 1000).toFixed(1)} s (${info.nRes} files)`);
  console.log('  bytes by host:', JSON.stringify(Object.fromEntries(Object.entries(info.byHost).map(([k, v]) => [k, Math.round(v / 1024) + ' KB']))));
  let prev = null;
  for (const [msg, ms] of info.boot || []) { console.log(`  ${String(ms).padStart(6)} ms  ${prev !== null ? '(+' + (ms - prev) + ')' : ''}  ${msg}`); prev = ms; }
  await browser.close();
}
if (server) server.close();
