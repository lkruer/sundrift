// grass_tuft — a clump of eleven blades, each one tapering triangle (a quad pinched to a point) leaning out from a
// common root on its own bearing, 0.22 to 0.46 m tall, the whole clump 0.5 m across. One foliage material, so the
// game tints each clump (young green, dry straw, deep green). The blades are single faces seen from both sides.
export default function (THREE) {
  const g = new THREE.Group();
  const foliage = new THREE.MeshStandardMaterial({ color: 0x6f8f3a, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  foliage.name = 'foliage';
  const pos = [], nor = [];
  let s = 29;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rnd() * 0.5;
    const r0 = 0.03 + rnd() * 0.07;                       // where the blade leaves the clump
    const lean = 0.12 + rnd() * 0.16, h = 0.22 + rnd() * 0.24, w = 0.028 + rnd() * 0.02;
    const cx = Math.cos(a), cz = Math.sin(a), tx = -cz, tz = cx;   // out along a, the blade's width across it
    const bx = cx * r0, bz = cz * r0;
    const tipx = bx + cx * lean, tipz = bz + cz * lean;
    // the base's two corners and the tip; the normal faces out and up, the way the blade leans
    const P = [bx - tx * w, 0, bz - tz * w, bx + tx * w, 0, bz + tz * w, tipx, h, tipz];
    const n = new THREE.Vector3(cx * h, lean, cz * h).normalize();
    pos.push(...P);
    for (let k = 0; k < 3; k++) nor.push(n.x, n.y, n.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.add(new THREE.Mesh(geo, foliage));

  // --- the six lines: measure vertices, ground at y = 0, centre on x/z ---------
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((o) => { const p = o.isMesh && o.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });
  return g;
}
