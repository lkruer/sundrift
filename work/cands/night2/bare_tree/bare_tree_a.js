// bare_tree — candidate A: primitives. A leafless deciduous tree built from tapered
// CylinderGeometry members placed end to end with SphereGeometry joints: a 7-sided trunk
// in two sections (0.44 m dia root section, a kink at 0.9 m, 0.24 m at the fork) that
// forks at 2.2 m into three limbs (0.16 m dia, 7 sides) at 25/135/255 degrees and three
// different tilts; each limb ends at about 4.5 m in a joint ball and forks into three,
// two and three branches (0.08 m dia tapering to 0.04 m, 6 sides), the tallest reaching
// 7.5 m; twelve 0.5 m twigs (0.04 m dia, 5 sides) off the upper branches at hash angles.
// No leaves. Every limb, branch and twig has its own azimuth, tilt and length, so no
// side repeats. 5.0 m wide, 7.5 m tall.
export default function (THREE) {
  const g = new THREE.Group();

  const bark = new THREE.MeshStandardMaterial({ color: 0x5a3f2c, roughness: 0.85, metalness: 0 });
  bark.name = 'timber';

  const D2R = Math.PI / 180, Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
  const hash = (n) => {
    let h = (n | 0) + 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const dir = (azd, tiltd) => {
    const a = azd * D2R, t = tiltd * D2R;
    return new THREE.Vector3(Math.sin(t) * Math.cos(a), Math.cos(t), Math.sin(t) * Math.sin(a));
  };
  // a tapered cylinder from p along d: radii r0 at the start and r1 at the far end; returns the far end
  const member = (p, d, L, r0, r1, sides) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, L, sides, 1), bark);
    m.position.copy(p).addScaledVector(d, L / 2);
    m.quaternion.setFromUnitVectors(Y, d);
    g.add(m);
    return p.clone().addScaledVector(d, L);
  };
  const joint = (p, r, w, h) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, w, h), bark); m.position.copy(p); g.add(m); };
  // a direction `tilt` degrees off d, swung `phi` around it
  const off = (d, tilt, phi) => {
    const u = new THREE.Vector3().crossVectors(d, Math.abs(d.y) < 0.99 ? Y : X).normalize();
    const w = new THREE.Vector3().crossVectors(d, u).normalize();
    const t = tilt * D2R;
    return d.clone().multiplyScalar(Math.cos(t)).addScaledVector(u, Math.sin(t) * Math.cos(phi)).addScaledVector(w, Math.sin(t) * Math.sin(phi)).normalize();
  };

  // ---- trunk: root section leaning one way, upper section the other, a ball at the kink
  const foot = new THREE.Vector3(0, 0, 0);
  const knee = member(foot, dir(200, 2.5), 0.9, 0.22, 0.17, 7);
  joint(knee, 0.17, 7, 4);
  const fork = member(knee, dir(20, 3.5), 1.3, 0.17, 0.12, 7);   // fork at 2.2 m
  joint(fork, 0.15, 7, 4);

  // ---- limbs and branches: [azimuth, tilt from vertical, length, [branches: azimuth, tilt, length, twigs]]
  const limbs = [
    [ 25, 30, 2.75, [[  5, 24, 3.15, 2], [ 60, 42, 2.4, 2], [320, 35, 2.0, 1]]],
    [135, 32, 2.80, [[150, 25, 3.20, 2], [ 95, 40, 2.2, 1]]],
    [255, 22, 2.50, [[240, 24, 3.00, 2], [300, 42, 2.3, 1], [200, 45, 1.7, 1]]],
  ];
  let twigSeed = 1;
  limbs.forEach(([az, tilt, len, branches]) => {
    const end = member(fork, dir(az, tilt), len, 0.08, 0.055, 7);
    joint(end, 0.065, 6, 4);
    branches.forEach(([baz, btilt, blen, twigs]) => {
      const d = dir(baz, btilt);
      member(end, d, blen, 0.04, 0.02, 6);
      // twigs: 0.5 m, 0.04 m dia, off the upper half of the branch, 45-65 degrees off it
      for (let i = 0; i < twigs; i++) {
        const s = twigSeed++;
        const along = blen * (0.5 + 0.35 * hash(s * 7 + 1));
        const td = off(d, 45 + 20 * hash(s * 7 + 2), hash(s * 7 + 3) * 2 * Math.PI);
        member(end.clone().addScaledVector(d, along), td, 0.5, 0.02, 0.02, 5);
      }
    });
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
