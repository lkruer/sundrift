// pagoda — a five-storey pagoda (gojū-no-tō) for a mountain shrine: a stone plinth, five storeys narrowing upward,
// each a vermilion frame with white wall panels under a dark tiled roof whose eaves reach well out and turn up at the
// corners, a paper lantern hung under every corner of the eaves, and the bronze spire (sōrin) of nine rings with its
// jewel. About 21 m to the jewel, 6.4 m across the plinth. The lanterns are their own emissive material, lit at
// night. Roofs are four sloped quads a storey, their corners lifted; every face is flat shaded.
export default function (THREE) {
  const g = new THREE.Group();
  const M = (color, name, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, flatShading: true, ...extra }); m.name = name; return m; };
  const stone = M(0x8d877c, 'stone'), red = M(0xb83a22, 'vermilion'), white = M(0xe9e1cf, 'plaster');
  const roof = M(0x2e3036, 'roof tiles', { roughness: 0.6 }), bronze = M(0x9a7a3a, 'bronze', { metalness: 0.6, roughness: 0.4 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xd8442a, emissive: 0xff6a2a, emissiveIntensity: 1.6, roughness: 0.8, metalness: 0 });
  lamp.name = 'lantern';
  const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };

  // the plinth and its step
  box(6.4, 0.6, 6.4, stone, 0, 0.3, 0);
  box(5.2, 0.3, 5.2, stone, 0, 0.75, 0);
  let y = 0.9;
  for (let i = 0; i < 5; i++) {
    const w = 4.0 - i * 0.42, h = i === 0 ? 2.5 : 2.0;
    // the storey: a white body with a vermilion post at each corner and a vermilion band at its head
    box(w, h, w, white, 0, y + h / 2, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.26, h, 0.26, red, sx * (w / 2 - 0.1), y + h / 2, sz * (w / 2 - 0.1));
    box(w + 0.1, 0.34, w + 0.1, red, 0, y + h - 0.17, 0);
    // the roof: eaves reaching out, corners turned up
    const top = y + h, R = w / 2 + 1.55, r = w / 2 - 0.2, rise = 1.05, lift = 0.38;
    const P = [], I = [];
    const corner = (sx, sz, rad, yy) => [sx * rad, yy, sz * rad];
    const ring = (rad, yy, up) => [corner(-1, -1, rad, yy + up), corner(1, -1, rad, yy + up), corner(1, 1, rad, yy + up), corner(-1, 1, rad, yy + up)];
    const low = ring(R, top + 0.1, 0), high = ring(r, top + rise, 0);
    // the corners of the eaves lift; the middle of each edge stays low: split each edge at its middle
    const lowC = low.map((p) => [p[0], p[1] + lift, p[2]]);
    const mid = [0, 1, 2, 3].map((k) => { const a = low[k], b = low[(k + 1) % 4]; return [(a[0] + b[0]) / 2, a[1], (a[2] + b[2]) / 2]; });
    const midH = [0, 1, 2, 3].map((k) => { const a = high[k], b = high[(k + 1) % 4]; return [(a[0] + b[0]) / 2, a[1], (a[2] + b[2]) / 2]; });
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      // two quads a side: corner to middle, middle to the next corner, each up to the ridge ring
      for (const [a, b, c, d] of [[lowC[k], mid[k], midH[k], high[k]], [mid[k], lowC[k2], high[k2], midH[k]]]) {
        const base = P.length / 3; P.push(...a, ...b, ...c, ...d); I.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    // (the underside, so the eaves are solid seen from below)
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4, base = P.length / 3;
      P.push(...lowC[k], ...lowC[k2], 0, top + 0.05, 0);
      I.push(base, base + 2, base + 1);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); rg.setIndex(I);
    const flat = rg.toNonIndexed(); flat.computeVertexNormals();
    g.add(new THREE.Mesh(flat, roof));
    // a lantern hung under each corner of the eaves
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const o = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.34, 8), lamp);
      o.position.set(sx * (R - 0.35), top - 0.2 + lift * 0.6, sz * (R - 0.35));
      g.add(o);
    }
    // the next storey sits on the ridge
    y = top + rise - 0.25;
  }
  // the spire: a stepped base, nine rings on the mast, the flame-shaped water guard, the jewel
  box(0.9, 0.35, 0.9, bronze, 0, y + 0.18, 0);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.8, 8), bronze); mast.position.set(0, y + 0.35 + 1.9, 0); g.add(mast);
  for (let k = 0; k < 9; k++) {
    const rr = 0.34 - k * 0.018;
    const o = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 0.08, 10), bronze); o.position.set(0, y + 0.7 + k * 0.3, 0); g.add(o);
  }
  const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), bronze); jewel.scale.set(1, 1.5, 1); jewel.position.set(0, y + 4.35, 0); g.add(jewel);

  // --- the six lines: measure vertices, ground at y = 0, centre on x/z ---------
  const bb = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((o) => { const p = o.isMesh && o.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) bb.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld)); });
  const c = bb.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= bb.min.y; o.position.z -= c.z; });
  return g;
}
