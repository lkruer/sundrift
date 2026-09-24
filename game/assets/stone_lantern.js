// stone_lantern — candidate C: hand-built, a different breakdown. The roof is ONE
// BufferGeometry lofted in loops over eight rays (four corners, four mid-edges) and
// six rings of a concave curve, where the corner rays curl up 0.09 m and the
// mid-edge rays only 0.025 m: the corners genuinely turn up, not the whole eave
// line. It has a 0.06 m eave edge and a closed soffit. The fire box is one indexed
// BufferGeometry: a cube whose four side faces each carry a frame, four recess
// walls and a recessed back, 0.16 m square and 0.03 m deep. Pillar, bead, slabs
// and moss band are primitives; the finial is a faceted icosahedron ball. (The recesses' backs were made the fire
// box's window, in their own warm material, in the game's polish pass: a lit lantern at the shrine by night.)
// Kasuga lantern, 1.8 m tall, 0.78 m across the eaves.
export default function (THREE) {
  const g = new THREE.Group();

  const stone = new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.95, metalness: 0, flatShading: true });
  stone.name = 'stone';
  const moss = new THREE.MeshStandardMaterial({ color: 0x5f7a3a, roughness: 0.9, metalness: 0, flatShading: true });
  moss.name = 'foliage';
  // the light in the fire box, seen through its four windows (the game lights it at night)
  const fire = new THREE.MeshStandardMaterial({ color: 0x3a2c20, emissive: 0xffb070, emissiveIntensity: 1.0, roughness: 0.9, metalness: 0 });
  fire.name = 'firebox';

  const add = (geo, m, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh;
  };
  const built = (pos, idx, m, x = 0, y = 0, z = 0) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return add(geo, m, x, y, z);
  };

  // --- moss band, plinth, pillar with bead, platform: primitives
  add(new THREE.BoxGeometry(0.74, 0.05, 0.74), moss, 0, 0.025, 0);
  add(new THREE.BoxGeometry(0.72, 0.16, 0.72), stone, 0, 0.08, 0);
  add(new THREE.CylinderGeometry(0.12, 0.14, 0.62, 12), stone, 0, 0.47, 0);
  add(new THREE.TorusGeometry(0.135, 0.022, 6, 12), stone, 0, 0.47, 0).rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(0.58, 0.12, 0.58), stone, 0, 0.84, 0);

  // --- fire box: a 0.42 m cube from 0.90 to 1.32 with a recessed panel on each side face.
  //     Each face is laid out in its own (u, v, n) frame with u x v = n, so the same
  //     counter-clockwise loops face outward on every side.
  const fp = [], fi = [], wi = [];
  const H = 0.21, A = 0.08, D = 0.03, YC = 1.11;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const face = (o, u, v, n, recess) => {
    const b = fp.length / 3;
    const put = (uu, vv, nn) => fp.push(
      o.x + u.x * uu + v.x * vv + n.x * nn, o.y + u.y * uu + v.y * vv + n.y * nn, o.z + u.z * uu + v.z * vv + n.z * nn);
    const sq = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    sq.forEach(([a, c]) => put(a * H, c * H, 0));              // outer corners  b+0..3
    if (!recess) { fi.push(b, b + 1, b + 2, b, b + 2, b + 3); return; }
    sq.forEach(([a, c]) => put(a * A, c * A, 0));              // recess mouth   b+4..7
    sq.forEach(([a, c]) => put(a * A, c * A, -D));             // recess back    b+8..11
    for (let k = 0; k < 4; k++) {
      const kn = (k + 1) % 4;
      fi.push(b + k, b + kn, b + 4 + kn, b + k, b + 4 + kn, b + 4 + k);             // frame
      fi.push(b + 4 + k, b + 4 + kn, b + 8 + kn, b + 4 + k, b + 8 + kn, b + 8 + k);   // recess wall
    }
    wi.push(b + 8, b + 9, b + 10, b + 8, b + 10, b + 11);                             // recess back: the window
  };
  face(V(0, YC, H), V(1, 0, 0), V(0, 1, 0), V(0, 0, 1), true);         // +z
  face(V(0, YC, -H), V(0, 1, 0), V(1, 0, 0), V(0, 0, -1), true);       // -z
  face(V(H, YC, 0), V(0, 1, 0), V(0, 0, 1), V(1, 0, 0), true);         // +x
  face(V(-H, YC, 0), V(0, 0, 1), V(0, 1, 0), V(-1, 0, 0), true);       // -x
  face(V(0, YC + H, 0), V(0, 0, 1), V(1, 0, 0), V(0, 1, 0), false);    // top
  face(V(0, YC - H, 0), V(1, 0, 0), V(0, 0, 1), V(0, -1, 0), false);   // bottom
  built(fp, fi, stone);
  built(fp, wi, fire);

  // --- roof: eight rays (odd k = corners at 45 degrees, even k = mid-edges), six rings
  //     down a concave curve r = R t^1.7, y = 0.34 (1 - t) plus an upturn that is 0.09 on
  //     the corners and 0.025 on the mid-edges; then the eave's lower edge and a soffit fan.
  const rp = [], ri = [];
  const RC = 0.39 * Math.SQRT2, NA = 8;
  const ang = (k) => (k * Math.PI) / 4;
  const rad = (k, t) => (k % 2 ? RC : RC / Math.SQRT2) * Math.pow(t, 1.7);
  const yOf = (k, t) => 0.34 * (1 - t) + (k % 2 ? 0.09 : 0.025) * Math.pow(t, 6);
  const P = (r, y, k) => rp.push(r * Math.sin(ang(k)), y, r * Math.cos(ang(k)));
  P(0, 0.34, 0);                                                        // apex, index 0
  const ts = [0.18, 0.35, 0.55, 0.75, 0.9, 1.0];
  ts.forEach((t) => { for (let k = 0; k < NA; k++) P(rad(k, t), yOf(k, t), k); });
  for (let k = 0; k < NA; k++) P(rad(k, 1) * 0.985, yOf(k, 1) - 0.06, k);   // eave lower edge
  const cIdx = rp.length / 3;
  rp.push(0, 0, 0);                                                     // soffit centre
  const ring = (j) => 1 + j * NA;
  for (let k = 0; k < NA; k++) {
    const kn = (k + 1) % NA;
    ri.push(0, ring(0) + k, ring(0) + kn);
    for (let j = 0; j < ts.length; j++) {          // ring j -> ring j+1; the last pair is the eave edge
      const up = ring(j), lo = ring(j + 1);
      ri.push(up + k, lo + k, lo + kn, up + k, lo + kn, up + kn);
    }
    const lo = ring(ts.length);
    ri.push(lo + k, cIdx, lo + kn);                // soffit, facing down
  }
  built(rp, ri, stone, 0, 1.32, 0);

  // --- finial: a neck and a faceted 0.12 m ball, top at 1.80 m
  add(new THREE.CylinderGeometry(0.035, 0.045, 0.03, 8), stone, 0, 1.675, 0);
  add(new THREE.IcosahedronGeometry(0.06, 1), stone, 0, 1.74, 0);

  // --- the six lines: measure vertices, ground at y = 0, centre on x/z ---------
  const bb = new THREE.Box3(), vv = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((o) => { const p = o.isMesh && o.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) bb.expandByPoint(vv.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld)); });
  const c = bb.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= bb.min.y; o.position.z -= c.z; });

  return g;
}
