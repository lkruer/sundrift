/**
 * The results and the records, filled in from run records (records.js) in the units the settings ask for. The page lays
 * them out (index.html #results, #records) and pagetv.js draws them on the TV; this only writes the words and the
 * numbers, and only where they changed (every change is a redraw of the menu on the TV).
 */
import { fmt } from './records.js?v=202610040049';

const $ = (id) => document.getElementById(id);
function set(el, text, hi) {
  if (typeof el === 'string') el = $(el);
  if (!el) return;
  if (el.textContent !== text) el.textContent = text;
  if (hi !== undefined) el.classList.toggle('hi', !!hi);
}

// a run's numbers, each a label and how a run record says it
const N = {
  drifts: ['DRIFTS', (r) => String(r.drifts)],
  biggest: ['BIGGEST', (r) => fmt.int(r.biggest)],
  longest: ['LONGEST', (r) => fmt.secs(r.longest)],
  combo: ['BEST COMBO', (r) => (r.combo > 0 ? 'x' + r.combo : '—')],
  comboS: ['COMBO', (r) => (r.combo > 0 ? 'x' + r.combo : '—')],
  clips: ['CLIPS', (r) => String(r.clips)],
  crashes: ['CRASHES', (r) => String(r.crashes)],
  jturns: ['J-TURNS', (r) => String(r.jturns)],
  driftTime: ['DRIFT TIME', (r) => fmt.time(r.driftTime)],
  angle: ['MAX ANGLE', (r) => fmt.angle(r.angle)],
  top: ['TOP SPEED', (r, u) => fmt.speed(r.topKmh, u)],
  smashes: ['SMASHED', (r) => String(r.smashes)],
  distance: ['DISTANCE', (r, u) => fmt.dist(r.distance, u)],
};
const RESULTS = ['drifts', 'biggest', 'longest', 'combo', 'clips', 'crashes', 'jturns', 'driftTime', 'angle', 'top', 'smashes', 'distance'];
const CARD = ['drifts', 'biggest', 'comboS', 'distance', 'clips', 'top', 'longest', 'smashes'];
const FAST = ['drifts', 'biggest', 'comboS', 'distance'];

/** A grid's cells, made once: a label over a number for each key; returns the numbers' elements by key. */
function cells(grid, keys) {
  if (!grid) return {};
  if (!grid._cells) {
    grid._cells = {};
    for (const k of keys) {
      const d = document.createElement('div'), i = document.createElement('i'), b = document.createElement('b');
      i.textContent = N[k][0]; b.textContent = '—';
      d.append(i, b); grid.appendChild(d);
      grid._cells[k] = b;
    }
  }
  return grid._cells;
}

function fillGrid(grid, keys, run, units) {
  const c = cells(grid, keys);
  for (const k of keys) set(c[k], run ? N[k][1](run, units) : '—');
}

/**
 * The results: kind 'dawn' (the run reached 06:00: as it stood then, whenever it ended) or 'over' (quit before dawn);
 * flags { newBest, newFastest } against the records as they stood when the run began, prev ({ best, fastest }: a score,
 * seconds, 0 and Infinity for none); keep: KEEP DRIVING is offered. The score and the time the night took are the two
 * records, each shown over the one it was measured against: BEST 41,200, or WAS 41,200 when it is the new one.
 */
export function fillResults(run, { newBest = false, newFastest = false, keep = false, prev = {} } = {}, units = 'mph') {
  const dawn = !!run.dawn, title = $('r-title');
  set(title, dawn ? 'DAWN' : 'RUN OVER');
  if (title) title.classList.toggle('dawn', dawn);
  set('r-sub', dawn ? 'YOU DROVE THROUGH THE NIGHT' : `THE CLOCK REACHED ${fmt.clock(run.clock)}`);
  set('r-course', run.course || '');
  const best = prev.best > 0 ? prev.best : 0, fast = Number.isFinite(prev.fastest) ? prev.fastest : 0;
  set('r-scorel', newBest ? 'NEW BEST' : 'SCORE', newBest);
  set('r-score', fmt.int(run.score), newBest);
  set('r-bestrec', newBest ? (best ? 'WAS ' + fmt.int(best) : 'FIRST RECORD') : best ? 'BEST ' + fmt.int(best) : '', newBest);
  set('r-time', fmt.time(run.time));
  set('r-dawnl', newFastest ? 'FASTEST DAWN' : 'DAWN IN', newFastest);
  set('r-dawn', dawn ? fmt.time(run.dawnTime) : '—', newFastest);
  const dn = $('r-dawn');
  if (dn) dn.classList.toggle('none', !dawn);                     // (a run over before dawn: a dim dash)
  set('r-fastrec', newFastest ? (fast ? 'WAS ' + fmt.time(fast) : 'FIRST RECORD') : fast ? 'FASTEST ' + fmt.time(fast) : dawn ? '' : 'NO DAWN YET', newFastest);
  set('r-clock', fmt.clock(run.clock));
  fillGrid($('r-grid'), RESULTS, run, units);
  const k = $('r-keep');
  if (k) k.style.display = keep ? '' : 'none';
  const btns = document.querySelector('#results .r-btns');
  if (btns) btns.classList.toggle('three', !keep);
}

/** The records panel for a course: its best run, its fastest dawn, its last run; legacy, a best score kept without one. */
export function fillRecords(recs, legacy, course, units = 'mph') {
  set('rec-course', course || '');
  const card = (id, run, big, line, keys, empty, extra = '') => {
    const el = $('rc-' + id);
    if (el) { el.classList.toggle('empty', !!empty); el.classList.toggle('noshare', extra === 'noshare'); }
    set('rc-' + id + '-big', big);
    set('rc-' + id + '-line', line);
    fillGrid($('rc-' + id + '-grid'), keys, run, units);
  };
  const how = (r) => (r.dawn ? `DAWN IN ${fmt.time(r.dawnTime)}` : `RUN OVER AT ${fmt.clock(r.clock)}`) + ' · ' + fmt.day(r.at);
  // the best: a best score kept before the breakdown existed beats a breakdown's lower one, and says it has none
  const best = recs.best;
  if (legacy > 0 && (!best || legacy > best.score)) card('best', null, fmt.int(legacy), 'SET BEFORE RUNS WERE BROKEN DOWN', CARD, false, 'noshare');
  else if (best) card('best', best, fmt.int(best.score), how(best), CARD, false);
  else card('best', null, '—', 'NO RUN YET', CARD, true);
  const f = recs.fastest;
  if (f) card('fast', f, fmt.time(f.dawnTime), `SCORE ${fmt.int(f.score)} · ${fmt.day(f.at)}`, FAST, false);
  else card('fast', null, '—', 'NOT YET: DRIVE UNTIL DAWN', FAST, true);
  const l = recs.last;
  if (l) card('last', l, fmt.int(l.score), how(l), CARD, false);
  else card('last', null, '—', 'NO RUN YET', CARD, true);
}

/** A SHARE button says what happened for a moment (COPIED, SHARED, SAVED), then SHARE again. */
export function flashButton(btn, text, ms = 2200) {
  if (!btn) return;
  clearTimeout(btn._flash);
  btn.textContent = text;
  btn._flash = setTimeout(() => { btn.textContent = 'SHARE'; }, ms);
}
