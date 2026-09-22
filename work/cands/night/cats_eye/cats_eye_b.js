// cats_eye — candidate B: profiles. The housing is ONE 10-segment LatheGeometry of a shallow dome profile
// (bottom to top: foot, shoulder, crown) scaled 0.14/0.12 on X into an oval, sitting in a rubber lathe
// gasket ring (open on its inner edge, DoubleSide); the two reflector lenses and their chrome-dark
// surrounds are extruded rounded-rectangle Shapes tilted back to follow the dome; the base plate is an
// extruded rounded rectangle 0.16 x 0.14 m, 0.01 m thick. No bevels anywhere.
export default function (THREE) {
  const g = new THREE.Group();
  const M = (color, o = {}, name) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0, ...o }); if (name) m.name = name; return m; };
  const put = (geo, mat, p, r) => { const m = new THREE.Mesh(geo, mat); if (p) m.position.set(p[0], p[1], p[2]); if (r) m.rotation.set(r[0], r[1], r[2]); g.add(m); return m; };
  const lathe = (pts, segs) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), segs);
  const rrect = (w, h, r) => {
    const s = new THREE.Shape(), x = w / 2, y = h / 2;
    s.moveTo(-x + r, -y); s.lineTo(x - r, -y); s.quadraticCurveTo(x, -y, x, -y + r);
    s.lineTo(x, y - r); s.quadraticCurveTo(x, y, x - r, y);
    s.lineTo(-x + r, y); s.quadraticCurveTo(-x, y, -x, y - r);
    s.lineTo(-x, -y + r); s.quadraticCurveTo(-x, -y, -x + r, -y);
    return s;
  };
  const extrude = (shape, depth, cs) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: cs });
  const white = M(0xe8e4da, { roughness: 0.35 });
  const rubber = M(0x1a1a1c, { roughness: 0.9 });
  const rubberDS = M(0x1a1a1c, { roughness: 0.9, side: THREE.DoubleSide });
  const dark = M(0x2b2d31, { roughness: 0.4 });
  const red = M(0xd11c1c, { roughness: 0.3, emissive: 0xd11c1c, emissiveIntensity: 0.9 });
  const lens = M(0xe8e4da, { roughness: 0.3, emissive: 0xe8e4da, emissiveIntensity: 0.35 });
  const SX = 0.14 / 0.12;

  // base plate: rounded rectangle extruded up (rotation.x = -PI/2 turns extrude depth into +Y)
  put(extrude(rrect(0.16, 0.14, 0.02), 0.01, 2), rubber, [0, 0, 0], [-Math.PI / 2, 0, 0]);
  // dome housing on the plate, oval in plan
  const dome = lathe([[0, 0.01], [0.058, 0.01], [0.06, 0.018], [0.056, 0.03], [0.04, 0.04], [0, 0.045]], 10);
  dome.scale(SX, 1, 1);
  put(dome, white);
  // rubber gasket ring around the foot of the dome
  const gasket = lathe([[0.06, 0.01], [0.068, 0.01], [0.068, 0.016], [0.058, 0.024]], 10);
  gasket.scale(SX, 1, 1);
  put(gasket, rubberDS);
  // lenses: tail red on +Z, lane white on -Z, in dark surrounds, tilted back 30 degrees to sit on the dome
  const T = 30 * Math.PI / 180;
  put(extrude(rrect(0.074, 0.028, 0.006), 0.012, 1), dark, [0, 0.023, 0.047], [-T, 0, 0]);
  put(extrude(rrect(0.06, 0.02, 0.005), 0.006, 1), red, [0, 0.023, 0.057], [-T, 0, 0]);
  put(extrude(rrect(0.074, 0.028, 0.006), 0.012, 1), dark, [0, 0.023, -0.047], [T, Math.PI, 0]);
  put(extrude(rrect(0.06, 0.02, 0.005), 0.006, 1), lens, [0, 0.023, -0.057], [T, Math.PI, 0]);

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
