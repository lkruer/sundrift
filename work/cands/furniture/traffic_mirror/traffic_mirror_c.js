// traffic_mirror — candidate C: a different part breakdown. The rim is a flat-band ring (open cylinder
// wall plus a flat front annulus) instead of a round bead; the hood is a thin curved SHELL (an open
// cylinder sector, DoubleSide) with a rolled lip torus on its front edge; the back is a dark cone dish with
// a flat mounting boss; the mirror hangs off an L-bracket with a dark back plate; the pole has a dark
// rubber foot sleeve and a two-band clamp. Tilted sub-group, +12 deg pitches the face down.
export default function (THREE) {
  const g = new THREE.Group();
  const M = (color, o = {}, name) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.0, ...o });
    if (name) m.name = name;
    return m;
  };
  const mesh = (parent, geo, mat, p, r) => {
    const m = new THREE.Mesh(geo, mat);
    if (p) m.position.set(p[0], p[1], p[2]);
    if (r) m.rotation.set(r[0], r[1], r[2]);
    parent.add(m);
    return m;
  };
  const put = (geo, mat, p, r) => mesh(g, geo, mat, p, r);
  const galv   = M(0xb9bcc0, { roughness: 0.5, metalness: 0.6 }, 'metal');
  const face   = M(0xb9bcc0, { roughness: 0.15, metalness: 0.85, side: THREE.DoubleSide });
  const verm   = M(0xc9402b);
  const vermDS = M(0xc9402b, { side: THREE.DoubleSide });
  const dark   = M(0x2b2d31, { roughness: 0.4 });
  const rubber = M(0x1a1a1c, { roughness: 0.9 });

  const PZ = -0.16;
  // pole on a base plate, rubber foot sleeve, two dark clamp bands and a cap
  put(new THREE.BoxGeometry(0.26, 0.02, 0.26), galv, [0, 0.01, PZ]);
  put(new THREE.CylinderGeometry(0.035, 0.035, 2.15, 10), galv, [0, 1.075, PZ]);
  put(new THREE.CylinderGeometry(0.05, 0.055, 0.12, 10), rubber, [0, 0.08, PZ]);
  for (const y of [2.06, 2.13]) put(new THREE.CylinderGeometry(0.044, 0.044, 0.035, 10), dark, [0, y, PZ]);
  put(new THREE.SphereGeometry(0.035, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), galv, [0, 2.15, PZ]);
  // L-bracket: horizontal arm from the pole to the dish, dark back plate on the dish
  put(new THREE.BoxGeometry(0.05, 0.05, 0.14), galv, [0, 2.15, PZ + 0.07]);
  put(new THREE.BoxGeometry(0.14, 0.14, 0.02), dark, [0, 2.15, -0.06]);

  const mir = new THREE.Group();
  mir.position.set(0, 2.15, 0);
  mir.rotation.x = 12 * Math.PI / 180;
  g.add(mir);
  const R = (0.4 * 0.4 + 0.06 * 0.06) / (2 * 0.06), th = Math.asin(0.4 / R);
  mesh(mir, new THREE.SphereGeometry(R, 16, 4, 0, Math.PI * 2, 0, th), face, [0, 0, 0.06 - R], [Math.PI / 2, 0, 0]);
  // flat-band rim: outer wall 0.46 radius, 0.05 deep (z -0.02..0.03), flat annulus 0.40..0.46 on its front
  mesh(mir, new THREE.CylinderGeometry(0.46, 0.46, 0.05, 20, 1, true), vermDS, [0, 0, 0.005], [Math.PI / 2, 0, 0]);
  mesh(mir, new THREE.RingGeometry(0.40, 0.46, 20), vermDS, [0, 0, 0.03]);
  // back: cone dish r 0.40 -> 0.14 over 0.06, with a flat boss disc
  mesh(mir, new THREE.CylinderGeometry(0.14, 0.40, 0.06, 16), dark, [0, 0, -0.03], [-Math.PI / 2, 0, 0]);
  mesh(mir, new THREE.CylinderGeometry(0.10, 0.10, 0.02, 12), dark, [0, 0, -0.07], [Math.PI / 2, 0, 0]);
  // hood: open cylindrical shell over the top 120 degrees, z -0.02..0.14, with a rolled lip on its front edge
  mesh(mir, new THREE.CylinderGeometry(0.47, 0.47, 0.16, 12, 1, true, 2 * Math.PI / 3, 2 * Math.PI / 3), vermDS, [0, 0, 0.06], [Math.PI / 2, 0, 0]);
  mesh(mir, new THREE.TorusGeometry(0.47, 0.02, 5, 12, 2 * Math.PI / 3), verm, [0, 0, 0.14], [0, 0, Math.PI / 6]);

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
