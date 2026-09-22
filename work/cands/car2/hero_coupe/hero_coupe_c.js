// hero_coupe — arm C: a hand-built loft hull (ten 12-point stations skinned into one
// surface, the glasshouse a second material group inside the same skin) carrying every
// fitting as its own part. Bumpers, lip, lamp band, tail panel and skirts are bands
// SWEPT along a plan path so they follow the nose and tail corners; flares are a
// four-point loop swept around each arch; shut lines are thin dark strips lofted along
// the hull's own surface; tyres, rims, discs, helmet and torso are revolved loops;
// tread blocks, calipers and the binnacle hood are partial lathes.
// Nose = +Z, base y = 0. Body 1.72 W x 1.28 H x 4.45 L (mirrors stand outside the body).
//
// Moving parts: g.userData.joints = { hubFL, hubFR, wheelFL, wheelFR, wheelRL, wheelRR }.
// A hub is a Group at the wheel centre (steer about y, camber baked into rotation.z) and
// carries the brake disc and caliper; its child wheel Group (spin about x) carries the
// tyre, rim and lug nuts. Everything static is under the Group named 'body'.
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
  const CHROME = mk(0x2b2d31, { roughness: 0.25, metalness: 0.85, side: DS });         CHROME.name = 'metal';   // exhaust tips
  const RUB    = mk(0x1a1a1c, { roughness: 0.9 });
  const RUB2   = mk(0x1a1a1c, { roughness: 0.9, side: DS });
  const BRONZE = mk(0xb8843a, { roughness: 0.4, metalness: 0.25 });                    BRONZE.name = 'metal';
  const BRONZ2 = mk(0xb8843a, { roughness: 0.4, metalness: 0.25, side: DS });          BRONZ2.name = 'metal';
  const LIP    = mk(0xb8843a, { roughness: 0.18, metalness: 0.7 });                    LIP.name = 'metal';      // polished rim lip
  const GALV   = mk(0xb9bcc0, { roughness: 0.5, metalness: 0.6 });                     GALV.name = 'metal';
  const DISC   = mk(0xb9bcc0, { roughness: 0.45, metalness: 0.7 });                    DISC.name = 'metal';
  const MIRROR = mk(0xb9bcc0, { roughness: 0.12, metalness: 0.8 });                    MIRROR.name = 'metal';
  const HEAD   = mk(0xffcf7a, { roughness: 0.3, emissive: new THREE.Color(0xfff1d6), emissiveIntensity: 0.8 });
  const GAUGE  = mk(0xffcf7a, { roughness: 0.5 });
  const TAIL   = mk(0xd11c1c, { roughness: 0.4, emissive: new THREE.Color(0xd11c1c), emissiveIntensity: 1.5 });
  const SEAT   = mk(0x1a1a1c, { roughness: 0.9 });
  const VERM   = mk(0xc9402b, { roughness: 0.8 });
  const HELMET = mk(0xf2f0ea, { roughness: 0.3 });
  const SUIT   = mk(0x2b2d31, { roughness: 0.85 });

  // ---- the skinning routine (unchanged from the previous winner) ---------------------
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
    const flip = o.flip ? vote >= 0 : vote < 0, tris = [];
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

  // ---- small helpers -------------------------------------------------------------------
  const add = (parent, geo, m, x, y, z, rx, ry, rz) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0);
    if (rx || ry || rz) o.rotation.set(rx || 0, ry || 0, rz || 0);
    parent.add(o); return o;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r1, r2, h, s, open) => new THREE.CylinderGeometry(r1, r2, h, s, 1, !!open);
  const sph = (r, ws, hs) => new THREE.SphereGeometry(r, ws || 12, hs || 8);
  const hemi = (r) => new THREE.SphereGeometry(r, 8, 4, 0, PI * 2, 0, PI / 2);
  // LatheGeometry about the y axis: prof is [radius, height] pairs; ph0/phl give a partial revolve.
  const lathe = (prof, seg, ph0, phl) => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg, ph0 || 0, phl === undefined ? PI * 2 : phl);
  const rod = (parent, p1, p2, r, m, seg) => {
    const a = new THREE.Vector3().fromArray(p1), b = new THREE.Vector3().fromArray(p2);
    const d = b.clone().sub(a); const len = d.length();
    const o = new THREE.Mesh(cyl(r, r, len, seg || 12), m);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    o.position.copy(a).add(b).multiplyScalar(0.5);
    parent.add(o); return o;
  };
  // A box whose long axis runs p1 -> p2, `thick` along the surface normal n, `width` across.
  const slab = (parent, p1, p2, width, thick, m, n, extra) => {
    const a = new THREE.Vector3().fromArray(p1), b = new THREE.Vector3().fromArray(p2);
    const d = b.clone().sub(a); const len = d.length() + (extra || 0); d.normalize();
    const nn = new THREE.Vector3().fromArray(n).normalize();
    const t = new THREE.Vector3().crossVectors(d, nn).normalize();
    nn.crossVectors(t, d).normalize();
    const o = new THREE.Mesh(box(width, len, thick), m);
    o.setRotationFromMatrix(new THREE.Matrix4().makeBasis(t, d, nn));
    o.position.copy(a).add(b).multiplyScalar(0.5);
    parent.add(o); return o;
  };
  // A rectangle loop in the plane of constant `axis` (0 x, 1 y, 2 z): c is the centre,
  // e the half extents along the other two axes in ascending axis order.
  const rect = (axis, c, e) => {
    const A = [1, 2], B = [0, 2], C = [0, 1]; const [p, q] = [A, B, C][axis];
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, w]) => { const v = [0, 0, 0]; v[axis] = c[axis]; v[p] = c[p] + u * e[0]; v[q] = c[q] + w * e[1]; return v; });
  };
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
  // A band swept along a plan path. path is [[x, z], ...] in order; prof is [[n, y], ...]
  // with n <= 0 measured inward along the plan normal and y a number or a function of
  // (x, z). Every profile row is a hard crease; the band shades smoothly along the path.
  const sweep = (path, prof, o) => {
    const secs = path.map(([x, z], i) => {
      const q = path[Math.min(i + 1, path.length - 1)], p = path[Math.max(i - 1, 0)];
      let dx = q[0] - p[0], dz = q[1] - p[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      const nx = dz, nz = -dx;
      return prof.map(([n, y]) => [x + nx * n, typeof y === 'function' ? y(x, z) : y, z + nz * n]);
    });
    const rows = prof.map((_, k) => k);
    return loft(secs, Object.assign({ creaseRows: rows, capFront: 0, capBack: 0 }, o || {}));
  };
  // The nose and tail in plan: a straight middle and corners that sweep back.
  const wrapF = (x) => 0.14 * Math.pow(c01((Math.abs(x) - 0.42) / 0.38), 1.6);
  const wrapR = (x) => 0.10 * Math.pow(c01((Math.abs(x) - 0.48) / 0.32), 1.5);
  // A plan path around an end of the car: side legs at |x| = 0.815 from zs to the corner,
  // then the curved face. dir = +1 nose (z increases toward the face), -1 tail.
  const endPath = (dir, zf, zs, wrapFn) => {
    const pts = [[0.815, zs], [0.815, zf - dir * 0.20]];
    for (let k = 0; k <= 32; k++) { const x = 0.80 - 1.60 * k / 32; pts.push([x, zf - dir * wrapFn(x)]); }
    pts.push([-0.815, zf - dir * 0.20], [-0.815, zs]);
    return pts;
  };
  // The part of a path whose x lies in [xa, xb], with exact points inserted at the cuts.
  // Path x is monotonic along an endPath so the result is one contiguous run.
  const clipX = (path, xa, xb) => {
    const out = [], inside = (p) => p[0] >= xa - 1e-9 && p[0] <= xb + 1e-9;
    for (let i = 0; i < path.length; i++) {
      const p = path[i], q = path[i + 1];
      if (inside(p)) out.push(p);
      if (!q) break;
      for (const xc of [xa, xb]) {
        if ((p[0] - xc) * (q[0] - xc) < 0) { const t = (xc - p[0]) / (q[0] - p[0]); out.push([xc, lerp(p[1], q[1], t)]); }
      }
    }
    return out;
  };
  // The face point and outward yaw of a path at a given x (first crossing found).
  const faceAt = (path, x) => {
    for (let i = 0; i < path.length - 1; i++) {
      const p = path[i], q = path[i + 1];
      if ((p[0] - x) * (q[0] - x) <= 0 && p[0] !== q[0]) {
        const t = (x - p[0]) / (q[0] - p[0]);
        const dx = q[0] - p[0], dz = q[1] - p[1];
        return { x, z: lerp(p[1], q[1], t), yaw: Math.atan2(dz, -dx) };
      }
    }
    return { x, z: path[0][1], yaw: 0 };
  };

  const nose = endPath(1, 2.16, 1.56, wrapF);
  const F = (v) => (typeof v === 'function' ? v : () => v);
  // a band profile with a chamfered top edge: outer face from y0 to y1 - ch, then in and up
  const bandProf = (y0, y1, t, ch) => { const Y0 = F(y0), Y1 = F(y1); return [[0, Y0], [0, (x, z) => Y1(x, z) - ch], [-ch * 0.8, Y1], [-t, Y1], [-t, Y0]]; };
  const plainProf = (y0, y1, t, n0) => [[n0 || 0, y0], [n0 || 0, y1], [-t, y1], [-t, y0]];
  // a small box tangent to a swept face at x, its back sunk into the face
  const onFace = (path, x, y, w, h, d, m, proud, ry) => {
    const f = faceAt(path, x), grp = new THREE.Group();
    grp.position.set(f.x, y, f.z); grp.rotation.y = f.yaw + (ry || 0); body.add(grp);
    add(grp, box(w, h, d), m, 0, 0, (proud || 0) + d / 2 - d);
    return grp;
  };
  const tail = endPath(-1, -2.19, -1.56, wrapR).reverse();
  // the part of a tail path at or behind z = zl, with exact points inserted at the cuts
  const clipZ = (path, zl) => { const out = []; for (let i = 0; i < path.length; i++) { const p = path[i], q = path[i + 1]; if (p[1] <= zl + 1e-9) out.push(p); if (q && (p[1] - zl) * (q[1] - zl) < 0) { const t = (zl - p[1]) / (q[1] - p[1]); out.push([lerp(p[0], q[0], t), zl]); } } return out; };                                        // reversed so the swept normal faces out

  // ---- the hull: ten stations, twelve points each --------------------------------------
  // rows: 0 floor centre, 1 floor edge, 2 flank, 3 belt, 4 roof edge, 5-7 crown, 8 crown centre,
  // then 9..15 mirror rows 7..1. Bands 3 / 12 are the tumblehome (glass through the cabin),
  // bands 4..11 the top (glass at the windscreen and rear glass segments).
  const ring = (z, lo, hwLo, hwMid, yMid, hwBelt, yBelt, hwRoof, yRoof, yTop) => {
    const R = [[0, lo], [hwLo, lo], [hwMid, yMid], [hwBelt, yBelt], [hwRoof, yRoof]];
    for (let k = 1; k <= 4; k++) { const x = hwRoof * (1 - k / 4); R.push([x, yRoof + (yTop - yRoof) * (1 - Math.pow(x / hwRoof, 2))]); }   // crown: a parabola, four segments a side
    const out = [];
    for (let i = 0; i < R.length; i++) out.push([R[i][0], R[i][1], z]);
    for (let i = R.length - 2; i >= 1; i--) out.push([-R[i][0], R[i][1], z]);
    return out;
  };
  const stations = [
    [2.12,  0.59, 0.72, 0.75,  0.615, 0.75,  0.655, 0.66, 0.686, 0.698],    // nose
    [1.64,  0.59, 0.80, 0.815, 0.65,  0.80,  0.712, 0.70, 0.733, 0.746],    // front arch, front edge
    [1.275, 0.70, 0.80, 0.815, 0.71,  0.80,  0.745, 0.70, 0.768, 0.781],    // front axle
    [0.92,  0.70, 0.80, 0.815, 0.72,  0.80,  0.78,  0.70, 0.803, 0.816],    // front arch, rear edge
    [0.275, 0.70, 0.80, 0.815, 0.76,  0.795, 0.85,  0.74, 0.866, 0.88],     // scuttle
    [-0.35, 0.70, 0.80, 0.815, 0.78,  0.78,  0.895, 0.60, 1.235, 1.265],    // windscreen top
    [-0.65, 0.70, 0.80, 0.815, 0.79,  0.78,  0.905, 0.60, 1.245, 1.28],     // roof peak
    [-0.95, 0.70, 0.80, 0.815, 0.80,  0.78,  0.912, 0.59, 1.225, 1.255],    // rear glass top
    [-1.48, 0.70, 0.80, 0.815, 0.80,  0.80,  0.915, 0.70, 0.94,  0.952],    // rear glass base
    [-2.12, 0.78, 0.78, 0.79,  0.85,  0.78,  0.905, 0.71, 0.915, 0.93],     // tail, deck lowered
  ];
  const rings = stations.map((s) => ring(...s));
  add(body, loft(rings, {
    creaseRows: [1, 3, 4, 12, 13, 15], creaseSecs: [4, 5, 7, 8], capFront: 0, capBack: 0,
    matOf: (seg, row) => {
      const top = row >= 4 && row <= 11, side = row === 3 || row === 12;
      if (top && (seg === 4 || seg === 7)) return 1;
      if (side && seg >= 4 && seg <= 7) return 1;
      return 0;
    },
  }), [PAINT, GLASS]);

  // ---- reading the hull's own surface, so fittings sit ON it ---------------------------
  const ringAt = (z) => {
    let i = 0; while (i < rings.length - 2 && z < rings[i + 1][0][2]) i++;
    const a = rings[i], b = rings[i + 1], t = c01((a[0][2] - z) / (a[0][2] - b[0][2]));
    return a.map((p, k) => [lerp(p[0], b[k][0], t), lerp(p[1], b[k][1], t), z]);
  };
  // height of the top skin at (x, z): belt(+x), roof edge, crown points, roof edge, belt(-x)
  const topY = (x, z) => {
    const r = ringAt(z), pts = r.slice(3, 14);
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      if (x <= a[0] + 1e-9 && x >= b[0] - 1e-9) return lerp(a[1], b[1], (a[0] - x) / ((a[0] - b[0]) || 1e-9));
    }
    return r[6][1];
  };
  // x of the flank skin at (y, z) on side s: floor edge, flank, belt, roof edge
  const flankX = (s, y, z) => {
    const r = ringAt(z), pts = [r[1], r[2], r[3], r[4]];
    for (let k = 0; k < 3; k++) {
      const a = pts[k], b = pts[k + 1];
      if (y >= a[1] - 1e-9 && y <= b[1] + 1e-9) return s * lerp(a[0], b[0], (y - a[1]) / ((b[1] - a[1]) || 1e-9));
    }
    return s * (y < pts[0][1] ? pts[0][0] : pts[3][0]);
  };
  const linePts = (a, b, n) => { const out = []; for (let k = 0; k <= n; k++) out.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]); return out; };
  // A shut line: a dark strip w wide, sunk 0.006 and proud 0.002, lofted along [x, z]
  // points on the top skin. Sample enough points that it follows the crown.
  const topStrip = (pts, w, m) => {
    const secs = pts.map(([x, z], i) => {
      const y = topY(x, z), q = pts[Math.min(i + 1, pts.length - 1)], p = pts[Math.max(i - 1, 0)];
      let dx = q[0] - p[0], dz = q[1] - p[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      const nx = dz * w / 2, nz = -dx * w / 2;
      return [[x - nx, y - 0.006, z - nz], [x + nx, y - 0.006, z + nz], [x + nx, y + 0.002, z + nz], [x - nx, y + 0.002, z - nz]];
    });
    return add(body, loft(secs, { creaseRows: [0, 1, 2, 3], capFront: 0, capBack: 0 }), m || DARK);
  };
  // The same along [y, z] points on the flank of side s.
  const flankStrip = (s, pts, w, m) => {
    const secs = pts.map(([y, z], i) => {
      const x = flankX(s, y, z), q = pts[Math.min(i + 1, pts.length - 1)], p = pts[Math.max(i - 1, 0)];
      let dy = q[0] - p[0], dz = q[1] - p[1]; const L = Math.hypot(dy, dz) || 1; dy /= L; dz /= L;
      const ny = dz * w / 2, nz = -dy * w / 2, o = s * 0.002, i2 = -s * 0.006;
      return [[x + i2, y - ny, z - nz], [x + i2, y + ny, z + nz], [x + o, y + ny, z + nz], [x + o, y - ny, z - nz]];
    });
    return add(body, loft(secs, { creaseRows: [0, 1, 2, 3], capFront: 0, capBack: 0 }), m || DARK);
  };
  // A raised panel on the top skin over x0..x1, z0..z1, h proud, following the crown.
  const topPanel = (x0, x1, z0, z1, h, m, nz) => {
    const secs = [];
    for (let k = 0; k <= (nz || 4); k++) {
      const z = lerp(z0, z1, k / (nz || 4)), lo = [], hi = [];
      for (let j = 0; j <= 4; j++) { const x = lerp(x0, x1, j / 4), y = topY(x, z); lo.push([x, y - 0.01, z]); hi.push([x, y + h, z]); }
      secs.push(lo.concat(hi.reverse()));
    }
    return add(body, loft(secs, { creaseRows: [0, 4, 5, 9], capFront: 0, capBack: 0 }), m || PAINT);
  };

  // ---- panel map: shut lines, pop-up lids, bulge, vents, roof furniture ---------------
  for (const s of [-1, 1]) {
    topStrip(linePts([s * 0.60, 0.34], [s * 0.60, 1.74], 8), 0.010);                          // bonnet edges
    topPanel(s * 0.30, s * 0.62, 1.79, 2.05, 0.003, PAINT, 3);                                 // pop-up lamp lid, closed
    const lid = [[s * 0.30, 1.79], [s * 0.62, 1.79], [s * 0.62, 2.05], [s * 0.30, 2.05], [s * 0.30, 1.79]];
    for (let k = 0; k < 4; k++) topStrip(linePts(lid[k], lid[k + 1], 4), 0.010);
    topStrip(linePts([s * 0.60, -1.52], [s * 0.60, -2.13], 7), 0.010);                        // boot edges, run out through the ducktail
    flankStrip(s, linePts([0.25, 0.42], [0.80, 0.42], 6), 0.010);                             // door front edge
    flankStrip(s, linePts([0.25, -0.93], [0.80, -0.93], 6), 0.010);                           // door rear edge
  }
  topStrip(linePts([-0.60, 1.74], [0.60, 1.74], 12), 0.010);                                  // bonnet front edge
  topStrip(linePts([-0.60, 0.34], [0.60, 0.34], 12), 0.010);                                  // bonnet rear edge (scuttle)
  topStrip(linePts([-0.60, -1.52], [0.60, -1.52], 12), 0.010);                                // boot front edge
  {                                                                                            // bonnet bulge, riding the crown
    const secs = [];
    for (let k = 0; k <= 8; k++) {
      const z = lerp(0.50, 1.72, k / 8), e = Math.sin(PI * k / 8), h = 0.03 * Math.pow(e, 0.6);
      const y = (x) => topY(x, z);
      secs.push([[0.25, y(0.25) - 0.012, z], [0.25, y(0.25) + 0.002, z], [0.13, y(0.13) + h, z], [-0.13, y(-0.13) + h, z], [-0.25, y(-0.25) + 0.002, z], [-0.25, y(-0.25) - 0.012, z]]);
    }
    add(body, loft(secs, { creaseRows: [0, 1, 4, 5] }), PAINT);
  }
  {                                                                                            // ducktail: the boot lid trailing edge kicks up
    const secs = [];
    for (let k = 0; k <= 7; k++) {
      const z = lerp(-1.90, -2.19, k / 7), h = 0.04 * Math.pow(c01((-1.90 - z) / 0.29), 1.6), lo = [], hi = [];
      for (let j = 0; j <= 6; j++) { const x = lerp(-0.58, 0.58, j / 6), y = topY(x, z); lo.push([x, y - 0.012, z]); hi.push([x, y + h + 0.002, z]); }
      secs.push(lo.concat(hi.reverse()));
    }
    add(body, loft(secs, { creaseRows: [0, 6, 7, 13], capBack: 0 }), PAINT);
  }


  const topF = (x, z) => lerp(0.605, 0.648, c01((1.96 - z) / 0.40));         // the hull floor rises over the arch
  add(body, sweep(nose, bandProf(0.38, topF, 0.10, 0.05)), PAINT);                                 // upper bumper
  add(body, sweep(nose, plainProf(0.16, 0.21, 0.10)), PAINT);                                     // lower bumper band
  add(body, sweep(clipX(nose, 0.58, 0.815), plainProf(0.19, 0.40, 0.10)), PAINT);                    // pillar beside the opening
  add(body, sweep(clipX(nose, -0.815, -0.58), plainProf(0.19, 0.40, 0.10)), PAINT);
  add(body, sweep(clipX(nose, -0.80, 0.80), plainProf(0.135, 0.168, 0.10, 0.055)), DARK);          // splitter lip, proud of the face
  add(body, sweep(clipX(nose, -0.80, 0.80), plainProf(0.585, 0.665, 0.10, 0.012)), DARK);           // lamp band
  const topR = (x, z) => lerp(0.725, 0.80, c01((-1.60 - z) / 0.59));
  add(body, sweep(tail, [[0, 0.46], [0.012, 0.52], [0.004, topR], [-0.10, topR], [-0.10, 0.46]]), PAINT);   // rear bumper face, 0.34 tall with a soft crease
  add(body, sweep(clipZ(tail, -1.86), [[0.0, 0.80], [0.014, 0.812], [0.014, 0.928], [0.0, 0.94], [-0.08, 0.94], [-0.08, 0.80]]), DARK);   // garnish, 0.14 tall, chamfered, wrapping into the quarters
  add(body, sweep(tail, plainProf(0.17, 0.47, 0.10, 0.006)), DARK);                                  // lower valance, wraps the corners
  // rear wing: aerofoil lofted across, swept uprights, end plates, high-mount brake lamp
  const foil = (x) => {
    const out = [];
    for (let k = 0; k < 14; k++) {
      const t = k / 14, u = 0.5 - 0.5 * Math.cos(2 * PI * t);
      const th = 0.011 * (1.2 * Math.sqrt(u) - 0.3 * u - 0.9 * u * u) / 0.50;
      out.push([x, t < 0.5 ? th + 0.006 : -th * 0.9 + 0.006, 0.11 - 0.22 * u]);
    }
    return out;
  };
  add(body, loft([foil(-0.71), foil(-0.30), foil(0.30), foil(0.71)], { capFront: 0, capBack: 0 }), DARK, 0, 1.235, -2.02, 0.10);
  for (const s of [-1, 1]) add(body, loft([rect(1, [s * 0.45, 0.905, -1.83], [0.018, 0.09]), rect(1, [s * 0.45, 1.08, -1.92], [0.018, 0.075]), rect(1, [s * 0.45, 1.232, -2.01], [0.018, 0.06])], { capFront: 0, capBack: 0 }), DARK);   // taller swept uprights
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
      const ox = az > 0 ? 0.875 : 0.89;
      secs.push([[s * 0.785, iy, iz], [s * ox, iy, iz], [s * ox, oy, oz], [s * 0.785, oy, oz]]);
    }
    add(body, loft(secs, { creaseRows: [0, 1, 2, 3], capFront: 0, capBack: 0 }), PAINT);
  }
  for (const s of [-1, 1]) {
    add(body, loft([rect(1, [s * 0.775, 0.865, 0.26], [0.03, 0.05]), rect(1, [s * 0.60, 1.245, -0.36], [0.03, 0.05])], { capFront: 0, capBack: 0 }), PAINT);   // A pillar
    add(body, loft([rect(1, [s * 0.78, 0.905, -0.825], [0.03, 0.045]), rect(1, [s * 0.603, 1.245, -0.825], [0.03, 0.045])], { capFront: 0, capBack: 0 }), PAINT); // B pillar
    add(body, loft([[[s * 0.75, 0.915, -1.47], [s * 0.81, 0.915, -1.47], [s * 0.81, 0.915, -1.21], [s * 0.75, 0.915, -1.21]],
                    [[s * 0.573, 1.24, -0.965], [s * 0.633, 1.24, -0.965], [s * 0.633, 1.24, -0.955], [s * 0.573, 1.24, -0.955]]], { capFront: 0, capBack: 0 }), PAINT); // C pillar
  }

  // ---- shared fittings: everything below is the same in all three candidates ------------
  const POLISH = mk(0xb9bcc0, { roughness: 0.2, metalness: 0.8 });                                POLISH.name = 'metal';
  const LANE   = mk(0xe8e4da, { roughness: 0.4, emissive: new THREE.Color(0xe8e4da), emissiveIntensity: 0.5 });
  const REFL   = mk(0xd11c1c, { roughness: 0.4, emissive: new THREE.Color(0xd11c1c), emissiveIntensity: 0.6 });
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {                                                              // bonnet louvres, three per side
      const z = 1.14 + 0.17 * k, x = s * 0.40, y = topY(x, z);
      add(body, box(0.17, 0.012, 0.038), DARK, x, y + 0.002, z, 0.10);
      add(body, box(0.17, 0.006, 0.014), PAINT, x, y + 0.009, z + 0.016, 0.10);                // the louvre's raised lip
    }
    const hx = flankX(s, 0.72, -0.62);                                                         // door handle, flush
    add(body, box(0.006, 0.05, 0.16), DARK, hx + s * 0.003, 0.72, -0.62);
    add(body, box(0.014, 0.028, 0.12), DARK, hx + s * 0.010, 0.725, -0.62);
    add(body, box(0.012, 0.035, 0.09), TAIL, s * 0.832, 0.60, -1.86);                          // rear side marker
  }
  add(body, box(1.10, 0.028, 0.10), PAINT, 0, 1.236, -0.995, 0.34);                            // roof spoiler lip, trailing edge up
  add(body, box(1.10, 0.012, 0.04), DARK, 0, 1.243, -1.03, 0.34);                              // its rubber edge
  add(body, cyl(0.022, 0.026, 0.024, 12), DARK, 0.50, topY(0.50, -0.88) + 0.008, -0.88);      // antenna base
  add(body, cyl(0.007, 0.011, 0.09, 8), RUB, 0.50, topY(0.50, -0.88) + 0.048, -0.90, -0.45);   // rubber mast, raked back
  {                                                                                            // fuel filler on the left rear quarter
    const fx = flankX(1, 0.80, -1.72);
    add(body, new THREE.TorusGeometry(0.055, 0.009, 8, 24), DARK, fx + 0.004, 0.80, -1.72, 0, PI / 2, 0);
    add(body, cyl(0.048, 0.048, 0.008, 24), DARK, fx + 0.006, 0.80, -1.72, 0, 0, PI / 2);
  }

  // ---- front end: bands swept round the nose, a real opening with the intercooler in it ----
  add(body, box(1.20, 0.19, 0.10), DARK, 0, 0.295, 1.955);                                           // intercooler core
  for (let k = 0; k < 12; k++) add(body, box(1.12, 0.007, 0.05), GALV, 0, 0.215 + k * 0.0145, 1.985); // its fins
  for (const s of [-1, 1]) {
    add(body, box(0.07, 0.21, 0.11), DARK, s * 0.635, 0.295, 1.955);                                   // intercooler end tanks
    add(body, new THREE.TorusGeometry(0.05, 0.022, 8, 12, PI / 2), DARK, s * 0.69, 0.35, 1.90, 0, s * PI / 2, 0);   // charge pipe elbows
    add(body, cyl(0.02, 0.02, 0.03, 16), DARK, s * 0.62, 0.185, 2.15, PI / 2);                     // brake duct in the lower band
  }
  add(body, box(1.40, 0.34, 0.02), DARK, 0, 0.31, 1.88);                                            // closes the bay behind it
  add(body, box(0.90, 0.05, 0.02), DARK, 0, 0.535, 2.155);                                          // mouth slot on the upper band
  for (const s of [-1, 1]) {
    const f = faceAt(nose, s * 0.69), fog = new THREE.Group();                                     // fog lamp in a cup
    fog.position.set(f.x, 0.295, f.z); fog.rotation.y = f.yaw; body.add(fog);
    add(fog, cyl(0.05, 0.05, 0.04, 28), DARK, 0, 0, -0.006, PI / 2);
    add(fog, cyl(0.038, 0.038, 0.012, 20), HEAD, 0, 0, 0.018, PI / 2);
    add(fog, new THREE.TorusGeometry(0.044, 0.005, 6, 24), DARK, 0, 0, 0.016);
    const c = faceAt(nose, s * 0.70), can = new THREE.Group();                                      // canard at the corner
    can.position.set(c.x, 0.245, c.z - 0.03); can.rotation.set(-0.32, c.yaw, 0, 'YXZ'); body.add(can);
    add(can, box(0.13, 0.005, 0.16), DARK, 0, 0, 0.06);
    add(can, box(0.005, 0.035, 0.16), DARK, s * 0.065, 0.018, 0.06);                                   // its little end plate
    onFace(nose, s * 0.31, 0.625, 0.34, 0.06, 0.024, HEAD, 0.028);                                 // inner headlamp lens
    onFace(nose, s * 0.545, 0.625, 0.13, 0.06, 0.024, HEAD, 0.028);                                // outer lens pair, following the corner
    onFace(nose, s * 0.685, 0.625, 0.12, 0.06, 0.024, HEAD, 0.028);
  }
  {                                                                                                  // tow hook, low on the right
    const f = faceAt(nose, -0.56), hook = new THREE.Group();
    hook.position.set(f.x, 0.20, f.z); hook.rotation.y = f.yaw; body.add(hook);
    add(hook, box(0.03, 0.03, 0.10), VERM, 0, 0, 0.0);
    add(hook, new THREE.TorusGeometry(0.036, 0.011, 8, 18), VERM, 0, 0, 0.055);
  }

  // ---- rear end: bumper, tail panel, four round lamps, garnish, diffuser, tips, flaps ------
  for (const x of [-0.62, -0.44, 0.44, 0.62]) {
    const f = faceAt(tail, x), lamp = new THREE.Group();
    lamp.position.set(f.x, 0.87, f.z); lamp.rotation.y = f.yaw; body.add(lamp);
    add(lamp, new THREE.CylinderGeometry(0.06, 0.06, 0.024, 32, 1, true), DARK2, 0, 0, 0.026, PI / 2);   // cup, open, the lamp sits down inside it
    add(lamp, cyl(0.048, 0.048, 0.01, 32), TAIL, 0, 0, 0.019, PI / 2);                              // lens, sunk below the rim
    add(lamp, new THREE.TorusGeometry(0.06, 0.004, 8, 32), POLISH, 0, 0, 0.038);                     // polished rim ring
    add(lamp, new THREE.TorusGeometry(0.024, 0.0035, 6, 24), LANE, 0, 0, 0.025);                      // white inner ring
  }
  {                                                                                                  // number-plate pocket: proud rim, blank plate, lamp above
    const zf = -2.19;
    for (const [w, h, x, y] of [[0.36, 0.015, 0, 0.7575], [0.36, 0.015, 0, 0.5725], [0.015, 0.20, -0.1725, 0.665], [0.015, 0.20, 0.1725, 0.665]]) add(body, box(w, h, 0.03), DARK, x, y, zf - 0.008);
    add(body, box(0.33, 0.17, 0.006), LANE, 0, 0.665, zf - 0.011);                                   // blank plate, just inside the rim
    add(body, box(0.08, 0.018, 0.04), DARK, 0, 0.787, zf - 0.012);                                   // plate lamp housing under the garnish
    add(body, box(0.05, 0.008, 0.01), HEAD, 0, 0.78, zf - 0.033);
  }
  for (const s of [-1, 1]) onFace(tail, s * 0.70, 0.63, 0.028, 0.24, 0.02, REFL, 0.014);             // vertical corner reflector strips
  for (const x of [0.36, 0.48]) {
    add(body, cyl(0.045, 0.045, 0.16, 28, true), CHROME, x, 0.29, -2.16, PI / 2);                      // twin tips, left side, hollow
    add(body, cyl(0.03, 0.03, 0.16, 20), DARK, x, 0.29, -2.14, PI / 2);                            // the dark inner pipe seen down the tip
  }
  add(body, box(1.30, 0.05, 0.42), DARK, 0, 0.155, -2.00);                                           // diffuser plate
  for (const x of [-0.60, -0.30, 0, 0.30, 0.60]) add(body, box(0.012, 0.10, 0.30), DARK, x, 0.13, -1.95);   // five fins, set back
  for (const s of [-1, 1]) add(body, box(0.22, 0.22, 0.016), RUB2, s * 0.75, 0.21, -1.60);           // mud flaps
  for (const s of [-1, 1]) {
    add(body, box(0.008, 0.09, 0.26), DARK, s * 0.714, 1.24, -2.02, 0.10);                           // end plate
  }
  add(body, box(0.24, 0.018, 0.03), TAIL, 0, 1.243, -2.115, 0.10);                                   // high-mount brake lamp
  add(body, box(1.40, 0.016, 0.010), DARK, 0, 1.249, -2.126, 0.10);                                  // gurney flap on the trailing edge
  add(body, box(0.42, 0.14, 0.44), DARK, 0.44, 0.23, -1.66);                                         // muffler, seen under the rear bumper
  rod(body, [0.44, 0.23, -1.88], [0.44, 0.27, -2.12], 0.03, DARK, 10);                               // tailpipe into the tips
  for (const s of [-1, 1]) {                                                                         // bonnet pins at the front corners
    add(body, cyl(0.02, 0.02, 0.01, 12), DARK, s * 0.50, topY(s * 0.50, 1.68) + 0.004, 1.68);
    add(body, cyl(0.007, 0.007, 0.02, 8), GALV, s * 0.50, topY(s * 0.50, 1.68) + 0.014, 1.68);
  }

  // ---- flanks: skirts, tubs, plate, flares with rivets, pillars, trims, mirrors -------------
  for (const s of [-1, 1]) {
    add(body, box(0.07, 0.50, 1.80), PAINT, s * 0.765, 0.47, 0.02);                                  // door skin, sill to the hull's floor line
    add(body, box(0.06, 0.10, 1.78), DARK, s * 0.79, 0.19, 0.03);                                    // skirt blade
    add(body, box(0.11, 0.035, 1.78), DARK, s * 0.805, 0.152, 0.03);                                 // its step
    add(body, box(0.18, 0.04, 1.78), DARK, s * 0.71, 0.16, 0.03);
    add(body, box(0.18, 0.04, 0.46), DARK, s * 0.71, 0.16, 1.875);
    add(body, box(0.18, 0.04, 0.52), DARK, s * 0.71, 0.16, -1.89);
    for (const az of [1.275, -1.225]) {                                                              // wheel tubs
      add(body, box(0.04, 0.50, 0.80), DARK, s * 0.57, 0.47, az);
      const hf = az > 0 ? 0.44 : 0.50, hr = az > 0 ? 0.49 : 0.50;
      add(body, box(0.22, hf, 0.04), DARK, s * 0.68, 0.22 + hf / 2, az + 0.40);
      add(body, box(0.22, hr, 0.04), DARK, s * 0.68, 0.22 + hr / 2, az - 0.40);
    }
  }
  add(body, box(1.24, 0.04, 4.20), DARK, 0, 0.16, 0);                                                // underbody plate
  for (const s of [-1, 1]) for (const az of [1.275, -1.225]) for (let k = 0; k < 8; k++) {                                                                    // rivet row on the flare face
      const th = (20 + 140 * k / 7) * PI / 180;
      add(body, new THREE.SphereGeometry(0.014, 10, 5, 0, PI * 2, 0, PI / 2), DARK, s * (az > 0 ? 0.875 : 0.89), 0.32 + 0.39 * Math.sin(th), az + 0.39 * Math.cos(th), 0, 0, -s * PI / 2);
    }
  for (const s of [-1, 1]) {
    add(body, box(0.03, 0.03, 1.66), RUB, s * 0.79, 0.905, -0.60);                                   // belt trim
    add(body, box(0.03, 0.03, 0.62), RUB, s * 0.61, 1.245, -0.65);                                   // drip rail
    add(body, box(0.024, 0.024, 0.34), RUB, s * 0.79, 0.912, -1.24);                                 // quarter window lower trim
    rod(body, [s * 0.77, 0.94, 0.20], [s * 0.85, 0.97, 0.17], 0.022, DARK, 10);                      // mirror stalk
    const head = new THREE.Group(); head.position.set(s * 0.885, 0.975, 0.16); head.rotation.y = s * 0.30; body.add(head);
    const shell = add(head, sph(1, 20, 12), DARK); shell.scale.set(0.088, 0.048, 0.062);
    add(head, box(0.13, 0.066, 0.008), MIRROR, 0, 0, -0.052);                                        // mirror face
  }
  add(body, box(1.52, 0.03, 0.03), RUB, 0, 0.875, 0.285);                                            // windscreen base trim
  add(body, box(1.40, 0.03, 0.03), RUB, 0, 0.945, -1.475);                                           // rear glass base trim
  for (const s of [-1, 1]) add(body, box(0.50, 0.014, 0.022), DARK, s * 0.30, 0.914, 0.22, 0.546, s * 0.30, 0);   // wipers, parked on the glass

  // ---- interior: dash, binnacle, gauges, seats, harness, cage, driver, wheel, shifter ------
  add(body, box(1.40, 0.04, 1.80), DARK, 0, 0.30, -0.45);                                            // floor
  add(body, box(0.24, 0.14, 1.30), DARK, 0, 0.39, -0.45);                                            // tunnel
  add(body, box(1.46, 0.24, 0.36), DARK, 0, 0.72, 0.16);                                             // dashboard
  add(body, box(1.46, 0.05, 0.22), DARK, 0, 0.855, 0.18);                                            // its upper pad
  add(body, box(1.40, 0.04, 0.45), DARK, 0, 0.90, -1.26);                                            // parcel shelf
  add(body, new THREE.CylinderGeometry(0.095, 0.095, 0.30, 12, 1, true, 0, PI), DARK2, -0.36, 0.86, 0.10, 0, 0, PI / 2);   // binnacle hood
  {
    const gz = new THREE.Group(); gz.position.set(-0.36, 0.87, 0.11); gz.rotation.x = -PI / 2 + 0.28; body.add(gz);      // gauges face the driver
    for (const dx of [-0.085, 0, 0.085]) {
      add(gz, cyl(0.036, 0.036, 0.03, 18), DARK, dx, 0, 0);
      add(gz, cyl(0.029, 0.029, 0.008, 18), GAUGE, dx, 0.016, 0);
      add(gz, box(0.004, 0.006, 0.026), DARK, dx, 0.022, 0.003);                                     // needle
    }
  }
  add(body, cyl(0.045, 0.055, 0.05, 12), DARK, -0.05, 0.47, -0.30);                                  // shifter boot
  rod(body, [-0.05, 0.48, -0.30], [-0.04, 0.64, -0.27], 0.012, DARK, 10);
  add(body, sph(0.03, 12, 8), GALV, -0.04, 0.655, -0.265);                                           // shift knob
  rod(body, [-0.05, 0.46, -0.48], [-0.05, 0.60, -0.62], 0.012, DARK, 8);                            // handbrake lever
  add(body, sph(0.022, 10, 6), DARK, -0.05, 0.61, -0.63);
  for (const px of [-0.46, -0.36, -0.26]) add(body, box(0.06, 0.07, 0.012), DARK, px, 0.40, 0.02, -0.6);   // pedals
  add(body, cyl(0.045, 0.045, 0.26, 12), VERM, 0.38, 0.365, 0.05, 0, 0, PI / 2);                    // fire extinguisher on the passenger floor
  add(body, cyl(0.016, 0.02, 0.05, 8), DARK, 0.53, 0.365, 0.05, 0, 0, PI / 2);
  for (const s of [-1, 1]) {
    const x = s * 0.36;
    add(body, loft([rect(2, [x, 0.39, -0.25], [0.22, 0.07]), rect(2, [x, 0.40, -0.75], [0.24, 0.08])], { capFront: 0, capBack: 0 }), SEAT);      // cushion
    add(body, loft([rect(1, [x, 0.44, -0.75], [0.24, 0.05]), rect(1, [x, 0.70, -0.79], [0.25, 0.05]), rect(1, [x, 0.88, -0.83], [0.19, 0.04])],
                   { capFront: 0, capBack: 0 }), SEAT);                                                                                           // backrest
    for (const b of [-1, 1]) {
      add(body, box(0.07, 0.11, 0.42), SEAT, x + b * 0.215, 0.475, -0.50);                            // cushion bolsters
      add(body, box(0.07, 0.34, 0.11), SEAT, x + b * 0.21, 0.66, -0.735, -0.18);                     // backrest bolsters
    }
    add(body, box(0.10, 0.012, 0.46), VERM, x, 0.475, -0.50);                                        // stripe
    add(body, box(0.10, 0.40, 0.012), VERM, x, 0.66, -0.735, -0.18);
    if (s > 0) {                                                                                     // passenger harness lies on the seat
      for (const b of [-1, 1]) {
        slab(body, [x + b * 0.07, 0.87, -0.815], [x + b * 0.07, 0.47, -0.705], 0.05, 0.008, VERM, [0, 0.2, 1]);
        slab(body, [x + b * 0.07, 0.49, -0.70], [x + b * 0.08, 0.47, -0.40], 0.05, 0.008, VERM, [0, 1, 0]);
        slab(body, [x + b * 0.21, 0.50, -0.56], [x + b * 0.03, 0.49, -0.40], 0.045, 0.008, VERM, [0, 1, 0]);   // lap straps
      }
      add(body, box(0.06, 0.025, 0.05), DARK, x, 0.50, -0.39);                                       // buckle
    }
  }
  // driver: torso (revolved, flattened front to back), helmet, visor band, arms, gloves
  const torso = add(body, revolve(1, [[0.10, 0], [0.17, 0.05], [0.19, 0.25], [0.17, 0.38], [0.11, 0.44], [0.001, 0.47]], 16), SUIT, -0.36, 0.44, -0.55, -0.15);
  torso.scale.z = 0.68;
  for (const b of [-1, 1]) {                                                                         // driver harness over the chest
    slab(body, [-0.36 + b * 0.07, 0.87, -0.455], [-0.36 + b * 0.08, 0.50, -0.385], 0.05, 0.008, VERM, [0, 0.2, 1]);
    slab(body, [-0.36 + b * 0.21, 0.50, -0.56], [-0.36 + b * 0.03, 0.50, -0.39], 0.045, 0.008, VERM, [0, 1, 0]);
  }
  add(body, box(0.06, 0.025, 0.05), DARK, -0.36, 0.505, -0.385);
  const helm = [];
  for (let k = 0; k <= 12; k++) { const t = -1.25 + (PI / 2 + 1.25) * k / 12; helm.push([0.13 * Math.cos(t), 0.13 * Math.sin(t)]); }
  add(body, revolve(1, helm, 32), HELMET, -0.36, 1.00, -0.52);
  const visor = new THREE.TorusGeometry(0.118, 0.032, 10, 24, 2.4); visor.rotateZ(PI / 2 - 1.2); visor.rotateX(PI / 2);
  add(body, visor, DARK, -0.36, 1.01, -0.52);
  for (const b of [-1, 1]) {
    rod(body, [-0.36 + b * 0.17, 0.83, -0.53], [-0.36 + b * 0.14, 0.85, -0.10], 0.035, SUIT, 10);
    add(body, sph(0.045, 12, 8), DARK, -0.36 + b * 0.14, 0.85, -0.10);                              // gloved hands
  }
  const sw = new THREE.Group(); sw.position.set(-0.36, 0.84, -0.08); sw.rotation.x = -0.29; body.add(sw);
  add(sw, new THREE.TorusGeometry(0.15, 0.022, 10, 28), DARK);
  add(sw, revolve(2, [[0.12, 0], [0.045, 0.09], [0.045, 0.11], [0.001, 0.11]], 16), DARK2);          // deep dish
  for (const p of [[0.14, 0, 0], [-0.14, 0, 0], [0, -0.14, 0]]) rod(sw, [0, 0, 0.085], p, 0.016, DARK, 8);
  // roll cage: main hoop, rear cross bar, diagonal, roof bars, A bars, door bars
  for (const s of [-1, 1]) {
    rod(body, [s * 0.66, 0.32, -0.98], [s * 0.60, 1.12, -0.98], 0.02, DARK, 12);
    rod(body, [s * 0.60, 1.12, -0.98], [s * 0.60, 1.10, -0.38], 0.02, DARK, 12);
    rod(body, [s * 0.60, 1.10, -0.38], [s * 0.70, 0.88, 0.22], 0.02, DARK, 12);
    rod(body, [s * 0.63, 0.42, -0.95], [s * 0.69, 0.70, 0.18], 0.02, DARK, 12);
  }
  rod(body, [-0.60, 1.12, -0.98], [0.60, 1.12, -0.98], 0.02, DARK, 12);
  rod(body, [-0.62, 0.90, -0.98], [0.62, 0.90, -0.98], 0.02, DARK, 12);
  rod(body, [0.62, 0.40, -0.99], [-0.58, 1.10, -0.99], 0.02, DARK, 12);

  // ---- wheels: revolved tyre, 12 tread blocks, bead ring, rim shell and polished lip,
  //      five spokes, hub, cap, five lug nuts; the disc and caliper live on the hub -----------
  function wheel(side, w) {
    const wh = new THREE.Group(), hw = w / 2;
    const rv = (prof, seg, off) => revolve(0, prof.map(([r, a]) => [r, side * a]), seg, off);   // +a outboard
    const at = (geo, m, o, y, z, rx, rz) => {
      const mesh = new THREE.Mesh(geo, m); mesh.position.set(side * (o || 0), y || 0, z || 0);
      if (rx) mesh.rotation.x = rx; if (rz) mesh.rotation.z = rz; wh.add(mesh); return mesh;
    };
    at(rv([[0.25, -hw + 0.03], [0.292, -hw + 0.006], [0.306, -hw + 0.045], [0.306, hw - 0.045], [0.292, hw - 0.006], [0.25, hw - 0.03]], 48), RUB);
    for (let k = 0; k < 12; k++) {
      const geo = lathe([[0.306, -hw + 0.04], [0.32, -hw + 0.058], [0.32, hw - 0.058], [0.306, hw - 0.04]], 6, k * PI / 6 + 0.03, PI / 6 - 0.06);
      geo.rotateZ(-PI / 2); at(geo, RUB2);
    }
    const bead = at(new THREE.TorusGeometry(0.262, 0.008, 6, 44), RUB, hw - 0.012); bead.rotation.y = PI / 2;
    at(rv([[0.24, -hw + 0.02], [0.222, -hw + 0.05], [0.222, hw - 0.07], [0.215, hw - 0.03]], 40), BRONZ2);        // barrel
    at(rv([[0.20, hw - 0.03], [0.238, hw - 0.03], [0.238, hw + 0.004], [0.20, hw + 0.004]], 40), LIP);            // polished lip
    at(rv([[0.194, hw - 0.034], [0.206, hw - 0.034], [0.206, hw + 0.007], [0.194, hw + 0.007]], 40), GALV);       // machined ring at the lip's inner edge
    const os = hw - 0.075;                                                                                       // a slight dish
    at(rv([[0.001, os - 0.06], [0.08, os - 0.06], [0.08, os], [0.05, os], [0.05, os + 0.012], [0.001, os + 0.012]], 24), BRONZE);
    at(rv([[0.001, os + 0.012], [0.040, os + 0.012], [0.040, os + 0.020], [0.001, os + 0.020]], 16), DARK);         // centre cap
    for (let k = 0; k < 5; k++) {
      const a = k * PI * 2 / 5 + PI / 2;
      const spk = (y, t, w) => [[-t, y, -w], [-t, y, w], [t * 0.5, y, w * 0.72], [t * 1.15, y, 0], [t * 0.5, y, -w * 0.72]].map(([x, yy, z]) => [side * x, yy, z]);   // peaked cross-section
      at(loft([spk(0.045, 0.02, 0.016), spk(0.16, 0.02, 0.026), spk(0.228, 0.018, 0.032)], { creaseRows: [0, 1, 2, 3, 4], capFront: 0, capBack: 0 }), BRONZE, os - 0.015, 0, 0, a);   // tapered spoke
      at(cyl(0.011, 0.011, 0.014, 6), DARK, os + 0.016, 0.058 * Math.cos(a + PI / 5), 0.058 * Math.sin(a + PI / 5), 0, PI / 2);   // lug nut
    }
    at(rv([[0.062, -0.05], [0.062, os - 0.06]], 16), DARK2);                                                       // hub bell
    return wh;
  }
  const VERM2 = mk(0xc9402b, { roughness: 0.6, side: DS });
  const corner = (name, side, z, w, camberDeg) => {
    const hub = new THREE.Group(); hub.name = 'hub' + name;
    hub.position.set(side * 0.75, 0.32, z); hub.rotation.z = side * camberDeg * PI / 180;
    const wh = wheel(side, w); wh.name = 'wheel' + name; hub.add(wh);
    const disc = new THREE.Mesh(revolve(0, [[0.075, -0.062], [0.160, -0.062], [0.160, -0.038], [0.075, -0.038]].map(([r, a]) => [r, side * a]), 40), DISC); hub.add(disc);
    const cal = new THREE.Mesh(lathe([[0.105, -0.028], [0.168, -0.028], [0.168, 0.028], [0.105, 0.028], [0.105, -0.028]], 8, -1.25, 1.0), VERM2);
    cal.geometry.rotateZ(-PI / 2); cal.position.x = side * -0.05; hub.add(cal);
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
