/**
 * The world: the road ribbon, the mountainside, the guardrails, the trees and every roadside object,
 * streamed in 120 m chunks ahead of the car and dropped behind it.
 *
 * Draw-call discipline, because the jam gate counts them: every chunk bakes its static props into one
 * mesh per material (bakeStatic, per chunk so frustum culling still works), trees are InstancedMesh per
 * chunk, and the road, terrain and rail are one mesh each. A chunk is about twenty draws.
 *
 * Nothing here is a file. The road markings and the ground grain are canvases drawn at load.
 */
import * as THREE from 'three';
import { ASSET, bakeStatic } from '../assetlib.js';
import { surface } from '../surfaces.js';
import { ROAD, PAL, mulberry32, clamp, lerp, smoothstep } from './config.js';

const ASSETS = {
  cedar: './assets/cedar_tree.js', maple: './assets/maple_tree.js', boulder: './assets/boulder.js',
  post: './assets/guardrail_post.js', pole: './assets/snow_pole.js', lamp: './assets/lamp_post.js',
  mirror: './assets/traffic_mirror.js', chevron: './assets/chevron_sign.js', torii: './assets/torii_gate.js',
  lantern: './assets/stone_lantern.js', portal: './assets/tunnel_portal.js', hut: './assets/mountain_hut.js',
  vending: './assets/vending_machine.js', shrub: './assets/roadside_shrub.js', broadleaf: './assets/broadleaf_tree.js',
};
const SURFACED = new Set(['boulder', 'post', 'pole', 'lamp', 'mirror', 'chevron', 'torii', 'lantern', 'portal', 'hut', 'vending']);
const TUNNEL_LEN = 96;
const HALF = ROAD.halfWidth, RAIL = ROAD.railOffset;

/** Road texture: asphalt with grain, edge lines, a dashed centre line and gravel shoulders. u across, v along. */
function roadTextures() {
  const W = 256, H = 512;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const rv = document.createElement('canvas'); rv.width = W; rv.height = H;
  const rctx = rv.getContext('2d');
  const img = ctx.createImageData(W, H), rimg = rctx.createImageData(W, H);
  const asphalt = [0x3a, 0x3b, 0x40], gravel = [0x8d, 0x87, 0x7b], line = [0xe8, 0xe4, 0xda];
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const uOf = (x) => ((x + 0.5) / W) * 2 * RAIL - RAIL;       // metres from the centreline
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = uOf(x), au = Math.abs(u);
    const vm = (y / H) * 12;                                     // metres along, 12 m per tile
    let c, rough;
    const grain = (rnd() - 0.5) * 22;
    if (au > HALF) { c = gravel.map((v) => v + grain * 1.6); rough = 0.96; }
    else {
      const wear = 1 - 0.07 * Math.exp(-Math.pow((au - 1.55) / 0.5, 2));       // darker tyre tracks
      c = asphalt.map((v) => (v + grain) * wear);
      rough = 0.84 + (rnd() - 0.5) * 0.12 - 0.05 * (1 - wear) * 6;
      const onEdge = Math.abs(au - 3.35) < 0.075;
      const onCentre = au < 0.06 && (vm % 12) < 4.2;
      if (onEdge || onCentre) { const k = onCentre ? 0.92 : 1; c = line.map((v) => v * k + grain * 0.5); rough = 0.62; }
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
  return { map, roughnessMap };
}

export class World {
  constructor(scene, track, quality) {
    this.scene = scene; this.track = track; this.q = quality;
    this.chunks = new Map();
    this.templates = {};       // name -> loaded instance used as a template for clones and instancing
    this.lamps = [];           // world positions of lamp heads, for the night light pool
    this.tunnels = [];         // { s0, s1 }
    this.layouts = [];         // set pieces already planned: marker -> plan
    this.root = new THREE.Group(); scene.add(this.root);
    this.far = null;
    this.stats = { draws: 0 };
    this._plannedMarkers = 0;
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
    const rt = roadTextures();
    this.roadMat = new THREE.MeshStandardMaterial({ map: rt.map, roughnessMap: rt.roughnessMap, roughness: 1, metalness: 0.0, color: 0xffffff });
    const g = surface(THREE, 'ground', 256);
    this.groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: g.map, roughnessMap: g.roughnessMap, normalMap: g.normalMap,
      normalScale: new THREE.Vector2(0.55, 0.55), roughness: 1, metalness: 0, color: 0xffffff });
    this.railMat = new THREE.MeshStandardMaterial({ color: PAL.galvanised, roughness: 0.42, metalness: 0.65, side: THREE.DoubleSide });
    this.tunnelMat = new THREE.MeshStandardMaterial({ color: 0x4a4a50, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
    this.tunnelLampMat = new THREE.MeshStandardMaterial({ color: 0xffe9c0, emissive: 0xffd28a, emissiveIntensity: 2.2, roughness: 0.5 });
    this.buildFar();
  }

  /** Every marker becomes a plan once, when the road reaches it. */
  planMarkers() {
    const t = this.track;
    for (; this._plannedMarkers < t.markers.length; this._plannedMarkers++) {
      const m = t.markers[this._plannedMarkers];
      if (m.kind === 'tunnel') {
        this.tunnels.push({ s0: m.s, s1: m.s + TUNNEL_LEN });
      } else if (m.kind === 'shrine') {
        t.terraces.push({ s0: m.s - 6, s1: m.s + 30, side: m.side, u0: RAIL + 1.2, u1: RAIL + 16, h: 0.55, mountain: true });
      } else if (m.kind === 'hut' || m.kind === 'vista') {
        t.terraces.push({ s0: m.s - 4, s1: m.s + 34, side: -m.side, u0: RAIL - 0.3, u1: RAIL + 10, h: -0.02, mountain: false, layby: true });
      }
    }
  }

  inTunnel(s) { for (const tn of this.tunnels) if (s >= tn.s0 && s <= tn.s1) return tn; return null; }
  nearTunnel(s, pad = 8) { for (const tn of this.tunnels) if (s >= tn.s0 - pad && s <= tn.s1 + pad) return tn; return null; }

  /** Keep the chunks around distance s built; at most one new chunk per call so a frame never hitches twice. */
  update(s) {
    const ci = Math.floor(s / ROAD.chunkLen);
    const lo = ci - ROAD.behind, hi = ci + ROAD.ahead;
    for (const [k, c] of this.chunks) if (k < lo || k > hi) { this.dropChunk(c); this.chunks.delete(k); }
    for (let i = Math.max(0, lo); i <= hi; i++) if (!this.chunks.has(i)) { this.buildChunk(i); return true; }
    return false;
  }

  /** Build everything the first frame needs, synchronously. */
  prime(s) { for (let i = 0; i < 40 && this.update(s); i++) {} }

  dropChunk(c) {
    this.root.remove(c.group);
    c.group.traverse((o) => {
      if (o.isInstancedMesh) { o.dispose(); }
      else if (o.isMesh && c.own.has(o.geometry)) o.geometry.dispose();
    });
    this.lamps = this.lamps.filter((l) => l.ci !== c.ci);
  }

  buildChunk(ci) {
    const t = this.track;
    const s0 = ci * ROAD.chunkLen, s1 = s0 + ROAD.chunkLen;
    t.ensure(s1 + 600);
    this.planMarkers();
    const i0 = t.index(s0), i1 = t.index(s1);
    const group = new THREE.Group();
    const own = new Set();
    const rng = mulberry32(ROAD.seed + ci * 7919 + 13);
    const c = { ci, s0, s1, group, own };

    // tunnel bookkeeping on the samples themselves: narrower walls, no rails
    for (let i = i0; i <= i1; i++) {
      const p = t.pts[i];
      p.tunnel = !!this.inTunnel(p.s);
      if (p.tunnel) { p.wl = Math.min(p.wl, 3.95); p.wr = Math.min(p.wr, 3.95); }
      const lay = t.terraceAt(p.s);
      if (lay && lay.layby) { if (lay.side > 0) p.wl = Math.max(p.wl, lay.u1 - 0.6); else p.wr = Math.max(p.wr, lay.u1 - 0.6); }
    }

    group.add(this.buildRoad(i0, i1, own));
    group.add(this.buildTerrain(i0, i1, +1, own));
    group.add(this.buildTerrain(i0, i1, -1, own));
    const tube = this.buildTunnel(i0, i1, own); if (tube) group.add(tube);

    // static props, baked per chunk
    const statics = new THREE.Group();
    const place = (name, x, y, z, ry, scale = 1, sx = 1, colour = 0) => {
      const tpl = this.templates[name]; if (!tpl) return null;
      const o = tpl.clone(true);
      o.position.set(x, y, z); o.rotation.y = ry; o.scale.set(scale * sx, scale, scale);
      // a placed (not instanced) maple gets a real coloured material, since a bake has no instance colour
      if (colour) o.traverse((m) => { if (m.isMesh && m.material.name === 'foliage_tinted') m.material = this.mapleMat(colour); });
      statics.add(o);
      return o;
    };
    this.placeRailsAndPoles(i0, i1, group, own, place, rng);
    this.placeProps(i0, i1, s0, s1, place, rng, ci);
    this.placeSetPieces(s0, s1, place, rng, ci);
    statics.updateMatrixWorld(true);
    const baked = bakeStatic(statics);
    baked.traverse((o) => { if (o.isMesh) { own.add(o.geometry); o.castShadow = true; o.receiveShadow = true; } });
    group.add(baked);

    this.placeTrees(i0, i1, s0, s1, group, rng);

    this.root.add(group);
    this.chunks.set(ci, c);
    return c;
  }

  /** One material per maple colour, for baked clones. */
  mapleMat(colour) {
    this._mapleMats = this._mapleMats || new Map();
    let m = this._mapleMats.get(colour);
    if (!m) {
      let base = null;
      this.templates.maple.traverse((o) => { if (!base && o.isMesh && o.material.name === 'foliage_tinted') base = o.material; });
      m = base ? base.clone() : new THREE.MeshStandardMaterial({ flatShading: true });
      m.color.set(colour); m.name = 'foliage_' + colour.toString(16);
      this._mapleMats.set(colour, m);
    }
    return m;
  }

  /** A slice's left unit vector and position, for placing things at lateral offset u. */
  at(p, u, dy = 0) {
    const lx = Math.cos(p.h), lz = -Math.sin(p.h);
    return [p.x + lx * u, p.y + dy, p.z + lz * u];
  }

  buildRoad(i0, i1, own) {
    const t = this.track, pts = t.pts;
    const us = [-RAIL, -HALF, 0, HALF, RAIL];
    const n = i1 - i0 + 1, cols = us.length;
    const pos = new Float32Array(n * cols * 3), uv = new Float32Array(n * cols * 2);
    const idx = [];
    for (let k = 0; k < n; k++) {
      const p = pts[i0 + k];
      const lx = Math.cos(p.h), lz = -Math.sin(p.h);
      for (let j = 0; j < cols; j++) {
        const u = us[j], o = (k * cols + j);
        const dy = Math.abs(u) > HALF ? -0.02 : 0.012 * (1 - Math.abs(u) / HALF);     // a slight crown
        pos[o * 3] = p.x + lx * u; pos[o * 3 + 1] = p.y + dy; pos[o * 3 + 2] = p.z + lz * u;
        uv[o * 2] = (u + RAIL) / (2 * RAIL); uv[o * 2 + 1] = p.s / 12;
      }
      if (k < n - 1) for (let j = 0; j < cols - 1; j++) {
        const a = k * cols + j, b = a + 1, c2 = a + cols, d = c2 + 1;
        idx.push(a, c2, b, b, c2, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    own.add(g);
    const m = new THREE.Mesh(g, this.roadMat);
    m.receiveShadow = true;
    return m;
  }

  /** Terrain on one side (+1 left, -1 right), or over the tunnel where the hill covers the road. */
  buildTerrain(i0, i1, side, own) {
    const t = this.track, pts = t.pts;
    const US = [RAIL, RAIL + 0.7, RAIL + 1.5, RAIL + 2.6, RAIL + 4.2, RAIL + 6.5, RAIL + 9.5, RAIL + 14, RAIL + 20, RAIL + 28, RAIL + 40, RAIL + 56, RAIL + 76, RAIL + 100, RAIL + 130, RAIL + 165];
    const step = 2;                                     // every other sample: 4 m
    const rows = [];
    for (let i = i0; i <= i1; i += step) rows.push(i);
    if (rows[rows.length - 1] !== i1) rows.push(i1);
    const cols = US.length;
    const n = rows.length;
    const pos = new Float32Array(n * cols * 3), col = new Float32Array(n * cols * 3), uv = new Float32Array(n * cols * 2);
    const idx = [];
    const cGrass = new THREE.Color(PAL.dryGrass), cMoss = new THREE.Color(PAL.moss), cStone = new THREE.Color(PAL.stone), cFloor = new THREE.Color(0x3f5533), cDark = new THREE.Color(0x2c3d2a);
    const tmp = new THREE.Color();
    for (let k = 0; k < n; k++) {
      const p = pts[rows[k]];
      const lx = Math.cos(p.h) * side, lz = -Math.sin(p.h) * side;
      const tun = this.nearTunnel(p.s, 10);
      let folded = false, fx = 0, fy = 0, fz = 0;
      for (let j = 0; j < cols; j++) {
        let u = US[j];
        let h;
        if (folded) {
          // past the fold (the inside of a hairpin, say) another stretch of road is nearer: collapse the rest of
          // the row onto the last good vertex so the strip never climbs over the far half of the road
          const o = k * cols + j;
          pos[o * 3] = fx; pos[o * 3 + 1] = fy; pos[o * 3 + 2] = fz;
          uv[o * 2] = fx / 7; uv[o * 2 + 1] = fz / 7;
          col[o * 3] = col[(o - 1) * 3]; col[o * 3 + 1] = col[(o - 1) * 3 + 1]; col[o * 3 + 2] = col[(o - 1) * 3 + 2];
          continue;
        }
        if (j > 0 && u > 6) {
          const wx = p.x + lx * u, wz = p.z + lz * u;
          const n = t.nearestScan(wx, wz, rows[k], 80);
          if (Math.abs(n.i - rows[k]) > 10 && n.d < u - 2) {
            folded = true; const o = k * cols + j - 1;
            fx = pos[o * 3]; fy = pos[o * 3 + 1]; fz = pos[o * 3 + 2];
            j--; continue;
          }
        }
        if (tun) {
          // over the tunnel the whole hill rises; the roof arches over the road itself
          const cap = tun && p.s >= tun.s0 - 2 && p.s <= tun.s1 + 2 ? 9 - (u * u) / 11 : -99;
          h = Math.max(t.profile(u * side, side > 0 ? 1 : -1, p.s), cap);
          if (p.s >= tun.s0 - 2 && p.s <= tun.s1 + 2 && j === 0) u = 0;   // the first column meets at the centreline over the tube
        } else h = t.profile(u * side, p.mount, p.s);
        const o = k * cols + j;
        const x = p.x + lx * u, z = p.z + lz * u, y = p.y + h;
        pos[o * 3] = x; pos[o * 3 + 1] = y; pos[o * 3 + 2] = z;
        uv[o * 2] = x / 7; uv[o * 2 + 1] = z / 7;
        // colour by slope and distance
        const hNext = t.profile((US[Math.min(j + 1, cols - 1)]) * side, p.mount, p.s);
        const du = Math.max(0.3, US[Math.min(j + 1, cols - 1)] - u);
        const slope = Math.abs(hNext - h) / du;
        const nz = t.noise(x * 0.05, z * 0.05) * 0.5 + 0.5;
        tmp.copy(cGrass).lerp(cMoss, clamp(nz * 1.3 - 0.2, 0, 1));
        if (u > RAIL + 12) tmp.lerp(cFloor, smoothstep(RAIL + 12, RAIL + 40, u));
        if (u > RAIL + 60) tmp.lerp(cDark, smoothstep(RAIL + 60, RAIL + 140, u));
        tmp.lerp(cStone, smoothstep(0.55, 1.0, slope));
        if (u < RAIL + 1.6) tmp.lerp(cStone, 0.35);                 // the ditch and the berm are gravelly
        col[o * 3] = tmp.r; col[o * 3 + 1] = tmp.g; col[o * 3 + 2] = tmp.b;
      }
      if (k < n - 1) for (let j = 0; j < cols - 1; j++) {
        const a = k * cols + j, b = a + 1, c2 = a + cols, d = c2 + 1;
        if (side > 0) idx.push(a, c2, b, b, c2, d); else idx.push(a, b, c2, b, d, c2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    own.add(g);
    const m = new THREE.Mesh(g, this.groundMat);
    m.receiveShadow = true; m.castShadow = true;
    return m;
  }

  /** The tunnel lining: a swept arch with ceiling lamps, for the samples of this chunk that are inside one. */
  buildTunnel(i0, i1, own) {
    const t = this.track, pts = t.pts;
    const inside = [];
    for (let i = i0; i <= i1; i++) if (this.nearTunnel(pts[i].s, 1.0)) inside.push(i);
    if (inside.length < 2) return null;
    // cross-section, left to right: wall, arch, wall
    const prof = [];
    for (let k = 0; k <= 12; k++) { const a = Math.PI - (k / 12) * Math.PI; prof.push([Math.cos(a) * 4.05, 2.4 + Math.sin(a) * 4.05]); }
    prof.unshift([-4.05, 0]); prof.push([4.05, 0]);
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
      if (k < n - 1) for (let j = 0; j < cols - 1; j++) {
        const a = k * cols + j, b = a + 1, c2 = a + cols, d = c2 + 1;
        idx.push(a, c2, b, b, c2, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    own.add(g);
    const grp = new THREE.Group();
    const m = new THREE.Mesh(g, this.tunnelMat); m.receiveShadow = true; m.castShadow = true;
    grp.add(m);
    // ceiling lamps every 10 m
    const lampGeo = new THREE.BoxGeometry(0.9, 0.12, 0.3);
    const lamps = [];
    for (let k = 0; k < n; k += 5) {
      const p = pts[inside[k]];
      const l = new THREE.Mesh(lampGeo, this.tunnelLampMat);
      l.position.set(p.x, p.y + 6.05, p.z); l.rotation.y = p.h; l.updateMatrix();
      lamps.push(l);
      this.lamps.push({ x: p.x, y: p.y + 5.6, z: p.z, ci: Math.floor(p.s / ROAD.chunkLen), tunnel: true });
    }
    const lg = new THREE.Group(); lamps.forEach((l) => lg.add(l)); lg.updateMatrixWorld(true);
    const bl = bakeStatic(lg); bl.traverse((o) => { if (o.isMesh) own.add(o.geometry); });
    grp.add(bl);
    return grp;
  }

  /** Guardrail beam on the valley side, posts every sample; snow poles on the mountain side. */
  placeRailsAndPoles(i0, i1, group, own, place, rng) {
    const t = this.track, pts = t.pts;
    for (const side of [1, -1]) {
      let run = [];
      const flush = () => { if (run.length >= 2) group.add(this.buildRail(run, side, own)); run = []; };
      for (let i = i0; i <= i1; i++) {
        const p = pts[i];
        const mountainHere = side > 0 ? (p.mount + 1) * 0.5 : (1 - p.mount) * 0.5;
        const lay = t.terraceAt(p.s);
        const openHere = lay && lay.layby && lay.side === side;
        const w = side > 0 ? p.wl : p.wr;
        const wantRail = !p.tunnel && !openHere && mountainHere < 0.5 && !this.nearTunnel(p.s, 4);
        if (wantRail) {
          run.push({ p, u: w - 0.12 });
          const [x, y, z] = this.at(p, (w - 0.12) * side);
          place('post', x, y, z, p.h + (side > 0 ? -Math.PI / 2 : Math.PI / 2));
        } else flush();
        // snow poles along the mountain side, every 10 samples
        if (!p.tunnel && !openHere && mountainHere >= 0.5 && i % 10 === 3) {
          const [x, y, z] = this.at(p, (w - 0.25) * side);
          place('pole', x, y, z, p.h + (side > 0 ? -Math.PI / 2 : Math.PI / 2));
        }
      }
      flush();
    }
  }

  /** A W-beam swept along a run of samples at lateral offset u on `side`. */
  buildRail(run, side, own) {
    const prof = [[0, 0.45], [0.07, 0.49], [0.07, 0.535], [0, 0.575], [0, 0.615], [0.07, 0.655], [0.07, 0.70], [0, 0.74]];
    const cols = prof.length, n = run.length;
    const pos = new Float32Array(n * cols * 3);
    const idx = [];
    for (let k = 0; k < n; k++) {
      const { p, u } = run[k];
      const lx = Math.cos(p.h) * side, lz = -Math.sin(p.h) * side;
      for (let j = 0; j < cols; j++) {
        const [du, h] = prof[j], o = k * cols + j;
        const uu = u - du;                       // the flanges stand toward the road
        pos[o * 3] = p.x + lx * uu; pos[o * 3 + 1] = p.y + h; pos[o * 3 + 2] = p.z + lz * uu;
      }
      if (k < n - 1) for (let j = 0; j < cols - 1; j++) {
        const a = k * cols + j, b = a + 1, c2 = a + cols, d = c2 + 1;
        idx.push(a, c2, b, b, c2, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    own.add(g);
    const m = new THREE.Mesh(g, this.railMat); m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  /** Boulders at the foot of the cutting, hairpin signage, mirrors, the odd lamp. */
  placeProps(i0, i1, s0, s1, place, rng, ci) {
    const t = this.track, pts = t.pts;
    for (let i = i0; i < i1; i += 6) {
      const p = pts[i];
      if (p.tunnel || this.nearTunnel(p.s, 12) || t.terraceAt(p.s)) continue;
      for (const side of [1, -1]) {
        const mountainHere = side > 0 ? (p.mount + 1) * 0.5 : (1 - p.mount) * 0.5;
        if (mountainHere > 0.5 && rng() < 0.28) {
          const u = RAIL + 2.2 + rng() * 3.5;
          const [x, , z] = this.at(p, u * side);
          if (t.onRoad(x, z, i, 1.0)) continue;
          const y = t.groundAt(x, z, i) - 0.15;
          place('boulder', x, y, z, rng() * Math.PI * 2, 0.55 + rng() * 0.9);
        }
      }
    }
    // hairpins and sweepers: chevrons on the outside of the entry, a mirror at the apex on the inside
    for (const f of t.features) {
      if (f.type !== 'hairpin' && f.type !== 'sweeper') continue;
      const hairpin = f.type === 'hairpin';
      const entry = f.s0 + (hairpin ? 28 : 14);
      const apex = f.s0 + (hairpin ? 60 : 40);
      if (entry >= s0 && entry < s1) {
        const outside = -f.dir;
        for (let k = 0; k < (hairpin ? 3 : 1); k++) {
          const p = t.sample(entry + k * 7);
          if (this.nearTunnel(p.s, 6)) continue;
          const w = outside > 0 ? p.wl : p.wr;
          const [x, y, z] = this.at(p, (w + 0.9) * outside);
          // faces the approaching car; mirrored so the chevrons point into the corner
          place('chevron', x, y, z, p.h + Math.PI, 1, f.dir > 0 ? -1 : 1);
        }
      }
      if (hairpin && apex >= s0 && apex < s1) {
        const p = t.sample(apex);
        const w = f.dir > 0 ? p.wl : p.wr;
        const [x, y, z] = this.at(p, (w + 0.8) * f.dir);
        place('mirror', x, y, z, p.h + Math.PI + f.dir * 0.5);
      }
    }
    // a lamp every so often on a straight, lighting the road at night
    for (const f of t.features) {
      if (f.type !== 'straight' || f.s0 < s0 || f.s0 >= s1) continue;
      if (rng() > 0.5) continue;
      const p = t.sample(f.s0 + 20);
      if (this.nearTunnel(p.s, 10) || t.terraceAt(p.s)) continue;
      const side = p.mount >= 0 ? -1 : 1;                  // on the valley side, arm over the road
      const w = side > 0 ? p.wl : p.wr;
      const [x, y, z] = this.at(p, (w + 0.5) * side);
      place('lamp', x, y, z, p.h + (side > 0 ? -Math.PI / 2 : Math.PI / 2) + Math.PI);
      const arm = 1.3;
      this.lamps.push({ x: x - Math.cos(p.h) * side * arm, y: y + 5.8, z: z + Math.sin(p.h) * side * arm, ci });
    }
  }

  /** Shrines, rest huts, tunnel portals. */
  placeSetPieces(s0, s1, place, rng, ci) {
    const t = this.track;
    for (const m of t.markers) {
      if (m.s < s0 || m.s >= s1) continue;
      if (m.kind === 'shrine') {
        const side = m.side;
        const face = (p) => p.h + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
        const p1 = t.sample(m.s + 4), p2 = t.sample(m.s + 12), p3 = t.sample(m.s + 20);
        const lay = t.terraceAt(m.s + 10);
        const h = p1.y + (lay ? lay.h : 0.55);
        for (const [p, u] of [[p1, RAIL + 2.6], [p3, RAIL + 2.6]]) { const [x, , z] = this.at(p, u * side); place('lantern', x, h, z, face(p)); }
        { const [x, , z] = this.at(p2, (RAIL + 5.2) * side); place('torii', x, h, z, face(p2)); }
        { const [x, , z] = this.at(p2, (RAIL + 11.5) * side); place('hut', x, h, z, face(p2)); }
        for (let k = 0; k < 3; k++) { const p = t.sample(m.s - 2 + k * 13); const [x, , z] = this.at(p, (RAIL + 8 + rng() * 5) * side); place('maple', x, h, z, rng() * 6, 0.9 + rng() * 0.3, 1, k === 1 ? PAL.mapleGold : PAL.mapleRed); }
      } else if (m.kind === 'hut' || m.kind === 'vista') {
        const side = -m.side;                             // the lay-by is on the valley side
        const face = (p) => p.h + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
        const p1 = t.sample(m.s + 8), p2 = t.sample(m.s + 16), p3 = t.sample(m.s + 24);
        const y = p2.y - 0.02;
        if (m.kind === 'hut') {
          { const [x, , z] = this.at(p2, (RAIL + 7.2) * side); place('hut', x, y, z, face(p2)); }
          { const [x, , z] = this.at(p2, (RAIL + 4.6) * side); place('vending', x - Math.sin(p2.h) * 3.2, y, z - Math.cos(p2.h) * 3.2, face(p2)); }
        }
        { const [x, , z] = this.at(p1, (RAIL + 8.6) * side); place('lamp', x, y, z, face(p1) + Math.PI); this.lamps.push({ x, y: y + 5.8, z, ci }); }
        { const [x, , z] = this.at(p3, (RAIL + 8.8) * side); place('boulder', x, y - 0.1, z, rng() * 6, 1.1); }
        for (let k = 0; k < 4; k++) { const p = t.sample(m.s + 2 + k * 8); const [x, , z] = this.at(p, (RAIL + 9.4) * side); place('pole', x, y, z, face(p)); }
      } else if (m.kind === 'tunnel') {
        for (const [s, flip] of [[m.s, Math.PI], [m.s + TUNNEL_LEN, 0]]) {
          const p = t.sample(s);
          place('portal', p.x, p.y - 0.05, p.z, p.h + flip);
        }
      }
    }
  }

  /** Cedars on the slopes, maples along the road, as per-chunk InstancedMesh. */
  placeTrees(i0, i1, s0, s1, group, rng) {
    const t = this.track, pts = t.pts;
    const cedars = [], maplesA = [], broad = [], shrubs = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const density = this.q.trees;
    const put = (list, x, y, z, ry, s, extra) => {
      q.setFromAxisAngle(v.set(0, 1, 0), ry); sc.set(s, s, s);
      m4.compose(v.set(x, y, z), q, sc);
      list.push({ m: m4.clone(), ...extra });
    };
    for (let i = i0; i < i1; i += 5) {              // every 10 m
      const p = pts[i];
      const tun = this.nearTunnel(p.s, 14);
      for (const side of [1, -1]) {
        const mountainHere = side > 0 ? (p.mount + 1) * 0.5 : (1 - p.mount) * 0.5;
        const lay = t.terraceAt(p.s);
        const start = tun ? RAIL + 12 : (lay && lay.side === side ? lay.u1 + 3 : (mountainHere > 0.5 ? RAIL + 8.5 : RAIL + 5));
        const spacing = mountainHere > 0.5 ? 13 : 15.5;
        for (let u = start + rng() * spacing; u < RAIL + 150; u += spacing / density) {
          if (rng() < 0.22) continue;
          const uu = u + (rng() - 0.5) * 5;
          const [x, , z] = this.at(p, uu * side + (rng() - 0.5) * 2);
          if (t.onRoad(x, z, i, 2.5)) continue;
          const y = t.groundAt(x, z, i) - 0.4;
          put(cedars, x, y, z, rng() * Math.PI * 2, 0.7 + rng() * 0.6, { near: uu < 34 });
        }
        // the accent trees at the road's edge: maples and a looser broadleaf, red a minority
        if (!tun && !(lay && lay.side === side) && rng() < 0.5) {
          const u = mountainHere > 0.5 ? RAIL + 2.2 + rng() * 5 : RAIL + 1.4 + rng() * 3;
          const [x, , z] = this.at(p, u * side);
          if (t.onRoad(x, z, i, 1.2)) continue;
          const y = t.groundAt(x, z, i) - 0.25;
          const pick = rng();
          if (rng() < 0.45) {
            const colour = pick < 0.5 ? PAL.mapleGold : pick < 0.85 ? PAL.dryGrass : PAL.mapleOrange;
            put(broad, x, y, z, rng() * Math.PI * 2, 0.8 + rng() * 0.45, { colour });
          } else {
            const colour = pick < 0.3 ? PAL.mapleRed : pick < 0.7 ? PAL.mapleOrange : PAL.mapleGold;
            put(maplesA, x, y, z, rng() * Math.PI * 2, 0.75 + rng() * 0.45, { colour });
          }
        }
        // a second rank on the mountain slope, so the hillside above the road is not bare grass
        if (!tun && mountainHere > 0.5 && !(lay && lay.side === side) && rng() < 0.28) {
          const u = RAIL + 7 + rng() * 6;
          const [x, , z] = this.at(p, u * side);
          if (t.onRoad(x, z, i, 2.5)) continue;
          const y = t.groundAt(x, z, i) - 0.3;
          const pick = rng();
          const colour = pick < 0.4 ? PAL.mapleGold : pick < 0.7 ? PAL.mapleOrange : pick < 0.85 ? PAL.dryGrass : PAL.mapleRed;
          put(pick < 0.5 ? broad : maplesA, x, y, z, rng() * 6, 0.7 + rng() * 0.4, { colour });
        }
      }
    }
    // hairpin insides get a clump of maples
    for (const f of t.features) {
      if (f.type !== 'hairpin') continue;
      const apex = f.s0 + 60;
      if (apex < s0 || apex >= s1) continue;
      for (let k = 0; k < 5; k++) {
        const p = t.sample(apex - 14 + k * 7);
        const [x, , z] = this.at(p, (RAIL + 2.5 + rng() * 4) * f.dir);
        if (t.onRoad(x, z, t.index(p.s), 1.2)) continue;
        const y = t.groundAt(x, z, t.index(p.s)) - 0.25;
        put(maplesA, x, y, z, rng() * 6, 0.85 + rng() * 0.35, { colour: k % 2 ? PAL.mapleRed : PAL.mapleGold });
      }
    }
    // shrubs crowd the verge on both sides, every few metres, in the dry autumn hues
    for (let i = i0; i < i1; i += 2) {
      const p = pts[i];
      if (this.nearTunnel(p.s, 6)) continue;
      for (const side of [1, -1]) {
        const lay = t.terraceAt(p.s);
        if (lay && lay.side === side && lay.layby) continue;
        if (rng() < 0.3) continue;
        const mountainHere = side > 0 ? (p.mount + 1) * 0.5 : (1 - p.mount) * 0.5;
        const w = side > 0 ? p.wl : p.wr;
        const u = w + 0.6 + rng() * (mountainHere > 0.5 ? 2.4 : 1.7);
        const [x, , z] = this.at(p, u * side + (rng() - 0.5) * 1.2);
        if (t.onRoad(x, z, i, 0.6)) continue;
        const y = t.groundAt(x, z, i) - 0.12;
        const pick = rng();
        const colour = pick < 0.4 ? PAL.dryGrass : pick < 0.68 ? PAL.moss : pick < 0.9 ? PAL.mapleGold : PAL.mapleOrange;
        put(shrubs, x, y, z, rng() * 6.28, 0.7 + rng() * 0.7, { colour });
      }
    }
    this.instance(group, 'cedar', cedars.filter((c) => c.near), true);
    this.instance(group, 'cedar', cedars.filter((c) => !c.near), false);
    this.instance(group, 'maple', maplesA, true, true);
    this.instance(group, 'broadleaf', broad, true, true);
    this.instance(group, 'shrub', shrubs, false, true);
  }

  /** Turn a template's merged meshes into InstancedMeshes with the given placements. */
  instance(group, name, items, castShadow, tint = false) {
    if (!items.length) return;
    const tpl = this.templates[name]; if (!tpl) return;
    const meshes = [];
    tpl.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const local = new THREE.Matrix4(), m = new THREE.Matrix4();
    for (const mesh of meshes) {
      local.copy(mesh.matrixWorld);          // template is at the origin, so world == local-in-template
      const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, items.length);
      const tinted = tint && mesh.material.name === 'foliage_tinted';
      for (let i = 0; i < items.length; i++) {
        m.multiplyMatrices(items[i].m, local);
        im.setMatrixAt(i, m);
        if (tinted) im.setColorAt(i, new THREE.Color(items[i].colour));
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = castShadow; im.receiveShadow = true;
      im.computeBoundingSphere();
      group.add(im);
    }
  }

  /** Far ranges: two rings of skyline, each one strip with a jagged crest, plus the valley floor and a lake. */
  buildFar() {
    const g = new THREE.Group();
    const rng = mulberry32(ROAD.seed ^ 0x5eed);
    const ring = (radius, base, hMin, hMax, segs, colour, seedOff) => {
      const pos = new Float32Array((segs + 1) * 2 * 3), idx = [];
      const n1 = mulberry32(seedOff);
      const bumps = []; for (let i = 0; i < 6; i++) bumps.push({ a: n1() * Math.PI * 2, w: 0.25 + n1() * 0.6, h: n1() });
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        // a crest from a few broad peaks plus a jagged fine term
        let h = 0;
        for (const b of bumps) { let d = Math.abs(a - b.a); d = Math.min(d, Math.PI * 2 - d); h = Math.max(h, b.h * Math.max(0, 1 - (d / b.w) * (d / b.w))); }
        const fine = 0.5 + 0.5 * Math.sin(a * 23 + seedOff) * Math.sin(a * 41 + 1.7) ;
        const y = base + hMin + (hMax - hMin) * (0.55 * h + 0.45 * fine * (0.4 + 0.6 * h));
        const x = Math.sin(a) * radius, z = Math.cos(a) * radius;
        pos.set([x, base, z, x, y, z], i * 6);
        if (i < segs) { const b0 = i * 2; idx.push(b0, b0 + 2, b0 + 1, b0 + 1, b0 + 2, b0 + 3); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setIndex(idx); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colour, roughness: 1, metalness: 0, side: THREE.DoubleSide, flatShading: true }));
      m.frustumCulled = false;
      return m;
    };
    g.add(ring(820, -170, 140, 330, 96, 0x3d5243, 11));
    g.add(ring(1500, -190, 260, 640, 120, 0x394c46, 29));
    g.add(ring(2600, -200, 500, 1100, 140, 0x35474a, 47));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000), new THREE.MeshStandardMaterial({ color: 0x2c3d2a, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -160;
    g.add(floor);
    const lake = new THREE.Mesh(new THREE.CircleGeometry(420, 24), new THREE.MeshStandardMaterial({ color: 0x8fb0c4, roughness: 0.15, metalness: 0.2 }));
    lake.rotation.x = -Math.PI / 2; lake.position.set(520, -158, -420);
    g.add(lake);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    this.far = g; this.scene.add(g);
  }

  updateFar(x, y, z) {
    if (!this.far) return;
    this.far.position.set(x * 0.85, y * 0.85, z * 0.85);
  }
}
