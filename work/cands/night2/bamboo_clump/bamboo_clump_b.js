// bamboo_clump — candidate B: profiles along curves. Every culm is a hexagon Shape
// extruded along a QuadraticBezierCurve3 (closed caps, three steps), so the culms rise
// nearly straight and bow outward under their tufts instead of leaning as rods; the
// bow, the foot position and the height are all different on all nine. A node every
// 0.45 m is a 6-sided open cone cup (rim upward) seated on the curve's tangent. Each
// leaf blob is a pointed kite Shape extruded 0.3 m thick (0.34 x 0.9 x 0.3 m), three
// per culm, hanging down and sideways. ONE stem material, ONE foliage material.
//
// Budget note: 27 blobs at icosahedron detail 1 alone would be 2,160 triangles, above
// the 1,400 cap, so the blobs are 12-triangle kites and the ~100 nodes 6-triangle cups.
export default function (THREE) {
  const g = new THREE.Group();

  const stem = new THREE.MeshStandardMaterial({ color: 0x5f7a3a, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  stem.name = 'foliage';
  const leaf = new THREE.MeshStandardMaterial({ color: 0x2f5a3a, roughness: 0.9, metalness: 0, flatShading: true });
  leaf.name = 'foliage';

  const D2R = Math.PI / 180, Y = new THREE.Vector3(0, 1, 0);
  const hash = (n) => {
    let h = (n | 0) + 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const hz = (a) => new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
  const hexagon = (r) => {
    const s = new THREE.Shape();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * 2 * Math.PI; i ? s.lineTo(r * Math.cos(a), r * Math.sin(a)) : s.moveTo(r, 0); }
    s.closePath();
    return s;
  };
  // leaf: a kite, wide a third of the way up and pointed at both ends, extruded 0.3 m and centred
  const kite = new THREE.Shape();
  kite.moveTo(0, -0.45); kite.lineTo(0.17, -0.10); kite.lineTo(0, 0.45); kite.lineTo(-0.17, -0.10); kite.closePath();
  const leafGeo = new THREE.ExtrudeGeometry(kite, { depth: 0.3, bevelEnabled: false, steps: 1 }).translate(0, 0, -0.15);

  // [azimuth deg, foot radius m, height m, outward lean of the top deg, culm radius m]
  const culms = [
    [ 10, 0.25, 7.00, 2.0, 0.050],
    [ 62, 0.55, 6.10, 4.0, 0.040],
    [ 95, 0.20, 5.80, 8.0, 0.038],
    [150, 0.58, 6.40, 3.0, 0.045],
    [178, 0.35, 6.70, 5.0, 0.048],
    [230, 0.60, 5.50, 4.5, 0.036],
    [262, 0.30, 6.85, 3.5, 0.050],
    [318, 0.50, 5.95, 5.5, 0.040],
    [340, 0.45, 6.25, 2.5, 0.043],
  ];

  culms.forEach(([azd, r0, h, leand, r], k) => {
    const az = azd * D2R, out = hz(az), j = (i) => hash(k * 37 + i);
    const foot = out.clone().multiplyScalar(r0);
    const reach = h * Math.tan(leand * D2R);                    // how far the top ends up outward
    // control point at half height so y is linear in t; its small outward offset makes the
    // culm rise straight and bow outward near the top
    const ctrl = foot.clone().addScaledVector(out, reach * (0.1 + 0.15 * j(1))).addScaledVector(Y, 0.5 * h);
    const top = foot.clone().addScaledVector(out, reach).addScaledVector(Y, h);
    const curve = new THREE.QuadraticBezierCurve3(foot, ctrl, top);

    // culm: a hexagon profile swept along the curve, capped at both ends
    g.add(new THREE.Mesh(new THREE.ExtrudeGeometry(hexagon(r), { steps: 3, bevelEnabled: false, extrudePath: curve }), stem));

    // nodes: a 6-sided open cone cup every 0.45 m, 35 % wider than the culm, rim upward
    for (let y = 0.45; y <= h - 1.0; y += 0.45) {
      const t = y / h, tan = curve.getTangent(t).normalize();
      const n = new THREE.Mesh(new THREE.ConeGeometry(1.35 * r, 0.06, 6, 1, true).rotateX(Math.PI), stem);
      n.position.copy(curve.getPoint(t)); n.quaternion.setFromUnitVectors(Y, tan); g.add(n);
    }

    // tuft: a crown along the culm's end tangent, two kites drooping down and sideways
    const tuft = (y, dir, along, spin) => {
      const m = new THREE.Mesh(leafGeo, leaf);
      m.position.copy(curve.getPoint(y / h)).addScaledVector(dir, along);
      m.quaternion.setFromUnitVectors(Y, dir).multiply(new THREE.Quaternion().setFromAxisAngle(Y, spin));
      g.add(m);
    };
    const side = j(2) > 0.5 ? 1 : -1, tip = curve.getTangent(1).normalize();
    tuft(h - 0.30, tip.addScaledVector(hz(az + (j(3) - 0.5) * 3), 0.15 + 0.15 * j(4)).normalize(), 0, j(5) * 6.28);
    tuft(h - 0.65, hz(az + side * (70 + 30 * j(6)) * D2R).multiplyScalar(0.85).addScaledVector(Y, -0.45 - 0.2 * j(7)).normalize(), 0.32, j(8) * 6.28);
    tuft(h - 1.15, hz(az - side * (60 + 40 * j(9)) * D2R).multiplyScalar(0.9).addScaledVector(Y, -0.3 - 0.25 * j(10)).normalize(), 0.30, j(11) * 6.28);
  });

  // --- the six lines: measure vertices, ground at y = 0, centre on x/z ---------
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });

  return g;
}
