// bamboo_clump — candidate C: hand-built. All nine culms and every node ring are ONE
// BufferGeometry: each culm is a 6-sided loft through three rings (foot, knee, top) on a
// two-piece kinked path, tapering 30 % foot to top, with the knee height and its offset
// varied per culm so the culms zig outward at different heights; every 0.45 m a 6-vertex
// rim plus an apex on the axis makes a node skirt in the same mesh. The leaves are a
// second BufferGeometry of 27 four-sided spindles (apex, fat ring, narrow ring, apex:
// 0.34 x 0.9 x 0.34 m), three per culm, drooping down and sideways at hash angles.
// ONE stem material, ONE foliage material. 2.4 m wide, 7.0 m tall.
//
// Budget note: icosahedron detail 1 blobs (80 tris) times 27 are 2,160 triangles alone,
// above the 1,400 cap, so the blobs are 16-triangle spindles and the nodes 6-triangle skirts.
export default function (THREE) {
  const g = new THREE.Group();

  const stem = new THREE.MeshStandardMaterial({ color: 0x5f7a3a, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  stem.name = 'foliage';
  const leaf = new THREE.MeshStandardMaterial({ color: 0x2f5a3a, roughness: 0.9, metalness: 0, flatShading: true });
  leaf.name = 'foliage';

  const D2R = Math.PI / 180, Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
  const hash = (n) => {
    let h = (n | 0) + 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const hz = (a) => new THREE.Vector3(Math.cos(a), 0, Math.sin(a));

  // ---- loft primitives: rings of N points around a tangent, quad strips, fans ------------
  const wood = { pos: [], idx: [] }, green = { pos: [], idx: [] };
  const A = new THREE.Vector3(), B = new THREE.Vector3(), P = new THREE.Vector3();
  const point = (buf, p) => { buf.pos.push(p.x, p.y, p.z); return buf.pos.length / 3 - 1; };
  const ring = (buf, c, t, r, N) => {                       // A x B = t, so strips wind outward
    const base = buf.pos.length / 3;
    A.crossVectors(t, Math.abs(t.y) < 0.99 ? Y : X).normalize();
    B.crossVectors(t, A).normalize();
    for (let i = 0; i < N; i++) {
      const th = (i / N) * 2 * Math.PI;
      P.copy(c).addScaledVector(A, Math.cos(th) * r).addScaledVector(B, Math.sin(th) * r);
      buf.pos.push(P.x, P.y, P.z);
    }
    return base;
  };
  const strip = (buf, lo, hi, N) => { for (let i = 0; i < N; i++) { const j = (i + 1) % N; buf.idx.push(lo + i, hi + j, hi + i, lo + i, lo + j, hi + j); } };
  const fan = (buf, rim, N, apex, up) => { for (let i = 0; i < N; i++) { const j = (i + 1) % N; if (up) buf.idx.push(rim + i, rim + j, apex); else buf.idx.push(rim + j, rim + i, apex); } };

  // a leaf spindle centred at c with its long axis along dir: 0.34 wide, 0.9 long, 16 triangles
  const spindle = (c, dir, spin) => {
    const q = new THREE.Quaternion().setFromUnitVectors(Y, dir).multiply(new THREE.Quaternion().setFromAxisAngle(Y, spin));
    const W = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(c);
    const bot = point(green, W(0, -0.45, 0));
    const R = [[0.17, -0.13], [0.13, 0.21]].map(([rr, y]) => {
      const b = green.pos.length / 3;
      for (let i = 0; i < 4; i++) { const th = (i / 4) * 2 * Math.PI; point(green, W(rr * Math.sin(th), y, rr * Math.cos(th))); }
      return b;
    });
    const top = point(green, W(0, 0.45, 0));
    fan(green, R[0], 4, bot, false); strip(green, R[0], R[1], 4); fan(green, R[1], 4, top, true);
  };

  // [azimuth deg, foot radius m (inside the 1.2 m circle), height m, outward lean of the top deg, culm radius m]
  const culms = [
    [ 10, 0.25, 7.00, 2.0, 0.050],
    [ 62, 0.55, 6.10, 4.0, 0.040],
    [ 95, 0.20, 5.80, 8.0, 0.038],
    [150, 0.58, 6.40, 3.0, 0.045],
    [178, 0.35, 6.70, 5.0, 0.048],
    [230, 0.60, 5.50, 4.5, 0.036],
    [262, 0.30, 6.85, 3.5, 0.050],
    [318, 0.50, 5.95, 5.5, 0.040],
    [340, 0.45, 6.25, 2.5, 0.043],
  ];

  culms.forEach(([azd, r0, h, leand, r], k) => {
    const az = azd * D2R, out = hz(az), j = (i) => hash(k * 41 + i);
    const foot = out.clone().multiplyScalar(r0);
    const reach = h * Math.tan(leand * D2R);
    // the knee: somewhere between half and two thirds of the way up, a little way outward
    const kneeY = h * (0.5 + 0.15 * j(1));
    const knee = foot.clone().addScaledVector(out, reach * (0.15 + 0.2 * j(2))).addScaledVector(Y, kneeY);
    const top = foot.clone().addScaledVector(out, reach).addScaledVector(Y, h);
    const t1 = knee.clone().sub(foot).normalize(), t2 = top.clone().sub(knee).normalize(), tk = t1.clone().add(t2).normalize();

    // culm: three rings, two strips, a cap; 30 % taper foot to top
    const R0 = ring(wood, foot, t1, r, 6), R1 = ring(wood, knee, tk, 0.88 * r, 6), R2 = ring(wood, top, t2, 0.7 * r, 6);
    strip(wood, R0, R1, 6); strip(wood, R1, R2, 6);
    fan(wood, R2, 6, point(wood, top), true);

    // nodes: every 0.45 m up to the tuft, a 6-point rim 35 % wider than the culm and an apex
    // 3 cm higher on the axis, a skirt in the same mesh
    const along = (y) => (y < kneeY ? [foot.clone().lerp(knee, y / kneeY), t1] : [knee.clone().lerp(top, (y - kneeY) / (h - kneeY)), t2]);
    for (let y = 0.45; y <= h - 1.0; y += 0.45) {
      const [c, t] = along(y), rs = r * (1 - 0.3 * (y / h));
      const rim = ring(wood, c.clone().addScaledVector(t, -0.03), t, 1.35 * rs, 6);
      fan(wood, rim, 6, point(wood, c.clone().addScaledVector(t, 0.03)), true);
    }

    // tuft: a crown along the top piece, two spindles drooping down and sideways
    const at = (y, dir, alongDir) => along(y)[0].addScaledVector(dir, alongDir);
    const side = j(3) > 0.5 ? 1 : -1;
    const crown = t2.clone().addScaledVector(hz(az + (j(4) - 0.5) * 3), 0.15 + 0.2 * j(5)).normalize();
    spindle(at(h - 0.28, crown, 0), crown, j(6) * 6.28);
    const f1 = hz(az + side * (65 + 35 * j(7)) * D2R).multiplyScalar(0.85).addScaledVector(Y, -0.4 - 0.25 * j(8)).normalize();
    spindle(at(h - 0.6, f1, 0.32), f1, j(9) * 6.28);
    const f2 = hz(az - side * (55 + 45 * j(10)) * D2R).multiplyScalar(0.9).addScaledVector(Y, -0.3 - 0.3 * j(11)).normalize();
    spindle(at(h - 1.15, f2, 0.30), f2, j(12) * 6.28);
  });

  const build = (buf, mat) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
    geo.setIndex(buf.idx);
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, mat));
  };
  build(wood, stem);
  build(green, leaf);

  // --- the six lines: measure vertices, ground at y = 0, centre on x/z ---------
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });

  return g;
}
