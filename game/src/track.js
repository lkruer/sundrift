/**
 * The pass: an endless mountain road laid on the mountain itself.
 *
 * The mountain is one smooth height field (field.js). The road is grown feature by feature (straights,
 * sweepers, S-bends, kinks, hairpins) with clothoid-like curvature ramps. Every feature is steered to run along
 * the mountainside's local contour, so the road wraps round spurs and into gullies the way a real pass does;
 * the hairpins at the end of each leg turn uphill, so switchbacks stack up the slope and the leg below is
 * always downhill of the leg above. Every candidate feature is simulated and tested against the road already
 * laid before it is committed, so the road never runs into itself. The road's elevation follows the field,
 * grade-limited, so it sits on the mountain instead of floating over it.
 *
 * Difficulty is the road: how wide it is and how tight and how frequent the corners are.
 *
 * Pure maths, no Three.js: the game, the physics sim and the gate share it.
 */
import { mulberry32, clamp, lerp, smoothstep } from './config.js?v=202609222216';
import { Field } from './field.js?v=202609222216';

const TAU = Math.PI * 2;
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const lerpAngle = (a, b, t) => a + wrap(b - a) * t;
const within = (r, [a, b]) => a + r() * (b - a);
export const CELL = 24;
export const ckey = (cx, cz) => (cx + 40000) * 80000 + (cz + 40000);
const LAYBY = { conbini: [8, 11, 46], busstop: [4.5, 5, 30], hut: [6, 8, 36], vista: [6, 4, 36] };   // drivable width, pad depth, length
const LOOK = 4;                                  // provisional features kept ahead of the final road
const SET_ROTATION = ['busstop', 'conbini', 'tunnel', 'shrine', 'hut', 'vista', 'busstop', 'tunnel', 'shrine', 'conbini', 'hut'];

export const DIFFS = {
  easy: {
    key: 'easy', label: 'EASY', blurb: 'Wide road, flowing sweepers', salt: 101,
    half: 5.0, wall: 6.3, gmax: 0.07,
    leg: [360, 700], hairpinR: [30, 40], approach: [30, 50],
    sweeperR: [70, 150], sweeperAng: [0.35, 0.9], essR: [55, 95], essAng: [0.4, 0.75],
    kinkR: [110, 220], kinkAng: [0.15, 0.35], straight: [60, 130], ramp: [18, 28],
    weights: [['sweeper', 0.42], ['ess', 0.2], ['kink', 0.23], ['straight', 0.15]], maxOff: 0.55, setEvery: 5,
  },
  medium: {
    key: 'medium', label: 'MEDIUM', blurb: 'The pass: hairpins and S-bends', salt: 202,
    half: 4.4, wall: 5.5, gmax: 0.085,
    leg: [190, 380], hairpinR: [16, 22], approach: [22, 40],
    sweeperR: [42, 110], sweeperAng: [0.45, 1.15], essR: [30, 58], essAng: [0.6, 1.1],
    kinkR: [70, 160], kinkAng: [0.2, 0.5], straight: [40, 100], ramp: [12, 20],
    weights: [['sweeper', 0.4], ['ess', 0.27], ['kink', 0.2], ['straight', 0.13]], maxOff: 0.7, setEvery: 5,
  },
  hard: {
    key: 'hard', label: 'HARD', blurb: 'Narrow, tight, relentless', salt: 303,
    half: 3.9, wall: 4.9, gmax: 0.10,
    leg: [120, 240], hairpinR: [11.5, 15], approach: [16, 30],
    sweeperR: [30, 80], sweeperAng: [0.6, 1.45], essR: [22, 42], essAng: [0.7, 1.3],
    kinkR: [50, 110], kinkAng: [0.3, 0.6], straight: [25, 65], ramp: [9, 15],
    weights: [['sweeper', 0.34], ['ess', 0.36], ['kink', 0.2], ['straight', 0.1]], maxOff: 0.8, setEvery: 5,
  },
};

export class Track {
  constructor(seed = 20260921, diffKey = 'medium') {
    this.seed = seed;
    this.D = DIFFS[diffKey] || DIFFS.medium;
    this.diff = this.D.key;
    this.field = new Field(seed);
    this.rng = mulberry32((seed * 31 + this.D.salt) >>> 0);
    this.step = 2;
    this.half = this.D.half; this.wall = this.D.wall;
    this.tubeHalf = this.half + 0.6;
    this.clear = 2 * this.wall + 9;            // how close two unrelated stretches of road may come, centre to centre
    this.pts = []; this.features = []; this.markers = []; this.tunnels = []; this.pads = [];
    this.squeezes = 0;                          // features committed without full clearance (should stay 0)
    this._cells = new Map();
    this._listeners = [];
    this._cand = { i: new Int32Array(2048), d: new Float32Array(2048), t: new Float32Array(2048) };
    const U = this.field.U;
    this._x = 0; this._z = 0; this._k = 0; this._s = 0;
    this._h = Math.atan2(-U[1], U[0]);          // along the contour, uphill on the left
    this._y = this.field.base(0, 0); this._grade = 0; this._prevB = this._y;
    this._leg = this._h;
    this._legLeft = 260;
    // the ladder: every leg runs along the contour and holds itself above a floor set by the leg below it, so the
    // road only ever climbs away from the road it has already laid
    this._below = new Map();                    // along-contour bin (4 m) -> highest uphill coordinate of the road below
    this._legStart = 0;                         // first sample of the current leg
    this._sinceSet = 0; this._setIdx = 0; this._pendingTunnel = false;
    this._floorFrom = 0;                        // first sample not yet part of the floor
    // the last few features stay provisional: when the road runs itself into a corner, the generator backs up and
    // lays them again differently. Only final road is published to the world (listeners, queries).
    this._pending = [];
    this._failAt = new Map();
    this._budget = 60;
    this.nFinal = 1;                            // samples [0, nFinal) are final
    this.nFinalF = 0;                           // features [0, nFinalF) are final
    this._push(this._sampleHere('straight', 0));
  }

  /** Distance along the road covered by final samples. */
  get sFinal() { return this.pts[this.nFinal - 1].s; }

  onAdd(fn) { this._listeners.push(fn); }

  // ------------------------------------------------------------------ generation

  /** Grow the centreline until it covers distance sMax. */
  ensure(sMax) {
    let n = 0;
    while (this.pts[this.nFinal - 1].s < sMax && n++ < 4000) this._feature();
  }

  _sampleHere(feature, fi) {
    return { x: this._x, z: this._z, y: this._y, h: this._h, k: this._k, s: this._s, wl: this.wall, wr: this.wall,
             feature, fi, tunnel: false, nl: 0, nr: 0 };
  }

  _push(p) {
    this.pts.push(p);
    const i = this.pts.length - 1;
    const k = ckey(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
    const c = this._cells.get(k); if (c) c.push(i); else this._cells.set(k, [i]);
  }

  /** Uphill side of the road at a heading: +1 left, -1 right. */
  _upSide(h, up) { return (Math.cos(h) * up[0] - Math.sin(h) * up[1]) >= 0 ? 1 : -1; }

  /** How far up the mountainside a point is, along the global uphill direction. */
  _uc(x, z) { return x * this.field.U[0] + z * this.field.U[1]; }
  /** How far along the mountainside a point is, along the contour. */
  _vc(x, z) { return -x * this.field.U[1] + z * this.field.U[0]; }

  /** The floor at a point: the road already laid below it, at the same place along the contour, plus clearance. */
  _floorAt(x, z) {
    const b = Math.floor(this._vc(x, z) / 4);
    let m = -Infinity;
    for (let k = b - 4; k <= b + 4; k++) { const v = this._below.get(k); if (v !== undefined && v > m) m = v; }
    return m + this.clear;
  }

  _feature() {
    const D = this.D, r = this.rng;
    const fi = this.features.length;
    const up = this.field.U;
    // the contour this leg follows: of the two headings along the contour, the one nearer the leg's own
    const c1 = Math.atan2(-up[1], up[0]), c2 = wrap(c1 + Math.PI);
    this._leg = Math.abs(wrap(c1 - this._leg)) < Math.abs(wrap(c2 - this._leg)) ? c1 : c2;
    const e = wrap(this._h - this._leg);       // how far the road points off the contour (left positive)
    const upSide = this._upSide(this._h, up);
    const lev = this._uc(this._x, this._z) - this._floorAt(this._x, this._z);   // how far above the road below
    const climbAng = e * upSide;                // positive when the road points uphill
    const plans = [];
    this._downCap = clamp((lev - 14) / 90, 0.05, D.maxOff);   // how far downhill a turn may point the road
    if (fi === 0) {
      plans.push(this._planStraight(100));
    } else if (this._pendingTunnel) {
      plans.push(this._planStraight(within(r, [96, 124]), 'tunnel'));
    } else if (this._legLeft <= 0 && climbAng > -0.06) {
      plans.push(this._planHairpin(upSide, e));
      plans.push(this._planKink(upSide, within(r, D.kinkR), within(r, D.kinkAng) * 0.5));
      plans.push(this._planStraight(within(r, D.straight) * 0.5));
      plans.push(this._planHairpin(upSide, e));
    } else if (this._legLeft <= 0) {
      // a switchback entered while the road points downhill would swing its exit back into the leg below:
      // straighten up first
      plans.push(this._planKink(upSide, within(r, D.kinkR) * 0.7, clamp(-climbAng + 0.08, 0.12, 0.6)));
      plans.push(this._planSweeper(upSide, within(r, D.sweeperR), clamp(-climbAng + 0.08, 0.2, 0.9)));
      plans.push(this._planStraight(30));
    } else {
      const type = this._pickType();
      // turn back toward the contour when the road has wandered off it, and always up and away from the floor
      let toward = -Math.sign(e) || (r() < 0.5 ? 1 : -1);
      let dir = Math.abs(e) > 0.22 && r() < 0.85 ? toward : (r() < 0.5 ? 1 : -1);
      if (lev < 10) { dir = upSide; toward = upSide; }
      else if (lev < 26 && dir !== upSide && climbAng <= 0.05) dir = upSide;
      plans.push(this._mk(type, dir, e));
      plans.push(this._mk(type, -dir, e));
    }
    // the escapes: turn up the mountain, harder and harder, and as a last resort switch back early
    if (fi > 0) {
      plans.push(this._mk('kink', upSide, e));
      plans.push(this._planSweeper(upSide, within(r, D.sweeperR), clamp(0.12 - climbAng, 0.3, 1.1)));
      plans.push(this._planSweeper(upSide, D.sweeperR[0], clamp(0.3 - climbAng, 0.45, 1.4)));
      plans.push(this._planStraight(within(r, D.straight) * 0.6));
      plans.push(this._planHairpin(upSide, e));
    }
    // try each plan against the road already laid; take the first that keeps clear
    let best = null, bestC = -1;
    for (const plan of plans) {
      const c = this._clearance(plan);
      if (c >= this.clear) { best = plan; bestC = c; break; }
      if (c > bestC) { best = plan; bestC = c; }
    }
    if (bestC < this.clear) {
      // a dead end: back up over the provisional road and lay it again, further back each time this spot fails
      if (this._pending.length && this._budget > 0) {
        this._budget--;
        const F = this.features.length;
        const n = (this._failAt.get(F) || 0) + 1; this._failAt.set(F, n);
        const depth = Math.min(this._pending.length, n > 8 ? 4 : n > 5 ? 3 : n > 2 ? 2 : 1);
        for (let d = 0; d < depth; d++) this._undo();
        return;
      }
      this.squeezes++;
    }
    this._commit(best, fi);
  }

  _mk(t, d, e) {
    const D = this.D, r = this.rng;
    if (t === 'straight') return this._planStraight(within(r, D.straight));
    if (t === 'kink') return this._planKink(d, within(r, D.kinkR), this._angleFor(d, e, within(r, D.kinkAng), 0.12));
    if (t === 'sweeper') return this._planSweeper(d, within(r, D.sweeperR), this._angleFor(d, e, within(r, D.sweeperAng), 0.3));
    return this._planEss(d, e);
  }

  _pickType() {
    const w = this.D.weights, r = this.rng();
    let acc = 0;
    for (const [t, p] of w) { acc += p; if (r < acc) return t; }
    return w[0][0];
  }

  /** A turn angle that keeps the road within maxOff of the contour, and above the road below. */
  _angleFor(dir, e, ang, min) {
    const maxOff = this.D.maxOff;
    const upSide = this._upSide(this._h, this.field.U);
    // headings are measured left positive; a turn toward the uphill side makes the road climb
    const lim = dir === upSide ? maxOff : Math.min(maxOff, this._downCap ?? maxOff);
    const after = e + dir * ang;                          // heading error after the turn
    const room = lim - Math.abs(after) >= 0 ? ang : Math.max(0, lim - dir * e);
    return clamp(Math.min(ang, room), min, Math.max(min, ang));
  }

  _ramp() { return within(this.rng, this.D.ramp); }

  _planStraight(len, tag = null) {
    return { type: tag || 'straight', dir: 0, segs: [{ len, k0: 0, k1: 0 }] };
  }

  _arc(segs, dir, R, ang, widen = false) {
    const k = dir / R;
    const r1 = Math.min(this._ramp(), R * ang * 0.45), r2 = Math.min(this._ramp(), R * ang * 0.45);
    const arcLen = Math.max(2, (ang - (r1 + r2) / (2 * R)) * R);
    segs.push({ len: r1, k0: 0, k1: k, widen });
    segs.push({ len: arcLen, k0: k, k1: k, widen });
    segs.push({ len: r2, k0: k, k1: 0, widen });
  }

  _planKink(dir, R, ang) {
    const segs = [];
    this._arc(segs, dir, R, ang);
    segs.push({ len: within(this.rng, [20, 45]), k0: 0, k1: 0 });
    return { type: 'kink', dir, R, segs };
  }

  _planSweeper(dir, R, ang) {
    const segs = [];
    this._arc(segs, dir, R, ang);
    segs.push({ len: within(this.rng, [10, 34]), k0: 0, k1: 0 });
    return { type: 'sweeper', dir, R, segs };
  }

  _planEss(dir, e) {
    const D = this.D, r = this.rng;
    const R1 = within(r, D.essR), R2 = within(r, D.essR);
    const a1 = within(r, D.essAng);
    // the second arc undoes the first, plus half of the current wander, so an S-bend nets back toward the contour
    const a2 = clamp(a1 + dir * e * 0.5, 0.3, 1.5);
    const segs = [];
    const k1 = dir / R1, k2 = -dir / R2;
    const rin = this._ramp(), rx = this._ramp() * 1.3, rout = this._ramp();
    segs.push({ len: rin, k0: 0, k1: k1 });
    segs.push({ len: Math.max(2, (a1 - rin / (2 * R1) - rx / (4 * R1)) * R1), k0: k1, k1: k1 });
    segs.push({ len: rx, k0: k1, k1: k2 });
    segs.push({ len: Math.max(2, (a2 - rout / (2 * R2) - rx / (4 * R2)) * R2), k0: k2, k1: k2 });
    segs.push({ len: rout, k0: k2, k1: 0 });
    segs.push({ len: within(r, [8, 24]), k0: 0, k1: 0 });
    return { type: 'ess', dir, R: Math.min(R1, R2), segs };
  }

  /** A switchback: an approach, a turn that brings the heading round to the far side of the contour, an exit. */
  _planHairpin(dir, e) {
    const D = this.D, r = this.rng;
    const R = within(r, D.hairpinR);
    let A;
    // the turn that leaves along the contour the other way, aimed a little uphill of it, and always a little short
    // of a full half-turn so the new leg diverges from the one it came up from
    A = clamp(Math.PI - dir * e - 0.12, 2.45, Math.PI - 0.06);
    const segs = [{ len: within(r, D.approach), k0: 0, k1: 0 }];
    this._arc(segs, dir, R, A, true);
    segs.push({ len: within(r, D.approach), k0: 0, k1: 0 });
    return { type: 'hairpin', dir, R, segs };
  }

  /** Where a plan would put the road, as points every 2 m, plus a 60 m look-ahead past its end. */
  _simulate(plan) {
    let x = this._x, z = this._z, h = this._h;
    const xs = [], zs = [];
    for (const seg of plan.segs) {
      const n = Math.max(1, Math.round(seg.len / this.step)), ds = seg.len / n;
      for (let i = 0; i < n; i++) {
        const k = lerp(seg.k0, seg.k1, (i + 0.5) / n);
        const h0 = h; h += k * ds; const hm = (h0 + h) * 0.5;
        x += Math.sin(hm) * ds; z += Math.cos(hm) * ds;
        xs.push(x); zs.push(z);
      }
    }
    for (let d = 4; d <= 60; d += 4) { xs.push(x + Math.sin(h) * d); zs.push(z + Math.cos(h) * d); }
    return { xs, zs };
  }

  /** The closest a plan comes to road laid more than 60 m ago. */
  _clearance(plan) {
    const { xs, zs } = this._simulate(plan);
    const cutoff = this.pts.length - 30;
    if (cutoff <= 0) return Infinity;
    let min = Infinity;
    for (let j = 0; j < xs.length; j++) {
      const x = xs[j], z = zs[j];
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const c = this._cells.get(ckey(cx + dx, cz + dz)); if (!c) continue;
        for (let k = 0; k < c.length; k++) {
          const i = c[k]; if (i >= cutoff) continue;
          const p = this.pts[i];
          const d2 = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
          if (d2 < min) min = d2;
        }
      }
    }
    return Math.sqrt(min);
  }

  _commit(plan, fi) {
    const D = this.D, F = this.field;
    const i0 = this.pts.length;
    const s0 = this._s;
    const rec = { n: i0, nf: this.features.length, nm: this.markers.length, nt: this.tunnels.length, np: this.pads.length,
      x: this._x, z: this._z, h: this._h, k: this._k, s: this._s, y: this._y, grade: this._grade, prevB: this._prevB,
      leg: this._leg, legLeft: this._legLeft, legStart: this._legStart, floorFrom: this._floorFrom,
      sinceSet: this._sinceSet, setIdx: this._setIdx, pendingTunnel: this._pendingTunnel, below: null };
    // hairpins are wider on the outside through the turn, the way a real pass is cut
    let widenLen = 0; for (const seg of plan.segs) if (seg.widen) widenLen += seg.len;
    let widenAt = 0;
    const outer = -plan.dir;
    for (const seg of plan.segs) {
      const n = Math.max(1, Math.round(seg.len / this.step)), ds = seg.len / n;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const k = lerp(seg.k0, seg.k1, t);
        const h0 = this._h; this._h += k * ds; const hm = (h0 + this._h) * 0.5;
        this._x += Math.sin(hm) * ds; this._z += Math.cos(hm) * ds;
        this._s += ds; this._k = k;
        // elevation: converge on the mountain over ~26 m, move with its slope, never steeper than the grade limit
        const B = F.base(this._x, this._z);
        const dB = (B - this._prevB) / ds; this._prevB = B;
        const want = clamp((B - this._y) / 26 + dB, -D.gmax, D.gmax);
        this._grade += (want - this._grade) * Math.min(1, ds / 12);
        this._y += this._grade * ds;
        const p = this._sampleHere(plan.type === 'tunnel' ? 'straight' : plan.type, fi);
        if (seg.widen && widenLen > 0) {
          const w = this.wall + 2.4 * Math.sin(Math.PI * clamp((widenAt + t * seg.len) / widenLen, 0, 1));
          if (outer > 0) p.wl = w; else p.wr = w;
        }
        this._push(p);
      }
      if (seg.widen) widenAt += seg.len;
    }
    const i1 = this.pts.length - 1;
    const feat = { type: plan.type === 'tunnel' ? 'straight' : plan.type, dir: plan.dir, R: plan.R || 0, s0, s1: this._s, i0, i1 };
    this.features.push(feat);

    // legs and the ladder
    const len = this._s - s0;
    if (plan.type === 'hairpin') {
      this._leg = wrap(this._leg + Math.PI);
      this._legLeft = within(this.rng, D.leg);
      // the leg just finished, and the switchback that led into it, become part of the road below (the switchback
      // just taken does not: the new leg starts at its top)
      rec.below = [];
      for (let i = this._floorFrom; i < i0; i++) {
        const q = this.pts[i]; const b = Math.floor(this._vc(q.x, q.z) / 4); const u = this._uc(q.x, q.z);
        const v = this._below.get(b);
        if (v === undefined || u > v) { rec.below.push([b, v]); this._below.set(b, u); }
      }
      this._floorFrom = i0;
      this._legStart = i1 + 1;
    } else {
      this._legLeft -= len;
    }

    // set pieces
    if (plan.type === 'tunnel') {
      this._pendingTunnel = false;
      const ts0 = s0 + 12, ts1 = this._s - 12;
      this.tunnels.push({ s0: ts0, s1: ts1, fi });
      this.markers.push({ s: ts0, kind: 'tunnel', side: 0, s1: ts1, fi });
      for (let i = i0; i <= i1; i++) {
        const p = this.pts[i];
        if (p.s >= ts0 - 1 && p.s <= ts1 + 1) { p.tunnel = true; p.wl = p.wr = this.tubeHalf - 0.15; }
      }
    } else if (fi === 0) {
      this._placeSet('shrine', 34, i0, i1);
    } else if (plan.type !== 'hairpin') {
      this._sinceSet++;
      if (this._sinceSet >= D.setEvery) {
        const kind = SET_ROTATION[this._setIdx % SET_ROTATION.length];
        if (kind === 'tunnel') { this._pendingTunnel = true; this._setIdx++; this._sinceSet = 0; }
        else if ((plan.type === 'straight' || plan.type === 'kink' || (plan.type === 'sweeper' && plan.R >= 55)) && len >= 90) {
          this._placeSet(kind, s0 + 20, i0, i1);
          this._setIdx++; this._sinceSet = 0;
        }
      }
    }

    // what the natural ground does just beyond each wall: the props read it to decide rail or cutting
    for (let i = i0; i <= i1; i++) {
      const p = this.pts[i];
      const lx = Math.cos(p.h), lz = -Math.sin(p.h);
      p.nl = F.base(p.x + lx * (p.wl + 6), p.z + lz * (p.wl + 6)) - p.y;
      p.nr = F.base(p.x - lx * (p.wr + 6), p.z - lz * (p.wr + 6)) - p.y;
    }
    // provisional until LOOK more features follow it
    this._pending.push(rec);
    while (this._pending.length > LOOK) {
      const r0 = this._pending.shift();
      const g = this.features[r0.nf];
      this.nFinal = g.i1 + 1; this.nFinalF = r0.nf + 1;
      this._budget = 60;
      this._failAt.delete(r0.nf);
      for (const fn of this._listeners) fn(Math.max(0, g.i0 - 1), g.i1);
    }
  }

  /** Take back the last provisional feature. */
  _undo() {
    const rec = this._pending.pop();
    for (let i = this.pts.length - 1; i >= rec.n; i--) {
      const p = this.pts[i]; const k = ckey(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
      const c = this._cells.get(k); c.pop(); if (!c.length) this._cells.delete(k);
    }
    this.pts.length = rec.n; this.features.length = rec.nf;
    this.markers.length = rec.nm; this.tunnels.length = rec.nt; this.pads.length = rec.np;
    if (rec.below) for (let j = rec.below.length - 1; j >= 0; j--) {
      const [b, v] = rec.below[j]; if (v === undefined) this._below.delete(b); else this._below.set(b, v);
    }
    this._x = rec.x; this._z = rec.z; this._h = rec.h; this._k = rec.k; this._s = rec.s; this._y = rec.y;
    this._grade = rec.grade; this._prevB = rec.prevB; this._leg = rec.leg; this._legLeft = rec.legLeft;
    this._legStart = rec.legStart; this._floorFrom = rec.floorFrom;
    this._sinceSet = rec.sinceSet; this._setIdx = rec.setIdx; this._pendingTunnel = rec.pendingTunnel;
  }

  /** A set piece at distance s: a raised terrace cut into the uphill side, or a lay-by on the downhill side. */
  _placeSet(kind, s, i0, i1) {
    let i = i0;
    while (i < i1 && this.pts[i].s < s) i++;
    const p0 = this.pts[i];
    const lx = Math.cos(p0.h), lz = -Math.sin(p0.h), o = this.wall + 8;
    const upSide = this.field.base(p0.x + lx * o, p0.z + lz * o) >= this.field.base(p0.x - lx * o, p0.z - lz * o) ? 1 : -1;
    if (kind === 'shrine') {
      const side = upSide;
      this.pads.push({ s0: s - 8, s1: s + 30, side, u0: this.wall + 3.6, u1: this.wall + 16, h: 0.5, kind, fi: this.features.length - 1 });
      this.markers.push({ s, kind, side, fi: this.features.length - 1 });
      return;
    }
    const side = -upSide;                                     // lay-bys look out over the valley
    // a drivable lay-by, and beyond its edge a level pad for the building, which the car cannot reach
    const [width, depth, len] = LAYBY[kind] || [6, 6, 36];
    const a = s - 10, b = s + len;
    for (let j = i0; j <= i1; j++) {
      const p = this.pts[j];
      if (p.s < a - 8 || p.s > b + 8) continue;
      const k = smoothstep(a - 8, a, p.s) * (1 - smoothstep(b, b + 8, p.s));
      const w = this.wall + (width - 0.6) * k;
      if (side > 0) p.wl = Math.max(p.wl, w); else p.wr = Math.max(p.wr, w);
    }
    const wlay = this.wall + width - 0.6;
    this.pads.push({ s0: a, s1: b, side, u0: wlay + 1.0, u1: wlay + 1.0 + depth, h: 0, kind, fi: this.features.length - 1 });
    this.markers.push({ s, kind, side, width, depth, len, wlay, fi: this.features.length - 1 });
  }

  // ------------------------------------------------------------------ queries

  /** Index of a sample near distance s (samples are close to, but not exactly, 2 m apart). */
  index(s) {
    let i = clamp(Math.floor(s / this.step), 0, this.pts.length - 1);
    while (i > 0 && this.pts[i].s > s) i--;
    while (i < this.pts.length - 1 && this.pts[i + 1].s <= s) i++;
    return i;
  }

  /** Interpolated centreline sample at distance s. */
  sample(s) {
    this.ensure(s + 40);
    const i = Math.min(this.index(s), this.pts.length - 2);
    const a = this.pts[i], b = this.pts[i + 1];
    const t = clamp((s - a.s) / Math.max(1e-6, b.s - a.s), 0, 1);
    return { x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t), y: lerp(a.y, b.y, t), h: lerpAngle(a.h, b.h, t),
             k: lerp(a.k, b.k, t), s, wl: lerp(a.wl, b.wl, t), wr: lerp(a.wr, b.wr, t), i,
             tunnel: a.tunnel && b.tunnel, nl: lerp(a.nl, b.nl, t), nr: lerp(a.nr, b.nr, t) };
  }

  /**
   * Nearest point of the road to a world point, walking from a hint index along the road. Fast and stable for
   * the car, which is always near its hint. Returns the index, the distance along the road and the signed
   * lateral offset (left positive), all taken from the segment, so they are continuous as the car moves.
   */
  nearest(x, z, hint = 0) {
    const pts = this.pts;
    let i = clamp(hint, 0, pts.length - 2);
    const d2 = (j) => { const p = pts[j]; const dx = x - p.x, dz = z - p.z; return dx * dx + dz * dz; };
    let best = d2(i);
    while (i + 1 < pts.length - 1 && d2(i + 1) < best) { i++; best = d2(i); }
    while (i - 1 >= 0 && d2(i - 1) < best) { i--; best = d2(i); }
    // the segment on the side of the point
    let j = i;
    if (i > 0) {
      const p = pts[i], a = pts[i - 1];
      if ((x - p.x) * (p.x - a.x) + (z - p.z) * (p.z - a.z) < 0) j = i - 1;
    }
    if (j >= pts.length - 1) j = pts.length - 2;
    const a = pts[j], b = pts[j + 1];
    const ex = b.x - a.x, ez = b.z - a.z, L2 = ex * ex + ez * ez || 1;
    const t = clamp(((x - a.x) * ex + (z - a.z) * ez) / L2, 0, 1);
    const L = Math.sqrt(L2);
    const u = ((x - a.x) * ez - (z - a.z) * ex) / L;      // left positive
    return { i, j, t, s: a.s + (b.s - a.s) * t, u, p: pts[i],
             h: lerpAngle(a.h, b.h, t), y: lerp(a.y, b.y, t), wl: lerp(a.wl, b.wl, t), wr: lerp(a.wr, b.wr, t) };
  }

  /** Sample indices i of segments (i, i+1) whose start lies in cells overlapping a box. */
  segmentsNear(x0, z0, x1, z1) {
    const out = [];
    const cx0 = Math.floor((x0 - 2) / CELL), cx1 = Math.floor((x1 + 2) / CELL);
    const cz0 = Math.floor((z0 - 2) / CELL), cz1 = Math.floor((z1 + 2) / CELL);
    const N = this.nFinal - 1;
    for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
      const c = this._cells.get(ckey(cx, cz)); if (!c) continue;
      for (const i of c) if (i < N) out.push(i);
    }
    return out;
  }

  /**
   * The nearest road to any world point, from the spatial grid, and the nearest point of a DIFFERENT stretch of
   * road (more than 90 m of road away from the first), so ground between two legs of a switchback answers to
   * both. `out` is reused to keep this allocation-free.
   */
  nearestRoad(x, z, maxD = 44, out = {}) {
    const pts = this.pts, N = this.nFinal - 1;
    const R = Math.ceil((maxD + 2) / CELL);
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    const C = this._cand; let nc = 0;
    const lim = maxD * maxD;
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      const c = this._cells.get(ckey(cx + dx, cz + dz)); if (!c) continue;
      for (let k = 0; k < c.length; k++) {
        const i = c[k]; if (i >= N) continue;
        const a = pts[i], b = pts[i + 1];
        const ex = b.x - a.x, ez = b.z - a.z, L2 = ex * ex + ez * ez || 1;
        let t = ((x - a.x) * ex + (z - a.z) * ez) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = a.x + ex * t - x, qz = a.z + ez * t - z;
        const d2 = qx * qx + qz * qz;
        if (d2 < lim && nc < 2048) { C.i[nc] = i; C.d[nc] = d2; C.t[nc] = t; nc++; }
      }
    }
    out.found = false; out.found2 = false;
    if (!nc) return out;
    let b1 = 0;
    for (let k = 1; k < nc; k++) if (C.d[k] < C.d[b1]) b1 = k;
    let b2 = -1;
    const i1 = C.i[b1];
    for (let k = 0; k < nc; k++) if (Math.abs(C.i[k] - i1) > 45 && (b2 < 0 || C.d[k] < C.d[b2])) b2 = k;
    this.fillRoad(out, '', C.i[b1], C.t[b1], x, z);
    out.found = true;
    if (b2 >= 0) { this.fillRoad(out, '2', C.i[b2], C.t[b2], x, z); out.found2 = true; }
    return out;
  }

  /** Everything about the road at segment i, parameter t, as seen from (x, z), written into out with a suffix. */
  fillRoad(out, sfx, i, t, x, z) {
    const a = this.pts[i], b = this.pts[i + 1];
    const ex = b.x - a.x, ez = b.z - a.z, L = Math.hypot(ex, ez) || 1;
    const qx = a.x + ex * t, qz = a.z + ez * t;
    out['i' + sfx] = i; out['t' + sfx] = t;
    out['d' + sfx] = Math.hypot(x - qx, z - qz);
    out['u' + sfx] = ((x - qx) * ez - (z - qz) * ex) / L;
    out['s' + sfx] = a.s + (b.s - a.s) * t;
    out['y' + sfx] = a.y + (b.y - a.y) * t;
    out['wl' + sfx] = a.wl + (b.wl - a.wl) * t;
    out['wr' + sfx] = a.wr + (b.wr - a.wr) * t;
    out['tunnel' + sfx] = a.tunnel && b.tunnel;
  }

  inTunnel(s) { for (const tn of this.tunnels) if (tn.fi < this.nFinalF && s >= tn.s0 && s <= tn.s1) return tn; return null; }
  nearTunnel(s, pad = 8) { for (const tn of this.tunnels) if (tn.fi < this.nFinalF && s >= tn.s0 - pad && s <= tn.s1 + pad) return tn; return null; }

  /** The terrace (if any) at distance s on a side. */
  padAt(s, side) {
    for (const p of this.pads) if (p.fi < this.nFinalF && p.side === side && s >= p.s0 - 4 && s <= p.s1 + 4) return p;
    return null;
  }

  /** The set piece (if any) whose footprint covers distance s on a side. */
  markerAt(s, side) {
    for (const m of this.markers) {
      if (m.kind === 'tunnel' || m.fi >= this.nFinalF) continue;
      const a = m.s - 18, b = m.s + (m.len ? m.len + 8 : 34);
      if (m.side === side && s >= a && s <= b) return m;
    }
    return null;
  }
}
