// chochin_b — profiles. The paper is nine LatheGeometry panels, one per gap between the eight bamboo hoops,
// each a three-point profile (hoop, sag, hoop) dipping 11 mm between hoops: the ridged lathe, one material.
// Each panel is its own lathe, so its normals break at every hoop and the ridge shades as a crisp line
// instead of being averaged away; the two end panels close to the axis inside the caps. The caps are
// extruded 10-gon Shapes; the hanging loop is an extruded ring Shape (a disc with a hole) standing in the YZ
// plane, so a rope run along X threads it.
export default function (THREE) {
  const g = new THREE.Group();

  const paper = new THREE.MeshStandardMaterial({ color: 0xd8342a, emissive: 0xffb070, emissiveIntensity: 1.0, roughness: 0.8, metalness: 0 });
  paper.name = 'lantern';
  const lacquer = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.4, metalness: 0 });

  const add = (geo, m, x = 0, y = 0, z = 0) => {
    const n = new THREE.Mesh(geo, m); n.position.set(x, y, z); g.add(n); return n;
  };
  const V = (x, y) => new THREE.Vector2(x, y);

  const S = 10;                                               // segments round the axis
  const CAP_H = 0.045, CAP_R = 0.112;
  const Y0 = 0.04, Y1 = 0.445, YC = (Y0 + Y1) / 2;
  const R = 0.17, B = 0.25;
  const rAt = (y) => R * Math.sqrt(Math.max(0, 1 - ((y - YC) / B) ** 2));

  // --- paper: panel k runs from hoop k to hoop k+1 (hoop 0 and hoop N+1 are the paper's ends in the caps)
  const N = 8, SAG = 0.011;
  const hy = (k) => Y0 + (k / (N + 1)) * (Y1 - Y0);
  for (let k = 0; k <= N; k++) {
    const ya = hy(k), yb = hy(k + 1), ym = (ya + yb) / 2;
    const pts = [];
    if (k === 0) pts.push(V(0, ya));
    pts.push(V(rAt(ya), ya), V(rAt(ym) - SAG, ym), V(rAt(yb), yb));
    if (k === N) pts.push(V(0, yb));
    add(new THREE.LatheGeometry(pts, S), paper);
  }

  // --- caps: a 10-gon Shape extruded 0.045 m, stood upright (extrusion +z turned to +y)
  const disc = (r, n) => {
    const s = new THREE.Shape();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (i === 0) s.moveTo(r * Math.sin(a), r * Math.cos(a)); else s.lineTo(r * Math.sin(a), r * Math.cos(a));
    }
    s.closePath();
    return s;
  };
  const capGeo = new THREE.ExtrudeGeometry(disc(CAP_R, S), { depth: CAP_H, bevelEnabled: false });
  capGeo.rotateX(-Math.PI / 2);
  add(capGeo, lacquer, 0, 0, 0);
  add(capGeo.clone(), lacquer, 0, Y1 - 0.005, 0);
  const TOP = Y1 - 0.005 + CAP_H;

  // --- loop: a ring Shape (outer 0.032, hole 0.018) extruded 0.022 m, set in the YZ plane on a lathe boss
  const ring = disc(0.032, 8);
  const hole = new THREE.Path();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    if (i === 0) hole.moveTo(0.018 * Math.sin(a), 0.018 * Math.cos(a)); else hole.lineTo(0.018 * Math.sin(a), 0.018 * Math.cos(a));
  }
  hole.closePath();
  ring.holes.push(hole);
  const loopGeo = new THREE.ExtrudeGeometry(ring, { depth: 0.022, bevelEnabled: false });
  loopGeo.translate(0, 0, -0.011);
  loopGeo.rotateY(Math.PI / 2);
  add(loopGeo, lacquer, 0, 0.55 - 0.032, 0);
  add(new THREE.LatheGeometry([V(0, 0), V(0.03, 0), V(0.024, 0.014), V(0, 0.014)], 8), lacquer, 0, TOP - 0.002, 0);

  // --- ground at y = 0 and centre on x/z by measuring vertices
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
