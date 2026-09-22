// bare_tree — candidate B: profiles and tubes along curves. The trunk is a 7-segment
// LatheGeometry (root flare 0.48 m dia, 0.40 m at the knee, 0.24 m at the fork, profile
// bottom to top) leaning 3 degrees; every limb, branch and twig is a TubeGeometry along a
// QuadraticBezierCurve3 that leaves its joint at one angle and curls upward, tapered by
// scaling each ring about its own centre after construction and closed with a 6-sided
// cone tip; SphereGeometry balls at the fork and the three limb ends so nothing gaps.
// Three limbs (0.16 m dia) fork at 2.2 m and end at about 4.5 m; three, two and three
// branches (0.08 -> 0.04 m dia) reach 7.5 m; twelve 0.5 m twigs (0.04 m dia).
// No leaves. 5.0 m wide, 7.5 m tall.
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
  const off = (d, tilt, phi) => {
    const u = new THREE.Vector3().crossVectors(d, Math.abs(d.y) < 0.99 ? Y : X).normalize();
    const w = new THREE.Vector3().crossVectors(d, u).normalize();
    const t = tilt * D2R;
    return d.clone().multiplyScalar(Math.cos(t)).addScaledVector(u, Math.sin(t) * Math.cos(phi)).addScaledVector(w, Math.sin(t) * Math.sin(phi)).normalize();
  };
  const joint = (p, r, w, h) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, w, h), bark); m.position.copy(p); g.add(m); };

  // a curved member: leaves p along d, and by its far end has curled `curl` of its length
  // upward; radius r0 at the start tapering to r1, closed by a cone tip. Returns the far end
  // and the tangent there.
  const member = (p, d, L, r0, r1, sides, segs, curl) => {
    const end = p.clone().addScaledVector(d, L).addScaledVector(Y, curl * L);
    const ctrl = p.clone().addScaledVector(d, 0.55 * L);
    const curve = new THREE.QuadraticBezierCurve3(p, ctrl, end);
    const geo = new THREE.TubeGeometry(curve, segs, r0, sides, false);
    const pos = geo.attributes.position, c = new THREE.Vector3(), q = new THREE.Vector3();
    const per = sides + 1;                                   // vertices per ring (the seam is doubled)
    for (let i = 0; i <= segs; i++) {
      c.set(0, 0, 0);
      for (let k = 0; k < sides; k++) c.add(q.fromBufferAttribute(pos, i * per + k));
      c.multiplyScalar(1 / sides);
      const s = 1 + (r1 / r0 - 1) * (i / segs);
      for (let k = 0; k < per; k++) {
        q.fromBufferAttribute(pos, i * per + k).sub(c).multiplyScalar(s).add(c);
        pos.setXYZ(i * per + k, q.x, q.y, q.z);
      }
    }
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, bark));
    // tip: a cone whose base ring is the tube's last ring
    const tan = curve.getTangent(1).normalize();
    const tip = new THREE.Mesh(new THREE.ConeGeometry(r1, 3 * r1, sides, 1, true), bark);
    tip.position.copy(end).addScaledVector(tan, 1.5 * r1);
    tip.quaternion.setFromUnitVectors(Y, tan);
    g.add(tip);
    return [end, tan, curve];
  };

  // ---- trunk: one lathe, root flare to a 0.24 m fork, leaning 3 degrees
  const profile = [[0.24, 0], [0.20, 0.3], [0.175, 1.0], [0.15, 1.7], [0.12, 2.2], [0, 2.3]].map(([x, y]) => new THREE.Vector2(x, y));
  const trunk = new THREE.Mesh(new THREE.LatheGeometry(profile, 7), bark);
  const lean = dir(210, 3);
  trunk.quaternion.setFromUnitVectors(Y, lean);
  g.add(trunk);
  const fork = lean.clone().multiplyScalar(2.2);
  joint(fork, 0.15, 7, 4);

  // ---- limbs and branches: [azimuth, tilt, length, curl, [branches: azimuth, tilt, length, curl, twigs]]
  const limbs = [
    [ 25, 38, 2.6, 0.18, [[  5, 30, 3.0, 0.20, 2], [ 60, 50, 2.2, 0.22, 2], [320, 44, 1.9, 0.15, 1]]],
    [135, 40, 2.6, 0.16, [[150, 32, 3.0, 0.22, 2], [ 95, 48, 2.1, 0.18, 1]]],
    [255, 30, 2.4, 0.14, [[240, 30, 2.9, 0.20, 2], [300, 50, 2.2, 0.16, 1], [200, 52, 1.6, 0.10, 1]]],
  ];
  let twigSeed = 1;
  limbs.forEach(([az, tilt, len, curl, branches]) => {
    const [end] = member(fork, dir(az, tilt), len, 0.08, 0.055, 7, 3, curl);
    joint(end, 0.065, 6, 4);
    branches.forEach(([baz, btilt, blen, bcurl, twigs]) => {
      const [, , curve] = member(end, dir(baz, btilt), blen, 0.04, 0.02, 6, 3, bcurl);
      for (let i = 0; i < twigs; i++) {
        const s = twigSeed++;
        const t = 0.5 + 0.35 * hash(s * 7 + 1);
        const td = off(curve.getTangent(t).normalize(), 45 + 20 * hash(s * 7 + 2), hash(s * 7 + 3) * 2 * Math.PI);
        member(curve.getPoint(t), td, 0.5, 0.02, 0.02, 5, 2, 0.12);
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
