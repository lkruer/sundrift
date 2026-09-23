// chochin — candidate A: primitives. The paper is one SphereGeometry scaled into an ellipsoid 0.34 m across, its poles
// buried inside the caps. Nine bamboo hoops are open CylinderGeometry frusta cut to the ellipsoid's slope at
// each hoop and standing 3 mm proud of it, in a NON-emissive copy of the lantern red: fine ridges by day,
// darker bands once the paper glows (the hoop blocks the light, as on a real lantern). The lacquered caps are
// closed 0.22 m cylinders; the hanging loop is a torus standing in the YZ plane, so a rope run along X
// threads it.
export default function (THREE) {
  const g = new THREE.Group();

  const paper = new THREE.MeshStandardMaterial({ color: 0xd8342a, emissive: 0xffb070, emissiveIntensity: 1.0, roughness: 0.8, metalness: 0 });
  paper.name = 'lantern';
  const hoop = new THREE.MeshStandardMaterial({ color: 0xd8342a, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
  const lacquer = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.4, metalness: 0 });

  const add = (geo, m, x = 0, y = 0, z = 0) => {
    const n = new THREE.Mesh(geo, m); n.position.set(x, y, z); g.add(n); return n;
  };

  // caps 0.045 m tall; paper visible from 0.045 to 0.44; loop tops out at 0.55
  const CAP_H = 0.045, CAP_R = 0.11;
  const Y0 = 0.04, Y1 = 0.445, YC = (Y0 + Y1) / 2;
  const R = 0.17, B = 0.235;                                  // semi-axes; poles at YC +- B stay inside the caps
  const rAt = (y) => R * Math.sqrt(Math.max(0, 1 - ((y - YC) / B) ** 2));

  // --- paper. Sphere and hoops share 10 segments round the axis. SphereGeometry puts its vertices on
  //     multiples of 36 degrees and CylinderGeometry 18 degrees off them, so the hoops start at PI/10: every
  //     hoop facet then runs parallel to the paper facet under it (misaligned, the paper's vertices poke
  //     through the middle of each hoop facet and the hoops break into dashes).
  const SEG = 10, ALIGN = Math.PI / SEG;
  const body = add(new THREE.SphereGeometry(1, SEG, 12), paper, 0, YC, 0);
  body.scale.set(R, B, R);

  // --- hoops: frusta following the ellipsoid, evenly spaced between the caps
  const N = 9, HW = 0.0045, OFF = 0.003;
  for (let k = 1; k <= N; k++) {
    const y = Y0 + 0.005 + (k / (N + 1)) * (Y1 - Y0 - 0.01);
    add(new THREE.CylinderGeometry(rAt(y + HW) + OFF, rAt(y - HW) + OFF, 2 * HW, SEG, 1, true, ALIGN), hoop, 0, y, 0);
  }

  // --- lacquered caps, closed
  add(new THREE.CylinderGeometry(CAP_R, CAP_R, CAP_H, SEG), lacquer, 0, CAP_H / 2, 0);
  add(new THREE.CylinderGeometry(CAP_R, CAP_R, CAP_H, SEG), lacquer, 0, Y1 - 0.005 + CAP_H / 2, 0);

  // --- hanging loop on a small boss, its foot sunk into the boss
  const TOP = Y1 - 0.005 + CAP_H;
  const LR = 0.028, LT = 0.011;
  const loop = add(new THREE.TorusGeometry(LR, LT, 4, 10), lacquer, 0, 0.55 - LR - LT, 0);
  loop.rotation.y = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.026, 0.03, 0.012, 6), lacquer, 0, TOP + 0.006, 0);

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
