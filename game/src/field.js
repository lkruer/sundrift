/**
 * The mountain: one smooth height field for the whole world.
 *
 * The road is laid on it (its elevation follows the field, grade-limited), and the terrain is this field
 * carved to the road, so every stretch of road, every tree and every lamp stands on the same ground. That is
 * the whole fix for roads that float and hillsides that clip through a hairpin: there is only one ground.
 *
 * base() is the shape the road follows: a mountainside rising along U at `k` per metre, with ridges and
 * gullies on three scales. detail() is roughness the road never sees; the terrain fades it in away from the
 * road so verges stay clean. Pure maths, no Three.js: the Node sim and the gate use it too.
 */
const TAU = Math.PI * 2;

function hash2(ix, iz, salt, seed) {
  let t = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(salt, 1442695041) + seed) | 0;
  t = Math.imul(t ^ (t >>> 13), 1274126177);
  t ^= t >>> 16;
  return (t >>> 0) / 4294967296 * 2 - 1;
}

export class Field {
  constructor(seed = 1) {
    this.seed = seed | 0;
    const a = ((hash2(7, 11, 3, this.seed) + 1) * 0.5) * TAU;
    this.U = [Math.cos(a), Math.sin(a)];      // uphill direction in (x, z)
    this.k = 0.10;                             // mean slope of the mountainside
  }

  /** Smooth value noise in [-1, 1]. */
  vnoise(x, z, salt) {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
    const sx = xf * xf * (3 - 2 * xf), sz = zf * zf * (3 - 2 * zf);
    const s = this.seed;
    const a = hash2(xi, zi, salt, s), b = hash2(xi + 1, zi, salt, s);
    const c = hash2(xi, zi + 1, salt, s), d = hash2(xi + 1, zi + 1, salt, s);
    const ab = a + (b - a) * sx, cd = c + (d - c) * sx;
    return ab + (cd - ab) * sz;
  }

  /** The large shape: what the road follows. */
  base(x, z) {
    const along = x * this.U[0] + z * this.U[1];
    return this.k * along
      + 30 * this.vnoise(x / 560, z / 560, 1)
      + 11 * this.vnoise(x / 190, z / 190, 2)
      + 3.5 * this.vnoise(x / 75, z / 75, 5);
  }

  /** Small-scale roughness, terrain only. */
  detail(x, z) {
    return 1.7 * this.vnoise(x / 36, z / 36, 3) + 0.45 * this.vnoise(x / 10.5, z / 10.5, 4);
  }

  /** Gradient of base(), by central difference. */
  grad(x, z, e = 4) {
    return [(this.base(x + e, z) - this.base(x - e, z)) / (2 * e), (this.base(x, z + e) - this.base(x, z - e)) / (2 * e)];
  }

  /** Unit uphill direction at a point (falls back to the global slope where the ground is flat). */
  uphill(x, z) {
    const [gx, gz] = this.grad(x, z, 10);
    const m = Math.hypot(gx, gz);
    if (m < 0.02) return this.U;
    return [gx / m, gz / m];
  }
}
