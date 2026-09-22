// snow_pole — candidate C: a different part breakdown. A single white core pole with THREE red sleeves
// (bands 1, 3, 5) slipped over it, so the white bands are the core showing through; the arrow plate is a
// hand-built BufferGeometry prism (triangle loft built in a loop, flat normals); the reflector is a
// shallow SphereGeometry cap; a dark saddle block and an open dark band hold the plate to the pole.
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
      tri(at(pts[0], depth), at(pts[i], depth), at(pts[i + 1], depth));   // front cap, faces +Z
      tri(at(pts[0], 0), at(pts[i + 1], 0), at(pts[i], 0));               // back cap, faces -Z
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
  const red     = M(0xd11c1c);
  const white   = M(0xe8e4da);
  const whiteDS = M(0xe8e4da, { side: THREE.DoubleSide });
  const dark    = M(0x2b2d31, { roughness: 0.6, side: THREE.DoubleSide });

  // white core (kept 0.01 clear of the sleeve caps so no faces coincide) and three red sleeves
  put(new THREE.CylinderGeometry(0.03, 0.03, 1.28, 8), white, [0, 0.65, 0]);
  const sleeve = new THREE.CylinderGeometry(0.032, 0.032, 0.26, 8);
  for (const yc of [0.13, 0.65, 1.17]) put(sleeve, red, [0, yc, 0]);
  // arrow plate: 0.14 wide, 0.16 tall, apex down, 0.02 thick, on the +Z face
  put(prism([[-0.07, 0.08], [0, -0.08], [0.07, 0.08]], 0.02), red, [0, 1.32, 0.03]);
  // reflector: shallow spherical cap 0.05 dia, 0.008 proud of the plate
  const Rs = 0.043, th = Math.asin(0.025 / Rs);
  put(new THREE.SphereGeometry(Rs, 10, 3, 0, Math.PI * 2, 0, th), whiteDS, [0, 1.352, 0.058 - Rs], [Math.PI / 2, 0, 0]);
  // saddle block behind the plate and an open dark band round the pole
  put(new THREE.BoxGeometry(0.05, 0.05, 0.02), dark, [0, 1.27, 0.02]);
  put(new THREE.CylinderGeometry(0.034, 0.034, 0.03, 8, 1, true), dark, [0, 1.27, 0]);

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
