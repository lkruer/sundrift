/**
 * MINIDRIFT — boot, the title screen, the frame loop, pause, and the contract the harness steers by.
 *
 * window.__GAME__ is refreshed every frame: `pos` in metres (the gate drives by it), `fps` from REAL elapsed
 * time, draws and tris straight from renderer.info. The start button is #startb and it is the only way a run
 * starts; the defaults (medium course, pearl white) mean one press is all it takes.
 */
import * as THREE from 'three';
import { ASSET, bakeStatic } from '../assetlib.js?v=202609230143';
import { createRig, detectTier } from '../rig.js?v=202609230143';
import { PAL, ROAD, QUALITY, SCORE, MAX_DT, CAR_SCALE, clamp, damp, smoothstep } from './config.js?v=202609230143';
import { Car, gearbox } from './car.js?v=202609230143';
import { Track, DIFFS } from './track.js?v=202609230143';
import { World } from './world.js?v=202609230143';
import { ChaseCam } from './camera.js?v=202609230143';
import { Input } from './input.js?v=202609230143';
import { Scoring } from './scoring.js?v=202609230143';
import { Hud } from './hud.js?v=202609230143';
import { Audio } from './audio.js?v=202609230143';
import { SkidMarks, Particles, ExhaustFlame } from './fx.js?v=202609230143';
import { makePost } from './post.js?v=202609230143';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const loadEl = $('load'), barf = $('barf'), loadmsg = $('loadmsg');
const store = {
  get(k, d) { try { const v = localStorage.getItem('minidrift.' + k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('minidrift.' + k, String(v)); } catch {} },
};

const PAINTS = [
  { name: 'PEARL WHITE', hex: 0xf2f0ea }, { name: 'SILVER', hex: 0xaeb3ba }, { name: 'MIDNIGHT PURPLE', hex: 0x3b2458 },
  { name: 'BAYSIDE BLUE', hex: 0x1d4fb0 }, { name: 'SUNBURST YELLOW', hex: 0xf3c318 }, { name: 'RALLY RED', hex: 0xc11f1b },
  { name: 'MILLENNIUM JADE', hex: 0x587c68 }, { name: 'BLACK', hex: 0x121316 },
];
const SEED = 20260921;
const START_S = 8;

const G = {
  mode: 'loading', hour: 20.6, hourShown: 0, fps: 60, frameAvg: 1 / 60, s: 0, u: 0, idx: 0, dist: 0, lastS: 0, night: 0,
  diff: DIFFS[store.get('diff', 'medium')] ? store.get('diff', 'medium') : 'medium',
  paint: clamp(Number(store.get('paint', 0)) || 0, 0, PAINTS.length - 1),
  gear: null, best: {},
};
window.__GAME__ = { pos: [0, 0], fps: 0, speed: 0, score: 0, over: false, draws: 0, tris: 0 };

// ---------------------------------------------------------------- renderer
const tier = detectTier();
const Q = QUALITY[tier === 'phone' ? 'phone' : 'high'];
const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier !== 'phone', powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pixelRatio));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = Q.shadow;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 4500);
scene.add(camera);
// the camera goes in at creation, so the rig builds its shadow cascades as soon as they load, before any shader compiles
const rig = createRig(THREE, renderer, scene, { hour: G.hour, azimuth: 235, tier, fogStart: 60, fogDensity: 0.0012, exposure: 1.05, post: false, camera });
const post = makePost(renderer, scene, camera, { bloom: tier !== 'phone', fringe: tier !== 'phone', width: innerWidth, height: innerHeight });
renderer.info.autoReset = false;

let track, world, car, carRoot, bodyPivot, joints, chase, input, scoring, hud, audio, skids, particles, flame, headlights, paintMat;
const lampLights = [];
const night = { moon: null, stars: null, disc: null, dir: new THREE.Vector3(0.35, 0.6, -0.72).normalize(), amt: 0 };
// the body on its springs, and the visible wheel angles (clamped so a fast wheel never strobes)
const susp = { roll: 0, rollV: 0, pitch: 0, pitchV: 0, accL: 0, accF: 0, spinF: 0, spinR: 0 };
const prof = { on: new URLSearchParams(location.search).has('prof'), long: 0, worst: 0, parts: { sim: 0, world: 0, render: 0 }, log: [] };

// ---------------------------------------------------------------- night
function buildNight() {
  // the moon is a far spot light, not a directional one: the sun's cascaded shadows assume every shadowed
  // directional light is one of their cascades, and a second one breaks every lit shader
  const moon = new THREE.SpotLight(0x6f8fd8, 0, 0, 0.36, 0.05, 0);
  moon.castShadow = Q.shadow;
  const sm = tier === 'phone' ? 1024 : 1536;
  moon.shadow.mapSize.set(sm, sm);
  moon.shadow.camera.near = 60; moon.shadow.camera.far = 160;
  moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.04;
  scene.add(moon); scene.add(moon.target);
  night.moon = moon;
  const N = tier === 'phone' ? 900 : 1600;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.asin(Math.random() * 0.95 + 0.04);
    pos[i * 3] = Math.cos(e) * Math.sin(a) * 2600; pos[i * 3 + 1] = Math.sin(e) * 2600; pos[i * 3 + 2] = Math.cos(e) * Math.cos(a) * 2600;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  stars.frustumCulled = false; stars.renderOrder = -1;
  scene.add(stars); night.stars = stars;
  const disc = new THREE.Group();
  const dm = new THREE.Mesh(new THREE.CircleGeometry(38, 24), new THREE.MeshBasicMaterial({ color: 0xfff4dc, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  const halo = new THREE.Mesh(new THREE.CircleGeometry(120, 24), new THREE.MeshBasicMaterial({ color: 0x9fb4e0, transparent: true, opacity: 0, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.z = -1;
  disc.add(halo, dm); disc.userData = { dm, halo };
  scene.add(disc); night.disc = disc;
  // a showroom key for the title screen, so the car is lit before the first lamp
  const hero = new THREE.SpotLight(0xffd9a0, 0, 26, 0.7, 0.6, 1.2);
  scene.add(hero); scene.add(hero.target); night.hero = hero;
  // horizon glow: warm at the horizon fading into the blue, the retro night sky
  const H = 420, R = 2300, seg = 48;
  const gpos = new Float32Array((seg + 1) * 2 * 3), gcol = new Float32Array((seg + 1) * 2 * 4), gidx = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2, x = Math.sin(a) * R, z = Math.cos(a) * R;
    gpos.set([x, -40, z, x, H, z], i * 6);
    gcol.set([0.95, 0.45, 0.35, 0.6, 0.35, 0.25, 0.55, 0.0], i * 8);
    if (i < seg) { const b0 = i * 2; gidx.push(b0, b0 + 2, b0 + 1, b0 + 1, b0 + 2, b0 + 3); }
  }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.BufferAttribute(gpos, 3)); gg.setAttribute('color', new THREE.BufferAttribute(gcol, 4)); gg.setIndex(gidx);
  const glow = new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.frustumCulled = false; glow.renderOrder = -1;
  scene.add(glow); night.glow = glow;
  night.hemiDay = rig.hemi ? rig.hemi.intensity : 1;
  for (let i = 0; i < (tier === 'phone' ? 3 : 5); i++) {
    const pl = new THREE.PointLight(0xffa040, 0, 26, 2.0);
    scene.add(pl); lampLights.push(pl);
  }
}

// ---------------------------------------------------------------- boot
async function boot() {
  const tb = performance.now(); window.__BOOT__ = [];
  const prog = (f, msg) => { barf.style.width = (f * 100).toFixed(0) + '%'; if (msg) loadmsg.textContent = msg; window.__BOOT__.push([msg, Math.round(performance.now() - tb)]); };
  prog(0.02, 'laying the road');
  for (const k of Object.keys(DIFFS)) G.best[k] = Number(store.get('best.' + k, 0)) || 0;
  track = new Track(SEED, G.diff);
  track.ensure(2400);
  world = new World(scene, Q);
  await world.load((f, k) => prog(0.05 + f * 0.55, k.replace('_', ' ')));
  world.setTrack(track);
  prog(0.62, 'the car');
  await buildCar();
  buildNight();
  car = new Car();
  const start = track.sample(START_S);
  car.reset(start.x, start.z, start.h);
  G.idx = track.index(START_S); G.s = START_S; G.lastS = START_S;
  prog(0.7, 'the mountain');
  await nextFrame();
  world.prime(start.x, start.z, START_S);
  prog(0.9, 'the lights');
  chase = new ChaseCam(camera);
  chase.snap(car, start.y);
  input = new Input();
  scoring = new Scoring();
  hud = new Hud();
  audio = new Audio();
  skids = new SkidMarks(scene, Q.skid);
  particles = new Particles(scene, Q.smoke);
  particles.setScale(innerHeight);
  placeCar(start.y, 0, 0);
  applySun(10, true);
  // the rig loads its cascaded shadows on its own; they re-patch every material, so compile after, not before
  try { await rig.ready; } catch {}
  applySun(0, true);
  rig.refresh(scene);
  prog(0.93, 'the shaders');
  // one real frame while hidden, with every prop in view and every shadow map drawn: shadow and post programs
  // compile here, not in the first seconds of play
  // things that are only drawn later (skid marks, the boost flame) are drawn once here too: the first draw of
  // a mesh is when the GPU driver finishes its shader, and that was a 100 ms stall at the first drift
  const warmRender = () => {
    idle(0.016); rig.update(camera, 0.016);
    if (rig.csm) for (const l of rig.csm.lights) l.shadow.needsUpdate = true;
    for (const t of skids.tracks) t.geo.setDrawRange(0, 6);
    flame.cones.visible = true;
    post.render(0.016);
    for (const t of skids.tracks) t.geo.setDrawRange(0, 0);
    flame.cones.visible = false;
  };
  const [fx0, fz0] = car.forward();
  await world.precompile(renderer, camera, (root) => rig.refresh(root), post.sceneRT, { x: car.x + fx0 * 6, y: start.y, z: car.z + fz0 * 6, render: warmRender });
  warmRender();
  window.__DEBUG__ = { world, get track() { return track; }, car, rig, scene, renderer, G, chase, audio, post, get scoring() { return scoring; }, prof,
    teleport(s, kmh = 0) {
      const p = track.sample(s);
      car.reset(p.x, p.z, p.h); car.vF = kmh / 3.6;
      G.idx = track.index(s); G.s = s; G.lastS = s;
      world.prime(p.x, p.z, s); chase.snap(car, p.y); placeCar(p.y, 0, 0);
      return p;
    } };
  input.onAny = () => audio.unlock();
  input.onPause = () => { if (G.mode === 'playing') setPaused(true); else if (G.mode === 'paused') setPaused(false); };
  input.onMute = () => toggleMute();
  buildTitle();
  prog(0.99, 'title');
  // the start button must be on screen the moment __READY__ is true: the harness presses it straight away
  loadEl.style.display = 'none'; showTitle();
  window.__START__ = startGame;
  $('startb').addEventListener('click', startGame);
  $('startb').addEventListener('touchend', (e) => { e.preventDefault(); startGame(); }, { passive: false });
  $('mute').addEventListener('click', toggleMute);
  $('mute').classList.toggle('off', audio.muted);
  $('pauseb').addEventListener('click', () => setPaused(G.mode === 'playing'));
  $('resumeb').addEventListener('click', () => setPaused(false));
  $('restartb').addEventListener('click', () => { restartRun(); setPaused(false); });
  $('quitb').addEventListener('click', quitToTitle);
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'playing') setPaused(true); });
  window.__READY__ = true;
  prog(1, 'ready');
}

// a frame, or a moment if the tab is hidden (a hidden tab never runs requestAnimationFrame, and the boot must not wait on it)
const nextFrame = () => new Promise((r) => { let done = false; const f = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(f); setTimeout(f, 60); });

function toggleMute() { audio.unlock(); audio.setMuted(!audio.muted); $('mute').classList.toggle('off', audio.muted); }

async function buildCar() {
  const obj = await ASSET('./assets/hero_coupe.js', { keepHierarchy: true });
  joints = obj.userData.joints || {};
  const upgraded = new Map();
  const upgrade = (m) => {
    if (!m || !m.color) return m;
    if (upgraded.has(m)) return upgraded.get(m);
    let out = m;
    if (m.emissive && m.emissiveIntensity > 0 && m.emissive.getHex() !== 0) {
      // the lamps glow: tail lights and headlight lenses; the plate and the reflectors only catch light
      const hex = m.emissive.getHex();
      out = m.clone();
      out.emissiveIntensity = hex === PAL.tailRed && m.emissiveIntensity > 1 ? 2.4 : hex === 0xfff1d6 ? 2.4 : m.emissiveIntensity * 0.35;
      upgraded.set(m, out); return out;
    }
    if (m.name === 'paint' || m.color.getHex() === PAL.pearl) {
      if (!paintMat) { paintMat = new THREE.MeshPhysicalMaterial({ color: m.color, roughness: 0.22, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.2 }); paintMat.name = 'paint'; }
      out = paintMat;
    } else if (m.name === 'glass' || m.color.getHex() === PAL.glass) {
      out = new THREE.MeshPhysicalMaterial({ color: m.color, roughness: 0.08, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2, transparent: true, opacity: 0.5 });
      out.name = 'glass';
    }
    upgraded.set(m, out);
    return out;
  };
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(upgrade) : upgrade(o.material);
    o.castShadow = true; o.receiveShadow = true;
  });
  setPaint(G.paint);
  // bake the still parts per joint: the body into one mesh per material, each wheel into its own few in its own
  // frame, so the pivots keep working and the car is a few dozen draws, not four hundred
  obj.updateMatrixWorld(true);
  const bakeInto = (node, parent) => {
    const baked = bakeStatic(node);
    const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
    baked.traverse((o) => { if (o.isMesh) { o.geometry.applyMatrix4(inv); o.castShadow = true; o.receiveShadow = true; } });
    return baked;
  };
  // the body hangs on a pivot at about axle height, so it can roll and pitch on its springs while the wheels stay down
  bodyPivot = new THREE.Group(); bodyPivot.position.set(0, 0.5, 0); bodyPivot.name = 'bodyPivot';
  const bodyNode = obj.getObjectByName('body');
  if (bodyNode) {
    const baked = bakeInto(bodyNode, obj);
    bodyNode.parent.remove(bodyNode);
    baked.position.set(0, -0.5, 0);
    bodyPivot.add(baked);
  }
  obj.add(bodyPivot);
  for (const key of ['wheelFL', 'wheelFR', 'wheelRL', 'wheelRR']) {
    const w = joints[key]; if (!w) continue;
    const baked = bakeInto(w, w);
    for (const c of [...w.children]) w.remove(c);
    for (const c of [...baked.children]) w.add(c);
  }
  obj.scale.setScalar(CAR_SCALE);
  carRoot = new THREE.Group(); carRoot.name = 'car';
  carRoot.add(obj);
  obj.updateMatrixWorld(true);
  scene.add(carRoot);
  flame = new ExhaustFlame(bodyPivot);
  flame.set(0.375, 0.253 - 0.5, -2.01);
  // headlights: soft-edged, wide, aimed down the road; no fake beams (they read as cones)
  headlights = [];
  for (const x of [-0.6, 0.6]) {
    // no distance falloff (decay 0): a low light with the usual falloff burns a white blob onto the road at the
    // bumper and leaves the road ahead dark; this throws an even, soft-edged pool down the road instead
    const sp = new THREE.SpotLight(0xf3f6ff, 0, 58, 0.5, 0.8, 0);
    sp.position.set(x, 0.72 - 0.5, 2.0);
    sp.target.position.set(x * 2.2, -1.0, 40);
    bodyPivot.add(sp); bodyPivot.add(sp.target);
    headlights.push(sp);
  }
  // no light of the car's own besides its lamps: an unshadowed light inside the car shines straight through it
  // (a white spill light lit the road behind the car and put a hot spot on the boot lid)
  const tailGlow = new THREE.PointLight(0xff3020, 0, 4.0, 1.5);
  tailGlow.position.set(0, 0.35, -3.1);
  bodyPivot.add(tailGlow); night.tailGlow = tailGlow;
}

function setPaint(i) {
  G.paint = i; store.set('paint', i);
  if (paintMat) {
    paintMat.color.setHex(PAINTS[i].hex);
    // dark paints need a brighter coat to read at night
    paintMat.envMapIntensity = PAINTS[i].hex === 0x121316 || PAINTS[i].hex === 0x3b2458 ? 1.8 : 1.2;
  }
  const n = $('paintname'); if (n) n.textContent = PAINTS[i].name;
  document.querySelectorAll('.sw').forEach((s, k) => s.classList.toggle('sel', k === i));
}

// ---------------------------------------------------------------- title, course, pause
function buildTitle() {
  const sw = $('swatches');
  PAINTS.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'sw'; b.title = p.name; b.style.background = '#' + p.hex.toString(16).padStart(6, '0');
    b.addEventListener('click', () => setPaint(i));
    sw.appendChild(b);
  });
  setPaint(G.paint);
  document.querySelectorAll('.diff').forEach((b) => b.addEventListener('click', () => setCourse(b.dataset.d)));
  markDiff();
  refreshBests();
  document.body.classList.toggle('touch', input.touchMode);
}

function markDiff() { document.querySelectorAll('.diff').forEach((b) => b.classList.toggle('sel', b.dataset.d === G.diff)); }
function refreshBests() { for (const k of Object.keys(DIFFS)) { const e = $('best-' + k); if (e) e.textContent = G.best[k] > 0 ? 'BEST ' + Math.round(G.best[k]).toLocaleString('en-US') : 'BEST —'; } }

let building = false;
async function setCourse(diff) {
  if (building || !DIFFS[diff] || G.mode !== 'title') return;
  if (diff === G.diff) return;
  building = true;
  G.diff = diff; store.set('diff', diff); markDiff();
  $('building').classList.add('on');
  await nextFrame(); await nextFrame();
  track = new Track(SEED, diff);
  track.ensure(2400);
  world.setTrack(track);
  skids.clear && skids.clear();
  resetCarToStart();
  world.prime(car.x, car.z, START_S);
  rig.refresh(scene);
  $('building').classList.remove('on');
  building = false;
}

function resetCarToStart() {
  const p = track.sample(START_S);
  car.reset(p.x, p.z, p.h);
  G.idx = track.index(START_S); G.s = START_S; G.lastS = START_S; G.dist = 0; G.u = 0;
  susp.roll = susp.rollV = susp.pitch = susp.pitchV = susp.accL = susp.accF = 0;
  chase.snap(car, p.y);
  placeCar(p.y, 0, 0);
}

function showTitle() {
  G.mode = 'title';
  $('title').classList.add('on');
  hud.show(false);
  if (!G.hudWarmed) { G.hudWarmed = true; hud.warm(true); setTimeout(() => { if (G.mode === 'title') hud.warm(false); }, 700); }
  document.body.classList.remove('playing');
}

function startGame() {
  if (G.mode !== 'title' || building) return;
  $('title').classList.remove('on');
  document.body.classList.add('playing');
  if (night.hero) night.hero.intensity = 0;
  hud.warm(false);
  scoring.reset(); hud.reset();
  G.hour = 20.6; G.dist = 0; G.newBest = false; G.runBest = G.best[G.diff] || 0;
  G.playT = 0; G.longFrames = 0; G.worstFrame = 0;
  const p = track.sample(G.s || START_S);
  chase.snap(car, p.y);
  hud.show(true);
  audio.unlock();
  G.mode = 'playing';
  hud.toast(DIFFS[G.diff].label + ' PASS', 'good', true);
}

function setPaused(on) {
  if (on && G.mode === 'playing') {
    G.mode = 'paused';
    $('pause').classList.add('on');
    const st = scoring.stats;
    $('pstats').textContent = `${DIFFS[G.diff].label}   SCORE ${Math.round(scoring.total).toLocaleString('en-US')}   ${(G.dist / 1609.344).toFixed(1)} MI   ${st.drifts} DRIFTS`;
    audio.pause && audio.pause(true);
  } else if (!on && G.mode === 'paused') {
    $('pause').classList.remove('on');
    G.mode = 'playing';
    last = performance.now();
    audio.pause && audio.pause(false);
  }
}

function saveBest() {
  const b = G.best[G.diff] || 0;
  if (scoring.total > b) { G.best[G.diff] = scoring.total; store.set('best.' + G.diff, Math.round(scoring.total)); }
  refreshBests();
}

function restartRun() {
  saveBest();
  scoring.reset(); hud.reset();
  G.hour = 20.6; G.newBest = false; G.runBest = G.best[G.diff] || 0;
  resetCarToStart();
  world.prime(car.x, car.z, START_S);
  hud.toast('NEW RUN', '', false);
}

function quitToTitle() {
  saveBest();
  $('pause').classList.remove('on');
  audio.pause && audio.pause(false);
  scoring.reset(); hud.reset();
  resetCarToStart();
  world.prime(car.x, car.z, START_S);
  showTitle();
}

// ---------------------------------------------------------------- frame
let last = performance.now();
// car-space (left, forward) points on the drawn car: collision corners, wheels for skids, the exhaust
const K = CAR_SCALE;
const CORNERS = [[0.97 * K, 2.08 * K], [-0.97 * K, 2.08 * K], [0.97 * K, -2.12 * K], [-0.97 * K, -2.12 * K]];
const REAR = [[0.75 * K, -1.32 * K], [-0.75 * K, -1.32 * K]], FRONT = [[0.75 * K, 1.18 * K], [-0.75 * K, 1.18 * K]];
const EXHAUST = [0.375 * K, -2.03 * K, 0.253 * K];
const WHEEL_R = 0.32 * K;
const sunColor = new THREE.Color(1, 0.9, 0.8);
let perfLine = '';

function frame(now) {
  requestAnimationFrame(frame);
  const real = Math.max(1e-4, (now - last) / 1000);
  last = now;
  G.frameAvg = G.frameAvg * 0.9 + real * 0.1;
  G.fps = Math.round(1 / G.frameAvg);
  const dt = Math.min(real, MAX_DT);
  const t0 = performance.now();
  // nothing is drawn while loading: a frame drawn mid-boot compiles its shaders synchronously, on the spot
  if (G.mode === 'loading') return;

  if (G.mode === 'playing') step(dt, t0);
  else if (G.mode === 'title') idle(dt, t0);
  else if (G.mode === 'paused') { if (world && car) world.update(car.x, car.z, G.s, t0 + 2); }

  // a debug camera for inspecting the world from anywhere (set window.__CAM__ = { pos: [x,y,z], look: [x,y,z], fov })
  if (window.__CAM__) { const c = window.__CAM__; camera.position.set(...c.pos); camera.up.set(0, 1, 0); camera.lookAt(...c.look); if (c.fov && camera.fov !== c.fov) { camera.fov = c.fov; camera.updateProjectionMatrix(); } }
  const t1 = performance.now();
  renderer.info.reset();
  rig.update(camera, dt);
  post.cel.uniforms.uSpeed.value = car && G.mode === 'playing' ? clamp((car.speed - 8) / 32, 0, 1) * (1 + 0.6 * clamp(car.boost / 1.2, 0, 1)) : 0;
  post.cel.uniforms.uVig.value = hud && G.mode === 'playing' ? hud.vignette : 0;
  post.cel.uniforms.uHit.value = hud && G.mode === 'playing' ? hud.hitFlash : 0;
  post.render(dt);
  const t2 = performance.now();
  G.renderMs = damp(G.renderMs || 4, t2 - t1, 6, dt);

  const g = window.__GAME__;
  g.pos[0] = car ? car.x : 0; g.pos[1] = car ? car.z : 0;
  g.fps = G.fps; g.speed = car ? Math.round(car.speed * 10) / 10 : 0; g.score = scoring ? scoring.total : 0; g.over = false;
  g.draws = renderer.info.render.calls; g.tris = renderer.info.render.triangles;
  if (car && track && scoring) {
    g.drift = scoring.active ? 1 + scoring.tier : 0; g.combo = scoring.chain; g.slip = Math.round(car.beta * 180 / Math.PI); g.heading = car.yaw;
    g.progress = Math.round(G.s); g.lat = Math.round(G.u * 100) / 100; g.roadHeading = G.roadH ?? track.pts[G.idx].h;
    g.curvAhead = Math.round(track.sample(G.s + 22).k * 1000) / 1000; g.walls = [track.pts[G.idx].wl, track.pts[G.idx].wr];
    g.kmh = Math.round(car.kmh); g.boost = Math.round(car.boost * 10) / 10; g.hour = Math.round(G.hour * 100) / 100; g.mode = G.mode; g.diff = G.diff;
  }
  if (prof.on) {
    const ms = real * 1000;
    prof.parts.sim = damp(prof.parts.sim, G.simMs || 0, 4, dt); prof.parts.world = damp(prof.parts.world, G.worldMs || 0, 4, dt); prof.parts.render = damp(prof.parts.render, t2 - t1, 4, dt);
    if (ms > 28 && G.mode === 'playing') { prof.long++; prof.log.push({ at: Math.round(G.s), ms: Math.round(ms), sim: +(G.simMs || 0).toFixed(1), world: +(G.worldMs || 0).toFixed(1), render: +(t2 - t1).toFixed(1) }); if (prof.log.length > 40) prof.log.shift(); }
    prof.worst = Math.max(prof.worst * 0.999, ms);
  }
  if (window.__ONFRAME__) window.__ONFRAME__(dt, real);
  // every run keeps count of its slow frames, for the gate (the first second of a run is the start itself)
  if (G.mode === 'playing') {
    G.playT = (G.playT || 0) + real;
    const shot = window.__SHOT__ && Math.abs(now - window.__SHOT__) < 2000;   // the test harness was taking a screenshot
    if (G.playT > 1.2 && !shot) {
      if (real > 0.034) { G.longFrames = (G.longFrames || 0) + 1; (G.slowLog = G.slowLog || []).push([Math.round(G.playT * 10) / 10, Math.round(G.s), Math.round(real * 1000), +(G.simMs || 0).toFixed(1), +(G.worldMs || 0).toFixed(1), +(G.renderMs || 0).toFixed(1)]); if (G.slowLog.length > 30) G.slowLog.shift(); }
      G.worstFrame = Math.max(G.worstFrame || 0, real * 1000);
    }
    g.longFrames = G.longFrames || 0; g.worstFrame = Math.round(G.worstFrame || 0); g.slowLog = G.slowLog || [];
  }
  if (hud && (hud.perfOn || prof.on)) {
    perfLine = `${G.fps} fps  ${g.draws} draws  ${(g.tris / 1000).toFixed(0)}k tris  ${tier}\n` +
      `sim ${prof.parts.sim.toFixed(1)}  world ${prof.parts.world.toFixed(1)}  render ${prof.parts.render.toFixed(1)} ms\n` +
      `long frames ${prof.long}  chunks ${world ? world.stats.chunks : 0}/${world ? world.stats.near : 0}  tiles ${world && world.terrain ? world.terrain.tiles.size : 0}`;
  }
}

// the title: the camera circles the car slowly, low and close, the hero shot
let orbitT = 0.6;
function idle(dt, t0 = performance.now()) {
  if (!car) return;
  const n = track.nearest(car.x, car.z, G.idx);
  const y = n.y;
  orbitT += dt * 0.14;
  const portrait = innerWidth <= 720;
  const a = car.yaw + Math.PI + 0.5 + Math.sin(orbitT) * 1.0;
  const d = portrait ? 7.4 : 5.0;
  camera.position.set(car.x + Math.sin(a) * d, y + (portrait ? 2.3 : 1.15) + 0.2 * Math.cos(orbitT * 0.7), car.z + Math.cos(a) * d);
  camera.up.set(0, 1, 0);
  // portrait: the menu fills the lower half, so the car sits in the upper third
  camera.lookAt(car.x, y + (portrait ? -0.9 : 0.5), car.z);
  // the car sits right of centre, clear of the menu: pan the camera sideways along its own right axis
  if (innerWidth > 720) {
    const k = clamp((1400 - innerWidth) / 700, 0, 1) * 1.1 + 1.0;
    camera.updateMatrixWorld();
    const rx = camera.matrixWorld.elements[0], rz = camera.matrixWorld.elements[2];
    camera.position.x -= rx * k; camera.position.z -= rz * k;
  }
  if (night.hero) {
    night.hero.intensity = 150;
    night.hero.position.set(car.x - Math.sin(car.yaw + 0.6) * 6, y + 6, car.z - Math.cos(car.yaw + 0.6) * 6);
    night.hero.target.position.set(car.x, y + 0.6, car.z); night.hero.target.updateMatrixWorld();
  }
  const fov = portrait ? 62 : 44;
  if (Math.abs(camera.fov - fov) > 0.1) { camera.fov = fov; camera.updateProjectionMatrix(); }
  placeCar(y, 0, dt);
  world.update(car.x, car.z, G.s, t0 + 4);
  world.updateFar(camera.position.x, y, camera.position.z);
  nightFollow();
  lampsFollow();
  applySun(dt);
}

function step(dt, t0) {
  const inp = input.sample(dt);
  // ---- where on the road are we
  const n = track.nearest(car.x, car.z, G.idx);
  G.idx = n.i; G.s = n.s; G.u = n.u; G.roadH = n.h;
  const au = Math.abs(n.u);
  // grip: full on the asphalt and its edge line, most of it on the gravel shoulder, which is there to be used
  const w = n.u >= 0 ? n.wl : n.wr;
  const surface = au < track.half + 0.35 ? 1 : au < w + 0.1 ? 0.88 : 0.65;
  inp.line = { curv: track.sample(G.s + 12 + car.speed * 0.55).k };
  car.step(dt, inp, surface);

  // ---- walls: the corridor's edges on each side, the tunnel lining
  let impact = 0, clipping = false, noseIn = false;
  for (const [l, f] of CORNERS) {
    const [cx, cz] = car.point(l, f);
    const q = track.nearest(cx, cz, G.idx);
    const lx = Math.cos(q.h), lz = -Math.sin(q.h);
    if (q.u > q.wl) { impact = Math.max(impact, car.hitWall(-lx, -lz, q.u - q.wl, l, f)); if (f > 0) noseIn = true; }
    else if (q.u < -q.wr) { impact = Math.max(impact, car.hitWall(lx, lz, -q.wr - q.u, l, f)); if (f > 0) noseIn = true; }
    else if (f < 0) {
      const gap = Math.min(q.wl - q.u, q.u + q.wr);
      if (gap < SCORE.clipDist && Math.abs(car.beta) > SCORE.minSlip) clipping = true;
    }
  }
  // scrape free: nose against the wall, nearly stopped, still on the throttle: the car pivots back toward the road
  // rather than sitting there until the player thinks to reverse
  G.pinned = noseIn && car.speed < 3 && inp.throttle > 0.5 ? (G.pinned || 0) + dt : 0;
  if (G.pinned > 0.3) {
    let e = G.roadH - car.yaw; while (e > Math.PI) e -= 2 * Math.PI; while (e < -Math.PI) e += 2 * Math.PI;
    if (Math.abs(e) > Math.PI * 0.75) e = Math.sign(e) * Math.PI * 0.75;           // facing backwards: turn the short way to the wall's side
    car.yaw += clamp(e * 2.2, -1.4, 1.4) * dt * smoothstep(0.3, 0.6, G.pinned);
    car.omega = 0;
  }
  if (impact > 1.5) {
    chase.kick(clamp(impact / 10, 0.15, 1));
    const side = G.u > 0 ? 1 : -1;
    const [px, pz] = car.point(side * 0.7, impact > 4 ? 0 : 1.2);
    particles.sparks(px, n.y + 0.3, pz, -Math.cos(n.h) * side, Math.sin(n.h) * side, impact > 5 ? 22 : 8);
    if (impact > 2.5 && impact <= SCORE.crashSpeed) audio.impact(impact);
  }

  // ---- scoring and boost
  scoring.update(dt, car, impact, clipping);
  const grant = scoring.takeBoost();
  if (grant > 0) { car.boost = Math.min(SCORE.boostMax, car.boost + grant); chase.kick(0.12); }
  // a clean J-turn scores, and says so
  if (car.jturnDone) {
    car.jturnDone = false;
    scoring.total += 500;
    const e = { type: 'jturn', value: 500 };
    hud.onEvent(e); audio.onEvent && audio.onEvent(e); chase.kick(0.15);
  }
  for (const e of scoring.drain()) {
    hud.onEvent(e); audio.onEvent(e);
    if (e.type === 'bank') { G.hour += e.value / 6000; if (scoring.total > (G.best[G.diff] || 0)) { G.best[G.diff] = scoring.total; store.set('best.' + G.diff, Math.round(scoring.total)); } }
    if (e.type === 'crash') chase.kick(0.9);
  }
  if (!G.newBest && G.runBest > 0 && scoring.total > G.runBest) { G.newBest = true; hud.onEvent({ type: 'best' }); }
  const boost01 = clamp(car.boost / 1.2, 0, 1);

  // ---- distance, time of day
  const ds = Math.max(0, G.s - G.lastS); G.lastS = G.s;
  if (ds < 50) { G.dist += ds; scoring.stats.distance = G.dist; }
  const h = G.hour;
  const rate = (h >= 7.2 && h < 16.6) ? 7 : 1;
  G.hour += ds / 3000 * rate;
  if (G.hour >= 24) G.hour -= 24;
  const crossed = (edge) => h < edge && G.hour >= edge;
  if (crossed(18.05)) { const e = { type: 'sun', value: 'SUNSET' }; hud.onEvent(e); audio.onEvent(e); }
  if (crossed(5.95)) { const e = { type: 'sun', value: 'SUNRISE' }; hud.onEvent(e); audio.onEvent(e); }
  applySun(dt);

  // ---- car placement, fx, audio
  const n2 = track.nearest(car.x, car.z, G.idx);
  const y = n2.y;
  const ahead = track.sample(G.s + 1.2).y, behind = track.sample(Math.max(0, G.s - 1.2)).y;
  placeCar(y, (ahead - behind) / 2.4, dt);
  effects(dt, y, boost01);
  const gb = gearbox(car.vF, car.throttle, G.gear);
  G.gear = gb;
  audio.update(dt, car, gb.rpm, scoring.active, boost01, surface);
  const inTun = !!track.inTunnel(G.s);
  if (audio.setTunnel) audio.setTunnel(inTun ? 1 : 0);
  // in a tunnel the sodium lamps are the light: the headlights drop back so the bore stays orange
  G.tunnelK = damp(G.tunnelK || 0, inTun || track.nearTunnel(G.s + 25, 0) ? 1 : 0, 3, dt);
  for (const hl of headlights) hl.intensity = 2.6 * G.night * (1 - 0.6 * G.tunnelK);
  const t1 = performance.now();

  // ---- camera, world
  chase.update(dt, car, y, camGround, boost01, input.zoom, susp.accL);
  nightFollow();
  // the world builds in the time the frame has spare: less after a slow frame, so a hitch never compounds
  const spare = clamp(13.5 - (performance.now() - t0) - G.renderMs, 0.8, tier === 'phone' ? 3.5 : 4.5);
  world.update(car.x, car.z, G.s, performance.now() + spare);
  world.updateFar(camera.position.x, y, camera.position.z);
  lampsFollow();
  hud.update(dt, scoring, car, gb, G.hour, G.dist, car.boost, SCORE.boostMax, perfLine);
  G.simMs = t1 - t0; G.worldMs = performance.now() - t1;
}

// the ground the camera keeps clear of: in a tunnel that is the road, not the hill over it
const camProbe = {};
function camGround(x, z) { const s = world.ground.sample(x, z, 2.2, camProbe); return s.tunnel ? -1e9 : s.h; }

function nightFollow() {
  if (!night.moon) return;
  if (night.stars) night.stars.position.copy(camera.position);
  if (night.glow) night.glow.position.set(camera.position.x, camera.position.y - 60, camera.position.z);
  if (night.disc) {
    night.disc.position.copy(camera.position).addScaledVector(night.dir, 2400);
    night.disc.lookAt(camera.position);
  }
  // the moon key sits over the car; snapped to texels so the shadow edges do not crawl
  const texel = 60 / (tier === 'phone' ? 1024 : 1536);
  const sx = Math.round(car.x / texel) * texel, sz = Math.round(car.z / texel) * texel;
  const m = night.moon;
  m.position.set(sx + night.dir.x * 100, carRoot.position.y + night.dir.y * 100, sz + night.dir.z * 100);
  m.target.position.set(sx, carRoot.position.y, sz);
  m.target.updateMatrixWorld();
}

let sunTimer = 0;
function applySun(dt, force = false) {
  sunTimer += dt;
  const moved = Math.abs(G.hour - G.hourShown);
  const elOf = (h) => Math.max(-12, 62 * Math.sin(Math.PI * (h - 6) / 12));
  if (!force) {
    if (elOf(G.hour) <= -12 && elOf(G.hourShown) <= -12 && G.sunApplied) return;
    if (sunTimer < 3 && moved < 0.15) return;
    if (moved < 0.006) return;
  }
  sunTimer = 0; G.hourShown = G.hour; G.sunApplied = true;
  const t = rig.setTime({ hour: G.hour });
  const el = t.elevation;
  const nightAmt = smoothstep(4, -3, el);
  G.night = nightAmt; night.amt = nightAmt;
  for (const hl of headlights) hl.intensity = 2.6 * nightAmt;
  if (night.moon) night.moon.intensity = 0.85 * nightAmt;
  if (night.glow) night.glow.material.opacity = 0.42 * smoothstep(-0.5, -5, el);
  if (night.tailGlow) night.tailGlow.intensity = 0.9 * nightAmt;
  if (rig.hemi && night.hemiDay) rig.hemi.intensity = night.hemiDay * (1 - 0.66 * nightAmt);
  if (night.stars) night.stars.material.opacity = 0.9 * smoothstep(-1, -6, el);
  if (night.disc) { night.disc.userData.dm.material.opacity = smoothstep(-1, -5, el); night.disc.userData.halo.material.opacity = 0.35 * smoothstep(-1, -5, el); }
  world.setNight(nightAmt);
  sunColor.copy(rig.sun.color).lerp(new THREE.Color(0.55, 0.65, 0.95), nightAmt);
}

/**
 * The car on the road: yaw and the road's grade on the root, the body rolling and pitching on springs driven
 * by the car's accelerations, low-passed first, so a tyre's buzz never reaches the screen.
 */
function placeCar(y, grade, dt) {
  carRoot.position.set(car.x, y, car.z);
  carRoot.rotation.set(0, car.yaw, 0);
  carRoot.rotateX(-Math.atan(grade));
  if (dt > 0) {
    susp.accL = damp(susp.accL, clamp(car.accL, -14, 14), 9, dt);
    susp.accF = damp(susp.accF, clamp(car.accF, -12, 12), 7, dt);
    const spring = (x, v, target, k, c) => {
      let rem = dt;
      while (rem > 1e-6) { const hh = Math.min(rem, 1 / 120); rem -= hh; v += (k * (target - x) - c * v) * hh; x += v * hh; }
      return [x, v];
    };
    [susp.roll, susp.rollV] = spring(susp.roll, susp.rollV, susp.accL * 0.0075, 110, 14);
    [susp.pitch, susp.pitchV] = spring(susp.pitch, susp.pitchV, -susp.accF * 0.0042, 130, 16);
    // wheels: turn at the road speed, but never more than half a spoke a frame, so they blur instead of strobing
    const maxStep = 0.55;
    susp.spinF += clamp(car.vF * dt / WHEEL_R, -maxStep, maxStep);
    const rearRate = car.hand > 0.5 ? car.vF * 0.15 : car.vF * (1 + car.slipRear * 0.8 * car.throttle);
    susp.spinR += clamp(rearRate * dt / WHEEL_R, -maxStep, maxStep);
  }
  bodyPivot.rotation.set(susp.pitch, 0, susp.roll);
  if (joints.hubFL) joints.hubFL.rotation.y = car.steer;
  if (joints.hubFR) joints.hubFR.rotation.y = car.steer;
  if (joints.wheelFL) joints.wheelFL.rotation.x = susp.spinF;
  if (joints.wheelFR) joints.wheelFR.rotation.x = susp.spinF;
  if (joints.wheelRL) joints.wheelRL.rotation.x = susp.spinR;
  if (joints.wheelRR) joints.wheelRR.rotation.x = susp.spinR;
}

function effects(dt, y, boost01) {
  const slip = car.slipRear;
  const onRoad = car.surface > 0.9;
  const [lx, lz] = car.left();
  const [fx, fz] = car.forward();
  const vx = fx * car.vF + lx * car.vL, vz = fz * car.vF + lz * car.vL;
  REAR.forEach(([l, f], i) => {
    const [wx, wz] = car.point(l, f);
    const a = onRoad ? clamp(slip * 1.2 + (car.hand ? 0.5 : 0) * clamp(car.speed / 8, 0, 1), 0, 1) : 0;
    skids.add(i, wx, y + 0.02, wz, lx, lz, a, 0.19);
    if (a > 0.25 && car.speed > 6 && Math.random() < a * 0.9) particles.smoke(wx, y, wz, vx, vz, a, sunColor);
    if (!onRoad && car.speed > 4 && Math.random() < 0.45) particles.dust(wx, y, wz, vx, vz, clamp(car.speed / 20, 0, 1), sunColor);
  });
  FRONT.forEach(([l, f], i) => {
    const [wx, wz] = car.point(l, f);
    const a = onRoad && car.hand ? clamp(car.speed / 10, 0, 0.8) : (onRoad ? car.slipFront * 0.7 : 0);
    skids.add(2 + i, wx, y + 0.02, wz, lx, lz, a, 0.19);
  });
  flame.update(dt, boost01);
  if (boost01 > 0.05 && Math.random() < 0.7) {
    const [ex, ez] = car.point(EXHAUST[0], EXHAUST[1]);
    particles.flame(ex, y + EXHAUST[2], ez, -fx, -fz, boost01);
  }
  particles.update(dt);
}

/**
 * The lamp lights go to the nearest lamps. Each fades out as it nears the edge of the set it belongs to, so a
 * light handed from one lamp to the next never pops. No allocation: a partial selection over the lamp list.
 */
const pickIdx = new Int32Array(8), pickD = new Float64Array(8);
function lampsFollow() {
  const k = lampLights.length, L = world.lamps;
  const tunnel = world.inTunnel(G.s);
  if (G.night < 0.02 && !tunnel) { for (const pl of lampLights) pl.intensity = 0; return; }
  let n = 0;
  for (let i = 0; i < L.length; i++) {
    const d = (L[i].x - car.x) ** 2 + (L[i].z - car.z) ** 2;
    if (n < k + 1) { let j = n++; while (j > 0 && pickD[j - 1] > d) { pickD[j] = pickD[j - 1]; pickIdx[j] = pickIdx[j - 1]; j--; } pickD[j] = d; pickIdx[j] = i; }
    else if (d < pickD[k]) { let j = k; while (j > 0 && pickD[j - 1] > d) { pickD[j] = pickD[j - 1]; pickIdx[j] = pickIdx[j - 1]; j--; } pickD[j] = d; pickIdx[j] = i; }
  }
  const cut = Math.min(75, n > k ? Math.sqrt(pickD[k]) : 75);
  for (let j = 0; j < k; j++) {
    const pl = lampLights[j];
    if (j >= n) { pl.intensity = 0; continue; }
    const l = L[pickIdx[j]], d = Math.sqrt(pickD[j]);
    const fade = 1 - smoothstep(cut * 0.72, cut, d);
    pl.position.set(l.x, l.y, l.z);
    const col = l.color || 0xffa040;
    if (pl.userData.col !== col) { pl.color.setHex(col); pl.userData.col = col; }
    pl.intensity = (l.tunnel ? 110 : (l.power || 330) * Math.max(G.night, 0.12)) * fade;
  }
}

// ---------------------------------------------------------------- resize
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  post.resize(w, h);
  if (particles) particles.setScale(h);
}
addEventListener('resize', resize);
resize();

boot().catch((e) => { console.error(e); loadmsg.textContent = 'failed: ' + e.message; });
requestAnimationFrame(frame);
