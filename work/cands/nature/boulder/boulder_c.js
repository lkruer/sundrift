// boulder — candidate C: hand-built, and a different reading of the mass. The rock
// is ONE indexed BufferGeometry made in loops: a lat/long ball of 9 columns and 7
// rows for the main mass plus a smaller 7 x 5 ball as a shoulder lobe on the +X
// side, every vertex pushed in or out by a hash of its index (16 %), rings twisted
// so no column reads, flattened underneath to y = 0 and fitted to 1.5 x 1.1 x 1.3 m.
// The moss cap is a hand-built 8-sided dome, 0.9 x 0.3 x 0.8 m, sunk into the crown.
export default function (THREE) {
  const g = new THREE.Group();

  const stone = new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.95, metalness: 0, flatShading: true });
  stone.name = 'stone';
  const moss = new THREE.MeshStandardMaterial({ color: 0x5f7a3a, roughness: 0.9, metalness: 0, flatShading: true });
  moss.name = 'foliage';

  const hash = (n) => {
    let h = (n | 0) + 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const build = (pos, idx, m) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    return geo;
  };
  const fit = (geo, w, h, d) => {
    geo.computeBoundingBox();
    const bb = geo.boundingBox, s = bb.getSize(new THREE.Vector3());
    geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
    geo.scale(w / s.x, h / s.y, d / s.z);
    geo.computeVertexNormals();
    return geo;
  };

  // ---- the rock: two lobes in one geometry ------------------------------------
  const pos = [], idx = [];
  // a lat/long ball: N columns, M rows, radii (rx, ry, rz) about (cx, cy, cz);
  // each vertex pushed along its radius by a hash of its own index
  const lobe = (cx, cy, cz, rx, ry, rz, N, M, amount, seed) => {
    const b = pos.length / 3;
    const put = (x, y, z, k) => {
      const f = 1 + (hash(k * 13 + seed) - 0.5) * 2 * amount;
      pos.push(cx + x * rx * f, cy + y * ry * f, cz + z * rz * f);
    };
    put(0, 1, 0, 0);                                                     // top pole
    for (let j = 1; j < M; j++) {
      const ph = (j / M) * Math.PI, y = Math.cos(ph), rr = Math.sin(ph);
      for (let i = 0; i < N; i++) {
        const th = (i / N) * 2 * Math.PI + j * 0.35;                     // twist each row
        put(rr * Math.sin(th), y, rr * Math.cos(th), j * N + i);
      }
    }
    put(0, -1, 0, M * N + 1);                                            // bottom pole
    const T = b, R = (j) => b + 1 + (j - 1) * N, Bo = b + 1 + (M - 1) * N;
    for (let i = 0; i < N; i++) {
      const jn = (i + 1) % N;
      idx.push(T, R(1) + i, R(1) + jn);
      for (let j = 1; j < M - 1; j++) {
        idx.push(R(j) + i, R(j + 1) + i, R(j + 1) + jn, R(j) + i, R(j + 1) + jn, R(j) + jn);
      }
      idx.push(R(M - 1) + i, Bo, R(M - 1) + jn);
    }
  };
  lobe(-0.12, 0.42, 0.00, 0.74, 0.70, 0.64, 9, 7, 0.16, 1);   // main mass
  lobe( 0.42, 0.26, 0.18, 0.44, 0.42, 0.40, 7, 5, 0.14, 2);   // shoulder lobe
  const rock = build(pos, idx);
  const rp = rock.attributes.position;
  for (let i = 0; i < rp.count; i++) if (rp.getY(i) < 0) rp.setY(i, 0);   // flat underside at y = 0
  fit(rock, 1.5, 1.1, 1.3);
  g.add(new THREE.Mesh(rock, stone));

  // ---- moss cap: an 8-sided dome of three rings, closed underneath ------------
  const mp = [], mi = [], NM = 8;
  const rings = [[1.0, 0.0], [0.86, 0.5], [0.5, 0.86]];   // (radius, height) on a unit dome
  rings.forEach(([r, y], j) => {
    for (let i = 0; i < NM; i++) {
      const th = (i / NM) * 2 * Math.PI + j * 0.3;
      const f = 1 + (hash(i * 5 + j * 41 + 99) - 0.5) * 0.2;
      mp.push(r * f * Math.sin(th), y, r * f * Math.cos(th));
    }
  });
  const topI = mp.length / 3; mp.push(0, 1.0, 0);
  const botI = topI + 1; mp.push(0, 0, 0);
  for (let i = 0; i < NM; i++) {
    const jn = (i + 1) % NM;
    for (let j = 0; j < rings.length - 1; j++) {
      const lo = j * NM, hi = (j + 1) * NM;
      mi.push(lo + i, hi + jn, hi + i, lo + i, lo + jn, hi + jn);
    }
    const hi = (rings.length - 1) * NM;
    mi.push(hi + i, hi + jn, topI);   // crown, facing up
    mi.push(i, botI, jn);             // base, facing down
  }
  const cap = build(mp, mi);
  cap.scale(0.45, 0.30, 0.40);
  cap.computeVertexNormals();
  const top = new THREE.Vector3(0, -1, 0);
  for (let i = 0; i < rp.count; i++) if (rp.getY(i) > top.y) top.set(rp.getX(i), rp.getY(i), rp.getZ(i));
  const capMesh = new THREE.Mesh(cap, moss);
  capMesh.position.set(top.x * 0.5, top.y - 0.19, top.z * 0.5);   // base buried, ~0.1 m of moss shows
  g.add(capMesh);

  // --- the six lines: measure vertices, ground at y = 0, centre on x/z ---------
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });

  return g;
}
