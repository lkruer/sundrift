/**
 * Sharing a run: a few lines of text and a picture of it, the share card.
 *
 * The card is drawn here on a canvas, 1200 x 630 (the size a link preview and a feed post both take), in the game's own
 * look and the page's own fonts, nothing fetched: the sky as it was at the hour the run reached (the golden hour's
 * amber, the blue hour, the night with its stars and the moon, the pink of dawn, the day), the pass's ridges or the
 * city's skyline against it, the logo in its sunset gradient, the course, the score, the clock in the dash's amber
 * seven-segment digits, and a row of the run's numbers in the pause card's boxes, under the tube's scanlines.
 *
 * The share itself goes to the platform first (platform.js: a host may share it its own way), then to the system's
 * share sheet (navigator.share, with the card as a file where the browser can take one), and where there is neither, the
 * text goes to the clipboard and the card is saved as a download. The card is drawn ahead (prepareCard, as a screen with
 * a SHARE button opens) so the share sheet is asked for inside the tap that asked for it: a browser lets a page open it
 * only then, and an await on a fresh 1200 x 630 PNG could outlast that.
 */
import { fmt } from './records.js?v=202610040117';

export const SHARE_URL = 'https://lkruer.github.io/sundrift/game/';
const W = 1200, H = 630;
const RACE = '"Racing Sans One", Rajdhani, sans-serif', MONO = '"Share Tech Mono", ui-monospace, Consolas, monospace';
const JP = '"Dela Gothic One", "Hiragino Sans", "Yu Gothic", sans-serif';

/** What a run says in words: the game, the course, the score, dawn (or how far the night got), three numbers. */
export function shareText(run, units = 'mph') {
  const head = `SUNDRIFT · ${run.course}`;
  const how = run.dawn ? `reached dawn in ${fmt.time(run.dawnTime)}` : `drove the night to ${fmt.clock(run.clock)}`;
  const dist = fmt.dist(run.distance, units).toLowerCase();
  const nums = run.drifts > 0 ? `${run.drifts} drift${run.drifts === 1 ? '' : 's'} · biggest ${fmt.int(run.biggest)}${run.combo > 1 ? ' · combo x' + run.combo : ''} · ${dist}` : `${dist} driven`;
  return `${head}\n${fmt.int(run.score)} points, ${how}\n${nums}`;
}

// ---------------------------------------------------------------- the sky at an hour

// the sky's three bands (the top, the middle, the horizon) at hours of the clock, between which it is blended
const SKY = [
  [0, '#05071a', '#0d1436', '#232a55'], [4.75, '#0b1030', '#2c2a63', '#7a4a7a'], [5.5, '#1b2457', '#7a5a9a', '#ff9a7a'],
  [6, '#2a3a78', '#c97a8a', '#ffc58a'], [7, '#3d6fc0', '#8ab4e0', '#f6e2c0'], [12, '#3a78d0', '#7fb2ea', '#dcecf6'],
  [16.5, '#3b62b0', '#9ab0d8', '#f6d8a8'], [17.3, '#3a3f8f', '#d9785a', '#ffc070'], [18, '#262a6a', '#b0587a', '#ff9a5a'],
  [18.25, '#141a4a', '#3a3f8f', '#c77a8a'], [19.25, '#070a1e', '#121a40', '#2a2f5f'], [24, '#05071a', '#0d1436', '#232a55'],
];
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixHex = (a, b, t) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; };
function skyAt(h) {
  h = ((h % 24) + 24) % 24;
  for (let i = 0; i < SKY.length - 1; i++) {
    const [h0, ...a] = SKY[i], [h1, ...b] = SKY[i + 1];
    if (h >= h0 && h <= h1) { const t = (h - h0) / Math.max(1e-6, h1 - h0); return a.map((c, k) => mixHex(c, b[k], t)); }
  }
  return SKY[0].slice(1);
}
/** How much night there is at an hour (0 by day, 1 deep in it), as the stars and the windows need. */
const nightAt = (h) => { h = ((h % 24) + 24) % 24; const s = (a, b, x) => Math.max(0, Math.min(1, (x - a) / (b - a))); return h >= 12 ? s(18, 19.4, h) : 1 - s(4.8, 6.1, h); };

/** A small seeded random, so a course's ridge or skyline is the same on every card. */
function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// the dash's seven segments (hud.js has the same cell: 12 x 22, bars 2.3 thick)
const SEGS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
function segPoly(s) {
  const w = 12, h = 22, t = 2.3, g = 0.45, L = t / 2, R = w - t / 2, T = t / 2, M = h / 2, B = h - t / 2;
  const Hb = (x0, x1, y) => [[x0, y], [x0 + t / 2, y - t / 2], [x1 - t / 2, y - t / 2], [x1, y], [x1 - t / 2, y + t / 2], [x0 + t / 2, y + t / 2]];
  const V = (x, y0, y1) => [[x, y0], [x + t / 2, y0 + t / 2], [x + t / 2, y1 - t / 2], [x, y1], [x - t / 2, y1 - t / 2], [x - t / 2, y0 + t / 2]];
  return { a: Hb(L + g, R - g, T), g: Hb(L + g, R - g, M), d: Hb(L + g, R - g, B), f: V(L, T + g, M - g), b: V(R, T + g, M - g), e: V(L, M + g, B - g), c: V(R, M + g, B - g) }[s];
}
function drawSeg(c, str, x, y, h, color) {
  const q = h / 22, pitch = 15 * q, skew = Math.tan(7 * Math.PI / 180);
  let ox = x;
  for (const ch of str) {
    if (ch === ':') { c.fillStyle = color; c.fillRect(ox + 1 * q, y + 6.5 * q, 2.4 * q, 2.4 * q); c.fillRect(ox - 0.2 * q, y + 15 * q, 2.4 * q, 2.4 * q); ox += 5 * q; continue; }
    const on = SEGS[ch] || '';
    for (const s of 'abcdefg') {
      c.fillStyle = color; c.globalAlpha = on.includes(s) ? 1 : 0.1;
      c.beginPath();
      segPoly(s).forEach(([px, py], i) => { const X = ox + px * q + (h - py * q) * skew * 0.5, Y = y + py * q; if (i) c.lineTo(X, Y); else c.moveTo(X, Y); });
      c.closePath(); c.fill();
    }
    c.globalAlpha = 1;
    ox += pitch;
  }
  return ox - x;
}

/** The pass's ridges, three of them stepping back into the haze; or NEO TOKYO's skyline, its windows lit at night. */
function drawLand(c, city, sky, night) {
  const r = rnd(city ? 7 : 3);
  if (!city) {
    const layers = [[0.6, 0.55, 0.52], [0.72, 0.35, 0.3], [0.84, 0.14, 0.12]];
    layers.forEach(([base, amp, k], li) => {
      c.beginPath(); c.moveTo(0, H);
      let y = H * base;
      for (let x = 0; x <= W; x += 12) {
        y += (r() - 0.5) * 22 * amp * 2;
        const pull = H * base - 70 * amp * Math.sin(x / W * Math.PI * (1.4 + li * 0.6) + li) - y;
        y += pull * 0.08;
        c.lineTo(x, y);
      }
      c.lineTo(W, H); c.closePath();
      // (each ridge darker and nearer; the far one takes the sky's own haze)
      const g = c.createLinearGradient(0, H * (base - 0.15), 0, H);
      g.addColorStop(0, li === 2 ? '#0a0612' : li === 1 ? '#150d22' : '#221832'); g.addColorStop(1, '#07040c');
      c.fillStyle = g; c.globalAlpha = 0.55 + li * 0.2; c.fill(); c.globalAlpha = 1;
      if (li === 0) { c.fillStyle = sky[2]; c.globalAlpha = 0.18 * (1 - night); c.fill(); c.globalAlpha = 1; }
    });
    // a few lamps along the road down the nearest ridge, and the town far off in the valley
    c.fillStyle = 'rgba(255,190,110,' + (0.25 + 0.6 * night) + ')';
    for (let i = 0; i < 26; i++) { const x = 40 + r() * (W - 80), y = H * 0.8 + r() * H * 0.12; c.fillRect(x, y, 2, 2); }
  } else {
    let x = -10;
    while (x < W) {
      const w = 34 + r() * 70, h = 60 + Math.pow(r(), 1.6) * 230, top = H - 70 - h;
      c.fillStyle = '#0b0714'; c.fillRect(x, top, w, H - top);
      if (r() < 0.25) { c.fillStyle = 'rgba(255,60,90,' + (0.4 + 0.5 * night) + ')'; c.fillRect(x + w / 2 - 1.5, top - 6, 3, 3); }
      // the windows, lit at night
      for (let wy = top + 8; wy < H - 40; wy += 11) for (let wx = x + 5; wx < x + w - 6; wx += 9) {
        if (r() < 0.32 * night + 0.03) { c.fillStyle = r() < 0.2 ? 'rgba(120,220,255,0.7)' : 'rgba(255,205,130,0.75)'; c.fillRect(wx, wy, 4, 5); }
      }
      x += w + 2 + r() * 8;
    }
    // the lattice tower on the skyline
    const tx = W * 0.78, base = H - 70;
    c.strokeStyle = 'rgba(255,120,60,' + (0.55 + 0.4 * night) + ')'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(tx - 40, base); c.lineTo(tx, base - 330); c.lineTo(tx + 40, base); c.moveTo(tx - 26, base - 110); c.lineTo(tx + 26, base - 110); c.moveTo(tx - 13, base - 220); c.lineTo(tx + 13, base - 220); c.stroke();
    c.fillStyle = '#ff5050'; c.fillRect(tx - 2, base - 340, 4, 8);
  }
  // the road's glow along the bottom
  const g = c.createLinearGradient(0, H - 90, 0, H);
  g.addColorStop(0, 'rgba(10,6,18,0)'); g.addColorStop(1, 'rgba(10,6,18,0.92)');
  c.fillStyle = g; c.fillRect(0, H - 90, W, 90);
}

/** A box of the pause card's kind: dark glass, an amber rule, a hard shadow; a label over a number. */
function statBox(c, x, y, w, h, label, value, hi) {
  c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(x + 5, y + 5, w, h);
  c.fillStyle = 'rgba(12,8,20,0.82)'; c.fillRect(x, y, w, h);
  c.strokeStyle = hi ? 'rgba(255,210,63,0.75)' : 'rgba(255,179,71,0.42)'; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, w - 2, h - 2);
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.font = `17px ${MONO}`; c.fillStyle = hi ? '#ffd23f' : '#a79f95';
  spaced(c, label, x + w / 2, y + 30, 3.2, 'center');
  c.font = `italic 400 40px ${RACE}`; c.fillStyle = hi ? '#ffd23f' : '#f6efe2';
  c.fillText(value, x + w / 2, y + h - 18);
}

/** Text with letter spacing (a canvas has letterSpacing only in newer browsers). */
function spaced(c, s, x, y, ls, align = 'left') {
  const w = [...s].reduce((a, ch) => a + c.measureText(ch).width + ls, -ls);
  let px = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  const keep = c.textAlign; c.textAlign = 'left';
  for (const ch of s) { c.fillText(ch, px, y); px += c.measureText(ch).width + ls; }
  c.textAlign = keep;
  return w;
}

/** The card for a run, drawn on a new canvas. */
export async function drawCard(run, units = 'mph') {
  // (the page's own faces, waited for a moment: they are loaded by the time a run has been driven, as a rule)
  try {
    if (document.fonts && document.fonts.load) {
      await Promise.race([Promise.all([document.fonts.load(`italic 400 120px ${RACE}`, 'SUNDRIFT0123456789'), document.fonts.load(`20px ${MONO}`, 'DAWN'), document.fonts.load(`40px ${JP}`, 'サンドリフト')]), new Promise((r) => setTimeout(r, 1500))]);
    }
  } catch {}
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const city = run.map === 'city', hour = Number.isFinite(run.clock) ? run.clock : 6, sky = skyAt(hour), night = nightAt(hour);
  // the sky
  const g = c.createLinearGradient(0, 0, 0, H * 0.82);
  g.addColorStop(0, sky[0]); g.addColorStop(0.55, sky[1]); g.addColorStop(1, sky[2]);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  if (city) { const m = c.createLinearGradient(0, H * 0.35, 0, H * 0.85); m.addColorStop(0, 'rgba(255,80,180,0)'); m.addColorStop(1, `rgba(255,80,180,${0.08 + 0.3 * night})`); c.fillStyle = m; c.fillRect(0, 0, W, H); }
  // the stars, and the moon or the sun
  const r = rnd(11);
  if (night > 0.05) for (let i = 0; i < 170; i++) { const x = r() * W, y = r() * H * 0.62, s = r() < 0.12 ? 2.2 : 1.3; c.fillStyle = `rgba(230,236,255,${(0.35 + 0.65 * r()) * night})`; c.fillRect(x, y, s, s); }
  const low = hour >= 16 || hour < 8;
  // (the moon and a high sun between the logo and the clock's panel; a low sun on the horizon, right of the words)
  if (night > 0.6) {
    const mx = W * 0.63, my = H * 0.17;
    const halo = c.createRadialGradient(mx, my, 10, mx, my, 120); halo.addColorStop(0, 'rgba(180,200,255,0.35)'); halo.addColorStop(1, 'rgba(180,200,255,0)');
    c.fillStyle = halo; c.fillRect(mx - 130, my - 130, 260, 260);
    c.fillStyle = '#fff2c0'; c.beginPath(); c.arc(mx, my, 30, 0, Math.PI * 2); c.fill();
    c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(mx + 15, my - 10, 27, 0, Math.PI * 2); c.fill(); c.globalCompositeOperation = 'source-over';
  } else {
    const sx = low ? W * (hour < 12 ? 0.7 : 0.66) : W * 0.62, sy = low ? H * 0.6 : H * 0.2, sr = low ? 62 : 46;
    const halo = c.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 4); halo.addColorStop(0, 'rgba(255,214,140,0.55)'); halo.addColorStop(1, 'rgba(255,214,140,0)');
    c.fillStyle = halo; c.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
    const sg = c.createLinearGradient(0, sy - sr, 0, sy + sr); sg.addColorStop(0, '#fff3c8'); sg.addColorStop(1, low ? '#ff8a4a' : '#ffe9a0');
    c.fillStyle = sg; c.beginPath(); c.arc(sx, sy, sr, 0, Math.PI * 2); c.fill();
    // (the 80s sun's bands across its lower half)
    if (low) { c.fillStyle = sky[2]; for (let i = 0; i < 5; i++) c.fillRect(sx - sr, sy + 8 + i * 11, sr * 2, 2 + i * 1.2); }
  }
  drawLand(c, city, sky, night);
  // the shade behind the words, as the title has it
  const sh = c.createLinearGradient(0, 0, W * 0.75, 0);
  sh.addColorStop(0, 'rgba(10,6,18,0.78)'); sh.addColorStop(0.62, 'rgba(10,6,18,0.4)'); sh.addColorStop(1, 'rgba(10,6,18,0)');
  c.fillStyle = sh; c.fillRect(0, 0, W, H);

  // the logo: italic racing type, chrome over a sunset, its dark drop and pink glow, leaning as the title's leans
  c.save();
  c.translate(70, 150); c.transform(1, 0, Math.tan(-6 * Math.PI / 180), 1, 0, 0);
  c.font = `italic 400 112px ${RACE}`; c.textBaseline = 'alphabetic';
  const lg = c.createLinearGradient(0, -96, 0, 14);
  [['#fffaf0', 0], ['#ffe0a8', 0.38], ['#ff9a3d', 0.52], ['#ff4f9a', 0.7], ['#7a4dff', 1]].forEach(([col, at]) => lg.addColorStop(at, col));
  // (the title's two drop shadows: a soft pink glow, then a hard dark drop under the letters, then the letters)
  c.shadowColor = 'rgba(255,90,140,0.5)'; c.shadowBlur = 26; c.fillStyle = lg; spaced(c, 'SUNDRIFT', 0, 0, 2.2);
  c.shadowColor = 'transparent'; c.shadowBlur = 0;
  c.fillStyle = '#1a0f24'; spaced(c, 'SUNDRIFT', 0, 5, 2.2);
  c.fillStyle = lg; spaced(c, 'SUNDRIFT', 0, 0, 2.2);
  c.restore();
  let y = 196;
  const kana = (() => { try { return document.fonts && document.fonts.check(`40px ${JP}`, 'サンドリフト'); } catch { return false; } })();
  if (kana) { c.font = `24px ${JP}`; c.fillStyle = '#ffb3cc'; spaced(c, 'サンドリフト', 78, y, 14); y += 44; } else y += 16;
  c.font = `21px ${MONO}`; c.fillStyle = '#ffd9a8'; spaced(c, String(run.course || '').toUpperCase(), 76, y, 6); y += 92;

  // the score, the way the results screen says it
  c.font = `italic 400 104px ${RACE}`; c.textBaseline = 'alphabetic';
  const scoreG = c.createLinearGradient(0, y - 90, 0, y);
  scoreG.addColorStop(0, '#ffe3a6'); scoreG.addColorStop(0.5, '#ffb347'); scoreG.addColorStop(1, '#ff8a2a');
  c.fillStyle = '#1a0f24'; c.fillText(fmt.int(run.score), 76, y + 5);
  c.fillStyle = scoreG; c.fillText(fmt.int(run.score), 72, y);
  c.font = `20px ${MONO}`; c.fillStyle = '#a79f95'; spaced(c, 'POINTS', 80, y + 36, 6);
  y += 86;
  c.font = `italic 400 40px ${RACE}`;
  if (run.dawn) { c.fillStyle = '#ffd23f'; c.fillText(`REACHED DAWN IN ${fmt.time(run.dawnTime)}`, 76, y); }
  else { c.fillStyle = '#ff9ccb'; c.fillText(`DROVE THE NIGHT TO ${fmt.clock(run.clock)}`, 76, y); }

  // the clock it reached, on the dash's display
  {
    const bx = W - 330, by = 46, bw = 270, bh = 128;
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(bx + 6, by + 6, bw, bh);
    c.fillStyle = 'rgba(12,10,18,0.84)'; c.fillRect(bx, by, bw, bh);
    c.strokeStyle = 'rgba(255,179,71,0.4)'; c.lineWidth = 2; c.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
    // (DAWN over the clock of a run that ended at dawn; the CLOCK it reached otherwise, carried on into the day or not)
    const atDawn = run.dawn && hour >= 6 && hour < 6.5;
    c.font = `18px ${MONO}`; c.fillStyle = atDawn ? '#ffd23f' : '#a79f95'; c.textAlign = 'left'; spaced(c, atDawn ? 'DAWN' : 'CLOCK', bx + 18, by + 30, 4);
    drawSeg(c, fmt.clock(hour), bx + 22, by + 44, 66, '#ffb347');
  }

  // the run's numbers, in a row of the pause card's boxes
  const stats = [['DRIFTS', String(run.drifts)], ['BIGGEST', fmt.int(run.biggest)], ['COMBO', run.combo > 0 ? 'x' + run.combo : '—'], ['DISTANCE', fmt.dist(run.distance, units)]];
  const bw = 236, gap = 20, bx0 = 72, by = H - 148;
  stats.forEach(([l, v], i) => statBox(c, bx0 + i * (bw + gap), by, bw, 96, l, v, false));
  c.textAlign = 'left';
  c.font = `18px ${MONO}`; c.fillStyle = 'rgba(246,239,226,0.72)';
  spaced(c, 'LKRUER.GITHUB.IO/SUNDRIFT', 76, H - 22, 4);
  c.textAlign = 'right'; c.fillStyle = '#ffd9a8'; spaced(c, 'DRIFT UNTIL DAWN', W - 64, H - 22, 5, 'right'); c.textAlign = 'left';

  // the tube: its scanlines and its rim
  c.fillStyle = 'rgba(0,0,0,0.13)';
  for (let sy = 0; sy < H; sy += 4) c.fillRect(0, sy, W, 1.5);
  const v = c.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
  c.fillStyle = v; c.fillRect(0, 0, W, H);
  return cv;
}

// ---------------------------------------------------------------- the card ahead of time, and the share

const cards = new Map();
const cardKey = (run, units) => `${run.id}|${run.at}|${units}`;

/** The card as a PNG, drawn now and kept for the share that may follow. */
export function prepareCard(run, units = 'mph') {
  if (!run) return null;
  const key = cardKey(run, units);
  let e = cards.get(key);
  if (e) return e.promise;
  if (cards.size > 6) cards.clear();
  e = { blob: null, promise: null };
  e.promise = drawCard(run, units).then((cv) => new Promise((res) => {
    try { cv.toBlob((b) => { e.blob = b; res(b); }, 'image/png'); } catch { res(null); }
  })).catch(() => null);
  cards.set(key, e);
  return e.promise;
}

const fileName = (run) => `sundrift-${String(run.course || 'run').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Math.round(run.score)}.png`;

function download(blob, name) {
  try {
    const a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return true;
  } catch { return false; }
}

async function copy(text) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; } } catch {}
  // (an older browser, or a page the clipboard API is not allowed on: the old way)
  try {
    const t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(t); t.select();
    const ok = document.execCommand && document.execCommand('copy');
    t.remove();
    return !!ok;
  } catch { return false; }
}

/**
 * Share a run. Returns what happened: 'platform' (the host shared it), 'shared' (the share sheet took it), 'cancelled'
 * (the player closed the sheet), 'copied' (the text is on the clipboard; the card was saved too where it could be),
 * 'saved' (only the card could be saved), or 'failed'.
 */
export async function shareRun(run, { units = 'mph', platform = null } = {}) {
  if (!run) return 'failed';
  const text = shareText(run, units);
  const e = cards.get(cardKey(run, units));
  let blob = e && e.blob;
  if (!blob) {
    // (not drawn yet: waited for a moment at most, so the share sheet is still asked for inside the tap)
    const p = prepareCard(run, units);
    blob = await Promise.race([p, new Promise((r) => setTimeout(() => r(null), 350))]);
  }
  if (platform) {
    try { if (await platform.share({ title: 'SUNDRIFT', text, url: SHARE_URL, run, card: blob || null })) return 'platform'; } catch {}
  }
  let file = null;
  try { if (blob && typeof File === 'function') file = new File([blob], fileName(run), { type: 'image/png' }); } catch {}
  if (navigator.share) {
    const data = { title: 'SUNDRIFT', text, url: SHARE_URL };
    try { if (file && navigator.canShare && navigator.canShare({ files: [file] })) data.files = [file]; } catch {}
    try { await navigator.share(data); return 'shared'; } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
      // (anything else, a sheet the browser would not open: the clipboard instead)
    }
  }
  const copied = await copy(text + '\n' + SHARE_URL);
  const saved = blob ? download(blob, fileName(run)) : false;
  return copied ? 'copied' : saved ? 'saved' : 'failed';
}
