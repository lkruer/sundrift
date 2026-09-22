# ---------------------------------------------------------------- track: the road must never cross itself
p='game/src/track.js'; s=open(p,encoding='utf-8').read()
a="""    this._sinceHairpin = 0; this._sinceSet = 120;
    this._lastType = 'straight';
    this.pts.push(this._point('straight'));
  }"""
b="""    this._sinceHairpin = 0; this._sinceSet = 120;
    this._lastType = 'straight';
    this._cells = new Map();     // coarse grid of sample indices, so a new feature can see old road
    this._snap = null; this._retries = 0; this._forceDir = 0;
    this.pts.push(this._point('straight'));
    this._cell(0);
  }

  _cellKey(x, z) { return Math.floor(x / 24) + ',' + Math.floor(z / 24); }
  _cell(i) { const p = this.pts[i]; const k = this._cellKey(p.x, p.z); const c = this._cells.get(k); if (c) c.push(i); else this._cells.set(k, [i]); }

  /** True when (x, z) is within 30 m of road older than 120 m, looking at the nine cells around it. */
  _collides(x, z, newestOk) {
    const cx = Math.floor(x / 24), cz = Math.floor(z / 24);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const c = this._cells.get((cx + dx) + ',' + (cz + dz)); if (!c) continue;
      for (const j of c) {
        if (j >= this.pts.length || j > newestOk) continue;
        const q = this.pts[j];
        if ((x - q.x) * (x - q.x) + (z - q.z) * (z - q.z) < 30 * 30) return true;
      }
    }
    return false;
  }"""
assert a in s; s=s.replace(a,b)
a="""    while (this._s < sMax) {
      if (!this._pending.length) this._plan();
      const seg = this._pending[0];"""
b="""    while (this._s < sMax) {
      if (!this._pending.length) {
        // a snapshot at the start of every feature, so a feature that runs into old road can be undone
        this._snap = { x: this._x, z: this._z, h: this._h, k: this._k, y: this._y, s: this._s, grade: this._grade, mount: this._mount,
          mountTarget: this._mountTarget, ptsLen: this.pts.length, markersLen: this.markers.length, featuresLen: this.features.length,
          sinceHairpin: this._sinceHairpin, sinceSet: this._sinceSet, lastType: this._lastType };
        this._plan();
      }
      const seg = this._pending[0];"""
assert a in s; s=s.replace(a,b)
a="""        this.pts.push(p);
      }
      this._pending.shift();
    }
  }"""
b="""        this.pts.push(p);
        this._cell(this.pts.length - 1);
        // ran into road laid more than 120 m ago: undo this feature and plan it the other way
        if (this._retries < 6 && this._collides(p.x, p.z, this._snap.ptsLen - 60)) {
          const S = this._snap;
          this.pts.length = S.ptsLen; this.markers.length = S.markersLen; this.features.length = S.featuresLen;
          Object.assign(this, { _x: S.x, _z: S.z, _h: S.h, _k: S.k, _y: S.y, _s: S.s, _grade: S.grade, _mount: S.mount, _mountTarget: S.mountTarget,
            _sinceHairpin: S.sinceHairpin, _sinceSet: S.sinceSet, _lastType: S.lastType });
          const lastDir = this.features.length ? this.features[this.features.length - 1].dir : 1;
          this._forceDir = this._retries % 2 === 0 ? -(seg.dir || lastDir) : (seg.dir || lastDir);
          this._forceType = this._retries >= 2 ? 'sweeper' : null;
          this._retries++;
          this._pending = [];
          break;
        }
      }
      if (this._pending.length) { this._pending.shift(); if (!this._pending.length) this._retries = 0; }
    }
  }"""
assert a in s; s=s.replace(a,b)
a="""    const dir = r() < 0.5 ? 1 : -1;        // +1 left"""
b="""    if (this._forceType) { type = this._forceType; this._forceType = null; }
    const dir = this._forceDir || (r() < 0.5 ? 1 : -1);        // +1 left
    this._forceDir = 0;"""
assert a in s; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s); print('track patched')

# ---------------------------------------------------------------- world: road width follows the wall; lamps closer, pools wider
p='game/src/world.js'; s=open(p,encoding='utf-8').read()
a="""    const us = [-RAIL, -HALF, 0, HALF, RAIL];
    const n = i1 - i0 + 1, cols = us.length;
    const pos = new Float32Array(n * cols * 3), uv = new Float32Array(n * cols * 2);
    const idx = [];
    for (let k = 0; k < n; k++) {
      const p = pts[i0 + k];
      const lx = Math.cos(p.h), lz = -Math.sin(p.h);
      for (let j = 0; j < cols; j++) {
        const u = us[j], o = (k * cols + j);"""
b="""    const cols = 5;
    const n = i1 - i0 + 1;
    const pos = new Float32Array(n * cols * 3), uv = new Float32Array(n * cols * 2);
    const idx = [];
    for (let k = 0; k < n; k++) {
      const p = pts[i0 + k];
      const lx = Math.cos(p.h), lz = -Math.sin(p.h);
      const us = [-p.wr, -HALF, 0, HALF, p.wl];             // the shoulder reaches the wall, wider through a hairpin
      for (let j = 0; j < cols; j++) {
        const u = us[j], o = (k * cols + j);"""
assert a in s; s=s.replace(a,b)
a="""        uv[o * 2] = (u + RAIL) / (2 * RAIL); uv[o * 2 + 1] = p.s / 12;"""
b="""        uv[o * 2] = clamp((u + RAIL) / (2 * RAIL), 0, 1); uv[o * 2 + 1] = p.s / 12;"""
assert a in s; s=s.replace(a,b)
a="""      for (let j = 0; j < cols; j++) {
        let u = US[j];
        let h;
        if (folded) {"""
b="""      const wallShift = (side > 0 ? p.wl : p.wr) - RAIL;     // the terrain starts where the road's shoulder ends
      for (let j = 0; j < cols; j++) {
        let u = US[j] + wallShift;
        let h;
        if (folded) {"""
assert a in s; s=s.replace(a,b)
a="""    for (let sl = Math.ceil(s0 / 36) * 36; sl < s1; sl += 36) {"""
b="""    for (let sl = Math.ceil(s0 / 30) * 30; sl < s1; sl += 30) {"""
assert a in s; s=s.replace(a,b)
a="""      const side = (Math.round(sl / 36) % 2 === 0) ? 1 : -1;"""
b="""      const side = (Math.round(sl / 30) % 2 === 0) ? 1 : -1;"""
assert a in s; s=s.replace(a,b)
a="""      this.pool(hx, y, hz, 10, 1.0);"""
b="""      this.pool(hx, y, hz, 15, 1.0);"""
assert a in s; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s); print('world patched')

# ---------------------------------------------------------------- car: the line assist, and A/D scaled to the corner
p='game/src/car.js'; s=open(p,encoding='utf-8').read()
a="""  assistTouch: 0.78,"""
b="""  assistTouch: 0.78,
  lineAssist: 0.55,               // hands off the keys, the car follows the road; 0 is none
  lineAssistTouch: 0.7,"""
assert a in s; s=s.replace(a,b)
a="""    const target = clamp(playerSteer + assistAngle, -P.maxSteer, P.maxSteer);"""
b="""    // the line: with no key held the car follows the road, and A or D commits to the corner with as much lock as
    // the corner needs (a hairpin gets full lock, a gentle curve half), so a slide stays on the road and the
    // combo keeps going instead of ending on the rail
    let lineSteer = 0, gain = 1;
    const L = inp.line;
    if (L && speed > 4) {
      const velHead = this.yaw + this.beta;
      let e = L.roadHeading - velHead; while (e > Math.PI) e -= 2 * Math.PI; while (e < -Math.PI) e += 2 * Math.PI;
      const want = Math.atan(L.curv * L_) * 1.15 + e * 0.5 - L.lat * 0.02;
      const hands = Math.min(1, Math.abs(inp.steer) * 1.4);
      lineSteer = clamp(want, -0.32, 0.32) * (inp.touch ? P.lineAssistTouch : P.lineAssist) * (1 - hands) * (this.vF > 0 ? 1 : 0);
      gain = clamp(Math.abs(L.curv) * 30 + Math.abs(e) * 1.2 + 0.15, 0.55, 1.0);
    }
    const target = clamp(playerSteer * gain + lineSteer + assistAngle, -P.maxSteer, P.maxSteer);"""
assert a in s; s=s.replace(a,b)
a="""    const g = 9.81, m = P.mass, L = P.a + P.b;"""
b="""    const g = 9.81, m = P.mass, L_ = P.a + P.b, L = L_;"""
assert a in s; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s); print('car patched')

# ---------------------------------------------------------------- main: the line data, the light around the hero, the night level
p='game/src/main.js'; s=open(p,encoding='utf-8').read()
a="""  car.step(dt, inp, surface);"""
b="""  inp.line = { roadHeading: p.h, lat: n.u, curv: track.sample(G.s + 12 + car.speed * 0.55).k };
  car.step(dt, inp, surface);"""
assert a in s; s=s.replace(a,b)
a="""      out.emissiveIntensity = m.emissive.getHex() === PAL.tailRed ? 3.2 : 2.2;"""
b="""      out.emissiveIntensity = m.emissive.getHex() === PAL.tailRed ? 6.0 : 2.6;"""
assert a in s; s=s.replace(a,b)
a="""    const sp = new THREE.SpotLight(0xf6f8ff, 0, 46, 0.42, 0.6, 1.4);"""
b="""    const sp = new THREE.SpotLight(0xf6f8ff, 0, 52, 0.56, 0.55, 1.3);"""
assert a in s; s=s.replace(a,b)
a="""  beams.userData.mat = beamMat;
  carRoot.add(beams);"""
b="""  beams.userData.mat = beamMat;
  carRoot.add(beams);
  // spill: the road around the car is lit by its own lamps, so the hero always sits inside light
  const spill = new THREE.PointLight(0xfff1dc, 0, 16, 1.6);
  spill.position.set(0, 0.5, 1.4);
  carRoot.add(spill); night.spill = spill;
  const tailGlow = new THREE.PointLight(0xff3020, 0, 7, 1.8);
  tailGlow.position.set(0, 0.55, -2.4);
  carRoot.add(tailGlow); night.tailGlow = tailGlow;"""
assert a in s; s=s.replace(a,b)
a="""  if (night.moon) night.moon.intensity = 0.5 * nightAmt;
  if (night.glow) night.glow.material.opacity = 0.30 * smoothstep(-0.5, -5, el);
  if (rig.hemi && night.hemiDay) rig.hemi.intensity = night.hemiDay * (1 - 0.82 * nightAmt);"""
b="""  if (night.moon) night.moon.intensity = 0.85 * nightAmt;
  if (night.glow) night.glow.material.opacity = 0.42 * smoothstep(-0.5, -5, el);
  if (night.spill) night.spill.intensity = 34 * nightAmt;
  if (night.tailGlow) night.tailGlow.intensity = 9 * nightAmt;
  if (rig.hemi && night.hemiDay) rig.hemi.intensity = night.hemiDay * (1 - 0.66 * nightAmt);"""
assert a in s; s=s.replace(a,b)
a="""  post.render(dt);"""
b="""  post.cel.uniforms.uSpeed.value = car ? clamp((car.speed - 8) / 32, 0, 1) * (1 + 0.6 * clamp(car.boost / 1.2, 0, 1)) : 0;
  post.render(dt);"""
assert a in s; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s); print('main patched')

# ---------------------------------------------------------------- post: a radial motion cue at speed
p='game/src/post.js'; s=open(p,encoding='utf-8').read()
a="""    uInk: { value: 1.0 }, uBands: { value: 1.0 }, uGrain: { value: 0.035 }, uScan: { value: 0.06 },"""
b="""    uInk: { value: 1.0 }, uBands: { value: 1.0 }, uGrain: { value: 0.035 }, uScan: { value: 0.06 }, uSpeed: { value: 0 },"""
assert a in s; s=s.replace(a,b)
a="""    uniform sampler2D tDiffuse, tDepth; uniform vec2 uRes; uniform float uNear, uFar, uTime, uInk, uBands, uGrain, uScan;"""
b="""    uniform sampler2D tDiffuse, tDepth; uniform vec2 uRes; uniform float uNear, uFar, uTime, uInk, uBands, uGrain, uScan, uSpeed;"""
assert a in s; s=s.replace(a,b)
a="""      vec2 px = 1.0 / uRes;
      vec3 c = texture2D(tDiffuse, vUv).rgb;"""
b="""      vec2 px = 1.0 / uRes;
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // speed: the edges of the frame smear toward the centre, the way a drift anime draws speed
      vec2 toC = vUv - vec2(0.5, 0.42);
      float edge = smoothstep(0.12, 0.5, dot(toC, toC));
      if (uSpeed > 0.01 && edge > 0.001) {
        vec3 acc = c; float wsum = 1.0;
        for (int i = 1; i <= 5; i++) { float t = float(i) / 5.0; vec2 uv2 = vUv - toC * t * 0.05 * uSpeed * edge; acc += texture2D(tDiffuse, uv2).rgb; wsum += 1.0; }
        c = acc / wsum;
      }"""
assert a in s; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s); print('post patched')
