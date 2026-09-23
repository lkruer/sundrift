// NEO TOKYO test street: the game's rig and post chain, the building material on instanced boxes, the neon atlas
// on sign boxes, Tokyo Tower down the street and the far skyline ring. ?view=street|shops|close|tower|skyline|day
import * as THREE from 'three';
import { createRig } from '../../game/rig.js';
import { makePost } from '../../game/src/post.js';
import { neonAtlas } from '../../game/src/neon.js';
import { buildingMaterial, facadeColour } from '../../game/src/buildings.js';
import { tokyoTower, citySkyline } from '../../game/src/landmarks.js';
import { cityPropMaterials, lotProps, streetProps, bollardGeometry } from '../../game/src/cityprops.js';

/** The same merge as city.js: position, normal, uv and indices copied; each part disposed. */
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

function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function propCheck() {
  const rng = mulberry32(5);
  let bad = 0, maxLot = 0, sumLot = 0, maxSeg = 0, sumSeg = 0;
  const N = 3000;
  for (let i = 0; i < N; i++) {
    const h = rng() * Math.PI * 2, side = rng() < 0.5 ? 1 : -1;
    const lot = { x: (rng() - 0.5) * 4000, z: (rng() - 0.5) * 4000, y: rng() * 40, fx: Math.sin(h), fz: Math.cos(h), lx: Math.cos(h) * side, lz: -Math.sin(h) * side,
      width: 3 + rng() * 20, depth: 5 + rng() * 20, height: 4 + rng() * 90, shop: rng() < 0.8 };
    const out = {};
    const t = lotProps(THREE, lot, rng, out);
    sumLot += t; maxLot = Math.max(maxLot, t);
    const seg = { x: lot.x, z: lot.z, y: lot.y, y1: lot.y + (rng() - 0.5) * 3, fx: lot.fx, fz: lot.fz, lx: lot.lx, lz: lot.lz, length: 5 + rng() * 60 };
    const t2 = streetProps(THREE, seg, rng, out);
    sumSeg += t2 / seg.length * 30; maxSeg = Math.max(maxSeg, t2);
    for (const [k, list] of Object.entries(out)) {
      if (k.startsWith('__')) { for (const p of list) if (!p.every(Number.isFinite)) bad++; continue; }
      for (const g of list) {
        for (const name of ['position', 'normal', 'uv']) { const a = g.attributes[name]; if (!a) { bad++; continue; } for (let j = 0; j < a.array.length; j++) if (!Number.isFinite(a.array[j])) { bad++; if (!window.__BAD__) window.__BAD__ = { k, name, j, n: a.array.length, lot: { w: lot.width, h: lot.height, d: lot.depth, shop: lot.shop } }; break; } }
        const n = g.attributes.position.count; for (const ix of g.index.array) if (ix >= n) { bad++; break; }
        g.dispose();
      }
    }
  }
  return { bad, avgLot: Math.round(sumLot / N), maxLot, avgPer30m: Math.round(sumSeg / N), maxSeg };
}

export async function run(view, Q, FONT) {
  if (view === 'check') { window.__STATS__.check = propCheck(); window.__STATS__.bad = window.__BAD__; return; }
  const W = innerWidth, H = innerHeight;
  const canvas = document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(Number(Q.get('fov') || 62), W / H, 0.3, 4500);
  scene.add(camera);
  const day = view === 'day';
  const rig = createRig(THREE, renderer, scene, { hour: day ? 14 : 21.5, azimuth: 235, tier: 'high', fogStart: 60, fogDensity: 0.0012, exposure: 1.05, post: false, camera, sky: day });
  const post = makePost(renderer, scene, camera, { bloom: true, fringe: true, width: W, height: H });
  const night = day ? 0 : 1;
  if (rig.hemi) rig.hemi.intensity *= day ? 1 : 0.5;

  // the light-polluted sky: magenta at the horizon, deep purple overhead
  if (!day) {
    const geo = new THREE.SphereGeometry(4000, 48, 24), P = geo.attributes.position, col = new Float32Array(P.count * 3);
    const hz = new THREE.Color(0xd23c8c), mid = new THREE.Color(0x4a1c62), top = new THREE.Color(0x0c0818), c = new THREE.Color();
    for (let i = 0; i < P.count; i++) {
      const e = Math.asin(THREE.MathUtils.clamp(P.getY(i) / 4000, -1, 1));
      const t1 = THREE.MathUtils.smoothstep(e, -0.02, 0.1), t2 = THREE.MathUtils.smoothstep(e, 0.08, 0.7);
      c.copy(hz).lerp(mid, t1).lerp(top, t2);
      if (e < -0.02) c.copy(hz).multiplyScalar(0.6);
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -1000; sky.frustumCulled = false; sky.name = 'test sky';
    scene.add(sky);
    scene.userData.sky = sky;
  }

  // the street: road along -z, pavements, a kerb
  const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 1200), new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.28, metalness: 0 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -400); road.receiveShadow = true; scene.add(road);
  for (const s of [-1, 1]) {
    const pave = new THREE.Mesh(new THREE.PlaneGeometry(4, 1200), new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.5 }));
    pave.rotation.x = -Math.PI / 2; pave.position.set(s * 9, 0.12, -400); pave.receiveShadow = true; scene.add(pave);
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);

  // the buildings
  const rng = mulberry32(Number(Q.get('seed') || 3));
  const lots = [];
  if (!Q.has('nobldg')) {
    for (const side of [-1, 1]) {
      let z = 40;
      while (z > -560) {
        const w = 6 + rng() * 12, d = 12 + rng() * 10, floors = 2 + Math.floor(Math.pow(rng(), 1.3) * 13);
        const h = 4 + floors * 3.4 + 0.6 + rng() * 2.2;
        lots.push({ x: side * (11 + d / 2), z: z - w / 2, w, d, h, side });
        z -= w + (rng() < 0.15 ? 2.5 : 0);
      }
    }
    // a second row behind, taller, so the skyline over the street is dense
    for (const side of [-1, 1]) {
      let z = 40;
      while (z > -560) {
        const w = 14 + rng() * 20, d = 18, h = 30 + rng() * 60;
        lots.push({ x: side * (11 + 24 + d / 2 + rng() * 4), z: z - w / 2, w, d, h, side, back: true });
        z -= w + 3;
      }
    }
    const mat = buildingMaterial(THREE, { night });
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, lots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), cc = new THREE.Color();
    lots.forEach((l, i) => {
      // widths run along the street: scale x is the depth (across), scale z the frontage; sunk 0.3 m as city.js does
      m4.compose(p.set(l.x, (l.h + 0.3) / 2 - 0.3, l.z), q.identity(), s.set(l.d, l.h + 0.3, l.w));
      im.setMatrixAt(i, m4);
      im.setColorAt(i, cc.set(facadeColour(rng())));
    });
    im.castShadow = true; im.receiveShadow = true;
    scene.add(im);
    window.__STATS__.buildings = lots.length;
    window.__MAT__ = mat;
  }

  // the signs
  const t0 = performance.now();
  const atlas = neonAtlas(FONT);
  window.__STATS__.atlasMs = Math.round(performance.now() - t0);
  const signMat = new THREE.MeshBasicMaterial({ map: atlas.texture, color: new THREE.Color(1, 1, 1).multiplyScalar(Number(Q.get('signk') || 2.0)) });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x1c1b20, roughness: 0.6, metalness: 0.3 });
  const signGeo = (sg, depth) => {
    const g = new THREE.BoxGeometry(sg.w, sg.h, depth);
    const uv = g.attributes.uv;
    // faces 4 (+z) and 5 (-z) show the sign; BoxGeometry lays each face out unmirrored as seen from outside
    for (let f = 4; f < 6; f++) for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, sg.u0 + uv.getX(i) * (sg.u1 - sg.u0), sg.v0 + uv.getY(i) * (sg.v1 - sg.v0));
    }
    return g;
  };
  const vert = atlas.signs.filter((s) => s.vertical), horiz = atlas.signs.filter((s) => !s.vertical);
  const glows = [];
  let vi = 0, hi = 0;
  if (!Q.has('nobldg')) {
    for (const l of lots) {
      if (l.back) continue;
      const face = l.side < 0 ? l.x + l.d / 2 : l.x - l.d / 2;   // the street-facing facade's x
      // a vertical sign on most buildings, hung out over the pavement at the lot's leading edge
      if (rng() < 0.8 && l.h > 10) {
        const sg = vert[vi++ % vert.length];
        const m = new THREE.Mesh(signGeo(sg, 0.22), [edgeMat, edgeMat, edgeMat, edgeMat, signMat, signMat]);
        const y = Math.min(l.h - sg.h / 2 - 0.5, 4.6 + sg.h / 2 + rng() * 5);
        m.position.set(face - l.side * (0.2 + sg.w / 2), y, l.z + l.w / 2 - 0.6);
        m.rotation.y = 0;                 // the faces look along the street
        scene.add(m);
        glows.push({ c: sg.colour, p: m.position.clone() });
      }
      // a horizontal board over the shop front
      if (rng() < 0.75 && l.w > 3) {
        const sg = horiz[hi++ % horiz.length];
        if (sg.w < l.w - 1) {
          const m = new THREE.Mesh(signGeo(sg, 0.16), [edgeMat, edgeMat, edgeMat, edgeMat, signMat, signMat]);
          m.position.set(face - l.side * 0.1, 4.25 + sg.h / 2 + rng() * 0.3, l.z);
          m.rotation.y = l.side < 0 ? Math.PI / 2 : -Math.PI / 2;
          scene.add(m);
          glows.push({ c: sg.colour, p: m.position.clone() });
        }
      }
    }
  }
  window.__STATS__.signsPlaced = glows.length;

  // the clutter: lots and pavements through cityprops, merged per material as city.js does
  if (!Q.has('noprops') && !Q.has('nobldg')) {
    const pmats = cityPropMaterials(THREE);
    const out = {};
    const prng = mulberry32(99);
    const t0p = performance.now();
    let lotTris = 0, nLots = 0, segTris = 0, nSegs = 0;
    for (const l of lots) {
      if (l.back) continue;
      const lot = { x: l.side * 11, z: l.z, y: 0.12, fx: 0, fz: -1, lx: l.side, lz: 0, width: l.w, depth: l.d, height: l.h, shop: true };
      lotTris += lotProps(THREE, lot, prng, out); nLots++;
    }
    for (const side of [-1, 1]) for (let z = 40; z > -560; z -= 30) {
      segTris += streetProps(THREE, { x: side * 7, z, y: 0.12, fx: 0, fz: -1, lx: side, lz: 0, length: 30 }, prng, out); nSegs++;
    }
    window.__STATS__.propsMs = Math.round(performance.now() - t0p);
    window.__STATS__.trisPerLot = Math.round(lotTris / nLots);
    window.__STATS__.trisPer30m = Math.round(segTris / nSegs);
    const bg = bollardGeometry(THREE);
    const bol = out.__bollards || [];
    const bim = new THREE.InstancedMesh(bg.geometry, pmats[bg.material], Math.max(1, bol.length));
    bol.forEach((p, i) => bim.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p[0], p[1], p[2])));
    bim.count = bol.length; scene.add(bim);
    window.__STATS__.bollards = bol.length;
    const drawn = {};
    for (const [k, list] of Object.entries(out)) {
      if (k.startsWith('__') || !list.length) continue;
      const geo = merge(list);
      drawn[k] = geo.index.count / 3;
      const m = new THREE.Mesh(geo, pmats[k]); m.castShadow = true; m.receiveShadow = true; m.name = 'props ' + k;
      scene.add(m);
    }
    window.__STATS__.propTris = drawn;
    window.__STATS__.propMaterials = Object.keys(pmats).length;
  }
  // a few coloured lights from the nearest signs, as the game's light pools would be
  const near = glows.filter((g) => g.p.z > -60 && g.p.z < 20).slice(0, 6);
  for (const g of near) { const pl = new THREE.PointLight(g.c, day ? 0 : 18, 14, 2); pl.position.copy(g.p).setX(g.p.x * 0.8); scene.add(pl); }
  // street lamps, warm, both sides, as the game has near the car; and the city's own glow as fill
  if (!day) {
    for (let z = 12; z > -75; z -= 16) for (const sx of [-1, 1]) {
      const pl = new THREE.PointLight(0xffc98a, 60, 26, 1.6); pl.position.set(sx * 7.6, 6.2, z + (sx > 0 ? 8 : 0)); scene.add(pl);
    }
    if (rig.hemi) rig.hemi.intensity *= Number(Q.get('fill') || 4);
  }
  if (window.__MAT__ && Q.has('wet')) window.__MAT__.userData.uWet.value = Number(Q.get('wet'));

  // Tokyo Tower down the street, and the skyline ring round the camera
  const tower = tokyoTower(THREE);
  const tz = Number(Q.get('tz') || -2200);
  tower.position.set(Number(Q.get('tx') || 90), 0, tz);
  scene.add(tower);
  const ring = citySkyline(THREE, { radius: 2600, count: 180, seed: 7 });
  scene.add(ring);
  window.__STATS__.towerTris = tower.userData.triangles;
  window.__STATS__.skylineTris = ring.userData.triangles;

  // the views
  const V = {
    street: [[0.5, 1.5, 6], [0, 6, -120]],
    shops: [[3.2, 1.3, 2], [9, 2.4, -12]],
    close: [[5.5, 1.6, -8], [11, 2.1, -12.5]],
    pave: [[5.2, 1.3, 0], [9.2, 0.6, -10]],
    roofs: [[0, 42, 30], [14, 20, -60]],
    upper: [[-2, 1.6, 0], [9, 16, -22]],
    tower: [[0, 1.6, 0], [90, 160, -2200]],
    skyline: [[0, 1.6, 0], [0, 80, -2600]],
    high: [[0, 70, 60], [0, 30, -400]],
    day: [[0.5, 1.5, 6], [0, 6, -120]],
  };
  const [pos, tgt] = V[view] || V.street;
  const dz = Number(Q.get('camz') || 0), mirror = Q.has('left') ? -1 : 1;
  camera.position.set(pos[0] * mirror, pos[1], pos[2] + dz); camera.lookAt(tgt[0] * mirror, tgt[1], tgt[2] + dz);
  if (Q.has('yaw')) camera.rotateY(Number(Q.get('yaw')));
  ring.position.copy(camera.position);
  camera.updateMatrixWorld();

  try { await rig.ready; } catch {}
  rig.refresh(scene);
  for (let i = 0; i < 4; i++) { rig.update(camera, 0.016); post.render(0.016); await new Promise((r) => requestAnimationFrame(r)); }
  window.__STATS__.draws = renderer.info.render.calls;
  window.__STATS__.tris = renderer.info.render.triangles;
  window.__STATS__.programs = renderer.info.programs.length;
}
