/**
 * MINIDRIFT — boot, the title screen, the frame loop, pause, and the contract the harness steers by.
 *
 * window.__GAME__ is refreshed every frame: `pos` in metres (the gate drives by it), `fps` from REAL elapsed
 * time, draws and tris straight from renderer.info. The start button is #startb and it is the only way a run
 * starts; the defaults (medium course, pearl white) mean one press is all it takes.
 */
import * as THREE from 'three';
import { ASSET, bakeStatic } from '../assetlib.js?v=202609240808';
import { createRig, detectTier } from '../rig.js?v=202609240808';
import { PAL, ROAD, QUALITY, SCORE, MAX_DT, CAR_SCALE, REDUCED_MOTION, clamp, damp, lerp, smoothstep } from './config.js?v=202609240808';
import { Car, gearbox } from './car.js?v=202609240808';
import { Track, DIFFS, CITY_DIFFS } from './track.js?v=202609240808';
import { World, drawsGlyphs } from './world.js?v=202609240808';
import { ChaseCam } from './camera.js?v=202609240808';
import { Input } from './input.js?v=202609240808';
import { Scoring } from './scoring.js?v=202609240808';
import { Hud } from './hud.js?v=202609240808';
import { Audio } from './audio.js?v=202609240808';
import { SkidMarks, Particles, ExhaustFlame, Petals, Rain, RainSplashes, RainCurtain, HeadBeams, LightTrails } from './fx.js?v=202609240808';
import { CourseOutUI, Magnet, COURSE_OUT_S } from './offroad.js?v=202609240808';
import { Atmosphere } from './atmos.js?v=202609240808';
import { Debris } from './debris.js?v=202609240808';
import { makePost } from './post.js?v=202609240808';

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

// A run starts just after sunset, the sky still warm and the lamps already lit: the first drifts carry it on into the
// night (the clock is the score), so the find is on screen from the first minute; at 20:36 the night had already fallen
const START_HOUR = 18.2;
const G = {
  mode: 'loading', hour: START_HOUR, hourShown: 0, fps: 60, frameAvg: 1 / 60, s: 0, u: 0, idx: 0, dist: 0, lastS: 0, night: 0,
  diff: store.get('diff', 'easy') === 'hard' ? 'hard' : 'easy',
  map: store.get('map', 'mountain') === 'city' ? 'city' : 'mountain',
  paint: clamp(Number(store.get('paint', 0)) || 0, 0, PAINTS.length - 1),
  gear: null, best: {},
};
window.__GAME__ = { pos: [0, 0], fps: 0, speed: 0, score: 0, over: false, draws: 0, tris: 0 };

// ---------------------------------------------------------------- renderer
const tier = detectTier();
const Q = QUALITY[tier === 'phone' ? 'phone' : 'high'];
// (no antialiasing on the canvas: the scene is drawn into the post chain's own target, and the canvas only ever gets
// the chain's full-screen triangle, whose multisampled copy was memory and a resolve a frame for an identical picture)
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pixelRatio));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = Q.shadow;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
// (the scene's own matrix never changes: left updating itself, it told every object in the world to remake its world
// matrix every frame, even the road and the terrain whose matrices are made once, see instancing.js freezeStatic)
scene.matrixAutoUpdate = false;
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 4500);
scene.add(camera);
// the camera goes in at creation, so the rig builds its shadow cascades as soon as they load, before any shader compiles
const rig = createRig(THREE, renderer, scene, { hour: G.hour, azimuth: 235, tier, fogStart: 60, fogDensity: 0.00095, exposure: 1.05, post: false, camera });
const post = makePost(renderer, scene, camera, { bloom: tier !== 'phone', fringe: tier !== 'phone', width: innerWidth, height: innerHeight });
renderer.info.autoReset = false;
// a lost and restored context gets back what three restores for itself, but not the environment map the rig built, which
// would stay black until the sky next changed: build the light of the hour again
renderer.domElement.addEventListener('webglcontextrestored', () => { if (G.sunApplied) applySun(0, true); });

let track, world, car, carRoot, bodyPivot, joints, chase, input, scoring, hud, audio, skids, particles, flame, headlights, paintMat, petals, rain, courseOut, magnet, debris, atmos;
let splashes, curtain, beams, trails;
const tailLamps = [];          // two points on the tail lamps' outer ends, carried by the body on its springs
let tailMat = null;             // the tail lamps' lens, brighter on the brake
const _tl = [new THREE.Vector3(), new THREE.Vector3()];
const lampLights = [];
const pops = { list: [], t: 0, open: -1.13, lamp: null };
// weather: spells of clear and of rain, each coming on and clearing over seconds; the road stays wet a while after
const W = { rain: 0, target: 0, wet: 0, t: 0, next: 75, raining: false, shownWet: -1 };
function resetWeather() {
  W.rain = 0; W.target = 0; W.wet = 0; W.t = 0; W.raining = false; W.next = 110 + Math.random() * 110;
  if (G.map === 'city') {
    W.raining = Math.random() < 0.3;
    W.target = W.rain = W.raining ? 0.45 + Math.random() * 0.35 : 0;
    W.wet = W.raining ? 1 : 0.4;
    W.next = W.raining ? 35 + Math.random() * 30 : 90 + Math.random() * 90;
  }
  W.shownWet = -1;
  if (world) { world.setWet(W.wet); W.shownWet = W.wet; }
}
function weather(dt, inTunnel) {
  W.t += dt;
  if (W.t > W.next) {
    W.t = 0; W.raining = !W.raining;
    // (showers now and then: a minute or less of rain, then two to four minutes clear)
    W.target = W.raining ? 0.4 + Math.random() * 0.45 : 0;
    W.next = W.raining ? 30 + Math.random() * 30 : 120 + Math.random() * 120;
    if (W.raining) hud.onEvent({ type: 'sun', value: 'RAIN' });
  }
  W.rain = damp(W.rain, W.target, W.target > W.rain ? 0.14 : 0.1, dt);
  W.wet = damp(W.wet, W.rain > 0.08 ? 1 : G.map === 'city' ? 0.4 : 0, W.rain > 0.08 ? 0.09 : 0.018, dt);
  if (Math.abs(W.wet - W.shownWet) > 0.004) { W.shownWet = W.wet; world.setWet(W.wet); }
  audio.setRain && audio.setRain(W.rain * (inTunnel ? 0.15 : 1));
}
const night = { moon: null, stars: null, disc: null, fuji: null, dir: new THREE.Vector3(0.36, 0.38, -0.85).normalize(), amt: 0 };
// the body on its springs, and the visible wheel angles (clamped so a fast wheel never strobes)
const susp = { roll: 0, rollV: 0, pitch: 0, pitchV: 0, accL: 0, accF: 0, spinF: 0, spinR: 0, heave: 0, heaveV: 0 };
const prof = { on: new URLSearchParams(location.search).has('prof'), long: 0, worst: 0, parts: { sim: 0, world: 0, render: 0 }, log: [] };

// ---------------------------------------------------------------- night
/**
 * Fuji, across the valley and a little to one side of the moon: a lathe with the mountain's concave flanks and
 * its crater dip, snow down to about two thirds of its height and further in the gullies, the moon's side of it
 * brighter. It is drawn unlit and unfogged in the night's own colours and travels with the camera like the far
 * skyline, so it is always the same far mountain; the nearer skyline ring crosses its foot.
 */
function buildFuji() {
  const R = 1300, H = 1080;
  const prof = [[1.25, -0.06], [1.0, 0.05], [0.85, 0.15], [0.7, 0.29], [0.55, 0.44], [0.4, 0.61], [0.27, 0.78], [0.15, 0.925], [0.075, 0.985], [0.04, 1.0], [0.0, 0.975]];
  const geo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * R, y * H)), 72);
  geo.computeVertexNormals();
  const az = Math.atan2(night.dir.x, night.dir.z) + 0.55;
  const dir = [Math.sin(az), Math.cos(az)];
  const moon = new THREE.Vector3(night.dir.x, night.dir.y * 0.6, night.dir.z).normalize();
  const P = geo.attributes.position, N = geo.attributes.normal, col = new Float32Array(P.count * 3);
  const rock = new THREE.Color(0x121827), snow = new THREE.Color(0x8494b4), haze = new THREE.Color(0x2a3350), c = new THREE.Color(), n = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), yf = y / H, th = Math.atan2(z, x);
    const gully = Math.pow(Math.max(0, Math.sin(th * 9 + 1.3 * Math.sin(th * 4))), 3);
    const line = 0.79 - 0.1 * gully - 0.025 * Math.sin(th * 23);
    const sn = smoothstep(line - 0.015, line + 0.015, yf);
    n.fromBufferAttribute(N, i);
    const lit = 0.6 + 0.55 * Math.max(0, n.dot(moon));
    c.copy(rock).lerp(snow, sn).multiplyScalar(lit);
    c.lerp(haze, smoothstep(0.5, 0.05, yf) * 0.85);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
  m.name = 'fuji'; m.frustumCulled = false; m.renderOrder = -1; m.castShadow = false; m.receiveShadow = false;
  m.userData.dir = dir;
  return m;
}

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
  // the halo: a soft radial falloff, not a flat disc
  const haloTex = (() => {
    const s = 128, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const ctx = cv.getContext('2d'), gr = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, s, s);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshBasicMaterial({ color: 0x9fb4e0, map: haloTex, transparent: true, opacity: 0, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
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
  night.fuji = buildFuji();
  scene.add(night.fuji);
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
  for (const m of ['mountain', 'city']) for (const k of Object.keys(DIFFS)) G.best[bestKey(m, k)] = Number(store.get('best.' + bestKey(m, k), 0)) || 0;
  track = new Track(SEED, G.diff, G.map);
  track.ensure(2400);
  // the Japanese faces the canvases draw with (tunnel plates, the torii plaque, the number plate): wait a moment
  // for them, never long, and draw with whatever there is if they do not come
  try {
    await Promise.race([Promise.all([document.fonts.load('900 64px "Noto Serif JP"', '櫻宮霧峰'), document.fonts.load('64px "Dela Gothic One"', '夜桜峠霧峰'), document.fonts.load('700 30px Rajdhani', 'Kirimine 12 km'), document.fonts.load('800 64px "M PLUS Rounded 1c"', 'ラーメンカラオケBAR'), document.fonts.load('64px "Dela Gothic One"', 'GAME CENTER 24H')]), new Promise((r) => setTimeout(r, 2500))]);
  } catch {}
  world = new World(scene, Q);
  // a chunk's own materials (a tunnel's name plate, a road text) get the rig's patches before the chunk is first drawn:
  // drawn unpatched, each compiled a shader of its own on the spot (a 400-550 ms stall a minute into a run)
  world.onChunk = (g) => g.traverse((o) => { const m = o.material; if (m) for (const x of Array.isArray(m) ? m : [m]) rig.setupMaterial(x); });
  await world.load((f, k) => prog(0.05 + f * 0.55, k.replace('_', ' ')));
  // NEO TOKYO loads at boot only when it is the saved map; otherwise the first time it is chosen (setMap)
  if (G.map === 'city') { prog(0.6, 'neo tokyo'); await world.loadCity(); }
  world.setTrack(track);
  prog(0.62, 'the car');
  await buildCar();
  buildNight();
  atmos = new Atmosphere(scene, { phone: tier === 'phone' });
  applyMapLook(); resetWeather();
  car = new Car();
  const start = track.sample(START_S);
  car.reset(start.x, start.z, start.h);
  G.idx = track.index(START_S); G.s = START_S; G.lastS = START_S;
  prog(0.7, 'the mountain');
  await nextFrame();
  world.prime(start.x, start.z, START_S);
  prog(0.9, 'the lights');
  chase = new ChaseCam(camera);
  // where the orbiting lens may go: not through a bore's lining, not into a street front
  chase.roomAt = (x, z) => { const s = world.ground.sample(x, z, 2.2, camProbe); if (s.tunnel) return s.edge < 0.8; if (world.city) return s.edge < 2.4; return true; };
  chase.snap(car, start.y);
  input = new Input();
  scoring = new Scoring();
  hud = new Hud();
  audio = new Audio();
  audio.setMap(G.map === 'city');
  skids = new SkidMarks(scene, Q.skid);
  particles = new Particles(scene, Q.smoke);
  courseOut = new CourseOutUI($('hud'));
  magnet = new Magnet(scene);
  debris = new Debris(scene, (x, z) => world.ground.height(x, z));
  debris.onTrail = (x, y, z) => particles.spawn({ x, y, z, vx: (Math.random() - 0.5) * 1.5, vy: 0.5 + Math.random(), vz: (Math.random() - 0.5) * 1.5, life: 0.3 + Math.random() * 0.2, s0: 0.28, s1: 0.04, r: 1, g: 0.72, b: 0.28, a0: 1, grav: 6, drag: 1.5 });
  particles.setScale(innerHeight);
  petals = new Petals(scene, Q.petals || 600);
  rain = new Rain(scene, Q.rain || 2000);
  splashes = new RainSplashes(scene, rain.u, tier === 'phone' ? 150 : 280);
  trails = new LightTrails(scene);
  curtain = new RainCurtain(scene);
  beams = new HeadBeams(scene);
  placeCar(start.y, 0, 0);
  applySun(10, true);
  // the rig loads its cascaded shadows on its own; they re-patch every material, so compile after, not before
  try { await rig.ready; } catch {}
  applySun(0, true);
  rig.refresh(scene);
  prog(0.93, 'the shaders');
  await compileAll(start.y);
  window.__DEBUG__ = { world, get track() { return track; }, car, rig, scene, renderer, G, chase, audio, post, get scoring() { return scoring; }, prof, W, get debris() { return debris; }, get magnet() { return magnet; }, get atmos() { return atmos; }, get courseOut() { return courseOut; }, get hud() { return hud; }, get trails() { return trails; },
    // hold the weather at x (0 clear .. 1 downpour) for testing
    rainNow(x) { W.raining = x > 0; W.target = x; W.rain = x; W.wet = x > 0 ? 1 : 0; W.t = 0; W.next = 1e9; },
    teleport(s, kmh = 0) {
      const p = track.sample(s);
      car.reset(p.x, p.z, p.h); car.vF = kmh / 3.6;
      G.idx = track.index(s); G.s = s; G.lastS = s; G.carY = p.y; G.vy = 0; G.off = null; G.floor = null;
      world.prime(p.x, p.z, s); chase.snap(car, p.y); placeCar(p.y, 0, 0);
      return p;
    } };
  input.onAny = () => audio.unlock();
  input.onPause = () => { if (G.mode === 'playing') setPaused(true); else if (G.mode === 'paused') setPaused(false); };
  // (Enter or Space on the title, from input.js; true when a run started, so the key does nothing else)
  input.onStart = () => { if (building) { startWanted = true; return true; } if (G.mode !== 'title') return false; startGame(); return true; };
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

/**
 * One real frame while hidden, with every prop in view and every shadow map drawn: shadow and post programs compile
 * here, not in the first seconds of play. Things that are only drawn later (skid marks, the boost flame) are drawn once
 * here too: the first draw of a mesh is when the GPU driver finishes its shader, and that was a 100 ms stall at the
 * first drift.
 */
function warmRender() {
  idle(0.016); rig.update(camera, 0.016);
  if (rig.csm) for (const l of rig.csm.lights) l.shadow.needsUpdate = true;
  if (night.moon) night.moon.shadow.needsUpdate = true;              // (drawn even if the moon is down just now)
  for (const t of skids.tracks) t.geo.setDrawRange(0, 6);
  flame.cones.visible = true;
  // the magnet (parked out of sight) and the rain (hidden until it rains) are drawn once here too, in front of
  // the lens, with their beam and rings lit: their first draw would otherwise be a stall the first time they appear
  const [wfx, wfz] = car.forward();
  magnet.g.position.set(car.x + wfx * 9, carRoot.position.y + 3, car.z + wfz * 9);
  magnet.beam.material.opacity = 0.2; for (const r of magnet.rings) r.material.opacity = 0.5; magnet.dust.material.opacity = 0.5;
  rain.mesh.visible = true; rain.u.uAmount.value = 1; rain.u.uCenter.value.copy(camera.position);
  splashes.mesh.visible = true; curtain.mesh.visible = true; beams.mesh.visible = true;
  trails.update(0.016, [camera.position.clone().add(new THREE.Vector3(0, 0, -5)), camera.position.clone().add(new THREE.Vector3(1, 0, -5))], 0.5, camera.position, camera);
  if (post.retro) post.retro.uniforms.uLens.value = 1;
  atmos.warm(true, camera.position);
  post.render(0.016);
  atmos.warm(false);
  splashes.mesh.visible = false; curtain.mesh.visible = false; beams.mesh.visible = false;
  trails.clear(); trails.update(0.016, [], 0, camera.position, camera);
  if (post.retro) post.retro.uniforms.uLens.value = 0;
  for (const t of skids.tracks) t.geo.setDrawRange(0, 0);
  flame.cones.visible = false;
  magnet.g.position.set(0, -600, 0); magnet.beam.material.opacity = 0; for (const r of magnet.rings) r.material.opacity = 0; magnet.dust.material.opacity = 0;
  rain.mesh.visible = false; rain.u.uAmount.value = 0;
}

/** Every program the world can ask for compiled (world.precompile), then the warm-up frame: at boot, and when NEO TOKYO first loads. */
async function compileAll(y) {
  const [fx0, fz0] = car.forward();
  await world.precompile(renderer, camera, (root) => rig.refresh(root), post.sceneRT, { x: car.x + fx0 * 6, y, z: car.z + fz0 * 6, render: warmRender });
  warmRender();
}

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
    if (m.name === 'plate') { out = plateMaterial(); upgraded.set(m, out); return out; }
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
  // pop-up lamps: joints of their own, baked like the wheels and carried by the body on its springs
  pops.list = [];
  for (const key of ['popL', 'popR']) {
    const p = joints[key]; if (!p) continue;
    const baked = bakeInto(p, p);
    for (const c of [...p.children]) p.remove(c);
    for (const c of [...baked.children]) p.add(c);
    p.parent.remove(p); p.position.y -= 0.5; bodyPivot.add(p);
    pops.list.push(p);
  }
  pops.open = obj.userData.popOpen ?? -1.13;
  pops.lamp = obj.userData.popLamp || null;
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
  // the tail lamps' outer ends, for the light trails: found from the lamps' own geometry (the red lens material)
  {
    const bb = new THREE.Box3(), tmp = new THREE.Box3();
    let lampMesh = null;
    bodyPivot.traverse((o) => {
      if (!o.isMesh || !o.material || Array.isArray(o.material) || !o.material.emissive) return;
      if (o.material.emissive.getHex() !== PAL.tailRed || o.material.emissiveIntensity < 2) return;
      o.geometry.computeBoundingBox(); tmp.copy(o.geometry.boundingBox);
      tailMat = o.material;
      if (!lampMesh) { bb.copy(tmp); lampMesh = o; } else bb.union(tmp);
    });
    const parent = lampMesh ? lampMesh.parent : bodyPivot;
    const y = lampMesh ? (bb.min.y + bb.max.y) / 2 : 0.35, z = lampMesh ? bb.min.z + 0.02 : -2.0;
    for (const x of lampMesh ? [bb.max.x - 0.04, bb.min.x + 0.04] : [0.72, -0.72]) {
      const e = new THREE.Object3D(); e.position.set(x, y, z); parent.add(e); tailLamps.push(e);
    }
  }
}

/** A Japanese number plate: white, green characters, the region and class number over the kana and the number. */
function plateMaterial() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f2f1ea'; ctx.fillRect(0, 0, 512, 256);
  const green = '#1c6a3b';
  ctx.strokeStyle = green; ctx.lineWidth = 7;
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(10, 10, 492, 236, 18); ctx.stroke(); } else ctx.strokeRect(10, 10, 492, 236);
  ctx.fillStyle = '#a3a8ad'; for (const x of [120, 392]) { ctx.beginPath(); ctx.arc(x, 40, 10, 0, Math.PI * 2); ctx.fill(); }
  const jp = '"Dela Gothic One", "Noto Serif JP", "Yu Gothic", "Hiragino Sans", sans-serif', num = '700 SIZEpx Rajdhani, "Share Tech Mono", sans-serif';
  const kanji = drawsGlyphs('44px ' + jp, '群馬た');
  ctx.fillStyle = green; ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right'; ctx.font = kanji ? '52px ' + jp : num.replace('SIZE', 50); ctx.fillText(kanji ? '群馬' : 'GUNMA', 262, 96);
  ctx.textAlign = 'left'; ctx.font = num.replace('SIZE', 64); ctx.fillText('330', 284, 98);
  ctx.textAlign = 'center'; ctx.font = kanji ? '60px ' + jp : num.replace('SIZE', 56); ctx.fillText(kanji ? 'た' : 'TA', 70, 214);
  ctx.font = num.replace('SIZE', 150); ctx.fillText('86-86', 300, 226);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.14, roughness: 0.45, metalness: 0.05 });
  m.name = 'plate';
  return m;
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
  document.querySelectorAll('.map').forEach((b) => b.addEventListener('click', () => setMap(b.dataset.m)));
  markDiff(); markMap();
  refreshBests();
  document.body.classList.toggle('touch', input.touchMode);
}

function markDiff() { document.querySelectorAll('.diff').forEach((b) => b.classList.toggle('sel', b.dataset.d === G.diff)); }
function refreshBests() { for (const k of Object.keys(DIFFS)) { const e = $('best-' + k), b = G.best[bestKey(G.map, k)]; if (e) e.textContent = b > 0 ? 'BEST ' + Math.round(b).toLocaleString('en-US') : 'BEST —'; } }
/** Where a best score is kept: the mountain's under the course alone (as before the city), the city's under city. */
function bestKey(m = G.map, d = G.diff) { return (m === 'city' ? 'city.' : '') + d; }
function courseLabel() { const D = (G.map === 'city' ? CITY_DIFFS : DIFFS)[G.diff]; return G.map === 'city' ? 'NEO TOKYO · ' + D.label : D.label + ' PASS'; }

/** The title's map buttons, the course blurbs and the Japanese strip follow the map. */
function markMap() {
  document.querySelectorAll('.map').forEach((b) => b.classList.toggle('sel', b.dataset.m === G.map));
  const T = G.map === 'city' ? CITY_DIFFS : DIFFS;
  document.querySelectorAll('.diff').forEach((b) => { const sp = b.querySelector('span'); if (sp && T[b.dataset.d]) sp.textContent = T[b.dataset.d].blurb; });
  const tate = document.querySelector('#title .tate');
  if (tate) { tate.textContent = G.map === 'city' ? 'ネオ東京' : '夜桜峠'; tate.classList.toggle('city', G.map === 'city'); }
  document.body.classList.toggle('city', G.map === 'city');
  const tag = $('tagline'); if (tag) tag.textContent = G.map === 'city' ? 'NEON STREETS · DRIFT UNTIL DAWN' : 'NIGHT TOUGE · DRIFT UNTIL DAWN';
  refreshBests();
}

/** Everything in the scene that belongs to one map and not the other. */
function applyMapLook() {
  const city = G.map === 'city';
  if (audio && audio.setMap) audio.setMap(city);
  if (night.fuji) night.fuji.visible = !city;
  if (night.glow) {
    // the horizon: a warm dusk over the mountains, a magenta light-polluted haze over the city
    const c = night.glow.geometry.attributes.color, a = c.array;
    const lo = city ? [0.95, 0.3, 0.72, 0.8] : [0.95, 0.45, 0.35, 0.6], hi = city ? [0.4, 0.18, 0.7, 0.0] : [0.35, 0.25, 0.55, 0.0];
    for (let i = 0; i < a.length; i += 8) { a.set(lo, i); a.set(hi, i + 4); }
    c.needsUpdate = true;
  }
  night.starK = city ? 0.3 : 1;
  if (atmos) atmos.setMap(city);
}

async function setMap(m) {
  if (building || G.mode !== 'title' || (m !== 'city' && m !== 'mountain') || m === G.map) return;
  building = true;
  G.map = m; store.set('map', m); markMap();
  $('building').classList.add('on');
  await nextFrame(); await nextFrame();
  // NEO TOKYO chosen for the first time: its module and materials load now (the boot skipped them), and nothing is
  // drawn until its programs are compiled, so no frame compiles a shader on the spot (the title holds its last frame
  // under LAYING THE ROAD)
  const firstCity = m === 'city' && !world.City;
  try {
    if (firstCity) { G.mode = 'loading'; await world.loadCity(); }
    track = new Track(SEED, G.diff, G.map);
    track.ensure(2400);
    world.setTrack(track);
    applyMapLook(); resetWeather(); applySun(0, true);
    skids.clear && skids.clear();
    resetCarToStart();
    world.prime(car.x, car.z, START_S);
    rig.refresh(scene);
    if (firstCity) await compileAll(G.carY);
  } finally {
    if (firstCity) G.mode = 'title';
    $('building').classList.remove('on');
    building = false;
  }
  startIfWanted();
}

// (START pressed while a map or a course is being laid, NEO TOKYO's first build most of all: the run starts the moment
// the road is ready, instead of the press being lost)
let building = false, startWanted = false;
function startIfWanted() { if (startWanted) { startWanted = false; startGame(); } }
async function setCourse(diff) {
  if (building || !DIFFS[diff] || G.mode !== 'title') return;
  if (diff === G.diff) return;
  building = true;
  G.diff = diff; store.set('diff', diff); markDiff();
  $('building').classList.add('on');
  await nextFrame(); await nextFrame();
  track = new Track(SEED, diff, G.map);
  track.ensure(2400);
  world.setTrack(track);
  skids.clear && skids.clear();
  resetCarToStart();
  world.prime(car.x, car.z, START_S);
  rig.refresh(scene);
  $('building').classList.remove('on');
  building = false;
  startIfWanted();
}

function resetCarToStart() {
  const p = track.sample(START_S);
  car.reset(p.x, p.z, p.h);
  G.idx = track.index(START_S); G.s = START_S; G.lastS = START_S; G.dist = 0; G.u = 0;
  G.carY = p.y; G.vy = 0; G.off = null; G.floor = null; G.magPose = null; car.air = false;
  if (magnet) magnet.run = null;
  if (chase) chase.cine = null;
  if (debris) debris.clear();
  if (skids) skids.clear();
  if (trails) trails.clear();
  if (courseOut) courseOut.update(null);
  susp.roll = susp.rollV = susp.pitch = susp.pitchV = susp.accL = susp.accF = susp.heave = susp.heaveV = 0;
  chase.snap(car, p.y);
  placeCar(p.y, 0, 0);
}

function showTitle() {
  G.mode = 'title';
  $('title').classList.add('on');
  hud.show(false);
  if (!G.hudWarmed) {
    // (the off-road countdown in all three of its moods, drawn once nearly invisibly with the rest of the HUD: its glows cost a
    // 100 ms stall the first time a run left the road)
    // (the ring has to be seen counting down while hot: a ring redrawn under the hot glow's animated filter is its
    // own raster pipeline, and a still one is never redrawn)
    G.hudWarmed = true; hud.warm(true);
    const w0 = performance.now();
    const warmStep = () => {
      if (G.mode !== 'title') return;
      const e = (performance.now() - w0) / 1000;
      if (e < 0.3) courseOut.update(3.6 - e * 3);
      else if (e < 0.85) courseOut.update(1.95 - (e - 0.3) * 2.6);
      else if (e < 1.05) courseOut.update(null, true);
      else { courseOut.update(null); hud.warm(false); return; }
      requestAnimationFrame(warmStep);
    };
    requestAnimationFrame(warmStep);
  }
  document.body.classList.remove('playing');
}

function startGame() {
  if (building) { startWanted = true; return; }
  if (G.mode !== 'title') return;
  $('title').classList.remove('on');
  document.body.classList.add('playing');
  if (night.hero) night.hero.intensity = 0;
  hud.warm(false); courseOut.update(null);
  scoring.reset(); hud.reset();
  G.hour = START_HOUR; G.dist = 0; G.newBest = false; G.runBest = G.best[bestKey()] || 0;
  resetWeather();
  G.playT = 0; G.longFrames = 0; G.worstFrame = 0;
  const p = track.sample(G.s || START_S);
  chase.snap(car, p.y);
  hud.show(true);
  audio.unlock();
  G.mode = 'playing';
  hud.toast(courseLabel(), 'good', true);
}

function setPaused(on) {
  if (on && G.mode === 'playing') {
    G.mode = 'paused';
    $('pause').classList.add('on');
    const st = scoring.stats;
    $('pstats').textContent = `${courseLabel()}   SCORE ${Math.round(scoring.total).toLocaleString('en-US')}   ${(G.dist / 1609.344).toFixed(1)} MI   ${st.drifts} DRIFTS`;
    audio.pause && audio.pause(true);
  } else if (!on && G.mode === 'paused') {
    $('pause').classList.remove('on');
    G.mode = 'playing';
    last = performance.now();
    audio.pause && audio.pause(false);
  }
}

function saveBest() {
  const b = G.best[bestKey()] || 0;
  if (scoring.total > b) { G.best[bestKey()] = scoring.total; store.set('best.' + bestKey(), Math.round(scoring.total)); }
  refreshBests();
}

function restartRun() {
  saveBest();
  scoring.reset(); hud.reset();
  G.hour = START_HOUR; G.newBest = false; G.runBest = G.best[bestKey()] || 0;
  resetWeather();
  resetCarToStart();
  world.prime(car.x, car.z, START_S);
  hud.toast('NEW RUN', '', false);
}

function quitToTitle() {
  saveBest();
  $('pause').classList.remove('on');
  audio.pause && audio.pause(false);
  // (the engine, the tyres and the wind fade out: they droned on under the title after a quit)
  audio.quiet && audio.quiet();
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

const _fwd = new THREE.Vector3(), _carAt = { x: 0, y: 0, z: 0, vx: 0, vz: 0 };
const _camVel = new THREE.Vector3(), _rainCol = new THREE.Color(), _cityRain = new THREE.Color();
const _smoke = new THREE.Color(), _tailSmoke = new THREE.Color(1.0, 0.32, 0.3), _neonSmoke = new THREE.Color(0.75, 0.45, 1.0);
/** Where a drop lands for a splash: on the road ahead of the car or just behind it, across its whole width. */
function splashSpot() {
  const s = G.s + Math.random() * 60 - 8;
  if (s < 2) return null;
  const p = track.sample(s);
  if (p.tunnel) return null;
  const u = (Math.random() * 2 - 1) * (Math.random() < 0.5 ? p.wl : p.wr) * 0.95;
  return [p.x + Math.cos(p.h) * u, p.y - u * Math.tan(p.bank || 0), p.z - Math.sin(p.h) * u];
}
function frame(now) {
  requestAnimationFrame(frame);
  const real = Math.max(1e-4, (now - last) / 1000);
  last = now;
  G.prevJs = G.jsMs;
  G.frameAvg = G.frameAvg * 0.9 + real * 0.1;
  G.fps = Math.round(1 / G.frameAvg);
  let dt = Math.min(real, MAX_DT);
  if (G.hitStop > 0 && G.mode === 'playing') { G.hitStop -= dt; dt *= 0.16; }
  const t0 = performance.now();
  // nothing is drawn while loading: a frame drawn mid-boot compiles its shaders synchronously, on the spot
  if (G.mode === 'loading') return;

  if (G.mode === 'playing') step(dt, t0);
  else if (G.mode === 'title') idle(dt, t0);
  else if (G.mode === 'paused') { if (world && car) world.update(car.x, car.z, G.s, t0 + 2); }

  // a debug camera for inspecting the world from anywhere (set window.__CAM__ = { pos: [x,y,z], look: [x,y,z], fov })
  if (window.__CAM__) { const c = window.__CAM__; camera.position.set(...c.pos); camera.up.set(0, 1, 0); camera.lookAt(...c.look); if (c.fov && camera.fov !== c.fov) { camera.fov = c.fov; camera.updateProjectionMatrix(); } }
  // the road studs light up where the car is pointing
  if (car && world) { const [sfx, sfz] = car.forward(); world.setStudView(car.x, carRoot ? carRoot.position.y : 0, car.z, sfx, sfz, G.night, renderer.domElement.height); }
  // rain, lit by the headlights and the lamps near the car
  if (rain && car && G.mode !== 'paused') {
    camera.getWorldDirection(_fwd);
    const hh = Math.hypot(_fwd.x, _fwd.z) || 1;
    const [cfx, cfz] = car.forward();
    _carAt.x = car.x; _carAt.y = carRoot ? carRoot.position.y + 0.4 : 0; _carAt.z = car.z; _carAt.fx = cfx; _carAt.fz = cfz;
    const [clx, clz] = car.left();
    _camVel.set(cfx * car.vF + clx * car.vL, 0, cfz * car.vF + clz * car.vL);
    const wetAir = W.rain * (1 - (G.tunnelK || 0));
    // (by day a drop is a pale sliver of the grey sky; the size of a pixel at a metre, so no streak is drawn thinner)
    rain.update(dt, wetAir, camera.position, _fwd.x / hh, _fwd.z / hh, _carAt, G.night, lampLights, 0.05 + 0.72 * (1 - G.night), _camVel,
      2 * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, renderer.domElement.height));
    // the rain landing on the road ahead, the rain further off, the headlights' beams in it, and drops on the lens
    if (track) splashes.update(dt, wetAir, splashSpot);
    _rainCol.copy(rig.fog.color).multiplyScalar(0.5 + 0.9 * (1 - G.night)).addScalar(0.05);
    if (G.map === 'city') _rainCol.add(_cityRain.setRGB(0.12, 0.05, 0.1).multiplyScalar(G.night));
    curtain.update(dt, wetAir * 0.6, camera.position, _rainCol, 1 - G.night);
    beams.update(G.night * (0.012 + 0.05 * wetAir) * (1 - 0.7 * (G.tunnelK || 0)) * (headlights[0] && headlights[0].intensity > 0.01 ? 1 : 0), headlights);
    // (fewer drops on the lens by day, where each one shows plainly as a lens flaw rather than a glint)
    if (post.retro) { post.retro.uniforms.uLens.value = (G.mode === 'playing' ? wetAir * (1 - (G.tunnelK || 0)) : wetAir * 0.5) * (0.45 + 0.55 * G.night); post.retro.uniforms.uFlow.value = clamp(car.speed / 40, 0, 1); }
    // the paint beads up and shines in the wet
    if (paintMat) { paintMat.roughness = 0.22 - 0.12 * W.wet; paintMat.clearcoatRoughness = 0.06 - 0.035 * W.wet; }
  }
  if (atmos && car && track && G.mode !== 'paused' && G.mode !== 'loading') airFollow(dt);
  // cherry petals on the air, round the camera wherever it is (not while paused, and not inside a tunnel)
  if (petals && car && G.mode !== 'paused') {
    camera.getWorldDirection(_fwd);
    const h = Math.hypot(_fwd.x, _fwd.z) || 1;
    const [cfx, cfz] = car.forward(), [clx, clz] = car.left();
    _carAt.x = car.x; _carAt.y = carRoot ? carRoot.position.y + 0.4 : 0; _carAt.z = car.z;
    _carAt.vx = cfx * car.vF + clx * car.vL; _carAt.vz = cfz * car.vF + clz * car.vL;
    petals.update(dt, camera.position, _fwd.x / h, _fwd.z / h, _carAt, G.map === 'city' ? 0 : 1 - (G.tunnelK || 0));
  }
  const t1 = performance.now();
  renderer.info.reset();
  rig.update(camera, dt);
  post.cel.uniforms.uSpeed.value = car && G.mode === 'playing' ? clamp((car.speed - 8) / 32, 0, 1) * (1 + 0.6 * clamp(car.boost / 1.2, 0, 1)) : 0;
  post.cel.uniforms.uVig.value = hud && G.mode === 'playing' ? hud.vignette : 0;
  post.cel.uniforms.uHit.value = hud && G.mode === 'playing' ? hud.hitFlash : 0;
  shafts();
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
  G.jsMs = performance.now() - t0;
  if (window.__ONFRAME__) window.__ONFRAME__(dt, real);
  // every run keeps count of its slow frames, for the gate (the first second of a run is the start itself)
  if (G.mode === 'playing') {
    G.playT = (G.playT || 0) + real;
    const shot = window.__SHOT__ && Math.abs(now - window.__SHOT__) < 2000;   // the test harness was taking a screenshot
    if (G.playT > 1.2 && !shot) {
      if (real > 0.034) { G.longFrames = (G.longFrames || 0) + 1; (G.slowLog = G.slowLog || []).push([Math.round(G.playT * 10) / 10, Math.round(G.s), Math.round(real * 1000), +(G.simMs || 0).toFixed(1), +(G.worldMs || 0).toFixed(1), +(G.renderMs || 0).toFixed(1), +(G.prevJs || 0).toFixed(1)]); if (G.slowLog.length > 30) G.slowLog.shift(); }
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
  // (as the page's layout: a phone upright; a small phone on its side has the menu at the left, as on a laptop)
  const portrait = innerWidth <= 720 && innerHeight > innerWidth;
  const a = car.yaw + Math.PI + 0.5 + Math.sin(orbitT) * 1.0;
  const d = portrait ? 7.4 : 5.0;
  camera.position.set(car.x + Math.sin(a) * d, y + (portrait ? 2.3 : 1.15) + 0.2 * Math.cos(orbitT * 0.7), car.z + Math.cos(a) * d);
  camera.up.set(0, 1, 0);
  // portrait: the menu fills the lower half, so the car sits in the upper third
  camera.lookAt(car.x, y + (portrait ? -0.9 : 0.5), car.z);
  // the car sits right of centre, clear of the menu: pan the camera sideways along its own right axis
  if (!portrait) {
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
  // (window.__AUTOPILOT__, a test hook: a function of dt returning the input, drives the car instead of the keys)
  const inp = window.__AUTOPILOT__ ? window.__AUTOPILOT__(dt) : input.sample(dt);
  const mag = magnet.active ? magnet.update(dt, camera.position) : null;
  // ---- where on the road are we
  let n = track.nearest(car.x, car.z, G.idx);
  // off the road the car may reach another stretch of it (a switchback's other leg, a street across): if the
  // nearest road overall is another one and the car is on it, that is where it is now
  if (G.off && !mag) {
    const wN = n.u >= 0 ? n.wl : n.wr;
    if (Math.abs(n.u) > wN + 1.5) {
      const r = track.nearestRoad(car.x, car.z, 24, _roadOut);
      if (r.found && Math.abs(r.i - n.i) > 45) { const q = track.nearest(car.x, car.z, r.i); if (Math.abs(q.u) < (q.u >= 0 ? q.wl : q.wr)) n = q; }
    }
  }
  G.idx = n.i; G.s = n.s; G.u = n.u; G.roadH = n.h;
  const au = Math.abs(n.u);
  const w = n.u >= 0 ? n.wl : n.wr;
  const beyond = au - w;                                    // metres past the road's edge (negative: on it)
  // grip: full on the asphalt and its edge line, most of it on the gravel shoulder, less on the ground beyond
  let surface = au < track.half + 0.35 ? 1 : beyond < 0.1 ? 0.88 : 0.6;
  let impact = 0, clipping = false, noseIn = false;
  if (mag) carryByMagnet(mag);
  else {
    // ---- the floor: the road, or past its edge the ground; where the ground falls away at speed, the air
    const fl = G.floor = floorUnderCar(n, beyond);
    vertical(dt, fl);
    if (!car.air && !fl.onRoad) {
      // a slope pulls the car down it, and steep ground holds less well
      const gx = fl.gx, gz = fl.gz, k = -9.81 / Math.sqrt(1 + gx * gx + gz * gz);
      const s = Math.sin(car.yaw), c = Math.cos(car.yaw);
      car.extF = gx * k * s + gz * k * c; car.extL = gx * k * c - gz * k * s;
      surface *= 1 - 0.35 * smoothstep(0.4, 1.2, Math.hypot(gx, gz));
    } else if (!car.air && fl.bank) {
      // on a banked road gravity pulls toward the inside of the bend, down the camber
      const a = 9.81 * Math.sin(fl.bank), ax = a * Math.cos(n.h), az = -a * Math.sin(n.h);
      const s = Math.sin(car.yaw), c = Math.cos(car.yaw);
      car.extF = ax * s + az * c; car.extL = ax * c - az * s;
    } else { car.extF = 0; car.extL = 0; }
    inp.line = { curv: track.sample(G.s + 12 + car.speed * 0.55).k, here: track.sample(G.s + 2 + car.speed * 0.12).k };
    car.step(dt, inp, surface * (1 - 0.07 * W.wet));            // a wet road gives a little grip away

    // ---- walls, where there are walls: guardrails, tunnel linings, street fronts, and ground too steep to climb
    for (const [l, f] of CORNERS) {
      const [cx, cz] = car.point(l, f);
      const q = track.nearest(cx, cz, G.idx);
      const lx = Math.cos(q.h), lz = -Math.sin(q.h);
      const hL = hardLine(q, 1), hR = hardLine(q, -1);
      if (q.u > hL) { impact = Math.max(impact, car.hitWall(-lx, -lz, q.u - hL, l, f)); if (f > 0) noseIn = true; }
      else if (q.u < -hR) { impact = Math.max(impact, car.hitWall(lx, lz, -hR - q.u, l, f)); if (f > 0) noseIn = true; }
      else if (q.u > q.wl || q.u < -q.wr) {
        // off the road: a face of ground rising more than a wheel can climb is a wall
        const gy = world.ground.height(cx, cz);
        if (gy - G.carY > 0.9 && !car.air) {
          const e = 0.6, gx = world.ground.height(cx + e, cz) - world.ground.height(cx - e, cz), gz = world.ground.height(cx, cz + e) - world.ground.height(cx, cz - e);
          const gl = Math.hypot(gx, gz) || 1;
          impact = Math.max(impact, car.hitWall(-gx / gl, -gz / gl, 0.04, l, f));
          if (f > 0) noseIn = true;
        }
      } else if (f < 0) {
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
    // ---- the things beside the road: trees and buildings stop the car, posts, lamps and signs fly, bushes go flat
    impact = Math.max(impact, collideProps());
    // ---- off the road: the countdown, and at zero the magnet
    offRoad(dt, n, beyond);
  }
  courseOut.update(G.off && !magnet.active ? Math.max(0, G.off.t) : null, magnet.active);
  debris.update(dt);

  // ---- scoring and boost
  scoring.update(dt, car, impact, clipping);
  const grant = scoring.takeBoost();
  if (grant > 0) { car.boost = Math.min(SCORE.boostMax, car.boost + grant); chase.kick(0.12); }
  // a pull on the handbrake cancels a boost (to set up the next corner without it)
  if (inp.hand && !G.handWas && car.boost > 0.05) { car.boost = 0; audio.sfx && audio.sfx('boostCut'); }
  G.handWas = !!inp.hand;
  // a clean J-turn scores, and says so
  if (car.jturnDone) {
    car.jturnDone = false;
    scoring.total += 500;
    const e = { type: 'jturn', value: 500 };
    hud.onEvent(e); audio.onEvent && audio.onEvent(e); chase.kick(0.15);
  }
  // (the clock before this frame's banks: a banked drift moves it too, and may carry it over sunrise or sunset)
  const h0 = G.hour;
  for (const e of scoring.drain()) {
    hud.onEvent(e); audio.onEvent(e);
    if (e.type === 'bank') { G.hour += e.value / 6000; if (scoring.total > (G.best[bestKey()] || 0)) { G.best[bestKey()] = scoring.total; store.set('best.' + bestKey(), Math.round(scoring.total)); } }
    if (e.type === 'crash') chase.kick(0.9);
  }
  if (!G.newBest && G.runBest > 0 && scoring.total > G.runBest) { G.newBest = true; hud.onEvent({ type: 'best' }); }
  const boost01 = clamp(car.boost / 1.2, 0, 1);

  weather(dt, !!track.inTunnel(G.s));

  // ---- distance, time of day
  const ds = Math.max(0, G.s - G.lastS); G.lastS = G.s;
  if (ds < 50) { G.dist += ds; scoring.stats.distance = G.dist; }
  const h = G.hour;
  const rate = (h >= 7.2 && h < 16.6) ? 7 : 1;
  G.hour += ds / 3000 * rate;
  if (G.hour >= 24) G.hour -= 24;
  // an edge the clock passed this frame, on the road or by a bank, and across midnight too, counts once (tested only
  // against the road's share, a bank carrying the clock over sunrise let the SUNRISE callout go by)
  const moved = (G.hour - h0 + 24) % 24;
  const crossed = (edge) => { const d = (edge - h0 + 24) % 24; return d > 0 && d <= moved; };
  if (crossed(18.05)) { const e = { type: 'sun', value: 'SUNSET' }; hud.onEvent(e); audio.onEvent(e); }
  if (crossed(5.95)) { const e = { type: 'sun', value: 'SUNRISE' }; hud.onEvent(e); audio.onEvent(e); }
  applySun(dt);

  // ---- car placement, fx, audio
  if (!mag && !car.air && G.floor && G.floor.onRoad) { const n3 = track.nearest(car.x, car.z, G.idx); G.carY = n3.y - n3.u * Math.tan(n3.bank || 0); }   // (the road where the car now is)
  const y = G.carY;
  {
    const fl = G.floor || { grade: 0, roll: 0 };
    const pitchT = car.air ? clamp(G.vy / Math.max(5, car.speed), -0.5, 0.5) * 0.8 : fl.grade;
    G.visPitch = damp(G.visPitch || 0, pitchT, car.air ? 5 : 14, dt);
    G.visRoll = damp(G.visRoll || 0, car.air ? 0 : fl.roll, car.air ? 3 : 14, dt);
  }
  placeCar(y, mag ? 0 : G.visPitch, dt, mag ? 0 : G.visRoll, mag);
  effects(dt, y, boost01);
  // the tail lamps' light trails, while a slide is held (fainter by day, when the lamps are only lamps)
  if (trails && tailLamps.length === 2) {
    // (getWorldPosition brings the lamp's own chain of parents up to date, the car root down to the lamp: the whole car,
    // some 120 objects, was remade here first, and then again by the render)
    tailLamps[0].getWorldPosition(_tl[0]); tailLamps[1].getWorldPosition(_tl[1]);
    const slide = smoothstep(0.2, 0.5, Math.abs(car.beta)) * smoothstep(7, 14, car.speed) * (car.air || mag ? 0 : 1);
    G.trailK = damp(G.trailK || 0, slide, slide > (G.trailK || 0) ? 10 : 6, dt);
    trails.u.uI.value = 1.1 + 1.1 * G.night;
    trails.update(dt, _tl, G.trailK * (0.45 + 0.55 * G.night), camera.position, camera);
  }
  const gb = gearbox(car.vF, car.throttle, G.gear);
  G.gear = gb;
  // a lift at high revs: for a moment unburnt fuel lights off in the exhaust, a pop and a flame each time
  if (car.throttle < 0.08 && gb.rpm > 3200 && !car.air && G.mode === 'playing') {
    G.liftT = (G.liftT || 0) + dt;
    if (Math.random() < 5.5 * Math.exp(-G.liftT / 0.7) * dt) {
      const k = 0.6 + Math.random() * 0.9;
      audio.pop && audio.pop(k);
      const [ex, ez] = car.point(EXHAUST[0], EXHAUST[1]), [fx, fz] = car.forward();
      // (the flame is the exhaust's own cone of fire, lit for a blink; a puff of sprites read as a yellow disc on the road)
      G.popFlame = Math.max(G.popFlame || 0, 0.45 + 0.4 * k);
      particles.flame(ex, G.carY + EXHAUST[2], ez, -fx, -fz, 0.4 + k * 0.3);
    }
  } else G.liftT = 0;
  // the revs flare as the rear tyres let go and spin up in a slide (the tach and the engine note, not the gearbox)
  G.flare = damp(G.flare || 0, car.slipRear * car.throttle * (car.hand ? 0.35 : 1) * (car.air ? 0 : 1), G.flare > 0.1 ? 5 : 8, dt);
  const rpmIn = Math.min(8300, gb.rpm * (1 + 0.34 * G.flare));
  const gbShown = { gear: gb.gear, rpm: rpmIn };
  // the brake lights: the tail lamps burn brighter on the brake and the handbrake
  if (tailMat) tailMat.emissiveIntensity = damp(tailMat.emissiveIntensity, 2.4 + 3.2 * Math.max(car.brake, car.hand * 0.6), 18, dt);
  audio.update(dt, car, rpmIn, scoring.active, boost01, surface, gb.gear);
  const inTun = !!track.inTunnel(G.s);
  if (audio.setTunnel) audio.setTunnel(inTun ? 1 : 0);
  // NEO TOKYO's own sounds under it all (far traffic, horns, a siren, the train, the crossings' chirps), heard from the lens
  if (G.map === 'city' && audio.cityUpdate) { const e = camera.matrixWorld.elements; audio.cityUpdate(dt, camera.position.x, camera.position.z, Math.atan2(-e[8], -e[10]), world, inTun ? 1 : 0); }
  // in a tunnel the sodium lamps are the light: the headlights drop back so the bore stays orange
  G.tunnelK = damp(G.tunnelK || 0, inTun || track.nearTunnel(G.s + 25, 0) ? 1 : 0, 3, dt);
  for (const hl of headlights) hl.intensity = 2.6 * G.night * (1 - 0.6 * G.tunnelK);
  const t1 = performance.now();

  // ---- camera, world
  { const o = input.takeOrbit(); chase.orbit(o.held, o.dx, o.dy); }
  chase.bank = G.floor && G.floor.bank ? G.floor.bank : 0;
  chase.update(dt, car, y, camGround, boost01, input.zoom, susp.accL);
  nightFollow();
  // the world builds in the time the frame has spare: less after a slow frame, so a hitch never compounds
  const spare = clamp(13.5 - (performance.now() - t0) - G.renderMs, 0.8, tier === 'phone' ? 3.5 : 4.5);
  world.update(car.x, car.z, G.s, performance.now() + spare);
  world.updateFar(camera.position.x, y, camera.position.z);
  lampsFollow();
  hud.update(dt, scoring, car, gbShown, G.hourShown, G.dist, car.boost, SCORE.boostMax, perfLine);
  G.simMs = t1 - t0; G.worldMs = performance.now() - t1;
}

// the ground the camera keeps clear of: in a tunnel that is the road, not the hill over it
const camProbe = {};
function camGround(x, z) { const s = world.ground.sample(x, z, 2.2, camProbe); return s.tunnel ? -1e9 : s.h; }

function nightFollow() {
  if (!night.moon) return;
  if (night.fuji) { const f = night.fuji.userData.dir; night.fuji.position.set(camera.position.x + f[0] * 2900, camera.position.y - 700, camera.position.z + f[1] * 2900); }
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

/**
 * The light follows the clock smoothly. The clock shown chases the real one (a banked drift moves the real one
 * half an hour at once; the light gets there over a couple of seconds, easing in), and the sun, sky, haze and
 * fill are updated as often as the shown hour moves at all, which costs a few uniforms. Only the environment
 * map (a PMREM build, milliseconds) waits, and is rebuilt every two and a half seconds while the sky changes.
 */
let sunTimer = 0, envTimer = 0;
function applySun(dt, force = false) {
  let d = G.hour - G.hourShown;
  if (d > 12) d -= 24; else if (d < -12) d += 24;
  const move = force ? d : Math.sign(d) * Math.min(Math.abs(d), (0.02 + Math.abs(d) * 1.6) * dt);
  let shown = G.hourShown + move;
  if (shown >= 24) shown -= 24; else if (shown < 0) shown += 24;
  const elOf = (h) => Math.max(-12, 62 * Math.sin(Math.PI * (h - 6) / 12));
  sunTimer += dt; envTimer += dt;
  if (!force && G.sunApplied) {
    // (deep in the night the sky stops changing with the hour, but never with the rain or the map: it used to
    // stay starry and clear through a whole storm)
    const hourStill = Math.abs(shown - G.lastApplied) < 0.0025 || (elOf(shown) <= -12 && elOf(G.lastApplied) <= -12);
    const rainStill = Math.abs(W.rain - (G.lastRain ?? 0)) < 0.01 && G.lastMap === G.map;
    if (hourStill && rainStill) { G.hourShown = shown; return; }
  }
  G.hourShown = shown; sunTimer = 0;
  const full = force || envTimer > 2.5;
  if (full) envTimer = 0;
  G.lastApplied = shown; G.sunApplied = true; G.lastRain = W.rain; G.lastMap = G.map;
  rig.setOvercast(W.rain * 0.9);
  // the city's own light, thrown back by the haze and the cloud: magenta and sodium over the skyline at night
  rig.setGlow(G.map === 'city' ? CITY_GLOW : null, smoothstep(4, -3, elOf(shown)) * (0.75 + 0.3 * W.rain));
  const t = rig.setTime({ hour: shown }, { env: full });
  const el = t.elevation;
  const nightAmt = smoothstep(4, -3, el);
  G.night = nightAmt; night.amt = nightAmt;
  for (const hl of headlights) hl.intensity = 2.6 * nightAmt;
  if (night.moon) {
    night.moon.intensity = 0.85 * nightAmt;
    // (the moon's shadow map is drawn only while the moon gives light: by day it was a whole shadow pass a frame, the
    // car and everything near it drawn again for a light of intensity 0, about 100 draws; castShadow itself stays on,
    // as switching it recompiles every lit shader)
    night.moon.shadow.autoUpdate = night.moon.intensity > 0;
  }
  // (the night sky's pieces are not drawn at all while they are drawn at nothing, all day long: the horizon glow was two
  // draws a frame, each making three work its program out again, and the stars and the moon three more)
  if (night.glow) { night.glow.material.opacity = 0.42 * smoothstep(-0.5, -5, el); night.glow.visible = night.glow.material.opacity > 0; }
  if (night.tailGlow) night.tailGlow.intensity = 0.9 * nightAmt;
  if (rig.hemi && night.hemiDay) { G.hemiNow = night.hemiDay * (1 - 0.66 * nightAmt); rig.hemi.intensity = G.hemiNow + (G.flash || 0) * 1.8; }
  // cloud takes the stars and most of the moon
  const clear = 1 - W.rain;
  if (night.stars) { night.stars.material.opacity = 0.9 * smoothstep(-1, -6, el) * clear * clear * (night.starK ?? 1); night.stars.visible = night.stars.material.opacity > 0; }
  if (night.disc) {
    const { dm, halo } = night.disc.userData;
    dm.material.opacity = smoothstep(-1, -5, el) * (1 - 0.85 * W.rain); halo.material.opacity = 0.35 * smoothstep(-1, -5, el) * (1 - 0.6 * W.rain);
    dm.visible = dm.material.opacity > 0; halo.visible = halo.material.opacity > 0;
  }
  if (night.fuji) { night.fuji.material.transparent = true; night.fuji.material.opacity = 1 - 0.85 * W.rain; }
  // Fuji is drawn in the night's colours; by day the same mountain, lifted into daylight
  if (night.fuji) night.fuji.material.color.setRGB(lerp(2.5, 1, nightAmt), lerp(2.45, 1, nightAmt), lerp(2.2, 1, nightAmt));
  world.setNight(nightAmt);
  sunColor.copy(rig.sun.color).lerp(new THREE.Color(0.55, 0.65, 0.95), nightAmt);
  if (rig.fog) world.skylineTint(rig.fog.color, nightAmt);
}

// ---------------------------------------------------------------- the air
const CITY_GLOW = [0.34, 0.11, 0.2];
const _ahead = new THREE.Vector3(), _air = { cam: null, car: null, sun: sunColor, haze: null, ahead: _ahead }, _look = new THREE.Vector3();
/** A place for a firefly: over the verge beside the road somewhere ahead (never in a tunnel). */
function fireflySpot() {
  const s = G.s + Math.random() * 190 - 30;
  if (s < 5) return null;
  const p = track.sample(s);
  if (p.tunnel) return null;
  const side = Math.random() < 0.5 ? 1 : -1, w = side > 0 ? p.wl : p.wr;
  const u = (w + 1.5 + Math.random() * 15) * side, x = p.x + Math.cos(p.h) * u, z = p.z - Math.sin(p.h) * u;
  return [x, world.ground.height(x, z) + 0.4 + Math.random() * 2.4, z];
}
function airFollow(dt) {
  camera.getWorldDirection(_look);
  const pa = track.sample(G.s + 88 + Math.min(40, car.speed));
  _ahead.set(pa.x, pa.y, pa.z);
  _air.cam = camera.position; _air.car = car; _air.haze = rig.fog.color; _air.hazeLin = rig.atmos.uAtmHaze.value;
  _air.viewYaw = Math.atan2(_look.x, _look.z);
  _air.groundY = G.carY ?? pa.y; _air.carY = G.carY ?? pa.y;
  _air.night = G.night ?? 1; _air.rain = W.rain; _air.tunnel = G.tunnelK || 0; _air.spot = fireflySpot;
  atmos.flies.u.uScale.value = renderer.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360));
  const th = atmos.update(dt, _air);
  if (th && audio && G.mode === 'playing') audio.thunder && audio.thunder(th.delay, th.k);
  // the flash lights the sky, the haze on every far thing, and the world
  const f = atmos.bolt.flash * (1 - (G.tunnelK || 0));
  if (Math.abs(f - (G.flash || 0)) > 1e-3 || f > 0) {
    G.flash = f;
    rig.setFlash(f);
    if (rig.hemi && G.hemiNow !== undefined) rig.hemi.intensity = G.hemiNow + f * 1.8;
  }
}

/** The sea of cloud's state and the camera, for the cel pass's height fog and its motion blur. */
const _m4 = new THREE.Matrix4(), _vp = new THREE.Matrix4(), _lastCam = new THREE.Vector3(1e9, 0, 0);
function mistToPass() {
  const U = post.cel.uniforms, M = atmos ? atmos.mist : null;
  U.uCamPos.value.copy(camera.position);
  U.uCamRot.value.setFromMatrix4(camera.matrixWorld);
  const ty = Math.tan((camera.fov * Math.PI) / 360);
  U.uTanFov.value.set(ty * camera.aspect, ty);
  // motion blur: the last frame's camera, and none across a cut (a reset, a teleport, the title's first frame)
  const cut = camera.position.distanceTo(_lastCam) > 12;
  // (and none for a player who asked their system for less motion)
  U.uBlur.value = tier === 'phone' || cut || G.mode !== 'playing' || REDUCED_MOTION ? 0 : 0.5;
  // (by day the shade keeps its colour under the bands; see the cel pass)
  U.uLift.value = 1 - (G.night ?? 1);
  U.uPrevVP.value.copy(_vp);
  _vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _lastCam.copy(camera.position);
  const on = M && M.on && G.mode !== 'loading' ? 1 : 0;
  U.uMist.value.set(M ? M.top : -1e4, M ? M.density : 0, M ? M.soft : 14, on);
  if (!on) return;
  U.uMistCol.value.copy(M.col).addScalar(M.flash * 0.25);
  U.uMistGlow.value.copy(M.glow); U.uMistFar.value.copy(M.far);
  U.uMoonDir.value.copy(night.dir);
  U.uNoise.value = atmos.noise;
  U.uMistT.value = atmos.t;
}

/** Light shafts: the sun low in the sky, or the moon on a clear night, found on the screen for the cel pass. */
const _sv = new THREE.Vector3();
function shafts() {
  camera.updateMatrixWorld();
  mistToPass();
  const u = post.cel.uniforms.uShaft.value;
  u.z = 0;
  if (tier === 'phone' || !car || G.mode === 'loading') return;
  const clear = (1 - W.rain) * (1 - (G.tunnelK || 0));
  const nightAmt = G.night ?? 1;
  const el = rig.elevation;
  const sunK = (1 - nightAmt) * (0.12 + 0.5 * (1 - smoothstep(8, 32, el))) * clear;
  const moonK = nightAmt * 0.3 * clear * (G.map === 'city' ? 0.55 : 1);
  if (Math.max(sunK, moonK) < 0.01) return;
  const sun = sunK > moonK;
  _sv.copy(sun ? rig.sunDir : night.dir).multiplyScalar(1000).add(camera.position).project(camera);
  if (_sv.z > 1 || Math.abs(_sv.x) > 1.8 || Math.abs(_sv.y) > 1.8) return;
  u.set(_sv.x * 0.5 + 0.5, _sv.y * 0.5 + 0.5, (sun ? sunK : moonK) * (1 - smoothstep(1.1, 1.8, Math.max(Math.abs(_sv.x), Math.abs(_sv.y)))));
  if (sun) post.cel.uniforms.uShaftCol.value.copy(rig.sun.color).multiplyScalar(0.9);
  else post.cel.uniforms.uShaftCol.value.setRGB(0.42, 0.52, 0.85);
}

// ---------------------------------------------------------------- off the road

const _roadOut = {};
const K_ = CAR_SCALE;
const HIT_F = [-1.16 * K_, 0, 1.16 * K_], HIT_R = 1.0 * K_;
const _seen = new Set();
const COLL_TREES = new Set(['sakura', 'weeping', 'maple', 'broadleaf', 'bare', 'cedar', 'bamboo']);
const SMASH = { pole: ['BOLLARD!', 50], bollard: ['BOLLARD!', 50], shrub: ['FLATTENED!', 20], lamp: ['LIGHTS OUT!', 150], warn: ['SIGN DOWN!', 90],
  chevron: ['SIGN DOWN!', 90], mirror: ['MIRROR!', 90], vending: ['JACKPOT!', 300],
  bag: ['TRASH!', 15], box: ['TRASH!', 10], crate: ['CRATE!', 25], crates: ['CRATES!', 40], cone: ['CONE!', 25], aboard: ['MENU BOARD!', 40], bike: ['BIKE!', 80] };

/** Where a side of the road has its hard edge: the road's edge (a rail, a lining), further out (a street front), or none. */
function hardLine(q, side) {
  const p = track.pts[q.i], off = side > 0 ? p.hardL : p.hardR, w = side > 0 ? q.wl : q.wr;
  return off === undefined ? w : w + off;
}

/** What is under the car: the road (its height, grade and bank), or the ground beyond it and its slope. */
function floorUnderCar(n, beyond) {
  if (beyond < 0.3) {
    const ahead = track.sample(G.s + 1.2).y, behind = track.sample(Math.max(0, G.s - 1.2)).y;
    const bank = n.bank || 0;
    return { y: n.y - n.u * Math.tan(bank), grade: (ahead - behind) / 2.4, roll: -bank, onRoad: true, gx: 0, gz: 0, bank };
  }
  const H = (x, z) => world.ground.height(x, z);
  const s = Math.sin(car.yaw), c = Math.cos(car.yaw);
  const h0 = H(car.x, car.z);
  const hF = H(car.x + s * 1.2, car.z + c * 1.2), hB = H(car.x - s * 1.2, car.z - c * 1.2);
  const hL = H(car.x + c * 0.7, car.z - s * 0.7), hR = H(car.x - c * 0.7, car.z + s * 0.7);
  const gF = (hF - hB) / 2.4, gL = (hL - hR) / 1.4;
  // the car rests on its wheels: the floor is the higher of the centre and the axles' average
  return { y: Math.max(h0, (hF + hB) / 2, (hL + hR) / 2), grade: gF, roll: Math.atan(gL), onRoad: false, gx: gF * s + gL * c, gz: gF * c - gL * s };
}

/**
 * The car's height. It moves as a thrown body does and the floor holds it up. On the ground it rises and falls with
 * the floor at the rate the floor's slope gives along its travel, never at the rate the floor's height changed from
 * one frame to the next: a step or a kink in the ground (the verge's few centimetres, the lip of a bank) used to
 * hand the car its whole height as speed, and a small bump threw it into the air. Where the floor falls away faster
 * than gravity can follow (over a crest at speed, off a drop) the car floats clear of it; more than a hand's width
 * clear it is flying, with no grip until it lands. On the road it keeps to the asphalt.
 */
const AIR_GAP = 0.18;
function vertical(dt, fl) {
  if (!Number.isFinite(G.carY)) { G.carY = fl.y; G.vy = 0; }
  if (!Number.isFinite(G.vy)) G.vy = 0;
  const [vx, vz] = car.pointVelocity(0, 0);
  let rate;
  if (fl.onRoad) {
    const sh = Math.sin(G.roadH || 0), ch = Math.cos(G.roadH || 0);
    rate = fl.grade * (vx * sh + vz * ch) - Math.tan(fl.bank || 0) * (vx * ch - vz * sh);
  } else rate = fl.gx * vx + fl.gz * vz;
  // (the springs soak up a little of a climb, and a steep face lifts the car only so fast)
  rate = clamp(rate * (rate > 0 ? 0.85 : 1), -25, 5);
  if (fl.onRoad && !car.air) { G.carY = fl.y; G.vy = rate; return; }
  G.vy -= 16 * dt;
  G.carY += G.vy * dt;
  if (car.air) G.airT += dt;
  if (G.carY <= fl.y) {
    const v = rate - G.vy;                                  // how hard it meets the ground
    G.carY = fl.y; G.vy = Math.max(G.vy, rate);
    if (car.air) {
      car.air = false;
      if (v > 2.2 && G.airT > 0.12) {
        chase.kick(clamp(v / 14, 0.12, 0.8));
        susp.heaveV -= clamp(v * 0.09, 0.2, 1.4);
        audio.sfx('land', clamp(v / 10, 0.35, 1));
        for (const [l, f] of REAR.concat(FRONT)) { const [wx, wz] = car.point(l, f); for (let i = 0; i < 3; i++) particles.dust(wx, G.carY, wz, 0, 0, clamp(v / 8, 0.4, 1), sunColor); }
      }
    }
  } else if (!car.air && G.carY - fl.y > AIR_GAP) { car.air = true; G.airT = 0; }
}

/** The car against the things beside the road; returns the hardest hit on something solid. */
function collideProps() {
  if (car.air && G.carY - world.ground.height(car.x, car.z) > 1.3) return 0;
  let worst = 0;
  _seen.clear();
  const s = Math.sin(car.yaw), c = Math.cos(car.yaw);
  world.near(car.x, car.z, 3.4, (rec) => {
    if (_seen.has(rec) || (rec.y !== undefined && Math.abs(rec.y - G.carY) > 2.4)) return;
    for (const f of HIT_F) {
      const px = car.x + s * f, pz = car.z + c * f;
      let nx, nz, d;
      if (rec.box) {
        const ca = Math.cos(rec.ry), sa = Math.sin(rec.ry), dx = px - rec.x, dz = pz - rec.z;
        const bx = dx * ca - dz * sa, bz = dx * sa + dz * ca;
        let ex = bx - clamp(bx, -rec.hx, rec.hx), ez = bz - clamp(bz, -rec.hz, rec.hz), dist = Math.hypot(ex, ez);
        if (dist < 1e-4) {
          const ox = rec.hx - Math.abs(bx), oz = rec.hz - Math.abs(bz);
          if (ox < oz) { ex = Math.sign(bx) || 1; ez = 0; dist = -ox; } else { ex = 0; ez = Math.sign(bz) || 1; dist = -oz; }
        } else { ex /= dist; ez /= dist; }
        nx = ex * ca + ez * sa; nz = -ex * sa + ez * ca; d = HIT_R - dist;
      } else {
        const dx = px - rec.x, dz = pz - rec.z, dist = Math.hypot(dx, dz) || 1e-4;
        nx = dx / dist; nz = dz / dist; d = HIT_R + rec.r - dist;
      }
      if (d <= 0) continue;
      _seen.add(rec);
      const cxw = px - nx * HIT_R, czw = pz - nz * HIT_R, rx = cxw - car.x, rz = czw - car.z;
      const lC = rx * c - rz * s, fC = rx * s + rz * c;
      if (rec.kind === 'solid') worst = Math.max(worst, hitSolid(rec, nx, nz, Math.min(d, 0.6), lC, fC, cxw, czw));
      else if (rec.kind === 'knock') smash(rec, nx, nz, cxw, czw);
      else if (rec.kind === 'flat') flattenBush(rec, nx, nz, cxw, czw);
      break;
    }
  });
  return worst;
}

function hitSolid(rec, nx, nz, d, l, f, px, pz) {
  const v = car.hitWall(nx, nz, d, l, f);
  if (v > 2) {
    chase.kick(clamp(v / 12, 0.1, 0.8));
    const tree = rec.name === 'tree' || COLL_TREES.has(rec.name);
    if (tree) {
      // the canopy shakes out a burst of blossom and leaves
      const col = new THREE.Color(rec.colour ?? (world.city ? 0x5f8f3e : 0xf0a6bf));
      for (let i = 0; i < Math.min(26, 6 + v * 2); i++) particles.spawn({ x: rec.x + (Math.random() - 0.5) * 3, y: G.carY + 2.5 + Math.random() * 3, z: rec.z + (Math.random() - 0.5) * 3,
        vx: (Math.random() - 0.5) * 3, vy: 0.5 + Math.random() * 2, vz: (Math.random() - 0.5) * 3, life: 1.2 + Math.random() * 0.8, s0: 0.22, s1: 0.18,
        r: col.r, g: col.g, b: col.b, a0: 0.9, grav: 2.5, drag: 1.4 });
      audio.sfx('tree', clamp(v / 12, 0.3, 1));
    } else { particles.sparks(px, G.carY + 0.4, pz, nx, nz, v > 5 ? 18 : 8); audio.impact(v); }
  }
  return v;
}

function smash(rec, nx, nz, px, pz) {
  const [vx, vz] = car.pointVelocity(0, 0);
  const sp = Math.hypot(vx, vz);
  if (!world.knock(rec)) return;
  // flung along the car's travel and away from where it was struck
  let dx = (sp > 0.5 ? vx / sp : -nx) * 0.85 - nx * 0.4, dz = (sp > 0.5 ? vz / sp : -nz) * 0.85 - nz * 0.4;
  const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  const steel = rec.name === 'lamp' || rec.name === 'chevron' || rec.name === 'warn' || rec.name === 'mirror' || rec.name === 'vending' || rec.name === 'bike';
  // (thrown as the model its pool draws: a mirrored chevron scores as a chevron, but flies as the mirrored one it was)
  debris.spawn(world.parts[rec.pool] || world.parts[rec.name], world.foot[rec.pool] || world.foot[rec.name] || [0.3, 0.3, 1.5], rec, { px, pz, dx, dz, speed: Math.max(2, sp), trail: steel });
  // the car feels it by the thing's weight
  const share = rec.m / (1250 + rec.m);
  car.vF *= 1 - share * 1.6; car.vL *= 1 - share;
  // and the world stops for a blink and shakes
  G.hitStop = Math.max(G.hitStop || 0, 0.035 + Math.min(0.09, rec.m / 2600));
  chase.kick(0.08 + Math.min(0.45, rec.m / 400));
  const y = G.carY;
  if (rec.name === 'lamp' || rec.name === 'chevron' || rec.name === 'warn' || rec.name === 'mirror' || rec.name === 'vending') particles.sparks(px, y + 0.25, pz, -nx, -nz, rec.name === 'lamp' ? 26 : 14);
  if (rec.light) {
    // the bulb pops: a flash where it was
    for (let i = 0; i < 3; i++) particles.spawn({ x: rec.light.x, y: rec.light.y, z: rec.light.z, vx: 0, vy: 0, vz: 0, life: 0.22 + i * 0.05, s0: 3.2 - i * 0.8, s1: 0.4, r: 1, g: 0.85, b: 0.55, a0: 0.8, drag: 1 });
    particles.sparks(rec.light.x, rec.light.y, rec.light.z, dx, dz, 16);
  }
  if (rec.name === 'pole' || rec.name === 'bollard') for (let i = 0; i < 12; i++) {
    const red = i % 2;
    particles.spawn({ x: px, y: y + 0.4 + Math.random() * 0.6, z: pz, vx: vx * 0.5 + (Math.random() - 0.5) * 5, vy: 2 + Math.random() * 4, vz: vz * 0.5 + (Math.random() - 0.5) * 5,
      life: 0.8 + Math.random() * 0.5, s0: 0.14, s1: 0.1, r: red ? 0.9 : 0.96, g: red ? 0.12 : 0.95, b: red ? 0.1 : 0.92, a0: 1, grav: 14, drag: 0.8 });
  }
  // the street's trash bursts: scraps of paper and plastic out of a bag or a box, shards off a crate or a cone
  if (rec.name === 'bag' || rec.name === 'box' || rec.name === 'crate' || rec.name === 'crates' || rec.name === 'cone' || rec.name === 'aboard') {
    const col = new THREE.Color(rec.colour ?? (rec.name === 'cone' ? 0xe8641c : rec.name === 'box' || rec.name === 'aboard' ? 0xa47c50 : 0xd8d2c0));
    const n = rec.name === 'bag' ? 14 : 9;
    for (let i = 0; i < n; i++) {
      const paper = rec.name === 'bag' && i % 3 === 0;
      particles.spawn({ x: px, y: y + 0.3 + Math.random() * 0.4, z: pz, vx: dx * sp * 0.4 + (Math.random() - 0.5) * 5, vy: 2 + Math.random() * 4, vz: dz * sp * 0.4 + (Math.random() - 0.5) * 5,
        life: 0.8 + Math.random() * 0.7, s0: paper ? 0.17 : 0.12, s1: 0.1, r: paper ? 0.92 : col.r, g: paper ? 0.9 : col.g, b: paper ? 0.84 : col.b, a0: 1, grav: paper ? 5 : 13, drag: paper ? 1.8 : 0.7 });
    }
  }
  if (rec.name === 'vending') for (let i = 0; i < 16; i++) {
    const k = i % 3, col = [[0.85, 0.1, 0.12], [0.1, 0.35, 0.9], [0.95, 0.8, 0.2]][k];
    particles.spawn({ x: px, y: y + 1, z: pz, vx: dx * sp * 0.6 + (Math.random() - 0.5) * 6, vy: 3 + Math.random() * 5, vz: dz * sp * 0.6 + (Math.random() - 0.5) * 6,
      life: 1 + Math.random() * 0.6, s0: 0.16, s1: 0.14, r: col[0], g: col[1], b: col[2], a0: 1, grav: 14, drag: 0.6 });
  }
  audio.sfx(rec.name, clamp(sp / 16, 0.45, 1));
  smashScore(rec.name);
}

function flattenBush(rec, nx, nz, px, pz) {
  if (!rec.alive) return;
  world.retire(rec);
  const pool = world.pools[rec.pool];
  if (pool) debris.flatten(pool, rec.id, rec, -nx, -nz);
  const col = new THREE.Color(rec.colour ?? 0x7a9a3e);
  const [vx, vz] = car.pointVelocity(0, 0);
  for (let i = 0; i < 18; i++) particles.spawn({ x: rec.x + (Math.random() - 0.5), y: G.carY + 0.4 + Math.random() * 0.6, z: rec.z + (Math.random() - 0.5),
    vx: vx * 0.35 + (Math.random() - 0.5) * 4, vy: 1.5 + Math.random() * 3, vz: vz * 0.35 + (Math.random() - 0.5) * 4, life: 1 + Math.random() * 0.7,
    s0: 0.24, s1: 0.2, r: col.r, g: col.g, b: col.b, a0: 0.95, grav: 4, drag: 1.6 });
  car.vF *= 0.985;
  chase.kick(0.05);
  audio.sfx('shrub', clamp(car.speed / 14, 0.4, 1));
  smashScore('shrub');
}

function smashScore(name) {
  const [label, pts] = SMASH[name] || ['SMASH!', 40];
  const now = performance.now() / 1000;
  if (!G.smash || now - G.smash.t > 1.8) G.smash = { n: 0, total: 0, t: now };
  G.smash.n++; G.smash.t = now;
  const add = pts * Math.min(5, G.smash.n);
  G.smash.total += add; scoring.total += add;
  hud.smash(label, G.smash.total, G.smash.n);
}

/** The countdown while the car is off the road, and at zero the magnet. */
function offRoad(dt, n, beyond) {
  if (!G.off) {
    if (beyond > 0.35) G.off = { t: COURSE_OUT_S, s: n.s, side: n.u >= 0 ? 1 : -1, last: COURSE_OUT_S + 1 };
    return;
  }
  if (beyond < -0.4) { G.off = null; return; }
  const off = G.off;
  off.t -= dt;
  const sec = Math.ceil(off.t);
  if (sec !== off.last && sec >= 1) { off.last = sec; audio.sfx(sec <= 2 ? 'tickHot' : 'tick'); }
  if (off.t <= 0) startMagnet();
}

function startMagnet() {
  const off = G.off;
  const s = clamp(off.s - 4, START_S, track.sFinal - 30);
  const p = track.sample(s);
  const u = off.side * track.half * 0.3, lx = Math.cos(p.h), lz = -Math.sin(p.h);
  magnet.play({ x: car.x, y: G.carY, z: car.z, yaw: car.yaw }, { x: p.x + lx * u, y: p.y, z: p.z + lz * u, yaw: p.h });
  // the camera watches from behind the line of flight (or, a short hop, from behind the car as it was)
  const fdx = p.x + lx * u - car.x, fdz = p.z + lz * u - car.z;
  chase.cine = { dir: Math.hypot(fdx, fdz) > 6 ? Math.atan2(fdx, fdz) : car.yaw };
  G.magTo = { s };
  car.air = false; G.vy = 0;
  // a held drift is lost to the magnet
  if (scoring.active) { scoring.active = false; scoring.points = 0; scoring.mult = 1; scoring.time = 0; scoring.tier = 0; }
}

function carryByMagnet(mag) {
  // the camera comes round to the road's heading before the car is set down
  if (chase.cine && chase.cine.dir0 === undefined) chase.cine.dir0 = chase.cine.dir;
  if (chase.cine && mag.toYaw !== undefined) { let e = mag.toYaw - chase.cine.dir0; e = Math.atan2(Math.sin(e), Math.cos(e)); chase.cine.dir = chase.cine.dir0 + e * smoothstep(0.42, 0.8, mag.k || 0); }
  car.x = mag.x; car.z = mag.z; car.yaw = mag.yaw; car.vF = 0; car.vL = 0; car.omega = 0; car.air = false;
  car.extF = 0; car.extL = 0;
  G.carY = mag.y; G.vy = 0; G.floor = null;
  for (const e of mag.events) {
    if (e === 'grab') audio.sfx('grab');
    else if (e === 'clank') { audio.sfx('clank'); chase.kick(0.35); particles.sparks(car.x, mag.y + 1.1, car.z, 0, 0, 18); }
    else if (e === 'fly') audio.sfx('fly');
    else if (e === 'drop') audio.sfx('drop');
    else if (e === 'land') {
      audio.sfx('land'); chase.kick(0.45); susp.heaveV -= 0.9;
      for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; particles.spawn({ x: car.x + Math.cos(a) * 1.2, y: mag.y + 0.1, z: car.z + Math.sin(a) * 1.2, vx: Math.cos(a) * 5, vy: 0.6, vz: Math.sin(a) * 5, life: 0.7, s0: 0.5, s1: 1.4, r: 1, g: 0.95, b: 0.8, a0: 0.5, drag: 3 }); }
    } else if (e === 'done') audio.sfx('done');
  }
  if (mag.done) {
    const s = G.magTo.s;
    G.idx = track.index(s); G.s = s; G.lastS = s;
    car.vF = 7; G.off = null; G.magPose = null;
    chase.cine = null;
  }
}

/**
 * The car on the road: yaw and the road's grade on the root, the body rolling and pitching on springs driven
 * by the car's accelerations, low-passed first, so a tyre's buzz never reaches the screen.
 */
function placeCar(y, grade, dt, roll = 0, pose = null) {
  carRoot.position.set(car.x, y, car.z);
  carRoot.rotation.set(0, car.yaw, 0);
  carRoot.rotateX(-Math.atan(grade));
  if (roll) carRoot.rotateZ(roll);
  if (pose) { carRoot.rotateX(pose.pitch || 0); carRoot.rotateZ(pose.roll || 0); }
  const sq = pose ? pose.squash || 1 : 1;
  carRoot.scale.set(1 + (1 - sq) * 0.6, sq, 1 + (1 - sq) * 0.6);
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
  if (dt > 0) {
    // the heave: a landing compresses the springs and the body bounces back
    let rem = dt;
    while (rem > 1e-6) { const hh = Math.min(rem, 1 / 120); rem -= hh; susp.heaveV += (-170 * susp.heave - 13 * susp.heaveV) * hh; susp.heave += susp.heaveV * hh; }
    bodyPivot.position.y = 0.5 + clamp(susp.heave, -0.25, 0.2);
  }
  if (joints.hubFL) joints.hubFL.rotation.y = car.steer;
  if (joints.hubFR) joints.hubFR.rotation.y = car.steer;
  if (joints.wheelFL) joints.wheelFL.rotation.x = susp.spinF;
  if (joints.wheelFR) joints.wheelFR.rotation.x = susp.spinF;
  if (joints.wheelRL) joints.wheelRL.rotation.x = susp.spinR;
  if (joints.wheelRR) joints.wheelRR.rotation.x = susp.spinR;
  // the pop-ups flip up once the run is under way at night (with a little overshoot, as a motor stops), and fold
  // away by day; the headlights move up into them as they rise
  if (pops.list.length && dt > 0) {
    const want = (G.mode === 'playing' || G.mode === 'paused') && G.night > 0.3 ? 1 : 0;
    pops.t = clamp(pops.t + (want ? dt : -dt) / 0.45, 0, 1);
    const e = pops.t < 1 ? pops.t * pops.t * (3 - 2 * pops.t) * (1 + 0.12 * Math.sin(pops.t * Math.PI)) : 1;
    for (const p of pops.list) p.rotation.x = pops.open * e;
    if (pops.lamp && headlights) headlights.forEach((hl, i) => {
      const sg = i === 0 ? -1 : 1;
      hl.position.set(lerp(sg * 0.6, sg * Math.abs(pops.lamp[0]), e), lerp(0.22, pops.lamp[1] - 0.5, e), lerp(2.0, pops.lamp[2], e));
    });
  }
}

function effects(dt, y, boost01) {
  const slip = car.slipRear;
  const onRoad = car.surface > 0.9;
  const [lx, lz] = car.left();
  const [fx, fz] = car.forward();
  const vx = fx * car.vF + lx * car.vL, vz = fz * car.vF + lz * car.vL;
  // across the car's travel: a mark starts at the width of the tyre's path (the car's own left when it is barely moving)
  const vl = Math.hypot(vx, vz), ax = vl > 0.5 ? vz / vl : lx, az = vl > 0.5 ? -vx / vl : lz;
  // nothing is laid on the ground while the car flies or hangs from the magnet
  const lifted = car.air || magnet.active;
  const mark = (i, wx, wz, a) => {
    let wy = y;
    if (a > 0.03) {
      const q = track.nearest(wx, wz, G.idx), au = Math.abs(q.u);
      wy = q.y - q.u * Math.tan(q.bank || 0) + (au < track.half ? 0.012 * (1 - au / track.half) : 0);
    }
    skids.add(i, wx, wy + 0.025, wz, ax, az, a, 0.19);
  };
  REAR.forEach(([l, f], i) => {
    const [wx, wz] = car.point(l, f);
    if (lifted) { skids.add(i, wx, y, wz, ax, az, 0, 0.19); return; }
    const a = onRoad ? clamp(slip * 1.2 + (car.hand ? 0.5 : 0) * clamp(car.speed / 8, 0, 1), 0, 1) : 0;
    mark(i, wx, wz, a);
    // (at night the smoke pouring past the tail lamps catches their red; in the city, some of the neon too)
    if (a > 0.25 && car.speed > 6 && Math.random() < a * 0.9) particles.smoke(wx, y, wz, vx, vz, a, _smoke.copy(sunColor).lerp(G.map === 'city' && Math.random() < 0.4 ? _neonSmoke : _tailSmoke, 0.32 * (G.night || 0)));
    // on a wet road the tyres throw spray
    if (W.wet > 0.3 && onRoad && car.speed > 8 && Math.random() < W.wet * 0.55) particles.spray(wx, y, wz, vx, vz, W.wet * clamp(car.speed / 30, 0, 1), sunColor);
    if (!onRoad && car.speed > 4 && Math.random() < 0.45) particles.dust(wx, y, wz, vx, vz, clamp(car.speed / 20, 0, 1), sunColor);
  });
  FRONT.forEach(([l, f], i) => {
    const [wx, wz] = car.point(l, f);
    const a = lifted ? 0 : onRoad && car.hand ? clamp(car.speed / 10, 0, 0.8) : (onRoad ? car.slipFront * 0.7 : 0);
    mark(2 + i, wx, wz, a);
  });
  G.popFlame = Math.max(0, (G.popFlame || 0) - dt * 9);
  flame.update(dt, Math.max(boost01, G.popFlame), boost01 >= G.popFlame ? 1 : 0.1);
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
  // (the lights go to the lamps round a point some way ahead of the car, where the lens is looking, so a lamp's
  // pool of light comes up well before the car reaches it rather than as it does)
  const [lfx, lfz] = car.forward();
  const ax = car.x + lfx * 34, az = car.z + lfz * 34;
  for (let i = 0; i < L.length; i++) {
    const d = (L[i].x - ax) ** 2 + (L[i].z - az) ** 2;
    if (n < k + 1) { let j = n++; while (j > 0 && pickD[j - 1] > d) { pickD[j] = pickD[j - 1]; pickIdx[j] = pickIdx[j - 1]; j--; } pickD[j] = d; pickIdx[j] = i; }
    else if (d < pickD[k]) { let j = k; while (j > 0 && pickD[j - 1] > d) { pickD[j] = pickD[j - 1]; pickIdx[j] = pickIdx[j - 1]; j--; } pickD[j] = d; pickIdx[j] = i; }
  }
  const cut = Math.min(95, n > k ? Math.sqrt(pickD[k]) : 95);
  for (let j = 0; j < k; j++) {
    const pl = lampLights[j];
    if (j >= n) { pl.intensity = 0; continue; }
    const l = L[pickIdx[j]], d = Math.sqrt(pickD[j]);
    const fade = 1 - smoothstep(cut * 0.6, cut, d);
    pl.position.set(l.x, l.y, l.z);
    const col = l.color || 0xffa040;
    if (pl.userData.col !== col) { pl.color.setHex(col); pl.userData.col = col; }
    // (the lamps are dimmer than they were, and dimmer still in the rain, when the wet road throws every one back)
    pl.intensity = (l.tunnel ? 110 : (l.power || 330) * 0.8 * Math.max(G.night, 0.12) * (1 - 0.3 * W.wet)) * fade;
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
