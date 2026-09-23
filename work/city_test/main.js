// NEO TOKYO module test page. ?view=atlas | street | ...
import * as THREE from 'three';
import { neonAtlas, NEON_CHARS, NEON_LATIN } from '../../game/src/neon.js';

const Q = new URLSearchParams(location.search);
const VIEW = Q.get('view') || 'atlas';
window.__STATS__ = {};

async function loadFonts() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@800&family=Dela+Gothic+One&text=' + encodeURIComponent(NEON_CHARS + NEON_LATIN) + '&display=block';
  const loaded = new Promise((r) => { link.onload = r; link.onerror = r; });
  document.head.appendChild(link);
  await loaded;
  await Promise.all([
    document.fonts.load('800 64px "M PLUS Rounded 1c"', NEON_CHARS + NEON_LATIN),
    document.fonts.load('64px "Dela Gothic One"', NEON_CHARS + NEON_LATIN),
  ]).catch((e) => console.log('font load failed', e.message));
  await document.fonts.ready;
  window.__STATS__.fonts = [document.fonts.check('800 64px "M PLUS Rounded 1c"', 'ラ'), document.fonts.check('64px "Dela Gothic One"', '酒')];
}

const FONT = '"M PLUS Rounded 1c", "Dela Gothic One", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif';

async function atlasView() {
  const t0 = performance.now();
  const { texture, signs, texelsPerMetre, canvas } = neonAtlas(FONT);
  window.__STATS__.atlasMs = Math.round(performance.now() - t0);
  window.__STATS__.signs = signs.length;
  window.__STATS__.texelsPerMetre = texelsPerMetre;
  document.getElementById('c').style.display = 'none';
  canvas.id = 'atlas'; canvas.style.display = 'block';
  document.body.appendChild(canvas);
  // outline each sign's rectangle, to check the UVs
  if (Q.has('rects')) {
    const o = document.createElement('canvas'); o.width = o.height = 2048; o.style.cssText = 'position:absolute;left:0;top:0';
    const c = o.getContext('2d'); c.strokeStyle = '#0f0'; c.lineWidth = 1; c.font = '14px monospace'; c.fillStyle = '#0f0';
    for (const s of signs) { const x = s.u0 * 2048, y = (1 - s.v1) * 2048, w = (s.u1 - s.u0) * 2048, h = (s.v1 - s.v0) * 2048; c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); c.fillText(s.name, x + 3, y + 14); }
    document.body.appendChild(o);
  }
  texture.dispose();
}

async function main() {
  await loadFonts();
  if (VIEW === 'atlas') await atlasView();
  else { const mod = await import('./scene.js'); await mod.run(VIEW, Q, FONT); }
  window.__READY__ = true;
}
main().catch((e) => { console.error(e.stack || e.message); window.__READY__ = true; });
