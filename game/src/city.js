/**
 * NEO TOKYO: the city along the road, for the city courses (track.city).
 *
 * The road is the same ribbon; what changes is everything beside it. Each chunk lines both sides with street-front
 * buildings (instanced unit boxes, scaled per lot, their windows drawn by the building shader from world position
 * so a floor is a floor at any size), fixes vertical and horizontal neon signs to their fronts (every sign of a
 * chunk is one merged mesh over one atlas), and lays the neon's light on the street: a coloured pool on the
 * pavement and, on a wet road, a long streak down the asphalt, the reflection a wet Tokyo street is made of.
 * Square corners get zebra crossings, a painted STOP, and a signal on the outside of the turn.
 *
 * Everything here runs at build level with the chunk and is owned by it (the world disposes what is in ch.own).
 */
import * as THREE from 'three';
import { clamp, lerp, mulberry32 } from './config.js?v=202609232035';
import { buildingMaterial } from './buildings.js?v=202609232035';
import { neonAtlas } from './neon.js?v=202609232035';
import { cityPropMaterials, lotProps, parkingProps, streetProps, bollardGeometry, streetItems } from './cityprops.js?v=202609232035';
import { detailLoad, detailBegin, detailLot, detailChunk, detailUpdate, detailWet } from './citydetail.js?v=202609232035';
import { railSkip } from './citytrain.js?v=202609232035';
import { carsLoad, parkCar } from './citycars.js?v=202609232035';

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

// facade colours: concrete, tile, dark glass and the odd painted block
const FACADES = [0x55565c, 0x6b6a66, 0x7a746a, 0x3c3f47, 0x4a4e57, 0x8a8478, 0x5c5048, 0x2f3440, 0x6e6a74, 0x44474d];

/** The city road: darker asphalt to a concrete gutter, solid white edge lines, the orange no-passing pair. */
export function cityRoadTexture(half, wall) {
  const W = 256, H = 1024, LEN = 48;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const rv = document.createElement('canvas'); rv.width = W; rv.height = H;
  const ctx = cv.getContext('2d'), rctx = rv.getContext('2d');
  const img = ctx.createImageData(W, H), rimg = rctx.createImageData(W, H);
  let seed = 11;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const patches = [];
  for (let k = 0; k < 6; k++) patches.push({ u0: -half + rnd() * (2 * half - 2), du: 0.8 + rnd() * 2.4, v0: rnd() * LEN, dv: 1.5 + rnd() * 5 });
  const holes = [[half * 0.45, 9], [-half * 0.5, 31]];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = ((x + 0.5) / W) * 2 * wall - wall, au = Math.abs(u), vm = (y / H) * LEN;
    const grain = (rnd() - 0.5) * 12;
    let c = [0x2b + grain, 0x2c + grain, 0x31 + grain], rough = 0.58 + 0.06 * rnd();
    const wear = 1 - 0.07 * Math.exp(-Math.pow((au - half * 0.4) / 0.55, 2));
    c = c.map((v) => v * wear);
    for (const p of patches) if (u > p.u0 && u < p.u0 + p.du && vm > p.v0 && vm < p.v0 + p.dv) { c = c.map((v) => v * 0.82); rough = 0.66; }
    for (const [hu, hv] of holes) { const d = Math.hypot(u - hu, vm - hv); if (d < 0.32) { c = d > 0.27 ? [0x5a, 0x5a, 0x5c] : [0x24, 0x24, 0x27].map((v) => v + ((Math.floor((u - hu) * 18) + Math.floor((vm - hv) * 18)) & 1) * 10); rough = 0.4; } }
    if (au > wall - 0.32) { c = [0x74 + grain, 0x72 + grain, 0x6d + grain]; rough = 0.8; }                    // the concrete gutter
    else if (Math.abs(au - (wall - 0.55)) < 0.07) { c = [0xe4, 0xe2, 0xda].map((v) => v + grain * 0.4); rough = 0.5; }  // edge line
    else if (au > 0.08 && au < 0.22) { c = [0xe8, 0xa4, 0x2a].map((v) => v * (0.92 + 0.08 * rnd())); rough = 0.5; }   // the orange pair
    // an avenue wide enough for two lanes a side: the white dashes between them, 4 m on and 4 m off
    else if (half > 5.4 && Math.abs(au - half * 0.5) < 0.075 && (vm % 8) < 4) { c = [0xde, 0xdc, 0xd4].map((v) => v * (0.9 + 0.1 * rnd())); rough = 0.52; }
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

/** A soft round and a long soft streak, for the light the neon throws on the street. */
function gradientTexture(stretch) {
  const w = 128, h = stretch ? 512 : 128;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x + 0.5) / w * 2 - 1, dy = (y + 0.5) / h * 2 - 1;
    let a;
    if (!stretch) { const r = Math.hypot(dx, dy); a = Math.max(0, 1 - r); a = a * a * (3 - 2 * a) * 0.9; }
    else {
      // a streak: sharp across, fading along, brightest a third of the way down, broken into ripples
      const across = Math.exp(-dx * dx * 9), along = Math.max(0, 1 - Math.abs(dy + 0.25) / 1.25);
      const ripple = 0.72 + 0.28 * Math.sin(dy * 40 + Math.sin(dy * 7) * 3);
      a = across * along * along * ripple;
    }
    const i = (y * w + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = clamp(a * 255, 0, 255);
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Zebra crossing paint: bars along the road, across its whole width (u repeats). */
function zebraTexture() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 128, 64);
  ctx.fillStyle = 'rgba(236,233,224,0.95)';
  ctx.fillRect(10, 2, 58, 60);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

/** The city's materials and pools, made once at load (so every program compiles with the rest). */
export function cityLoad(w, Pool, fontFamily) {
  w.bldgMat = buildingMaterial(THREE, {});
  w.bldgMat.userData.tinted = true;
  const unit = new THREE.BoxGeometry(1, 1, 1);                  // centred: an instance sits at its lot's middle
  w.pools.bldg = new Pool([{ geometry: unit, material: w.bldgMat, local: new THREE.Matrix4() }], 1400, { tint: true });
  w.root.add(w.pools.bldg.group);
  const atlas = neonAtlas(fontFamily);
  w.neon = atlas;
  w.neonMat = new THREE.MeshBasicMaterial({ map: atlas.texture, side: THREE.DoubleSide, color: new THREE.Color(1.7, 1.7, 1.7), transparent: false });
  w.neonMat.name = 'neon';
  w.neonHousingMat = new THREE.MeshStandardMaterial({ color: 0x1b1c21, roughness: 0.55, metalness: 0.35 });
  const glowTex = gradientTexture(false), streakTex = gradientTexture(true);
  w.neonGlowMat = new THREE.MeshBasicMaterial({ map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, opacity: 0.9 });
  w.streakMat = new THREE.MeshBasicMaterial({ map: streakTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6, opacity: 0.35 });
  w.signalPoleMat = new THREE.MeshStandardMaterial({ color: 0x5a5e66, roughness: 0.5, metalness: 0.5 });
  w.signalBoxMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.6, metalness: 0.3 });
  w.signalLit = [0x1ee8a8, 0xffb21e, 0xff3322].map((c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.2) }));
  w.signalDim = new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.3, metalness: 0.2 });
  w.zebraMat = new THREE.MeshStandardMaterial({ map: zebraTexture(), transparent: true, depthWrite: false, roughness: 0.55,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  // the street's clutter (cityprops.js), one draw per material per chunk
  w.propMats = cityPropMaterials(THREE);
  // the bollards the car can take out: a pool of their own
  {
    const b = bollardGeometry(THREE);
    const m = w.propMats[b.material] || w.propMats.glossy;
    w.pools.bollard = new Pool([{ geometry: b.geometry, material: m, local: new THREE.Matrix4() }], 900);
    w.root.add(w.pools.bollard.group);
    w.parts.bollard = [{ geometry: b.geometry, material: m, local: new THREE.Matrix4() }];
    b.geometry.computeBoundingBox(); const bb = b.geometry.boundingBox;
    w.foot.bollard = [(bb.max.x - bb.min.x) / 2, (bb.max.z - bb.min.z) / 2, bb.max.y - bb.min.y];
  }
  // the pavement's loose things, each a pool the car can knock them out of: bags, crates, boxes, cones, boards, bikes
  // (bags, crates and bicycle frames take their instance's colour through a tinted copy of their material)
  {
    const tint = {};
    for (const k of ['glossy', 'props']) { const m = w.propMats[k].clone(); m.name = w.propMats[k].name + ' tinted'; m.userData.tinted = true; tint[k] = m; }
    w.propMats.glossyTint = tint.glossy; w.propMats.propsTint = tint.props;
    const TINTED = new Set(['bag', 'crate', 'crates', 'bike']);
    const CAP = { bag: 1600, crate: 300, crates: 300, box: 300, cone: 400, aboard: 300, bike: 700 };
    for (const [name, parts0] of Object.entries(streetItems(THREE))) {
      const parts = parts0.map((p) => ({ geometry: p.geometry, local: new THREE.Matrix4(),
        material: TINTED.has(name) && tint[p.material] ? tint[p.material] : (w.propMats[p.material] || w.propMats.props) }));
      w.pools[name] = new Pool(parts, CAP[name] || 300, { tint: TINTED.has(name) });
      w.root.add(w.pools[name].group);
      w.parts[name] = parts;
      const bb = new THREE.Box3();
      for (const p of parts) { p.geometry.computeBoundingBox(); bb.union(p.geometry.boundingBox); }
      w.foot[name] = [(bb.max.x - bb.min.x) / 2, (bb.max.z - bb.min.z) / 2, bb.max.y - bb.min.y];
    }
  }
  // the expressway: concrete deck and piers, Jersey barriers, a lit strip along them, the gantry's steel and its sign
  w.deckMat = new THREE.MeshStandardMaterial({ color: 0x77746f, roughness: 0.93, metalness: 0 });
  w.barrierMat = new THREE.MeshStandardMaterial({ color: 0xa9a59d, roughness: 0.88, metalness: 0 });
  w.stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe2b8).multiplyScalar(1.9) });
  w.gantryMat = new THREE.MeshStandardMaterial({ color: 0x565a62, roughness: 0.5, metalness: 0.55 });
  w.shutoMat = shutoSignMaterial(w);
  // the detail over and along the street (citydetail.js): screens, wires, the pavement
  const detailMats = detailLoad(w, Pool);
  carsLoad(w, Pool);                                              // the parked cars' pool (citycars.js)
  // (the building material is drawn only instanced, by the buildings' pool and the terrain's blocks: the pool's own
  // instanced program is compiled at load with every pool, so it is not handed over for a plain mesh's program too,
  // which nothing draws and which cost a second compile of the city's biggest shader)
  return [...detailMats, w.neonMat, w.neonHousingMat, w.neonGlowMat, w.streakMat, w.signalPoleMat, w.signalBoxMat, ...w.signalLit, w.signalDim, w.zebraMat,
    ...new Set(Object.values(w.propMats)), w.deckMat, w.barrierMat, w.stripMat, w.gantryMat, w.shutoMat];
}

/** How wet the street is: the neon streaks come up with it. */
export function cityWet(w, wet, night) {
  // (the signs' streaks on a wet road: bright, not blinding; at full strength they were the brightest thing on screen)
  if (w.streakMat) w.streakMat.opacity = (0.2 + 0.42 * wet) * (0.3 + 0.7 * night);
  if (w.neonGlowMat) w.neonGlowMat.opacity = 0.9 * (0.35 + 0.65 * night);
  if (w.bldgMat && w.bldgMat.userData.uNight) w.bldgMat.userData.uNight.value = night;
  if (w.bldgMat && w.bldgMat.userData.uWet) w.bldgMat.userData.uWet.value = wet;
  detailWet(w, wet);
}

/**
 * A mesh of coloured light lying on the street: [x, z, along-x, along-z, width, length, hex] draped on the ground,
 * or (onRoad) on the road ribbon itself, whose surface can sit a little above the ground under it.
 */
function drape(w, ch, list, mat, lift, onRoad = false) {
  const g = w.ground, t = w.track, N = 6, probe = {};
  const hAt = (x, z) => { if (!onRoad) return g.height(x, z); g.sample(x, z, 2.2, probe); return t.sample(probe.s).y; };
  const pos = [], uv = [], col = [], idx = [];
  const c = new THREE.Color();
  for (const [cx, cz, ax, az, wid, len, hex] of list) {
    c.set(hex);
    const base = pos.length / 3;
    const bx = az, bz = -ax;                      // across
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const a = (j / N - 0.5) * len, b = (i / N - 0.5) * wid;
      const x = cx + ax * a + bx * b, z = cz + az * a + bz * b;
      pos.push(x, hAt(x, z) + lift, z); uv.push(i / N, j / N); col.push(c.r, c.g, c.b);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = base + j * (N + 1) + i, b = a + 1, cc = a + N + 1, d = cc + 1;
      idx.push(a, cc, b, b, cc, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeBoundingSphere();
  ch.own.add(geo);
  const m = new THREE.Mesh(geo, mat); m.renderOrder = 2; m.name = 'neon light';
  return m;
}

/** Merge simple geometries (position, normal, uv) into one; each is disposed. */
function merge(list) {
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
    ov += n; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

/** One sign face: a quad through corners a (bottom-left), b (bottom-right), c (top-right), d (top-left) with the atlas cell. */
function signQuad(list, a, b, c, d, cell, flip) {
  const g = new THREE.BufferGeometry();
  const P = [...a, ...b, ...c, ...d];
  const u0 = flip ? cell.u1 : cell.u0, u1 = flip ? cell.u0 : cell.u1;
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, cell.v0, u1, cell.v0, u1, cell.v1, u0, cell.v1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  list.push(g);
}

/**
 * The city beside one chunk of road. w is the World; its track, ground, pools and lamps are used directly.
 */
export function* cityChunk(w, ch) {
  const t = w.track, g = w.ground, pts = t.pts;
  const own = ch.c * 2;
  const rng = mulberry32((w.seed * 911 + ch.c * 7331) >>> 0);
  const probe = {};
  const signs = [], housings = [], glows = [], streaks = [], poles = [], boxes = [], lampsOn = [[], [], []], lampsOff = [], zebras = [];
  const parkSign = w.neon.signs.find((q) => q.name === 'parking');
  const clutter = {};
  let nLots = 0;
  // the screens, wires, shopping street and pavement (citydetail.js) share the chunk's housings and its light
  const D = detailBegin(w, ch, { housings, glows, streaks });
  const vSigns = w.neon.signs.filter((s) => s.vertical), hSigns = w.neon.signs.filter((s) => !s.vertical);
  const s0 = pts[ch.i0].s, s1 = pts[ch.i1].s;
  const at = (s, u) => { const p = t.sample(s); const lx = Math.cos(p.h), lz = -Math.sin(p.h); return [p.x + lx * u, p.z + lz * u, p]; };
  const clearAt = (x, z, need) => { g.sample(x, z, 2.2, probe); return probe.edge > need && !probe.tunnel; };

  for (const side of [1, -1]) {
    let s = s0 + rng() * 3;
    while (s < s1) {
      const lotW = 7 + rng() * 11;
      const sm = s + lotW / 2;
      s += lotW + (rng() < 0.14 ? 2.5 + rng() * 5 : 0.35);             // an alley now and then
      const p = t.sample(sm);
      if (p.tunnel || t.nearTunnel(p.s, 12) || t.markerAt(p.s, side) || t.padAt(p.s, side)) continue;
      // (an elevated railway runs along some avenues: its viaduct and stations stand where these lots would)
      if (railSkip(w, sm, side, lotW / 2)) continue;
      // the inside of a square corner has no room for a lot
      if (Math.abs(p.k) > 1 / 70 && Math.sign(p.k) === side) continue;
      const wall = side > 0 ? p.wl : p.wr;
      const up = p.express && p.elev > 3;                     // beside the viaduct: the towers it weaves between
      const u0 = wall + (up ? 3.4 : 2.9);
      let depth = 10 + rng() * 14;
      // the footprint must clear every road: the one beside it and any other street behind or across
      const fits = (dep) => {
        for (const [ds, du] of [[-0.5, 0], [0.5, 0], [-0.5, 1], [0.5, 1], [0, 1], [0, 0.5]]) {
          const [x, z] = at(sm + ds * lotW, side * (u0 + du * dep));
          if (!clearAt(x, z, du === 0 ? 2.2 : 3.0)) return false;
        }
        return true;
      };
      if (!fits(depth)) { depth = 7; if (!fits(depth)) continue; }
      // now and then a coin parking instead of a building: the bays and their cars, the lit P sign, a low block
      // behind (a hash of the lot's place decides, so the rest of the street is as it was)
      const hp = Math.sin(sm * 12.9898 + side * 78.233 + (w.seed % 1000) * 0.113) * 43758.5453;
      if (!up && w.pools.parked && parkSign && lotW >= 8 && lotW <= 16 && depth >= 12.5 && hp - Math.floor(hp) < 0.075) {
        coinParking(w, ch, { sm, side, lotW, depth, u0, p, at, rng, clutter, signs, housings, glows, D, parkSign });
        continue;
      }
      const r = rng();
      let H = r < 0.55 ? 9 + rng() * 14 : r < 0.88 ? 22 + rng() * 22 : 44 + rng() * 40;
      if (up) H = Math.max(H, p.elev + 10 + rng() * 26);
      const [cx, cz] = at(sm, side * (u0 + depth / 2));
      const gy = g.height(cx, cz) - 0.3;
      // turned by the heading plus a quarter, the unit box's x runs along the road and its z across it
      _q.setFromAxisAngle(_up, p.h + Math.PI / 2);
      _s.set(lotW * 0.985, H + 0.3, depth);
      _m4.compose(_v.set(cx, gy + (H + 0.3) / 2, cz), _q, _s);
      w.pools.bldg.add(own, _m4, FACADES[Math.floor(rng() * FACADES.length)]);

      const lx = Math.cos(p.h) * side, lz = -Math.sin(p.h) * side;     // toward the building from the road
      const fx = Math.sin(p.h), fz = Math.cos(p.h);                     // along the road
      const [frontX, frontZ] = at(sm, side * u0);
      const fy = g.height(frontX, frontZ);
      // a vertical sign standing out from the front at one end of the lot, faces along the street
      let vEdge = 0;
      if (rng() < 0.72 && H > 8) {
        const cell = vSigns[Math.floor(rng() * vSigns.length)];
        const scale = Math.min(1, (H - 4.2) / cell.h);
        const sw = cell.w * scale, sh = cell.h * scale;
        const edge = (rng() < 0.5 ? -1 : 1) * (lotW * 0.5 - 0.7);
        vEdge = Math.sign(edge);
        const bx = frontX + fx * edge, bz = frontZ + fz * edge;
        const yb = Math.max(fy + 3.4 + rng() * Math.max(0, H - 4.2 - sh - 3.4) * 0.5, up ? p.y - 1 + rng() * 3 : -1e9), yt = yb + sh;
        const out0 = -0.15, out1 = -0.15 - sw;                           // from the facade out over the pavement
        const P = (u, y, d) => [bx + lx * u + fx * d, y, bz + lz * u + fz * d];
        // (on the left of the road the sign's outer end is on a driver's right, so the cell is mirrored to read)
        signQuad(signs, P(out1, yb, -0.14), P(out0, yb, -0.14), P(out0, yt, -0.14), P(out1, yt, -0.14), cell, side > 0);
        signQuad(signs, P(out0, yb, 0.14), P(out1, yb, 0.14), P(out1, yt, 0.14), P(out0, yt, 0.14), cell, side > 0);
        // the housing: across the road (the sign's width) by the sign's height, thin along the road
        const hb = new THREE.BoxGeometry(sw + 0.12, sh + 0.18, 0.24);
        hb.rotateY(p.h); hb.translate(bx + lx * (out0 + out1) / 2, (yb + yt) / 2, bz + lz * (out0 + out1) / 2);
        housings.push(hb);
        const gx = bx - lx * (1.2 + sw), gz = bz - lz * (1.2 + sw);
        glows.push([gx, gz, fx, fz, 7, 7, cell.colour]);
        // on the road, the sign's reflection: a streak down the asphalt toward the car coming up it
        const [rx, rz] = at(sm + edge - 5, side * (wall - 1.8 - rng() * 1.5));
        streaks.push([rx, rz, fx, fz, 1.6 + sw * 0.6, 9 + sh * 0.6, cell.colour]);
        if (rng() < 0.5) w.lamps.push({ x: gx, y: yb + 1.2, z: gz, c: ch.c, color: cell.colour, power: 110 });
      }
      // a lit sign over the shop front, facing the road
      let hTop = 0;
      if (rng() < 0.55) {
        const cell = hSigns[Math.floor(rng() * hSigns.length)];
        const sw = Math.min(lotW - 1.2, cell.w), sh = cell.h * (sw / cell.w);
        const yb = fy + 3.1 + rng() * 0.8, yt = yb + sh;
        hTop = yt - fy;
        const P = (d, y) => [frontX - lx * 0.06 + fx * d, y, frontZ - lz * 0.06 + fz * d];
        // seen from the road: left to right is against the road's direction on the left side
        if (side > 0) signQuad(signs, P(-sw / 2, yb), P(sw / 2, yb), P(sw / 2, yt), P(-sw / 2, yt), cell, false);
        else signQuad(signs, P(sw / 2, yb), P(-sw / 2, yb), P(-sw / 2, yt), P(sw / 2, yt), cell, false);
        const [gx, gz] = at(sm, side * (wall + 0.8));
        glows.push([gx, gz, fx, fz, 6, Math.max(6, sw + 3), cell.colour]);
      }
      // the building's clutter: air conditioners, pipes, fire escapes, balconies, roof tanks, awnings, lanterns
      // its screens (a big one on the upper floors, a vertical LED tower, a billboard on the roof) come first: the
      // clutter keeps clear of them
      const clear = detailLot(w, D, { s: sm, side, W: lotW * 0.985, D: depth, H, up, x: frontX, z: frontZ, y: fy, fx, fz, lx, lz, wall, vEdge, hTop });
      if (w.propMats) lotProps(THREE, { x: frontX, z: frontZ, y: fy, fx, fz, lx, lz, width: lotW * 0.985, depth, height: H, shop: !up, clear }, rng, clutter);
      // (a lot's clutter is half a millisecond: the chunk is built across frames, a few lots at a time)
      if (++nLots % 4 === 0) yield;
      // vending machines on the pavement now and then
      if (rng() < 0.2 && w.pools.vending) {
        const [vx, vz] = at(sm + (rng() - 0.5) * lotW * 0.5, side * (u0 - 0.45));
        w._put('vending', own, vx, g.height(vx, vz), vz, p.h + (side > 0 ? -Math.PI / 2 : Math.PI / 2));
      }
    }
  }
  // the wires and their poles, the shopping street, the pavement, the screens
  yield* detailChunk(w, ch, D);

  // the pavement's clutter, in 30 m stretches on both sides (not under the viaduct, not in a corner's inside)
  yield;
  if (w.propMats) for (const side of [1, -1]) for (let s = s0; s < s1 - 4; s += 30) {
    const p = t.sample(s);
    if (p.tunnel || (p.express && p.elev > 1) || t.markerAt(p.s, side) || t.padAt(p.s, side)) continue;
    const wall = side > 0 ? p.wl : p.wr;
    const lx = Math.cos(p.h) * side, lz = -Math.sin(p.h) * side, fx = Math.sin(p.h), fz = Math.cos(p.h);
    const x = p.x + lx * (wall + 0.15), z = p.z + lz * (wall + 0.15);
    // (off every road by the thing's own size: at a square corner the stretch runs on straight into the street across)
    const clear = (qx, qz, r) => { g.sample(qx, qz, 2.2, probe); return probe.edge > 0.15 + r && !probe.tunnel; };
    streetProps(THREE, { x, z, y: g.height(x, z), fx, fz, lx, lz, length: Math.min(30, s1 - s), heightAt: (qx, qz) => g.height(qx, qz), clear }, rng, clutter);
  }
  for (const [bx, by, bz] of clutter.__bollards || []) w._put('bollard', own, bx, by, bz, rng() * 6.28);
  for (const [name, x, y, z, ry, sc, sx, colour] of clutter.__items || []) w._put(name, own, x, y, z, ry, sc, sx, colour);
  // the expressway: deck, piers, barriers and their lit strips, and a gantry at the top of the ramp
  yield;
  viaduct(w, ch);

  // square corners: zebra crossings either side of the turn, STOP painted before it, and a signal on the outside
  // (a corner already under way where the chunk begins belongs to the chunk before; one that runs on past the
  // chunk's end is followed into the next, on final road only)
  let i = ch.i0;
  while (i < ch.i1 && Math.abs(pts[i].k) >= 1 / 45) i++;
  while (i < ch.i1) {
    const p = pts[i];
    if (Math.abs(p.k) < 1 / 45 || p.tunnel) { i++; continue; }
    let j = i; while (j < t.nFinal - 1 && j < ch.i1 + 90 && Math.abs(pts[j].k) >= 1 / 45) j++;
    const turn = Math.sign(p.k), outside = -turn;
    const sa = p.s - 7, sb = pts[Math.min(j, pts.length - 1)].s + 7;
    for (const sz of [sa, sb]) {
      if (sz < 4 || t.nearTunnel(sz, 10)) continue;
      const q = t.sample(sz);
      zebras.push([q]);
    }
    if (sa - 9 > 8 && !t.nearTunnel(sa - 9, 12) && w._roadText) { const m = w._roadText(ch.group, sa - 13, t.half * 0.5, '止まれ'); if (m) ch.own.add(m.geometry); }
    // the signal: a pole on the outside of the approach, an arm over the road, the lamps facing the car
    {
      const q = t.sample(sa - 2);
      const wall = outside > 0 ? q.wl : q.wr;
      const lx = Math.cos(q.h) * outside, lz = -Math.sin(q.h) * outside, fx = Math.sin(q.h), fz = Math.cos(q.h);
      const px = q.x + lx * (wall + 0.9), pz = q.z + lz * (wall + 0.9), py = g.height(px, pz);
      const pole = new THREE.CylinderGeometry(0.11, 0.13, 6.2, 10); pole.translate(px, py + 3.1, pz); poles.push(pole);
      w._reg(own, { name: 'signal', kind: 'solid', x: px, y: py, z: pz, r: 0.16, alive: true });
      const armLen = wall + 0.9 - 2.2;
      const arm = new THREE.CylinderGeometry(0.07, 0.07, armLen, 8); arm.rotateZ(Math.PI / 2); arm.rotateY(q.h);
      arm.translate(px - lx * armLen / 2, py + 5.8, pz - lz * armLen / 2); poles.push(arm);
      const hx = px - lx * armLen, hz = pz - lz * armLen;
      const box = new THREE.BoxGeometry(1.25, 0.42, 0.3); box.rotateY(q.h); box.translate(hx - fx * 0.05, py + 5.55, hz - fz * 0.05); boxes.push(box);
      const lit = rng() < 0.62 ? 0 : rng() < 0.5 ? 1 : 2;
      // left to right as the driver sees it (their left is the road's left): blue-green, amber, red
      const Lx = Math.cos(q.h), Lz = -Math.sin(q.h);
      [0.4, 0, -0.4].forEach((d, k) => {
        const disc = new THREE.CircleGeometry(0.15, 16); disc.rotateY(q.h + Math.PI);
        disc.translate(hx - fx * 0.21 + Lx * d, py + 5.55, hz - fz * 0.21 + Lz * d);
        if (k === lit) lampsOn[k].push(disc); else lampsOff.push(disc);
      });
    }
    i = j + 1;
  }

  const addMesh = (geos, mat, name, shadow = false) => {
    if (!geos.length) return;
    const geo = merge(geos); ch.own.add(geo);
    const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = shadow; m.receiveShadow = true;
    ch.group.add(m);
  };
  for (const [name, list] of Object.entries(clutter)) if (!name.startsWith('__') && list.length && w.propMats[name]) addMesh(list, w.propMats[name], 'clutter ' + name, name === 'props' || name === 'metal');
  addMesh(signs, w.neonMat, 'neon signs');
  addMesh(housings, w.neonHousingMat, 'sign housings');
  addMesh(poles, w.signalPoleMat, 'signal poles', true);
  addMesh(boxes, w.signalBoxMat, 'signal boxes', true);
  lampsOn.forEach((l, k) => addMesh(l, w.signalLit[k], 'signal lamp'));
  addMesh(lampsOff, w.signalDim, 'signal lamps off');
  if (glows.length) ch.group.add(drape(w, ch, glows, w.neonGlowMat, 0.06));
  if (streaks.length) ch.group.add(drape(w, ch, streaks, w.streakMat, 0.04, true));
  // the crossings: a strip of zebra paint across the road, 4 m along it, on the ribbon itself
  if (zebras.length) {
    const pos = [], uv = [], idx = [];
    for (const [q] of zebras) {
      const base = pos.length / 3, NS = 2, NU = 8, L = 4.2;
      const width = 2 * (t.half - 0.2);
      for (let jj = 0; jj <= NS; jj++) {
        const qq = t.sample(q.s - L / 2 + (jj / NS) * L), lx = Math.cos(qq.h), lz = -Math.sin(qq.h);
        for (let ii = 0; ii <= NU; ii++) {
          const u = (ii / NU - 0.5) * width;
          pos.push(qq.x + lx * u, qq.y + 0.028, qq.z + lz * u); uv.push((u + width / 2) / 0.9, jj / NS);
        }
      }
      for (let jj = 0; jj < NS; jj++) for (let ii = 0; ii < NU; ii++) {
        const a = base + jj * (NU + 1) + ii, b = a + 1, c = a + NU + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingSphere();
    ch.own.add(geo);
    const m = new THREE.Mesh(geo, w.zebraMat); m.renderOrder = 1; m.receiveShadow = true; m.name = 'crossings';
    ch.group.add(m);
  }
}

void lerp;

/**
 * A coin parking on a lot: its bays painted across it with their wheel stops (cityprops.js parkingProps), cars in
 * most of them (reversed in, as most are in Japan, now and then nose in), the blue P sign on a pole at the front
 * corner facing along the street, a lamp over the bays, and a low block of shops and flats behind the back wall.
 */
function coinParking(w, ch, o) {
  const { sm, side, lotW, depth, u0, p, at, rng, clutter, signs, housings, glows, D, parkSign } = o;
  const g = w.ground, own = ch.c * 2;
  const lx = Math.cos(p.h) * side, lz = -Math.sin(p.h) * side, fx = Math.sin(p.h), fz = Math.cos(p.h);
  const [frontX, frontZ] = at(sm, side * u0);
  const fy = g.height(frontX, frontZ);
  const W = lotW * 0.985;
  const res = parkingProps(THREE, { x: frontX, z: frontZ, y: fy, fx, fz, lx, lz, width: W, depth }, rng, clutter);
  // the cars: lot metres (x along the front, z negative into the lot) to the world
  const L = (x, z) => [frontX + fx * x - lx * z, frontZ + fz * x - lz * z];
  for (const [bx, bz] of res.bays) {
    if (rng() < 0.18) continue;
    const [x, z] = L(bx + (rng() - 0.5) * 0.25, bz + (rng() - 0.5) * 0.3);
    const toRoad = rng() < 0.72;
    parkCar(w, own, x, g.height(x, z) + 0.01, z, p.h + (toRoad ? -side : side) * Math.PI / 2 + (rng() - 0.5) * 0.06, rng);
  }
  // the P sign: a pole at the front corner, the sign along the street over the lot's edge, both faces lit
  {
    const s = res.sign ? Math.sign((res.sign[0] - frontX) * fx + (res.sign[2] - frontZ) * fz) || 1 : 1;
    const ex = s * (W / 2 - 0.25);
    const [px, pz] = L(ex, -0.15);
    const pole = new THREE.CylinderGeometry(0.07, 0.08, 4.4, 8); pole.translate(px, fy + 2.2, pz); housings.push(pole);
    const sw = parkSign.w * 0.95, sh = parkSign.h * 0.95, yb = fy + 3.0, yt = yb + sh;
    const Q = (u, y, d) => [px + lx * u + fx * d, y, pz + lz * u + fz * d];
    const u1 = 0.1, u2 = 0.1 + sw;
    signQuad(signs, Q(u2, yb, -0.09), Q(u1, yb, -0.09), Q(u1, yt, -0.09), Q(u2, yt, -0.09), parkSign, side < 0);
    signQuad(signs, Q(u1, yb, 0.09), Q(u2, yb, 0.09), Q(u2, yt, 0.09), Q(u1, yt, 0.09), parkSign, side < 0);
    const hb = new THREE.BoxGeometry(sw + 0.1, sh + 0.12, 0.14); hb.rotateY(p.h); hb.translate(px + lx * (u1 + u2) / 2, (yb + yt) / 2, pz + lz * (u1 + u2) / 2); housings.push(hb);
    glows.push([px + lx * 1.2, pz + lz * 1.2, fx, fz, 5, 5, parkSign.colour]);
  }
  // the lamp over the bays: its head lit, its light on the bays
  if (res.lamp) {
    D.lamp([res.lamp[0], res.lamp[1] + 0.13, res.lamp[2]], fx, fz, 0.44, 0.24);
    const [gx, gz] = L(0, -res.bayD / 2 - 0.6);
    glows.push([gx, gz, fx, fz, Math.min(W, 9), 6, 0xdfe8ff]);
    w.lamps.push({ x: res.lamp[0], y: res.lamp[1], z: res.lamp[2], c: ch.c, color: 0xe2ecff, power: 70 });
  }
  // a vending machine at the other front corner, now and then
  if (rng() < 0.5 && w.pools.vending) {
    const s = res.sign ? -Math.sign((res.sign[0] - frontX) * fx + (res.sign[2] - frontZ) * fz) || 1 : 1;
    const [vx, vz] = L(s * (W / 2 - 0.7), 0.45);
    w._put('vending', own, vx, g.height(vx, vz), vz, p.h + (side > 0 ? -Math.PI / 2 : Math.PI / 2));
  }
  // the low block behind the back wall
  const back = -res.back + 0.45, dep = depth - back;
  if (dep >= 4.5) {
    const H = 8 + rng() * 9;
    const [cx, cz] = at(sm, side * (u0 + back + dep / 2));
    _q.setFromAxisAngle(_up, p.h + Math.PI / 2);
    _s.set(W, H + 0.3, dep);
    _m4.compose(_v.set(cx, g.height(cx, cz) - 0.3 + (H + 0.3) / 2, cz), _q, _s);
    w.pools.bldg.add(own, _m4, FACADES[Math.floor(rng() * FACADES.length)]);
    const [bx, bz] = at(sm, side * (u0 + back));
    if (w.propMats) lotProps(THREE, { x: bx, z: bz, y: g.height(bx, bz), fx, fz, lx, lz, width: W, depth: dep, height: H, shop: true }, rng, clutter);
  }
  w.detail.stats.parkings = (w.detail.stats.parkings || 0) + 1;
}

/**
 * The far city: a ring of towers round the camera with red lights blinking on the tallest roofs, and Tokyo Tower
 * three kilometres off in a fixed direction, lit orange. The group travels with the camera like the mountain's
 * skyline does.
 */
export function citySkyBuild(w, L) {
  const g = new THREE.Group(); g.name = 'city sky';
  if (!L) return g;
  const ring = L.citySkyline(THREE, { radius: 2600, count: 180, seed: 7 });
  g.add(ring);
  const tower = L.tokyoTower(THREE);
  const az = 2.3;
  tower.position.set(Math.sin(az) * 3000, -6, Math.cos(az) * 3000);
  tower.scale.setScalar(1.35);                                   // a little larger than life, so it reads from the street
  g.add(tower);
  // Tokyo Skytree, further off the other way, its lattice lit pale blue
  let skytree = null;
  if (L.tokyoSkytree) {
    skytree = L.tokyoSkytree(THREE);
    const az2 = -0.75;
    skytree.position.set(Math.sin(az2) * 3300, -10, Math.cos(az2) * 3300);
    skytree.scale.setScalar(1.3);                                // (larger than life too: it stands over the far towers)
    g.add(skytree);
  }
  g.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine || o.isLineSegments) { o.frustumCulled = false; o.castShadow = false; o.receiveShadow = false; } });
  g.userData = { aviation: ring.userData && ring.userData.aviation, tower, skytree };
  return g;
}

/** The Shuto's green gantry sign: the route, and two exits with their distances. */
function shutoSignMaterial(w) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 320;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#0d6b44'; ctx.fillRect(0, 0, 1024, 320);
  ctx.strokeStyle = '#f2f4f2'; ctx.lineWidth = 10; ctx.strokeRect(14, 14, 996, 292);
  const jp = '"Dela Gothic One", "Noto Serif JP", "Yu Gothic", "Hiragino Sans", sans-serif';
  const ok = w.glyphs ? w.glyphs('44px ' + jp, '首都高速環状線銀座新宿') : false;
  ctx.fillStyle = '#f2f4f2'; ctx.textBaseline = 'middle';
  // the route shield: a white rounded square with C1 in green
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(46, 52, 150, 108, 16); else ctx.rect(46, 52, 150, 108); ctx.fill();
  ctx.fillStyle = '#0d6b44'; ctx.textAlign = 'center'; ctx.font = '700 84px Rajdhani, sans-serif'; ctx.fillText('C1', 121, 110);
  ctx.fillStyle = '#f2f4f2'; ctx.textAlign = 'left';
  ctx.font = ok ? '62px ' + jp : '700 58px Rajdhani, sans-serif'; ctx.fillText(ok ? '首都高速 環状線' : 'SHUTO EXPWY', 226, 92);
  ctx.font = '700 30px Rajdhani, sans-serif'; ctx.fillText('SHUTO EXPRESSWAY  INNER CIRCULAR', 230, 150);
  // the exits
  const row = (y, kanji, romaji, km, arrow) => {
    ctx.font = ok ? '56px ' + jp : '700 50px Rajdhani, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(ok ? kanji : romaji, 64, y);
    if (ok) { ctx.font = '700 30px Rajdhani, sans-serif'; ctx.fillText(romaji, 64 + ctx.measureText('xxxxxxxx').width * 0 + 190, y + 4); }
    ctx.textAlign = 'right'; ctx.font = '700 54px Rajdhani, sans-serif'; ctx.fillText(km, 900, y); ctx.font = '700 30px Rajdhani, sans-serif'; ctx.fillText('km', 960, y + 6);
    ctx.save(); ctx.translate(990, y); ctx.rotate(arrow); ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(12, 4); ctx.lineTo(4, 4); ctx.lineTo(4, 16); ctx.lineTo(-4, 16); ctx.lineTo(-4, 4); ctx.lineTo(-12, 4); ctx.closePath(); ctx.fill(); ctx.restore();
  };
  ctx.fillStyle = 'rgba(242,244,242,.35)'; ctx.fillRect(40, 188, 944, 3); ctx.fillStyle = '#f2f4f2';
  row(228, '銀座', 'Ginza', '2', 0);
  row(282, '新宿', 'Shinjuku', '7', Math.PI / 4);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.45 });
}

/**
 * The expressway through a chunk: under the road ribbon a concrete deck whose sides run down to the street while
 * it is low (a solid ramp) and stop at a girder's depth once it is up (with a pier every 30 m), a Jersey barrier
 * along each edge with a lit strip on its inside face, and a green gantry where the ramp reaches the top.
 */
function viaduct(w, ch) {
  const t = w.track, g = w.ground, pts = t.pts, last = Math.min(ch.i1 + 1, t.nFinal - 1);
  const deck = { pos: [], nor: [], idx: [] }, bar = { pos: [], nor: [], idx: [] }, strip = { pos: [], nor: [], idx: [] };
  const piers = [], gantry = [], signs = [];
  // a strip of quads along a run: rows[k] is the k-th sample's list of points; faces join point j to j+1
  const loft = (M, rows, closeRows) => {
    const n = rows.length, m = rows[0].length, base = M.pos.length / 3;
    for (const r of rows) for (const q of r) { M.pos.push(q[0], q[1], q[2]); M.nor.push(0, 1, 0); }
    for (let k = 0; k < n - 1; k++) for (let j = 0; j < (closeRows ? m : m - 1); j++) {
      const j2 = (j + 1) % m, a = base + k * m + j, b = base + k * m + j2, c = a + m, d = b + m;
      M.idx.push(a, c, b, b, c, d);
    }
  };
  let run = [];
  const flush = () => {
    if (run.length < 2) { run = []; return; }
    const deckRows = [], barL = [], barR = [], stL = [], stR = [];
    for (const p of run) {
      const lx = Math.cos(p.h), lz = -Math.sin(p.h), tb = Math.tan(p.bank || 0);
      const Y = (u, dy = 0) => p.y - u * tb + dy;
      const P = (u, y) => [p.x + lx * u, y, p.z + lz * u];
      const uL = p.wl + 0.55, uR = -(p.wr + 0.55);
      const low = p.elev < 5;
      const gL = g.height(p.x + lx * uL, p.z + lz * uL), gR = g.height(p.x + lx * uR, p.z + lz * uR);
      const bL = low ? Math.min(Y(uL) - 0.3, gL - 0.3) : Y(uL, -1.8), bR = low ? Math.min(Y(uR) - 0.3, gR - 0.3) : Y(uR, -1.8);
      // the deck's cross-section, round from the left top edge, down, across the underside, up the right
      deckRows.push([P(uL, Y(uL, -0.05)), P(uL, bL), P(uR, bR), P(uR, Y(uR, -0.05))]);
      // the barriers: inner foot at the road's edge, a bevel, the top, the outer face
      const wl = p.wl, wr = p.wr;
      barL.push([P(wl, Y(wl, -0.02)), P(wl + 0.07, Y(wl, 0.32)), P(wl + 0.3, Y(wl, 1.0)), P(uL, Y(wl, 1.0)), P(uL, Y(uL, -0.05))]);
      barR.push([P(-wr, Y(-wr, -0.02)), P(-wr - 0.07, Y(-wr, 0.32)), P(-wr - 0.3, Y(-wr, 1.0)), P(uR, Y(-wr, 1.0)), P(uR, Y(uR, -0.05))]);
      stL.push([P(wl + 0.2, Y(wl, 0.66)), P(wl + 0.23, Y(wl, 0.76))]);
      stR.push([P(-wr - 0.2, Y(-wr, 0.66)), P(-wr - 0.23, Y(-wr, 0.76))]);
      // a pier every 30 m while the deck is up
      if (!low && ((p.s % 30) + 30) % 30 < t.step) {
        const gy = g.height(p.x, p.z), top = Math.min(bL, bR) - 0.05, hgt = top - gy;
        if (hgt > 1) {
          const col = new THREE.BoxGeometry(1.5, hgt, 1.1); col.rotateY(p.h); col.translate(p.x, gy + hgt / 2, p.z); piers.push(col);
          const cap = new THREE.BoxGeometry(uL - uR - 0.6, 0.9, 1.4); cap.rotateY(p.h); cap.translate(p.x + lx * (uL + uR) / 2, top - 0.45, p.z + lz * (uL + uR) / 2); piers.push(cap);
        }
      }
      // the gantry, once, where the ramp tops out
      if (!ch.gantried && p.elev > 9 && p.elev < 12 && Math.abs(p.k) < 0.004) {
        ch.gantried = true;
        const H = 6.4, yl = Y(p.wl + 0.3, 1.0), yr = Y(-p.wr - 0.3, 1.0);
        for (const [u, yb] of [[p.wl + 0.3, yl], [-p.wr - 0.3, yr]]) { const c = new THREE.BoxGeometry(0.34, H, 0.34); c.translate(p.x + lx * u, yb + H / 2, p.z + lz * u); gantry.push(c); }
        const span = p.wl + p.wr + 0.6, ym = Y(0, 0) + H + 0.7;
        const beam = new THREE.BoxGeometry(span, 0.4, 0.4); beam.rotateY(p.h); beam.translate(p.x + lx * (p.wl - p.wr) / 2, ym + 0.4, p.z + lz * (p.wl - p.wr) / 2); gantry.push(beam);
        const back = new THREE.BoxGeometry(6.4, 2.0, 0.12); back.rotateY(p.h); back.translate(p.x, ym - 0.7, p.z); gantry.push(back);
        const face = new THREE.PlaneGeometry(6.3, 1.95); face.rotateY(p.h + Math.PI);
        face.translate(p.x - Math.sin(p.h) * 0.07, ym - 0.7, p.z - Math.cos(p.h) * 0.07); signs.push(face);
      }
    }
    loft(deck, deckRows, false);
    loft(bar, barL, false); loft(bar, barR, false);
    loft(strip, stL, false); loft(strip, stR, false);
    run = [];
  };
  for (let i = ch.i0; i <= last; i++) { const p = pts[i]; if (p.express && p.elev > 0.25) run.push(p); else flush(); }
  flush();
  const mesh = (M, mat, name, shadow) => {
    if (!M.idx.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(M.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(M.pos.length / 3 * 2), 2));
    geo.setIndex(M.idx); geo.computeVertexNormals(); geo.computeBoundingSphere();
    ch.own.add(geo);
    const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = shadow; m.receiveShadow = true;
    // (the lofts wind either way round: draw both faces)
    mat.side = THREE.DoubleSide;
    ch.group.add(m);
  };
  mesh(deck, w.deckMat, 'viaduct deck', true);
  mesh(bar, w.barrierMat, 'viaduct barriers', true);
  mesh(strip, w.stripMat, 'viaduct strips', false);
  const add = (list, mat, name) => {
    if (!list.length) return;
    const geo = merge(list); ch.own.add(geo);
    const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = true; m.receiveShadow = true; ch.group.add(m);
  };
  add(piers, w.deckMat, 'viaduct piers');
  add(gantry, w.gantryMat, 'gantry');
  add(signs, w.shutoMat, 'gantry sign');
}

/** Blink the aviation lights (a slow red pulse, as on a real skyline). */
export function citySkyUpdate(w, t) {
  const a = w.citySky && w.citySky.userData.aviation;
  if (a && a.material) a.material.opacity = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2.1)) ** 2;
  const sk = w.citySky && w.citySky.userData.skytree;
  if (sk && sk.userData.aviation) sk.userData.aviation.material.opacity = 0.3 + 0.7 * Math.max(0, Math.sin(t * 1.7 + 1.1)) ** 2;
  // the clock the televisions, the arcade screens and the street's animated signs run on (kept small for precision)
  const tt = t % 3600;
  if (w.bldgMat && w.bldgMat.userData.uTime) w.bldgMat.userData.uTime.value = tt;
  detailUpdate(w, tt);
}
