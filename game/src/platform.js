/**
 * The games platform's hooks: what the game tells a host about itself, and the one thing it may hand over (sharing).
 *
 * Out of the box every hook does nothing, so the game runs the same on its own page. A platform that wants to know
 * (its SDK's loading bar, its gameplay events for ads or analytics, a run's result for a leaderboard, its own share
 * sheet) sets window.SUNDRIFT_PLATFORM before the game's script runs, with any of these as functions; the ones it
 * leaves out stay no-ops. Each call is guarded: a hook that throws is reported once in the console as a warning and
 * never costs the game a frame or a run.
 *
 *   init()                    once, as the game's script starts
 *   loadingProgress(f)        0..1 while the game loads
 *   loadingDone()             the title is up and START works
 *   gameplayStart()           a run is under way (started, resumed, carried on past dawn)
 *   gameplayStop()            it is not (paused, the tab hidden, the results up, back to the title)
 *   runComplete(stats)        a run reached dawn: its full breakdown (records.js, the run record)
 *   share(payload)            the player asked to share { title, text, url, run, card }: return true (or a promise of
 *                             true) if the platform shared it, and the game does nothing more; anything else and the
 *                             game shares it itself (share.js)
 */
const NAMES = ['init', 'loadingProgress', 'loadingDone', 'gameplayStart', 'gameplayStop', 'runComplete', 'share'];
const warned = new Set();

function host() {
  try { const h = typeof window !== 'undefined' && window.SUNDRIFT_PLATFORM; return h && typeof h === 'object' ? h : null; } catch { return null; }
}

function call(name, args) {
  const h = host(), f = h && h[name];
  if (typeof f !== 'function') return undefined;
  try {
    const r = f.apply(h, args);
    // (a promise that rejects is the host's business, not an unhandled rejection in the game's console)
    if (r && typeof r.then === 'function') return r.then((v) => v, (e) => { warn(name, e); return undefined; });
    return r;
  } catch (e) { warn(name, e); return undefined; }
}

function warn(name, e) {
  if (warned.has(name)) return;
  warned.add(name);
  try { console.warn('SUNDRIFT_PLATFORM.' + name + ' failed:', e); } catch {}
}

// (gameplayStart and gameplayStop are said once per change, however often the game passes through the same state)
let playing = false;

export const platform = {
  init() { call('init', []); },
  loadingProgress(f) { call('loadingProgress', [Math.max(0, Math.min(1, Number(f) || 0))]); },
  loadingDone() { call('loadingDone', []); },
  gameplayStart() { if (playing) return; playing = true; call('gameplayStart', []); },
  gameplayStop() { if (!playing) return; playing = false; call('gameplayStop', []); },
  runComplete(stats) { call('runComplete', [stats]); },
  /** True when the platform shared it (and the game should do nothing more). */
  async share(payload) { try { return (await call('share', [payload])) === true; } catch { return false; } },
  /** For the hooks' own names (a host can check what it may implement). */
  names: NAMES,
};
