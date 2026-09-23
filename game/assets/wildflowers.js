// wildflowers — a little clump of spring flowers for the verges: seven thin stems (one triangle each) with a
// four-petal head on top (two crossed diamonds), 0.18 to 0.34 m tall, 0.45 m across. The heads take the
// instance colour (white, butter yellow, pale violet, the game chooses); the stems are their own green material.
export default function (THREE) {
  const g = new THREE.Group();
  const petal = new THREE.MeshStandardMaterial({ color: 0xf2eee0, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
  petal.name = 'foliage';
  const stem = new THREE.MeshStandardMaterial({ color: 0x4f7a34, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  stem.name = 'stem';
  const sp = [], sn = [], hp = [], hn = [];
  let s = 71;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2, r = 0.04 + rnd() * 0.16;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, h = 0.18 + rnd() * 0.16;
    const lx = x + (rnd() - 0.5) * 0.06, lz = z + (rnd() - 0.5) * 0.06;
    // the stem: a sliver from the ground to the head
    sp.push(x - 0.008, 0, z, x + 0.008, 0, z, lx, h, lz);
    for (let k = 0; k < 3; k++) sn.push(0, 0, 1);
    // the head: two crossed diamonds facing up and out, 0.07 m across
    const R = 0.035 + rnd() * 0.015;
    for (const t of [0, Math.PI / 2]) {
      const cx = Math.cos(t + a), cz = Math.sin(t + a);
      const q = [[lx + cx * R, h, lz + cz * R], [lx, h + R * 0.5, lz], [lx - cx * R, h, lz - cz * R], [lx, h - R * 0.3, lz]];
      hp.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
      for (let k = 0; k < 6; k++) hn.push(0, 1, 0);
    }
  }
  const mk = (p, n, m) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3)); g.add(new THREE.Mesh(geo, m)); };
  mk(sp, sn, stem); mk(hp, hn, petal);

  // --- the six lines: measure vertices, ground at y = 0, centre on x/z ---------
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((o) => { const p = o.isMesh && o.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });
  return g;
}
