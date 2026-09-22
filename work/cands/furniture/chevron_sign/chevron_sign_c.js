// chevron_sign — candidate C: a different reading of the board. It is a stack of three plates: a galvanised
// body, a chrome-dark plate the full board size, and a smaller maple-gold plate on top, so the 0.03 dark
// margin IS the border rather than a separate frame. Each chevron is two mitred quads built as hand-built
// BufferGeometry prisms (exact ">" outline, no overshoot at the tip). The post has a hemispherical cap and
// a dark foot sleeve; two saddle brackets with dark bands hold the board; two flat rails stiffen the back.
export default function (THREE) {
  const g = new THREE.Group();
  const M = (color, o = {}, name) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.0, ...o });
    if (name) m.name = name;
    return m;
  };
  const put = (geo, mat, p, r) => {
    const m = new THREE.Mesh(geo, mat);
    if (p) m.position.set(p[0], p[1], p[2]);
    if (r) m.rotation.set(r[0], r[1], r[2]);
    g.add(m);
    return m;
  };
  // convex polygon in XY (any winding) extruded from z = 0 to z = depth, flat-shaded
  const prism = (pts, depth) => {
    let area = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
    if (area < 0) pts = pts.slice().reverse();
    const P = [];
    const tri = (a, b, c) => P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    const at = (p, z) => [p[0], p[1], z];
    for (let i = 1; i < pts.length - 1; i++) {
      tri(at(pts[0], depth), at(pts[i], depth), at(pts[i + 1], depth));
      tri(at(pts[0], 0), at(pts[i + 1], 0), at(pts[i], 0));
    }
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      tri(at(a, 0), at(b, 0), at(b, depth));
      tri(at(a, 0), at(b, depth), at(a, depth));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.computeVertexNormals();
    return geo;
  };
  const galv   = M(0xb9bcc0, { roughness: 0.5, metalness: 0.6 }, 'metal');
  const galvDS = M(0xb9bcc0, { roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide }, 'metal');
  const gold   = M(0xe8b52a);
  const dark   = M(0x2b2d31, { roughness: 0.4 });
  const darkDS = M(0x2b2d31, { roughness: 0.4, side: THREE.DoubleSide });

  const PZ = -0.04;
  // post with a hemispherical cap and a dark foot sleeve
  put(new THREE.CylinderGeometry(0.03, 0.03, 1.35, 10), galv, [0, 0.675, PZ]);
  put(new THREE.SphereGeometry(0.03, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), galvDS, [0, 1.35, PZ]);
  put(new THREE.CylinderGeometry(0.038, 0.038, 0.10, 10), dark, [0, 0.05, PZ]);
  // board as a stack: galvanised body (z 0..0.03), dark plate (0.03..0.04), gold inset (0.04..0.05)
  put(new THREE.BoxGeometry(0.92, 0.60, 0.03), galv, [0, 1.50, 0.015]);
  put(new THREE.BoxGeometry(0.92, 0.60, 0.01), dark, [0, 1.50, 0.035]);
  put(new THREE.BoxGeometry(0.86, 0.54, 0.01), gold, [0, 1.50, 0.045]);
  // chevrons: two mitred quads each, 0.22 x 0.46, stroke 0.06, pointing +X, 0.01 proud of the gold
  const hw = 0.11, hh = 0.23, tw = 0.06 / Math.sin(Math.atan2(hh, hw));
  const upper = prism([[-hw, hh], [-hw + tw, hh], [hw, 0], [hw - tw, 0]], 0.01);
  const lower = prism([[-hw, -hh], [-hw + tw, -hh], [hw, 0], [hw - tw, 0]], 0.01);
  for (const cx of [-0.29, 0, 0.29]) { put(upper, dark, [cx, 1.50, 0.05]); put(lower, dark, [cx, 1.50, 0.05]); }
  // saddle brackets: a block straddling the post's front half plus an open dark band round it
  for (const y of [1.24, 1.32]) {
    put(new THREE.BoxGeometry(0.10, 0.04, 0.06), galv, [0, y, -0.03]);
    put(new THREE.CylinderGeometry(0.036, 0.036, 0.04, 10, 1, true), darkDS, [0, y, PZ]);
  }
  // flat stiffening rails on the back
  for (const y of [1.42, 1.66]) put(new THREE.BoxGeometry(0.86, 0.05, 0.02), galv, [0, y, -0.01]);

  // ground and centre by measuring vertices
  const box = new THREE.Box3(), v = new THREE.Vector3(), m4 = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const add = (mat) => { for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); add(m4.multiplyMatrices(n.matrixWorld, im)); } return; }
    add(n.matrixWorld);
  });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });
  return g;
}
