// conbini — candidate A: primitives. Everything is a box, a cylinder or a torus. A chrome-dark plinth and
// floor slab, concrete back and side walls, a roof slab under a dark coping, a vermilion fascia lightbox
// with a lane-white stripe, a two-pane tint-glass front (opacity 0.5) on galvanised mullions every 1.5 m
// with a recessed sliding-door vestibule (two framed glass leaves), a warm emissive ceiling panel, four
// timber shelf units in two rows with dark shelf lines, a timber counter with a white top, a wall cooler,
// two galvanised AC units with fan rings on the roof, four dark bollards with white bands, a steel back
// door under a lamp, a rear condenser, downpipes, a meter box, a side window and an exhaust hood.
export default function (THREE) {
  const g = new THREE.Group();
  const M = (color, o = {}, name) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0, ...o }); if (name) m.name = name; return m; };
  const put = (geo, mat, p, r) => { const m = new THREE.Mesh(geo, mat); if (p) m.position.set(p[0], p[1], p[2]); if (r) m.rotation.set(r[0], r[1], r[2]); g.add(m); return m; };
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

  // shell: plinth, walls, roof slab, coping, front band above the fascia
  box(9, 0.3, 6, 0, 0.15, 0, dark);
  box(9, 3.9, 0.25, 0, 2.25, -2.875, concrete);
  box(0.25, 3.9, 6, -4.375, 2.25, 0, concrete);
  box(0.25, 3.9, 6, 4.375, 2.25, 0, concrete);
  box(9, 0.26, 6, 0, 3.93, 0, concrete);
  box(9.2, 0.14, 6.2, 0, 4.13, 0, dark);
  box(9, 0.86, 0.25, 0, 3.63, 2.875, concrete);
  // fascia lightbox and its stripe
  box(9, 0.6, 0.4, 0, 2.9, 2.95, verm);
  box(9, 0.1, 0.04, 0, 2.72, 3.17, white);
  // glazing: two panes, mullions every 1.5 m, head rail, sill
  box(3.6, 2.3, 0.04, -2.7, 1.45, 2.9, glass);
  box(3.6, 2.3, 0.04, 2.7, 1.45, 2.9, glass);
  for (const x of [-4.4, -3, -1.5, 1.5, 3, 4.4]) box(0.08, 2.3, 0.14, x, 1.45, 2.9, galv);
  box(9, 0.08, 0.14, 0, 2.64, 2.9, galv);
  box(9, 0.06, 0.14, 0, 0.33, 2.9, galv);
  // door vestibule recessed 0.3 m: jambs, soffit, two framed glass leaves, mat, step
  box(0.12, 2.3, 0.4, -0.96, 1.45, 2.8, concrete);
  box(0.12, 2.3, 0.4, 0.96, 1.45, 2.8, concrete);
  box(1.9, 0.1, 0.4, 0, 2.65, 2.8, concrete);
  for (const x of [-0.45, 0.45]) {
    box(0.9, 2.2, 0.04, x, 1.45, 2.66, glass);
    box(0.06, 2.2, 0.06, x - 0.42, 1.45, 2.66, galv);
    box(0.06, 2.2, 0.06, x + 0.42, 1.45, 2.66, galv);
    box(0.9, 0.06, 0.06, x, 2.52, 2.66, galv);
    box(0.9, 0.1, 0.06, x, 0.4, 2.66, galv);
  }
  box(1.8, 0.03, 0.3, 0, 0.315, 2.82, dark);
  box(2.4, 0.15, 0.5, 0, 0.075, 3.25, concrete);
  // interior: floor, ceiling backing, emissive panel, shelves, counter, back shelving, wall cooler
  box(8.5, 0.06, 5.5, 0, 0.33, 0, dark);
  box(8.6, 0.1, 5.6, 0, 2.95, 0, concrete);
  box(8, 0.05, 5, 0, 2.875, 0, ceiling);
  for (const z of [0.9, -0.8]) for (const x of [-3.0, -1.7]) {
    box(0.9, 1.6, 0.5, x, 1.16, z, timber);
    for (const yy of [0.76, 1.16, 1.56]) box(0.92, 0.03, 0.52, x, yy, z, dark);
  }
  box(2.4, 0.9, 0.7, 2.6, 0.81, 0.6, timber);
  box(2.5, 0.05, 0.8, 2.6, 1.285, 0.6, white);
  box(3.0, 2.0, 0.4, 2.6, 1.36, -2.55, timber);
  box(0.7, 2.0, 3.0, -3.9, 1.36, -1.2, galv);
  box(0.02, 1.6, 2.8, -3.54, 1.46, -1.2, glass);
  // roof plant: two AC units with a grille plate and fan ring, a vent stack
  for (const [x, z] of [[-2.5, -1.0], [2.2, -1.6]]) {
    box(1.2, 0.55, 0.8, x, 4.475, z, galv);
    box(1.1, 0.04, 0.7, x, 4.77, z, dark);
    put(new THREE.TorusGeometry(0.26, 0.05, 4, 10), dark, [x, 4.8, z], [Math.PI / 2, 0, 0]);
  }
  cyl(0.1, 0.5, 8, 3.8, 4.45, 1.5, galv);
  cyl(0.16, 0.06, 8, 3.8, 4.73, 1.5, galv);
  // bollards
  for (const x of [-3.4, -1.7, 1.7, 3.4]) { cyl(0.07, 0.9, 8, x, 0.45, 3.6, dark); cyl(0.075, 0.1, 8, x, 0.75, 3.6, white); }
  // back: steel door in a frame, lamp above, downpipe with hopper, condenser unit
  box(0.9, 2.1, 0.08, 2.5, 1.35, -3.04, dark);
  box(0.08, 2.2, 0.1, 1.99, 1.4, -3.05, galv);
  box(0.08, 2.2, 0.1, 3.01, 1.4, -3.05, galv);
  box(1.1, 0.08, 0.1, 2.5, 2.46, -3.05, galv);
  box(0.3, 0.08, 0.24, 2.5, 2.75, -3.12, dark);
  box(0.24, 0.04, 0.18, 2.5, 2.69, -3.12, lampLens);
  cyl(0.05, 3.9, 6, -4.2, 1.95, -3.08, galv);
  box(0.2, 0.2, 0.2, -4.2, 4.0, -3.1, galv);
  box(0.9, 0.7, 0.35, -2.0, 0.65, -3.2, galv);
  put(new THREE.TorusGeometry(0.22, 0.04, 4, 10), dark, [-2.0, 0.7, -3.38]);
  box(0.9, 0.1, 0.35, -2.0, 0.35, -3.2, dark);
  // sides: downpipes, a meter box and a framed window on the left, an exhaust hood on the right
  cyl(0.05, 3.9, 6, -4.58, 1.95, -2.4, galv);
  cyl(0.05, 3.9, 6, 4.58, 1.95, -2.4, galv);
  box(0.15, 0.6, 0.5, -4.58, 1.6, 1.0, galv);
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
