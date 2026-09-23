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
import { clamp } from './config.js?v=202609231752';

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
  constructor(scene, max = 900) {
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
      this.tracks.push({ mesh, geo, pos, al, head: 0, count: 0, lastX: 0, lastY: 0, lastZ: 0, px: 1, pz: 0, n: 0, open: false });
    }
  }

  /** Wipe every mark (a new course or a new run). */
  clear() {
    for (const t of this.tracks) {
      t.al.fill(0); t.pos.fill(0); t.head = 0; t.count = 0; t.n = 0; t.open = false;
      t.geo.attributes.position.needsUpdate = true; t.geo.attributes.alpha.needsUpdate = true; t.geo.setDrawRange(0, 0);
    }
  }

  /**
   * Add a point for wheel i at world (x, y, z) with alpha 0..1: y is the road's own surface under the wheel, and
   * (lx, lz) is the direction across the wheel's travel, which the first point of a stroke is laid along. A low
   * alpha lifts the pen.
   *
   * The ring draws a quad between every pair of neighbouring points, so each stroke is fenced by invisible points
   * (alpha 0 at its first and its last): the quad that joins one stroke to the next has nothing to show at either
   * end. The ring's seam, the newest point beside the oldest, is fenced the same way. (Unfenced, both drew a faint
   * streak: across every gap between two slides, and from the newest mark out to the oldest.) The width is laid
   * across the stroke's own direction, never across the car, which in a big drift runs along the mark and would
   * pinch it to a sliver.
   */
  add(i, x, y, z, lx, lz, alpha, width = 0.24) {
    const t = this.tracks[i];
    const dx = x - t.lastX, dz = z - t.lastZ, d = Math.hypot(dx, dz);
    // (a wheel that jumped, as it does when the car is reset or set down by the magnet, starts a new stroke)
    const jumped = t.open && (d > 4 || Math.abs(y - t.lastY) > 0.6);
    if (t.open && (alpha < 0.03 || jumped)) {
      // close the stroke, fading it out over its last few centimetres toward where the wheel is now
      const k = !jumped && d > 1e-4 ? Math.min(d, 0.3) / d : 0;
      this._write(t, t.lastX + dx * k, t.lastY, t.lastZ + dz * k, t.px, t.pz, 0, width);
      t.open = false;
      this._flush(t);
    }
    if (!t.open) {
      if (alpha < 0.06) return;                               // (a little more to start a stroke than to keep one going)
      const l = Math.hypot(lx, lz) || 1;
      t.px = lx / l; t.pz = lz / l;
      this._write(t, x, y, z, t.px, t.pz, 0, width);          // the stroke's invisible first point
      this._write(t, x, y, z, t.px, t.pz, alpha, width);
      t.open = true; t.n = 1;
      t.lastX = x; t.lastY = y; t.lastZ = z;
      this._flush(t);
      return;
    }
    if (d < 0.22) return;
    // across the stroke, turned to agree with the last point so the ribbon never twists
    let px = -dz / d, pz = dx / d;
    if (px * t.px + pz * t.pz < 0) { px = -px; pz = -pz; }
    if (t.n === 1) {
      // the stroke's first point was laid across the wheel's travel; lay it across the stroke itself now
      const m = this.max;
      this._put(t, (t.head - 1 + m) % m, t.lastX, t.lastY, t.lastZ, px, pz, width);
      this._put(t, (t.head - 2 + m) % m, t.lastX, t.lastY, t.lastZ, px, pz, width);
    }
    this._write(t, x, y, z, px, pz, alpha, width);
    t.n++;
    t.lastX = x; t.lastY = y; t.lastZ = z; t.px = px; t.pz = pz;
    this._flush(t);
  }

  _put(t, slot, x, y, z, px, pz, width) {
    const o = slot * 6, hw = width * 0.5;
    t.pos[o] = x + px * hw; t.pos[o + 1] = y; t.pos[o + 2] = z + pz * hw;
    t.pos[o + 3] = x - px * hw; t.pos[o + 4] = y; t.pos[o + 5] = z - pz * hw;
  }

  _write(t, x, y, z, px, pz, a, width) {
    this._put(t, t.head, x, y, z, px, pz, width);
    t.al[t.head * 2] = a; t.al[t.head * 2 + 1] = a;
    t.head = (t.head + 1) % this.max;
    t.count = Math.min(this.max, t.count + 1);
  }

  _flush(t) {
    const m = this.max, h = t.head, p = (h - 1 + m) % m, o = (h + 1) % m;
    // the seam: the slot to be written next repeats the newest point, invisibly, and the oldest point goes
    // invisible too, so neither quad at the seam (newest to next, next to oldest) can draw anything
    t.pos.copyWithin(h * 6, p * 6, p * 6 + 6);
    t.al[h * 2] = 0; t.al[h * 2 + 1] = 0;
    t.al[o * 2] = 0; t.al[o * 2 + 1] = 0;
    t.geo.attributes.position.needsUpdate = true;
    t.geo.attributes.alpha.needsUpdate = true;
    t.geo.setDrawRange(0, m * 6);
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
/**
 * Rain landing on the road: rings spreading on the asphalt round the car, each a thin circle that grows and fades
 * in under half a second, lit as the falling rain is (the sky, the headlights' cone, the lamps; the Rain's own
 * uniforms are shared). The caller places them (spot() gives a place on the road ahead), a few every frame.
 */
export class RainSplashes {
  constructor(scene, rainU, n = 260) {
    this.n = n; this.life = 0.42; this.next = 0; this.t = 0;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1], 3));
    g.setIndex([0, 2, 1, 0, 3, 2]);
    this.at = new Float32Array(n * 4).fill(0);
    for (let i = 0; i < n; i++) this.at[i * 4 + 1] = -1e5;
    g.setAttribute('aAt', new THREE.InstancedBufferAttribute(this.at, 4).setUsage(THREE.DynamicDrawUsage));
    g.instanceCount = n;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    this.u = { ...rainU, uNow: { value: 0 }, uLife: { value: this.life }, uAmount: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: `
        uniform float uNow, uLife, uHead; uniform vec3 uCar, uSky; uniform vec2 uCarFwd; uniform vec3 uLamps[5]; uniform vec3 uLampCol[5];
        attribute vec4 aAt; varying vec2 vP; varying float vK; varying vec3 vC;
        void main() {
          float age = (uNow - aAt.w) / uLife;
          float live = step(0.0, age) * step(age, 1.0);
          float r = 0.05 + 0.2 * sqrt(clamp(age, 0.0, 1.0));
          vec3 wp = aAt.xyz + vec3(position.x * r, 0.0, position.z * r) * live;
          vP = position.xz; vK = age;
          vec3 lc = uSky * 1.6;
          vec2 dc = wp.xz - uCar.xz; float dl = length(dc);
          lc += vec3(0.85, 0.9, 1.0) * smoothstep(0.84, 0.97, dot(dc / max(dl, 0.01), uCarFwd)) * smoothstep(40.0, 4.0, dl) * uHead * 1.4;
          for (int i = 0; i < 5; i++) { vec3 d = wp - uLamps[i]; lc += uLampCol[i] * 1.3 / (1.0 + dot(d, d) * 0.05); }
          vC = lc * live;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader: `
        uniform float uAmount; varying vec2 vP; varying float vK; varying vec3 vC;
        void main() {
          float d = length(vP);
          float ring = smoothstep(0.62, 0.86, d) * (1.0 - smoothstep(0.86, 1.0, d));
          float dot0 = (1.0 - smoothstep(0.0, 0.35, d)) * (1.0 - smoothstep(0.0, 0.18, vK));
          float fade = (1.0 - vK) * (1.0 - vK);
          gl_FragColor = vec4(vC * (ring * fade * 0.55 + dot0 * 0.8) * uAmount, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 3; this.mesh.name = 'rain splashes';
    scene.add(this.mesh);
  }

  /** spot() returns [x, y, z] on the road (y the surface) or null. */
  update(dt, amount, spot) {
    this.t += dt;
    this.u.uNow.value = this.t; this.u.uAmount.value = amount;
    this.mesh.visible = amount > 0.02;
    if (!this.mesh.visible) return;
    this.next += (this.n / this.life) * dt * Math.min(1, amount * 1.2);
    let changed = false;
    while (this.next >= 1) {
      this.next -= 1;
      const i = this.k = ((this.k || 0) + 1) % this.n;
      const p = spot();
      if (!p) continue;
      this.at[i * 4] = p[0]; this.at[i * 4 + 1] = p[1] + 0.03; this.at[i * 4 + 2] = p[2]; this.at[i * 4 + 3] = this.t + Math.random() * 0.05;
      changed = true;
    }
    if (changed) this.mesh.geometry.attributes.aAt.needsUpdate = true;
  }
}

/**
 * The rain further off: a ring of falling streaks round the camera some forty metres out, in front of the far
 * streets and slopes and behind anything nearer, so a downpour reads to the end of the road and not only round the
 * car. The streaks are made in the shader (columns of dashes falling at their own speeds), lit by the sky and the
 * city's glow.
 */
export class RainCurtain {
  constructor(scene) {
    const g = new THREE.CylinderGeometry(42, 42, 60, 64, 1, true);
    this.u = { uTime: { value: 0 }, uAmount: { value: 0 }, uCol: { value: new THREE.Color(0.2, 0.22, 0.28) } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, fog: false,
      vertexShader: 'varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform float uTime, uAmount; uniform vec3 uCol; varying vec3 vL;
        float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
        void main() {
          float a = atan(vL.z, vL.x) / 6.2831853 + 0.5;
          float col = floor(a * 900.0), f = fract(a * 900.0);
          float sp = 0.9 + 0.8 * h1(col), ph = h1(col + 17.0);
          float y = vL.y / 60.0 + 0.5;
          float d = fract(y * (5.0 + 4.0 * h1(col + 3.0)) + uTime * sp + ph);
          float streak = smoothstep(0.0, 0.05, d) * (1.0 - smoothstep(0.05, 0.4, d)) * (1.0 - smoothstep(0.2, 0.5, abs(f - 0.5)));
          float on = step(0.45, h1(col + 41.0));
          float band = smoothstep(0.0, 0.2, y) * (1.0 - smoothstep(0.55, 1.0, y));
          gl_FragColor = vec4(uCol * streak * on * band * uAmount, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 2; this.mesh.name = 'rain curtain';
    scene.add(this.mesh);
  }

  update(dt, amount, eye, colour) {
    this.u.uTime.value += dt; this.u.uAmount.value = amount;
    this.mesh.visible = amount > 0.02;
    if (!this.mesh.visible) return;
    this.mesh.position.set(eye.x, eye.y + 12, eye.z);
    this.u.uCol.value.copy(colour);
  }
}

/**
 * The headlights' beams, seen in the rain: two soft shafts of lit air ahead of the car, worked out per pixel from how
 * close the eye's ray passes to each beam's axis (the searchlights' way), so they have no hard edge to read as cones.
 * Only as much as there is rain in the air, at night.
 */
export class HeadBeams {
  constructor(scene) {
    const geo = new THREE.InstancedBufferGeometry().copy(new THREE.CylinderGeometry(1, 1, 1, 14, 1, true).translate(0, 0.5, 0));
    this.base = new Float32Array(6); this.dir = new Float32Array(6);
    geo.setAttribute('aBase', new THREE.InstancedBufferAttribute(this.base, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aDir', new THREE.InstancedBufferAttribute(this.dir, 3).setUsage(THREE.DynamicDrawUsage));
    geo.instanceCount = 2;
    this.u = { uI: { value: 0 }, uLen: { value: 26 }, uR0: { value: 0.1 }, uR1: { value: 3.4 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: `
        attribute vec3 aBase, aDir; uniform float uLen, uR0, uR1; varying vec3 vW, vB, vA;
        void main() {
          vec3 A = normalize(aDir);
          vec3 T = normalize(abs(A.y) < 0.99 ? cross(A, vec3(0.0, 1.0, 0.0)) : vec3(1.0, 0.0, 0.0));
          vec3 N = cross(T, A);
          float r = mix(uR0, uR1, position.y);
          vec3 w = aBase + A * position.y * uLen + (T * position.x + N * position.z) * r;
          vW = w; vB = aBase; vA = A;
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: `
        uniform float uI, uLen, uR0, uR1; varying vec3 vW, vB, vA;
        void main() {
          vec3 rd = normalize(vW - cameraPosition), w0 = cameraPosition - vB;
          float b = dot(rd, vA), d = dot(rd, w0), e = dot(vA, w0), den = max(1.0 - b * b, 1e-4);
          float t = (b * e - d) / den, s = (e - b * d) / den;
          float along = clamp(s / uLen, 0.0, 1.0);
          float dist = length((cameraPosition + rd * t) - (vB + vA * s));
          float x = clamp(dist / mix(uR0, uR1, along), 0.0, 1.0);
          float core = pow(1.0 - x, 1.4) * (1.0 - x);
          float fade = smoothstep(0.03, 0.4, along) * (1.0 - smoothstep(0.4, 1.0, along));
          gl_FragColor = vec4(vec3(0.9, 0.94, 1.0) * core * fade * uI, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 3; this.mesh.name = 'head beams';
    scene.add(this.mesh);
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3();
  }

  /** lights: the two headlight SpotLights (their world positions and targets aim the beams). */
  update(intensity, lights) {
    this.mesh.visible = intensity > 0.005;
    this.u.uI.value = intensity;
    if (!this.mesh.visible) return;
    lights.forEach((l, i) => {
      l.getWorldPosition(this._a); l.target.getWorldPosition(this._b);
      this._b.sub(this._a).normalize();
      this.base.set([this._a.x, this._a.y, this._a.z], i * 3); this.dir.set([this._b.x, this._b.y, this._b.z], i * 3);
    });
    const g = this.mesh.geometry.attributes;
    g.aBase.needsUpdate = true; g.aDir.needsUpdate = true;
  }
}

/**
 * Light trails off the tail lamps while a drift is held, the way a drift anime draws a slide at night: a thin streak
 * of red light left hanging in the air behind each lamp, curving with the car's path and dying in under half a
 * second, and a faint horizontal flare on the lamp itself. Kept low-key: fine, short-lived, and only as bright as the
 * slide is deep. Each streak is a ribbon turned to face the lens, rebuilt on the CPU every frame (a few dozen points).
 */
export class LightTrails {
  constructor(scene, n = 2, max = 40) {
    this.n = n; this.max = max; this.life = 0.42; this.t = 0;
    this.trails = Array.from({ length: n }, () => ({ pts: [], on: false }));
    const nv = n * max * 2 + n * 4;                       // ribbons, then a flare quad a lamp
    this.pos = new Float32Array(nv * 3); this.al = new Float32Array(nv); const across = new Float32Array(nv), kind = new Float32Array(nv);
    const idx = [];
    for (let j = 0; j < n; j++) {
      const b = j * max * 2;
      for (let i = 0; i < max; i++) { across[b + i * 2] = -1; across[b + i * 2 + 1] = 1; }
      for (let i = 0; i < max - 1; i++) { const a = b + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    this.flare0 = n * max * 2;
    for (let j = 0; j < n; j++) {
      const b = this.flare0 + j * 4;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([x, y], k) => { across[b + k] = y; kind[b + k] = x; });
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.al, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAcross', new THREE.BufferAttribute(across, 1));
    g.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    this.u = { uCol: { value: new THREE.Color(1.0, 0.13, 0.08) }, uI: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: `attribute float alpha, aAcross, aKind; varying float vA, vX, vK;
        void main(){ vA = alpha; vX = aAcross; vK = aKind; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uCol; uniform float uI; varying float vA, vX, vK;
        void main(){
          // a ribbon: a white-hot core in red; a flare (vK set): a soft horizontal streak
          float core = 1.0 - vX * vX;
          float flare = abs(vK) > 0.0 ? (1.0 - smoothstep(0.0, 1.0, abs(vK))) * (1.0 - smoothstep(0.0, 1.0, abs(vX))) : 0.0;
          float a = abs(vK) > 0.0 ? flare * flare : core * core;
          vec3 c = mix(uCol, vec3(1.0, 0.85, 0.8), 0.35 * a * a);
          gl_FragColor = vec4(c * a * vA * uI, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 4; this.mesh.name = 'light trails';
    scene.add(this.mesh);
    this._e = new THREE.Vector3(); this._tn = new THREE.Vector3(); this._sd = new THREE.Vector3(); this._r = new THREE.Vector3(); this._u = new THREE.Vector3();
  }

  /** Clear every trail (a reset, the magnet). */
  clear() { for (const tr of this.trails) { tr.pts.length = 0; tr.on = false; } }

  /**
   * sources: the lamps' world positions (Vector3s); k: how much of a slide there is, 0..1; eye: the camera position;
   * camera: for the flares' orientation.
   */
  update(dt, sources, k, eye, camera) {
    this.t += dt;
    const t = this.t, life = this.life;
    this.trails.forEach((tr, j) => {
      const src = sources[j];
      if (k > 0.03 && src) {
        if (!tr.on) tr.pts.length = 0;                   // a new slide starts a new streak
        tr.on = true;
        const last = tr.pts[tr.pts.length - 1];
        if (!last || Math.hypot(src.x - last.x, src.y - last.y, src.z - last.z) > 0.05) tr.pts.push({ x: src.x, y: src.y, z: src.z, t, k });
        else { last.t = t; last.k = k; }
        if (tr.pts.length > this.max) tr.pts.shift();
      } else tr.on = false;
      while (tr.pts.length && t - tr.pts[0].t > life) tr.pts.shift();
      // the ribbon, oldest to newest, turned to face the lens
      const b = j * this.max * 2, P = tr.pts, n = P.length;
      for (let i = 0; i < this.max; i++) {
        const v = b + i * 2;
        if (i >= n) {
          // unused: folded onto the last point, invisible
          const q = P[n - 1] || { x: 0, y: -1e5, z: 0 };
          for (const o of [v, v + 1]) { this.pos[o * 3] = q.x; this.pos[o * 3 + 1] = q.y; this.pos[o * 3 + 2] = q.z; this.al[o] = 0; }
          continue;
        }
        const p = P[i], a = P[Math.max(0, i - 1)], c = P[Math.min(n - 1, i + 1)];
        this._tn.set(c.x - a.x, c.y - a.y, c.z - a.z);
        this._e.set(eye.x - p.x, eye.y - p.y, eye.z - p.z);
        this._sd.crossVectors(this._tn, this._e);
        const l = this._sd.length();
        if (l > 1e-6) this._sd.multiplyScalar(1 / l); else this._sd.set(0, 1, 0);
        const age = (t - p.t) / life, f = Math.max(0, 1 - age);
        const hw = 0.022 * (0.6 + 0.4 * p.k) * Math.sqrt(f) * (i === n - 1 ? 0.6 : 1);
        this.pos.set([p.x + this._sd.x * hw, p.y + this._sd.y * hw, p.z + this._sd.z * hw], v * 3);
        this.pos.set([p.x - this._sd.x * hw, p.y - this._sd.y * hw, p.z - this._sd.z * hw], (v + 1) * 3);
        const al = 0.8 * p.k * f * f * Math.min(1, (n - 1 - i) * 0.5 + 0.25);
        this.al[v] = al; this.al[v + 1] = al;
      }
      // the flare on the lamp: a soft horizontal streak across the lens's view
      const fb = this.flare0 + j * 4;
      camera.matrixWorld.extractBasis(this._r, this._u, this._e);
      const w = 0.34 * k, h = 0.05 * k;
      const s = src || { x: 0, y: -1e5, z: 0 };
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([x, y], q) => {
        this.pos.set([s.x + this._r.x * w * x + this._u.x * h * y, s.y + this._r.y * w * x + this._u.y * h * y, s.z + this._r.z * w * x + this._u.z * h * y], (fb + q) * 3);
        this.al[fb + q] = 0.8 * k;
      });
    });
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.alpha.needsUpdate = true;
  }
}

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
      uLamps: { value: lamps }, uLampCol: { value: lampCol }, uCamVel: { value: new THREE.Vector3() },
    };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: `
        uniform float uTime, uAmount, uHead; uniform vec3 uBox, uCenter, uEye, uCar, uSky, uCamVel; uniform vec2 uWind, uCarFwd;
        uniform vec3 uLamps[5]; uniform vec3 uLampCol[5];
        attribute vec4 aSeed; attribute vec2 aCorner;
        varying vec3 vC; varying float vA; varying float vX;
        void main() {
          float fall = 8.5 + 3.5 * fract(aSeed.w * 7.1);
          vec3 vel = vec3(uWind.x, -fall, uWind.y);
          vec3 p = aSeed.xyz * uBox + vel * uTime;
          vec3 rel = mod(p - uCenter + 0.5 * uBox, uBox) - 0.5 * uBox;
          vec3 wp = uCenter + rel;
          // the streak lies along the drop's motion as the lens sees it: at speed the rain rakes back past the camera
          vec3 rv = vel - uCamVel * 0.75;
          vec3 dir = normalize(rv);
          vec3 toEye = normalize(uEye - wp);
          vec3 side = normalize(cross(dir, toEye) + vec3(1e-4, 0.0, 0.0));
          float heavy = step(0.82, fract(aSeed.w * 5.3));
          float len = (0.45 + 0.35 * fract(aSeed.w * 3.7)) * (0.7 + length(rv) * 0.045);
          vec3 pos = wp + dir * (aCorner.y * len) + side * (aCorner.x * (0.013 + 0.012 * heavy));
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
        void main() { float a = vA * (1.0 - vX * vX); gl_FragColor = vec4(vC, a * 0.6); }`,
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
  update(dt, amount, eye, fx, fz, car, head, lights, sky, camVel = null) {
    this.t += dt;
    const U = this.u;
    U.uTime.value = this.t;
    if (camVel) U.uCamVel.value.copy(camVel);
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
