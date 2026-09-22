// tunnel_portal — candidate C: a different breakdown.
// The face is two box piers plus a spandrel whose OUTLINE carries the arch (rectangle minus the
// half-disc, no hole), so the opening is truly open to the road at y = 0 with no sill. A concrete
// hood ring projects 0.35 m in front of the arch (bell-mouth portal). The lining is a hand-built
// loft: a 19-point arch section (walls + 16-segment semicircle) skinned along ten rings whose
// radius steps out twice to form recessed joint bands. Wing walls step down in four treads;
// the coping sits on a concrete cornice band. Front face is +Z; wings flare 22 degrees.
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (hex, rough, name, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: 0 }, extra || {}));
    if (name) m.name = name;
    return m;
  };
  const concrete = mat(0xa8a49c, 0.9, 'plaster');
  const tile = mat(0x4a4f5a, 0.8, 'tile');
  const lining = mat(0x2b2d31, 0.9, null, { side: THREE.DoubleSide, flatShading: true });

  const box = (w, h, d, x, y, z, m, parent) => {
    const n = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    n.position.set(x, y, z); (parent || g).add(n); return n;
  };
  const extrude = (shape, depth, m, segs) => new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: segs || 16 }), m);

  // --- face: piers, and a spandrel whose bottom edge is the arch ------------------
  for (const s of [1, -1]) box(0.9, 2.4, 0.6, s * 4.55, 1.2, -0.3, concrete);
  const sp = new THREE.Shape();
  sp.moveTo(-5, 2.4); sp.lineTo(-4.1, 2.4); sp.absarc(0, 2.4, 4.1, Math.PI, 0, true);
  sp.lineTo(5, 2.4); sp.lineTo(5, 6.8); sp.lineTo(-5, 6.8); sp.closePath();
  const spandrel = extrude(sp, 0.6, concrete); spandrel.position.z = -0.6; g.add(spandrel);

  // hood ring: a U band from radius 4.1 to 4.7, projecting 0.35 m in front of the face
  const hood = new THREE.Shape();
  hood.moveTo(-4.7, 0); hood.lineTo(-4.7, 2.4); hood.absarc(0, 2.4, 4.7, Math.PI, 0, true); hood.lineTo(4.7, 0);
  hood.lineTo(4.1, 0); hood.lineTo(4.1, 2.4); hood.absarc(0, 2.4, 4.1, 0, Math.PI, false); hood.lineTo(-4.1, 0);
  hood.closePath();
  g.add(extrude(hood, 0.35, concrete));

  // cornice band and the tile coping on top of it
  box(10.0, 0.15, 0.75, 0, 6.725, -0.3, concrete);
  box(10.0, 0.4, 0.8, 0, 7.0, -0.3, tile);

  // --- lining: lofted arch section, 3.0 m deep, with two recessed joint bands ---
  const section = (z, r) => {
    const pts = [[-r, 0, z]];
    for (let k = 0; k <= 16; k++) { const a = Math.PI - k * Math.PI / 16; pts.push([r * Math.cos(a), 2.4 + r * Math.sin(a), z]); }
    pts.push([r, 0, z]);
    return pts;
  };
  const rings = [[0, 4.1], [-0.6, 4.1], [-0.6, 4.22], [-1.0, 4.22], [-1.0, 4.1], [-1.8, 4.1], [-1.8, 4.22], [-2.2, 4.22], [-2.2, 4.1], [-3.0, 4.1]];
  {
    const secs = rings.map(([z, r]) => section(z, r));
    const N = secs[0].length, pos = [], idx = [];
    for (const sec of secs) for (const p of sec) pos.push(p[0], p[1], p[2]);
    for (let i = 0; i < secs.length - 1; i++) for (let k = 0; k < N - 1; k++) {
      const a = i * N + k, b = a + 1, c = (i + 1) * N + k + 1, d = (i + 1) * N + k;
      idx.push(a, b, c, a, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const flat = geo.toNonIndexed(); flat.computeVertexNormals();
    g.add(new THREE.Mesh(flat, lining));
  }
  // kerbs with a chamfered top, along each side inside
  for (const s of [1, -1]) {
    box(0.5, 0.22, 3.0, s * 3.85, 0.11, -1.5, concrete);
    box(0.42, 0.08, 3.0, s * 3.89, 0.26, -1.5, concrete);
  }

  // --- wing walls: four treads from 5.0 m down to 3.0 m, tile cap on each -----------
  const TH = 22 * Math.PI / 180;
  for (const s of [1, -1]) {
    const wing = new THREE.Group();
    wing.position.set(s * 4.45, 0, -0.3);
    wing.rotation.y = Math.PI / 2 - s * TH;
    g.add(wing);
    for (let i = 0; i < 4; i++) {
      const h = 5.0 - i * (2.0 / 3);
      box(0.75, h, 0.6, 0.375 + i * 0.75, h / 2, 0, concrete, wing);
      box(0.75, 0.15, 0.7, 0.375 + i * 0.75, h + 0.075, 0, tile, wing);
    }
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
