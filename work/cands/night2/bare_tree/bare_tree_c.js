// bare_tree — candidate C: hand-built, a different breakdown. The whole tree except the
// joint knuckles is ONE BufferGeometry grown by a recursive function: each member is a
// loft of rings swept along a path that bends a little at every ring (a hash wobble plus
// an upward curl), capped at its far end, and its children start with their first ring
// buried inside the parent's end so nothing gaps. Trunk 7 sides (0.44 m dia root flare,
// 0.24 m at the 2.2 m fork), three limbs of 7 sides (0.16 m dia) ending at 4.2-4.8 m, eight
// branches of 6 sides (0.08 -> 0.04 m dia) with the tallest at 7.5 m, twelve 4-sided twigs
// (0.04 m dia, 0.5 m). A hash-lumped icosahedron burl sits on the main fork and small
// icosahedron knuckles on the three limb forks. No leaves. 5.0 m wide, 7.5 m tall.
export default function (THREE) {
  const g = new THREE.Group();

  const bark = new THREE.MeshStandardMaterial({ color: 0x5a3f2c, roughness: 0.85, metalness: 0 });
  bark.name = 'timber';

  const D2R = Math.PI / 180, Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
  const hash = (n) => {
    let h = (n | 0) + 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const dir = (azd, tiltd) => {
    const a = azd * D2R, t = tiltd * D2R;
    return new THREE.Vector3(Math.sin(t) * Math.cos(a), Math.cos(t), Math.sin(t) * Math.sin(a));
  };
  const off = (d, tilt, phi) => {
    const u = new THREE.Vector3().crossVectors(d, Math.abs(d.y) < 0.99 ? Y : X).normalize();
    const w = new THREE.Vector3().crossVectors(d, u).normalize();
    const t = tilt * D2R;
    return d.clone().multiplyScalar(Math.cos(t)).addScaledVector(u, Math.sin(t) * Math.cos(phi)).addScaledVector(w, Math.sin(t) * Math.sin(phi)).normalize();
  };

  // ---- loft: rings of N points around a tangent, quad strips, a fan cap -------------
  const pos = [], idx = [];
  const A = new THREE.Vector3(), B = new THREE.Vector3(), P = new THREE.Vector3();
  const ring = (c, t, r, N) => {                            // A x B = t, so strips wind outward
    const base = pos.length / 3;
    A.crossVectors(t, Math.abs(t.y) < 0.99 ? Y : X).normalize();
    B.crossVectors(t, A).normalize();
    for (let i = 0; i < N; i++) {
      const th = (i / N) * 2 * Math.PI;
      P.copy(c).addScaledVector(A, Math.cos(th) * r).addScaledVector(B, Math.sin(th) * r);
      pos.push(P.x, P.y, P.z);
    }
    return base;
  };
  const strip = (lo, hi, N) => { for (let i = 0; i < N; i++) { const j = (i + 1) % N; idx.push(lo + i, hi + j, hi + i, lo + i, lo + j, hi + j); } };
  const cap = (rim, N, p) => { const a = pos.length / 3; pos.push(p.x, p.y, p.z); for (let i = 0; i < N; i++) idx.push(rim + i, rim + (i + 1) % N, a); };

  // grow one member: `steps` rings from p along d, the direction wobbling by `wob` degrees
  // at a hash angle and curling `curl` degrees upward at every step; radius r0 -> r1.
  // The first ring sits `back` metres behind p, inside the parent. Returns the end and its tangent.
  const grow = (p, d, L, r0, r1, N, steps, wob, curl, back, seed) => {
    let c = p.clone().addScaledVector(d, -back), t = d.clone(), prev = ring(c, t, r0, N);
    for (let s = 1; s <= steps; s++) {
      const bent = off(t, wob, hash(seed * 13 + s) * 2 * Math.PI);
      t = bent.addScaledVector(Y, Math.sin(curl * D2R)).normalize();
      c = c.clone().addScaledVector(t, (L + back) / steps);
      const next = ring(c, t, r0 + (r1 - r0) * (s / steps), N);
      strip(prev, next, N); prev = next;
    }
    cap(prev, N, c);
    return [c, t];
  };

  // ---- trunk: 7 sides, root flare, a slight lean, four rings to the fork at 2.2 m
  const [fork] = grow(new THREE.Vector3(0, 0, 0), dir(200, 3), 2.2, 0.22, 0.12, 7, 3, 2.5, 0, 0, 1);

  // ---- limbs and branches: [azimuth, tilt, length, [branches: azimuth, tilt, length, twigs]]
  const limbs = [
    [ 25, 33, 2.55, [[  5, 22, 3.05, 2], [ 60, 40, 2.3, 2], [320, 36, 1.9, 1]]],
    [135, 36, 2.85, [[150, 26, 2.95, 2], [ 95, 42, 2.1, 1]]],
    [255, 24, 2.30, [[240, 22, 2.95, 2], [300, 44, 2.2, 1], [200, 48, 1.6, 1]]],
  ];
  let seed = 2, twigs = [];
  limbs.forEach(([az, tilt, len, branches], li) => {
    const [end] = grow(fork, dir(az, tilt), len, 0.08, 0.055, 7, 3, 4, 2.5, 0.15, seed++);
    branches.forEach(([baz, btilt, blen, n]) => {
      const d = dir(baz, btilt);
      // the branch loft: keep its ring centres so twigs can sit on it
      const rings = [];
      let c = end.clone().addScaledVector(d, -0.08), t = d.clone(), prev = ring(c, t, 0.04, 6);
      for (let s = 1; s <= 3; s++) {
        t = off(t, 5, hash(seed * 13 + s) * 2 * Math.PI).addScaledVector(Y, Math.sin(2.5 * D2R)).normalize();
        c = c.clone().addScaledVector(t, (blen + 0.08) / 3);
        rings.push([c.clone(), t.clone()]);
        const next = ring(c, t, 0.04 + (0.02 - 0.04) * (s / 3), 6);
        strip(prev, next, 6); prev = next;
      }
      cap(prev, 6, c);
      seed++;
      for (let i = 0; i < n; i++) twigs.push([rings[1 + (i % 2)][0], rings[1 + (i % 2)][1], seed * 100 + i]);
    });
    // a knuckle on the limb fork
    const k = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), bark);
    k.position.copy(end); k.rotation.y = li * 1.3; g.add(k);
  });
  // twelve twigs: 0.5 m, 0.04 m dia, 4 sides, off the upper rings of the branches
  twigs.forEach(([c, t, s], i) => {
    const td = off(t, 45 + 20 * hash(s + 1), hash(s + 2) * 2 * Math.PI);
    grow(c, td, 0.5, 0.02, 0.02, 4, 2, 6, 3, 0.03, 50 + i);
  });

  const wood = new THREE.BufferGeometry();
  wood.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  wood.setIndex(idx);
  wood.computeVertexNormals();
  g.add(new THREE.Mesh(wood, bark));

  // the burl at the main fork: an icosahedron with every vertex pushed in or out by a hash
  const burl = new THREE.IcosahedronGeometry(0.17, 1), bp = burl.attributes.position, ids = new Map();
  let next = 0;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
    const key = Math.round(x * 500) + ',' + Math.round(y * 500) + ',' + Math.round(z * 500);
    let id = ids.get(key);
    if (id === undefined) { id = next++; ids.set(key, id); }
    const f = 1 + (hash(id * 131 + 9) - 0.5) * 0.3;
    bp.setXYZ(i, x * f, y * f, z * f);
  }
  burl.computeVertexNormals();
  const b = new THREE.Mesh(burl, bark); b.position.copy(fork).addScaledVector(Y, 0.05); g.add(b);

  // --- the six lines: measure vertices, ground at y = 0, centre on x/z ---------
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });

  return g;
}
