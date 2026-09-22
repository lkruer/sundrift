p='game/src/main.js'; s=open(p,encoding='utf-8').read()

# two sources that read differently: cool white headlights, sodium lamps, a blue moon
a="""    const sp = new THREE.SpotLight(0xfff0d0, 0, 46, 0.42, 0.6, 1.4);"""
b="""    const sp = new THREE.SpotLight(0xf6f8ff, 0, 46, 0.42, 0.6, 1.4);"""
assert a in s; s=s.replace(a,b)
a="""    const pl = new THREE.PointLight(0xffc266, 0, 30, 2.0);"""
b="""    const pl = new THREE.PointLight(0xffa040, 0, 26, 2.0);"""
assert a in s; s=s.replace(a,b)
a="""      pl.intensity = e.l.tunnel ? 110 : 300 * Math.max(G.night, 0.12);"""
b="""      pl.intensity = e.l.tunnel ? 110 : 340 * Math.max(G.night, 0.12);"""
assert a in s; s=s.replace(a,b)
a="""  const moon = new THREE.DirectionalLight(0x9fb4e0, 0);"""
b="""  const moon = new THREE.DirectionalLight(0x6f8fd8, 0);"""
assert a in s; s=s.replace(a,b)
a="""  for (const h of headlights) h.intensity = 120 * nightAmt;
  if (beams) beams.userData.mat.opacity = 0.06 * nightAmt;
  if (night.moon) night.moon.intensity = 0.32 * nightAmt;"""
b="""  for (const h of headlights) h.intensity = 110 * nightAmt;
  if (beams) beams.userData.mat.opacity = 0.09 * nightAmt;
  if (night.moon) night.moon.intensity = 0.5 * nightAmt;"""
assert a in s; s=s.replace(a,b)

# the beams fade along their length: bright at the lamp, nothing at the far end, so from behind there is no dome
a="""  beams = new THREE.Group();
  const beamGeo = new THREE.ConeGeometry(2.6, 16, 14, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 8);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });"""
b="""  beams = new THREE.Group();
  const beamGeo = new THREE.ConeGeometry(2.1, 18, 14, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 9);
  {
    const pos = beamGeo.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { const t = 1 - Math.min(1, Math.max(0, pos.getZ(i) / 18)); const v = t * t; col[i * 3] = v; col[i * 3 + 1] = v; col[i * 3 + 2] = v; }
    beamGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xf0f4ff, vertexColors: true, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });"""
assert a in s; s=s.replace(a,b)

# lights on the car glow: tail lights and lenses over the bloom line
a="""    let out = m;
    if (m.name === 'paint' || m.color.getHex() === PAL.pearl) {"""
b="""    let out = m;
    if (m.emissive && m.emissiveIntensity > 0 && m.emissive.getHex() !== 0) {
      out = m.clone();
      out.emissiveIntensity = m.emissive.getHex() === PAL.tailRed ? 3.2 : 2.2;
      upgraded.set(m, out); return out;
    }
    if (m.name === 'paint' || m.color.getHex() === PAL.pearl) {"""
assert a in s; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s); print('main patched')

p='game/src/world.js'; s=open(p,encoding='utf-8').read()
# sodium pools, a little tighter
a="""      g.addColorStop(0, 'rgba(255,200,120,0.7)'); g.addColorStop(0.3, 'rgba(255,180,95,0.34)'); g.addColorStop(1, 'rgba(255,160,80,0)');"""
b="""      g.addColorStop(0, 'rgba(255,165,70,0.72)'); g.addColorStop(0.3, 'rgba(255,150,60,0.34)'); g.addColorStop(1, 'rgba(255,135,50,0)');"""
assert a in s; s=s.replace(a,b)
a="""      this.pool(hx, y, hz, 11.5, 1.0);"""
b="""      this.pool(hx, y, hz, 10, 1.0);"""
assert a in s; s=s.replace(a,b)
# a cleaner asphalt grain
a="""    const grain = (rnd() - 0.5) * 22;"""
b="""    const grain = (rnd() - 0.5) * 10;"""
assert a in s; s=s.replace(a,b)
# the night tint: unlit ground and foliage go cool and dark, the way skylight drowns warm albedo
a="""  /** How bright the lamp pools are: 0 by day, 1 at night. */
  setNight(n) { if (this._poolMat) this._poolMat.opacity = 1.0 * n; }"""
b="""  /** Night: lamp pools come up, and the ground and foliage take a cool dark tint so warm albedo does not read as daylight. */
  setNight(n) {
    if (this._poolMat) this._poolMat.opacity = 1.0 * n;
    if (!this._tinted) {
      this._tinted = [];
      const grab = (mat) => { if (mat && mat.color && !this._tinted.some((t) => t.mat === mat)) this._tinted.push({ mat, base: mat.color.clone() }); };
      grab(this.groundMat); grab(this.roadMat);
      for (const name of ['maple', 'shrub', 'broadleaf', 'cedar']) { const tpl = this.templates[name]; if (tpl) tpl.traverse((o) => { if (o.isMesh && o.material && /foliage/.test(o.material.name)) grab(o.material); }); }
      this._mapleMats && this._mapleMats.forEach((m) => grab(m));
    }
    const k = n;
    for (const t of this._tinted) {
      const g = t.mat === this.groundMat ? [0.42, 0.55, 0.95] : t.mat === this.roadMat ? [0.62, 0.70, 0.95] : [0.40, 0.52, 0.92];
      t.mat.color.setRGB(t.base.r * (1 + (g[0] - 1) * k), t.base.g * (1 + (g[1] - 1) * k), t.base.b * (1 + (g[2] - 1) * k));
    }
  }"""
assert a in s; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s); print('world patched')

p='game/index.html'; s=open(p,encoding='utf-8').read()
a="""  #crt { position:fixed; inset:0; z-index:11; pointer-events:none; opacity:.55;
         background: repeating-linear-gradient(0deg, rgba(0,0,0,.10) 0px, rgba(0,0,0,.10) 1px, transparent 1px, transparent 3px),
                     radial-gradient(ellipse at center, rgba(0,0,0,0) 62%, rgba(4,6,14,.55) 100%); }"""
b="""  #crt { position:fixed; inset:0; z-index:11; pointer-events:none; opacity:.4;
         background: repeating-linear-gradient(0deg, rgba(0,0,0,.07) 0px, rgba(0,0,0,.07) 1px, transparent 1px, transparent 4px),
                     radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(4,6,14,.6) 100%); }"""
assert a in s; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s); print('html patched')
