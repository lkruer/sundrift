/**
 * SUNDRIFT — boot, the frame loop, and the contract the harness steers by.
 *
 * window.__GAME__ is refreshed every frame: `pos` in metres (the gate drives by it), `fps` from REAL elapsed
 * time (a counter that divides by a clamped delta is pinned to a constant), draws and tris straight from
 * renderer.info. The start button is #startb and it is the only way the game starts.
 */
import * as THREE from 'three';
import { ASSET, bakeStatic } from '../assetlib.js?v=202609220343';
import { createRig, detectTier } from '../rig.js?v=202609220343';
import { PAL, ROAD, QUALITY, SCORE, MAX_DT, clamp, damp, smoothstep } from './config.js?v=202609220343';
import { Car, gearbox } from './car.js?v=202609220343';
import { Track } from './track.js?v=202609220343';
import { World } from './world.js?v=202609220343';
import { ChaseCam } from './camera.js?v=202609220343';
import { Input } from './input.js?v=202609220343';
import { Scoring } from './scoring.js?v=202609220343';
import { Hud } from './hud.js?v=202609220343';
import { Audio } from './audio.js?v=202609220343';
import { SkidMarks, Particles, ExhaustFlame } from './fx.js?v=202609220343';
import { makePost } from './post.js?v=202609220343';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const loadEl = $('load'), barf = $('barf'), loadmsg = $('loadmsg');

const G = {
  playing: false, over: false, hour: 20.6, hourShown: 0, lastSunApply: 0,
  fps: 60, frameAvg: 1 / 60, s: 0, u: 0, idx: 0, dist: 0, lastS: 0, boostMax: SCORE.boostMax, night: 0,
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
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.4, 4500);
scene.add(camera);
const rig = createRig(THREE, renderer, scene, { hour: G.hour, azimuth: 235, tier, fogStart: 55, fogDensity: 0.0013, exposure: 1.05, post: false });
const post = makePost(renderer, scene, camera, { bloom: tier !== 'phone', width: innerWidth, height: innerHeight });
// the composer renders several passes; count the whole frame for the telemetry, the way the rig's own post did
renderer.info.autoReset = false;

let track, world, car, carRoot, joints, chase, input, scoring, hud, audio, skids, particles, flame, headlights, beams;
const lampLights = [];
const night = { moon: null, stars: null, disc: null, dir: new THREE.Vector3(0.35, 0.6, -0.72).normalize(), amt: 0 };

/** The night's own light: a cool moon with a shadow box around the car, stars, and a moon disc. */
function buildNight() {
  const moon = new THREE.DirectionalLight(0x6f8fd8, 0);
  moon.castShadow = Q.shadow;
  const sm = tier === 'phone' ? 1024 : 1536;
  moon.shadow.mapSize.set(sm, sm);
  moon.shadow.camera.near = 1; moon.shadow.camera.far = 120;
  moon.shadow.bias = -0.0008; moon.shadow.normalBias = 0.04;
  const r = 34; const c = moon.shadow.camera; c.left = -r; c.right = r; c.top = r; c.bottom = -r; c.updateProjectionMatrix();
  scene.add(moon); scene.add(moon.target);
  night.moon = moon;
  // stars: a point cloud on a far sphere that follows the camera
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
  // the moon disc with a soft halo
  const disc = new THREE.Group();
  const dm = new THREE.Mesh(new THREE.CircleGeometry(38, 24), new THREE.MeshBasicMaterial({ color: 0xfff4dc, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  const halo = new THREE.Mesh(new THREE.CircleGeometry(120, 24), new THREE.MeshBasicMaterial({ color: 0x9fb4e0, transparent: true, opacity: 0, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.z = -1;
  disc.add(halo, dm); disc.userData = { dm, halo };
  scene.add(disc); night.disc = disc;
  // a showroom key for the start screen, so the hero is lit before the first lamp
  const hero = new THREE.SpotLight(0xffd9a0, 0, 24, 0.7, 0.6, 1.2);
  hero.castShadow = false;
  scene.add(hero); scene.add(hero.target); night.hero = hero;
  // horizon glow: a band around the camera, warm at the horizon fading into the blue, the retro night sky
  const H = 420, R = 2300, seg = 48;
  const gpos = new Float32Array((seg + 1) * 2 * 3), gcol = new Float32Array((seg + 1) * 2 * 4), gidx = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2, x = Math.sin(a) * R, z = Math.cos(a) * R;
    gpos.set([x, -40, z, x, H, z], i * 6);
    gcol.set([0.95, 0.55, 0.28, 0.55, 0.35, 0.35, 0.7, 0.0], i * 8);
    if (i < seg) { const b0 = i * 2; gidx.push(b0, b0 + 2, b0 + 1, b0 + 1, b0 + 2, b0 + 3); }
  }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.BufferAttribute(gpos, 3)); gg.setAttribute('color', new THREE.BufferAttribute(gcol, 4)); gg.setIndex(gidx);
  const glow = new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.frustumCulled = false; glow.renderOrder = -1;
  scene.add(glow); night.glow = glow;
  night.hemiDay = rig.hemi ? rig.hemi.intensity : 1;
}

// ---------------------------------------------------------------- boot
async function boot() {
  const prog = (f, msg) => { barf.style.width = (f * 100).toFixed(0) + '%'; if (msg) loadmsg.textContent = msg; };
  prog(0.02, 'laying the road');
  track = new Track(ROAD.seed);
  track.ensure(900);
  world = new World(scene, track, Q);
  await world.load((f, k) => prog(0.05 + f * 0.6, k.replace('_', ' ')));
  prog(0.68, 'the car');
  await buildCar();
  buildNight();
  prog(0.8, 'the mountain');
  car = new Car();
  const start = track.sample(8);
  car.reset(start.x, start.z, start.h);
  world.prime(8);
  chase = new ChaseCam(camera);
  chase.snap(car, start.y);
  input = new Input();
  scoring = new Scoring();
  hud = new Hud();
  audio = new Audio();
  skids = new SkidMarks(scene, Q.skid);
  particles = new Particles(scene, Q.smoke);
  particles.setScale(innerHeight);
  rig.refresh(scene);
  // compile every shader variant now, not on the first frame that needs it
  world.mapleMat(PAL.mapleRed); world.mapleMat(PAL.mapleGold);
  world.precompile(renderer, camera, (root) => rig.refresh(root));
  try { renderer.compile(scene, camera); } catch (e) { console.warn('compile', e.message); }
  window.__DEBUG__ = { world, track, car, rig, scene, renderer, G, chase, audio, post, get scoring() { return scoring; },
    // put the car on the centreline at distance s, facing along the road, camera snapped: for the critic's fixed views
    teleport(s, kmh = 0) {
      const p = track.sample(s);
      car.reset(p.x, p.z, p.h); car.vF = kmh / 3.6;
      G.idx = track.index(s); G.s = s; G.lastS = s;
      world.prime(s); chase.snap(car, p.y); placeCar(p.y, 0);
      return p;
    } };
  input.onAny = () => audio.unlock();
  hud.setBest(scoring.best);
  prog(1, 'ready');
  setTimeout(() => { loadEl.style.display = 'none'; $('start').classList.add('on'); }, 250);
  window.__START__ = startGame;
  $('startb').addEventListener('click', startGame);
  $('startb').addEventListener('touchend', (e) => { e.preventDefault(); startGame(); }, { passive: false });
  $('mute').addEventListener('click', () => { audio.unlock(); audio.setMuted(!audio.muted); $('mute').classList.toggle('off', audio.muted); });
  $('mute').classList.toggle('off', audio.muted);
  $('restart').addEventListener('click', restartRun);
  window.__READY__ = true;
}

async function buildCar() {
  const obj = await ASSET('./assets/hero_coupe.js', { keepHierarchy: true });
  joints = obj.userData.joints || {};
  // paint gets a clearcoat; the rig gives it a sky to reflect. Glass gets a little transmission-free gloss.
  const upgraded = new Map();
  const upgrade = (m) => {
    if (!m || !m.color) return m;
    if (upgraded.has(m)) return upgraded.get(m);
    let out = m;
    if (m.emissive && m.emissiveIntensity > 0 && m.emissive.getHex() !== 0) {
      out = m.clone();
      out.emissiveIntensity = m.emissive.getHex() === PAL.tailRed ? 6.0 : 2.6;
      upgraded.set(m, out); return out;
    }
    if (m.name === 'paint' || m.color.getHex() === PAL.pearl) {
      out = new THREE.MeshPhysicalMaterial({ color: m.color, roughness: 0.2, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.2 });
      out.name = 'paint';
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
  // bake the still parts per joint: the body into one mesh per material, and each wheel into its own few
  // meshes in the wheel's own frame, so the pivots keep working and the car is a few dozen draws, not 150
  obj.updateMatrixWorld(true);
  const bakeInto = (node, parent) => {
    const baked = bakeStatic(node);
    const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
    baked.traverse((o) => { if (o.isMesh) { o.geometry.applyMatrix4(inv); o.castShadow = true; o.receiveShadow = true; } });
    return baked;
  };
  const bodyNode = obj.getObjectByName('body');
  if (bodyNode) {
    const baked = bakeInto(bodyNode, obj);
    bodyNode.parent.remove(bodyNode);
    obj.add(baked);
  }
  for (const key of ['wheelFL', 'wheelFR', 'wheelRL', 'wheelRR']) {
    const w = joints[key]; if (!w) continue;
    const baked = bakeInto(w, w);
    for (const c of [...w.children]) w.remove(c);
    for (const c of [...baked.children]) w.add(c);
  }
  obj.updateMatrixWorld(true);
  carRoot = obj;
  scene.add(carRoot);
  flame = new ExhaustFlame(carRoot);
  flame.set(0.42, 0.28, -2.15);
  // headlights for dusk
  headlights = [];
  for (const x of [-0.6, 0.6]) {
    const sp = new THREE.SpotLight(0xf6f8ff, 0, 52, 0.56, 0.55, 1.3);
    sp.position.set(x, 0.7, 2.0);
    sp.target.position.set(x * 1.5, 0.1, 30);
    carRoot.add(sp); carRoot.add(sp.target);
    headlights.push(sp);
  }
  for (let i = 0; i < (tier === 'phone' ? 3 : 5); i++) {
    const pl = new THREE.PointLight(0xffa040, 0, 26, 2.0);
    scene.add(pl); lampLights.push(pl);
  }
  // fake volumetric beams: two additive cones ahead of the lamps, the way arcade racers draw headlights
  beams = new THREE.Group();
  const beamGeo = new THREE.ConeGeometry(2.1, 18, 14, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 9);
  {
    const pos = beamGeo.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { const t = 1 - Math.min(1, Math.max(0, pos.getZ(i) / 18)); const v = t * t; col[i * 3] = v; col[i * 3 + 1] = v; col[i * 3 + 2] = v; }
    beamGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xf0f4ff, vertexColors: true, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  for (const x of [-0.6, 0.6]) {
    const b = new THREE.Mesh(beamGeo, beamMat);
    b.position.set(x, 0.62, 2.1); b.rotation.x = 0.04;
    beams.add(b);
  }
  beams.userData.mat = beamMat;
  carRoot.add(beams);
  // spill: the road around the car is lit by its own lamps, so the hero always sits inside light
  const spill = new THREE.PointLight(0xfff1dc, 0, 16, 1.6);
  spill.position.set(0, 0.5, 1.4);
  carRoot.add(spill); night.spill = spill;
  const tailGlow = new THREE.PointLight(0xff3020, 0, 7, 1.8);
  tailGlow.position.set(0, 0.55, -2.4);
  carRoot.add(tailGlow); night.tailGlow = tailGlow;
}

function startGame() {
  if (G.playing) return;
  $('start').classList.remove('on');
  document.body.classList.add('playing');
  if (night.hero) night.hero.intensity = 0;
  chase.snap(car, track.sample(G.s || 8).y);
  hud.show(true);
  audio.unlock();
  G.playing = true;
  hud.toast('DRIFT THE NIGHT AWAY', 'good', true);
}

function restartRun() {
  scoring.reset();
  const start = track.sample(8);
  car.reset(start.x, start.z, start.h);
  G.idx = 0; G.dist = 0; G.lastS = 8; G.hour = 20.6;
  chase.snap(car, start.y);
  hud.toast('NEW RUN', '', false);
}

// ---------------------------------------------------------------- frame
let last = performance.now();
const CORNERS = [[0.86, 2.2], [-0.86, 2.2], [0.86, -2.25], [-0.86, -2.25]];   // (left, forward) of the four corners
const REAR = [[0.75, -1.32], [-0.75, -1.32]], FRONT = [[0.75, 1.18], [-0.75, 1.18]];
const sunColor = new THREE.Color(1, 0.9, 0.8);
let perfLine = '';

function frame(now) {
  requestAnimationFrame(frame);
  const real = Math.max(1e-4, (now - last) / 1000);
  last = now;
  // fps from real elapsed time, smoothed
  G.frameAvg = G.frameAvg * 0.9 + real * 0.1;
  G.fps = Math.round(1 / G.frameAvg);
  const dt = Math.min(real, MAX_DT);

  if (G.playing) step(dt);
  else idle(dt);

  renderer.info.reset();
  rig.update(camera, dt);
  post.cel.uniforms.uSpeed.value = car ? clamp((car.speed - 8) / 32, 0, 1) * (1 + 0.6 * clamp(car.boost / 1.2, 0, 1)) : 0;
  post.render(dt);

  const g = window.__GAME__;
  g.pos[0] = car ? car.x : 0; g.pos[1] = car ? car.z : 0;
  g.fps = G.fps; g.speed = car ? Math.round(car.speed * 10) / 10 : 0; g.score = scoring ? scoring.total : 0; g.over = false;
  g.draws = renderer.info.render.calls; g.tris = renderer.info.render.triangles;
  if (car) { g.drift = scoring.active ? 1 + scoring.tier : 0; g.combo = scoring.chain; g.slip = Math.round(car.beta * 180 / Math.PI); g.heading = car.yaw; g.progress = Math.round(G.s); g.lat = Math.round(G.u * 100) / 100; g.roadHeading = track.pts[G.idx].h; g.curvAhead = Math.round(track.sample(G.s + 22).k * 1000) / 1000; g.walls = [track.pts[G.idx].wl, track.pts[G.idx].wr]; g.kmh = Math.round(car.kmh); g.boost = Math.round(car.boost * 10) / 10; g.hour = Math.round(G.hour * 100) / 100; }
  if (hud && hud.perfOn) perfLine = `${G.fps} fps  ${g.draws} draws  ${(g.tris / 1000).toFixed(0)}k tris  ${tier}`;
}

// before the start: the camera circles the car slowly, low and close, the hero shot
let orbitT = 0.6;
function idle(dt) {
  if (!car) return;
  const y = track.sample(G.s || 8).y;
  orbitT += dt * 0.16;
  const a = car.yaw + Math.PI + Math.sin(orbitT) * 1.15;
  const d = 5.6;
  camera.position.set(car.x + Math.sin(a) * d, y + 1.35 + 0.25 * Math.cos(orbitT * 0.7), car.z + Math.cos(a) * d);
  camera.up.set(0, 1, 0);
  camera.lookAt(car.x, y + 0.55, car.z);
  if (night.hero) {
    night.hero.intensity = 160;
    night.hero.position.set(car.x - Math.sin(car.yaw + 0.6) * 6, y + 6, car.z - Math.cos(car.yaw + 0.6) * 6);
    night.hero.target.position.set(car.x, y + 0.6, car.z); night.hero.target.updateMatrixWorld();
  }
  if (Math.abs(camera.fov - 48) > 0.1) { camera.fov = 48; camera.updateProjectionMatrix(); }
  placeCar(y, 0);
  world.updateFar(car.x, y, car.z);
  nightFollow();
  if (!G.sunOnce) { G.sunOnce = true; applySun(10); }
}

function step(dt) {
  const inp = input.sample(dt);
  // ---- where on the road are we
  const n = track.nearest(car.x, car.z, G.idx);
  G.idx = n.i; G.s = n.s; G.u = n.u;
  const p = n.p;
  const au = Math.abs(n.u);
  const surface = au < ROAD.halfWidth ? 1 : au < ROAD.halfWidth + 0.9 ? 0.7 : 0.35;
  inp.line = { roadHeading: p.h, lat: n.u, curv: track.sample(G.s + 12 + car.speed * 0.55).k };
  car.step(dt, inp, surface);

  // ---- walls: the rail on the valley side, the cutting on the mountain side, the tunnel lining
  let impact = 0, clipping = false;
  for (const [l, f] of CORNERS) {
    const [cx, cz] = car.point(l, f);
    const q = track.nearest(cx, cz, G.idx);
    const wl = q.p.wl, wr = q.p.wr;
    const lx = Math.cos(q.p.h), lz = -Math.sin(q.p.h);
    if (q.u > wl) impact = Math.max(impact, car.hitWall(-lx, -lz, q.u - wl, l, f));
    else if (q.u < -wr) impact = Math.max(impact, car.hitWall(lx, lz, -wr - q.u, l, f));
    else if (f < 0) {
      const gap = Math.min(wl - q.u, q.u + wr);
      if (gap < SCORE.clipDist && Math.abs(car.beta) > SCORE.minSlip) clipping = true;
    }
  }
  if (impact > 1.5) {
    chase.kick(clamp(impact / 10, 0.15, 1));
    const [cx, cz] = car.point(0, 0);
    const side = G.u > 0 ? 1 : -1;
    const [px, pz] = car.point(side * 0.9, impact > 4 ? 0 : 1.5);
    particles.sparks(px, p.y + 0.3, pz, -Math.cos(p.h) * side, Math.sin(p.h) * side, impact > 5 ? 22 : 8);
    if (impact > 2.5 && impact <= SCORE.crashSpeed) audio.impact(impact);
  }

  // ---- scoring and boost
  scoring.update(dt, car, impact, clipping);
  const grant = scoring.takeBoost();
  if (grant > 0) { car.boost = Math.min(SCORE.boostMax, car.boost + grant); chase.kick(0.25); }
  for (const e of scoring.drain()) {
    hud.onEvent(e); audio.onEvent(e);
    if (e.type === 'bank') {
      // the sun moves with the score: a banked drift pushes the day on, and a big one swings the shadows
      G.hour += e.value / 6000;
    }
    if (e.type === 'crash') chase.kick(0.9);
  }
  const boost01 = clamp(car.boost / 1.2, 0, 1);

  // ---- distance, time of day
  const ds = Math.max(0, G.s - G.lastS); G.lastS = G.s;
  if (ds < 50) { G.dist += ds; scoring.stats.distance = G.dist; }
  // the clock runs slowly with distance too, fast through the night and the flat middle of the day, slow
  // through the golden hour that the game is about
  const h = G.hour;
  const rate = (h >= 7.2 && h < 16.6) ? 7 : 1;
  G.hour += ds / 3000 * rate;
  if (G.hour >= 24) { G.hour -= 24; }
  // the day's two moments, called out once each
  const crossed = (edge) => h < edge && G.hour >= edge;
  if (crossed(18.05)) { const e = { type: 'sun', value: 'SUNSET' }; hud.onEvent(e); audio.onEvent(e); }
  if (crossed(5.95)) { const e = { type: 'sun', value: 'SUNRISE' }; hud.onEvent(e); audio.onEvent(e); }
  applySun(dt);

  // ---- car placement, fx, audio
  const road = track.sample(G.s);
  const gradeAhead = track.sample(G.s + 3).y, gradeBehind = track.sample(Math.max(0, G.s - 3)).y;
  const grade = (gradeAhead - gradeBehind) / 6;
  placeCar(road.y, grade);
  effects(dt, road.y, boost01);
  const gb = gearbox(car.vF, car.throttle, G.gear);
  G.gear = gb;
  audio.update(dt, car, gb.rpm, scoring.active, boost01, surface);

  // ---- camera, world
  chase.update(dt, car, road.y, (x, z) => track.groundAt(x, z, G.idx), boost01, input.zoom);
  nightFollow();
  world.update(G.s, car.x, car.z);
  world.updateFar(car.x, road.y, car.z);
  hud.update(dt, scoring, car, G.hour, G.dist, car.boost, SCORE.boostMax, perfLine);
}

function nightFollow() {
  if (!night.moon) return;
  if (night.stars) night.stars.position.copy(camera.position);
  if (night.glow) night.glow.position.set(camera.position.x, camera.position.y - 60, camera.position.z);
  if (night.disc) {
    night.disc.position.copy(camera.position).addScaledVector(night.dir, 2400);
    night.disc.lookAt(camera.position);
  }
  // the moon key sits over the car; snapped to texels so the shadow edges do not crawl
  const texel = 68 / (tier === 'phone' ? 1024 : 1536);
  const sx = Math.round(car.x / texel) * texel, sz = Math.round(car.z / texel) * texel;
  const m = night.moon;
  m.position.set(sx + night.dir.x * 60, carRoot.position.y + night.dir.y * 60, sz + night.dir.z * 60);
  m.target.position.set(sx, carRoot.position.y, sz);
  m.target.updateMatrixWorld();
}

let sunTimer = 0;
function applySun(dt) {
  sunTimer += dt;
  // setTime rebuilds the sky (about 25 ms), so it is throttled: every 2.5 s, or sooner after a big bank
  const moved = Math.abs(G.hour - G.hourShown);
  // below the rig's own clamp of -12 degrees the sky does not change at all, so a rebuild (30 ms) is skipped
  const elOf = (h) => Math.max(-12, 62 * Math.sin(Math.PI * (h - 6) / 12));
  if (elOf(G.hour) <= -12 && elOf(G.hourShown) <= -12 && G.sunApplied) return;
  if (sunTimer < 2.5 && moved < 0.12) return;
  if (moved < 0.004) return;
  sunTimer = 0; G.hourShown = G.hour; G.sunApplied = true;
  const t = rig.setTime({ hour: G.hour });
  const el = t.elevation;
  // headlights and lamps come on as the sun goes
  const nightAmt = smoothstep(4, -3, el);
  G.night = nightAmt; night.amt = nightAmt;
  for (const h of headlights) h.intensity = 110 * nightAmt;
  if (beams) beams.userData.mat.opacity = 0.09 * nightAmt;
  if (night.moon) night.moon.intensity = 0.85 * nightAmt;
  if (night.glow) night.glow.material.opacity = 0.42 * smoothstep(-0.5, -5, el);
  if (night.spill) night.spill.intensity = 22 * nightAmt;
  if (night.tailGlow) night.tailGlow.intensity = 6 * nightAmt;
  if (rig.hemi && night.hemiDay) rig.hemi.intensity = night.hemiDay * (1 - 0.66 * nightAmt);
  // the sun's cascaded shadow maps are pure cost once the sun is down: stop refreshing them until dawn
  const sunDown = nightAmt > 0.98;
  if (sunDown !== G.sunDown) {
    G.sunDown = sunDown;
    scene.traverse((o) => {
      if (!o.isDirectionalLight || o === night.moon || !o.shadow) return;
      o.shadow.autoUpdate = !sunDown;
      if (!sunDown) o.shadow.needsUpdate = true;
    });
  }
  if (night.stars) night.stars.material.opacity = 0.9 * smoothstep(-1, -6, el);
  if (night.disc) { night.disc.userData.dm.material.opacity = smoothstep(-1, -5, el); night.disc.userData.halo.material.opacity = 0.35 * smoothstep(-1, -5, el); }
  world.setNight(nightAmt);
  sunColor.copy(rig.sun.color).lerp(new THREE.Color(0.55, 0.65, 0.95), nightAmt);
}

function placeCar(y, grade) {
  carRoot.position.set(car.x, y, car.z);
  carRoot.rotation.set(0, car.yaw, 0);
  // body: pitch with the grade and the throttle, lean with lateral g
  const pitch = -Math.atan(grade) - clamp(car.accF, -9, 9) * 0.006;
  const roll = clamp(car.accL, -12, 12) * 0.011;
  carRoot.rotateX(pitch);
  carRoot.rotateZ(roll);
  if (joints.hubFL) joints.hubFL.rotation.y = car.steer;
  if (joints.hubFR) joints.hubFR.rotation.y = car.steer;
  if (joints.wheelFL) joints.wheelFL.rotation.x = car.wheelSpin;
  if (joints.wheelFR) joints.wheelFR.rotation.x = car.wheelSpin;
  if (joints.wheelRL) joints.wheelRL.rotation.x = car.rearSpin;
  if (joints.wheelRR) joints.wheelRR.rotation.x = car.rearSpin;
}

function effects(dt, y, boost01) {
  // skid marks and smoke from the rears while they slip, dust off the road
  const slip = car.slipRear;
  const onRoad = car.surface > 0.9;
  const [lx, lz] = car.left();
  const [fx, fz] = car.forward();
  const vx = fx * car.vF + lx * car.vL, vz = fz * car.vF + lz * car.vL;
  REAR.forEach(([l, f], i) => {
    const [wx, wz] = car.point(l, f);
    const a = onRoad ? clamp(slip * 1.2 + (car.hand ? 0.5 : 0) * clamp(car.speed / 8, 0, 1), 0, 1) : 0;
    skids.add(i, wx, y + 0.02, wz, lx, lz, a);
    if (a > 0.25 && car.speed > 6 && Math.random() < a * 0.9) particles.smoke(wx, y, wz, vx, vz, a, sunColor);
    if (!onRoad && car.speed > 4 && Math.random() < 0.6) particles.dust(wx, y, wz, vx, vz, clamp(car.speed / 20, 0, 1));
  });
  FRONT.forEach(([l, f], i) => {
    const [wx, wz] = car.point(l, f);
    const a = onRoad && car.hand ? clamp(car.speed / 10, 0, 0.8) : (onRoad ? car.slipFront * 0.7 : 0);
    skids.add(2 + i, wx, y + 0.02, wz, lx, lz, a);
  });
  // boost flame and a backfire on lift
  flame.update(dt, boost01);
  if (boost01 > 0.05 && Math.random() < 0.7) {
    const [ex, ez] = car.point(0.42, -2.2);
    particles.flame(ex, y + 0.28, ez, -fx, -fz, boost01);
  }
  particles.update(dt);
  // lamp lights: the pool goes to the nearest lamps at night
  if (G.night > 0.02 || world.inTunnel(G.s)) {
    const near = world.lamps.map((l) => ({ l, d: (l.x - car.x) ** 2 + (l.z - car.z) ** 2 })).sort((a, b) => a.d - b.d);
    lampLights.forEach((pl, i) => {
      const e = near[i];
      if (!e || e.d > 70 * 70) { pl.intensity = 0; return; }
      pl.position.set(e.l.x, e.l.y, e.l.z);
      pl.intensity = e.l.tunnel ? 110 : 340 * Math.max(G.night, 0.12);
    });
  } else lampLights.forEach((pl) => { pl.intensity = 0; });
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
