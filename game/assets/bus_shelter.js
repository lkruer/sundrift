// bus_shelter — WINNER (candidate C, a different breakdown): carpentry you can count. Every plank is its own board
// (0.18 m boards with 0.02 m gaps over a dark backing board, so the grooves are real gaps), the roof is
// five overlapping tile courses per slope stepping down over exposed cedar rafters, the gables are left
// open showing the king posts and ridge beam, the bench slab sits on two log rounds, the sign disc has a
// galvanised back plate and a torus rim on a post with a hex nut collar, and the lamp is a glowing tube in
// a dark trough. Dark sill logs at the foot of the walls.
export default function (THREE) {
  const g = new THREE.Group();
  const M = (color, o = {}, name) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0, ...o }); if (name) m.name = name; return m; };
  const put = (geo, mat, p, r) => { const m = new THREE.Mesh(geo, mat); if (p) m.position.set(p[0], p[1], p[2]); if (r) m.rotation.set(r[0], r[1], r[2]); g.add(m); return m; };
  const timber = M(0x7a5a3a, { roughness: 0.85 }, 'timber');
  const bark = M(0x5a3f2c, { roughness: 0.85 }, 'timber');
  const tile = M(0x4a4f5a, { roughness: 0.8 }, 'tile');
  const galv = M(0xb9bcc0, { roughness: 0.5, metalness: 0.6 }, 'metal');
  const dark = M(0x2b2d31, { roughness: 0.4 });
  const lamp = M(0xffcf7a, { roughness: 0.3, emissive: 0xffcf7a, emissiveIntensity: 1.2 });
  const box = (w, h, d, x, y, z, m, r) => put(new THREE.BoxGeometry(w, h, d), m, [x, y, z], r);
  const SL = Math.atan2(0.5, 0.8);

  // frame: posts, eave beams, tie beams, king posts, ridge beam; dark sill logs
  for (const x of [-1.25, 1.25]) for (const z of [-0.55, 0.55]) box(0.1, 2.3, 0.1, x, 1.15, z, timber);
  for (const z of [-0.55, 0.55]) box(2.6, 0.1, 0.1, 0, 2.3, z, timber);
  for (const x of [-1.25, 1.25]) box(0.1, 0.1, 1.2, x, 2.3, 0, timber);
  for (const x of [-1.25, 1.25]) box(0.1, 0.3, 0.1, x, 2.5, 0, timber);
  box(2.6, 0.1, 0.1, 0, 2.62, 0, timber);
  put(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), bark, [0, 0.06, -0.55], [0, 0, Math.PI / 2]);
  for (const x of [-1.25, 1.25]) put(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), bark, [x, 0.06, 0], [Math.PI / 2, 0, 0]);
  // roof: rafters under five overlapping tile courses per slope, ridge cap
  const down = new THREE.Vector3(0, -Math.sin(SL), Math.cos(SL)), up = new THREE.Vector3(0, Math.cos(SL), Math.sin(SL));
  for (const s of [1, -1]) {
    for (const x of [-1.35, -0.7, 0, 0.7, 1.35]) {
      const p = new THREE.Vector3(x, 2.7, 0).addScaledVector(down, 0.47).addScaledVector(up, -0.05); p.z *= s;
      box(0.06, 0.08, 0.9, p.x, p.y, p.z, bark, [s * SL, 0, 0]);
    }
    for (let k = 0; k < 5; k++) {
      const p = new THREE.Vector3(0, 2.7, 0).addScaledVector(down, 0.12 + k * 0.19).addScaledVector(up, 0.03 - k * 0.006); p.z *= s;
      box(3.0, 0.05, 0.24, p.x, p.y, p.z, tile, [s * SL, 0, 0]);
    }
  }
  box(3.0, 0.1, 0.2, 0, 2.73, 0, tile);
  // gable boards closing the ends: an extruded triangle (world z, y) swept 0.05 along +X
  for (const x of [-1.275, 1.225]) {
    const tri = new THREE.Shape(); tri.moveTo(-0.72, 2.35); tri.lineTo(0.72, 2.35); tri.lineTo(0, 2.7); tri.closePath();
    put(new THREE.ExtrudeGeometry(tri, { depth: 0.05, bevelEnabled: false }), timber, [x, 0, 0], [0, Math.PI / 2, 0]);
  }
  // walls: a dark core with eleven boards on BOTH faces and 0.02 m gaps, back and both sides
  const planks = (w, x, z, ry) => {
    const gr = new THREE.Group(); gr.position.set(x, 0, z); gr.rotation.y = ry; g.add(gr);
    const core = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, 0.02), dark); core.position.set(0, 1.2, 0); gr.add(core);
    for (const side of [-1, 1]) for (let k = 0; k < 11; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, 0.03), timber); m.position.set(0, 0.19 + k * 0.2, side * 0.025); gr.add(m); }
  };
  planks(2.4, 0, -0.52, 0);
  planks(1.0, -1.22, 0, Math.PI / 2);
  planks(1.0, 1.22, 0, -Math.PI / 2);
  // bench: slab on two log rounds
  box(2.4, 0.07, 0.4, 0, 0.385, -0.22, timber);
  for (const x of [-0.95, 0.95]) put(new THREE.CylinderGeometry(0.15, 0.15, 0.35, 8), bark, [x, 0.175, -0.22]);
  // sign: post with a hex collar, galvanised back plate, dark disc, torus rim, facing +Z
  put(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 8), galv, [1.65, 1.2, 0.35]);
  put(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 6), galv, [1.65, 0.025, 0.35]);
  put(new THREE.CylinderGeometry(0.26, 0.26, 0.02, 16), galv, [1.65, 2.1, 0.375], [Math.PI / 2, 0, 0]);
  put(new THREE.CylinderGeometry(0.23, 0.23, 0.03, 16), dark, [1.65, 2.1, 0.4], [Math.PI / 2, 0, 0]);
  put(new THREE.TorusGeometry(0.24, 0.02, 4, 16), galv, [1.65, 2.1, 0.4]);
  // lamp: glowing tube in a dark trough under the ridge beam
  box(0.96, 0.06, 0.12, 0, 2.54, 0, dark);
  put(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8), lamp, [0, 2.49, 0], [0, 0, Math.PI / 2]);

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
