// stone_lantern — candidate A: primitives. Kasuga lantern, 1.8 m: a box plinth on a
// moss band, a 12-sided tapered cylinder pillar with a torus bead, a box platform,
// a fire box built from two full-width slabs, a narrower core and four corner posts
// so every face carries a real 0.16 m square recess 0.03 m deep, a roof of a soffit
// frustum, a shallow 4-sided slope and a steeper 4-sided cone (the kink between
// them is the concave flank), four tilted corner tips, and a sphere finial on a neck.
export default function (THREE) {
  const g = new THREE.Group();

  const stone = new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.95, metalness: 0, flatShading: true });
  stone.name = 'stone';
  const moss = new THREE.MeshStandardMaterial({ color: 0x5f7a3a, roughness: 0.9, metalness: 0, flatShading: true });
  moss.name = 'foliage';

  const add = (geo, m, x = 0, y = 0, z = 0, parent = g) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  const box = (w, h, d, m, x, y, z) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z);

  // --- moss band (0.01 m proud) and the 0.72 m square plinth, 0.16 m tall
  box(0.74, 0.05, 0.74, moss, 0, 0.025, 0);
  box(0.72, 0.16, 0.72, stone, 0, 0.08, 0);

  // --- pillar: 0.28 m dia at the foot, 0.24 m at the top, 0.62 m tall, a bead at its middle
  add(new THREE.CylinderGeometry(0.12, 0.14, 0.62, 12), stone, 0, 0.16 + 0.31, 0);
  add(new THREE.TorusGeometry(0.135, 0.022, 6, 12), stone, 0, 0.47, 0).rotation.x = Math.PI / 2;

  // --- platform: 0.58 m square, 0.12 m tall
  box(0.58, 0.12, 0.58, stone, 0, 0.84, 0);

  // --- fire box: a 0.42 m cube from 0.90 to 1.32 m. Bottom and top slabs are full width; the
  //     middle band is a 0.36 m core plus four 0.13 m corner posts, which leaves a 0.16 m
  //     square recess 0.03 m deep centred on every face without any hole.
  box(0.42, 0.13, 0.42, stone, 0, 0.965, 0);
  box(0.42, 0.13, 0.42, stone, 0, 1.255, 0);
  box(0.36, 0.16, 0.36, stone, 0, 1.11, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.13, 0.16, 0.13, stone, sx * 0.145, 1.11, sz * 0.145);

  // --- roof: 0.78 m across the eaves, 0.34 m tall from 1.32 to 1.66. Four-sided sweeps
  //     turned 45 degrees so the square sits on axis: a soffit frustum for the eave edge,
  //     a shallow lower slope and a steep upper cone, so the flank is concave.
  const RC = 0.39 * Math.SQRT2, ROT = Math.PI / 4;
  add(new THREE.CylinderGeometry(RC, RC * 0.92, 0.05, 4), stone, 0, 1.345, 0).rotation.y = ROT;   // 1.32..1.37
  add(new THREE.CylinderGeometry(0.26, RC, 0.10, 4), stone, 0, 1.42, 0).rotation.y = ROT;          // 1.37..1.47
  add(new THREE.ConeGeometry(0.26, 0.19, 4), stone, 0, 1.565, 0).rotation.y = ROT;                 // 1.47..1.66
  // upturned corners: a short block at each corner, pointing out along the diagonal, tilted up
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(sx * 0.32, 1.375, sz * 0.32);
    piv.rotation.y = Math.atan2(-sz, sx);      // local +x now points out along the diagonal
    g.add(piv);
    const tip = add(new THREE.BoxGeometry(0.18, 0.05, 0.09), stone, 0.03, 0.02, 0, piv);
    tip.rotation.z = 0.45;                      // the +x (outer) end rises
  }

  // --- finial: a short neck and a 0.12 m sphere, top at 1.80 m
  add(new THREE.CylinderGeometry(0.035, 0.045, 0.03, 8), stone, 0, 1.675, 0);
  add(new THREE.SphereGeometry(0.06, 8, 6), stone, 0, 1.74, 0);

  // --- the six lines: measure vertices, ground at y = 0, centre on x/z ---------
  const bb = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) bb.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = bb.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= bb.min.y; o.position.z -= c.z; });

  return g;
}
