// jizo — candidate A: primitives. A roadside Jizo, 0.75 m to the top of its cap. Stone: two stepped box slabs for the
// base on a recessed chrome-dark footing (the style lock's dark line against the ground), an oval
// CylinderGeometry frustum robe narrowing to the hem with a half-sphere of shoulders, capsule sleeves bent
// forward to a tapered block of joined palms, a neck, a flat-shaded sphere head with long ear lobes and a
// nose bump. Fabric: a bib of two open cone segments draped over the shoulders and chest from under a torus
// neck tie, the tie's knot and two tails at the back, and a knitted cap (a stretched sphere dome, a rolled
// torus cuff, a pompom). Front faces +Z.
export default function (THREE) {
  const g = new THREE.Group();

  const stone = new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.95, metalness: 0, flatShading: true });
  stone.name = 'stone';
  // double sided: the bib is an open shell
  const fabric = new THREE.MeshStandardMaterial({ color: 0xc9402b, roughness: 0.9, metalness: 0, flatShading: true, side: THREE.DoubleSide });
  fabric.name = 'fabric';
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.6, metalness: 0 });

  const add = (geo, m, x = 0, y = 0, z = 0) => {
    const n = new THREE.Mesh(geo, m); n.position.set(x, y, z); g.add(n); return n;
  };
  const up = new THREE.Vector3(0, 1, 0);
  // a capsule of radius r from a to b
  const limb = (a, b, r, m) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
    const n = add(new THREE.CapsuleGeometry(r, d.length(), 2, 6), m);
    n.position.copy(A).addScaledVector(d, 0.5);
    n.quaternion.setFromUnitVectors(up, d.normalize());
    return n;
  };

  // --- footing and base: a dark footing inset under two stepped slabs
  add(new THREE.BoxGeometry(0.31, 0.035, 0.27), dark, 0, 0.0175, 0);
  add(new THREE.BoxGeometry(0.34, 0.06, 0.30), stone, 0, 0.065, 0);
  add(new THREE.BoxGeometry(0.28, 0.035, 0.25), stone, 0, 0.1125, 0);

  // --- robe: oval frustum from the hem (0.22 x 0.165 at 0.13) to the shoulders (0.27 x 0.20 at 0.42)
  const robe = add(new THREE.CylinderGeometry(0.135, 0.11, 0.29, 12), stone, 0, 0.275, 0);
  robe.scale.z = 0.75;
  const sh = add(new THREE.SphereGeometry(0.135, 12, 4, 0, Math.PI * 2, 0, Math.PI / 2), stone, 0, 0.42, 0);
  sh.scale.set(1, 0.36, 0.75);
  // sleeves: upper arm down the side, forearm forward and in to the hands
  for (const s of [1, -1]) {
    limb([s * 0.118, 0.425, -0.005], [s * 0.128, 0.315, 0.02], 0.042, stone);
    limb([s * 0.128, 0.315, 0.02], [s * 0.035, 0.335, 0.118], 0.036, stone);
  }
  // joined palms: a tapered block, fingertips up and a little forward
  const palms = add(new THREE.CylinderGeometry(0.02, 0.036, 0.12, 6), stone, 0, 0.385, 0.135);
  palms.scale.z = 0.8;
  palms.rotation.x = 0.18;

  // --- neck, head, ears, nose
  add(new THREE.CylinderGeometry(0.056, 0.062, 0.07, 10, 1, true), stone, 0, 0.48, 0);
  const HY = 0.575, HR = 0.1;
  add(new THREE.SphereGeometry(HR, 12, 8), stone, 0, HY, 0);
  for (const s of [1, -1]) {
    const ear = add(new THREE.SphereGeometry(0.028, 5, 5), stone, s * 0.097, HY - 0.022, 0.004);
    ear.scale.set(0.75, 1.7, 0.95);
  }
  add(new THREE.SphereGeometry(0.02, 6, 4), stone, 0, HY - 0.012, 0.092);

  // --- bib: two open cone segments over the front 130 degrees, squashed like the robe, draping from under the
  //     neck tie over the shoulder dome (0.478 -> 0.445) and down the chest to 0.35; checked clear of the
  //     shoulders at r = 0.10 and 0.125 and of the robe at 0.42
  const BT0 = -1.13, BTL = 2.26;
  const bibUp = add(new THREE.CylinderGeometry(0.07, 0.14, 0.033, 10, 1, true, BT0, BTL), fabric, 0, 0.4615, 0);
  bibUp.scale.z = 0.75;
  const bibLo = add(new THREE.CylinderGeometry(0.14, 0.148, 0.095, 10, 1, true, BT0, BTL), fabric, 0, 0.3975, 0);
  bibLo.scale.z = 0.75;
  // neck tie, and its knot and two tails at the back
  // (members 0.04 m thick, the style lock's minimum: tie roll, tails, palm tip, cap cuff)
  const tie = add(new THREE.TorusGeometry(0.064, 0.02, 5, 10), fabric, 0, 0.47, 0);
  tie.rotation.x = Math.PI / 2;
  add(new THREE.SphereGeometry(0.028, 6, 5), fabric, 0, 0.468, -0.08);
  for (const s of [1, -1]) {
    const tail = add(new THREE.BoxGeometry(0.04, 0.09, 0.02), fabric, s * 0.026, 0.425, -0.096);
    tail.rotation.set(0.38, 0, s * 0.28);
  }

  // --- knitted cap: a dome a little taller than the crown, a rolled cuff hugging its edge (a fat flared torus
  //     read as a hat brim), a pompom for the peaked top
  const CAP_T = 1.3, CR = HR + 0.007, CS = 1.1;              // dome edge angle, radius, vertical stretch
  const dome = add(new THREE.SphereGeometry(CR, 12, 5, 0, Math.PI * 2, 0, CAP_T), fabric, 0, HY, 0);
  dome.scale.y = CS;
  const cuff = add(new THREE.TorusGeometry(CR * Math.sin(CAP_T) - 0.004, 0.02, 5, 12), fabric, 0, HY + CS * CR * Math.cos(CAP_T), 0);
  cuff.rotation.x = Math.PI / 2;
  add(new THREE.SphereGeometry(0.036, 7, 5), fabric, 0, HY + CS * CR + 0.024, 0);

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
