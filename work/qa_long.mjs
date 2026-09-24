// QA long session: drive with the QA autopilot for --min minutes, sampling everything every 10 s.
//   node work/qa_long.mjs --map=mountain|city --diff=easy|hard --min=12 --out=work/qa_out/<name> [--phone] [--every=22] [--shots=60]
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { createRequire } from 'module';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const RECIPE = arg('recipe', 'C:/Users/liamk/404-game-recipe');
const require = createRequire(path.join(RECIPE, 'package.json'));
const puppeteer = require('puppeteer');
const target = path.resolve('game');
const MAP = arg('map', 'mountain'), DIFF = arg('diff', 'easy'), MIN = Number(arg('min', 12)), PHONE = process.argv.includes('--phone');
const NAME = arg('name', `${MAP}_${DIFF}${PHONE ? '_phone' : ''}`);
const OUT = path.resolve(arg('out', 'work/qa_out/' + NAME));
const SHOT_EVERY = Number(arg('shots', 60)), GC_EVERY = Number(arg('gc', 180));
fs.mkdirSync(OUT, { recursive: true });
const INSTR = fs.readFileSync(path.resolve('work/qa_instrument.js'), 'utf8');
const AP = fs.readFileSync(path.resolve('work/qa_autopilot.js'), 'utf8');

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
const URL = `http://127.0.0.1:${server.address().port}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TRACEGC = process.argv.includes('--tracegc');
const browser = await puppeteer.launch({ headless: true, dumpio: TRACEGC, args: ['--no-sandbox', '--window-size=1280,720', '--enable-precise-memory-info', TRACEGC ? '--js-flags=--expose-gc --trace-gc' : '--js-flags=--expose-gc',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
if (PHONE) {
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36');
} else await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(['pageerror', Math.round(performance.now() / 1000), String(e.message).slice(0, 300)]));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push([m.type(), Math.round(performance.now() / 1000), m.text().slice(0, 300)]); });
await page.evaluateOnNewDocument(INSTR);
const cdp = await page.target().createCDPSession();
await cdp.send('Performance.enable');
const tLoad = performance.now();
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction('window.__READY__ === true', { timeout: 90000 });
const readyS = ((performance.now() - tLoad) / 1000).toFixed(1);
// pick the course
const tap = async (sel) => { if (PHONE) { const b = await page.$(sel); const bb = await b.boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); } else await page.click(sel); };
await tap(`.map[data-m=${MAP}]`);
await sleep(400);
await page.waitForFunction('!document.getElementById("building").classList.contains("on")', { timeout: 60000 });
await tap(`.diff[data-d=${DIFF}]`);
await sleep(400);
await page.waitForFunction('!document.getElementById("building").classList.contains("on")', { timeout: 60000 });
await sleep(2500);
await tap('#startb');
await sleep(1500);
const mode0 = await page.evaluate('window.__DEBUG__.G.mode + " " + window.__DEBUG__.G.map + " " + window.__DEBUG__.G.diff');
console.log('ready', readyS, 's; started:', mode0);
if (arg('plan')) await page.evaluate(`window.__QA_PLAN__ = ${JSON.stringify(arg('plan'))}`);
if (arg('every')) await page.evaluate(`window.__QA_EVERY__ = ${Number(arg('every'))}`);
console.log('autopilot', JSON.stringify(await page.evaluate(AP)));
await page.evaluate('window.__ONFRAME__ = window.__QA__.onFrame; window.__QA__.take();');
if (process.argv.includes('--draws')) await page.evaluate('window.__QA__.hookDraws(window.__DEBUG__.renderer); window.__QA__.watchFirst = true;');

const TRACE = arg('trace') ? arg('trace').split('-').map(Number) : null; let tracing = false;
const samples = [];
const t0 = performance.now();
let lastShot = 0, lastGc = -1e9, nShot = 0;
const gcSample = async (label) => {
  await page.evaluate('window.__QA__.gcs.push(performance.now()); window.gc && window.gc(); window.gc && window.gc();');
  await sleep(300);
  const h = await page.evaluate('({ heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) })');
  const dom = await cdp.send('Memory.getDOMCounters').catch(() => ({}));
  return { label, ...h, ...dom };
};
const gcs = [];
gcs.push(await gcSample('start'));
while ((performance.now() - t0) / 60000 < MIN) {
  await sleep(10000);
  const el = (performance.now() - t0) / 1000;
  const f = await page.evaluate('window.__QA__.take()');
  const s = await page.evaluate('window.__QA__.sample()');
  const ap = await page.evaluate('({ mode: window.__QA__.ap.mode, counts: window.__QA__.ap.counts, done: window.__QA__.ap.done, magnets: window.__QA__.ap.magnets, teleports: window.__QA__.ap.teleports, events: window.__QA__.ap.events })');
  const m = await cdp.send('Performance.getMetrics');
  const met = Object.fromEntries(m.metrics.filter((x) => ['JSHeapUsedSize', 'Nodes', 'JSEventListeners', 'LayoutCount', 'RecalcStyleCount', 'Documents'].includes(x.name)).map((x) => [x.name, Math.round(x.value)]));
  samples.push({ el: Math.round(el), f, s, ap, met });
  console.log(`${String(Math.round(el)).padStart(4)}s ${s.mode} h=${s.hour.toFixed(2)} n=${s.night} rain=${s.rain} s=${s.s} ${s.kmh}kmh | fr p50 ${f.real.p50} p99 ${f.real.p99} max ${f.real.max} >34:${f.over34} js99 ${f.js.p99} w99 ${f.world.p99} | heap ${s.heapMB} geo ${s.geo} tex ${s.tex} prog ${s.progs} calls ${s.calls} tris ${(s.tris / 1e6).toFixed(2)}M objs ${s.objs} dom ${s.dom} ch ${s.chunks}/${s.near} tiles ${s.tiles} tAvg ${(s.tMs / Math.max(1, s.tBuilt)).toFixed(1)} parts ${s.particles} deb ${s.debris} aud ${s.aud ? s.aud.playing + '/' + s.aud.live + ' ' + s.aud.state : '-'} full[${s.fullPools.join(',')}] ap:${ap.mode} mag ${ap.magnets}`);
  if (el - lastShot >= SHOT_EVERY) {
    lastShot = el;
    await page.evaluate('window.__QA__.shots.push(performance.now()); window.__SHOT__ = performance.now();');
    await page.screenshot({ path: path.join(OUT, `t${String(Math.round(el)).padStart(4, '0')}_h${s.hour.toFixed(1)}.png`) });
    nShot++;
  }
  if (TRACE && !tracing && el >= TRACE[0]) { tracing = true; await page.tracing.start({ path: path.join(OUT, 'trace.json'), categories: ['devtools.timeline', 'v8', 'disabled-by-default-v8.gc', 'blink.user_timing', 'gpu', 'toplevel'] }); console.log('   trace on'); }
  if (TRACE && tracing === true && el >= TRACE[1]) { tracing = 'done'; await page.tracing.stop(); console.log('   trace off'); }
  if (el - lastGc >= GC_EVERY) { lastGc = el; gcs.push(await gcSample(Math.round(el) + 's')); console.log('   gc', JSON.stringify(gcs[gcs.length - 1])); }
}
gcs.push(await gcSample('end'));
const apFinal = await page.evaluate('({ counts: window.__QA__.ap.counts, done: window.__QA__.ap.done, magnets: window.__QA__.ap.magnets, teleports: window.__QA__.ap.teleports, events: window.__QA__.ap.events, log: window.__QA__.ap.log.slice(-80) })');
const slowLog = await page.evaluate('window.__DEBUG__.G.slowLog || []');
const slowCtx = await page.evaluate('window.__QA__.slowCtx');
const newProgs = await page.evaluate('window.__QA__.newProgs || []');
const slowGL = await page.evaluate('window.__QA__.slowGL || []');
const slowDraws = await page.evaluate('window.__QA__.slowDraws || []');
// the first draws in the second before each slow frame
const firstNear = await page.evaluate(`(() => { const Q = window.__QA__, out = []; for (const r of Q.slowCtx) { const t = r[r.length - 1][0]; out.push([t, (Q.firstDraws || []).filter((f) => f[0] > t - 1200 && f[0] <= t).slice(-25)]); } return out; })()`);
fs.writeFileSync(path.join(OUT, 'long.json'), JSON.stringify({ map: MAP, diff: DIFF, phone: PHONE, readyS, samples, gcs, apFinal, slowLog, slowCtx, newProgs, slowGL, slowDraws, firstNear, errors }, null, 1));
console.log('slow GL calls:', JSON.stringify(slowGL.slice(0, 30)));
console.log('slow draws:', JSON.stringify(slowDraws.slice(0, 30)));
console.log('slow frames (>50 ms) with the frames before:');
for (const r of slowCtx) console.log('  ', r.map((x) => `${x[1]}ms js${x[2]} [${x[3]}]`).join(' | '));
console.log('new programs during play:', JSON.stringify(newProgs.map((p) => [p[0], p[1], p[2]])));
console.log('gc samples', JSON.stringify(gcs));
console.log('autopilot', JSON.stringify(apFinal.counts), JSON.stringify(apFinal.done), 'magnets', apFinal.magnets, 'teleports', apFinal.teleports);
console.log('events', JSON.stringify(apFinal.events));
console.log('errors', errors.length, JSON.stringify(errors.slice(0, 12)));
await browser.close(); server.close();
