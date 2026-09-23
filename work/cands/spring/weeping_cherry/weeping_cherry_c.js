// weeping_cherry — candidate C: a lathe shell. The whole fall of blossom is ONE hand-built shell of
// revolution with thickness: an outer wall whose profile runs bottom -> top (hem, curtain, shoulder, dome,
// top pole) and whose 32 columns alternate ridge and valley, the valleys cut 0.6-0.8 m in, so the curtain
// hangs in sixteen deep star pleats of uneven width that fade out over the dome; ridges hang lower than
// valleys and every ridge gets its own length, so the hem is scalloped and ragged. An inner wall 0.25 m
// inside, wound the other way, climbs to a ceiling at 4.55 m, and a downward band joins the two walls
// round the hem, so the shell is closed and needs no DoubleSide. Four 7-sided lathe puffs sit on the dome
// to make the head billow. The dark trunk shows under the hem and runs up inside to the ceiling. Blossom
// is ONE geometry. 6.8 x 6.5 x 6.7 m, 998 triangles.
export default function (THREE) {
  const g = new THREE.Group();

  // ONE blossom material: the game turns it white and recolours it per instance.
  const foliage = new THREE.MeshStandardMaterial({ color: 0xdd6f98, roughness: 0.9, metalness: 0, flatShading: true });
  foliage.name = 'foliage';
  const bark = new THREE.MeshStandardMaterial({ color: 0x3b2a27, roughness: 0.85, metalness: 0 });
  bark.name = 'timber';

  const hash = (n) => {
    let h = (n | 0) + 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const D = Math.PI / 180;
  const fp = [], fi = [];
  const vert = (x, y, z) => { fp.push(x, y, z); return fp.length / 3 - 1; };

  // ---------------------------------------------------------------- the shell
  const C = 32;                                   // columns: even = ridge, odd = valley
  // rows bottom -> top: [height, base radius, pleat depth factor]; row 0 is the hem, its height set per column
  const ROWS = [[1.0, 3.0, 1], [2.3, 2.95, 1], [3.5, 2.9, 1], [4.45, 2.8, 0.8], [5.15, 2.5, 0.4], [5.7, 1.9, 0.15], [6.05, 1.05, 0]];
  const TOP = 6.2;
  const hemY = [], colPhi = [];
  for (let c = 0; c < C; c++) {
    hemY.push(c % 2 === 0 ? 0.78 + 0.42 * hash(c + 11) : 1.4 + 0.5 * hash(c + 21));
    colPhi.push(((c + 0.35 * (hash(c + 33) - 0.5)) / C) * 2 * Math.PI);   // pleats of uneven width
  }
  // deep star pleats: ridges stand out, valleys cut most of the way in, so the fall reads as strands
  const pleat = (c) => (c % 2 === 0 ? 0.26 + 0.1 * hash(c + 40) : -(0.6 + 0.2 * hash(c + 44)));
  const outer = [], inner = [];
  ROWS.forEach(([y0, r0, pf], k) => {
    const o = [], n = [];
    for (let c = 0; c < C; c++) {
      const phi = colPhi[c] + (k > 0 ? (hash(k * 57 + c) - 0.5) * 0.05 : 0);
      const y = k === 0 ? hemY[c] : y0 + (hash(k * 71 + c) - 0.5) * 0.16;
      const r = r0 + pleat(c) * pf + (hash(k * 91 + c) - 0.5) * 0.1 + (k === 0 ? 0.06 : 0);
      o.push(vert(r * Math.sin(phi), y, r * Math.cos(phi)));
      if (k <= 3) { const ri = r - 0.25; n.push(vert(ri * Math.sin(phi), y, ri * Math.cos(phi))); }
    }
    outer.push(o); if (k <= 3) inner.push(n);
  });
  const pole = vert(0, TOP, 0), ceil = vert(0, 4.55, 0);
  for (let k = 0; k < outer.length - 1; k++) for (let c = 0; c < C; c++) {
    const c1 = (c + 1) % C, A = outer[k], B = outer[k + 1];
    fi.push(A[c], A[c1], B[c], B[c1], B[c], A[c1]);              // outer wall faces out
  }
  const T = outer[outer.length - 1];
  for (let c = 0; c < C; c++) fi.push(T[c], T[(c + 1) % C], pole);
  for (let k = 0; k < inner.length - 1; k++) for (let c = 0; c < C; c++) {
    const c1 = (c + 1) % C, A = inner[k], B = inner[k + 1];
    fi.push(A[c], B[c], A[c1], B[c1], A[c1], B[c]);              // inner wall faces in
  }
  const IT = inner[inner.length - 1];
  for (let c = 0; c < C; c++) fi.push(IT[(c + 1) % C], IT[c], ceil);  // the ceiling faces down
  for (let c = 0; c < C; c++) {                                  // the hem band faces down
    const c1 = (c + 1) % C, o0 = outer[0][c], o1 = outer[0][c1], n0 = inner[0][c], n1 = inner[0][c1];
    fi.push(o0, n0, o1, n0, n1, o1);
  }

  // ---------------------------------------------------------------- the head: lathe puffs on the dome
  const PROF = [[0, -0.6], [0.7, -0.56], [1.0, -0.12], [0.86, 0.42], [0.5, 0.82], [0, 0.96]];
  const puff = (x, y, z, rad, hgt, seed) => {
    const sides = 7, rot = hash(seed * 11 + 3) * 6.283, ids = [];
    PROF.forEach(([pr, py], k) => {
      const n = pr === 0 ? 1 : sides, row = [];
      for (let i = 0; i < n; i++) {
        const j = seed * 1013 + k * 97 + i;
        const phi = rot + ((i + 0.5 * k) / sides) * 2 * Math.PI + (hash(j) - 0.5) * 0.25;
        const r = pr * rad * (1 + (hash(j + 5) - 0.5) * 0.22), yy = py * hgt + (pr === 0 ? 0 : (hash(j + 9) - 0.5) * 0.12 * hgt);
        row.push(vert(x + r * Math.sin(phi), y + yy, z + r * Math.cos(phi)));
      }
      ids.push(row);
    });
    for (let k = 0; k < PROF.length - 1; k++) {
      const A = ids[k], B = ids[k + 1];
      for (let i = 0; i < sides; i++) {
        const i1 = (i + 1) % sides;
        if (A.length === 1) fi.push(B[i1], B[i], A[0]);
        else if (B.length === 1) fi.push(A[i], A[i1], B[0]);
        else fi.push(A[i], A[i1], B[i], B[i1], B[i], A[i1]);
      }
    }
  };
  puff(0.1, 5.85, 0.05, 1.2, 0.72, 1);
  [[40, 1.35], [160, 1.4], [280, 1.3]].forEach(([az, r], i) => puff(r * Math.cos(az * D), 5.45 + 0.1 * hash(i + 5), r * Math.sin(az * D), 1.05, 0.66, i + 2));

  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  fg.setIndex(fi);
  const flat = fg.toNonIndexed(); fg.dispose();
  flat.computeVertexNormals();
  g.add(new THREE.Mesh(flat, foliage));

  // ---------------------------------------------------------------- the trunk, up into the ceiling
  const bp = [], bi = [];
  const rings = [[0, 0, 0, 0.36], [0.03, 0.3, 0.0, 0.27], [0.12, 1.3, 0.05, 0.24], [0.16, 2.5, 0.0, 0.23], [0.1, 3.5, -0.05, 0.21], [0.05, 4.7, 0.0, 0.17]];
  const N = 7;
  rings.forEach(([cx, cy, cz, r], k) => { for (let i = 0; i < N; i++) {
    const th = (i / N) * 2 * Math.PI, q = r * (1 + 0.1 * (hash(k * 131 + i + 7) - 0.5) * 2);
    bp.push(cx + Math.sin(th) * q, cy, cz + Math.cos(th) * q);
  } });
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < N; i++) {
    const i1 = (i + 1) % N, a = k * N;
    bi.push(a + i, a + i1, a + N + i, a + N + i1, a + N + i, a + i1);
  }
  const wood = new THREE.BufferGeometry();
  wood.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
  wood.setIndex(bi);
  wood.computeVertexNormals();
  g.add(new THREE.Mesh(wood, bark));

  // --- the six lines: measure vertices, ground at y = 0, centre on x/z ---------
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });

  return g;
}
