// hero_coupe — arm C: a hand-built loft. Ten cross-sections along the length, each a
// closed loop of twelve points computed from nine numbers (floor edge, flank, belt,
// roof edge, crown), are skinned into one BufferGeometry with normals averaged per
// corner, hard creases at the sill, the belt and the roof edge, and the glasshouse
// bands assigned to a second material group so the skin runs unbroken from nose to
// tail. The same routine skins the bumpers, the lip and lamp band (plan-curved), the
// flares (a four-point loop swept around each arch), the pillars, the wing and the
// seats, and revolved loops make the tyres, rim shells, discs, helmet and torso.
// Nose = +Z, base y = 0. 1.72 W x 1.28 H x 4.45 L.
//
// Moving parts: g.userData.joints = { hubFL, hubFR, wheelFL, wheelFR, wheelRL, wheelRR }.
export default function (THREE) {
  const g = new THREE.Group();
  const body = new THREE.Group(); body.name = 'body'; g.add(body);
  const PI = Math.PI, DS = THREE.DoubleSide;
  const lerp = (a, b, t) => a + (b - a) * t;
  const c01 = (t) => Math.max(0, Math.min(1, t));

  // ---- materials: every hex from STYLE_LOCK.md -----------------------------------
  const mk = (color, o) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0 }, o || {}));
  const PAINT  = mk(0xf2f0ea, { roughness: 0.35 });                                    PAINT.name = 'paint';
  const GLASS  = mk(0x1c2a33, { roughness: 0.1, transparent: true, opacity: 0.55 });   GLASS.name = 'glass';
  const DARK   = mk(0x2b2d31, { roughness: 0.5 });                                     DARK.name = 'metal';
  const DARK2  = mk(0x2b2d31, { roughness: 0.5, side: DS });                           DARK2.name = 'metal';
  const EXH    = mk(0x2b2d31, { roughness: 0.3, metalness: 0.8, side: DS });           EXH.name = 'metal';
  const RUB    = mk(0x1a1a1c, { roughness: 0.9 });
  const BRONZE = mk(0xb8843a, { roughness: 0.4, metalness: 0.25 });                    BRONZE.name = 'metal';
  const BRONZ2 = mk(0xb8843a, { roughness: 0.4, metalness: 0.25, side: DS });          BRONZ2.name = 'metal';
  const GALV   = mk(0xb9bcc0, { roughness: 0.5, metalness: 0.6 });                     GALV.name = 'metal';
  const HEAD   = mk(0xffcf7a, { roughness: 0.3, emissive: new THREE.Color(0xfff1d6), emissiveIntensity: 0.8 });
  const TAIL   = mk(0xd11c1c, { roughness: 0.4, emissive: new THREE.Color(0xd11c1c), emissiveIntensity: 1.5 });
  const SEAT   = mk(0x1a1a1c, { roughness: 0.9 });
  const STRIPE = mk(0xc9402b, { roughness: 0.8 });
  const HELMET = mk(0xf2f0ea, { roughness: 0.3 });
  const SUIT   = mk(0x2b2d31, { roughness: 0.85 });

  // ---- the skinning routine -----------------------------------------------------------
  // secs: S loops of N [x,y,z] points, all the same N. Consecutive loops are joined by
  // quads. Normals are averaged for every corner shared between faces, except across a
  // loop index in creaseRows or a section index in creaseSecs, which stay hard. matOf
  // (segment, row) picks the material group of a quad. Face winding is decided by a vote
  // against each loop's centroid, so the loops may be listed in either direction.
  function loft(secs, o) {
    o = o || {};
    const S = secs.length, N = secs[0].length;
    const cr = o.creaseRows || [], cs = o.creaseSecs || [], matOf = o.matOf || (() => 0);
    const P = (s, i) => secs[s][(i + N) % N];
    const cen = (s) => { const c = [0, 0, 0]; for (const p of secs[s]) { c[0] += p[0] / N; c[1] += p[1] / N; c[2] += p[2] / N; } return c; };
    const nrm = (a, b, c) => {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      return [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    };
    const key = (s, i, sb, ib) => {
      i = (i + N) % N;
      return (cs.includes(s) ? s + (s === sb ? 'a' : 'b') : String(s)) + '/' + (cr.includes(i) ? i + (i === ib ? 'a' : 'b') : String(i));
    };
    let vote = 0;
    for (let s = 0; s < S - 1; s++) {
      const c0 = cen(s);
      for (let i = 0; i < N; i++) {
        const a = P(s, i), b = P(s, i + 1), c = P(s + 1, i), n = nrm(a, b, c);
        const mx = (a[0] + b[0] + c[0]) / 3 - c0[0], my = (a[1] + b[1] + c[1]) / 3 - c0[1], mz = (a[2] + b[2] + c[2]) / 3 - c0[2];
        vote += Math.sign(n[0] * mx + n[1] * my + n[2] * mz);
      }
    }
    const flip = vote < 0, tris = [];
    const tri = (a, ka, b, kb, c, kc, mat) => tris.push(flip ? [a, ka, c, kc, b, kb, mat] : [a, ka, b, kb, c, kc, mat]);
    for (let s = 0; s < S - 1; s++) for (let i = 0; i < N; i++) {
      const mat = matOf(s, i);
      const a = P(s, i), b = P(s, i + 1), c = P(s + 1, i), d = P(s + 1, i + 1);
      const ka = key(s, i, s, i), kb = key(s, i + 1, s, i), kc = key(s + 1, i, s, i), kd = key(s + 1, i + 1, s, i);
      tri(a, ka, b, kb, c, kc, mat); tri(b, kb, d, kd, c, kc, mat);
    }
    const cap = (s, away, mat, tag) => {
      const c0 = cen(s), c1 = cen(away), out = [c0[0] - c1[0], c0[1] - c1[1], c0[2] - c1[2]];
      for (let i = 0; i < N; i++) {
        const b = P(s, i), c = P(s, i + 1), n = nrm(c0, b, c);
        const f = (n[0] * out[0] + n[1] * out[1] + n[2] * out[2]) < 0;
        tris.push(f ? [c0, tag, c, tag, b, tag, mat] : [c0, tag, b, tag, c, tag, mat]);
      }
    };
    if (o.capFront !== undefined) cap(0, 1, o.capFront, 'cf');
    if (o.capBack !== undefined) cap(S - 1, S - 2, o.capBack, 'cb');
    tris.sort((p, q) => p[6] - q[6]);
    const n = tris.length * 3, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), acc = new Map(), fn = [];
    tris.forEach((t, ti) => {
      const nn = nrm(t[0], t[2], t[4]); const L = Math.hypot(nn[0], nn[1], nn[2]) || 1; nn[0] /= L; nn[1] /= L; nn[2] /= L; fn.push(nn);
      for (let k = 0; k < 3; k++) {
        const p = t[k * 2], kk = t[k * 2 + 1], o3 = (ti * 3 + k) * 3;
        pos[o3] = p[0]; pos[o3 + 1] = p[1]; pos[o3 + 2] = p[2];
        let a = acc.get(kk); if (!a) acc.set(kk, a = [0, 0, 0]);
        a[0] += nn[0]; a[1] += nn[1]; a[2] += nn[2];
      }
    });
    tris.forEach((t, ti) => {
      for (let k = 0; k < 3; k++) {
        const a = acc.get(t[k * 2 + 1]), L = Math.hypot(a[0], a[1], a[2]) || 1, o3 = (ti * 3 + k) * 3;
        nor[o3] = a[0] / L; nor[o3 + 1] = a[1] / L; nor[o3 + 2] = a[2] / L;
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    for (let ti = 0; ti < tris.length;) { const mat = tris[ti][6]; let e = ti; while (e < tris.length && tris[e][6] === mat) e++; geo.addGroup(ti * 3, (e - ti) * 3, mat); ti = e; }
    return geo;
  }
  const add = (parent, geo, m, x, y, z, rx, ry, rz) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0);
    if (rx || ry || rz) o.rotation.set(rx || 0, ry || 0, rz || 0);
    parent.add(o); return o;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r1, r2, h, s, open) => new THREE.CylinderGeometry(r1, r2, h, s, 1, !!open);
  const rod = (parent, p1, p2, r, m, seg) => {
    const a = new THREE.Vector3().fromArray(p1), b = new THREE.Vector3().fromArray(p2);
    const d = b.clone().sub(a); const len = d.length();
    const o = new THREE.Mesh(cyl(r, r, len, seg || 10), m);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    o.position.copy(a).add(b).multiplyScalar(0.5);
    parent.add(o); return o;
  };
  // A rectangle loop in the plane of constant `axis` (0 x, 1 y, 2 z): c is the centre,
  // e the half extents along the other two axes in ascending axis order.
  const rect = (axis, c, e) => {
    const A = [1, 2], B = [0, 2], C = [0, 1]; const [p, q] = [A, B, C][axis];
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, w]) => { const v = [0, 0, 0]; v[axis] = c[axis]; v[p] = c[p] + u * e[0]; v[q] = c[q] + w * e[1]; return v; });
  };
  // A loop of `seg` points on a circle of radius r about the given axis, at position a along it.
  const circle = (axis, a, r, seg, off) => {
    const out = [];
    for (let k = 0; k < seg; k++) {
      const t = k * 2 * PI / seg, v = [0, 0, 0]; v[axis] = a;
      v[(axis + 1) % 3] = (off ? off[0] : 0) + r * Math.cos(t); v[(axis + 2) % 3] = (off ? off[1] : 0) + r * Math.sin(t);
      out.push(v);
    }
    return out;
  };
  // A surface of revolution about `axis` from a profile of [radius, position] pairs.
  const revolve = (axis, prof, seg, off) => loft(prof.map(([r, a]) => circle(axis, a, Math.max(r, 0.0005), seg, off)));

  // ---- the hull: ten stations, twelve points each --------------------------------------
  // rows: 0 floor centre, 1 floor edge, 2 flank, 3 belt, 4 roof edge, 5 roof mid, 6 crown,
  // then 7..11 mirror rows 5..1. Bands 3-4 / 8-9 are the tumblehome (glass through the
  // cabin), bands 4..8 the top (glass at the windscreen and rear glass segments).
  const ring = (z, lo, hwLo, hwMid, yMid, hwBelt, yBelt, hwRoof, yRoof, yTop) => {
    const R = [[0, lo], [hwLo, lo], [hwMid, yMid], [hwBelt, yBelt], [hwRoof, yRoof], [hwRoof * 0.5, yRoof + (yTop - yRoof) * 0.75], [0, yTop]];
    const out = [];
    for (let i = 0; i < 7; i++) out.push([R[i][0], R[i][1], z]);
    for (let i = 5; i >= 1; i--) out.push([-R[i][0], R[i][1], z]);
    return out;
  };
  const stations = [
    [2.12,  0.59, 0.72, 0.75,  0.615, 0.75,  0.655, 0.66, 0.68,  0.70],     // nose
    [1.64,  0.59, 0.80, 0.815, 0.65,  0.80,  0.712, 0.70, 0.727, 0.752],    // front arch, front edge
    [1.275, 0.70, 0.80, 0.815, 0.71,  0.80,  0.745, 0.70, 0.762, 0.787],    // front axle
    [0.92,  0.70, 0.80, 0.815, 0.72,  0.80,  0.78,  0.70, 0.797, 0.822],    // front arch, rear edge
    [0.275, 0.70, 0.80, 0.815, 0.76,  0.795, 0.85,  0.74, 0.86,  0.885],    // scuttle
    [-0.35, 0.70, 0.80, 0.815, 0.78,  0.78,  0.92,  0.66, 1.235, 1.265],    // windscreen top
    [-0.65, 0.70, 0.80, 0.815, 0.79,  0.78,  0.925, 0.66, 1.245, 1.28],     // roof peak
    [-0.95, 0.70, 0.80, 0.815, 0.80,  0.78,  0.93,  0.65, 1.225, 1.255],    // rear glass top
    [-1.48, 0.70, 0.80, 0.815, 0.80,  0.80,  0.94,  0.73, 0.96,  0.975],    // rear glass base
    [-2.12, 0.78, 0.78, 0.79,  0.85,  0.78,  0.93,  0.71, 0.975, 0.99],     // tail, with a lip
  ];
  const hullGeo = loft(stations.map((s) => ring(...s)), {
    creaseRows: [1, 3, 4, 8, 9, 11], creaseSecs: [4, 5, 7, 8], capFront: 0, capBack: 0,
    matOf: (seg, row) => {
      const top = row >= 4 && row <= 7, side = row === 3 || row === 8;
      if (top && (seg === 4 || seg === 7)) return 1;
      if (side && seg >= 4 && seg <= 7) return 1;
      return 0;
    },
  });
  add(body, hullGeo, [PAINT, GLASS]);

  // ---- lower body: bumpers, lip, lamp band, doors, skirts, tubs, plate ------------------
  const bumper = (z, hw, top) => ring(z, 0.16, hw - 0.04, hw, 0.30, hw, top - 0.09, hw - 0.03, top - 0.012, top);
  // both ends capped: the inner end faces the wheel well and would read as a hole
  // The inner sections reach into the arch openings so the bumper meets the flare's
  // sloped face; ending them at the arch edge left a dark wedge of wheel tub showing.
  add(body, loft([bumper(1.56, 0.81, 0.585), bumper(1.95, 0.80, 0.585), bumper(2.145, 0.72, 0.585)],
                 { creaseRows: [1, 11, 4, 8], capFront: 0, capBack: 0 }), PAINT);
  add(body, loft([bumper(-1.56, 0.81, 0.70), bumper(-2.0, 0.80, 0.77), bumper(-2.21, 0.72, 0.78)],
                 { creaseRows: [1, 11, 4, 8], capFront: 0, capBack: 0 }), PAINT);
  const band = (z, hw, y0, y1) => [[hw, y0, z], [hw, y1, z], [-hw, y1, z], [-hw, y0, z]];
  const HARD = [0, 1, 2, 3];
  add(body, loft([band(1.95, 0.80, 0.14, 0.17), band(2.16, 0.76, 0.14, 0.17), band(2.225, 0.60, 0.14, 0.17)], { creaseRows: HARD, capFront: 0 }), DARK);   // splitter lip
  add(body, loft([band(2.03, 0.80, 0.575, 0.685), band(2.10, 0.74, 0.575, 0.685), band(2.16, 0.52, 0.575, 0.685)], { creaseRows: HARD, capFront: 0 }), DARK); // lamp band
  add(body, loft([band(-2.05, 0.79, 0.78, 0.94), band(-2.13, 0.76, 0.78, 0.94), band(-2.16, 0.62, 0.78, 0.94)], { creaseRows: HARD, capBack: 0 }), DARK);     // tail lamp panel
  for (const s of [-1, 1]) {
    add(body, box(0.34, 0.09, 0.03), HEAD, s * 0.31, 0.63, 2.17);                          // inner lens on the band's face
    add(body, box(0.24, 0.09, 0.03), HEAD, s * 0.63, 0.63, 2.143, 0, s * 0.27, 0);        // outer lens on the band's chamfer
    for (const x of [0.44, 0.62]) add(body, cyl(0.055, 0.055, 0.03, 24), TAIL, s * x, 0.86, -2.165, PI / 2);
    add(body, cyl(0.05, 0.05, 0.02, 20), DARK, s * 0.64, 0.30, 2.152, PI / 2);            // fog recess, proud of the bumper cap
    add(body, cyl(0.032, 0.032, 0.012, 16), HEAD, s * 0.64, 0.30, 2.166, PI / 2);
    add(body, box(0.06, 0.48, 1.80), PAINT, s * 0.76, 0.48, 0.025);                        // door, sill to the arch line
    add(body, box(0.06, 0.10, 1.78), DARK, s * 0.79, 0.19, 0.03);                          // skirt
    add(body, box(0.18, 0.04, 1.78), DARK, s * 0.71, 0.16, 0.03);
    add(body, box(0.18, 0.04, 0.46), DARK, s * 0.71, 0.16, 1.875);
    add(body, box(0.18, 0.04, 0.52), DARK, s * 0.71, 0.16, -1.89);
    for (const az of [1.275, -1.225]) {
      add(body, box(0.04, 0.50, 0.80), DARK, s * 0.57, 0.47, az);
      add(body, box(0.22, 0.50, 0.04), DARK, s * 0.68, 0.47, az + 0.40);
      add(body, box(0.22, 0.50, 0.04), DARK, s * 0.68, 0.47, az - 0.40);
    }
  }
  add(body, box(1.24, 0.04, 4.20), DARK, 0, 0.16, 0);
  add(body, box(1.10, 0.12, 0.02), DARK, 0, 0.28, 2.15);                                    // intake slot
  add(body, box(0.90, 0.06, 0.02), DARK, 0, 0.53, 2.15);                                    // mouth slot
  add(body, box(1.30, 0.10, 0.03), DARK, 0, 0.21, -2.21);                                   // diffuser
  for (const x of [-0.55, -0.20, 0.20, 0.55]) add(body, box(0.04, 0.12, 0.28), DARK, x, 0.20, -2.07);
  add(body, cyl(0.045, 0.045, 0.12, 20, true), EXH, 0.50, 0.24, -2.20, PI / 2);
  add(body, cyl(0.036, 0.036, 0.012, 20), RUB, 0.50, 0.24, -2.25, PI / 2);
  add(body, cyl(0.045, 0.036, 0.012, 20), EXH, 0.50, 0.24, -2.26, PI / 2);
  // bonnet centre bulge: a narrow loft riding the bonnet line
  const bon = (z) => 0.68 + 0.18 * c01((2.10 - z) / 1.825) + 0.025;
  const bl = (z, h) => { const y = bon(z); return [[0.25, y - 0.02, z], [0.25, y - 0.005, z], [0.12, y + h, z], [-0.12, y + h, z], [-0.25, y - 0.005, z], [-0.25, y - 0.02, z]]; };
  add(body, loft([bl(0.36, 0), bl(0.55, 0.03), bl(1.85, 0.03), bl(2.02, 0)]), PAINT);

  // ---- flares: a four-point loop swept around the arch, box outline, flat top ----------
  for (const s of [-1, 1]) for (const [az, top] of [[1.275, 0.74], [-1.225, 0.78]]) {
    const th0 = Math.atan2(-0.08, 0.50), secs = [];
    const outer = (th) => {
      const sn = Math.sin(th), cs = Math.abs(Math.cos(th)), sg = Math.sign(Math.cos(th)) || 1;
      let t = sn > 1e-6 ? (top - 0.32) / sn : 1e9;
      if (t * cs > 0.30) t = (top - 0.32 + 1.5 * (top - 0.24)) / (sn + cs * (top - 0.24) / 0.20);
      return [az + sg * t * cs, 0.32 + t * sn];
    };
    for (let k = 0; k <= 18; k++) {
      const th = th0 + (PI - 2 * th0) * k / 18, iz = az + 0.35 * Math.cos(th), iy = 0.32 + 0.35 * Math.sin(th), [oz, oy] = outer(th);
      secs.push([[s * 0.785, iy, iz], [s * 0.86, iy, iz], [s * 0.86, oy, oz], [s * 0.785, oy, oz]]);
    }
    add(body, loft(secs, { creaseRows: [0, 1, 2, 3], capFront: 0, capBack: 0 }), PAINT);
  }

  // ---- glasshouse fittings: pillars as two-section lofts, trims, mirrors ---------------
  for (const s of [-1, 1]) {
    add(body, loft([rect(1, [s * 0.775, 0.865, 0.26], [0.03, 0.05]), rect(1, [s * 0.66, 1.245, -0.36], [0.03, 0.05])], { capFront: 0, capBack: 0 }), PAINT);   // A
    add(body, loft([rect(1, [s * 0.78, 0.915, -0.825], [0.03, 0.045]), rect(1, [s * 0.663, 1.245, -0.825], [0.03, 0.045])], { capFront: 0, capBack: 0 }), PAINT); // B
    add(body, loft([[[s * 0.75, 0.925, -1.47], [s * 0.81, 0.925, -1.47], [s * 0.81, 0.925, -1.21], [s * 0.75, 0.925, -1.21]],
                    [[s * 0.633, 1.24, -0.965], [s * 0.693, 1.24, -0.965], [s * 0.693, 1.24, -0.955], [s * 0.633, 1.24, -0.955]]], { capFront: 0, capBack: 0 }), PAINT); // C
    add(body, box(0.03, 0.03, 1.66), RUB, s * 0.79, 0.935, -0.60);
    add(body, box(0.03, 0.03, 0.62), RUB, s * 0.67, 1.245, -0.65);
    rod(body, [s * 0.77, 0.94, 0.20], [s * 0.85, 0.97, 0.17], 0.02, DARK, 10);
    const head = new THREE.Group(); head.position.set(s * 0.885, 0.975, 0.16); head.rotation.y = s * 0.30; body.add(head);
    add(head, box(0.16, 0.09, 0.05), DARK);
    add(head, box(0.13, 0.07, 0.008), GALV, 0, 0, -0.027);
  }
  add(body, box(1.52, 0.03, 0.03), RUB, 0, 0.875, 0.285);
  add(body, box(1.44, 0.03, 0.03), RUB, 0, 0.965, -1.475);

  // ---- rear wing: aerofoil loops lofted across, uprights lofted with a sweep -----------
  const foil = (x) => {
    const out = [];
    for (let k = 0; k < 12; k++) {
      const t = k / 12, u = 0.5 - 0.5 * Math.cos(2 * PI * t);                // chord fraction 0..1..0
      const th = 0.017 * (1.2 * Math.sqrt(u) - 0.3 * u - 0.9 * u * u) / 0.50;  // half thickness (peak 0.017), rounded nose, sharp tail
      out.push([x, t < 0.5 ? th + 0.006 : -th * 0.9 + 0.006, 0.11 - 0.22 * u]);
    }
    return out;
  };
  add(body, loft([foil(-0.71), foil(0), foil(0.71)], { capFront: 0, capBack: 0 }), DARK, 0, 1.255, -2.0, -0.14);
  for (const s of [-1, 1]) add(body, loft([rect(1, [s * 0.45, 0.945, -1.86], [0.02, 0.08]), rect(1, [s * 0.45, 1.25, -1.98], [0.02, 0.08])], { capFront: 0, capBack: 0 }), DARK);

  // ---- interior: floor, dash, shelf, lofted bucket seats, driver, wheel, cage ----------
  add(body, box(1.40, 0.04, 1.80), DARK, 0, 0.30, -0.45);
  add(body, box(0.24, 0.14, 1.30), DARK, 0, 0.39, -0.45);
  add(body, box(1.46, 0.24, 0.36), DARK, 0, 0.72, 0.16);
  add(body, box(1.40, 0.04, 0.45), DARK, 0, 0.92, -1.26);
  for (const s of [-1, 1]) {
    const x = s * 0.36;
    add(body, loft([rect(2, [x, 0.39, -0.25], [0.22, 0.07]), rect(2, [x, 0.40, -0.75], [0.24, 0.08])], { capFront: 0, capBack: 0 }), SEAT);      // cushion
    add(body, loft([rect(1, [x, 0.44, -0.75], [0.24, 0.05]), rect(1, [x, 0.70, -0.79], [0.25, 0.05]), rect(1, [x, 0.88, -0.83], [0.19, 0.04])],
                   { capFront: 0, capBack: 0 }), SEAT);                                                                                           // backrest
    add(body, box(0.10, 0.012, 0.46), STRIPE, x, 0.475, -0.50);
    add(body, box(0.10, 0.40, 0.012), STRIPE, x, 0.66, -0.735, -0.18);
  }
  add(body, revolve(1, [[0.10, 0], [0.17, 0.05], [0.19, 0.25], [0.17, 0.38], [0.11, 0.44], [0.001, 0.47]], 14), SUIT, -0.36, 0.44, -0.55, -0.15);
  const helm = [];
  for (let k = 0; k <= 10; k++) { const t = -1.25 + (PI / 2 + 1.25) * k / 10; helm.push([0.13 * Math.cos(t), 0.13 * Math.sin(t)]); }
  add(body, revolve(1, helm, 24), HELMET, -0.36, 1.00, -0.52);
  const visor = new THREE.TorusGeometry(0.115, 0.03, 8, 14, 2.4); visor.rotateZ(PI / 2 - 1.2); visor.rotateX(PI / 2);
  add(body, visor, DARK, -0.36, 1.01, -0.52);
  for (const s of [-1, 1]) {
    rod(body, [-0.36 + s * 0.17, 0.83, -0.53], [-0.36 + s * 0.14, 0.85, -0.10], 0.035, SUIT, 10);
    add(body, revolve(1, [[0.001, -0.045], [0.032, -0.032], [0.045, 0], [0.032, 0.032], [0.001, 0.045]], 10), SUIT, -0.36 + s * 0.14, 0.85, -0.10);
  }
  const sw = new THREE.Group(); sw.position.set(-0.36, 0.84, -0.08); sw.rotation.x = -0.29; body.add(sw);
  add(sw, new THREE.TorusGeometry(0.15, 0.022, 10, 24), DARK);
  add(sw, revolve(2, [[0.12, 0], [0.045, 0.09], [0.045, 0.11], [0.001, 0.11]], 14), DARK2);
  for (const p of [[0.14, 0, 0], [-0.14, 0, 0], [0, -0.14, 0]]) rod(sw, [0, 0, 0.085], p, 0.016, DARK, 8);
  for (const s of [-1, 1]) rod(body, [s * 0.66, 0.32, -0.98], [s * 0.60, 1.12, -0.98], 0.02, DARK, 12);
  rod(body, [-0.60, 1.12, -0.98], [0.60, 1.12, -0.98], 0.02, DARK, 12);
  rod(body, [-0.62, 0.90, -0.98], [0.62, 0.90, -0.98], 0.02, DARK, 12);
  rod(body, [0.62, 0.40, -0.99], [-0.58, 1.10, -0.99], 0.02, DARK, 12);

  // ---- wheels: revolved tyre and rim shell, spokes, revolved hub and disc --------------
  function wheel(side, w) {
    const wh = new THREE.Group(), hw = w / 2;
    const rv = (prof, seg, off) => revolve(0, prof.map(([r, a]) => [r, side * a]), seg, off);   // +a outboard
    const at = (geo, m, o, y, z, rx) => {
      const mesh = new THREE.Mesh(geo, m); mesh.position.set(side * (o || 0), y || 0, z || 0);
      if (rx) mesh.rotation.x = rx; wh.add(mesh); return mesh;
    };
    at(rv([[0.235, -hw + 0.03], [0.30, -hw + 0.005], [0.32, -hw + 0.05], [0.32, hw - 0.05], [0.30, hw - 0.005], [0.235, hw - 0.03]], 40), RUB);
    at(rv([[0.245, -hw + 0.02], [0.225, -hw + 0.05], [0.225, hw - 0.07], [0.245, hw - 0.01], [0.215, hw - 0.01]], 32), BRONZ2);
    const os = hw - 0.10;
    at(rv([[0.001, os - 0.06], [0.075, os - 0.06], [0.075, os], [0.045, os], [0.045, os + 0.012], [0.001, os + 0.012]], 16), BRONZE);
    at(rv([[0.001, os + 0.012], [0.042, os + 0.012], [0.042, os + 0.018], [0.001, os + 0.018]], 12), DARK);
    for (let k = 0; k < 5; k++) {
      const a = k * PI * 2 / 5 + PI / 2;
      at(box(0.03, 0.17, 0.05), BRONZE, os - 0.015, 0.135 * Math.cos(a), 0.135 * Math.sin(a), a);
      at(rv([[0.001, os + 0.005], [0.011, os + 0.005], [0.011, os + 0.018], [0.001, os + 0.018]], 6, [0.056 * Math.cos(a), 0.056 * Math.sin(a)]), DARK);
    }
    at(rv([[0.07, -(hw - 0.08) - 0.012], [0.165, -(hw - 0.08) - 0.012], [0.165, -(hw - 0.08) + 0.012], [0.07, -(hw - 0.08) + 0.012]], 32), GALV);
    at(rv([[0.06, -(hw - 0.08)], [0.06, os - 0.06]], 12), DARK2);
    return wh;
  }
  const corner = (name, side, z, w, camberDeg) => {
    const hub = new THREE.Group(); hub.name = 'hub' + name;
    hub.position.set(side * 0.75, 0.32, z); hub.rotation.z = side * camberDeg * PI / 180;
    const wh = wheel(side, w); wh.name = 'wheel' + name; hub.add(wh);
    const cal = new THREE.Mesh(box(0.05, 0.12, 0.17), DARK); cal.position.set(side * -(w / 2 - 0.08), 0.10, 0.11); hub.add(cal);
    g.add(hub);
    return { hub, wh };
  };
  const FL = corner('FL', 1, 1.275, 0.24, 4), FR = corner('FR', -1, 1.275, 0.24, 4);
  const RL = corner('RL', 1, -1.225, 0.27, 3), RR = corner('RR', -1, -1.225, 0.27, 3);
  g.userData.joints = { hubFL: FL.hub, hubFR: FR.hub, wheelFL: FL.wh, wheelFR: FR.wh, wheelRL: RL.wh, wheelRR: RR.wh };

  // ---- ground and centre by measuring vertices, shifting the CHILDREN of g -------------
  const bb = new THREE.Box3(), v = new THREE.Vector3(), m = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const put = (mat) => { for (let i = 0; i < p.count; i++) bb.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); put(m.multiplyMatrices(n.matrixWorld, im)); } return; }
    put(n.matrixWorld);
  });
  const c = bb.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= bb.min.y; o.position.z -= c.z; });
  return g;
}
