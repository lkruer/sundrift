// tunnel_portal — candidate A: primitives around the one mandated extrusion.
// The face wall is an ExtrudeGeometry of a 10 x 6.8 rectangle with a Path hole (vertical sides
// 2.4 m, then a 4.1 m semicircle), no bevel, 0.6 m thick; everything else is boxes, an open
// half-cylinder lining with plane walls, half-torus lining rings and stepped wing-wall boxes.
// Front face is +Z. The wing walls run back from the face at 22 degrees off the tunnel axis
// (the brief's 30 degrees with 3.0 m walls pushes the envelope past 12 m against a 10 m width).
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (hex, rough, name, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: 0 }, extra || {}));
    if (name) m.name = name;
    return m;
  };
  const concrete = mat(0xa8a49c, 0.9, 'plaster');
  const tile = mat(0x4a4f5a, 0.8, 'tile');
  const lining = mat(0x2b2d31, 0.9, null, { side: THREE.DoubleSide });

  const box = (w, h, d, x, y, z, m, parent) => {
    const n = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    n.position.set(x, y, z); (parent || g).add(n); return n;
  };

  // --- face wall: rectangle with the round-topped opening as a Path hole ---------
  // The hole floor sits 0.04 m up so it does not touch the outline (a hole on the boundary
  // breaks the cap triangulation); that strip is the threshold sill.
  const face = new THREE.Shape();
  face.moveTo(-5, 0); face.lineTo(5, 0); face.lineTo(5, 6.8); face.lineTo(-5, 6.8); face.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-4.1, 0.04); hole.lineTo(-4.1, 2.4);
  hole.absarc(0, 2.4, 4.1, Math.PI, 0, true);
  hole.lineTo(4.1, 0.04); hole.closePath();
  face.holes.push(hole);
  const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(face, { depth: 0.6, bevelEnabled: false, curveSegments: 16 }), concrete);
  wall.position.z = -0.6;                      // front face on z = 0, wall runs back to -0.6
  g.add(wall);

  // pilasters at the face ends and the parapet coping along the top
  for (const s of [1, -1]) box(0.5, 6.8, 0.15, s * 4.75, 3.4, 0.075, concrete);
  box(10.0, 0.4, 0.8, 0, 7.0, -0.3, tile);

  // --- lining: open half-cylinder over plane walls, 3.0 m deep, chrome dark, both sides ---
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.1, 3.0, 16, 1, true, -Math.PI / 2, Math.PI), lining);
  tube.rotation.x = -Math.PI / 2;              // axis along z, open half facing up
  tube.position.set(0, 2.4, -1.5);
  g.add(tube);
  for (const s of [1, -1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.4), lining);
    w.rotation.y = s * Math.PI / 2;
    w.position.set(s * 4.1, 1.2, -1.5);
    g.add(w);
  }
  // lining rings (segment joints) and their wall ribs, so the bore reads as built, inside and out
  for (const z of [-0.68, -1.8, -2.93]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(4.15, 0.07, 6, 16, Math.PI), concrete);
    r.position.set(0, 2.4, z);
    g.add(r);
    for (const s of [1, -1]) box(0.14, 2.4, 0.14, s * 4.1, 1.2, z, concrete);
  }
  // kerbs along each side of the floor inside
  for (const s of [1, -1]) box(0.5, 0.3, 3.0, s * 3.85, 0.15, -1.5, concrete);

  // --- wing walls: three steps 5.0 / 4.0 / 3.0 m, 1.0 m each, with a tile cap on every step ---
  const TH = 22 * Math.PI / 180;
  for (const s of [1, -1]) {
    const wing = new THREE.Group();
    wing.position.set(s * 4.45, 0, -0.3);
    wing.rotation.y = Math.PI / 2 - s * TH;    // local +x runs back and outward
    g.add(wing);
    [5.0, 4.0, 3.0].forEach((h, i) => {
      box(1.0, h, 0.6, 0.5 + i, h / 2, 0, concrete, wing);
      box(1.0, 0.15, 0.7, 0.5 + i, h + 0.075, 0, tile, wing);
    });
  }

  // --- ground and centre by measuring vertices -----------------------------------
  const bb = new THREE.Box3(), v = new THREE.Vector3(), m4 = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const put = (mt) => { for (let i = 0; i < p.count; i++) bb.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mt)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); put(m4.multiplyMatrices(n.matrixWorld, im)); } return; }
    put(n.matrixWorld);
  });
  const ctr = bb.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= ctr.x; o.position.y -= bb.min.y; o.position.z -= ctr.z; });
  return g;
}
