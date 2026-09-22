import io
p='game/src/main.js'; s=open(p,encoding='utf-8').read()

s=s.replace("playing: false, over: false, hour: 17.6,","playing: false, over: false, hour: 20.6,")
s=s.replace("G.idx = 0; G.dist = 0; G.lastS = 8; G.hour = 17.6;","G.idx = 0; G.dist = 0; G.lastS = 8; G.hour = 20.6;")
a="""  const h = G.hour;
  const rate = (h > 18.3 || h < 5.6) ? 10 : h < 15 ? 5 : h < 17.2 ? 2.5 : 1;
  G.hour += ds / 3800 * rate;"""
b="""  const h = G.hour;
  const rate = (h >= 7.2 && h < 16.6) ? 7 : 1;
  G.hour += ds / 3000 * rate;"""
assert a in s; s=s.replace(a,b)

a="""let track, world, car, carRoot, joints, chase, input, scoring, hud, audio, skids, particles, flame, headlights;
const lampLights = [];"""
b="""let track, world, car, carRoot, joints, chase, input, scoring, hud, audio, skids, particles, flame, headlights, beams;
const lampLights = [];
const night = { moon: null, stars: null, disc: null, dir: new THREE.Vector3(0.35, 0.6, -0.72).normalize(), amt: 0 };

/** The night's own light: a cool moon with a shadow box around the car, stars, and a moon disc. */
function buildNight() {
  const moon = new THREE.DirectionalLight(0x9fb4e0, 0);
  moon.castShadow = Q.shadow;
  const sm = tier === 'phone' ? 1024 : 2048;
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
}"""
assert a in s; s=s.replace(a,b)

a="""  prog(0.68, 'the car');
  await buildCar();"""
b="""  prog(0.68, 'the car');
  await buildCar();
  buildNight();"""
assert a in s; s=s.replace(a,b)

a="""  for (let i = 0; i < (tier === 'phone' ? 2 : 3); i++) {
    const pl = new THREE.PointLight(0xffcf7a, 0, 26, 1.6);
    scene.add(pl); lampLights.push(pl);
  }"""
b="""  for (let i = 0; i < (tier === 'phone' ? 3 : 5); i++) {
    const pl = new THREE.PointLight(0xffcf7a, 0, 36, 1.5);
    scene.add(pl); lampLights.push(pl);
  }
  // fake volumetric beams: two additive cones ahead of the lamps, the way arcade racers draw headlights
  beams = new THREE.Group();
  const beamGeo = new THREE.ConeGeometry(2.6, 16, 14, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 8);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  for (const x of [-0.6, 0.6]) {
    const b = new THREE.Mesh(beamGeo, beamMat);
    b.position.set(x, 0.62, 2.1); b.rotation.x = 0.04;
    beams.add(b);
  }
  beams.userData.mat = beamMat;
  carRoot.add(beams);"""
assert a in s; s=s.replace(a,b)

a="""  const nightAmt = smoothstep(4, -3, el);
  G.night = nightAmt;
  for (const h of headlights) h.intensity = 180 * nightAmt;
  sunColor.copy(rig.sun.color).lerp(new THREE.Color(0.6, 0.7, 1.0), nightAmt);"""
b="""  const nightAmt = smoothstep(4, -3, el);
  G.night = nightAmt; night.amt = nightAmt;
  for (const h of headlights) h.intensity = 220 * nightAmt;
  if (beams) beams.userData.mat.opacity = 0.075 * nightAmt;
  if (night.moon) night.moon.intensity = 1.35 * nightAmt;
  if (night.stars) night.stars.material.opacity = 0.9 * smoothstep(-1, -6, el);
  if (night.disc) { night.disc.userData.dm.material.opacity = smoothstep(-1, -5, el); night.disc.userData.halo.material.opacity = 0.35 * smoothstep(-1, -5, el); }
  world.setNight(nightAmt);
  sunColor.copy(rig.sun.color).lerp(new THREE.Color(0.55, 0.65, 0.95), nightAmt);"""
assert a in s; s=s.replace(a,b)

a="""  // ---- camera, world
  chase.update(dt, car, road.y, (x, z) => track.groundAt(x, z, G.idx), boost01);"""
b="""  // ---- camera, world
  chase.update(dt, car, road.y, (x, z) => track.groundAt(x, z, G.idx), boost01);
  nightFollow();"""
assert a in s; s=s.replace(a,b)

a="""let sunTimer = 0;
function applySun(dt) {"""
b="""function nightFollow() {
  if (!night.moon) return;
  if (night.stars) night.stars.position.copy(camera.position);
  if (night.disc) {
    night.disc.position.copy(camera.position).addScaledVector(night.dir, 2400);
    night.disc.lookAt(camera.position);
  }
  // the moon key sits over the car; snapped to texels so the shadow edges do not crawl
  const texel = 68 / (tier === 'phone' ? 1024 : 2048);
  const sx = Math.round(car.x / texel) * texel, sz = Math.round(car.z / texel) * texel;
  const m = night.moon;
  m.position.set(sx + night.dir.x * 60, carRoot.position.y + night.dir.y * 60, sz + night.dir.z * 60);
  m.target.position.set(sx, carRoot.position.y, sz);
  m.target.updateMatrixWorld();
}

let sunTimer = 0;
function applySun(dt) {"""
assert a in s; s=s.replace(a,b)

a="""  placeCar(y, 0);
  world.updateFar(car.x, y, car.z);
}"""
b="""  placeCar(y, 0);
  world.updateFar(car.x, y, car.z);
  nightFollow();
  if (!G.sunOnce) { G.sunOnce = true; applySun(10); }
}"""
assert a in s; s=s.replace(a,b,1)

a="""      pl.position.set(e.l.x, e.l.y, e.l.z);
      pl.intensity = e.l.tunnel ? 60 : 90 * Math.max(G.night, 0.15);"""
b="""      pl.position.set(e.l.x, e.l.y, e.l.z);
      pl.intensity = e.l.tunnel ? 70 : 130 * Math.max(G.night, 0.12);"""
assert a in s; s=s.replace(a,b)
s=s.replace("hud.toast('DRIFT THE SUN DOWN', 'good', true);","hud.toast('DRIFT THE NIGHT AWAY', 'good', true);")
open(p,'w',encoding='utf-8').write(s); print('main patched')

p='game/index.html'; s=open(p,encoding='utf-8').read()
s=s.replace('<div class="sub">AUTUMN TOUGE</div>','<div class="sub">NIGHT TOUGE</div>')
s=s.replace('<div class="sub">AUTUMN TOUGE · ENDLESS</div>','<div class="sub">NIGHT TOUGE · ENDLESS</div>')
s=s.replace("Chain drifts to bank score and earn boost. Every banked drift pushes the sun across the sky. Clip the guardrail without touching it for a bonus. Crashing drops the drift you are holding.",
            "Chain drifts to bank score and earn boost. Every banked drift pushes the night toward dawn. Clip the guardrail without touching it for a bonus. Crashing drops the drift you are holding.")
a="""<div id="vign"></div>"""
b="""<div id="vign"></div>
<div id="crt"></div>"""
assert a in s; s=s.replace(a,b)
a="""  #hit { position:fixed;"""
b="""  #crt { position:fixed; inset:0; z-index:11; pointer-events:none; opacity:.55;
         background: repeating-linear-gradient(0deg, rgba(0,0,0,.10) 0px, rgba(0,0,0,.10) 1px, transparent 1px, transparent 3px),
                     radial-gradient(ellipse at center, rgba(0,0,0,0) 62%, rgba(4,6,14,.55) 100%); }
  #hit { position:fixed;"""
assert a in s; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s); print('html patched')
