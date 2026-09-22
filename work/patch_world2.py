p='game/src/world.js'; s=open(p,encoding='utf-8').read()

a="""  vending: './assets/vending_machine.js', shrub: './assets/roadside_shrub.js', broadleaf: './assets/broadleaf_tree.js',
};
const SURFACED = new Set(['boulder', 'post', 'pole', 'lamp', 'mirror', 'chevron', 'torii', 'lantern', 'portal', 'hut', 'vending']);"""
b="""  vending: './assets/vending_machine.js', shrub: './assets/roadside_shrub.js', broadleaf: './assets/broadleaf_tree.js',
  catseye: './assets/cats_eye.js', upole: './assets/power_pole.js', bamboo: './assets/bamboo_clump.js', bare: './assets/bare_tree.js',
  conbini: './assets/conbini.js', busstop: './assets/bus_shelter.js',
};
const SURFACED = new Set(['boulder', 'post', 'pole', 'lamp', 'mirror', 'chevron', 'torii', 'lantern', 'portal', 'hut', 'vending', 'upole', 'conbini', 'busstop']);"""
assert a in s; s=s.replace(a,b)

# markers: the store and the bus stop join the rotation
a="""      } else if (m.kind === 'hut' || m.kind === 'vista') {
        t.terraces.push({ s0: m.s - 4, s1: m.s + 34, side: -m.side, u0: RAIL - 0.3, u1: RAIL + 10, h: -0.02, mountain: false, layby: true });
      }"""
b="""      } else if (m.kind === 'hut' || m.kind === 'vista' || m.kind === 'busstop') {
        t.terraces.push({ s0: m.s - 4, s1: m.s + 34, side: -m.side, u0: RAIL - 0.3, u1: RAIL + 10, h: -0.02, mountain: false, layby: true });
      } else if (m.kind === 'conbini') {
        t.terraces.push({ s0: m.s - 6, s1: m.s + 44, side: -m.side, u0: RAIL - 0.3, u1: RAIL + 17, h: -0.02, mountain: false, layby: true });
      }"""
assert a in s; s=s.replace(a,b)

# set pieces: the store and the bus stop
a="""      } else if (m.kind === 'tunnel') {
        for (const [s, flip] of [[m.s, Math.PI], [m.s + TUNNEL_LEN, 0]]) {"""
b="""      } else if (m.kind === 'conbini') {
        const side = -m.side;
        const face = (p) => p.h + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
        const p1 = t.sample(m.s + 8), p2 = t.sample(m.s + 20), p3 = t.sample(m.s + 32);
        const y = p2.y - 0.02;
        { const [x, , z] = this.at(p2, (RAIL + 11.5) * side); place('conbini', x, y, z, face(p2)); }
        { const [x, , z] = this.at(p1, (RAIL + 7.6) * side); place('vending', x, y, z, face(p1)); }
        { const [x, , z] = this.at(p1, (RAIL + 6.4) * side); place('vending', x + Math.sin(p1.h) * 1.3, y, z + Math.cos(p1.h) * 1.3, face(p1)); }
        for (const p of [p1, p3]) { const [x, , z] = this.at(p, (RAIL + 8.6) * side); place('lamp', x, y, z, face(p) + Math.PI); this.lamps.push({ x, y: y + 5.8, z, ci }); this.pool(x, y, z, 10, 1); }
        for (let k = 0; k < 6; k++) { const p = t.sample(m.s - 2 + k * 8); const [x, , z] = this.at(p, (RAIL + 16.2) * side); place('pole', x, y, z, face(p)); }
        { const [x, , z] = this.at(p3, (RAIL + 14) * side); place('bare', x, y, z, rng() * 6, 0.9); }
      } else if (m.kind === 'busstop') {
        const side = -m.side;
        const face = (p) => p.h + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
        const p1 = t.sample(m.s + 10), p2 = t.sample(m.s + 18);
        const y = p1.y - 0.02;
        { const [x, , z] = this.at(p1, (RAIL + 3.0) * side); place('busstop', x, y, z, face(p1)); }
        { const [x, , z] = this.at(p2, (RAIL + 6.5) * side); place('bare', x, y, z, rng() * 6, 1.0); }
        { const [x, , z] = this.at(p2, (RAIL + 2.2) * side); place('lamp', x, y, z, face(p2) + Math.PI); this.lamps.push({ x, y: y + 5.8, z, ci }); this.pool(x, y, z, 9, 1); }
        for (let k = 0; k < 3; k++) { const p = t.sample(m.s + 24 + k * 4); const [x, , z] = this.at(p, (RAIL + 6 + rng() * 3) * side); place('bamboo', x, y, z, rng() * 6, 0.8 + rng() * 0.3); }
      } else if (m.kind === 'tunnel') {
        for (const [s, flip] of [[m.s, Math.PI], [m.s + TUNNEL_LEN, 0]]) {"""
assert a in s; s=s.replace(a,b)

# shrines get bamboo behind the torii
a="""        for (let k = 0; k < 3; k++) { const p = t.sample(m.s - 2 + k * 13); const [x, , z] = this.at(p, (RAIL + 8 + rng() * 5) * side); place('maple', x, h, z, rng() * 6, 0.9 + rng() * 0.3, 1, k === 1 ? PAL.mapleGold : PAL.mapleRed); }"""
b="""        for (let k = 0; k < 3; k++) { const p = t.sample(m.s - 2 + k * 13); const [x, , z] = this.at(p, (RAIL + 8 + rng() * 5) * side); place('maple', x, h, z, rng() * 6, 0.9 + rng() * 0.3, 1, k === 1 ? PAL.mapleGold : PAL.mapleRed); }
        for (let k = 0; k < 4; k++) { const p = t.sample(m.s + 2 + k * 7); const [x, , z] = this.at(p, (RAIL + 13.5 + rng() * 2) * side); place('bamboo', x, h, z, rng() * 6, 0.85 + rng() * 0.35); }"""
assert a in s; s=s.replace(a,b)

# power poles with sagging wires, and cat's eyes, in placeProps
a="""  /** A warm additive pool of light on the ground under a lamp, so the string of lamps reads at any distance. */"""
b="""  /** Concrete utility poles every 44 m on the mountain side, with two sagging wires strung between them. */
  placePoles(s0, s1, place, ci) {
    const t = this.track;
    if (!this._wireMat) { this._wireMat = new THREE.MeshStandardMaterial({ color: 0x1f2024, roughness: 0.8, metalness: 0.2 }); }
    for (let sp = Math.ceil((s0 - 14) / 44) * 44 + 14; sp < s1; sp += 44) {
      if (sp < s0) continue;
      const p = t.sample(sp);
      if (p.tunnel || this.nearTunnel(p.s, 10)) { this._lastPole = null; continue; }
      const side = p.mount >= 0 ? 1 : -1;
      const lay = t.terraceAt(p.s);
      if (lay && lay.side === side) { this._lastPole = null; continue; }
      const w = side > 0 ? p.wl : p.wr;
      const [x, , z] = this.at(p, (w + 1.7) * side);
      const y = t.groundAt(x, z, t.index(p.s)) - 0.1;
      const ry = p.h - Math.PI / 2;                       // the cross-arm runs along the road
      place('upole', x, y, z, ry);
      const fx = Math.sin(p.h), fz = Math.cos(p.h);
      const ins = [-0.36, 0.36].map((d) => new THREE.Vector3(x + fx * d, y + 8.55, z + fz * d));
      const prev = this._lastPole;
      if (prev && prev.ci >= ci - 1 && prev.pts[0].distanceTo(ins[0]) < 60) {
        for (let k = 0; k < 2; k++) {
          const a0 = prev.pts[k], b0 = ins[k];
          const mid = a0.clone().lerp(b0, 0.5); mid.y -= 0.75;
          const curve = new THREE.CatmullRomCurve3([a0, mid, b0]);
          const geo = new THREE.TubeGeometry(curve, 10, 0.022, 4, false);
          const m = new THREE.Mesh(geo, this._wireMat);
          this._statics.add(m);
        }
      }
      this._lastPole = { pts: ins, ci };
    }
  }

  /** Cat's-eye studs: white on the centre line every 12 m, red at the edges, facing the driver. */
  placeStuds(i0, i1, group) {
    const t = this.track, pts = t.pts;
    const items = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
    const put = (p, u, ry) => {
      const [x, y, z] = this.at(p, u, 0.01);
      q.setFromAxisAngle(v.set(0, 1, 0), ry); m4.compose(v.set(x, y, z), q, sc); items.push({ m: m4.clone() });
    };
    for (let i = i0; i < i1; i += 6) {                  // every 12 m
      const p = pts[i];
      put(p, 0, p.h);                                    // white lens toward the driver
      if (i % 12 === 0) { put(p, HALF - 0.25, p.h + Math.PI); put(p, -(HALF - 0.25), p.h + Math.PI); }   // red at the edges
    }
    this.instance(group, 'catseye', items, false);
  }

  /** A warm additive pool of light on the ground under a lamp, so the string of lamps reads at any distance. */"""
assert a in s; s=s.replace(a,b)

a="""    this.placeRailsAndPoles(i0, i1, group, own, place, rng);
    this.placeProps(i0, i1, s0, s1, place, rng, ci);
    this.placeSetPieces(s0, s1, place, rng, ci);"""
b="""    this.placeRailsAndPoles(i0, i1, group, own, place, rng);
    this.placeProps(i0, i1, s0, s1, place, rng, ci);
    this.placePoles(s0, s1, place, ci);
    this.placeSetPieces(s0, s1, place, rng, ci);
    this.placeStuds(i0, i1, group);"""
assert a in s; s=s.replace(a,b)

# bare trees mixed into the accent ranks (no tint), and a little bamboo on the mountain slope
a="""          const pick = rng();
          if (rng() < 0.45) {
            const colour = pick < 0.5 ? PAL.mapleGold : pick < 0.85 ? PAL.dryGrass : PAL.mapleOrange;
            put(broad, x, y, z, rng() * Math.PI * 2, 0.8 + rng() * 0.45, { colour });
          } else {"""
b="""          const pick = rng();
          const kind = rng();
          if (kind < 0.18) {
            put(bare, x, y, z, rng() * Math.PI * 2, 0.8 + rng() * 0.4, {});
          } else if (kind < 0.55) {
            const colour = pick < 0.5 ? PAL.mapleGold : pick < 0.85 ? PAL.dryGrass : PAL.mapleOrange;
            put(broad, x, y, z, rng() * Math.PI * 2, 0.8 + rng() * 0.45, { colour });
          } else {"""
assert a in s; s=s.replace(a,b)
a="""    const cedars = [], maplesA = [], broad = [], shrubs = [];"""
b="""    const cedars = [], maplesA = [], broad = [], shrubs = [], bare = [], bamboos = [];"""
assert a in s; s=s.replace(a,b)
a="""          const colour = pick < 0.4 ? PAL.mapleGold : pick < 0.7 ? PAL.mapleOrange : pick < 0.85 ? PAL.dryGrass : PAL.mapleRed;
          put(pick < 0.5 ? broad : maplesA, x, y, z, rng() * 6, 0.7 + rng() * 0.4, { colour });"""
b="""          const colour = pick < 0.4 ? PAL.mapleGold : pick < 0.7 ? PAL.mapleOrange : pick < 0.85 ? PAL.dryGrass : PAL.mapleRed;
          if (rng() < 0.12) put(bamboos, x, y, z, rng() * 6, 0.8 + rng() * 0.4, {});
          else put(pick < 0.5 ? broad : maplesA, x, y, z, rng() * 6, 0.7 + rng() * 0.4, { colour });"""
assert a in s; s=s.replace(a,b)
a="""    this.instance(group, 'broadleaf', broad, true, true);
    this.instance(group, 'shrub', shrubs, false, true);"""
b="""    this.instance(group, 'broadleaf', broad, true, true);
    this.instance(group, 'shrub', shrubs, false, true);
    this.instance(group, 'bare', bare, true);
    this.instance(group, 'bamboo', bamboos, true);"""
assert a in s; s=s.replace(a,b)

# the valley: a town of lights far below, always around
a="""    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    this.far = g; this.scene.add(g);
  }"""
b="""    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    // a town in the valley: clusters of warm points far below, and the red lamp of a mast
    const N = 900, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const towns = [[520, -420, 260], [-700, 300, 180], [200, 900, 140]];
    for (let i = 0; i < N; i++) {
      const tw = towns[i % towns.length];
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * tw[2];
      pos[i * 3] = tw[0] + Math.cos(a) * r; pos[i * 3 + 1] = -156 + rng() * 6; pos[i * 3 + 2] = tw[1] + Math.sin(a) * r;
      const warm = rng() < 0.85;
      col[i * 3] = warm ? 1.0 : 0.7; col[i * 3 + 1] = warm ? 0.72 + rng() * 0.2 : 0.85; col[i * 3 + 2] = warm ? 0.35 : 1.0;
    }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.town = new THREE.Points(tg, new THREE.PointsMaterial({ size: 2.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    this.town.frustumCulled = false;
    g.add(this.town);
    this.far = g; this.scene.add(g);
  }"""
assert a in s; s=s.replace(a,b)
a="""  setNight(n) {
    if (this._poolMat) this._poolMat.opacity = 1.0 * n;"""
b="""  setNight(n) {
    if (this._poolMat) this._poolMat.opacity = 1.0 * n;
    if (this.town) this.town.material.opacity = 0.9 * n;"""
assert a in s; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s); print('world patched')

p='game/src/track.js'; s=open(p,encoding='utf-8').read()
a="""      const kinds = ['shrine', 'vista', 'tunnel', 'hut', 'tunnel', 'shrine', 'vista', 'hut'];"""
b="""      const kinds = ['shrine', 'busstop', 'tunnel', 'conbini', 'hut', 'tunnel', 'shrine', 'vista', 'busstop', 'conbini'];"""
assert a in s; s=s.replace(a,b); open(p,'w',encoding='utf-8').write(s); print('track patched')
