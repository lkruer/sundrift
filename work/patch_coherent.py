# ---------------------------------------------------------------- config: a wider road, a kinder wall
p='game/src/config.js'; s=open(p,encoding='utf-8').read()
for a,b in [
 ("  halfWidth: 3.6,        // asphalt half width (7.2 m two-lane mountain road)", "  halfWidth: 4.4,        // asphalt half width (8.8 m: a generous two-lane pass)"),
 ("  railOffset: 4.55,      // guardrail / cutting face distance from the centreline", "  railOffset: 5.5,       // guardrail / cutting face distance from the centreline"),
 ("  crashSpeed: 4.5,       // m/s of lateral impact that drops the held drift", "  crashSpeed: 6.0,       // m/s of lateral impact that drops the held drift"),
]:
    assert a in s, a[:40]; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s); print('config patched')

# ---------------------------------------------------------------- track: wider hairpins, old road kept further away
p='game/src/track.js'; s=open(p,encoding='utf-8').read()
a="      const w = ROAD.railOffset + 1.6 * Math.sin(Math.PI * t);"
b="      const w = ROAD.railOffset + 2.4 * Math.sin(Math.PI * t);"
assert a in s; s=s.replace(a,b)
a="        if ((x - q.x) * (x - q.x) + (z - q.z) * (z - q.z) < 15 * 15) return true;"
b="        if ((x - q.x) * (x - q.x) + (z - q.z) * (z - q.z) < 40 * 40) return true;"
assert a in s; s=s.replace(a,b)
a="    const cx = Math.floor(x / 24), cz = Math.floor(z / 24);"
b="    const cx = Math.floor(x / 24), cz = Math.floor(z / 24);   // cells are 24 m, so two cells each way covers 40 m"
assert a in s; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s); print('track patched')

# ---------------------------------------------------------------- world
p='game/src/world.js'; s=open(p,encoding='utf-8').read()

# road markings follow the new width
a="""      const onEdge = Math.abs(au - 3.35) < 0.075;"""
b="""      const onEdge = Math.abs(au - (HALF - 0.25)) < 0.075;"""
assert a in s; s=s.replace(a,b)

# chunks: kept while near, rebuilt when old road comes back into view, and built a phase per frame
a="""  update(s) {
    const ci = Math.floor(s / ROAD.chunkLen);
    const lo = ci - ROAD.behind, hi = ci + ROAD.ahead;
    for (const [k, c] of this.chunks) if (k < lo || k > hi) { this.dropChunk(c); this.chunks.delete(k); }
    for (let i = Math.max(0, lo); i <= hi; i++) if (!this.chunks.has(i)) { this.buildChunk(i); return true; }
    return false;
  }

  /** Build everything the first frame needs, synchronously. */
  prime(s) { for (let i = 0; i < 40 && this.update(s); i++) {} }"""
b="""  update(s, x = null, z = null) {
    const ci = Math.floor(s / ROAD.chunkLen);
    const lo = ci - ROAD.behind, hi = ci + ROAD.ahead;
    const near = (k) => {
      if (x === null) return false;
      const p = this.track.sample((k + 0.5) * ROAD.chunkLen);
      return (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z) < 330 * 330;
    };
    // drop what is behind, unless it is still close by (the pass doubles back on itself)
    for (const [k, c] of this.chunks) if ((k < lo || k > hi) && !near(k)) { this.dropChunk(c); this.chunks.delete(k); }
    // one build phase per frame, never more, so a chunk never costs a whole frame
    if (this._job) {
      const r = this._job.it.next();
      if (r.done) { this._job = null; }
      return true;
    }
    for (let i = Math.max(0, lo); i <= hi; i++) if (!this.chunks.has(i)) { this._job = { ci: i, it: this.buildSteps(i) }; this._job.it.next(); return true; }
    // old road that has come back into view
    if (x !== null) for (let k = Math.max(0, ci - 40); k < lo; k++) if (!this.chunks.has(k) && near(k)) { this._job = { ci: k, it: this.buildSteps(k) }; this._job.it.next(); return true; }
    return false;
  }

  /** Build everything the first frame needs, synchronously. */
  prime(s) {
    for (let n = 0; n < 60; n++) {
      if (this._job) { while (!this._job.it.next().done) {} this._job = null; }
      if (!this.update(s)) break;
    }
    if (this._job) { while (!this._job.it.next().done) {} this._job = null; }
  }

  buildChunk(ci) { const it = this.buildSteps(ci); let r; do { r = it.next(); } while (!r.done); return r.value; }"""
assert a in s; s=s.replace(a,b)

a="""  buildChunk(ci) {
    const t = this.track;
    const s0 = ci * ROAD.chunkLen, s1 = s0 + ROAD.chunkLen;
    t.ensure(s1 + 600);
    this.planMarkers();"""
b="""  /** The chunk build, in phases: the caller advances it one phase per frame. */
  *buildSteps(ci) {
    if (this.chunks.has(ci)) return this.chunks.get(ci);
    const t = this.track;
    const s0 = ci * ROAD.chunkLen, s1 = s0 + ROAD.chunkLen;
    t.ensure(s1 + 600);
    this.planMarkers();"""
assert a in s; s=s.replace(a,b)
a="""    group.add(this.buildRoad(i0, i1, own));
    group.add(this.buildTerrain(i0, i1, +1, own));
    group.add(this.buildTerrain(i0, i1, -1, own));
    const tube = this.buildTunnel(i0, i1, own); if (tube) group.add(tube);
"""
b="""    group.add(this.buildRoad(i0, i1, own));
    yield;
    group.add(this.buildTerrain(i0, i1, +1, own));
    yield;
    group.add(this.buildTerrain(i0, i1, -1, own));
    const tube = this.buildTunnel(i0, i1, own); if (tube) group.add(tube);
    yield;
"""
assert a in s; s=s.replace(a,b)
a="""    this.placeRailsAndPoles(i0, i1, group, own, place, rng);
    this.placeProps(i0, i1, s0, s1, place, rng, ci);
    this.placePoles(s0, s1, place, ci);
    this.placeSetPieces(s0, s1, place, rng, ci);
    this.placeStuds(i0, i1, group);
    statics.updateMatrixWorld(true);
    const baked = bakeStatic(statics);"""
b="""    this.placeRailsAndPoles(i0, i1, group, own, place, rng);
    this.placeProps(i0, i1, s0, s1, place, rng, ci);
    this.placePoles(s0, s1, place, ci);
    this.placeSetPieces(s0, s1, place, rng, ci);
    this.placeStuds(i0, i1, group);
    yield;
    statics.updateMatrixWorld(true);
    const baked = bakeStatic(statics);"""
assert a in s; s=s.replace(a,b)
a="""    this.placeTrees(i0, i1, s0, s1, group, rng);

    this.root.add(group);
    this.chunks.set(ci, c);
    return c;
  }"""
b="""    yield;
    this.placeTrees(i0, i1, s0, s1, group, rng);

    this.root.add(group);
    this.chunks.set(ci, c);
    return c;
  }

  /** True where another stretch of road is nearer than this tree's own: the terrain there was folded away. */
  folded(x, z, i, u) {
    const n = this.track.nearestScan(x, z, i, 90);
    return Math.abs(n.i - i) > 10 && n.d < Math.abs(u) - 2;
  }"""
assert a in s; s=s.replace(a,b)

# trees: never at a fold, never on a lamp
a="""          const uu = u + (rng() - 0.5) * 5;
          const [x, , z] = this.at(p, uu * side + (rng() - 0.5) * 2);
          if (t.onRoad(x, z, i, 2.5)) continue;"""
b="""          const uu = u + (rng() - 0.5) * 5;
          const [x, , z] = this.at(p, uu * side + (rng() - 0.5) * 2);
          if (t.onRoad(x, z, i, 2.5) || this.folded(x, z, i, uu)) continue;"""
assert a in s; s=s.replace(a,b)
a="""        // the accent trees at the road's edge: maples and a looser broadleaf, red a minority
        if (!tun && !(lay && lay.side === side) && rng() < 0.5) {
          const u = mountainHere > 0.5 ? RAIL + 2.2 + rng() * 5 : RAIL + 1.4 + rng() * 3;
          const [x, , z] = this.at(p, u * side);
          if (t.onRoad(x, z, i, 1.2)) continue;"""
b="""        // the accent trees at the road's edge: maples and a looser broadleaf, red a minority; not on a lamp
        const lampNear = Math.abs(((p.s % 30) + 30) % 30 - 15) > 11.5;
        if (!tun && !lampNear && !(lay && lay.side === side) && rng() < 0.5) {
          const u = mountainHere > 0.5 ? RAIL + 2.2 + rng() * 5 : RAIL + 1.4 + rng() * 3;
          const [x, , z] = this.at(p, u * side);
          if (t.onRoad(x, z, i, 1.2) || this.folded(x, z, i, u)) continue;"""
assert a in s; s=s.replace(a,b)
a="""          const u = RAIL + 7 + rng() * 6;
          const [x, , z] = this.at(p, u * side);
          if (t.onRoad(x, z, i, 2.5)) continue;"""
b="""          const u = RAIL + 7 + rng() * 6;
          const [x, , z] = this.at(p, u * side);
          if (t.onRoad(x, z, i, 2.5) || this.folded(x, z, i, u)) continue;"""
assert a in s; s=s.replace(a,b)
a="""        const [x, , z] = this.at(p, u * side + (rng() - 0.5) * 1.2);
        if (t.onRoad(x, z, i, 0.6)) continue;"""
b="""        const [x, , z] = this.at(p, u * side + (rng() - 0.5) * 1.2);
        if (t.onRoad(x, z, i, 0.6) || this.folded(x, z, i, u)) continue;"""
assert a in s; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s); print('world patched')

# ---------------------------------------------------------------- main: pass the car position to the streamer, pause the sun's shadows at night, slower sky rebuilds
p='game/src/main.js'; s=open(p,encoding='utf-8').read()
a="""  world.update(G.s);
  world.updateFar(car.x, road.y, car.z);"""
b="""  world.update(G.s, car.x, car.z);
  world.updateFar(car.x, road.y, car.z);"""
assert a in s; s=s.replace(a,b)
a="""  if (sunTimer < 2.5 && moved < 0.12) return;"""
b="""  const deepNight = G.night > 0.98;
  if (sunTimer < (deepNight ? 7 : 2.5) && moved < 0.12) return;"""
assert a in s; s=s.replace(a,b)
a="""  if (rig.hemi && night.hemiDay) rig.hemi.intensity = night.hemiDay * (1 - 0.66 * nightAmt);"""
b="""  if (rig.hemi && night.hemiDay) rig.hemi.intensity = night.hemiDay * (1 - 0.66 * nightAmt);
  // the sun's cascaded shadow maps are pure cost once the sun is down: stop refreshing them until dawn
  const sunDown = nightAmt > 0.98;
  if (sunDown !== G.sunDown) {
    G.sunDown = sunDown;
    scene.traverse((o) => {
      if (!o.isDirectionalLight || o === night.moon || !o.shadow) return;
      o.shadow.autoUpdate = !sunDown;
      if (!sunDown) o.shadow.needsUpdate = true;
    });
  }"""
assert a in s; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s); print('main patched')
