/**
 * The farmland drawn (farm.js lays it out and levels it): every paddy's water, the bunds between the terraces, the
 * dry-stone walls of the house lots, the rows of tea, vegetables and white plastic tunnels, the rice nursery's
 * greenhouses, and the hamlets: farmhouses, storehouses, persimmon trees, hedges.
 *
 * All of it lives in a few pools shared by every terrain tile, so the whole valley's fields are a handful of draws:
 * terrain.js asks for a tile's plan while it builds the tile (plan, a generator that works a few plots a step), puts
 * it in when the tile's new mesh goes in (commit) and takes it out with the tile (drop). A plot belongs to the tile
 * its middle is in. The far ring of tiles gets the water, the bunds and the buildings; the rows only nearer.
 *
 * The water is a mirror for the sky: the reflection is the rig's own sky in the mirrored direction (gold at sunset, blue
 * in the blue hour, near black at night), weighted by water's Fresnel so it is strongest at a glancing look from the
 * road, and held under the bloom's threshold; the sun's own highlight on it under a soft ceiling, as the road's is, so
 * a low sun ahead draws a sheen across the paddies and not a white blaze.
 *
 * A phone gets fewer of the small things: rows only in the nearest ring, the plain storehouse and the plain farmhouse
 * past it, earth for the house lots' walls, no persimmons (its budget is in draws).
 */
import * as THREE from 'three';
import { Pool } from './instancing.js?v=202610040049';
import { KIND } from './farm.js?v=202610040049';
import { mulberry32 } from './config.js?v=202610040049';

const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const OWN = 1000000;              // (the pools' and the colliders' owners for a tile: OWN + its farm id)

// what the bunds and walls, the rows and the water are tinted, by kind
const BUND = [0x7f9f47, 0x86a54c, 0x74963f, 0x8aa957, 0x5e4a36, 0x6a5440];        // fresh grass, and a few new-plastered in mud
const RISER = [0x6f8d42, 0x667f3f, 0x7a7447, 0x5f6a3c];                          // a terrace's taller face: grass over earth
const WATER = [0x3c4a4e, 0x42504f, 0x4a4a40, 0x3a4746, 0x4b5848];                // the water's own colour under the sky it shows
const TEA = [0x3b6a2e, 0x416f31, 0x355f2b, 0x4c7a34, 0x5f8a3a];
const CROP = [[0x6f9e3a, 0.36, 0.5], [0x8ab34a, 0.3, 0.45], [0x5d8a5a, 0.42, 0.5], [0x6a4c35, 0.2, 0.62], [0xe8eeec, 0.6, 0.95], [0x9cbf54, 0.26, 0.4]];
const HEDGE = [0x2f5a32, 0x37643a, 0x2b5530];
const TRACK = [0x9d947f, 0x948c78, 0xa39a84, 0x8f9070];                        // gravel, a little grass down its middle

/**
 * A unit loaf: a rounded hedge, a crop row or a plastic tunnel, x -0.5..0.5 along, z -0.5..0.5 across, y 0..1. Five
 * faces over the top and a fan at each end: eighteen triangles (there are thousands of them).
 */
function loafGeometry() {
  const prof = [[-0.5, 0], [-0.44, 0.58], [-0.22, 0.95], [0.22, 0.95], [0.44, 0.58], [0.5, 0]];
  const pos = [];
  const P = (x, [z, y]) => pos.push(x, y, z);
  for (let i = 0; i < prof.length - 1; i++) {
    const a = prof[i], b = prof[i + 1];
    // (wound so the outside faces out)
    P(-0.5, a); P(0.5, b); P(0.5, a);
    P(-0.5, a); P(-0.5, b); P(0.5, b);
  }
  // the two ends, fans from the first point of the profile
  for (const [x, flip] of [[-0.5, true], [0.5, false]]) for (let i = 1; i < prof.length - 1; i++) {
    const a = prof[i], b = prof[i + 1];
    if (flip) { P(x, prof[0]); P(x, b); P(x, a); } else { P(x, prof[0]); P(x, a); P(x, b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * A unit bund: a prism along x 0..1, its back face upright at z = 0 (the line between two plots) and its front face
 * battered down to z = 1, from y 0 (buried) to 1 (its top); the top a little over half as wide as the foot (T), or most
 * of it for a farm track.
 */
function bundGeometry(T = 0.55) {
  const sec = [[0, 0], [0, 1], [T, 1], [1, 0]];          // (z, y) round the section: back foot, back top, front top, front foot
  const pos = [];
  const P = (x, [z, y]) => pos.push(x, y, z);
  for (let i = 0; i < 3; i++) {
    const a = sec[i], b = sec[i + 1];
    P(0, a); P(1, b); P(1, a);
    P(0, a); P(0, b); P(1, b);
  }
  // the ends
  P(0, sec[0]); P(0, sec[2]); P(0, sec[1]); P(0, sec[0]); P(0, sec[3]); P(0, sec[2]);
  P(1, sec[0]); P(1, sec[1]); P(1, sec[2]); P(1, sec[0]); P(1, sec[2]); P(1, sec[3]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // (uv: along and up, so the stone wall's courses run along it at any length: see wallMaterial)
  return g;
}

/**
 * Stone for the house lots' walls (ishigaki): rounded field stones in courses with dark joints, moss in the joints
 * low down. Mapped from the world position by the face's own direction, so a wall of any length and height keeps its
 * stones the same size (the walls are instanced and stretched).
 */
export function stoneTexture() {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  let seed = 41;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  ctx.fillStyle = '#56524a'; ctx.fillRect(0, 0, S, S);              // the joints, earth and shadow
  // field stones of every size in rough courses, each an irregular polygon a shade of its own (kept close in value: the
  // ink pass draws hard edges, and a wall of pale even stones read as eggs in a tray)
  let y = -6;
  while (y < S) {
    const h = 34 + rnd() * 30;
    let x = -rnd() * 40;
    while (x < S) {
      const w = 38 + rnd() * 52, v = 118 + rnd() * 46, warm = rnd() * 12 - 4, sh = (rnd() - 0.5) * 10;
      const pts = [];
      for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + rnd() * 0.5, q = 0.8 + rnd() * 0.25; pts.push([Math.cos(a) * (w / 2 - 2) * q, Math.sin(a) * (h / 2 - 2) * q]); }
      for (const dx of [0, -S, S]) for (const dy of [0, -S, S]) {
        ctx.fillStyle = `rgb(${v + warm | 0},${v + warm * 0.5 | 0},${v - 6 | 0})`;
        ctx.beginPath();
        for (const [px, py] of pts) ctx.lineTo(x + w / 2 + dx + px, y + h / 2 + sh + dy + py);
        ctx.closePath(); ctx.fill();
      }
      x += w * (0.86 + rnd() * 0.1);
    }
    y += h * (0.8 + rnd() * 0.12);
  }
  // moss in the joints and over the stones in patches
  for (let i = 0; i < 110; i++) {
    const x = rnd() * S, yy = rnd() * S, r = 5 + rnd() * 16;
    ctx.fillStyle = `rgba(${62 + rnd() * 30 | 0},${92 + rnd() * 34 | 0},${44 | 0},${0.3 + rnd() * 0.35})`;
    ctx.beginPath(); ctx.ellipse(x, yy, r, r * 0.6, rnd() * 3, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

/** A stone material mapped in world metres off whichever way each face looks (2.6 m to a repeat of the texture). */
export function wallMaterial(tex, color = 0xb3ab9c) {
  const m = new THREE.MeshStandardMaterial({ color, map: tex, roughness: 0.95, metalness: 0, flatShading: true });
  m.name = 'drystone';
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStoneW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vStoneW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#ifdef USE_INSTANCING\n  vStoneW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#endif');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStoneW;')
      .replace('#include <map_fragment>', `{
  vec3 n = normalize(cross(dFdx(vStoneW), dFdy(vStoneW)));
  vec2 suv = abs(n.y) > 0.7 ? vStoneW.xz : vec2(abs(n.x) > abs(n.z) ? vStoneW.z : vStoneW.x, vStoneW.y);
  diffuseColor.rgb *= texture2D(map, suv / 2.6).rgb;
}`);
  };
  m.customProgramCacheKey = () => 'drystone-world';
  return m;
}

/**
 * A house as the far ring sees it: walls (a dark skirt under white plaster) under a hip roof (the farmhouse) or a gable
 * (the storehouse), vertex-coloured, two dozen triangles. foot: the full model's [half width, half depth, height].
 */
function farHouse([hx, hz, H], hip) {
  const pos = [], col = [], c = new THREE.Color();
  const tri = (a, b, d, k) => { pos.push(...a, ...b, ...d); c.set(k); for (let i = 0; i < 3; i++) col.push(c.r, c.g, c.b); };
  const quad = (a, b, d, e, k) => { tri(a, b, d, k); tri(a, d, e, k); };
  const wx = hx * (hip ? 0.84 : 0.72), wz = hz * (hip ? 0.73 : 0.7);
  const eave = H * (hip ? 0.45 : 0.66), ridge = H * (hip ? 0.91 : 0.88);
  const walls = (y0, y1, k) => {
    quad([-wx, y0, wz], [wx, y0, wz], [wx, y1, wz], [-wx, y1, wz], k);
    quad([wx, y0, -wz], [-wx, y0, -wz], [-wx, y1, -wz], [wx, y1, -wz], k);
    quad([wx, y0, wz], [wx, y0, -wz], [wx, y1, -wz], [wx, y1, wz], k);
    quad([-wx, y0, -wz], [-wx, y0, wz], [-wx, y1, wz], [-wx, y1, -wz], k);
  };
  walls(0, 1.1, 0x3d2c22); walls(1.1, eave, 0xe8e2d2);
  const ex = hx, ez = hz;
  if (hip) {
    const rx = Math.max(0.5, hx - hz);
    quad([-ex, eave, ez], [ex, eave, ez], [rx, ridge, 0], [-rx, ridge, 0], 0x4b515b);
    quad([ex, eave, -ez], [-ex, eave, -ez], [-rx, ridge, 0], [rx, ridge, 0], 0x4b515b);
    tri([ex, eave, ez], [ex, eave, -ez], [rx, ridge, 0], 0x454b55);
    tri([-ex, eave, -ez], [-ex, eave, ez], [-rx, ridge, 0], 0x454b55);
  } else {
    quad([-ex, eave, ez], [ex, eave, ez], [ex, ridge, 0], [-ex, ridge, 0], 0x484e58);
    quad([ex, eave, -ez], [-ex, eave, -ez], [-ex, ridge, 0], [ex, ridge, 0], 0x484e58);
    tri([wx, eave, wz], [wx, eave, -wz], [wx, ridge - 0.2, 0], 0xebe6d8);
    tri([-wx, eave, -wz], [-wx, eave, wz], [-wx, ridge - 0.2, 0], 0xebe6d8);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * Merge an asset's parts into one vertex-coloured part (each part keeps its material's colour), apart from the parts
 * whose material name matches keep: a farmhouse of six materials is one draw and its windows a second.
 */
export function bakeParts(parts, keep, mat) {
  const out = [], geos = [];
  for (const p of parts) {
    if (keep && keep.test(p.material.name)) { out.push(p); continue; }
    const g = (p.geometry.index ? p.geometry.toNonIndexed() : p.geometry.clone()).applyMatrix4(p.local);
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    const n = g.attributes.position.count, col = new Float32Array(n * 3), c = p.material.color;
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geos.push(g);
  }
  if (geos.length) {
    let nv = 0; for (const g of geos) nv += g.attributes.position.count;
    const pos = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    let o = 0;
    for (const g of geos) { pos.set(g.attributes.position.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; g.dispose(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals(); geo.computeBoundingSphere();
    out.unshift({ geometry: geo, material: mat, local: new THREE.Matrix4() });
  }
  return out;
}

export class Farmland {
  /**
   * world: its parts (the hamlet's assets), its pools (these join them, so they are flushed, drawn and compiled with the
   * rest) and its colliders; phone: the lighter tier (no rows past the nearest ring, fewer of everything small).
   */
  constructor(world, { phone = false } = {}) {
    this.w = world; this.phone = phone;
    // the water: dark, so the sky it reflects is what shows (see the top); tinted per paddy. The reflection is the sky
    // itself: the rig's own sky (atmosSky, which its haze patch puts in every lit material's shader) in the mirrored
    // direction, weighted by water's Fresnel and held under the bloom's threshold; the environment map alone (built at
    // half the sky's strength and greyed, to light with) gave a flat grey slab
    this.mirrorU = { uPaddyMirror: { value: 0.92 } };
    this.waterMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.08, metalness: 0, envMapIntensity: 1 });
    this.waterMat.name = 'paddy water'; this.waterMat.userData.tinted = true;
    this.waterMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.mirrorU);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPaddyW;')
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
#ifdef USE_INSTANCING
  vPaddyW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vPaddyW = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPaddyW;\nuniform float uPaddyMirror;')
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  // (the sun's highlight under a soft ceiling, as on the road: a sheen across the paddies, never a blaze for the bloom)
  reflectedLight.directSpecular = reflectedLight.directSpecular / (1.0 + reflectedLight.directSpecular * 4.0);
#ifdef USE_FOG
  {
    vec3 rd = reflect(normalize(vPaddyW - cameraPosition), vec3(0.0, 1.0, 0.0));
    float fr = 0.04 + 0.96 * pow(1.0 - clamp(rd.y, 0.0, 1.0), 5.0);
    vec3 sky = min(atmosSky(normalize(vec3(rd.x, max(rd.y, 0.006), rd.z))), vec3(1.05));
    float k = clamp(fr * uPaddyMirror + 0.06, 0.0, 0.88);
    reflectedLight.indirectSpecular = sky * k;
    reflectedLight.directDiffuse *= 1.0 - k;
    reflectedLight.indirectDiffuse *= 1.0 - k;
  }
#endif`);
    };
    this.waterMat.customProgramCacheKey = () => 'paddy-water-sky';
    this.earthMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, flatShading: true });
    this.earthMat.name = 'bund'; this.earthMat.userData.tinted = true;
    this.stoneMat = wallMaterial(stoneTexture());
    this.rowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0, flatShading: true });
    this.rowMat.name = 'rows'; this.rowMat.userData.tinted = true;
    // the buildings, one vertex-coloured draw each (their windows a second, lit at night: setNight)
    this.houseMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, flatShading: true });
    this.houseMat.name = 'hamlet';
    const P = world.parts;
    const parts = {
      paddy: [{ geometry: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), material: this.waterMat, local: new THREE.Matrix4() }],
      aze: [{ geometry: bundGeometry(), material: this.earthMat, local: new THREE.Matrix4() }],
      track: [{ geometry: bundGeometry(0.88), material: this.earthMat, local: new THREE.Matrix4() }],
      ishi: [{ geometry: bundGeometry(), material: this.stoneMat, local: new THREE.Matrix4() }],
      rows: [{ geometry: loafGeometry(), material: this.rowMat, local: new THREE.Matrix4() }],
    };
    // the buildings' sizes (half width, half depth, height), from the templates as placed
    this.foot = {};
    for (const k of ['farmhouse', 'kura', 'persimmon']) if (world.foot[k]) this.foot[k] = world.foot[k];
    if (P.farmhouse) { parts.house = bakeParts(P.farmhouse, /window/, this.houseMat); parts.houseFar = [{ geometry: farHouse(this.foot.farmhouse, true), material: this.houseMat, local: new THREE.Matrix4() }]; }
    if (P.kura) { parts.kura = bakeParts(P.kura, /window/, this.houseMat); parts.kuraFar = [{ geometry: farHouse(this.foot.kura, false), material: this.houseMat, local: new THREE.Matrix4() }]; }
    if (P.persimmon) parts.kaki = P.persimmon;
    this.parts = parts;
    const caps = { paddy: 3000, aze: 9000, track: 1500, ishi: 2500, rows: phone ? 9000 : 16000, house: 60, kura: 50, houseFar: 120, kuraFar: 90, kaki: 160 };
    this.pools = {};
    for (const k of Object.keys(parts)) {
      // (nothing out in the fields casts a shadow: the cascades would draw every house in the valley twice more, and
      // they lie well past where the sun's shadows reach)
      const pool = new Pool(parts[k], caps[k], { tint: !/house|kura/i.test(k) });
      this.pools[k] = pool;
      world.pools['farm_' + k] = pool;
      world.root.add(pool.group);
    }
    this._lit = [];
    for (const k of ['house', 'kura']) for (const p of parts[k] || []) if (/window/.test(p.material.name) && p.material.emissive) this._lit.push({ mat: p.material, base: p.material.emissiveIntensity || 1 });
  }

  /** The materials of the fields, for the shader compile at boot. */
  materials() { return [this.waterMat, this.earthMat, this.stoneMat, this.rowMat, this.houseMat]; }

  /** Night (0..1): the windows come on, the water and the fields take the cool night tint. */
  setNight(n, tint) {
    for (const l of this._lit) l.mat.emissiveIntensity = l.base * n;
    if (tint) { tint(this.waterMat, [0.46, 0.56, 0.95]); tint(this.earthMat, [0.42, 0.55, 0.95]); tint(this.stoneMat, [0.5, 0.58, 0.92]); tint(this.rowMat, [0.42, 0.54, 0.92]); tint(this.houseMat, [0.52, 0.6, 0.95]); }
  }

  /**
   * The plan for a tile: every instance its plots need, worked out a few plots a step (yield) and returned. hAt(x, z) is
   * the ground's height there as the tile has it (its own surface inside it, the ground beyond).
   */
  *plan(tile, lod, farm, ground, TILE) {
    const out = { list: [], cols: [] };
    if (!farm) return out;
    const plots = [];
    farm.plotsIn(tile.i * TILE, tile.j * TILE, (tile.i + 1) * TILE, (tile.j + 1) * TILE, (p) => { const I = farm.info(p); if (I.kind) plots.push(I); });
    let work = 0;
    for (const I of plots) {
      const rng = mulberry32((I.key % 2147483647) ^ 0x2545f491);
      if (I.kind === KIND.TEA) { if (lod <= (this.phone ? 0 : 1)) this._tea(out, I, rng, ground, lod); }
      else {
        if (I.kind === KIND.PADDY) this._water(out, I, rng);
        else if (I.kind === KIND.VEG) { if (lod <= (this.phone ? 0 : 1)) this._veg(out, I, rng, lod); }
        else if (I.kind === KIND.HOUSE) this._house(out, I, rng, lod);
        this._bunds(out, I, farm, ground);
      }
      if (++work % 6 === 0) yield;
    }
    return out;
  }

  /** The tile's plan goes in (its old one, if any, came out with the old mesh: drop). */
  commit(tile, plan) {
    if (!plan || (!plan.list.length && !plan.cols.length)) return;
    tile.farmOwn = OWN + (tile.farmSeq = (this._seq = (this._seq || 0) + 1));
    // ('@name': one of the world's own pools, the bamboo fence's)
    for (const [k, m, c] of plan.list) { const pool = k[0] === '@' ? this.w.pools[k.slice(1)] : this.pools[k]; if (pool) pool.add(tile.farmOwn, m, c); }
    for (const rec of plan.cols) this.w._reg(tile.farmOwn, rec);
  }

  drop(tile) {
    if (!tile.farmOwn) return;
    for (const p of Object.values(this.pools)) p.removeOwner(tile.farmOwn);
    for (const k of ['fence', 'hokora']) if (this.w.pools[k]) this.w.pools[k].removeOwner(tile.farmOwn);
    this.w._unregOwner(tile.farmOwn);
    tile.farmOwn = 0;
  }

  // ------------------------------------------------------------------ the plots

  _put(out, k, x, y, z, ry, sx, sy, sz, colour = null) {
    _q.setFromAxisAngle(_up, ry); _s.set(sx, sy, sz);
    out.list.push([k, new THREE.Matrix4().compose(_v.set(x, y, z), _q, _s), colour]);
  }

  /** A paddy's water: the whole plot, a few centimetres over its level (the bunds stand on its edges). */
  _water(out, I, rng) {
    const pick = Math.floor(rng() * WATER.length);
    this._put(out, 'paddy', (I.x0 + I.x1) / 2, I.level + 0.07, (I.z0 + I.z1) / 2, 0, I.x1 - I.x0, 1, I.z1 - I.z0, WATER[pick]);
  }

  /**
   * The bunds and walls round a levelled plot, walked along each side a 6 m step at a time. The higher of two levelled
   * plots (or a levelled plot against the natural ground) owns the line between; the bund's upright back stands on the
   * line, its battered front falls to the lower side, from below the lower ground to a little over the higher level.
   * A house lot's are dry stone.
   */
  _bunds(out, I, farm, ground) {
    const sides = [[I.x0, I.z0, 0, 1, -1, 0], [I.x1, I.z0, 0, 1, 1, 0], [I.x0, I.z0, 1, 0, 0, -1], [I.x0, I.z1, 1, 0, 0, 1]];
    const q = {};
    for (const [sx, sz, dx, dz, ox, oz] of sides) {
      const len = dx ? I.x1 - I.x0 : I.z1 - I.z0, steps = Math.round(len / 6);
      let run = null;
      // a farm track (noudou) along the terrace edges that fall on a block's edge, here and there: gravel on top of the
      // riser between two farmed plots, the way the farm's own little vans get round
      const across = dx ? !I.tr : I.tr, coord = dx ? sz : sx;
      const trackLine = across && coord % 72 === 0 && (Math.abs(Math.sin(coord * 0.1373 + Math.floor((dx ? sx : sz) / 72) * 7.31 + this.w.seed * 0.01) * 43758.5453) % 1) < 0.5;
      const flush = () => {
        if (!run) return;
        const { a, b, out: sgn, top, bottom, stone, track } = run;
        // walk the line so that (along) x up is the way the body goes (see the matrix below)
        const ax = sx + dx * a, az = sz + dz * a, bx = sx + dx * b, bz = sz + dz * b;
        const wx = ox * sgn, wz = oz * sgn;                    // the way to the lower side
        let px = ax, pz = az, ux = bx - ax, uz = bz - az;
        // (dir x up = out: dir = up x out = (wz, 0, -wx))
        if (ux * wz - uz * wx < 0) { px = bx; pz = bz; ux = -ux; uz = -uz; }
        const L = Math.hypot(ux, uz), H = top - bottom, T = (track ? 2.5 : stone ? 0.5 : 0.36) + 0.28 * Math.min(H, 4);
        const m = new THREE.Matrix4().set(ux, 0, wx * T, px, 0, H, 0, bottom, uz, 0, wz * T, pz, 0, 0, 0, 1);
        const hsh = Math.abs(Math.floor(px * 7 + pz * 3));
        out.list.push([track ? 'track' : stone ? 'ishi' : 'aze', m, stone ? null : track ? TRACK[hsh % TRACK.length] : H > 1.4 ? RISER[hsh % RISER.length] : BUND[hsh % BUND.length]]);
        run = null;
      };
      for (let k = 0; k < steps; k++) {
        const a = k * 6, b = a + 6;
        const mx = sx + dx * (a + 3), mz = sz + dz * (a + 3);
        const J = farm.info(farm.plotAt(mx + ox * 0.01, mz + oz * 0.01, q));
        // the ground on the line, every 1.5 m (the vertices of the finest terrain stand there)
        let lo = Infinity;
        for (let t = 0; t <= 4; t++) lo = Math.min(lo, ground.height(sx + dx * (a + t * 1.5), sz + dz * (a + t * 1.5)));
        let own = false, sgn = 1, top = I.level;
        if (J.flat) {
          own = I.level > J.level + 1e-6 || (Math.abs(I.level - J.level) <= 1e-6 && I.key < J.key);
          top = Math.max(I.level, J.level); sgn = I.level >= J.level ? 1 : -1;
        } else {
          own = true; sgn = lo < I.level - 0.05 ? 1 : -1;
        }
        const stone = !this.phone && (I.kind === KIND.HOUSE || (J.flat && J.kind === KIND.HOUSE && J.level > I.level));
        const track = trackLine && !stone && J.flat && I.kind !== KIND.HOUSE && J.kind !== KIND.HOUSE;
        if (!own) { flush(); continue; }
        const t = top + (track ? 0.1 : stone ? 0.32 : I.kind === KIND.VEG && (!J.flat || J.kind === KIND.VEG) ? 0.12 : 0.2), btm = lo - 0.5;
        if (run && run.out === sgn && run.stone === stone && run.track === track && Math.abs(run.top - t) < 0.01 && run.b === a) { run.b = b; run.bottom = Math.min(run.bottom, btm); }
        else { flush(); run = { a, b, out: sgn, top: t, bottom: btm, stone, track }; }
      }
      flush();
    }
  }

  /** Rows of tea along the contour across a sloping plot, each a hedge of loaves sat on the ground and tilted with it. */
  _tea(out, I, rng, ground, lod) {
    const gl = Math.hypot(I.gx, I.gz) || 1, nx = I.gx / gl, nz = I.gz / gl;     // up the slope
    const dx = -nz, dz = nx;                                                   // along the contour
    const cx = (I.x0 + I.x1) / 2, cz = (I.z0 + I.z1) / 2, hw = (I.x1 - I.x0) / 2 - 1.0, hd = (I.z1 - I.z0) / 2 - 1.0;
    // (a row is one long hedge: in lengths of several metres only so that it follows the ground's rise along it)
    const R = Math.hypot(hw, hd), SP = 1.85, SEG = lod === 0 ? 8 : 14;
    const colour = TEA[Math.floor(rng() * TEA.length)];
    for (let o = -R + ((I.h * 7) % 1) * SP; o <= R; o += SP) {
      // the row's line, clipped to the plot (inset a metre all round)
      let t0 = -Infinity, t1 = Infinity;
      const clip = (p, d, lo, hi) => {
        if (Math.abs(d) < 1e-6) return p >= lo && p <= hi;
        let a = (lo - p) / d, b = (hi - p) / d; if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, b); return true;
      };
      const px = cx + nx * o, pz = cz + nz * o;
      if (!clip(px - cx, dx, -hw, hw) || !clip(pz - cz, dz, -hd, hd) || t1 - t0 < 2) continue;
      const n = Math.max(1, Math.round((t1 - t0) / SEG)), len = (t1 - t0) / n;
      for (let k = 0; k < n; k++) {
        const ta = t0 + k * len - (k ? 0.05 : 0), tb = t0 + (k + 1) * len + (k < n - 1 ? 0.05 : 0);
        const ax = px + dx * ta, az = pz + dz * ta, bx = px + dx * tb, bz = pz + dz * tb;
        const ya = ground.height(ax, az), yb = ground.height(bx, bz);
        const L = Math.hypot(bx - ax, bz - az), pitch = Math.atan2(yb - ya, L);
        const m = new THREE.Matrix4().makeRotationY(Math.atan2(-dz, dx)).multiply(new THREE.Matrix4().makeRotationZ(pitch));
        m.scale(_s.set(L / Math.cos(pitch), 0.95 + rng() * 0.15, 1.3));
        m.setPosition((ax + bx) / 2, (ya + yb) / 2 - 0.12, (az + bz) / 2);
        out.list.push(['rows', m, rng() < 0.85 ? colour : TEA[Math.floor(rng() * TEA.length)]]);
      }
    }
  }

  /** A vegetable plot: beds of one crop each across it (greens, onions, bare ridges, white plastic tunnels). */
  _veg(out, I, rng, lod) {
    const along = I.x1 - I.x0 >= I.z1 - I.z0;                 // the rows run the long way
    const L = (along ? I.x1 - I.x0 : I.z1 - I.z0) - 2.4, W = (along ? I.z1 - I.z0 : I.x1 - I.x0) - 2.4;
    const cx = (I.x0 + I.x1) / 2, cz = (I.z0 + I.z1) / 2, ry = along ? 0 : Math.PI / 2;
    // now and then the whole plot is the rice nursery: two greenhouses of white plastic
    if (I.h > 0.82 && W > 9) {
      for (const k of [-1, 1]) {
        const o = k * W / 4;
        this._put(out, 'rows', cx + (along ? 0 : o), I.level - 0.05, cz + (along ? o : 0), ry, L, 2.7, Math.min(5.6, W / 2 - 0.8), 0xe6ecea);
      }
      return;
    }
    let o = -W / 2 + 0.5;
    while (o < W / 2 - 0.4) {
      const [colour, h, w] = CROP[Math.floor(rng() * CROP.length)], bed = 3 + Math.floor(rng() * 4), gap = w > 0.8 ? 1.7 : 1.05;
      const segs = lod === 0 && L > 14 ? 2 : 1;
      for (let r = 0; r < bed && o < W / 2 - 0.4; r++, o += gap) {
        for (let s = 0; s < segs; s++) {
          const a = -L / 2 + (L / segs) * s, len = L / segs - 0.3, c = a + len / 2 + 0.15;
          this._put(out, 'rows', cx + (along ? c : o), I.level - 0.04, cz + (along ? o : c), ry, len, h * (0.9 + rng() * 0.2), w, colour);
        }
      }
      o += 0.6;
    }
  }

  /**
   * A house lot: the farmhouse at its back facing down the slope, a storehouse beside it where there is room, a persimmon
   * in the yard, a hedge down one side.
   */
  _house(out, I, rng, lod) {
    const F = this.foot;
    if (!F.farmhouse) return;
    // the front: downhill, along whichever axis is nearer
    let fx = 0, fz = 0;
    if (Math.abs(I.gx || 0) > Math.abs(I.gz || 0)) fx = -Math.sign(I.gx); else fz = -Math.sign(I.gz || 1);
    const ry = Math.atan2(fx, fz);
    const lx = fz, lz = -fx;                                       // across the front (the house's own +x)
    const D = fx ? I.x1 - I.x0 : I.z1 - I.z0, W = fx ? I.z1 - I.z0 : I.x1 - I.x0;
    const cx = (I.x0 + I.x1) / 2, cz = (I.z0 + I.z1) / 2, y = I.level;
    const [hx, hz] = F.farmhouse;
    // set back from the front so a yard opens before it
    const back = Math.max(0, D / 2 - hz - 1.4), side = W > 2 * hx + 9 ? (rng() < 0.5 ? -1 : 1) * Math.min(W / 2 - hx - 1, 4) : 0;
    const x = cx - fx * back + lx * side, z = cz - fz * back + lz * side;
    // (the far ring's houses are walls and a roof: a few hundred metres off, the full model's posts and lattices are
    // a pixel each)
    const far = (lod >= 2 || (this.phone && lod >= 1)) && this.pools.houseFar;
    this._put(out, far ? 'houseFar' : 'house', x, y, z, ry, 1, 1, 1);
    out.cols.push({ name: 'house', kind: 'solid', x, y, z, ry, box: true, hx: hx * 0.96, hz: hz * 0.96, r: Math.hypot(hx, hz), alive: true });
    // the storehouse: beside the house on the lot's wider side if there is room, its back in line with the house's
    if (F.kura && rng() < 0.75) {
      const [kx, kz] = F.kura, s = side ? -Math.sign(side) : rng() < 0.5 ? -1 : 1;
      const lat = side + s * (hx + 1.6 + kx);
      if (Math.abs(lat) + kx < W / 2 - 0.8 && D > 2 * kz + 2) {
        const dep = Math.max(0, D / 2 - kz - 1.2);
        const bx = cx - fx * dep + lx * lat, bz = cz - fz * dep + lz * lat;
        // (a phone draws the storehouse plain at any distance: one draw fewer)
        this._put(out, (far || this.phone) && this.pools.kuraFar ? 'kuraFar' : 'kura', bx, y, bz, ry, 1, 1, 1);
        out.cols.push({ name: 'house', kind: 'solid', x: bx, y, z: bz, ry, box: true, hx: kx * 0.96, hz: kz * 0.96, r: Math.hypot(kx, kz), alive: true });
      }
    }
    // the persimmon in one front corner of the yard, and now and then in the other the household's own little shrine
    // (yashikigami), turned to the house
    const ps = rng() < 0.5 ? -1 : 1;
    if (F.persimmon && lod <= 1 && !this.phone && D > 2 * hz + 6) {
      const px = cx + fx * (D / 2 - 3) + lx * ps * (W / 2 - 3.2), pz = cz + fz * (D / 2 - 3) + lz * ps * (W / 2 - 3.2);
      const sc = 0.85 + rng() * 0.3;
      this._put(out, 'kaki', px, y - 0.1, pz, rng() * 6.28, sc, sc * (0.9 + rng() * 0.2), sc, [0x9cc85a, 0xa9cf63, 0x8dbb4f][Math.floor(rng() * 3)]);
      out.cols.push({ name: 'tree', kind: 'solid', x: px, y, z: pz, r: 0.35 * sc, alive: true, colour: 0x9cc85a });
    }
    if (lod <= 1 && this.w.pools.hokora && D > 2 * hz + 5 && rng() < 0.25) {
      const hx2 = cx + fx * (D / 2 - 1.8) - lx * ps * (W / 2 - 2.4), hz2 = cz + fz * (D / 2 - 1.8) - lz * ps * (W / 2 - 2.4);
      out.list.push(['@hokora', new THREE.Matrix4().compose(_v.set(hx2, y - 0.06, hz2), _q.setFromAxisAngle(_up, ry + Math.PI), _s.set(1.1, 1.1, 1.1)), null]);
    }
    // down one side, a clipped hedge (ikegaki) or a bamboo fence (yotsume-gaki)
    if (lod === 0 && rng() < 0.75) {
      const s = rng() < 0.5 ? -1 : 1, ex = cx + lx * s * (W / 2 - 0.9), ez = cz + lz * s * (W / 2 - 0.9);
      if (rng() < 0.55 || !this.w.pools.fence) this._put(out, 'rows', ex, y - 0.05, ez, ry + Math.PI / 2, D - 3, 1.5, 0.9, HEDGE[Math.floor(rng() * HEDGE.length)]);
      else {
        // (panels of two metres from the back of the lot toward its front, along the house's own -z)
        const n = Math.floor((D - 3) / 2), ux = -fx, uz = -fz, a0 = (D - 3) / 2;
        for (let k = 0; k < n; k++) {
          const px = ex - ux * a0 + ux * k * 2, pz = ez - uz * a0 + uz * k * 2;
          out.list.push(['@fence', new THREE.Matrix4().compose(_v.set(px, y - 0.05, pz), _q.setFromAxisAngle(_up, Math.atan2(-uz, ux)), _s.set(1, 1, 1)), null]);
        }
      }
    }
  }
}
