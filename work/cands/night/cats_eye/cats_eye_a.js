// cats_eye — candidate A: primitives. A stadium-plan housing from a box between two 8-sided cylinders
// (0.14 x 0.025 x 0.12 m, lane white) with a smaller stepped upper puck so the profile is a shallow wedge,
// a tail-red reflector lens on +Z and a lane-white lens on -Z, each in a chrome-dark surround, two rubber
// grip pads on the +X/-X ends (the housing detail the sides need) and a rubber base plate 0.16 x 0.01 x 0.14 m.
export default function (THREE) {
  const g = new THREE.Group();
  const M = (color, o = {}, name) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0, ...o }); if (name) m.name = name; return m; };
  const put = (geo, mat, p, r) => { const m = new THREE.Mesh(geo, mat); if (p) m.position.set(p[0], p[1], p[2]); if (r) m.rotation.set(r[0], r[1], r[2]); g.add(m); return m; };
  const white = M(0xe8e4da, { roughness: 0.35 });
  const rubber = M(0x1a1a1c, { roughness: 0.9 });
  const dark = M(0x2b2d31, { roughness: 0.4 });
  const red = M(0xd11c1c, { roughness: 0.3, emissive: 0xd11c1c, emissiveIntensity: 0.9 });
  const lens = M(0xe8e4da, { roughness: 0.3, emissive: 0xe8e4da, emissiveIntensity: 0.35 });

  // rubber base plate
  put(new THREE.BoxGeometry(0.16, 0.01, 0.14), rubber, [0, 0.005, 0]);
  // lower housing: a stadium 0.14 x 0.12 in plan, 0.025 tall from y = 0.01
  put(new THREE.BoxGeometry(0.02, 0.025, 0.12), white, [0, 0.0225, 0]);
  put(new THREE.CylinderGeometry(0.06, 0.06, 0.025, 8), white, [0.01, 0.0225, 0]);
  put(new THREE.CylinderGeometry(0.06, 0.06, 0.025, 8), white, [-0.01, 0.0225, 0]);
  // upper step: a smaller stadium, 0.01 tall, top at y = 0.045
  put(new THREE.BoxGeometry(0.02, 0.01, 0.08), white, [0, 0.04, 0]);
  put(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 8), white, [0.01, 0.04, 0]);
  put(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 8), white, [-0.01, 0.04, 0]);
  // reflector lenses in dark surrounds: tail red on +Z, lane white on -Z
  put(new THREE.BoxGeometry(0.074, 0.028, 0.012), dark, [0, 0.022, 0.056]);
  put(new THREE.BoxGeometry(0.06, 0.02, 0.008), red, [0, 0.022, 0.062]);
  put(new THREE.BoxGeometry(0.074, 0.028, 0.012), dark, [0, 0.022, -0.056]);
  put(new THREE.BoxGeometry(0.06, 0.02, 0.008), lens, [0, 0.022, -0.062]);
  // rubber grip pads on the ends
  put(new THREE.BoxGeometry(0.03, 0.02, 0.06), rubber, [0.065, 0.02, 0]);
  put(new THREE.BoxGeometry(0.03, 0.02, 0.06), rubber, [-0.065, 0.02, 0]);

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
