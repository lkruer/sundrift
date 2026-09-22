/**
 * The pass: an endless procedural mountain road. Pure maths, no Three.js, shared by the game, the
 * tuning sim and the gate.
 *
 * The centreline is grown feature by feature (straight, sweeper, hairpin, S-bend, kink) from a seeded RNG,
 * with linear curvature ramps between them so the road has clothoid-like transitions rather than corners
 * that start on a dime. Samples are stored every ROAD.sliceStep metres with position, elevation, heading,
 * curvature, and `mount`: which side the mountain is on (+1 left, -1 right, 0 a ridge with valleys both
 * sides). Everything else in the world (terrain height, where trees go, where the wall is) is a function of
 * (s, u): distance along the road and signed lateral offset from it, left positive.
 */
import { ROAD, mulberry32, clamp, lerp, smoothstep } from './config.js';

const TAU = Math.PI * 2;

export class Track {
  constructor(seed = ROAD.seed) {
    this.rng = mulberry32(seed);
    this.step = ROAD.sliceStep;
    this.pts = [];              // { x, z, y, h, k, s, mount, wl, wr, feature }
    this.features = [];         // { type, s0, s1, R, dir }
    this.markers = [];          // set pieces: { s, type, side }
    this.terraces = [];         // flat cuts for set pieces: { s0, s1, side, u0, u1, h, layby }
    this.noiseSeed = seed * 7 + 3;
    // generator state
    this._x = 0; this._z = 0; this._h = 0; this._k = 0; this._y = 0; this._s = 0;
    this._grade = 0.0; this._mount = 1; this._mountTarget = 1;
    this._pending = [];         // curvature program: [{ len, k0, k1 }]
    this._featureIndex = 0;
    this._sinceHairpin = 0; this._sinceSet = 120;
    this._lastType = 'straight';
    this.pts.push(this._point('straight'));
  }

  _point(feature) {
    return { x: this._x, z: this._z, y: this._y, h: this._h, k: this._k, s: this._s, mount: this._mount, feature,
             wl: ROAD.railOffset, wr: ROAD.railOffset };
  }

  /** Grow the centreline until it covers distance sMax. */
  ensure(sMax) {
    while (this._s < sMax) {
      if (!this._pending.length) this._plan();
      const seg = this._pending[0];
      const n = Math.max(1, Math.round(seg.len / this.step));
      const ds = seg.len / n;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const k = lerp(seg.k0, seg.k1, t);
        // heading integrates curvature; position integrates heading (midpoint)
        const h0 = this._h;
        this._h += k * ds;
        const hm = (h0 + this._h) * 0.5;
        this._x += Math.sin(hm) * ds;
        this._z += Math.cos(hm) * ds;
        // grade drifts toward its target; elevation follows
        this._grade += (seg.grade - this._grade) * Math.min(1, ds / 40);
        this._y += this._grade * ds;
        this._s += ds;
        this._k = k;
        this._mount += (this._mountTarget - this._mount) * Math.min(1, ds / 90);
        const p = this._point(seg.type);
        if (seg.widenOuter) {
          // hairpins are wider on the outside, the way a real pass is cut
          const w = ROAD.railOffset + 1.6 * Math.sin(Math.PI * t);
          if (seg.dir > 0) p.wr = w; else p.wl = w;
        }
        this.pts.push(p);
      }
      this._pending.shift();
    }
  }

  /** Queue the next feature as curvature segments. */
  _plan() {
    const r = this.rng;
    const s0 = this._s;
    this._sinceHairpin += 1; this._sinceSet += 1;
    const pick = r();
    let type;
    if (this._sinceHairpin >= 3 && pick < 0.34) type = 'hairpin';
    else if (pick < 0.55) type = 'sweeper';
    else if (pick < 0.72) type = 'ess';
    else if (pick < 0.86) type = 'kink';
    else type = 'straight';
    if (this._lastType === 'straight' && type === 'straight') type = 'sweeper';
    this._lastType = type;
    const dir = r() < 0.5 ? 1 : -1;        // +1 left
    const grade = clamp((r() - 0.45) * 0.14, -0.075, 0.075);
    const push = (len, k0, k1, extra = {}) => this._pending.push({ len, k0, k1, grade, type, dir, ...extra });
    const ramp = 10 + r() * 8;
    if (type === 'straight') {
      push(40 + r() * 80, 0, 0);
    } else if (type === 'sweeper') {
      const R = 42 + r() * 70, ang = (0.5 + r() * 0.9), k = dir / R;
      push(ramp, 0, k); push(Math.max(8, R * ang - ramp), k, k); push(ramp, k, 0);
      push(10 + r() * 30, 0, 0);
    } else if (type === 'hairpin') {
      const R = 11.5 + r() * 6, ang = 2.45 + r() * 0.75, k = dir / R;
      push(20 + r() * 25, 0, 0);                                  // approach
      push(ramp, 0, k); push(R * ang, k, k, { widenOuter: true }); push(ramp, k, 0);
      push(18 + r() * 24, 0, 0);
      this._sinceHairpin = 0;
    } else if (type === 'ess') {
      const R1 = 26 + r() * 30, R2 = 26 + r() * 30, a1 = 0.7 + r() * 0.6, a2 = 0.7 + r() * 0.6;
      const k1 = dir / R1, k2 = -dir / R2;
      push(ramp, 0, k1); push(R1 * a1, k1, k1); push(ramp * 1.4, k1, k2); push(R2 * a2, k2, k2); push(ramp, k2, 0);
      push(8 + r() * 20, 0, 0);
    } else if (type === 'kink') {
      const R = 70 + r() * 90, ang = 0.25 + r() * 0.3, k = dir / R;
      push(ramp, 0, k); push(R * ang, k, k); push(ramp, k, 0);
      push(20 + r() * 50, 0, 0);
    }
    // which side the mountain is on changes slowly, through a ridge
    if (r() < 0.22) this._mountTarget = this._mountTarget > 0 ? -1 : 1;
    if (r() < 0.10) this._mountTarget = 0;
    // set pieces every 450 m or so, never inside a hairpin
    if (this._sinceSet >= 5 && type !== 'hairpin' && r() < 0.55) {
      const kinds = ['shrine', 'tunnel', 'vista', 'hut', 'mirrors'];
      const kind = kinds[Math.floor(r() * kinds.length)];
      this.markers.push({ s: s0 + 30, kind, side: this._mountTarget >= 0 ? 1 : -1 });
      this._sinceSet = 0;
    }
    this.features.push({ type, s0, dir, s1: null });
  }

  /** Index of the sample at or before distance s. */
  index(s) { return clamp(Math.floor(s / this.step), 0, this.pts.length - 1); }

  /** Interpolated centreline sample at distance s. */
  sample(s) {
    this.ensure(s + this.step * 2);
    const i = this.index(s);
    const a = this.pts[i], b = this.pts[Math.min(i + 1, this.pts.length - 1)];
    const t = a === b ? 0 : clamp((s - a.s) / Math.max(1e-6, b.s - a.s), 0, 1);
    return { x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t), y: lerp(a.y, b.y, t), h: lerpAngle(a.h, b.h, t),
             k: lerp(a.k, b.k, t), s, mount: lerp(a.mount, b.mount, t), wl: lerp(a.wl, b.wl, t), wr: lerp(a.wr, b.wr, t) };
  }

  /**
   * Nearest sample to a world point, searching outward from a hint index. Returns the index, the exact
   * distance along the road and the signed lateral offset (left positive).
   */
  nearest(x, z, hint = 0) {
    const pts = this.pts;
    let i = clamp(hint, 0, pts.length - 1);
    const d2 = (j) => { const p = pts[j]; const dx = x - p.x, dz = z - p.z; return dx * dx + dz * dz; };
    let best = d2(i);
    // walk forward then backward until the distance stops improving
    while (i + 1 < pts.length && d2(i + 1) < best) { i++; best = d2(i); }
    while (i - 1 >= 0 && d2(i - 1) < best) { i--; best = d2(i); }
    const p = pts[i];
    const fx = Math.sin(p.h), fz = Math.cos(p.h);         // forward
    const lx = Math.cos(p.h), lz = -Math.sin(p.h);        // left
    const dx = x - p.x, dz = z - p.z;
    const along = dx * fx + dz * fz;
    const u = dx * lx + dz * lz;
    return { i, s: p.s + along, u, along, p };
  }

  /**
   * Terrain height relative to the road at signed offset u, for the road sample p. The mountain side rises
   * as a cutting then a slope; the valley side drops away. `mount` blends between them so the mountain can
   * change sides through a ridge.
   */
  profile(u, mount, s) {
    const au = Math.abs(u);
    const rail = ROAD.railOffset;
    // uphill: a 0.4 m ditch at the rail, a steep rock cutting to 9 m, then a 30-degree wooded slope
    const ditch = -0.35 * smoothstep(rail - 0.3, rail + 0.9, au) * (1 - smoothstep(rail + 0.9, rail + 2.4, au));
    const cut = 1.15 * clamp(au - (rail + 1.6), 0, 7.5) * smoothstep(rail + 1.2, rail + 2.2, au);
    const hill = 0.62 * clamp(au - (rail + 9.1), 0, 200);
    const up = ditch + cut + hill;
    // downhill: a small berm under the rail, then a 35-degree fall into the valley, easing off far below
    const berm = 0.18 * smoothstep(rail - 0.6, rail + 0.4, au) * (1 - smoothstep(rail + 0.4, rail + 1.8, au));
    const fall = clamp(au - (rail + 1.2), 0, 200);
    const down = berm - 0.72 * fall + 0.0018 * fall * fall * (fall < 120 ? 1 : 0);
    // which profile applies on this side
    const mountainHere = u > 0 ? (mount + 1) * 0.5 : (1 - mount) * 0.5;   // 1 = mountain on this side
    let h = lerp(down, up, mountainHere);
    // a ridge (mount near 0) is a broad plateau that falls gently
    const ridge = 1 - Math.min(1, Math.abs(mount) * 1.6);
    h = lerp(h, -0.28 * fall, ridge);
    // noise, growing with distance from the road so the shoulder stays clean
    const n = this.noise(u * 0.11 + s * 0.013, s * 0.06) * 2.2 + this.noise(u * 0.35, s * 0.21) * 0.5;
    h += n * smoothstep(rail + 0.8, rail + 6, au);
    // terraces: a flat cut for a shrine or a lay-by, with soft edges
    for (const t of this.terraces) {
      if (s < t.s0 - 3 || s > t.s1 + 3) continue;
      if (Math.sign(u) !== t.side) continue;
      if (au < t.u0 - 1.5 || au > t.u1 + 2.5) continue;
      const kS = smoothstep(t.s0 - 3, t.s0, s) * (1 - smoothstep(t.s1, t.s1 + 3, s));
      const kU = smoothstep(t.u0 - 1.5, t.u0, au) * (1 - smoothstep(t.u1, t.u1 + 2.5, au));
      h = lerp(h, t.h, kS * kU);
    }
    return h;
  }

  /** The terrace covering distance s, if any. */
  terraceAt(s) {
    for (const t of this.terraces) if (s >= t.s0 && s <= t.s1) return t;
    return null;
  }

  /** Cheap 2D value noise in [-1, 1], deterministic. */
  noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const hsh = (a, b) => { let t = (a * 374761393 + b * 668265263 + this.noiseSeed) | 0; t = (t ^ (t >>> 13)) * 1274126177; return (((t ^ (t >>> 16)) >>> 0) / 4294967296) * 2 - 1; };
    const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    return lerp(lerp(hsh(xi, yi), hsh(xi + 1, yi), sx), lerp(hsh(xi, yi + 1), hsh(xi + 1, yi + 1), sx), sy);
  }

  /** World height of the ground at a point, given a nearby sample index as a hint. */
  groundAt(x, z, hint = 0) {
    const n = this.nearest(x, z, hint);
    return n.p.y + this.profile(n.u, n.p.mount, n.s);
  }

  /** The wall on each side at distance s: the rail on the valley side, the cutting face on the mountain side. */
  walls(s) {
    const p = this.sample(s);
    return { left: p.wl, right: p.wr };
  }
}

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return a + d * t;
}
