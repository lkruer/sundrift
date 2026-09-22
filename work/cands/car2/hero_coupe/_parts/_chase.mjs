// Render the car from the chase camera (4 m back, 1.5 m up, three-quarter rear), a dead-rear low
// view, and a side elevation under a strong top light to show creases in the paint.
import { createRequire } from 'module';
import { createServer } from 'http';
import fs from 'fs';
const puppeteer = createRequire('C:/Users/liamk/404-game-recipe/')('puppeteer');
const src = fs.readFileSync(process.argv[2], 'utf8');
const out = process.argv[3];
const html = `<!doctype html><style>body{margin:0;background:#22262b}</style><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js"}}</script>
<script type="module">
import * as THREE from 'three';
const W = 900, H = 600, N = 3;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W * N, H, false); renderer.outputColorSpace = THREE.SRGBColorSpace; document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x22262b);
scene.add(new THREE.HemisphereLight(0xffffff, 0x556677, 2.0));
const sun = new THREE.DirectionalLight(0xffffff, 1.9); sun.position.set(5, 9, 7); scene.add(sun);
const top = new THREE.DirectionalLight(0xffffff, 3.5); top.position.set(0.5, 10, 0.2); top.visible = false; scene.add(top);
const mod = await import('/car.js'); const car = mod.default(THREE); scene.add(car);
const views = [
  { p: [1.7, 1.5, -3.65], t: [0, 0.6, -0.6], fov: 40 },
  { p: [0.0, 0.9, -4.2], t: [0, 0.55, -1.0], fov: 40 },
  { p: [14, 1.6, 0], t: [0, 0.62, 0], fov: 19, topLight: true },
];
views.forEach((v, i) => {
  top.visible = !!v.topLight; sun.visible = !v.topLight;
  const cam = new THREE.PerspectiveCamera(v.fov, W / H, 0.1, 100); cam.position.set(...v.p); cam.lookAt(...v.t);
  renderer.setViewport(i * W, 0, W, H); renderer.setScissor(i * W, 0, W, H); renderer.setScissorTest(true); renderer.render(scene, cam);
});
window.__DONE__ = true;
</script>`;
const server = createServer((req, res) => { if (req.url === '/car.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end(src); } else { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); } });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await puppeteer.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage(); await page.setViewport({ width: 2700, height: 600 });
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load' });
await page.waitForFunction('window.__DONE__', { timeout: 90000 });
await page.screenshot({ path: out });
await browser.close(); server.close();
console.log('wrote', out);
