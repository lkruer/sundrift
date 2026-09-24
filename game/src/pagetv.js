/**
 * The page's menus, on the TV.
 *
 * The title screen and the pause menu are laid out by the page (index.html), and the page keeps them: its buttons take
 * the clicks, the taps and the keys, and a screen reader reads them. But the page draws none of it. This paints what
 * the page lays out into the HUD's canvas, every box and every run of text where the tube shows its place on the
 * screen (each point goes through the glass's curve on its way in, hud.js _toTex), at the screen's own resolution, and
 * the tube lays it into the picture with the scanlines, the phosphor's glow and the colour steps. So the menu is on the
 * set, in the set's light, and where a thumb lands is where it is drawn.
 *
 * It reads what it draws from the page as the page shows it (computed colours, borders, gradients, shadows, fonts,
 * transforms, hover and focus), so a change to the page's CSS shows on the TV as it is. A few things the canvas cannot
 * take from CSS it draws its own way: the logo's and the vertical title's gradient type, the paints' round swatches, the
 * red seal, and the shade behind the menu. It draws again only when something changed: a choice, a hover, a focus, a
 * resize, a font arriving.
 */
const TAU = Math.PI * 2;
const num = (v) => parseFloat(v) || 0;

/** The alpha of a computed colour (rgb(), rgba(), or the rgb(r g b / a) form). */
function alphaOf(col) {
  if (!col || col === 'transparent') return 0;
  const m = /rgba?\(([^)]*)\)/.exec(col);
  if (!m) return 1;
  const p = m[1].split(/[\s,/]+/).filter(Boolean);
  return p.length > 3 ? parseFloat(p[3]) : 1;
}

/** Split at the commas that are not inside parentheses. */
function splitTop(s) {
  const out = []; let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++; else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) { out.push(s.slice(start, i).trim()); start = i + 1; }
  }
  out.push(s.slice(start).trim());
  return out;
}

/** The first linear gradient in a computed background-image: its angle (degrees, CSS's) and its stops [color, 0..1]. */
function parseGradient(img) {
  const i = img ? img.indexOf('linear-gradient(') : -1;
  if (i < 0) return null;
  let depth = 0, j = i + 'linear-gradient'.length;
  for (; j < img.length; j++) { if (img[j] === '(') depth++; else if (img[j] === ')') { depth--; if (depth === 0) break; } }
  const parts = splitTop(img.slice(i + 'linear-gradient('.length, j));
  let angle = 180;
  if (/deg$/.test(parts[0])) angle = parseFloat(parts.shift());
  else if (/^to /.test(parts[0])) { const t = parts.shift(); angle = t.includes('right') ? 90 : t.includes('left') ? 270 : t.includes('top') ? 0 : 180; }
  const stops = parts.map((p) => { const m = /(rgba?\([^)]*\))\s*([\d.]+%)?/.exec(p); return m ? [m[1], m[2] ? parseFloat(m[2]) / 100 : null] : null; }).filter(Boolean);
  stops.forEach((s, k) => { if (s[1] === null) s[1] = stops.length > 1 ? k / (stops.length - 1) : 0; });
  return stops.length ? { angle, stops } : null;
}

/** A computed box-shadow as a list of { color, x, y, blur, spread, inset } (the first is drawn on top). */
function parseShadows(v) {
  if (!v || v === 'none') return [];
  return splitTop(v).map((p) => {
    const col = (/rgba?\([^)]*\)/.exec(p) || ['rgba(0,0,0,0)'])[0];
    const n = p.replace(col, '').trim().split(/\s+/).filter((t) => /px$/.test(t)).map(parseFloat);
    return { color: col, x: n[0] || 0, y: n[1] || 0, blur: n[2] || 0, spread: n[3] || 0, inset: /inset/.test(p) };
  });
}

/** A computed filter's drop-shadows. */
function parseDrops(v) {
  const out = [], re = /drop-shadow\((rgba?\([^)]*\))\s+([-\d.]+)px\s+([-\d.]+)px\s+([-\d.]+)px\)/g;
  let m;
  while ((m = re.exec(v || ''))) out.push({ color: m[1], x: +m[2], y: +m[3], blur: +m[4] });
  return out;
}

export class PageTV {
  constructor(hud) {
    this.hud = hud; hud.page = this;
    this.title = document.getElementById('title');
    this.pause = document.getElementById('pause');
    this.mc = document.createElement('canvas').getContext('2d');
    this.dirty = true; this.shot = null; this.mode = '';
    const mark = () => { this.dirty = true; };
    const watch = { subtree: true, attributes: true, childList: true, characterData: true, attributeFilter: ['class', 'style'] };
    for (const root of [this.title, this.pause]) {
      if (!root) continue;
      new MutationObserver(mark).observe(root, watch);
      for (const ev of ['pointerover', 'pointerout', 'pointerdown', 'pointerup', 'focusin', 'focusout']) root.addEventListener(ev, mark, { passive: true });
    }
    const menu = this.title && this.title.querySelector('.menu');
    if (menu) menu.addEventListener('scroll', mark, { passive: true });
    addEventListener('resize', mark);
    // (what the page hides for the TV, index.html: body.tv; their own opacity is the TV's switch, not a look to copy)
    this.hidden = new Set(document.querySelectorAll('#title .menu, #title .tatebox, #title .credit, #title #building, #title .shade, #pause'));
    document.body.classList.add('tv');
  }

  /** Which page is up: the title, the pause menu, or neither. */
  _which() {
    if (this.pause && this.pause.classList.contains('on')) return 'pause';
    if (this.title && this.title.classList.contains('on')) return 'title';
    return '';
  }

  /** Once a frame: draws the page that is up when something on it changed; true when the canvas was drawn. */
  frame() {
    const which = this._which();
    if (which !== this.mode) {
      // (the pause menu is drawn over the HUD as the run left it: a copy of it kept for every redraw of the menu)
      if (which === 'pause') {
        const cv = this.hud.canvas;
        this.shot = this.shot || document.createElement('canvas');
        this.shot.width = cv.width; this.shot.height = cv.height;
        this.shot.getContext('2d').drawImage(cv, 0, 0);
      }
      this.mode = which; this.dirty = true;
      this.hud.showPage(!!which);
      if (!which) { this.hud.dirty = true; return false; }
    }
    if (!which || !this.dirty) return false;
    this.dirty = false;
    this.paint(which);
    return true;
  }

  // ---------------------------------------------------------------- drawing

  /** A screen point (CSS px) to the OSD (units), through the tube. */
  _p(x, y) { return this.hud._toTex(x, y); }

  /** The element's box as the page shows it: its four corners on the screen (its transform about its centre applied). */
  _quad(el, cs, grow = 0) {
    const r = el.getBoundingClientRect(), w = el.offsetWidth + 2 * grow, h = el.offsetHeight + 2 * grow;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let a = 1, b = 0, c = 0, d = 1;
    const m = /matrix\(([^)]+)\)/.exec(cs.transform || '');
    if (m) [a, b, c, d] = m[1].split(',').map(Number);
    const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => [cx + a * x + c * y, cy + b * x + d * y]);
    return { pts, cx, cy, w, h, skewed: Math.abs(b) > 1e-3 || Math.abs(c) > 1e-3 };
  }

  /** A quad's outline through the tube (each edge in thirds, so a long edge bends with the glass). */
  _quadPath(c, pts) {
    c.beginPath();
    for (let i = 0; i < 4; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % 4];
      for (let k = 0; k < 3; k++) {
        const t = k / 3, [u, v] = this._p(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
        if (i === 0 && k === 0) c.moveTo(u, v); else c.lineTo(u, v);
      }
    }
    c.closePath();
  }

  /** A rounded rectangle (an unskewed box) through the tube: its corners mapped, its radius in units. */
  _roundPath(c, q, rad) {
    const [x0, y0] = this._p(q.pts[0][0], q.pts[0][1]), [x1, y1] = this._p(q.pts[2][0], q.pts[2][1]);
    c.beginPath();
    if (c.roundRect) c.roundRect(x0, y0, x1 - x0, y1 - y0, Math.max(0, Math.min(rad, (x1 - x0) / 2, (y1 - y0) / 2)));
    else c.rect(x0, y0, x1 - x0, y1 - y0);
  }

  /** The box's outline added to the path being built (no beginPath). */
  _subpath(c, q, cs) {
    const rad = cs.borderTopLeftRadius || '0px', r = rad.endsWith('%') ? Math.min(q.w, q.h) * num(rad) / 100 : num(rad);
    if (!q.skewed && r > 0.5 && c.roundRect) {
      const [x0, y0] = this._p(q.pts[0][0], q.pts[0][1]), [x1, y1] = this._p(q.pts[2][0], q.pts[2][1]);
      c.roundRect(x0, y0, x1 - x0, y1 - y0, Math.max(0, Math.min(r / this.hud.kx, (x1 - x0) / 2, (y1 - y0) / 2)));
      return;
    }
    q.pts.forEach(([x, y], i) => { const [u, v] = this._p(x, y); if (i) c.lineTo(u, v); else c.moveTo(u, v); });
    c.closePath();
  }

  _path(c, q, cs) {
    const rad = cs.borderTopLeftRadius || '0px';
    const r = rad.endsWith('%') ? Math.min(q.w, q.h) * num(rad) / 100 : num(rad);
    if (!q.skewed && r > 0.5) this._roundPath(c, q, r / this.hud.kx);
    else this._quadPath(c, q.pts);
  }

  /** A box as CSS draws it: its outer shadows (the last underneath), its background colour or gradient, its border. */
  _box(c, el, cs, alpha) {
    const q = this._quad(el, cs), k = this.hud.s / this.hud.kx;          // canvas px per CSS px
    c.save();
    c.globalAlpha = alpha;
    // the shadows: a spread ring is the box grown and filled; a blurred one a shadow cast by a shape drawn out of sight
    for (const sh of parseShadows(cs.boxShadow).reverse()) {
      if (sh.inset || alphaOf(sh.color) <= 0) continue;
      const g = this._quad(el, cs, sh.spread);
      g.pts = g.pts.map(([x, y]) => [x + sh.x, y + sh.y]);
      if (sh.blur <= 0) { c.fillStyle = sh.color; this._path(c, g, cs); c.fill(); continue; }
      c.save();
      c.beginPath(); c.rect(-1e3, -1e3, this.hud.W + 2e3, this.hud.H + 2e3); this._subpath(c, q, cs); c.clip('evenodd');
      c.shadowColor = sh.color; c.shadowBlur = sh.blur * k;
      c.fillStyle = '#000'; this._path(c, g, cs); c.fill();
      c.restore();
    }
    this._path(c, q, cs);
    if (alphaOf(cs.backgroundColor) > 0) { c.fillStyle = cs.backgroundColor; c.fill(); }
    const gr = parseGradient(cs.backgroundImage);
    if (gr && !/text/.test(cs.backgroundClip || cs.webkitBackgroundClip || '')) {
      // (a gradient runs across the box as the page's does: top to bottom unless it says otherwise)
      const rad = (gr.angle - 90) * Math.PI / 180, hx = Math.cos(rad) * q.w / 2, hy = Math.sin(rad) * q.h / 2;
      const [x0, y0] = this._p(q.cx - hx, q.cy - hy), [x1, y1] = this._p(q.cx + hx, q.cy + hy);
      const lg = c.createLinearGradient(x0, y0, x1, y1);
      for (const [col, at] of gr.stops) lg.addColorStop(Math.min(1, Math.max(0, at)), col);
      c.fillStyle = lg; c.fill();
    }
    const bw = num(cs.borderTopWidth);
    if (bw > 0 && alphaOf(cs.borderTopColor) > 0) {
      const inner = this._quad(el, cs, -bw / 2);
      c.lineWidth = bw / this.hud.kx; c.strokeStyle = cs.borderTopColor;
      this._path(c, inner, cs); c.stroke();
      // (a keycap's heavier bottom edge)
      const bb = num(cs.borderBottomWidth);
      if (bb > bw + 0.5) {
        const [ax, ay] = this._p(q.pts[3][0] + 2, q.pts[3][1] - bb / 2), [bx, by] = this._p(q.pts[2][0] - 2, q.pts[2][1] - bb / 2);
        c.lineWidth = bb / this.hud.kx; c.strokeStyle = cs.borderBottomColor; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
      }
    }
    c.restore();
    return q;
  }

  /** A keyboard's focus: the ring the page would have drawn round it. */
  _focus(c, el, cs) {
    if (!el.matches || !el.matches(':focus-visible')) return;
    const q = this._quad(el, cs, 4);
    c.save(); c.lineWidth = 2 / this.hud.kx; c.strokeStyle = 'rgba(246,239,226,0.9)'; this._path(c, q, cs); c.stroke(); c.restore();
  }

  /** How opaque an element is, all the way up to (not counting) the element the page hides for the TV. */
  _alpha(el, stop) {
    let a = 1;
    for (let e = el; e && e !== stop && e.nodeType === 1; e = e.parentElement) {
      if (this.hidden.has(e)) continue;
      a *= num(getComputedStyle(e).opacity);
      if (a <= 0) return 0;
    }
    return a;
  }

  /** The canvas font for a computed style, sized in units. */
  _font(cs, sz) { return `${cs.fontStyle === 'normal' ? '' : cs.fontStyle + ' '}${cs.fontWeight} ${sz}px ${cs.fontFamily}`; }

  /** Every line of a text node as the page wraps it: [text, left, top, height] on the screen. */
  _lines(node, cs) {
    const text = node.textContent, range = document.createRange();
    range.selectNodeContents(node);
    const rects = range.getClientRects();
    if (!rects.length) return [];
    if (rects.length === 1) {
      const r = rects[0];
      if (!(r.width > 0)) return [];
      // (a space at either end is laid out or collapsed away: whichever reading matches the width the page gave it)
      const t = text.replace(/\s+/g, ' '), m = this.mc, ls = cs.letterSpacing === 'normal' ? 0 : num(cs.letterSpacing);
      m.font = this._font(cs, num(cs.fontSize));
      const wOf = (x) => m.measureText(x).width + ls * x.length;
      let best = t, err = Infinity;
      for (const cand of [t, t.trimStart(), t.trimEnd(), t.trim()]) { const e = Math.abs(wOf(cand) - r.width); if (cand && e < err - 0.01) { err = e; best = cand; } }
      return [[best, r.left, r.top, r.height, r.width]];
    }
    // (wrapped: the characters grouped by the line each sits on)
    const out = []; let cur = null;
    for (let i = 0; i < text.length; i++) {
      range.setStart(node, i); range.setEnd(node, i + 1);
      const r = range.getBoundingClientRect();
      if (!r.width) continue;
      if (!cur || Math.abs(r.top - cur[2]) > r.height * 0.5) { cur = ['', r.left, r.top, r.height, 0]; out.push(cur); }
      cur[0] += text[i]; cur[4] = r.right - cur[1];
    }
    for (const l of out) l[0] = l[0].replace(/\s+/g, ' ');
    return out.filter((l) => l[0].trim());
  }

  /** A run of text drawn as the page draws it, from the left end of its baseline, letter-spaced as the page spaces it. */
  _text(c, str, cs, left, top, alpha, fill) {
    const hk = this.hud.kx, sz = num(cs.fontSize);
    const m = this.mc; m.font = this._font(cs, sz);
    const asc = m.measureText('Hg').fontBoundingBoxAscent || sz * 0.8;
    const ls = cs.letterSpacing === 'normal' ? 0 : num(cs.letterSpacing);
    const tt = cs.textTransform === 'uppercase' ? str.toUpperCase() : str;
    // every word where the tube shows its own place: a run drawn straight from its first point would cut across the
    // glass's curve (by several pixels along a line near a tall screen's corners)
    // (and fitted between where the tube shows its two ends, so the glass's squeeze toward its edges and its bend are
    // the word's too: a word drawn at its own width came out short of the next one near an edge)
    const words = [], space = m.measureText(' ').width + ls;
    let x = left;
    for (const w of tt.split(' ')) {
      if (w) {
        const ww = m.measureText(w).width + ls * w.length, [u0, v0] = this._p(x, top + asc), [u1, v1] = this._p(x + ww, top + asc);
        words.push([w, u0, v0, Math.hypot(u1 - u0, v1 - v0) / (ww / hk), Math.atan2(v1 - v0, u1 - u0)]);
        x += ww;
      }
      x += space;
    }
    c.save();
    c.globalAlpha = alpha;
    c.font = this._font(cs, sz / hk); c.textBaseline = 'alphabetic';
    const k = this.hud.s / hk;
    const put = (dx, dy) => {
      for (const [w, u, v, sx, rot] of words) {
        c.save(); c.translate(u + dx, v + dy); if (Math.abs(rot) > 1e-3) c.rotate(rot); c.scale(sx, 1);
        this._fill(c, w, 0, 0, ls / hk); c.restore();
      }
    };
    for (const sh of parseShadows(cs.textShadow).reverse()) {
      if (alphaOf(sh.color) <= 0) continue;
      c.save();
      if (sh.blur > 0) {
        // (a soft shadow is cast in place, by the words drawn in its colour: the words themselves cover them after)
        c.shadowColor = sh.color; c.shadowBlur = sh.blur * k; c.shadowOffsetX = sh.x * k; c.shadowOffsetY = sh.y * k;
        c.fillStyle = sh.color; put(0, 0);
      } else { c.fillStyle = sh.color; put(sh.x / hk, sh.y / hk); }
      c.restore();
    }
    c.fillStyle = fill || cs.color;
    put(0, 0);
    c.restore();
  }

  _fill(c, s, x, y, ls) {
    if (!ls) { c.fillText(s, x, y); return; }
    for (const ch of s) { c.fillText(ch, x, y); x += c.measureText(ch).width + ls; }
  }

  /** The page up now, drawn. */
  paint(which) {
    const h = this.hud, c = h.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.clearRect(0, 0, h.canvas.width, h.canvas.height);
    if (which === 'pause' && this.shot) c.drawImage(this.shot, 0, 0);
    c.setTransform(h.s, 0, 0, h.s, 0, 0);
    c.imageSmoothingEnabled = true;
    if (which === 'title') this._paintTitle(c); else this._paintPause(c);
  }

  /** Every box and every text node under root, in page order (the special ones left to their own drawing). */
  _walk(c, root, skip, stop) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        if (n.nodeType !== 1) return NodeFilter.FILTER_ACCEPT;
        if (skip(n)) return NodeFilter.FILTER_REJECT;
        const cs = getComputedStyle(n);
        return cs.display === 'none' || cs.visibility === 'hidden' ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    const focus = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === 1) {
        const cs = getComputedStyle(n);
        const hasBox = alphaOf(cs.backgroundColor) > 0 || /gradient/.test(cs.backgroundImage) || (num(cs.borderTopWidth) > 0 && alphaOf(cs.borderTopColor) > 0) || cs.boxShadow !== 'none';
        if (hasBox) { const a = this._alpha(n, stop); if (a > 0) this._box(c, n, cs, a); }
        if (n.tabIndex >= 0 || n.tagName === 'BUTTON') focus.push([n, cs]);
      } else if (n.nodeType === 3 && /\S/.test(n.textContent)) {
        const el = n.parentElement, cs = getComputedStyle(el), a = this._alpha(el, stop);
        if (a <= 0 || /text/.test(cs.backgroundClip || cs.webkitBackgroundClip || '')) continue;
        for (const [s, left, top] of this._lines(n, cs)) this._text(c, s, cs, left, top, a);
      }
    }
    for (const [n, cs] of focus) this._focus(c, n, cs);
  }

  // ---------------------------------------------------------------- the title

  _paintTitle(c) {
    const T = this.title, h = this.hud;
    // the shade behind the menu, as the page draws it (under the glass now, with everything else)
    const portrait = matchMedia('(max-width: 720px) and (orientation: portrait)').matches;
    const W = h.W, H = h.H;
    if (portrait) {
      const g = c.createLinearGradient(0, H, 0, 0);
      g.addColorStop(0, 'rgba(10,6,18,0.92)'); g.addColorStop(0.4, 'rgba(10,6,18,0.78)'); g.addColorStop(0.64, 'rgba(10,6,18,0.1)'); g.addColorStop(1, 'rgba(10,6,18,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    } else {
      const g = c.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, 'rgba(10,6,18,0.86)'); g.addColorStop(0.38, 'rgba(10,6,18,0.55)'); g.addColorStop(0.62, 'rgba(10,6,18,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      const g2 = c.createLinearGradient(0, H, 0, 0);
      g2.addColorStop(0, 'rgba(10,6,18,0.55)'); g2.addColorStop(0.3, 'rgba(10,6,18,0)');
      c.fillStyle = g2; c.fillRect(0, 0, W, H);
    }
    const menu = T.querySelector('.menu');
    if (menu) {
      c.save();
      // (a menu that scrolls, on a short screen, shows only what is inside its own box)
      if (menu.scrollHeight > menu.clientHeight + 1) {
        const r = menu.getBoundingClientRect(), [x0, y0] = this._p(r.left - 20, r.top), [x1, y1] = this._p(r.right + 20, r.bottom);
        c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip();
      }
      const logo = menu.querySelector('.logo');
      if (logo) this._logo(c, logo);
      for (const sw of menu.querySelectorAll('.sw')) this._swatch(c, sw);
      this._walk(c, menu, (n) => n.classList && (n.classList.contains('logo') || n.classList.contains('sw')), menu);
      for (const sw of menu.querySelectorAll('.sw')) this._focus(c, sw, getComputedStyle(sw));
      c.restore();
    }
    const tate = T.querySelector('.tate'), seal = T.querySelector('.seal');
    if (tate) this._tate(c, tate);
    if (seal) this._seal(c, seal);
    for (const sel of ['.credit', '#building']) {
      const el = T.querySelector(sel);
      if (!el) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none') continue;
      const a = sel === '#building' ? (el.classList.contains('on') ? 1 : 0) : this._alpha(el, T);
      if (a <= 0) continue;
      for (const n of el.childNodes) if (n.nodeType === 3) for (const [s, left, top] of this._lines(n, cs)) this._text(c, s, cs, left, top, a);
    }
  }

  /** The logo: chrome over a sunset in italic racing type, its dark drop and pink glow, leaning as the page leans it. */
  _logo(c, el) {
    const cs = getComputedStyle(el), q = this._quad(el, cs), hk = this.hud.kx, sz = num(cs.fontSize);
    const gr = parseGradient(cs.backgroundImage), drops = parseDrops(cs.filter);
    const [cu, cv] = this._p(q.cx, q.cy);
    const m = this.mc; m.font = this._font(cs, sz);
    const fm = m.measureText('SUNDRIFT'), asc = fm.fontBoundingBoxAscent || sz * 0.8, dsc = fm.fontBoundingBoxDescent || sz * 0.25;
    const lh = num(cs.lineHeight) || sz, top = -q.h / 2 + num(cs.paddingTop) + (lh - asc - dsc) / 2, base = top + asc;
    const left = -q.w / 2 + num(cs.paddingLeft), ls = cs.letterSpacing === 'normal' ? 0 : num(cs.letterSpacing);
    const text = el.textContent.trim(), k = this.hud.s;
    c.save();
    c.translate(cu, cv);
    const mm = /matrix\(([^)]+)\)/.exec(cs.transform || '');
    if (mm) { const [a, b, cc, d] = mm[1].split(',').map(Number); c.transform(a, b, cc, d, 0, 0); }
    c.scale(1 / hk, 1 / hk);                                      // (from here on, CSS px about the logo's centre)
    c.font = this._font(cs, sz); c.textBaseline = 'alphabetic';
    let fill = cs.color;
    if (gr) {
      const lg = c.createLinearGradient(0, -q.h / 2, 0, q.h / 2);
      for (const [col, at] of gr.stops) lg.addColorStop(Math.min(1, Math.max(0, at)), col);
      fill = lg;
    }
    for (const d of drops) {
      if (d.blur <= 0) { c.fillStyle = d.color; this._fill(c, text, left + d.x, base + d.y, ls); continue; }
      // (a glow cast in place, round the letters drawn in their own colours, which the last pass covers)
      c.save(); c.shadowColor = d.color; c.shadowBlur = d.blur * k / hk; c.fillStyle = fill; this._fill(c, text, left, base, ls); c.restore();
    }
    c.fillStyle = fill;
    this._fill(c, text, left, base, ls);
    c.restore();
  }

  /** The vertical Japanese title: its characters stacked down the column, in the gradient the page gives it. */
  _tate(c, el) {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect(), hk = this.hud.kx, sz = num(cs.fontSize), k = this.hud.s;
    const chars = [...el.textContent.trim()], gr = parseGradient(cs.backgroundImage), drops = parseDrops(cs.filter);
    if (!chars.length) return;
    const cell = r.height / chars.length, cx = r.left + r.width / 2;
    const [, y0] = this._p(cx, r.top), [, y1] = this._p(cx, r.bottom);
    let fill = cs.color;
    if (gr) { const lg = c.createLinearGradient(0, y0, 0, y1); for (const [col, at] of gr.stops) lg.addColorStop(Math.min(1, Math.max(0, at)), col); fill = lg; }
    c.save();
    c.font = this._font(cs, sz / hk); c.textAlign = 'center'; c.textBaseline = 'middle';
    chars.forEach((ch, i) => {
      const [u, v] = this._p(cx, r.top + (i + 0.5) * cell);
      for (const d of drops) {
        if (d.blur <= 0) { c.fillStyle = d.color; c.fillText(ch, u + d.x / hk, v + d.y / hk); continue; }
        c.save(); c.shadowColor = d.color; c.shadowBlur = d.blur * k / hk; c.fillStyle = fill; c.fillText(ch, u, v); c.restore();
      }
      c.fillStyle = fill; c.fillText(ch, u, v);
    });
    c.restore();
  }

  /** The red seal under it: a rounded square turned a little, a pale ring inside its edge, the character on it. */
  _seal(c, el) {
    const cs = getComputedStyle(el), q = this._quad(el, cs), hk = this.hud.kx, k = this.hud.s;
    const [u, v] = this._p(q.cx, q.cy);
    const mm = /matrix\(([^)]+)\)/.exec(cs.transform || ''), rot = mm ? Math.atan2(+mm[1].split(',')[1], +mm[1].split(',')[0]) : 0;
    const w = q.w / hk, hh = q.h / hk, rad = num(cs.borderTopLeftRadius) / hk;
    const glow = parseShadows(cs.boxShadow).find((s) => !s.inset && s.blur > 0);
    if (glow) { c.save(); c.shadowColor = glow.color; c.shadowBlur = glow.blur * k / hk; c.fillStyle = cs.backgroundColor; c.beginPath(); c.arc(u, v, Math.min(w, hh) / 2 - 1, 0, TAU); c.fill(); c.restore(); }
    c.save();
    c.translate(u, v); c.rotate(rot);
    c.beginPath(); if (c.roundRect) c.roundRect(-w / 2, -hh / 2, w, hh, rad); else c.rect(-w / 2, -hh / 2, w, hh);
    c.fillStyle = cs.backgroundColor; c.fill();
    const ring = parseShadows(cs.boxShadow).find((s) => s.inset);
    if (ring) { const sp = ring.spread / hk; c.beginPath(); if (c.roundRect) c.roundRect(-w / 2 + sp / 2, -hh / 2 + sp / 2, w - sp, hh - sp, Math.max(0, rad - sp / 2)); else c.rect(-w / 2 + sp / 2, -hh / 2 + sp / 2, w - sp, hh - sp); c.lineWidth = sp; c.strokeStyle = ring.color; c.stroke(); }
    c.font = this._font(cs, num(cs.fontSize) / hk); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = cs.color;
    c.fillText(el.textContent.trim(), 0, hh * 0.04);
    c.restore();
  }

  /** A paint's swatch: a glossy ball of the colour, lit from above, ringed in amber when it is the one chosen. */
  _swatch(c, el) {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect(), hk = this.hud.kx;
    const [u, v] = this._p(r.left + r.width / 2, r.top + r.height / 2), rad = r.width / 2 / hk, a = this._alpha(el, this.title);
    if (a <= 0) return;
    c.save();
    c.globalAlpha = a;
    if (el.classList.contains('sel')) { c.beginPath(); c.arc(u, v, rad + 3 / hk, 0, TAU); c.fillStyle = 'rgba(255,179,71,0.3)'; c.fill(); }
    c.beginPath(); c.arc(u, v, rad, 0, TAU); c.fillStyle = cs.backgroundColor; c.fill();
    const g = c.createRadialGradient(u - rad * 0.3, v - rad * 0.45, rad * 0.05, u, v, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.42)'); g.addColorStop(0.45, 'rgba(255,255,255,0.05)'); g.addColorStop(0.8, 'rgba(0,0,0,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.38)');
    c.fillStyle = g; c.fill();
    c.lineWidth = num(cs.borderTopWidth) / hk; c.strokeStyle = cs.borderTopColor;
    c.beginPath(); c.arc(u, v, rad - c.lineWidth / 2, 0, TAU); c.stroke();
    c.restore();
  }

  // ---------------------------------------------------------------- the pause menu

  _paintPause(c) {
    const P = this.pause, h = this.hud;
    // the page's dimming over the run (its lines are the tube's own now)
    c.fillStyle = 'rgba(10,6,18,0.66)'; c.fillRect(0, 0, h.W, h.H);
    this._walk(c, P, () => false, P);
  }
}
