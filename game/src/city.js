/**
 * NEO TOKYO: the city along the road, for the city courses (track.city).
 *
 * The road is the same ribbon; what changes is everything beside it. Each chunk lines both sides with street-front
 * buildings (instanced unit boxes, scaled per lot, their windows drawn by the building shader from world position
 * so a floor is a floor at any size), fixes vertical and horizontal neon signs to their fronts (every sign of a
 * chunk is one merged mesh over one atlas), and lays the neon's light on the street: a coloured pool on the
 * pavement and, on a wet road, a long streak down the asphalt, the reflection a wet Tokyo street is made of.
 * Square corners get zebra crossings, a painted STOP, and a signal on the outside of the turn.
 *
 * Everything here runs at build level with the chunk and is owned by it (the world disposes what is in ch.own).
 */
import * as THREE from 'three';
import { clamp, lerp, mulberry32 } from './config.js?v=202609240808';
import { buildingMaterial } from './buildings.js?v=202609240808';
import { neonAtlas } from './neon.js?v=202609240808';
import { cityPropMaterials, lotProps, parkingProps, siteProps, streetProps, bollardGeometry, streetItems } from './cityprops.js?v=202609240808';
import { detailLoad, detailBegin, detailLot, detailChunk, detailUpdate, detailWet, poleSpots, archPosts } from './citydetail.js?v=202609240808';
import { railSkip } from './citytrain.js?v=202609240808';
import { carsLoad, parkCar } from './citycars.js?v=202609240808';
import { steamLoad, steamChunk, steamWeather } from './citysteam.js?v=202609240808';
import { peopleLoad, peopleChunk, peopleWeather } from './citypeople.js?v=202609240808';

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
// the points of a lot's footprint tested against the roads: [along the front (-0.5..0.5 of its width), in (0..1 of its depth)]
const FIT = [[-0.5, 0], [0, 0], [0.5, 0], [-0.5, 0.35], [0.5, 0.35], [0, 0.5], [-0.5, 0.7], [0.5, 0.7], [-0.5, 1], [0, 1], [0.5, 1]];
// how much room each of the pavement's loose things takes (metres round its middle)
const ITEM_R = { bag: 0.28, crate: 0.3, crates: 0.3, box: 0.3, cone: 0.22, aboard: 0.35, bike: 0.6 };
// the share of them left out, so their pools stay under their caps (measured along 5 km: bags 1,600 of 1,600, bikes
// 700 of 700, on HARD the cones 400 of 400, before)
const THIN = { bag: 0.32, bike: 0.4, cone: 0.1 };

// facade colours: concrete, tile, dark glass and the odd painted block, and the pale tile a Tokyo street is so much of (by
// day the street was all dark greys; at night a pale wall takes the neon's colour)
const FACADES = [0x55565c, 0x6b6a66, 0x7a746a, 0x3c3f47, 0x4a4e57, 0x8a8478, 0x5c5048, 0x2f3440, 0x6e6a74, 0x44474d,
  0xa6a39b, 0xb9a68b, 0xc9c7c2, 0xb08a7c];
// a tower over a podium: glass and pale concrete
const TOWERS = [0x2f3440, 0x3c3f47, 0x4a4e57, 0x6e6a74, 0x8c8983, 0x2d3b54];

/** The city road: darker asphalt to a concrete gutter, solid white edge lines, the orange no-passing pair. */
export function cityRoadTexture(half, wall) {
  const W = 256, H = 1024, LEN = 48;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const rv = document.createElement('canvas'); rv.width = W; rv.height = H;
  const ctx = cv.getContext('2d'), rctx = rv.getContext('2d');
  const img = ctx.createImageData(W, H), rimg = rctx.createImageData(W, H);
  let seed = 11;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const patches = [];
  for (let k = 0; k < 6; k++) patches.push({ u0: -half + rnd() * (2 * half - 2), du: 0.8 + rnd() * 2.4, v0: rnd() * LEN, dv: 1.5 + rnd() * 5 });
  const holes = [[half * 0.45, 9], [-half * 0.5, 31]];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = ((x + 0.5) / W) * 2 * wall - wall, au = Math.abs(u), vm = (y / H) * LEN;
    const grain = (rnd() - 0.5) * 12;
    let c = [0x2b + grain, 0x2c + grain, 0x31 + grain], rough = 0.58 + 0.06 * rnd();
    const wear = 1 - 0.07 * Math.exp(-Math.pow((au - half * 0.4) / 0.55, 2));
    c = c.map((v) => v * wear);
    for (const p of patches) if (u > p.u0 && u < p.u0 + p.du && vm > p.v0 && vm < p.v0 + p.dv) { c = c.map((v) => v * 0.82); rough = 0.66; }
    for (const [hu, hv] of holes) { const d = Math.hypot(u - hu, vm - hv); if (d < 0.32) { c = d > 0.27 ? [0x5a, 0x5a, 0x5c] : [0x24, 0x24, 0x27].map((v) => v + ((Math.floor((u - hu) * 18) + Math.floor((vm - hv) * 18)) & 1) * 10); rough = 0.4; } }
    if (au > wall - 0.32) { c = [0x74 + grain, 0x72 + grain, 0x6d + grain]; rough = 0.8; }                    // the concrete gutter
    else if (Math.abs(au - (wall - 0.55)) < 0.07) { c = [0xe4, 0xe2, 0xda].map((v) => v + grain * 0.4); rough = 0.5; }  // edge line
    else if (au > 0.08 && au < 0.22) { c = [0xe8, 0xa4, 0x2a].map((v) => v * (0.92 + 0.08 * rnd())); rough = 0.5; }   // the orange pair
    // an avenue wide enough for two lanes a side: the white dashes between them, 4 m on and 4 m off
    else if (half > 5.4 && Math.abs(au - half * 0.5) < 0.075 && (vm % 8) < 4) { c = [0xde, 0xdc, 0xd4].map((v) => v * (0.9 + 0.1 * rnd())); rough = 0.52; }
    const i = (y * W + x) * 4;
    img.data[i] = clamp(c[0], 0, 255); img.data[i + 1] = clamp(c[1], 0, 255); img.data[i + 2] = clamp(c[2], 0, 255); img.data[i + 3] = 255;
    const r = clamp(rough * 255, 0, 255);
    rimg.data[i] = r; rimg.data[i + 1] = r; rimg.data[i + 2] = r; rimg.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); rctx.putImageData(rimg, 0, 0);
  const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.ClampToEdgeWrapping; map.wrapT = THREE.RepeatWrapping; map.anisotropy = 8;
  const roughnessMap = new THREE.CanvasTexture(rv); roughnessMap.wrapS = THREE.ClampToEdgeWrapping; roughnessMap.wrapT = THREE.RepeatWrapping;
  return { map, roughnessMap, len: LEN };
}

/** A soft round and a long soft streak, for the light the neon throws on the street. */
function gradientTexture(stretch) {
  const w = 128, h = stretch ? 512 : 128;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x + 0.5) / w * 2 - 1, dy = (y + 0.5) / h * 2 - 1;
    let a;
    if (!stretch) { const r = Math.hypot(dx, dy); a = Math.max(0, 1 - r); a = a * a * (3 - 2 * a) * 0.9; }
    else {
      // a streak: sharp across, fading along, brightest a third of the way down, broken into ripples
      const across = Math.exp(-dx * dx * 9), along = Math.max(0, 1 - Math.abs(dy + 0.25) / 1.25);
      const ripple = 0.72 + 0.28 * Math.sin(dy * 40 + Math.sin(dy * 7) * 3);
      a = across * along * along * ripple;
    }
    const i = (y * w + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = clamp(a * 255, 0, 255);
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Zebra crossing paint: bars along the road, across its whole width (u repeats). */
function zebraTexture() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 128, 64);
  ctx.fillStyle = 'rgba(236,233,224,0.95)';
  ctx.fillRect(10, 2, 58, 60);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

// Neon that is not all steady: now and then a tube that is going stutters, and drops out for a moment before it
// catches; and a few signs blink on purpose. aFlick per vertex: 0 steady, (0, 1) a failing tube (its own seed),
// (1, 2) a blinker. A sign, its light on the pavement and its streak down the wet road flicker together.
const FLICK = /* glsl */`
uniform float uClock;
float neonFlick(float f, float t) {
  if (f <= 0.0) return 1.0;
  if (f > 1.0) {
    float s = f - 1.0;
    float c = mod(t * (0.8 + 0.5 * s) + s * 17.0, 4.0);
    return c < 2.4 ? (fract(c * 1.25) < 0.55 ? 1.0 : 0.1) : 1.0;
  }
  float cyc = t * (0.05 + 0.07 * fract(f * 7.13)) + f * 31.0;
  float k = fract(cyc);
  if (k < 0.86) return 1.0;
  float h = fract(sin(floor(cyc) * 91.7 + f * 473.3) * 43758.5453);
  float st = fract(sin(floor(t * 19.0) * 12.9898 + f * 78.233) * 43758.5453);
  float on = st > 0.42 ? 1.0 : 0.08;
  // (and one time in three it goes out for a second before it catches again)
  if (h > 0.66 && k > 0.94) on = 0.06;
  return on;
}`;

const NL = String.fromCharCode(10);
// (grazing: a reflection on the wet road shows most at a grazing angle, far ahead, and hardly at all looking steeply
// down beside the car, where a streak banded into a flat white pill)
function flickering(mat, w, key, grazing = false) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uClock = w.cityClock;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>' + NL + 'attribute float aFlick;' + NL + 'varying float vFlick;' + NL + FLICK)
      .replace('#include <begin_vertex>', '#include <begin_vertex>' + NL + 'vFlick = neonFlick(aFlick, uClock);')
      .replace('#include <project_vertex>', '#include <project_vertex>' + NL + (grazing ? 'vFlick *= smoothstep(5.0, 16.0, -mvPosition.z);' : ''));
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>' + NL + 'varying float vFlick;')
      .replace('#include <map_fragment>', '#include <map_fragment>' + NL + 'diffuseColor.rgb *= vFlick;');
  };
  mat.customProgramCacheKey = () => key;
}

/**
 * The signals' lamps: every lamp of a chunk in one mesh, and the shader lights one of each signal's three from the
 * city's clock (green ten seconds, amber three, red nine), each signal on its own phase. aLamp 0-2 are the cars'
 * lamps; 3 and 4 the walkers' red and green (green while the cars have red, blinking for its last two seconds); 5 a red
 * aviation light on a tall roof, pulsing slowly on its own phase; 6 a tower's lit crown (uNight); 7 and 8 an
 * expressway delineator, amber and white.
 */
function signalMaterial(w) {
  const lin = (hex) => new THREE.Color(hex).multiplyScalar(2.2);
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uG: { value: lin(0x1ee8a8) }, uY: { value: lin(0xffb21e) }, uR: { value: lin(0xff3322) }, uOff: { value: new THREE.Color(0x15171b) }, uClock: { value: 0 }, uNight: { value: 1 } }]),
    vertexShader: /* glsl */`
      attribute float aLamp;
      attribute float aPhase;
      uniform float uClock;
      uniform vec3 uG, uY, uR, uOff;
      uniform float uNight;
      varying vec3 vCol;
      varying vec2 vUv;
      varying float vMan;
      #include <fog_pars_vertex>
      void main() {
        float T = 22.0, t = mod(uClock + aPhase * T, T);
        float st = t < 10.0 ? 0.0 : t < 13.0 ? 1.0 : 2.0;
        vec3 lit = aLamp < 0.5 ? uG : aLamp < 1.5 ? uY : uR;
        vCol = abs(aLamp - st) < 0.5 ? lit : uOff;
        vMan = 0.0;
        if (aLamp > 2.5 && aLamp < 3.5) { vCol = st < 1.5 ? uR : uOff; vMan = 1.0; }
        else if (aLamp > 3.5 && aLamp < 4.5) { vCol = st > 1.5 && (t < 20.0 || fract(t * 2.0) < 0.5) ? uG : uOff; vMan = 2.0; }
        else if (aLamp > 4.5 && aLamp < 5.5) { float k = max(0.0, sin(uClock * 1.9 + aPhase * 6.2832)); vCol = uR * (0.18 + 1.2 * k * k); }
        else if (aLamp > 5.5 && aLamp < 6.5) {
          // a tower's lit crown, in its own colour (aPhase): lit by night, by day a pale band of glass
          vec3 cc = aPhase < 0.35 ? vec3(1.5, 1.45, 1.35) : aPhase < 0.6 ? vec3(0.45, 1.2, 1.9) : aPhase < 0.8 ? vec3(1.8, 0.45, 1.3) : vec3(1.9, 1.1, 0.4);
          vCol = mix(vec3(0.34, 0.36, 0.4), cc, uNight);
        }
        // the expressway's delineators on its barriers, amber on the right and white on the left
        else if (aLamp > 6.5) vCol = (aLamp < 7.5 ? uY * 0.75 : vec3(1.45, 1.45, 1.4)) * (0.35 + 0.65 * uNight);
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vCol;
      varying vec2 vUv;
      varying float vMan;
      #include <fog_pars_fragment>
      // the walkers' lamps: a figure lit in the lens, standing (red) or striding (green), the rest of the lens dark:
      // the head, the body, and each side's leg and arm (spread from the hip and the shoulder in a stride)
      float man(vec2 q, float walk) {
        float f = step(length(q - vec2(0.0, 0.3)), 0.085);
        vec2 b = q - vec2(0.0, 0.07);
        f = max(f, step(abs(b.x + walk * 0.04 * b.y), 0.075) * step(abs(b.y), 0.13));
        for (int s = 0; s < 2; s++) {
          float sd = float(s) * 2.0 - 1.0;
          vec2 l = q - vec2(sd * (0.045 + walk * 0.02), -0.2);
          f = max(f, step(abs(l.x + walk * sd * 0.55 * l.y), 0.035) * step(abs(l.y), 0.15));
          vec2 a = q - vec2(sd * 0.1, 0.05);
          f = max(f, step(abs(a.x + walk * sd * 0.4 * a.y), 0.03) * step(abs(a.y), 0.12));
        }
        return f;
      }
      void main() {
        vec3 c = vCol;
        if (vMan > 0.5) c *= mix(0.07, 1.0, man(vUv - 0.5, vMan > 1.5 ? 1.0 : 0.0));
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
  });
  m.uniforms.uClock = w.cityClock;
  m.name = 'signal lamps';
  // (a lamp's lens is a centimetre proud of its box, a walker's lamp half that: past 200 m the depth buffer cannot tell
  // them apart and they flickered; a little depth bias keeps them in front)
  m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2;
  return m;
}

/** A lamp of the signals' mesh: which lamp it is (aLamp, see signalMaterial) and its signal's phase, on every vertex. */
function lampAttrs(geo, k, phase) {
  const nv = geo.attributes.position.count;
  geo.setAttribute('aLamp', new THREE.BufferAttribute(new Float32Array(nv).fill(k), 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(nv).fill(phase), 1));
  return geo;
}

/** The city's materials and pools, made once at load (so every program compiles with the rest). */
export function cityLoad(w, Pool, fontFamily) {
  // the city's clock: the signs' flicker, the signals, the steam (kept small for precision)
  w.cityClock = { value: 0 };
  w.bldgMat = buildingMaterial(THREE, {});
  w.bldgMat.userData.tinted = true;
  const unit = new THREE.BoxGeometry(1, 1, 1);                  // centred: an instance sits at its lot's middle
  w.pools.bldg = new Pool([{ geometry: unit, material: w.bldgMat, local: new THREE.Matrix4() }], 1400, { tint: true });
  w.root.add(w.pools.bldg.group);
  const atlas = neonAtlas(fontFamily);
  w.neon = atlas;
  // (biased toward the lens: a sign is two centimetres proud of its housing, and far off the two flickered)
  w.neonMat = new THREE.MeshBasicMaterial({ map: atlas.texture, side: THREE.DoubleSide, color: new THREE.Color(1.7, 1.7, 1.7), transparent: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  w.neonMat.name = 'neon';
  flickering(w.neonMat, w, 'neon-flick1');
  w.neonHousingMat = new THREE.MeshStandardMaterial({ color: 0x1b1c21, roughness: 0.55, metalness: 0.35 });
  const glowTex = gradientTexture(false), streakTex = gradientTexture(true);
  w.neonGlowMat = new THREE.MeshBasicMaterial({ map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, opacity: 0.9 });
  w.streakMat = new THREE.MeshBasicMaterial({ map: streakTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6, opacity: 0.35 });
  flickering(w.neonGlowMat, w, 'neon-glow-flick1');
  flickering(w.streakMat, w, 'neon-streak-flick2', true);
  w.signalPoleMat = new THREE.MeshStandardMaterial({ color: 0x5a5e66, roughness: 0.5, metalness: 0.5 });
  w.signalBoxMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.6, metalness: 0.3 });
  w.signalMat = signalMaterial(w);
  w.zebraMat = new THREE.MeshStandardMaterial({ map: zebraTexture(), transparent: true, depthWrite: false, roughness: 0.55,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  // the street's clutter (cityprops.js), one draw per material per chunk
  w.propMats = cityPropMaterials(THREE);
  // The knockable things' pools draw with copies of these materials, not the materials themselves: the chunks' clutter
  // draws with those as plain meshes, and a material drawn both instanced and not flips between two shader programs,
  // which made three work its program out again at every flip, eight to ten times a frame in the city.
  const inst = {};
  for (const [k, m] of Object.entries(w.propMats)) { const c = m.clone(); c.name = m.name + ' pooled'; inst[k] = c; }
  // the bollards the car can take out: a pool of their own
  {
    const b = bollardGeometry(THREE);
    const m = inst[b.material] || inst.glossy;
    w.pools.bollard = new Pool([{ geometry: b.geometry, material: m, local: new THREE.Matrix4() }], 900);
    w.root.add(w.pools.bollard.group);
    w.parts.bollard = [{ geometry: b.geometry, material: m, local: new THREE.Matrix4() }];
    b.geometry.computeBoundingBox(); const bb = b.geometry.boundingBox;
    w.foot.bollard = [(bb.max.x - bb.min.x) / 2, (bb.max.z - bb.min.z) / 2, bb.max.y - bb.min.y];
  }
  // the pavement's loose things, each a pool the car can knock them out of: bags, crates, boxes, cones, boards, bikes
  // (bags, crates and bicycle frames take their instance's colour through a tinted copy of their material)
  {
    const tint = {};
    for (const k of ['glossy', 'props']) { const m = w.propMats[k].clone(); m.name = w.propMats[k].name + ' tinted'; m.userData.tinted = true; tint[k] = m; }
    w.propMats.glossyTint = tint.glossy; w.propMats.propsTint = tint.props;
    const TINTED = new Set(['bag', 'crate', 'crates', 'bike']);
    const CAP = { bag: 1600, crate: 300, crates: 300, box: 300, cone: 480, aboard: 360, bike: 700 };
    for (const [name, parts0] of Object.entries(streetItems(THREE))) {
      const parts = parts0.map((p) => ({ geometry: p.geometry, local: new THREE.Matrix4(),
        material: TINTED.has(name) && tint[p.material] ? tint[p.material] : (inst[p.material] || inst.props) }));
      w.pools[name] = new Pool(parts, CAP[name] || 300, { tint: TINTED.has(name) });
      w.root.add(w.pools[name].group);
      w.parts[name] = parts;
      const bb = new THREE.Box3();
      for (const p of parts) { p.geometry.computeBoundingBox(); bb.union(p.geometry.boundingBox); }
      w.foot[name] = [(bb.max.x - bb.min.x) / 2, (bb.max.z - bb.min.z) / 2, bb.max.y - bb.min.y];
    }
  }
  // the expressway: concrete deck and piers, Jersey barriers, a lit strip along them, the gantry's steel and its sign
  w.deckMat = new THREE.MeshStandardMaterial({ color: 0x77746f, roughness: 0.93, metalness: 0 });
  w.barrierMat = new THREE.MeshStandardMaterial({ color: 0xa9a59d, roughness: 0.88, metalness: 0 });
  w.stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe2b8).multiplyScalar(1.9) });
  w.gantryMat = new THREE.MeshStandardMaterial({ color: 0x565a62, roughness: 0.5, metalness: 0.55 });
  w.shutoMat = shutoSignMaterial(w);
  // the detail over and along the street (citydetail.js): screens, wires, the pavement
  const detailMats = detailLoad(w, Pool);
  carsLoad(w, Pool);                                              // the parked cars' pool (citycars.js)
  w.steamMat = steamLoad(w);                                      // manholes, vents and roofs (citysteam.js)
  w.peopleMat = peopleLoad(w);                                    // in the alleys and the coin parkings (citypeople.js)
  // (the building material is drawn only instanced, by the buildings' pool and the terrain's blocks: the pool's own
  // instanced program is compiled at load with every pool, so it is not handed over for a plain mesh's program too,
  // which nothing draws and which cost a second compile of the city's biggest shader)
  return [...detailMats, w.neonMat, w.neonHousingMat, w.neonGlowMat, w.streakMat, w.signalPoleMat, w.signalBoxMat, w.signalMat, w.steamMat, w.peopleMat, w.zebraMat,
    ...new Set(Object.values(w.propMats)), w.deckMat, w.barrierMat, w.stripMat, w.gantryMat, w.shutoMat];
}

/** How wet the street is: the neon streaks come up with it. */
export function cityWet(w, wet, night) {
  // (the signs' streaks on a wet road: bright, not blinding; at full strength they were the brightest thing on screen)
  if (w.streakMat) w.streakMat.opacity = (0.2 + 0.42 * wet) * (0.3 + 0.7 * night);
  if (w.neonGlowMat) w.neonGlowMat.opacity = 0.9 * (0.35 + 0.65 * night);
  if (w.bldgMat && w.bldgMat.userData.uNight) w.bldgMat.userData.uNight.value = night;
  if (w.bldgMat && w.bldgMat.userData.uWet) w.bldgMat.userData.uWet.value = wet;
  if (w.signalMat) w.signalMat.uniforms.uNight.value = night;
  detailWet(w, wet);
  steamWeather(w, wet, night);
  peopleWeather(w, wet, night);
}

/**
 * A mesh of coloured light lying on the street: [x, z, along-x, along-z, width, length, hex] draped on the ground,
 * or (onRoad) on the road ribbon itself, whose surface can sit a little above the ground under it.
 */
function drape(w, ch, list, mat, lift, onRoad = false) {
  const g = w.ground, t = w.track, probe = {};
  const hAt = (x, z) => { if (!onRoad) return g.height(x, z); g.sample(x, z, 2.2, probe); return t.sample(probe.s).y; };
  const pos = [], uv = [], col = [], idx = [], fl = [];
  const c = new THREE.Color();
  for (const [cx, cz, ax, az, wid, len, hex, flick] of list) {
    c.set(hex);
    // (a grid of about a metre and a half, 2 to 6 cells a side: a small pool on flat pavement needs no 49 samples of the
    // ground, and the chunk's last build step was a frame's worth of them)
    const N = Math.max(2, Math.min(6, Math.ceil(Math.max(wid, len) / 1.5)));
    const base = pos.length / 3;
    const bx = az, bz = -ax;                      // across
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const a = (j / N - 0.5) * len, b = (i / N - 0.5) * wid;
      const x = cx + ax * a + bx * b, z = cz + az * a + bz * b;
      pos.push(x, hAt(x, z) + lift, z); uv.push(i / N, j / N); col.push(c.r, c.g, c.b); fl.push(flick || 0);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = base + j * (N + 1) + i, b = a + 1, cc = a + N + 1, d = cc + 1;
      idx.push(a, cc, b, b, cc, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aFlick', new THREE.Float32BufferAttribute(fl, 1));
  geo.setIndex(idx); geo.computeBoundingSphere();
  ch.own.add(geo);
  const m = new THREE.Mesh(geo, mat); m.renderOrder = 2; m.name = 'neon light';
  return m;
}

/** Merge simple geometries (position, normal, uv, and any other attribute some of them carry) into one; each is disposed. */
function merge(list) {
  let nv = 0, ni = 0;
  const extra = new Map();
  for (const g of list) {
    nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count;
    for (const [k, a] of Object.entries(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv' && !extra.has(k)) extra.set(k, a.itemSize);
  }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni);
  const ex = new Map([...extra].map(([k, size]) => [k, new Float32Array(nv * size)]));
  let ov = 0, oi = 0;
  for (const g of list) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, ov * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, ov * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, ov * 2);
    for (const [k, arr] of ex) { const a = g.attributes[k]; if (a) arr.set(a.array, ov * a.itemSize); }
    if (g.index) { const a = g.index.array; for (let k = 0; k < a.length; k++) idx[oi++] = a[k] + ov; }
    else for (let k = 0; k < n; k++) idx[oi++] = ov + k;
    ov += n; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  for (const [k, arr] of ex) out.setAttribute(k, new THREE.BufferAttribute(arr, extra.get(k)));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

/** One sign face: a quad through corners a (bottom-left), b (bottom-right), c (top-right), d (top-left) with the atlas cell. */
function signQuad(list, a, b, c, d, cell, flip, flick = 0) {
  const g = new THREE.BufferGeometry();
  const P = [...a, ...b, ...c, ...d];
  const u0 = flip ? cell.u1 : cell.u0, u1 = flip ? cell.u0 : cell.u1;
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, cell.v0, u1, cell.v0, u1, cell.v1, u0, cell.v1], 2));
  g.setAttribute('aFlick', new THREE.Float32BufferAttribute([flick, flick, flick, flick], 1));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  list.push(g);
}

/**
 * The city beside one chunk of road. w is the World; its track, ground, pools and lamps are used directly.
 */
export function* cityChunk(w, ch) {
  const t = w.track, g = w.ground, pts = t.pts;
  const own = ch.c * 2;
  const rng = mulberry32((w.seed * 911 + ch.c * 7331) >>> 0);
  const probe = {};
  const signs = [], housings = [], glows = [], streaks = [], poles = [], boxes = [], lamps = [], zebras = [], paint = [], steam = [], people = [], boardFaces = [], cars = [];
  // (a hash of a place, for what is new here, so the random sequence the street was built from is as it was)
  const h01 = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233 + (w.seed % 1000) * 0.371) * 43758.5453; return x - Math.floor(x); };
  // one sign in eleven is a failing tube, one in twenty-five blinks
  const flickOf = (a, b) => { const f = h01(a, b); return f < 0.09 ? 0.02 + f / 0.09 * 0.96 : f < 0.13 ? 1.02 + (f - 0.09) / 0.04 * 0.96 : 0; };
  const parkSign = w.neon.signs.find((q) => q.name === 'parking');
  const clutter = {};
  let nLots = 0;
  // the screens, wires, shopping street and pavement (citydetail.js) share the chunk's housings and its light
  const D = detailBegin(w, ch, { housings, glows, streaks, boards: boardFaces });
  const vSigns = w.neon.signs.filter((s) => s.vertical), hSigns = w.neon.signs.filter((s) => !s.vertical);
  // (the boards a roof carries: none of the small shop boards, a giant OPEN is not a thing)
  const roofSigns = hSigns.filter((s) => !['parking', 'open', 'open24'].includes(s.name));
  const beacons = [];
  const s0 = pts[ch.i0].s, s1 = pts[ch.i1].s;
  const at = (s, u) => { const p = t.sample(s); const lx = Math.cos(p.h), lz = -Math.sin(p.h); return [p.x + lx * u, p.z + lz * u, p]; };
  const clearAt = (x, z, need) => { g.sample(x, z, 2.2, probe); return probe.edge > need && !probe.tunnel; };
  // what stands where: the chunk's building footprints [x, z, along x, along z, half width, half depth] (a person or a
  // loose thing on the pavement must never end up inside one), and the solid things on the pavement [x, z, r]
  const foots = [], solids = [];
  const addFoot = (cx, cz, h, W, D) => foots.push([cx, cz, Math.sin(h), Math.cos(h), W / 2, D / 2]);
  const inFoot = (x, z, m) => {
    for (const [cx, cz, ax, az, hw, hd] of foots) {
      const dx = x - cx, dz = z - cz;
      if (Math.abs(dx * ax + dz * az) < hw + m && Math.abs(dx * az - dz * ax) < hd + m) return true;
    }
    return false;
  };
  const nearSolid = (x, z, r) => { for (const q of solids) if (Math.hypot(q[0] - x, q[1] - z) < q[2] + r) return true; return false; };
  // a band of light round a tower's top: four faces a hand's breadth proud of its walls, in the signals' mesh
  const crown = (cx, cz, h, hw, hd, y0, y1, ph) => {
    const f = [Math.sin(h), Math.cos(h)], l = [Math.cos(h), -Math.sin(h)];
    for (const [n, half, wid] of [[l, hd, 2 * hw], [[-l[0], -l[1]], hd, 2 * hw], [f, hw, 2 * hd], [[-f[0], -f[1]], hw, 2 * hd]]) {
      const q = new THREE.PlaneGeometry(wid, y1 - y0); q.rotateY(Math.atan2(n[0], n[1]));
      q.translate(cx + n[0] * (half + 0.08), (y0 + y1) / 2, cz + n[1] * (half + 0.08));
      lamps.push(lampAttrs(q, 6, ph));
    }
  };
  // the square corners that start between samples i0 and i1, [where the bend starts, where it ends] (a corner already
  // under way at i0 belongs to the stretch before; one that runs on past i1 is followed on, on final road only)
  const cornersOf = (i0 = ch.i0, i1 = ch.i1) => {
    const out = [];
    let i = Math.max(1, i0);
    while (i < i1 && Math.abs(pts[i].k) >= 1 / 45) i++;
    while (i < i1) {
      if (Math.abs(pts[i].k) < 1 / 45 || pts[i].tunnel) { i++; continue; }
      let j = i; while (j < t.nFinal - 1 && j < i1 + 90 && Math.abs(pts[j].k) >= 1 / 45) j++;
      out.push([pts[i].s, pts[Math.min(j, pts.length - 1)].s, i, j]);
      i = j + 1;
    }
    return out;
  };
  // where a corner's signal stands: its pole on the outside of the approach, 0.9 m past the kerb, 9 m before the bend
  // (p the bend's first sample; sb, where it starts)
  const signalSpot = (p, sb) => {
    const q = t.sample(sb - 9), out = -Math.sign(p.k), wall = out > 0 ? q.wl : q.wr;
    return [q.x + Math.cos(q.h) * out * (wall + 0.9), q.z - Math.sin(q.h) * out * (wall + 0.9)];
  };
  // the building on the inside of a corner, from the corner alone (so the chunks either side know where it stands):
  // [its middle along the road, its side, its width, its depth, and its footprint]; null if the bend is too tight
  const cornerLot = (sa, sb) => {
    const sm = (sa + sb) / 2, p = t.sample(sm), side = Math.sign(p.k), wall = side > 0 ? p.wl : p.wr;
    const Rf = 1 / Math.max(1e-3, Math.abs(p.k)) - wall - 2.9;
    if (Rf < 3.5) return null;
    // (as wide as its front's corners stay 2.2 m off the kerb round the bend)
    const W = 2 * Math.sqrt(1.4 * Rf + 0.49) * 0.96, depth = 11 + h01(sm * 3.9 + 1.7, side) * 9;
    const [cx, cz] = at(sm, side * (wall + 2.9 + depth / 2));
    return { sm, side, W, depth, foot: [cx, cz, Math.sin(p.h), Math.cos(p.h), W / 2 * 0.985, depth / 2] };
  };
  // (the corners' buildings a chunk either side may have put up: nothing of this chunk's may stand in them)
  for (const [sa, sb] of cornersOf(Math.max(1, ch.i0 - 90), Math.min(t.nFinal - 1, ch.i1 + 60))) { const c = cornerLot(sa, sb); if (c) foots.push(c.foot); }

  /**
   * Behind a lay-by's shop, a bus stop or a shrine's ground, where the street's lots stand back: buildings along the back of
   * the set piece's pad, so it sits in the city instead of on an empty lot. Their fronts face the road over the pad, with
   * the clutter of their upper floors, and now and then a big screen over it all.
   */
  const backdropLot = (side, sm, lotW, p, mk) => {
    const pad = mk.u1 !== undefined ? mk : t.pads.find((q) => q.fi === mk.fi && q.side === side);
    // (not behind a shrine: its pagoda wants the far towers' lit windows behind it, not a dark wall)
    if (!pad || pad.kind === 'shrine' || railSkip(w, sm, side, lotW / 2)) return false;
    const u0 = pad.u1 + 1.6, depth = 8 + h01(sm * 2.3, side) * 5;
    const bx0 = Math.cos(p.h) * side, bz0 = -Math.sin(p.h) * side, bfx = Math.sin(p.h), bfz = Math.cos(p.h);
    for (const [ds, du] of FIT) {
      const a = ds * lotW, u = u0 + du * depth;
      if (!clearAt(p.x + bfx * a + bx0 * u, p.z + bfz * a + bz0 * u, 3.0)) return false;
    }
    const H = 12 + Math.floor(h01(sm * 3.1, side) * 9) * 3.4 + (h01(sm * 1.9, side) - 0.5) * 0.3;
    const [cx, cz] = at(sm, side * (u0 + depth / 2));
    _q.setFromAxisAngle(_up, p.h + Math.PI / 2);
    _s.set(lotW * 0.985, H + 0.3, depth);
    _m4.compose(_v.set(cx, g.height(cx, cz) - 0.3 + (H + 0.3) / 2, cz), _q, _s);
    w.pools.bldg.add(own, _m4, FACADES[Math.floor(h01(sm * 4.3, side) * FACADES.length)]);
    addFoot(cx, cz, p.h, lotW * 0.985, depth);
    const lx = Math.cos(p.h) * side, lz = -Math.sin(p.h) * side, fx = Math.sin(p.h), fz = Math.cos(p.h);
    const [frontX, frontZ] = at(sm, side * u0), fy = g.height(frontX, frontZ);
    if (w.propMats) lotProps(THREE, { x: frontX, z: frontZ, y: fy, fx, fz, lx, lz, width: lotW * 0.985, depth, height: H, shop: false }, rng, clutter);
    if (H >= 18 && lotW >= 8 && h01(sm * 5.9, side) < 0.55) {
      const sw = Math.min(lotW - 2, 5 + h01(sm * 6.3, side) * 4), sh = sw * 0.5, y0 = fy + 7.7 + Math.floor(h01(sm * 7.1, side) * 2) * 3.4;
      if (y0 + sh < fy + H - 1.2) {
        D.screen([frontX - lx * 0.34, y0, frontZ - lz * 0.34], [-lx, -lz], sw, sh, Math.floor(h01(sm * 8.1, side) * 997) + 0.5, 0);
        const hb = new THREE.BoxGeometry(sw + 0.3, sh + 0.3, 0.26); hb.rotateY(p.h + Math.PI / 2);
        hb.translate(frontX - lx * 0.18, y0 + sh / 2, frontZ - lz * 0.18); housings.push(hb);
      }
    }
    return true;
  };

  /**
   * One lot: a building (or now and then a coin parking) with its signs, screens, clutter and the life round it. side,
   * the middle of its front sm (along the road), its width, the alley after it; corner: the narrow building on the
   * inside of a square corner, its front cut across the corner. False if nothing stands there.
   */
  const buildLot = (side, sm, lotW, alleyW, corner = false, depth0 = 0) => {
      const p = t.sample(sm);
      if (p.tunnel || t.nearTunnel(p.s, 12)) return false;
      const mk = t.markerAt(p.s, side) || t.padAt(p.s, side);
      if (mk) return backdropLot(side, sm, lotW, p, mk);
      // (an elevated railway runs along some avenues: its viaduct and stations stand where these lots would)
      if (railSkip(w, sm, side, lotW / 2)) return false;
      // the inside of a square corner has no room for a lot (but for the corner's own building)
      if (!corner && Math.abs(p.k) > 1 / 70 && Math.sign(p.k) === side) return false;
      const wall = side > 0 ? p.wl : p.wr;
      const up = p.express && p.elev > 3;                     // beside the viaduct: the towers it weaves between
      const u0 = wall + (up ? 3.4 : 2.9);
      let depth = 10 + rng() * 14;
      if (depth0) depth = depth0;
      // the footprint must clear every road: the one beside it and any other street behind or across. Tested round the
      // box as it will stand (turned to the heading at its middle), its sides too: at a dog-leg the next leg's kerb ran
      // past a side between the corners that were tested, and a building's corner stood a metre from the road
      const bx0 = Math.cos(p.h) * side, bz0 = -Math.sin(p.h) * side, bfx = Math.sin(p.h), bfz = Math.cos(p.h);
      const fits = (dep) => {
        for (const [ds, du] of FIT) {
          const a = ds * lotW, u = u0 + du * dep;
          if (!clearAt(p.x + bfx * a + bx0 * u, p.z + bfz * a + bz0 * u, du === 0 ? 2.2 : 3.0)) return false;
        }
        return true;
      };
      // (and where another street runs close behind, a thin building, as Tokyo squeezes one onto any strip it has, rather
      // than a gap in the street front)
      if (!fits(depth)) { depth = 7; if (!fits(depth)) { depth = 4.6; if (!fits(depth)) return false; } }
      // now and then a coin parking instead of a building: the bays and their cars, the lit P sign, a low block
      // behind (a hash of the lot's place decides, so the rest of the street is as it was)
      const hp = Math.sin(sm * 12.9898 + side * 78.233 + (w.seed % 1000) * 0.113) * 43758.5453;
      if (!up && !corner && w.pools.parked && parkSign && lotW >= 8 && lotW <= 16 && depth >= 12.5 && hp - Math.floor(hp) < 0.075) {
        coinParking(w, ch, { sm, side, lotW, depth, u0, p, at, rng, clutter, signs, housings, glows, D, parkSign, people, h01, clearAt, addFoot, solids, cars });
        // (its way in stays clear: nothing of the pavement's is left standing in front of the bays)
        const [ex, ez] = at(sm, side * (wall + 1.45));
        foots.push([ex, ez, Math.sin(p.h), Math.cos(p.h), lotW * 0.985 / 2 - 1.2, 1.45]);
        return true;
      }
      // and now and then a building site: a hoarding, a frame going up, a crane over it, lit for the night shift
      if (!up && !corner && lotW >= 10.5 && depth >= 12 && h01(sm * 8.9 + 1.1, side) < 0.05) {
        const lx = Math.cos(p.h) * side, lz = -Math.sin(p.h) * side, fx = Math.sin(p.h), fz = Math.cos(p.h);
        const [frontX, frontZ] = at(sm, side * u0), fy = g.height(frontX, frontZ);
        const res = siteProps(THREE, { x: frontX, z: frontZ, y: fy, fx, fz, lx, lz, width: lotW * 0.985, depth }, rng, clutter);
        for (const [x, y, z, sz] of res.lamps) beacons.push([x, y, z, h01(x * 1.3, z * 1.7), sz]);
        w.lamps.push({ x: res.flood[0], y: res.flood[1], z: res.flood[2], c: ch.c, color: 0xe8f0ff, power: 120 });
        const [gx, gz] = at(sm, side * (u0 + depth * 0.45));
        glows.push([gx, gz, fx, fz, depth * 0.8, lotW * 0.85, 0xdfe8ff]);
        const [cx, cz] = at(sm, side * (u0 + depth / 2));
        addFoot(cx, cz, p.h, lotW * 0.985, depth);
        w.detail.stats.sites = (w.detail.stats.sites || 0) + 1;
        return true;
      }
      const r = rng();
      let H = r < 0.55 ? 9 + rng() * 14 : r < 0.88 ? 22 + rng() * 22 : 44 + rng() * 40;
      if (up) H = Math.max(H, p.elev + 10 + rng() * 26);
      const [cx, cz] = at(sm, side * (u0 + depth / 2));
      const gy = g.height(cx, cz) - 0.3;
      // now and then a tall one is a tower set back on a podium of a few storeys: the street keeps its low front of shops
      // and signs, and the skyline steps. Both boxes stand on the ground, so their floors line up, and the tower's foot
      // is inside the podium
      const hq = h01(sm * 2.9 + 4.4, side), setback = 3 + h01(sm * 4.1, side) * 3, inset = 1.2 + h01(sm * 3.3, side) * 1.3;
      const podium = !up && H >= 38 && lotW >= 10.5 && depth - setback - 1 >= 7 && hq < 0.5;
      // the front's height (a podium: 11.9, 15.3 or 18.7 m, and a hand's breadth either way, so two podiums that meet
      // round a corner never share a roof's plane)
      const Hf = podium ? 11.9 + Math.floor(hq * 6) * 3.4 + (h01(sm * 1.7, side) - 0.5) * 0.3 : H;
      // turned by the heading plus a quarter, the unit box's x runs along the road and its z across it
      _q.setFromAxisAngle(_up, p.h + Math.PI / 2);
      _s.set(lotW * 0.985, Hf + 0.3, depth);
      _m4.compose(_v.set(cx, gy + (Hf + 0.3) / 2, cz), _q, _s);
      w.pools.bldg.add(own, _m4, FACADES[Math.floor(rng() * FACADES.length)]);
      addFoot(cx, cz, p.h, lotW * 0.985, depth);
      let tw = lotW * 0.985, tx = cx, tz = cz;
      if (podium) {
        const td = depth - setback - 1;
        tw -= 2 * inset;
        [tx, tz] = at(sm, side * (u0 + setback + td / 2));
        _s.set(tw, H + 0.3, td);
        _m4.compose(_v.set(tx, gy + (H + 0.3) / 2, tz), _q, _s);
        w.pools.bldg.add(own, _m4, TOWERS[Math.floor(h01(sm * 5.7, side) * TOWERS.length)]);
      }

      const lx = Math.cos(p.h) * side, lz = -Math.sin(p.h) * side;     // toward the building from the road
      const fx = Math.sin(p.h), fz = Math.cos(p.h);                     // along the road
      const [frontX, frontZ] = at(sm, side * u0);
      const fy = g.height(frontX, frontZ);
      // a vertical sign standing out from the front at one end of the lot, faces along the street
      let vEdge = 0, vColour = 0xffc890;
      if (rng() < 0.72 && Hf > 8) {
        const cell = vSigns[Math.floor(rng() * vSigns.length)];
        const scale = Math.min(1, (Hf - 4.2) / cell.h);
        const sw = cell.w * scale, sh = cell.h * scale;
        const edge = (rng() < 0.5 ? -1 : 1) * (lotW * 0.5 - 0.7);
        vEdge = Math.sign(edge);
        const bx = frontX + fx * edge, bz = frontZ + fz * edge;
        const yb = Math.max(fy + 3.4 + rng() * Math.max(0, Hf - 4.2 - sh - 3.4) * 0.5, up ? p.y - 1 + rng() * 3 : -1e9), yt = yb + sh;
        const out0 = -0.15, out1 = -0.15 - sw;                           // from the facade out over the pavement
        const P = (u, y, d) => [bx + lx * u + fx * d, y, bz + lz * u + fz * d];
        // (on the left of the road the sign's outer end is on a driver's right, so the cell is mirrored to read)
        const flick = flickOf(sm * 1.7 + 3.1, side);
        vColour = cell.colour;
        signQuad(signs, P(out1, yb, -0.14), P(out0, yb, -0.14), P(out0, yt, -0.14), P(out1, yt, -0.14), cell, side > 0, flick);
        signQuad(signs, P(out0, yb, 0.14), P(out1, yb, 0.14), P(out1, yt, 0.14), P(out0, yt, 0.14), cell, side > 0, flick);
        // the housing: across the road (the sign's width) by the sign's height, thin along the road
        const hb = new THREE.BoxGeometry(sw + 0.12, sh + 0.18, 0.24);
        hb.rotateY(p.h); hb.translate(bx + lx * (out0 + out1) / 2, (yb + yt) / 2, bz + lz * (out0 + out1) / 2);
        housings.push(hb);
        const gx = bx - lx * (1.2 + sw), gz = bz - lz * (1.2 + sw);
        glows.push([gx, gz, fx, fz, 7, 7, cell.colour, flick]);
        // on the road, the sign's reflection: a streak down the asphalt toward the car coming up it
        const [rx, rz] = at(sm + edge - 5, side * (wall - 1.8 - rng() * 1.5));
        streaks.push([rx, rz, fx, fz, 1.6 + sw * 0.6, 9 + sh * 0.6, cell.colour, flick]);
        if (rng() < 0.5) w.lamps.push({ x: gx, y: yb + 1.2, z: gz, c: ch.c, color: cell.colour, power: 110 });
      }
      // a lit sign over the shop front, facing the road
      let hTop = 0;
      if (rng() < 0.55) {
        const cell = hSigns[Math.floor(rng() * hSigns.length)];
        const sw = Math.min(lotW - 1.2, cell.w), sh = cell.h * (sw / cell.w);
        const yb = fy + 3.1 + rng() * 0.8, yt = yb + sh;
        hTop = yt - fy;
        const P = (d, y) => [frontX - lx * 0.06 + fx * d, y, frontZ - lz * 0.06 + fz * d];
        const flick = flickOf(sm * 2.3 + 11.7, side);
        // seen from the road: left to right is against the road's direction on the left side
        if (side > 0) signQuad(signs, P(-sw / 2, yb), P(sw / 2, yb), P(sw / 2, yt), P(-sw / 2, yt), cell, false, flick);
        else signQuad(signs, P(sw / 2, yb), P(-sw / 2, yb), P(-sw / 2, yt), P(sw / 2, yt), cell, false, flick);
        const [gx, gz] = at(sm, side * (wall + 0.8));
        glows.push([gx, gz, fx, fz, 6, Math.max(6, sw + 3), cell.colour, flick]);
      }
      // the building's clutter: air conditioners, pipes, fire escapes, balconies, roof tanks, awnings, lanterns
      // its screens (a big one on the upper floors, a vertical LED tower, a billboard on the roof) come first: the
      // clutter keeps clear of them
      // (on a podium only its roof in front of the tower is roof)
      const roofD = podium ? setback : depth;
      const clear = detailLot(w, D, { s: sm, side, W: lotW * 0.985, D: roofD, H: Hf, up, x: frontX, z: frontZ, y: fy, fx, fz, lx, lz, wall, vEdge, hTop, chamfer: corner });
      // (a lit board on the roof, decided now: the roof's own clutter, its tanks and plant, keeps off a roof that has one)
      const roofSign = !up && !clear.roof && Hf >= 11 && Hf <= 46 && lotW >= 8 && h01(sm * 6.7 + 2.9, side) < (w.detail.phone ? 0.16 : 0.24);
      if (roofSign) clear.roof = true;
      // a vending machine against the front now and then (one in two of them: the machines' pool was full, 90 of 90,
      // and a chunk built ahead of the car got none); the lot's plants and pipes keep out of its way
      let vendX = null;
      if (rng() < 0.2 && w.pools.vending) {
        const vxl = (rng() - 0.5) * lotW * 0.5;
        if (h01(sm * 5.1 + 0.3, side) < 0.55) { vendX = vxl; clear.boxes.push([vxl - 0.75, vxl + 0.75, -1, 2.3]); }
      }
      if (w.propMats) lotProps(THREE, { x: frontX, z: frontZ, y: fy, fx, fz, lx, lz, width: lotW * 0.985, depth: roofD, height: Hf, shop: !up, clear }, rng, clutter);
      const Q = (a, i, y) => [frontX + fx * a + lx * i, y, frontZ + fz * a + lz * i];     // along the front, in, up
      // the tower over a podium: a big screen on its face above the shops, the way the towers over a crossing have them
      if (podium && h01(sm * 7.9 + 0.7, side) < 0.55) {
        const sw = Math.min(tw - 1.6, 6 + h01(sm * 8.7, side) * 5), sh = sw * 0.5, y0 = fy + Hf + 2 + h01(sm * 9.3, side) * 6;
        if (y0 + sh < fy + H - 2) {
          D.screen(Q(0, setback - 0.32, y0), [-lx, -lz], sw, sh, Math.floor(h01(sm * 1.3, side) * 997) + 0.5, 0);
          const hb = new THREE.BoxGeometry(sw + 0.3, sh + 0.3, 0.26); hb.rotateY(p.h + Math.PI / 2);
          const hc = Q(0, setback - 0.16, y0 + sh / 2); hb.translate(hc[0], hc[1], hc[2]); housings.push(hb);
        }
      }
      // a big lit sign standing on the roof's front edge (a podium's, in front of its tower) on a steel frame, turned
      // toward the traffic coming up the street, its back boarded
      if (roofSign) {
        const cell = roofSigns[Math.floor(h01(sm * 8.3, side) * roofSigns.length)];
        const k = Math.min((lotW - 1.4) / cell.w, 1.5 + h01(sm * 9.1, side) * 0.7);
        const sw = cell.w * k, sh = cell.h * k, room = roofD - 1;
        let a = 0.3 + h01(sm * 9.7, side) * 0.25;
        while (a > 0.02 && 0.6 + sw * Math.sin(a) > room) a -= 0.04;
        const n = [-lx * Math.cos(a) - fx * Math.sin(a), -lz * Math.cos(a) - fz * Math.sin(a)], right = [n[1], -n[0]];
        const span = sw / 2 * Math.cos(a), xs = (h01(sm * 4.9, side) - 0.5) * Math.max(0, lotW - 1 - 2 * span);
        const roofY = fy + Hf, legH = 1.1 + h01(sm * 6.1, side) * 0.8;
        const c = Q(xs, 0.6 + sw / 2 * Math.sin(a), roofY + legH);
        const E = (t, y) => [c[0] + right[0] * sw * t, y, c[2] + right[1] * sw * t];
        signQuad(signs, E(-0.5, c[1]), E(0.5, c[1]), E(0.5, c[1] + sh), E(-0.5, c[1] + sh), cell, false, flickOf(sm * 3.7 + 5.3, side));
        const ry = Math.atan2(-right[1], right[0]);
        const back = new THREE.BoxGeometry(sw + 0.16, sh + 0.16, 0.16); back.rotateY(ry);
        back.translate(c[0] - n[0] * 0.1, c[1] + sh / 2, c[2] - n[1] * 0.1); housings.push(back);
        for (const t of [-0.4, 0, 0.4]) {
          const [px, , pz] = E(t, 0), leg = new THREE.BoxGeometry(0.12, legH + 0.1, 0.12);
          leg.translate(px - n[0] * 0.14, roofY + legH / 2, pz - n[1] * 0.14); housings.push(leg);
        }
        const rail = new THREE.BoxGeometry(sw, 0.06, 0.6); rail.rotateY(ry); rail.translate(c[0] + n[0] * 0.15, c[1] - 0.12, c[2] + n[1] * 0.15); housings.push(rail);
      }
      // red aviation lights on the tallest roofs, at the corners toward the street
      const top = podium ? H : Hf;
      if (top >= 44) {
        const [bx, bz] = podium ? [Q(0, setback + 0.3, 0)[0], Q(0, setback + 0.3, 0)[2]] : [Q(0, 0.3, 0)[0], Q(0, 0.3, 0)[2]];
        for (const e of [-1, 1]) beacons.push([bx + fx * e * (tw / 2 - 0.3), fy + top + 0.3, bz + fz * e * (tw / 2 - 0.3), h01(sm + e * 3.1, side)]);
        // and now and then a band of light round its top, the way the towers over a crossing are lit at night
        const hc = h01(sm * 6.3 + 7.1, side);
        if (hc < 0.45) {
          const td = podium ? depth - setback - 1 : depth;
          crown(podium ? tx : cx, podium ? tz : cz, p.h, tw / 2, td / 2, fy + top - 1.7, fy + top - 0.55, hc / 0.45);
        }
      }
      // a kitchen's vent in the shop front now and then, puffing steam out over the pavement, lit by the sign
      if (!up && h01(sm * 3.1 + 5.5, side) < 0.2) {
        const ve = (vEdge ? -vEdge : h01(sm * 0.7, side) < 0.5 ? -1 : 1) * (lotW * 0.5 - 1.1);
        const vx = frontX + fx * ve, vz = frontZ + fz * ve, vy = fy + 2.35;
        const vb = new THREE.BoxGeometry(0.2, 0.42, 0.62); vb.rotateY(p.h); vb.translate(vx - lx * 0.1, vy, vz - lz * 0.1); housings.push(vb);
        steam.push([vx - lx * 0.25, vy, vz - lz * 0.25, 1, vColour, -lx, -lz]);
      }
      // at the mouth of the alley beside it, now and then, a few people in the light of a back door: past the
      // building line, where the car's wall is, so no car ever reaches them
      // (not near a square corner, where the alley can run in behind the next street's fronts)
      // (and not where the alley runs on into the next chunk, whose first building stands across its end, nor into a
      // railway station)
      alleyW = Math.min(alleyW, s1 - 0.3 - (sm + lotW / 2));
      const sa = sm + lotW / 2 + alleyW / 2;
      const nearCorner = () => { for (let d = -30; d <= 30; d += 3) if (Math.abs(t.sample(sa + d).k) >= 1 / 45) return true; return false; };
      if (!up && alleyW > 2.4 && h01(sm * 5.3 + 9.1, side) < 0.6 && !nearCorner() && !railSkip(w, sa, side, alleyW / 2)) {
        const pa = t.sample(sa);
        const ax = Math.cos(pa.h) * side, az = -Math.sin(pa.h) * side, afx = Math.sin(pa.h), afz = Math.cos(pa.h);
        const aw = side > 0 ? pa.wl : pa.wr, n = 1 + Math.floor(h01(sm * 6.1, side) * 3);
        for (let k = 0; k < n; k++) {
          const along = (h01(sm * 7.3 + k, side) - 0.5) * (alleyW - 1.3), into = aw + 3.9 + h01(sm * 8.9 + k, side) * 2.2;
          const x = pa.x + ax * into + afx * along, z = pa.z + az * into + afz * along;
          // (and clear of every road by more than the car can reach past its kerb: a corner's other leg too)
          if (!clearAt(x, z, 3.4)) continue;
          people.push([x, g.height(x, z), z, Math.floor(h01(sm * 3.7 + k * 1.9, side) * 8), 0xffc890, 0.9]);
        }
        const gx = pa.x + ax * (aw + 4.6), gz = pa.z + az * (aw + 4.6);
        glows.push([gx, gz, afx, afz, Math.max(2.5, alleyW - 0.4), 4.5, 0xffb070]);
      }
      // and a slow plume off the roof of a tall one, lit by the city's glow on the cloud
      if (H > 40 && h01(sm * 4.7 + 1.3, side) < 0.12) steam.push([tx, gy + H + 1.2, tz, 2, 0xd8a6c8, 0, 0]);
      // vending machines on the pavement now and then (where, decided with the lot's clutter)
      if (vendX !== null) {
        const [vx, vz] = at(sm + vendX, side * (u0 - 0.45));
        w._put('vending', own, vx, g.height(vx, vz), vz, p.h + (side > 0 ? -Math.PI / 2 : Math.PI / 2));
        solids.push([vx, vz, 0.62]);
        // its cold white light on the pavement in front of it
        glows.push([vx - lx * 1.1, vz - lz * 1.1, fx, fz, 2.2, 2.6, 0xd6ecff]);
      }
      return true;
  };

  yield;
  for (const side of [1, -1]) {
    // (the first lot starts at the chunk's start, where the chunk before ended its last one)
    let s = s0 + 0.25 + rng() * 0.3;
    while (s < s1) {
      let lotW = 7 + rng() * 11;
      // a lot never runs on into the next chunk, whose own first lot starts there: two boxes sharing one front z-fight.
      // The last lot on a side takes the room that is left (a narrow building), or none
      if (s + lotW > s1 - 0.25) { lotW = s1 - 0.25 - s; if (lotW < 4.5) break; }
      const sm = s + lotW / 2;
      s += lotW + (rng() < 0.14 ? 2.5 + rng() * 5 : 0.35);             // an alley now and then
      // (a lot's clutter is half a millisecond: the chunk is built across frames, a few lots at a time)
      if (buildLot(side, sm, lotW, s - (sm + lotW / 2)) && ++nLots % 4 === 0) yield;
    }
  }
  // the inside of each square corner the chunk has: a narrow building on the corner itself, its front cut across it
  // (sumikiri) and facing the crossing, where the street's lots leave the corner's inside empty. As wide as its front
  // corners stay 2.2 m off the kerb round the bend
  for (const [sa, sb] of cornersOf()) {
    const c = cornerLot(sa, sb);
    if (c) buildLot(c.side, c.sm, c.W, 0, true, c.depth);
  }
  // the coin parkings' cars, now that every building of the chunk stands: none with a corner in a neighbour's wall
  for (const [x, y, z, ry, vals] of cars) {
    const cr = Math.cos(ry), sr = Math.sin(ry);
    if ([[0, 0], [0.9, 2.1], [-0.9, 2.1], [0.9, -2.1], [-0.9, -2.1]].some(([a, b]) => inFoot(x + cr * a + sr * b, z - sr * a + cr * b, 0.05))) continue;
    parkCar(w, own, x, y, z, ry, () => vals.shift());
  }
  // steam out of the manholes in the road (its texture has a cover 39 m and 17 m into every 48), a third of them
  for (const [off, uk] of [[39, 0.45], [17, -0.5]]) {
    for (let s = Math.ceil((s0 - off) / 48) * 48 + off; s < s1; s += 48) {
      if (h01(s * 0.37 + 2.2, uk) > 0.33) continue;
      const p = t.sample(s);
      if (p.tunnel || (p.express && p.elev > 0.25) || t.nearTunnel(s, 10)) continue;
      const u = t.half * uk, lx = Math.cos(p.h), lz = -Math.sin(p.h);
      steam.push([p.x + lx * u, p.y + 0.05, p.z + lz * u, 0, 0xffd8b0, 0, 0]);
    }
  }
  // the wires and their poles, the shopping street, the pavement, the screens
  yield* detailChunk(w, ch, D);

  // the pavement's clutter, in 30 m stretches on both sides (not under the viaduct, not in a corner's inside)
  yield;
  // (the utility poles went up with the detail: the pavement's loose things keep clear of them)
  // (and of the neighbours' poles and signals and the arches' posts, built yet or not: bags stood in an arch's post)
  for (const [x, z] of poleSpots(w, s0 - 12, s1 + 12, ch.i1 - ch.i0)) solids.push([x, z, 0.3]);
  for (const [x, z] of archPosts(w, ch.c, ch.i1 - ch.i0)) solids.push([x, z, 0.35]);
  for (const [sa, , i0] of cornersOf(Math.max(1, ch.i0 - 90), Math.min(t.nFinal - 1, ch.i1 + 60))) { const [x, z] = signalSpot(pts[i0], sa); solids.push([x, z, 0.35]); }
  const paveOK = (s, side) => { const q = t.sample(s); return !(q.tunnel || (q.express && q.elev > 1) || t.markerAt(q.s, side) || t.padAt(q.s, side)); };
  if (w.propMats) for (const side of [1, -1]) for (let s = s0; s < s1 - 4; s += 30) {
    if (!paveOK(s, side)) continue;
    // the stretch runs on while the pavement does (it used to run on straight: through a bend its bags and bicycles
    // ended up inside the buildings on the inside of the bend)
    let len = 2;
    while (len < Math.min(30, s1 - s) && paveOK(s + len, side)) len += 2;
    const edgeAt = (d) => {
      const q = t.sample(s + d), wall = side > 0 ? q.wl : q.wr;
      const lx = Math.cos(q.h) * side, lz = -Math.sin(q.h) * side;
      return { x: q.x + lx * (wall + 0.15), z: q.z + lz * (wall + 0.15), fx: Math.sin(q.h), fz: Math.cos(q.h), lx, lz };
    };
    const e0 = edgeAt(0);
    // (off every road by the thing's own size: at a square corner the stretch runs on into the street across)
    // (and the small things, the cardboard on the walls, the bollards, out of the machines, the poles and the signals)
    const clear = (qx, qz, r) => { g.sample(qx, qz, 2.2, probe); return probe.edge > 0.15 + r && !probe.tunnel && (r > 1 || !nearSolid(qx, qz, Math.min(r, 0.35))); };
    streetProps(THREE, { ...e0, y: g.height(e0.x, e0.z), length: Math.min(len, s1 - s), along: edgeAt, heightAt: (qx, qz) => g.height(qx, qz), clear }, rng, clutter);
  }
  // the expressway: deck, piers, barriers and their lit strips, and a gantry at the top of the ramp
  yield;
  viaduct(w, ch, lamps);

  // (the chunk's last part is split across frames: the corners, the loose things, the merges, the light on the street)
  yield;
  // square corners: zebra crossings either side of the turn, STOP painted before it, and a signal on the outside
  // (a corner already under way where the chunk begins belongs to the chunk before; one that runs on past the
  // chunk's end is followed into the next, on final road only)
  let i = ch.i0;
  while (i < ch.i1 && Math.abs(pts[i].k) >= 1 / 45) i++;
  while (i < ch.i1) {
    const p = pts[i];
    if (Math.abs(p.k) < 1 / 45 || p.tunnel) { i++; continue; }
    let j = i; while (j < t.nFinal - 1 && j < ch.i1 + 90 && Math.abs(pts[j].k) >= 1 / 45) j++;
    const turn = Math.sign(p.k), outside = -turn;
    const sa = p.s - 7, sb = pts[Math.min(j, pts.length - 1)].s + 7;
    for (const sz of [sa, sb]) {
      if (sz < 4 || t.nearTunnel(sz, 10)) continue;
      const q = t.sample(sz);
      zebras.push([q]);
    }
    if (sa - 9 > 8 && !t.nearTunnel(sa - 9, 12) && w._roadText) { const m = w._roadText(ch.group, sa - 13, t.half * 0.5, '止まれ'); if (m) ch.own.add(m.geometry); }
    // the signal: a pole on the outside of the approach, an arm over the road, the lamps facing the car
    {
      const q = t.sample(sa - 2);
      const wall = outside > 0 ? q.wl : q.wr;
      const lx = Math.cos(q.h) * outside, lz = -Math.sin(q.h) * outside, fx = Math.sin(q.h), fz = Math.cos(q.h);
      const [px, pz] = signalSpot(p, p.s), py = g.height(px, pz);
      // (taller where it carries the blue board over the road: the arrow the way the road turns, two places that way)
      // (and not where a street lamp's head reaches out over the road beside it)
      const bcx = px - lx * 2.25, bcz = pz - lz * 2.25;
      const blue = w.signCells && !t.nearTunnel(sa, 20) && !q.express && !w.lamps.some((l) => l.c === ch.c && l.y > py + 4 && Math.hypot(l.x - bcx, l.z - bcz) < 2.8);
      const pH = blue ? 8.75 : 6.2;
      const pole = new THREE.CylinderGeometry(0.11, 0.13, pH, 10); pole.translate(px, py + pH / 2, pz); poles.push(pole);
      if (blue) {
        const cell = w.signCells.board[(turn > 0 ? 0 : 2) + (h01(sa * 1.3 + 2.1, turn) < 0.5 ? 0 : 1)];
        const bw = 3.3, bh = 2.2, bu = 2.25, by = py + 6.35 + bh / 2;             // its middle 2.25 m in from the pole
        const face = toCell(new THREE.PlaneGeometry(bw, bh), cell); face.rotateY(q.h + Math.PI);
        face.translate(px - lx * bu - fx * 0.13, by, pz - lz * bu - fz * 0.13); boardFaces.push(face);
        const back = new THREE.BoxGeometry(bw + 0.08, bh + 0.08, 0.1); back.rotateY(q.h); back.translate(px - lx * bu - fx * 0.06, by, pz - lz * bu - fz * 0.06); boxes.push(back);
        // the two arms it hangs from, out from the pole behind it
        for (const ya of [by + 0.72, by - 0.55]) {
          const arm = new THREE.CylinderGeometry(0.06, 0.06, bu + 1.6, 8); arm.rotateZ(Math.PI / 2); arm.rotateY(q.h);
          arm.translate(px - lx * (bu + 1.6) / 2, ya, pz - lz * (bu + 1.6) / 2); poles.push(arm);
        }
      }
      // (its phase in the lamps' cycle: the crossing's chirp sings while the walkers have green, the cars red)
      const phase = h01(sa * 0.91 + 7.7, outside);
      w._reg(own, { name: 'signal', kind: 'solid', x: px, y: py, z: pz, r: 0.16, alive: true, phase });
      solids.push([px, pz, 0.35]);
      const armLen = wall + 0.9 - 2.2;
      const arm = new THREE.CylinderGeometry(0.07, 0.07, armLen, 8); arm.rotateZ(Math.PI / 2); arm.rotateY(q.h);
      arm.translate(px - lx * armLen / 2, py + 5.8, pz - lz * armLen / 2); poles.push(arm);
      const hx = px - lx * armLen, hz = pz - lz * armLen;
      const box = new THREE.BoxGeometry(1.25, 0.42, 0.3); box.rotateY(q.h); box.translate(hx - fx * 0.05, py + 5.55, hz - fz * 0.05); boxes.push(box);
      // (the draw that picked the lit lamp when the signals stood still, kept so the rest of the street is as it was)
      void (rng() < 0.62 || rng());
      // left to right as the driver sees it (their left is the road's left): blue-green, amber, red; the shader
      // lights them in turn
      const Lx = Math.cos(q.h), Lz = -Math.sin(q.h);
      [0.4, 0, -0.4].forEach((d, k) => {
        const disc = new THREE.CircleGeometry(0.15, 16); disc.rotateY(q.h + Math.PI);
        disc.translate(hx - fx * 0.21 + Lx * d, py + 5.55, hz - fz * 0.21 + Lz * d);
        lamps.push(lampAttrs(disc, k, phase));
      });
      // the walkers' signal on the same pole, facing across the road to the far kerb: a red man over a green one,
      // green while the cars have red (the crossing's chirp sings then)
      {
        const wx = px - lx * 0.2, wz = pz - lz * 0.2, wy = py + 2.75;
        const head = new THREE.BoxGeometry(0.36, 0.78, 0.24); head.rotateY(Math.atan2(-fz, fx)); head.translate(wx, wy, wz); boxes.push(head);
        const hood = new THREE.BoxGeometry(0.4, 0.05, 0.2); hood.rotateY(Math.atan2(-fz, fx)); hood.translate(wx - lx * 0.2, wy + 0.4, wz - lz * 0.2); boxes.push(hood);
        [[0.18, 3], [-0.18, 4]].forEach(([dy, k]) => {
          const face = new THREE.PlaneGeometry(0.26, 0.26); face.rotateY(Math.atan2(-lx, -lz));
          face.translate(wx - lx * 0.125, wy + dy, wz - lz * 0.125);
          lamps.push(lampAttrs(face, k, phase));
        });
      }
    }
    // the stop lines: a thick white bar across the lanes coming up to each crossing, a car's length short of it (the
    // left lanes before the first crossing, the right lanes before the one past the corner)
    for (const [sl, dir] of [[sa - 4.4, 1], [sb + 4.4, -1]]) {
      if (sl < 4 || t.nearTunnel(sl, 10) || t.sample(sl).express) continue;
      paint.push([sl, 0.35 * dir, sl, (t.half - 0.35) * dir, 0.22]);
    }
    // before each crossing, two diamonds painted in every lane coming up to it (a crossing ahead, as Japan marks it):
    // on the left lanes before the first crossing, on the right lanes before the one past the corner
    for (const [sd, dir] of [[sa - 32, 1], [sa - 50, 1], [sb + 32, -1], [sb + 50, -1]]) {
      if (sd < 8 || sd > pts[t.nFinal - 1].s - 8 || t.nearTunnel(sd, 10)) continue;
      let flat = true;
      for (const d of [-2, 0, 2, 4]) { const qd = t.sample(sd + d); if (Math.abs(qd.k) > 1 / 200 || qd.express) flat = false; }
      if (flat) for (const u of (t.half > 5.4 ? [t.half * 0.25, t.half * 0.75] : [t.half * 0.5])) {
        const c = u * dir, Ld = 3.4, Wd = 1.25, P = [[0, 0], [Ld / 2, Wd / 2], [Ld, 0], [Ld / 2, -Wd / 2]];
        for (let e = 0; e < 4; e++) paint.push([sd + P[e][0], c + P[e][1], sd + P[(e + 1) % 4][0], c + P[(e + 1) % 4][1], 0.075]);
      }
    }
    i = j + 1;
  }
  // a konbini's lay-by is its car park: bays painted across it, nose in toward the shop
  for (const m of t.markers) {
    if (m.kind !== 'conbini' || m.fi >= t.nFinalF || m.s + m.len < s0 - 10 || m.s - 10 > s1) continue;
    const u0 = t.wall + 0.3, u1 = m.wlay - 0.2;
    for (let sb = m.s - 4; sb <= m.s + m.len - 6; sb += 2.5) {
      if (sb < s0 || sb >= s1) continue;
      paint.push([sb, (u0 + 0.6) * m.side, sb, u1 * m.side, 0.06]);
      if (sb + 2.5 <= m.s + m.len - 6) paint.push([sb, u1 * m.side, sb + 2.5, u1 * m.side, 0.06]);
    }
  }
  yield;
  // the red lights on the tall roofs, in the signals' mesh (its shader pulses them)
  for (const [bx, by, bz, ph, sz] of beacons) { const o = new THREE.OctahedronGeometry(sz || 0.26, 0); o.translate(bx, by, bz); lamps.push(lampAttrs(o, 5, ph)); }
  // the pavement's loose things, now that everything solid on it stands: none inside a building (at a corner the
  // pavement a stretch follows can pass behind another street's fronts), none in a coin parking's way in, none
  // standing in a utility pole, a vending machine or a signal
  for (const [bx, by, bz] of clutter.__bollards || []) if (!inFoot(bx, bz, 0.12) && !nearSolid(bx, bz, 0.12)) w._put('bollard', own, bx, by, bz, rng() * 6.28);
  for (const [name, x, y, z, ry, sc, sx, colour] of clutter.__items || []) {
    const r = (ITEM_R[name] || 0.3) * (sc || 1);
    if (inFoot(x, z, r) || nearSolid(x, z, r)) continue;
    // (a few thinned out, by a hash of the place: the pools draw every built chunk's, and at their caps a chunk built
    // ahead of the car got none at all)
    if (THIN[name] && h01(x * 0.71 + 3.3, z * 0.71) < THIN[name]) continue;
    w._put(name, own, x, y, z, ry, sc, sx, colour);
  }

  const addMesh = (geos, mat, name, shadow = false) => {
    if (!geos.length) return;
    const geo = merge(geos); ch.own.add(geo);
    const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = shadow; m.receiveShadow = true;
    ch.group.add(m);
  };
  for (const [name, list] of Object.entries(clutter)) if (!name.startsWith('__') && list.length && w.propMats[name]) addMesh(list, w.propMats[name], 'clutter ' + name, name === 'props' || name === 'metal');
  yield;
  addMesh(signs, w.neonMat, 'neon signs');
  addMesh(housings, w.neonHousingMat, 'sign housings');
  addMesh(poles, w.signalPoleMat, 'signal poles', true);
  addMesh(boxes, w.signalBoxMat, 'signal boxes', true);
  addMesh(lamps, w.signalMat, 'signal lamps');
  addMesh(boardFaces, w.shutoMat, 'direction boards');
  steamChunk(w, ch, steam);
  // (an alley at the end of a lot can be closed by the next lot, or by a building round a corner: nobody stands inside one)
  peopleChunk(w, ch, people.filter(([x, , z]) => !inFoot(x, z, 0.4)));
  yield;
  if (glows.length) ch.group.add(drape(w, ch, glows, w.neonGlowMat, 0.06));
  yield;
  if (streaks.length) ch.group.add(drape(w, ch, streaks, w.streakMat, 0.04, true));
  yield;
  // the crossings: a strip of zebra paint across the road, 4 m along it, on the ribbon itself; and the lines of the
  // diamonds before them and the lay-bys' bays, in the same paint (their uv on the solid of a bar)
  if (zebras.length || paint.length) {
    const pos = [], uv = [], idx = [];
    const onRoad = (s, u) => { const q = t.sample(s), lx = Math.cos(q.h), lz = -Math.sin(q.h); return [q.x + lx * u, q.y + 0.03 - u * Math.tan(q.bank || 0), q.z + lz * u]; };
    for (const [sa0, ua0, sb0, ub0, hw] of paint) {
      const l = Math.hypot(sb0 - sa0, ub0 - ua0) || 1, na = -(ub0 - ua0) / l * hw, nc = (sb0 - sa0) / l * hw;
      const V = [onRoad(sa0 - na, ua0 - nc), onRoad(sb0 - na, ub0 - nc), onRoad(sb0 + na, ub0 + nc), onRoad(sa0 + na, ua0 + nc)];
      // (wound to face up, whichever way round the line runs)
      const up = (V[1][2] - V[0][2]) * (V[2][0] - V[0][0]) - (V[1][0] - V[0][0]) * (V[2][2] - V[0][2]) > 0;
      const b = pos.length / 3;
      for (const v of V) { pos.push(v[0], v[1], v[2]); uv.push(0.3, 0.5); }
      if (up) idx.push(b, b + 1, b + 2, b, b + 2, b + 3); else idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
    }
    for (const [q] of zebras) {
      const base = pos.length / 3, NS = 2, NU = 8, L = 4.2;
      const width = 2 * (t.half - 0.2);
      for (let jj = 0; jj <= NS; jj++) {
        const qq = t.sample(q.s - L / 2 + (jj / NS) * L), lx = Math.cos(qq.h), lz = -Math.sin(qq.h);
        for (let ii = 0; ii <= NU; ii++) {
          const u = (ii / NU - 0.5) * width;
          pos.push(qq.x + lx * u, qq.y + 0.028, qq.z + lz * u); uv.push((u + width / 2) / 0.9, jj / NS);
        }
      }
      for (let jj = 0; jj < NS; jj++) for (let ii = 0; ii < NU; ii++) {
        const a = base + jj * (NU + 1) + ii, b = a + 1, c = a + NU + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingSphere();
    ch.own.add(geo);
    const m = new THREE.Mesh(geo, w.zebraMat); m.renderOrder = 1; m.receiveShadow = true; m.name = 'crossings';
    ch.group.add(m);
  }
}

void lerp;

/**
 * A coin parking on a lot: its bays painted across it with their wheel stops (cityprops.js parkingProps), cars in
 * most of them (reversed in, as most are in Japan, now and then nose in), the blue P sign on a pole at the front
 * corner facing along the street, a lamp over the bays, and a low block of shops and flats behind the back wall.
 */
function coinParking(w, ch, o) {
  const { sm, side, lotW, depth, u0, p, at, rng, clutter, signs, housings, glows, D, parkSign, people, h01, clearAt, addFoot, solids } = o;
  const g = w.ground, own = ch.c * 2;
  const lx = Math.cos(p.h) * side, lz = -Math.sin(p.h) * side, fx = Math.sin(p.h), fz = Math.cos(p.h);
  const [frontX, frontZ] = at(sm, side * u0);
  const fy = g.height(frontX, frontZ);
  const W = lotW * 0.985;
  const res = parkingProps(THREE, { x: frontX, z: frontZ, y: fy, fx, fz, lx, lz, width: W, depth }, rng, clutter);
  // the cars: lot metres (x along the front, z negative into the lot) to the world
  const L = (x, z) => [frontX + fx * x - lx * z, frontZ + fz * x - lz * z];
  for (const [bx, bz] of res.bays) {
    if (rng() < 0.18) continue;
    const [x, z] = L(bx + (rng() - 0.5) * 0.25, bz + (rng() - 0.5) * 0.3);
    const toRoad = rng() < 0.72;
    // (parked once the chunk's lots all stand: on a bend a neighbour leans in over the bays, and a car there is dropped)
    const ry = p.h + (toRoad ? -side : side) * Math.PI / 2 + (rng() - 0.5) * 0.06, vals = [rng(), rng(), rng(), rng()];
    if (o.cars) o.cars.push([x, g.height(x, z) + 0.01, z, ry, vals]);
    else parkCar(w, own, x, g.height(x, z) + 0.01, z, ry, () => vals.shift());
    // now and then someone at their car's door, under the lot's lamp
    if (people && h01(bx * 3.1 + sm, bz + side) < 0.16) {
      const [qx, qz] = L(bx + 1.25, bz - 0.6);
      if (clearAt(qx, qz, 3.4)) people.push([qx, g.height(qx, qz), qz, Math.floor(h01(bx + sm * 2.3, side) * 8), 0xdfe8ff, 0.85]);
    }
  }
  // the P sign: a pole at the front corner, the sign along the street over the lot's edge, both faces lit
  {
    const s = res.sign ? Math.sign((res.sign[0] - frontX) * fx + (res.sign[2] - frontZ) * fz) || 1 : 1;
    const ex = s * (W / 2 - 0.25);
    const [px, pz] = L(ex, -0.15);
    const pole = new THREE.CylinderGeometry(0.07, 0.08, 4.4, 8); pole.translate(px, fy + 2.2, pz); housings.push(pole);
    const sw = parkSign.w * 0.95, sh = parkSign.h * 0.95, yb = fy + 3.0, yt = yb + sh;
    const Q = (u, y, d) => [px + lx * u + fx * d, y, pz + lz * u + fz * d];
    const u1 = 0.1, u2 = 0.1 + sw;
    signQuad(signs, Q(u2, yb, -0.09), Q(u1, yb, -0.09), Q(u1, yt, -0.09), Q(u2, yt, -0.09), parkSign, side < 0);
    signQuad(signs, Q(u1, yb, 0.09), Q(u2, yb, 0.09), Q(u2, yt, 0.09), Q(u1, yt, 0.09), parkSign, side < 0);
    const hb = new THREE.BoxGeometry(sw + 0.1, sh + 0.12, 0.14); hb.rotateY(p.h); hb.translate(px + lx * (u1 + u2) / 2, (yb + yt) / 2, pz + lz * (u1 + u2) / 2); housings.push(hb);
    glows.push([px + lx * 1.2, pz + lz * 1.2, fx, fz, 5, 5, parkSign.colour]);
  }
  // the lamp over the bays: its head lit, its light on the bays
  if (res.lamp) {
    D.lamp([res.lamp[0], res.lamp[1] + 0.13, res.lamp[2]], fx, fz, 0.44, 0.24);
    const [gx, gz] = L(0, -res.bayD / 2 - 0.6);
    glows.push([gx, gz, fx, fz, Math.min(W, 9), 6, 0xdfe8ff]);
    w.lamps.push({ x: res.lamp[0], y: res.lamp[1], z: res.lamp[2], c: ch.c, color: 0xe2ecff, power: 70 });
  }
  // a vending machine at the other front corner, now and then
  if (rng() < 0.5 && w.pools.vending) {
    const s = res.sign ? -Math.sign((res.sign[0] - frontX) * fx + (res.sign[2] - frontZ) * fz) || 1 : 1;
    const [vx, vz] = L(s * (W / 2 - 0.7), 0.45);
    w._put('vending', own, vx, g.height(vx, vz), vz, p.h + (side > 0 ? -Math.PI / 2 : Math.PI / 2));
    if (solids) solids.push([vx, vz, 0.62]);
    glows.push([vx - lx * 1.1, vz - lz * 1.1, fx, fz, 2.2, 2.6, 0xd6ecff]);
  }
  // the low block behind the back wall
  const back = -res.back + 0.45, dep = depth - back;
  if (dep >= 4.5) {
    const H = 8 + rng() * 9;
    const [cx, cz] = at(sm, side * (u0 + back + dep / 2));
    _q.setFromAxisAngle(_up, p.h + Math.PI / 2);
    _s.set(W, H + 0.3, dep);
    _m4.compose(_v.set(cx, g.height(cx, cz) - 0.3 + (H + 0.3) / 2, cz), _q, _s);
    w.pools.bldg.add(own, _m4, FACADES[Math.floor(rng() * FACADES.length)]);
    if (addFoot) addFoot(cx, cz, p.h, W, dep);
    const [bx, bz] = at(sm, side * (u0 + back));
    if (w.propMats) lotProps(THREE, { x: bx, z: bz, y: g.height(bx, bz), fx, fz, lx, lz, width: W, depth: dep, height: H, shop: true }, rng, clutter);
  }
  w.detail.stats.parkings = (w.detail.stats.parkings || 0) + 1;
}

/**
 * The far city: a ring of towers round the camera with red lights blinking on the tallest roofs, and Tokyo Tower
 * three kilometres off in a fixed direction, lit orange. The group travels with the camera like the mountain's
 * skyline does.
 */
export function citySkyBuild(w, L) {
  const g = new THREE.Group(); g.name = 'city sky';
  if (!L) return g;
  const ring = L.citySkyline(THREE, { radius: 2600, count: 180, seed: 7 });
  g.add(ring);
  const tower = L.tokyoTower(THREE);
  const az = 2.3;
  tower.position.set(Math.sin(az) * 3000, -6, Math.cos(az) * 3000);
  tower.scale.setScalar(1.35);                                   // a little larger than life, so it reads from the street
  g.add(tower);
  // Tokyo Skytree, further off the other way, its lattice lit pale blue
  let skytree = null;
  if (L.tokyoSkytree) {
    skytree = L.tokyoSkytree(THREE);
    const az2 = -0.75;
    skytree.position.set(Math.sin(az2) * 3300, -10, Math.cos(az2) * 3300);
    skytree.scale.setScalar(1.3);                                // (larger than life too: it stands over the far towers)
    g.add(skytree);
  }
  const ship = airship(w);
  if (ship) g.add(ship.g);
  g.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine || o.isLineSegments) { o.frustumCulled = false; o.castShadow = false; o.receiveShadow = false; } });
  g.userData = { aviation: ring.userData && ring.userData.aviation, ring, tower, skytree, airship: ship, day: -1 };
  return g;
}

/**
 * The far city by day: the skyline ring pale in the haze (its shader), its lit crowns and signs dimmed, and the two
 * towers' lights down to painted steel in the sun. Only when the hour has moved (a few uniforms).
 */
function skyDay(w, U) {
  const n = w.bldgMat && w.bldgMat.userData.uNight ? w.bldgMat.userData.uNight.value : 1;
  const day = 1 - clamp((n - 0.05) / 0.4, 0, 1);
  const fog = w.scene && w.scene.fog;
  if (U.ring && U.ring.userData.haze && fog) U.ring.userData.haze.value.copy(fog.color);
  if (Math.abs(day - U.day) < 0.002) return;
  U.day = day;
  const d = day * day * (3 - 2 * day);
  if (U.ring && U.ring.userData.day) { U.ring.userData.day.value = d; U.ring.userData.materials.lights.color.setScalar(1 - 0.8 * d); }
  for (const L of [U.tower, U.skytree]) {
    const M = L && L.userData.materials; if (!M) continue;
    // (the lattice is two materials, its far faces and its near ones: see landmarks.js latticeMeshes)
    for (const m of [M.lit, M.lattice, M.latticeBack]) { if (!m) continue; if (!m.userData.base) m.userData.base = m.color.clone(); m.color.copy(m.userData.base).multiplyScalar(1 - 0.62 * d); }
  }
}

/**
 * An airship over the city: a long silver hull, its fins and gondola, an LED screen along each flank showing the
 * street's ads (the screens' own material and clock), a red beacon pulsing and a white strobe. It circles a point
 * that follows the camera a few seconds behind, so it drifts across the sky and shifts as the car sets off or
 * stops, as a real one would, but is never left behind.
 */
function airship(w) {
  if (!w.screenMat) return null;
  const g = new THREE.Group(); g.name = 'airship';
  const L = 64, R = 8.4;
  // the hull's radius a way along it, tail (0) to nose (1): a blunt nose, fattest a little forward, a long taper
  const rAt = (a) => R * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(a, 1.25))), 0.6);
  const prof = [];
  for (let i = 0; i <= 20; i++) { const a = i / 20; prof.push(new THREE.Vector2(Math.max(0.02, rAt(a)), (a - 0.5) * L)); }
  const hull = new THREE.LatheGeometry(prof, 28);
  hull.rotateX(Math.PI / 2);                                       // its axis along z, the nose at +z
  const parts = [hull];
  const zF = -L / 2 + 8, rF = rAt(8 / L);
  for (const [ax, ay] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const f = new THREE.BoxGeometry(ax ? 7.5 : 0.35, ay ? 7.5 : 0.35, 9);
    f.translate(ax * (rF + 3.2), ay * (rF + 3.2), zF);
    parts.push(f);
  }
  const gondola = new THREE.BoxGeometry(2.6, 2.0, 9); gondola.translate(0, -R - 0.6, 6); parts.push(gondola);
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x8e949e, roughness: 0.45, metalness: 0.3, emissive: 0x1a1822 });
  hullMat.name = 'airship';
  g.add(new THREE.Mesh(merge(parts), hullMat));
  // the screens: flat panels hung on the flanks, each reading left to right from its own side
  const scr = [];
  for (const side of [1, -1]) {
    const q = new THREE.PlaneGeometry(24, 8.5);
    q.rotateY(side * Math.PI / 2);
    q.translate(side * (R + 0.15), 0.8, 3);
    const seed = side > 0 ? 0.37 : 0.81;
    q.setAttribute('aScr', new THREE.Float32BufferAttribute(new Array(q.attributes.position.count).fill([seed, 24, 8.5, 1]).flat(), 4));
    scr.push(q);
  }
  g.add(new THREE.Mesh(merge(scr), w.screenMat));
  // the beacon, under the gondola and on the top; the strobe on the top fin and the nose
  const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.12, 0.08).multiplyScalar(3) });
  const strobeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(4) });
  const ball = (x, y, z, r) => { const b = new THREE.SphereGeometry(r, 8, 6); b.translate(x, y, z); return b; };
  g.add(new THREE.Mesh(merge([ball(0, -R - 1.8, 6, 1.3), ball(0, R + 0.4, 4, 1.3)]), beaconMat));
  g.add(new THREE.Mesh(merge([ball(0, rF + 7.2, zF - 3.5, 1.1), ball(0, 0, L / 2 + 0.4, 1.1)]), strobeMat));
  return { g, beaconMat, strobeMat, c: null, t: null };
}

/**
 * The road signs, one canvas: the Shuto's green gantry sign along the top (the route, and two exits with their
 * distances), and under it four of the blue boards a Tokyo street hangs over its junctions, each an arrow the way the
 * road turns and two places that way (w.signCells.board[0..1] turn left, [2..3] right; [u0, v0, u1, v1]).
 */
function shutoSignMaterial(w) {
  const CV = 1280, cv = document.createElement('canvas'); cv.width = 1024; cv.height = CV;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#0d6b44'; ctx.fillRect(0, 0, 1024, 320);
  ctx.strokeStyle = '#f2f4f2'; ctx.lineWidth = 10; ctx.strokeRect(14, 14, 996, 292);
  const jp = '"Dela Gothic One", "Noto Serif JP", "Yu Gothic", "Hiragino Sans", sans-serif';
  const ok = w.glyphs ? w.glyphs('44px ' + jp, '首都高速環状線銀座新宿') : false;
  ctx.fillStyle = '#f2f4f2'; ctx.textBaseline = 'middle';
  // the route shield: a white rounded square with C1 in green
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(46, 52, 150, 108, 16); else ctx.rect(46, 52, 150, 108); ctx.fill();
  ctx.fillStyle = '#0d6b44'; ctx.textAlign = 'center'; ctx.font = '700 84px Rajdhani, sans-serif'; ctx.fillText('C1', 121, 110);
  ctx.fillStyle = '#f2f4f2'; ctx.textAlign = 'left';
  ctx.font = ok ? '62px ' + jp : '700 58px Rajdhani, sans-serif'; ctx.fillText(ok ? '首都高速 環状線' : 'SHUTO EXPWY', 226, 92);
  ctx.font = '700 30px Rajdhani, sans-serif'; ctx.fillText('SHUTO EXPRESSWAY  INNER CIRCULAR', 230, 150);
  // the exits
  const row = (y, kanji, romaji, km, arrow) => {
    ctx.font = ok ? '56px ' + jp : '700 50px Rajdhani, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(ok ? kanji : romaji, 64, y);
    if (ok) { ctx.font = '700 30px Rajdhani, sans-serif'; ctx.fillText(romaji, 64 + ctx.measureText('xxxxxxxx').width * 0 + 190, y + 4); }
    ctx.textAlign = 'right'; ctx.font = '700 54px Rajdhani, sans-serif'; ctx.fillText(km, 900, y); ctx.font = '700 30px Rajdhani, sans-serif'; ctx.fillText('km', 960, y + 6);
    ctx.save(); ctx.translate(990, y); ctx.rotate(arrow); ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(12, 4); ctx.lineTo(4, 4); ctx.lineTo(4, 16); ctx.lineTo(-4, 16); ctx.lineTo(-4, 4); ctx.lineTo(-12, 4); ctx.closePath(); ctx.fill(); ctx.restore();
  };
  ctx.fillStyle = 'rgba(242,244,242,.35)'; ctx.fillRect(40, 188, 944, 3); ctx.fillStyle = '#f2f4f2';
  row(228, '銀座', 'Ginza', '2', 0);
  row(282, '新宿', 'Shinjuku', '7', Math.PI / 4);
  // the blue boards, 512 x 340 each under the gantry's 320 rows: the white rim, the arrow bending the way the road
  // turns (a stem up from the foot and an arm across with its head), the places that way, a national route's shield
  const ok2 = w.glyphs ? w.glyphs('44px ' + jp, '銀座東京大塚白山新宿宮') : false;
  const board = (x, y, dir, names, route) => {
    const W = 512, H = 340, B = '#1553a8', F = '#f3f5f7';
    ctx.fillStyle = B; ctx.fillRect(x, y, W, H);
    ctx.strokeStyle = F; ctx.lineWidth = 9;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x + 16, y + 16, W - 32, H - 32, 22); else ctx.rect(x + 16, y + 16, W - 32, H - 32); ctx.stroke();
    const sx = x + (dir < 0 ? 372 : 140), ay = y + 104;
    ctx.lineWidth = 42; ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(sx, y + H - 20); ctx.lineTo(sx, ay + 52); ctx.quadraticCurveTo(sx, ay, sx + dir * 52, ay); ctx.lineTo(sx + dir * 150, ay); ctx.stroke();
    const hx = sx + dir * 146;
    ctx.fillStyle = F; ctx.beginPath(); ctx.moveTo(hx + dir * 70, ay); ctx.lineTo(hx, ay - 54); ctx.lineTo(hx, ay + 54); ctx.closePath(); ctx.fill();
    // the places, stacked by the arrow's arm: the kanji and the romaji after it
    const nx = dir < 0 ? x + 52 : x + 214;
    names.forEach(([kanji, romaji], i) => {
      const ny = y + 212 + i * 72;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = F;
      if (ok2) {
        ctx.font = '58px ' + jp; ctx.fillText(kanji, nx, ny);
        const kw = ctx.measureText(kanji).width;
        ctx.font = '700 28px Rajdhani, sans-serif'; ctx.fillText(romaji, nx + kw + 12, ny + 8);
      } else { ctx.font = '700 44px Rajdhani, sans-serif'; ctx.fillText(romaji, nx, ny); }
    });
    // the route's shield: a blue inverted pentagon in a white rim, its number in white, over the arrow's other side
    const cx = dir < 0 ? x + 440 : x + 72, cy = y + 62;
    ctx.beginPath(); ctx.moveTo(cx - 34, cy - 28); ctx.lineTo(cx + 34, cy - 28); ctx.lineTo(cx + 34, cy + 8); ctx.lineTo(cx, cy + 32); ctx.lineTo(cx - 34, cy + 8); ctx.closePath();
    ctx.fillStyle = F; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 28, cy - 22); ctx.lineTo(cx + 28, cy - 22); ctx.lineTo(cx + 28, cy + 5); ctx.lineTo(cx, cy + 25); ctx.lineTo(cx - 28, cy + 5); ctx.closePath();
    ctx.fillStyle = B; ctx.fill();
    ctx.fillStyle = F; ctx.textAlign = 'center'; ctx.font = '700 34px Rajdhani, sans-serif'; ctx.fillText(route, cx, cy - 2);
  };
  const cells = [];
  [[-1, [['銀座', 'Ginza'], ['東京', 'Tokyo']], '4'], [-1, [['大塚', 'Otsuka'], ['白山', 'Hakusan']], '17'],
    [1, [['新宿', 'Shinjuku'], ['大宮', 'Omiya']], '20'], [1, [['東京', 'Tokyo'], ['銀座', 'Ginza']], '1']].forEach(([dir, names, route], k) => {
    const x = (k % 2) * 512, y = 336 + Math.floor(k / 2) * 344;
    board(x, y, dir, names, route);
    // (the cell a little inside the board's own blue, so the mipmaps never take in a neighbour)
    cells.push([(x + 4) / 1024, 1 - (y + 336) / CV, (x + 508) / 1024, 1 - (y + 4) / CV]);
  });
  // the stations' name boards, 512 x 128 each along the bottom: white, the line's green band, the station's number in
  // its square, the name in kanji and in romaji
  const stations = [];
  [['新宿', 'Shinjuku', 'JY 17'], ['東京', 'Tokyo', 'JY 01'], ['大塚', 'Otsuka', 'JY 11'], ['銀座', 'Ginza', 'JY 30']].forEach(([kanji, romaji, num], k) => {
    const x = (k % 2) * 512, y = 1024 + Math.floor(k / 2) * 128;
    ctx.fillStyle = '#f4f5f2'; ctx.fillRect(x, y, 512, 128);
    ctx.fillStyle = '#80c241'; ctx.fillRect(x, y + 104, 512, 16);
    ctx.fillStyle = '#2a2b2e'; ctx.fillRect(x, y + 120, 512, 8);
    ctx.strokeStyle = '#80c241'; ctx.lineWidth = 6; ctx.strokeRect(x + 22, y + 22, 64, 64);
    ctx.fillStyle = '#1c1d20'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 22px Rajdhani, sans-serif'; ctx.fillText(num.slice(0, 2), x + 54, y + 42); ctx.font = '700 28px Rajdhani, sans-serif'; ctx.fillText(num.slice(3), x + 54, y + 68);
    if (ok2) { ctx.font = '64px ' + jp; ctx.fillText(kanji, x + 256, y + 50); ctx.font = '700 22px Rajdhani, sans-serif'; ctx.fillText(romaji.toUpperCase(), x + 256, y + 92); }
    else { ctx.font = '700 58px Rajdhani, sans-serif'; ctx.fillText(romaji, x + 256, y + 58); }
    stations.push([(x + 4) / 1024, 1 - (y + 124) / CV, (x + 508) / 1024, 1 - (y + 4) / CV]);
  });
  w.signCells = { gantry: [0, 1 - 320 / CV, 1, 1], board: cells, station: stations };
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  // (a sign's face is a centimetre in front of its back plate: biased toward the lens, so it never flickers far off)
  return new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
}

/** A plane's uvs (0..1) squeezed into one cell of an atlas, [u0, v0, u1, v1]. */
function toCell(geo, c) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, c[0] + uv.getX(i) * (c[2] - c[0]), c[1] + uv.getY(i) * (c[3] - c[1]));
  return geo;
}

/**
 * The expressway through a chunk: under the road ribbon a concrete deck whose sides run down to the street while
 * it is low (a solid ramp) and stop at a girder's depth once it is up (with a pier every 30 m), a Jersey barrier
 * along each edge with a lit strip on its inside face, and a green gantry where the ramp reaches the top.
 */
function viaduct(w, ch, lamps) {
  const t = w.track, g = w.ground, pts = t.pts, last = Math.min(ch.i1 + 1, t.nFinal - 1);
  const deck = { pos: [], nor: [], idx: [] }, bar = { pos: [], nor: [], idx: [] }, strip = { pos: [], nor: [], idx: [] };
  const piers = [], gantry = [], signs = [];
  // a strip of quads along a run: rows[k] is the k-th sample's list of points; faces join point j to j+1
  const loft = (M, rows, closeRows) => {
    const n = rows.length, m = rows[0].length, base = M.pos.length / 3;
    for (const r of rows) for (const q of r) { M.pos.push(q[0], q[1], q[2]); M.nor.push(0, 1, 0); }
    for (let k = 0; k < n - 1; k++) for (let j = 0; j < (closeRows ? m : m - 1); j++) {
      const j2 = (j + 1) % m, a = base + k * m + j, b = base + k * m + j2, c = a + m, d = b + m;
      M.idx.push(a, c, b, b, c, d);
    }
  };
  let run = [];
  const flush = () => {
    if (run.length < 2) { run = []; return; }
    const deckRows = [], barL = [], barR = [], stL = [], stR = [];
    for (const p of run) {
      const lx = Math.cos(p.h), lz = -Math.sin(p.h), tb = Math.tan(p.bank || 0);
      const Y = (u, dy = 0) => p.y - u * tb + dy;
      const P = (u, y) => [p.x + lx * u, y, p.z + lz * u];
      const uL = p.wl + 0.55, uR = -(p.wr + 0.55);
      const low = p.elev < 5;
      const gL = g.height(p.x + lx * uL, p.z + lz * uL), gR = g.height(p.x + lx * uR, p.z + lz * uR);
      const bL = low ? Math.min(Y(uL) - 0.3, gL - 0.3) : Y(uL, -1.8), bR = low ? Math.min(Y(uR) - 0.3, gR - 0.3) : Y(uR, -1.8);
      // the deck's cross-section, round from the left top edge, down, across the underside, up the right
      deckRows.push([P(uL, Y(uL, -0.05)), P(uL, bL), P(uR, bR), P(uR, Y(uR, -0.05))]);
      // the barriers: inner foot at the road's edge, a bevel, the top, the outer face
      const wl = p.wl, wr = p.wr;
      barL.push([P(wl, Y(wl, -0.02)), P(wl + 0.07, Y(wl, 0.32)), P(wl + 0.3, Y(wl, 1.0)), P(uL, Y(wl, 1.0)), P(uL, Y(uL, -0.05))]);
      barR.push([P(-wr, Y(-wr, -0.02)), P(-wr - 0.07, Y(-wr, 0.32)), P(-wr - 0.3, Y(-wr, 1.0)), P(uR, Y(-wr, 1.0)), P(uR, Y(uR, -0.05))]);
      stL.push([P(wl + 0.2, Y(wl, 0.66)), P(wl + 0.23, Y(wl, 0.76))]);
      stR.push([P(-wr - 0.2, Y(-wr, 0.66)), P(-wr - 0.23, Y(-wr, 0.76))]);
      // a delineator on top of each barrier every 4 m, facing the traffic: its lamp in the signals' mesh
      if (lamps && ((p.s % 4) + 4) % 4 < t.step) {
        for (const [u, k] of [[wl + 0.38, 8], [-wr - 0.38, 7]]) {
          const q = new THREE.PlaneGeometry(0.12, 0.09); q.rotateY(p.h + Math.PI);
          q.translate(p.x + lx * u, Y(u < 0 ? -wr : wl, 1.0) + 0.05, p.z + lz * u);
          lamps.push(lampAttrs(q, k, 0));
        }
      }
      // a pier every 30 m while the deck is up
      if (!low && ((p.s % 30) + 30) % 30 < t.step) {
        const gy = g.height(p.x, p.z), top = Math.min(bL, bR) - 0.05, hgt = top - gy;
        if (hgt > 1) {
          const col = new THREE.BoxGeometry(1.5, hgt, 1.1); col.rotateY(p.h); col.translate(p.x, gy + hgt / 2, p.z); piers.push(col);
          const cap = new THREE.BoxGeometry(uL - uR - 0.6, 0.9, 1.4); cap.rotateY(p.h); cap.translate(p.x + lx * (uL + uR) / 2, top - 0.45, p.z + lz * (uL + uR) / 2); piers.push(cap);
        }
      }
      // the gantry, once, where the ramp tops out
      if (!ch.gantried && p.elev > 9 && p.elev < 12 && Math.abs(p.k) < 0.004) {
        ch.gantried = true;
        const H = 6.4, yl = Y(p.wl + 0.3, 1.0), yr = Y(-p.wr - 0.3, 1.0);
        for (const [u, yb] of [[p.wl + 0.3, yl], [-p.wr - 0.3, yr]]) { const c = new THREE.BoxGeometry(0.34, H, 0.34); c.translate(p.x + lx * u, yb + H / 2, p.z + lz * u); gantry.push(c); }
        const span = p.wl + p.wr + 0.6, ym = Y(0, 0) + H + 0.7;
        const beam = new THREE.BoxGeometry(span, 0.4, 0.4); beam.rotateY(p.h); beam.translate(p.x + lx * (p.wl - p.wr) / 2, ym + 0.4, p.z + lz * (p.wl - p.wr) / 2); gantry.push(beam);
        const back = new THREE.BoxGeometry(6.4, 2.0, 0.12); back.rotateY(p.h); back.translate(p.x, ym - 0.7, p.z); gantry.push(back);
        const face = toCell(new THREE.PlaneGeometry(6.3, 1.95), w.signCells.gantry); face.rotateY(p.h + Math.PI);
        face.translate(p.x - Math.sin(p.h) * 0.07, ym - 0.7, p.z - Math.cos(p.h) * 0.07); signs.push(face);
      }
    }
    loft(deck, deckRows, false);
    loft(bar, barL, false); loft(bar, barR, false);
    loft(strip, stL, false); loft(strip, stR, false);
    run = [];
  };
  for (let i = ch.i0; i <= last; i++) { const p = pts[i]; if (p.express && p.elev > 0.25) run.push(p); else flush(); }
  flush();
  const mesh = (M, mat, name, shadow) => {
    if (!M.idx.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(M.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(M.pos.length / 3 * 2), 2));
    geo.setIndex(M.idx); geo.computeVertexNormals(); geo.computeBoundingSphere();
    ch.own.add(geo);
    const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = shadow; m.receiveShadow = true;
    // (the lofts wind either way round: draw both faces)
    mat.side = THREE.DoubleSide;
    ch.group.add(m);
  };
  mesh(deck, w.deckMat, 'viaduct deck', true);
  mesh(bar, w.barrierMat, 'viaduct barriers', true);
  mesh(strip, w.stripMat, 'viaduct strips', false);
  const add = (list, mat, name) => {
    if (!list.length) return;
    const geo = merge(list); ch.own.add(geo);
    const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = true; m.receiveShadow = true; ch.group.add(m);
  };
  add(piers, w.deckMat, 'viaduct piers');
  add(gantry, w.gantryMat, 'gantry');
  add(signs, w.shutoMat, 'gantry sign');
}

/** Blink the aviation lights (a slow red pulse, as on a real skyline). */
export function citySkyUpdate(w, t) {
  const a = w.citySky && w.citySky.userData.aviation;
  if (a && a.material) a.material.opacity = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2.1)) ** 2;
  const sk = w.citySky && w.citySky.userData.skytree;
  if (sk && sk.userData.aviation) sk.userData.aviation.material.opacity = 0.3 + 0.7 * Math.max(0, Math.sin(t * 1.7 + 1.1)) ** 2;
  if (w.citySky) skyDay(w, w.citySky.userData);
  // the clock the televisions, the arcade screens and the street's animated signs run on (kept small for precision)
  const tt = t % 3600;
  if (w.cityClock) w.cityClock.value = tt;
  // the airship: round a point that follows the camera a few seconds behind, nose along its way, a slow sway
  const A = w.citySky && w.citySky.userData.airship;
  if (A) {
    const cam = w.citySky.position;
    const dt = Math.min(0.1, Math.max(0, t - (A.t ?? t))); A.t = t;
    if (!A.c || Math.hypot(cam.x - A.c.x, cam.z - A.c.z) > 2500) A.c = { x: cam.x, z: cam.z };
    const k = 1 - Math.exp(-dt / 12);
    A.c.x += (cam.x - A.c.x) * k; A.c.z += (cam.z - A.c.z) * k;
    const th = t * 0.011 + 1.3;
    const gy = w.ground ? w.ground.height(cam.x, cam.z) : cam.y;
    A.g.position.set(A.c.x + Math.cos(th) * 480 - cam.x, 170 + gy - cam.y, A.c.z + Math.sin(th) * 480 - cam.z);
    A.g.rotation.set(Math.sin(t * 0.21) * 0.02, -th, Math.sin(t * 0.17) * 0.015);
    A.beaconMat.color.setRGB(1, 0.12, 0.08).multiplyScalar(0.4 + 2.6 * Math.max(0, Math.sin(t * 2.4)) ** 2);
    const sp = (t * 0.7) % 1;
    A.strobeMat.color.setScalar(sp < 0.04 || (sp > 0.1 && sp < 0.14) ? 5 : 0.05);
  }
  if (w.bldgMat && w.bldgMat.userData.uTime) w.bldgMat.userData.uTime.value = tt;
  detailUpdate(w, tt);
}
