// roadside_shrub — candidate C: hand-built, a different reading. A bush grows out
// of the ground, so instead of balls this is ONE BufferGeometry of four lumpy
// domes rising from y = 0, each made in loops: a ground ring, two rings up a
// rounded flank and a crown point, eight columns, every ring vertex pushed in or
// out by a hash and each ring twisted, closed underneath. 1.8 x 1.1 x 1.6 m,
// the big dome off-centre so the bush is not symmetric. No stub: nothing floats.
export default function (THREE) {
  const g = new THREE.Group();

  // ONE foliage material for the whole bush: the game retints it per instance.
  const foliage = new THREE.MeshStandardMaterial({ color: 0x9a8a3c, roughness: 0.9, metalness: 0, flatShading: true });
  foliage.name = 'foliage';

  const hash = (n) => {
    let h = (n | 0) + 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  const pos = [], idx = [], N = 8;
  const rings = [[1.0, 0.0], [1.0, 0.45], [0.7, 0.8]];   // (radius, height) as fractions of R and H
  const dome = (cx, cz, R, RZ, H, seed, twist) => {
    const b = pos.length / 3;
    rings.forEach(([rf, hf], j) => {
      for (let i = 0; i < N; i++) {
        const th = (i / N) * 2 * Math.PI + twist + j * 0.25;
        const jr = 1 + (hash(seed + j * 31 + i * 7) - 0.5) * 0.3;                       // radius +-15 %
        const jy = j === 0 ? 1 : 1 + (hash(seed + 100 + j * 31 + i * 7) - 0.5) * 0.2;    // height +-10 %
        pos.push(cx + R * rf * jr * Math.sin(th), H * hf * jy, cz + RZ * rf * jr * Math.cos(th));
      }
    });
    const top = pos.length / 3; pos.push(cx, H, cz);
    const bot = top + 1; pos.push(cx, 0, cz);
    for (let i = 0; i < N; i++) {
      const jn = (i + 1) % N;
      for (let k = 0; k < rings.length - 1; k++) {
        const lo = b + k * N, hi = b + (k + 1) * N;
        idx.push(lo + i, hi + jn, hi + i, lo + i, lo + jn, hi + jn);   // flank, facing out
      }
      const hi = b + (rings.length - 1) * N;
      idx.push(hi + i, hi + jn, top);    // crown, facing up
      idx.push(b + i, bot, b + jn);      // ground cap, facing down
    }
  };
  dome(-0.15,  0.00, 0.75, 0.68, 1.10, 1, 0.0);   // main
  dome( 0.40, -0.35, 0.50, 0.50, 0.85, 2, 0.5);
  dome( 0.15,  0.40, 0.45, 0.42, 0.70, 3, 1.1);
  dome(-0.55, -0.45, 0.35, 0.35, 0.55, 4, 0.3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, foliage));

  // --- the six lines: measure vertices, ground at y = 0, centre on x/z ---------
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });

  return g;
}
