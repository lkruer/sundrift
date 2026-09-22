// power_pole — candidate C: a different breakdown. The column is ONE hand-built BufferGeometry loft of
// 10-point rings: a root flare, the taper, and a raised joint band at 4.5 m where a two-piece Japanese
// concrete pole is spliced, capped at the top. The arms are braced: each box arm carries two diagonal
// galvanised struts down to the column, the way real pole arms are held. The transformer can hangs from a
// band clamp (an open 10-sided ring, DoubleSide) by two hanger bars and has a conical lid; insulators are
// a 6-sided cone skirt under a low-poly sphere; a dark open band marks the base.
export default function (THREE) {
  const g = new THREE.Group();
  const M = (color, o = {}, name) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0, ...o }); if (name) m.name = name; return m; };
  const put = (geo, mat, p, r) => { const m = new THREE.Mesh(geo, mat); if (p) m.position.set(p[0], p[1], p[2]); if (r) m.rotation.set(r[0], r[1], r[2]); g.add(m); return m; };
  const concrete = M(0xa8a49c, { roughness: 0.9 }, 'plaster');
  const galv = M(0xb9bcc0, { roughness: 0.5, metalness: 0.6 }, 'metal');
  const white = M(0xe8e4da, { roughness: 0.35 });
  const dark = M(0x2b2d31, { roughness: 0.4 });
  const darkDS = M(0x2b2d31, { roughness: 0.4, side: THREE.DoubleSide });
  const galvDS = M(0xb9bcc0, { roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide }, 'metal');
  const rAt = (y) => 0.15 - 0.055 * (y / 9);

  // column loft: rings (y, r) bottom to top, 10 points each, quad strips between, a fan cap on top
  const N = 10, rings = [[0, 0.17], [0.3, 0.155], [0.6, 0.146], [4.44, rAt(4.44)], [4.5, rAt(4.5) + 0.016], [4.56, rAt(4.56)], [9.0, 0.095]];
  const pos = [], idx = [];
  rings.forEach(([y, r]) => { for (let i = 0; i < N; i++) { const t = (i / N) * Math.PI * 2; pos.push(Math.cos(t) * r, y, Math.sin(t) * r); } });
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < N; i++) {
    const j = (i + 1) % N, lo = k * N, hi = (k + 1) * N;
    idx.push(lo + i, hi + j, hi + i, lo + i, lo + j, hi + j);
  }
  const top = (rings.length - 1) * N, cap = pos.length / 3;
  pos.push(0, 9.0, 0);
  for (let i = 0; i < N; i++) idx.push(top + i, top + (i + 1) % N, cap);
  const col = new THREE.BufferGeometry();
  col.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  col.setIndex(idx);
  col.computeVertexNormals();
  put(col, concrete);
  put(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 10, 1, true), darkDS, [0, 0.16, 0]);   // dark base band

  // a strut from point a to point b, 6 sides, open-ended (both ends are buried in arm and column)
  const strut = (a, b, r) => {
    const A = new THREE.Vector3(a[0], a[1], a[2]), B = new THREE.Vector3(b[0], b[1], b[2]), d = B.clone().sub(A), L = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 6, 1, true), galvDS);
    m.position.copy(A).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    g.add(m);
  };
  // insulator: open cone skirt (foot on the arm, top inside the head) under a low-poly sphere
  const whiteDS = M(0xe8e4da, { roughness: 0.35, side: THREE.DoubleSide });
  const insulator = (x, y) => {
    put(new THREE.CylinderGeometry(0.015, 0.042, 0.07, 6, 1, true), whiteDS, [x, y + 0.035, 0]);
    put(new THREE.SphereGeometry(0.04, 5, 3), white, [x, y + 0.095, 0]);
  };
  const arm = (y, len, xs) => {
    put(new THREE.BoxGeometry(len, 0.08, 0.08), galv, [0, y, 0]);
    const r = rAt(y - 0.45);
    strut([r - 0.03, y - 0.45, 0], [len / 2 - 0.12, y - 0.04, 0], 0.02);
    strut([-r + 0.03, y - 0.45, 0], [-len / 2 + 0.12, y - 0.04, 0], 0.02);
    for (const x of xs) insulator(x, y + 0.04);
  };
  arm(8.4, 0.9, [-0.36, 0.36]);
  arm(7.6, 0.6, [-0.22, 0.22]);
  insulator(0, 9.0);

  // transformer can on +X at 7 m: band clamp on the column, two hanger bars, 8-sided can, conical lid
  const cx = 0.29, rc = rAt(7.35);
  put(new THREE.CylinderGeometry(rc + 0.02, rc + 0.02, 0.08, 10, 1, true), galvDS, [0, 7.35, 0]);
  put(new THREE.BoxGeometry(0.05, 0.3, 0.05), galv, [rc + 0.03, 7.2, 0.09]);
  put(new THREE.BoxGeometry(0.05, 0.3, 0.05), galv, [rc + 0.03, 7.2, -0.09]);
  put(new THREE.BoxGeometry(0.2, 0.05, 0.24), galv, [cx - 0.08, 7.32, 0]);
  put(new THREE.CylinderGeometry(0.175, 0.175, 0.6, 8), dark, [cx, 7.0, 0]);
  put(new THREE.CylinderGeometry(0.11, 0.185, 0.05, 8), dark, [cx, 7.32, 0]);
  put(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6), white, [cx - 0.07, 7.38, 0]);
  put(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6), white, [cx + 0.07, 7.38, 0]);

  // step bolts with hex nuts on the ends
  put(new THREE.CylinderGeometry(0.02, 0.02, 0.26, 6), galv, [0.14, 2.0, 0], [0, 0, Math.PI / 2]);
  put(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 6), galv, [0.27, 2.0, 0], [0, 0, Math.PI / 2]);
  put(new THREE.CylinderGeometry(0.02, 0.02, 0.26, 6), galv, [-0.14, 2.5, 0], [0, 0, Math.PI / 2]);
  put(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 6), galv, [-0.27, 2.5, 0], [0, 0, Math.PI / 2]);

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
