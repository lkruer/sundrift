/**
 * The ground under everything: the mountain field carved to the road.
 *
 * Every stretch of road near a point constrains the ground there. Inside a road's corridor and its verge the
 * ground is exactly the road's level. Beyond, a cut may rise no steeper than CUT and an embankment may fall no
 * steeper than FILL, so the ground is the natural mountain clamped between the lowest ceiling and the highest
 * floor that the nearby road sets. Two legs of a switchback each set theirs and the ground between them
 * satisfies both, so a hillside can never fold over a road or leave one floating. Where the two cannot both be
 * met (legs close together and far apart in height) the ground runs straight from one verge to the other: a
 * retaining face. Over a tunnel the floor is the tunnel's roof, and the hill the tunnel goes through is added to
 * the mountain itself, so the portals stand in a real hillside.
 *
 * Pure maths, no Three.js: the terrain tiles, the props, the camera and the tests all ask this one function.
 */
import { clamp, smoothstep } from './config.js?v=202609222216';
import { CELL, ckey } from './track.js?v=202609222216';

export const CUT = 1.25;          // steepest cut face: rise per metre (51 degrees)
export const FILL = 0.8;          // steepest embankment (39 degrees)
export const REACH = 46;          // metres: no road further away than this shapes the ground
const SOFT = 1.8;                 // metres over which the clamps are rounded
const UNDER = 0.15;               // how far below the road surface the ground sits under the ribbon
const VERGE_DROP = 0.06;          // and on the verge beyond the wall

function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
function smax(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; }

export class Ground {
  constructor(track) {
    this.track = track;
    this.field = track.field;
    this.tubeHalf = track.tubeHalf;
    this.tubeTop = track.tubeHalf * (1 + 2.4 / 4.05);   // the lining's crown above the road (walls scale with the portal)
    this.out = { h: 0, edge: 99, flat: false, tunnel: false, natural: 0 };
  }

  /** Ground height at (x, z), with the default (finest) verge. */
  height(x, z) { return this.sample(x, z, 2.2).h; }

  /**
   * The ground at (x, z). `verge` is how far beyond the corridor wall the ground stays level with the road:
   * coarse terrain tiles pass a wider one so their big triangles never reach up over the road's edge.
   * Writes into `out`: h, edge (metres beyond the nearest corridor wall, negative inside), flat (in a corridor
   * or verge), tunnel (over a tunnel), natural (the uncarved mountain there).
   */
  sample(x, z, verge = 2.2, out = this.out) {
    const t = this.track, f = this.field, pts = t.pts;
    const base = f.base(x, z);
    let N = base;
    if (t.tunnels.length) { const sp = this.spur(x, z); if (sp > N) N = sp; }
    out.natural = N;
    out.flat = false; out.tunnel = false; out.edge = 99;

    let U = Infinity, L = -Infinity, eU = 0, eL = 0;
    let exactD = Infinity, exactY = 0, tunnelD = Infinity, minE = Infinity;
    const R = REACH, R2 = R * R;
    const nSeg = t.nFinal - 1;
    const cells = t._cells;
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    const rc = Math.ceil((R + 2) / CELL);
    const pads = t.pads, nPads = pads.length;
    for (let dx = -rc; dx <= rc; dx++) for (let dz = -rc; dz <= rc; dz++) {
      const c = cells.get(ckey(cx + dx, cz + dz)); if (!c) continue;
      for (let k = 0; k < c.length; k++) {
        const i = c[k]; if (i >= nSeg) continue;
        const a = pts[i], b = pts[i + 1];
        const ex = b.x - a.x, ez = b.z - a.z, L2 = ex * ex + ez * ez;
        if (L2 < 1e-9) continue;
        let tt = ((x - a.x) * ex + (z - a.z) * ez) / L2;
        // a point off the start of a segment belongs to the one before (unless this is the very first)
        if (tt <= 0 && i > 0) continue;
        if (tt > 1) tt = 1; else if (tt < 0) tt = 0;
        const qx = a.x + ex * tt - x, qz = a.z + ez * tt - z;
        const d2 = qx * qx + qz * qz;
        if (d2 > R2) continue;
        const d = Math.sqrt(d2);
        const y = a.y + (b.y - a.y) * tt;
        const left = ((x - a.x) * ez - (z - a.z) * ex) >= 0;
        const w = left ? a.wl + (b.wl - a.wl) * tt : a.wr + (b.wr - a.wr) * tt;
        const edge = d - w;
        if (edge < out.edge) out.edge = edge;
        if (a.tunnel && b.tunnel) {
          // the tunnel: the ground is at least the roof over the lining, falling away beside it
          const foot = this.tubeHalf + 1.2;
          const roof = y + this.tubeTop + 1.8;
          const Lc = d <= foot ? roof : roof - (d - foot) * FILL;
          if (Lc > L) { L = Lc; eL = Math.max(0.01, d - foot); }
          if (d <= foot && d < tunnelD) tunnelD = d;
          continue;
        }
        let fe = w + verge, flatY = y - VERGE_DROP;
        if (nPads) {
          // a shrine terrace: the verge on its side widens into a level pad a little above the road
          const s = a.s + (b.s - a.s) * tt;
          for (let j = 0; j < nPads; j++) {
            const p = pads[j];
            if (p.fi >= t.nFinalF || s < p.s0 - 6 || s > p.s1 + 6 || (p.side > 0) !== left) continue;
            const kS = smoothstep(p.s0 - 6, p.s0, s) * (1 - smoothstep(p.s1, p.s1 + 6, s));
            fe = Math.max(fe, w + verge + (p.u1 - w) * kS);
            flatY += (p.h + VERGE_DROP) * smoothstep(p.u0 - 1.4, p.u0, d) * kS;
          }
        }
        if (d <= fe) {
          if (d < exactD) { exactD = d; exactY = d < w ? y - UNDER : flatY; }
          continue;
        }
        const e = d - fe;
        if (e < minE) minE = e;
        const Uc = flatY + e * CUT, Lc = flatY - e * FILL;
        if (Uc < U) { U = Uc; eU = e; }
        if (Lc > L) { L = Lc; eL = e; }
      }
    }

    let h;
    if (tunnelD < Infinity && tunnelD <= exactD) {
      h = Math.max(N + f.detail(x, z) * 0.5, L);
      out.tunnel = true;
    } else if (exactD < Infinity) {
      h = exactY; out.flat = true;
    } else {
      const Nd = N + f.detail(x, z) * smoothstep(1, 12, minE);
      if (L <= U) h = smax(L, smin(Nd, U, SOFT), SOFT);
      else h = (U * eL + L * eU) / (eU + eL);           // two roads that cannot both be met: a straight face
    }
    out.h = h;
    return out;
  }

  /** The hill a tunnel runs through: a flat-topped spur over the bore, steep at the portals. */
  spur(x, z) {
    const t = this.track;
    let best = -Infinity;
    for (const tn of t.tunnels) {
      if (tn.fi >= t.nFinalF) continue;
      const A = tn._axis || (tn._axis = this._axis(tn));
      const dx = x - A.mx, dz = z - A.mz;
      if (dx * dx + dz * dz > A.r2) continue;
      const along = dx * A.fx + dz * A.fz;
      const lat = Math.abs(dx * A.fz - dz * A.fx);
      const top = A.ym + along * A.grade + this.tubeTop + 3.2;
      const s = top - Math.max(0, Math.abs(along) - A.half - 1.0) * 1.2 - Math.max(0, lat - this.tubeHalf - 8) * 0.32;
      if (s > best) best = s;
    }
    return best;
  }

  _axis(tn) {
    const t = this.track;
    const a = t.sample(tn.s0), b = t.sample(tn.s1);
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const half = len / 2;
    return { mx: (a.x + b.x) / 2, mz: (a.z + b.z) / 2, fx: (b.x - a.x) / len, fz: (b.z - a.z) / len,
             ym: (a.y + b.y) / 2, grade: (b.y - a.y) / len, half, r2: (half + 90) * (half + 90) };
  }
}

export { clamp };
