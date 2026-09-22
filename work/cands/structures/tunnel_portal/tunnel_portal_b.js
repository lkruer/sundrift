// tunnel_portal — candidate B: profile route.
// Everything is an ExtrudeGeometry of a Shape, no bevels. The face wall is the brief's rectangle
// with a Path hole; the lining is a solid arch BAND (outer arch 4.25 m over an inner arch 4.1 m,
// one U-shaped outline) extruded 3.0 m; the lining rings are thinner bands of the same family;
// the coping is a drip-edged cross-section extruded along the face; the wing walls are stepped
// side-elevation profiles extruded to 0.6 m thick with a stepped tile cap; the kerbs are a
// chamfered cross-section extruded along the bore. Front face is +Z; wings flare 22 degrees.
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

  const extrude = (shape, depth, m, segs) => new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: segs || 16 }), m);
  const poly = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s; };
  // a U-shaped arch band: vertical legs to 2.4 m, then semicircles of radius ro outside and ri inside
  const archBand = (ri, ro) => {
    const s = new THREE.Shape();
    s.moveTo(-ro, 0); s.lineTo(-ro, 2.4); s.absarc(0, 2.4, ro, Math.PI, 0, true); s.lineTo(ro, 0);
    s.lineTo(ri, 0); s.lineTo(ri, 2.4); s.absarc(0, 2.4, ri, 0, Math.PI, false); s.lineTo(-ri, 0);
    s.closePath();
    return s;
  };

  // --- face wall with the Path hole (hole floor 0.04 m up: the threshold sill) ---
  const face = poly([[-5, 0], [5, 0], [5, 6.8], [-5, 6.8]]);
  const hole = new THREE.Path();
  hole.moveTo(-4.1, 0.04); hole.lineTo(-4.1, 2.4);
  hole.absarc(0, 2.4, 4.1, Math.PI, 0, true);
  hole.lineTo(4.1, 0.04); hole.closePath();
  face.holes.push(hole);
  const wall = extrude(face, 0.6, concrete); wall.position.z = -0.6; g.add(wall);
  for (const s of [1, -1]) {                                     // pilasters at the face ends
    const p = extrude(poly([[-0.25, 0], [0.25, 0], [0.25, 6.8], [-0.25, 6.8]]), 0.15, concrete);
    p.position.set(s * 4.75, 0, 0); g.add(p);
  }

  // --- coping: drip-edged section run along the whole face --------------------
  const cop = extrude(poly([[-0.4, 6.8], [0.4, 6.8], [0.4, 7.06], [0.3, 7.2], [-0.3, 7.2], [-0.4, 7.06]]), 10.0, tile);
  cop.rotation.y = Math.PI / 2;                                    // local z (10 m) -> world x
  cop.position.set(-5.0, 0, -0.3);
  g.add(cop);

  // --- lining: a solid arch band 3.0 m deep, plus three joint rings proud inside and out ---
  const bore = extrude(archBand(4.1, 4.25), 3.0, lining); bore.position.z = -3.0; g.add(bore);
  for (const z of [-0.68, -1.8, -2.93]) {
    const r = extrude(archBand(3.98, 4.37), 0.16, concrete); r.position.z = z - 0.08; g.add(r);
  }

  // --- kerbs: chamfered section along each side of the floor ---------------------
  for (const s of [1, -1]) {
    const k = extrude(poly([[s * 3.6, 0], [s * 4.1, 0], [s * 4.1, 0.3], [s * 3.68, 0.3], [s * 3.6, 0.22]]), 3.0, concrete);
    k.position.z = -3.0; g.add(k);
  }

  // --- wing walls: stepped elevation 5.0 / 4.0 / 3.0 m, extruded 0.6 m, tile cap on the steps ---
  const TH = 22 * Math.PI / 180;
  const stepped = poly([[0, 0], [3, 0], [3, 3], [2, 3], [2, 4], [1, 4], [1, 5], [0, 5]]);
  const capShape = poly([[0, 5], [1, 5], [1, 4], [2, 4], [2, 3], [3, 3], [3, 3.15], [2, 3.15], [2, 4.15], [1, 4.15], [1, 5.15], [0, 5.15]]);
  for (const s of [1, -1]) {
    const wing = new THREE.Group();
    wing.position.set(s * 4.45, 0, -0.3);
    wing.rotation.y = Math.PI / 2 - s * TH;                       // local +x runs back and outward
    g.add(wing);
    const w = extrude(stepped, 0.6, concrete); w.position.z = -0.3; wing.add(w);
    const c = extrude(capShape, 0.7, tile); c.position.z = -0.35; wing.add(c);
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
