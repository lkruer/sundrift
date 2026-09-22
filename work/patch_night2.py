p='game/src/main.js'; s=open(p,encoding='utf-8').read()

# a horizon glow band around the camera, and the rig's hemisphere fill dimmed at night so lamps and headlights dominate
a="""  scene.add(disc); night.disc = disc;
}"""
b="""  scene.add(disc); night.disc = disc;
  // horizon glow: a band around the camera, warm at the horizon fading into the blue, the retro night sky
  const H = 420, R = 2300, seg = 48;
  const gpos = new Float32Array((seg + 1) * 2 * 3), gcol = new Float32Array((seg + 1) * 2 * 4), gidx = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2, x = Math.sin(a) * R, z = Math.cos(a) * R;
    gpos.set([x, -40, z, x, H, z], i * 6);
    gcol.set([0.95, 0.55, 0.28, 0.55, 0.35, 0.35, 0.7, 0.0], i * 8);
    if (i < seg) { const b0 = i * 2; gidx.push(b0, b0 + 2, b0 + 1, b0 + 1, b0 + 2, b0 + 3); }
  }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.BufferAttribute(gpos, 3)); gg.setAttribute('color', new THREE.BufferAttribute(gcol, 4)); gg.setIndex(gidx);
  const glow = new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.frustumCulled = false; glow.renderOrder = -1;
  scene.add(glow); night.glow = glow;
  night.hemiDay = rig.hemi ? rig.hemi.intensity : 1;
}"""
assert a in s; s=s.replace(a,b)

a="""  for (const h of headlights) h.intensity = 220 * nightAmt;
  if (beams) beams.userData.mat.opacity = 0.075 * nightAmt;
  if (night.moon) night.moon.intensity = 1.35 * nightAmt;"""
b="""  for (const h of headlights) h.intensity = 150 * nightAmt;
  if (beams) beams.userData.mat.opacity = 0.07 * nightAmt;
  if (night.moon) night.moon.intensity = 0.95 * nightAmt;
  if (night.glow) night.glow.material.opacity = 0.32 * smoothstep(-0.5, -5, el);
  if (rig.hemi && night.hemiDay) rig.hemi.intensity = night.hemiDay * (1 - 0.55 * nightAmt);"""
assert a in s; s=s.replace(a,b)

a="""  if (night.stars) night.stars.position.copy(camera.position);"""
b="""  if (night.stars) night.stars.position.copy(camera.position);
  if (night.glow) night.glow.position.set(camera.position.x, camera.position.y - 60, camera.position.z);"""
assert a in s; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s); print('main patched')

p='game/src/world.js'; s=open(p,encoding='utf-8').read()
a="""      g.addColorStop(0, 'rgba(255,205,130,0.55)'); g.addColorStop(0.35, 'rgba(255,190,110,0.28)'); g.addColorStop(1, 'rgba(255,170,90,0)');"""
b="""      g.addColorStop(0, 'rgba(255,200,120,0.7)'); g.addColorStop(0.3, 'rgba(255,180,95,0.34)'); g.addColorStop(1, 'rgba(255,160,80,0)');"""
assert a in s; s=s.replace(a,b)
a="""      this.pool(hx, y, hz, 9, 1.0);"""
b="""      this.pool(hx, y, hz, 11.5, 1.0);"""
assert a in s; s=s.replace(a,b)
a="""  setNight(n) { if (this._poolMat) this._poolMat.opacity = 0.85 * n; }"""
b="""  setNight(n) { if (this._poolMat) this._poolMat.opacity = 1.0 * n; }"""
assert a in s; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s); print('world patched')
