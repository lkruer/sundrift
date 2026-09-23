// chochin_c — hand-built. A different part breakdown: the lantern is built the way it is made, bamboo hoops
// and paper panels, as two indexed BufferGeometries lofted in one loop over a profile. The paper is ten
// straight panels (a faceted ellipse, each panel its own flat normal along the profile, smooth round the
// axis); the nine hoops are 9 mm bands in the lacquer black between them, 3 mm proud, so every rib is a dark
// line whatever the paper's glow is doing, the way a lantern is drawn. Caps are hand-built closed cylinders
// and the hanger is a bail: a half-round tube arching over the top cap in the YZ plane, so a rope run along X
// threads it. Only the brief's two colours.
export default function (THREE) {
  const g = new THREE.Group();

  const paper = new THREE.MeshStandardMaterial({ color: 0xd8342a, emissive: 0xffb070, emissiveIntensity: 1.0, roughness: 0.8, metalness: 0 });
  paper.name = 'lantern';
  const lacquer = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.4, metalness: 0 });

  const S = 10;
  const TAU = Math.PI * 2;
  const newL = () => ({ pos: [], nor: [], uv: [], idx: [] });

  // one ring of S quads between profile points (x0, y0) and (x1, y1), with that segment's own normal
  const band = (L, x0, y0, x1, y1) => {
    const tx = x1 - x0, ty = y1 - y0, len = Math.hypot(tx, ty) || 1;
    const nx = ty / len, ny = -tx / len;                      // outward for a profile running upward
    const b = L.pos.length / 3;
    for (let i = 0; i <= S; i++) {
      const a = (i / S) * TAU, s = Math.sin(a), c = Math.cos(a);
      L.pos.push(x0 * s, y0, x0 * c, x1 * s, y1, x1 * c);
      L.nor.push(nx * s, ny, nx * c, nx * s, ny, nx * c);
      L.uv.push(i / S, 0, i / S, 1);
    }
    for (let i = 0; i < S; i++) {
      const a = b + 2 * i;                                    // a=(i,lo) a+1=(i,hi) a+2=(i+1,lo) a+3=(i+1,hi)
      L.idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  };
  // a flat disc facing up or down
  const disk = (L, r, y, up) => {
    const b = L.pos.length / 3, ny = up ? 1 : -1;
    L.pos.push(0, y, 0); L.nor.push(0, ny, 0); L.uv.push(0.5, 0.5);
    for (let i = 0; i <= S; i++) {
      const a = (i / S) * TAU;
      L.pos.push(r * Math.sin(a), y, r * Math.cos(a)); L.nor.push(0, ny, 0); L.uv.push(0.5 + 0.5 * Math.sin(a), 0.5 + 0.5 * Math.cos(a));
    }
    for (let i = 0; i < S; i++) {
      if (up) L.idx.push(b, b + 1 + i, b + 2 + i); else L.idx.push(b, b + 2 + i, b + 1 + i);
    }
  };
  const mesh = (L, m) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(L.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(L.nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(L.uv, 2));
    geo.setIndex(L.idx);
    const n = new THREE.Mesh(geo, m); g.add(n); return n;
  };

  const CAP_H = 0.045, CAP_R = 0.11;
  const Y0 = 0.04, Y1 = 0.445, YC = (Y0 + Y1) / 2;
  const R = 0.17, B = 0.25;
  const rAt = (y) => R * Math.sqrt(Math.max(0, 1 - ((y - YC) / B) ** 2));

  // --- paper panels and hoop bands, lofted together up the profile
  const P = newL(), H = newL();
  const N = 9, W = 0.009, D = 0.003;
  let px = rAt(Y0), py = Y0;
  disk(P, px, py, false);                                     // the paper's end, inside the bottom cap
  for (let k = 1; k <= N; k++) {
    const y = Y0 + (k / (N + 1)) * (Y1 - Y0), lo = y - W / 2, hi = y + W / 2;
    const xl = rAt(lo) + D, xh = rAt(hi) + D;
    band(P, px, py, xl, lo);                                  // paper panel up to the hoop
    band(H, xl, lo, xh, hi);                                  // the hoop
    px = xh; py = hi;
  }
  band(P, px, py, rAt(Y1), Y1);
  disk(P, rAt(Y1), Y1, true);
  mesh(P, paper);

  // --- caps and bail in the lacquer black
  const K = newL();
  const cap = (y0) => { disk(K, CAP_R, y0, false); band(K, CAP_R, y0, CAP_R, y0 + CAP_H); disk(K, CAP_R, y0 + CAP_H, true); };
  cap(0);
  cap(Y1 - 0.005);
  mesh(H, lacquer);
  mesh(K, lacquer);

  // bail: a tube of radius 0.011 along a half ellipse (0.055 m half-span, crown at 0.55) in the YZ plane,
  // its feet run 0.15 rad past the horizontal so they sink into the cap
  const T = newL();
  const TOP = Y1 - 0.005 + CAP_H, TR = 0.011, AZ = 0.055, ALONG = 8, ROUND = 6;
  const yb = TOP - 0.004, AY = 0.55 - TR - yb;
  const t0 = -0.15, t1 = Math.PI + 0.15;
  for (let j = 0; j <= ALONG; j++) {
    const t = t0 + (j / ALONG) * (t1 - t0);
    const cy = yb + AY * Math.sin(t), cz = AZ * Math.cos(t);
    let ny = Math.sin(t) / AY, nz = Math.cos(t) / AZ;         // the ellipse's outward normal in YZ
    const nl = Math.hypot(ny, nz); ny /= nl; nz /= nl;
    for (let i = 0; i <= ROUND; i++) {
      const b = (i / ROUND) * TAU, nx = Math.sin(b), nr = Math.cos(b);
      T.pos.push(TR * nx, cy + TR * nr * ny, cz + TR * nr * nz);
      T.nor.push(nx, nr * ny, nr * nz);
      T.uv.push(i / ROUND, j / ALONG);
    }
  }
  for (let j = 0; j < ALONG; j++) for (let i = 0; i < ROUND; i++) {
    const a = j * (ROUND + 1) + i, b = a + ROUND + 1;
    T.idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  mesh(T, lacquer);

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
