p='game/src/world.js'; s=open(p,encoding='utf-8').read()

# the bake in two phases
a="""    yield;
    statics.updateMatrixWorld(true);
    const baked = bakeStatic(statics);
    baked.traverse((o) => { if (o.isMesh) { own.add(o.geometry); o.castShadow = true; o.receiveShadow = true; } });
    group.add(baked);"""
b="""    yield;
    statics.updateMatrixWorld(true);
    // the bake is the heavy phase, so it is done in two halves on two frames
    const kids = [...statics.children];
    const halfA = new THREE.Group(), halfB = new THREE.Group();
    kids.forEach((k, i) => (i % 2 ? halfB : halfA).add(k));
    halfA.updateMatrixWorld(true); halfB.updateMatrixWorld(true);
    const bakedA = bakeStatic(halfA);
    bakedA.traverse((o) => { if (o.isMesh) { own.add(o.geometry); o.castShadow = true; o.receiveShadow = true; } });
    group.add(bakedA);
    yield;
    const baked = bakeStatic(halfB);
    baked.traverse((o) => { if (o.isMesh) { own.add(o.geometry); o.castShadow = true; o.receiveShadow = true; } });
    group.add(baked);"""
assert a in s; s=s.replace(a,b)

# precompile every program the world can ask for, once, at boot
a="""  /** How bright the lamp pools are: 0 by day, 1 at night. */"""
if a not in s:
    a="""  /** Night: lamp pools come up, and the ground and foliage take a cool dark tint so warm albedo does not read as daylight. */"""
b="""  /**
   * Compile every shader program the world can ask for, now, so the first convenience store or bamboo clump
   * to enter the frame does not stall the game for a second while its materials compile.
   */
  precompile(renderer, camera) {
    const stage = new THREE.Group();
    const m4 = new THREE.Matrix4();
    for (const name of Object.keys(this.templates)) {
      const tpl = this.templates[name]; if (!tpl) continue;
      const clone = tpl.clone(true); clone.position.set(0, -500, 0);
      stage.add(clone);
      tpl.traverse((o) => {
        if (!o.isMesh) return;
        const im = new THREE.InstancedMesh(o.geometry, o.material, 1);
        im.setMatrixAt(0, m4.identity()); if (o.material.name === 'foliage_tinted') im.setColorAt(0, new THREE.Color(0xffffff));
        im.position.set(0, -500, 0); im.castShadow = true;
        stage.add(im);
      });
    }
    if (this._mapleMats) for (const m of this._mapleMats.values()) stage.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m));
    for (const m of [this.tunnelMat, this.tunnelLampMat, this._wireMat, this._poolMat, this._bulbMat]) if (m) { const x = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m); x.position.y = -500; stage.add(x); }
    this.scene.add(stage);
    try { renderer.compile(this.scene, camera); } catch (e) { console.warn('precompile', e.message); }
    this.scene.remove(stage);
  }

""" + a
assert a in s; s=s.replace(a,b,1)
open(p,'w',encoding='utf-8').write(s); print('world patched')

p='game/src/main.js'; s=open(p,encoding='utf-8').read()
a="""  // compile every shader variant now, not on the first frame that needs it
  try { renderer.compile(scene, camera); } catch (e) { console.warn('compile', e.message); }"""
b="""  // compile every shader variant now, not on the first frame that needs it
  world.mapleMat(PAL.mapleRed); world.mapleMat(PAL.mapleGold);
  world.precompile(renderer, camera);
  try { renderer.compile(scene, camera); } catch (e) { console.warn('compile', e.message); }"""
assert a in s; s=s.replace(a,b)
a="""  const deepNight = G.night > 0.98;
  if (sunTimer < (deepNight ? 7 : 2.5) && moved < 0.12) return;"""
b="""  // below the rig's own clamp of -12 degrees the sky does not change at all, so a rebuild (30 ms) is skipped
  const elOf = (h) => Math.max(-12, 62 * Math.sin(Math.PI * (h - 6) / 12));
  if (elOf(G.hour) <= -12 && elOf(G.hourShown) <= -12 && G.sunApplied) return;
  if (sunTimer < 2.5 && moved < 0.12) return;"""
assert a in s; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s); print('main patched')
