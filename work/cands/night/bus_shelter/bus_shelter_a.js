// bus_shelter — candidate A: primitives. A timber post-and-beam frame (four 0.10 m posts, eave and tie
// beams, king posts, ridge beam) under a gabled roof of two tilted tile boxes with a ridge cap, three
// plank walls as timber panels carrying a chrome-dark groove line every 0.2 m on both faces, a full-width
// bench on two leg boards with an apron, a round chrome-dark sign disc on a galvanised post at the +X end
// reaching 2.4 m, a lamp-warm bar lamp in a dark fitting under the ridge, and dark sill beams at the foot
// of the walls. Front (+Z) open.
export default function (THREE) {
  const g = new THREE.Group();
  const M = (color, o = {}, name) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0, ...o }); if (name) m.name = name; return m; };
  const put = (geo, mat, p, r, parent) => { const m = new THREE.Mesh(geo, mat); if (p) m.position.set(p[0], p[1], p[2]); if (r) m.rotation.set(r[0], r[1], r[2]); (parent || g).add(m); return m; };
  const timber = M(0x7a5a3a, { roughness: 0.85 }, 'timber');
  const tile = M(0x4a4f5a, { roughness: 0.8 }, 'tile');
  const galv = M(0xb9bcc0, { roughness: 0.5, metalness: 0.6 }, 'metal');
  const dark = M(0x2b2d31, { roughness: 0.4 });
  const lamp = M(0xffcf7a, { roughness: 0.3, emissive: 0xffcf7a, emissiveIntensity: 1.2 });
  const box = (w, h, d, x, y, z, m, r, parent) => put(new THREE.BoxGeometry(w, h, d), m, [x, y, z], r, parent);
  const SL = Math.atan2(0.5, 0.8);   // roof pitch: 0.5 m rise over 0.8 m half-span

  // frame: posts, eave beams, tie beams, king posts, ridge beam; dark sill beams
  for (const x of [-1.25, 1.25]) for (const z of [-0.55, 0.55]) box(0.1, 2.3, 0.1, x, 1.15, z, timber);
  for (const z of [-0.55, 0.55]) box(2.6, 0.1, 0.1, 0, 2.3, z, timber);
  for (const x of [-1.25, 1.25]) box(0.1, 0.1, 1.2, x, 2.3, 0, timber);
  for (const x of [-1.25, 1.25]) box(0.1, 0.3, 0.1, x, 2.5, 0, timber);
  box(2.6, 0.1, 0.1, 0, 2.62, 0, timber);
  box(2.6, 0.1, 0.1, 0, 0.05, -0.55, dark);
  for (const x of [-1.25, 1.25]) box(0.1, 0.1, 1.2, x, 0.05, 0, dark);
  // roof: two tile panels (the +Z one pitches its front DOWN with a positive rotation.x), ridge cap
  const PL = Math.hypot(0.8, 0.5) + 0.08;
  box(3.0, 0.06, PL, 0, 2.45, 0.4, tile, [SL, 0, 0]);
  box(3.0, 0.06, PL, 0, 2.45, -0.4, tile, [-SL, 0, 0]);
  box(3.0, 0.1, 0.22, 0, 2.7, 0, tile);
  // walls: a timber panel with a dark groove every 0.2 m on both faces, in a per-wall frame
  const wall = (w, x, z, ry) => {
    const gr = new THREE.Group(); gr.position.set(x, 0, z); gr.rotation.y = ry; g.add(gr);
    box(w, 2.15, 0.06, 0, 1.175, 0, timber, null, gr);
    for (let y = 0.3; y < 2.2; y += 0.2) { box(w, 0.03, 0.02, 0, y, 0.03, dark, null, gr); box(w, 0.03, 0.02, 0, y, -0.03, dark, null, gr); }
  };
  wall(2.4, 0, -0.52, 0);
  wall(1.0, -1.22, 0, Math.PI / 2);
  wall(1.0, 1.22, 0, Math.PI / 2);
  // bench: seat slab at 0.42 m, two leg boards, apron
  box(2.4, 0.06, 0.4, 0, 0.39, -0.22, timber);
  for (const x of [-1.1, 1.1]) box(0.06, 0.36, 0.36, x, 0.18, -0.22, timber);
  box(2.4, 0.08, 0.04, 0, 0.32, -0.04, timber);
  // sign: galvanised post with a base plate at the +X end, chrome-dark disc facing +Z
  put(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 8), galv, [1.65, 1.2, 0.35]);
  box(0.16, 0.02, 0.16, 1.65, 0.01, 0.35, galv);
  put(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 16), dark, [1.65, 2.1, 0.4], [Math.PI / 2, 0, 0]);
  // bar lamp under the ridge beam
  box(0.95, 0.05, 0.1, 0, 2.545, 0, dark);
  box(0.9, 0.06, 0.06, 0, 2.49, 0, lamp);

  // ground and centre by measuring vertices
  const bx = new THREE.Box3(), v = new THREE.Vector3(), m4 = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const add = (mat) => { for (let i = 0; i < p.count; i++) bx.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); add(m4.multiplyMatrices(n.matrixWorld, im)); } return; }
    add(n.matrixWorld);
  });
  const c = bx.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= bx.min.y; o.position.z -= c.z; });
  return g;
}
