/**
 * NEO TOKYO: steam. Out of the manholes in the road, out of the kitchens' vents on the shop fronts, and in slow tall
 * plumes off the roofs of the taller buildings: soft puffs that rise, spread and thin, lit by the light nearest them
 * (a sign's colour, the street lamps' orange, the city's glow on the clouds). A chunk's puffs are one mesh over one
 * material: each puff is a quad turned to the camera and moved along its life by the clock in the vertex shader, so
 * nothing about them is touched on the CPU after the chunk is built.
 *
 *     w.steamMat = steamLoad(w);                  // once, with the city's materials (it compiles at load)
 *     steamChunk(w, ch, list);                    // per chunk: [x, y, z, kind, colour, dx, dz] (kind 0 manhole,
 *                                                 //   1 a vent pushing out along (dx, dz), 2 a roof's plume)
 *     steamWeather(w, wet, night);                // the weather and the hour
 */
import * as THREE from 'three';
import { mulberry32 } from './config.js?v=202609242220';

// puffs per emitter, by kind (a phone draws fewer)
const PUFFS = [7, 5, 8], PUFFS_PHONE = [4, 3, 5];

/** A soft puff with a little cloudy structure in it, white on black (the shader takes red as its density). */
function puffTexture() {
  const S = 128;
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(S, S);
  const rnd = mulberry32(4242);
  // a few soft lumps round the middle, and fine grain over them
  const lumps = [];
  for (let k = 0; k < 9; k++) { const a = rnd() * Math.PI * 2, r = rnd() * 0.32; lumps.push([Math.cos(a) * r, Math.sin(a) * r, 0.22 + rnd() * 0.22, 0.5 + rnd() * 0.5]); }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x + 0.5) / S * 2 - 1, v = (y + 0.5) / S * 2 - 1;
    let d = 0;
    for (const [lx, ly, lr, lw] of lumps) { const q = Math.hypot(u - lx, v - ly) / lr; d += lw * Math.exp(-q * q * 1.6); }
    const edge = Math.max(0, 1 - Math.hypot(u, v));
    const grain = 0.82 + 0.18 * Math.sin(u * 23 + Math.sin(v * 17) * 2) * Math.sin(v * 19 + Math.sin(u * 13) * 2);
    const a = Math.min(1, d * 0.55) * edge * edge * (3 - 2 * edge) * grain;
    const i = (y * S + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, a * 255)); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export function steamLoad(w) {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTex: { value: null }, uWet: { value: 0 }, uNight: { value: 1 }, uTime: { value: 0 } }]),
    vertexShader: /* glsl */`
      attribute vec2 aCorner;
      attribute vec4 aP;       // the puff's phase in its emitter's cycle, a seed, the kind, a size
      attribute vec2 aDir;     // a vent's push, along the ground
      attribute vec3 aTint;    // the light nearest it
      uniform float uTime;
      uniform float uWet;
      uniform float uNight;
      varying vec2 vUv;
      varying float vA;
      varying vec3 vCol;
      #include <fog_pars_vertex>
      void main() {
        float kind = aP.z, sd = aP.y;
        // a manhole's steam lingers, a vent's puffs are quick, a roof's plume is slow and tall
        float life = kind < 0.5 ? 4.2 : kind < 1.5 ? 2.6 : 9.0;
        float age = fract(uTime / life + aP.x);
        float rise = kind < 0.5 ? 3.2 : kind < 1.5 ? 1.9 : 17.0;
        float size0 = kind < 0.5 ? 0.42 : kind < 1.5 ? 0.26 : 1.7;
        float grow = kind < 0.5 ? 1.5 : kind < 1.5 ? 1.25 : 6.5;
        float big = kind > 1.5 ? 3.0 : 1.0;
        vec3 p = position;
        // up, slowing as it cools; out of a vent first; off on the breeze; and a slow curl of its own
        p.y += rise * (1.0 - (1.0 - age) * (1.0 - age));
        p.xz += aDir * 1.3 * (1.0 - exp(-age * 5.0));
        p.xz += vec2(0.8, 0.35) * big * 1.3 * age * age;
        p.x += sin(sd * 40.0 + age * 4.5) * 0.35 * age * big;
        p.z += cos(sd * 23.0 + age * 3.7) * 0.35 * age * big;
        float size = (size0 + grow * age) * aP.w;
        vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        // (each puff turned its own way and turning slowly, so the texture never shows the same face twice)
        float ang = sd * 6.2832 + age * (sd - 0.5) * 1.6;
        float ca = cos(ang), sa = sin(ang);
        vec2 c = vec2(ca * aCorner.x - sa * aCorner.y, sa * aCorner.x + ca * aCorner.y);
        vec3 wp = p + (camR * c.x + camU * c.y) * size;
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        vUv = aCorner * 0.5 + 0.5;
        // in quickly and out slowly; thicker on a cold wet night; never a grey wall in the lens's face (a manhole's
        // column beside the car read as a solid white pillar in the rain: thinner, and thinning from 8 m in)
        float a = smoothstep(0.0, 0.1, age) * (1.0 - smoothstep(0.35, 1.0, age));
        a *= (kind < 0.5 ? 0.3 : kind < 1.5 ? 0.4 : 0.15) * (0.6 + 0.4 * uWet);
        a *= smoothstep(2.0, 8.0, -mvPosition.z);
        vA = a;
        // lit by the light beside it at night (not a lamp itself), plain grey-white by day
        vCol = mix(vec3(0.62, 0.63, 0.66), vec3(0.15, 0.15, 0.18) + aTint * 0.46, uNight);
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uTex;
      varying vec2 vUv;
      varying float vA;
      varying vec3 vCol;
      #include <fog_pars_fragment>
      void main() {
        float a = texture2D(uTex, vUv).r * vA;
        if (a < 0.003) discard;
        gl_FragColor = vec4(vCol, a);
        #include <fog_fragment>
      }`,
    transparent: true, depthWrite: false, fog: true,
  });
  m.uniforms.uTex.value = puffTexture();
  // (the city's clock, shared with the signs and the signals)
  if (w.cityClock) m.uniforms.uTime = w.cityClock;
  m.name = 'city steam';
  return m;
}

/** The weather: steam shows best on a cold wet night. */
export function steamWeather(w, wet, night) {
  if (!w.steamMat) return;
  w.steamMat.uniforms.uWet.value = wet;
  w.steamMat.uniforms.uNight.value = night;
}

/** A chunk's steam, one mesh: list of [x, y, z, kind, colour, dx, dz]. */
export function steamChunk(w, ch, list) {
  if (!w.steamMat || !list.length) return;
  const phone = w.detail && w.detail.phone;
  const rng = mulberry32((ch.c * 2654435761 + 97) >>> 0);
  let n = 0;
  for (const e of list) n += (phone ? PUFFS_PHONE : PUFFS)[e[3]];
  const pos = new Float32Array(n * 12), cor = new Float32Array(n * 8), par = new Float32Array(n * 16), dir = new Float32Array(n * 8), tin = new Float32Array(n * 12);
  const idx = new Uint32Array(n * 6);
  const col = new THREE.Color();
  const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  let q = 0;
  for (const [x, y, z, kind, colour, dx, dz] of list) {
    const K = (phone ? PUFFS_PHONE : PUFFS)[kind];
    col.set(colour);
    const base = rng();
    for (let j = 0; j < K; j++, q++) {
      const phase = (base + j / K + (rng() - 0.5) * 0.4 / K) % 1, seed = rng(), size = 0.8 + rng() * 0.45;
      for (let v = 0; v < 4; v++) {
        const o = q * 4 + v;
        pos[o * 3] = x; pos[o * 3 + 1] = y; pos[o * 3 + 2] = z;
        cor[o * 2] = C[v][0]; cor[o * 2 + 1] = C[v][1];
        par[o * 4] = phase; par[o * 4 + 1] = seed; par[o * 4 + 2] = kind; par[o * 4 + 3] = size;
        dir[o * 2] = dx || 0; dir[o * 2 + 1] = dz || 0;
        tin[o * 3] = col.r; tin[o * 3 + 1] = col.g; tin[o * 3 + 2] = col.b;
      }
      const b = q * 4;
      idx.set([b, b + 1, b + 2, b, b + 2, b + 3], q * 6);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aCorner', new THREE.BufferAttribute(cor, 2));
  geo.setAttribute('aP', new THREE.BufferAttribute(par, 4));
  geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 2));
  geo.setAttribute('aTint', new THREE.BufferAttribute(tin, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  geo.boundingSphere.radius += 20;              // (the puffs rise and drift well away from where they start)
  ch.own.add(geo);
  const m = new THREE.Mesh(geo, w.steamMat);
  m.name = 'steam'; m.renderOrder = 3;
  ch.group.add(m);
}
