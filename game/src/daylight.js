/**
 * The day, hour by hour: where the sun stands, and what each part of the day looks like. The sky's colours, the sun's
 * colour and strength, how much of the night is on (the lamps, the cool tint on the world), the sky's fill, the haze,
 * the clouds on the horizon, the sea of cloud in the valleys, the stars, the glow and the grade the cel pass lays over
 * the frame: one table on the CLOCK, not on the sun's height, so a dawn and a dusk at the same height can be different
 * hours. The morning is rose and lilac and clean; the evening is amber, coral and violet.
 *
 * The sun is slow round the horizon, the way it is in late spring at Japan's latitude: a golden hour of an hour and a
 * quarter, the sun down at a quarter past six, a blue hour to a quarter past seven; and the same again before sunrise.
 * (It used to fall from the horizon to full night in twelve minutes of the clock, so there was no blue hour at all.)
 *
 * The sky's stops are written as the colour each should come out ON THE SCREEN (sRGB, after the ACES curve at the
 * frame's exposure) and turned back into the linear radiance the rig wants once, here: a palette that can be read.
 */

/* ---------------------------------------------------------------- the sun */

// [hour, elevation in degrees]: a monotone curve through these (it never overshoots a key), flat at -12 all night
const SUN = [
  [4.45, -12], [5.0, -8.6], [5.55, -4.4], [6.05, 0.6], [6.75, 7.4], [7.6, 16], [8.6, 27], [10.3, 49], [12.0, 62],
  [13.7, 49], [14.8, 37], [16.4, 20.5], [17.3, 11.5], [17.85, 5.3], [18.2, 0.9], [18.62, -3.4], [19.05, -7.1],
  [19.55, -10.6], [20.1, -12],
];
// the sun's bearing (clockwise from north): it sets at `azSet` and rose 156 degrees round from there, then goes on round
// under the world by night, which nobody sees. The game sets each course's sunset bearing from its start line (see
// main.js), so the evening sun stands behind the title's camera and lights the car instead of blinding it.
const AZ_SWEEP = 156, H_RISE = 6.05, H_SET = 18.2;

const _sunTan = monotoneTangents(SUN);

/** Where the sun is at an hour: { el (degrees), az (degrees) }, for a sunset bearing of azSet. */
export function sunAt(hour, azSet = 258) {
  const AZ_SET = azSet, AZ_RISE = azSet - AZ_SWEEP;
  const h = ((hour % 24) + 24) % 24;
  let el;
  if (h <= SUN[0][0] || h >= SUN[SUN.length - 1][0]) el = -12;
  else el = hermite(SUN, _sunTan, h);
  let az;
  if (h >= H_RISE && h <= H_SET) az = AZ_RISE + (h - H_RISE) * (AZ_SET - AZ_RISE) / (H_SET - H_RISE);
  else {
    const since = (h - H_SET + 24) % 24, night = 24 - (H_SET - H_RISE);
    az = AZ_SET + since * (360 - AZ_SWEEP) / night;
  }
  return { el, az: ((az % 360) + 360) % 360 };
}

/* ------------------------------------------------------- the colour maths */

const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
// three r169's ACESFilmicToneMapping, run backwards: its output matrix, the RRT+ODT fit, its input matrix, the exposure
const ACES_IN = [[0.59719, 0.35458, 0.04823], [0.07600, 0.90834, 0.01566], [0.02840, 0.13383, 0.83777]];
const ACES_OUT = [[1.60475, -0.53108, -0.07367], [-0.10208, 1.10813, -0.00605], [-0.00327, -0.07276, 1.07602]];
const IN_INV = inv3(ACES_IN), OUT_INV = inv3(ACES_OUT);
export const EXPOSURE = 1.05;

/** A screen colour (0xRRGGBB) as the linear radiance that comes out as it through the frame's ACES curve. */
export function screenToRadiance(hex, exposure = EXPOSURE) {
  const d = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => srgbToLin(v / 255));
  const w = mul3(OUT_INV, d).map((y) => Math.min(1.0, Math.max(0, y)));
  const v = w.map((y) => {
    const A = 1 - 0.983729 * y, B = 0.0245786 - 0.432951 * y, C = 0.000090537 + 0.238081 * y;
    return A <= 1e-6 ? 60 : (-B + Math.sqrt(B * B + 4 * A * C)) / (2 * A);
  });
  return mul3(IN_INV, v).map((x) => Math.max(0, x * 0.6 / exposure));
}
/** A light's colour (0xRRGGBB, sRGB) in linear. */
const hexLin = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => srgbToLin(v / 255));

/* ------------------------------------------------------------- the looks */

/**
 * The keys, in hour order round the clock. Sky stops are screen colours (or linear radiance, as arrays: the night's,
 * kept exactly as it was tuned); `sunGlow` is linear, a light. `sun` and `sunI` are the key light; `night` how much of
 * the night is on (lamps, headlights, the cool tint); `fill` the sky's fill light and `fillCol` its colour (the colour
 * of the shade: blue against a gold sun, violet at sunset; the sky's own stops are far too saturated to be a light);
 * `aer` the haze's density (times
 * the base); `bloom` the glow's strength; `grade` the cel pass's: shade tint, light tint, saturation, contrast;
 * `cloud` the cumulus on the horizon (screen colours: their lit side, their shade, the silver at their edge, and how
 * much of the horizon they cover); `deck` the high cloud overhead (how much it shows); `mist` the sea of cloud in the
 * valleys (dawn's, mostly); `stars`.
 */
const NIGHT = {
  sky: {
    horizon: [0.070, 0.062, 0.075], low: [0.045, 0.046, 0.064], mid: [0.026, 0.031, 0.052], high: [0.018, 0.024, 0.046], zenith: [0.012, 0.018, 0.038],
    haze: [0.090, 0.072, 0.078], below: [0.040, 0.038, 0.045],
  },
  sunGlow: [0.30, 0.18, 0.12], sun: 0xffa060, sunI: 0.35, night: 1, fill: 0.26, aer: 1.0, bloom: 0.34,
  fillCol: [0.7, 0.97, 2.03],
  grade: { lo: [0.93, 0.96, 1.10], hi: [1.04, 1.0, 0.97], sat: 1.08, con: 1.04 },
  cloud: { lit: 0x262c44, shade: 0x141828, rim: 0x46507a, cover: 0.42, k: 0.75 }, deck: 1, mist: 1, stars: 1,
};
const KEYS = [
  { h: 4.45, ...NIGHT },
  { h: 5.0, name: 'first light',
    fillCol: [0.72, 0.92, 1.9],
    sky: { haze: 0x6a5880, horizon: 0x544c80, low: 0x384276, mid: 0x263366, high: 0x1e2a5a, zenith: 0x18234e, below: 0x1e1a2a },
    sunGlow: [0.42, 0.24, 0.32], sun: 0xff9a80, sunI: 0, night: 0.94, fill: 0.3, aer: 1.1, bloom: 0.32,
    grade: { lo: [0.92, 0.95, 1.12], hi: [1.04, 0.98, 1.03], sat: 1.06, con: 1.03 },
    cloud: { lit: 0x4a4268, shade: 0x262848, rim: 0x8a6a96, cover: 0.42, k: 0.8 }, deck: 1, mist: 1, stars: 0.55 },
  { h: 5.55, name: 'dawn',
    fillCol: [1.0, 0.86, 1.6],
    sky: { haze: 0xe49aa6, horizon: 0xb48ab6, low: 0x7a7cb6, mid: 0x4c64a8, high: 0x3c5698, zenith: 0x2f4888, below: 0x3c3044 },
    sunGlow: [0.95, 0.5, 0.52], sun: 0xff9a80, sunI: 0, night: 0.72, fill: 0.42, aer: 1.25, bloom: 0.32,
    grade: { lo: [0.94, 0.94, 1.12], hi: [1.07, 0.98, 1.02], sat: 1.08, con: 1.03 },
    cloud: { lit: 0xd492ac, shade: 0x5c5a8e, rim: 0xffb4bc, cover: 0.45, k: 0.95 }, deck: 0.8, mist: 1, stars: 0 },
  { h: 6.05, name: 'sunrise',
    fillCol: [1.05, 0.9, 1.35],
    sky: { haze: 0xffb894, horizon: 0xf4a8a2, low: 0xc6a8ca, mid: 0x8098d2, high: 0x6686c8, zenith: 0x5276bc, below: 0x6a5058 },
    sunGlow: [1.0, 0.6, 0.45], sun: 0xff9c72, sunI: 9.5, night: 0.3, fill: 0.56, aer: 1.3, bloom: 0.3,
    grade: { lo: [0.95, 0.94, 1.10], hi: [1.08, 0.99, 0.97], sat: 1.1, con: 1.04 },
    cloud: { lit: 0xffc2a8, shade: 0x9a92ba, rim: 0xffe2d2, cover: 0.5, k: 1 }, deck: 0.7, mist: 0.9, stars: 0 },
  { h: 6.75, name: 'morning gold',
    fillCol: [0.86, 0.98, 1.3],
    sky: { haze: 0xffe0c0, horizon: 0xf6dccc, low: 0xc4d4ea, mid: 0x86b0e2, high: 0x6a9ad8, zenith: 0x5688d0, below: 0x8a7a70 },
    sunGlow: [1.0, 0.76, 0.52], sun: 0xffc892, sunI: 13, night: 0, fill: 0.7, aer: 1.1, bloom: 0.24,
    grade: { lo: [0.95, 0.98, 1.08], hi: [1.07, 1.02, 0.96], sat: 1.1, con: 1.05 },
    cloud: { lit: 0xfff2e4, shade: 0xb6bcd8, rim: 0xfffaf0, cover: 0.55, k: 1 }, deck: 0.7, mist: 0.6, stars: 0 },
  { h: 8.6, name: 'morning',
    fillCol: [0.82, 1.0, 1.32],
    sky: { haze: 0xe0eaf4, horizon: 0xcae2f6, low: 0x94c4f0, mid: 0x62a2e8, high: 0x4c90e2, zenith: 0x3c80d8, below: 0x7c828a },
    sunGlow: [1.0, 0.92, 0.8], sun: 0xfff0dc, sunI: 8.6, night: 0, fill: 0.8, aer: 0.8, bloom: 0.18,
    grade: { lo: [0.96, 1.0, 1.07], hi: [1.03, 1.01, 0.98], sat: 1.1, con: 1.05 },
    cloud: { lit: 0xffffff, shade: 0xb2c4e2, rim: 0xffffff, cover: 0.6, k: 1 }, deck: 0.8, mist: 0.15, stars: 0 },
  { h: 12.0, name: 'noon',
    fillCol: [0.8, 1.0, 1.34],
    sky: { haze: 0xd4e8f8, horizon: 0xb8dcf8, low: 0x80bcf2, mid: 0x4e98ec, high: 0x3c86e4, zenith: 0x2e74da, below: 0x7a8590 },
    sunGlow: [1.0, 0.95, 0.88], sun: 0xfff6ec, sunI: 6.6, night: 0, fill: 0.84, aer: 0.68, bloom: 0.16,
    grade: { lo: [0.96, 1.0, 1.07], hi: [1.02, 1.01, 0.99], sat: 1.12, con: 1.06 },
    cloud: { lit: 0xffffff, shade: 0xaec2e2, rim: 0xffffff, cover: 0.62, k: 1 }, deck: 0.85, mist: 0, stars: 0 },
  { h: 14.8, name: 'afternoon',
    fillCol: [0.82, 1.0, 1.3],
    sky: { haze: 0xdeeaf2, horizon: 0xc4e0f4, low: 0x8ec2f0, mid: 0x5a9ee8, high: 0x468ce2, zenith: 0x357ad8, below: 0x7a8088 },
    sunGlow: [1.0, 0.92, 0.8], sun: 0xffeed2, sunI: 7.8, night: 0, fill: 0.82, aer: 0.72, bloom: 0.18,
    grade: { lo: [0.96, 1.0, 1.07], hi: [1.03, 1.01, 0.97], sat: 1.12, con: 1.06 },
    cloud: { lit: 0xffffff, shade: 0xb2c2de, rim: 0xffffff, cover: 0.6, k: 1 }, deck: 0.85, mist: 0, stars: 0 },
  { h: 16.4, name: 'late afternoon',
    fillCol: [0.84, 0.99, 1.3],
    sky: { haze: 0xf6e2c2, horizon: 0xe6e2da, low: 0xb0cfec, mid: 0x76a8e4, high: 0x5c94de, zenith: 0x4682d4, below: 0x807868 },
    sunGlow: [1.0, 0.82, 0.56], sun: 0xffdcae, sunI: 10.5, night: 0, fill: 0.78, aer: 0.85, bloom: 0.2,
    grade: { lo: [0.95, 0.99, 1.07], hi: [1.06, 1.02, 0.95], sat: 1.12, con: 1.06 },
    cloud: { lit: 0xfff6e8, shade: 0xb6c0d8, rim: 0xfffcf2, cover: 0.58, k: 1 }, deck: 0.85, mist: 0, stars: 0 },
  { h: 17.3, name: 'golden hour',
    fillCol: [0.8, 0.95, 1.48],
    sky: { haze: 0xffd08c, horizon: 0xffd2a2, low: 0xf0d0b6, mid: 0x8eb0dc, high: 0x6e98d4, zenith: 0x5a86c8, below: 0x8a7058 },
    sunGlow: [1.0, 0.66, 0.32], sun: 0xffc074, sunI: 15, night: 0, fill: 0.72, aer: 1.12, bloom: 0.28,
    grade: { lo: [0.92, 0.98, 1.09], hi: [1.09, 1.02, 0.9], sat: 1.15, con: 1.07 },
    cloud: { lit: 0xffe6c0, shade: 0xaeaccc, rim: 0xfff4d8, cover: 0.55, k: 1 }, deck: 0.9, mist: 0, stars: 0 },
  { h: 17.85, name: 'late gold',
    fillCol: [0.88, 0.92, 1.45],
    sky: { haze: 0xffae62, horizon: 0xffaa74, low: 0xf0b09a, mid: 0x98a4cc, high: 0x6f88c2, zenith: 0x5574b4, below: 0x7a5a48 },
    sunGlow: [1.0, 0.52, 0.22], sun: 0xffa45a, sunI: 14, night: 0, fill: 0.68, aer: 1.2, bloom: 0.3,
    grade: { lo: [0.92, 0.96, 1.09], hi: [1.1, 1.01, 0.88], sat: 1.16, con: 1.07 },
    cloud: { lit: 0xffc490, shade: 0xa496ba, rim: 0xffeac0, cover: 0.52, k: 1 }, deck: 0.9, mist: 0, stars: 0 },
  { h: 18.2, name: 'sunset',
    fillCol: [0.98, 0.88, 1.42],
    sky: { haze: 0xffa062, horizon: 0xff9a6c, low: 0xe8949a, mid: 0x8c80bc, high: 0x5c68aa, zenith: 0x44549c, below: 0x6a4048 },
    sunGlow: [1.0, 0.45, 0.18], sun: 0xff8444, sunI: 11, night: 0.16, fill: 0.66, aer: 1.2, bloom: 0.32,
    grade: { lo: [0.96, 0.94, 1.05], hi: [1.1, 1.0, 0.9], sat: 1.14, con: 1.06 },
    cloud: { lit: 0xff9a6a, shade: 0x86689a, rim: 0xffcc98, cover: 0.5, k: 1 }, deck: 0.9, mist: 0.1, stars: 0 },
  { h: 18.62, name: 'blue hour',
    fillCol: [0.72, 0.88, 1.95],
    sky: { haze: 0xcc8a8e, horizon: 0x9a7aa0, low: 0x5a62a2, mid: 0x33458e, high: 0x263a80, zenith: 0x1e3072, below: 0x2c2436 },
    sunGlow: [0.95, 0.42, 0.3], sun: 0xff8060, sunI: 0, night: 0.55, fill: 0.46, aer: 1.08, bloom: 0.34,
    grade: { lo: [0.92, 0.94, 1.14], hi: [1.1, 0.98, 0.96], sat: 1.12, con: 1.05 },
    cloud: { lit: 0x9a6a8e, shade: 0x3a3c6e, rim: 0xff9c8c, cover: 0.48, k: 1 }, deck: 0.95, mist: 0.4, stars: 0 },
  { h: 19.05, name: 'late blue',
    fillCol: [0.69, 0.92, 2.05],
    sky: { haze: 0x5c4c76, horizon: 0x4a4878, low: 0x2e3a72, mid: 0x1f2c62, high: 0x182558, zenith: 0x131e4c, below: 0x1a1828 },
    sunGlow: [0.5, 0.22, 0.28], sun: 0xff8060, sunI: 0, night: 0.86, fill: 0.33, aer: 1.02, bloom: 0.34,
    grade: { lo: [0.9, 0.95, 1.14], hi: [1.06, 0.98, 1.0], sat: 1.1, con: 1.04 },
    cloud: { lit: 0x3c3c66, shade: 0x22264a, rim: 0x8c5c7a, cover: 0.45, k: 0.9 }, deck: 1, mist: 0.8, stars: 0.35 },
  { h: 19.6, ...NIGHT },
];

const mix = (a, b, t) => a + (b - a) * t;
const unitLum = (c) => { const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; return c.map((v) => v / l); };
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

// (a colour's radiance held under 1.8 in its brightest channel, its hue kept: a white cloud is all but white on the screen
// at 1.8, and pure white turned back through the curve is 14.7, which bloomed every cloud near the sun into a white blob)
const cap = (c, m = 1.8) => { const k = Math.max(c[0], c[1], c[2]); return k > m ? c.map((v) => v * m / k) : c; };
const STOPS = ['horizon', 'low', 'mid', 'high', 'zenith', 'haze', 'below'];
// every key's colours in linear once, so a frame only mixes numbers
const LIN = KEYS.map((k) => {
  const sky = {};
  for (const s of STOPS) sky[s] = Array.isArray(k.sky[s]) ? k.sky[s] : screenToRadiance(k.sky[s]);
  const cl = k.cloud;
  return {
    ...k, sky, sunLin: hexLin(k.sun), fillCol: unitLum(k.fillCol),
    cloudLin: { lit: cap(screenToRadiance(cl.lit)), shade: cap(screenToRadiance(cl.shade)), rim: cap(screenToRadiance(cl.rim)), cover: cl.cover, k: cl.k },
  };
});

/**
 * The look at an hour: the two keys either side, mixed with an ease (each key holds a little, so golden hour reads as
 * golden hour and not as the middle of a fade). Returns the rig's atmosphere row (`atm`) and the rest.
 */
export function lookAt(hour) {
  let h = ((hour % 24) + 24) % 24;
  const first = LIN[0].h, last = LIN[LIN.length - 1].h;
  let a, b, t;
  if (h < first || h >= last) {
    // the night: the last key round to the first (the same look, so it simply holds)
    a = LIN[LIN.length - 1]; b = LIN[0];
    const span = first + 24 - last;
    t = ((h - last + 24) % 24) / span;
  } else {
    let i = 0;
    while (i < LIN.length - 2 && h >= LIN[i + 1].h) i++;
    a = LIN[i]; b = LIN[i + 1];
    t = (h - a.h) / (b.h - a.h);
  }
  t = Math.min(1, Math.max(0, t));
  const e = t * t * (3 - 2 * t);
  const atm = {};
  for (const s of STOPS) atm[s] = mix3(a.sky[s], b.sky[s], e);
  atm.sunGlow = mix3(a.sunGlow, b.sunGlow, e);
  atm.sun = mix3(a.sunLin, b.sunLin, e);
  atm.intensity = mix(a.sunI, b.sunI, e);
  atm.exposure = EXPOSURE;
  const g = (k) => mix(a.grade[k], b.grade[k], e);
  return {
    atm,
    name: e < 0.5 ? a.name || 'night' : b.name || 'night',
    night: mix(a.night, b.night, e),
    fill: mix(a.fill, b.fill, e),
    fillCol: mix3(a.fillCol, b.fillCol, e),
    aer: mix(a.aer, b.aer, e),
    bloom: mix(a.bloom, b.bloom, e),
    grade: { lo: mix3(a.grade.lo, b.grade.lo, e), hi: mix3(a.grade.hi, b.grade.hi, e), sat: g('sat'), con: g('con') },
    cloud: {
      lit: mix3(a.cloudLin.lit, b.cloudLin.lit, e), shade: mix3(a.cloudLin.shade, b.cloudLin.shade, e), rim: mix3(a.cloudLin.rim, b.cloudLin.rim, e),
      cover: mix(a.cloudLin.cover, b.cloudLin.cover, e), k: mix(a.cloudLin.k, b.cloudLin.k, e),
    },
    deck: mix(a.deck, b.deck, e),
    mist: mix(a.mist, b.mist, e),
    stars: mix(a.stars, b.stars, e),
  };
}

/* ---------------------------------------------------------------- helpers */

function inv3(m) {
  const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ];
}
function mul3(m, v) { return [0, 1, 2].map((r) => m[r][0] * v[0] + m[r][1] * v[1] + m[r][2] * v[2]); }

/** Fritsch-Carlson tangents: a cubic through the keys that never overshoots one (the sun never bobs). */
function monotoneTangents(P) {
  const n = P.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((P[i + 1][1] - P[i][1]) / (P[i + 1][0] - P[i][0]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return m;
}
function hermite(P, m, x) {
  let i = 0;
  while (i < P.length - 2 && x > P[i + 1][0]) i++;
  const [x0, y0] = P[i], [x1, y1] = P[i + 1], hh = x1 - x0, t = (x - x0) / hh;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * hh * m[i] + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * hh * m[i + 1];
}
