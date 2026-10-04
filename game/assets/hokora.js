// hokora — a wayside shrine: a little timber shrine in the nagare style (its gable roof sweeping on out over the front
// as a canopy) roofed in copper gone green, with crossed chigi boards on the ridge, a front of two slatted doors
// behind a short porch with its own rail, set on a plinth of two dressed stone blocks over a rough stone base; a sacred
// rope (shimenawa) across the front hung with white paper zigzags (shide), and a pair of stone vases with sprigs of
// sakaki before it. Front faces +Z. About 1.2 m wide over the base, 1.75 m to the top of the chigi.
export default function (THREE) {
  const g = new THREE.Group();
  const M = (color, name, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...extra }); m.name = name; return m; };
  const stone = M(0x8e877c, 'stone', { roughness: 0.95 }), rough = M(0x7a7368, 'rough stone', { roughness: 0.95 });
  const wood = M(0x7a6650, 'weathered timber'), dark = M(0x2e2722, 'timber');
  const copper = M(0x5f9a86, 'copper roof', { roughness: 0.6 }), paper = M(0xf4f1e8, 'paper'), rope = M(0xc8b07a, 'straw');
  const leaf = M(0x3f6e34, 'foliage');

  const box = (w, h, d, m, x, y, z, rx = 0, rz = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); g.add(o); return o; };

  // ---- the base: a rough slab of stone, then two dressed blocks
  {
    const geo = new THREE.CylinderGeometry(0.6, 0.68, 0.26, 7);
    const o = new THREE.Mesh(geo, rough); o.position.set(0, 0.13, 0.02); o.rotation.y = 0.3; g.add(o);
  }
  box(0.9, 0.26, 0.78, stone, 0, 0.39, 0);
  box(0.76, 0.2, 0.66, stone, 0, 0.62, 0);

  // ---- the shrine: body, the porch floor before it, posts, doors with slats
  const B0 = 0.72, BH = 0.6;
  box(0.6, BH, 0.46, wood, 0, B0 + BH / 2, -0.07);
  box(0.72, 0.05, 0.72, dark, 0, B0 + 0.025, 0.02);                       // the floor and the porch
  for (const x of [-0.31, 0.31]) for (const z of [0.17, 0.34]) box(0.05, BH + 0.1, 0.05, dark, x, B0 + (BH + 0.1) / 2, z);
  for (const x of [-0.14, 0.14]) {
    box(0.27, 0.5, 0.03, dark, x, B0 + 0.31, 0.17);
    for (const k of [-0.08, 0, 0.08]) box(0.025, 0.48, 0.02, wood, x + k, B0 + 0.31, 0.19);
  }
  // the porch's low rail
  box(0.68, 0.03, 0.03, dark, 0, B0 + 0.15, 0.36);

  // ---- the roof: nagare style, the front slope long over the porch; ridge, crossed chigi at both ends
  const RY = B0 + BH + 0.36, a = 0.55;
  {
    box(0.94, 0.05, 0.72, copper, 0, RY - Math.sin(a) * 0.36 + 0.02, 0.26, a);
    box(0.94, 0.05, 0.48, copper, 0, RY - Math.sin(a) * 0.24 + 0.02, -0.27, -a);
    box(0.96, 0.08, 0.08, dark, 0, RY + 0.03, -0.01);
    for (const s of [1, -1]) for (const t of [1, -1]) box(0.03, 0.2, 0.06, dark, s * 0.45, RY + 0.1, -0.01 + t * 0.045, t * 0.5, 0);
    // the gable boards under each end
    for (const s of [1, -1]) {
      const sh = new THREE.Shape();
      sh.moveTo(-0.34, 0); sh.lineTo(0.36, 0); sh.lineTo(-0.01, 0.34); sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false });
      geo.rotateY(Math.PI / 2); geo.translate(s * 0.3 - 0.02, B0 + BH, 0);
      g.add(new THREE.Mesh(geo, wood));
    }
  }

  // ---- the sacred rope across the front, its paper zigzags; the vases and their sakaki
  {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.7, 6), rope);
    r.rotation.z = Math.PI / 2; r.position.set(0, B0 + BH + 0.02, 0.38); g.add(r);
    for (const x of [-0.2, 0.2]) for (const k of [0, 1]) box(0.07, 0.08, 0.01, paper, x + (k ? 0.018 : -0.018), B0 + BH - 0.06 - k * 0.08, 0.39);
  }
  for (const x of [-0.27, 0.27]) {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.18, 7), stone);
    v.position.set(x, 0.81, 0.47); g.add(v);
    const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), leaf);
    l.scale.set(0.8, 1.4, 0.8); l.position.set(x, 0.98, 0.47); g.add(l);
  }

  // --- the six lines: measure vertices, ground at y = 0, centre on x/z ---------
  const bb = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((o) => { const p = o.isMesh && o.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) bb.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld)); });
  const c = bb.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= bb.min.y; o.position.z -= c.z; });
  return g;
}
