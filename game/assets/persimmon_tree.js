// persimmon_tree — the old persimmon (kaki) of a farmyard, in spring leaf: a short dark trunk, rough and leaning, that
// forks low into four crooked limbs zigzagging out and up (a persimmon's wood grows in elbows), and a broad, low,
// uneven crown of glossy leaf clusters, wider than it is tall, the way a yard tree is kept for picking. The wood is
// one loft of rings along each member (trunk, limbs, a twig off each limb); the crown is seven hashed icosahedra
// squashed into flat clusters on the limbs' ends and over the fork. ONE foliage material (the game tints it the
// fresh yellow-green of new persimmon leaves) and the bark. About 6.6 m across and 5.4 m tall.
export default function (THREE) {
  const g = new THREE.Group();
  const foliage = new THREE.MeshStandardMaterial({ color: 0x9cc85a, roughness: 0.62, metalness: 0, flatShading: true });
  foliage.name = 'foliage';
  const bark = new THREE.MeshStandardMaterial({ color: 0x3a2e28, roughness: 0.9, metalness: 0, flatShading: true });
  bark.name = 'timber';

  const hash = (n) => {
    let h = (n | 0) + 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const D = Math.PI / 180;

  // ---- the wood: rings along a member, parallel-transported frames, quads wound outward, a cap at the end
  const bp = [], bi = [];
  const loft = (rings, N, seed) => {
    const base = bp.length / 3, n = rings.length;
    let ux = 0, uy = 0, uz = 0, tx = 0, ty = 0, tz = 0;
    for (let k = 0; k < n; k++) {
      const a = rings[Math.max(0, k - 1)], b = rings[Math.min(n - 1, k + 1)];
      tx = b[0] - a[0]; ty = b[1] - a[1]; tz = b[2] - a[2];
      const tl = Math.hypot(tx, ty, tz); tx /= tl; ty /= tl; tz /= tl;
      if (k === 0) { if (Math.abs(ty) < 0.9) { ux = -tz; uy = 0; uz = tx; } else { ux = 1; uy = 0; uz = 0; } }
      const d = ux * tx + uy * ty + uz * tz; ux -= d * tx; uy -= d * ty; uz -= d * tz;
      const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
      const vx = ty * uz - tz * uy, vy = tz * ux - tx * uz, vz = tx * uy - ty * ux;
      const [cx, cy, cz, r] = rings[k];
      for (let i = 0; i < N; i++) {
        const th = (i / N) * 2 * Math.PI, q = r * (1 + 0.16 * (hash(seed * 7919 + k * 131 + i) - 0.5));
        const cs = Math.cos(th) * q, sn = Math.sin(th) * q;
        bp.push(cx + ux * cs + vx * sn, cy + uy * cs + vy * sn, cz + uz * cs + vz * sn);
      }
    }
    for (let k = 0; k < n - 1; k++) for (let i = 0; i < N; i++) {
      const j = (i + 1) % N, lo = base + k * N, hi = base + (k + 1) * N;
      bi.push(lo + i, hi + j, hi + i, lo + i, lo + j, hi + j);
    }
    const [cx, cy, cz, r] = rings[n - 1], hi = base + (n - 1) * N, c = bp.length / 3;
    bp.push(cx + tx * r * 0.6, cy + ty * r * 0.6, cz + tz * r * 0.6);
    for (let i = 0; i < N; i++) bi.push(hi + i, hi + (i + 1) % N, c);
  };
  // a crooked member: legs of a zigzag, each turning a little off the last (elbows)
  const member = (p0, az, el, legs, r0, r1, seed) => {
    const rings = [[...p0, r0]];
    let [x, y, z] = p0, a = az, e = el;
    legs.forEach((len, k) => {
      a += (hash(seed * 13 + k) - 0.5) * 50 * (k ? 1 : 0.3);
      e += (hash(seed * 17 + k) - 0.5) * 30 - (k ? 6 : 0);
      x += Math.cos(e * D) * Math.cos(a * D) * len; y += Math.sin(e * D) * len; z += Math.cos(e * D) * Math.sin(a * D) * len;
      rings.push([x, y, z, r0 + (r1 - r0) * ((k + 1) / legs.length)]);
    });
    return rings;
  };

  // the trunk, leaning a little, a knuckle at the fork
  loft([[0, 0, 0, 0.38], [0.04, 0.3, 0.02, 0.29], [0.12, 0.9, 0.06, 0.26], [0.2, 1.5, 0.08, 0.28], [0.25, 1.85, 0.1, 0.22]], 7, 1);
  const ends = [];
  [[25, 30, [1.1, 0.9, 0.8]], [118, 38, [0.9, 1.0, 0.7]], [205, 32, [1.1, 0.9, 0.7]], [298, 42, [0.9, 0.9, 0.8]]].forEach(([az, el, legs], i) => {
    const p0 = [0.25 + 0.1 * Math.cos(az * D), 1.7, 0.1 + 0.1 * Math.sin(az * D)];
    const rings = member(p0, az, el, legs, 0.18, 0.07, i + 3);
    loft(rings, 6, i + 11);
    const end = rings[rings.length - 1];
    ends.push(end);
    // a twig off the limb's middle, up and out
    const mid = rings[2];
    loft(member([mid[0], mid[1], mid[2]], az + 70 * (hash(i + 40) - 0.5) + 40, 52, [0.7, 0.5], 0.07, 0.035, i + 21), 5, i + 31);
  });
  const wood = new THREE.BufferGeometry();
  wood.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
  wood.setIndex(bi); wood.computeVertexNormals();
  g.add(new THREE.Mesh(wood, bark));

  // ---- the crown: a cluster on every limb's end and two over the fork, flattened and uneven, a dense dome
  const blobs = [];
  // (none below 3.2 m: a limb that drooped hung its cluster under the crown like a separate bush)
  ends.forEach((e, i) => blobs.push([e[0] * 0.92, Math.max(e[1] + 0.3, 3.2), e[2] * 0.92, 1.35 + 0.3 * hash(i + 60), 0.72]));
  blobs.push([0.3, 4.1, 0.1, 1.6, 0.7], [-0.3, 3.7, -0.5, 1.35, 0.72]);
  const parts = blobs.map(([x, y, z, r, sy], i) => {
    const geo = new THREE.IcosahedronGeometry(r, 1);
    const p = geo.attributes.position, ids = new Map();
    for (let k = 0; k < p.count; k++) {
      const key = Math.round(p.getX(k) * 500) + ',' + Math.round(p.getY(k) * 500) + ',' + Math.round(p.getZ(k) * 500);
      if (!ids.has(key)) ids.set(key, ids.size);
      const f = 1 + (hash(ids.get(key) * 131 + i * 977) - 0.5) * 0.34;
      p.setXYZ(k, p.getX(k) * f, p.getY(k) * f * sy, p.getZ(k) * f);
    }
    geo.rotateY(hash(i + 90) * 6.28);
    geo.translate(x, y, z);
    return geo;
  });
  // (one geometry for every cluster: one draw)
  const pos = [];
  for (const geo of parts) { const a = geo.attributes.position.array; for (let k = 0; k < a.length; k++) pos.push(a[k]); geo.dispose(); }
  const crown = new THREE.BufferGeometry();
  crown.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  crown.computeVertexNormals();
  g.add(new THREE.Mesh(crown, foliage));

  // --- the six lines: measure vertices, ground at y = 0, centre on x/z ---------
  const bb = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((o) => { const p = o.isMesh && o.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) bb.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld)); });
  const c = bb.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= bb.min.y; o.position.z -= c.z; });
  return g;
}
