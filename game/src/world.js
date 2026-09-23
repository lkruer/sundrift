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
import { ASSET } from '../assetlib.js?v=202609231752';
import { surface } from '../surfaces.js?v=202609231752';
import { PAL, clamp, lerp, smoothstep, mulberry32 } from './config.js?v=202609231752';
import { Ground } from './ground.js?v=202609231752';
import { Terrain, LODS } from './terrain.js?v=202609231752';
import { partsOf, Pool } from './instancing.js?v=202609231752';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const ASSETS = {
  cedar: './assets/cedar_tree.js', maple: './assets/maple_tree.js', boulder: './assets/boulder.js',
  post: './assets/guardrail_post.js', pole: './assets/snow_pole.js', lamp: './assets/lamp_post.js',
  mirror: './assets/traffic_mirror.js', chevron: './assets/chevron_sign.js', torii: './assets/torii_gate.js',
  lantern: './assets/stone_lantern.js', portal: './assets/tunnel_portal.js', hut: './assets/mountain_hut.js',
  vending: './assets/vending_machine.js', shrub: './assets/roadside_shrub.js', broadleaf: './assets/broadleaf_tree.js',
  catseye: './assets/cats_eye.js', upole: './assets/power_pole.js', bamboo: './assets/bamboo_clump.js', bare: './assets/bare_tree.js',
  conbini: './assets/conbini.js', busstop: './assets/bus_shelter.js', chochin: './assets/chochin.js', jizo: './assets/jizo.js',
  sakura: './assets/sakura_tree.js', weeping: './assets/weeping_cherry.js',
  grass: './assets/grass_tuft.js', flowers: './assets/wildflowers.js', pagoda: './assets/pagoda.js',
};
const SURFACED = new Set(['boulder', 'post', 'pole', 'lamp', 'mirror', 'chevron', 'torii', 'lantern', 'portal', 'hut', 'vending', 'upole', 'conbini', 'busstop', 'jizo', 'pagoda']);
// pool capacities: what the whole visible road can hold at once
const CAPS = {
  lamp: 320, post: 1400, pole: 500, chevron: 120, mirror: 40, boulder: 300, upole: 160,
  maple: 300, broadleaf: 500, shrub: 1600, bamboo: 160, bare: 120, sakura: 700, weeping: 24,
  torii: 8, lantern: 24, hut: 12, vending: 90, conbini: 6, busstop: 8, portal: 8, chochin: 700, jizo: 40,
  grass: 3600, flowers: 1000, pagoda: 6,
};
/**
 * What the car can hit, by template: 'solid' things stop it (a hit, like a wall), 'knock' things are sent flying,
 * 'flat' things are flattened. r is the collision radius at scale 1 (a tree's trunk, a post's pole), m the mass in
 * kg (how far it flies, how much the car feels it); box takes the template's own footprint.
 */
const COLL = {
  pole: { kind: 'knock', r: 0.13, m: 4 }, chevron: { kind: 'knock', r: 0.16, m: 9 }, mirror: { kind: 'knock', r: 0.14, m: 11 },
  lamp: { kind: 'knock', r: 0.17, m: 60 }, vending: { kind: 'knock', box: true, m: 220 }, bollard: { kind: 'knock', r: 0.13, m: 7 },
  bag: { kind: 'knock', r: 0.3, m: 3 }, crate: { kind: 'knock', r: 0.24, m: 5 }, crates: { kind: 'knock', r: 0.26, m: 9 },
  box: { kind: 'knock', r: 0.24, m: 2 }, cone: { kind: 'knock', r: 0.18, m: 2 }, aboard: { kind: 'knock', r: 0.3, m: 6 }, bike: { kind: 'knock', r: 0.42, m: 16 },
  shrub: { kind: 'flat', r: 0.55, m: 2 },
  sakura: { kind: 'solid', r: 0.42 }, weeping: { kind: 'solid', r: 0.45 }, maple: { kind: 'solid', r: 0.3 }, broadleaf: { kind: 'solid', r: 0.3 },
  bare: { kind: 'solid', r: 0.28 }, cedar: { kind: 'solid', r: 0.4 }, bamboo: { kind: 'solid', r: 0.85 }, boulder: { kind: 'solid', r: 0.7 },
  upole: { kind: 'solid', r: 0.2 }, lantern: { kind: 'solid', r: 0.42 }, jizo: { kind: 'solid', r: 0.24 }, torii: { kind: 'solid', legs: true, r: 0.26 },
  hut: { kind: 'solid', box: true }, conbini: { kind: 'solid', box: true }, busstop: { kind: 'solid', box: true }, pagoda: { kind: 'solid', box: true },
};
const COL_CELL = 8;
const colKey = (cx, cz) => (cx + 50000) * 100000 + (cz + 50000);

const TINTED = new Set(['maple', 'broadleaf', 'shrub', 'sakura', 'weeping', 'grass', 'flowers']);
// a cherry's colour, by a number in 0..1: mostly the pale Somei-Yoshino, some pinker, a few nearly white
const cherryColour = (r) => (r < 0.6 ? PAL.sakuraPale : r < 0.86 ? PAL.sakuraPink : PAL.sakuraWhite);
const CHUNK = 60;
const NEAR_R = 150, FAR_R = 470, DROP_R = 540;
const LAMP_EVERY = 30;

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

/**
 * Whether a font really draws these characters rather than the missing-glyph box: the text and as many unassigned
 * code points are drawn and the pixels compared. (Comparing widths is not enough: a Japanese face's box is a full
 * em wide, like its kanji.)
 */
export function drawsGlyphs(font, text) {
  const cv = document.createElement('canvas'); cv.width = 56 * text.length; cv.height = 56;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const draw = (str) => { ctx.clearRect(0, 0, cv.width, cv.height); ctx.font = font; ctx.fillStyle = '#fff'; ctx.textBaseline = 'top'; ctx.fillText(str, 2, 4); return ctx.getImageData(0, 0, cv.width, cv.height).data; };
  const a = draw(text), b = draw(String.fromCharCode(0x378).repeat(text.length));
  let diff = 0;
  for (let i = 3; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 60) diff++;
  return diff > 40 * text.length;
}

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
    // fallen cherry petals: blown into drifts against the edges and the gravel, a few across the lanes
    {
      const drift = 0.55 + 0.45 * Math.sin(vm * 0.61 + u * 0.8) * Math.sin(vm * 0.19 + 1.7);
      const k = (au > half ? 0.1 : 0.0022 + 0.06 * Math.exp(-Math.pow((half - au) / 0.5, 2))) * drift;
      if (rnd() < k) {
        const pk = rnd();
        c = (pk < 0.55 ? [224, 176, 190] : pk < 0.82 ? [212, 146, 170] : [232, 208, 216]).map((v) => v * (0.85 + 0.15 * rnd()));
        rough = 0.82;
      }
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
 * The bore's lining, across (u) and 12 m along (v): the kerb face, the walkway, cream tiles with a painted band
 * at their top, and the concrete arch with its panel joint and water stains; mirrored about the crown.
 */
function tunnelTexture() {
  const W = 1024, H = 512;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  let seed = 23;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const band = (u0, u1, fill) => { for (const [a, b] of [[u0, u1], [1 - u1, 1 - u0]]) { ctx.fillStyle = fill; ctx.fillRect(a * W, 0, (b - a) * W, H); } };
  band(0, 0.035, '#e6e2d8');                                   // the kerb face, painted white
  band(0.035, 0.1, '#8b8983');                                 // walkway
  band(0.1, 0.43, '#d6cdb4');                                  // the tiles
  band(0.415, 0.43, '#2f5a47');                                // a green band along their top
  band(0.43, 0.57, '#6d6b67');                                 // the arch
  // tiles: 0.3 m courses up the wall, 0.6 m along, grout lines and a little variation, grime near the foot
  const tileU0 = 0.105, tileU1 = 0.415, courses = 7, perV = 20;
  for (const mir of [false, true]) {
    for (let c = 0; c < courses; c++) for (let r = 0; r < perV; r++) {
      const a = tileU0 + (tileU1 - tileU0) * (c / courses), b = tileU0 + (tileU1 - tileU0) * ((c + 1) / courses);
      const x0 = (mir ? 1 - b : a) * W, x1 = (mir ? 1 - a : b) * W;
      const y0 = (r / perV) * H, y1 = ((r + 1) / perV) * H;
      const k = 0.93 + rnd() * 0.1 - (c === 0 ? 0.12 : c === 1 ? 0.05 : 0);
      ctx.fillStyle = `rgb(${214 * k | 0},${205 * k | 0},${180 * k | 0})`;
      ctx.fillRect(x0 + 1.5, y0 + 1.5, x1 - x0 - 3, y1 - y0 - 3);
    }
  }
  // kerb joints, walkway joints every 3 m, the arch's panel joint and its water stains
  ctx.fillStyle = 'rgba(30,30,30,0.5)';
  for (let r = 0; r < 4; r++) { const y = (r / 4) * H; ctx.fillRect(0.035 * W, y, 0.065 * W, 2); ctx.fillRect(0.9 * W, y, 0.065 * W, 2); }
  ctx.fillStyle = 'rgba(20,20,20,0.55)'; ctx.fillRect(0.43 * W, 0, 0.14 * W, 3);
  for (let i = 0; i < 26; i++) {
    const x = (0.43 + rnd() * 0.14) * W, y = rnd() * H, len = 20 + rnd() * 90;
    const gr = ctx.createLinearGradient(x, y, x, y + len);
    gr.addColorStop(0, 'rgba(40,38,34,0.35)'); gr.addColorStop(1, 'rgba(40,38,34,0)');
    ctx.fillStyle = gr; ctx.fillRect(x, y, 2 + rnd() * 5, len);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
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
    this.cols = new Map();      // collider cell -> records of things the car can hit
    this.colsBy = new Map();    // owner (a chunk's build or dress level, a terrain tile) -> its records
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
    for (const name of ['maple', 'shrub', 'broadleaf', 'sakura', 'weeping', 'grass', 'flowers']) {
      const tpl = this.templates[name]; if (!tpl) continue;
      tpl.traverse((o) => {
        const hex = o.isMesh && o.material ? o.material.color.getHex() : -1;
        if (o.isMesh && o.material && (o.material.name === 'foliage' || hex === PAL.mapleOrange || hex === PAL.dryGrass || hex === PAL.mapleGold)) {
          o.material = o.material.clone(); o.material.color.set(0xffffff); o.material.name = 'foliage_tinted';
          // blossom holds a little light of its own, so a cherry reads as a pale cloud even away from a lamp
          if (name === 'sakura' || name === 'weeping') { o.material.emissive = new THREE.Color(0x3a2230); o.material.emissiveIntensity = 1; }
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
    this.foot = {};
    for (const k of names) { const b = new THREE.Box3().setFromObject(this.templates[k]); this.foot[k] = [(b.max.x - b.min.x) / 2, (b.max.z - b.min.z) / 2, b.max.y - b.min.y]; }
    // the far forest's cherry: the same blossom and bark materials on a hundred-odd triangles (five flattened
    // clouds in an umbrella over a trunk), for the ring of tiles past 200 m where the full tree's 1,200 would be
    // spent on a pink dot
    if (this.parts.sakura) {
      const fol = this.parts.sakura.find((p) => p.material.name === 'foliage_tinted'), bark = this.parts.sakura.find((p) => p.material.name !== 'foliage_tinted');
      const clouds = [[0, 5.6, 0, 2.6], [2.4, 5.0, 0.6, 2.0], [-2.2, 5.1, -0.7, 2.1], [0.5, 5.0, -2.3, 1.9], [-0.6, 4.9, 2.3, 1.9]].map(([x, y, z, r]) => {
        const g = new THREE.IcosahedronGeometry(r, 0); g.scale(1, 0.62, 1); g.translate(x, y, z); return g;
      });
      const trunk = new THREE.CylinderGeometry(0.16, 0.26, 4.4, 5); trunk.translate(0, 2.2, 0);
      this.parts.sakuraFar = [];
      if (fol) this.parts.sakuraFar.push({ geometry: mergeGeos(clouds.map((g) => g.index ? g.toNonIndexed() : g)), material: fol.material, local: new THREE.Matrix4() });
      if (bark) this.parts.sakuraFar.push({ geometry: mergeGeos([trunk]), material: bark.material, local: new THREE.Matrix4() });
    }
    // the lamp's head: the far end of its arm, found from the template rather than assumed
    {
      const box = new THREE.Box3().setFromObject(this.templates.lamp);
      this.lampHead = [box.max.x - 0.28, box.max.y - 0.3];
      this.lampReach = box.max.x;
      // the far lamp: a post, the arm and a head in the lamp's own metal, thirty-odd triangles for a lamp a few
      // hundred metres off (its bulb and its pool of light are separate and stay)
      const metal = this.parts.lamp.slice().sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count)[0];
      if (metal) {
        // (the template is centred, as every asset is, so its post stands at the box's -x end, not at the origin)
        const H = this.lampHead[1] + 0.25, R = this.lampHead[0], x0 = box.min.x + 0.1;
        const post = new THREE.CylinderGeometry(0.07, 0.1, H, 6); post.translate(x0, H / 2, 0);
        const arm = new THREE.BoxGeometry(R - x0 + 0.1, 0.09, 0.09); arm.translate((R + x0) / 2, H - 0.12, 0);
        const head = new THREE.BoxGeometry(0.62, 0.14, 0.3); head.translate(R, H - 0.26, 0);
        this.pools.lampFar = new Pool([{ geometry: mergeGeos([post, arm, head]), material: metal.material, local: new THREE.Matrix4() }], 360);
      }
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
    // the lining glows faintly sodium-orange: the whole bore is lit by its lamps, not just the stretch round the car
    { const tt = tunnelTexture(); this.tunnelMat = new THREE.MeshStandardMaterial({ map: tt, emissiveMap: tt, emissive: 0xff9448, emissiveIntensity: 0.62, roughness: 0.82, metalness: 0, side: THREE.DoubleSide }); }
    this.tunnelMat.name = 'bore';
    this.tunnelLampMat = new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffa84a, emissiveIntensity: 2.6, roughness: 0.5 });
    this.fixMetalMat = new THREE.MeshStandardMaterial({ color: 0x3b3d42, roughness: 0.55, metalness: 0.5 });
    this.signGreenMat = new THREE.MeshStandardMaterial({ color: 0x3ad082, emissive: 0x20c46a, emissiveIntensity: 1.7, roughness: 0.5 });
    this.signRedMat = new THREE.MeshStandardMaterial({ color: 0xff3a24, emissive: 0xff2a18, emissiveIntensity: 2.4, roughness: 0.5 });
    this.reflectorMat = new THREE.MeshStandardMaterial({ color: 0xffb030, emissive: 0xff9a20, emissiveIntensity: 1.5, roughness: 0.4 });
    this.tunnelGlowMat = new THREE.MeshBasicMaterial({ color: 0xff9a40, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, opacity: 0.55 });
    this.portalMat = new THREE.MeshStandardMaterial({ color: 0xa29e95, roughness: 0.92, metalness: 0 });
    this.copingMat = new THREE.MeshStandardMaterial({ color: 0x4a4f5a, roughness: 0.8, metalness: 0 });
    this._plateMat(['霧峰', 'KIRIMINE']);                          // one plate made now, so its program compiles with the rest
    this.wireMat = new THREE.LineBasicMaterial({ color: 0x15161a });
    this.postMat = new THREE.MeshStandardMaterial({ color: PAL.timber, roughness: 0.85, metalness: 0 });
    this.postMat.name = 'timber';
    this.toriiRedMat = new THREE.MeshStandardMaterial({ color: PAL.vermilion, roughness: 0.62, metalness: 0, side: THREE.DoubleSide, emissive: 0x3a0c06, emissiveIntensity: 1 });
    this.toriiBlackMat = new THREE.MeshStandardMaterial({ color: 0x1c1a1a, roughness: 0.55, metalness: 0, side: THREE.DoubleSide });
    this.toriiPlaqueGeo = new THREE.PlaneGeometry(1.0, 1.5);
    this.signBoardGeo = new THREE.BoxGeometry(3.4, 2.02, 0.08);
    this.signFaceGeo = new THREE.PlaneGeometry(3.3, 1.94);
    this.signBackMat = new THREE.MeshStandardMaterial({ color: PAL.galvanised, roughness: 0.5, metalness: 0.6 });
    this._signFaces();
    this._roadTextMat('徐行');
    this._toriiPlaqueMat();
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
      this.glowLanternMat = this.glowMat.clone(); this.glowLanternMat.color.set(0xff7050);
      this.glowCityMat = this.glowMat.clone(); this.glowCityMat.color.set(0xc6d8ff);
      // road studs: retroreflectors drawn as points of light, a fixed few pixels across however far, bright where
      // the headlights point (a retroreflector sends the beam straight back, so it shines from far beyond the
      // beam's own reach) and dim elsewhere; additive and depth-tested but not depth-written, so never inked
      this.studMat = new THREE.ShaderMaterial({
        uniforms: { uCar: { value: new THREE.Vector3(0, -1e4, 0) }, uFwd: { value: new THREE.Vector2(0, 1) }, uNight: { value: 1 }, uScale: { value: 720 } },
        vertexShader: `
          uniform vec3 uCar; uniform vec2 uFwd; uniform float uNight, uScale;
          attribute vec3 aCol;
          varying vec3 vC; varying float vA;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            float d = max(0.5, -mv.z);
            vec2 to = position.xz - uCar.xz; float dl = length(to);
            float ahead = smoothstep(0.5, 0.93, dot(to / max(dl, 0.01), uFwd)) * step(2.5, dl);
            float near = smoothstep(60.0, 6.0, dl);
            float lit = 0.34 + 0.66 * max(ahead, near * 0.8);
            vA = lit * (0.2 + 0.8 * uNight) * smoothstep(640.0, 420.0, d);
            vC = aCol;
            float k = uScale / 720.0;
            gl_PointSize = clamp(uScale * 0.24 / d, 2.3 * k, 8.0 * k) * (0.8 + 0.4 * lit);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          varying vec3 vC; varying float vA;
          void main() {
            vec2 c = gl_PointCoord - 0.5; float r = dot(c, c);
            if (r > 0.25) discard;
            float a = smoothstep(0.25, 0.02, r);
            gl_FragColor = vec4(vC * (1.6 + 2.8 * a * a), vA * a);
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      this.studMat.name = 'studs';
    }
    // the shared pools
    if (this.parts.sakuraFar) this.pools.sakuraFar = new Pool(this.parts.sakuraFar, 700, { tint: true });
    if (this.parts.chochin) {
      const lit = this.parts.chochin.find((p) => p.material.name === 'lantern');
      if (lit) {
        const g = new THREE.IcosahedronGeometry(0.17, 0); g.scale(1, 1.55, 1); g.translate(0, 0.28, 0);
        this.pools.chochinFar = new Pool([{ geometry: g, material: lit.material, local: new THREE.Matrix4() }], 700);
      }
    }
    const bulbParts = [{ geometry: new THREE.SphereGeometry(0.2, 8, 6), material: this.bulbMat, local: new THREE.Matrix4() }];
    this.pools.bulb = new Pool(bulbParts, CAPS.lamp);
    for (const k of Object.keys(CAPS)) {
      if (!this.parts[k]) continue;
      this.pools[k] = new Pool(this.parts[k], CAPS[k], { tint: TINTED.has(k) });
    }
    // the grass and the flowers are drawn after everything solid and write no depth: blades a few pixels across
    // that write depth are inked by the cel pass into black scribble
    for (const k of ['grass', 'flowers']) {
      const pool = this.pools[k]; if (!pool) continue;
      for (const p of pool.parts) { p.im.material.depthWrite = false; p.im.renderOrder = 2; p.im.receiveShadow = false; }
    }
    for (const p of Object.values(this.pools)) this.root.add(p.group);
    this.buildSky();
    // the city (NEO TOKYO): its module is loaded here, and its materials made now so they compile with the rest
    try {
      this.glyphs = drawsGlyphs;
      this.City = await import('./city.js?v=202609231752');
      this._cityMats = this.City.cityLoad(this, Pool, '"M PLUS Rounded 1c", "Dela Gothic One", "Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif');
      const L = await import('./landmarks.js?v=202609231752').catch((e) => { console.warn('landmarks', e && e.message); return null; });
      this.citySky = this.City.citySkyBuild(this, L);
      this.citySky.visible = false;
      this.scene.add(this.citySky);
    } catch (e) { console.warn('city', e && e.message); this.City = null; this._cityMats = []; }
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
    this.city = !!track.city && !!this.City;
    const rt = this.city ? this.City.cityRoadTexture(track.half, track.wall) : roadTexture(track.half, track.wall);
    // a city fence is painted white; the mountain's guardrail is bare galvanised steel
    this.railMat.color.set(this.city ? 0xd8d6ce : PAL.galvanised);
    if (this.skyline) this.skyline.visible = !this.city;
    if (this.town) this.town.visible = !this.city;
    if (this.citySky) this.citySky.visible = this.city;
    if (this.roadMat.map) { this.roadMat.map.dispose(); this.roadMat.roughnessMap.dispose(); }
    this.roadMat.map = rt.map; this.roadMat.roughnessMap = rt.roughnessMap; this.roadMat.needsUpdate = true;
    this.texLen = rt.len;
    const tp = { cedar: this.parts.cedar, maple: this.parts.maple, broadleaf: this.parts.broadleaf, bare: this.parts.bare, sakura: this.parts.sakura || null, sakuraFar: this.parts.sakuraFar || null };
    const building = this.city ? { geometry: this.pools.bldg.parts[0].im.geometry, material: this.bldgMat } : null;
    const colliders = { add: (o, list) => this.addTrees(o, list), drop: (o) => this.dropTrees(o) };
    if (!this.terrain) this.terrain = new Terrain({ scene: this.scene, ground: this.ground, mat: this.groundMat, farMat: this.farMat, parts: tp, density: this.q.trees, seed: track.seed, city: this.city, building, colliders });
    else { this.terrain.o.seed = track.seed; this.terrain.o.city = this.city; this.terrain.o.building = building; this.terrain.reset(this.ground); }
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
    this._unregOwner(ch.c * 2);
    this.root.remove(ch.group);
    ch.group.traverse((o) => { if ((o.isMesh || o.isLineSegments) && ch.own.has(o.geometry)) o.geometry.dispose(); });
    this.lamps = this.lamps.filter((l) => l.c !== ch.c);
  }

  _undress(ch) {
    if (!ch.near) return;
    for (const p of Object.values(this.pools)) p.removeOwner(ch.c * 2 + 1);
    this._unregOwner(ch.c * 2 + 1);
    this._lodSwap(ch, false);
    if (ch.nearGroup) {
      ch.group.remove(ch.nearGroup);
      ch.nearGroup.traverse((o) => { if ((o.isMesh || o.isLineSegments) && o.geometry) o.geometry.dispose(); });
      ch.nearGroup = null;
    }
    ch.near = false;
  }

  /** Put one of a template into a pool under owner, at (x, y, z) turned ry, scaled. */
  _put(name, owner, x, y, z, ry, sc = 1, sx = 1, colour = null, reg = true) {
    const pool = this.pools[name]; if (!pool) return null;
    _q.setFromAxisAngle(_up, ry); _s.set(sc * sx, sc, sc);
    _m4.compose(_v.set(x, y, z), _q, _s);
    const id = pool.add(owner, _m4, colour);
    const C = COLL[name];
    if (!reg || !C || !id) return null;
    const rec = { name, pool: name, id, owner, x, y, z, ry, sc, colour, kind: C.kind, r: (C.r || 0) * sc, m: C.m || 0, alive: true };
    if (C.box) { const f = this.foot[name] || [1, 1, 2]; rec.hx = f[0] * sc * 0.96; rec.hz = f[1] * sc * 0.96; rec.r = Math.hypot(rec.hx, rec.hz); rec.box = true; }
    if (C.legs) {
      // a torii: its two legs, across the gate
      const half = (this.foot[name] ? this.foot[name][0] : 2.7) * sc - 0.45, lx = Math.cos(ry), lz = -Math.sin(ry);
      for (const s of [-1, 1]) this._reg(owner, { ...rec, x: x + lx * half * s, z: z + lz * half * s, r: C.r * sc });
      return rec;
    }
    this._reg(owner, rec);
    return rec;
  }

  // ------------------------------------------------------------------ what the car can hit

  _reg(owner, rec) {
    rec.owner = owner;
    const R = rec.r || 0.5, c0x = Math.floor((rec.x - R) / COL_CELL), c1x = Math.floor((rec.x + R) / COL_CELL);
    const c0z = Math.floor((rec.z - R) / COL_CELL), c1z = Math.floor((rec.z + R) / COL_CELL);
    rec.cells = [];
    for (let cx = c0x; cx <= c1x; cx++) for (let cz = c0z; cz <= c1z; cz++) {
      const k = colKey(cx, cz); let a = this.cols.get(k); if (!a) this.cols.set(k, a = []);
      a.push(rec); rec.cells.push(k);
    }
    let o = this.colsBy.get(owner); if (!o) this.colsBy.set(owner, o = []);
    o.push(rec);
  }

  _unreg1(rec) {
    for (const k of rec.cells || []) { const a = this.cols.get(k); if (!a) continue; const i = a.indexOf(rec); if (i >= 0) { a[i] = a[a.length - 1]; a.pop(); } if (!a.length) this.cols.delete(k); }
    rec.cells = null;
  }

  _unregOwner(owner) {
    const o = this.colsBy.get(owner); if (!o) return;
    for (const rec of o) if (rec.cells) this._unreg1(rec);
    this.colsBy.delete(owner);
  }

  /** Every live record whose cell is within reach of (x, z); calls fn(rec) for each (a record may repeat). */
  near(x, z, reach, fn) {
    const c0x = Math.floor((x - reach) / COL_CELL), c1x = Math.floor((x + reach) / COL_CELL);
    const c0z = Math.floor((z - reach) / COL_CELL), c1z = Math.floor((z + reach) / COL_CELL);
    for (let cx = c0x; cx <= c1x; cx++) for (let cz = c0z; cz <= c1z; cz++) {
      const a = this.cols.get(colKey(cx, cz)); if (!a) continue;
      for (let i = 0; i < a.length; i++) if (a[i].alive) fn(a[i]);
    }
  }

  /** Terrain tiles register their forest's trunks here (and take them away with the tile). */
  addTrees(owner, list) { for (const [x, z, r, y] of list) this._reg(owner, { name: 'tree', kind: 'solid', x, y: y ?? 0, z, r, alive: true }); }
  dropTrees(owner) { this._unregOwner(owner); }

  /**
   * Knock one thing over: it leaves its pool (and, a lamp, its light, its bulb and its pool of light go out) and
   * the caller throws a copy of it into the air. False if it was already gone.
   */
  knock(rec) {
    if (!rec.alive) return false;
    rec.alive = false;
    const pool = this.pools[rec.pool]; if (pool && rec.id) pool.removeId(rec.id);
    if (rec.cells) this._unreg1(rec);
    if (rec.light) { const i = this.lamps.indexOf(rec.light); if (i >= 0) this.lamps.splice(i, 1); }
    if (rec.bulbId) this.pools.bulb.removeId(rec.bulbId);
    if (rec.glowMesh) rec.glowMesh.visible = false;
    if (rec.glowList && rec.ch) {
      const i = rec.glowList.indexOf(rec.glow); if (i >= 0) rec.glowList.splice(i, 1);
      this._lampGlowMesh(rec.ch);
    }
    return true;
  }

  /**
   * Where the car meets a hard edge on each side of each sample, as a distance beyond the road's edge: 0 at a rail
   * or a tunnel's lining (and near a portal), 2.75 at a city's street fronts, Infinity where there is nothing:
   * there the car can leave the road.
   */
  _hardLines(ch) {
    const t = this.track, pts = t.pts;
    for (let i = ch.i0; i <= ch.i1; i++) {
      const p = pts[i], k = i - ch.i0, tun = p.tunnel || t.nearTunnel(p.s, 12);
      for (const side of [1, -1]) {
        const off = tun || p.express || ch.rails[side][k] ? 0 : this.city ? 2.75 : Infinity;
        if (side > 0) p.hardL = off; else p.hardR = off;
      }
    }
  }

  /** Out of the reckoning, but left standing (a bush, flattened where it grew). */
  retire(rec) { rec.alive = false; if (rec.cells) this._unreg1(rec); }

  /** The chunk's street lamps' pools of light, one mesh, rebuilt when one goes out. */
  _lampGlowMesh(ch) {
    if (ch.lampGlow) { ch.group.remove(ch.lampGlow); ch.lampGlow.geometry.dispose(); ch.own.delete(ch.lampGlow.geometry); ch.lampGlow = null; }
    if (!ch.lampGlows || !ch.lampGlows.length) return;
    const m = this._glows(ch.lampGlows, ch, this.city ? this.glowCityMat : this.glowMat);
    if (m) { ch.group.add(m); ch.lampGlow = m; }
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
    this._hardLines(ch);
    const rail = this._rails(ch); if (rail) ch.group.add(rail);
    const tube = this._tunnel(ch); if (tube) ch.group.add(tube);
    yield;
    this._lampsFor(ch);
    this._setPieces(ch);
    this._avenueFor(ch);
    this._signsFor(ch);
    this._studs(ch);
    if (this.city) yield* this.City.cityChunk(this, ch);
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
      const v = p.s / this.texLen, tb = Math.tan(p.bank || 0), cb = Math.cos(p.bank || 0), sb = Math.sin(p.bank || 0);
      for (let j = 0; j < cols; j++) {
        const u = us[j], o = k * per + j;
        const dy = Math.abs(u) < half ? 0.012 * (1 - Math.abs(u) / half) : 0;
        pos[o * 3] = p.x + lx * u; pos[o * 3 + 1] = p.y + dy - u * tb; pos[o * 3 + 2] = p.z + lz * u;
        uv[o * 2] = (clamp(u, -TW, TW) + TW) / (2 * TW); uv[o * 2 + 1] = v;
        nor[o * 3] = lx * sb; nor[o * 3 + 1] = cb; nor[o * 3 + 2] = lz * sb;
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
        // a rail where the ground falls away or on the outside of a tight bend (in the city there is none: the
        // expressway's edges are its concrete barriers, and hard all the same)
        if (!this.city && (drop > 0.9 || tight)) plan[side][i - ch.i0] = 1;
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

  /**
   * A tunnel, as a Japanese mountain road has them: kerbs with amber reflectors, a raised walkway each side,
   * cream-tiled lower walls with a painted band, a concrete arch, a continuous row of sodium lamps along each
   * springline, cable trays, green exit signs, red alarm lamps, jet fans hung in pairs from the crown, and the
   * lamps' orange light lying along the walkways. Portals of any tunnel that starts or ends in this chunk too.
   */
  _tunnel(ch) {
    const t = this.track, pts = t.pts;
    const inside = [];
    for (let i = ch.i0; i <= ch.i1; i++) if (pts[i].tunnel) inside.push(i);
    const grp = new THREE.Group(); grp.name = 'tunnel';
    for (const tn of t.tunnels) {
      if (tn.fi >= t.nFinalF) continue;
      for (const [s, flip] of [[tn.s0 - 1.0, Math.PI], [tn.s1 + 1.0, 0]]) {
        const i = t.index(s); if (i < ch.i0 || i >= ch.i1) continue;
        const p = t.sample(s);
        const portal = this._portal(tn, ch);
        portal.position.set(p.x, p.y, p.z); portal.rotation.y = p.h + flip;
        grp.add(portal);
        const out = flip ? -1 : 1, fx = Math.sin(p.h) * out, fz = Math.cos(p.h) * out;
        this.lamps.push({ x: p.x + fx * 2.5, y: p.y + 7.4, z: p.z + fz * 2.5, c: ch.c });
      }
    }
    if (inside.length < 2) return grp.children.length ? grp : null;
    const W = t.tubeHalf, K = t.half + 0.55, H0 = 2.4, RV = 4.05;

    // the bore: strips of the section, each with its own vertices so the corners stay crisp; texU is where the
    // point sits on the lining texture (kerb, walkway, tiles, band, arch; mirrored about 0.5)
    const strips = [];
    for (const side of [1, -1]) {
      const m = (v) => (side > 0 ? v : 1 - v);
      strips.push([[side * K, -0.12, m(0.0)], [side * K, 0.22, m(0.035)]]);                   // kerb face
      strips.push([[side * K, 0.22, m(0.035)], [side * (W - 0.02), 0.22, m(0.1)]]);           // walkway
      strips.push([[side * W, 0.22, m(0.105)], [side * W, H0, m(0.43)]]);                     // tiled wall
    }
    const arch = [];
    for (let k = 0; k <= 20; k++) { const a = (k / 20) * Math.PI; arch.push([Math.cos(a) * W, H0 + Math.sin(a) * RV, 0.43 + 0.14 * (k / 20)]); }
    strips.push(arch);
    const n = inside.length;
    const pos = [], uv = [], idx = [];
    for (const st of strips) {
      const base = pos.length / 3, cols = st.length;
      for (let k = 0; k < n; k++) {
        const p = pts[inside[k]];
        const lx = Math.cos(p.h), lz = -Math.sin(p.h);
        for (const [u, y, tu] of st) { pos.push(p.x + lx * u, p.y + y, p.z + lz * u); uv.push(tu, p.s / 12); }
        if (k < n - 1) for (let j = 0; j < cols - 1; j++) {
          const a = base + k * cols + j, b = a + 1, c2 = a + cols, d = c2 + 1;
          idx.push(a, b, c2, b, d, c2);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    ch.own.add(g);
    // it casts: the moon has no business lighting the inside of a tunnel through the hill
    const bore = new THREE.Mesh(g, this.tunnelMat); bore.receiveShadow = true; bore.castShadow = true; bore.name = 'bore';
    grp.add(bore);

    // the fittings, merged by material
    const sets = { metal: [], lamp: [], green: [], red: [], amber: [] };
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const G = this._tunnelGeo || (this._tunnelGeo = {
      housing: box(0.34, 0.16, 1.2), lens: box(0.24, 0.05, 1.05), tray: box(0.3, 0.07, 2.06), refl: box(0.04, 0.09, 0.13),
      exit: box(0.05, 0.32, 0.78), cabinet: box(0.18, 0.72, 0.56), alarm: box(0.09, 0.13, 0.13), bracket: box(0.08, 0.6, 0.08),
      fan: new THREE.CylinderGeometry(0.5, 0.5, 3.4, 16, 1).rotateX(Math.PI / 2),
    });
    const m4 = new THREE.Matrix4(), rq = new THREE.Quaternion(), rx = new THREE.Quaternion(), fwd = new THREE.Vector3(0, 0, 1);
    const put = (set, geo, p, u, y, roll = 0) => {
      const [x, z] = this._at(p, u);
      rq.setFromAxisAngle(_up, p.h); rx.setFromAxisAngle(fwd, roll); rq.multiply(rx);
      m4.compose(_v.set(x, p.y + y, z), rq, _s.set(1, 1, 1));
      sets[set].push(geo.clone().applyMatrix4(m4));
    };
    const sA = pts[inside[0]].s, sB = pts[inside[n - 1]].s;
    const at = (s) => t.sample(s);
    for (let s = Math.ceil(sA / 3) * 3; s <= sB; s += 3) {                     // lamps: a continuous row each side
      const p = at(s);
      for (const side of [1, -1]) {
        put('metal', G.housing, p, side * (W - 0.3), H0 + 0.62, side * 0.55);
        put('lamp', G.lens, p, side * (W - 0.36), H0 + 0.53, side * 0.55);
      }
      if (Math.round(s) % 12 === 0) this.lamps.push({ x: p.x, y: p.y + H0 + 1.9, z: p.z, c: ch.c, tunnel: true });
    }
    for (let k = 0; k < n - 1; k++) {                                              // cable trays along each wall
      const p = t.sample((pts[inside[k]].s + pts[inside[k + 1]].s) / 2);
      for (const side of [1, -1]) put('metal', G.tray, p, side * (W - 0.17), 2.2);
    }
    for (let s = Math.ceil(sA / 6) * 6; s <= sB; s += 6) {                      // amber reflectors on the kerbs
      const p = at(s);
      for (const side of [1, -1]) put('amber', G.refl, p, side * (K - 0.01), 0.1);
    }
    for (let s = Math.ceil((sA - 30) / 60) * 60 + 30; s <= sB; s += 60) {       // exit signs, alternating
      if (s < sA) continue;
      const p = at(s), side = Math.round(s / 60) % 2 ? 1 : -1;
      put('green', G.exit, p, side * (W - 0.04), 2.0);
    }
    for (let s = Math.ceil((sA - 12) / 50) * 50 + 12; s <= sB; s += 50) {       // alarm cabinets and their red lamps
      if (s < sA) continue;
      const p = at(s);
      for (const side of [1, -1]) { put('metal', G.cabinet, p, side * (W - 0.1), 1.2); put('red', G.alarm, p, side * (W - 0.05), 1.78); }
    }
    for (let s = Math.ceil((sA - 40) / 120) * 120 + 40; s <= sB; s += 120) {    // jet fans, in pairs under the crown
      if (s < sA) continue;
      const p = at(s);
      for (const u of [1.25, -1.25]) {
        put('metal', G.fan, p, u, H0 + RV - 0.95);
        for (const dz of [-1.1, 1.1]) put('metal', G.bracket, t.sample(s + dz), u, H0 + RV - 0.3);
      }
    }
    const mats = { metal: this.fixMetalMat, lamp: this.tunnelLampMat, green: this.signGreenMat, red: this.signRedMat, amber: this.reflectorMat };
    for (const k of Object.keys(sets)) {
      if (!sets[k].length) continue;
      const merged = mergeGeos(sets[k]);
      ch.own.add(merged);
      const mesh = new THREE.Mesh(merged, mats[k]); mesh.name = 'tunnel-' + k;
      if (k === 'metal') { mesh.castShadow = false; mesh.receiveShadow = true; }
      grp.add(mesh);
    }

    // the sodium light lying along the walkways and the edges of the road
    {
      const gp = [], gc = [], gi = [];
      const cols = [[-1.8, 0.03, 0], [0, 0.03, 0.85], [0.02, 0.25, 0.85], [W - K - 0.05, 0.25, 0.55]];
      for (const side of [1, -1]) {
        const base = gp.length / 3;
        for (let k = 0; k < n; k++) {
          const p = pts[inside[k]];
          const lx = Math.cos(p.h), lz = -Math.sin(p.h);
          for (const [du, y, a] of cols) { const u = side * (K + du); gp.push(p.x + lx * u, p.y + y, p.z + lz * u); gc.push(1, 1, 1, a); }
          if (k < n - 1) for (let j = 0; j < cols.length - 1; j++) {
            const a = base + k * cols.length + j, b = a + 1, c2 = a + cols.length, d = c2 + 1;
            gi.push(a, c2, b, b, c2, d);
          }
        }
      }
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
      gg.setAttribute('color', new THREE.Float32BufferAttribute(gc, 4));
      gg.setIndex(gi); gg.computeBoundingSphere();
      ch.own.add(gg);
      const glow = new THREE.Mesh(gg, this.tunnelGlowMat); glow.renderOrder = 2; glow.name = 'tunnel-glow';
      grp.add(glow);
    }
    return grp;
  }

  /**
   * A portal: a concrete face round the bore with a bell-mouth hood, a tiled coping, the tunnel's name plate, and
   * wing walls stepping down into the cutting. Built at the origin facing +Z (the way out of the tunnel).
   */
  _portal(tn, ch) {
    const t = this.track, W = t.tubeHalf, H0 = 2.4, RV = 4.05;
    const g = new THREE.Group(); g.name = 'portal';
    const top = H0 + RV + 1.8, side = W + 1.7;
    const arc = (sh, w, rv, from, to, steps = 24) => {
      for (let k = 0; k <= steps; k++) { const a = from + (to - from) * (k / steps); sh.lineTo(Math.cos(a) * w, H0 + Math.sin(a) * rv); }
    };
    const own = (geo) => { ch.own.add(geo); return geo; };
    // the face: a wall with the bore's shape cut out of its foot
    const face = new THREE.Shape();
    face.moveTo(-side, -0.3); face.lineTo(-W, -0.3); face.lineTo(-W, H0);
    arc(face, W, RV, Math.PI, 0);
    face.lineTo(W, -0.3); face.lineTo(side, -0.3); face.lineTo(side, top); face.lineTo(-side, top); face.closePath();
    const fm = new THREE.Mesh(own(new THREE.ExtrudeGeometry(face, { depth: 1.0, bevelEnabled: false, curveSegments: 4 })), this.portalMat);
    fm.position.z = -1.0; g.add(fm);
    // the hood ring, 0.6 m wide, standing 0.45 m proud
    const hood = new THREE.Shape();
    hood.moveTo(-W - 0.6, -0.3); hood.lineTo(-W - 0.6, H0);
    arc(hood, W + 0.6, RV + 0.6, Math.PI, 0);
    hood.lineTo(W + 0.6, -0.3); hood.lineTo(W, -0.3); hood.lineTo(W, H0);
    arc(hood, W, RV, 0, Math.PI);
    hood.lineTo(-W, -0.3); hood.closePath();
    const hm = new THREE.Mesh(own(new THREE.ExtrudeGeometry(hood, { depth: 0.45, bevelEnabled: false, curveSegments: 4 })), this.portalMat);
    g.add(hm);
    // coping
    const cop = new THREE.Mesh(own(new THREE.BoxGeometry(2 * side + 0.3, 0.42, 1.25)), this.copingMat);
    cop.position.set(0, top + 0.21, -0.45); g.add(cop);
    // the name plate over the hood
    const names = [['霧峰', 'KIRIMINE'], ['紅葉', 'MOMIJI'], ['月見', 'TSUKIMI'], ['天狗', 'TENGU'], ['星降', 'HOSHIFURI'], ['白樺', 'SHIRAKABA'], ['狐塚', 'KITSUNEZUKA'], ['雷鳥', 'RAICHO']];
    const nm = names[(t.tunnels.indexOf(tn) + (t.seed % 5)) % names.length];
    const plate = new THREE.Mesh(own(new THREE.BoxGeometry(3.4, 0.86, 0.12)), [this.copingMat, this.copingMat, this.copingMat, this.copingMat, this._plateMat(nm), this.copingMat]);
    plate.position.set(0, H0 + RV + 0.95, 0.07); g.add(plate);
    // a lamp over the mouth, lighting the face and the plate
    const lamp = new THREE.Mesh(own(new THREE.BoxGeometry(0.9, 0.14, 0.3)), this.tunnelLampMat); lamp.position.set(0, H0 + RV + 1.55, 0.35); g.add(lamp);
    // wing walls, flaring out toward the road and stepping down
    for (const sgn of [1, -1]) {
      const wing = new THREE.Group();
      wing.position.set(sgn * side, 0, 0); wing.rotation.y = sgn * 0.42;
      for (let k = 0; k < 4; k++) {
        const h = Math.max(1.4, top - 1.0 - k * 1.5);
        const seg = new THREE.Mesh(own(new THREE.BoxGeometry(0.6, h, 1.8)), this.portalMat);
        seg.position.set(sgn * 0.3, h / 2 - 0.3, 0.9 + k * 1.8); wing.add(seg);
        const cap = new THREE.Mesh(own(new THREE.BoxGeometry(0.7, 0.14, 1.8)), this.copingMat);
        cap.position.set(sgn * 0.3, h - 0.23, 0.9 + k * 1.8); wing.add(cap);
      }
      g.add(wing);
    }
    g.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = true; } });
    // one mesh per material: built of twenty-odd boxes, a portal was that many draws, and twice that again in the
    // sun's shadow cascades by day
    g.updateMatrixWorld(true);
    const byMat = new Map(), keep = [];
    g.traverse((o) => {
      if (!o.isMesh) return;
      if (Array.isArray(o.material) || o.material === this.tunnelLampMat) { keep.push(o); return; }
      let a = byMat.get(o.material); if (!a) byMat.set(o.material, a = []);
      const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
      for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k);
      a.push(geo);
    });
    const out = new THREE.Group(); out.name = 'portal';
    for (const [mat, list] of byMat) {
      const merged = mergeGeometries(list, false);
      for (const geo of list) geo.dispose();
      if (!merged) continue;
      own(merged);
      const m = new THREE.Mesh(merged, mat); m.receiveShadow = true; m.castShadow = true;
      out.add(m);
    }
    for (const o of keep) { o.matrix.copy(o.matrixWorld); o.matrix.decompose(o.position, o.quaternion, o.scale); out.add(o); }
    return out;
  }

  /** The name plate's face: the tunnel's name in kanji over its reading, white on dark enamel. */
  _plateMat([kanji, romaji]) {
    this._plates = this._plates || new Map();
    let m = this._plates.get(romaji);
    if (m) return m;
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#1f2a33'; ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = 'rgba(230,226,214,0.85)'; ctx.lineWidth = 5; ctx.strokeRect(8, 8, 496, 112);
    ctx.fillStyle = '#ece8dc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // a system without a Japanese font draws boxes for kanji: then the reading alone, larger
    ctx.font = '900 58px "Noto Serif JP", "Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif';
    if (drawsGlyphs('900 44px "Noto Serif JP", "Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif', kanji + 'トンネル')) {
      ctx.fillText(kanji + 'トンネル', 256, 54);
      ctx.font = '26px "Share Tech Mono", monospace'; ctx.fillText(romaji + ' TUNNEL', 256, 100);
    } else {
      ctx.font = '44px "Share Tech Mono", monospace'; ctx.fillText(romaji, 256, 50);
      ctx.font = '26px "Share Tech Mono", monospace'; ctx.fillText('TUNNEL', 256, 96);
    }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.2 });
    this._plates.set(romaji, m);
    return m;
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
      const [x, z] = this._at(p, (w + (p.express ? 0.45 : 0.55)) * side);
      const y = p.express ? p.y - (w + 0.45) * side * Math.tan(p.bank || 0) + 0.95 : g.height(x, z);
      const ry = side > 0 ? p.h + Math.PI : p.h;               // the arm reaches local +X: point it at the road
      const rec = this._putLod(ch, 'lamp', x, y, z, ry, 1, null);
      const hx = x + Math.cos(ry) * this.lampHead[0], hz = z - Math.sin(ry) * this.lampHead[0];
      const hy = y + this.lampHead[1];
      rec.light = this.city ? { x: hx, y: hy - 0.25, z: hz, c: ch.c, color: 0xe2ecff, power: 230 } : { x: hx, y: hy - 0.25, z: hz, c: ch.c };
      this.lamps.push(rec.light);
      _q.setFromAxisAngle(_up, 0); _m4.compose(_v.set(hx, hy - 0.22, hz), _q, _s.set(1, 1, 1));
      rec.bulbId = this.pools.bulb.add(ch.c * 2, _m4);
      rec.glow = [hx, hz, this.city ? 9 : 12]; rec.glowList = glows;
      glows.push(rec.glow);
    }
    ch.lampGlows = glows;
    this._lampGlowMesh(ch);
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
        // the approach: a great torii over the road, on the first spot before the shrine where both of its
        // legs can stand on ground near the road's height
        for (const ds of [-26, -34, -18, -42]) { if (this._bigTorii(ch, m.s + ds)) break; }
        const pad = t.pads.find((q) => q.kind === 'shrine' && Math.abs(q.s0 + 8 - m.s) < 1);
        const u0 = pad ? pad.u0 : t.wall + 3.6;
        { const a = at(m.s + 11, u0 + 2.2); this._put('torii', own, a.x, a.y, a.z, face(a.p)); }
        for (const ds of [4, 18]) { const a = at(m.s + ds, u0 + 1.2); this._put('lantern', own, a.x, a.y, a.z, face(a.p)); }
        // a row of jizo in their red bibs by the path, facing the road
        for (const ds of [6.2, 7.3, 8.4]) { const a = at(m.s + ds, u0 + 0.9); this._put('jizo', own, a.x, a.y, a.z, face(a.p) + (rng() - 0.5) * 0.15, 0.95 + rng() * 0.12); }
        { const a = at(m.s + 11, u0 + 9.5); this._put('hut', own, a.x, a.y, a.z, face(a.p)); }
        // a weeping cherry behind the gate, a Somei-Yoshino before it; further along, the shrine's five-storey pagoda
        { const a = at(m.s + 23, u0 + 8.6); this._put('pagoda', own, a.x, a.y - 0.35, a.z, face(a.p)); }
        for (let k = 0; k < 2; k++) {
          const a = at(m.s - 2 + k * 12, u0 + 5 + rng() * 3);
          if (k === 1) this._cherry('weeping', own, a.x, a.y - 0.2, a.z, rng() * 6, 0.95 + rng() * 0.2, PAL.sakuraDeep);
          else this._cherry('sakura', own, a.x, a.y - 0.2, a.z, rng() * 6, 0.85 + rng() * 0.3, cherryColour(rng()));
        }
        for (let k = 0; k < 3; k++) { const a = at(m.s + 2 + k * 7, u0 + 12 + rng() * 1.5); this._put('bamboo', own, a.x, a.y - 0.2, a.z, rng() * 6, 0.85 + rng() * 0.35); }
        const l = at(m.s + 24, u0 + 2.4); this._lampAt(ch, l.x, l.y, l.z, face(l.p) + Math.PI, this._put('lamp', own, l.x, l.y, l.z, face(l.p) + Math.PI));
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
        for (const ds of [m.s - 4, m.s + m.len - 6]) { const a = at(ds, edge + 0.4); this._lampAt(ch, a.x, a.y, a.z, face(a.p) + Math.PI, this._put('lamp', own, a.x, a.y, a.z, face(a.p) + Math.PI)); }
        { const a = at(m.s + m.len - 2, edge + m.depth - 1); this._cherry('sakura', own, a.x, a.y - 0.2, a.z, rng() * 6, 0.9, cherryColour(rng())); }
      } else if (m.kind === 'busstop') {
        { const a = at(mid, edge + 1.6); this._put('busstop', own, a.x, a.y, a.z, face(a.p)); }
        { const a = at(mid - 3.4, edge + 0.8); this._put('jizo', own, a.x, a.y, a.z, face(a.p), 1.0); }
        { const a = at(mid + 8, edge + 0.6); this._lampAt(ch, a.x, a.y, a.z, face(a.p) + Math.PI, this._put('lamp', own, a.x, a.y, a.z, face(a.p) + Math.PI)); }
        { const a = at(mid - 7, edge + 3); this._cherry('sakura', own, a.x, a.y - 0.2, a.z, rng() * 6, 1.0, cherryColour(rng())); }
        for (let k = 0; k < 3; k++) { const a = at(mid + 12 + k * 4, edge + 2 + rng() * 2); this._put('bamboo', own, a.x, a.y - 0.2, a.z, rng() * 6, 0.8 + rng() * 0.3); }
      } else if (m.kind === 'hut' || m.kind === 'vista') {
        if (m.kind === 'hut') {
          { const a = at(mid, edge + m.depth * 0.5); this._put('hut', own, a.x, a.y, a.z, face(a.p)); }
          { const a = at(mid - 4.2, edge + 0.9); this._put('vending', own, a.x, a.y, a.z, face(a.p)); }
        } else {
          for (let k = 0; k < 5; k++) { const a = at(m.s + 2 + k * 7, edge + m.depth - 0.6); this._put('pole', own, a.x, a.y, a.z, face(a.p)); }
          { const a = at(mid + 6, edge + 2); this._put('boulder', own, a.x, a.y - 0.2, a.z, rng() * 6, 1.1); }
          for (const du of [0, 0.62]) { const a = at(mid + 2 + du * 1.4, edge + 1.0); this._put('jizo', own, a.x, a.y, a.z, face(a.p), 0.9 + du * 0.2); }
          // the lone cherry at the viewpoint, leaning out over the drop
          { const a = at(mid - 4, edge + m.depth - 2.2); this._cherry('sakura', own, a.x, a.y - 0.2, a.z, rng() * 6, 1.05, PAL.sakuraPale); }
        }
        if (m.kind === 'hut') { const a = at(mid + 7, edge + m.depth - 1.5); this._cherry('sakura', own, a.x, a.y - 0.2, a.z, rng() * 6, 0.95, cherryColour(rng())); }
        { const a = at(m.s + 2, edge + 0.6); this._lampAt(ch, a.x, a.y, a.z, face(a.p) + Math.PI, this._put('lamp', own, a.x, a.y, a.z, face(a.p) + Math.PI)); }
      }
    }
  }

  /**
   * A great torii across the road at s, myojin style: two vermilion legs on black feet, the tie beam (nuki)
   * through them, the painted lintel (shimaki) and the black top lintel (kasagi) whose ends sweep up, a strut
   * between them carrying a black plaque with the shrine's name in gold, and a warm light on it. The legs
   * stand just beyond the walls and reach down to whatever ground is under them. False if it cannot stand.
   */
  _bigTorii(ch, s) {
    const t = this.track, g = this.ground;
    if (s < 5 || t.nearTunnel(s, 20)) return false;
    const p = t.sample(s);
    const half = Math.max(p.wl, p.wr) + 1.1;
    const legs = [1, -1].map((side) => { const [x, z] = this._at(p, half * side); return { x, z, y: g.height(x, z) }; });
    if (legs.some((l) => Math.abs(l.y - p.y) > 2.2)) return false;
    const y0 = p.y, H = 8.4, R = 0.42;
    const red = [], black = [];
    const lx = Math.cos(p.h), lz = -Math.sin(p.h);           // across the road
    const place = (geo, u, y) => { geo.rotateY(p.h); geo.translate(p.x + lx * u, y, p.z + lz * u); return geo; };
    for (const [k, side] of [[0, 1], [1, -1]]) {
      const l = legs[k], bottom = Math.min(l.y, y0) - 0.4;
      red.push(place(new THREE.CylinderGeometry(R * 0.86, R, y0 + H - 0.2 - bottom, 16), half * side, (bottom + y0 + H - 0.2) / 2));
      black.push(place(new THREE.CylinderGeometry(R * 1.14, R * 1.2, l.y + 1.0 - bottom, 16), half * side, (bottom + l.y + 1.0) / 2));
    }
    const span = 2 * half;
    // the nuki: a tie beam through both legs, standing out past them
    red.push(place(new THREE.BoxGeometry(span + 2.2, 0.52, 0.42), 0, y0 + H - 2.1));
    // the lintels: shimaki (painted) under kasagi (black), both sweeping up toward their ends
    const lintel = (len, h, d, yc, lift) => {
      const N = 16, pos = [], idx = [];
      const yy = (x) => yc + lift * Math.pow(Math.abs(x) / (len / 2), 2.6);
      for (let i = 0; i <= N; i++) {
        const x = -len / 2 + (len * i) / N, y = yy(x);
        for (const [dy, dz] of [[-h / 2, -d / 2], [-h / 2, d / 2], [h / 2, d / 2], [h / 2, -d / 2]]) pos.push(x, y + dy, dz);
      }
      for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) {
        const a = i * 4 + k, b = i * 4 + ((k + 1) % 4), c = a + 4, d2 = b + 4;
        idx.push(a, c, b, b, c, d2);
      }
      for (const e of [0, N * 4]) idx.push(e, e + 1, e + 2, e, e + 2, e + 3, e + 2, e + 1, e, e + 3, e + 2, e);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx); geo.computeVertexNormals();
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
      return geo;
    };
    red.push(place(lintel(span + 3.0, 0.5, 0.5, y0 + H - 0.2, 0.35), 0, 0));
    black.push(place(lintel(span + 3.8, 0.42, 0.62, y0 + H + 0.26, 0.6), 0, 0));
    // the strut between the beams, and the plaque on it
    red.push(place(new THREE.BoxGeometry(0.42, 1.6, 0.36), 0, y0 + H - 1.05));
    const geoR = mergeGeos(red), geoB = mergeGeos(black);
    ch.own.add(geoR); ch.own.add(geoB);
    const mr = new THREE.Mesh(geoR, this.toriiRedMat), mb = new THREE.Mesh(geoB, this.toriiBlackMat);
    for (const m of [mr, mb]) { m.castShadow = true; m.receiveShadow = true; m.name = 'great torii'; ch.group.add(m); }
    const plaque = new THREE.Mesh(this.toriiPlaqueGeo, this._toriiPlaqueMat());
    // (facing the car that comes up the road, a hand's breadth proud of the strut)
    plaque.position.set(p.x - Math.sin(p.h) * 0.24, y0 + H - 1.05, p.z - Math.cos(p.h) * 0.24); plaque.rotation.y = p.h + Math.PI;
    ch.group.add(plaque);
    // lit from below, as a shrine lights its gate
    this.lamps.push({ x: p.x, y: y0 + 4.5, z: p.z, c: ch.c, color: 0xffb070, power: 150 });
    const gm = this._glows([[p.x, p.z, 11]], ch); if (gm) ch.group.add(gm);
    return true;
  }

  /** The plaque's face: gold characters, top to bottom, on black lacquer (the name in romaji where the font has no kanji). */
  _toriiPlaqueMat() {
    if (this._plaqueMat) return this._plaqueMat;
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#16120f'; ctx.fillRect(0, 0, 128, 256);
    ctx.strokeStyle = '#b8843a'; ctx.lineWidth = 8; ctx.strokeRect(8, 8, 112, 240);
    const kanji = '櫻宮';
    ctx.font = '900 84px "Noto Serif JP", "Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif';
    const tofu = !drawsGlyphs('900 44px "Noto Serif JP", "Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif', kanji);
    ctx.fillStyle = '#e8c068'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (!tofu) { ctx.fillText(kanji[0], 64, 76); ctx.fillText(kanji[1], 64, 180); }
    else { ctx.font = 'bold 30px serif'; for (const [k, ch] of [...'SAKURA'].entries()) ctx.fillText(ch, 64, 42 + k * 36); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    this._plaqueMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.5 });
    return this._plaqueMat;
  }

  /**
   * Blue guide signs, the national road kind: two destinations up the pass, kanji over romaji, the distance
   * beside each, an arrow. A handful of faces are drawn once; each sign picks one.
   */
  _signFaces() {
    if (this._signMats) return this._signMats;
    const sets = [
      [['霧峰', 'Kirimine', 12], ['星降', 'Hoshifuri', 27]], [['月見', 'Tsukimi', 8], ['天狗', 'Tengu', 19]],
      [['白樺', 'Shirakaba', 15], ['雷鳥', 'Raicho', 34]], [['狐塚', 'Kitsunezuka', 6], ['紅葉', 'Momiji', 22]],
    ];
    const jp = '"Dela Gothic One", "Noto Serif JP", "Yu Gothic", "Hiragino Sans", sans-serif';
    this._signMats = sets.map((rows) => {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 304;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#1f55a6'; ctx.fillRect(0, 0, 512, 304);
      ctx.strokeStyle = '#f2f4f6'; ctx.lineWidth = 9; ctx.strokeRect(12, 12, 488, 280);
      // the arrow: straight on, up the pass
      ctx.fillStyle = '#f2f4f6';
      ctx.beginPath(); ctx.moveTo(70, 44); ctx.lineTo(112, 104); ctx.lineTo(84, 104); ctx.lineTo(84, 260); ctx.lineTo(56, 260); ctx.lineTo(56, 104); ctx.lineTo(28, 104); ctx.closePath(); ctx.fill();
      ctx.font = `76px ${jp}`;
      const tofu = !drawsGlyphs(`44px ${jp}`, rows[0][0] + rows[1][0]);
      rows.forEach(([kanji, romaji, km], k) => {
        const y = 92 + k * 128;
        ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
        if (!tofu) { ctx.font = `76px ${jp}`; ctx.fillText(kanji, 138, y); ctx.font = '700 30px Rajdhani, "Share Tech Mono", sans-serif'; ctx.fillText(romaji, 142, y + 38); }
        else { ctx.font = '700 58px Rajdhani, "Share Tech Mono", sans-serif'; ctx.fillText(romaji, 138, y + 18); }
        ctx.textAlign = 'right'; ctx.font = '700 60px Rajdhani, "Share Tech Mono", sans-serif'; ctx.fillText(String(km), 440, y + 14);
        ctx.font = '700 30px Rajdhani, "Share Tech Mono", sans-serif'; ctx.fillText('km', 486, y + 14);
      });
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      // retroreflective: the headlights and lamps make it bright, and it holds a little glow of its own
      return new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.22, roughness: 0.45, metalness: 0 });
    });
    return this._signMats;
  }

  /** Guide signs on the left of the road every 900 m or so, on a straight stretch with room beside it. */
  _signsFor(ch) {
    const t = this.track, g = this.ground, pts = t.pts;
    const faces = this._signFaces(), posts = [];
    for (let i = ch.i0; i < ch.i1; i++) {
      const p = pts[i];
      const ph = (((p.s - 120) % 900) + 900) % 900;
      if (ph >= t.step || p.tunnel || t.nearTunnel(p.s, 30) || Math.abs(p.k) > 0.012) continue;
      const side = 1;
      if (t.markerAt(p.s, side) || t.padAt(p.s, side) || this.avenueAt(p.s)) continue;
      const w = p.wl, u = w + 1.4;
      const [x, z] = this._at(p, u);
      const gy = g.height(x, z);
      if (Math.abs(gy - p.y) > 1.8) continue;
      const H = 2.02, top = p.y + 5.2, bottom = top - H;
      const fx = Math.sin(p.h), fz = Math.cos(p.h), lx = Math.cos(p.h), lz = -Math.sin(p.h);
      for (const d of [-1.2, 1.2]) posts.push([x + lx * d + fx * 0.13, gy - 0.3, z + lz * d + fz * 0.13, top - 0.05, p.h]);
      const k = Math.abs(Math.floor(p.s / 900)) % faces.length;
      const board = new THREE.Mesh(this.signBoardGeo, this.signBackMat);
      board.position.set(x, (top + bottom) / 2, z); board.rotation.y = p.h;
      const face = new THREE.Mesh(this.signFaceGeo, faces[k]);
      face.position.set(x - fx * 0.05, (top + bottom) / 2, z - fz * 0.05); face.rotation.y = p.h + Math.PI;
      for (const m of [board, face]) { m.castShadow = true; m.receiveShadow = true; ch.group.add(m); }
    }
    if (posts.length) {
      const geos = posts.map(([x, y0, z, y1, h]) => { const b = new THREE.CylinderGeometry(0.09, 0.09, y1 - y0, 10); b.rotateY(h); b.translate(x, (y0 + y1) / 2, z); return b; });
      const geo = mergeGeos(geos); ch.own.add(geo);
      const m = new THREE.Mesh(geo, this.railMat); m.castShadow = true; m.name = 'sign posts';
      ch.group.add(m);
    }
  }

  /** The paint for road-marking text: the characters stacked along the road, first one nearest, stretched long. */
  _roadTextMat(chars) {
    this._roadTexts = this._roadTexts || new Map();
    let m = this._roadTexts.get(chars);
    if (m) return m;
    const n = chars.length, cv = document.createElement('canvas'); cv.width = 128; cv.height = 256 * n;
    const ctx = cv.getContext('2d');
    const jp = '"Dela Gothic One", "Noto Serif JP", "Yu Gothic", "Hiragino Sans", sans-serif';
    ctx.fillStyle = '#e9e5db'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const ok = drawsGlyphs(`44px ${jp}`, chars);
    [...chars].forEach((c, k) => {
      ctx.save(); ctx.translate(64, 256 * (n - 1 - k) + 128); ctx.scale(1, 2.1);
      ctx.font = ok ? `112px ${jp}` : '700 100px Rajdhani, sans-serif';
      ctx.fillText(ok ? c : 'SLOW'[k] || '', 0, 4);
      ctx.restore();
    });
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.62, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    this._roadTexts.set(chars, m);
    return m;
  }

  /** Paint text on the road at s, centred at lateral offset u, reading for a car coming up the road. */
  _roadText(group, s, u, chars) {
    const t = this.track;
    const n = chars.length, L = 2.7 * n, W = 1.7, NS = 5 * n, NU = 3;
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= NS; j++) {
      const p = t.sample(s + (j / NS) * L);
      const lx = Math.cos(p.h), lz = -Math.sin(p.h);
      for (let i = 0; i <= NU; i++) {
        const uu = u + (i / NU - 0.5) * W, x = p.x + lx * uu, z = p.z + lz * uu;
        pos.push(x, p.y + 0.03, z); uv.push(1 - i / NU, j / NS);          // on the ribbon (the ground can sit under it)
      }
    }
    for (let j = 0; j < NS; j++) for (let i = 0; i < NU; i++) {
      const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);                    // forward x left is up
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, this._roadTextMat(chars));
    m.receiveShadow = true; m.renderOrder = 1; m.name = 'road text';
    group.add(m);
    return m;
  }

  /**
   * Road studs along the chunk: white on the centre line every 12 m, amber at both edges every 8 m, a few
   * centimetres above the ribbon. One Points draw per chunk; their light is the shader's.
   */
  _studs(ch) {
    const t = this.track, pts = t.pts;
    const pos = [], col = [];
    const W = [1.0, 0.95, 0.86], A = [1.0, 0.56, 0.14];
    for (let i = ch.i0; i < ch.i1; i++) {
      const p = pts[i];
      const lx = Math.cos(p.h), lz = -Math.sin(p.h), bank = p.bank || 0;
      const ph = (((p.s - 2) % 12) + 12) % 12, pe = (((p.s - 6) % 8) + 8) % 8;
      if (ph < t.step) { pos.push(p.x, p.y + 0.06, p.z); col.push(...W); }
      if (pe < t.step) for (const side of [1, -1]) {
        const u = (t.half - 0.3) * side;
        pos.push(p.x + lx * u, p.y + 0.055 - u * Math.tan(bank), p.z + lz * u); col.push(...A);
      }
    }
    if (!pos.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    ch.own.add(geo);
    const m = new THREE.Points(geo, this.studMat);
    m.name = 'studs'; m.renderOrder = 3;
    ch.group.add(m);
  }

  /** Where the studs are looked at from: the car and its heading, how dark it is, the view's height in pixels. */
  setStudView(x, y, z, fx, fz, night, heightPx) {
    if (!this.studMat) return;
    const u = this.studMat.uniforms;
    u.uCar.value.set(x, y, z); u.uFwd.value.set(fx, fz); u.uNight.value = night; u.uScale.value = heightPx;
  }

  /** Where the pass runs through a cherry avenue: 170 m in every 640, clear of the tunnels. */
  avenueAt(s) {
    const ph = (((s + 230) % 640) + 640) % 640;
    return ph < 170 && !this.track.nearTunnel(s, 25);
  }

  /**
   * The cherry avenue (sakura namiki) through a chunk: cherries at an even step on both sides, and on the side
   * that is not a drop, a string of red paper lanterns on timber posts, each span sagging between its posts,
   * with a warm pool of light under it and a real light every other post. Built with the chunk, so an avenue
   * glows across the valley before the car gets there.
   */
  _avenueFor(ch) {
    const t = this.track, g = this.ground, pts = t.pts;
    const own = ch.c * 2;
    const rng = mulberry32((this.seed * 613 + ch.c * 2887) >>> 0);
    const probe = {};
    const posts = [], wires = [], glows = [];
    const STEP = 9, ROPE = 3.7, SAG = 0.36;
    const lanternSide = (p) => {
      // the lanterns go on the uphill side (a string along a drop reads as a fence to nowhere)
      const lx = Math.cos(p.h), lz = -Math.sin(p.h);
      return g.height(p.x + lx * (p.wl + 6), p.z + lz * (p.wl + 6)) >= g.height(p.x - lx * (p.wr + 6), p.z - lz * (p.wr + 6)) ? 1 : -1;
    };
    let prev = null;
    for (let i = ch.i0; i < ch.i1; i++) {
      const p = pts[i];
      if (p.tunnel || !this.avenueAt(p.s)) { prev = null; continue; }
      // cherries every 10 m a side, the two sides staggered by half a step (a city street keeps only the lanterns)
      if (!this.city) for (const side of [1, -1]) {
        const ph = (((p.s + (side > 0 ? 0 : 6)) % 12) + 12) % 12;
        if (ph >= t.step || t.markerAt(p.s, side) || t.padAt(p.s, side)) continue;
        const w = side > 0 ? p.wl : p.wr;
        const [x, z] = this._at(p, (w + 2.5 + (rng() - 0.5) * 0.8) * side);
        g.sample(x, z, 2.2, probe);
        if (probe.tunnel || probe.edge < 0.8) continue;
        if (this.pools.sakura) this._putLod(ch, 'sakura', x, probe.h - 0.25, z, rng() * 6.28, 0.95 + rng() * 0.2, cherryColour(rng()));
        else this._cherry('sakura', own, x, probe.h - 0.25, z, rng() * 6.28, 0.95 + rng() * 0.2, cherryColour(rng()));
      }
      // the lantern posts, every STEP metres on one side, just behind the wall line
      const ph = ((p.s % STEP) + STEP) % STEP;
      if (ph >= t.step) continue;
      const side = lanternSide(p);
      if (t.markerAt(p.s, side) || t.padAt(p.s, side)) { prev = null; continue; }
      const w = side > 0 ? p.wl : p.wr;
      const [x, z] = this._at(p, (w + 0.75) * side);
      const gy = g.height(x, z), top = p.y + ROPE;
      if (Math.abs(gy - p.y) > 1.6) { prev = null; continue; }
      posts.push([x, gy - 0.2, z, top + 0.25, p.h]);
      const post = { x, z, y: top, side };
      if (prev && prev.side === side && Math.hypot(prev.x - x, prev.z - z) < STEP * 1.5) {
        // the span: a sagging rope, three lanterns hanging from it, a pool of light under them
        const K = 8;
        const at = (u) => [lerp(prev.x, x, u), lerp(prev.y, top, u) - SAG * 4 * u * (1 - u), lerp(prev.z, z, u)];
        for (let k = 0; k < K; k++) { const a = at(k / K), b = at((k + 1) / K); wires.push(...a, ...b); }
        if (this.pools.chochin) for (const u of [0.33, 0.67]) {
          const [lx, ly, lz] = at(u);
          this._putLod(ch, 'chochin', lx, ly - 0.62, lz, p.h + rng() * 0.3 - 0.15, 0.95 + rng() * 0.1, null);
        }
        const [mx, , mz] = at(0.5);
        glows.push([mx, mz, 6.5]);
        if ((Math.round(p.s / STEP) & 1) === 0) this.lamps.push({ x: mx, y: top - 0.9, z: mz, c: ch.c, color: 0xff8a5c, power: 70 });
      }
      prev = post;
    }
    if (posts.length) {
      const geos = posts.map(([x, y0, z, y1, h]) => {
        const b = new THREE.BoxGeometry(0.13, y1 - y0, 0.13);
        b.rotateY(h); b.translate(x, (y0 + y1) / 2, z);
        return b;
      });
      const geo = mergeGeos(geos); ch.own.add(geo);
      const m = new THREE.Mesh(geo, this.postMat); m.castShadow = true; m.receiveShadow = true; m.name = 'lantern posts';
      ch.group.add(m);
    }
    if (wires.length) {
      const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3)); wg.computeBoundingSphere();
      ch.own.add(wg);
      const wl = new THREE.LineSegments(wg, this.wireMat); wl.name = 'lantern ropes';
      ch.group.add(wl);
    }
    if (glows.length) { const gm = this._glows(glows, ch, this.glowLanternMat); if (gm) ch.group.add(gm); }
  }

  /**
   * A prop with a near and a far model (the pool name + 'Far'): placed far with the chunk, and swapped for the
   * full model while the chunk is dressed (within NEAR_R), so an avenue half a kilometre off costs a tenth of one
   * beside the car. Placements are kept on the chunk to swap back.
   */
  _putLod(ch, name, x, y, z, ry, sc, colour) {
    const C = COLL[name] || {};
    const rec = { name, x, y, z, ry, sc, colour, kind: C.kind || 'none', r: (C.r || 0.3) * sc, m: C.m || 0, alive: true, lod: true, ch };
    (ch.lod || (ch.lod = [])).push(rec);
    this._lodPlace(ch, rec, ch.near);
    if (C.kind) this._reg(ch.c * 2, rec);
    return rec;
  }

  _lodPlace(ch, rec, near) {
    const far = this.pools[rec.name + 'Far'];
    rec.pool = near || !far ? rec.name : rec.name + 'Far';
    const owner = near && far ? ch.c * 2 + 1 : ch.c * 2;
    const pool = this.pools[rec.pool]; if (!pool) { rec.id = 0; return; }
    _q.setFromAxisAngle(_up, rec.ry); _s.set(rec.sc, rec.sc, rec.sc);
    _m4.compose(_v.set(rec.x, rec.y, rec.z), _q, _s);
    rec.id = pool.add(owner, _m4, rec.colour);
  }

  _lodSwap(ch, near) {
    if (!ch.lod) return;
    const names = new Set(ch.lod.map((l) => l.name));
    for (const n of names) { const far = this.pools[n + 'Far']; if (far) far.removeOwner(ch.c * 2); }
    for (const rec of ch.lod) {
      if (!rec.alive || !this.pools[rec.name + 'Far']) continue;   // (knocked over, or placed full and never swapped)
      this._lodPlace(ch, rec, near);
    }
  }

  /** A cherry: the Somei-Yoshino or the weeping one, or whichever of them (or the maple) the build has. */
  _cherry(kind, owner, x, y, z, ry, sc, colour) {
    const name = kind === 'weeping' && this.pools.weeping ? 'weeping' : this.pools.sakura ? 'sakura' : 'maple';
    this._put(name, owner, x, y, z, ry, name === 'maple' ? sc * 1.1 : sc, 1, colour);
  }

  /** A lamp placed by a set piece: its bulb, its light and its pool of light. */
  _lampAt(ch, x, y, z, ry, rec = null) {
    const hx = x + Math.cos(ry) * this.lampHead[0], hz = z - Math.sin(ry) * this.lampHead[0], hy = y + this.lampHead[1];
    const light = { x: hx, y: hy - 0.25, z: hz, c: ch.c };
    this.lamps.push(light);
    _q.setFromAxisAngle(_up, 0); _m4.compose(_v.set(hx, hy - 0.22, hz), _q, _s.set(1, 1, 1));
    const bulbId = this.pools.bulb.add(ch.c * 2, _m4);
    const m = this._glows([[hx, hz, 10]], ch); if (m) ch.group.add(m);
    if (rec) { rec.light = light; rec.bulbId = bulbId; rec.glowMesh = m; }
  }

  // ------------------------------------------------------------------ dress: the small things, near the car only

  *_dress(ch) {
    if (!ch || ch.near) return;
    this._lodSwap(ch, true);
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
        } else if (!this.city && i % 10 === 3 && !p.tunnel && !t.nearTunnel(p.s, 4) && !t.markerAt(p.s, side) && !t.padAt(p.s, side)) {
          const [x, z] = this._at(p, (w - 0.2) * side); this._put('pole', own, x, p.y, z, face(p, side));
        }
      }
    }
    // (the old cat's-eye models: replaced by the road studs, points of light built with the chunk)
    if (false) for (let i = ch.i0; i < ch.i1; i++) {
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
      for (let k = 0; k < (this.city ? 0 : f.type === 'hairpin' ? 4 : 2); k++) {
        const s = entry + k * 8;
        const i = t.index(s); if (i < ch.i0 || i >= ch.i1) continue;
        const p = t.sample(s);
        if (p.tunnel || t.nearTunnel(p.s, 6)) continue;
        const w = outside > 0 ? p.wl : p.wr;
        const [x, z] = this._at(p, (w + 0.7) * outside);
        this._put('chevron', own, x, g.height(x, z), z, p.h + Math.PI, 1, f.dir > 0 ? -1 : 1);
      }
      // before a hairpin, SLOW (jokou) painted on the lane, as the mountain roads have it
      if (f.type === 'hairpin') {
        const st = t.pts[f.i0].s - 30, it = t.index(st);
        if (!this.city && st > 10 && it >= ch.i0 && it < ch.i1 && !t.nearTunnel(st, 12)) this._roadText(nearGroup, st, t.half * 0.5, '徐行');
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
    if (!this.city) for (let i = ch.i0; i < ch.i1; i += 5) {
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
    for (let sp = Math.ceil((s0 - 14) / 44) * 44 + 14; sp < s1 && !this.city; sp += 44) {     // (the city hangs its own: citydetail.js)
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
    // the verge: cherries in blossom, fresh broadleaf, bamboo, a young red maple now and then; azaleas and shrubs
    // crowding the edge
    const dens = this.q.trees || 1;
    const probe = {};
    const verge = !this.city;
    // grass along the verges, thick near the edge and thinning out, with a clump of spring flowers now and then
    if (verge && this.pools.grass) {
      const GRASS = [PAL.youngLeaf, PAL.moss, PAL.leafDeep, PAL.dryGrass, PAL.youngLeaf];
      const FLOWER = [0xf6f3e6, 0xf6f3e6, 0xf2d35c, 0xc9b6f2, 0xf3b6cf];
      for (let i = ch.i0; i < ch.i1; i++) {
        const p = pts[i];
        if (p.tunnel || t.nearTunnel(p.s, 8)) continue;
        for (const side of [1, -1]) {
          if (t.markerAt(p.s, side) || t.padAt(p.s, side)) continue;
          const w = side > 0 ? p.wl : p.wr;
          for (let k = 0; k < 2; k++) {
            if (rng() > (k ? 0.8 : 0.95) * dens) continue;
            const u = w + 0.35 + (k ? 1.2 + rng() * 7 : rng() * 1.6);
            const [x, z] = this._at(p, u * side + (rng() - 0.5) * 1.6);
            g.sample(x, z, 2.2, probe);
            if (probe.edge < 0.25 || probe.tunnel) continue;
            this._put('grass', own, x, probe.h - 0.03, z, rng() * 6.28, 0.95 + rng() * 0.8, 1, GRASS[Math.floor(rng() * GRASS.length)], false);
          }
          if (this.pools.flowers && rng() < 0.3 * dens) {
            const [x, z] = this._at(p, (w + 0.5 + rng() * 4.5) * side);
            g.sample(x, z, 2.2, probe);
            if (probe.edge < 0.3 || probe.tunnel) continue;
            this._put('flowers', own, x, probe.h - 0.02, z, rng() * 6.28, 0.8 + rng() * 0.5, 1, FLOWER[Math.floor(rng() * FLOWER.length)], false);
          }
        }
      }
    }
    for (let i = ch.i0; verge && i < ch.i1; i += 4) {
      const p = pts[i];
      if (p.tunnel || t.nearTunnel(p.s, 14) || this.avenueAt(p.s)) continue;
      for (const side of [1, -1]) {
        if (t.markerAt(p.s, side) || t.padAt(p.s, side)) continue;
        const w = side > 0 ? p.wl : p.wr;
        if (rng() < 0.45 * dens && !lampNear(p.s)) {
          // (a clear strip beyond the edge: the car can leave the road now, and a trunk at the kerb is a wall)
          const u = w + 3.2 + rng() * 3.4;
          const [x, z] = this._at(p, u * side);
          g.sample(x, z, 2.2, probe);
          if (probe.edge > 1.2 && !probe.tunnel) {
            const h = probe.h;
            const hx = g.height(x + 1.2, z) - g.height(x - 1.2, z), hz = g.height(x, z + 1.2) - g.height(x, z - 1.2);
            if (hx * hx + hz * hz < 4.0) {
              const pick = rng(), kind = rng();
              if (kind < 0.03) this._put('bare', own, x, h - 0.25, z, rng() * 6.28, 0.8 + rng() * 0.4);
              else if (kind < 0.13) this._put('bamboo', own, x, h - 0.25, z, rng() * 6.28, 0.8 + rng() * 0.35);
              else if (kind < 0.46) this._put('broadleaf', own, x, h - 0.25, z, rng() * 6.28, 0.8 + rng() * 0.45, 1, pick < 0.6 ? PAL.youngLeaf : PAL.leafDeep);
              else if (kind < 0.52) this._put('maple', own, x, h - 0.25, z, rng() * 6.28, 0.7 + rng() * 0.35, 1, pick < 0.6 ? PAL.mapleRed : PAL.youngLeaf);
              else this._cherry('sakura', own, x, h - 0.25, z, rng() * 6.28, 0.8 + rng() * 0.35, cherryColour(pick));
            }
          }
        }
      }
    }
    for (let i = ch.i0; verge && i < ch.i1; i += 2) {
      const p = pts[i];
      if (p.tunnel || t.nearTunnel(p.s, 6)) continue;
      for (const side of [1, -1]) {
        if (rng() < 0.52 / dens || t.markerAt(p.s, side) || t.padAt(p.s, side)) continue;
        const w = side > 0 ? p.wl : p.wr;
        const u = w + 0.7 + rng() * 2.4;
        const [x, z] = this._at(p, u * side + (rng() - 0.5));
        g.sample(x, z, 2.2, probe);
        if (probe.edge < 0.5 || probe.tunnel) continue;
        const pick = rng();
        const colour = pick < 0.3 ? PAL.youngLeaf : pick < 0.52 ? PAL.moss : pick < 0.68 ? PAL.leafDeep : pick < 0.82 ? PAL.azalea : pick < 0.93 ? PAL.azaleaPink : PAL.sakuraWhite;
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
      // (unlit and unfogged: the haze would take them to exactly the sky's colour; skylineTint mixes it in by hand)
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide, fog: false }));
      m.userData.base = new THREE.Color(colour);
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

  /**
   * The far ridges in the light of the hour: each ring its own colour mixed toward the haze (the nearer ring less),
   * a little darker than the haze itself, so the ranges stand one behind another against the sky.
   */
  skylineTint(haze, night) {
    if (!this.skyline) return;
    this.skyline.children.forEach((m, i) => {
      if (!m.userData.base) return;
      const k = i === 0 ? 0.5 : 0.7, dark = (i === 0 ? 0.78 : 0.88) - 0.12 * night;
      m.material.color.copy(m.userData.base).lerp(haze, k).multiplyScalar(dark);
    });
  }

  /** Far things follow the camera: the skyline rings exactly, the towns in steps. */
  updateFar(x, y, z) {
    if (this.skyline) this.skyline.position.set(x, y, z);
    if (this.citySky && this.city) { this.citySky.position.set(x, y - 1, z); if (this.City.citySkyUpdate) this.City.citySkyUpdate(this, performance.now() / 1000); }
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
    for (const m of [this.tunnelMat, this.tunnelLampMat, this.glowMat, this.glowCoolMat, this.glowLanternMat, this.glowCityMat, this.postMat, this.toriiRedMat, this.toriiBlackMat, this._plaqueMat, this.signBackMat, ...this._signMats, this._roadTextMat('徐行'), this._roadTextMat('止まれ'), ...(this._cityMats || []), this.bulbMat, this.groundMat, this.farMat, this.roadMat, this.railMat,
      this.fixMetalMat, this.signGreenMat, this.signRedMat, this.reflectorMat, this.portalMat, this.copingMat, [...this._plates.values()][0]]) {
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
  /** Wet, 0..1: the road and the ground darken and turn glossy, and the pools of lamplight on them brighten. */
  setWet(w) {
    this._wet = w;
    // (a wet road is glossy enough that a lamp draws a streak on it, not a broad blob)
    // (not quite a mirror: at 0.2 each street lamp burned a white blob into the wet asphalt; at 0.34 it is a soft
    // glow drawn out toward the lens)
    if (this.roadMat) this.roadMat.roughness = 1 - 0.66 * w;
    if (this.groundMat) this.groundMat.roughness = 1 - 0.4 * w;
    this.setNight(this._n ?? 1);
  }

  setNight(n) {
    this._n = n;
    if (this.city && this.City) this.City.cityWet(this, this._wet || 0, n);
    const w = this._wet || 0, pool = 1 + 0.45 * w;
    if (this.glowMat) this.glowMat.opacity = 0.75 * n * pool;
    if (this.glowCoolMat) this.glowCoolMat.opacity = Math.min(0.78, 0.62 * n * pool);
    if (this.glowLanternMat) this.glowLanternMat.opacity = 0.6 * n * pool;
    if (this.glowCityMat) this.glowCityMat.opacity = 0.3 * n * (1 + 0.3 * w);
    if (this.town) this.town.material.opacity = 0.9 * n;
    if (!this._tinted) {
      this._tinted = [];
      const grab = (mat, k) => { if (mat && mat.color && !this._tinted.some((t) => t.mat === mat)) this._tinted.push({ mat, base: mat.color.clone(), k }); };
      grab(this.groundMat, [0.42, 0.55, 0.95]); grab(this.farMat, [0.34, 0.45, 0.85]); grab(this.roadMat, [0.62, 0.70, 0.95]);
      for (const name of ['maple', 'shrub', 'broadleaf', 'cedar', 'bamboo']) for (const p of this.parts[name] || []) if (/foliage/.test(p.material.name)) grab(p.material, [0.40, 0.52, 0.92]);
      // blossom keeps more of its pink by night: moonlight turns it pale lilac rather than blue
      for (const name of ['sakura', 'weeping']) for (const p of this.parts[name] || []) if (/foliage/.test(p.material.name)) grab(p.material, [0.80, 0.62, 0.74]);
      // (the far ridges take their colour from the haze: skylineTint)
    }
    for (const t of this._tinted) {
      const wk = t.mat === this.roadMat ? 1 - 0.38 * w : t.mat === this.groundMat ? 1 - 0.22 * w : 1;
      t.mat.color.setRGB(t.base.r * (1 + (t.k[0] - 1) * n) * wk, t.base.g * (1 + (t.k[1] - 1) * n) * wk, t.base.b * (1 + (t.k[2] - 1) * n) * wk);
    }
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
