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
import { clamp } from './config.js';

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
      life: 1.0 + Math.random() * 0.8, s0: 0.45, s1: 1.9 + strength * 1.0,
      r: warm.r, g: warm.g, b: warm.b, a0: 0.13 + 0.17 * strength, drag: 1.5,
    });
  }

  dust(x, y, z, vx, vz, strength) {
    this.spawn({ x, y: y + 0.05, z, vx: vx * 0.4 + (Math.random() - 0.5) * 2, vy: 0.6 + Math.random(), vz: vz * 0.4 + (Math.random() - 0.5) * 2,
      life: 0.9 + Math.random() * 0.6, s0: 0.4, s1: 2.2, r: 0.62, g: 0.52, b: 0.36, a0: 0.12 + 0.2 * strength, drag: 1.6 });
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

/** A flickering cone of fire at the exhaust while boosting, plus a light on the road behind it. */
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
    this.group.add(this.core, this.inner);
    this.group.visible = false;
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
    this.group.visible = on;
    if (!on) { this.light.intensity = 0; return; }
    const f = 0.7 + 0.3 * Math.sin(this.t * 61) * Math.sin(this.t * 37 + 1);
    this.group.scale.set(1, 1, (0.6 + 1.2 * strength) * f);
    this.mat.opacity = 0.6 * f * strength + 0.2;
    this.light.intensity = 25 * strength * f;
  }
}
