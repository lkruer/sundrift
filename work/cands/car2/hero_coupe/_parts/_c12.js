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
