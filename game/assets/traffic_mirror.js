// traffic_mirror — WINNER (candidate B): profile route. Pole with its base flange in one LatheGeometry, hex-lathe
// bolts, a dark lathe clamp collar and a lathe bracket stub; the mirror (tilted sub-group, +12 deg pitches
// the face down) is three lathes: the convex face from a circular-arc profile, the vermilion rim from a
// 0.06 x 0.05 rectangular section, the chrome-dark back from a parabolic dish profile; the hood is an
// ExtrudeGeometry of an annular-sector Shape (120 degrees over the top), no bevel.
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
  const lathe = (pts, segs) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), segs);
  const galv = M(0xb9bcc0, { roughness: 0.5, metalness: 0.6 }, 'metal');
  const face = M(0xb9bcc0, { roughness: 0.15, metalness: 0.85 });
  const verm = M(0xc9402b);
  const dark = M(0x2b2d31, { roughness: 0.4 });

  const PZ = -0.16;
  // pole: base flange 0.26 dia, 0.07 shaft to 2.15, closed top, in one lathe; bolts; dark clamp collar
  put(lathe([[0, 0], [0.13, 0], [0.13, 0.02], [0.035, 0.02], [0.035, 2.15], [0, 2.15]], 10), galv, [0, 0, PZ]);
  const bolt = lathe([[0, 0], [0.013, 0], [0.013, 0.014], [0, 0.014]], 6);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(bolt, dark, [sx * 0.095, 0.02, PZ + sz * 0.095]);
  put(lathe([[0.035, -0.07], [0.046, -0.07], [0.046, 0.07], [0.035, 0.07], [0.035, -0.07]], 10), dark, [0, 2.10, PZ]);
  // bracket stub from the pole forward to the dish, axis turned to +Z
  put(lathe([[0, 0], [0.04, 0], [0.03, 0.13], [0, 0.13]], 10), galv, [0, 2.15, PZ], [Math.PI / 2, 0, 0]);

  const mir = new THREE.Group();
  mir.position.set(0, 2.15, 0);
  mir.rotation.x = 12 * Math.PI / 180;
  g.add(mir);
  // convex face: arc profile from the rim (r 0.40, z 0) up to the apex (r 0, z 0.06); lathe axis -> +Z
  const R = (0.4 * 0.4 + 0.06 * 0.06) / (2 * 0.06), th = Math.asin(0.4 / R);
  const arc = [];
  for (let i = 0; i <= 6; i++) { const a = th * (1 - i / 6); arc.push([R * Math.sin(a), 0.06 - R * (1 - Math.cos(a))]); }
  mesh(mir, lathe(arc, 20), face, [0, 0, 0], [Math.PI / 2, 0, 0]);
  // rim: rectangular section r 0.40..0.46, z -0.02..0.03
  mesh(mir, lathe([[0.40, -0.02], [0.46, -0.02], [0.46, 0.03], [0.40, 0.03], [0.40, -0.02]], 20), verm, [0, 0, 0], [Math.PI / 2, 0, 0]);
  // back: parabolic dish from the centre (z -0.06) out to the rim (r 0.40, z 0)
  const dish = [];
  for (let i = 0; i <= 5; i++) { const t = i / 5; dish.push([0.40 * t, -0.06 * (1 - t * t)]); }
  mesh(mir, lathe(dish, 20), dark, [0, 0, 0], [Math.PI / 2, 0, 0]);
  // mounting hardware on the back: stepped galvanised boss (lathe, axis -> -Z) and two strap bars
  mesh(mir, lathe([[0, 0], [0.10, 0], [0.10, 0.015], [0.06, 0.015], [0.06, 0.04], [0, 0.04]], 12), galv, [0, 0, -0.045], [-Math.PI / 2, 0, 0]);
  for (const y of [-0.13, 0.13]) mesh(mir, new THREE.BoxGeometry(0.34, 0.03, 0.02), galv, [0, y, -0.058]);
  // hood: annular sector r 0.44..0.48 over 30..150 degrees, extruded 0.16 forward from just behind the rim face
  const a0 = Math.PI / 6, a1 = 5 * Math.PI / 6;
  const hood = new THREE.Shape();
  hood.moveTo(0.48 * Math.cos(a0), 0.48 * Math.sin(a0));
  hood.absarc(0, 0, 0.48, a0, a1, false);
  hood.lineTo(0.44 * Math.cos(a1), 0.44 * Math.sin(a1));
  hood.absarc(0, 0, 0.44, a1, a0, true);
  hood.closePath();
  mesh(mir, new THREE.ExtrudeGeometry(hood, { depth: 0.16, bevelEnabled: false, curveSegments: 10 }), verm, [0, 0, -0.02]);

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
