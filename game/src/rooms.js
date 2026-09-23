/**
 * NEO TOKYO: the rooms behind the city's glass, drawn once into one canvas atlas for the building shader's interior
 * mapping (buildings.js follows the view ray from the glass into a box room and samples what it meets here).
 *
 *     const { texture, params } = roomAtlas(THREE);
 *     // params.a[k] = [back, side, floor, ceiling]: metres one cell of that surface covers (0: the whole surface)
 *     // params.b[k] = [z, h, tile, on]: the row of furniture across the room (z a fraction of the depth), 0 off
 *
 * Eight furnishings, five cells each (back wall, side wall, floor, ceiling, the furniture row, which has alpha):
 *   0 an eatery (wood, the menu on paper strips, bottles, a noren to the kitchen, pendant lamps; a counter, stools)
 *   1 a boutique or cafe (white, shelves of things, a mirror, spotlights; a rail of clothes)
 *   2 a convenience store (the drinks fridges, shelves of goods, tubes across the ceiling; a gondola, an aisle)
 *   3 an arcade (machines with lit screens, marquees, carpet, coloured strip lights; a row of machines)
 *   4 a flat (a sofa, the television, a picture, a door, a bookcase, a round ceiling light)
 *   5 a tatami room (shoji, the alcove with its scroll, a chest, tatami, a paper lamp; the kotatsu)
 *   6 an office (filing cabinets, a whiteboard, partitions, carpet tiles, light panels; desks and screens)
 *   7 a bar (backlit bottles, a neon squiggle, dark wood, small spots; the counter and its stools)
 * Anything drawn at full white is a lamp (the shader makes it glow); the television's screen is drawn pure blue so the
 * shader can find it (lit when a flat is watching, dark otherwise). Tiled cells wrap at their edges.
 */
import * as THREE from 'three';

const N = 8, C = 128, PAD = 2, IN = C - 2 * PAD;          // 8 x 8 cells of 128 px, drawn in 124 px

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// the kinds: [back, side, floor, ceiling] tiles in metres (0: fit the surface); [z, h, tile, on] the furniture row
export const ROOM_KINDS = [
  { name: 'eatery', a: [4.8, 3.2, 1.8, 2.8], b: [0.7, 1.05, 2.4, 1] },
  { name: 'boutique', a: [3.2, 3.2, 2.4, 2.4], b: [0.5, 1.64, 2.4, 1] },
  { name: 'konbini', a: [3.2, 3.2, 2.4, 2.4], b: [0.44, 1.46, 3.0, 1] },
  { name: 'arcade', a: [3.2, 3.2, 2.4, 2.4], b: [0.5, 1.9, 3.2, 1] },
  { name: 'flat', a: [0, 0, 1.8, 0], b: [0, 0, 0, 0] },
  { name: 'tatami', a: [0, 0, 1.8, 0], b: [0.55, 0.45, 0, 1] },
  { name: 'office', a: [3.2, 3.2, 2.4, 2.4], b: [0.36, 1.18, 2.6, 1] },
  { name: 'bar', a: [3.2, 3.2, 2.4, 2.4], b: [0.62, 1.1, 2.4, 1] },
];

export function roomAtlas(T = THREE) {
  const cv = document.createElement('canvas'); cv.width = cv.height = N * C;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, N * C, N * C);
  const rnd = mulberry32(911);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  // draw one cell: fn(ctx, w, h, X, Y) with X(m), Y(m) mapping metres (y up from the floor) to pixels in the cell
  const cell = (k, spanX, spanY, fn, wrap) => {
    const x0 = (k % N) * C, y0 = Math.floor(k / N) * C;
    c.save();
    c.beginPath(); c.rect(x0 + PAD, y0 + PAD, IN, IN); c.clip();
    c.translate(x0 + PAD, y0 + PAD);
    const X = (m) => (m / spanX) * IN, Y = (m) => IN - (m / spanY) * IN;
    fn(c, IN, IN, X, Y);
    c.restore();
    // the border: wrapped for a tiled cell, repeated for a fitted one, so the mipmaps never bleed another cell in
    c.save(); c.imageSmoothingEnabled = false;
    const sx = x0 + PAD, sy = y0 + PAD;
    if (wrap) {
      c.drawImage(cv, sx + IN - PAD, sy, PAD, IN, sx - PAD, sy, PAD, IN);
      c.drawImage(cv, sx, sy, PAD, IN, sx + IN, sy, PAD, IN);
      c.drawImage(cv, sx - PAD, sy + IN - PAD, IN + 2 * PAD, PAD, sx - PAD, sy - PAD, IN + 2 * PAD, PAD);
      c.drawImage(cv, sx - PAD, sy, IN + 2 * PAD, PAD, sx - PAD, sy + IN, IN + 2 * PAD, PAD);
    } else {
      c.drawImage(cv, sx, sy, 1, IN, sx - PAD, sy, PAD, IN);
      c.drawImage(cv, sx + IN - 1, sy, 1, IN, sx + IN, sy, PAD, IN);
      c.drawImage(cv, sx - PAD, sy, IN + 2 * PAD, 1, sx - PAD, sy - PAD, IN + 2 * PAD, PAD);
      c.drawImage(cv, sx - PAD, sy + IN - 1, IN + 2 * PAD, 1, sx - PAD, sy + IN, IN + 2 * PAD, PAD);
    }
    c.restore();
  };
  const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  // a rectangle in metres (x, y the lower left, y up)
  const M = (X, Y) => (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(X(x), Y(y + h), X(x + w) - X(x), Y(y) - Y(y + h)); };
  const disc = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
  const planks = (w, h, base, dark, step, vertical) => {
    R(0, 0, w, h, base);
    c.fillStyle = dark;
    if (vertical) for (let x = 0; x < w; x += step) c.fillRect(Math.round(x), 0, 1, h);
    else for (let y = 0; y < h; y += step) c.fillRect(0, Math.round(y), w, 1);
  };
  const vivid = ['#ff3a5a', '#ffb21a', '#3ad0ff', '#7a5cff', '#46e07a', '#ff6ec7', '#ffe23a', '#ff7a2a'];
  const muted = ['#c84a3a', '#d8a040', '#4a8ac8', '#6a4a9a', '#4a9a5a', '#d87aa0', '#e8d060', '#e0e0d8', '#8a8a90'];
  // goods on shelves: rows between y0 and y1 (metres), items of varied width and height
  const shelves = (X, Y, w, y0, y1, rows, palette, edge = '#e8e8e4') => {
    const m = M(X, Y), rh = (y1 - y0) / rows;
    for (let r = 0; r < rows; r++) {
      const yb = y0 + r * rh;
      for (let x = 0; x < w;) { const iw = 0.06 + rnd() * 0.14, ih = rh * (0.5 + rnd() * 0.4); m(x + 0.01, yb + 0.03, iw - 0.02, ih, pick(palette)); x += iw; }
      m(0, yb, w, 0.03, edge);
    }
  };

  // ---------------------------------------------------------------- 0 an eatery
  cell(0, 4.8, 2.62, (g, w, h, X, Y) => {
    const m = M(X, Y);
    planks(w, h, '#6b4424', '#553418', X(0.3), true);
    m(0, 0, 4.8, 0.9, '#452a14');
    m(0, 0.88, 4.8, 0.04, '#2a180a');
    // the menu: paper strips with their marks
    for (let x = 0.1; x < 3.1; x += 0.17) {
      m(x, 1.62, 0.12, 0.58, '#f2ead8');
      for (let k = 0; k < 4; k++) m(x + 0.04, 1.68 + k * 0.13, 0.04, 0.07, rnd() < 0.2 ? '#c8201a' : '#2a2018');
    }
    // bottles on a shelf
    m(0.1, 1.1, 3.0, 0.04, '#2a180a');
    for (let x = 0.15; x < 3.0; x += 0.11) { const hh = 0.18 + rnd() * 0.14; m(x, 1.14, 0.07, hh, pick(['#2a6a3a', '#8a5a1a', '#c8d0c8', '#3a4a8a', '#6a2a1a'])); }
    // the doorway to the kitchen with its noren, a red lantern beside it
    m(3.4, 0, 0.9, 1.95, '#120a06');
    m(3.4, 1.35, 0.9, 0.6, '#1c2a5a');
    for (const x of [3.62, 3.85, 4.08]) m(x, 1.35, 0.02, 0.45, '#0c1430');
    disc(X(3.85), Y(1.72), X(0.1), '#f2eee4'); disc(X(3.85), Y(1.72), X(0.06), '#1c2a5a');
    disc(X(4.55), Y(1.6), X(0.14), '#e0301e'); m(4.47, 1.74, 0.16, 0.03, '#1a1010'); m(4.47, 1.44, 0.16, 0.03, '#1a1010');
  }, true);
  cell(1, 3.2, 2.62, (g, w, h, X, Y) => {
    const m = M(X, Y);
    planks(w, h, '#63401f', '#4e3016', X(0.3), true);
    m(0, 0, 3.2, 0.9, '#432812');
    m(0.4, 1.3, 0.5, 0.7, '#e8d8a8'); m(0.45, 1.36, 0.4, 0.5, '#c83a2a');
    m(1.6, 1.4, 0.45, 0.6, '#f0e8d8'); m(1.65, 1.5, 0.35, 0.18, '#2a5ab8');
    m(2.5, 1.2, 0.5, 0.04, '#2a180a'); disc(X(2.75), Y(1.36), X(0.1), '#f2f0e8'); disc(X(2.75), Y(1.36), X(0.04), '#e8a020');
  }, true);
  cell(2, 1.8, 1.8, (g, w, h) => { planks(w, h, '#2e2018', '#1e140e', w / 6, false); }, true);
  cell(3, 2.8, 2.8, (g, w, h, X) => {
    planks(w, h, '#2c1c10', '#1a0e06', w / 4, true);
    const cx = w / 2, cy = h / 2;
    disc(cx, cy, X(0.26), '#ffb060'); disc(cx, cy, X(0.18), '#ffe8c0'); disc(cx, cy, X(0.12), '#ffffff');
  }, true);
  cell(4, 2.4, 1.05, (g, w, h, X, Y) => {
    const m = M(X, Y);
    m(0, 0, 2.4, 1.05, '#4a2e18');
    for (let x = 0; x < 2.4; x += 0.3) m(x, 0, 0.02, 0.95, '#3a2210');
    m(0, 0.93, 2.4, 0.12, '#b08050');
    // stools in front: dark legs, red seats
    for (let x = 0.3; x < 2.4; x += 0.6) { m(x - 0.03, 0, 0.06, 0.66, '#140c08'); m(x - 0.17, 0.64, 0.34, 0.08, '#a8201a'); }
  }, true);

  // ---------------------------------------------------------------- 1 a boutique or a cafe
  cell(5, 3.2, 2.62, (g, w, h, X, Y) => {
    const m = M(X, Y);
    R(0, 0, w, h, '#e4e0da');
    for (const y of [0.9, 1.45, 2.0]) {
      m(0.1, y, 3.0, 0.04, '#8a6a4a');
      for (let x = 0.2; x < 3.0;) { const iw = 0.12 + rnd() * 0.22, ih = 0.12 + rnd() * 0.3; if (rnd() < 0.75) m(x, y + 0.04, iw, ih, pick(muted)); x += iw + 0.08; }
    }
    m(1.2, 2.2, 0.8, 0.3, '#2a2a2e'); m(1.25, 2.25, 0.7, 0.2, '#f0e0c0');
    m(0, 0, 3.2, 0.1, '#b0aaa0');
  }, true);
  cell(6, 3.2, 2.62, (g, w, h, X, Y) => {
    const m = M(X, Y);
    R(0, 0, w, h, '#e0dcd4');
    m(0.5, 0.2, 0.7, 1.8, '#8a8a90'); m(0.56, 0.26, 0.58, 1.68, '#b8c8d8');
    m(2.0, 0, 0.5, 0.5, '#6a4a2a'); disc(X(2.25), Y(0.8), X(0.28), '#4a8a3a'); disc(X(2.1), Y(0.95), X(0.18), '#5a9a4a');
    m(0, 0, 3.2, 0.1, '#b0aaa0');
  }, true);
  cell(7, 2.4, 2.4, (g, w, h) => { planks(w, h, '#b08a5a', '#8a6a42', w / 12, false); }, true);
  cell(8, 2.4, 2.4, (g, w, h) => {
    R(0, 0, w, h, '#e2e0dc');
    for (const [x, y] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) { disc(x * w, y * h, 7, '#f8f0dc'); disc(x * w, y * h, 4, '#ffffff'); }
  }, true);
  cell(9, 2.4, 1.64, (g, w, h, X, Y) => {
    const m = M(X, Y);
    m(0.05, 0, 0.04, 1.6, '#a0a4aa'); m(2.31, 0, 0.04, 1.6, '#a0a4aa');
    m(0.05, 1.56, 2.3, 0.04, '#c8ccd0');
    for (let x = 0.15; x < 2.25; x += 0.14) { const bottom = 0.7 + rnd() * 0.35; m(x, bottom, 0.11, 1.54 - bottom, pick(muted)); m(x + 0.045, 1.54, 0.02, 0.04, '#707478'); }
  }, true);

  // ---------------------------------------------------------------- 2 a convenience store
  cell(10, 3.2, 2.62, (g, w, h, X, Y) => {
    const m = M(X, Y);
    R(0, 0, w, h, '#d8dee4');
    for (let d = 0; d < 4; d++) {
      const x = d * 0.8;
      m(x, 0.1, 0.8, 2.0, '#9aa0a8');
      m(x + 0.05, 0.16, 0.7, 1.88, '#eef4fa');
      for (let r = 0; r < 5; r++) {
        const yb = 0.2 + r * 0.37;
        m(x + 0.05, yb, 0.7, 0.02, '#b8c0c8');
        for (let bx = x + 0.08; bx < x + 0.72; bx += 0.07) { const hh = 0.18 + rnd() * 0.1; m(bx, yb + 0.02, 0.05, hh, pick(['#e8201e', '#2aa04a', '#3a7ad8', '#f0a01a', '#e8e8f0', '#8a3a1a', '#ff6ea0'])); }
      }
      m(x + 0.37, 0.16, 0.03, 1.88, '#c8d0d8');
    }
    const brand = pick(['#1e9a4a', '#1e5ac8', '#e8641c']);
    m(0, 2.12, 3.2, 0.3, brand); m(0, 2.22, 3.2, 0.06, '#ffffff');
  }, true);
  cell(11, 3.2, 2.62, (g, w, h, X, Y) => {
    const m = M(X, Y);
    R(0, 0, w, h, '#dfe4e8');
    shelves(X, Y, 3.2, 0.15, 1.9, 5, vivid.concat(muted), '#f4f4f0');
    m(0, 1.95, 3.2, 0.2, '#f8e8a0');
    for (let x = 0.1; x < 3.2; x += 0.4) m(x, 1.98, 0.25, 0.14, '#e8201e');
  }, true);
  cell(12, 2.4, 2.4, (g, w, h) => {
    R(0, 0, w, h, '#c4c6c8');
    c.fillStyle = '#a4a6aa'; for (let i = 0; i <= 8; i++) { c.fillRect(Math.round(i * w / 8), 0, 1, h); c.fillRect(0, Math.round(i * h / 8), w, 1); }
  }, true);
  cell(13, 2.4, 2.4, (g, w, h) => {
    R(0, 0, w, h, '#e8eaec');
    for (const y of [0.25, 0.75]) { R(w * 0.08, y * h - 4, w * 0.84, 8, '#f4f8ff'); R(w * 0.1, y * h - 2, w * 0.8, 4, '#ffffff'); }
  }, true);
  cell(14, 3.0, 1.46, (g, w, h, X, Y) => {
    const m = M(X, Y);
    m(0, 0, 2.3, 1.46, '#c8ccd0');
    shelves(X, Y, 2.3, 0.08, 1.38, 4, vivid.concat(muted), '#f4f4f0');
    m(0, 1.38, 2.3, 0.08, '#e8201e');
  }, true);

  // ---------------------------------------------------------------- 3 an arcade
  const machine = (m, x, col, scr) => {
    m(x + 0.04, 0, 0.72, 2.0, '#1a1622');
    m(x + 0.04, 0, 0.05, 2.0, col); m(x + 0.71, 0, 0.05, 2.0, col);
    m(x + 0.12, 0.95, 0.56, 0.5, scr);
    m(x + 0.2, 1.1, 0.14, 0.14, '#ffffff'); m(x + 0.42, 1.02, 0.2, 0.08, pick(vivid));
    m(x + 0.1, 0.8, 0.6, 0.15, '#b8b4c0');
    for (const bx of [0.2, 0.32, 0.44, 0.56]) m(x + bx, 0.86, 0.06, 0.05, pick(vivid));
    m(x + 0.08, 1.62, 0.64, 0.34, col); m(x + 0.12, 1.72, 0.56, 0.12, '#ffffff');
  };
  cell(15, 3.2, 2.62, (g, w, h, X, Y) => {
    const m = M(X, Y);
    R(0, 0, w, h, '#120e18');
    for (let k = 0; k < 4; k++) machine(m, k * 0.8, pick(vivid), pick(vivid));
    m(0, 2.3, 3.2, 0.05, '#ff4fd8');
  }, true);
  cell(16, 3.2, 2.62, (g, w, h, X, Y) => {
    const m = M(X, Y);
    R(0, 0, w, h, '#100c16');
    for (let k = 0; k < 4; k++) machine(m, k * 0.8, pick(vivid), pick(vivid));
    m(0, 2.3, 3.2, 0.05, '#35e8ff');
  }, true);
  cell(17, 2.4, 2.4, (g, w, h) => {
    R(0, 0, w, h, '#3a0a16');
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { const x = (i + 0.5) * w / 6, y = (j + 0.5) * h / 6; c.fillStyle = (i + j) % 2 ? '#e8b02a' : '#2a4ab8'; c.beginPath(); c.moveTo(x, y - 4); c.lineTo(x + 4, y); c.lineTo(x, y + 4); c.lineTo(x - 4, y); c.fill(); }
  }, true);
  cell(18, 2.4, 2.4, (g, w, h) => {
    R(0, 0, w, h, '#0a080e');
    for (const [y, col] of [[0.25, '#ff4fd8'], [0.75, '#35e8ff']]) { R(0, y * h - 5, w, 10, col); R(0, y * h - 2, w, 4, '#ffffff'); }
  }, true);
  cell(19, 3.2, 1.9, (g, w, h, X, Y) => {
    const m = M(X, Y);
    for (let k = 0; k < 3; k++) machine(m, 0.1 + k * 0.8, pick(vivid), pick(vivid));
  }, true);

  // ---------------------------------------------------------------- 4 a flat (the television's screen pure blue)
  cell(20, 1, 1, (g, w, h) => {
    R(0, 0, w, h, '#d8ccb0');
    R(0, h * 0.94, w, h * 0.06, '#b8a888');
    // a sofa, a picture over it, the television on its cabinet, a door, a lamp
    R(w * 0.06, h * 0.64, w * 0.42, h * 0.2, '#3a4a6a'); R(w * 0.06, h * 0.56, w * 0.42, h * 0.1, '#4a5a7a'); R(w * 0.04, h * 0.6, w * 0.05, h * 0.24, '#34425e'); R(w * 0.45, h * 0.6, w * 0.05, h * 0.24, '#34425e');
    R(w * 0.14, h * 0.2, w * 0.26, h * 0.2, '#6a4a2a'); R(w * 0.16, h * 0.22, w * 0.22, h * 0.16, pick(['#6a9ac8', '#c87a5a', '#8ab070']));
    R(w * 0.56, h * 0.78, w * 0.26, h * 0.12, '#4a3020'); R(w * 0.58, h * 0.58, w * 0.22, h * 0.19, '#18181a'); R(w * 0.59, h * 0.59, w * 0.2, h * 0.16, '#0000ff');
    R(w * 0.86, h * 0.26, w * 0.12, h * 0.68, '#a08a68'); R(w * 0.95, h * 0.6, w * 0.015, h * 0.04, '#d8c8a0');
    R(w * 0.52, h * 0.3, w * 0.015, h * 0.6, '#3a3a3a'); disc(w * 0.527, h * 0.3, w * 0.035, '#fff4dc');
  }, false);
  cell(21, 1, 1, (g, w, h) => {
    R(0, 0, w, h, '#d0c4a8');
    R(0, h * 0.94, w, h * 0.06, '#b0a080');
    R(w * 0.2, h * 0.3, w * 0.4, h * 0.64, '#6a4a2e');
    for (let r = 0; r < 4; r++) { const y = h * (0.34 + r * 0.15); for (let x = w * 0.22; x < w * 0.58;) { const bw = 3 + rnd() * 4; R(x, y, bw - 1, h * 0.12, pick(muted)); x += bw; } }
    R(w * 0.7, h * 0.2, w * 0.2, h * 0.28, '#e8e4dc'); R(w * 0.72, h * 0.22, w * 0.16, h * 0.24, '#8ab0d0');
  }, false);
  cell(22, 1.8, 1.8, (g, w, h) => { planks(w, h, '#7a5234', '#5e3e26', w / 9, false); }, true);
  cell(23, 1, 1, (g, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w * 0.6); gr.addColorStop(0, '#f0e6d0'); gr.addColorStop(1, '#c8bca4');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    disc(w / 2, h / 2, w * 0.14, '#e8e0d0'); disc(w / 2, h / 2, w * 0.11, '#ffffff');
  }, false);
  cell(24, 1, 1, () => {}, false);

  // ---------------------------------------------------------------- 5 a tatami room
  cell(25, 1, 1, (g, w, h) => {
    R(0, 0, w, h, '#c8b890');
    // shoji over most of it, the alcove at one end with its scroll
    R(0, h * 0.08, w * 0.66, h * 0.86, '#ece6d4');
    c.fillStyle = '#6a4a2a';
    for (let i = 0; i <= 6; i++) c.fillRect(Math.round(i * w * 0.66 / 6), h * 0.08, 2, h * 0.86);
    for (let j = 0; j <= 8; j++) c.fillRect(0, Math.round(h * 0.08 + j * h * 0.86 / 8), w * 0.66, 1);
    R(w * 0.7, h * 0.06, w * 0.28, h * 0.88, '#9a8a64'); R(w * 0.72, h * 0.1, w * 0.24, h * 0.8, '#b0a07a');
    R(w * 0.79, h * 0.14, w * 0.1, h * 0.5, '#f0e8d4'); R(w * 0.81, h * 0.2, w * 0.06, h * 0.3, '#3a3024');
    R(0, 0, w, h * 0.06, '#5a3e22'); R(0, h * 0.94, w, h * 0.06, '#5a3e22');
  }, false);
  cell(26, 1, 1, (g, w, h) => {
    R(0, 0, w, h, '#c4b48c');
    R(w * 0.25, h * 0.55, w * 0.4, h * 0.39, '#5a3a20'); for (let r = 0; r < 4; r++) R(w * 0.27, h * (0.6 + r * 0.085), w * 0.36, 1, '#3a2410');
    R(0, 0, w, h * 0.05, '#5a3e22'); R(0, h * 0.95, w, h * 0.05, '#5a3e22');
  }, false);
  cell(27, 1.8, 1.8, (g, w, h) => {
    R(0, 0, w, h, '#a8a064');
    c.fillStyle = '#b4ac70'; for (let x = 0; x < w; x += 2) c.fillRect(x, 0, 1, h);
    R(0, 0, w, 3, '#2a2418'); R(0, h / 2 - 1, w, 3, '#2a2418'); R(w / 2 - 1, 0, 3, h / 2, '#2a2418');
  }, true);
  cell(28, 1, 1, (g, w, h) => {
    planks(w, h, '#8a6a44', '#6a4e30', w / 10, true);
    disc(w / 2, h / 2, w * 0.16, '#f4ead0'); disc(w / 2, h / 2, w * 0.12, '#ffffff');
  }, false);
  cell(29, 1, 0.45, (g, w, h) => {
    R(w * 0.28, h * 0.1, w * 0.44, h * 0.22, '#7a5230');
    R(w * 0.24, h * 0.28, w * 0.52, h * 0.72, pick(['#c84a2a', '#d88a3a', '#6a3a8a']));
    for (let x = w * 0.26; x < w * 0.74; x += 6) R(x, h * 0.3, 2, h * 0.68, 'rgba(255,255,255,0.18)');
  }, false);

  // ---------------------------------------------------------------- 6 an office
  cell(30, 3.2, 3.1, (g, w, h, X, Y) => {
    const m = M(X, Y);
    R(0, 0, w, h, '#b8bcc0');
    for (let x = 0; x < 3.2; x += 0.45) { m(x + 0.02, 0, 0.41, 1.1, '#8a9098'); for (let r = 1; r < 4; r++) m(x + 0.02, r * 0.27, 0.41, 0.015, '#6a7078'); }
    m(0.6, 1.35, 1.6, 0.8, '#f4f6f8'); m(0.6, 1.35, 1.6, 0.03, '#8a9098');
    for (let k = 0; k < 5; k++) m(0.7 + rnd() * 1.2, 1.5 + rnd() * 0.5, 0.2 + rnd() * 0.3, 0.02, pick(['#2a5ab8', '#c83a2a', '#2a8a4a']));
    disc(X(2.7), Y(2.3), X(0.14), '#f8f8f8');
  }, true);
  cell(31, 3.2, 3.1, (g, w, h, X, Y) => {
    const m = M(X, Y);
    R(0, 0, w, h, '#aeb4ba');
    for (let x = 0; x < 3.2; x += 1.0) { m(x + 0.03, 0, 0.94, 1.5, '#6a7a8a'); m(x + 0.03, 1.46, 0.94, 0.04, '#4a5460'); }
    m(0, 2.0, 3.2, 0.6, '#c8d4dc');
  }, true);
  cell(32, 2.4, 2.4, (g, w, h) => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) R(i * w / 4, j * h / 4, w / 4, h / 4, (i + j) % 2 ? '#4a5260' : '#434a58');
  }, true);
  cell(33, 2.4, 2.4, (g, w, h) => {
    R(0, 0, w, h, '#d4d6da');
    c.fillStyle = '#b8bcc0'; for (let i = 0; i <= 4; i++) { c.fillRect(Math.round(i * w / 4), 0, 1, h); c.fillRect(0, Math.round(i * h / 4), w, 1); }
    for (const [x, y] of [[0.125, 0.125], [0.625, 0.625]]) { R(x * w, y * h, w / 4, h / 4, '#f4f8ff'); R(x * w + 3, y * h + 3, w / 4 - 6, h / 4 - 6, '#ffffff'); }
  }, true);
  cell(34, 2.6, 1.18, (g, w, h, X, Y) => {
    const m = M(X, Y);
    m(0, 0, 2.5, 0.72, '#6a6e76'); m(0, 0.7, 2.5, 0.04, '#a8acb4');
    for (const x of [0.35, 1.6]) { m(x, 0.76, 0.56, 0.4, '#1a1c22'); m(x + 0.03, 0.8, 0.5, 0.33, '#9ec8f0'); m(x + 0.24, 0.72, 0.08, 0.06, '#1a1c22'); m(x + 0.08, 0.9, 0.2, 0.03, '#ffffff'); }
  }, true);

  // ---------------------------------------------------------------- 7 a bar
  cell(35, 3.2, 2.62, (g, w, h, X, Y) => {
    const m = M(X, Y);
    R(0, 0, w, h, '#1a1216');
    const gr = c.createLinearGradient(0, Y(2.2), 0, Y(1.0)); gr.addColorStop(0, '#6a2a8a'); gr.addColorStop(1, '#e8a060');
    c.fillStyle = gr; c.fillRect(X(0.2), Y(2.2), X(2.8), Y(1.0) - Y(2.2));
    for (const y of [1.0, 1.4, 1.8]) { m(0.2, y, 2.8, 0.03, '#ffe8c0'); for (let x = 0.25; x < 2.95; x += 0.12) { const hh = 0.2 + rnd() * 0.12; m(x, y + 0.03, 0.07, hh, pick(['#1a0e0a', '#2a1a0a', '#0e1a12', '#1a1a2a'])); } }
    m(0, 0, 3.2, 0.95, '#2a1a12');
  }, true);
  cell(36, 3.2, 2.62, (g, w, h, X, Y) => {
    const m = M(X, Y);
    planks(w, h, '#2a1a14', '#1a100c', X(0.4), true);
    c.strokeStyle = '#ff4fd8'; c.lineWidth = 3; c.beginPath(); c.moveTo(X(0.6), Y(1.8)); c.bezierCurveTo(X(1.0), Y(2.2), X(1.3), Y(1.4), X(1.7), Y(1.9)); c.stroke();
    c.strokeStyle = '#ffffff'; c.lineWidth = 1; c.stroke();
    m(2.2, 1.3, 0.6, 0.8, '#3a2a20'); m(2.25, 1.35, 0.5, 0.7, '#8a6a4a');
  }, true);
  cell(37, 2.4, 2.4, (g, w, h) => { planks(w, h, '#1c1410', '#120c08', w / 8, false); }, true);
  cell(38, 2.4, 2.4, (g, w, h) => {
    R(0, 0, w, h, '#120c10');
    for (const [x, y] of [[0.25, 0.3], [0.75, 0.3], [0.5, 0.8]]) { disc(x * w, y * h, 6, '#ffb070'); disc(x * w, y * h, 3, '#ffffff'); }
    R(0, h * 0.55, w, 4, '#8a3ad8');
  }, true);
  cell(39, 2.4, 1.1, (g, w, h, X, Y) => {
    const m = M(X, Y);
    m(0, 0, 2.4, 1.02, '#24160e');
    m(0, 0.98, 2.4, 0.12, '#6a4a30'); m(0, 0.94, 2.4, 0.03, '#ffc080');
    for (let x = 0.3; x < 2.4; x += 0.6) { m(x - 0.02, 0, 0.04, 0.7, '#0a0604'); m(x - 0.15, 0.68, 0.3, 0.06, '#5a1a3a'); }
  }, true);

  const tex = new T.CanvasTexture(cv);
  tex.name = 'rooms'; tex.colorSpace = T.SRGBColorSpace;
  tex.generateMipmaps = true; tex.minFilter = T.LinearMipmapLinearFilter; tex.magFilter = T.LinearFilter; tex.anisotropy = 4;
  return { texture: tex, canvas: cv };
}
