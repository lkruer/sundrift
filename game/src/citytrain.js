/**
 * NEO TOKYO: an elevated railway along some of the avenues, the way the Yamanote line runs beside a street on its
 * viaduct, with little shops and bars in the arches underneath (gaado-shita), and a lit commuter train now and then.
 *
 *     railLoad(w, Pool);                 // once: the train's pool (six cars, compiled with everything else)
 *     railSkip(w, s, side, halfW);       // in the lot loop: true where the viaduct stands instead of a lot
 *     railChunk(w, ch, D);               // with a chunk's detail: the viaduct, its shops, masts, wires, stations
 *     railUpdate(w, t);                  // every frame: the train along the stretch nearest the camera
 *
 * Where: stretches of 200 to 320 m of avenue that bends gently at most, with no ramp, lay-by or set piece on the
 * side the viaduct takes, at least 700 m apart, found once along the track as it grows (so every chunk agrees).
 * The viaduct's front is the street front (its shops stand where the lots would), its deck 8 m up with a parapet
 * carrying lit ad panels, catenary masts every 30 m with their wires, a pier every 12 m; a station building at each
 * end the line runs into; taller buildings behind it keep the skyline. The train is six silver cars with the green
 * stripe and their windows lit, running the stretch at 50 km/h one way on the near track, then back on the far one.
 */
import * as THREE from 'three';

const DECK = 8.0, DECK_T = 1.35, DEPTH = 9.4;          // deck top above the street, its thickness, front to back
const CAR_L = 19.5, CARS = 6, GAP = 0.5;
const TRACKS = [3.0, 6.3];                             // the two tracks' distances in from the front
const STATION = 22;                                    // a station building's length (a whole car hides in it)

// ---------------------------------------------------------------- where the line runs

/** The stretches found so far (s0, s1, side), scanning the track forward as it grows. */
export function railStretches(w) {
  const t = w.track;
  let R = w._rail;
  if (!R || R.track !== t) R = w._rail = { track: t, list: [], s: 40, run: null, lastEnd: -1e9 };
  const end = t.pts[t.nFinal - 1].s - 60;
  const ok = (s, side) => {
    const p = t.sample(s);
    if (p.tunnel || p.express || Math.abs(p.k) > 1 / 110 || t.nearTunnel(p.s, 20)) return false;
    return side === 0 ? true : !(t.markerAt(p.s, side) || t.padAt(p.s, side));
  };
  const close = (a, b) => {
    // a run of plain road from a to b: take up to 320 m of it, on a side with nothing set beside the road
    // (its stations, 22 m long, stand on plain road too)
    if (b - a < 230 || a - R.lastEnd < 700) return;
    const s0 = a + STATION + 4, s1 = Math.min(b - STATION - 4, s0 + 320);
    const h = Math.sin(a * 0.0137 + (w.seed % 997)) * 43758.5453, pref = h - Math.floor(h) < 0.5 ? 1 : -1;
    for (const side of [pref, -pref]) {
      let clear = true;
      for (let s = s0 - STATION - 2; s < s1 + STATION + 2 && clear; s += 4) if (!ok(s, side)) clear = false;
      if (clear) { R.list.push({ s0, s1, side, i: R.list.length }); R.lastEnd = s1; return; }
    }
  };
  for (; R.s < end; R.s += 4) {
    const plain = ok(R.s, 0);
    if (plain && R.run === null) R.run = R.s;
    else if (!plain && R.run !== null) { close(R.run, R.s - 4); R.run = null; }
  }
  return R.list;
}

/** The stretch at s on this side, if any (with the stations' margins). */
function stretchAt(w, s, side, margin = 0) {
  for (const st of railStretches(w)) if (st.side === side && s > st.s0 - margin && s < st.s1 + margin) return st;
  return null;
}

/** Whether a lot centred at s (half its width halfW) on this side must give way to the viaduct or a station. */
export function railSkip(w, s, side, halfW) {
  return !!stretchAt(w, s, side, halfW + STATION + 1);
}

// ---------------------------------------------------------------- the train

function carGeometry() {
  // local: along +z (0..CAR_L), x across (-1.47..1.47), y up from the rail top
  const body = { p: [], n: [], c: [], i: [] }, win = { p: [], n: [], i: [], uv: [] };
  const quad = (M, a, b, c, d, n, col) => {
    const k = M.p.length / 3;
    for (const v of [a, b, c, d]) {
      M.p.push(v[0], v[1], v[2]); M.n.push(n[0], n[1], n[2]); if (M.c) M.c.push(col[0], col[1], col[2]);
      // (a window's picture runs along the car, four metres to a repeat, over the height of the glass)
      if (M.uv) M.uv.push((v[2] + (n[2] ? v[0] : 0)) / 4, (v[1] - 1.3) / 1.45);
    }
    M.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
  };
  const box = (M, x0, x1, y0, y1, z0, z1, col, skipBottom = true) => {
    quad(M, [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0], col);
    quad(M, [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [-1, 0, 0], col);
    quad(M, [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0], col);
    if (!skipBottom) quad(M, [x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [0, -1, 0], col);
    quad(M, [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1], [0, 0, 1], col);
    quad(M, [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [0, 0, -1], col);
  };
  const silver = [0.72, 0.74, 0.78], green = [0.42, 0.72, 0.14], dark = [0.08, 0.08, 0.09], roof = [0.55, 0.57, 0.6];
  const W = 1.47, L = CAR_L;
  box(body, -W, W, 0.95, 3.25, 0, L, silver);                       // the body
  box(body, -W + 0.12, W - 0.12, 3.25, 3.62, 0.3, L - 0.3, roof);   // the roof
  box(body, -W - 0.02, W + 0.02, 1.02, 1.24, 0.05, L - 0.05, green); // the stripe
  box(body, -W + 0.1, W - 0.1, 0.55, 0.95, 0.4, L - 0.4, dark);     // the skirt
  for (const z of [3.2, L - 3.2]) box(body, -1.25, 1.25, 0.05, 0.62, z - 1.3, z + 1.3, dark);  // the bogies
  box(body, -0.9, 0.9, 3.62, 3.72, 5.5, 7.2, dark);                 // the pantograph's base
  // the windows along both sides, broken by four doors; the doors' own windows higher and narrower
  for (const s of [1, -1]) {
    const x = s * (W + 0.012), n = [s, 0, 0];
    const doors = [2.6, 7.2, 12.3, 16.9];
    let z = 0.6;
    const pane = (z0, z1, y0, y1) => { const a = [x, y0, z0], b = [x, y1, z0], c = [x, y1, z1], d = [x, y0, z1]; if (s > 0) quad(win, a, b, c, d, n); else quad(win, d, c, b, a, n); };
    for (const dz of doors) { if (dz - 0.75 > z + 0.2) pane(z, dz - 0.75, 1.45, 2.55); pane(dz - 0.6, dz + 0.6, 1.3, 2.75); z = dz + 0.75; }
    if (L - 0.6 > z + 0.2) pane(z, L - 0.6, 1.45, 2.55);
  }
  // the ends: a lit destination board and the lamps (white one end, red the other)
  for (const [z, n] of [[L + 0.012, [0, 0, 1]], [-0.012, [0, 0, -1]]]) {
    const a = [-0.7, 2.75, z], b = [0.7, 2.75, z], c = [0.7, 3.05, z], d = [-0.7, 3.05, z];
    if (n[2] > 0) quad(win, b, c, d, a, n); else quad(win, a, d, c, b, n);
  }
  const g = (M, colours) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(M.p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(M.n, 3));
    if (colours) geo.setAttribute('color', new THREE.Float32BufferAttribute(M.c, 3));
    if (M.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(M.uv, 2));
    geo.setIndex(M.i); geo.computeBoundingSphere();
    return geo;
  };
  return { body: g(body, true), win: g(win, false) };
}

/** The inside of a carriage through its windows: warm light, the seats' backs, people standing, the straps. */
function carriageTexture() {
  const W = 256, H = 64, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  let seed = 5; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#fffaf0'); g.addColorStop(0.5, '#fff0d8'); g.addColorStop(1, '#e8d8c0');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // the straps along the top, the seats' backs along the bottom
  c.fillStyle = '#b8a890'; c.fillRect(0, 4, W, 2);
  for (let x = 6; x < W; x += 14) { c.fillStyle = '#d8c8a8'; c.fillRect(x, 6, 2, 6); c.strokeStyle = '#a89878'; c.lineWidth = 2; c.beginPath(); c.arc(x + 1, 15, 3, 0, Math.PI * 2); c.stroke(); }
  c.fillStyle = '#5a6a8a'; c.fillRect(0, H - 16, W, 16);
  for (let x = 0; x < W; x += 32) { c.fillStyle = '#4a5a7a'; c.fillRect(x, H - 16, 2, 16); }
  // people standing, dark against the light: a head and shoulders, now and then someone looking at a phone
  for (let i = 0; i < 9; i++) {
    const x = 10 + rnd() * (W - 20), hgt = 34 + rnd() * 12, col = ['#2a2630', '#3a3040', '#1e2230', '#4a3a3a'][Math.floor(rnd() * 4)];
    c.fillStyle = col;
    c.beginPath(); c.arc(x, H - hgt, 5.5, 0, Math.PI * 2); c.fill();
    c.fillRect(x - 8, H - hgt + 5, 16, hgt);
    if (rnd() < 0.4) { c.fillStyle = '#9ad0ff'; c.fillRect(x + 3, H - hgt + 12, 3, 4); }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

export function railLoad(w, Pool) {
  const geo = carGeometry();
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.55 });
  bodyMat.name = 'train body';
  const winMat = new THREE.MeshBasicMaterial({ map: carriageTexture(), color: new THREE.Color(0xfff2d8).multiplyScalar(1.3) });
  winMat.name = 'train windows';
  // a pool of its own, so the instanced programs compile with the rest at load; the cars move every frame
  w.pools.train = new Pool([{ geometry: geo.body, material: bodyMat, local: new THREE.Matrix4() }, { geometry: geo.win, material: winMat, local: new THREE.Matrix4() }], CARS);
  w.root.add(w.pools.train.group);
  w._train = { ids: [], hidden: true };
  return [bodyMat, winMat];
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _hide = new THREE.Vector3(0, -900, 0), _up = new THREE.Vector3(0, 1, 0);

/** Every frame: the train on the stretch nearest the camera, if one is near. */
export function railUpdate(w, t) {
  const pool = w.pools && w.pools.train, T = w._train;
  if (!pool || !T || !w.city || !w.track || !w.citySky) return;
  const cam = w.citySky.position;
  T.pos = null;                // (for the city's sounds, audio.js: set below to the point of the train nearest the camera)
  const g = w.ground, tr = w.track;
  let best = null, bd = 520;
  for (const st of railStretches(w)) {
    const pa = tr.sample(st.s0), pb = tr.sample(st.s1), pm = tr.sample((st.s0 + st.s1) / 2);
    const d = Math.min(Math.hypot(pa.x - cam.x, pa.z - cam.z), Math.hypot(pb.x - cam.x, pb.z - cam.z), Math.hypot(pm.x - cam.x, pm.z - cam.z));
    if (d < bd) { bd = d; best = st; }
  }
  // (with no stretch near, the cars leave the pool and cost nothing; a new course's cleared pools are refilled here)
  if (!best) { if (pool.n) { pool.removeOwner(-7); T.ids = []; } return; }
  if (pool.n === 0 || T.ids.length !== CARS) { pool.removeOwner(-7); T.ids = []; for (let k = 0; k < CARS; k++) { _m.compose(_hide, _q.identity(), _s); T.ids.push(pool.add(-7, _m)); } }
  // one run from station to station, one way on the near track, then back on the far one, a pause at each end;
  // a car shows only while it is wholly past the far wall of the station it left and short of the other's
  const inset = STATION - 0.5, L = best.s1 - best.s0 + 2 * inset, len = CARS * (CAR_L + GAP), speed = 14;
  const run = (L + len) / speed, cycle = 2 * (run + 6);
  const tt = w._trainT !== undefined ? w._trainT : t;          // (a test can hold the train where it wants it)
  const ph = ((tt + best.i * 37) % cycle + cycle) % cycle;
  const back = ph >= run + 6, u = back ? ph - run - 6 : ph;
  const head = u < run ? u * speed : -1e9;                   // metres the head has come from the first station
  for (let k = 0; k < CARS; k++) {
    const d0 = head - k * (CAR_L + GAP);                     // this car's front, metres along
    const inside = d0 - CAR_L > 0 && d0 < L;
    if (!inside) { _m.compose(_hide, _q.identity(), _s); pool.setById(T.ids[k], _m); continue; }
    const sMid = back ? best.s1 + inset - (d0 - CAR_L / 2) : best.s0 - inset + (d0 - CAR_L / 2);
    const p = tr.sample(sMid);
    const wall = best.side > 0 ? p.wl : p.wr;
    const off = (wall + 2.9 + (back ? TRACKS[1] : TRACKS[0])) * best.side;
    const lx = Math.cos(p.h), lz = -Math.sin(p.h);
    const x = p.x + lx * off, z = p.z + lz * off;
    const fx = p.x + lx * (wall + 2.9) * best.side, fz = p.z + lz * (wall + 2.9) * best.side;
    const y = g.height(fx, fz) + DECK + 0.02;
    // the car's local z runs along its travel; its origin is its rear end, so step back half a car
    const hd = p.h + (back ? Math.PI : 0);
    const ax = Math.sin(hd), az = Math.cos(hd);
    _q.setFromAxisAngle(_up, hd);
    _m.compose(_p.set(x - ax * CAR_L / 2, y, z - az * CAR_L / 2), _q, _s);
    pool.setById(T.ids[k], _m);
    // ---- for the city's sounds (audio.js cityUpdate): the point of the train nearest the camera, its speed, and how
    // far the head has run (the wheels' clacks over the rail joints are timed from it); one object, reused
    {
      const q = Math.max(-CAR_L / 2, Math.min(CAR_L / 2, (cam.x - x) * ax + (cam.z - z) * az));
      const nx = x + ax * q, nz = z + az * q, d2 = (nx - cam.x) * (nx - cam.x) + (nz - cam.z) * (nz - cam.z);
      if (!T.pos || d2 < T.pos.d2) {
        const P = T.pos = T._pos || (T._pos = { x: 0, y: 0, z: 0, d2: 0, speed: 0, od: 0 });
        P.x = nx; P.y = y + 2; P.z = nz; P.d2 = d2; P.speed = speed; P.od = head;
      }
    }
  }
}

// ---------------------------------------------------------------- the viaduct, per chunk

/**
 * The part of any stretch that runs through this chunk: the deck and its parapet (concrete), piers, the shops in
 * the arches (building boxes, the building shader draws their fronts), ad panels on the parapet, catenary masts and
 * their wires, a station building at each end, and taller buildings behind. D: the chunk's detail lists.
 */
export function railChunk(w, ch, D) {
  const t = w.track, g = w.ground, pts = t.pts;
  const s0 = pts[ch.i0].s, s1 = pts[ch.i1].s;
  const own = ch.c * 2;
  const r = D.rng;
  const deck = { p: [], i: [] };
  const loft = (rows, flip) => {
    const n = rows.length, m = rows[0].length, base = deck.p.length / 3;
    for (const row of rows) for (const q of row) deck.p.push(q[0], q[1], q[2]);
    for (let k = 0; k < n - 1; k++) for (let j = 0; j < m - 1; j++) {
      const a = base + k * m + j, b = a + 1, c = a + m, d = c + 1;
      if (flip) deck.i.push(a, b, c, b, d, c); else deck.i.push(a, c, b, b, c, d);
    }
  };
  const _q2 = new THREE.Quaternion(), _m2 = new THREE.Matrix4(), _v2 = new THREE.Vector3(), _s2 = new THREE.Vector3();
  const building = (x, y, z, h, w0, H, d, colour) => {
    _q2.setFromAxisAngle(_up, h + Math.PI / 2);
    _s2.set(w0, H + 0.3, d);
    _m2.compose(_v2.set(x, y - 0.3 + (H + 0.3) / 2, z), _q2, _s2);
    w.pools.bldg.add(own, _m2, colour);
  };
  const piers = [], strip = { p: [], i: [] };
  const FAC = [0x55565c, 0x6b6a66, 0x7a746a, 0x3c3f47, 0x4a4e57, 0x8a8478, 0x5c5048, 0x2f3440, 0x6e6a74, 0x44474d];
  for (const st of railStretches(w)) {
    if (st.s1 + 12 < s0 || st.s0 - 12 > s1) continue;
    const side = st.side;
    const at = (s, u) => { const p = t.sample(s); const lx = Math.cos(p.h) * side, lz = -Math.sin(p.h) * side; const wall = side > 0 ? p.wl : p.wr; return { p, wall, lx, lz, x: p.x + lx * (wall + u), z: p.z + lz * (wall + u), fx: Math.sin(p.h), fz: Math.cos(p.h) }; };
    const front = (s) => { const a = at(s, 2.9); return g.height(a.x, a.z); };
    // the deck and its parapet, sample by sample through this chunk
    const rows = [];
    const a0 = Math.max(s0, st.s0 - 1), a1 = Math.min(s1, st.s1 + 1);
    if (a1 > a0) {
      for (let s = a0; s <= a1 + 0.01; s += Math.min(2, a1 - a0 || 2)) {
        const y = front(s);
        const P = (u, dy) => { const a = at(s, u); return [a.x, y + dy, a.z]; };
        // round from the back of the underside, along it to the front, up the front face, over the parapet
        rows.push([P(2.9 + DEPTH, DECK - DECK_T), P(2.6, DECK - DECK_T), P(2.6, DECK + 1.15), P(2.95, DECK + 1.15), P(2.95, DECK), P(2.9 + DEPTH, DECK)]);
      }
      if (rows.length > 1) loft(rows, side < 0);
      // under the deck's front edge a strip of lamps lighting the arches, and one along the parapet's top
      for (const [u0, u1, y0, y1] of [[2.62, 2.62, DECK - DECK_T - 0.02, DECK - DECK_T + 0.1], [2.58, 2.58, DECK + 0.62, DECK + 0.7]]) {
        const srows = [];
        for (const row of rows) void row;
        for (let s = a0; s <= a1 + 0.01; s += Math.min(2, a1 - a0 || 2)) {
          const y = front(s), A = at(s, u0 - 0.03), B = at(s, u1 - 0.03);
          srows.push([[A.x, y + y0, A.z], [B.x, y + y1, B.z]]);
        }
        if (srows.length > 1) {
          const base = strip.p.length / 3;
          for (const row of srows) for (const q of row) strip.p.push(q[0], q[1], q[2]);
          for (let k = 0; k < srows.length - 1; k++) { const a = base + k * 2, b = a + 1, c = a + 2, d = a + 3; strip.i.push(a, c, b, b, c, d, a, b, c, b, d, c); }
        }
      }
      // piers every 12 m, and between them the shops in the arches
      for (let s = Math.ceil(a0 / 12) * 12; s < a1; s += 12) {
        const a = at(s, 2.9), y = front(s);
        for (const u of [2.8, 2.9 + DEPTH - 0.9]) {
          const b = at(s, u + 0.55);
          piers.push(box2(b.x, y - 0.2, b.z, a.p.h, 1.1, DECK - DECK_T + 0.25, 0.9));
        }
        const shop = at(s + 6, 2.9 + 4.2);
        if (s + 6 < st.s1 - 1 && s + 6 > st.s0 + 1) building(shop.x, g.height(shop.x, shop.z), shop.z, shop.p.h, 10.7, DECK - DECK_T - 0.05, 8.4, FAC[Math.floor(r() * FAC.length)]);
      }
      // ad panels along the parapet, facing the street
      for (let s = Math.ceil((a0 - 10) / 26) * 26 + 10; s < a1 - 6; s += 26) {
        const k = r();
        if (k < 0.2) continue;
        const y = front(s) + DECK - DECK_T + 0.14;
        if (k < 0.45) { const a = at(s, 2.55); D.screen([a.x, y + 0.35, a.z], [-a.lx, -a.lz], 9, 0.62, Math.floor(r() * 997) + 0.5, 2); continue; }
        for (const ds of [-1.45, 1.45]) { const a = at(s + ds, 2.55); D.screen([a.x, y, a.z], [-a.lx, -a.lz], 2.7, 1.35, Math.floor(r() * 997) + 0.5, 0); }
      }
      // catenary masts every 30 m (a post by the parapet, an arm over both tracks) and the wires along each track
      const masts = [];
      for (let s = Math.ceil(a0 / 30) * 30; s < a1; s += 30) masts.push(s);
      for (const s of masts) {
        const y = front(s), p0 = at(s, 3.3), p1 = at(s, 2.9 + DEPTH - 0.4);
        D.housings.push(box2(p0.x, y + DECK, p0.z, p0.p.h, 0.22, 5.6, 0.22));
        D.housings.push(box2(p1.x, y + DECK, p1.z, p1.p.h, 0.22, 5.6, 0.22));
        const q0 = [p0.x, y + DECK + 5.4, p0.z], q1 = [p1.x, y + DECK + 5.4, p1.z];
        D.housings.push(beamBox(q0, q1, 0.16));
        for (const tu of TRACKS) {
          const c0 = at(s, 2.9 + tu), c1 = at(s + 30, 2.9 + tu);
          if (s + 30 <= st.s1 + 1) {
            const y1 = front(s + 30);
            D.hang([c0.x, y + DECK + 5.3, c0.z], [c1.x, y1 + DECK + 5.3, c1.z], 0.35, 0.03, 8);
            D.hang([c0.x, y + DECK + 4.9, c0.z], [c1.x, y1 + DECK + 4.9, c1.z], 0.06, 0.02, 6);
          }
        }
      }
      // taller buildings behind the line keep the skyline (where the ground is clear of any other road)
      const probe = {};
      for (let s = a0 + 4; s < a1 - 4;) {
        const bw = 10 + r() * 8, sm = s + bw / 2;
        s += bw + 0.4;
        if (sm > a1 - 2) break;
        const dep = 9 + r() * 6, a = at(sm, 2.9 + DEPTH + 1.2 + dep / 2);
        g.sample(a.x, a.z, 2.2, probe);
        const b = at(sm, 2.9 + DEPTH + 1.2 + dep);
        const probe2 = {}; g.sample(b.x, b.z, 2.2, probe2);
        if (probe.edge < 3 || probe2.edge < 3) continue;
        building(a.x, g.height(a.x, a.z), a.z, a.p.h, bw, 18 + r() * 42, dep, FAC[Math.floor(r() * FAC.length)]);
      }
    }
    // a station building at each end the line runs into
    for (const [se, dir] of [[st.s0, -1], [st.s1, 1]]) {
      if (se < s0 || se >= s1) continue;
      const dep = DEPTH + 3.4, a = at(se + dir * (STATION / 2 - 0.5), 2.9 + dep / 2);
      building(a.x, g.height(a.x, a.z), a.z, a.p.h, STATION, 22 + r() * 14, dep, FAC[Math.floor(r() * FAC.length)]);
      w.detail.stats.stations = (w.detail.stats.stations || 0) + 1;
    }
  }
  // the piers go in with the deck: one mesh, the expressway's concrete
  for (const pg of piers) {
    const base = deck.p.length / 3, pa = pg.attributes.position.array, ix = pg.index.array;
    for (let k = 0; k < pa.length; k++) deck.p.push(pa[k]);
    for (let k = 0; k < ix.length; k++) deck.i.push(ix[k] + base);
    pg.dispose();
  }
  if (deck.i.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(deck.p, 3));
    geo.setIndex(deck.i); geo.computeVertexNormals(); geo.computeBoundingSphere();
    ch.own.add(geo);
    const m = new THREE.Mesh(geo, w.barrierMat); m.name = 'railway viaduct'; m.castShadow = true; m.receiveShadow = true;
    ch.group.add(m);
  }
  if (strip.i.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(strip.p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(strip.p.length).fill(0), 3));
    geo.setIndex(strip.i); geo.computeBoundingSphere();
    ch.own.add(geo);
    const m = new THREE.Mesh(geo, w.stripMat); m.name = 'railway lamps';
    ch.group.add(m);
  }
}

/** A box standing on (x, y, z): w across (along the heading's left), h tall, d along the road. */
function box2(x, y, z, heading, w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.rotateY(heading);
  g.translate(x, y + h / 2, z);
  return g;
}
/** A square beam between two points. */
function beamBox(a, b, t) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length();
  const g = new THREE.BoxGeometry(t, L, t);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
}
