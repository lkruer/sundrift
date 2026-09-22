// conbini — WINNER (candidate C, a different breakdown): the shop as a lit box you look into. The front wall is a
// Shape with a hole (a real glazed opening, no stacked bands), the fascia is a projecting vermilion canopy
// with three lamp-warm down-lights under it and the white stripe on its face, the glazing has a galvanised
// mid-rail with lane-white spandrel panels below it, one sliding-door leaf is slid open behind the other
// so the doorway reads as open, the emissive ceiling panel sits in a galvanised tile grid, the shelves are
// gondolas with galvanised end caps and goods on them, the counter has a dark front, and the roof carries
// two AC units on a dark plinth frame plus an access hatch. Pavement slab with a dark kerb and bollards.
export default function (THREE) {
  const g = new THREE.Group();
  const M = (color, o = {}, name) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0, ...o }); if (name) m.name = name; return m; };
  const put = (geo, mat, p, r) => { const m = new THREE.Mesh(geo, mat); if (p) m.position.set(p[0], p[1], p[2]); if (r) m.rotation.set(r[0], r[1], r[2]); g.add(m); return m; };
  const poly = (pts) => { const s = new THREE.Shape(); pts.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]))); s.closePath(); return s; };
  const hole = (shape, pts) => { const h = new THREE.Path(); pts.forEach((p, i) => (i ? h.lineTo(p[0], p[1]) : h.moveTo(p[0], p[1]))); h.closePath(); shape.holes.push(h); return shape; };
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const extrude = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  const concrete = M(0xa8a49c, { roughness: 0.9 }, 'plaster');
  const dark = M(0x2b2d31, { roughness: 0.4 });
  const galv = M(0xb9bcc0, { roughness: 0.5, metalness: 0.6 }, 'metal');
  const glass = M(0x1c2a33, { roughness: 0.1, transparent: true, opacity: 0.5 });
  const verm = M(0xc9402b, { roughness: 0.35 });
  const white = M(0xe8e4da, { roughness: 0.35 });
  const timber = M(0x7a5a3a, { roughness: 0.85 }, 'timber');
  const ceiling = M(0xffcf7a, { roughness: 0.5, emissive: 0xffcf7a, emissiveIntensity: 1.6 });
  const lampLens = M(0xffcf7a, { roughness: 0.3, emissive: 0xffcf7a, emissiveIntensity: 1.2 });
  const box = (w, h, d, x, y, z, m) => put(new THREE.BoxGeometry(w, h, d), m, [x, y, z]);
  const cyl = (r, h, n, x, y, z, m) => put(new THREE.CylinderGeometry(r, r, h, n), m, [x, y, z]);

  // hollow shell: floor slab on a dark plinth, back and side walls, front wall with a real opening, roof
  box(9, 0.3, 6, 0, 0.15, 0, dark);
  box(8.5, 0.06, 5.5, 0, 0.33, 0, dark);
  box(9, 3.9, 0.25, 0, 2.25, -2.875, concrete);
  box(0.25, 3.9, 6, -4.375, 2.25, 0, concrete);
  box(0.25, 3.9, 6, 4.375, 2.25, 0, concrete);
  put(extrude(hole(poly(rect(-4.5, 0.2, 4.5, 4.06)), rect(-4.4, 0.3, 4.4, 2.6)), 0.25), concrete, [0, 0, 2.75]);
  box(9, 0.26, 6, 0, 3.93, 0, concrete);
  box(9.2, 0.14, 6.2, 0, 4.13, 0, dark);
  // canopy fascia: projecting vermilion box, white stripe on its face, three down-lights under it
  box(9.2, 0.6, 0.55, 0, 2.9, 3.025, verm);
  box(9.2, 0.1, 0.04, 0, 2.72, 3.32, white);
  for (const x of [-3, 0, 3]) { box(0.36, 0.04, 0.36, x, 2.58, 3.12, dark); box(0.3, 0.03, 0.3, x, 2.555, 3.12, lampLens); }
  // glazing: upper glass, mid-rail at 1.3 m, lane-white spandrel panels below, mullions, head, sill
  for (const x of [-2.65, 2.65]) {
    box(3.5, 1.3, 0.04, x, 1.95, 2.9, glass);
    box(3.5, 0.9, 0.04, x, 0.85, 2.9, glass);
    box(3.4, 0.7, 0.03, x, 0.78, 2.86, white);
  }
  for (const x of [-4.4, -3, -1.5, 1.5, 3, 4.4]) box(0.08, 2.3, 0.14, x, 1.45, 2.9, galv);
  box(9, 0.08, 0.14, 0, 2.64, 2.9, galv);
  box(9, 0.08, 0.14, 0, 1.3, 2.9, galv);
  box(9, 0.06, 0.14, 0, 0.33, 2.9, galv);
  // doorway: vestibule, closed leaf on the left, the right leaf slid open behind it, mat and step
  box(0.12, 2.3, 0.4, -0.96, 1.45, 2.8, concrete);
  box(0.12, 2.3, 0.4, 0.96, 1.45, 2.8, concrete);
  box(1.9, 0.1, 0.4, 0, 2.65, 2.8, concrete);
  box(1.9, 0.1, 0.1, 0, 2.55, 2.64, galv);
  for (const [x, z] of [[-0.45, 2.66], [-0.45, 2.6]]) {
    box(0.86, 2.16, 0.03, x, 1.45, z, glass);
    box(0.06, 2.2, 0.05, x - 0.42, 1.45, z, galv);
    box(0.06, 2.2, 0.05, x + 0.42, 1.45, z, galv);
    box(0.9, 0.06, 0.05, x, 2.52, z, galv);
    box(0.9, 0.12, 0.05, x, 0.41, z, galv);
  }
  box(1.8, 0.03, 0.3, 0, 0.315, 2.82, dark);
  box(2.4, 0.15, 0.35, 0, 0.075, 3.175, concrete);
  // interior: ceiling backing, emissive panel in a galvanised grid, three pendant lamps low enough to
  // show through the upper glass from any camera height, gondolas with goods, counter
  box(8.6, 0.1, 5.6, 0, 2.95, 0, concrete);
  box(8, 0.05, 5, 0, 2.875, 0, ceiling);
  for (const x of [-2.4, 0, 2.4]) { cyl(0.02, 0.4, 6, x, 2.65, 0.2, dark); box(0.36, 0.04, 0.36, x, 2.45, 0.2, dark); box(0.3, 0.03, 0.3, x, 2.42, 0.2, lampLens); }
  for (const z of [-1.25, 0, 1.25]) box(8, 0.04, 0.06, 0, 2.85, z, galv);
  for (const x of [-2.4, -0.8, 0.8, 2.4]) box(0.06, 0.04, 5, x, 2.85, 0, galv);
  for (const z of [0.9, -0.8]) for (const x of [-3.0, -1.7]) {
    box(0.9, 1.6, 0.5, x, 1.16, z, timber);
    box(0.04, 1.62, 0.54, x - 0.45, 1.17, z, galv);
    box(0.04, 1.62, 0.54, x + 0.45, 1.17, z, galv);
    for (const yy of [0.76, 1.16, 1.56]) box(0.92, 0.03, 0.54, x, yy, z, dark);
    for (const k of [0, 1, 2]) { box(0.22, 0.24, 0.16, x - 0.3 + k * 0.3, 0.9, z + 0.2, k === 1 ? galv : white); box(0.22, 0.2, 0.16, x - 0.3 + k * 0.3, 1.28, z - 0.2, k === 1 ? white : galv); }
  }
  box(2.4, 0.9, 0.7, 2.6, 0.81, 0.6, timber);
  box(2.4, 0.9, 0.04, 2.6, 0.81, 0.97, dark);
  box(2.5, 0.05, 0.8, 2.6, 1.285, 0.6, white);
  box(3.0, 2.0, 0.4, 2.6, 1.36, -2.55, timber);
  box(0.7, 2.0, 3.0, -3.9, 1.36, -1.2, galv);
  box(0.02, 1.6, 2.8, -3.54, 1.46, -1.2, glass);
  // roof plant: two AC units on a thin dark frame, an access hatch, a vent stack
  box(4.4, 0.06, 1.0, -0.4, 4.23, -1.4, dark);
  for (const x of [-2.2, 1.4]) {
    box(1.2, 0.4, 0.8, x, 4.46, -1.4, galv);
    box(1.1, 0.04, 0.7, x, 4.68, -1.4, dark);
    put(new THREE.TorusGeometry(0.26, 0.05, 4, 10), dark, [x, 4.71, -1.4], [Math.PI / 2, 0, 0]);
  }
  box(0.9, 0.3, 0.9, 3.5, 4.35, 1.6, dark);
  cyl(0.1, 0.35, 8, -3.6, 4.375, 1.8, galv);
  cyl(0.16, 0.06, 8, -3.6, 4.58, 1.8, galv);
  // pavement slab, kerb and bollards in front
  box(9.4, 0.08, 0.45, 0, 0.04, 3.225, concrete);
  box(9.4, 0.12, 0.1, 0, 0.06, 3.4, dark);
  for (const x of [-3.4, -1.7, 1.7, 3.4]) { cyl(0.07, 0.9, 8, x, 0.53, 3.28, dark); cyl(0.075, 0.1, 8, x, 0.83, 3.28, white); }
  // back: steel door and frame, lamp, downpipe, condenser
  box(0.9, 2.1, 0.08, 2.5, 1.35, -3.04, dark);
  box(0.08, 2.2, 0.1, 1.99, 1.4, -3.05, galv);
  box(0.08, 2.2, 0.1, 3.01, 1.4, -3.05, galv);
  box(1.1, 0.08, 0.1, 2.5, 2.46, -3.05, galv);
  box(0.3, 0.08, 0.24, 2.5, 2.75, -3.12, dark);
  box(0.24, 0.04, 0.18, 2.5, 2.69, -3.12, lampLens);
  cyl(0.05, 3.9, 6, -4.2, 1.95, -3.08, galv);
  box(0.2, 0.2, 0.2, -4.2, 4.0, -3.1, galv);
  box(0.9, 0.7, 0.3, -2.0, 0.65, -3.15, galv);
  put(new THREE.TorusGeometry(0.22, 0.04, 4, 10), dark, [-2.0, 0.7, -3.31]);
  box(0.9, 0.1, 0.3, -2.0, 0.35, -3.15, dark);
  // back: roof-access ladder, a small framed staff window, a meter cabinet
  for (const x of [-3.5, -3.1]) box(0.05, 3.9, 0.05, x, 2.05, -3.12, galv);
  for (let y = 0.3; y < 4.0; y += 0.3) box(0.4, 0.04, 0.04, -3.3, y, -3.12, galv);
  box(1.2, 0.5, 0.06, 0.5, 3.1, -3.03, glass);
  box(1.3, 0.06, 0.1, 0.5, 3.38, -3.05, galv);
  box(1.3, 0.06, 0.1, 0.5, 2.82, -3.05, galv);
  box(0.06, 0.6, 0.1, -0.13, 3.1, -3.05, galv);
  box(0.06, 0.6, 0.1, 1.13, 3.1, -3.05, galv);
  box(0.6, 0.9, 0.25, 1.0, 0.75, -3.12, galv);
  box(0.5, 0.8, 0.02, 1.0, 0.75, -3.25, dark);
  // sides: downpipes, meter box and a framed window on the left, exhaust hood on the right
  cyl(0.05, 3.9, 6, -4.58, 1.95, -2.4, galv);
  cyl(0.05, 3.9, 6, 4.58, 1.95, -2.4, galv);
  box(0.15, 0.6, 0.5, -4.58, 1.6, 1.0, galv);
  box(0.1, 0.4, 0.6, -4.55, 1.5, -1.8, galv);
  for (const y of [1.38, 1.5, 1.62]) box(0.04, 0.04, 0.5, -4.62, y, -1.8, dark);
  box(0.06, 0.6, 1.2, -4.53, 3.2, -0.6, glass);
  box(0.1, 0.06, 1.3, -4.55, 3.53, -0.6, galv);
  box(0.1, 0.06, 1.3, -4.55, 2.87, -0.6, galv);
  box(0.1, 0.7, 0.06, -4.55, 3.2, -1.23, galv);
  box(0.1, 0.7, 0.06, -4.55, 3.2, 0.03, galv);
  box(0.5, 0.5, 0.8, 4.7, 3.4, 0.8, galv);
  cyl(0.12, 0.6, 8, 4.7, 3.95, 0.8, galv);

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
