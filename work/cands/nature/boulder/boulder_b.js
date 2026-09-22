// boulder — candidate B: profile route. The rock is an 8-sided LatheGeometry of a
// lumpy profile (flat underneath, a shoulder, a rounded crown); then every unique
// vertex is nudged radially and vertically by a hash so the eight columns stop
// reading as a barrel, and the result is fitted to 1.5 x 1.1 x 1.3 m. The moss cap
// is a second lathe, a low dome of 0.9 x 0.3 x 0.8 m, sunk into the crown.
export default function (THREE) {
  const g = new THREE.Group();

  const stone = new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.95, metalness: 0, flatShading: true });
  stone.name = 'stone';
  const moss = new THREE.MeshStandardMaterial({ color: 0x5f7a3a, roughness: 0.9, metalness: 0, flatShading: true });
  moss.name = 'foliage';

  const V2 = (a) => a.map(([x, y]) => new THREE.Vector2(x, y));
  const hash = (n) => {
    let h = (n | 0) + 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  // Nudge every unique vertex: radially by up to `radial`, vertically by up to
  // `vertical`. Keyed on position because the lathe duplicates its seam column.
  // Points on the axis and on the ground ring cannot move (0 times anything).
  const jitter = (geo, radial, vertical, seed) => {
    const p = geo.attributes.position, ids = new Map();
    let next = 0;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const key = Math.round(x * 500) + ',' + Math.round(y * 500) + ',' + Math.round(z * 500);
      let id = ids.get(key);
      if (id === undefined) { id = next++; ids.set(key, id); }
      const fr = 1 + (hash(id * 7 + seed) - 0.5) * 2 * radial;
      const fy = 1 + (hash(id * 7 + seed + 3) - 0.5) * 2 * vertical;
      p.setXYZ(i, x * fr, Math.max(0, y * fy), z * fr);
    }
    return geo;
  };
  // fit a geometry to exact extents, base at y = 0, centred on x/z
  const fit = (geo, w, h, d) => {
    geo.computeBoundingBox();
    const bb = geo.boundingBox, s = bb.getSize(new THREE.Vector3());
    geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
    geo.scale(w / s.x, h / s.y, d / s.z);
    geo.computeVertexNormals();
    return geo;
  };

  // --- the rock: profile runs ground centre -> out along the flat base -> up the
  //     flank -> crown (solid on the left of travel, so the lathe faces outward)
  const rock = new THREE.LatheGeometry(V2([
    [0, 0], [0.62, 0], [0.78, 0.18], [0.82, 0.46], [0.72, 0.74], [0.50, 0.95], [0.24, 1.07], [0, 1.1],
  ]), 8, 0.3);
  fit(jitter(rock, 0.14, 0.10, 3), 1.5, 1.1, 1.3);
  g.add(new THREE.Mesh(rock, stone));

  // --- moss cap: a low 8-sided dome, 0.9 x 0.3 x 0.8 m, base sunk 0.19 below the
  //     rock's highest vertex so its rim is buried and about 0.1 m of moss shows
  const rp = rock.attributes.position, top = new THREE.Vector3(0, -1, 0);
  for (let i = 0; i < rp.count; i++) if (rp.getY(i) > top.y) top.set(rp.getX(i), rp.getY(i), rp.getZ(i));
  const cap = new THREE.LatheGeometry(V2([[0, 0], [0.45, 0], [0.43, 0.09], [0.33, 0.20], [0.18, 0.27], [0, 0.30]]), 8, 0.6);
  jitter(cap, 0.10, 0, 9);
  cap.scale(1, 1, 0.89);
  cap.computeVertexNormals();
  const capMesh = new THREE.Mesh(cap, moss);
  capMesh.position.set(top.x * 0.5, top.y - 0.19, top.z * 0.5);
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
