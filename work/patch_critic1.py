p='game/src/main.js'; s=open(p,encoding='utf-8').read()

# the night is dark: a faint moon, the rig's fill nearly off, the lamps and the headlights are the light
a="""  for (const h of headlights) h.intensity = 150 * nightAmt;
  if (beams) beams.userData.mat.opacity = 0.07 * nightAmt;
  if (night.moon) night.moon.intensity = 0.95 * nightAmt;
  if (night.glow) night.glow.material.opacity = 0.32 * smoothstep(-0.5, -5, el);
  if (rig.hemi && night.hemiDay) rig.hemi.intensity = night.hemiDay * (1 - 0.55 * nightAmt);"""
b="""  for (const h of headlights) h.intensity = 120 * nightAmt;
  if (beams) beams.userData.mat.opacity = 0.06 * nightAmt;
  if (night.moon) night.moon.intensity = 0.32 * nightAmt;
  if (night.glow) night.glow.material.opacity = 0.30 * smoothstep(-0.5, -5, el);
  if (rig.hemi && night.hemiDay) rig.hemi.intensity = night.hemiDay * (1 - 0.82 * nightAmt);"""
assert a in s; s=s.replace(a,b)

# lamps: tighter, brighter, real fall-off
a="""  for (let i = 0; i < (tier === 'phone' ? 3 : 5); i++) {
    const pl = new THREE.PointLight(0xffcf7a, 0, 36, 1.5);
    scene.add(pl); lampLights.push(pl);
  }"""
b="""  for (let i = 0; i < (tier === 'phone' ? 3 : 5); i++) {
    const pl = new THREE.PointLight(0xffc266, 0, 30, 2.0);
    scene.add(pl); lampLights.push(pl);
  }"""
assert a in s; s=s.replace(a,b)
a="""      pl.intensity = e.l.tunnel ? 70 : 130 * Math.max(G.night, 0.12);"""
b="""      pl.intensity = e.l.tunnel ? 110 : 300 * Math.max(G.night, 0.12);"""
assert a in s; s=s.replace(a,b)

# headlights: a narrower cone that lights the road ahead, not the whole hillside
a="""    const sp = new THREE.SpotLight(0xfff0d0, 0, 60, 0.55, 0.5, 1.2);"""
b="""    const sp = new THREE.SpotLight(0xfff0d0, 0, 46, 0.42, 0.6, 1.4);"""
assert a in s; s=s.replace(a,b)

# hero surfaces: glossier paint, glass that is actually transparent so the driver reads
a="""      out = new THREE.MeshPhysicalMaterial({ color: m.color, roughness: 0.32, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.0 });"""
b="""      out = new THREE.MeshPhysicalMaterial({ color: m.color, roughness: 0.2, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.2 });"""
assert a in s; s=s.replace(a,b)
a="""      out = new THREE.MeshPhysicalMaterial({ color: m.color, roughness: 0.08, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2 });"""
b="""      out = new THREE.MeshPhysicalMaterial({ color: m.color, roughness: 0.08, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2, transparent: true, opacity: 0.5 });"""
assert a in s; s=s.replace(a,b)

# bloom threshold fixed, so the night's low key does not put every pool over the line
a="""const rig = createRig(THREE, renderer, scene, { hour: G.hour, azimuth: 235, tier, fogStart: 55, fogDensity: 0.0013, exposure: 1.05 });"""
b="""const rig = createRig(THREE, renderer, scene, { hour: G.hour, azimuth: 235, tier, fogStart: 55, fogDensity: 0.0013, exposure: 1.05, bloomThreshold: 1.6, bloomStrength: 0.22 });"""
assert a in s; s=s.replace(a,b)

# smoke only at speed
a="""    if (a > 0.25 && Math.random() < a * 0.9) particles.smoke(wx, y, wz, vx, vz, a, sunColor);"""
b="""    if (a > 0.25 && car.speed > 6 && Math.random() < a * 0.9) particles.smoke(wx, y, wz, vx, vz, a, sunColor);"""
assert a in s; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s); print('main patched')

# camera: closer and lower, the hero at a quarter of the frame
p='game/src/config.js'; s=open(p,encoding='utf-8').read()
a="""export const CAM = {
  dist: 5.0, height: 1.85, lookAhead: 4.2, lookUp: 0.85,
  fov: 60, fovBoost: 11, fovSpeed: 7,"""
b="""export const CAM = {
  dist: 4.1, height: 1.5, lookAhead: 3.4, lookUp: 0.75,
  fov: 58, fovBoost: 10, fovSpeed: 6,"""
assert a in s; s=s.replace(a,b); open(p,'w',encoding='utf-8').write(s)
p='game/src/camera.js'; s=open(p,encoding='utf-8').read()
a="    const dist = CAM.dist + speed * 0.022 + boost01 * 0.5;"
b="    const dist = CAM.dist + speed * 0.012 + boost01 * 0.4;"
assert a in s; s=s.replace(a,b); open(p,'w',encoding='utf-8').write(s); print('camera patched')

# road roughness: smooth variation, not per-texel noise, so a lamp's sheen is a highlight and not a grid
p='game/src/world.js'; s=open(p,encoding='utf-8').read()
a="""      rough = 0.66 + (rnd() - 0.5) * 0.10 - 0.05 * (1 - wear) * 6;"""
b="""      rough = 0.55 + 0.08 * Math.sin(x * 0.11 + y * 0.05) * Math.sin(y * 0.09) - 0.05 * (1 - wear) * 6;"""
assert a in s; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s); print('world patched')

# the gate photographs the car moving, never parked or crashed
p='gate/drift-gate.mjs'; s=open(p,encoding='utf-8').read()
a="""  if (covered >= nextShot && frames.length < 8) {"""
b="""  if (covered >= nextShot && frames.length < 8 && g.kmh > 38) {"""
assert a in s; s=s.replace(a,b); open(p,'w',encoding='utf-8').write(s); print('gate patched')
