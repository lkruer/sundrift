/**
 * NEO TOKYO: every shop and bar sign of the street, drawn once into one canvas atlas.
 *
 *     const { texture, signs } = neonAtlas('"M PLUS Rounded 1c", "Dela Gothic One", "Yu Gothic", sans-serif');
 *     // signs[i] = { name, u0, v0, u1, v1, w, h, colour, vertical }
 *
 * The designs are the signs a Tokyo street has: tate-kanban that stack their characters down a narrow board
 * (ラーメン, カラオケ, 居酒屋 ...), tenant stacks that list a building's bars floor by floor, and horizontal
 * boards over the shop fronts that mix in English and numbers (BAR, 24H, GAME CENTER ...). Four ways of lighting:
 *   neon tube  a near-white core inside a coloured tube inside two layers of glow (canvas shadowBlur), on a dark
 *              backing board so the tube reads;
 *   lit box    a backlit acrylic panel, white or coloured, its fluorescent tubes faintly showing through, with
 *              dark or coloured lettering;
 *   LED dot    characters rasterised into a coarse grid and drawn as lit and unlit dots;
 *   bulbs      a chaser border of round bulbs, the pachinko way;
 * with borders, stripes and small icons (a ramen bowl, a microphone, a moon and stars, a coffee cup ...).
 *
 * Every sign is drawn at its real size, about 1.3 texels to the centimetre, so it is sharp from a car passing
 * under it. Its glow stays inside its own rectangle and its edge pixels are repeated into a gutter round it, so
 * the mipmaps of a far sign blend into its own colour and never into a neighbour's. The atlas is opaque: the
 * backing board or the lit panel is part of the sign.
 *
 * UVs follow three.js (a CanvasTexture flips Y): (u0, v0) is the bottom-left corner of the sign as it reads
 * upright, (u1, v1) the top right.
 *
 * Fonts: `fontFamily` names "M PLUS Rounded 1c" (weight 800, the neon tubes) and "Dela Gothic One" (the box
 * lettering); load both with NEON_CHARS + NEON_LATIN before calling. A page that cannot draw Japanese at all
 * gets the signs' English words instead of boxes.
 */
import * as THREE from 'three';

/** Every Japanese character the atlas draws: request exactly these from Google Fonts (&text=). */
export const NEON_CHARS = 'ラーメンカオケ居酒屋寿司焼肉薬くすりホテルパチコゲム喫茶麻雀占い鳥珈琲営業中場スナック';
/** The Latin letters, digits and signs drawn with the same faces: add them to the same &text= request. */
export const NEON_LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789&¥,./:-min ';

const SIZE = 2048;       // the atlas is SIZE x SIZE
const GUT = 12;          // pixels of repeated edge round every sign

// ---------------------------------------------------------------- small helpers

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rgb = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const css = (h, a = 1) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };
const mix = (a, b, t) => {
  const A = rgb(a), B = rgb(b);
  return (Math.round(A[0] + (B[0] - A[0]) * t) << 16) | (Math.round(A[1] + (B[1] - A[1]) * t) << 8) | Math.round(A[2] + (B[2] - A[2]) * t);
};
const tint = (h, t) => mix(h, 0xffffff, t);
const shade = (h, t) => mix(h, 0x000000, t);
const TAU = Math.PI * 2;

/** A rounded rectangle added to the current path (no beginPath, so a neon path can hold several). */
function rrp(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (r <= 0) { c.rect(x, y, w, h); return; }
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function rr(c, x, y, w, h, r) { c.beginPath(); rrp(c, x, y, w, h, r); }

// ---------------------------------------------------------------- lettering

/** One run of text, measured so it can be drawn with its ink (not its em box) centred on (x, y). */
function glyph(c, t, x, y, px, font, rot = 0) {
  c.save(); c.font = font(px); const m = c.measureText(t); c.restore();
  return { t, x, y, px, f: font(px), rot, sx: 1, l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, a: m.actualBoundingBoxAscent, b: m.actualBoundingBoxDescent };
}
function paint(c, g, stroke) {
  c.save(); c.translate(g.x, g.y);
  if (g.rot) c.rotate(g.rot);
  if (g.sx !== 1) c.scale(g.sx, 1);
  c.font = g.f; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  const x = -(g.r - g.l) / 2, y = (g.a - g.b) / 2;
  if (stroke) c.strokeText(g.t, x, y); else c.fillText(g.t, x, y);
  c.restore();
}
// in vertical writing the long vowel mark and dashes turn with the column
const TURN = new Set(['ー', '〜', '-', '—']);
/** Characters stacked top to bottom between y0 and y1, the way a tate-kanban reads. */
function vstack(c, text, cx, y0, y1, px, font, fill = 0.94) {
  const ch = [...text], cell = (y1 - y0) / ch.length, size = Math.min(px, cell * fill);
  return ch.map((t, i) => glyph(c, t, cx, y0 + cell * (i + 0.5), size, font, TURN.has(t) ? Math.PI / 2 : 0));
}
/** One line centred on (cx, cy), squeezed sideways if it is wider than maxW. */
function hline(c, text, cx, cy, px, font, maxW = 1e9) {
  const g = glyph(c, text, cx, cy, px, font);
  const ink = g.r + g.l;
  if (ink > maxW) g.sx = maxW / ink;
  return [g];
}
/** One line with its letters spread evenly from x0 to x1. */
function hspread(c, text, x0, x1, cy, px, font) {
  const ch = [...text], cell = (x1 - x0) / ch.length;
  return ch.map((t, i) => glyph(c, t, x0 + cell * (i + 0.5), cy, px, font));
}
/** A line of Latin turned to read top to bottom, as English is set on a vertical sign. */
function vturned(c, text, cx, y0, y1, px, font) {
  const g = glyph(c, text, cx, (y0 + y1) / 2, px, font, Math.PI / 2);
  const ink = g.r + g.l;
  if (ink > y1 - y0) g.sx = (y1 - y0) / ink;
  return [g];
}

// ---------------------------------------------------------------- light

/** Draw into a scratch layer the size of the sign; returns the layer's canvas. */
function layer(d, k, fn) {
  const cv = d.scratch[k], c = cv.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.shadowBlur = 0; c.shadowColor = 'rgba(0,0,0,0)';
  c.clearRect(0, 0, d.W + 4, d.H + 4);
  fn(c);
  return cv;
}
/** Composite a layer onto the sign, optionally over a blurred glow of itself. */
function put(d, cv, { blur = 0, colour = 0xffffff, alpha = 1 } = {}) {
  const c = d.ctx;
  c.save(); c.globalAlpha = alpha;
  if (blur > 0) { c.shadowColor = css(colour); c.shadowBlur = blur; }
  c.drawImage(cv, 0, 0, d.W, d.H, 0, 0, d.W, d.H);
  c.restore();
}

/**
 * Neon tube: glyphs filled (a fat rounded tube) or outlined (outline neon), paths stroked, shapes filled; a wide
 * soft halo and a tight glow in the colour, the tube a little paler, and a near-white core down its middle (the
 * filled shapes eroded to a thin centre, the strokes drawn thin).
 */
function neon(d, parts, colour, o = {}) {
  const gl = parts.glyphs || [], paths = parts.paths || [], fills = parts.fills || [];
  const px = o.px ?? (gl.length ? gl[0].px : 0.4 * d.S);
  const tw = o.tw ?? 0.075 * px;
  const outline = !!o.outline, glow = o.glow ?? 1;
  const tubeC = tint(colour, o.tube ?? 0.08), coreC = tint(colour, o.core ?? 0.9);
  const tube = layer(d, 0, (c) => {
    c.fillStyle = c.strokeStyle = css(tubeC); c.lineWidth = tw; c.lineJoin = 'round'; c.lineCap = 'round';
    for (const g of gl) paint(c, g, outline);
    for (const f of fills) { c.beginPath(); f(c); c.fill(); }
    for (const p of paths) { c.beginPath(); p(c); c.stroke(); }
  });
  // a wide wash that colours the board, a halo, a tight glow, then the tube itself
  put(d, tube, { blur: Math.min(160, px * 1.5 * glow), colour, alpha: 0.5 });
  put(d, tube, { blur: px * 0.55 * glow, colour, alpha: 0.85 });
  put(d, tube, { blur: px * 0.16 * glow, colour, alpha: 1 });
  put(d, tube);
  const er = o.erode ?? 0.046 * px;
  const core = layer(d, 1, (c) => {
    c.fillStyle = c.strokeStyle = '#fff'; c.lineJoin = 'round'; c.lineCap = 'round';
    if (!outline) for (const g of gl) paint(c, g, false);
    for (const f of fills) { c.beginPath(); f(c); c.fill(); }
    c.globalCompositeOperation = 'destination-out'; c.lineWidth = 2 * er;
    if (!outline) for (const g of gl) paint(c, g, true);
    for (const f of fills) { c.beginPath(); f(c); c.stroke(); }
    c.globalCompositeOperation = 'source-over';
    c.lineWidth = tw * 0.36;
    if (outline) for (const g of gl) paint(c, g, true);
    for (const p of paths) { c.beginPath(); p(c); c.stroke(); }
    c.globalCompositeOperation = 'source-in'; c.fillStyle = css(coreC); c.fillRect(0, 0, d.W, d.H);
    c.globalCompositeOperation = 'source-over';
  });
  put(d, core, { blur: px * 0.07, colour: coreC });
}

/** Lettering on a lit box: an optional outline stroke under a solid fill. */
function boxText(d, gl, fill, o = {}) {
  const c = d.ctx;
  c.save(); c.lineJoin = 'round';
  if (o.stroke) { c.strokeStyle = o.stroke; c.lineWidth = o.strokeW ?? 0.04 * d.S; for (const g of gl) paint(c, g, true); }
  c.fillStyle = fill; for (const g of gl) paint(c, g, false);
  c.restore();
}

/**
 * LED dots: the text rasterised at four samples a dot into a coarse grid (a dot is lit where the glyph covers
 * enough of it), then every dot drawn, the lit ones bright over a glow of their own, the rest dark and small.
 */
function led(d, text, x, y, w, h, o) {
  const pitch = o.pitch, cols = Math.max(1, Math.floor(w / pitch)), rows = Math.max(1, Math.floor(h / pitch));
  const K = 4, cv = d.raster;
  cv.width = cols * K; cv.height = rows * K;
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.clearRect(0, 0, cv.width, cv.height); c.fillStyle = '#fff';
  const font = o.font || d.font.led, fill = o.fill ?? 0.9;
  // each glyph measured at 100 px, then set so its ink fills its cell
  const fit = (t, cx, cy, cw, ch, rot = 0) => {
    const g = glyph(c, t, cx, cy, 100, font, rot);
    let iw = g.r + g.l, ih = g.a + g.b;
    if (rot) [iw, ih] = [ih, iw];
    const k = Math.min((cw * fill) / Math.max(1, iw), (ch * fill) / Math.max(1, ih));
    const g2 = glyph(c, t, cx, cy, 100 * k, font, rot);
    if (!rot && (g2.r + g2.l) > cw * 0.98) g2.sx = (cw * 0.98) / (g2.r + g2.l);
    paint(c, g2, false);
  };
  if (o.vertical) {
    const ch = [...text], cell = (rows * K) / ch.length;
    ch.forEach((t, i) => fit(t, cols * K / 2, cell * (i + 0.5), cols * K, cell, TURN.has(t) ? Math.PI / 2 : 0));
  } else {
    // one line: as tall as the grid, squeezed if wider
    const g = glyph(c, text, cols * K / 2, rows * K / 2, 100, font);
    const k = (rows * K * fill) / Math.max(1, g.a + g.b);
    const g2 = glyph(c, text, cols * K / 2, rows * K / 2, 100 * k, font);
    if ((g2.r + g2.l) > cols * K * 0.98) g2.sx = (cols * K * 0.98) / (g2.r + g2.l);
    paint(c, g2, false);
  }
  const data = c.getImageData(0, 0, cols * K, rows * K).data;
  const ox = x + (w - cols * pitch) / 2 + pitch / 2, oy = y + (h - rows * pitch) / 2 + pitch / 2, r = pitch * 0.42;
  const lit = [];
  const ctx = d.ctx;
  ctx.fillStyle = o.dim ?? css(shade(o.colour, 0.84));
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let s = 0;
    for (let v = 0; v < K; v++) for (let u = 0; u < K; u++) s += data[((j * K + v) * cols * K + i * K + u) * 4 + 3];
    const cx = ox + i * pitch, cy = oy + j * pitch;
    if (s / (K * K * 255) > (o.thr ?? 0.34)) lit.push(cx, cy);
    else { ctx.beginPath(); ctx.arc(cx, cy, r * 0.72, 0, TAU); ctx.fill(); }
  }
  // one lit dot drawn once, stamped at every lit cell
  const sp = document.createElement('canvas'), R = Math.ceil(r) + 1;
  sp.width = sp.height = 2 * R;
  { const s = sp.getContext('2d'), gr = s.createRadialGradient(R, R, 0, R, R, r);
    gr.addColorStop(0, css(tint(o.colour, 0.85))); gr.addColorStop(0.45, css(tint(o.colour, 0.3))); gr.addColorStop(0.85, css(o.colour)); gr.addColorStop(1, css(o.colour, 0));
    s.fillStyle = gr; s.fillRect(0, 0, 2 * R, 2 * R); }
  const on = layer(d, 0, (lc) => { for (let k = 0; k < lit.length; k += 2) lc.drawImage(sp, lit[k] - R, lit[k + 1] - R); });
  put(d, on, { blur: pitch * 2.6, colour: o.colour, alpha: 0.85 });
  put(d, on);
}

/** Round bulbs in sockets; every `dimEvery`th one is off, as a chaser caught mid-run. */
function bulbs(d, pts, r, colours, o = {}) {
  const c = d.ctx;
  c.fillStyle = o.socket ?? '#3a2a1c';
  for (const [x, y] of pts) { c.beginPath(); c.arc(x, y, r * 1.25, 0, TAU); c.fill(); }
  const on = layer(d, 0, (lc) => {
    pts.forEach(([x, y], i) => {
      const col = colours[i % colours.length], off = o.dimEvery && i % o.dimEvery === 0;
      const g = lc.createRadialGradient(x - r * 0.25, y - r * 0.25, 0, x, y, r);
      g.addColorStop(0, off ? css(shade(col, 0.35)) : '#fffdf4'); g.addColorStop(0.5, css(off ? shade(col, 0.5) : tint(col, 0.3))); g.addColorStop(1, css(off ? shade(col, 0.6) : col));
      lc.fillStyle = g; lc.beginPath(); lc.arc(x, y, r, 0, TAU); lc.fill();
    });
  });
  put(d, on, { blur: r * 3.2, colour: colours[0], alpha: 0.8 });
  put(d, on);
}

// ---------------------------------------------------------------- boards and panels

function grain(d, x, y, w, h, n, a = 0.05) {
  const c = d.ctx;
  for (let i = 0; i < n; i++) {
    const v = d.rng() < 0.5 ? 255 : 0;
    c.fillStyle = `rgba(${v},${v},${v},${(a * d.rng()).toFixed(3)})`;
    c.fillRect(x + d.rng() * w, y + d.rng() * h, 1 + d.rng() * 2, 1 + d.rng() * 2);
  }
}

/** The dark backing board a neon sign is mounted on: a metal frame, a near-black face, four bolts. */
function board(d, x, y, w, h, o = {}) {
  const c = d.ctx, m = d.S, fw = o.fw ?? 0.03 * m, r = o.r ?? 0.02 * m;
  c.fillStyle = o.frame ?? '#3a3541'; rr(c, x, y, w, h, r); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.14)'; c.lineWidth = 1.5; rr(c, x + 1, y + 1, w - 2, h - 2, r); c.stroke();
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, o.top ?? '#1c1523'); g.addColorStop(1, o.bottom ?? '#0d0a11');
  c.fillStyle = g; rr(c, x + fw, y + fw, w - 2 * fw, h - 2 * fw, Math.max(0, r - fw)); c.fill();
  grain(d, x + fw, y + fw, w - 2 * fw, h - 2 * fw, Math.floor((w * h) / 90), 0.06);
  if (o.bolts !== false) {
    c.fillStyle = 'rgba(170,160,180,0.55)';
    for (const [bx, by] of [[x + fw * 2, y + fw * 2], [x + w - fw * 2, y + fw * 2], [x + fw * 2, y + h - fw * 2], [x + w - fw * 2, y + h - fw * 2]]) { c.beginPath(); c.arc(bx, by, fw * 0.4, 0, TAU); c.fill(); }
  }
  return { x: x + fw, y: y + fw, w: w - 2 * fw, h: h - 2 * fw };
}

/**
 * A lit box's face: a metal frame, the acrylic lit from behind (a gradient, the bright stripes of the tubes
 * behind it, darker toward the frame).
 */
function panel(d, x, y, w, h, c0, c1, o = {}) {
  const c = d.ctx, m = d.S, fw = o.fw ?? 0.035 * m, r = o.r ?? 0.015 * m;
  c.fillStyle = o.frame ?? '#1f1d24'; rr(c, x, y, w, h, r); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 1.5; rr(c, x + 1, y + 1, w - 2, h - 2, r); c.stroke();
  const ix = x + fw, iy = y + fw, iw = w - 2 * fw, ih = h - 2 * fw;
  c.save(); rr(c, ix, iy, iw, ih, Math.max(0, r - fw)); c.clip();
  const g = o.across ? c.createLinearGradient(ix, 0, ix + iw, 0) : c.createLinearGradient(0, iy, 0, iy + ih);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  c.fillStyle = g; c.fillRect(ix, iy, iw, ih);
  const n = o.tubes ?? 2, a = o.tubeA ?? 0.1, vert = ih > iw;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    if (vert) {
      const cx = ix + iw * t, hw = (iw / n) * 0.5;
      const gg = c.createLinearGradient(cx - hw, 0, cx + hw, 0);
      gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(0.5, `rgba(255,255,255,${a})`); gg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gg; c.fillRect(cx - hw, iy, 2 * hw, ih);
    } else {
      const cy = iy + ih * t, hh = (ih / n) * 0.5;
      const gg = c.createLinearGradient(0, cy - hh, 0, cy + hh);
      gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(0.5, `rgba(255,255,255,${a})`); gg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gg; c.fillRect(ix, cy - hh, iw, 2 * hh);
    }
  }
  // the edge falls off toward the frame
  c.shadowColor = `rgba(0,0,0,${o.edge ?? 0.45})`; c.shadowBlur = Math.min(iw, ih) * 0.22;
  c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 4; c.strokeRect(ix - 2, iy - 2, iw + 4, ih + 4);
  c.restore();
  return { x: ix, y: iy, w: iw, h: ih };
}

/** A small floor or price tag: a rounded plate with a word on it. */
function tag(d, text, cx, cy, w, h, bg, fg, font) {
  const c = d.ctx;
  c.fillStyle = bg; rr(c, cx - w / 2, cy - h / 2, w, h, h * 0.25); c.fill();
  boxText(d, hline(c, text, cx, cy, h * 0.72, font || d.font.gothic, w * 0.86), fg);
}

// ---------------------------------------------------------------- icons (paths, for neon or for ink)

const IC = {
  bowl: (cx, cy, s) => (c) => {
    const w = s, h = s * 0.42;
    c.moveTo(cx - w / 2, cy); c.lineTo(cx + w / 2, cy);
    c.moveTo(cx - w * 0.47, cy); c.quadraticCurveTo(cx - w * 0.44, cy + h, cx, cy + h); c.quadraticCurveTo(cx + w * 0.44, cy + h, cx + w * 0.47, cy);
    c.moveTo(cx - w * 0.16, cy + h); c.lineTo(cx - w * 0.18, cy + h * 1.22); c.lineTo(cx + w * 0.18, cy + h * 1.22); c.lineTo(cx + w * 0.16, cy + h);
    c.moveTo(cx + w * 0.06, cy - h * 0.08); c.lineTo(cx + w * 0.5, cy - h * 1.25);
    c.moveTo(cx + w * 0.16, cy - h * 0.04); c.lineTo(cx + w * 0.58, cy - h * 1.1);
    for (let i = -1; i <= 0; i++) { const x = cx + i * w * 0.2 - w * 0.02; c.moveTo(x, cy - h * 0.18); c.bezierCurveTo(x - w * 0.09, cy - h * 0.55, x + w * 0.09, cy - h * 0.8, x, cy - h * 1.2); }
  },
  mic: (cx, cy, s) => (c) => {
    const R = s * 0.2, hy = cy - s * 0.22;
    c.moveTo(cx + R, hy); c.arc(cx, hy, R, 0, TAU);
    c.moveTo(cx - R * 0.95, hy - R * 0.25); c.lineTo(cx + R * 0.95, hy - R * 0.25);
    c.moveTo(cx - R * 0.95, hy + R * 0.25); c.lineTo(cx + R * 0.95, hy + R * 0.25);
    c.moveTo(cx - R * 0.55, hy + R * 0.95); c.lineTo(cx - R * 0.3, cy + s * 0.46); c.lineTo(cx + R * 0.3, cy + s * 0.46); c.lineTo(cx + R * 0.55, hy + R * 0.95);
    c.moveTo(cx - R * 0.35, cy + s * 0.1); c.lineTo(cx + R * 0.35, cy + s * 0.1);
  },
  star: (cx, cy, r, inner = 0.45, n = 5, rot = -Math.PI / 2) => (c) => {
    for (let i = 0; i <= n * 2; i++) {
      const a = rot + (i * Math.PI) / n, rr2 = i % 2 ? r * inner : r;
      const x = cx + Math.cos(a) * rr2, y = cy + Math.sin(a) * rr2;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath();
  },
  moon: (cx, cy, r) => (c) => {
    c.moveTo(cx + Math.cos(-1.1) * r, cy + Math.sin(-1.1) * r);
    c.arc(cx, cy, r, -1.1, 1.1, true);
    c.arc(cx + r * 0.55, cy, r * 0.78, 1.47, -1.47, false);
  },
  cup: (cx, cy, s) => (c) => {
    const w = s * 0.62, h = s * 0.46, top = cy - h * 0.2;
    c.moveTo(cx - w / 2, top); c.lineTo(cx + w / 2, top); c.lineTo(cx + w * 0.4, top + h); c.lineTo(cx - w * 0.4, top + h); c.closePath();
    c.moveTo(cx + w * 0.47, top + h * 0.22); c.arc(cx + w * 0.5, top + h * 0.45, h * 0.24, -Math.PI / 2, Math.PI / 2);
    c.moveTo(cx - w * 0.7, top + h * 1.18); c.lineTo(cx + w * 0.7, top + h * 1.18);
    for (const dx of [-0.16, 0.12]) { const x = cx + dx * w; c.moveTo(x, top - h * 0.15); c.bezierCurveTo(x - w * 0.14, top - h * 0.45, x + w * 0.14, top - h * 0.65, x, top - h * 0.95); }
  },
  flame: (cx, cy, s) => (c) => {
    c.moveTo(cx, cy - s * 0.5);
    c.bezierCurveTo(cx + s * 0.08, cy - s * 0.2, cx + s * 0.34, cy - s * 0.05, cx + s * 0.3, cy + s * 0.2);
    c.bezierCurveTo(cx + s * 0.26, cy + s * 0.45, cx - s * 0.26, cy + s * 0.45, cx - s * 0.3, cy + s * 0.2);
    c.bezierCurveTo(cx - s * 0.34, cy - s * 0.02, cx - s * 0.12, cy - s * 0.12, cx - s * 0.06, cy - s * 0.32);
    c.bezierCurveTo(cx - s * 0.02, cy - s * 0.2, cx + s * 0.02, cy - s * 0.3, cx, cy - s * 0.5);
  },
  fish: (cx, cy, s) => (c) => {
    const L = s, H = s * 0.34;
    c.moveTo(cx - L * 0.42, cy);
    c.quadraticCurveTo(cx - L * 0.05, cy - H, cx + L * 0.28, cy);
    c.quadraticCurveTo(cx - L * 0.05, cy + H, cx - L * 0.42, cy);
    c.moveTo(cx + L * 0.28, cy); c.lineTo(cx + L * 0.5, cy - H * 0.55); c.lineTo(cx + L * 0.46, cy); c.lineTo(cx + L * 0.5, cy + H * 0.55); c.closePath();
    c.moveTo(cx - L * 0.24 + H * 0.12, cy - H * 0.2); c.arc(cx - L * 0.24, cy - H * 0.2, H * 0.12, 0, TAU);
  },
  glass: (cx, cy, s) => (c) => {
    const w = s * 0.6, top = cy - s * 0.42, mid = cy + s * 0.05;
    c.moveTo(cx - w / 2, top); c.lineTo(cx + w / 2, top); c.lineTo(cx, mid); c.closePath();
    c.moveTo(cx, mid); c.lineTo(cx, cy + s * 0.4);
    c.moveTo(cx - w * 0.36, cy + s * 0.42); c.lineTo(cx + w * 0.36, cy + s * 0.42);
    c.moveTo(cx - w * 0.05, top - s * 0.08); c.lineTo(cx + w * 0.3, top + s * 0.2);
    c.moveTo(cx + w * 0.22 + s * 0.07, top + s * 0.13); c.arc(cx + w * 0.22, top + s * 0.13, s * 0.07, 0, TAU);
  },
  ball: (cx, cy, s) => (c) => {
    const R = s * 0.32, by = cy - s * 0.08;
    c.moveTo(cx + R, by); c.arc(cx, by, R, 0, TAU);
    c.moveTo(cx - R * 0.55, by - R * 0.15); c.arc(cx, by, R * 0.6, Math.PI * 1.05, Math.PI * 1.45);
    c.moveTo(cx - R * 0.75, by + R * 0.85); c.lineTo(cx + R * 0.75, by + R * 0.85); c.lineTo(cx + R * 0.95, cy + s * 0.42); c.lineTo(cx - R * 0.95, cy + s * 0.42); c.closePath();
  },
  bottle: (cx, cy, s) => (c) => {
    const x = cx - s * 0.12;
    c.moveTo(x - s * 0.06, cy - s * 0.46); c.lineTo(x + s * 0.06, cy - s * 0.46);
    c.moveTo(x - s * 0.05, cy - s * 0.44); c.bezierCurveTo(x - s * 0.05, cy - s * 0.2, x - s * 0.26, cy - s * 0.08, x - s * 0.24, cy + s * 0.18);
    c.bezierCurveTo(x - s * 0.22, cy + s * 0.42, x + s * 0.22, cy + s * 0.42, x + s * 0.24, cy + s * 0.18);
    c.bezierCurveTo(x + s * 0.26, cy - s * 0.08, x + s * 0.05, cy - s * 0.2, x + s * 0.05, cy - s * 0.44);
    const ox = cx + s * 0.3, oy = cy + s * 0.22;
    c.moveTo(ox - s * 0.13, oy - s * 0.1); c.lineTo(ox + s * 0.13, oy - s * 0.1); c.lineTo(ox + s * 0.08, oy + s * 0.14); c.lineTo(ox - s * 0.08, oy + s * 0.14); c.closePath();
  },
  heart: (cx, cy, s) => (c) => {
    c.moveTo(cx, cy + s * 0.38);
    c.bezierCurveTo(cx - s * 0.55, cy, cx - s * 0.4, cy - s * 0.45, cx, cy - s * 0.18);
    c.bezierCurveTo(cx + s * 0.4, cy - s * 0.45, cx + s * 0.55, cy, cx, cy + s * 0.38);
  },
  wave: (x0, x1, cy, amp, n) => (c) => {
    c.moveTo(x0, cy);
    const step = (x1 - x0) / n;
    for (let i = 0; i < n; i++) c.quadraticCurveTo(x0 + step * (i + 0.5), cy + (i % 2 ? amp : -amp), x0 + step * (i + 1), cy);
  },
  invader: (cx, cy, s) => (c) => {
    const P = ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'];
    const px = s / 11;
    P.forEach((row, j) => { for (let i = 0; i < 11; i++) if (row[i] === '1') c.rect(cx - s / 2 + i * px + px * 0.06, cy - px * 4 + j * px + px * 0.06, px * 0.88, px * 0.88); });
  },
};

/** A red paper lantern (chochin), lit from inside. */
function lantern(d, cx, cy, rx, ry) {
  const c = d.ctx;
  c.save();
  c.shadowColor = 'rgba(255,90,40,0.9)'; c.shadowBlur = rx * 1.4;
  const g = c.createRadialGradient(cx - rx * 0.2, cy - ry * 0.2, rx * 0.1, cx, cy, rx * 1.1);
  g.addColorStop(0, '#ffcf8a'); g.addColorStop(0.35, '#ff6a32'); g.addColorStop(1, '#b0180f');
  c.fillStyle = g; c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, TAU); c.fill();
  c.restore();
  c.strokeStyle = 'rgba(90,10,5,0.55)'; c.lineWidth = Math.max(1, rx * 0.06);
  for (let k = -3; k <= 3; k++) { const yy = cy + (k / 4) * ry; const hw = rx * Math.sqrt(Math.max(0, 1 - (k / 4) ** 2)); c.beginPath(); c.moveTo(cx - hw, yy); c.lineTo(cx + hw, yy); c.stroke(); }
  c.fillStyle = '#17110f';
  c.fillRect(cx - rx * 0.55, cy - ry - ry * 0.16, rx * 1.1, ry * 0.2);
  c.fillRect(cx - rx * 0.55, cy + ry - ry * 0.04, rx * 1.1, ry * 0.2);
}

// ---------------------------------------------------------------- the designs
// Each draws itself into its W x H pixel box with d.ctx; m is pixels to the metre, so positions read in metres.

const V = (name, w, h, colour, draw) => ({ name, w, h, colour, vertical: true, draw });
const Hz = (name, w, h, colour, draw) => ({ name, w, h, colour, vertical: false, draw });

// the tenant stack's panels: each fills (x, y, w, h) of the sign
function tenant(d, kind, x, y, w, h, floor) {
  const m = d.S, c = d.ctx, R = d.font.round, G = d.font.gothic, T = d.T;
  const fy = y + h - 0.14 * m;
  let body;
  if (kind === 'bar') {
    const b = board(d, x, y, w, h, { fw: 0.025 * m, bolts: false });
    neon(d, { glyphs: hline(c, 'BAR', x + w / 2, y + h * 0.42, 0.42 * m, R, b.w * 0.82) }, 0xb35cff, { outline: true, tw: 0.035 * m });
    body = 0xffffff;
  } else if (kind === 'snack') {
    panel(d, x, y, w, h, '#ff9ad2', '#f062b4', { fw: 0.025 * m });
    boxText(d, hline(c, T('スナック', 'SNACK'), x + w / 2, y + h * 0.42, 0.26 * m, G, w * 0.84), '#3a0626');
    body = 0x3a0626;
  } else if (kind === 'mahjong') {
    panel(d, x, y, w, h, '#26b062', '#137a3e', { fw: 0.025 * m });
    boxText(d, hline(c, T('麻雀', 'MAHJONG'), x + w / 2, y + h * 0.42, 0.42 * m, G, w * 0.84), '#ffffff', { stroke: '#0a3d1f', strokeW: 0.03 * m });
    body = 0xffffff;
  } else if (kind === 'karaoke') {
    panel(d, x, y, w, h, '#fffdf8', '#efe9e0', { fw: 0.025 * m });
    boxText(d, hline(c, T('カラオケ', 'KARAOKE'), x + w / 2, y + h * 0.42, 0.25 * m, G, w * 0.86), '#e0182c');
    body = 0x7a1018;
  } else if (kind === 'izakaya') {
    const b = board(d, x, y, w, h, { fw: 0.025 * m, bolts: false, top: '#1f1208', bottom: '#120a05' });
    neon(d, { glyphs: hline(c, T('居酒屋', 'IZAKAYA'), x + w / 2, y + h * 0.42, 0.32 * m, R, b.w * 0.86) }, 0xff8a24);
    body = 0xffd9a0;
  } else if (kind === 'club') {
    panel(d, x, y, w, h, '#3c6cff', '#1c3cc8', { fw: 0.025 * m });
    boxText(d, hline(c, 'CLUB', x + w / 2, y + h * 0.42, 0.36 * m, G, w * 0.8), '#ffffff', { stroke: '#0c1a66', strokeW: 0.025 * m });
    body = 0xffffff;
  } else if (kind === 'uranai') {
    const b = board(d, x, y, w, h, { fw: 0.025 * m, bolts: false });
    neon(d, { glyphs: hline(c, T('占い', 'TAROT'), x + w / 2, y + h * 0.42, 0.4 * m, R, b.w * 0.8) }, 0xd24dff);
    body = 0xffffff;
  } else if (kind === 'kissa') {
    panel(d, x, y, w, h, '#fff1d8', '#efd8b2', { fw: 0.025 * m });
    boxText(d, hline(c, T('喫茶', 'CAFE'), x + w / 2, y + h * 0.42, 0.4 * m, G, w * 0.8), '#4a2410');
    body = 0x4a2410;
  } else if (kind === 'yakiniku') {
    panel(d, x, y, w, h, '#f0301e', '#b51510', { fw: 0.025 * m });
    boxText(d, hline(c, T('焼肉', 'BBQ'), x + w / 2, y + h * 0.42, 0.42 * m, G, w * 0.8), '#fff4e0', { stroke: '#5a0804', strokeW: 0.03 * m });
    body = 0xfff4e0;
  } else if (kind === 'drink') {
    const b = board(d, x, y, w, h, { fw: 0.025 * m, bolts: false, top: '#0c0b0c', bottom: '#080708' });
    led(d, 'DRINK', b.x + 0.02 * m, y + h * 0.24, b.w - 0.04 * m, 0.38 * m, { pitch: 0.03 * m, colour: 0xffd23a });
    body = 0xffd23a;
  } else if (kind === '24h') {
    const b = board(d, x, y, w, h, { fw: 0.025 * m, bolts: false });
    neon(d, { glyphs: hline(c, '24H', x + w / 2, y + h * 0.42, 0.42 * m, R, b.w * 0.8) }, 0x2ff0ff);
    body = 0x2ff0ff;
  }
  // the floor, small, along the foot of the panel
  boxText(d, hline(c, floor, x + w / 2, fy, 0.15 * m, G), css(body, 0.9));
}

const DESIGNS = [
  // ---------------------------------------------------------------- vertical: tate-kanban
  V('ramen', 1.0, 4.6, 0xff3b2f, (d) => {
    const { W, H, S: m, ctx: c } = d;
    const p = panel(d, 0, 0, W, H, '#f43c24', '#c0170f', { tubes: 2 });
    const cy = 0.55 * m, R = 0.37 * m;
    c.fillStyle = '#ffd43a'; c.beginPath(); c.arc(W / 2, cy, R, 0, TAU); c.fill();
    c.strokeStyle = '#fff0c0'; c.lineWidth = 0.022 * m; c.stroke();
    c.strokeStyle = '#8a1208'; c.lineWidth = 0.03 * m; c.lineCap = c.lineJoin = 'round';
    c.beginPath(); IC.bowl(W / 2, cy + 0.04 * m, 0.46 * m)(c); c.stroke();
    c.strokeStyle = 'rgba(255,236,214,0.9)'; c.lineWidth = 0.018 * m; c.strokeRect(p.x + 0.05 * m, 1.0 * m, p.w - 0.1 * m, H - 1.1 * m);
    boxText(d, vstack(c, d.T('ラーメン', 'RAMEN'), W / 2, 1.06 * m, 4.44 * m, 0.72 * m, d.font.gothic), '#fff7ea', { stroke: '#6e0804', strokeW: 0.05 * m });
  }),
  V('karaoke', 1.0, 5.2, 0xff3fa4, (d) => {
    const { W, S: m, ctx: c } = d;
    const b = board(d, 0, 0, W, d.H, { top: '#1f0f25', bottom: '#0d0912' });
    neon(d, { paths: [(cc) => rrp(cc, b.x + 0.06 * m, b.y + 0.06 * m, b.w - 0.12 * m, b.h - 0.12 * m, 0.1 * m)] }, 0x35e8ff, { px: 0.3 * m, tw: 0.026 * m, glow: 0.8 });
    neon(d, { paths: [IC.mic(W / 2, 0.58 * m, 0.62 * m)] }, 0xfff06a, { px: 0.36 * m, tw: 0.03 * m });
    neon(d, { glyphs: vstack(c, d.T('カラオケ', 'KARAOKE'), W / 2, 1.08 * m, 4.36 * m, 0.66 * m, d.font.round) }, 0xff3fa4);
    neon(d, { glyphs: hline(c, 'BOX', W / 2, 4.74 * m, 0.25 * m, d.font.round, b.w * 0.7) }, 0x35e8ff);
  }),
  V('izakaya', 1.1, 4.2, 0xffd9a8, (d) => {
    const { W, H, S: m, ctx: c } = d;
    const p = panel(d, 0, 0, W, H, '#fff6e2', '#f2dcbc', { tubes: 2, tubeA: 0.14 });
    c.fillStyle = '#1a1412'; c.fillRect(p.x, p.y, p.w, 0.7 * m);
    lantern(d, W / 2, 0.37 * m, 0.2 * m, 0.25 * m);
    c.fillStyle = '#c8201a'; c.fillRect(p.x, 0.7 * m, p.w, 0.06 * m); c.fillRect(p.x, H - p.y - 0.3 * m, p.w, 0.3 * m);
    c.fillStyle = '#fff0dc'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(W / 2 + (i - 1) * 0.22 * m, H - p.y - 0.15 * m, 0.045 * m, 0, TAU); c.fill(); }
    boxText(d, vstack(c, d.T('居酒屋', 'IZAKAYA'), W / 2, 0.86 * m, 3.8 * m, 0.82 * m, d.font.gothic), '#1c1512');
  }),
  V('sushi', 0.9, 3.2, 0x49d4ff, (d) => {
    const { W, H, S: m, ctx: c } = d;
    const p = panel(d, 0, 0, W, H, '#f6fcff', '#dcebf5', { tubes: 2 });
    c.fillStyle = '#16b8f4'; c.fillRect(p.x, p.y, 0.08 * m, p.h); c.fillRect(p.x + p.w - 0.08 * m, p.y, 0.08 * m, p.h);
    c.fillStyle = '#d8231c'; rr(c, W / 2 - 0.3 * m, 0.1 * m, 0.6 * m, 0.4 * m, 0.06 * m); c.fill();
    boxText(d, hline(c, 'SUSHI', W / 2, 0.3 * m, 0.2 * m, d.font.gothic, 0.5 * m), '#ffffff');
    boxText(d, vstack(c, d.T('寿司', 'SUSHI'), W / 2, 0.66 * m, 2.46 * m, 0.66 * m, d.font.gothic), '#12306e');
    c.strokeStyle = '#12306e'; c.lineWidth = 0.028 * m; c.lineJoin = c.lineCap = 'round';
    c.beginPath(); IC.fish(W / 2, 2.8 * m, 0.56 * m)(c); c.stroke();
  }),
  V('yakiniku', 1.0, 3.6, 0xff6a1a, (d) => {
    const { W, S: m, ctx: c } = d;
    board(d, 0, 0, W, d.H, { top: '#1a0c07', bottom: '#0e0604' });
    neon(d, { paths: [IC.flame(W / 2, 0.5 * m, 0.66 * m)] }, 0xff3a14, { px: 0.4 * m, tw: 0.034 * m });
    neon(d, { paths: [IC.flame(W / 2, 0.58 * m, 0.34 * m)] }, 0xffd23a, { px: 0.3 * m, tw: 0.026 * m, glow: 0.6 });
    neon(d, { glyphs: vstack(c, d.T('焼肉', 'BBQ'), W / 2, 1.0 * m, 2.95 * m, 0.72 * m, d.font.round) }, 0xff6a1a);
    neon(d, { paths: [(cc) => { cc.moveTo(0.18 * m, 3.18 * m); cc.lineTo(W - 0.18 * m, 3.18 * m); cc.moveTo(0.18 * m, 3.32 * m); cc.lineTo(W - 0.18 * m, 3.32 * m); }] }, 0xffd23a, { px: 0.25 * m, tw: 0.024 * m, glow: 0.7 });
  }),
  V('drug', 1.0, 3.0, 0xffd21a, (d) => {
    const { W, S: m, ctx: c } = d;
    panel(d, 0, 0, W, d.H, '#ffdc40', '#f4b80c', { tubes: 2, tubeA: 0.14 });
    c.fillStyle = '#16348a'; c.beginPath(); c.arc(W / 2, 0.52 * m, 0.4 * m, 0, TAU); c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = 0.025 * m; c.beginPath(); c.arc(W / 2, 0.52 * m, 0.35 * m, 0, TAU); c.stroke();
    boxText(d, hline(c, d.T('薬', 'Rx'), W / 2, 0.52 * m, 0.5 * m, d.font.gothic), '#ffffff');
    boxText(d, vstack(c, d.T('くすり', 'DRUG'), W / 2, 1.04 * m, 2.4 * m, 0.42 * m, d.font.gothic), '#16348a');
    c.fillStyle = '#ffffff'; rr(c, W / 2 - 0.2 * m, 2.47 * m, 0.4 * m, 0.4 * m, 0.05 * m); c.fill();
    c.fillStyle = '#14a44a'; c.fillRect(W / 2 - 0.055 * m, 2.52 * m, 0.11 * m, 0.3 * m); c.fillRect(W / 2 - 0.15 * m, 2.615 * m, 0.3 * m, 0.11 * m);
  }),
  V('hotel', 1.2, 5.8, 0xb45cff, (d) => {
    const { W, S: m, ctx: c } = d;
    const b = board(d, 0, 0, W, d.H, { top: '#170d24', bottom: '#0b0712' });
    neon(d, { paths: [(cc) => rrp(cc, b.x + 0.06 * m, b.y + 0.06 * m, b.w - 0.12 * m, b.h - 0.12 * m, 0.14 * m)] }, 0xff4fc8, { px: 0.3 * m, tw: 0.024 * m, glow: 0.7 });
    neon(d, { paths: [IC.moon(W / 2 - 0.08 * m, 0.62 * m, 0.3 * m)] }, 0xffe066, { px: 0.36 * m, tw: 0.032 * m });
    neon(d, { paths: [IC.star(W / 2 + 0.3 * m, 0.34 * m, 0.1 * m), IC.star(W / 2 + 0.26 * m, 0.86 * m, 0.07 * m)] }, 0xff4fc8, { px: 0.25 * m, tw: 0.02 * m });
    neon(d, { glyphs: vstack(c, d.T('ホテル', 'HOTEL'), W / 2, 1.18 * m, 4.12 * m, 0.82 * m, d.font.round) }, 0xb45cff);
    neon(d, { glyphs: vturned(c, 'HOTEL', W / 2, 4.28 * m, 5.52 * m, 0.4 * m, d.font.round) }, 0xff4fc8);
  }),
  V('pachinko', 1.2, 6.8, 0xffb31a, (d) => {
    const { W, H, S: m, ctx: c } = d;
    const p = panel(d, 0, 0, W, H, '#c8121e', '#840913', { frame: '#d6a02a', fw: 0.05 * m, tubes: 2 });
    const pts = [];
    for (let y = 0.2 * m; y < H - 0.12 * m; y += 0.2 * m) { pts.push([p.x + 0.09 * m, y]); pts.push([p.x + p.w - 0.09 * m, y]); }
    bulbs(d, pts, 0.042 * m, [0xffe07a, 0xfff6d8], { dimEvery: 5 });
    neon(d, { paths: [IC.star(W / 2, 0.58 * m, 0.34 * m, 0.42)] }, 0xffd23a, { px: 0.4 * m, tw: 0.03 * m });
    const cols = [0xff4fb0, 0xffe03a, 0x35e8ff, 0x46ff7a];
    const ch = [...d.T('パチンコ', 'PACHINKO')];
    const y0 = 1.0 * m, cell = (4.72 * m) / ch.length;
    ch.forEach((t, i) => {
      const cy = y0 + cell * (i + 0.5), s = Math.min(0.84 * m, cell * 0.92);
      c.fillStyle = '#1a0608'; rr(c, W / 2 - s / 2, cy - s / 2, s, s, 0.08 * m); c.fill();
      c.strokeStyle = css(cols[i % 4], 0.8); c.lineWidth = 0.02 * m; rr(c, W / 2 - s / 2 + 0.03 * m, cy - s / 2 + 0.03 * m, s - 0.06 * m, s - 0.06 * m, 0.06 * m); c.stroke();
      neon(d, { glyphs: [glyph(c, t, W / 2, cy, s * 0.78, d.font.round, TURN.has(t) ? Math.PI / 2 : 0)] }, cols[i % 4], { glow: 0.8 });
    });
    neon(d, { glyphs: vstack(c, '777', W / 2, 5.86 * m, 6.62 * m, 0.34 * m, d.font.round) }, 0xffd23a, { glow: 0.8 });
  }),
  V('game', 1.0, 4.4, 0x2ff0ff, (d) => {
    const { W, S: m, ctx: c } = d;
    board(d, 0, 0, W, d.H, { top: '#08141c', bottom: '#050a0e' });
    neon(d, { fills: [IC.invader(W / 2, 0.52 * m, 0.62 * m)] }, 0x46ff7a, { px: 0.4 * m, erode: 0.012 * m });
    neon(d, { glyphs: vstack(c, d.T('ゲーム', 'GAME'), W / 2, 1.0 * m, 3.62 * m, 0.72 * m, d.font.round) }, 0x2ff0ff);
    neon(d, { glyphs: hline(c, 'GAME', W / 2, 3.98 * m, 0.24 * m, d.font.round, 0.7 * m) }, 0xff3fd0);
  }),
  V('kissa', 1.0, 3.4, 0x3dff8a, (d) => {
    const { W, S: m, ctx: c } = d;
    board(d, 0, 0, W, d.H, { top: '#0b1a12', bottom: '#060d09' });
    neon(d, { paths: [IC.cup(W / 2, 0.62 * m, 0.72 * m)] }, 0xffe7b0, { px: 0.4 * m, tw: 0.03 * m });
    neon(d, { glyphs: vstack(c, d.T('喫茶', 'CAFE'), W / 2, 1.1 * m, 2.84 * m, 0.72 * m, d.font.round) }, 0x3dff8a);
    neon(d, { glyphs: hline(c, 'CAFE', W / 2, 3.08 * m, 0.24 * m, d.font.round, 0.7 * m) }, 0xffb13a);
  }),
  V('mahjong', 1.0, 3.6, 0x22d07a, (d) => {
    const { W, S: m, ctx: c } = d;
    panel(d, 0, 0, W, d.H, '#26b865', '#117a3c', { tubes: 2 });
    c.fillStyle = '#0c5a2c'; rr(c, W / 2 - 0.25 * m, 0.14 * m, 0.52 * m, 0.7 * m, 0.07 * m); c.fill();
    c.fillStyle = '#fbfaf4'; rr(c, W / 2 - 0.27 * m, 0.12 * m, 0.5 * m, 0.68 * m, 0.07 * m); c.fill();
    c.strokeStyle = '#1b6fd0'; c.lineWidth = 0.035 * m; c.beginPath(); c.arc(W / 2 - 0.02 * m, 0.46 * m, 0.16 * m, 0, TAU); c.stroke();
    c.fillStyle = '#d8231c'; c.beginPath(); c.arc(W / 2 - 0.02 * m, 0.46 * m, 0.09 * m, 0, TAU); c.fill();
    boxText(d, vstack(c, d.T('麻雀', 'MAHJONG'), W / 2, 0.96 * m, 2.76 * m, 0.7 * m, d.font.gothic), '#ffffff', { stroke: '#0a4a24', strokeW: 0.04 * m });
    tag(d, '3F', W / 2, 3.16 * m, 0.56 * m, 0.4 * m, '#fbfaf4', '#117a3c');
  }),
  V('uranai', 0.9, 3.4, 0xd24dff, (d) => {
    const { W, S: m, ctx: c } = d;
    board(d, 0, 0, W, d.H, { top: '#1a0c22', bottom: '#0c0610' });
    neon(d, { paths: [IC.ball(W / 2, 0.56 * m, 0.72 * m)] }, 0x9ad8ff, { px: 0.36 * m, tw: 0.03 * m });
    neon(d, { paths: [IC.star(W / 2 - 0.28 * m, 0.2 * m, 0.07 * m), IC.star(W / 2 + 0.3 * m, 0.34 * m, 0.05 * m)] }, 0xffe066, { px: 0.2 * m, tw: 0.018 * m });
    neon(d, { glyphs: vstack(c, d.T('占い', 'TAROT'), W / 2, 1.08 * m, 2.66 * m, 0.64 * m, d.font.round) }, 0xd24dff);
    neon(d, { glyphs: vturned(c, 'TAROT', W / 2, 2.8 * m, 3.28 * m, 0.24 * m, d.font.round) }, 0x9ad8ff);
  }),
  V('yakitori', 1.0, 3.6, 0xff9a1f, (d) => {
    const { W, H, S: m, ctx: c } = d;
    const p = panel(d, 0, 0, W, H, '#ffbd3c', '#f08414', { tubes: 2, tubeA: 0.14 });
    c.strokeStyle = '#3a1a08'; c.lineWidth = 0.025 * m; c.lineCap = 'round';
    c.beginPath(); c.moveTo(W / 2 - 0.3 * m, 0.72 * m); c.lineTo(W / 2 + 0.34 * m, 0.2 * m); c.stroke();
    c.fillStyle = '#5a260c';
    for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(W / 2 - 0.16 * m + k * 0.15 * m, 0.6 * m - k * 0.125 * m, 0.08 * m, 0, TAU); c.fill(); }
    boxText(d, vstack(c, d.T('焼鳥', 'YAKITORI'), W / 2, 0.96 * m, 2.8 * m, 0.72 * m, d.font.gothic), '#1d0f06');
    c.fillStyle = '#c81e18'; c.fillRect(p.x, 2.95 * m, p.w, H - p.y - 2.95 * m);
    c.fillStyle = '#fff4d8'; rr(c, W / 2 - 0.16 * m, 3.05 * m, 0.26 * m, 0.34 * m, 0.03 * m); c.fill();
    c.strokeStyle = '#fff4d8'; c.lineWidth = 0.035 * m; c.beginPath(); c.arc(W / 2 + 0.12 * m, 3.22 * m, 0.08 * m, -1.3, 1.3); c.stroke();
    c.fillStyle = '#ffc23a'; c.fillRect(W / 2 - 0.13 * m, 3.13 * m, 0.2 * m, 0.22 * m);
  }),
  V('coffee', 0.9, 3.2, 0xffd9a0, (d) => {
    const { W, H, S: m, ctx: c } = d;
    const p = panel(d, 0, 0, W, H, '#fff2da', '#eed4a8', { tubes: 2 });
    c.fillStyle = '#1f4a32'; c.fillRect(p.x, p.y, p.w, 0.78 * m);
    c.fillStyle = '#f4dcb0'; c.beginPath(); c.ellipse(W / 2, 0.42 * m, 0.17 * m, 0.25 * m, 0.5, 0, TAU); c.fill();
    c.strokeStyle = '#1f4a32'; c.lineWidth = 0.03 * m; c.beginPath(); c.moveTo(W / 2 - 0.08 * m, 0.22 * m); c.bezierCurveTo(W / 2 + 0.1 * m, 0.34 * m, W / 2 - 0.1 * m, 0.5 * m, W / 2 + 0.08 * m, 0.62 * m); c.stroke();
    boxText(d, vstack(c, d.T('珈琲', 'COFFEE'), W / 2, 0.92 * m, 2.5 * m, 0.62 * m, d.font.gothic), '#4a2612');
    c.fillStyle = '#4a2612'; c.fillRect(p.x, 2.62 * m, p.w, H - p.y - 2.62 * m);
    boxText(d, hline(c, 'CAFE', W / 2, 2.88 * m, 0.24 * m, d.font.gothic, p.w * 0.8), '#fff2da');
  }),
  V('open_led', 1.0, 3.8, 0xff3322, (d) => {
    const { W, S: m } = d;
    const b = board(d, 0, 0, W, d.H, { frame: '#8c8f96', top: '#0c0a0a', bottom: '#080707' });
    led(d, d.T('営業中', 'OPEN'), b.x + 0.04 * m, b.y + 0.12 * m, b.w - 0.08 * m, 2.72 * m, { pitch: 0.036 * m, colour: 0xff2a1a, vertical: true });
    led(d, 'OPEN', b.x + 0.04 * m, 3.02 * m, b.w - 0.08 * m, 0.5 * m, { pitch: 0.03 * m, colour: 0x2aff5a });
  }),
  V('sakaba', 1.0, 3.4, 0xffe03a, (d) => {
    const { W, S: m, ctx: c } = d;
    board(d, 0, 0, W, d.H, { top: '#1c140a', bottom: '#0e0a06' });
    neon(d, { paths: [IC.bottle(W / 2, 0.56 * m, 0.8 * m)] }, 0xfff2d0, { px: 0.36 * m, tw: 0.03 * m });
    neon(d, { glyphs: vstack(c, d.T('酒場', 'BAR'), W / 2, 1.08 * m, 2.86 * m, 0.72 * m, d.font.round) }, 0xffe03a);
    neon(d, { paths: [IC.wave(0.16 * m, W - 0.16 * m, 3.1 * m, 0.06 * m, 6)] }, 0xff3a3a, { px: 0.24 * m, tw: 0.024 * m });
  }),
  V('tenants_a', 1.1, 7.0, 0xff6ac0, (d) => {
    const { W, H, S: m, ctx: c } = d;
    c.fillStyle = '#2a2830'; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(0, 0, W, 2);
    const kinds = [['bar', '5F'], ['snack', '4F'], ['mahjong', '3F'], ['karaoke', '2F'], ['izakaya', '1F'], ['club', 'B1']];
    const g = 0.05 * m, ph = (H - 2 * g - (kinds.length - 1) * 0.06 * m) / kinds.length;
    kinds.forEach(([k, f], i) => tenant(d, k, g, g + i * (ph + 0.06 * m), W - 2 * g, ph, f));
  }),
  V('tenants_b', 1.0, 6.2, 0x6aa8ff, (d) => {
    const { W, H, S: m, ctx: c } = d;
    c.fillStyle = '#2c2c34'; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(0, 0, W, 2);
    const kinds = [['uranai', '6F'], ['kissa', '5F'], ['yakiniku', '4F'], ['drink', '3F'], ['24h', 'B1']];
    const g = 0.05 * m, ph = (H - 2 * g - (kinds.length - 1) * 0.06 * m) / kinds.length;
    kinds.forEach(([k, f], i) => tenant(d, k, g, g + i * (ph + 0.06 * m), W - 2 * g, ph, f));
  }),

  // ---------------------------------------------------------------- horizontal boards
  Hz('bar', 2.6, 1.1, 0xff4fb0, (d) => {
    const { W, H, S: m, ctx: c } = d;
    board(d, 0, 0, W, H, { r: 0.08 * m, top: '#1c0d1a', bottom: '#0d070c' });
    neon(d, { paths: [IC.glass(0.5 * m, H / 2, 0.78 * m)] }, 0x35e8ff, { px: 0.4 * m, tw: 0.03 * m });
    neon(d, { glyphs: hspread(c, 'BAR', 0.95 * m, 2.45 * m, H / 2, 0.74 * m, d.font.round) }, 0xff4fb0, { outline: true, tw: 0.045 * m });
  }),
  Hz('open24', 2.8, 0.9, 0xffa01e, (d) => {
    const { W, H, S: m } = d;
    const b = board(d, 0, 0, W, H, { frame: '#7d8088', top: '#0b0a0a', bottom: '#070606' });
    led(d, 'OPEN 24H', b.x + 0.06 * m, b.y + 0.05 * m, b.w - 0.12 * m, b.h - 0.1 * m, { pitch: 0.036 * m, colour: 0xffa01e });
  }),
  Hz('gamecenter', 5.6, 1.4, 0x33c8ff, (d) => {
    const { W, H, S: m, ctx: c } = d;
    const p = panel(d, 0, 0, W, H, '#1638b4', '#19b8ff', { across: true, tubes: 2 });
    const band = [0xff3a3a, 0xff9a1f, 0xffe03a, 0x46ff7a, 0x35e8ff, 0x3c6cff, 0xb45cff];
    const bw = p.w / band.length;
    band.forEach((h, i) => { c.fillStyle = css(h); c.fillRect(p.x + i * bw, p.y + p.h - 0.2 * m, bw + 1, 0.2 * m); });
    c.fillStyle = '#ffffff'; c.fillRect(p.x, p.y + p.h - 0.25 * m, p.w, 0.04 * m);
    for (const x of [0.42 * m, W - 0.42 * m]) { c.fillStyle = '#ffe03a'; c.beginPath(); IC.star(x, 0.6 * m, 0.24 * m, 0.45)(c); c.fill(); }
    boxText(d, hline(c, 'GAME CENTER', W / 2, 0.6 * m, 0.62 * m, d.font.gothic, W - 1.5 * m), '#ffffff', { stroke: '#0b1a66', strokeW: 0.07 * m });
  }),
  Hz('neon', 3.0, 1.0, 0x3cf0ff, (d) => {
    const { W, H, S: m, ctx: c } = d;
    const b = board(d, 0, 0, W, H, { r: 0.05 * m, top: '#0f0f1e', bottom: '#08080f' });
    neon(d, { paths: [(cc) => rrp(cc, b.x + 0.06 * m, b.y + 0.06 * m, b.w - 0.12 * m, b.h - 0.12 * m, 0.12 * m)] }, 0xff4fc8, { px: 0.3 * m, tw: 0.026 * m, glow: 0.8 });
    neon(d, { glyphs: hspread(c, 'NEON', 0.35 * m, W - 0.35 * m, H / 2, 0.62 * m, d.font.round) }, 0x3cf0ff);
  }),
  Hz('club', 3.2, 1.2, 0xa04dff, (d) => {
    const { W, H, S: m, ctx: c } = d;
    board(d, 0, 0, W, H, { top: '#170c24', bottom: '#0b0612' });
    neon(d, { glyphs: hspread(c, 'CLUB', 0.7 * m, W - 0.7 * m, H * 0.46, 0.74 * m, d.font.round) }, 0xa04dff);
    neon(d, { paths: [IC.star(0.38 * m, H * 0.46, 0.2 * m), IC.star(W - 0.38 * m, H * 0.46, 0.2 * m)] }, 0xff4fc8, { px: 0.3 * m, tw: 0.026 * m });
    neon(d, { paths: [(cc) => { cc.moveTo(0.75 * m, H - 0.18 * m); cc.lineTo(W - 0.75 * m, H - 0.18 * m); }] }, 0x35e8ff, { px: 0.24 * m, tw: 0.022 * m, glow: 0.7 });
  }),
  Hz('karaoke_h', 5.0, 1.3, 0xff5ac8, (d) => {
    const { W, H, S: m, ctx: c } = d;
    panel(d, 0, 0, W, H, '#ff6ec8', '#d61c86', { tubes: 2 });
    c.fillStyle = '#ffffff'; c.strokeStyle = '#ffffff'; c.lineWidth = 0.045 * m; c.lineJoin = c.lineCap = 'round';
    c.beginPath(); IC.mic(0.62 * m, H / 2, 0.9 * m)(c); c.stroke();
    boxText(d, hline(c, 'KARAOKE', W / 2 + 0.35 * m, 0.82 * m, 0.56 * m, d.font.gothic, W - 1.7 * m), '#ffffff', { stroke: '#7a0a4a', strokeW: 0.05 * m });
    boxText(d, hline(c, d.T('カラオケ', 'SING'), W / 2 + 0.35 * m, 0.32 * m, 0.28 * m, d.font.gothic), '#fff06a', { stroke: '#7a0a4a', strokeW: 0.035 * m });
  }),
  Hz('ramen_h', 4.2, 1.2, 0xff3a2a, (d) => {
    const { W, H, S: m, ctx: c } = d;
    panel(d, 0, 0, W, H, '#f43c24', '#bd160f', { tubes: 2 });
    c.fillStyle = '#ffd43a'; c.beginPath(); c.arc(0.62 * m, H / 2, 0.42 * m, 0, TAU); c.fill();
    c.strokeStyle = '#8a1208'; c.lineWidth = 0.03 * m; c.lineCap = c.lineJoin = 'round';
    c.beginPath(); IC.bowl(0.62 * m, H / 2 + 0.05 * m, 0.52 * m)(c); c.stroke();
    boxText(d, hline(c, d.T('ラーメン', 'RAMEN'), W / 2 + 0.4 * m, H / 2, 0.7 * m, d.font.gothic, W - 1.6 * m), '#fff7ea', { stroke: '#6e0804', strokeW: 0.05 * m });
  }),
  Hz('izakaya_h', 4.0, 1.1, 0xffe0b8, (d) => {
    const { W, H, S: m, ctx: c } = d;
    const p = panel(d, 0, 0, W, H, '#fff6e2', '#f0d9b6', { tubes: 2, tubeA: 0.14 });
    c.fillStyle = '#c8201a'; c.fillRect(p.x, p.y + p.h - 0.12 * m, p.w, 0.12 * m);
    lantern(d, 0.42 * m, H / 2 - 0.04 * m, 0.2 * m, 0.3 * m);
    lantern(d, W - 0.42 * m, H / 2 - 0.04 * m, 0.2 * m, 0.3 * m);
    boxText(d, hline(c, d.T('居酒屋', 'IZAKAYA'), W / 2, H / 2 - 0.04 * m, 0.72 * m, d.font.gothic, W - 1.3 * m), '#1c1512');
  }),
  Hz('hotel_h', 3.6, 1.5, 0xff47d1, (d) => {
    const { W, H, S: m, ctx: c } = d;
    const b = board(d, 0, 0, W, H, { top: '#1c0c20', bottom: '#0c060e' });
    neon(d, { paths: [IC.heart(0.5 * m, 0.46 * m, 0.56 * m)] }, 0xff3355, { px: 0.36 * m, tw: 0.032 * m });
    neon(d, { glyphs: hspread(c, 'HOTEL', 0.95 * m, W - 0.25 * m, 0.46 * m, 0.56 * m, d.font.round) }, 0xff47d1);
    led(d, 'REST ¥4,500', b.x + 0.1 * m, 0.83 * m, b.w - 0.2 * m, 0.3 * m, { pitch: 0.028 * m, colour: 0xffb13a });
    led(d, 'STAY ¥7,800', b.x + 0.1 * m, 1.13 * m, b.w - 0.2 * m, 0.3 * m, { pitch: 0.028 * m, colour: 0xffb13a });
  }),
  Hz('pachinko_h', 6.0, 1.6, 0xffc21a, (d) => {
    const { W, H, S: m, ctx: c } = d;
    const p = panel(d, 0, 0, W, H, '#c8121e', '#7c0812', { frame: '#d6a02a', fw: 0.05 * m, tubes: 2 });
    const pts = [];
    for (let x = p.x + 0.12 * m; x < p.x + p.w - 0.05 * m; x += 0.2 * m) { pts.push([x, p.y + 0.1 * m]); pts.push([x, p.y + p.h - 0.1 * m]); }
    bulbs(d, pts, 0.045 * m, [0xffe07a, 0xfff6d8], { dimEvery: 4 });
    for (const x of [0.62 * m, W - 0.62 * m]) neon(d, { paths: [IC.star(x, H / 2, 0.3 * m, 0.42)] }, 0xffd23a, { px: 0.4 * m, tw: 0.03 * m });
    const gl = hline(c, d.T('パチンコ', 'PACHINKO'), W / 2, 0.7 * m, 0.8 * m, d.font.gothic, W - 2.2 * m);
    const gg = c.createLinearGradient(0, 0.3 * m, 0, 1.1 * m); gg.addColorStop(0, '#fff6c0'); gg.addColorStop(0.5, '#ffd23a'); gg.addColorStop(1, '#ff9a1a');
    c.save(); c.shadowColor = 'rgba(255,200,60,0.9)'; c.shadowBlur = 0.12 * m; boxText(d, gl, gg, { stroke: '#4a0408', strokeW: 0.09 * m }); c.restore();
    boxText(d, hline(c, 'PACHINKO  SLOT', W / 2, 1.28 * m, 0.17 * m, d.font.gothic, W - 2.2 * m), '#fff4d8');
  }),
  Hz('sake', 2.6, 0.9, 0x46ff7a, (d) => {
    const { W, H, S: m, ctx: c } = d;
    board(d, 0, 0, W, H, { top: '#0c1a10', bottom: '#070d08' });
    neon(d, { paths: [(cc) => { cc.moveTo(0.52 * m + 0.33 * m, H / 2); cc.arc(0.52 * m, H / 2, 0.33 * m, 0, TAU); }] }, 0x46ff7a, { px: 0.36 * m, tw: 0.028 * m });
    neon(d, { glyphs: hline(c, d.T('酒', 'S'), 0.52 * m, H / 2, 0.44 * m, d.font.round) }, 0xfff2d0, { glow: 0.7 });
    neon(d, { glyphs: hspread(c, 'SAKE', 1.05 * m, W - 0.15 * m, H / 2, 0.5 * m, d.font.round) }, 0x46ff7a, { outline: true, tw: 0.04 * m });
  }),
  Hz('live', 3.2, 0.9, 0xffe23a, (d) => {
    const { W, H, S: m } = d;
    const b = board(d, 0, 0, W, H, { frame: '#7d8088', top: '#0b0a0a', bottom: '#070606' });
    led(d, 'LIVE & DRINK', b.x + 0.05 * m, b.y + 0.06 * m, b.w - 0.1 * m, b.h - 0.12 * m, { pitch: 0.034 * m, colour: 0xffe23a });
  }),
  Hz('cafe_h', 3.0, 1.0, 0xffe4b8, (d) => {
    const { W, H, S: m, ctx: c } = d;
    const p = panel(d, 0, 0, W, H, '#fff4de', '#efd8b0', { tubes: 2 });
    c.fillStyle = '#1f6a42'; c.fillRect(p.x, p.y + p.h - 0.1 * m, p.w, 0.1 * m);
    c.fillStyle = '#1f6a42'; c.beginPath(); c.arc(0.5 * m, H / 2 - 0.03 * m, 0.36 * m, 0, TAU); c.fill();
    c.strokeStyle = '#fff4de'; c.lineWidth = 0.035 * m; c.lineJoin = c.lineCap = 'round';
    c.beginPath(); IC.cup(0.5 * m, H / 2 - 0.01 * m, 0.5 * m)(c); c.stroke();
    boxText(d, hline(c, d.T('喫茶', 'CAFE'), W / 2 + 0.42 * m, 0.4 * m, 0.52 * m, d.font.gothic), '#4a2612');
    boxText(d, hline(c, 'CAFE', W / 2 + 0.42 * m, 0.8 * m, 0.2 * m, d.font.gothic), '#1f6a42');
  }),
  Hz('parking', 2.6, 1.2, 0x2f7bff, (d) => {
    const { W, H, S: m, ctx: c } = d;
    panel(d, 0, 0, W, H, '#2a6cf0', '#123fae', { tubes: 2 });
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0.62 * m, H / 2, 0.44 * m, 0, TAU); c.fill();
    boxText(d, hline(c, 'P', 0.62 * m, H / 2, 0.64 * m, d.font.gothic), '#1a4fd0');
    boxText(d, hline(c, '24H', 1.72 * m, 0.46 * m, 0.46 * m, d.font.gothic, 1.4 * m), '#ffffff');
    boxText(d, hline(c, '¥300/20min', 1.72 * m, 0.9 * m, 0.2 * m, d.font.gothic, 1.4 * m), '#ffffff');
  }),
  Hz('yakiniku_h', 3.5, 1.1, 0xff6a1a, (d) => {
    const { W, H, S: m, ctx: c } = d;
    board(d, 0, 0, W, H, { top: '#1a0c07', bottom: '#0e0604' });
    for (const x of [0.46 * m, W - 0.46 * m]) {
      neon(d, { paths: [IC.flame(x, H / 2, 0.66 * m)] }, 0xff3a14, { px: 0.4 * m, tw: 0.032 * m });
      neon(d, { paths: [IC.flame(x, H / 2 + 0.07 * m, 0.32 * m)] }, 0xffd23a, { px: 0.28 * m, tw: 0.024 * m, glow: 0.6 });
    }
    neon(d, { glyphs: hline(c, d.T('焼肉', 'BBQ'), W / 2, 0.44 * m, 0.62 * m, d.font.round, W - 1.8 * m) }, 0xff6a1a);
    neon(d, { glyphs: hline(c, 'YAKINIKU', W / 2, 0.9 * m, 0.17 * m, d.font.round, W - 1.8 * m) }, 0xffd23a, { glow: 0.7 });
  }),
  Hz('open', 2.5, 0.9, 0xff3355, (d) => {
    const { W, H, S: m, ctx: c } = d;
    const b = board(d, 0, 0, W, H, { r: H / 2, bolts: false, top: '#140a10', bottom: '#0a0508' });
    neon(d, { paths: [(cc) => rrp(cc, b.x + 0.06 * m, b.y + 0.06 * m, b.w - 0.12 * m, b.h - 0.12 * m, (b.h - 0.12 * m) / 2)] }, 0x3c7cff, { px: 0.3 * m, tw: 0.028 * m, glow: 0.8 });
    neon(d, { glyphs: hspread(c, 'OPEN', 0.45 * m, W - 0.45 * m, H / 2, 0.52 * m, d.font.round) }, 0xff3355, { outline: true, tw: 0.04 * m });
  }),
  Hz('sushi_h', 3.6, 1.1, 0x44c4ff, (d) => {
    const { W, H, S: m, ctx: c } = d;
    const p = panel(d, 0, 0, W, H, '#123a86', '#0a1f50', { tubes: 2 });
    c.strokeStyle = '#35d0ff'; c.lineWidth = 0.025 * m; c.strokeRect(p.x + 0.06 * m, p.y + 0.06 * m, p.w - 0.12 * m, p.h - 0.12 * m);
    c.strokeStyle = '#ffffff'; c.lineWidth = 0.035 * m; c.lineJoin = c.lineCap = 'round';
    c.beginPath(); IC.fish(0.62 * m, H / 2, 0.66 * m)(c); c.stroke();
    boxText(d, hline(c, d.T('寿司', 'SUSHI'), W / 2 + 0.3 * m, 0.46 * m, 0.62 * m, d.font.gothic), '#ffffff');
    boxText(d, hline(c, 'SUSHI', W / 2 + 0.3 * m, 0.88 * m, 0.17 * m, d.font.gothic), '#35d0ff');
  }),
];

// ---------------------------------------------------------------- packing

/** Skyline bottom-left packing of rectangles into a W x H sheet; null if they do not fit. */
const ORDERS = [
  (r) => (a, b) => r[b].h - r[a].h || r[b].w - r[a].w,
  (r) => (a, b) => r[b].w * r[b].h - r[a].w * r[a].h,
  (r) => (a, b) => Math.max(r[b].w, r[b].h) - Math.max(r[a].w, r[a].h),
  (r) => (a, b) => r[b].w - r[a].w || r[b].h - r[a].h,
];
function pack(rects, W, H, by = ORDERS[0]) {
  const order = rects.map((_, i) => i).sort(by(rects));
  let sky = [{ x: 0, y: 0, w: W }];
  const out = new Array(rects.length);
  for (const i of order) {
    const { w, h } = rects[i];
    let best = null;
    for (let s = 0; s < sky.length; s++) {
      const x = sky[s].x;
      if (x + w > W) break;
      let y = 0, span = 0;
      for (let k = s; k < sky.length && span < w; k++) { y = Math.max(y, sky[k].y); span += sky[k].w; }
      if (span < w || y + h > H) continue;
      if (!best || y + h < best.top || (y + h === best.top && x < best.x)) best = { x, y, top: y + h };
    }
    if (!best) return null;
    out[i] = { x: best.x, y: best.y };
    const x0 = best.x, x1 = best.x + w, next = [];
    for (const seg of sky) {
      const a = seg.x, b = seg.x + seg.w;
      if (b <= x0 || a >= x1) { next.push(seg); continue; }
      if (a < x0) next.push({ x: a, y: seg.y, w: x0 - a });
      if (b > x1) next.push({ x: x1, y: seg.y, w: b - x1 });
    }
    next.push({ x: x0, y: best.top, w });
    next.sort((p, q) => p.x - q.x);
    sky = [];
    for (const seg of next) {
      const last = sky[sky.length - 1];
      if (last && last.y === seg.y && last.x + last.w === seg.x) last.w += seg.w; else sky.push({ ...seg });
    }
  }
  return out;
}

/** Repeat a sign's edge pixels outward into its gutter, so mip levels blend it with itself. */
function bleed(ctx, x, y, w, h, g) {
  const cv = ctx.canvas;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cv, x, y, w, 1, x, y - g, w, g);
  ctx.drawImage(cv, x, y + h - 1, w, 1, x, y + h, w, g);
  ctx.drawImage(cv, x, y - g, 1, h + 2 * g, x - g, y - g, g, h + 2 * g);
  ctx.drawImage(cv, x + w - 1, y - g, 1, h + 2 * g, x + w, y - g, g, h + 2 * g);
  ctx.restore();
}

/** Whether the font really draws Japanese rather than the missing-glyph box (as world.js drawsGlyphs). */
function drawsJapanese(font) {
  const text = '酒場ラ', cv = document.createElement('canvas'); cv.width = 56 * text.length; cv.height = 56;
  const c = cv.getContext('2d', { willReadFrequently: true });
  const draw = (s) => { c.clearRect(0, 0, cv.width, cv.height); c.font = font; c.fillStyle = '#fff'; c.textBaseline = 'top'; c.fillText(s, 2, 4); return c.getImageData(0, 0, cv.width, cv.height).data; };
  const a = draw(text), b = draw(String.fromCharCode(0x378).repeat(text.length));
  let diff = 0;
  for (let i = 3; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 60) diff++;
  return diff > 40 * text.length;
}

// ---------------------------------------------------------------- the atlas

/**
 * Draw every sign into one 2048 x 2048 CanvasTexture. Call after the fonts have loaded (document.fonts.load for
 * both faces, then document.fonts.ready): a canvas draws with whatever face is there at the moment it draws.
 * Returns { texture, signs, texelsPerMetre, canvas }.
 */
export function neonAtlas(fontFamily = '"M PLUS Rounded 1c", "Dela Gothic One", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif') {
  const fam = { round: `"M PLUS Rounded 1c", ${fontFamily}`, gothic: `"Dela Gothic One", ${fontFamily}` };
  const font = { round: (px) => `800 ${px.toFixed(1)}px ${fam.round}`, gothic: (px) => `400 ${px.toFixed(1)}px ${fam.gothic}` };
  const jp = drawsJapanese(font.round(44));
  // LED dots want a plain gothic of regular weight: the page's own system faces, without the two display faces
  const sys = fontFamily.replace(/"(M PLUS Rounded 1c|Dela Gothic One)"\s*,?\s*/g, '').trim().replace(/^,\s*|,\s*$/g, '') || 'sans-serif';
  font.led = (px) => `500 ${px.toFixed(1)}px ${sys}`;
  if (jp && !drawsJapanese(font.led(44))) font.led = font.round;

  // the largest scale at which every sign, with its gutter, still fits the sheet
  let S = 0, place = null;
  for (let s = 148; s >= 80 && !place; s -= 2) {
    const rects = DESIGNS.map((k) => ({ w: Math.round(k.w * s) + 2 * GUT, h: Math.round(k.h * s) + 2 * GUT }));
    for (const by of ORDERS) { place = pack(rects, SIZE, SIZE, by); if (place) { S = s; break; } }
  }
  if (!place) throw new Error('neonAtlas: the signs do not fit the atlas');

  const cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SIZE, SIZE);
  let maxW = 0, maxH = 0;
  for (const k of DESIGNS) { maxW = Math.max(maxW, Math.round(k.w * S)); maxH = Math.max(maxH, Math.round(k.h * S)); }
  const mk = () => { const c = document.createElement('canvas'); c.width = maxW + 4; c.height = maxH + 4; return c; };
  const scratch = [mk(), mk()], raster = document.createElement('canvas');
  const signs = [];
  const seen = new Set();
  const T = (a, b) => { if (jp) for (const ch of a) if (ch.charCodeAt(0) > 0x2fff) seen.add(ch); return jp ? a : b; };

  DESIGNS.forEach((k, i) => {
    const W = Math.round(k.w * S), H = Math.round(k.h * S), x = place[i].x + GUT, y = place[i].y + GUT;
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    k.draw({ ctx, W, H, S, font, jp, T, scratch, raster, rng: mulberry32(0x5e1 + i * 7919) });
    ctx.restore();
    bleed(ctx, x, y, W, H, GUT);
    signs.push({ name: k.name, u0: x / SIZE, v0: 1 - (y + H) / SIZE, u1: (x + W) / SIZE, v1: 1 - y / SIZE, w: k.w, h: k.h, colour: k.colour, vertical: k.vertical });
  });
  const missing = [...seen].filter((ch) => !NEON_CHARS.includes(ch));
  if (missing.length) console.warn('[neon] drawn but not in NEON_CHARS:', missing.join(''));

  const texture = new THREE.CanvasTexture(cv);
  texture.name = 'neon atlas';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  return { texture, signs, texelsPerMetre: S, canvas: cv };
}
