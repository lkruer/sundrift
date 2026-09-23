/**
 * Effects: skid marks, tyre smoke, dust, sparks, exhaust flame. None of it loads a file: the particle
 * sprite is a radial gradient drawn into a canvas once.
 *
 * Skid marks are ring buffers of quads laid on the road behind each rear wheel while it slips, with a
 * per-vertex alpha that follows the slip, so a long slide draws a long dark arc that fades in at the entry
 * and out at the exit, which is what a drift leaves on real asphalt. Smoke is a CPU particle pool drawn as
 * points; it is tinted by the sun so it reads warm at golden hour and cool in shade.
 */
import * as THREE from 'three';
import { clamp } from './config.js?v=202609230440';

function spriteTexture() {
  const s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const SKID_VS = `attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKID_FS = `uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA * 0.75); }`;

export class SkidMarks {
  constructor(scene, max = 700) {
    this.max = max;
    this.tracks = [];
    this.mat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(0x141416) } }, vertexShader: SKID_VS, fragmentShader: SKID_FS,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(max * 2 * 3), al = new Float32Array(max * 2);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('alpha', new THREE.BufferAttribute(al, 1).setUsage(THREE.DynamicDrawUsage));
      const idx = new Uint32Array(max * 6);
      for (let q = 0; q < max; q++) {
        const a = q * 2, b = ((q + 1) % max) * 2, o = q * 6;
        idx[o] = a; idx[o + 1] = a + 1; idx[o + 2] = b; idx[o + 3] = a + 1; idx[o + 4] = b + 1; idx[o + 5] = b;
      }
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.setDrawRange(0, 0);
      const mesh = new THREE.Mesh(geo, this.mat);
      mesh.frustumCulled = false; mesh.renderOrder = 1;
      scene.add(mesh);
      this.tracks.push({ mesh, geo, pos, al, head: 0, count: 0, lastX: 0, lastZ: 0, on: false, gap: true });
    }
  }

  /** Wipe every mark (a new course or a new run). */
  clear() {
    for (const t of this.tracks) { t.al.fill(0); t.head = 0; t.count = 0; t.gap = true; t.geo.attributes.alpha.needsUpdate = true; t.geo.setDrawRange(0, 0); }
  }

  /**
   * Add a point for wheel i at world (x, y, z), lateral direction (lx, lz) for the width, alpha 0..1.
   * alpha 0 lifts the pen: the next point starts a new stroke.
   */
  add(i, x, y, z, lx, lz, alpha, width = 0.24) {
    const t = this.tracks[i];
    if (alpha < 0.03) { t.gap = true; return; }
    const d = Math.hypot(x - t.lastX, z - t.lastZ);
    if (!t.gap && d < 0.22) return;
    const write = (a) => {
      const v = t.head * 2;
      t.pos[v * 3] = x + lx * width * 0.5; t.pos[v * 3 + 1] = y; t.pos[v * 3 + 2] = z + lz * width * 0.5;
      t.pos[v * 3 + 3] = x - lx * width * 0.5; t.pos[v * 3 + 4] = y; t.pos[v * 3 + 5] = z - lz * width * 0.5;
      t.al[v] = a; t.al[v + 1] = a;
      t.head = (t.head + 1) % this.max;
      t.count = Math.min(this.max, t.count + 1);
    };
    if (t.gap) { write(0); t.gap = false; }   // an invisible seam so strokes do not join across a gap
    write(alpha);
    // the quad that wraps from the head back to the tail must stay invisible
    const tail = t.head * 2;
    t.al[tail] = 0; t.al[tail + 1] = 0;
    t.lastX = x; t.lastZ = z;
    t.geo.attributes.position.needsUpdate = true;
    t.geo.attributes.alpha.needsUpdate = true;
    t.geo.setDrawRange(0, this.max * 6);
  }
}

export class Particles {
  constructor(scene, max = 400) {
    this.max = max;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('psize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: spriteTexture() }, uScale: { value: 400 } },
      vertexShader: `attribute float psize; attribute vec4 color; varying vec4 vC; uniform float uScale;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = psize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uTex; varying vec4 vC; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vC.rgb, vC.a * t.a); }`,
      transparent: true, depthWrite: false,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false; this.points.renderOrder = 3;
    scene.add(this.points);
    this.p = [];
    for (let i = 0; i < max; i++) this.p.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, s0: 1, s1: 2, r: 1, g: 1, b: 1, a0: 0.4, grav: 0, drag: 1 });
    this.next = 0;
    this.tint = new THREE.Color(1, 1, 1);
  }

  setScale(heightPx) { this.mat.uniforms.uScale.value = heightPx * 0.55; }

  spawn(o) {
    const p = this.p[this.next]; this.next = (this.next + 1) % this.max;
    Object.assign(p, { alive: true, age: 0, grav: 0, drag: 1 }, o);
  }

  smoke(x, y, z, vx, vz, strength, warm) {
    // tyre smoke: rises, drifts back with the car's slip, tinted by the light
    const n = strength > 0.7 ? 2 : 1;
    for (let i = 0; i < n; i++) this.spawn({
      x: x + (Math.random() - 0.5) * 0.3, y: y + 0.1, z: z + (Math.random() - 0.5) * 0.3,
      vx: vx * 0.35 + (Math.random() - 0.5) * 1.2, vy: 0.9 + Math.random() * 1.3, vz: vz * 0.35 + (Math.random() - 0.5) * 1.2,
      life: 0.9 + Math.random() * 0.7, s0: 0.35, s1: 1.3 + strength * 0.7,
      r: warm.r, g: warm.g, b: warm.b, a0: 0.10 + 0.13 * strength, drag: 1.6,
    });
  }

  dust(x, y, z, vx, vz, strength, tint = null) {
    // dry dirt thrown up off the verge: brown, low, spreading and thin, lit by the scene's light colour
    const k = tint ? 0.55 : 1;
    this.spawn({ x, y: y + 0.08, z, vx: vx * 0.3 + (Math.random() - 0.5) * 1.6, vy: 0.35 + Math.random() * 0.5, vz: vz * 0.3 + (Math.random() - 0.5) * 1.6,
      life: 0.8 + Math.random() * 0.6, s0: 0.7, s1: 2.6, r: 0.42 * k * (tint ? tint.r * 1.6 : 1), g: 0.34 * k * (tint ? tint.g * 1.6 : 1), b: 0.24 * k * (tint ? tint.b * 1.6 : 1),
      a0: 0.05 + 0.1 * strength, drag: 2.2 });
  }

  spray(x, y, z, vx, vz, strength, tint = null) {
    // road spray off a wet tyre: fine and pale, thrown back and up, gone quickly
    const k = tint ? 1.1 : 1;
    this.spawn({ x: x + (Math.random() - 0.5) * 0.3, y: y + 0.12, z: z + (Math.random() - 0.5) * 0.3,
      vx: vx * 0.25 + (Math.random() - 0.5) * 1.4, vy: 0.5 + Math.random() * 0.9, vz: vz * 0.25 + (Math.random() - 0.5) * 1.4,
      life: 0.45 + Math.random() * 0.35, s0: 0.3, s1: 1.5, r: 0.72 * k * (tint ? tint.r * 1.4 : 1), g: 0.76 * k * (tint ? tint.g * 1.4 : 1), b: 0.84 * k * (tint ? tint.b * 1.4 : 1),
      a0: 0.05 + 0.09 * strength, drag: 2.4 });
  }

  sparks(x, y, z, nx, nz, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 7;
      this.spawn({ x, y: y + 0.2, z, vx: nx * 3 + Math.cos(a) * sp, vy: 1 + Math.random() * 4, vz: nz * 3 + Math.sin(a) * sp,
        life: 0.25 + Math.random() * 0.45, s0: 0.22, s1: 0.05, r: 1.0, g: 0.72, b: 0.25, a0: 1.0, grav: 12, drag: 0.6 });
    }
  }

  flame(x, y, z, bx, bz, strength) {
    this.spawn({ x, y, z, vx: bx * 6 + (Math.random() - 0.5), vy: 0.3 + Math.random() * 0.5, vz: bz * 6 + (Math.random() - 0.5),
      life: 0.12 + Math.random() * 0.12 * strength, s0: 0.45, s1: 0.12, r: 1.0, g: 0.55 + 0.4 * Math.random(), b: 0.15, a0: 0.9, drag: 4 });
  }

  update(dt) {
    const P = this.p;
    for (let i = 0; i < this.max; i++) {
      const p = P[i];
      const o3 = i * 3, o4 = i * 4;
      if (!p.alive) { this.col[o4 + 3] = 0; this.size[i] = 0; continue; }
      p.age += dt;
      if (p.age >= p.life) { p.alive = false; this.col[o4 + 3] = 0; this.size[i] = 0; continue; }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vz *= k; p.vy = p.vy * k - p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const t = p.age / p.life;
      this.pos[o3] = p.x; this.pos[o3 + 1] = p.y; this.pos[o3 + 2] = p.z;
      this.col[o4] = p.r; this.col[o4 + 1] = p.g; this.col[o4 + 2] = p.b;
      this.col[o4 + 3] = p.a0 * (1 - t) * (t < 0.1 ? t / 0.1 : 1);
      this.size[i] = p.s0 + (p.s1 - p.s0) * t;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.psize.needsUpdate = true;
  }
}

/**
 * A flickering cone of fire at the exhaust while boosting, plus a light on the road behind it.
 *
 * The light is never hidden or removed, only dimmed to zero: the number of lights in the scene is part of
 * every lit material's shader, so a light that comes and goes recompiles every material in the scene (a
 * second-long freeze the first time a boost fires).
 */
export class ExhaustFlame {
  constructor(parent) {
    const geo = new THREE.ConeGeometry(0.075, 0.9, 8, 1, true);
    geo.rotateX(Math.PI / 2);               // point along -Z (backwards) after the flip below
    geo.translate(0, 0, -0.45);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    this.core = new THREE.Mesh(geo, this.mat);
    this.inner = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.55, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, -0.27),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.group = new THREE.Group();
    this.cones = new THREE.Group();
    this.cones.add(this.core, this.inner);
    this.cones.visible = false;
    this.group.add(this.cones);
    this.light = new THREE.PointLight(0xff9a3a, 0, 6, 2);
    this.light.position.set(0, 0.2, -0.9);
    this.group.add(this.light);
    parent.add(this.group);
    this.t = 0;
  }
  set(x, y, z) { this.group.position.set(x, y, z); }
  update(dt, strength) {
    this.t += dt;
    const on = strength > 0.02;
    this.cones.visible = on;
    if (!on) { this.light.intensity = 0; return; }
    const f = 0.7 + 0.3 * Math.sin(this.t * 61) * Math.sin(this.t * 37 + 1);
    this.cones.scale.set(1, 1, (0.6 + 1.2 * strength) * f);
    this.mat.opacity = 0.6 * f * strength + 0.2;
    this.light.intensity = 25 * strength * f;
  }
}

/**
 * Cherry petals on the air: a few hundred of them in a box that travels with the camera, falling, swaying and
 * tumbling, every one placed by the vertex shader from its seed and the clock, so the CPU never touches them
 * and the whole shower is one draw. A petal's position is a pure function of time, wrapped into the box, and
 * it shrinks away near the box's faces so the wrap never shows. The car's wind pushes the petals near its path
 * aside and up as it passes. They are lit like everything else, so they catch the lamps as they drift past.
 */
export class Petals {
  constructor(scene, count = 700) {
    this.count = count;
    // one petal: a rounded blade with the notch at its tip, 6 cm long (larger than life, so it reads), in the xy plane
    const shape = [[0, -0.5], [0.3, -0.08], [0.24, 0.36], [0.09, 0.5], [0, 0.4], [-0.09, 0.5], [-0.24, 0.36], [-0.3, -0.08]];
    const S = 0.06, nv = shape.length, fan = [];
    for (let k = 1; k < nv - 1; k++) fan.push(0, k, k + 1);
    const pos = new Float32Array(count * nv * 3), nor = new Float32Array(count * nv * 3), col = new Float32Array(count * nv * 3), seed = new Float32Array(count * nv * 4);
    const idx = new (count * nv > 65535 ? Uint32Array : Uint16Array)(count * fan.length);
    let s = 12345;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const cA = new THREE.Color(0xf6d3de), cB = new THREE.Color(0xf0a6bf), cW = new THREE.Color(0xfbeef2), c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const sd = [rnd(), rnd(), rnd(), rnd()];
      const pick = rnd();
      c.copy(pick < 0.5 ? cA : pick < 0.8 ? cB : cW);
      // a slight cup: the edges lift toward +z, so a tumbling petal flashes light and dark
      for (let k = 0; k < nv; k++) {
        const v = (i * nv + k), [x, y] = shape[k];
        pos[v * 3] = x * S; pos[v * 3 + 1] = y * S; pos[v * 3 + 2] = Math.abs(x) * S * 0.35;
        nor[v * 3] = -x * 0.4; nor[v * 3 + 1] = 0; nor[v * 3 + 2] = 1;
        col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
        seed.set(sd, v * 4);
      }
      for (let k = 0; k < fan.length; k++) idx[i * fan.length + k] = i * nv + fan[k];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const U = this.u = {
      uTime: { value: 0 }, uBox: { value: new THREE.Vector3(30, 14, 30) }, uCenter: { value: new THREE.Vector3() },
      uWind: { value: new THREE.Vector2(0.6, 0.2) }, uCar: { value: new THREE.Vector3(0, -1e4, 0) }, uCarV: { value: new THREE.Vector2() },
      uEye: { value: new THREE.Vector3() }, uDensity: { value: 1 },
    };
    // (no depth written: a petal drawn into the depth buffer gets an ink outline from the cel pass, and at a few
    // pixels across a petal is all outline, a dark speck)
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0, side: THREE.DoubleSide,
      emissive: 0x70404f, emissiveIntensity: 1, transparent: true, opacity: 0.95, depthWrite: false });
    mat.name = 'petals';
    const ROT = `
uniform float uTime, uDensity; uniform vec3 uBox, uCenter, uCar, uEye; uniform vec2 uWind, uCarV;
attribute vec4 aSeed;
vec3 petalRot(vec3 v, vec4 sd, float t) {
  float ph = sd.w * 6.2831853;
  float a = t * (1.6 + 3.4 * fract(sd.w * 13.7)) + ph;
  vec3 ax = normalize(vec3(sin(ph * 3.1), cos(ph * 1.7), sin(ph * 2.3)) + vec3(0.001));
  float c = cos(a), s = sin(a);
  return v * c + cross(ax, v) * s + ax * dot(ax, v) * (1.0 - c);
}`;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, U);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + ROT)
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = petalRot(vec3(normal), aSeed, uTime);\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3(tangent.xyz);\n#endif')
        .replace('#include <begin_vertex>', `
vec3 transformed;
{
  vec4 sd = aSeed;
  float t = uTime, ph = sd.w * 6.2831853;
  float fall = 0.45 + 0.5 * fract(sd.w * 7.13);
  vec3 p = sd.xyz * uBox + vec3(uWind.x * t, -fall * t, uWind.y * t);
  p.x += sin(t * 1.3 + ph) * 0.7; p.z += cos(t * 1.1 + ph * 1.7) * 0.7; p.y += sin(t * 2.1 + ph * 2.3) * 0.15;
  vec3 rel = mod(p - uCenter + 0.5 * uBox, uBox) - 0.5 * uBox;
  vec3 e = 1.0 - smoothstep(0.36 * uBox, 0.5 * uBox, abs(rel));
  vec3 wp = uCenter + rel;
  // the car's wind: pushed out from its path and lifted, more the faster it goes
  vec3 d = wp - uCar;
  float r2 = dot(d.xz, d.xz), sp = length(uCarV);
  float push = sp * exp(-r2 / 5.0) * smoothstep(3.0, -0.5, d.y);
  wp.xz += normalize(d.xz + vec2(0.001)) * push * 0.045 + uCarV * push * 0.004;
  wp.y += push * 0.03;
  float near = smoothstep(0.7, 2.2, length(wp - uEye));
  float on = step(fract(sd.w * 91.7), uDensity);
  float size = (0.7 + 0.7 * fract(sd.w * 3.3)) * e.x * e.y * e.z * near * on;
  transformed = wp + petalRot(position * size, sd, t);
}`);
    };
    mat.customProgramCacheKey = () => 'petals';
    this.mat = mat;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false; this.mesh.castShadow = false; this.mesh.receiveShadow = false;
    this.mesh.name = 'petals';
    scene.add(this.mesh);
    this.t = 0; this.gust = 0;
  }

  /** @param eye camera position; fx, fz the view's forward on the ground; car { x, y, z, vx, vz }; density 0..1 */
  update(dt, eye, fx, fz, car, density) {
    this.t += dt;
    const U = this.u;
    U.uTime.value = this.t;
    U.uEye.value.copy(eye);
    U.uCenter.value.set(eye.x + fx * 9, eye.y + 2.5, eye.z + fz * 9);
    // the breeze swings about and gusts now and then
    this.gust = 0.5 + 0.5 * Math.sin(this.t * 0.23) * Math.sin(this.t * 0.071 + 1.3);
    U.uWind.value.set(0.35 + 0.9 * this.gust, 0.25 * Math.sin(this.t * 0.05));
    if (car) { U.uCar.value.set(car.x, car.y, car.z); U.uCarV.value.set(car.vx, car.vz); }
    U.uDensity.value += (density - U.uDensity.value) * Math.min(1, dt * 2);
  }
}

/**
 * Rain: a few thousand streaks in a box that travels with the camera, placed by the vertex shader from a seed and
 * the clock like the petals (one draw, nothing on the CPU). Each streak is a thin quad along the fall, turned to
 * face the eye. A drop is only seen where light catches it, so the shader lights it itself: a cone ahead of the
 * car for the headlights, and the few real lamp lights near the car, with a faint sky light by day. Additive, no
 * depth written, so the cel pass never inks it.
 */
export class Rain {
  constructor(scene, count = 2400) {
    this.count = count;
    const pos = new Float32Array(count * 4 * 3), corner = new Float32Array(count * 4 * 2), seed = new Float32Array(count * 4 * 4);
    const idx = new (count * 4 > 65535 ? Uint32Array : Uint16Array)(count * 6);
    let s = 777;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const C = [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]];
    for (let i = 0; i < count; i++) {
      const sd = [rnd(), rnd(), rnd(), rnd()];
      for (let k = 0; k < 4; k++) { const v = i * 4 + k; corner.set(C[k], v * 2); seed.set(sd, v * 4); }
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const lamps = [], lampCol = [];
    for (let i = 0; i < 5; i++) { lamps.push(new THREE.Vector3(0, -1e4, 0)); lampCol.push(new THREE.Vector3()); }
    this.u = {
      uTime: { value: 0 }, uAmount: { value: 0 }, uBox: { value: new THREE.Vector3(26, 16, 26) }, uCenter: { value: new THREE.Vector3() },
      uEye: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector2(1.2, 0.4) }, uCar: { value: new THREE.Vector3(0, -1e4, 0) },
      uCarFwd: { value: new THREE.Vector2(0, 1) }, uHead: { value: 1 }, uSky: { value: new THREE.Vector3(0.1, 0.12, 0.16) },
      uLamps: { value: lamps }, uLampCol: { value: lampCol },
    };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: `
        uniform float uTime, uAmount, uHead; uniform vec3 uBox, uCenter, uEye, uCar, uSky; uniform vec2 uWind, uCarFwd;
        uniform vec3 uLamps[5]; uniform vec3 uLampCol[5];
        attribute vec4 aSeed; attribute vec2 aCorner;
        varying vec3 vC; varying float vA; varying float vX;
        void main() {
          float fall = 8.5 + 3.5 * fract(aSeed.w * 7.1);
          vec3 vel = vec3(uWind.x, -fall, uWind.y);
          vec3 p = aSeed.xyz * uBox + vel * uTime;
          vec3 rel = mod(p - uCenter + 0.5 * uBox, uBox) - 0.5 * uBox;
          vec3 wp = uCenter + rel;
          vec3 dir = normalize(vel);
          vec3 toEye = normalize(uEye - wp);
          vec3 side = normalize(cross(dir, toEye) + vec3(1e-4, 0.0, 0.0));
          float len = 0.45 + 0.35 * fract(aSeed.w * 3.7);
          vec3 pos = wp + dir * (aCorner.y * len) + side * (aCorner.x * 0.014);
          vec3 e = 1.0 - smoothstep(0.36 * uBox, 0.5 * uBox, abs(rel));
          float near = smoothstep(0.35, 1.6, length(wp - uEye));
          float on = step(fract(aSeed.w * 91.7), uAmount);
          // light that catches the drop
          vec3 lc = uSky;
          vec2 dc = wp.xz - uCar.xz; float dl = length(dc);
          float cone = smoothstep(0.86, 0.97, dot(dc / max(dl, 0.01), uCarFwd)) * smoothstep(48.0, 5.0, dl) * smoothstep(-0.5, 2.5, wp.y - uCar.y + 1.5);
          lc += vec3(0.85, 0.9, 1.0) * cone * uHead;
          for (int i = 0; i < 5; i++) { vec3 d = wp - uLamps[i]; lc += uLampCol[i] / (1.0 + dot(d, d) * 0.06); }
          vC = lc; vA = on * e.x * e.y * e.z * near; vX = aCorner.x * 2.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }`,
      fragmentShader: `
        varying vec3 vC; varying float vA; varying float vX;
        void main() { float a = vA * (1.0 - vX * vX); gl_FragColor = vec4(vC, a * 0.55); }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false; this.mesh.name = 'rain'; this.mesh.renderOrder = 4;
    scene.add(this.mesh);
    this.t = 0;
  }

  /**
   * @param amount 0..1 how hard it rains; eye the camera position; fx, fz the view's forward on the ground;
   * car { x, y, z, fx, fz } and head (0..1, headlights); lights: the real lamp lights near the car; sky: day light
   */
  update(dt, amount, eye, fx, fz, car, head, lights, sky) {
    this.t += dt;
    const U = this.u;
    U.uTime.value = this.t;
    U.uAmount.value = amount;
    this.mesh.visible = amount > 0.005;
    if (!this.mesh.visible) return;
    U.uEye.value.copy(eye);
    U.uCenter.value.set(eye.x + fx * 7, eye.y + 3, eye.z + fz * 7);
    U.uWind.value.set(1.0 + 0.8 * Math.sin(this.t * 0.13), 0.5 * Math.sin(this.t * 0.07 + 1));
    if (car) { U.uCar.value.set(car.x, car.y, car.z); U.uCarFwd.value.set(car.fx, car.fz); }
    U.uHead.value = head;
    U.uSky.value.set(sky, sky * 1.08, sky * 1.2);
    for (let i = 0; i < 5; i++) {
      const l = lights[i];
      if (l && l.intensity > 0) { U.uLamps.value[i].copy(l.position); const k = Math.min(1.2, l.intensity / 300); U.uLampCol.value[i].set(l.color.r * k, l.color.g * k, l.color.b * k); }
      else U.uLamps.value[i].set(0, -1e4, 0);
    }
  }
}
