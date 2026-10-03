// Render the ambience offline (each creature at a set time) to a WAV, to look at its spectrogram and levels.
//   node work/amb_render.mjs [out.wav]
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { createRequire } from 'module';

const require = createRequire(path.join('C:/Users/liamk/404-game-recipe', 'package.json'));
const puppeteer = require('puppeteer');
const target = path.resolve('game');
const out = process.argv[2] || 'work/amb.wav';
const server = createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel.endsWith('/')) rel = '/blank.html';
  if (rel === '/blank.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<!doctype html><title>amb</title>'); }
  const file = path.join(target, rel);
  if (!file.startsWith(target) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => console.log('page:', m.text()));
await page.goto(`http://127.0.0.1:${server.address().port}/`);
const data = await page.evaluate(async () => {
  const { Ambience } = await import('/src/ambience.js');
  const SR = 44100, LEN = 22;
  const ctx = new OfflineAudioContext(2, SR * LEN, SR);
  const a = new Ambience(ctx, ctx.destination);
  a.out.gain.value = 1;
  // 0-4 s higurashi (two), 5-9 crickets, 9-12 frogs, 12-16 warbler, 16-18 sparrows, 18-21 crows
  a._cicada(0.3); a._cicada(1.8);
  a._cricketsOn();
  for (const k of a.crickets) { let t = 5 + Math.random(); while (t < 9) { const len = 0.4; k.v.g.gain.setValueAtTime(0, t); k.v.g.gain.linearRampToValueAtTime(0.022 * k.v.k, t + 0.04); k.v.g.gain.setValueAtTime(0.022 * k.v.k, t + len - 0.06); k.v.g.gain.linearRampToValueAtTime(0, t + len); t += len + 1.2; } }
  for (let t = 9.2; t < 12; t += 0.7) a._frog(t);
  a._warbler(12.3);
  a._sparrow(16.2); a._sparrow(17.0);
  a._crow(18.3);
  const buf = await ctx.startRendering();
  const L = buf.getChannelData(0), Rr = buf.getChannelData(1);
  let peak = 0, sum = 0;
  for (let i = 0; i < L.length; i++) { peak = Math.max(peak, Math.abs(L[i]), Math.abs(Rr[i])); sum += L[i] * L[i]; }
  // (16-bit interleaved, as a plain array of numbers)
  const pcm = new Array(L.length * 2);
  for (let i = 0; i < L.length; i++) { pcm[2 * i] = Math.round(Math.max(-1, Math.min(1, L[i])) * 32767); pcm[2 * i + 1] = Math.round(Math.max(-1, Math.min(1, Rr[i])) * 32767); }
  return { sr: SR, pcm, peak, rms: Math.sqrt(sum / L.length) };
});
console.log('peak', data.peak.toFixed(4), 'rms', data.rms.toFixed(5));
const n = data.pcm.length, b = Buffer.alloc(44 + n * 2);
b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
b.writeUInt16LE(2, 22); b.writeUInt32LE(data.sr, 24); b.writeUInt32LE(data.sr * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34);
b.write('data', 36); b.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) b.writeInt16LE(data.pcm[i], 44 + i * 2);
fs.writeFileSync(out, b);
console.log('wrote', out);
await browser.close(); server.close();
