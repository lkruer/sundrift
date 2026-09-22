// cats_eye — candidate C: a different breakdown, a chamfered octagonal wedge. The housing is an 8-sided
// drum (0.02 m tall) under an 8-sided frustum chamfer (0.013 m), both scaled 0.14/0.12 on X and flat
// shaded so the facets read as a crisp box with chamfers; a rubber torus gasket sits around the foot; the
// lenses are boxes in chrome-dark surround boxes set into the +Z and -Z facets; the base plate is an
// 8-sided flat drum stretched to 0.16 x 0.14 m so its corners read as rounded.
export default function (THREE) {
  const g = new THREE.Group();
  const M = (color, o = {}, name) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0, ...o }); if (name) m.name = name; return m; };
  const put = (geo, mat, p, r) => { const m = new THREE.Mesh(geo, mat); if (p) m.position.set(p[0], p[1], p[2]); if (r) m.rotation.set(r[0], r[1], r[2]); g.add(m); return m; };
  const white = M(0xe8e4da, { roughness: 0.35, flatShading: true });
  const rubber = M(0x1a1a1c, { roughness: 0.9, flatShading: true });
  const dark = M(0x2b2d31, { roughness: 0.4 });
  const red = M(0xd11c1c, { roughness: 0.3, emissive: 0xd11c1c, emissiveIntensity: 0.9 });
  const lens = M(0xe8e4da, { roughness: 0.3, emissive: 0xe8e4da, emissiveIntensity: 0.35 });
  // stretch: push every vertex outward on X by a constant, which turns a regular octagon into a
  // chamfered rectangle (long flat +Z/-Z facets for the lenses) rather than a squashed oval
  const stretch = (geo, s) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setX(i, x + Math.sign(x) * s); } geo.computeVertexNormals(); return geo; };
  // an 8-sided cylinder rotated so a flat facet faces +Z, then stretched on X
  const oct = (rt, rb, h, s) => stretch(new THREE.CylinderGeometry(rt, rb, h, 8).rotateY(Math.PI / 8), s);

  // an octagon's flat-to-flat size is 2 * r * cos(22.5 deg), so radii are set from the apothem
  const K = 1 / Math.cos(Math.PI / 8);
  // base plate: an 8-sided flat drum stretched to 0.16 x 0.14 in plan
  put(oct(0.07 * K, 0.07 * K, 0.01, 0.01), rubber, [0, 0.005, 0]);
  // housing: drum then chamfer frustum, 0.14 x 0.12 in plan, front facet 0.07 m long
  put(oct(0.06 * K, 0.06 * K, 0.022, 0.01), white, [0, 0.021, 0]);
  put(oct(0.038 * K, 0.06 * K, 0.013, 0.01), white, [0, 0.0385, 0]);
  // rubber gasket around the foot
  put(stretch(new THREE.TorusGeometry(0.062 * K, 0.007, 4, 8).rotateX(Math.PI / 2).rotateY(Math.PI / 8), 0.01), rubber, [0, 0.014, 0]);
  // lenses in dark surrounds on the +Z (tail red) and -Z (lane white) facets
  put(new THREE.BoxGeometry(0.07, 0.028, 0.012), dark, [0, 0.022, 0.055]);
  put(new THREE.BoxGeometry(0.06, 0.02, 0.008), red, [0, 0.022, 0.063]);
  put(new THREE.BoxGeometry(0.07, 0.028, 0.012), dark, [0, 0.022, -0.055]);
  put(new THREE.BoxGeometry(0.06, 0.02, 0.008), lens, [0, 0.022, -0.063]);

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
