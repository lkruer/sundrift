// QA instrumentation, injected before the page's own scripts (evaluateOnNewDocument).
// window.__QA__: frame log, audio node census, and helpers the harness calls.
(() => {
  const Q = window.__QA__ = { frames: [], shots: [], gcs: [], marks: [], t0: performance.now(),
    aud: { created: {}, started: 0, ended: 0, conn: 0, disc: 0, live: 0, worklets: 0, ctxs: 0 } };
  try {
    const A = Q.aud;
    const reg = new FinalizationRegistry(() => { A.live--; });
    const B = (window.BaseAudioContext || window.AudioContext).prototype;
    for (const k of Object.getOwnPropertyNames(B)) {
      if (!/^create/.test(k) || k === 'createBuffer' || k === 'createPeriodicWave') continue;
      const d = Object.getOwnPropertyDescriptor(B, k); if (!d || typeof d.value !== 'function') continue;
      const f = d.value;
      B[k] = function (...a) {
        const n = f.apply(this, a);
        A.created[k] = (A.created[k] || 0) + 1; A.live++;
        try { reg.register(n, k); } catch {}
        if (n && typeof n.start === 'function') {
          const st = n.start;
          n.start = function (...b) { A.started++; try { n.addEventListener('ended', () => { A.ended++; }, { once: true }); } catch {} return st.apply(this, b); };
        }
        return n;
      };
    }
    const AC = window.AudioContext;
    if (AC) { window.AudioContext = function (...a) { A.ctxs++; const c = new AC(...a); Q.ctx = c; return c; }; window.AudioContext.prototype = AC.prototype; }
    if (window.AudioWorkletNode) { const W = window.AudioWorkletNode; window.AudioWorkletNode = function (...a) { A.worklets++; return new W(...a); }; window.AudioWorkletNode.prototype = W.prototype; }
    const C = AudioNode.prototype.connect, Dc = AudioNode.prototype.disconnect;
    AudioNode.prototype.connect = function (...a) { A.conn++; return C.apply(this, a); };
    AudioNode.prototype.disconnect = function (...a) { A.disc++; return Dc.apply(this, a); };
  } catch (e) { Q.audErr = String(e); }

  // slow GL calls (a texture upload, a buffer, a mipmap, a program link): anything over 12 ms, with what was bound
  Q.slowGL = [];
  try {
    const GL = window.WebGL2RenderingContext && WebGL2RenderingContext.prototype;
    if (GL) for (const k of ['texImage2D', 'texSubImage2D', 'texImage3D', 'generateMipmap', 'bufferData', 'bufferSubData', 'linkProgram', 'getProgramParameter', 'compileShader', 'readPixels', 'getError', 'drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'clear', 'texStorage2D', 'copyTexSubImage2D', 'blitFramebuffer', 'finish', 'flush', 'getParameter', 'getShaderParameter', 'getProgramInfoLog', 'getUniformLocation', 'getActiveUniform']) {
      const f = GL[k]; if (typeof f !== 'function') continue;
      GL[k] = function (...a) {
        const t = performance.now(); const r = f.apply(this, a); const d = performance.now() - t;
        if (d > 12) { Q.slowGL.push([Math.round(t), k, Math.round(d), Q.curDraw || '', a.length > 5 && a[a.length - 1] && a[a.length - 1].width ? a[a.length - 1].width + 'x' + a[a.length - 1].height : '']); if (Q.slowGL.length > 200) Q.slowGL.shift(); }
        return r;
      };
    }
  } catch (e) { Q.glErr = String(e); }
  /** Wrap the renderer's per-object draw: name what is drawing, time it, and remember first draws. */
  Q.hookDraws = (renderer) => {
    if (renderer.__qa) return; renderer.__qa = true;
    const orig = renderer.renderBufferDirect;
    const seen = new WeakMap();
    Q.slowDraws = []; Q.firstDraws = [];
    renderer.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
      const desc = `${object.type}:${object.name || object.parent && object.parent.name || ''}|${material.type}:${material.name || ''}${scene === null ? '|shadow' : ''}`;
      Q.curDraw = desc;
      let m = seen.get(material); if (!m) seen.set(material, m = new WeakSet());
      const first = !m.has(geometry); if (first) m.add(geometry);
      const t = performance.now();
      const r = orig.apply(this, arguments);
      const d = performance.now() - t;
      if (first && Q.watchFirst) { Q.firstDraws.push([Math.round(t), Math.round(d * 10) / 10, desc, Object.keys(geometry.attributes).join(',')]); if (Q.firstDraws.length > 3000) Q.firstDraws.shift(); }
      if (d > 12) { Q.slowDraws.push([Math.round(t), Math.round(d), desc, Object.keys(geometry.attributes).join(','), first ? 'FIRST' : '', object.isInstancedMesh ? 'n' + object.count : '']); if (Q.slowDraws.length > 200) Q.slowDraws.shift(); }
      Q.curDraw = '';
      return r;
    };
  };

  const pct = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;
  const stats = (a) => { const s = a.slice().sort((x, y) => x - y); return { p50: +pct(s, 0.5).toFixed(1), p90: +pct(s, 0.9).toFixed(1), p99: +pct(s, 0.99).toFixed(1), max: +(s[s.length - 1] || 0).toFixed(1) }; };
  /** Frame stats since the last call, leaving out the frames just after a screenshot or a forced GC. */
  Q.take = () => {
    const F = Q.frames; Q.frames = [];
    const skip = (t) => Q.shots.some((s) => t >= s - 50 && t <= s + 1500) || Q.gcs.some((s) => t >= s - 50 && t <= s + 1200) || Q.marks.some((s) => t >= s - 50 && t <= s + 1500);
    const f = F.filter((x) => !skip(x[0]));
    const real = f.map((x) => x[1]);
    return { n: f.length, skipped: F.length - f.length, real: stats(real), js: stats(f.map((x) => x[2])), world: stats(f.map((x) => x[3])), sim: stats(f.map((x) => x[4])),
      over20: real.filter((x) => x > 20).length, over34: real.filter((x) => x > 34).length,
      slow: f.filter((x) => x[1] > 34).slice(0, 6).map((x) => [Math.round(x[0] / 100) / 10, Math.round(x[1]), +x[2].toFixed(1), +x[3].toFixed(1), +x[4].toFixed(1), x[5]]) };
  };
  // what is going on in each frame, to put a name to a slow one: [programs, off, magnet, debris, reversing, toast, tunnel, rain, hitStop]
  Q.state = () => {
    const D = window.__DEBUG__; if (!D) return '';
    const G = D.G, car = D.car, h = D.hud;
    const toast = h && h.cur && h.cur.el && h.cur.el.isConnected ? h.cur.el.textContent.slice(0, 16) : '';
    return `p${D.renderer.info.programs ? D.renderer.info.programs.length : -1} ${G.off ? 'OFF' + G.off.t.toFixed(1) : ''} ${D.magnet.active ? 'MAG' : ''} d${D.debris ? D.debris.list.length : 0} ${car.vF < -0.5 ? 'REV' : ''} ${toast} ${G.tunnelK > 0.5 ? 'TUN' : ''} r${D.W.rain.toFixed(2)} ${G.hitStop > 0 ? 'HS' : ''} ${D.chase && D.chase.cine ? 'CINE' : ''}`.replace(/\s+/g, ' ');
  };
  Q.ring = [];
  Q.slowCtx = [];
  Q.onFrame = (dt, real) => {
    const D = window.__DEBUG__; const G = D && D.G;
    const now = performance.now();
    Q.frames.push([now, real * 1000, G ? (G.jsMs || 0) : 0, G ? (G.worldMs || 0) : 0, G ? (G.simMs || 0) : 0, G ? G.mode : '']);
    if (Q.frames.length > 20000) Q.frames.shift();
    const st = Q.state();
    Q.ring.push([Math.round(now), Math.round(real * 1000), +(G.jsMs || 0).toFixed(1), st + ' w' + (G.worldMs || 0).toFixed(1) + ' s' + Math.round(G.s)]);
    if (Q.ring.length > 6) Q.ring.shift();
    if (real > 0.05 && G && G.mode === 'playing') { Q.slowCtx.push(Q.ring.slice()); if (Q.slowCtx.length > 60) Q.slowCtx.shift(); }
    if (real > 0.1) try { performance.mark('qa-slow ' + Math.round(real * 1000) + ' js ' + (G ? (G.jsMs || 0).toFixed(0) : 0) + ' prevjs ' + (G ? (G.prevJs || 0).toFixed(0) : 0)); } catch {}
    // every new shader program, when it came and what it was for
    const P = D.renderer.info.programs;
    if (P && P.length !== Q.nProg) {
      if (Q.nProg !== undefined && P.length > Q.nProg) for (const p of P.slice(Q.nProg)) (Q.newProgs = Q.newProgs || []).push([Math.round(now), G ? G.mode : '', p.name, (p.cacheKey || '').slice(0, 160)]);
      Q.nProg = P.length;
    }
  };
  /** Everything the long run watches, in one object. */
  Q.sample = () => {
    const D = window.__DEBUG__; if (!D) return null;
    const G = D.G, r = D.renderer, w = D.world, t = D.track, car = D.car, sc = D.scoring;
    let objs = 0, meshes = 0, vis = 0, lights = 0, alive = 0;
    D.scene.traverse((o) => {
      objs++; if (o.isMesh || o.isPoints || o.isLine) { meshes++; if (o.visible) vis++; } if (o.isLight) lights++;
      if (o.isPoints && o.geometry.attributes.psize) { const a = o.geometry.attributes.psize.array; for (let i = 0; i < a.length; i++) if (a[i] > 0) alive++; }
    });
    const pools = {}; let fullPools = [];
    for (const [k, p] of Object.entries(w.pools)) { pools[k] = p.n; if (p.n >= p.cap) fullPools.push(k); }
    const tp = w.terrain && w.terrain.farTrees ? Object.fromEntries(Object.entries(w.terrain.farTrees).map(([k, p]) => [k, p.n])) : null;
    const parts = D.debris ? D.debris.list.length : -1;
    const au = D.audio, ctx = au && au.ctx;
    const heap = performance.memory ? performance.memory.usedJSHeapSize : 0, heapTot = performance.memory ? performance.memory.totalJSHeapSize : 0;
    return {
      t: Math.round((performance.now() - Q.t0) / 100) / 10, mode: G.mode,
      heapMB: +(heap / 1048576).toFixed(1), heapTotMB: +(heapTot / 1048576).toFixed(1),
      geo: r.info.memory.geometries, tex: r.info.memory.textures, progs: r.info.programs ? r.info.programs.length : -1,
      calls: r.info.render.calls, tris: r.info.render.triangles,
      objs, meshes, vis, lights, dom: document.getElementsByTagName('*').length, toasts: document.getElementById('toasts') ? document.getElementById('toasts').children.length : -1,
      chunks: w.stats.chunks, near: w.stats.near, tiles: w.terrain ? w.terrain.tiles.size : -1, tBuilt: w.terrain ? w.terrain.stats.built : -1, tMs: w.terrain ? Math.round(w.terrain.stats.ms) : -1,
      cols: w.cols.size, colsBy: w.colsBy.size, lamps: w.lamps.length, boxes: w.boxes.length,
      pts: t.pts.length, nFinal: t.nFinal, pads: t.pads.length, markers: t.markers.length, tunnels: t.tunnels.length,
      pools, fullPools, farTrees: tp, debris: parts, flats: D.debris ? D.debris.flats.length : -1, particles: alive,
      aud: au && au.ready ? { state: ctx.state, ...JSON.parse(JSON.stringify(window.__QA__.aud)), playing: window.__QA__.aud.started - window.__QA__.aud.ended, cy: !!au.cy } : null,
      hour: +G.hour.toFixed(3), shown: +(G.hourShown || 0).toFixed(3), night: +(G.night || 0).toFixed(2), rain: +D.W.rain.toFixed(2), wet: +D.W.wet.toFixed(2),
      s: Math.round(G.s), dist: Math.round(G.dist), kmh: Math.round(car.kmh), score: Math.round(sc.total), drifts: sc.stats.drifts, crashes: sc.stats.crashes, clips: sc.stats.clips,
      off: G.off ? +G.off.t.toFixed(1) : null, mag: D.magnet.active, tunnelK: +(G.tunnelK || 0).toFixed(2), longFrames: G.longFrames || 0, worstFrame: Math.round(G.worstFrame || 0),
      fps: G.fps,
    };
  };
})();
