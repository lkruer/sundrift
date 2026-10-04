/**
 * The air: what makes each map a place at night, beyond the road and what stands beside it.
 *
 * The pass: a sea of cloud (unkai) lying in the valleys below the road, silver under the moon and rose at dawn;
 * thin wisps drifting across the stars; fireflies pulsing along the verges; now and then a shooting star.
 * NEO TOKYO: a low cloud deck lit from beneath by the city (the towers vanish into it in the rain), searchlights
 * sweeping it from the rooftops, and two holographic koi swimming slow circles over the streets.
 * Both: in a storm, lightning: a bolt on the horizon, the sky and the haze flaring, the thunder after it.
 *
 * Every piece is one mesh whose shape and motion live in its shaders, fed a few uniforms a frame, plus a small
 * tiling noise texture made here once. Nothing in here writes depth, so none of it is inked by the cel pass.
 */
import * as THREE from 'three';
import { clamp, lerp, smoothstep, REDUCED_MOTION } from './config.js?v=202610040057';

/** Tiling value noise, four octaves in the four channels (4, 8, 16 and 32 cells across). */
function noiseTexture(size = 128) {
  const data = new Uint8Array(size * size * 4);
  const periods = [4, 8, 16, 32];
  const lattice = periods.map((p) => {
    const a = new Float32Array(p * p); let s = p * 7919 + 17;
    for (let i = 0; i < a.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; a[i] = s / 4294967296; }
    return a;
  });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    for (let c = 0; c < 4; c++) {
      const p = periods[c], L = lattice[c];
      const fx = (x / size) * p, fy = (y / size) * p, ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const x0 = ix % p, x1 = (ix + 1) % p, y0 = (iy % p) * p, y1 = ((iy + 1) % p) * p;
      const a = L[y0 + x0], b = L[y0 + x1], c2 = L[y1 + x0], d = L[y1 + x1];
      data[(y * size + x) * 4 + c] = Math.round(255 * (a + (b - a) * sx + (c2 - a) * sy + (a - b - c2 + d) * sx * sy));
    }
  }
  const t = new THREE.DataTexture(data, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

const rnd = (() => { let s = 90210; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();

// ------------------------------------------------------------------------------------------------ the cloud deck

/**
 * A layer of cloud overhead, a square that travels with the camera with its pattern fixed in the world and
 * drifting on the wind. It thins out toward its rim and melts into the haze there, so it never shows an edge.
 * Lit from below by `uLit` (the city, the moon) where it is thin, `uShade` where it is thick; up to six bright
 * spots where searchlights strike it.
 */
class CloudDeck {
  constructor(noise) {
    this.u = {
      uNoise: { value: noise }, uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uSize: { value: 3200 },
      uHeight: { value: 300 }, uCover: { value: 0.4 }, uOpacity: { value: 0 }, uScale: { value: 1 },
      uLit: { value: new THREE.Color() }, uShade: { value: new THREE.Color() }, uHaze: { value: new THREE.Color() },
      uSpots: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, 1, 0)) }, uSpotCol: { value: new THREE.Color(0.75, 0.82, 1) },
      uFlash: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      vertexShader: /* glsl */`
        uniform vec3 uCenter; uniform float uSize, uHeight; varying vec3 vW;
        void main() {
          vW = vec3(uCenter.x + position.x * uSize, uHeight, uCenter.z - position.y * uSize);
          gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uNoise; uniform float uTime, uCover, uOpacity, uSize, uFlash, uScale;
        uniform vec3 uCenter, uLit, uShade, uHaze, uSpotCol; uniform vec4 uSpots[6];
        varying vec3 vW;
        void main() {
          vec2 p = vW.xz, wind = uTime * vec2(3.2, 1.1);
          float n = dot(texture2D(uNoise, (p + wind) / (1500.0 * uScale)), vec4(0.5, 0.27, 0.15, 0.08));
          n += 0.55 * (dot(texture2D(uNoise, (p + wind * 1.7) / (430.0 * uScale) + 0.37), vec4(0.38, 0.3, 0.2, 0.12)) - 0.5);
          float dens = smoothstep(1.0 - uCover - 0.1, 1.0 - uCover + 0.24, n);
          float r = length(p - uCenter.xz) / uSize;
          float edge = 1.0 - smoothstep(0.55, 1.0, r);
          vec3 col = mix(uShade, uLit, clamp(0.3 + 1.1 * (1.0 - dens) * n + 0.35 * r, 0.0, 1.0));
          for (int i = 0; i < 6; i++) {
            vec4 s = uSpots[i];
            vec2 d = (p - s.xy) / s.z;
            col += uSpotCol * s.w * exp(-dot(d, d) * 2.0) * (0.45 + n);
          }
          col += vec3(0.7, 0.75, 1.0) * uFlash * (0.35 + dens);
          col = mix(col, uHaze, smoothstep(0.3, 0.95, r) * 0.7);
          gl_FragColor = vec4(col, dens * edge * uOpacity);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -500; this.mesh.name = 'clouds';
  }
}

// ------------------------------------------------------------------------------------------------ the cumulus

/**
 * Cumulus on the horizon, the way an anime sky paints them: heaps of round puffs on flat bases, each puff lit like a
 * ball by the sun in three flat tones, a bright silver edge where the sun is behind them, their feet lost in the haze.
 * One band of the sky (a ring round the camera from just under the horizon to 26 degrees up, beyond the far ridges,
 * which stand in front of it), one pass, no texture: the clouds are cells round the horizon, each a hash, so they keep
 * their place in the sky as the camera turns, and drift slowly on. The colours are the hour's (daylight.js).
 */
const BANK_R = 3900, BANK_N = 24;
class CloudBank {
  constructor() {
    this.u = {
      uCam: { value: new THREE.Vector3() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uLit: { value: new THREE.Color() }, uShade: { value: new THREE.Color() }, uRim: { value: new THREE.Color() },
      uHaze: { value: new THREE.Color() }, uCover: { value: 0.5 }, uK: { value: 0 }, uTime: { value: 0 }, uGrey: { value: 0 },
    };
    // the band: directions from 3 degrees under the horizon to 26 over it, all the way round
    const seg = 96, rows = 4, e0 = -3 * Math.PI / 180, e1 = 26 * Math.PI / 180;
    const pos = new Float32Array((seg + 1) * (rows + 1) * 3), idx = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      for (let j = 0; j <= rows; j++) {
        const e = e0 + (e1 - e0) * (j / rows), c = Math.cos(e);
        pos.set([Math.sin(a) * c, Math.sin(e), Math.cos(a) * c], (i * (rows + 1) + j) * 3);
        if (i < seg && j < rows) { const v = i * (rows + 1) + j, w = v + rows + 1; idx.push(v, w, v + 1, v + 1, w, w + 1); }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      vertexShader: /* glsl */`
        uniform vec3 uCam; varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * viewMatrix * vec4(uCam + position * ${BANK_R.toFixed(1)}, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uSunDir, uLit, uShade, uRim, uHaze; uniform float uCover, uK, uTime, uGrey;
        varying vec3 vDir;
        float hh(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
        void main() {
          vec3 d = normalize(vDir);
          const float N = ${BANK_N.toFixed(1)}, TAU = 6.2831853;
          // in cells: round the horizon, and up by the same measure, so a puff is round in the sky
          float U = (atan(d.x, d.z) / TAU + 0.5) * N + uTime * 0.0025;
          float V = asin(clamp(d.y, -1.0, 1.0)) / TAU * N;
          // (a screen pixel in cells, from the direction's own change: U itself jumps a whole turn at the seam behind)
          float fw = max(length(fwidth(d)) / TAU * N, 1e-4) * 1.1;
          float bestZ = -1.0, cover = 0.0, baseV = 0.0;
          vec3 nrm = vec3(0.0, 0.0, 1.0);
          float ci = floor(U);
          for (int k = -1; k <= 1; k++) {
            float c = ci + float(k), id = mod(c, N);
            if (hh(id * 3.7 + 1.3) > uCover) continue;
            float w = 0.3 + 0.32 * hh(id * 5.1 + 2.9);           // its half width, in cells (a cell is 15 degrees)
            float base = 0.1 + 0.16 * hh(id * 7.3 + 4.7);        // its flat base, clear of the far ridges
            float tall = 0.3 + 0.75 * hh(id * 9.7 + 6.1);        // how high it heaps, for its width
            float cx = c + 0.5 + (hh(id * 11.3 + 8.3) - 0.5) * 0.35;
            for (int j = 0; j < 7; j++) {
              float fj = float(j);
              float a = hh(id * 13.1 + fj * 1.7), b = hh(id * 17.9 + fj * 2.3), r0 = hh(id * 19.3 + fj * 3.1);
              // four along the base, two heaped on them, one crown
              float row = j < 4 ? 0.0 : (j < 6 ? 1.0 : 2.0);
              float slot = j < 4 ? fj - 1.5 : (j < 6 ? (fj - 4.5) * 1.3 : (a - 0.5) * 0.8);
              float pr = w * (row < 0.5 ? 0.36 + 0.14 * r0 : (row < 1.5 ? 0.32 + 0.12 * r0 : 0.27 + 0.1 * r0));
              float px = cx + slot * w * (row < 0.5 ? 0.42 : 0.34) + (a - 0.5) * 0.22 * w;
              float py = base + pr * 0.5 + row * tall * w * 0.42 + b * 0.05;
              vec2 q = vec2(U - px, V - py);
              float dl = length(q), inside = pr - dl;
              if (inside > -fw) {
                cover = max(cover, clamp(inside / fw + 0.5, 0.0, 1.0) * smoothstep(base - fw, base + 0.05, V));
                float z = sqrt(max(pr * pr - dl * dl, 0.0));
                // the puff whose ball stands furthest toward the eye is the one seen (the crown a little forward)
                if (z + row * 0.05 * w > bestZ) { bestZ = z + row * 0.05 * w; nrm = vec3(q, z) / pr; baseV = base; }
              }
            }
          }
          if (cover < 0.004) discard;
          // the light in the cloud's own frame: round the horizon, up, and toward the eye
          vec3 dh = normalize(vec3(d.x, 0.0, d.z) + 1e-5);
          vec3 L = normalize(vec3(dot(uSunDir, vec3(dh.z, 0.0, -dh.x)), uSunDir.y, -dot(uSunDir, dh)));
          float ndl = dot(nrm, L);
          // three flat tones, each edge a pixel soft
          float tone = 0.45 * smoothstep(-0.12, -0.04, ndl) + 0.55 * smoothstep(0.36, 0.44, ndl);
          vec3 col = mix(uShade, uLit, tone);
          // the base in its own shadow
          col = mix(col, uShade * 0.9, (1.0 - smoothstep(baseV, baseV + 0.16, V)) * 0.55);
          // the silver edge: a puff's rim where the light is behind the cloud or low beside it
          float back = clamp(-L.z * 0.75 + 0.35 * (1.0 - abs(L.y)), 0.0, 1.0);
          col += uRim * smoothstep(0.62, 0.92, 1.0 - nrm.z) * back * 0.6;
          // toward the sun the whole heap glows a little, lit through
          float toSun = max(dot(dh, normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + 1e-5)), 0.0);
          col += uRim * pow(toSun, 6.0) * 0.1;
          // the feet lost in the haze
          col = mix(col, uHaze, (1.0 - smoothstep(0.05, 0.55, V)) * 0.55);
          col = mix(col, vec3(dot(col, vec3(0.2126, 0.7152, 0.0722)) * 0.85), uGrey);
          gl_FragColor = vec4(col, cover * uK);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -600; this.mesh.name = 'cumulus';
  }
}

// ------------------------------------------------------------------------------------------------ the milky way

/**
 * The Milky Way on a clear dark night over the pass: a soft band of light across the sky, brighter and warmer toward
 * the galaxy's heart, torn along its middle by dark lanes of dust, faded into the haze near the horizon. A dome round
 * the camera, one draw, the noise looked up three ways (triplanar on the direction) so the sphere has no seam; drawn
 * before the stars and under the cumulus. The moon washes it out, the city's own light takes it, and so does cloud.
 */
class MilkyWay {
  constructor(noise) {
    this.u = { uNoise: { value: noise }, uK: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, fog: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); p.z = p.w * 0.99999; gl_Position = p; }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uNoise; uniform float uK; varying vec3 vDir;
        // the noise on a direction: three projections blended by the direction's own axes
        float tri(vec3 d, float sc, vec4 w) {
          vec3 a = abs(d); a /= a.x + a.y + a.z;
          return dot(texture2D(uNoise, d.yz * sc), w) * a.x + dot(texture2D(uNoise, d.zx * sc + 0.31), w) * a.y + dot(texture2D(uNoise, d.xy * sc + 0.67), w) * a.z;
        }
        void main() {
          vec3 d = normalize(vDir);
          if (d.y < 0.0) discard;
          // the galactic plane, tilted across the sky, and its heart low in the south-west
          vec3 n = normalize(vec3(0.42, 0.5, 0.76)), core = normalize(vec3(-0.62, 0.22, 0.75));
          float h = dot(d, n);
          float body = tri(d, 1.6, vec4(0.45, 0.3, 0.17, 0.08));
          float fine = tri(d, 4.8, vec4(0.2, 0.3, 0.3, 0.2));
          float wide = exp(-pow(h / (0.13 + 0.06 * body), 2.0));
          float heart = pow(max(dot(d, core), 0.0), 3.0);
          float glow = wide * (0.45 + 0.75 * body) * (0.6 + 0.9 * heart) + exp(-pow(h / 0.035, 2.0)) * 0.35 * (0.5 + body);
          // the dust: dark lanes torn along the band's middle
          float dust = smoothstep(0.42, 0.7, fine * 0.6 + body * 0.55) * exp(-pow((h - 0.015) / 0.05, 2.0));
          glow *= 1.0 - 0.75 * dust;
          // a grain of faint stars inside the band
          glow += wide * smoothstep(0.8, 0.95, fine) * 0.35;
          vec3 col = mix(vec3(0.52, 0.62, 0.95), vec3(1.0, 0.82, 0.64), heart * 0.8);
          float k = uK * smoothstep(0.03, 0.3, d.y);
          gl_FragColor = vec4(col * glow * k * 0.12, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(2450, 40, 20), mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -701; this.mesh.name = 'milky way';
  }
}

// ------------------------------------------------------------------------------------------------ birds

/**
 * Birds over the valley by day: a few flocks wheeling on slow loops a couple of hundred metres off, each bird a pair of
 * wings that beat and glide, dark against the sky (crows heading home at golden hour, black on the gold). One draw: every
 * bird's place is worked out in the vertex shader from its flock, its seed and the clock. Not by night, nor in the rain.
 */
class Birds {
  constructor(n) {
    this.n = n;
    // a bird: two wings hinged on the body line, each a triangle (root front, root back, tip), 2.4 m from tip to tip
    // (larger than life, so one reads as a bird and not a speck at two hundred metres)
    const pos = new Float32Array(n * 6 * 3), seed = new Float32Array(n * 6 * 4);
    const W = [[0, 0, 0.32], [0, 0, -0.18], [1.2, 0, -0.08]];
    let v = 0;
    for (let i = 0; i < n; i++) {
      const sd = [rnd(), rnd(), rnd(), Math.floor(i / Math.ceil(n / 3))];
      for (const side of [1, -1]) for (const [x, y, z] of W) {
        pos.set([x * side, y, z], v * 3);
        seed.set(sd, v * 4); v++;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    this.u = {
      uTime: { value: 0 }, uFlock: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
      uCol: { value: new THREE.Color(0.08, 0.08, 0.1) }, uHaze: { value: new THREE.Color() }, uCam: { value: new THREE.Vector3() }, uK: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, side: THREE.DoubleSide, fog: false,
      vertexShader: /* glsl */`
        uniform float uTime, uK; uniform vec4 uFlock[3]; uniform vec3 uCam;
        attribute vec4 aSeed; varying float vFar;
        void main() {
          int f = int(aSeed.w + 0.5);
          vec4 F = f == 0 ? uFlock[0] : f == 1 ? uFlock[1] : uFlock[2];
          // round the flock's centre on a loop of its own, each bird a little out of step and off the line
          float sp = 0.16 + 0.05 * aSeed.x, a = uTime * sp + aSeed.y * 1.4 + float(f) * 2.1;
          float r = F.w * (0.55 + 0.45 * aSeed.z);
          vec3 c = F.xyz + vec3(cos(a) * r, sin(a * 0.7 + aSeed.x * 6.0) * 6.0 + (aSeed.z - 0.5) * 14.0, sin(a) * r * 0.6);
          vec3 fwd = normalize(vec3(-sin(a) * r, 0.0, cos(a) * r * 0.6));
          vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
          // the wings beat in bursts and glide between (a crow's flap, flap, glide), the tip swinging up and down
          float beat = sin(uTime * (7.0 + 2.0 * aSeed.x) + aSeed.y * 30.0);
          float glide = smoothstep(-0.2, 0.6, sin(uTime * 0.9 + aSeed.z * 20.0));
          float tip = abs(position.x);
          float lift = mix(beat * 0.55, 0.12, glide) * tip;
          // (as the day goes the birds go one by one, home to roost, rather than all at once)
          float here = step(aSeed.x, uK);
          vec3 p = c + (side * position.x * 2.0 + fwd * position.z * 2.0 + vec3(0.0, lift * 2.0, 0.0)) * here;
          vFar = clamp(length(p - uCam) / 900.0, 0.0, 1.0);
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uCol, uHaze; varying float vFar;
        void main() { gl_FragColor = vec4(mix(uCol, uHaze, vFar * 0.55), 1.0); }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false; this.mesh.name = 'birds';
    this.anchor = null;
  }

  /** The flocks are set out round the camera, out over the open air, and moved on once it has gone far from them. */
  update(t, cam, viewYaw, groundY, k, haze, light) {
    this.u.uTime.value = t; this.u.uCam.value.copy(cam);
    if (!this.anchor || Math.hypot(cam.x - this.anchor[0], cam.z - this.anchor[1]) > 420) {
      this.anchor = [cam.x, cam.z];
      const F = this.u.uFlock.value;
      for (let i = 0; i < 3; i++) {
        // ahead of the camera, a little to either side, so a flock is in the picture more often than not
        const a = viewYaw + (i - 1) * 0.7 + (rnd() - 0.5) * 0.5, d = 170 + rnd() * 160;
        F[i].set(cam.x + Math.sin(a) * d, groundY + 70 + rnd() * 70, cam.z + Math.cos(a) * d, 18 + rnd() * 26);
      }
    }
    this.u.uHaze.value.copy(haze);
    // dark against the sky by day, near black against a gold one
    this.u.uCol.value.setRGB(0.05 + 0.1 * light, 0.05 + 0.1 * light, 0.07 + 0.11 * light);
    this.u.uK.value = k;
    this.mesh.visible = k > 0.02;
  }
}

// ------------------------------------------------------------------------------------------------ the sea of cloud

/**
 * Unkai: the valleys below the road filled with cloud. Not geometry (flat sheets cut the hillsides in hard contour
 * lines and read as lakes): the cel pass draws it as a height fog from the depth buffer, integrating along each
 * pixel's ray the cloud below a top that follows the car's height slowly and rises and falls in billows. This is
 * the state it reads.
 */
class ValleyMist {
  constructor() {
    this.on = 0; this.top = -1e4; this.density = 0.03; this.soft = 14;
    this.col = new THREE.Color(); this.glow = new THREE.Color(); this.far = new THREE.Color(); this.flash = 0;
  }
}

// ------------------------------------------------------------------------------------------------ fireflies

/**
 * Hotaru: points of green-gold light hanging over the verges, each drifting on its own slow loop and pulsing on
 * its own beat. Placed by the caller (`spot()` gives a place beside the road ahead) and moved on once the car has
 * left them well behind, a few a frame.
 */
class Fireflies {
  constructor(n) {
    this.n = n;
    const pos = new Float32Array(n * 3).fill(0), seed = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { seed[i * 4] = rnd(); seed[i * 4 + 1] = rnd(); seed[i * 4 + 2] = rnd(); seed[i * 4 + 3] = rnd(); pos[i * 3 + 1] = -1e5; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    this.pos = pos;
    this.u = { uTime: { value: 0 }, uI: { value: 0 }, uScale: { value: 600 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: /* glsl */`
        attribute vec4 aSeed; uniform float uTime, uI, uScale; varying float vB;
        void main() {
          float ph = aSeed.x * 6.2831853;
          vec3 p = position + vec3(sin(uTime * (0.23 + 0.2 * aSeed.z) + ph) * 1.3, sin(uTime * 0.5 + ph * 1.7) * 0.45, cos(uTime * (0.19 + 0.2 * aSeed.w) + ph * 2.3) * 1.3);
          float blink = pow(max(0.0, sin(uTime * (0.7 + 0.8 * aSeed.y) + ph * 3.0)), 6.0);
          vec4 mv = viewMatrix * vec4(p, 1.0);
          // (small points of light, not orbs: capped on the screen, and gone right at the lens)
          vB = (0.14 + blink) * uI * smoothstep(3.0, 9.0, -mv.z);
          gl_PointSize = clamp(uScale * (0.42 + 0.34 * blink) / max(0.5, -mv.z), 1.5, 22.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying float vB;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = pow(max(0.0, 1.0 - d), 2.2) + 0.9 * pow(max(0.0, 1.0 - d * 2.8), 2.0);
          gl_FragColor = vec4(vec3(0.78, 1.0, 0.38) * vB * a * 3.4, 1.0);
        }`,
    });
    this.mesh = new THREE.Points(g, mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 4; this.mesh.name = 'fireflies';
    this.next = 0;
  }

  /** Move on the few left furthest behind; `spot()` returns [x, y, z] or null. */
  tend(cx, cz, spot, budget = 5) {
    let moved = 0, changed = false;
    for (let k = 0; k < this.n && moved < budget; k++) {
      const i = this.next; this.next = (this.next + 1) % this.n;
      const dx = this.pos[i * 3] - cx, dz = this.pos[i * 3 + 2] - cz;
      if (this.pos[i * 3 + 1] > -1e4 && dx * dx + dz * dz < 150 * 150) continue;
      const p = spot();
      moved++;
      if (!p) continue;
      this.pos[i * 3] = p[0]; this.pos[i * 3 + 1] = p[1]; this.pos[i * 3 + 2] = p[2];
      changed = true;
    }
    if (changed) this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}

// ------------------------------------------------------------------------------------------------ searchlights

/**
 * Searchlight beams from the rooftops: open cones whose light is worked out per pixel from how close the eye's ray
 * passes to the beam's axis, so each reads as a soft shaft of lit air with a bright core, fading up into the deck.
 */
class Searchlights {
  constructor(n) {
    this.n = n;
    const geo = new THREE.InstancedBufferGeometry().copy(new THREE.CylinderGeometry(1, 1, 1, 18, 1, true).translate(0, 0.5, 0));
    this.base = new Float32Array(n * 3); this.dir = new Float32Array(n * 3); this.shape = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
    geo.setAttribute('aBase', new THREE.InstancedBufferAttribute(this.base, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aDir', new THREE.InstancedBufferAttribute(this.dir, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aShape', new THREE.InstancedBufferAttribute(this.shape, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aCol', new THREE.InstancedBufferAttribute(this.col, 3));
    geo.instanceCount = n;
    this.u = { uI: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: /* glsl */`
        attribute vec3 aBase, aDir, aShape, aCol; varying vec3 vW, vB, vA, vCol, vShape;
        void main() {
          vec3 A = normalize(aDir);
          vec3 T = normalize(abs(A.y) < 0.99 ? cross(A, vec3(0.0, 1.0, 0.0)) : vec3(1.0, 0.0, 0.0));
          vec3 N = cross(T, A);
          float r = mix(aShape.x, aShape.y, position.y);
          vec3 w = aBase + A * position.y * aShape.z + (T * position.x + N * position.z) * r;
          vW = w; vB = aBase; vA = A; vCol = aCol; vShape = aShape;
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uI; varying vec3 vW, vB, vA, vCol, vShape;
        void main() {
          vec3 rd = normalize(vW - cameraPosition), w0 = cameraPosition - vB;
          float b = dot(rd, vA), d = dot(rd, w0), e = dot(vA, w0), den = max(1.0 - b * b, 1e-4);
          float t = (b * e - d) / den, s = (e - b * d) / den;
          float along = clamp(s / vShape.z, 0.0, 1.0);
          float dist = length((cameraPosition + rd * t) - (vB + vA * s));
          float x = clamp(dist / mix(vShape.x, vShape.y, along), 0.0, 1.0);
          float core = 0.55 * pow(1.0 - x, 2.0) + 1.3 * pow(1.0 - x, 10.0);
          float fade = smoothstep(0.0, 0.03, along) * (1.0 - smoothstep(0.6, 1.0, along)) * (1.0 - 0.45 * along);
          gl_FragColor = vec4(vCol * core * fade * uI, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 3; this.mesh.name = 'searchlights';
    const COLS = [[0.75, 0.85, 1.0], [0.75, 0.85, 1.0], [0.9, 0.55, 1.0], [0.5, 0.95, 1.0], [0.75, 0.85, 1.0], [1.0, 0.6, 0.75]];
    this.beams = [];
    for (let i = 0; i < n; i++) {
      const c = COLS[i % COLS.length];
      this.col.set(c, i * 3);
      this.beams.push({ bearing: (i / n) * Math.PI * 2 + rnd() * 0.6, dist: 520 + rnd() * 420, roof: 70 + rnd() * 90,
        az0: rnd() * Math.PI * 2, sweep: 0.5 + rnd() * 0.7, w: 0.09 + rnd() * 0.1, ph: rnd() * 6.28, el0: 1.0 + rnd() * 0.3, spot: [0, 0, 0, 0] });
    }
  }

  update(t, cam, groundY, deckY, I) {
    for (let i = 0; i < this.n; i++) {
      const b = this.beams[i];
      const bx = cam.x + Math.sin(b.bearing) * b.dist, bz = cam.z + Math.cos(b.bearing) * b.dist, by = groundY + b.roof;
      const az = b.az0 + Math.sin(t * b.w + b.ph) * b.sweep, el = b.el0 + Math.sin(t * b.w * 0.63 + b.ph * 1.7) * 0.14;
      const dx = Math.cos(el) * Math.sin(az), dy = Math.sin(el), dz = Math.cos(el) * Math.cos(az);
      const reach = Math.max(40, (deckY - by) / dy);
      this.base.set([bx, by, bz], i * 3); this.dir.set([dx, dy, dz], i * 3);
      this.shape.set([2.2, 2.2 + reach * 0.07, reach + 30], i * 3);
      b.spot[0] = bx + dx * reach; b.spot[1] = bz + dz * reach; b.spot[2] = 8 + reach * 0.09; b.spot[3] = I;
    }
    const g = this.mesh.geometry.attributes;
    g.aBase.needsUpdate = true; g.aDir.needsUpdate = true; g.aShape.needsUpdate = true;
  }
}

// ------------------------------------------------------------------------------------------------ the holo koi

/** A koi, head toward +z, one unit long: the body as rings along the spine, the tail and the fins as flat fans. */
function koiGeometry() {
  const P = [], N = [], U = [], F = [], I = [];
  const vert = (x, y, z, nx, ny, nz, u, fin) => { P.push(x, y, z); N.push(nx, ny, nz); U.push(u); F.push(fin); return P.length / 3 - 1; };
  const RING = 14, SEG = 28, UEND = 0.78;
  const wid = (u) => (u < 0.22 ? 0.088 * Math.pow(Math.sin((u / 0.22) * Math.PI * 0.5), 0.6) : 0.088 - 0.064 * smoothstep(0.22, UEND, u));
  const rows = [];
  for (let j = 0; j <= SEG; j++) {
    const u = (j / SEG) * UEND, w = Math.max(0.004, wid(u)), h = w * 1.18, z = 0.5 - u;
    const row = [];
    for (let k = 0; k < RING; k++) {
      const a = (k / RING) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const yy = h * sa * (sa < 0 ? 0.85 : 1) + (sa > 0 ? 0.012 * Math.sin(Math.PI * Math.min(1, u / 0.6)) : 0);
      row.push(vert(w * ca, yy, z, ca / w, sa / h, 0, u, 0));
    }
    rows.push(row);
  }
  for (let j = 0; j < SEG; j++) for (let k = 0; k < RING; k++) {
    const a = rows[j][k], b = rows[j][(k + 1) % RING], c = rows[j + 1][k], d = rows[j + 1][(k + 1) % RING];
    I.push(a, c, b, b, c, d);
  }
  const nose = vert(0, 0, 0.505, 0, 0, 1, 0, 0);
  for (let k = 0; k < RING; k++) I.push(nose, rows[0][k], rows[0][(k + 1) % RING]);
  // a flat fan from a root point through an outline, in the plane its outline gives
  const fan = (root, outline, normal) => {
    const r = vert(...root, ...normal, 0.5 - root[2], 1);
    const ids = outline.map((p) => vert(...p, ...normal, 0.5 - p[2], 1));
    for (let k = 0; k < ids.length - 1; k++) I.push(r, ids[k], ids[k + 1]);
  };
  // the tail: two long flowing lobes, in the vertical plane
  const tail = [[0.025, 0.78], [0.09, 0.86], [0.15, 0.96], [0.135, 1.02], [0.07, 0.97], [0.0, 0.93], [-0.07, 0.97], [-0.135, 1.02], [-0.15, 0.96], [-0.09, 0.86], [-0.025, 0.78]];
  fan([0, 0, 0.5 - 0.74], tail.map(([y, u]) => [0, y, 0.5 - u]), [1, 0, 0]);
  // the dorsal fin, along the back
  const dors = []; for (let k = 0; k <= 8; k++) { const u = 0.2 + (k / 8) * 0.34; dors.push([0, wid(u) * 1.28 + 0.055 * Math.sin(Math.PI * Math.pow(k / 8, 0.7)), 0.5 - u]); }
  fan([0, wid(0.37) * 1.1, 0.5 - 0.37], dors, [1, 0, 0]);
  // the pectoral fins, long and trailing like a butterfly koi's
  for (const s of [1, -1]) {
    const w0 = wid(0.24);
    fan([s * w0 * 0.8, -w0 * 0.5, 0.5 - 0.22], [[s * w0 * 0.9, -w0 * 0.55, 0.5 - 0.2], [s * (w0 + 0.1), -0.07, 0.5 - 0.28], [s * (w0 + 0.15), -0.1, 0.5 - 0.4], [s * (w0 + 0.07), -0.07, 0.5 - 0.37], [s * w0 * 0.85, -w0 * 0.5, 0.5 - 0.31]], [0, 1, 0]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('aU', new THREE.Float32BufferAttribute(U, 1));
  g.setAttribute('aFin', new THREE.Float32BufferAttribute(F, 1));
  g.setIndex(I);
  g.normalizeNormals();
  return g;
}

/**
 * Two holographic koi, a red-and-white and a gold, circling each other high over the street ahead: additive light
 * with a bright rim, bands of scan rising through them, a pattern of patches from the noise, and now and then a
 * glitch that tears them sideways in slices. The swimming is a wave down the body in the vertex shader.
 */
class HoloKoi {
  constructor(noise) {
    const base = koiGeometry();
    const geo = new THREE.InstancedBufferGeometry().copy(base);
    geo.instanceCount = 2;
    geo.setAttribute('aKind', new THREE.InstancedBufferAttribute(new Float32Array([0, 1]), 1));
    this.mats = [new THREE.Matrix4(), new THREE.Matrix4()];
    this.m0 = new Float32Array(32);
    geo.setAttribute('aM0', new THREE.InstancedBufferAttribute(new Float32Array(8), 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aM1', new THREE.InstancedBufferAttribute(new Float32Array(8), 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aM2', new THREE.InstancedBufferAttribute(new Float32Array(8), 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aM3', new THREE.InstancedBufferAttribute(new Float32Array(8), 4).setUsage(THREE.DynamicDrawUsage));
    this.u = { uNoise: { value: noise }, uTime: { value: 0 }, uI: { value: 0 }, uGlitch: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: /* glsl */`
        attribute float aU, aFin, aKind; attribute vec4 aM0, aM1, aM2, aM3;
        uniform float uTime, uGlitch;
        varying vec3 vN, vW, vL; varying float vU, vFin, vKind;
        float h1(float n) { return fract(sin(n * 91.3458) * 47453.5453); }
        void main() {
          mat4 M = mat4(aM0, aM1, aM2, aM3);
          vec3 p = position;
          float ph = uTime * 3.1 + aKind * 2.1;
          // the swimming: a wave travelling down the body, growing toward the tail
          float amp = 0.012 + 0.11 * aU * aU;
          p.x += sin(aU * 7.5 - ph) * amp;
          // the pectorals row slowly
          if (aFin > 0.5 && abs(position.x) > 0.06 && aU < 0.45) p.y += sin(ph * 0.6) * 0.035 * abs(position.x) * 6.0;
          vec3 n = normal; n.x -= cos(aU * 7.5 - ph) * amp * 7.5 * n.z;
          vec4 w = M * vec4(p, 1.0);
          // a glitch: the image tears sideways in slices for a moment
          float band = floor(w.y * 0.6 + floor(uTime * 24.0) * 7.0);
          w.x += (h1(band) - 0.5) * 6.0 * uGlitch * step(0.55, h1(band + 3.1));
          vW = w.xyz; vN = normalize(mat3(M) * n); vL = position; vU = aU; vFin = aFin; vKind = aKind;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uNoise; uniform float uTime, uI, uGlitch;
        varying vec3 vN, vW, vL; varying float vU, vFin, vKind;
        void main() {
          vec3 V = normalize(cameraPosition - vW);
          float fres = pow(1.0 - abs(dot(normalize(vN), V)), 1.6);
          float pat = texture2D(uNoise, vec2(vU * 1.1 + vKind * 0.43, atan(vL.y, vL.x) * 0.16 + 0.5 + vKind * 0.29)).g;
          float red = smoothstep(0.5, 0.56, pat) * step(vFin, 0.5);
          red = max(red, smoothstep(0.1, 0.03, vU) * step(vFin, 0.5) * (1.0 - vKind));     // the red crown of a tancho
          vec3 body = vKind < 0.5 ? mix(vec3(0.45, 0.95, 1.0), vec3(1.0, 0.26, 0.2), red) : mix(vec3(1.0, 0.7, 0.18), vec3(0.85, 1.0, 1.0), red);
          float scan = 0.3 + 0.7 * smoothstep(0.2, 0.65, fract(vW.y * 0.45 - uTime * 0.5));
          float rings = vFin > 0.5 ? 0.78 + 0.22 * sin(vU * 420.0 + vL.y * 60.0) : 0.7 + 0.5 * smoothstep(0.8, 0.98, sin(vU * 150.0));
          float a = (0.055 + 1.6 * fres) * scan * rings * (vFin > 0.5 ? 0.75 : 1.0);
          vec3 col = body * a * (1.0 + 2.0 * uGlitch);
          col *= 0.88 + 0.12 * sin(uTime * 43.0 + vW.y * 0.3);
          gl_FragColor = vec4(col * uI, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 3; this.mesh.name = 'holokoi';
    this.center = null; this.glitchT = 0; this.glitchNext = 5;
    this._r = new THREE.Matrix4(); this._v = new THREE.Vector3();
  }

  update(dt, t, target, I) {
    // the pair keeps just ahead of the car over the street, weaving round each other; each faces the way it is
    // really going (the street's way at speed, round and round when the car stops)
    if (!this.center) { this.center = target.clone(); this.last = [null, null]; this.yaw = [0, 0]; }
    else this.center.lerp(target, 1 - Math.exp(-dt / 1.2));
    const g = this.mesh.geometry.attributes, L = 30, R = 42, w = 0.34;
    for (let k = 0; k < 2; k++) {
      const a = t * w + k * Math.PI;
      const x = this.center.x + Math.cos(a) * R, z = this.center.z + Math.sin(a) * R;
      const y = this.center.y + 31 + Math.sin(t * 0.31 + k * 2) * 4 + k * 5;
      const last = this.last[k];
      if (last && dt > 0) {
        const dx = x - last[0], dz = z - last[1];
        if (dx * dx + dz * dz > 1e-6) { let e = Math.atan2(dx, dz) - this.yaw[k]; e = Math.atan2(Math.sin(e), Math.cos(e)); this.yaw[k] += e * (1 - Math.exp(-dt * 3)); }
      } else this.yaw[k] = Math.atan2(-Math.sin(a), Math.cos(a));
      this.last[k] = [x, z];
      const yaw = this.yaw[k];
      const m = this.mats[k];
      m.makeRotationY(yaw);
      m.multiply(this._r.makeRotationZ(-0.22)).multiply(this._r.makeRotationX(Math.sin(t * 0.31 + k * 2) * 0.12));
      m.scale(this._v.set(L, L, L));
      m.setPosition(x, y, z);
      const e = m.elements;
      g.aM0.array.set(e.slice(0, 4), k * 4); g.aM1.array.set(e.slice(4, 8), k * 4); g.aM2.array.set(e.slice(8, 12), k * 4); g.aM3.array.set(e.slice(12, 16), k * 4);
    }
    g.aM0.needsUpdate = g.aM1.needsUpdate = g.aM2.needsUpdate = g.aM3.needsUpdate = true;
    // a glitch every few seconds
    this.glitchNext -= dt;
    if (this.glitchNext <= 0) { this.glitchT = 0.12 + rnd() * 0.18; this.glitchNext = 4 + rnd() * 7; }
    this.glitchT = Math.max(0, this.glitchT - dt);
    this.u.uGlitch.value = this.glitchT > 0 ? 0.6 + 0.4 * Math.sin(t * 90) : 0;
    this.u.uTime.value = t; this.u.uI.value = I;
  }
}

// ------------------------------------------------------------------------------------------------ a shooting star

class ShootingStar {
  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aT', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 1]), 1));
    g.setIndex([0, 1, 2, 1, 3, 2]);
    this.u = { uI: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: 'attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uI; varying float vT; void main(){ gl_FragColor = vec4(vec3(0.85, 0.92, 1.0) * pow(vT, 2.5) * 7.0 * uI, 1.0); }',
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -300; this.mesh.visible = false; this.mesh.name = 'shootingstar';
    this.t = -1; this.next = 6 + rnd() * 8;
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._s = new THREE.Vector3();
  }

  update(dt, cam, viewYaw, on) {
    if (this.t < 0) {
      this.next -= on ? dt : 0;
      if (this.next > 0) { this.mesh.visible = false; return; }
      // a new one somewhere ahead of the lens, high in the sky, falling at a slant
      this.t = 0; this.next = 7 + rnd() * 14;
      this.az = viewYaw + (rnd() - 0.5) * 1.6; this.el = 0.45 + rnd() * 0.5;
      this.daz = (rnd() < 0.5 ? -1 : 1) * (0.22 + rnd() * 0.18); this.del = -(0.1 + rnd() * 0.12);
      this.len = 0.6 + rnd() * 0.4;
    }
    this.t += dt / this.len;
    if (this.t >= 1) { this.t = -1; this.mesh.visible = false; return; }
    const R = 2000, at = (k) => { const az = this.az + this.daz * k, el = this.el + this.del * k; return [Math.cos(el) * Math.sin(az) * R, Math.sin(el) * R, Math.cos(el) * Math.cos(az) * R]; };
    const h = at(this.t), tl = at(Math.max(0, this.t - 0.28));
    this._a.set(...h); this._b.set(...tl);
    this._s.subVectors(this._a, this._b).cross(this._a).normalize().multiplyScalar(2.6);
    const p = this.mesh.geometry.attributes.position.array;
    p.set([tl[0] + this._s.x * 0.1, tl[1] + this._s.y * 0.1, tl[2] + this._s.z * 0.1, tl[0] - this._s.x * 0.1, tl[1] - this._s.y * 0.1, tl[2] - this._s.z * 0.1,
      h[0] + this._s.x, h[1] + this._s.y, h[2] + this._s.z, h[0] - this._s.x, h[1] - this._s.y, h[2] - this._s.z]);
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.position.copy(cam);
    this.u.uI.value = Math.sin(Math.PI * Math.min(1, this.t * 1.15));
    this.mesh.visible = true;
  }
}

// ------------------------------------------------------------------------------------------------ lightning

/**
 * Lightning in a storm: every so often a strike somewhere out on the horizon ahead: a jagged bolt with a branch,
 * drawn as a ribbon facing the lens, and a flash that flickers two or three times. `flash` is read by the caller
 * to light the sky, the haze and the world; the thunder follows after the distance's delay.
 */
class Lightning {
  constructor() {
    this.maxV = 160;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.maxV * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(this.maxV), 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.u = { uI: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: 'attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uI; varying float vT; void main(){ gl_FragColor = vec4(vec3(0.82, 0.8, 1.0) * uI * vT * 9.0, 1.0); }',
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -250; this.mesh.visible = false; this.mesh.name = 'lightning';
    this.next = 5; this.t = -1; this.flash = 0; this.pending = null;
  }

  _bolt(cam, viewYaw, topY, groundY) {
    const az = viewYaw + (rnd() - 0.5) * 1.1, dist = 700 + rnd() * 900;
    const x0 = cam.x + Math.sin(az) * dist, z0 = cam.z + Math.cos(az) * dist;
    // midpoint displacement down from the cloud to the ground
    let pts = [[x0, topY, z0], [x0 + (rnd() - 0.5) * 160, groundY, z0 + (rnd() - 0.5) * 160]];
    for (let lv = 0, off = 90; lv < 5; lv++, off *= 0.55) {
      const nx = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        nx.push(a, [(a[0] + b[0]) / 2 + (rnd() - 0.5) * off, (a[1] + b[1]) / 2 + (rnd() - 0.5) * off * 0.3, (a[2] + b[2]) / 2 + (rnd() - 0.5) * off]);
      }
      nx.push(pts[pts.length - 1]); pts = nx;
    }
    const strands = [pts];
    // a branch off a third of the way down
    const bi = Math.floor(pts.length * (0.25 + rnd() * 0.2));
    const br = [pts[bi]];
    for (let k = 1; k < 10; k++) { const p = br[k - 1]; br.push([p[0] + (rnd() - 0.3) * 40, p[1] - (topY - groundY) * 0.045, p[2] + (rnd() - 0.5) * 40]); }
    strands.push(br);
    const P = this.mesh.geometry.attributes.position.array, T = this.mesh.geometry.attributes.aT.array;
    const idx = [];
    let v = 0;
    const s = new THREE.Vector3(), d = new THREE.Vector3(), e = new THREE.Vector3();
    strands.forEach((st, si) => {
      const w = si === 0 ? 3.2 : 1.6, bright = si === 0 ? 1 : 0.55;
      for (let i = 0; i < st.length && v < this.maxV - 2; i++) {
        const p = st[i], q = st[Math.min(st.length - 1, i + 1)], o = st[Math.max(0, i - 1)];
        d.set(q[0] - o[0], q[1] - o[1], q[2] - o[2]);
        e.set(p[0] - cam.x, p[1] - cam.y, p[2] - cam.z);
        s.crossVectors(d, e).normalize().multiplyScalar(w * (1 - 0.5 * i / st.length));
        P.set([p[0] + s.x, p[1] + s.y, p[2] + s.z, p[0] - s.x, p[1] - s.y, p[2] - s.z], v * 3);
        T[v] = bright; T[v + 1] = bright;
        if (i > 0) idx.push(v - 2, v - 1, v, v - 1, v + 1, v);
        v += 2;
      }
    });
    const g = this.mesh.geometry;
    g.setIndex(idx); g.setDrawRange(0, idx.length);
    g.attributes.position.needsUpdate = true; g.attributes.aT.needsUpdate = true;
    return dist;
  }

  /** Returns the thunder to play now, if any: { delay, k }. */
  update(dt, rain, cam, viewYaw, topY, groundY) {
    let thunder = null;
    if (this.t < 0) {
      if (rain > 0.5) this.next -= dt * (rain - 0.4) * 1.6;
      if (this.next <= 0) {
        this.next = 5 + rnd() * 12;
        this.t = 0;
        const dist = this._bolt(cam, viewYaw, topY, groundY);
        // (a player who asked their system for less motion gets one soft flash, not the flicker of three)
        this.shape = REDUCED_MOTION ? [[0, 0.6]] : [[0, 1], [0.07, 0.55], [0.16, 0.9], [0.3, 0.25]].map(([a, k]) => [a + rnd() * 0.03, k * (0.7 + rnd() * 0.3)]);
        thunder = { delay: dist / 340, k: clamp(1.3 - dist / 1600, 0.35, 1) };
      }
    }
    if (this.t >= 0) {
      this.t += dt;
      let f = 0;
      const fade = REDUCED_MOTION ? 0.16 : 0.05;
      for (const [a, k] of this.shape) if (this.t >= a) f = Math.max(f, k * Math.exp(-(this.t - a) / fade));
      this.flash = f;
      this.u.uI.value = this.t < 0.36 ? f : 0;
      this.mesh.visible = this.t < 0.36;
      if (this.t > 0.7) { this.t = -1; this.flash = 0; this.mesh.visible = false; }
    }
    return thunder;
  }
}

// ------------------------------------------------------------------------------------------------ the whole air

export class Atmosphere {
  constructor(scene, { phone = false } = {}) {
    this.noise = noiseTexture(128);
    this.clouds = new CloudDeck(this.noise);
    this.bank = new CloudBank();
    this.birds = new Birds(phone ? 18 : 30);
    this.milky = new MilkyWay(this.noise);
    this.mist = new ValleyMist();
    this.flies = new Fireflies(phone ? 90 : 160);
    this.lights = new Searchlights(phone ? 4 : 6);
    this.koi = new HoloKoi(this.noise);
    this.star = new ShootingStar();
    this.bolt = new Lightning();
    this.group = new THREE.Group(); this.group.name = 'atmosphere';
    for (const m of [this.milky.mesh, this.bank.mesh, this.birds.mesh, this.clouds.mesh, this.flies.mesh, this.lights.mesh, this.koi.mesh, this.star.mesh, this.bolt.mesh]) this.group.add(m);
    scene.add(this.group);
    this.t = 0; this.city = false;
    this.mistY = null; this.deckY = null;
    this._c = new THREE.Color(); this._c2 = new THREE.Color();
    this._l = new THREE.Vector3();
  }

  setMap(city) {
    this.city = !!city;
    this.flies.mesh.visible = !city;
    this.lights.mesh.visible = city; this.koi.mesh.visible = city;
    this.mistY = null; this.deckY = null; this.koi.center = null;
  }

  /** Everything drawn once (for the warm-up frame that compiles the shaders), then back as it was. */
  warm(on, cam) {
    const all = [this.milky.mesh, this.bank.mesh, this.birds.mesh, this.clouds.mesh, this.flies.mesh, this.lights.mesh, this.koi.mesh, this.star.mesh, this.bolt.mesh];
    if (on) { this._vis = all.map((m) => m.visible); all.forEach((m) => { m.visible = true; }); this.star.mesh.position.copy(cam); }
    else if (this._vis) { all.forEach((m, i) => { m.visible = this._vis[i]; }); }
  }

  /**
   * Per frame. `s` is the scene state: cam (the camera position), viewYaw, groundY (the ground under the car),
   * carY, night 0..1, rain 0..1, sun (the mood colour of the light), haze (the far haze colour), ahead (a point
   * over the street ahead, for the koi), spot() (a place for a firefly), tunnel 0..1.
   * Returns thunder to play, if a bolt struck: { delay, k }.
   */
  update(dt, s) {
    this.t += dt;
    const t = this.t, city = this.city, night = s.night, rain = s.rain, clear = 1 - rain;
    const cam = s.cam;
    // ---- the cloud deck
    const U = this.clouds.u;
    const deckWant = city ? s.groundY + lerp(330, 190, rain) : s.carY + lerp(480, 300, rain);
    this.deckY = this.deckY === null ? deckWant : lerp(this.deckY, deckWant, 1 - Math.exp(-dt / 6));
    U.uHeight.value = this.deckY; U.uCenter.value.set(cam.x, 0, cam.z); U.uTime.value = t;
    U.uCover.value = city ? lerp(0.62, 0.86, rain) : lerp(0.3, 0.9, rain);
    U.uScale.value = city ? 0.8 : 1.25;
    U.uOpacity.value = (city ? lerp(0.8, 0.95, rain) : lerp(0.5, 0.92, rain) * (0.6 + 0.4 * night)) * (s.look ? lerp(s.look.deck, 1, rain) : 1);
    if (city) {
      // lit from beneath by the city: sodium and neon at night, plain grey cloud by day
      U.uLit.value.setRGB(0.36, 0.13, 0.2).multiplyScalar(night * (1 + 0.2 * rain)).lerp(this._c.setRGB(0.62, 0.64, 0.7), 1 - night);
      U.uShade.value.setRGB(0.05, 0.03, 0.08).lerp(this._c.setRGB(0.4, 0.42, 0.48), 1 - night);
    } else {
      // on the pass the moon silvers the wisps; by day they are white, at dusk they take the sun's colour
      U.uLit.value.copy(s.sun).multiplyScalar(lerp(1.1, 0.24, night) * (1 - 0.45 * rain));
      U.uShade.value.copy(s.sun).multiplyScalar(lerp(0.75, 0.05, night) * (1 - 0.5 * rain));
    }
    U.uHaze.value.copy(s.haze);
    // ---- the cumulus on the horizon, in the hour's colours (daylight.js); the moon lights them by night, the city's
    // glow from beneath, and rain greys them and fills the sky with them
    const B = this.bank.u, L = s.look;
    B.uCam.value.copy(cam); B.uTime.value = t;
    this.bank.mesh.visible = !!L && L.cloud.k > 0.01;
    if (L) {
      const c = L.cloud, dim = 1 - 0.45 * rain;
      B.uLit.value.setRGB(c.lit[0] * dim, c.lit[1] * dim, c.lit[2] * dim);
      B.uShade.value.setRGB(c.shade[0] * dim, c.shade[1] * dim, c.shade[2] * dim);
      B.uRim.value.setRGB(c.rim[0], c.rim[1], c.rim[2]).multiplyScalar(1 - 0.8 * rain);
      if (city) {
        const g = night * (1 + 0.3 * rain);
        B.uShade.value.r += 0.2 * g; B.uShade.value.g += 0.06 * g; B.uShade.value.b += 0.12 * g;
        B.uLit.value.r += 0.12 * g; B.uLit.value.g += 0.04 * g; B.uLit.value.b += 0.08 * g;
      }
      B.uCover.value = lerp(c.cover, 0.97, rain);
      B.uK.value = c.k;
      B.uGrey.value = rain * 0.75;
      B.uHaze.value.copy(s.hazeLin || s.haze);
      // the light they take: the sun, and by night the moon
      const moonK = smoothstep(0.55, 0.9, night);
      this._l.copy(s.sunDir || this._l.set(0, 1, 0)).lerp(s.moonDir || s.sunDir || this._l, moonK).normalize();
      B.uSunDir.value.copy(this._l);
    }
    // ---- searchlights and the spots they throw on the deck (the city, at night)
    const beams = city ? night * (0.7 + 0.6 * rain) : 0;
    this.lights.mesh.visible = beams > 0.02;
    if (this.lights.mesh.visible) {
      this.lights.u.uI.value = beams * 0.7;
      this.lights.update(t, cam, s.groundY, this.deckY, beams);
    }
    for (let i = 0; i < 6; i++) {
      const b = this.lights.beams[i];
      if (b && this.lights.mesh.visible) U.uSpots.value[i].set(b.spot[0], b.spot[1], b.spot[2], b.spot[3] * 0.5);
      else U.uSpots.value[i].w = 0;
    }
    // ---- the sea of cloud (the pass)
    const M = this.mist;
    M.on = city || this.mistOff ? 0 : 1;
    if (!city) {
      // the cloud's top: some way below the car, following it slowly as the road climbs, never over it
      const want = s.carY - 26;
      this.mistY = this.mistY === null ? want : lerp(this.mistY, want, 1 - Math.exp(-dt / 10));
      this.mistY = Math.min(this.mistY, s.carY - 9);
      // (a thing of the night and the dawn: gone by day, and never so thick that the hills beyond it disappear)
      const mk = s.look ? s.look.mist : night;
      M.top = this.mistY; M.density = 0.012 * mk * mk * (1 + 0.5 * rain); M.soft = 18;
      if (M.density < 0.0004) M.on = 0;
      // the sky's own colour at the horizon (rose at dawn, gold at dusk, white by day), silvered by the moon at
      // night, greyer in the rain
      M.col.copy(s.hazeLin).multiplyScalar(lerp(1.05, 0.35, night)).add(this._c.setRGB(0.06, 0.075, 0.12).multiplyScalar(night))
        .lerp(this._c2.setRGB(0.16, 0.17, 0.19).multiplyScalar(lerp(3, 1, night)), rain * 0.6);
      M.far.copy(s.hazeLin);
      M.glow.setRGB(0.1, 0.12, 0.2).multiplyScalar(night * clear).add(this._c.copy(s.sun).multiplyScalar(0.35 * (1 - night) * clear));
      M.flash = this.bolt.flash;
      // ---- fireflies: a clear night on the pass
      const fI = night * clear * clear * (1 - (s.tunnel || 0));
      this.flies.mesh.visible = fI > 0.02;
      if (this.flies.mesh.visible) {
        this.flies.u.uTime.value = t; this.flies.u.uI.value = fI;
        this.flies.tend(s.car.x, s.car.z, s.spot, 5);
      }
    }
    // ---- the koi (the city)
    if (city) {
      const kI = (0.35 + 0.65 * night) * (1 - 0.3 * rain);
      this.koi.mesh.visible = kI > 0.02;
      if (this.koi.mesh.visible && s.ahead) this.koi.update(dt, t, s.ahead, kI * 0.9);
    }
    // ---- the Milky Way: a clear dark night on the pass (the moon, s.moon 0..1, washes it out a little)
    {
      const k = city ? 0 : smoothstep(0.8, 0.98, night) * clear * clear * (1 - (s.tunnel || 0)) * (1 - 0.35 * (s.moon ?? 1));
      this.milky.u.uK.value = k; this.milky.mesh.visible = k > 0.01;
      if (this.milky.mesh.visible) this.milky.mesh.position.copy(cam);
    }
    // ---- birds by day (crows over the city at dawn and at dusk, on the pass all day)
    {
      const day = 1 - smoothstep(0.35, 0.7, night), cityK = city ? smoothstep(0.1, 0.35, night) * (1 - smoothstep(0.55, 0.8, night)) + 0.25 * day : day;
      const k = (city ? cityK : day) * (1 - smoothstep(0.15, 0.4, rain)) * (1 - (s.tunnel || 0));
      this.birds.update(t, cam, s.viewYaw || 0, s.groundY, k, s.hazeLin || s.haze, 1 - night);
    }
    // ---- a shooting star on a clear night
    this.star.update(dt, cam, s.viewYaw, night > 0.8 && rain < 0.15 && !(s.tunnel > 0.5));
    // ---- lightning in a storm
    const thunder = this.bolt.update(dt, rain, cam, s.viewYaw, this.deckY, s.groundY - 20);
    U.uFlash.value = this.bolt.flash;
    return thunder;
  }
}
