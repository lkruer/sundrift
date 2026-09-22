/**
 * The world: the road and everything beside it, over the terrain.
 *
 * The road is built in chunks of 60 samples (about 120 m), chosen by distance from the car, not by distance
 * along the road, so the leg of a switchback above you is there whether you drove it or not. A chunk has two
 * levels. Built (within FAR_R): the ribbon, the guardrail beams, the tunnel lining, the street lamps and their
 * light, the set pieces. Dressed (within NEAR_R): everything small besides, the posts, poles, studs, signs,
 * mirrors, boulders, power poles and wires, and the trees and shrubs along the verge.
 *
 * Draw-call discipline: every repeated prop of every chunk lives in one shared instanced Pool per prop, so
 * the prop draws do not grow with the number of chunks; a chunk's own meshes are its ribbon, its rail, and
 * the light pools, wires and tunnel it happens to have. Terrain and forest are terrain.js.
 *
 * Everything stands on ground.js: one height function for the terrain, the props and the camera, so nothing
 * floats and nothing is buried.
 */
import * as THREE from 'three';
import { ASSET } from '../assetlib.js?v=202609222245';
import { surface } from '../surfaces.js?v=202609222245';
import { PAL, clamp, lerp, smoothstep, mulberry32 } from './config.js?v=202609222245';
import { Ground } from './ground.js?v=202609222245';
import { Terrain, LODS } from './terrain.js?v=202609222245';
import { partsOf, Pool } from './instancing.js?v=202609222245';

const ASSETS = {
  cedar: './assets/cedar_tree.js', maple: './assets/maple_tree.js', boulder: './assets/boulder.js',
  post: './assets/guardrail_post.js', pole: './assets/snow_pole.js', lamp: './assets/lamp_post.js',
  mirror: './assets/traffic_mirror.js', chevron: './assets/chevron_sign.js', torii: './assets/torii_gate.js',
  lantern: './assets/stone_lantern.js', portal: './assets/tunnel_portal.js', hut: './assets/mountain_hut.js',
  vending: './assets/vending_machine.js', shrub: './assets/roadside_shrub.js', broadleaf: './assets/broadleaf_tree.js',
  catseye: './assets/cats_eye.js', upole: './assets/power_pole.js', bamboo: './assets/bamboo_clump.js', bare: './assets/bare_tree.js',
  conbini: './assets/conbini.js', busstop: './assets/bus_shelter.js',
};
const SURFACED = new Set(['boulder', 'post', 'pole', 'lamp', 'mirror', 'chevron', 'torii', 'lantern', 'portal', 'hut', 'vending', 'upole', 'conbini', 'busstop']);
// pool capacities: what the whole visible road can hold at once
const CAPS = {
  lamp: 320, post: 1400, pole: 500, catseye: 900, chevron: 120, mirror: 40, boulder: 300, upole: 160,
  maple: 500, broadleaf: 500, shrub: 1600, bamboo: 160, bare: 160,
  torii: 8, lantern: 24, hut: 12, vending: 24, conbini: 6, busstop: 8, portal: 8,
};
const TINTED = new Set(['maple', 'broadleaf', 'shrub']);
const CHUNK = 60;
const NEAR_R = 150, FAR_R = 470, DROP_R = 540;
const LAMP_EVERY = 30;

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

/** Road texture over the corridor's base width: asphalt with grain, wear, patches, edge lines and a dashed centre. */
function roadTexture(half, wall) {
  const W = 256, H = 1024, LEN = 48;                     // 48 m along, so patches do not visibly repeat
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const rv = document.createElement('canvas'); rv.width = W; rv.height = H;
  const ctx = cv.getContext('2d'), rctx = rv.getContext('2d');
  const img = ctx.createImageData(W, H), rimg = rctx.createImageData(W, H);
  const asphalt = [0x3a, 0x3b, 0x40], gravel = [0x86, 0x80, 0x75], line = [0xe8, 0xe4, 0xda];
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  // a few repair patches: darker, smoother rectangles
  const patches = [];
  for (let k = 0; k < 5; k++) patches.push({ u0: -half + rnd() * (2 * half - 2), du: 1 + rnd() * 2.2, v0: rnd() * LEN, dv: 2 + rnd() * 6 });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = ((x + 0.5) / W) * 2 * wall - wall, au = Math.abs(u);
    const vm = (y / H) * LEN;
    let c, rough;
    const grain = (rnd() - 0.5) * 10;
    if (au > half) { c = gravel.map((v) => v + grain * 1.8); rough = 0.96; }
    else {
      const wear = 1 - 0.08 * Math.exp(-Math.pow((au - half * 0.36) / 0.5, 2));       // darker tyre tracks
      c = asphalt.map((v) => (v + grain) * wear);
      rough = 0.55 + 0.08 * Math.sin(x * 0.11 + y * 0.05) * Math.sin(y * 0.09) - 0.05 * (1 - wear) * 6;
      for (const p of patches) if (u > p.u0 && u < p.u0 + p.du && vm > p.v0 && vm < p.v0 + p.dv) { c = c.map((v) => v * 0.8); rough = 0.7; }
      const onEdge = Math.abs(au - (half - 0.25)) < 0.075;
      const onCentre = au < 0.07 && (vm % 12) < 4.0;
      if (onEdge || onCentre) { c = line.map((v) => v * (onCentre ? 0.93 : 1) + grain * 0.5); rough = 0.62; }
    }
    const i = (y * W + x) * 4;
    img.data[i] = clamp(c[0], 0, 255); img.data[i + 1] = clamp(c[1], 0, 255); img.data[i + 2] = clamp(c[2], 0, 255); img.data[i + 3] = 255;
    const r = clamp(rough * 255, 0, 255);
    rimg.data[i] = r; rimg.data[i + 1] = r; rimg.data[i + 2] = r; rimg.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); rctx.putImageData(rimg, 0, 0);
  const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.ClampToEdgeWrapping; map.wrapT = THREE.RepeatWrapping; map.anisotropy = 8;
  const roughnessMap = new THREE.CanvasTexture(rv); roughnessMap.wrapS = THREE.ClampToEdgeWrapping; roughnessMap.wrapT = THREE.RepeatWrapping;
  return { map, roughnessMap, len: LEN };
}

/**
 * Slope protection, the concrete lattice (法枠) on every steep cutting of a Japanese mountain road: one 3.2 m
 * cell of grey beams round a pocket of soil and grass, weathered, drawn once into a canvas.
 */
function latticeTexture() {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  let seed = 11;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  // the pocket: dark soil with grass
  // (kept close in value to the beams, so the ink pass draws the grid, not every blade of grass)
  ctx.fillStyle = '#5c6545'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) {
    const g = 40 + rnd() * 40;
    ctx.fillStyle = `rgba(${g * 0.9 + 20 | 0},${g + 34 | 0},${g * 0.6 + 10 | 0},${0.25 + rnd() * 0.3})`;
    ctx.fillRect(rnd() * S, rnd() * S, 2 + rnd() * 5, 2 + rnd() * 6);
  }
  // the beams: a band on every edge, so the tiles meet in a grid
  const B = 19;
  const beam = (x, y, w, h) => {
    ctx.fillStyle = '#9d998f'; ctx.fillRect(x, y, w, h);
    for (let i = 0; i < (w * h) / 30; i++) { const v = 150 + rnd() * 40; ctx.fillStyle = `rgba(${v},${v - 4},${v - 12},0.35)`; ctx.fillRect(x + rnd() * w, y + rnd() * h, 2, 2); }
  };
  beam(0, 0, S, B); beam(0, S - B, S, B); beam(0, 0, B, S); beam(S - B, 0, B, S);
  // shading under the beams, and rust-dark streaks where water runs off them
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(B, B, S - 2 * B, 5); ctx.fillRect(B, B, 4, S - 2 * B);
  for (let i = 0; i < 9; i++) {
    const x = B + rnd() * (S - 2 * B), len = 10 + rnd() * 50;
    const gr = ctx.createLinearGradient(0, S - B - len, 0, S - B);
    gr.addColorStop(0, 'rgba(40,34,26,0)'); gr.addColorStop(1, 'rgba(40,34,26,0.45)');
    ctx.fillStyle = gr; ctx.fillRect(x, S - B - len, 2 + rnd() * 3, len);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

export class World {
  constructor(scene, quality) {
    this.scene = scene; this.q = quality;
    this.templates = {}; this.parts = {};
    this.pools = {};
    this.chunks = new Map();
    this.boxes = [];            // chunk index -> [minx, minz, maxx, maxz] once final
    this.lamps = [];            // { x, y, z, c, tunnel } lamp heads, for the night lights
    this.root = new THREE.Group(); this.root.name = 'road'; scene.add(this.root);
    this.job = null;
    this.stats = { chunks: 0, near: 0 };
    this.track = null; this.ground = null; this.terrain = null;
    this.seed = 1;
  }

  async load(progress) {
    const names = Object.keys(ASSETS);
    let n = 0;
    await Promise.all(names.map(async (k) => {
      const t = await ASSET(ASSETS[k], { surfaces: SURFACED.has(k) });
      t.updateMatrixWorld(true);
      this.templates[k] = t;
      n++; if (progress) progress(n / names.length, k);
    }));
    // foliage materials turn white so the instance colour is the leaf colour
    for (const name of ['maple', 'shrub', 'broadleaf']) {
      const tpl = this.templates[name]; if (!tpl) continue;
      tpl.traverse((o) => {
        const hex = o.isMesh && o.material ? o.material.color.getHex() : -1;
        if (o.isMesh && o.material && (o.material.name === 'foliage' || hex === PAL.mapleOrange || hex === PAL.dryGrass || hex === PAL.mapleGold)) {
          o.material = o.material.clone(); o.material.color.set(0xffffff); o.material.name = 'foliage_tinted';
        }
      });
    }
    // reflectors and lenses glow at night
    for (const name of ['pole', 'post', 'chevron', 'mirror']) {
      const tpl = this.templates[name]; if (!tpl) continue;
      tpl.traverse((o) => {
        if (!o.isMesh || !o.material || !o.material.color) return;
        const hex = o.material.color.getHex();
        if (hex === PAL.tailRed || hex === PAL.laneWhite) { o.material = o.material.clone(); o.material.emissive.set(hex); o.material.emissiveIntensity = hex === PAL.tailRed ? 0.9 : 0.35; }
      });
    }
    // the shop and the machines are the brightest things on a night pass: their panels glow for the bloom
    for (const name of ['conbini', 'vending']) {
      const tpl = this.templates[name]; if (!tpl) continue;
      tpl.traverse((o) => { if (o.isMesh && o.material && o.material.emissive && o.material.emissiveIntensity > 0.5) { o.material = o.material.clone(); o.material.emissiveIntensity = 2.6; } });
    }
    for (const k of names) this.parts[k] = partsOf(this.templates[k]);
    // the lamp's head: the far end of its arm, found from the template rather than assumed
    {
      const box = new THREE.Box3().setFromObject(this.templates.lamp);
      this.lampHead = [box.max.x - 0.28, box.max.y - 0.3];
      this.lampReach = box.max.x;
    }
    const g = surface(THREE, 'ground', 256);
    this.groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: g.map, roughnessMap: g.roughnessMap, normalMap: g.normalMap,
      normalScale: new THREE.Vector2(0.28, 0.28), roughness: 1, metalness: 0, color: 0xffffff });
    this.groundMat.name = 'ground';
    // steep cuttings by the road wear the lattice: the terrain gives each vertex a weight ('wall'), and the
    // lattice is mapped up and along the face. Installed before the rig first sees the material, so the rig
    // keeps this hook and runs it ahead of its own patches.
    {
      const lat = latticeTexture();
      this.groundMat.onBeforeCompile = (shader) => {
        shader.uniforms.uLattice = { value: lat };
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>
attribute float wall;
attribute float wallS;
varying float vWall;
varying vec2 vWallUv;`)
          .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
{ vec4 wp = modelMatrix * vec4(transformed, 1.0); vWallUv = vec2(wallS, wp.y * 1.3) / 3.2; vWall = wall; }`);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>
uniform sampler2D uLattice;
varying float vWall;
varying vec2 vWallUv;`)
          .replace('#include <color_fragment>', `#include <color_fragment>
if (vWall > 0.01) { diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(uLattice, vWallUv).rgb, vWall); }`);
      };
      this.groundMat.customProgramCacheKey = () => 'ground-lattice';
    }
    this.farMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, color: 0xffffff, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 8 });
    this.farMat.name = 'farground';
    this.roadMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, color: 0xffffff });
    this.roadMat.name = 'road';
    this.railMat = new THREE.MeshStandardMaterial({ color: PAL.galvanised, roughness: 0.42, metalness: 0.65, side: THREE.DoubleSide });
    this.tunnelMat = new THREE.MeshStandardMaterial({ color: 0x55555c, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
    this.tunnelLampMat = new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffb45a, emissiveIntensity: 2.4, roughness: 0.5 });
    this.wireMat = new THREE.LineBasicMaterial({ color: 0x15161a });
    this.bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffc070, emissiveIntensity: 2.1, roughness: 0.6 });
    {
      const sz = 128, cv = document.createElement('canvas'); cv.width = cv.height = sz;
      const ctx = cv.getContext('2d');
      const gr = ctx.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, sz / 2);
      gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.3)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, sz, sz);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      this.glowMat = new THREE.MeshBasicMaterial({ color: 0xffa046, map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
      this.glowCoolMat = this.glowMat.clone(); this.glowCoolMat.color.set(0xd8ecff);
    }
    // the shared pools
    const bulbParts = [{ geometry: new THREE.SphereGeometry(0.2, 8, 6), material: this.bulbMat, local: new THREE.Matrix4() }];
    this.pools.bulb = new Pool(bulbParts, CAPS.lamp);
    for (const k of Object.keys(CAPS)) {
      if (!this.parts[k]) continue;
      this.pools[k] = new Pool(this.parts[k], CAPS[k], { tint: TINTED.has(k) });
    }
    for (const p of Object.values(this.pools)) this.root.add(p.group);
    this.buildSky();
  }

  /** A new course: everything built for the old one goes. */
  setTrack(track) {
    for (const ch of this.chunks.values()) this._drop(ch);
    this.chunks.clear();
    for (const p of Object.values(this.pools)) { p.clear(); p.flush(); }
    this.boxes = []; this.lamps = []; this.job = null;
    this.track = track;
    this.ground = new Ground(track);
    this.seed = track.seed;
    const rt = roadTexture(track.half, track.wall);
    if (this.roadMat.map) { this.roadMat.map.dispose(); this.roadMat.roughnessMap.dispose(); }
    this.roadMat.map = rt.map; this.roadMat.roughnessMap = rt.roughnessMap; this.roadMat.needsUpdate = true;
    this.texLen = rt.len;
    const tp = { cedar: this.parts.cedar, maple: this.parts.maple, broadleaf: this.parts.broadleaf, bare: this.parts.bare };
    if (!this.terrain) this.terrain = new Terrain({ scene: this.scene, ground: this.ground, mat: this.groundMat, farMat: this.farMat, parts: tp, density: this.q.trees, seed: track.seed });
    else { this.terrain.o.seed = track.seed; this.terrain.reset(this.ground); }
    // new final road dirties the terrain beside it
    track.onAdd((i0, i1) => {
      if (this.track !== track) return;
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity, tun = false;
      for (let i = i0; i <= i1; i++) { const p = track.pts[i]; if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.z < z0) z0 = p.z; if (p.z > z1) z1 = p.z; if (p.tunnel) tun = true; }
      this.terrain.markDirty(x0, z0, x1, z1, tun ? 150 : undefined);
    });
  }

  inTunnel(s) { return this.track ? this.track.inTunnel(s) : null; }

  // ------------------------------------------------------------------ streaming

  _box(c) {
    let b = this.boxes[c];
    if (b) return b;
    const t = this.track, i0 = c * CHUNK, i1 = (c + 1) * CHUNK;
    if (i1 >= t.nFinal) return null;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let i = i0; i <= i1; i++) { const p = t.pts[i]; if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.z < z0) z0 = p.z; if (p.z > z1) z1 = p.z; }
    b = [x0 - 20, z0 - 20, x1 + 20, z1 + 20];
    this.boxes[c] = b;
    return b;
  }

  static boxDist(b, x, z) {
    const dx = Math.max(b[0] - x, 0, x - b[2]), dz = Math.max(b[1] - z, 0, z - b[3]);
    return Math.hypot(dx, dz);
  }

  /**
   * Keep the road and terrain around the car built, working until `deadline` (performance.now() ms).
   * s is the car's distance along the road: the generator stays well ahead of it.
   */
  update(x, z, s, deadline) {
    const t = this.track;
    t.ensure(s + 2200);
    const nC = Math.floor((t.nFinal - 1) / CHUNK);
    // what each chunk should be
    let best = null, bestD = Infinity, bestUp = false;
    for (let c = 0; c < nC; c++) {
      const b = this._box(c); if (!b) break;
      const d = World.boxDist(b, x, z);
      const ch = this.chunks.get(c);
      if (!ch) {
        if (d < FAR_R && d < bestD) { best = c; bestD = d; bestUp = false; }
        continue;
      }
      ch.d = d;
      if (d > DROP_R && !(this.job && this.job.c === c)) { this._drop(ch); this.chunks.delete(c); continue; }
      if (ch.near && d > NEAR_R + 40) this._undress(ch);
      else if (!ch.near && ch.built && d < NEAR_R && d - 60 < bestD) { best = c; bestD = d - 60; bestUp = true; }
    }
    // the terrain first when a tile near the car is missing; otherwise share the time
    const now = performance.now();
    const half = now + (deadline - now) * 0.5;
    this.terrain.update(x, z, this.job || best !== null ? half : deadline);
    while (performance.now() < deadline) {
      if (!this.job && best !== null) {
        this.job = bestUp ? { c: best, it: this._dress(this.chunks.get(best)) } : { c: best, it: this._build(best) };
        best = null;
      }
      if (!this.job) break;
      const r = this.job.it.next();
      if (r.done) this.job = null;
    }
    for (const p of Object.values(this.pools)) { p.flush(); for (const part of p.parts) part.im.visible = p.n > 0; }
    this.stats.chunks = this.chunks.size;
    this.stats.near = 0; for (const ch of this.chunks.values()) if (ch.near) this.stats.near++;
  }

  /** Build everything the first frames need, synchronously (the loading screen). */
  prime(x, z, s) {
    this.track.ensure(s + 2200);
    this.terrain.prime(x, z, LODS[1].r);
    for (let guard = 0; guard < 400; guard++) {
      this.update(x, z, s, performance.now() + 1000);
      let pending = !!this.job;
      const nC = Math.floor((this.track.nFinal - 1) / CHUNK);
      for (let c = 0; c < nC && !pending; c++) {
        const b = this._box(c); if (!b) break;
        const d = World.boxDist(b, x, z); const ch = this.chunks.get(c);
        if (d < 260 && (!ch || !ch.built || (d < NEAR_R && !ch.near))) pending = true;
      }
      if (!pending) break;
    }
    this.terrain.prime(x, z, LODS[1].r);
  }

  _drop(ch) {
    this._undress(ch);
    for (const p of Object.values(this.pools)) p.removeOwner(ch.c * 2);
    this.root.remove(ch.group);
    ch.group.traverse((o) => { if ((o.isMesh || o.isLineSegments) && ch.own.has(o.geometry)) o.geometry.dispose(); });
    this.lamps = this.lamps.filter((l) => l.c !== ch.c);
  }

  _undress(ch) {
    if (!ch.near) return;
    for (const p of Object.values(this.pools)) p.removeOwner(ch.c * 2 + 1);
    if (ch.nearGroup) {
      ch.group.remove(ch.nearGroup);
      ch.nearGroup.traverse((o) => { if ((o.isMesh || o.isLineSegments) && o.geometry) o.geometry.dispose(); });
      ch.nearGroup = null;
    }
    ch.near = false;
  }

  /** Put one of a template into a pool under owner, at (x, y, z) turned ry, scaled. */
  _put(name, owner, x, y, z, ry, sc = 1, sx = 1, colour = null) {
    const pool = this.pools[name]; if (!pool) return;
    _q.setFromAxisAngle(_up, ry); _s.set(sc * sx, sc, sc);
    _m4.compose(_v.set(x, y, z), _q, _s);
    pool.add(owner, _m4, colour);
  }

  /** Position at lateral offset u from sample p, left positive, on the ground unless y is given. */
  _at(p, u) { const lx = Math.cos(p.h), lz = -Math.sin(p.h); return [p.x + lx * u, p.z + lz * u]; }

  // ------------------------------------------------------------------ build: the road, rails, tunnel, lamps, set pieces

  *_build(c) {
    const t = this.track;
    const i0 = c * CHUNK, i1 = (c + 1) * CHUNK;
    const ch = { c, i0, i1, group: new THREE.Group(), own: new Set(), near: false, built: false, nearGroup: null, d: 0 };
    ch.group.name = 'chunk' + c;
    this.chunks.set(c, ch);
    ch.group.add(this._ribbon(ch));
    yield;
    ch.rails = this._railPlan(ch);
    const rail = this._rails(ch); if (rail) ch.group.add(rail);
    const tube = this._tunnel(ch); if (tube) ch.group.add(tube);
    yield;
    this._lampsFor(ch);
    this._setPieces(ch);
    this.root.add(ch.group);
    ch.built = true;
  }

  _ribbon(ch) {
    const t = this.track, pts = t.pts, half = t.half, TW = t.wall;
    const n = ch.i1 - ch.i0 + 1;
    const cols = 7, per = cols + 2;                         // seven across, then a skirt vertex under each edge
    const pos = new Float32Array(n * per * 3), uv = new Float32Array(n * per * 2), nor = new Float32Array(n * per * 3);
    const idx = [];
    for (let k = 0; k < n; k++) {
      const p = pts[ch.i0 + k];
      const lx = Math.cos(p.h), lz = -Math.sin(p.h);
      const us = [-p.wr, -Math.min(TW, p.wr), -half, 0, half, Math.min(TW, p.wl), p.wl];
      const v = p.s / this.texLen;
      for (let j = 0; j < cols; j++) {
        const u = us[j], o = k * per + j;
        const dy = Math.abs(u) < half ? 0.012 * (1 - Math.abs(u) / half) : 0;
        pos[o * 3] = p.x + lx * u; pos[o * 3 + 1] = p.y + dy; pos[o * 3 + 2] = p.z + lz * u;
        uv[o * 2] = (clamp(u, -TW, TW) + TW) / (2 * TW); uv[o * 2 + 1] = v;
        nor[o * 3 + 1] = 1;
      }
      for (let e = 0; e < 2; e++) {
        const src = k * per + (e === 0 ? 0 : cols - 1), o = k * per + cols + e;
        pos[o * 3] = pos[src * 3]; pos[o * 3 + 1] = pos[src * 3 + 1] - 0.45; pos[o * 3 + 2] = pos[src * 3 + 2];
        uv[o * 2] = uv[src * 2]; uv[o * 2 + 1] = v;
        nor[o * 3] = (e === 0 ? -lx : lx); nor[o * 3 + 2] = (e === 0 ? -lz : lz);
      }
      if (k < n - 1) {
        for (let j = 0; j < cols - 1; j++) {
          const a = k * per + j, b = a + 1, c2 = a + per, d = c2 + 1;
          idx.push(a, c2, b, b, c2, d);
        }
        // skirts: right edge (column 0) faces right, left edge (last column) faces left
        const r0 = k * per, r1 = r0 + per, rs0 = k * per + cols, rs1 = rs0 + per;
        idx.push(r0, rs0, r1, r1, rs0, rs1);
        const l0 = k * per + cols - 1, l1 = l0 + per, ls0 = k * per + cols + 1, ls1 = ls0 + per;
        idx.push(l0, l1, ls0, l1, ls1, ls0);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    ch.own.add(g);
    const m = new THREE.Mesh(g, this.roadMat);
    m.receiveShadow = true; m.name = 'ribbon';
    return m;
  }

  /** Where the guardrail runs: on a side where the ground falls away, or round the outside of a tight corner. */
  _railPlan(ch) {
    const t = this.track, pts = t.pts, g = this.ground;
    const plan = { 1: new Uint8Array(ch.i1 - ch.i0 + 1), [-1]: new Uint8Array(ch.i1 - ch.i0 + 1) };
    for (let i = ch.i0; i <= ch.i1; i++) {
      const p = pts[i];
      if (p.tunnel || t.nearTunnel(p.s, 5)) continue;
      for (const side of [1, -1]) {
        if (t.markerAt(p.s, side) || t.padAt(p.s, side)) continue;
        const w = side > 0 ? p.wl : p.wr;
        const [x, z] = this._at(p, (w + 4.5) * side);
        const drop = p.y - g.height(x, z);
        const tight = Math.abs(p.k) > 1 / 45 && Math.sign(p.k) === -side;
        if (drop > 0.9 || tight) plan[side][i - ch.i0] = 1;
      }
    }
    // no stubs, no gaps: fill gaps of up to 4 samples, drop runs shorter than 6
    for (const side of [1, -1]) {
      const a = plan[side], n = a.length;
      for (let i = 1; i < n - 1; i++) if (!a[i] && a[i - 1]) { let j = i; while (j < n && !a[j] && j - i < 5) j++; if (j < n && a[j] && j - i <= 4) for (let k = i; k < j; k++) a[k] = 1; }
      let i = 0;
      while (i < n) { if (!a[i]) { i++; continue; } let j = i; while (j < n && a[j]) j++; const edge = i === 0 || j === n; if (j - i < 6 && !edge) for (let k = i; k < j; k++) a[k] = 0; i = j; }
    }
    return plan;
  }

  _rails(ch) {
    const t = this.track, pts = t.pts;
    const prof = [[0, 0.45], [0.07, 0.49], [0.07, 0.535], [0, 0.575], [0, 0.615], [0.07, 0.655], [0.07, 0.70], [0, 0.74]];
    const cols = prof.length;
    const pos = [], idx = [];
    for (const side of [1, -1]) {
      const a = ch.rails[side];
      let run = [];
      const flush = () => {
        if (run.length >= 2) {
          const base = pos.length / 3;
          run.forEach((i, k) => {
            const p = pts[i]; const w = (side > 0 ? p.wl : p.wr) - 0.12;
            const lx = Math.cos(p.h) * side, lz = -Math.sin(p.h) * side;
            for (const [du, h] of prof) { const uu = w - du; pos.push(p.x + lx * uu, p.y + h, p.z + lz * uu); }
            if (k < run.length - 1) for (let j = 0; j < cols - 1; j++) {
              const o = base + k * cols + j, b = o + 1, c2 = o + cols, d = c2 + 1;
              if (side > 0) idx.push(o, c2, b, b, c2, d); else idx.push(o, b, c2, b, d, c2);
            }
          });
        }
        run = [];
      };
      for (let i = ch.i0; i <= ch.i1; i++) { if (a[i - ch.i0]) run.push(i); else flush(); }
      flush();
    }
    if (!idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    ch.own.add(g);
    const m = new THREE.Mesh(g, this.railMat); m.castShadow = true; m.receiveShadow = true; m.name = 'rail';
    return m;
  }

  /** The tunnel lining, its ceiling lamps and its portals, for the samples of this chunk that are inside one. */
  _tunnel(ch) {
    const t = this.track, pts = t.pts;
    const inside = [];
    for (let i = ch.i0; i <= ch.i1; i++) if (pts[i].tunnel) inside.push(i);
    const grp = new THREE.Group();
    // portals of tunnels that start or end in this chunk
    for (const tn of t.tunnels) {
      if (tn.fi >= t.nFinalF) continue;
      for (const [s, flip] of [[tn.s0 - 1.2, Math.PI], [tn.s1 + 1.2, 0]]) {
        const i = t.index(s); if (i < ch.i0 || i >= ch.i1) continue;
        const p = t.sample(s);
        const sc = t.tubeHalf / 4.05;
        this._put('portal', ch.c * 2, p.x, p.y - 0.05, p.z, p.h + flip, sc);
      }
    }
    if (inside.length < 2) return grp.children.length ? grp : null;
    const R = t.tubeHalf, wallH = 2.4 * (t.tubeHalf / 4.05);
    const prof = [[-R, -0.2], [-R, wallH]];
    for (let k = 1; k < 12; k++) { const a = Math.PI - (k / 12) * Math.PI; prof.push([Math.cos(a) * R, wallH + Math.sin(a) * R]); }
    prof.push([R, wallH], [R, -0.2]);
    const cols = prof.length, n = inside.length;
    const pos = new Float32Array(n * cols * 3), uv = new Float32Array(n * cols * 2);
    const idx = [];
    for (let k = 0; k < n; k++) {
      const p = pts[inside[k]];
      const lx = Math.cos(p.h), lz = -Math.sin(p.h);
      for (let j = 0; j < cols; j++) {
        const [u, h] = prof[j], o = k * cols + j;
        pos[o * 3] = p.x + lx * u; pos[o * 3 + 1] = p.y + h; pos[o * 3 + 2] = p.z + lz * u;
        uv[o * 2] = j / (cols - 1) * 4; uv[o * 2 + 1] = p.s / 4;
      }
      if (k < n - 1 && inside[k + 1] === inside[k] + 1) for (let j = 0; j < cols - 1; j++) {
        const a = k * cols + j, b = a + 1, c2 = a + cols, d = c2 + 1;
        idx.push(a, b, c2, b, d, c2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    ch.own.add(g);
    // it casts: the moon has no business lighting the inside of a tunnel through the hill
    const m = new THREE.Mesh(g, this.tunnelMat); m.receiveShadow = true; m.castShadow = true; m.name = 'tube';
    grp.add(m);
    // two rows of sodium lamps high on the walls, every 8 m
    const lamp = new THREE.BoxGeometry(0.3, 0.14, 1.1);
    const lp = [];
    for (let k = 0; k < n; k += 4) {
      const p = pts[inside[k]];
      for (const side of [1, -1]) {
        const a = Math.PI / 2 - side * 0.62;
        const u = Math.cos(a) * (R - 0.08), h = wallH + Math.sin(a) * (R - 0.08);
        const [x, z] = this._at(p, u);
        const mm = new THREE.Matrix4().compose(_v.set(x, p.y + h, z), _q.setFromAxisAngle(_up, p.h), _s.set(1, 1, 1));
        const gg = lamp.clone().applyMatrix4(mm); lp.push(gg);
      }
      if (k % 8 === 0) this.lamps.push({ x: p.x, y: p.y + wallH + R * 0.8, z: p.z, c: ch.c, tunnel: true });
    }
    if (lp.length) {
      const merged = mergeGeos(lp);
      ch.own.add(merged);
      const lm = new THREE.Mesh(merged, this.tunnelLampMat); lm.name = 'tubelamps';
      grp.add(lm);
    }
    return grp;
  }

  /** Street lamps every 30 m, on the outside of a bend, alternating on the straights; each with its light on the ground. */
  _lampsFor(ch) {
    const t = this.track, g = this.ground;
    const s0 = t.pts[ch.i0].s, s1 = t.pts[ch.i1].s;
    const glows = [];
    for (let sl = Math.ceil(s0 / LAMP_EVERY) * LAMP_EVERY; sl < s1; sl += LAMP_EVERY) {
      const p = t.sample(sl);
      if (p.tunnel || t.nearTunnel(p.s, 10)) continue;
      let side = Math.abs(p.k) > 1 / 160 ? -Math.sign(p.k) : ((Math.round(sl / LAMP_EVERY) % 2) ? 1 : -1);
      if (t.markerAt(p.s, side) || t.padAt(p.s, side)) side = -side;
      if (t.markerAt(p.s, side) || t.padAt(p.s, side)) continue;
      const w = side > 0 ? p.wl : p.wr;
      const [x, z] = this._at(p, (w + 0.55) * side);
      const y = g.height(x, z);
      const ry = side > 0 ? p.h + Math.PI : p.h;               // the arm reaches local +X: point it at the road
      this._put('lamp', ch.c * 2, x, y, z, ry);
      const hx = x + Math.cos(ry) * this.lampHead[0], hz = z - Math.sin(ry) * this.lampHead[0];
      const hy = y + this.lampHead[1];
      this.lamps.push({ x: hx, y: hy - 0.25, z: hz, c: ch.c });
      _q.setFromAxisAngle(_up, 0); _m4.compose(_v.set(hx, hy - 0.22, hz), _q, _s.set(1, 1, 1));
      this.pools.bulb.add(ch.c * 2, _m4);
      glows.push([hx, hz, 12]);
    }
    if (glows.length) { const m = this._glows(glows, ch); if (m) ch.group.add(m); }
  }

  /** Light pools that lie on the ground (a small grid draped over it), so none floats beside an embankment. */
  _glows(list, ch, mat = this.glowMat) {
    const g = this.ground, N = 8;
    const pos = [], uv = [], idx = [];
    for (const [cx, cz, size] of list) {
      const base = pos.length / 3;
      for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
        const x = cx + (i / N - 0.5) * size, z = cz + (j / N - 0.5) * size * 0.85;
        pos.push(x, g.height(x, z) + 0.05, z); uv.push(i / N, j / N);
      }
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const a = base + j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeBoundingSphere();
    ch.own.add(geo);
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 2; m.name = 'glow';
    return m;
  }

  /** Shrines on their terraces, huts, bus stops and convenience stores on their pads beyond a lay-by. */
  _setPieces(ch) {
    const t = this.track, g = this.ground;
    const s0 = t.pts[ch.i0].s, s1 = t.pts[ch.i1].s;
    const rng = mulberry32((this.seed * 131 + ch.c * 7919) >>> 0);
    const own = ch.c * 2;
    for (const m of t.markers) {
      if (m.fi >= t.nFinalF || m.s < s0 || m.s >= s1 || m.kind === 'tunnel') continue;
      const side = m.side;
      const face = (p) => p.h + (side > 0 ? -Math.PI / 2 : Math.PI / 2);      // turned to face the road
      const at = (s, u) => { const p = t.sample(s); const [x, z] = this._at(p, u * side); return { p, x, z, y: g.height(x, z) }; };
      if (m.kind === 'shrine') {
        const pad = t.pads.find((q) => q.kind === 'shrine' && Math.abs(q.s0 + 8 - m.s) < 1);
        const u0 = pad ? pad.u0 : t.wall + 3.6;
        { const a = at(m.s + 11, u0 + 2.2); this._put('torii', own, a.x, a.y, a.z, face(a.p)); }
        for (const ds of [4, 18]) { const a = at(m.s + ds, u0 + 1.2); this._put('lantern', own, a.x, a.y, a.z, face(a.p)); }
        { const a = at(m.s + 11, u0 + 9.5); this._put('hut', own, a.x, a.y, a.z, face(a.p)); }
        for (let k = 0; k < 3; k++) { const a = at(m.s - 2 + k * 12, u0 + 5 + rng() * 3); this._put('maple', own, a.x, a.y - 0.2, a.z, rng() * 6, 0.9 + rng() * 0.3, 1, k === 1 ? PAL.mapleGold : PAL.mapleRed); }
        for (let k = 0; k < 4; k++) { const a = at(m.s + 2 + k * 7, u0 + 12 + rng() * 1.5); this._put('bamboo', own, a.x, a.y - 0.2, a.z, rng() * 6, 0.85 + rng() * 0.35); }
        const l = at(m.s + 24, u0 + 2.4); this._put('lamp', own, l.x, l.y, l.z, face(l.p) + Math.PI);
        this._lampAt(ch, l.x, l.y, l.z, face(l.p) + Math.PI);
        continue;
      }
      // a lay-by: the building stands on the pad beyond its edge, facing the road
      const edge = m.wlay + 1.0;
      const mid = m.s + m.len * 0.45;
      if (m.kind === 'conbini') {
        { const a = at(mid, edge + m.depth * 0.55); this._put('conbini', own, a.x, a.y, a.z, face(a.p)); }
        // the shop's light spills over the lot: a cool pool on the ground, and a place for a lamp light
        { const a = at(mid, edge - 1.5); const gm = this._glows([[a.x, a.z, 16]], ch, this.glowCoolMat); if (gm) ch.group.add(gm);
          this.lamps.push({ x: a.x, y: a.y + 3.2, z: a.z, c: ch.c, color: 0xdcecff, power: 260 }); }
        for (const [ds, du] of [[mid - 9, 0.9], [mid - 7.8, 0.9]]) { const a = at(ds, edge + du); this._put('vending', own, a.x, a.y, a.z, face(a.p)); }
        for (const ds of [m.s - 4, m.s + m.len - 6]) { const a = at(ds, edge + 0.4); this._put('lamp', own, a.x, a.y, a.z, face(a.p) + Math.PI); this._lampAt(ch, a.x, a.y, a.z, face(a.p) + Math.PI); }
        { const a = at(m.s + m.len - 2, edge + m.depth - 1); this._put('bare', own, a.x, a.y - 0.2, a.z, rng() * 6, 0.9); }
      } else if (m.kind === 'busstop') {
        { const a = at(mid, edge + 1.6); this._put('busstop', own, a.x, a.y, a.z, face(a.p)); }
        { const a = at(mid + 8, edge + 0.6); this._put('lamp', own, a.x, a.y, a.z, face(a.p) + Math.PI); this._lampAt(ch, a.x, a.y, a.z, face(a.p) + Math.PI); }
        { const a = at(mid - 7, edge + 3); this._put('bare', own, a.x, a.y - 0.2, a.z, rng() * 6, 1.0); }
        for (let k = 0; k < 3; k++) { const a = at(mid + 12 + k * 4, edge + 2 + rng() * 2); this._put('bamboo', own, a.x, a.y - 0.2, a.z, rng() * 6, 0.8 + rng() * 0.3); }
      } else if (m.kind === 'hut' || m.kind === 'vista') {
        if (m.kind === 'hut') {
          { const a = at(mid, edge + m.depth * 0.5); this._put('hut', own, a.x, a.y, a.z, face(a.p)); }
          { const a = at(mid - 4.2, edge + 0.9); this._put('vending', own, a.x, a.y, a.z, face(a.p)); }
        } else {
          for (let k = 0; k < 5; k++) { const a = at(m.s + 2 + k * 7, edge + m.depth - 0.6); this._put('pole', own, a.x, a.y, a.z, face(a.p)); }
          { const a = at(mid + 6, edge + 2); this._put('boulder', own, a.x, a.y - 0.2, a.z, rng() * 6, 1.1); }
        }
        { const a = at(m.s + 2, edge + 0.6); this._put('lamp', own, a.x, a.y, a.z, face(a.p) + Math.PI); this._lampAt(ch, a.x, a.y, a.z, face(a.p) + Math.PI); }
      }
    }
  }

  /** A lamp placed by a set piece: its bulb, its light and its pool of light. */
  _lampAt(ch, x, y, z, ry) {
    const hx = x + Math.cos(ry) * this.lampHead[0], hz = z - Math.sin(ry) * this.lampHead[0], hy = y + this.lampHead[1];
    this.lamps.push({ x: hx, y: hy - 0.25, z: hz, c: ch.c });
    _q.setFromAxisAngle(_up, 0); _m4.compose(_v.set(hx, hy - 0.22, hz), _q, _s.set(1, 1, 1));
    this.pools.bulb.add(ch.c * 2, _m4);
    const m = this._glows([[hx, hz, 10]], ch); if (m) ch.group.add(m);
  }

  // ------------------------------------------------------------------ dress: the small things, near the car only

  *_dress(ch) {
    if (!ch || ch.near) return;
    const t = this.track, pts = t.pts, g = this.ground;
    const own = ch.c * 2 + 1;
    const rng = mulberry32((this.seed * 977 + ch.c * 104729) >>> 0);
    const nearGroup = new THREE.Group(); nearGroup.name = 'dress';
    const face = (p, side) => p.h + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
    const lampNear = (s) => { const r = ((s % LAMP_EVERY) + LAMP_EVERY) % LAMP_EVERY; return r < 3.5 || r > LAMP_EVERY - 3.5; };
    // posts along the rails, snow poles on the other sides
    for (let i = ch.i0; i < ch.i1; i++) {
      const p = pts[i], k = i - ch.i0;
      for (const side of [1, -1]) {
        const w = side > 0 ? p.wl : p.wr;
        if (ch.rails[side][k]) {
          if (i % 2 === 0) { const [x, z] = this._at(p, (w - 0.12) * side); this._put('post', own, x, p.y, z, face(p, side)); }
        } else if (i % 10 === 3 && !p.tunnel && !t.nearTunnel(p.s, 4) && !t.markerAt(p.s, side) && !t.padAt(p.s, side)) {
          const [x, z] = this._at(p, (w - 0.2) * side); this._put('pole', own, x, p.y, z, face(p, side));
        }
      }
    }
    // cat's eyes: white on the centre dashes every 12 m, red at the edges every 24 m
    for (let i = ch.i0; i < ch.i1; i++) {
      const p = pts[i];
      const ph = ((p.s - 2) % 12 + 12) % 12;
      if (ph >= 2) continue;
      this._put('catseye', own, p.x, p.y + 0.012, p.z, p.h);
      if (Math.floor(p.s / 12) % 2 === 0) for (const side of [1, -1]) { const [x, z] = this._at(p, (t.half - 0.25) * side); this._put('catseye', own, x, p.y, z, p.h + Math.PI); }
    }
    yield;
    // corners: chevrons round the outside of the entry, a mirror at the apex of a switchback
    for (const f of t.features) {
      if (f.i1 < ch.i0 || f.i0 > ch.i1) continue;
      const tight = f.type === 'hairpin' || ((f.type === 'sweeper' || f.type === 'ess') && f.R < 60);
      if (!tight) continue;
      const outside = -f.dir;
      const entry = t.pts[Math.min(f.i1, f.i0 + (f.type === 'hairpin' ? 14 : 4))].s;
      for (let k = 0; k < (f.type === 'hairpin' ? 4 : 2); k++) {
        const s = entry + k * 8;
        const i = t.index(s); if (i < ch.i0 || i >= ch.i1) continue;
        const p = t.sample(s);
        if (p.tunnel || t.nearTunnel(p.s, 6)) continue;
        const w = outside > 0 ? p.wl : p.wr;
        const [x, z] = this._at(p, (w + 0.7) * outside);
        this._put('chevron', own, x, g.height(x, z), z, p.h + Math.PI, 1, f.dir > 0 ? -1 : 1);
      }
      if (f.type === 'hairpin') {
        const s = (t.pts[f.i0].s + t.pts[f.i1].s) / 2;
        const i = t.index(s);
        if (i >= ch.i0 && i < ch.i1) {
          const p = t.sample(s); const w = outside > 0 ? p.wl : p.wr;
          const [x, z] = this._at(p, (w + 1.0) * outside);
          this._put('mirror', own, x, g.height(x, z), z, p.h + Math.PI - f.dir * 0.6);
        }
      }
    }
    // boulders at the foot of a cutting
    for (let i = ch.i0; i < ch.i1; i += 5) {
      const p = pts[i];
      if (p.tunnel || t.nearTunnel(p.s, 12)) continue;
      for (const side of [1, -1]) {
        if (rng() > 0.3 || t.markerAt(p.s, side) || t.padAt(p.s, side)) continue;
        const w = side > 0 ? p.wl : p.wr;
        const [x5, z5] = this._at(p, (w + 5) * side);
        if (g.height(x5, z5) < p.y + 1.4) continue;             // not a cutting
        const u = w + 2.3 + rng() * 1.2;
        const [x, z] = this._at(p, u * side);
        this._put('boulder', own, x, g.height(x, z) - 0.2, z, rng() * 6.28, 0.5 + rng() * 0.8);
      }
    }
    yield;
    // power poles on the uphill side every 44 m, and the two wires strung between them
    const wires = [];
    const poleAt = (sp) => {
      const p = t.sample(sp);
      if (p.tunnel || t.nearTunnel(p.s, 12)) return null;
      const lx = Math.cos(p.h), lz = -Math.sin(p.h);
      const up = g.height(p.x + lx * (p.wl + 8), p.z + lz * (p.wl + 8)) >= g.height(p.x - lx * (p.wr + 8), p.z - lz * (p.wr + 8)) ? 1 : -1;
      if (t.markerAt(p.s, up) || t.padAt(p.s, up)) return null;
      const w = up > 0 ? p.wl : p.wr;
      const [x, z] = this._at(p, (w + 1.5) * up);
      const y = g.height(x, z) - 0.05;
      const fx = Math.sin(p.h), fz = Math.cos(p.h);
      return { p, x, y, z, side: up, ins: [-0.36, 0.36].map((d) => [x + fx * d, y + 8.55, z + fz * d]) };
    };
    const s0 = pts[ch.i0].s, s1 = pts[ch.i1].s;
    for (let sp = Math.ceil((s0 - 14) / 44) * 44 + 14; sp < s1; sp += 44) {
      if (sp < s0) continue;
      const P = poleAt(sp); if (!P) continue;
      this._put('upole', own, P.x, P.y, P.z, P.p.h - Math.PI / 2);
      const Q = sp - 44 >= 0 ? poleAt(sp - 44) : null;
      if (Q && Q.side === P.side && Math.hypot(Q.x - P.x, Q.z - P.z) < 60) {
        for (let k = 0; k < 2; k++) {
          const a = Q.ins[k], b = P.ins[k];
          for (let j = 0; j < 8; j++) {
            const u0 = j / 8, u1 = (j + 1) / 8;
            const sag = (u) => 0.8 * 4 * u * (1 - u);
            wires.push(lerp(a[0], b[0], u0), lerp(a[1], b[1], u0) - sag(u0), lerp(a[2], b[2], u0), lerp(a[0], b[0], u1), lerp(a[1], b[1], u1) - sag(u1), lerp(a[2], b[2], u1));
          }
        }
      }
    }
    if (wires.length) {
      const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3)); wg.computeBoundingSphere();
      const wl = new THREE.LineSegments(wg, this.wireMat); wl.name = 'wires';
      nearGroup.add(wl);
    }
    yield;
    // the verge: maples and broadleaf, bamboo and the odd bare tree, shrubs crowding the edge
    const dens = this.q.trees || 1;
    const probe = {};
    for (let i = ch.i0; i < ch.i1; i += 4) {
      const p = pts[i];
      if (p.tunnel || t.nearTunnel(p.s, 14)) continue;
      for (const side of [1, -1]) {
        if (t.markerAt(p.s, side) || t.padAt(p.s, side)) continue;
        const w = side > 0 ? p.wl : p.wr;
        if (rng() < 0.45 * dens && !lampNear(p.s)) {
          const u = w + 1.8 + rng() * 3.8;
          const [x, z] = this._at(p, u * side);
          g.sample(x, z, 2.2, probe);
          if (probe.edge > 1.2 && !probe.tunnel) {
            const h = probe.h;
            const hx = g.height(x + 1.2, z) - g.height(x - 1.2, z), hz = g.height(x, z + 1.2) - g.height(x, z - 1.2);
            if (hx * hx + hz * hz < 4.0) {
              const pick = rng(), kind = rng();
              if (kind < 0.12) this._put('bare', own, x, h - 0.25, z, rng() * 6.28, 0.8 + rng() * 0.4);
              else if (kind < 0.2) this._put('bamboo', own, x, h - 0.25, z, rng() * 6.28, 0.8 + rng() * 0.35);
              else if (kind < 0.55) this._put('broadleaf', own, x, h - 0.25, z, rng() * 6.28, 0.8 + rng() * 0.45, 1, pick < 0.5 ? PAL.mapleGold : pick < 0.85 ? PAL.dryGrass : PAL.mapleOrange);
              else this._put('maple', own, x, h - 0.25, z, rng() * 6.28, 0.75 + rng() * 0.45, 1, pick < 0.3 ? PAL.mapleRed : pick < 0.7 ? PAL.mapleOrange : PAL.mapleGold);
            }
          }
        }
      }
    }
    for (let i = ch.i0; i < ch.i1; i += 2) {
      const p = pts[i];
      if (p.tunnel || t.nearTunnel(p.s, 6)) continue;
      for (const side of [1, -1]) {
        if (rng() < 0.35 / dens || t.markerAt(p.s, side) || t.padAt(p.s, side)) continue;
        const w = side > 0 ? p.wl : p.wr;
        const u = w + 0.7 + rng() * 2.4;
        const [x, z] = this._at(p, u * side + (rng() - 0.5));
        g.sample(x, z, 2.2, probe);
        if (probe.edge < 0.5 || probe.tunnel) continue;
        const pick = rng();
        const colour = pick < 0.4 ? PAL.dryGrass : pick < 0.68 ? PAL.moss : pick < 0.9 ? PAL.mapleGold : PAL.mapleOrange;
        this._put('shrub', own, x, probe.h - 0.12, z, rng() * 6.28, 0.7 + rng() * 0.7, 1, colour);
      }
    }
    ch.nearGroup = nearGroup;
    ch.group.add(nearGroup);
    ch.near = true;
  }

  // ------------------------------------------------------------------ sky, far things, night

  /** Two rings of far skyline that travel with the camera, and the lights of towns down in the valley. */
  buildSky() {
    const g = new THREE.Group();
    const ring = (radius, base, hMin, hMax, segs, colour, seedOff) => {
      const pos = new Float32Array((segs + 1) * 2 * 3), idx = [];
      const n1 = mulberry32(seedOff);
      const bumps = []; for (let i = 0; i < 7; i++) bumps.push({ a: n1() * Math.PI * 2, w: 0.25 + n1() * 0.6, h: n1() });
      const fine = []; for (let i = 0; i <= segs; i++) fine.push(n1());
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        let h = 0;
        for (const b of bumps) { let d = Math.abs(a - b.a); d = Math.min(d, Math.PI * 2 - d); h = Math.max(h, b.h * Math.max(0, 1 - (d / b.w) * (d / b.w))); }
        const f = 0.5 * fine[i] + 0.5 * fine[(i + 1) % (segs + 1)];
        const y = base + hMin + (hMax - hMin) * (0.6 * h + 0.4 * f * (0.4 + 0.6 * h));
        const x = Math.sin(a) * radius, z = Math.cos(a) * radius;
        pos.set([x, base, z, x, y, z], i * 6);
        if (i < segs) { const b0 = i * 2; idx.push(b0, b0 + 2, b0 + 1, b0 + 1, b0 + 2, b0 + 3); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setIndex(idx); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colour, roughness: 1, metalness: 0, side: THREE.DoubleSide, flatShading: true }));
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false;
      return m;
    };
    g.add(ring(2400, -520, 380, 760, 120, 0x2f4240, 29));
    g.add(ring(3400, -620, 700, 1400, 140, 0x2b3b42, 47));
    this.skyline = g; this.scene.add(g);
    // towns: clusters of warm points, placed down the valley when the course is set
    const N = 900, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.town = new THREE.Points(tg, new THREE.PointsMaterial({ size: 2.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    this.town.frustumCulled = false;
    this.scene.add(this.town);
    this._townAt = null;
  }

  /** Re-seat the valley towns downhill of the car when it has moved far; they are real points on the far terrain. */
  _placeTowns(x, z) {
    const f = this.track.field, U = f.U;
    const rng = mulberry32((this.seed ^ 0x70c0) >>> 0);
    const pos = this.town.geometry.attributes.position.array, col = this.town.geometry.attributes.color.array;
    const N = pos.length / 3;
    const towns = [];
    for (let k = 0; k < 4; k++) {
      const along = (rng() - 0.5) * 2400, down = 900 + rng() * 700;
      towns.push([x - U[0] * down - U[1] * along, z - U[1] * down + U[0] * along, 90 + rng() * 170]);
    }
    for (let i = 0; i < N; i++) {
      const tw = towns[i % towns.length];
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * tw[2];
      const px = tw[0] + Math.cos(a) * r, pz = tw[1] + Math.sin(a) * r;
      pos[i * 3] = px; pos[i * 3 + 1] = f.base(px, pz) - 0.5 + rng() * 5; pos[i * 3 + 2] = pz;
      const warm = rng() < 0.85;
      col[i * 3] = warm ? 1.0 : 0.7; col[i * 3 + 1] = warm ? 0.72 + rng() * 0.2 : 0.85; col[i * 3 + 2] = warm ? 0.35 : 1.0;
    }
    this.town.geometry.attributes.position.needsUpdate = true; this.town.geometry.attributes.color.needsUpdate = true;
    this.town.geometry.computeBoundingSphere();
    this._townAt = [x, z];
  }

  /** Far things follow the camera: the skyline rings exactly, the towns in steps. */
  updateFar(x, y, z) {
    if (this.skyline) this.skyline.position.set(x, y, z);
    if (this.track && (!this._townAt || Math.hypot(x - this._townAt[0], z - this._townAt[1]) > 700)) this._placeTowns(x, z);
  }

  /**
   * Compile every shader program the world can ask for, now, so the first convenience store or bamboo clump to
   * enter the frame does not stall the game while its materials compile.
   */
  async precompile(renderer, camera, refresh = null, target = null, warm = null) {
    const stage = new THREE.Group();
    const m4 = new THREE.Matrix4().makeTranslation(0, -500, 0);
    // every prop draws instanced (pools and forest), so only the instanced programs are needed
    for (const name of Object.keys(this.parts)) {
      for (const p of this.parts[name]) {
        const im = new THREE.InstancedMesh(p.geometry, p.material, 1);
        im.setMatrixAt(0, m4); if (p.material.name === 'foliage_tinted') im.setColorAt(0, new THREE.Color(0xffffff));
        im.castShadow = true; stage.add(im);
      }
    }
    const box = new THREE.BoxGeometry(1, 1, 1);
    for (const m of [this.tunnelMat, this.tunnelLampMat, this.glowMat, this.glowCoolMat, this.bulbMat, this.groundMat, this.farMat, this.roadMat, this.railMat]) {
      const x = new THREE.Mesh(box, m); x.position.y = -500; x.castShadow = true; stage.add(x);
    }
    { const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -500, 0), new THREE.Vector3(1, -500, 0)]), this.wireMat); stage.add(l); }
    this.scene.add(stage);
    const hidden = [];
    for (const p of Object.values(this.pools)) for (const part of p.parts) if (!part.im.visible) { part.im.visible = true; hidden.push(part.im); }
    if (refresh) refresh(this.scene);
    // compiled for the target the frame is really drawn into (the post chain's linear buffer, not the canvas),
    // and in parallel where the browser can
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    try {
      if (renderer.compileAsync) await renderer.compileAsync(this.scene, camera);
      else renderer.compile(this.scene, camera);
    } catch (e) { console.warn('precompile', e.message); }
    renderer.setRenderTarget(prev);
    // and one frame with every kind of prop standing in front of the camera, inside the shadow frustum: the
    // shadow pass compiles its depth programs only when a new kind of caster first falls in it, which was a
    // 100 ms stall a few seconds into the first run
    if (warm) {
      stage.position.set(warm.x, warm.y + 500, warm.z);
      stage.updateMatrixWorld(true);
      warm.render();
      stage.position.set(0, 0, 0);
    }
    for (const im of hidden) im.visible = false;
    this.scene.remove(stage);
  }

  /** Night: light pools come up, towns light, and ground, road and foliage take a cool dark tint. */
  setNight(n) {
    if (this.glowMat) this.glowMat.opacity = 0.75 * n;
    if (this.glowCoolMat) this.glowCoolMat.opacity = 0.7 * n;
    if (this.town) this.town.material.opacity = 0.9 * n;
    if (!this._tinted) {
      this._tinted = [];
      const grab = (mat, k) => { if (mat && mat.color && !this._tinted.some((t) => t.mat === mat)) this._tinted.push({ mat, base: mat.color.clone(), k }); };
      grab(this.groundMat, [0.42, 0.55, 0.95]); grab(this.farMat, [0.34, 0.45, 0.85]); grab(this.roadMat, [0.62, 0.70, 0.95]);
      for (const name of ['maple', 'shrub', 'broadleaf', 'cedar', 'bamboo']) for (const p of this.parts[name] || []) if (/foliage/.test(p.material.name)) grab(p.material, [0.40, 0.52, 0.92]);
      if (this.skyline) this.skyline.children.forEach((m) => grab(m.material, [0.30, 0.38, 0.75]));
    }
    for (const t of this._tinted) t.mat.color.setRGB(t.base.r * (1 + (t.k[0] - 1) * n), t.base.g * (1 + (t.k[1] - 1) * n), t.base.b * (1 + (t.k[2] - 1) * n));
  }
}

/** Merge BufferGeometries with the same attributes (position, normal, uv) into one. */
function mergeGeos(list) {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const g of list) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, ov * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, ov * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, ov * 2);
    if (g.index) { const a = g.index.array; for (let k = 0; k < a.length; k++) idx[oi++] = a[k] + ov; }
    else for (let k = 0; k < n; k++) idx[oi++] = ov + k;
    ov += n;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}
