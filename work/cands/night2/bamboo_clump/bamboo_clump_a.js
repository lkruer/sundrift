// bamboo_clump — candidate A: primitives. Nine straight 6-sided CylinderGeometry culms
// (0.07–0.10 m dia, 5.5–7.0 m tall, no two the same height) standing inside a 1.2 m
// circle and leaning outward 2–8 degrees; a node every 0.45 m as a 6-sided open
// ConeGeometry skirt 35 % wider than the culm; three icosahedron leaf blobs
// (0.35 x 0.9 x 0.35 m) per culm: one crown along the culm, two fronds drooping down
// and sideways. ONE stem material, ONE foliage material. 2.4 m wide, 7.0 m tall.
//
// Budget note: 27 blobs at icosahedron detail 1 are 2,160 triangles on their own,
// above the 1,400 cap, so the blobs are detail 0 (20 tris) and the ~100 node rings
// are 6-triangle skirts, the only ring that fits nine culms into the band.
export default function (THREE) {
  const g = new THREE.Group();

  // ONE material for culms and node rings (DoubleSide so the open skirts have an underside),
  // ONE flat-shaded foliage material for every leaf blob.
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

  // one leaf blob shape shared by every tuft: a 12-vertex icosahedron stretched to 0.35 x 0.9 x 0.35 m
  const leafGeo = new THREE.IcosahedronGeometry(1, 0).scale(0.175, 0.45, 0.175);

  // [azimuth deg, foot radius m (inside the 1.2 m circle), height m, outward lean deg, culm radius m]
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
    const az = azd * D2R, lean = leand * D2R;
    const out = hz(az);
    const foot = out.clone().multiplyScalar(r0);
    const d = new THREE.Vector3(Math.sin(lean) * out.x, Math.cos(lean), Math.sin(lean) * out.z);  // culm axis
    const L = h / Math.cos(lean);
    const at = (y) => foot.clone().addScaledVector(d, y / Math.cos(lean));   // point on the axis at height y
    const q = new THREE.Quaternion().setFromUnitVectors(Y, d);

    // culm: one 6-sided cylinder, the top a quarter narrower than the foot
    const culm = new THREE.Mesh(new THREE.CylinderGeometry(0.75 * r, r, L, 6, 1), stem);
    culm.position.copy(at(h / 2)); culm.quaternion.copy(q); g.add(culm);

    // nodes: a 6-sided open cone skirt every 0.45 m up to the tuft, 35 % wider than the culm there
    for (let y = 0.45; y <= h - 1.0; y += 0.45) {
      const rs = r * (1 - 0.25 * (y / h));
      const n = new THREE.Mesh(new THREE.ConeGeometry(1.35 * rs, 0.06, 6, 1, true), stem);
      n.position.copy(at(y)); n.quaternion.copy(q); g.add(n);
    }

    // tuft: a crown blob along the culm, then two fronds drooping down and sideways
    const j = (i) => hash(k * 31 + i);
    const tuft = (y, dir, along, spin) => {
      const m = new THREE.Mesh(leafGeo, leaf);
      m.position.copy(at(y)).addScaledVector(dir, along);
      m.quaternion.setFromUnitVectors(Y, dir).multiply(new THREE.Quaternion().setFromAxisAngle(Y, spin));
      g.add(m);
    };
    const side = j(1) > 0.5 ? 1 : -1;
    tuft(h - 0.30, d.clone().addScaledVector(hz(az + (j(2) - 0.5) * 3), 0.2 + 0.15 * j(3)).normalize(), 0, j(4) * 6.28);
    tuft(h - 0.65, hz(az + side * (70 + 30 * j(5)) * D2R).multiplyScalar(0.85).addScaledVector(Y, -0.45 - 0.2 * j(6)).normalize(), 0.32, j(7) * 6.28);
    tuft(h - 1.15, hz(az - side * (60 + 40 * j(8)) * D2R).multiplyScalar(0.9).addScaledVector(Y, -0.3 - 0.25 * j(9)).normalize(), 0.30, j(10) * 6.28);
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
