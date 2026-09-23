// Scratch renderer for the hero coupe detail pass.
//   node render.mjs <cfg.json> <out.png>
// cfg: { w, h, cols, cars: { name: path }, panels: [...], checks: bool }
// panel kinds:
//   { car, open, cel, p: [x,y,z], t: [x,y,z], fov, label }             a shaded view (optionally cel-inked)
//   { diff: [carA, carB], view: 'front'|'right'|'back'|'left'|'three-quarter', openB }
//                                                                       silhouettes: red only A, green only B, yellow both
// With checks: renders every car with its pop-up pods closed, paints the parts that must stay hidden
// (meshes named pod* under popL/popR, and meshes named popRecess*) red and everything else black,
// and counts red pixels from 26 directions plus close views of the nose.
import { createRequire } from 'module';
import { createServer } from 'http';
import fs from 'fs';
const puppeteer = createRequire('C:/Users/liamk/404-game-recipe/')('puppeteer');
const cfgPath = process.argv[2], out = process.argv[3];
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const rows = Math.ceil(cfg.panels.length / (cfg.cols || 1));
const page = `<!doctype html><style>body{margin:0;background:#22262b}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js"}}</script>
<script type="module">
import * as THREE from 'three';
const cfg = await (await fetch('/cfg.json')).json();
const W = cfg.w, H = cfg.h, COLS = cfg.cols || 1, ROWS = Math.ceil(cfg.panels.length / COLS);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W * COLS, H * ROWS, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); const BG = new THREE.Color(0x22262b); scene.background = BG;
scene.add(new THREE.HemisphereLight(0xffffff, 0x556677, 2.0));
const sun = new THREE.DirectionalLight(0xffffff, 1.9); sun.position.set(5, 9, 7); scene.add(sun);
const info = { cars: {}, checks: {}, errors: [] };
const cars = {};
for (const k of Object.keys(cfg.cars)) {
  const mod = await import('/' + k + '.js');
  const car = mod.default(THREE); car.visible = false; scene.add(car); cars[k] = car;
  car.updateMatrixWorld(true);
  const bb = new THREE.Box3(), v = new THREE.Vector3(); let tris = 0, meshes = 0;
  car.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return; meshes++;
    tris += (n.geometry.index ? n.geometry.index.count : p.count) / 3;
    for (let i = 0; i < p.count; i++) bb.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const r3 = (a) => a.map((x) => +x.toFixed(4));
  const ud = car.userData;
  info.cars[k] = { tris: Math.round(tris), meshes, min: r3(bb.min.toArray()), max: r3(bb.max.toArray()),
    size: r3(bb.getSize(v).toArray()), joints: Object.keys(ud.joints || {}), popOpen: ud.popOpen, popLamp: ud.popLamp, mounts: ud.mounts,
    popParent: ud.joints && ud.joints.popL ? (ud.joints.popL.parent === car ? 'g' : ud.joints.popL.parent.name) : null };
  car.userData._bb = bb;
  const J = ud.joints || {};
  if (J.popL) {
    const lens = {};
    for (const nm of ['popL', 'popR']) for (const open of [false, true]) {
      J[nm].rotation.x = open ? ud.popOpen : 0; car.updateMatrixWorld(true);
      let m = null; J[nm].traverse((n) => { if (n.name === 'podLens') m = n; });
      const face = new THREE.Vector3(0, 0, 0.003).applyMatrix4(m.matrixWorld);
      const dir = new THREE.Vector3(0, 0, 1).transformDirection(m.matrixWorld);
      lens[nm + (open ? ' open' : ' closed')] = { face: r3(face.toArray()), dir: r3(dir.toArray()), degBelowHorizon: +(Math.asin(-dir.y) * 180 / Math.PI).toFixed(1) };
      J[nm].rotation.x = 0; car.updateMatrixWorld(true);
    }
    info.cars[k].lens = lens;
  }
}
const setOpen = (car, open) => { const j = car.userData.joints || {}, a = typeof open === 'number' ? open : open ? (car.userData.popOpen || 0) : 0;
  if (j.popL) j.popL.rotation.x = a; if (j.popR) j.popR.rotation.x = a; car.updateMatrixWorld(true); };
// ---- a cut-down copy of the game's cel pass: depth ink, luma creases, bands ----
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(W, H) });
const cel = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false,
  uniforms: { tDiffuse: { value: rt.texture }, tDepth: { value: rt.depthTexture }, uRes: { value: new THREE.Vector2(W, H) }, uNear: { value: 0.05 }, uFar: { value: 200 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: \`uniform sampler2D tDiffuse, tDepth; uniform vec2 uRes; uniform float uNear, uFar; varying vec2 vUv;
    float lin(vec2 uv){ float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear)); }
    float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    float tl(vec2 uv){ vec3 c = texture2D(tDiffuse, uv).rgb; return luma(c / (c + 1.0)); }
    void main(){
      vec2 px = 1.0 / uRes; vec3 c = texture2D(tDiffuse, vUv).rgb;
      float d0 = lin(vUv);
      float dl = lin(vUv - vec2(px.x, 0.0)), dr = lin(vUv + vec2(px.x, 0.0)), du = lin(vUv + vec2(0.0, px.y)), dd = lin(vUv - vec2(0.0, px.y));
      float rel = (abs(dl - d0) + abs(dr - d0) + abs(du - d0) + abs(dd - d0)) / d0;
      float sil = smoothstep(0.04, 0.14, rel) * (1.0 - step(uFar * 0.9, d0));
      float a = tl(vUv + vec2(-px.x, px.y)), b = tl(vUv + vec2(0.0, px.y)), cc = tl(vUv + vec2(px.x, px.y));
      float d = tl(vUv + vec2(-px.x, 0.0)), e = tl(vUv + vec2(px.x, 0.0));
      float f = tl(vUv + vec2(-px.x, -px.y)), g = tl(vUv + vec2(0.0, -px.y)), h = tl(vUv + vec2(px.x, -px.y));
      float gx = (cc + 2.0 * e + h) - (a + 2.0 * d + f), gy = (a + 2.0 * b + cc) - (f + 2.0 * g + h);
      float crease = smoothstep(0.18, 0.5, sqrt(gx * gx + gy * gy));
      vec3 tm = c / (c + 1.0); float l = luma(tm);
      float q = floor(l * 6.0 + 0.5) / 6.0; float band = mix(l, q, 0.55);
      vec3 col = c * (band + 0.006) / (l + 0.006);
      float ink = clamp(sil + crease * 0.45, 0.0, 1.0);
      col *= 1.0 - ink * 0.92;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
      #include <colorspace_fragment>
    }\` });
const qScene = new THREE.Scene(), qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
qScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), cel));
const silA = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false });
const silB = silA.clone(); silB.color.set(0x00ff00);
const verCam = (bb, view) => {
  const VIEWS = ['front', 'right', 'back', 'left'], FOV = 34;
  const dim = bb.getSize(new THREE.Vector3()), ctr = bb.getCenter(new THREE.Vector3());
  const radius = 0.5 * Math.hypot(dim.x, dim.y, dim.z), dist = (radius / Math.sin(FOV / 2 * Math.PI / 180)) * 1.05;
  const a = view === 'three-quarter' ? Math.PI / 4 : VIEWS.indexOf(view) * Math.PI / 2, elev = view === 'three-quarter' ? 0.62 : 0.43;
  const cam = new THREE.PerspectiveCamera(FOV, W / H, dist * 0.01, dist * 10);
  cam.position.set(ctr.x + Math.sin(a) * dist * Math.cos(elev), ctr.y + dist * Math.sin(elev), ctr.z + Math.cos(a) * dist * Math.cos(elev));
  cam.lookAt(ctr); return cam;
};
cfg.panels.forEach((pn, i) => {
  const col = i % COLS, row = Math.floor(i / COLS), x = col * W, y = (ROWS - 1 - row) * H;
  for (const c of Object.values(cars)) c.visible = false;
  if (pn.diff) {
    const [A, B] = pn.diff, cam = verCam(cars[A].userData._bb, pn.view || 'front');
    renderer.setRenderTarget(null); renderer.setViewport(x, y, W, H); renderer.setScissor(x, y, W, H); renderer.setScissorTest(true);
    renderer.setClearColor(0x000000, 1); renderer.clear(); scene.background = null; renderer.autoClear = false;
    setOpen(cars[A], !!pn.openA); setOpen(cars[B], !!pn.openB);
    scene.overrideMaterial = silA; cars[A].visible = true; renderer.render(scene, cam); cars[A].visible = false;
    scene.overrideMaterial = silB; cars[B].visible = true; renderer.render(scene, cam); cars[B].visible = false;
    scene.overrideMaterial = null; scene.background = BG; renderer.autoClear = true;
    { const gl = renderer.getContext(), px = new Uint8Array(W * H * 4); gl.readPixels(x, y, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let a = 0, b = 0, both = 0; for (let i = 0; i < W * H; i++) { const r = px[i * 4] > 128, gg = px[i * 4 + 1] > 128; if (r && gg) both++; else if (r) a++; else if (gg) b++; }
      (info.diffs = info.diffs || []).push({ view: pn.view, onlyA: a, onlyB: b, both }); }
    setOpen(cars[A], false); setOpen(cars[B], false);
    return;
  }
  const car = cars[pn.car]; car.visible = true; setOpen(car, typeof pn.open === 'number' ? pn.open : !!pn.open);
  // plateTex: put a test texture (text + an up arrow, as a plate image would load: flipY true) on every
  // material named 'plate', to see that the texture reads upright and unmirrored
  const swapped = [];
  if (pn.plateTex) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const cx = cv.getContext('2d');
    cx.fillStyle = '#f4f2ea'; cx.fillRect(0, 0, 512, 256); cx.strokeStyle = '#1d6b3a'; cx.lineWidth = 14; cx.strokeRect(7, 7, 498, 242);
    cx.fillStyle = '#1d6b3a'; cx.font = 'bold 120px sans-serif'; cx.fillText('AB 12', 150, 190);
    cx.beginPath(); cx.moveTo(70, 40); cx.lineTo(120, 110); cx.lineTo(20, 110); cx.closePath(); cx.fill(); cx.fillRect(55, 110, 30, 100);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const tm = new THREE.MeshBasicMaterial({ map: tex });
    car.traverse((n) => { if (n.isMesh && n.material && n.material.name === 'plate') { swapped.push([n, n.material]); n.material = tm; } });
  }
  const cam = new THREE.PerspectiveCamera(pn.fov || 35, W / H, 0.05, 200); cam.position.set(...pn.p); cam.lookAt(...pn.t);
  if (pn.cel) {
    renderer.setRenderTarget(rt); renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); renderer.clear(); renderer.render(scene, cam);
    renderer.setRenderTarget(null); renderer.setViewport(x, y, W, H); renderer.setScissor(x, y, W, H); renderer.setScissorTest(true); renderer.render(qScene, qCam);
  } else {
    renderer.setRenderTarget(null); renderer.setViewport(x, y, W, H); renderer.setScissor(x, y, W, H); renderer.setScissorTest(true); renderer.render(scene, cam);
  }
  for (const [n, m] of swapped) n.material = m;
  car.visible = false; setOpen(car, false);
});
// ---- the hidden-when-closed check ----
if (cfg.checks) {
  const S = 360, crt = new THREE.WebGLRenderTarget(S, S), buf = new Uint8Array(S * S * 4);
  const red = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide }), blk = new THREE.MeshBasicMaterial({ color: 0x000000 }), blk2 = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
  for (const [k, car] of Object.entries(cars)) {
    const j = car.userData.joints || {};
    if (!j.popL) continue;
    setOpen(car, false); car.visible = true;
    const saved = [];
    car.traverse((n) => { if (!n.isMesh) return; saved.push([n, n.material]);
      let hid = /^popRecess/.test(n.name); let p = n.parent; while (p) { if ((p === j.popL || p === j.popR) && /^pod/.test(n.name)) hid = true; p = p.parent; }
      const m0 = Array.isArray(n.material) ? n.material[0] : n.material;
      n.material = hid ? red : (m0.side === THREE.DoubleSide ? blk2 : blk); });
    const bb = car.userData._bb, ctr = bb.getCenter(new THREE.Vector3());
    const dirs = [];
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) for (const dz of [-1, 0, 1]) if (dx || dy || dz) dirs.push([dx, dy, dz]);
    const res = []; scene.background = new THREE.Color(0x000000);
    const shoot = (pos, tgt, fov, tag) => {
      const cam = new THREE.PerspectiveCamera(fov, 1, 0.02, 100); cam.position.set(...pos); cam.lookAt(...tgt);
      renderer.setRenderTarget(crt); renderer.setScissorTest(false); renderer.setViewport(0, 0, S, S); renderer.clear(); renderer.render(scene, cam);
      renderer.readRenderTargetPixels(crt, 0, 0, S, S, buf); let n = 0;
      for (let i = 0; i < S * S; i++) if (buf[i * 4] > 100 && buf[i * 4 + 1] < 60) n++;
      if (n) res.push(tag + ':' + n);
    };
    for (const d of dirs) { const L = Math.hypot(...d); shoot([ctr.x + d[0] / L * 7, ctr.y + d[1] / L * 7, ctr.z + d[2] / L * 7], ctr.toArray(), 40, 'far' + d.join(',')); }
    const nose = [0, 0.66, bb.max.z - 0.35];
    for (const [px, py, pz] of [[0, 1.2, 3.4], [1.4, 1.0, 3.0], [-1.4, 1.0, 3.0], [1.6, 0.8, 1.9], [-1.6, 0.8, 1.9], [0.45, 2.2, 1.9], [-0.45, 2.2, 1.9], [0.0, 0.7, 3.2], [1.2, 0.45, 2.8], [-1.2, 0.45, 2.8], [0.6, 1.6, 0.4], [-0.6, 1.6, 0.4]])
      shoot([px, py, pz], nose, 45, 'near' + [px, py, pz].join(','));
    for (const [n, m] of saved) n.material = m;
    scene.background = BG; car.visible = false; renderer.setRenderTarget(null);
    info.checks[k] = res.length ? res : 'hidden from all 38 views';
  }
}
window.__INFO__ = info; window.__DONE__ = true;
</script>`;
const server = createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/cfg.json') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(cfg)); }
  const k = u.replace(/^\//, '').replace(/\.js$/, '');
  if (cfg.cars[k]) { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(fs.readFileSync(cfg.cars[k], 'utf8')); }
  res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(page);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await puppeteer.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const pg = await browser.newPage();
await pg.setViewport({ width: cfg.w * (cfg.cols || 1), height: cfg.h * rows });
pg.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text().slice(0, 300)); });
await pg.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load' });
await pg.waitForFunction('window.__DONE__', { timeout: 240000 });
const info = await pg.evaluate(() => window.__INFO__);
await pg.screenshot({ path: out });
await browser.close(); server.close();
for (const [k, c] of Object.entries(info.cars)) console.log(k, JSON.stringify(c));
console.log('checks', JSON.stringify(info.checks), 'errors', JSON.stringify(info.errors));
if (info.diffs) for (const d of info.diffs) console.log('diff', JSON.stringify(d));
console.log('wrote', out);
