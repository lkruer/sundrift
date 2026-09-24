/**
 * NEO TOKYO, the detail over and along the street: the things a street in Shinjuku at night is made of besides its
 * buildings and its neon.
 *
 *     const mats = detailLoad(w, Pool);               // once, with the city's materials (they compile at load)
 *     const D = detailBegin(w, ch, lists);            // per chunk, before its lots (lists: its housings, glows, streaks)
 *     lot.clear = detailLot(w, D, lot);               // per lot, before its clutter: what it must leave free
 *     yield* detailChunk(w, ch, D);                   // per chunk, after its lots
 *     detailUpdate(w, t);                             // every frame: the screens' clock, the train, far culling
 *
 * - LED screens, animated in their shader over one atlas of ads drawn at load: big screens on the upper floors of
 *   the taller buildings, vertical LED towers standing out from the fronts (facing along the street, so a driver
 *   sees them head on, both faces lit), and billboards on the roofs of the lower buildings, turned toward the
 *   traffic. Each shows a new ad every seven to eleven seconds behind a bright wipe (a soda, a concert, ramen, a
 *   game, a sale, the weather, a drift car, the city's own logo), some with a news ticker sliding past, and up
 *   close the picture breaks into round LEDs. Their light lies on the pavement and streaks down the wet road, and
 *   the nearest real lights take their colour as the ads change.
 * - Overhead wires: concrete poles 1.35 m back from the kerb (the recipe's power pole, solid; the first 1.3 m of
 *   pavement is the car's in a drift), arms across the street, on one side of a stretch, two high-voltage wires and one on top, two low-voltage ones, two black telecom cables, all sagging
 *   from pole to pole; service drops from each pole to the fronts, and wires slung across the street to the far
 *   fronts. Drawn as ribbons turned to the camera and never thinner than a pixel and a half, so they read against
 *   the glow of the sky at any distance and fade out far away.
 * - Shopping streets (shotengai): a lit arch over the road with its name and chasing bulbs, and strings of red
 *   paper lanterns across the street from front to front behind it.
 * - A glazed skybridge now and then between two fronts across the street, lit inside, people crossing it (drawn by
 *   the screens' shader), a ticker along its girder.
 * - The elevated railway and its train (citytrain.js), where the avenue allows.
 * - The pavement: kerb stones, interlocking pavers in two colours, and the yellow tactile strip, laid over the
 *   ground from the kerb to the fronts.
 *
 * Every chunk draws its screens in one mesh (one material: the ads, the tickers, the arch's signs, the skybridge's
 * glass, lamp lenses), its wires in one, its pavement in one (the last two not drawn beyond where they still show);
 * frames and supports go into the chunk's sign housings, the lanterns and the poles into the world's shared pools.
 * Nothing here stands on the road or in the first 1.3 m of pavement.
 */
import * as THREE from 'three';
import { mulberry32 } from './config.js?v=202609241743';
import { railLoad, railChunk, railUpdate, railSkip } from './citytrain.js?v=202609241743';

const TAU = Math.PI * 2;
const POLE_U = 1.35;             // the utility poles stand this far past the road's edge (the kerb zone, 1.3 m, stays clear)

// ---------------------------------------------------------------- a small geometry writer

class Geo {
  constructor(attrs) {
    this.names = Object.keys(attrs); this.sizes = attrs;
    this.a = {}; for (const k of this.names) this.a[k] = [];
    this.i = []; this.n = 0;
  }
  /** One vertex: its values in the order of the attributes given to the constructor. */
  v(...vals) {
    let o = 0;
    for (const k of this.names) { const arr = this.a[k], s = this.sizes[k]; for (let j = 0; j < s; j++) arr.push(vals[o][j] ?? vals[o]); o++; }
    return this.n++;
  }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  build() {
    if (!this.i.length) return null;
    const g = new THREE.BufferGeometry();
    for (const k of this.names) g.setAttribute(k, new THREE.Float32BufferAttribute(this.a[k], this.sizes[k]));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
}

const norm2 = (x, z) => { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };

// ---------------------------------------------------------------- the ad atlas: 4 x 4 cells of 512 x 256

const AW = 2048, AH = 1536, CW = 512, CH = 256;
const JP = '"Dela Gothic One", "M PLUS Rounded 1c", "Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif';
const ROUND = '"M PLUS Rounded 1c", "Dela Gothic One", "Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif';
/** Every Japanese character the ad atlas draws: they are in index.html's &text= list. */
export const DETAIL_CHARS = 'ネオ東京新発売作アリナラーメン大出しの天気雨カオケ月見一番街銀座商店首都高速環状線宿富士山寿司ホテル';

/**
 * Draw the ads. Cells 0-7 are landscape ads, 8-10 portrait ones (drawn turned a quarter, so they stand upright on a
 * tall screen), 11 holds the two arch signs, and the bottom quarter two ticker strips of 2048 x 128 that wrap.
 */
function adAtlas(w) {
  const cv = document.createElement('canvas'); cv.width = AW; cv.height = AH;
  const c = cv.getContext('2d');
  c.fillStyle = '#000'; c.fillRect(0, 0, AW, AH);
  const jp = w.glyphs ? w.glyphs('44px ' + JP, 'ネオ東京新発売') : false;
  const T = (a, b) => (jp ? a : b);
  const racing = document.fonts && document.fonts.check ? document.fonts.check('40px "Racing Sans One"') : false;
  const RACE = racing ? '"Racing Sans One", Rajdhani, sans-serif' : '700 Rajdhani, sans-serif';
  const font = (px, fam = JP, weight = '') => `${weight} ${px}px ${fam}`.trim();
  // text with an outline and an optional glow, centred on (x, y), squeezed to maxW
  const text = (s, x, y, px, fill, o = {}) => {
    c.save();
    c.font = o.font || font(px, o.fam || JP, o.weight || '');
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const m = c.measureText(s).width;
    c.translate(x, y);
    if (o.rot) c.rotate(o.rot);
    if (o.maxW && m > o.maxW) c.scale(o.maxW / m, 1);
    if (o.skew) c.transform(1, 0, o.skew, 1, 0, 0);
    if (o.glow) { c.shadowColor = o.glow; c.shadowBlur = o.blur ?? px * 0.35; }
    if (o.stroke) { c.lineJoin = 'round'; c.strokeStyle = o.stroke; c.lineWidth = o.sw ?? px * 0.14; c.strokeText(s, 0, 0); }
    c.fillStyle = fill; c.fillText(s, 0, 0);
    if (o.glow) { c.shadowBlur = 0; c.fillText(s, 0, 0); }
    c.restore();
  };
  const cell = (k, fn, portrait = false) => {
    const x = (k % 4) * CW, y = Math.floor(k / 4) * CH;
    c.save();
    c.beginPath(); c.rect(x, y, CW, CH); c.clip();
    if (portrait) { c.translate(x + CW, y); c.rotate(Math.PI / 2); fn(CH, CW); }   // a 256 x 512 design, upright on a tall screen
    else { c.translate(x, y); fn(CW, CH); }
    c.restore();
  };
  const lg = (x0, y0, x1, y1, stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([t, col]) => g.addColorStop(t, col)); return g; };
  const star = (x, y, r, n = 5, inner = 0.45, rot = -Math.PI / 2) => {
    c.beginPath();
    for (let i = 0; i <= n * 2; i++) { const a = rot + (i * Math.PI) / n, rr = i % 2 ? r * inner : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath();
  };
  const burst = (x, y, r, n, fill) => { star(x, y, r, n, 0.78, 0); c.fillStyle = fill; c.fill(); };
  const rnd = mulberry32(4242);

  // 0: the city's own logo over a synthwave sunset and a skyline
  cell(0, (W, H) => {
    c.fillStyle = lg(0, 0, 0, H, [[0, '#12052e'], [0.45, '#7a1266'], [0.72, '#ff3d7a'], [1, '#ffb347']]); c.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.6})`; c.fillRect(rnd() * W, rnd() * H * 0.4, 2, 2); }
    const sx = W / 2, sy = H * 0.78, r = 86;
    c.save(); c.beginPath(); c.arc(sx, sy, r, 0, TAU); c.clip();
    c.fillStyle = lg(0, sy - r, 0, sy + r, [[0, '#fff27a'], [0.6, '#ff8a3a'], [1, '#ff2d7a']]); c.fillRect(sx - r, sy - r, 2 * r, 2 * r);
    c.fillStyle = '#5a0e4e'; for (let k = 0; k < 7; k++) c.fillRect(sx - r, sy - 6 + k * 13, 2 * r, 3 + k * 1.2);
    c.restore();
    c.fillStyle = '#0b0614';
    for (let x = 0; x < W;) { const bw = 14 + rnd() * 30, bh = 24 + rnd() * 70; c.fillRect(x, H - bh, bw, bh); x += bw + 2; }
    c.fillStyle = 'rgba(255,220,120,0.9)';
    for (let i = 0; i < 70; i++) c.fillRect(rnd() * W, H - rnd() * 60, 2, 2);
    text(T('ネオ東京', 'NEO TOKYO'), W / 2, 70, 84, '#fff6fb', { glow: '#ff3db8', stroke: '#3a0636', sw: 8, maxW: W - 40 });
    text('NEO TOKYO  2099', W / 2, 136, 30, '#7ff6ff', { font: `700 30px Rajdhani, sans-serif`, glow: '#18d8ff' });
  });
  // 1: a soda, new
  cell(1, (W, H) => {
    c.fillStyle = lg(0, 0, W, H, [[0, '#ff1f2e'], [1, '#a8000e']]); c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,0.18)'; for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(60 + rnd() * 160, 30 + rnd() * 200, 6 + rnd() * 22, 0, TAU); c.fill(); }
    // the can
    const cx = 120, cy = 128;
    c.fillStyle = lg(cx - 52, 0, cx + 52, 0, [[0, '#8a0a10'], [0.35, '#ff5a5a'], [0.55, '#ffd0d0'], [0.7, '#e01020'], [1, '#6a0008']]);
    c.fillRect(cx - 52, cy - 88, 104, 176);
    c.fillStyle = lg(cx - 52, 0, cx + 52, 0, [[0, '#6a6e76'], [0.5, '#f2f4f8'], [1, '#5a5e66']]);
    c.fillRect(cx - 48, cy - 102, 96, 16); c.fillRect(cx - 48, cy + 86, 96, 12);
    c.save(); c.beginPath(); c.moveTo(cx - 52, cy + 10); c.bezierCurveTo(cx - 20, cy - 30, cx + 20, cy + 40, cx + 52, cy - 10); c.lineTo(cx + 52, cy + 14); c.bezierCurveTo(cx + 20, cy + 60, cx - 20, cy - 8, cx - 52, cy + 34); c.closePath();
    c.fillStyle = '#ffffff'; c.fill(); c.restore();
    text('NEO', cx, cy - 40, 34, '#ffffff', { font: `italic 700 34px Rajdhani, sans-serif` });
    text('NEO COLA', 360, 78, 64, '#ffffff', { stroke: '#5a0006', sw: 8, maxW: 270, font: `italic 700 64px Rajdhani, sans-serif` });
    burst(360, 170, 62, 14, '#ffe23a');
    text(T('新発売', 'NEW!'), 360, 170, 40, '#c80010', { maxW: 110 });
    text('¥150', 450, 226, 26, '#ffffff', { font: `700 26px Rajdhani, sans-serif` });
  });
  // 2: a concert
  cell(2, (W, H) => {
    c.fillStyle = lg(0, 0, W, H, [[0, '#1a0a5a'], [0.6, '#6a0ea0'], [1, '#ff2d9a']]); c.fillRect(0, 0, W, H);
    for (let k = 0; k < 5; k++) { c.fillStyle = `rgba(255,255,255,${0.06 + 0.04 * k})`; c.beginPath(); const x = 60 + k * 100; c.moveTo(x, H); c.lineTo(x - 40 + k * 20, 0); c.lineTo(x + 40 + k * 20, 0); c.closePath(); c.fill(); }
    for (let i = 0; i < 18; i++) { star(rnd() * W, rnd() * H, 4 + rnd() * 9); c.fillStyle = rnd() < 0.5 ? '#fff6a0' : '#ffffff'; c.fill(); }
    // the singer: a silhouette with twin tails and a microphone
    c.fillStyle = '#120420';
    c.beginPath(); c.arc(410, 96, 34, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(362, 120, 16, 52, 0.35, 0, TAU); c.fill(); c.beginPath(); c.ellipse(458, 120, 16, 52, -0.35, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(372, H); c.lineTo(386, 138); c.lineTo(434, 138); c.lineTo(448, H); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(430, 150); c.lineTo(472, 104); c.lineWidth = 10; c.strokeStyle = '#120420'; c.stroke();
    text('LIVE', 170, 86, 96, '#ffffff', { font: `italic 700 96px Rajdhani, sans-serif`, glow: '#ff4fd8', stroke: '#3a0060', sw: 8 });
    text(T('ネオ東京 アリーナ', 'NEO TOKYO ARENA'), 170, 168, 38, '#ffe86a', { maxW: 300 });
    text('9.25  SAT', 170, 214, 30, '#ffffff', { font: `700 30px Rajdhani, sans-serif` });
  });
  // 3: ramen
  cell(3, (W, H) => {
    const g = c.createRadialGradient(160, 150, 20, 160, 150, 320); g.addColorStop(0, '#ffe07a'); g.addColorStop(1, '#ff8a1a');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,0.25)'; for (let k = 0; k < 16; k++) { c.save(); c.translate(160, 150); c.rotate((k / 16) * TAU); c.fillRect(0, -6, 320, 12); c.restore(); }
    // the bowl, noodles, an egg, a slice of pork, chopsticks
    c.fillStyle = '#b8140e'; c.beginPath(); c.moveTo(60, 138); c.quadraticCurveTo(160, 290, 260, 138); c.closePath(); c.fill();
    c.fillStyle = '#ffe9b8'; c.beginPath(); c.ellipse(160, 138, 100, 22, 0, 0, TAU); c.fill();
    c.strokeStyle = '#f0c060'; c.lineWidth = 4; for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(80 + k * 26, 132); c.bezierCurveTo(90 + k * 26, 120, 100 + k * 26, 150, 110 + k * 26, 136); c.stroke(); }
    c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(190, 128, 20, 14, 0, 0, TAU); c.fill(); c.fillStyle = '#ffb21a'; c.beginPath(); c.arc(190, 128, 8, 0, TAU); c.fill();
    c.fillStyle = '#d88a6a'; c.beginPath(); c.ellipse(128, 128, 26, 12, -0.2, 0, TAU); c.fill();
    c.strokeStyle = '#6a3a16'; c.lineWidth = 7; c.beginPath(); c.moveTo(200, 150); c.lineTo(300, 40); c.moveTo(214, 154); c.lineTo(312, 50); c.stroke();
    text(T('ラーメン', 'RAMEN'), 390, 90, 64, '#b8140e', { stroke: '#fff6d8', sw: 10, maxW: 230 });
    burst(400, 186, 50, 16, '#b8140e');
    text('¥780', 400, 186, 34, '#ffffff', { font: `700 34px Rajdhani, sans-serif` });
  });
  // 4: a game
  cell(4, (W, H) => {
    c.fillStyle = '#05020c'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(255,60,220,0.55)'; c.lineWidth = 2;
    for (let k = 0; k <= 12; k++) { c.beginPath(); c.moveTo(W / 2, 120); c.lineTo((k / 12) * W * 2 - W / 2, H); c.stroke(); }
    for (let k = 0; k < 7; k++) { const y = 120 + Math.pow(k / 7, 1.8) * (H - 120); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    const inv = ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'];
    const invader = (x, y, s, col) => { c.fillStyle = col; inv.forEach((row, j) => { for (let i = 0; i < 11; i++) if (row[i] === '1') c.fillRect(x + i * s, y + j * s, s - 1, s - 1); }); };
    invader(30, 30, 7, '#46ff7a'); invader(400, 36, 7, '#ff4fd8'); invader(430, 150, 5, '#35e8ff');
    text('GAME', W / 2, 92, 110, '#35e8ff', { font: `italic 700 110px Rajdhani, sans-serif`, glow: '#18a8ff', stroke: '#001a3a', sw: 6 });
    c.fillStyle = '#ff2a3a'; c.fillRect(64, 150, 110, 44);
    text(T('新作', 'NEW'), 119, 172, 34, '#ffffff', { maxW: 100 });
    text('PLAY NOW', W / 2, 224, 40, '#ffe23a', { font: `700 40px Rajdhani, sans-serif`, glow: '#ffb21a' });
  });
  // 5: the drift car
  cell(5, (W, H) => {
    c.fillStyle = lg(0, 0, 0, H, [[0, '#0c0628'], [0.6, '#3a0a4e'], [1, '#12061a']]); c.fillRect(0, 0, W, H);
    c.fillStyle = '#1a1024'; c.beginPath(); c.moveTo(0, H); c.lineTo(W * 0.42, 118); c.lineTo(W * 0.58, 118); c.lineTo(W, H); c.closePath(); c.fill();
    c.strokeStyle = '#ffb347'; c.lineWidth = 4; c.setLineDash([18, 16]); c.beginPath(); c.moveTo(W / 2, 120); c.lineTo(W / 2, H); c.stroke(); c.setLineDash([]);
    // tyre smoke and the car, sideways
    c.fillStyle = 'rgba(230,230,255,0.5)'; for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(90 + rnd() * 140, 170 + rnd() * 60, 14 + rnd() * 26, 0, TAU); c.fill(); }
    c.save(); c.translate(300, 176); c.rotate(-0.12);
    c.fillStyle = '#f4f2ea'; c.beginPath(); c.moveTo(-120, 18); c.lineTo(-112, -10); c.lineTo(-60, -18); c.lineTo(-24, -44); c.lineTo(46, -44); c.lineTo(84, -18); c.lineTo(124, -12); c.lineTo(126, 18); c.closePath(); c.fill();
    c.fillStyle = '#1a2a3a'; c.beginPath(); c.moveTo(-18, -38); c.lineTo(40, -38); c.lineTo(66, -18); c.lineTo(-44, -18); c.closePath(); c.fill();
    c.fillStyle = '#d11c1c'; c.fillRect(-122, -6, 12, 10);
    c.fillStyle = '#18181a'; for (const x of [-72, 78]) { c.beginPath(); c.arc(x, 18, 20, 0, TAU); c.fill(); c.fillStyle = '#b8843a'; c.beginPath(); c.arc(x, 18, 10, 0, TAU); c.fill(); c.fillStyle = '#18181a'; }
    c.restore();
    text('SUNDRIFT', W / 2, 58, 72, '#ffffff', { font: `italic 72px ${RACE}`, glow: '#ff8a2a', stroke: '#4a0a2a', sw: 6, maxW: W - 50 });
  });
  // 6: a sale
  cell(6, (W, H) => {
    c.fillStyle = '#ffe23a'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#ff3a2a'; for (let k = -6; k < 16; k++) { c.beginPath(); c.moveTo(k * 48, 0); c.lineTo(k * 48 + 24, 0); c.lineTo(k * 48 - 80, H); c.lineTo(k * 48 - 104, H); c.closePath(); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.88)'; c.fillRect(20, 30, W - 40, H - 60);
    text('SALE', 190, 108, 128, '#e8101e', { font: `italic 700 128px Rajdhani, sans-serif`, stroke: '#ffffff', sw: 10 });
    text(T('大売出し', 'BIG SALE'), 190, 196, 46, '#1a1a6a', { maxW: 300 });
    burst(400, 128, 84, 18, '#e8101e');
    text('50%', 400, 112, 56, '#ffffff', { font: `700 56px Rajdhani, sans-serif` });
    text('OFF', 400, 160, 34, '#ffe23a', { font: `700 34px Rajdhani, sans-serif` });
  });
  // 7: the weather, a ticker bar along its foot (the shader slides the ticker in there)
  cell(7, (W, H) => {
    c.fillStyle = lg(0, 0, 0, H, [[0, '#0a2a6a'], [1, '#04102e']]); c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(120,180,255,0.18)'; c.lineWidth = 1; for (let k = 0; k < 16; k++) { c.beginPath(); c.moveTo(k * 32, 0); c.lineTo(k * 32, H); c.stroke(); c.beginPath(); c.moveTo(0, k * 32); c.lineTo(W, k * 32); c.stroke(); }
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, 40);
    text(T('東京の天気', 'TOKYO WEATHER'), 130, 20, 26, '#0a2a6a', { maxW: 230 });
    text('21:00', 440, 20, 26, '#e8101e', { font: `700 26px Rajdhani, sans-serif` });
    // a cloud with rain, and the numbers
    c.fillStyle = '#dfe8f8'; for (const [x, y, r] of [[110, 110, 34], [150, 96, 42], [192, 112, 32], [150, 124, 36]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    c.strokeStyle = '#6ac8ff'; c.lineWidth = 5; c.lineCap = 'round'; for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(106 + k * 20, 162); c.lineTo(96 + k * 20, 184); c.stroke(); }
    text(T('雨', 'RAIN'), 320, 104, 64, '#ffffff', { maxW: 150 });
    text('18°C', 440, 104, 44, '#ffe23a', { font: `700 44px Rajdhani, sans-serif` });
    text('90%', 330, 170, 30, '#6ac8ff', { font: `700 30px Rajdhani, sans-serif` });
    c.fillStyle = '#e8101e'; c.fillRect(0, H - 50, W, 50);
  });
  // 12 (portrait): the city's name down a red screen
  cell(12, (W, H) => {
    c.fillStyle = lg(0, 0, 0, H, [[0, '#ff2a3a'], [1, '#7a0018']]); c.fillRect(0, 0, W, H);
    c.strokeStyle = '#ffffff'; c.lineWidth = 6; c.strokeRect(14, 14, W - 28, H - 28);
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(W / 2, 74, 46, 0, TAU); c.fill();
    c.fillStyle = '#e8101e'; c.beginPath(); c.arc(W / 2, 74, 30, 0, TAU); c.fill();
    text(T('東', 'TO'), W / 2, 196, 120, '#ffffff', { stroke: '#5a0010', sw: 8 });
    text(T('京', 'KYO'), W / 2, 318, 120, '#ffffff', { stroke: '#5a0010', sw: 8 });
    text('TOKYO', W / 2, 450, 70, '#ffe23a', { font: `italic 700 70px Rajdhani, sans-serif`, maxW: W - 40 });
  }, true);
  // 13 (portrait): karaoke in pink neon
  cell(13, (W, H) => {
    c.fillStyle = lg(0, 0, 0, H, [[0, '#1a0628'], [1, '#07020e']]); c.fillRect(0, 0, W, H);
    c.strokeStyle = '#35e8ff'; c.lineWidth = 5; c.shadowColor = '#35e8ff'; c.shadowBlur = 14; c.strokeRect(16, 16, W - 32, H - 32); c.shadowBlur = 0;
    const ch = [...T('カラオケ', 'SING')];
    ch.forEach((t, i) => text(t, W / 2, 92 + i * 96, 84, '#ffd6f4', { fam: ROUND, weight: '800', glow: '#ff3fa4', blur: 22, rot: t === 'ー' ? Math.PI / 2 : 0 }));
    text('24H', W / 2, 470, 54, '#fff06a', { font: `700 54px Rajdhani, sans-serif`, glow: '#ffb21a' });
  }, true);
  // 14 (portrait): the moon over a bar
  cell(14, (W, H) => {
    c.fillStyle = lg(0, 0, 0, H, [[0, '#0a1a4a'], [1, '#040816']]); c.fillRect(0, 0, W, H);
    for (let i = 0; i < 30; i++) { c.fillStyle = `rgba(255,255,255,${0.4 + rnd() * 0.6})`; c.fillRect(rnd() * W, rnd() * H * 0.6, 2, 2); }
    c.fillStyle = '#ffe9a0'; c.shadowColor = '#ffd060'; c.shadowBlur = 30; c.beginPath(); c.arc(W / 2, 110, 70, 0, TAU); c.fill(); c.shadowBlur = 0;
    text(T('月', 'MOON'), W / 2, 260, 110, '#ffffff', { glow: '#6ab8ff' });
    text(T('見', 'BAR'), W / 2, 372, 110, '#ffffff', { glow: '#6ab8ff' });
    text('BAR', W / 2, 468, 56, '#ffb13a', { font: `700 56px Rajdhani, sans-serif`, glow: '#ff8a1a' });
  }, true);
  // 8: a film about the koi that swim over the city
  cell(8, (W, H) => {
    c.fillStyle = lg(0, 0, W, H, [[0, '#021a3a'], [0.6, '#0a3a6a'], [1, '#02101e']]); c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(120,200,255,0.25)'; c.lineWidth = 2;
    for (let k = 0; k < 7; k++) { c.beginPath(); c.arc(170, 128, 30 + k * 22, 0, TAU); c.stroke(); }
    const koi = (x, y, rot, body, spot) => {
      c.save(); c.translate(x, y); c.rotate(rot);
      c.fillStyle = body; c.beginPath(); c.ellipse(0, 0, 58, 20, 0, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(-50, 0); c.lineTo(-86, -22); c.lineTo(-78, 0); c.lineTo(-86, 22); c.closePath(); c.fill();
      c.fillStyle = spot; c.beginPath(); c.ellipse(14, -4, 18, 10, 0.3, 0, TAU); c.fill(); c.beginPath(); c.ellipse(-18, 5, 12, 7, 0, 0, TAU); c.fill();
      c.restore();
    };
    koi(150, 88, 0.5, '#f4f0ea', '#e8321e'); koi(196, 176, -2.6, '#ffc21a', '#ff8a1a');
    text('KOI', 380, 96, 110, '#ffffff', { font: 'italic 700 110px Rajdhani, sans-serif', glow: '#35c8ff', stroke: '#02203a', sw: 6 });
    text(T('東京 9.25', 'IN CINEMAS 9.25'), 380, 180, 36, '#ffe86a', { maxW: 230 });
    text('NOW SHOWING', 380, 224, 22, '#9ad8ff', { font: '700 22px Rajdhani, sans-serif' });
  });
  // 9: a telephone, new
  cell(9, (W, H) => {
    c.fillStyle = lg(0, 0, W, H, [[0, '#0ad0c8'], [1, '#0a3a8a']]); c.fillRect(0, 0, W, H);
    for (let k = 0; k < 12; k++) { c.fillStyle = 'rgba(255,255,255,0.08)'; c.beginPath(); c.arc(90, 128, 20 + k * 18, 0, TAU); c.fill(); }
    c.save(); c.translate(96, 128); c.rotate(-0.18);
    c.fillStyle = '#10141c'; c.beginPath(); if (c.roundRect) c.roundRect(-46, -96, 92, 192, 16); else c.rect(-46, -96, 92, 192); c.fill();
    c.fillStyle = lg(0, -86, 0, 86, [[0, '#ff4fd8'], [0.5, '#7a5cff'], [1, '#35e8ff']]); c.fillRect(-40, -86, 80, 172);
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, -20, 18, 0, TAU); c.fill();
    c.restore();
    text('NEO PHONE 7', 330, 90, 58, '#ffffff', { font: '700 58px Rajdhani, sans-serif', maxW: 300 });
    text(T('新発売', 'OUT NOW'), 330, 160, 44, '#fff27a', { maxW: 220 });
    text('¥98,000', 330, 214, 30, '#ffffff', { font: '700 30px Rajdhani, sans-serif' });
  });
  // 10: Fuji at dawn, a trip out of the city
  cell(10, (W, H) => {
    c.fillStyle = lg(0, 0, 0, H, [[0, '#2a1a6a'], [0.45, '#ff7a6a'], [0.75, '#ffd07a'], [1, '#ffe8b0']]); c.fillRect(0, 0, W, H);
    c.fillStyle = '#ffe8a0'; c.beginPath(); c.arc(360, 150, 44, 0, TAU); c.fill();
    c.fillStyle = '#3a3a7a'; c.beginPath(); c.moveTo(20, H); c.lineTo(230, 70); c.lineTo(250, 66); c.lineTo(270, 72); c.lineTo(480, H); c.closePath(); c.fill();
    c.fillStyle = '#f4f4ff'; c.beginPath(); c.moveTo(196, 100); c.lineTo(230, 70); c.lineTo(250, 66); c.lineTo(270, 72); c.lineTo(306, 104); c.lineTo(282, 96); c.lineTo(262, 110); c.lineTo(244, 94); c.lineTo(222, 108); c.closePath(); c.fill();
    text(T('富士山', 'MT FUJI'), 100, 62, 56, '#ffffff', { stroke: '#2a1a6a', sw: 6, maxW: 180 });
    text('LIMITED EXPRESS', 400, 224, 24, '#2a1a6a', { font: '700 24px Rajdhani, sans-serif' });
  });
  // 11: an energy drink
  cell(11, (W, H) => {
    c.fillStyle = '#0a0a0e'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#46ff7a'; c.lineWidth = 3; for (let k = 0; k < 9; k++) { c.beginPath(); c.moveTo(0, 30 + k * 26); c.lineTo(W, 10 + k * 26); c.stroke(); }
    c.fillStyle = '#ffe23a'; c.beginPath(); c.moveTo(120, 20); c.lineTo(60, 140); c.lineTo(110, 140); c.lineTo(80, 236); c.lineTo(180, 100); c.lineTo(128, 100); c.lineTo(170, 20); c.closePath(); c.fill();
    text('DRIFT', 340, 90, 110, '#46ff7a', { font: 'italic 700 110px Rajdhani, sans-serif', glow: '#46ff7a', stroke: '#002a10', sw: 6, maxW: 300 });
    text('ENERGY  ¥200', 340, 190, 36, '#ffffff', { font: '700 36px Rajdhani, sans-serif' });
  });
  // 15 (portrait): ramen down a red screen, the bowl on top
  cell(15, (W, H) => {
    c.fillStyle = lg(0, 0, 0, H, [[0, '#f43c24'], [1, '#9a1008']]); c.fillRect(0, 0, W, H);
    c.fillStyle = '#ffd43a'; c.beginPath(); c.arc(W / 2, 80, 60, 0, TAU); c.fill();
    c.fillStyle = '#b8140e'; c.beginPath(); c.moveTo(W / 2 - 44, 74); c.quadraticCurveTo(W / 2, 140, W / 2 + 44, 74); c.closePath(); c.fill();
    c.strokeStyle = '#6a3a16'; c.lineWidth = 5; c.beginPath(); c.moveTo(W / 2 + 6, 70); c.lineTo(W / 2 + 50, 26); c.stroke();
    [...T('ラーメン', 'RAMEN')].forEach((t, i) => text(t, W / 2, 190 + i * 82, 76, '#fff7ea', { stroke: '#6e0804', sw: 8, rot: t === 'ー' ? Math.PI / 2 : 0 }));
  }, true);
  // 16 (portrait): sushi, a fish over the characters
  cell(16, (W, H) => {
    c.fillStyle = lg(0, 0, 0, H, [[0, '#f6fcff'], [1, '#c8dcea']]); c.fillRect(0, 0, W, H);
    c.fillStyle = '#16b8f4'; c.fillRect(0, 0, 18, H); c.fillRect(W - 18, 0, 18, H);
    c.fillStyle = '#12306e'; c.beginPath(); c.ellipse(W / 2, 90, 70, 28, 0, 0, TAU); c.fill(); c.beginPath(); c.moveTo(W / 2 + 60, 90); c.lineTo(W / 2 + 96, 62); c.lineTo(W / 2 + 96, 118); c.closePath(); c.fill();
    text(T('寿', 'SU'), W / 2, 230, 120, '#12306e');
    text(T('司', 'SHI'), W / 2, 356, 120, '#12306e');
    c.fillStyle = '#d8231c'; c.fillRect(30, 440, W - 60, 50);
    text('SUSHI', W / 2, 466, 36, '#ffffff', { font: '700 36px Rajdhani, sans-serif' });
  }, true);
  // 17 (portrait): a love hotel, a heart and the moon
  cell(17, (W, H) => {
    c.fillStyle = lg(0, 0, 0, H, [[0, '#2a0a3a'], [1, '#0a0412']]); c.fillRect(0, 0, W, H);
    c.fillStyle = '#ff3a8a'; c.shadowColor = '#ff3a8a'; c.shadowBlur = 24;
    c.beginPath(); c.moveTo(W / 2, 150); c.bezierCurveTo(W / 2 - 90, 90, W / 2 - 60, 20, W / 2, 60); c.bezierCurveTo(W / 2 + 60, 20, W / 2 + 90, 90, W / 2, 150); c.fill(); c.shadowBlur = 0;
    [...T('ホテル', 'HOTEL')].forEach((t, i) => text(t, W / 2, 230 + i * 92, 84, '#ffd6f4', { fam: ROUND, weight: '800', glow: '#b45cff', blur: 22 }));
  }, true);
  // 18 (portrait): the soda's can, standing tall
  cell(18, (W, H) => {
    c.fillStyle = lg(0, 0, W, 0, [[0, '#a8000e'], [1, '#ff1f2e']]); c.fillRect(0, 0, W, H);
    const cx = W / 2;
    c.fillStyle = lg(cx - 70, 0, cx + 70, 0, [[0, '#8a0a10'], [0.35, '#ff5a5a'], [0.55, '#ffd0d0'], [0.7, '#e01020'], [1, '#6a0008']]); c.fillRect(cx - 70, 110, 140, 280);
    c.fillStyle = lg(cx - 66, 0, cx + 66, 0, [[0, '#6a6e76'], [0.5, '#f2f4f8'], [1, '#5a5e66']]); c.fillRect(cx - 66, 92, 132, 22); c.fillRect(cx - 66, 386, 132, 18);
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(cx - 70, 260); c.bezierCurveTo(cx - 20, 220, cx + 20, 300, cx + 70, 250); c.lineTo(cx + 70, 280); c.bezierCurveTo(cx + 20, 330, cx - 20, 250, cx - 70, 292); c.closePath(); c.fill();
    text('NEO', cx, 190, 60, '#ffffff', { font: 'italic 700 60px Rajdhani, sans-serif' });
    text('COLA', cx, 50, 60, '#ffffff', { font: 'italic 700 60px Rajdhani, sans-serif', stroke: '#5a0006', sw: 6 });
    text(T('新発売', 'NEW'), cx, 460, 50, '#ffe23a', { maxW: W - 30 });
  }, true);
  // 19: the two arch signs, 512 x 128 each: a red board and a blue one, a row of bulbs round each
  cell(19, (W, H) => {
    for (const [k, bg, name, sub] of [[0, '#c8101e', T('ネオ東京 一番街', 'NEO TOKYO 1st ST'), 'NEO TOKYO ICHIBANGAI'], [1, '#12308a', T('銀座 商店街', 'GINZA ARCADE'), 'GINZA SHOTENGAI']]) {
      const y = k * 128;
      c.fillStyle = '#d8b04a'; c.fillRect(0, y, W, 128);
      c.fillStyle = bg; c.fillRect(8, y + 8, W - 16, 112);
      text(name, W / 2, y + 56, 60, '#ffffff', { stroke: 'rgba(0,0,0,0.5)', sw: 6, maxW: W - 60 });
      text(sub, W / 2, y + 100, 18, '#ffe9a0', { font: `700 18px Rajdhani, sans-serif` });
    }
  });
  // the tickers: news in Japanese, and the markets
  {
    const y0 = 1280;
    c.fillStyle = '#10101a'; c.fillRect(0, y0, AW, 128);
    c.fillStyle = '#e8101e'; c.fillRect(0, y0 + 4, AW, 6); c.fillRect(0, y0 + 118, AW, 6);
    const items = jp ? ['ネオ東京', 'ネオ高速 環状線', '銀座 2km', '大売出し 50%OFF', '新発売 NEO COLA', 'ラーメン ¥780']
      : ['NEO TOKYO', 'EXPWY C1', 'GINZA 2km', 'BIG SALE 50%', 'NEW NEO COLA', 'RAMEN ¥780'];
    c.font = '58px ' + JP;
    const widths = items.map((s) => c.measureText(s).width);
    const gap = 60, total = Math.max(AW, widths.reduce((a, b) => a + b, 0) + gap * items.length);
    c.save(); c.translate(0, y0); c.scale(AW / total, 1);
    let x = 0;
    items.forEach((s, i) => {
      c.fillStyle = i % 2 ? '#ffe23a' : '#ffffff'; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText(s, x, 66);
      x += widths[i];
      c.fillStyle = '#ff3a2a'; c.beginPath(); c.moveTo(x + gap / 2, 44); c.lineTo(x + gap / 2 + 14, 66); c.lineTo(x + gap / 2, 88); c.lineTo(x + gap / 2 - 14, 66); c.closePath(); c.fill();
      x += gap;
    });
    c.restore();
    const y1 = 1408;
    c.fillStyle = '#020604'; c.fillRect(0, y1, AW, 128);
    const mk = [['NIKKEI 38,420', '+1.2%', 1], ['USD/JPY 148.20', '-0.3%', 0], ['NEO-TECH 4,210', '+5.4%', 1], ['SAKURA HVY 1,188', '-0.6%', 0], ['KOI MOTORS 7,760', '+2.1%', 1]];
    c.font = '700 58px Rajdhani, sans-serif';
    const parts = mk.map(([a, b]) => c.measureText(a + '  ' + b).width + 90);
    const tot = Math.max(AW, parts.reduce((a, b) => a + b, 0));
    c.save(); c.translate(0, y1); c.scale(AW / tot, 1);
    let xx = 0;
    mk.forEach(([a, b, up], i) => {
      c.textBaseline = 'middle'; c.textAlign = 'left';
      c.fillStyle = '#e8f0ff'; c.fillText(a, xx, 66);
      const wa = c.measureText(a + '  ').width;
      c.fillStyle = up ? '#46ff7a' : '#ff3a3a'; c.fillText(b, xx + wa, 66);
      c.beginPath(); const tx = xx + wa + c.measureText(b).width + 26; if (up) { c.moveTo(tx, 80); c.lineTo(tx + 14, 52); c.lineTo(tx + 28, 80); } else { c.moveTo(tx, 52); c.lineTo(tx + 14, 80); c.lineTo(tx + 28, 52); } c.closePath(); c.fill();
      xx += parts[i];
    });
    c.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.name = 'ad atlas'; tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 8;
  return tex;
}

// ---------------------------------------------------------------- the screens' material

const SCREEN_PARS = /* glsl */`
uniform float uTime;
uniform float uNight;
flat varying vec4 vScr;
float scH(float n) { return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }
// a cell of the ad atlas (4 x 6 cells of 512 x 256, rows counted from the top); q over the cell, y up
const vec2 SC = vec2(0.25, 1.0 / 6.0);
vec2 scCell(float k, vec2 q) {
  q = clamp(q, vec2(0.003, 0.006), vec2(0.997, 0.994));
  float cx = mod(k, 4.0), cy = floor(k / 4.0);
  return vec2((cx + q.x) * SC.x, 1.0 - (cy + 1.0 - q.y) * SC.y);
}
vec3 scTicker(float strip, vec2 q, float aspect, float T, vec2 gx, vec2 gy) {
  float u = fract(q.x * aspect / 16.0 + T * 0.028);
  vec2 t = vec2(u, (1.0 - strip) / 12.0 + clamp(q.y, 0.02, 0.98) / 12.0);
  return textureGrad(map, t, gx * vec2(aspect / 16.0, 1.0 / 12.0), gy * vec2(aspect / 16.0, 1.0 / 12.0)).rgb;
}`;

const SCREEN_MAIN = /* glsl */`
{
  vec2 uv = vMapUv;
  float seed = vScr.x, sW = vScr.y, sH = vScr.z, kind = vScr.w;
  float T = uTime + seed * 37.0;
  // up close the picture is sampled once per LED, and the LEDs show as round dots
  vec2 cells = vec2(sW, sH) / 0.055;
  vec2 lp = uv * cells;
  vec2 dl = fwidth(lp);
  float led = kind > 2.5 ? 0.0 : 1.0 - smoothstep(0.22, 0.55, max(dl.x, dl.y));
  vec2 q = mix(uv, (floor(lp) + 0.5) / cells, led);
  vec2 gx = dFdx(uv), gy = dFdy(uv);
  vec3 col;
  if (kind > 5.5) {
    // a lamp's lens: plain light, a little warmer at its edge
    col = mix(vec3(1.0, 0.92, 0.8), vec3(1.0), smoothstep(0.0, 0.35, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)))) * 1.3;
  } else if (kind > 4.5) {
    // a skybridge's glass: the walkway lit cool white, its ceiling lamps, the mullions and the handrail, and people
    // crossing, dark against the light, each at their own pace one way or the other
    float x = uv.x * sW, y = uv.y * sH;
    vec2 fw2 = max(fwidth(vec2(x, y)), vec2(1e-3));
    col = vec3(0.62, 0.7, 0.86) * (0.62 + 0.38 * smoothstep(0.0, sH, y));
    col += vec3(1.2) * (1.0 - smoothstep(0.0, 0.08 + fw2.y, abs(y - sH + 0.12))) * step(0.5, fract(x / 2.0));
    float fig = 0.0;
    for (int i = 0; i < 7; i++) {
      float fi = float(i);
      float sp = (0.9 + 0.8 * scH(seed + fi * 3.1)) * (scH(seed + fi * 7.7) < 0.5 ? -1.0 : 1.0);
      float px = mod(scH(seed + fi * 1.3) * sW + T * sp, sW + 2.0) - 1.0;
      float h = 1.55 + 0.25 * scH(seed + fi * 5.3);
      float bob = abs(sin(T * 4.0 * abs(sp) + fi)) * 0.04;
      vec2 d = vec2(x - px, y - bob);
      float head = 1.0 - smoothstep(0.11 - fw2.x, 0.11 + fw2.x, length(d - vec2(0.0, h)));
      float body = (1.0 - smoothstep(0.2 - fw2.x, 0.2 + fw2.x, abs(d.x))) * step(0.55, d.y) * step(d.y, h - 0.12);
      float legs = (1.0 - smoothstep(0.07 - fw2.x, 0.07 + fw2.x, abs(abs(d.x) - 0.08 * (1.0 - d.y / 0.55) * sin(T * 6.0 * abs(sp) + fi) - 0.06))) * step(d.y, 0.56);
      fig = max(fig, max(head, max(body, legs)));
    }
    col = mix(col, vec3(0.06, 0.06, 0.09), fig);
    float mull = 1.0 - smoothstep(0.04, 0.04 + fw2.x, abs(fract(x / 1.6 + 0.5) - 0.5) * 1.6);
    col = mix(col, vec3(0.05), max(mull, (1.0 - smoothstep(0.03, 0.03 + fw2.y, abs(y - 1.0)))));
    col *= 0.9;
  } else if (kind > 2.5) {
    // an arch's sign: a lit panel, bulbs chasing round its edge
    float k = kind - 3.0;
    vec2 a = vec2(q.x, (1.0 - k) * 0.5 + q.y * 0.5);
    col = textureGrad(map, scCell(19.0, a), gx * SC * vec2(1.0, 0.5), gy * SC * vec2(1.0, 0.5)).rgb * 1.25;
    vec2 e = vec2(min(uv.x, 1.0 - uv.x) * sW, min(uv.y, 1.0 - uv.y) * sH);
    float edge = min(e.x, e.y);
    float along = uv.x * sW + uv.y * sH * (uv.x > 0.5 ? -1.0 : 1.0);
    vec2 bc = vec2(fract(along / 0.3) - 0.5, (edge - 0.05) / 0.3);
    float bulb = (1.0 - smoothstep(0.18, 0.3, length(bc))) * step(edge, 0.12);
    float chase = step(0.5, fract(along / 0.9 - T * 1.6));
    col = mix(col, mix(vec3(1.0, 0.78, 0.35), vec3(1.0, 0.95, 0.8), chase) * (1.2 + 1.8 * chase), bulb);
  } else if (kind > 1.5) {
    col = scTicker(mod(floor(seed * 7.0), 2.0), q, sW / sH, T, gx, gy) * 1.2;
  } else {
    float period = 7.0 + 4.0 * scH(seed + 0.3);
    float slot = floor(T / period), ph = fract(T / period);
    float r = scH(slot * 1.73 + seed * 3.1);
    float portrait = step(1.5, sH / max(sW, 0.01));
    float ad = portrait > 0.5 ? 12.0 + floor(r * 6.999) : floor(r * 11.999);
    // a slow push in over the ad's time on the screen
    float z = 1.0 + 0.06 * ph;
    vec2 a = (q - 0.5) / z + 0.5;
    vec2 cq = portrait > 0.5 ? vec2(a.y, 1.0 - a.x) : a;
    vec2 cgx = portrait > 0.5 ? vec2(gx.y, -gx.x) : gx, cgy = portrait > 0.5 ? vec2(gy.y, -gy.x) : gy;
    col = textureGrad(map, scCell(ad, cq), cgx * SC / z, cgy * SC / z).rgb;
    if (ad < 0.5) {
      // the logo: a shine sweeping across
      col += vec3(0.7) * (1.0 - smoothstep(0.0, 0.05, abs(a.x + a.y * 0.4 - fract(T * 0.23) * 2.2 + 0.4)));
    } else if (ad < 1.5) {
      // the soda: bubbles rising
      vec2 bq = vec2(a.x * 14.0, a.y * 7.0 - T * 1.4);
      vec2 bi = floor(bq), bf = fract(bq) - 0.5;
      float br = length(bf);
      col += vec3(0.8) * step(0.62, scH(bi.x * 7.1 + bi.y * 13.7 + seed)) * (smoothstep(0.3, 0.24, br) - smoothstep(0.2, 0.14, br));
    } else if (ad < 2.5) {
      col *= 0.8 + 0.35 * (0.5 + 0.5 * sin(T * 7.0));
    } else if (ad < 3.5) {
      // steam off the bowl
      float st = sin(a.y * 26.0 - T * 4.0 + sin(a.x * 30.0 + T) * 1.5) * smoothstep(0.55, 0.9, a.y) * (1.0 - smoothstep(0.1, 0.25, abs(a.x - 0.3)));
      col += vec3(0.35) * max(st, 0.0);
    } else if (ad < 4.5) {
      col *= a.y < 0.2 ? step(0.45, fract(T * 1.3)) * 0.8 + 0.2 : 1.0;
    } else if (ad < 5.5) {
      float row = floor(a.y * 40.0);
      col += vec3(0.9, 0.8, 1.0) * step(0.9, scH(row + seed * 5.0)) * step(0.7, fract(a.x * 1.5 + T * 2.5 + scH(row * 3.1)));
    } else if (ad < 6.5) {
      col = mix(col, vec3(1.0) - col, step(0.5, fract(T * 2.0)) * step(ph, 0.3));
    } else if (ad < 7.5) {
      if (a.y < 0.19) col = scTicker(0.0, vec2(a.x, a.y / 0.19), sW / (sH * 0.19), T, gx, gy / 0.19);
    }
    // the change of ad: a bright bar wipes the new one in from the left
    float wipe = ph / 0.035;
    if (wipe < 1.0) {
      col *= mix(1.0, 0.12, step(wipe, uv.x));
      col += vec3(2.2) * (1.0 - smoothstep(0.0, 0.025, abs(uv.x - wipe)));
    }
  }
  // the LEDs themselves, and the dark gaps between them, up close
  vec2 f = fract(lp) - 0.5;
  float dotK = 1.0 - smoothstep(0.32, 0.46, length(f));
  col *= mix(1.0, 0.25 + 1.05 * dotK, led);
  col *= mix(1.15, 1.75, uNight);
  diffuseColor.rgb = col;
}`;

function screenMaterial(tex) {
  // (a screen is a centimetre in front of its housing: biased toward the lens, so the two never flicker far off)
  const m = new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  m.name = 'city screens';
  m.userData.uTime = { value: 0 };
  m.userData.uNight = { value: 1 };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = m.userData.uTime;
    shader.uniforms.uNight = m.userData.uNight;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aScr;\nflat varying vec4 vScr;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvScr = aScr;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\n' + SCREEN_PARS)
      .replace('#include <map_fragment>', SCREEN_MAIN);
  };
  m.customProgramCacheKey = () => 'city-screen1';
  return m;
}

// ---------------------------------------------------------------- the wires' material

function cableMaterial() {
  const m = new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: /* glsl */`
      attribute vec3 aDir;
      attribute float aSide;
      attribute float aThick;
      varying float vA;
      varying float vS;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec3 toCam = cameraPosition - wp.xyz;
        float d = length(toCam);
        vec3 side = cross(aDir, toCam);
        float sl = length(side);
        side = sl > 1e-6 ? side / sl : vec3(0.0, 1.0, 0.0);
        // never thinner than about a pixel and a half at 720 lines; a thin wire drawn wider is drawn fainter
        float minW = 0.0027 * d;
        float wv = max(aThick, minW);
        wp.xyz += side * (0.5 * wv * aSide);
        vA = (1.0 - smoothstep(150.0, 260.0, d)) * clamp(aThick / minW + 0.5, 0.5, 1.0);
        vS = aSide;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      varying float vS;
      void main() {
        float e = vS * vS;
        gl_FragColor = vec4(vec3(0.016, 0.017, 0.022) * (1.0 - 0.4 * e), vA * (1.0 - 0.35 * e * e));
      }`,
    transparent: true, depthWrite: false,
  });
  m.name = 'city wires';
  return m;
}

// ---------------------------------------------------------------- the pavement's material

function pavementMaterial() {
  // 2.8 m across (the kerb at the left) by 5.6 m along, 256 x 512
  const W = 256, H = 512, PX = W / 2.8;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const rnd = mulberry32(77);
  c.fillStyle = '#6f6c68'; c.fillRect(0, 0, W, H);
  // pavers: running bond, 20 x 10 cm, warm grey with bands of a redder brick
  const bw = 0.2 * PX, bh = 0.1 * PX;
  for (let j = 0, y = 0; y < H; j++, y += bh) {
    for (let x = 0.3 * PX + ((j % 2) ? bw / 2 : 0) - bw; x < W; x += bw) {
      const band = Math.floor(y / (1.4 * PX)) % 2 === 1 && x > 1.35 * PX;
      const v = 0.85 + rnd() * 0.3;
      const base = band ? [0x8a, 0x6c, 0x62] : [0x86, 0x83, 0x7e];
      c.fillStyle = `rgb(${base.map((b) => Math.round(b * v)).join(',')})`;
      c.fillRect(x + 1, y + 1, bw - 2, bh - 2);
    }
  }
  // the tactile strip: yellow blocks with raised dots, 30 cm wide, a metre from the kerb
  const tx0 = 0.95 * PX, tw = 0.3 * PX;
  for (let y = 0; y < H; y += tw) {
    c.fillStyle = '#d9b21e'; c.fillRect(tx0 + 1, y + 1, tw - 2, tw - 2);
    c.fillStyle = '#f0cc3a';
    for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) { c.beginPath(); c.arc(tx0 + (a + 0.5) * tw / 5, y + (b + 0.5) * tw / 5, 1.8, 0, TAU); c.fill(); }
  }
  // the kerb stones: pale concrete, a metre long, and the gutter joint behind them
  for (let y = 0; y < H; y += PX) {
    const v = 0.9 + rnd() * 0.15;
    c.fillStyle = `rgb(${Math.round(0xb4 * v)},${Math.round(0xb0 * v)},${Math.round(0xa8 * v)})`; c.fillRect(0, y + 1, 0.2 * PX, PX - 2);
  }
  c.fillStyle = '#3e3c3a'; c.fillRect(0.2 * PX, 0, 3, H);
  // grime: blotches and gum spots
  for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(20,18,16,${0.05 + rnd() * 0.1})`; c.beginPath(); c.arc(0.25 * PX + rnd() * (W - 0.25 * PX), rnd() * H, 2 + rnd() * 9, 0, TAU); c.fill(); }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 8;
  tex.name = 'pavement';
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  m.name = 'city pavement';
  return m;
}

// ---------------------------------------------------------------- load, update

export function detailLoad(w, Pool) {
  w.detail = { phone: !!(w.q && w.q.trees < 1), stats: { poles: 0, spans: 0, drops: 0, cross: 0, crossTry: 0, strings: 0, arches: 0, towers: 0, screens: 0, billboards: 0 } };
  w.screenMat = screenMaterial(adAtlas(w));
  w.cableMat = cableMaterial();
  w.paveMat = pavementMaterial();
  // the elevated railway's train (citytrain.js): a pool of its own, whose instanced programs compile with the rest
  if (Pool) railLoad(w, Pool);
  return [w.screenMat, w.cableMat, w.paveMat];
}

const SCREEN_COLOURS = [0xff4fb0, 0x35d8ff, 0xffb13a, 0x8a5cff, 0x46ff9a, 0xff3a3a, 0xfff0d0];

/** Every frame: the screens' clock, the night, and the colour of the light the nearest screens throw. */
export function detailUpdate(w, t) {
  if (!w.screenMat) return;
  w.screenMat.userData.uTime.value = t;
  const n = w.bldgMat && w.bldgMat.userData.uNight ? w.bldgMat.userData.uNight.value : 1;
  w.screenMat.userData.uNight.value = n;
  // the lamps a screen lends the street change colour with its ads (a lamp only takes colour when it changes)
  for (const l of w.lamps) if (l.screen) l.color = SCREEN_COLOURS[Math.floor(((t + l.screen * 37) / l.period) % SCREEN_COLOURS.length)];
  railUpdate(w, t);
  // a chunk's wires and pavement are not drawn beyond where they still show (the wires have faded out by then, and
  // the pavement is finer than the pixels): their draws are saved for the near street
  if (w.chunks && w.citySky) {
    const cam = w.citySky.position;
    for (const ch of w.chunks.values()) {
      if (!ch.cvFar) continue;
      for (const [m, far] of ch.cvFar) {
        const b = m.geometry.boundingSphere;
        if (b) m.visible = Math.hypot(b.center.x - cam.x, b.center.z - cam.z) - b.radius < far;
      }
    }
  }
}

/** How wet the pavement is. */
export function detailWet(w, wet) {
  if (w.paveMat) w.paveMat.roughness = 0.88 - 0.6 * wet;
}

// ---------------------------------------------------------------- per chunk

/**
 * The set pieces over a chunk's street, from a seed of their own so a neighbouring chunk can ask about them (its
 * wires must not run through them): a shopping street (an arch, and strings of lanterns every 10 m behind it for
 * as long as the street runs straight) and a glazed skybridge between the fronts across the street. CH: samples a
 * chunk. Null until the chunk's road is final.
 */
function streetPieces(w, c, CH) {
  const t = w.track;
  if (w.detail.piecesOf !== t) { w.detail.pieces = new Map(); w.detail.piecesOf = t; }
  const cache = w.detail.pieces;
  if (cache.has(c)) return cache.get(c);
  if ((c + 1) * CH >= t.nFinal || c < 0) return null;
  const s0 = t.pts[c * CH].s, s1 = t.pts[(c + 1) * CH].s;
  const rng = mulberry32((w.seed * 7919 + c * 104723 + 5) >>> 0);
  // (plain road: straight, no ramp or lay-by, and no railway viaduct on either side)
  const plain = (s) => { const p = t.sample(s); return !(p.tunnel || t.nearTunnel(p.s, 10) || p.express || Math.abs(p.k) > 1 / 200 || t.markerAt(p.s, 1) || t.markerAt(p.s, -1) || t.padAt(p.s, 1) || t.padAt(p.s, -1) || railSkip(w, s, 1, 0) || railSkip(w, s, -1, 0)); };
  const lampClear = (s, d) => { const m = ((s % 30) + 30) % 30; return m > d && m < 30 - d; };
  const P = { arch: null, bridge: null };
  if (rng() < (w.detail.phone ? 0.25 : 0.42) && w.pools.chochin) {
    const start = s0 + 8 + rng() * Math.max(0, s1 - s0 - 40);
    let ok = start > 40;
    for (let s = start - 8; ok && s <= start + 10; s += 3) if (!plain(s)) ok = false;
    if (ok) {
      const strings = [];
      for (let d = 9; d < 60 && plain(start + d) && plain(start + d + 3) && plain(start + d - 3); d += 10) strings.push(start + d);
      P.arch = { start, strings };
    }
  }
  if (rng() < (w.detail.phone ? 0.16 : 0.26)) {
    const sb = s0 + 10 + rng() * Math.max(0, s1 - s0 - 20);
    let ok = sb > 60 && lampClear(sb, 4.5);
    for (let s = sb - 8; ok && s <= sb + 8; s += 4) if (!plain(s)) ok = false;
    if (ok && P.arch && sb > P.arch.start - 12 && sb < (P.arch.strings.length ? P.arch.strings[P.arch.strings.length - 1] : P.arch.start) + 12) ok = false;
    if (ok) P.bridge = { s: sb };
  }
  cache.set(c, P);
  return P;
}

/** The posts of the shopping streets' arches in chunk c and either side of it, [x, z] each (so the pavement keeps clear). */
export function archPosts(w, c, CH) {
  const t = w.track, out = [];
  for (let k = c - 1; k <= c + 1; k++) {
    const P = streetPieces(w, k, CH); if (!P || !P.arch) continue;
    const p = t.sample(P.arch.start), lx = Math.cos(p.h), lz = -Math.sin(p.h);
    for (const u of [p.wl + 2.62, -(p.wr + 2.62)]) out.push([p.x + lx * u, p.z + lz * u]);
  }
  return out;
}

/** Whether anything over the street stands between s0 and s1 (an arch, a skybridge), with margin m. */
function overStreet(w, c, CH, a, b, m) {
  const lo = Math.min(a, b) - m, hi = Math.max(a, b) + m;
  for (let k = c - 1; k <= c + 1; k++) {
    const P = streetPieces(w, k, CH); if (!P) continue;
    if (P.arch && P.arch.start > lo - 0.5 && P.arch.start < hi + 0.5) return true;
    if (P.bridge && P.bridge.s > lo - 3.9 && P.bridge.s < hi + 3.9) return true;      // (it may move 2 m to find its fronts)
  }
  return false;
}

export function detailBegin(w, ch, lists) {
  const CH = ch.i1 - ch.i0;
  const pieces = streetPieces(w, ch.c, CH) || { arch: null, bridge: null };
  const D = {
    rng: mulberry32((w.seed * 577 + ch.c * 1291 + 17) >>> 0), CH,
    lots: [], screens: new Geo({ position: 3, uv: 2, aScr: 4 }), towers: [], lights: [],
    housings: lists.housings, glows: lists.glows, streaks: lists.streaks, boards: lists.boards || null, arch: pieces.arch, bridge: pieces.bridge,
  };
  D.screen = (c, n, w0, h, seed, kind) => screenQuad(D.screens, c, n, w0, h, seed, kind);
  D.lamp = (c, ax, az, w0, d0) => {
    const G = D.screens, S = [0.5, w0, d0, 6];
    const P = (a, b) => [c[0] + ax * a - az * b, c[1], c[2] + az * a + ax * b];
    const i0 = G.v(P(-w0 / 2, -d0 / 2), [0, 0], S), i1 = G.v(P(w0 / 2, -d0 / 2), [1, 0], S), i2 = G.v(P(w0 / 2, d0 / 2), [1, 1], S), i3 = G.v(P(-w0 / 2, d0 / 2), [0, 1], S);
    G.i.push(i0, i1, i2, i0, i2, i3, i0, i2, i1, i0, i3, i2);                  // (both faces: it is seen from below and from the side)
  };
  if (D.arch) w.detail.stats.arches++;
  return D;
}

/**
 * A lot's screens, decided before its clutter: returns what the clutter must leave free on the front (in the
 * lot's own metres: x along the front from its middle, heights above the pavement) and on the roof.
 */
export function detailLot(w, D, lot) {
  const r = D.rng, phone = w.detail.phone;
  const clear = { boxes: [], roof: false };
  D.lots.push(lot);
  if (D.arch && !lot.up) {
    const dx = D.arch.start - lot.s;
    if (Math.abs(dx) < lot.W / 2 + 0.6) clear.boxes.push([dx - 0.9, dx + 0.9, -1, 9]);
    // (a string may move up to 3 m to find fronts on both sides)
    for (const s of D.arch.strings) { const d = s - lot.s; if (Math.abs(d) < lot.W / 2 + 3.6) clear.boxes.push([d - 3.6, d + 3.6, 4.6, 6.8]); }
  }
  if (D.bridge && !lot.up) {
    const d = D.bridge.s - lot.s;
    if (Math.abs(d) < lot.W / 2 + 4.5) clear.boxes.push([d - 4.6, d + 4.6, 4.2, 9.4]);
  }
  const W = lot.W, H = lot.H;
  const side = lot.side;
  const f = [lot.fx, lot.fz], out = [-lot.lx, -lot.lz];
  const P = (x, u, y) => [lot.x + f[0] * x + out[0] * u, lot.y + y, lot.z + f[1] * x + out[1] * u];     // along, out from the front, up
  const seed = () => Math.floor(r() * 997) + 0.5;
  const near = (x) => { for (const q of D.towers) if (Math.abs((lot.x + f[0] * x - q[0]) * f[0] + (lot.z + f[1] * x - q[1]) * f[1]) < 2.5 && Math.hypot(lot.x + f[0] * x - q[0], lot.z + f[1] * x - q[1]) < 4) return true; return false; };
  // a street lamp's head is no place for a tower
  // (the street lamps stand every 30 m along the road, their heads out over the kerb)
  const lampNear = (x) => { const m = (((lot.s + x) % 30) + 30) % 30; return m < 3.2 || m > 26.8; };
  const k = phone ? 0.55 : 1;
  // is this front the one a driver sees head on as the street turns? (the first lots on the outside past a corner)
  // (the building cut across the inside of a corner faces the crossing: it is one too)
  let corner = !!lot.chamfer;
  for (let ds = 6; ds <= 34 && !corner; ds += 4) { const q = w.track.sample(lot.s - ds); if (Math.abs(q.k) > 1 / 45 && Math.sign(q.k) !== side) corner = true; }
  // ---- a vertical LED tower standing out from the front at the end the neon sign is not at: one to three
  // screens stacked, each its own ad, lit on both faces
  if (!lot.up && H >= 12 && r() < 0.3 * k) {
    const end = lot.vEdge ? -lot.vEdge : (r() < 0.5 ? -1 : 1);
    const x = end * (W / 2 - 0.65);
    const tw = 1.55 + r() * 0.35, y0 = 4.6 + r() * 0.8, seg = 2 * tw, gap = 0.28;
    let n = H >= 30 ? 3 : H >= 19 ? 2 : 1;
    if (n > 1 && r() < 0.3) n--;
    while (n > 1 && y0 + n * seg + (n - 1) * gap > H + 2.5) n--;
    const th = n * seg + (n - 1) * gap;
    if (y0 + th <= H + 2.5 && !lampNear(x) && !near(x)) {
      const s = seed(), u0 = 0.25, u1 = u0 + tw;
      // both faces: one toward the traffic coming up the street, one toward the traffic going away
      const nA = [-f[0], -f[1]], nB = [f[0], f[1]];
      for (let j = 0; j < n; j++) {
        const yb = y0 + j * (seg + gap);
        for (const [nn, dz] of [[nA, -0.19], [nB, 0.19]]) screenQuad(D.screens, P(x + dz, (u0 + u1) / 2, yb), nn, tw, seg, s + j * 0.31 + (dz > 0 ? 0.17 : 0), 1);
      }
      D.housings.push(box(P(x, (u0 + u1) / 2, y0 + th / 2), [out[0], out[1]], tw + 0.16, th + 0.24, 0.36));
      for (let yb = y0 + 1; yb < Math.min(H - 0.5, y0 + th); yb += 3) D.housings.push(box(P(x, u0 / 2 + 0.02, yb), [out[0], out[1]], u0 + 0.04, 0.12, 0.12));
      clear.boxes.push([x - 0.7, x + 0.7, y0 - 0.6, 999]);
      const c = SCREEN_COLOURS[Math.floor(r() * SCREEN_COLOURS.length)];
      const g = P(x, u1 + 1.2, 0);
      D.glows.push([g[0], g[2], f[0], f[1], 5, 5, c]);
      D.towers.push([P(x, 0, 0)[0], P(x, 0, 0)[2]]);
      D.lights.push({ x: P(x, u1, 0)[0], y: lot.y + y0 + 1, z: P(x, u1, 0)[2], s, colour: c, streak: true, ls: lot.s + x * 1, side, wall: lot.wall });
    }
  }
  // ---- a big screen on the upper floors of a tall building, and on most fronts that face the street head on
  if ((H >= 20 || (corner && H >= 11)) && W >= (lot.chamfer ? 6 : 7.5) && r() < (corner ? 0.8 : lot.up ? 0.3 : 0.2) * k) {
    const sw = Math.min(W - 2.2, 6 + r() * 5), sh = sw * 0.5;
    let fl = (H >= 20 ? 1 + Math.floor(r() * 2) : 0) + (lot.up ? 3 : 0);
    if (3.95 + fl * 3.4 < (lot.hTop || 0) + 0.4) fl++;                    // above the shop's own sign
    const y0 = 3.7 + fl * 3.4 + 0.25;
    let x = (r() - 0.5) * Math.max(0, W - sw - 2.2);
    // clear of the neon sign's end and of any tower
    if (lot.vEdge && Math.abs(x + lot.vEdge * sw / 2 - lot.vEdge * (W / 2 - 0.7)) < 1.2) x -= lot.vEdge * 1.2;
    const blocked = clear.boxes.some((b) => x + sw / 2 > b[0] && x - sw / 2 < b[1]);
    if (y0 + sh < H - 1.2 && !blocked) {
      const s = seed();
      screenQuad(D.screens, P(x, 0.34, y0), out, sw, sh, s, 0);
      D.housings.push(box(P(x, 0.2, y0 + sh / 2), [f[0], f[1]], sw + 0.3, sh + 0.3, 0.26));
      // a ticker under it now and then
      if (r() < 0.5) {
        screenQuad(D.screens, P(x, 0.34, y0 - 0.95), out, sw, 0.7, s + 0.5, 2);
        D.housings.push(box(P(x, 0.2, y0 - 0.6), [f[0], f[1]], sw + 0.3, 0.9, 0.26));
      }
      clear.boxes.push([x - sw / 2 - 0.6, x + sw / 2 + 0.6, y0 - 1.6, y0 + sh + 0.6]);
      const c = SCREEN_COLOURS[Math.floor(r() * SCREEN_COLOURS.length)];
      const g = P(x, 1.4, 0);
      D.glows.push([g[0], g[2], f[0], f[1], 6, Math.max(6, sw), c]);
      D.lights.push({ x: P(x, 2.5, 0)[0], y: lot.y + y0, z: P(x, 2.5, 0)[2], s, colour: c, streak: y0 < 16, ls: lot.s + x, side, wall: lot.wall });
    }
  }
  // ---- a billboard on the roof of a lower building, turned toward the traffic coming up the street
  if (!lot.up && H >= 9 && H <= 34 && W >= 7 && r() < 0.26 * k) {
    const bw = Math.min(W - 1.4, 6 + r() * 4), bh = bw * 0.5;
    let a = 0.45 + r() * 0.2;
    // turned toward the traffic, and set back so the whole of it (and its legs) stands on the roof
    while (a > 0.1 && 1.0 + bw * Math.sin(a) > lot.D - 0.8) a -= 0.1;
    const n = norm2(out[0] * Math.cos(a) - f[0] * Math.sin(a), out[1] * Math.cos(a) - f[1] * Math.sin(a));
    const x = (r() - 0.5) * Math.max(0, W - bw * Math.cos(a) - 1), base = H + 1.6;
    const c0 = P(x, -(0.9 + (bw / 2) * Math.sin(a)), base);
    screenQuad(D.screens, c0, n, bw, bh, seed(), 0);
    const back = [c0[0] - n[0] * 0.14, c0[1] + bh / 2, c0[2] - n[1] * 0.14];
    D.housings.push(box(back, [n[1], -n[0]], bw + 0.24, bh + 0.24, 0.2));
    // the steel under it: legs, a catwalk, braces back to the roof
    const right = [n[1], -n[0]];
    for (const t of [-0.4, 0, 0.4]) {
      const lx = c0[0] + right[0] * bw * t - n[0] * 0.3, lz = c0[2] + right[1] * bw * t - n[1] * 0.3;
      D.housings.push(box([lx, 0, lz], [right[0], right[1]], 0.14, base - H + 0.1, 0.14, lot.y + H - 0.05));
      D.housings.push(beam([lx, lot.y + H + 0.1, lz], [lx - n[0] * 1.5, lot.y + H + 0.02, lz - n[1] * 1.5], 0.1), beam([lx, lot.y + base - 0.2, lz], [lx - n[0] * 1.5, lot.y + H + 0.05, lz - n[1] * 1.5], 0.09));
    }
    D.housings.push(box([c0[0] + n[0] * 0.25, lot.y + base - 0.12, c0[2] + n[1] * 0.25], [right[0], right[1]], bw, 0.06, 0.7));
    clear.roof = true;
  }
  return clear;
}

/** A screen: bottom-middle at c, facing n (horizontal), w by h metres. kind 0 an ad, 1 a tall one, 2 a ticker, 3+ an arch. */
function screenQuad(G, c, n, w, h, seed, kind) {
  const right = [n[1], -n[0]];
  const x0 = c[0] - right[0] * w / 2, z0 = c[2] - right[1] * w / 2, x1 = c[0] + right[0] * w / 2, z1 = c[2] + right[1] * w / 2;
  const S = [seed, w, h, kind === 1 ? 0 : kind];
  const a = G.v([x0, c[1], z0], [0, 0], S), b = G.v([x1, c[1], z1], [1, 0], S), cc = G.v([x1, c[1] + h, z1], [1, 1], S), d = G.v([x0, c[1] + h, z0], [0, 1], S);
  G.quad(a, b, cc, d);
}

/** A box centred at c with its local x along the horizontal direction ax; w, h, d its size. (base: its foot's height, for a leg.) */
function box(c, ax, w, h, d, base = null) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.rotateY(Math.atan2(-ax[1], ax[0]));
  g.translate(c[0], base !== null ? base + h / 2 : c[1], c[2]);
  return g;
}

/** A square beam of side t between two points. */
function beam(p0, p1, t) {
  const d = new THREE.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
  const L = d.length();
  const g = new THREE.BoxGeometry(t, L, t);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  g.applyQuaternion(q);
  g.translate((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2);
  return g;
}

/**
 * The utility pole k (one every 34 m or so along the road), or null where none stands: at the kerb, 1.35 m back, on one
 * side of each stretch of about 200 m, only on a bend's outside, clear of corners, the expressway, lay-bys and any other
 * road's kerb zone. A function of the track alone, so a chunk can ask where its neighbours' poles stand.
 */
function poleAt(w, k, probe) {
  const t = w.track, g = w.ground;
  let s = k * 34 + (Math.sin(k * 7.13 + w.seed) * 0.5 + 0.5) * 6;
  // (the street lamps stand every 30 m: a pole keeps 4 m clear of their posts)
  const m = ((s % 30) + 30) % 30;
  if (m < 4) s += 4 - m; else if (m > 26) s -= m - 26;
  if (s < 30) return null;
  const p = t.sample(s);
  const hs = Math.sin(Math.floor(s / 200) * 12.9898 + (w.seed % 1000) * 0.37) * 43758.5453, side = hs - Math.floor(hs) < 0.5 ? 1 : -1;
  if (p.tunnel || t.nearTunnel(p.s, 16) || p.express || t.markerAt(p.s, side) || t.padAt(p.s, side)) return null;
  // on a bend only on its outside: there the wire from pole to pole cuts across over the road, on the inside it
  // would cut into the fronts
  if (Math.abs(p.k) > 1 / 55 || (Math.abs(p.k) > 1 / 400 && Math.sign(p.k) === side)) return null;
  // clear of the corners' crossings and signals, the lamps, and any other road
  const q0 = t.sample(s - 14), q1 = t.sample(s + 14);
  if (Math.abs(q0.k) > 1 / 45 || Math.abs(q1.k) > 1 / 45 || q0.express || q1.express) return null;
  const wall = side > 0 ? p.wl : p.wr;
  const lx = Math.cos(p.h) * side, lz = -Math.sin(p.h) * side, fx = Math.sin(p.h), fz = Math.cos(p.h);
  // back from the kerb: the first 1.3 m of pavement is the car's in a drift, and a pole is solid
  const x = p.x + lx * (wall + POLE_U), z = p.z + lz * (wall + POLE_U);
  g.sample(x, z, 2.2, probe);
  // (and clear of the kerb zone of any other road too, at a corner or where two streets run close)
  if (probe.edge < POLE_U - 0.03 || probe.tunnel) return null;
  return { k, s, side, x, z, y: g.height(x, z) - 0.05, lx, lz, fx, fz, h: p.h, wall, p };
}

/** Where the utility poles stand between sA and sB along the road, [x, z] each (every chunk's, built yet or not). */
export function poleSpots(w, sA, sB, CH) {
  const probe = {}, out = [], t = w.track;
  for (let k = Math.ceil((sA - 6) / 34); k <= Math.floor((sB - 6) / 34); k++) {
    const P = poleAt(w, k, probe);
    if (!P || P.s < sA || P.s >= sB) continue;
    const c = Math.floor(t.index(P.s) / CH);
    if (!overStreet(w, c, CH, P.s, P.s, 1.2)) out.push([P.x, P.z]);
  }
  return out;
}

/**
 * The rest of a chunk's detail, after its lots: the wires and their poles, the shopping street, the pavement, and the
 * screens' mesh. lists: the chunk's glows, streaks and sign housings (shared with the neon).
 */
export function* detailChunk(w, ch, D) {
  const t = w.track, g = w.ground, pts = t.pts;
  const own = ch.c * 2;
  const r = D.rng, phone = w.detail.phone;
  const probe = {};
  const s0 = pts[ch.i0].s, s1 = pts[ch.i1].s;
  const at = (s, u) => { const p = t.sample(s); const lx = Math.cos(p.h), lz = -Math.sin(p.h); return [p.x + lx * u, p.z + lz * u, p]; };
  // screens' light on the street: a pool on the pavement (added with the lot), a streak down the wet road, a real
  // light the car can pick up
  for (const L of D.lights) {
    if (L.streak) {
      const p = t.sample(L.ls - 5);
      const [rx, rz] = at(L.ls - 5, L.side * (L.wall - 1.6 - r() * 1.6));
      D.streaks.push([rx, rz, Math.sin(p.h), Math.cos(p.h), 2.4, 12, L.colour]);
    }
    if (!phone || L.streak) w.lamps.push({ x: L.x, y: L.y, z: L.z, c: ch.c, color: L.colour, power: 95, screen: L.s, period: 7 + 4 * ((L.s * 0.61) % 1) });
  }
  yield;
  // ---------------------------------------------------------------- the wires
  const cables = new Geo({ position: 3, aDir: 3, aSide: 1, aThick: 1 });
  const hang = (a, b, sag, thick, segs = 10) => {
    const base = cables.n;
    for (let k = 0; k <= segs; k++) {
      const u = k / segs;
      const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u - sag * 4 * u * (1 - u), z = a[2] + (b[2] - a[2]) * u;
      const dy = (b[1] - a[1]) - sag * 4 * (1 - 2 * u);
      const l = Math.hypot(b[0] - a[0], dy, b[2] - a[2]) || 1;
      const dir = [(b[0] - a[0]) / l, dy / l, (b[2] - a[2]) / l];
      cables.v([x, y, z], dir, -1, thick); cables.v([x, y, z], dir, 1, thick);
    }
    for (let k = 0; k < segs; k++) { const i = base + k * 2; cables.quad(i, i + 1, i + 3, i + 2); }      // (wound to face the camera)
  };
  // the poles: at the kerb, on one side of each stretch of about 200 m, every 30 to 38 m (poleAt)
  const poles = [];
  {
    const k0 = Math.ceil((s0 - 6) / 34), k1 = Math.floor((s1 - 6) / 34);
    for (let k = k0; k <= k1; k++) { const P = poleAt(w, k, probe); if (P && P.s >= s0 && P.s < s1 && !overStreet(w, ch.c, D.CH, P.s, P.s, 1.2)) poles.push(P); }
    // every pole: a point on it in its own axes (across toward the road, up, along the road)
    const pt = (P, x, y, zz = 0) => [P.x - P.lx * x + P.fx * zz, P.y + y, P.z - P.lz * x + P.fz * zz];
    for (const P of poles) {
      // arms across the street: local x toward the road
      const ry = P.side > 0 ? P.h + Math.PI : P.h;
      w._put('upole', own, P.x, P.y, P.z, ry); w.detail.stats.poles++;
      // to the next pole along, if it stands on the same side in a straight line
      const N = poleAt(w, P.k + 1, probe);
      if (N && N.side === P.side && Math.abs(Math.atan2(Math.sin(N.h - P.h), Math.cos(N.h - P.h))) < 0.7 && Math.hypot(N.x - P.x, N.z - P.z) < 44 && !overStreet(w, ch.c, D.CH, P.s, N.s, 0.5)) {
        const span = Math.hypot(N.x - P.x, N.z - P.z); w.detail.stats.spans++;
        // high voltage on the top arm and the pole's head, low voltage under it, then the black telecom bundles
        for (const [x, y, sag, th] of [[0.36, 8.57, 0.022, 0.02], [-0.36, 8.57, 0.022, 0.02], [0, 9.13, 0.018, 0.016], [0.22, 7.77, 0.03, 0.022], [-0.22, 7.77, 0.03, 0.022],
          [-0.16, 7.2, 0.04, 0.035], [-0.17, 6.9, 0.045, 0.05], [-0.18, 6.5, 0.052, 0.065], [-0.2, 6.2, 0.06, 0.08]]) {
          if (phone && th > 0.03 && th < 0.06) continue;
          hang(pt(P, x, y), pt(N, x, y), span * sag * (0.85 + r() * 0.3), th, phone ? 6 : 10);
        }
      }
      // service drops to the fronts on this side, clear of the neon and the towers
      const front = (s, side) => D.lots.find((l) => l.side === side && !l.up && Math.abs(l.s - s) < l.W / 2 - 0.3);
      for (let j = 0, n = phone ? 1 : 1 + Math.floor(r() * 2); j < n; j++) {
        const da = (r() < 0.5 ? -1 : 1) * (2.5 + r() * 5);
        const u = P.wall + 2.9 + 0.02;
        const [fxp, fzp, q] = at(P.s + da, u * P.side);
        if (!front(P.s + da, P.side) || !dropOK(D, fxp, fzp) || overStreet(w, ch.c, D.CH, P.s, P.s + da, 0.6)) continue;
        const y = g.height(fxp, fzp) + 5.4 + r() * 1.4;
        if (!q || q.express || Math.abs(q.k) > 1 / 90) continue;
        w.detail.stats.drops++; hang(pt(P, -0.22, 7.7), [fxp, y, fzp], 0.25 + r() * 0.25, 0.022, phone ? 5 : 8);
      }
      // across the street to the far fronts: a fan of two or three, from the road side of the pole
      if (r() < (phone ? 0.4 : 0.85)) {
        const da = (r() - 0.5) * 14; w.detail.stats.crossTry++;
        for (let j = 0, n = phone ? 1 : 2 + Math.floor(r() * 2); j < n; j++) {
          const sa = P.s + da + (j - (n - 1) / 2) * (1.2 + r() * 1.2);
          const q = t.sample(sa);
          const wf = P.side > 0 ? q.wr : q.wl;
          if (q.express || Math.abs(q.k) > 1 / 90 || !front(sa, -P.side) || overStreet(w, ch.c, D.CH, P.s, sa, 0.8)) continue;
          const [fxp, fzp] = at(sa, -(wf + 2.9 + 0.02) * P.side);
          if (!dropOK(D, fxp, fzp)) continue;
          const y = g.height(fxp, fzp) + 6.3 + r() * 1.4;
          const L = Math.hypot(fxp - P.x, fzp - P.z);
          const [ax, ay] = [[0.22, 7.77], [0.36, 8.57], [0.0, 9.13]][j % 3];
          w.detail.stats.cross++; hang(pt(P, ax, ay), [fxp, y, fzp], L * (0.03 + r() * 0.025), j === 2 ? 0.045 : 0.024, phone ? 8 : 14);
        }
      }
    }
  }
  yield;
  // ---------------------------------------------------------------- a shopping street: an arch, lanterns across
  if (D.arch) {
    const start = D.arch.start;
    {
      const lotAt = (s, side) => D.lots.find((l) => l.side === side && Math.abs(l.s - s) < l.W / 2 - 0.4 && !l.up);
      // the arch, facing the traffic coming up the street
      {
        const p = t.sample(start);
        const lx = Math.cos(p.h), lz = -Math.sin(p.h), fx = Math.sin(p.h), fz = Math.cos(p.h);
        const uL = p.wl + 2.62, uR = -(p.wr + 2.62);
        const yL = g.height(p.x + lx * uL, p.z + lz * uL), yR = g.height(p.x + lx * uR, p.z + lz * uR);
        const top = Math.max(yL, yR) + 6.6;
        for (const [u, yb] of [[uL, yL], [uR, yR]]) {
          const px = p.x + lx * u, pz = p.z + lz * u;
          D.housings.push(box([px, 0, pz], [fx, fz], 0.26, top + 0.5 - yb, 0.26, yb - 0.1));
          w._reg(own, { name: 'signal', kind: 'solid', x: px, y: yb, z: pz, r: 0.2, alive: true });
        }
        const span = uL - uR, mid = (uL + uR) / 2;
        const cx = p.x + lx * mid, cz = p.z + lz * mid;
        D.housings.push(box([cx, top + 0.3, cz], [lx, lz], span + 0.3, 0.3, 0.3));
        D.housings.push(box([cx, top - 0.2, cz], [lx, lz], span + 0.1, 0.12, 0.14));
        const sw = Math.min(9.5, span - 2.5), sh = sw / 4;
        const kind = 3 + (r() < 0.5 ? 0 : 1);
        // the sign under the beam, both faces (the name reads from either way)
        screenQuad(D.screens, [cx - fx * 0.13, top - 0.3 - sh, cz - fz * 0.13], [-fx, -fz], sw, sh, 1.5, kind);
        screenQuad(D.screens, [cx + fx * 0.13, top - 0.3 - sh, cz + fz * 0.13], [fx, fz], sw, sh, 2.5, kind);
        D.housings.push(box([cx, top - 0.3 - sh / 2, cz], [lx, lz], sw + 0.3, sh + 0.3, 0.22));
        for (const s of [-1, 1]) D.housings.push(box([cx + lx * s * sw * 0.3, top - 0.25, cz + lz * s * sw * 0.3], [lx, lz], 0.08, 0.2, 0.08));
        D.glows.push([cx, cz, fx, fz, 10, 7, kind === 3 ? 0xff5a3a : 0x5a8aff]);
        w.lamps.push({ x: cx, y: top - 1.5, z: cz, c: ch.c, color: 0xffb070, power: 120 });
      }
      // strings of lanterns from front to front, every 10 m behind it
      for (const s0 of D.arch.strings) {
        // the nearest place within 3 m with a front on both sides and neither end on a sign
        let p = null, a = null, b = null, uL = 0, uR = 0;
        for (const ds of [0, 1.5, -1.5, 3, -3]) {
          const s = s0 + ds;
          if (!lotAt(s, 1) || !lotAt(s, -1)) continue;
          const q = t.sample(s);
          const lx = Math.cos(q.h), lz = -Math.sin(q.h);
          const ul = q.wl + 2.88, ur = -(q.wr + 2.88);
          const A = [q.x + lx * ul, g.height(q.x + lx * ul, q.z + lz * ul) + 5.9, q.z + lz * ul], B = [q.x + lx * ur, g.height(q.x + lx * ur, q.z + lz * ur) + 5.9, q.z + lz * ur];
          if (!dropOK(D, A[0], A[2], 0.75) || !dropOK(D, B[0], B[2], 0.75)) continue;
          p = q; a = A; b = B; uL = ul; uR = ur; break;
        }
        if (!p) continue;
        w.detail.stats.strings++;
        const sag = 0.55;
        hang(a, b, sag, 0.02, 12);
        const n = Math.max(6, Math.round((uL - uR) / 1.7));
        for (let j = 1; j < n; j++) {
          const u = j / n;
          const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u - sag * 4 * u * (1 - u), z = a[2] + (b[2] - a[2]) * u;
          w._putLod(ch, 'chochin', x, y - 0.62, z, p.h + (r() - 0.5) * 0.3, 0.9 + r() * 0.15, null);
        }
        if ((Math.round(s0 / 10) & 1) === 0) w.lamps.push({ x: p.x, y: (a[1] + b[1]) / 2 - 1.2, z: p.z, c: ch.c, color: 0xff8a5c, power: 80 });
      }
    }
  }
  // ---------------------------------------------------------------- a glazed skybridge from front to front
  if (D.bridge) {
    // within 2 m of its place, where both sides have a front tall enough, and neither a sign nor an LED tower in the way
    const fits = (sb, side) => {
      const l = D.lots.find((q) => q.side === side && !q.up && Math.abs(q.s - sb) < q.W / 2 - 1.7 && q.H >= 9.6);
      if (!l) return false;
      for (const q of D.lots) if (q.side === side && q.vEdge && Math.abs(q.s + q.vEdge * (q.W / 2 - 0.7) - sb) < 2.4) return false;
      const p = t.sample(sb), lx = Math.cos(p.h) * side, lz = -Math.sin(p.h) * side, wall = side > 0 ? p.wl : p.wr;
      const fx = p.x + lx * (wall + 2.9), fz = p.z + lz * (wall + 2.9);
      for (const q of D.towers) if (Math.hypot(q[0] - fx, q[1] - fz) < 3) return false;
      return true;
    };
    let sb = null;
    for (const ds of [0, 1, -1, 2, -2]) if (fits(D.bridge.s + ds, 1) && fits(D.bridge.s + ds, -1)) { sb = D.bridge.s + ds; break; }
    if (sb !== null) {
      const p = t.sample(sb);
      const lx = Math.cos(p.h), lz = -Math.sin(p.h), fx = Math.sin(p.h), fz = Math.cos(p.h);
      const uL = p.wl + 2.9, uR = -(p.wr + 2.9);
      const yL = g.height(p.x + lx * uL, p.z + lz * uL), yR = g.height(p.x + lx * uR, p.z + lz * uR);
      const y0 = Math.max(yL, yR) + 5.3, span = uL - uR, mid = (uL + uR) / 2;
      const cx = p.x + lx * mid, cz = p.z + lz * mid;
      const B = 3.2, GH = 0.75, WH = 2.5;                               // along the road, the girder, the glass
      // the girder, the roof and its fascia, a portal where it meets each front, mullions every 1.6 m
      D.housings.push(box([cx, y0 + GH / 2, cz], [lx, lz], span, GH, B));
      D.housings.push(box([cx, y0 + GH + WH + 0.18, cz], [lx, lz], span, 0.36, B + 0.3));
      for (const u of [uL - 0.5, uR + 0.5]) D.housings.push(box([p.x + lx * u, y0 + (GH + WH + 0.5) / 2 - 0.1, p.z + lz * u], [lx, lz], 1.0, GH + WH + 0.7, B + 0.7));
      for (let u = uR + 1.6; u < uL - 1.2; u += 1.6) for (const e of [-1, 1]) {
        D.housings.push(box([p.x + lx * u + fx * e * (B / 2 - 0.04), y0 + GH + WH / 2, p.z + lz * u + fz * e * (B / 2 - 0.04)], [lx, lz], 0.1, WH, 0.1));
      }
      // the glass on both faces: the lit walkway and the people crossing it (the screens' shader draws it)
      for (const e of [-1, 1]) {
        screenQuad(D.screens, [cx + fx * e * (B / 2 - 0.02), y0 + GH, cz + fz * e * (B / 2 - 0.02)], [fx * e, fz * e], span - 2.0, WH, Math.floor(r() * 997) + 0.5, 5);
        // a ticker along the girder's face
        screenQuad(D.screens, [cx + fx * e * (B / 2 + 0.01), y0 + 0.12, cz + fz * e * (B / 2 + 0.01)], [fx * e, fz * e], span - 3.0, 0.5, Math.floor(r() * 997) + 0.5, 2);
      }
      // its light on the road under it, and a real light
      D.glows.push([cx, cz, fx, fz, span * 0.8, 6, 0xcfe3ff]);
      w.lamps.push({ x: cx, y: y0 - 0.5, z: cz, c: ch.c, color: 0xdfe8ff, power: 110 });
      w.detail.stats.bridges = (w.detail.stats.bridges || 0) + 1;
    }
  }
  // ---------------------------------------------------------------- the elevated railway, where one runs
  D.hang = hang;
  railChunk(w, ch, D);
  // ---------------------------------------------------------------- the wires' mesh
  const cg = cables.build();
  if (cg) { ch.own.add(cg); const m = new THREE.Mesh(cg, w.cableMat); m.name = 'wires'; m.renderOrder = 3; m.frustumCulled = true; ch.group.add(m); (ch.cvFar || (ch.cvFar = [])).push([m, phone ? 200 : 270]); }
  yield;
  // ---------------------------------------------------------------- the pavement
  {
    const G = new Geo({ position: 3, normal: 3, uv: 2 });
    for (const side of [1, -1]) {
      let prev = null;
      for (let i = ch.i0; i <= Math.min(ch.i1, t.nFinal - 1); i++) {
        const p = pts[i];
        const wall = side > 0 ? p.wl : p.wr;
        // (round the inside of a corner too, where the pavers close up a little, unless the bend is so tight that the
        // row's far edge would fold back on itself: without it the corner's inside was bare ground by day)
        const inside = Math.abs(p.k) > 1 / 70 && Math.sign(p.k) === side && 1 / Math.abs(p.k) < wall + 4.4;
        const okRow = !(p.tunnel || t.nearTunnel(p.s, 8) || (p.express && p.elev > 0.4) || t.markerAt(p.s, side) || t.padAt(p.s, side) || inside);
        let row = null;
        if (okRow) {
          const lx = Math.cos(p.h) * side, lz = -Math.sin(p.h) * side;
          const us = [wall + 0.02, wall + 1.4, wall + 2.84];
          row = [];
          for (const u of us) {
            const x = p.x + lx * u, z = p.z + lz * u;
            g.sample(x, z, 2.2, probe);
            if (probe.edge < -0.06 || probe.tunnel) { row = null; break; }
            row.push([x, g.height(x, z) + 0.012, z, (u - wall) / 2.8]);
          }
        }
        if (row && prev) {
          const v0 = prev.s / 5.6, v1 = p.s / 5.6;
          const idx = [];
          for (let j = 0; j < 3; j++) {
            const a = prev.row[j], b = row[j];
            idx.push(G.v([a[0], a[1], a[2]], [0, 1, 0], [a[3], v0]), G.v([b[0], b[1], b[2]], [0, 1, 0], [b[3], v1]));
          }
          for (let j = 0; j < 2; j++) {
            const a = idx[j * 2], b = idx[j * 2 + 1], c = idx[j * 2 + 2], d = idx[j * 2 + 3];
            if (side > 0) G.quad(a, b, d, c); else G.quad(a, c, d, b);
          }
        }
        prev = row ? { row, s: p.s } : null;
      }
    }
    const pg = G.build();
    if (pg) { ch.own.add(pg); const m = new THREE.Mesh(pg, w.paveMat); m.name = 'pavement'; m.receiveShadow = true; m.renderOrder = 0; ch.group.add(m); (ch.cvFar || (ch.cvFar = [])).push([m, phone ? 170 : 250]); }
  }
  // ---------------------------------------------------------------- the screens' mesh
  const sg = D.screens.build();
  if (sg) { ch.own.add(sg); const m = new THREE.Mesh(sg, w.screenMat); m.name = 'screens'; ch.group.add(m); }
}

/** Whether a wire can end on a front at (x, z) between heights lo and hi: not into a tower or a big screen. */
function dropOK(D, x, z, near = 1.6) {
  for (const q of D.towers) if (Math.hypot(q[0] - x, q[1] - z) < near + 0.8) return false;
  for (const l of D.lots) if (l.vEdge) {
    const ex = l.x + l.fx * l.vEdge * (l.W / 2 - 0.7), ez = l.z + l.fz * l.vEdge * (l.W / 2 - 0.7);
    if (Math.hypot(ex - x, ez - z) < near) return false;
  }
  return true;
}
