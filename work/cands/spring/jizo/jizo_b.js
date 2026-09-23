// jizo_b — profiles. One LatheGeometry runs from the hem up the robe, over the shoulders, up the neck and
// round the head to the crown; below the shoulders it is squashed to an oval (0.76 deep), easing back to
// round at the neck. The base is an octagonal stepped lathe with a chamfered top on a recessed chrome-dark
// footing (the dark line against the ground). The bib is a partial lathe of a CLOSED profile (so it has a
// 13 mm thickness) following the chest 3 mm off it, warped so its hem is a U; the neck tie, its knot and the
// knitted cap (rolled brim, dome, pompom) are lathes too. Sleeves are TubeGeometry sweeps from shoulder to
// elbow to wrist, ending inside the joined palms, which are an extruded side-profile Shape; the ear lobes are
// flattened lens-shaped lathes and the tie's two tails extruded Shapes. Front faces +Z.
export default function (THREE) {
  const g = new THREE.Group();

  const stone = new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.95, metalness: 0, flatShading: true });
  stone.name = 'stone';
  // double sided: the bib is a partial lathe whose two side edges are open
  const fabric = new THREE.MeshStandardMaterial({ color: 0xc9402b, roughness: 0.9, metalness: 0, flatShading: true, side: THREE.DoubleSide });
  fabric.name = 'fabric';
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.6, metalness: 0, flatShading: true });

  const add = (geo, m, x = 0, y = 0, z = 0) => {
    const n = new THREE.Mesh(geo, m); n.position.set(x, y, z); g.add(n); return n;
  };
  const V = (x, y) => new THREE.Vector2(x, y);

  // oval below the shoulders, round from the neck up
  const squash = (y) => (y <= 0.44 ? 0.76 : y >= 0.465 ? 1 : 0.76 + 0.24 * (y - 0.44) / 0.025);
  const warp = (geo) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * squash(p.getY(i)));
    p.needsUpdate = true; geo.computeVertexNormals();
    return geo;
  };

  // --- footing and base: octagons (8-segment lathes turned PI/8 so a flat faces +Z), 0.34 wide, 0.9 as deep
  const OCT = Math.PI / 8;
  add(new THREE.LatheGeometry([V(0, 0), V(0.158, 0), V(0.158, 0.035), V(0, 0.035)], 8, OCT), dark).scale.z = 0.9;
  add(new THREE.LatheGeometry([V(0, 0.035), V(0.184, 0.035), V(0.184, 0.086), V(0.166, 0.099), V(0.15, 0.099),
    V(0.15, 0.121), V(0.132, 0.134), V(0, 0.134)], 8, OCT), stone).scale.z = 0.9;

  // --- the figure: hem, robe, shoulders, neck, then round the head (radius 0.1 about y = 0.575) to the crown
  const HY = 0.575, HR = 0.1;
  const robe = [V(0, 0.132), V(0.112, 0.132), V(0.12, 0.21), V(0.128, 0.3), V(0.134, 0.385), V(0.131, 0.423),
    V(0.114, 0.451), V(0.084, 0.467), V(0.061, 0.476), V(0.057, 0.489)];
  const fig = robe.slice();
  for (let i = 0; i <= 5; i++) { const f = 0.62 + (i / 5) * (Math.PI - 0.62); fig.push(V(HR * Math.sin(f), HY - HR * Math.cos(f))); }
  add(warp(new THREE.LatheGeometry(fig, 12)), stone);
  // the robe's radius at height y, for the bib to follow
  const robeR = (y) => {
    for (let i = 1; i < robe.length; i++) {
      const a = robe[i - 1], b = robe[i];
      if (y >= a.y && y <= b.y) return a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y);
    }
    return robe[robe.length - 1].x;
  };

  // --- bib: closed profile 3 to 16 mm off the chest from the neck (0.476) to 0.345, over +-62 degrees,
  //     then its hem lifted toward the sides into a U and the whole squashed like the robe
  const BT = 0.476, BB = 0.345, BPHI = 1.08;
  const ys = [0.476, 0.458, 0.43, 0.39, 0.345];
  const bibPts = [];
  ys.forEach((y) => bibPts.push(V(robeR(y) + 0.016, y)));           // outer face, top to hem
  ys.slice().reverse().forEach((y) => bibPts.push(V(robeR(y) + 0.003, y)));   // inner face, hem to top
  bibPts.push(bibPts[0].clone());
  // reversed, the loop runs counter-clockwise in (r, y): outer face going up, so every face points out
  const bib = new THREE.LatheGeometry(bibPts.reverse(), 8, -BPHI, 2 * BPHI);
  {
    const p = bib.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const phi = Math.atan2(x, z), r = Math.hypot(x, z), off = r - robeR(y);
      const u = phi / BPHI, t = (BT - y) / (BT - BB);
      const y2 = BT - t * ((BT - BB) - 0.075 * u * u);
      const r2 = robeR(y2) + off;
      p.setXYZ(i, r2 * Math.sin(phi), y2, r2 * Math.cos(phi));
    }
  }
  add(warp(bib), fabric);

  // --- neck tie (a lathe of a circle, counter-clockwise) with its knot and two extruded tails at the back
  const ring = [];
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI * 2; ring.push(V(0.063 + 0.015 * Math.cos(a), 0.471 + 0.015 * Math.sin(a))); }
  add(warp(new THREE.LatheGeometry(ring, 10)), fabric);
  const knot = [];
  for (let i = 0; i <= 4; i++) { const a = (i / 4) * Math.PI; knot.push(V(0.027 * Math.sin(a), -0.024 * Math.cos(a))); }
  const kn = add(new THREE.LatheGeometry(knot, 6), fabric, 0, 0.47, -0.074);
  kn.rotation.x = Math.PI / 2;
  const tailShape = new THREE.Shape();
  tailShape.moveTo(-0.021, 0); tailShape.lineTo(0.021, 0); tailShape.lineTo(0.024, -0.095);
  tailShape.lineTo(0, -0.078); tailShape.lineTo(-0.024, -0.095); tailShape.closePath();
  for (const s of [1, -1]) {
    const tg = new THREE.ExtrudeGeometry(tailShape, { depth: 0.014, bevelEnabled: false });
    tg.translate(0, 0, -0.007);
    const t = add(tg, fabric, s * 0.024, 0.468, -0.088);
    t.rotation.set(0.4, 0, s * 0.3);                           // splay out, hems swung back down the back
  }

  // --- sleeves: tubes from deep inside the body, out to the elbow, forward and in to inside the palms
  //     (both open ends are buried: one in the robe, one in the palms)
  for (const s of [1, -1]) {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 0.07, 0.385, 0.0), new THREE.Vector3(s * 0.128, 0.345, 0.005),
      new THREE.Vector3(s * 0.13, 0.31, 0.04), new THREE.Vector3(s * 0.07, 0.325, 0.1), new THREE.Vector3(s * 0.012, 0.34, 0.125),
    ]);
    add(new THREE.TubeGeometry(path, 8, 0.035, 5, false), stone);
  }
  // joined palms: the side profile of two hands pressed together, extruded 0.064 across
  const palm = new THREE.Shape();
  palm.moveTo(0.088, 0.298); palm.lineTo(0.15, 0.303);
  palm.quadraticCurveTo(0.176, 0.35, 0.16, 0.418);
  palm.quadraticCurveTo(0.118, 0.392, 0.092, 0.37);
  palm.closePath();
  const pg = new THREE.ExtrudeGeometry(palm, { depth: 0.064, bevelEnabled: false, curveSegments: 4 });
  pg.rotateY(-Math.PI / 2);                                   // shape x -> world z, extrusion -> world -x
  add(pg, stone, 0.032, 0, 0);

  // --- ears: long lobes, a lens-shaped lathe either side of the head, flattened against it (an extruded
  //     ellipse read as a headphone cup)
  const earG = new THREE.LatheGeometry([V(0, -0.05), V(0.018, -0.032), V(0.023, 0), V(0.018, 0.034), V(0, 0.052)], 6);
  for (const s of [1, -1]) add(earG, stone, s * 0.1, HY - 0.028, 0.004).scale.x = 0.8;
  // nose
  add(new THREE.LatheGeometry([V(0, 0), V(0.017, 0.004), V(0, 0.022)], 5), stone, 0, HY - 0.012, 0.088).rotation.x = Math.PI / 2;

  // --- knitted cap: rolled brim, dome (radius 0.109 about the head centre), pompom to 0.75
  const cap = [V(0.097, 0.6), V(0.116, 0.598), V(0.125, 0.611), V(0.119, 0.626)];
  for (let i = 0; i <= 3; i++) { const f = 1.06 - (i / 3) * 0.82; cap.push(V(0.109 * Math.sin(f), HY + 0.109 * Math.cos(f))); }
  cap.push(V(0.034, 0.69), V(0.043, 0.712), V(0.031, 0.739), V(0, 0.75));
  add(new THREE.LatheGeometry(cap, 10), fabric);

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
