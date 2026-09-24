// QA autopilot: drives like a judge having fun for as long as it runs. It follows the road with drifts into the
// tight corners (a handbrake flick and the key held into the turn), and every so often it does something else:
// knocks things over, leaves the road until the magnet comes, hits the rail, reverses into a J-turn, spins donuts.
// window.__QA__.ap holds its state and counters. Install once a run is under way.
(() => {
  const D = window.__DEBUG__, G = D.G, Q = window.__QA__;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const PLAN = (window.__QA_PLAN__ || 'smash,offroad,smash,crash,reverse,smash,offroad,donut,smash,crash').split(',');
  const EVERY = window.__QA_EVERY__ || 22;
  const S = Q.ap = { T: 0, mode: 'drive', modeT: 0, next: 18, planI: 0, counts: {}, done: {}, log: [], uT: 0, handUntil: 0, handCool: 0, slowT: 0,
    lastS: 0, progT: 0, target: null, phase: 0, knocks: 0, teleports: 0, magnets: 0, wasMag: false, events: {} };
  const setMode = (m, why = '') => { S.mode = m; S.modeT = 0; S.phase = 0; S.counts[m] = (S.counts[m] || 0) + 1; S.log.push([+S.T.toFixed(1), m, Math.round(G.s), why]); if (S.log.length > 300) S.log.shift(); };
  const done = (what) => { S.done[what] = (S.done[what] || 0) + 1; };
  // count what the game said happened
  const hud = D.hud;
  if (hud && !hud.__qa) {
    hud.__qa = true;
    const oe = hud.onEvent.bind(hud); hud.onEvent = (e) => { S.events[e.type] = (S.events[e.type] || 0) + 1; return oe(e); };
    const sm = hud.smash.bind(hud); hud.smash = (label, total, n) => { S.events['smash:' + label] = (S.events['smash:' + label] || 0) + 1; return sm(label, total, n); };
  }
  /** the next thing ahead that can be knocked over (or flattened), within reach of the road */
  const findProp = () => {
    const t = D.track, w = D.world;
    let best = null, bestS = Infinity;
    for (let ds = 18; ds <= 90; ds += 8) {
      const p = t.sample(G.s + ds);
      w.near(p.x, p.z, 12, (rec) => {
        if (!rec.alive || (rec.kind !== 'knock' && rec.kind !== 'flat')) return;
        const q = t.nearest(rec.x, rec.z, p.i);
        if (q.s < G.s + 14) return;
        const wSide = q.u >= 0 ? q.wl : q.wr;
        const hard = (q.u >= 0 ? t.pts[q.i].hardL : t.pts[q.i].hardR);
        if (hard !== undefined && Math.abs(q.u) > wSide + hard - 0.3) return;   // behind a rail or a front
        if (Math.abs(q.u) > wSide + 6) return;
        if (q.s < bestS) { bestS = q.s; best = { rec, s: q.s, u: q.u }; }
      });
      if (best) break;
    }
    return best;
  };
  /** a stretch ahead with a side the car can leave by: { side, u } */
  const findExit = () => {
    const t = D.track, city = !!D.world.city;
    for (let ds = 20; ds <= 160; ds += 10) {
      for (const side of [1, -1]) {
        let ok = true;
        for (let k = 0; k <= 50 && ok; k += 5) {
          const p = t.sample(G.s + ds + k); const pt = t.pts[p.i];
          const hard = side > 0 ? pt.hardL : pt.hardR;
          if (p.tunnel || p.express || hard === undefined || (city ? hard < 2 : hard !== Infinity) || Math.abs(p.k) > 1 / 60) ok = false;
        }
        if (ok) { const p = t.sample(G.s + ds); const w = side > 0 ? p.wl : p.wr; return { side, u: side * (w + (city ? 1.35 : 4.5)), s: G.s + ds }; }
      }
    }
    return null;
  };
  /** a rail (or a front, or a lining) ahead to run into */
  const findWall = () => {
    const t = D.track;
    for (let ds = 25; ds <= 140; ds += 10) for (const side of [1, -1]) {
      let ok = true;
      for (let k = 0; k <= 20 && ok; k += 5) { const p = t.sample(G.s + ds + k), pt = t.pts[p.i]; const hard = side > 0 ? pt.hardL : pt.hardR; if (hard === undefined || hard === Infinity || p.tunnel) ok = false; }
      if (ok) { const p = t.sample(G.s + ds), pt = t.pts[p.i], w = side > 0 ? p.wl : p.wr, hard = side > 0 ? pt.hardL : pt.hardR; return { side, u: side * (w + hard + 2.5), s: G.s + ds }; }
    }
    return null;
  };

  window.__AUTOPILOT__ = (dt) => {
    S.T += dt; S.modeT += dt;
    const car = D.car, t = D.track, v = car.speed, slip = car.beta * 180 / Math.PI;
    const mag = D.magnet.active;
    if (mag && !S.wasMag) { S.magnets++; }
    S.wasMag = mag;
    // progress watchdog: no progress along the road for 25 s -> teleport on (logged: it should never be needed)
    if (G.s > S.lastS + 15) { S.lastS = G.s; S.progT = 0; } else S.progT += dt;
    if (S.progT > 25 && !mag) { S.teleports++; S.progT = 0; S.lastS = G.s + 60; D.teleport(G.s + 60, 40); setMode('drive', 'teleport'); }
    // the plan: something other than driving every EVERY seconds
    if (S.mode === 'drive' && S.T > S.next && !mag && !G.off) {
      const what = PLAN[S.planI++ % PLAN.length];
      S.next = S.T + EVERY;
      if (what === 'smash') { const f = findProp(); if (f) { S.target = f; setMode('smash'); } }
      else if (what === 'offroad') { const f = findExit(); if (f) { S.target = f; setMode('offroad'); } }
      else if (what === 'crash') { const f = findWall(); if (f) { S.target = f; setMode('crash'); } }
      else if (what === 'reverse' || what === 'donut') setMode(what);
    }
    let uT = 0, vT = null, hand = 0, forceSteer = null, throttle = null, brake = null, reverse = false;
    // ------------------------------------------------ modes
    if (S.mode === 'smash') {
      const f = S.target;
      if (!f.rec.alive) { done('smash'); setMode('drive', 'knocked'); }
      else if (G.s > f.s + 4 || S.modeT > 9) setMode('drive', 'missed');
      else { const d = f.s - G.s; uT = d < 45 ? f.u : f.u * clamp(1 - (d - 45) / 40, 0, 1); vT = 13; }
    } else if (S.mode === 'offroad') {
      const f = S.target;
      if (mag) { S.phase = 1; }
      if (S.phase === 1 && !mag) { done('offroad'); setMode('drive', 'magnet done'); }
      else if (S.modeT > 16) setMode('drive', 'gave up');
      else { const d = f.s - G.s; uT = d > 0 ? f.u * clamp(1 - d / 40, 0.25, 1) : f.u; vT = G.off ? 7 : 12; }
    } else if (S.mode === 'crash') {
      const f = S.target;
      if (G.s > f.s + 30 || S.modeT > 8) setMode('drive', 'crash timeout');
      else { const d = f.s - G.s; uT = d < 30 ? f.u : f.u * clamp(1 - (d - 30) / 30, 0, 1); vT = 19; if (Math.abs(G.u) > Math.abs(f.u) - 3) { done('crash'); setMode('drive', 'hit'); } }
    } else if (S.mode === 'reverse') {
      // stop, back up straight, let go, full lock and the gas: a J-turn
      if (S.phase === 0) { throttle = 0; brake = 1; forceSteer = 0; if (v < 0.6 || S.modeT > 6) { S.phase = 1; S.modeT = 0; } }
      else if (S.phase === 1) { throttle = 0; brake = 1; reverse = true; forceSteer = 0; if (car.vF < -6.2 || S.modeT > 5) { S.phase = 2; S.modeT = 0; } }
      else if (S.phase === 2) { throttle = 0; brake = 0; forceSteer = 1; if (S.modeT > 0.18) { S.phase = 3; S.modeT = 0; } }
      else if (S.phase === 3) { throttle = 1; brake = 0; forceSteer = 1; if (S.modeT > 1.6) { done('jturn-try'); setMode('drive', 'jturn done'); } }
    } else if (S.mode === 'donut') {
      if (S.phase === 0) { throttle = 0; brake = 1; forceSteer = 0; if (v < 0.6 || S.modeT > 6) { S.phase = 1; S.modeT = 0; } }
      else { throttle = 1; brake = 0; forceSteer = 1; if (S.modeT > 4.5) { done('donut'); setMode('drive', 'donut done'); } }
    } else if (S.mode === 'unstick') {
      throttle = 0; brake = 1; reverse = true; forceSteer = -Math.sign(G.u || 1);
      if (S.modeT > 1.4) setMode('drive', 'unstuck');
    }
    // stuck: nearly stopped for 3 s while trying to drive
    if ((S.mode === 'drive' || S.mode === 'smash' || S.mode === 'crash') && !mag) {
      S.slowT = v < 1.2 ? S.slowT + dt : 0;
      if (S.slowT > 3) { S.slowT = 0; setMode('unstick', 'stuck'); }
    }
    // ------------------------------------------------ drive toward a point ahead at lateral offset uT
    const la = 7 + v * 0.55;
    const pa = t.sample(G.s + la);
    const lx = Math.cos(pa.h), lz = -Math.sin(pa.h);
    const tx = pa.x + lx * uT, tz = pa.z + lz * uT;
    const want = Math.atan2(tx - car.x, tz - car.z);
    const err = wrap(want - car.yaw);
    let steer = clamp(err * 2.2, -1, 1);
    // speed for the road ahead
    let kMax = 0;
    for (let ds = 4; ds <= 10 + v * 2.2; ds += 4) kMax = Math.max(kMax, Math.abs(t.sample(G.s + ds).k));
    let vmax = kMax > 0.002 ? Math.sqrt(10.5 / kMax) : 40;
    vmax = Math.min(vmax, 38);
    if (vT !== null) vmax = Math.min(vmax, vT);
    if (Math.abs(err) > 1.2) vmax = Math.min(vmax, 8);
    // drift: a handbrake flick into a tight corner at speed, the key held into the turn
    const k22 = t.sample(G.s + 16 + v * 0.3).k;
    if (S.mode === 'drive' && Math.abs(k22) > 1 / 45 && v > 13 && S.T > S.handCool) { S.handUntil = S.T + 0.32; S.handCool = S.T + 3.0; }
    if (S.T < S.handUntil) { hand = 1; steer = Math.sign(k22) * 0.95; }
    // a deep slide: counter-steer
    if (Math.abs(slip) > 36 && v > 5) steer = Math.sign(slip) * 0.9;
    if (forceSteer !== null) steer = forceSteer;
    const out = {
      throttle: throttle !== null ? throttle : (v < vmax ? 1 : 0),
      brake: brake !== null ? brake : (v > vmax + 3 && Math.abs(slip) < 15 ? 1 : 0),
      steer, hand, reverse, touch: false,
    };
    S.last = out;
    return out;
  };
  return { plan: PLAN, every: EVERY };
})();
