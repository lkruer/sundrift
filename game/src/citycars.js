/**
 * NEO TOKYO: parked cars, for the coin parkings between the buildings.
 *
 *     carsLoad(w, Pool);                                  // once: the pool (compiled with the other pools)
 *     parkCar(w, owner, x, y, z, heading, rng);           // one car, its front toward heading
 *
 * One small car (a compact hatchback, about 200 triangles) drawn in two parts: the body, whose paint is the
 * instance's colour (its glass, tyres and trim are vertex colours the paint multiplies, so they stay dark), and
 * its lamps, lit: the tail lamps glow red (the street sees the backs of the cars nose-in), the head lamps pale.
 * Each car is stretched a little along and up (a kei car, a hatchback, a small wagon). Japanese paint: pearl white,
 * silver, black, gunmetal, navy, and now and then a bright little kei car.
 */
import * as THREE from 'three';

const PAINT = [0xf2f0ea, 0xf2f0ea, 0xe8e6e0, 0xb8bcc2, 0xa0a4aa, 0x1c1d22, 0x2a2c32, 0x44474d, 0x1e2a44, 0x6a1a1a, 0xb8202a, 0x2a5ab8, 0xe8c030, 0x3a7a4a, 0xd8d0b8];

function carGeometry() {
  // local: x across (-0.84..0.84), y up, z along with the front at +z (-2.0..2.0)
  const body = { p: [], n: [], c: [], i: [] }, lamps = { p: [], n: [], c: [], i: [] };
  const quad = (M, a, b, c, d, col) => {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / l, n[1] / l, n[2] / l];
    const k = M.p.length / 3;
    for (const v of [a, b, c, d]) { M.p.push(v[0], v[1], v[2]); M.n.push(n[0], n[1], n[2]); M.c.push(col[0], col[1], col[2]); }
    M.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
  };
  // a solid between two rectangles (bottom at y0, top at y1), each given as [x half-width, z0, z1]; col per face
  const frustum = (M, y0, b, y1, t, cols) => {
    const B = [[-b[0], y0, b[1]], [b[0], y0, b[1]], [b[0], y0, b[2]], [-b[0], y0, b[2]]];
    const Tp = [[-t[0], y1, t[1]], [t[0], y1, t[1]], [t[0], y1, t[2]], [-t[0], y1, t[2]]];
    // sides: -x, +x; ends: -z (rear), +z (front); top
    quad(M, B[0], B[3], Tp[3], Tp[0], cols.side);       // -x
    quad(M, B[2], B[1], Tp[1], Tp[2], cols.side);       // +x
    quad(M, B[1], B[0], Tp[0], Tp[1], cols.rear);       // -z
    quad(M, B[3], B[2], Tp[2], Tp[3], cols.front);      // +z
    quad(M, Tp[0], Tp[3], Tp[2], Tp[1], cols.top);      // top
  };
  const W = [1, 1, 1], G = [0.07, 0.085, 0.1], K = [0.05, 0.05, 0.055], T = [0.2, 0.2, 0.22];
  // the lower body: sills to the waist, a little narrower at the bumpers' corners
  frustum(body, 0.24, [0.84, -2.0, 2.0], 0.86, [0.84, -1.96, 1.9], { side: W, rear: W, front: W, top: W });
  // the bumpers, dark
  frustum(body, 0.2, [0.86, -2.04, -1.8], 0.48, [0.86, -2.04, -1.8], { side: T, rear: T, front: T, top: T });
  frustum(body, 0.2, [0.86, 1.8, 2.04], 0.48, [0.86, 1.8, 2.04], { side: T, rear: T, front: T, top: T });
  // the cabin: glass all round, the roof in paint
  frustum(body, 0.86, [0.8, -1.72, 0.95], 1.42, [0.7, -1.5, 0.35], { side: G, rear: G, front: G, top: W });
  // the pillars between the side windows (paint over the glass)
  for (const zz of [-0.45]) for (const s of [-1, 1]) {
    const x = s * 0.815, x2 = s * 0.715;
    const a = [x, 0.86, zz - 0.06], b = [x, 0.86, zz + 0.06], c = [x2, 1.42, zz + 0.06 - 0.1], d = [x2, 1.42, zz - 0.06 - 0.1];
    if (s > 0) quad(body, b, a, d, c, W); else quad(body, a, b, c, d, W);
  }
  // the wheels: an eight-sided tyre each side of each axle, dark
  for (const zz of [-1.3, 1.3]) for (const s of [-1, 1]) {
    const cx = s * 0.78, r = 0.3, cy = 0.3, N = 8;
    const ring = [];
    for (let k = 0; k < N; k++) { const a = (k / N) * Math.PI * 2; ring.push([Math.cos(a) * r, Math.sin(a) * r]); }
    for (let k = 0; k < N; k++) {
      const [y0, z0] = ring[k], [y1, z1] = ring[(k + 1) % N];
      const o = [cx + s * 0.07, cy + y0, zz + z0], p1 = [cx + s * 0.07, cy + y1, zz + z1], q1 = [cx - s * 0.13, cy + y1, zz + z1], q0 = [cx - s * 0.13, cy + y0, zz + z0];
      if (s > 0) quad(body, p1, o, q0, q1, K); else quad(body, o, p1, q1, q0, K);          // (the tread faces out)
    }
    // the hub cap, grey, on the outside face
    const hc = [];
    for (let k = 0; k < N; k++) { const a = (k / N) * Math.PI * 2; hc.push([cx + s * 0.075, cy + Math.sin(a) * r * 0.62, zz + Math.cos(a) * r * 0.62]); }
    for (let k = 1; k < N - 1; k++) { const k0 = body.p.length / 3; const tri = s > 0 ? [hc[0], hc[k + 1], hc[k]] : [hc[0], hc[k], hc[k + 1]]; for (const v of tri) { body.p.push(...v); body.n.push(s, 0, 0); body.c.push(0.55, 0.56, 0.58); } body.i.push(k0, k0 + 1, k0 + 2); }
  }
  // the lamps: tail lamps at the rear corners, red; head lamps at the front, pale; a third brake lamp over the glass
  const lamp = (xa, xb, y0, y1, z, dirZ, col) => {
    const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
    const a = [x0, y0, z], b = [x1, y0, z], c = [x1, y1, z], d = [x0, y1, z];
    if (dirZ > 0) quad(lamps, a, b, c, d, col); else quad(lamps, b, a, d, c, col);
  };
  const RED = [1.0, 0.1, 0.08], PALE = [0.55, 0.55, 0.5];
  for (const s of [-1, 1]) {
    lamp(s * 0.8, s * 0.5, 0.62, 0.8, -1.985, -1, RED);
    lamp(s * 0.5, s * 0.8, 0.6, 0.76, 1.94, 1, PALE);
  }
  lamp(-0.25, 0.25, 1.36, 1.4, -1.53, -1, RED);
  const g = (M) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(M.p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(M.n, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(M.c, 3));
    geo.setIndex(M.i); geo.computeBoundingSphere();
    return geo;
  };
  return { body: g(body), lamps: g(lamps) };
}

export function carsLoad(w, Pool) {
  const geo = carGeometry();
  const body = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.08 });
  body.name = 'parked car'; body.userData.tinted = true;
  const lamps = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.6, 1.6, 1.6) });
  lamps.name = 'parked car lamps';
  w.pools.parked = new Pool([{ geometry: geo.body, material: body, local: new THREE.Matrix4() }, { geometry: geo.lamps, material: lamps, local: new THREE.Matrix4() }], 160, { tint: true });
  w.root.add(w.pools.parked.group);
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

/** Park one car under owner at (x, y, z), its front toward heading (radians, as the road's p.h: +z along it). */
export function parkCar(w, owner, x, y, z, heading, rng) {
  const pool = w.pools.parked; if (!pool) return;
  const len = 0.84 + rng() * 0.2, tall = 0.95 + rng() * 0.15, wide = 0.94 + rng() * 0.08;
  _q.setFromAxisAngle(_up, heading);
  _m.compose(_p.set(x, y, z), _q, _s.set(wide, tall, len));
  pool.add(owner, _m, PAINT[Math.floor(rng() * PAINT.length)]);
}
