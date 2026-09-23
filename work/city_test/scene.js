// NEO TOKYO test street: the game's rig and post chain, the building material on instanced boxes, the neon atlas
// on sign boxes, Tokyo Tower down the street and the far skyline ring. ?view=street|shops|close|tower|skyline|day
import * as THREE from 'three';
import { createRig } from '../../game/rig.js';
import { makePost } from '../../game/src/post.js';
import { neonAtlas } from '../../game/src/neon.js';
import { buildingMaterial, facadeColour } from '../../game/src/buildings.js';
import { tokyoTower, citySkyline } from '../../game/src/landmarks.js';

function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export async function run(view, Q, FONT) {
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
      // widths run along the street: scale x is the depth (across), scale z the frontage
      m4.compose(p.set(l.x, l.h / 2, l.z), q.identity(), s.set(l.d, l.h, l.w));
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
  // a few coloured lights from the nearest signs, as the game's light pools would be
  const near = glows.filter((g) => g.p.z > -60 && g.p.z < 20).slice(0, 6);
  for (const g of near) { const pl = new THREE.PointLight(g.c, day ? 0 : 18, 14, 2); pl.position.copy(g.p).setX(g.p.x * 0.8); scene.add(pl); }

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
    upper: [[-2, 1.6, 0], [9, 16, -22]],
    tower: [[0, 1.6, 0], [90, 160, -2200]],
    skyline: [[0, 1.6, 0], [0, 80, -2600]],
    high: [[0, 70, 60], [0, 30, -400]],
    day: [[0.5, 1.5, 6], [0, 6, -120]],
  };
  const [pos, tgt] = V[view] || V.street;
  camera.position.set(...pos); camera.lookAt(...tgt);
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
