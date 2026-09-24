/**
 * MINIDRIFT — every tunable in one place.
 *
 * Colours here are the style lock (STYLE_LOCK.md at the repo root) and nothing else; the assets use the
 * same hex values, which is what makes a road, a tree and a car built by different agents read as one place.
 */
export const PAL = {
  asphalt: 0x3a3b40, laneWhite: 0xe8e4da, concrete: 0xa8a49c, galvanised: 0xb9bcc0, stone: 0x8a7f72,
  dryGrass: 0x9a8a3c, moss: 0x5f7a3a, cedar: 0x2f5a3a, bark: 0x5a3f2c,
  mapleRed: 0xc7351f, mapleOrange: 0xe07a1a, mapleGold: 0xe8b52a, vermilion: 0xc9402b, timber: 0x7a5a3a,
  roofTile: 0x4a4f5a, pearl: 0xf2f0ea, bronze: 0xb8843a, rubber: 0x1a1a1c, glass: 0x1c2a33,
  lampWarm: 0xffcf7a, tailRed: 0xd11c1c, chromeDark: 0x2b2d31,
  // spring: cherry blossom and fresh leaves
  sakuraPale: 0xf6d3de, sakuraPink: 0xf0a6bf, sakuraDeep: 0xdd6f98, sakuraWhite: 0xfbe9ef, cherryBark: 0x3b2a27,
  youngLeaf: 0x8cbf4f, leafDeep: 0x5f8f3e, springGrass: 0x7a9a3e, azalea: 0xd6408e, azaleaPink: 0xf08cc0,
  lanternRed: 0xd8342a, lanternGlow: 0xffb070,
};

/** Road geometry, metres. */
export const ROAD = {
  halfWidth: 4.4,        // asphalt half width (8.8 m: a generous two-lane pass)
  shoulder: 0.9,         // gravel shoulder each side before the rail or the cutting
  railOffset: 5.5,       // guardrail / cutting face distance from the centreline
  sliceStep: 2.0,        // metres between centreline samples
  chunkLen: 120,         // metres of road per streamed chunk
  ahead: 5,              // chunks kept ahead of the car
  behind: 2,             // chunks kept behind
  seed: 20260921,
};

/** Chase camera. */
export const CAM = {
  dist: 3.55, height: 1.28, lookAhead: 3.0, lookUp: 0.6,
  fov: 58, fovBoost: 10, fovSpeed: 6,
  followRate: 5.5, yawBlend: 0.62,   // 0 = behind the car's heading, 1 = behind the velocity vector
  roll: 0.045,
};

/** Scoring. */
export const SCORE = {
  minSpeed: 6.0,         // m/s before a slide counts
  minSlip: 0.15,         // rad, drift begins
  endSlip: 0.11,         // rad, drift ends below this for endGrace seconds
  endGrace: 0.8,
  chainGrace: 2.6,       // seconds between drifts that keep the chain alive
  rate: 2.2,             // points per second per (km/h * angle factor * multiplier)
  multStep: 0.5,         // multiplier gained per multEvery seconds of continuous drift
  multEvery: 1.4,
  multMax: 8,
  tiers: [0, 800, 2500, 6000],     // unbanked points where the tier label changes
  tierNames: ['', 'NICE', 'GREAT', 'INSANE'],
  boostPerPoint: 1 / 900,         // seconds of boost per banked point
  boostMax: 3.4,
  clipDist: 0.55,        // metres from the rail that count as a clip
  clipBonus: 250,
  crashSpeed: 8.0,       // m/s of lateral impact that drops the held drift
};

export const QUALITY = {
  high:  { pixelRatio: 1.5, shadow: true, smoke: 420, skid: 900, trees: 1.0, far: 900, petals: 800, rain: 2400 },
  phone: { pixelRatio: 1.5, shadow: true, smoke: 200, skid: 500, trees: 0.7, far: 700, petals: 450, rain: 1300 },
  low:   { pixelRatio: 1, shadow: false, smoke: 120, skid: 300, trees: 0.5, far: 600, petals: 250, rain: 700 },
};

export const MAX_DT = 1 / 20;

/**
 * The player has asked their system for less motion (macOS, iOS, Android and Windows all have the switch): what the
 * camera's kicks, the motion blur and the lightning's flicker should read to take themselves down. (The menus' own
 * pulsing is index.html's, in CSS.)
 */
export const REDUCED_MOTION = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The car as drawn: a little smaller than the physics body, so the road reads roomy. */
export const CAR_SCALE = 0.62;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
export const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

/** Deterministic PRNG so the pass is the same on every machine for a seed. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
