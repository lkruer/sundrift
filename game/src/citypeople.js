/**
 * NEO TOKYO: people, where a car cannot reach them. A few standing and talking in the light at the mouth of an alley
 * between two buildings, someone on the phone, someone with a can from the machine; someone in a coin parking by
 * the cars. (The pavement is the car's: people stand past the building line, where the car's wall is.) Each is a
 * figure drawn once into an atlas at load, stood on the ground and turned to face the camera about its own upright
 * (so it never leans), cut out and written to depth, so the cel pass inks it like everything else, and swaying a
 * little. In the rain they have umbrellas up. A chunk's people are one mesh over one material.
 *
 *     w.peopleMat = peopleLoad(w);                // once, with the city's materials (it compiles at load)
 *     peopleChunk(w, ch, list);                   // per chunk: [x, y, z, figure 0..7, light colour]
 *     peopleWeather(w, wet, night);               // umbrellas up, and the light
 */
import * as THREE from 'three';
import { mulberry32 } from './config.js?v=202609241743';

// a cell is 1.2 m by 2.4 m: 128 by 256 pixels, the feet at the bottom middle
const CW = 128, CH = 256, PX = CH / 2.4;

// the eight: coat, legs, hair, how they are seen, what their hands are doing, a bag, a skirt
const FIGURES = [
  { view: 'front', coat: '#2a2e3a', legs: '#1c1c22', hair: '#141010', arms: 'down', bag: '#3a2a1a' },
  { view: 'side', coat: '#b8a888', legs: '#2a2a30', hair: '#1a1210', arms: 'phone' },
  { view: 'back', coat: '#6a2a36', legs: '#141418', hair: '#2a1a10', arms: 'down', skirt: true },
  { view: 'front', coat: '#d8d4cc', legs: '#2a3a5a', hair: '#8a5a2a', arms: 'pocket' },
  { view: 'side', coat: '#1c1c20', legs: '#1c1c20', hair: '#141010', arms: 'can' },
  { view: 'front', coat: '#3a4a3a', legs: '#2a2a30', hair: '#6a6660', arms: 'down' },
  { view: 'back', coat: '#2a3a5a', legs: '#1c1c22', hair: '#141010', arms: 'down', bag: '#c8c0b0' },
  { view: 'front', coat: '#7a3a6a', legs: '#141418', hair: '#141010', arms: 'phone', skirt: true },
];
const UMBRELLAS = ['#c8d6e0', '#c8d6e0', '#1a1a22', '#2a3a6a', '#7a1a2a', '#c8d6e0', '#1a1a22', '#e8e0d0'];
const SKIN = '#c8987a';

function figureAtlas() {
  const cv = document.createElement('canvas'); cv.width = CW * 4; cv.height = CH * 4;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, cv.width, cv.height);
  const rnd = mulberry32(606);
  for (let k = 0; k < 16; k++) {
    const F = FIGURES[k % 8], umbrella = k >= 8;
    const ox = (k % 4) * CW, oy = Math.floor(k / 4) * CH;
    c.save();
    c.beginPath(); c.rect(ox, oy, CW, CH); c.clip();
    const X = (m) => ox + CW / 2 + m * PX, Y = (m) => oy + CH - 4 - m * PX;
    const box = (x0, y0, x1, y1, col) => { c.fillStyle = col; c.fillRect(X(x0), Y(y1), X(x1) - X(x0), Y(y0) - Y(y1)); };
    const disc = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(X(x), Y(y), r * PX, 0, Math.PI * 2); c.fill(); };
    const limb = (x0, y0, x1, y1, w, col) => { c.strokeStyle = col; c.lineWidth = w * PX; c.lineCap = 'round'; c.beginPath(); c.moveTo(X(x0), Y(y0)); c.lineTo(X(x1), Y(y1)); c.stroke(); };
    const side = F.view === 'side', back = F.view === 'back';
    const hw = side ? 0.12 : 0.2, shade = (hex, k2) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.round(Math.min(255, ((n >> v) & 255) * k2)); return `rgb(${f(16)},${f(8)},${f(0)})`; };
    // legs and shoes (or a skirt over dark tights)
    if (F.skirt) {
      box(side ? -0.04 : -0.1, 0.06, side ? 0.04 : -0.03, 0.6, '#141418'); if (!side) box(0.03, 0.06, 0.1, 0.6, '#141418');
      c.fillStyle = shade(F.coat, 0.8); c.beginPath(); c.moveTo(X(-hw * 0.85), Y(0.95)); c.lineTo(X(hw * 0.85), Y(0.95)); c.lineTo(X(hw * 1.15), Y(0.52)); c.lineTo(X(-hw * 1.15), Y(0.52)); c.closePath(); c.fill();
    } else if (side) box(-0.07, 0.06, 0.07, 0.92, F.legs);
    else { box(-0.14, 0.06, -0.02, 0.92, F.legs); box(0.02, 0.06, 0.14, 0.92, F.legs); }
    if (side) box(-0.06, 0, 0.13, 0.07, '#0e0e10');
    else { box(-0.15, 0, -0.02, 0.07, '#0e0e10'); box(0.02, 0, 0.15, 0.07, '#0e0e10'); }
    // the coat: the body, rounded at the shoulders
    c.fillStyle = F.coat; c.beginPath();
    const r = 0.08 * PX;
    if (c.roundRect) c.roundRect(X(-hw), Y(1.45), X(hw) - X(-hw), Y(F.skirt ? 0.9 : 0.8) - Y(1.45), [r, r, 2, 2]); else c.rect(X(-hw), Y(1.45), X(hw) - X(-hw), Y(0.8) - Y(1.45));
    c.fill();
    // a darker fold down the front (or the back seam), so the body is not one flat shape
    if (!side) box(-0.01, 0.84, 0.01, 1.4, shade(F.coat, 0.7));
    // the arms: the far one (hanging), and the near one doing what the figure does
    const arm = shade(F.coat, 0.82);
    const holdUmbrella = umbrella;
    if (!side) limb(-hw - 0.02, 1.38, -hw - 0.05, 0.86, 0.085, arm);
    if (holdUmbrella) {
      limb(hw + 0.02, 1.38, hw + 0.02, 1.12, 0.085, arm); limb(hw + 0.02, 1.12, 0.06, 1.22, 0.08, arm); disc(0.05, 1.23, 0.045, SKIN);
    } else if (F.arms === 'phone') {
      limb(hw + 0.02, 1.38, hw + 0.04, 1.12, 0.085, arm); limb(hw + 0.04, 1.12, 0.11, 1.55, 0.08, arm);
      disc(0.11, 1.56, 0.045, SKIN); box(0.08, 1.53, 0.12, 1.66, '#9ad0ff');
    } else if (F.arms === 'can') {
      limb(hw + 0.02, 1.38, hw + 0.03, 1.12, 0.085, arm); limb(hw + 0.03, 1.12, 0.1, 1.2, 0.08, arm);
      box(0.08, 1.16, 0.14, 1.3, rnd() < 0.5 ? '#e8201e' : '#2a7ad8'); disc(0.09, 1.2, 0.04, SKIN);
    } else if (F.arms === 'pocket') {
      limb(hw + 0.02, 1.38, hw + 0.03, 0.98, 0.085, arm);
    } else {
      limb(hw + 0.02, 1.38, hw + 0.05, 0.86, 0.085, arm); disc(hw + 0.05, 0.82, 0.045, SKIN);
    }
    if (F.bag && !holdUmbrella) box(side ? 0.02 : hw - 0.02, 0.5, (side ? 0.02 : hw - 0.02) + 0.2, 0.8, F.bag);
    else if (F.bag) box(-hw - 0.2, 0.5, -hw + 0.02, 0.8, F.bag);
    // the neck and the head, the hair over it (the whole head seen from behind, a fringe from the front)
    box(-0.04, 1.44, 0.04, 1.53, SKIN);
    if (back) disc(0, 1.63, 0.11, F.hair);
    else if (side) { disc(0, 1.63, 0.105, SKIN); disc(0.1, 1.6, 0.025, SKIN); c.save(); c.beginPath(); c.rect(X(-0.14), Y(1.76), X(0.02) - X(-0.14), Y(1.52) - Y(1.76)); c.clip(); disc(-0.01, 1.64, 0.112, F.hair); c.restore(); disc(0.0, 1.69, 0.08, F.hair); }
    else { disc(0, 1.64, 0.112, F.hair); c.fillStyle = SKIN; c.beginPath(); c.ellipse(X(0), Y(1.6), 0.085 * PX, 0.095 * PX, 0, 0, Math.PI * 2); c.fill(); box(-0.09, 1.66, 0.09, 1.72, F.hair); }
    // the umbrella: a dome on its shaft
    if (umbrella) {
      const uc = UMBRELLAS[k % 8];
      limb(0.05, 1.2, 0.02, 1.98, 0.02, '#3a3a40');
      c.fillStyle = uc; c.beginPath(); c.moveTo(X(-0.55), Y(1.9)); c.quadraticCurveTo(X(-0.5), Y(2.28), X(0.02), Y(2.3)); c.quadraticCurveTo(X(0.54), Y(2.28), X(0.59), Y(1.9)); c.closePath(); c.fill();
      c.strokeStyle = shade(uc, 0.7); c.lineWidth = 1.5;
      for (const x of [-0.3, 0.02, 0.34]) { c.beginPath(); c.moveTo(X(0.02), Y(2.3)); c.lineTo(X(x), Y(1.9)); c.stroke(); }
      // the scalloped edge
      c.fillStyle = uc; for (let x = -0.5; x <= 0.55; x += 0.14) { c.beginPath(); c.arc(X(x), Y(1.9), 0.07 * PX, 0, Math.PI); c.fill(); }
    }
    c.restore();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function peopleLoad(w) {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTex: { value: null }, uWet: { value: 0 }, uNight: { value: 1 }, uClock: { value: 0 } }]),
    vertexShader: /* glsl */`
      attribute vec2 aCorner;   // x across -1..1, y up 0..1
      attribute vec4 aP;        // the figure, a seed, a height, a light level
      attribute vec3 aTint;
      uniform float uClock;
      uniform float uWet;
      varying vec2 vUv;
      varying float vCell;
      varying vec3 vTint;
      #include <fog_pars_vertex>
      void main() {
        vec3 p = position;
        // turned to the camera about the upright, so a figure never leans back
        vec3 toCam = cameraPosition - p; toCam.y = 0.0;
        vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x) + vec3(1e-5, 0.0, 0.0));
        float sc = aP.z;
        // a little weight shifting, each their own
        float sway = sin(uClock * (0.6 + 0.5 * aP.y) + aP.y * 40.0) * 0.018 * aCorner.y;
        vec3 wp = p + right * (aCorner.x * 0.6 + sway) * sc + vec3(0.0, aCorner.y * 2.4 * sc, 0.0);
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        vUv = vec2(aCorner.x * 0.5 + 0.5, aCorner.y);
        vCell = aP.x + (uWet > 0.35 ? 8.0 : 0.0);
        vTint = aTint * aP.w;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uTex;
      uniform float uNight;
      varying vec2 vUv;
      varying float vCell;
      varying vec3 vTint;
      #include <fog_pars_fragment>
      void main() {
        float cx = mod(vCell, 4.0), cy = floor(vCell / 4.0);
        vec2 uv = vec2((cx + vUv.x) / 4.0, 1.0 - (cy + 1.0 - vUv.y) / 4.0);
        vec4 t = texture2D(uTex, uv);
        if (t.a < 0.5) discard;
        // by night lit by the light they stand in; by day as they are
        vec3 col = t.rgb * mix(vec3(1.0), vec3(0.1) + vTint * 0.95, uNight);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
  });
  m.uniforms.uTex.value = figureAtlas();
  if (w.cityClock) m.uniforms.uClock = w.cityClock;
  m.name = 'city people';
  return m;
}

/** Umbrellas up in the rain; the light they stand in by night. */
export function peopleWeather(w, wet, night) {
  if (!w.peopleMat) return;
  w.peopleMat.uniforms.uWet.value = wet;
  w.peopleMat.uniforms.uNight.value = night;
}

/** A chunk's people, one mesh: list of [x, y, z, figure, light colour, light level]. */
export function peopleChunk(w, ch, list) {
  if (!w.peopleMat || !list.length) return;
  const rng = mulberry32((ch.c * 2246822519 + 31) >>> 0);
  const n = list.length;
  const pos = new Float32Array(n * 12), cor = new Float32Array(n * 8), par = new Float32Array(n * 16), tin = new Float32Array(n * 12);
  const idx = new Uint32Array(n * 6);
  const col = new THREE.Color();
  const C = [[-1, 0], [1, 0], [1, 1], [-1, 1]];
  list.forEach(([x, y, z, fig, colour, level], q) => {
    col.set(colour);
    const seed = rng(), h = 0.92 + rng() * 0.14;
    for (let v = 0; v < 4; v++) {
      const o = q * 4 + v;
      pos[o * 3] = x; pos[o * 3 + 1] = y; pos[o * 3 + 2] = z;
      cor[o * 2] = C[v][0]; cor[o * 2 + 1] = C[v][1];
      par[o * 4] = fig; par[o * 4 + 1] = seed; par[o * 4 + 2] = h; par[o * 4 + 3] = level ?? 1;
      tin[o * 3] = col.r; tin[o * 3 + 1] = col.g; tin[o * 3 + 2] = col.b;
    }
    const b = q * 4;
    idx.set([b, b + 1, b + 2, b, b + 2, b + 3], q * 6);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aCorner', new THREE.BufferAttribute(cor, 2));
  geo.setAttribute('aP', new THREE.BufferAttribute(par, 4));
  geo.setAttribute('aTint', new THREE.BufferAttribute(tin, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  geo.boundingSphere.radius += 3;
  ch.own.add(geo);
  const m = new THREE.Mesh(geo, w.peopleMat);
  m.name = 'people';
  ch.group.add(m);
}
