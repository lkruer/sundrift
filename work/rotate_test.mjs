// The phone turned on its side mid-run, and back: the HUD's canvas changes size, and its texture has to follow (three
// keeps a texture at the size it was made). Screenshots before and after each turn, and the GL errors counted.
//   node work/rotate_test.mjs [url]
import { createRequire } from 'module';
const require = createRequire('C:/Users/liamk/404-game-recipe/package.json');
const puppeteer = require('puppeteer');
const URL = process.argv[2] || 'http://localhost:8123/__game__/game/';
const OUT = 'C:/Users/liamk/sundrift/work/shots/rotate';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fs = await import('fs');
fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text().slice(0, 160)); });
const phone = (w, h) => page.setViewport({ width: w, height: h, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await phone(390, 844);
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction('window.__READY__ === true', { timeout: 90000 });
await page.evaluate(() => document.getElementById('startb').click());
await sleep(1500);
const hold = async (ms) => { await page.keyboard.down('KeyW'); await sleep(ms); await page.keyboard.up('KeyW'); };
const info = () => page.evaluate(() => { const h = window.__DEBUG__.hud, gl = window.__DEBUG__.renderer.getContext(); return { canvas: [h.canvas.width, h.canvas.height], W: h.W, H: h.H, glError: gl.getError() }; });
await hold(1500);
await page.screenshot({ path: OUT + '/r0_portrait.png' });
console.log('portrait', JSON.stringify(await info()));
await phone(844, 390);
await sleep(600); await hold(1500);
await page.screenshot({ path: OUT + '/r1_landscape.png' });
console.log('landscape', JSON.stringify(await info()));
await phone(390, 844);
await sleep(600); await hold(1500);
await page.screenshot({ path: OUT + '/r2_portrait_again.png' });
console.log('portrait again', JSON.stringify(await info()));
console.log('errors', errors.length ? errors.slice(0, 6) : 'none');
await browser.close();
