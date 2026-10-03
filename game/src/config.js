/**
 * SUNDRIFT — every tunable in one place.
 *
 * Colours here are the style lock (STYLE_LOCK.md at the repo root) and nothing else; the assets use the
 * same hex values, which is what makes a road, a tree and a car built by different agents read as one place.
 */
// The game was MINIDRIFT for two days (22 to 24 September) and kept its bests and settings under 'minidrift.': they are
// moved to 'sundrift.' once, before anything reads them (this module is the first every other one imports)
try {
  const old = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('minidrift.')) old.push(k); }
  for (const k of old) { localStorage.setItem('sundrift.' + k.slice(10), localStorage.getItem(k)); localStorage.removeItem(k); }
} catch {}

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

/**
 * The clock, which is the score: a run is one night, from the golden hour until dawn. It moves by distance (the road
 * driven) and by every banked drift, and the drifts are what make it fast: an autopilot that drifts only into the
 * tightest corners (work/dawn_time.mjs) gets to dawn in about eleven minutes on any course; a player who drifts on
 * purpose, banking 300 to 550 points a second, gets there in four to six, most of it by points. (Before: a hundred
 * points a minute and 3,000 m an hour, from 18:12. That autopilot's night was about the same, but a player who never
 * drifted needed 26 minutes and one who drifted well under three: NOTES.md, 3 October.)
 */
export const CLOCK = {
  start: 17.3,          // 17:18, the golden hour: the first drifts carry the sun down (the run ends at DAY, below)
  ptsPerMin: 240,       // banked drift points for a minute of the clock
  mPerHour: 1500,       // metres of road for an hour of the clock, at night and in the golden hour
  dayRate: 7,           // the flat middle of the day goes this much faster (07:12 to 16:36)
  // each course's own rates (by main.js's bestKey), measured so the same driver's night takes about as long on any:
  // the hard pass's hairpins hand out drifts, so its road gives a little less of an hour; the narrow back streets are
  // driven slower, so theirs gives more; and the city's broad square corners hand out drifts at about three times the
  // easy pass's rate, so a drift there is worth two thirds of the pass's minute
  courses: { easy: { mPerHour: 1500 }, hard: { mPerHour: 1750 }, 'city.easy': { mPerHour: 2250, ptsPerMin: 360 }, 'city.hard': { mPerHour: 950 } },
};

/**
 * The night's phases, each from the hour it begins: a caption on the TV as the clock enters one (main.js, hud.js). The
 * first time a run's clock enters DAY, at 06:00, the run is complete.
 */
export const PHASES = [
  { id: 'golden', name: 'GOLDEN HOUR', at: 17 },
  { id: 'blue', name: 'BLUE HOUR', at: 18.25 },
  { id: 'night', name: 'NIGHT', at: 19.25 },
  { id: 'dawn', name: 'DAWN', at: 4.75 },
  { id: 'day', name: 'DAY', at: 6 },
];
/** The phase the clock (0..24) is in: the last one begun by that hour, round the clock (at 03:00, the night of 19:15). */
export function phaseOf(h) {
  h = ((h % 24) + 24) % 24;
  let now = null, last = PHASES[0];
  for (const p of PHASES) {
    if (p.at <= h && (!now || p.at > now.at)) now = p;
    if (p.at > last.at) last = p;
  }
  return now || last;
}

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
