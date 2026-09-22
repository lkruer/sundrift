/**
 * SUNDRIFT — boot, the frame loop, and the contract the harness steers by.
 *
 * window.__GAME__ is refreshed every frame: `pos` in metres (the gate drives by it), `fps` from REAL elapsed
 * time (a counter that divides by a clamped delta is pinned to a constant), draws and tris straight from
 * renderer.info. The start button is #startb and it is the only way the game starts.
 */
import * as THREE from 'three';
import { ASSET, bakeStatic } from '../assetlib.js';
import { createRig, detectTier } from '../rig.js';
import { PAL, ROAD, QUALITY, SCORE, MAX_DT, clamp, damp, smoothstep } from './config.js';
import { Car, gearbox } from './car.js';
import { Track } from './track.js';
import { World } from './world.js';
import { ChaseCam } from './camera.js';
import { Input } from './input.js';
import { Scoring } from './scoring.js';
import { Hud } from './hud.js';
import { Audio } from './audio.js';
import { SkidMarks, Particles, ExhaustFlame } from './fx.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const loadEl = $('load'), barf = $('barf'), loadmsg = $('loadmsg');

const G = {
  playing: false, over: false, hour: 17.6, hourShown: 0, lastSunApply: 0,
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
const rig = createRig(THREE, renderer, scene, { hour: G.hour, azimuth: 235, tier, fogStart: 55, fogDensity: 0.0013, exposure: 1.05 });

let track, world, car, carRoot, joints, chase, input, scoring, hud, audio, skids, particles, flame, headlights;
const lampLights = [];

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
  try { renderer.compile(scene, camera); } catch (e) { console.warn('compile', e.message); }
  window.__DEBUG__ = { world, track, car, rig, scene, renderer, G, chase, audio, get scoring() { return scoring; },
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
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    if (!m) return;
    if (m.name === 'paint' || m.color.getHex() === PAL.pearl) {
      const p = new THREE.MeshPhysicalMaterial({ color: m.color, roughness: 0.32, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.0 });
      p.name = 'paint'; o.material = p;
    } else if (m.name === 'glass' || m.color.getHex() === PAL.glass) {
      o.material = new THREE.MeshPhysicalMaterial({ color: m.color, roughness: 0.08, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2 });
      o.material.name = 'glass';
    }
    o.castShadow = true; o.receiveShadow = true;
  });
  // bake the still parts per joint: the body into one mesh per material, each wheel into its own
  const bodyNode = obj.getObjectByName('body');
  obj.updateMatrixWorld(true);
  if (bodyNode) {
    const baked = bakeStatic(bodyNode);
    baked.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    bodyNode.parent.remove(bodyNode);
    obj.add(baked);
  }
  carRoot = obj;
  scene.add(carRoot);
  flame = new ExhaustFlame(carRoot);
  flame.set(0.42, 0.28, -2.15);
  // headlights for dusk
  headlights = [];
  for (const x of [-0.6, 0.6]) {
    const sp = new THREE.SpotLight(0xfff0d0, 0, 60, 0.55, 0.5, 1.2);
    sp.position.set(x, 0.7, 2.0);
    sp.target.position.set(x * 1.5, 0.1, 30);
    carRoot.add(sp); carRoot.add(sp.target);
    headlights.push(sp);
  }
  for (let i = 0; i < (tier === 'phone' ? 2 : 3); i++) {
    const pl = new THREE.PointLight(0xffcf7a, 0, 26, 1.6);
    scene.add(pl); lampLights.push(pl);
  }
}

function startGame() {
  if (G.playing) return;
  $('start').classList.remove('on');
  hud.show(true);
  audio.unlock();
  G.playing = true;
  hud.toast('DRIFT THE SUN DOWN', 'good', true);
}

function restartRun() {
  scoring.reset();
  const start = track.sample(8);
  car.reset(start.x, start.z, start.h);
  G.idx = 0; G.dist = 0; G.lastS = 8; G.hour = 17.6;
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

  rig.render(camera, dt);

  const g = window.__GAME__;
  g.pos[0] = car ? car.x : 0; g.pos[1] = car ? car.z : 0;
  g.fps = G.fps; g.speed = car ? Math.round(car.speed * 10) / 10 : 0; g.score = scoring ? scoring.total : 0; g.over = false;
  g.draws = renderer.info.render.calls; g.tris = renderer.info.render.triangles;
  if (car) { g.drift = scoring.active ? 1 + scoring.tier : 0; g.combo = scoring.chain; g.slip = Math.round(car.beta * 180 / Math.PI); g.heading = car.yaw; g.progress = Math.round(G.s); g.lat = Math.round(G.u * 100) / 100; g.roadHeading = track.pts[G.idx].h; g.curvAhead = Math.round(track.sample(G.s + 22).k * 1000) / 1000; g.walls = [track.pts[G.idx].wl, track.pts[G.idx].wr]; g.kmh = Math.round(car.kmh); g.boost = Math.round(car.boost * 10) / 10; g.hour = Math.round(G.hour * 100) / 100; }
  if (hud && hud.perfOn) perfLine = `${G.fps} fps  ${g.draws} draws  ${(g.tris / 1000).toFixed(0)}k tris  ${tier}`;
}

function idle(dt) {
  if (!car) return;
  const y = track.sample(G.s || 8).y;
  chase.update(dt, car, y, (x, z) => track.groundAt(x, z, G.idx), 0);
  placeCar(y, 0);
  world.updateFar(car.x, y, car.z);
}

function step(dt) {
  const inp = input.sample(dt);
  // ---- where on the road are we
  const n = track.nearest(car.x, car.z, G.idx);
  G.idx = n.i; G.s = n.s; G.u = n.u;
  const p = n.p;
  const au = Math.abs(n.u);
  const surface = au < ROAD.halfWidth ? 1 : au < ROAD.halfWidth + 0.9 ? 0.7 : 0.35;
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
  const rate = (h > 18.3 || h < 5.6) ? 10 : h < 15 ? 5 : h < 17.2 ? 2.5 : 1;
  G.hour += ds / 3800 * rate;
  if (G.hour >= 24) { G.hour -= 24; }
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
  chase.update(dt, car, road.y, (x, z) => track.groundAt(x, z, G.idx), boost01);
  world.update(G.s);
  world.updateFar(car.x, road.y, car.z);
  hud.update(dt, scoring, car, G.hour, G.dist, car.boost, SCORE.boostMax, perfLine);
}

let sunTimer = 0;
function applySun(dt) {
  sunTimer += dt;
  // setTime rebuilds the sky (about 25 ms), so it is throttled: every 2.5 s, or sooner after a big bank
  const moved = Math.abs(G.hour - G.hourShown);
  if (sunTimer < 2.5 && moved < 0.12) return;
  if (moved < 0.004) return;
  sunTimer = 0; G.hourShown = G.hour;
  const t = rig.setTime({ hour: G.hour });
  const el = t.elevation;
  // headlights and lamps come on as the sun goes
  const nightAmt = smoothstep(4, -3, el);
  G.night = nightAmt;
  for (const h of headlights) h.intensity = 180 * nightAmt;
  sunColor.copy(rig.sun.color).lerp(new THREE.Color(0.6, 0.7, 1.0), nightAmt);
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
    if (a > 0.25 && Math.random() < a * 0.9) particles.smoke(wx, y, wz, vx, vz, a, sunColor);
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
      pl.intensity = e.l.tunnel ? 60 : 90 * Math.max(G.night, 0.15);
    });
  } else lampLights.forEach((pl) => { pl.intensity = 0; });
}

// ---------------------------------------------------------------- resize
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  rig.resize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
  if (particles) particles.setScale(h);
}
addEventListener('resize', resize);
resize();

boot().catch((e) => { console.error(e); loadmsg.textContent = 'failed: ' + e.message; });
requestAnimationFrame(frame);
