/**
 * The records a course keeps: the best run by score (its whole breakdown), the fastest dawn (the real time a run took
 * to drive the night through, with its score), and the last run. One course is a map and a difficulty, the key the best
 * score has always been kept under (main.js bestKey: 'easy', 'hard', 'city.easy', 'city.hard').
 *
 * Kept in localStorage under sundrift.records.<key> as one JSON object with a version; anything that does not read
 * back as this version (a private window that refuses storage, a hand-edited value, a future version's) is no record
 * at all rather than an error. The best score alone is still kept where it always was (sundrift.best.<key>, main.js),
 * so a player's best from before the breakdown existed is not lost: the records panel shows it without one.
 *
 * A run record is plain numbers and words, so it keeps as it is and goes to a platform's runComplete as it is:
 *   v, id (when the run started, ms), at (when it was recorded, ms), map, diff, course (the course's name),
 *   score, drifts, biggest (points in one drift), longest (s), combo (the longest chain), clips, crashes, jturns,
 *   driftTime (s sliding in banked drifts), angle (the biggest angle held in a banked drift, degrees), topKmh,
 *   smashes, distance (m), clock (the hour the clock reached, 0..24), hours (clock hours driven), time (real seconds of
 *   play, paused time left out), dawn (it reached 06:00), dawnTime (real seconds of play to get there).
 */
export const RECORDS_V = 1;
const PREFIX = 'sundrift.records.';

/** The records kept for a course: { best, fastest, last }, each a run record or null. */
export function loadRecords(key) {
  const none = { best: null, fastest: null, last: null };
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return none;
    const r = JSON.parse(raw);
    if (!r || typeof r !== 'object' || r.v !== RECORDS_V) return none;
    const ok = (x) => (x && typeof x === 'object' && Number.isFinite(x.score) ? x : null);
    return { best: ok(r.best), fastest: ok(r.fastest) && r.fastest.dawn ? r.fastest : null, last: ok(r.last) };
  } catch { return none; }
}

/**
 * A run recorded: it is the last run; the best if it scored more than the best (or is the best, recorded again as it
 * went on); the fastest dawn if it reached dawn sooner than any run before it. dawnNow: the run is being recorded at
 * its dawn (the moment the clock got there, and again as it completes a moment later), so a fastest dawn that is this
 * run is brought up to date; recorded later still (carried on into the day, then ended), it keeps the fastest dawn as
 * it stood at dawn. Returns the records as they now stand.
 */
export function saveRun(key, run, { dawnNow = false } = {}) {
  const r = loadRecords(key);
  r.last = run;
  if (!r.best || run.score > r.best.score || (r.best.id === run.id && run.score >= r.best.score)) r.best = run;
  if (run.dawn && (!r.fastest || run.dawnTime < r.fastest.dawnTime || (dawnNow && r.fastest.id === run.id))) r.fastest = run;
  try { localStorage.setItem(PREFIX + key, JSON.stringify({ v: RECORDS_V, ...r })); } catch {}
  return r;
}

// ---------------------------------------------------------------- the numbers, as the screens and the card say them

export const fmt = {
  int: (n) => Math.round(Number(n) || 0).toLocaleString('en-US'),
  /** Real time: m:ss, or h:mm:ss past the hour. */
  time(s) {
    s = Math.max(0, Math.round(Number(s) || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  },
  /** The game's clock: HH:MM. */
  clock(h) {
    h = ((Number(h) || 0) % 24 + 24) % 24;
    const mm = Math.floor(h * 60 + 1e-6);
    return String(Math.floor(mm / 60) % 24).padStart(2, '0') + ':' + String(mm % 60).padStart(2, '0');
  },
  dist: (m, units) => units === 'kmh' ? ((Number(m) || 0) / 1000).toFixed(1) + ' KM' : ((Number(m) || 0) / 1609.344).toFixed(1) + ' MI',
  speed: (kmh, units) => units === 'kmh' ? Math.round(Number(kmh) || 0) + ' KM/H' : Math.round((Number(kmh) || 0) / 1.609344) + ' MPH',
  secs: (s) => (Number(s) || 0).toFixed(1) + ' S',
  angle: (d) => Math.round(Number(d) || 0) + '°',
  /** A date as a short day and month (3 OCT). */
  day(ms) {
    try { const d = new Date(ms); return d.getDate() + ' ' + ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getMonth()]; } catch { return ''; }
  },
};
