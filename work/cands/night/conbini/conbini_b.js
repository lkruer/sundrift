// conbini — candidate B: profiles. The back and side walls are ONE ExtrudeGeometry of a C-shaped plan; the
// coping is an extruded frame (a Shape with a hole); the fascia is a lightbox section swept along X; the
// mullions are extruded T-sections; the shelf units are extruded comb profiles so every shelf plane is
// real; the counter is an extruded section with an overhanging top and a kick recess; the two steps are
// one swept section; the bollards are 8-segment lathes with domed tops and lathe white bands; the door
// leaves and the back door are extruded frames with holes over glass or steel panels; the AC fan cowls,
// the vent stack and the condenser fan are lathes. No bevels anywhere.
export default function (THREE) {
  const g = new THREE.Group();
  const M = (color, o = {}, name) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0, ...o }); if (name) m.name = name; return m; };
  const put = (geo, mat, p, r) => { const m = new THREE.Mesh(geo, mat); if (p) m.position.set(p[0], p[1], p[2]); if (r) m.rotation.set(r[0], r[1], r[2]); g.add(m); return m; };
  const lathe = (pts, segs) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), segs);
  const poly = (pts) => { const s = new THREE.Shape(); pts.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]))); s.closePath(); return s; };
  const hole = (shape, pts) => { const h = new THREE.Path(); pts.forEach((p, i) => (i ? h.lineTo(p[0], p[1]) : h.moveTo(p[0], p[1]))); h.closePath(); shape.holes.push(h); return shape; };
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const extrude = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  // a plan shape (world x, z) extruded upward from y0 by h: rotation.x = -PI/2 sends the depth to +Y and shape y to -Z
  const plan = (pts, h, y0, mat) => put(extrude(poly(pts.map(([x, z]) => [x, -z])), h), mat, [0, y0, 0], [-Math.PI / 2, 0, 0]);
  const planHole = (outer, inner, h, y0, mat) => put(extrude(hole(poly(outer.map(([x, z]) => [x, -z])), inner.map(([x, z]) => [x, -z])), h), mat, [0, y0, 0], [-Math.PI / 2, 0, 0]);
  // a section (world z, y) swept along +X from x0 for len: rotation.y = PI/2 sends the depth to +X and shape x to -Z
  const alongX = (pts, len, x0, mat, zc = 0) => put(extrude(poly(pts.map(([z, y]) => [-z, y])), len), mat, [x0, 0, zc], [0, Math.PI / 2, 0]);
  // a section (world x, y) swept along +Z from z0
  const alongZ = (pts, len, z0, mat, xc = 0) => put(extrude(poly(pts), len), mat, [xc, 0, z0]);
  const concrete = M(0xa8a49c, { roughness: 0.9 }, 'plaster');
  const dark = M(0x2b2d31, { roughness: 0.4 });
  const darkDS = M(0x2b2d31, { roughness: 0.4, side: THREE.DoubleSide });
  const galv = M(0xb9bcc0, { roughness: 0.5, metalness: 0.6 }, 'metal');
  const glass = M(0x1c2a33, { roughness: 0.1, transparent: true, opacity: 0.5 });
  const verm = M(0xc9402b, { roughness: 0.35 });
  const white = M(0xe8e4da, { roughness: 0.35 });
  const timber = M(0x7a5a3a, { roughness: 0.85 }, 'timber');
  const ceiling = M(0xffcf7a, { roughness: 0.5, emissive: 0xffcf7a, emissiveIntensity: 1.6 });
  const lampLens = M(0xffcf7a, { roughness: 0.3, emissive: 0xffcf7a, emissiveIntensity: 1.2 });
  const box = (w, h, d, x, y, z, m) => put(new THREE.BoxGeometry(w, h, d), m, [x, y, z]);

  // shell: dark plinth, C-plan walls 0.25 thick from 0.3 to 4.2, roof slab, coping frame, front band
  box(9, 0.3, 6, 0, 0.15, 0, dark);
  plan([[-4.5, -3], [4.5, -3], [4.5, 3], [4.25, 3], [4.25, -2.75], [-4.25, -2.75], [-4.25, 3], [-4.5, 3]], 3.9, 0.3, concrete);
  box(8.6, 0.26, 5.6, 0, 3.93, 0, concrete);
  planHole(rect(-4.6, -3.1, 4.6, 3.1), rect(-4.4, -2.9, 4.4, 2.9), 0.14, 4.06, dark);
  box(8.4, 0.02, 5.4, 0, 4.07, 0, concrete);
  box(9, 0.86, 0.25, 0, 3.63, 2.875, concrete);
  // fascia lightbox section swept along X, with the lane-white stripe
  alongX([[2.875, 2.6], [3.28, 2.62], [3.3, 3.15], [2.875, 3.2]], 9, -4.5, verm);
  alongX([[3.28, 2.66], [3.32, 2.66], [3.32, 2.76], [3.29, 2.76]], 9, -4.5, white);
  // glazing: panes, T-section mullions, head rail and sill
  box(3.6, 2.3, 0.04, -2.7, 1.45, 2.9, glass);
  box(3.6, 2.3, 0.04, 2.7, 1.45, 2.9, glass);
  const tee = poly([[-0.05, 0.08], [0.05, 0.08], [0.05, 0.04], [0.02, 0.04], [0.02, -0.08], [-0.02, -0.08], [-0.02, 0.04], [-0.05, 0.04]]);
  for (const x of [-4.4, -3, -1.5, 1.5, 3, 4.4]) put(extrude(tee, 2.3), galv, [x, 0.3, 2.9], [-Math.PI / 2, 0, 0]);
  box(9, 0.08, 0.16, 0, 2.64, 2.9, galv);
  box(9, 0.06, 0.16, 0, 0.33, 2.9, galv);
  // door vestibule: jambs and soffit, two extruded door frames over glass leaves, steps swept along X
  box(0.12, 2.3, 0.4, -0.96, 1.45, 2.8, concrete);
  box(0.12, 2.3, 0.4, 0.96, 1.45, 2.8, concrete);
  box(1.9, 0.1, 0.4, 0, 2.65, 2.8, concrete);
  for (const x of [-0.45, 0.45]) {
    put(extrude(hole(poly(rect(-0.45, -1.1, 0.45, 1.1)), rect(-0.39, -0.98, 0.39, 1.04)), 0.05), galv, [x, 1.45, 2.64]);
    box(0.82, 2.06, 0.02, x, 1.48, 2.66, glass);
  }
  alongX([[3.0, 0], [3.6, 0], [3.6, 0.15], [3.3, 0.15], [3.3, 0.3], [3.0, 0.3]], 2.4, -1.2, concrete);
  box(1.8, 0.03, 0.3, 0, 0.315, 2.82, dark);
  // interior: floor, ceiling backing and emissive panel, comb-profile shelves, counter section, back shelving, cooler
  box(8.5, 0.06, 5.5, 0, 0.33, 0, dark);
  box(8.6, 0.1, 5.6, 0, 2.95, 0, concrete);
  box(8, 0.05, 5, 0, 2.875, 0, ceiling);
  const comb = [[-0.25, 0], [0.25, 0], [0.25, 0.04], [-0.2, 0.04], [-0.2, 0.42], [0.25, 0.42], [0.25, 0.46], [-0.2, 0.46], [-0.2, 0.82], [0.25, 0.82], [0.25, 0.86], [-0.2, 0.86], [-0.2, 1.22], [0.25, 1.22], [0.25, 1.26], [-0.2, 1.26], [-0.2, 1.6], [-0.25, 1.6]];
  for (const z of [0.9, -0.8]) for (const x of [-3.0, -1.7]) {
    const s = alongX(comb, 0.9, x - 0.45, timber, z); s.position.y = 0.36;
  }
  const counter = alongX([[0.02, 0], [-0.35, 0], [-0.35, 0.85], [-0.45, 0.85], [-0.45, 0.92], [0.4, 0.92], [0.4, 0.85], [0.3, 0.85], [0.3, 0.1], [0.02, 0.1]], 2.4, 1.4, timber, 0.6);
  counter.position.y = 0.36;
  box(3.0, 2.0, 0.4, 2.6, 1.36, -2.55, timber);
  box(0.7, 2.0, 3.0, -3.9, 1.36, -1.2, galv);
  box(0.02, 1.6, 2.8, -3.54, 1.46, -1.2, glass);
  // roof plant: AC units with lathe fan cowls and hubs, a lathe vent stack
  for (const [x, z] of [[-2.5, -1.0], [2.2, -1.6]]) {
    box(1.2, 0.55, 0.8, x, 4.475, z, galv);
    put(lathe([[0.18, 0], [0.3, 0], [0.3, 0.08], [0.22, 0.1], [0.18, 0.1]], 10), darkDS, [x, 4.75, z]);
    put(lathe([[0, 0], [0.19, 0], [0.19, 0.02], [0, 0.02]], 10), dark, [x, 4.75, z]);
  }
  put(lathe([[0, 0], [0.1, 0], [0.1, 0.45], [0.16, 0.47], [0.16, 0.52], [0, 0.55]], 8), galv, [3.8, 4.2, 1.5]);
  // bollards: lathe posts with domed tops and a lathe white band
  const bollard = lathe([[0, 0], [0.09, 0], [0.09, 0.05], [0.07, 0.06], [0.07, 0.8], [0.06, 0.88], [0, 0.9]], 8);
  const band = lathe([[0.071, 0.7], [0.076, 0.7], [0.076, 0.8], [0.071, 0.8]], 8);
  for (const x of [-3.4, -1.7, 1.7, 3.4]) { put(bollard, dark, [x, 0, 3.6]); put(band, white, [x, 0, 3.6]); }
  // back: extruded door frame over a steel panel, lamp hood and lens, downpipe with hopper, condenser
  put(extrude(hole(poly(rect(-0.55, -1.15, 0.55, 1.15)), rect(-0.45, -1.05, 0.45, 1.05)), 0.1), galv, [2.5, 1.45, -3.1]);
  box(0.9, 2.1, 0.06, 2.5, 1.35, -3.03, dark);
  box(0.3, 0.08, 0.24, 2.5, 2.8, -3.12, dark);
  box(0.24, 0.04, 0.18, 2.5, 2.74, -3.12, lampLens);
  put(lathe([[0, 0], [0.05, 0], [0.05, 3.7], [0.1, 3.75], [0.1, 3.95], [0, 3.95]], 6), galv, [-4.2, 0.1, -3.08]);
  box(0.9, 0.7, 0.35, -2.0, 0.65, -3.2, galv);
  put(lathe([[0.16, 0], [0.26, 0], [0.26, 0.05], [0.16, 0.05]], 10), darkDS, [-2.0, 0.7, -3.375], [-Math.PI / 2, 0, 0]);
  put(lathe([[0, 0], [0.17, 0], [0.17, 0.03], [0, 0.03]], 10), dark, [-2.0, 0.7, -3.375], [-Math.PI / 2, 0, 0]);
  box(0.9, 0.1, 0.35, -2.0, 0.35, -3.2, dark);
  // sides: downpipes, meter box and an extruded window frame on the left, exhaust hood on the right
  put(lathe([[0, 0], [0.05, 0], [0.05, 3.7], [0.1, 3.75], [0.1, 3.95], [0, 3.95]], 6), galv, [-4.58, 0.1, -2.4]);
  put(lathe([[0, 0], [0.05, 0], [0.05, 3.7], [0.1, 3.75], [0.1, 3.95], [0, 3.95]], 6), galv, [4.58, 0.1, -2.4]);
  box(0.15, 0.6, 0.5, -4.58, 1.6, 1.0, galv);
  const wf = alongX([[-1.25, 2.85], [0.05, 2.85], [0.05, 3.55], [-1.25, 3.55]], 0.1, -4.6, galv);
  wf.geometry = extrude(hole(poly([[1.25, 2.85], [-0.05, 2.85], [-0.05, 3.55], [1.25, 3.55]]), [[1.19, 2.91], [-0.01, 2.91], [-0.01, 3.49], [1.19, 3.49]]), 0.1);
  box(0.06, 0.6, 1.2, -4.53, 3.2, -0.6, glass);
  box(0.5, 0.5, 0.8, 4.7, 3.4, 0.8, galv);
  put(lathe([[0, 0], [0.12, 0], [0.12, 0.5], [0.18, 0.55], [0.18, 0.6], [0, 0.6]], 8), galv, [4.7, 3.65, 0.8]);

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
