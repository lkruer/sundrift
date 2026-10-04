// farmhouse — a farmhouse of the valley (minka): one and a half storeys under a big irimoya roof of dark kawara tiles
// (a hip below, a small gable above, set back from the hip's top), its ridge capped with onigawara at both ends and the
// four hips ridged; white plaster walls in a dark timber frame over a dark board wainscot; along the front an engawa,
// a timber deck before a run of sliding glass doors, under its own lean-to roof on slender posts; the entrance's
// sliding door at the right end; small lattice windows on the other sides; all on a footing of stone. The roof is
// built face by face: each plane of the irimoya is one polygon (the front slope a hexagon), with a soffit under the
// eaves and a fascia round them so it reads solid from below. The glass is its own material ('window'): the game lights
// it at night. Front faces +Z. 11 x 7.2 m on plan, 12.8 x 9 m over the eaves, 7 m to the ridge.
export default function (THREE) {
  const g = new THREE.Group();
  const M = (color, name, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...extra }); m.name = name; return m; };
  const plaster = M(0xe8e2d2, 'plaster'), timber = M(0x3d2c22, 'timber'), wood = M(0x6e4f36, 'wood');
  const tile = M(0x4b515b, 'roof tiles', { roughness: 0.7 }), ridge = M(0x33373e, 'ridge', { roughness: 0.7 });
  const stone = M(0x8c867b, 'stone', { roughness: 0.95 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x2f3d47, emissive: 0xffb466, emissiveIntensity: 0, roughness: 0.25, metalness: 0.1 });
  glass.name = 'window';

  const box = (w, h, d, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; };
  // a box from a to b (a beam along any line), w x h in section
  const beam = (a, b, w, h, m) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, L), m);
    o.position.copy(A).addScaledVector(d, 0.5);
    o.lookAt(B.x, B.y, B.z);
    g.add(o); return o;
  };
  // a flat polygon (a roof plane), its points in order round it; flip winds it the other way
  const poly = (pts, m, flip = false) => {
    const pos = [];
    for (let i = 1; i < pts.length - 1; i++) {
      const tri = flip ? [pts[0], pts[i + 1], pts[i]] : [pts[0], pts[i], pts[i + 1]];
      for (const p of tri) pos.push(...p);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    const o = new THREE.Mesh(geo, m); g.add(o); return o;
  };

  const HX = 5.5, HZ = 3.6;                   // the walls' half extents
  const F0 = 0.45, WT = 3.55;                 // the floor on its footing, the top of the walls
  // ---- footing, walls, wainscot, the frieze up under the roof
  box(2 * HX + 0.4, F0, 2 * HZ + 0.4, stone, 0, F0 / 2, 0);
  box(2 * HX, WT - F0, 2 * HZ, plaster, 0, (F0 + WT) / 2, 0);
  // (the wainscot on the back and the ends: the front is the engawa's doors)
  box(2 * HX + 0.06, 0.95, 0.06, timber, 0, F0 + 0.475, -HZ - 0.01);
  for (const s of [1, -1]) box(0.06, 0.95, 2 * HZ, timber, s * (HX + 0.01), F0 + 0.475, 0);
  box(2 * HX - 0.1, 0.75, 2 * HZ - 0.1, plaster, 0, WT + 0.36, 0);

  // ---- the frame: corner posts, posts along the back and the ends, the head beam and the mid rail (nageshi)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.22, WT - F0 + 0.02, 0.22, timber, sx * (HX - 0.05), (F0 + WT) / 2, sz * (HZ - 0.05));
  for (let x = -HX + 1.83; x < HX - 0.5; x += 1.83) box(0.14, WT - F0, 0.06, timber, x, (F0 + WT) / 2, -HZ - 0.03);
  for (const sx of [-1, 1]) for (const z of [-1.2, 1.2]) box(0.06, WT - F0, 0.14, timber, sx * (HX + 0.03), (F0 + WT) / 2, z);
  for (const [w, d] of [[2 * HX + 0.12, 2 * HZ + 0.12]]) {
    box(w, 0.26, d, timber, 0, WT - 0.13, 0);
    box(w - 0.02, 0.12, d - 0.02, timber, 0, 2.35, 0);
  }

  // ---- the front: engawa deck, the run of glass doors, the entrance at the right end
  const EZ = HZ + 0.55;
  box(8.6, 0.12, 1.1, wood, -0.9, F0 + 0.06, EZ);
  for (const x of [-5.1, -2.8, -0.4, 2.0, 3.1]) box(0.12, F0, 0.12, timber, x, F0 / 2, EZ + 0.42);
  for (let k = 0; k <= 6; k++) {
    const x = -5.2 + k * 1.4;
    box(0.07, 1.8, 0.08, timber, x, F0 + 0.98, HZ + 0.07);                     // the doors' stiles
    if (k === 6) break;
    box(1.34, 1.72, 0.04, glass, x + 0.7, F0 + 0.98, HZ + 0.05);
    box(1.34, 0.05, 0.08, timber, x + 0.7, F0 + 0.5, HZ + 0.07);                // the lower rail
  }
  box(8.5, 0.08, 0.08, timber, -1.0, F0 + 1.86, HZ + 0.07);
  // the entrance: a wide timber sliding door with glass above, a step of stone
  box(1.8, 1.25, 0.05, wood, 4.35, F0 + 0.62, HZ + 0.05);
  box(1.8, 0.6, 0.04, glass, 4.35, F0 + 1.55, HZ + 0.05);
  for (const x of [3.45, 4.35, 5.25]) box(0.07, 1.95, 0.08, timber, x, F0 + 0.97, HZ + 0.07);
  box(1.9, 0.2, 0.7, stone, 4.35, 0.1, HZ + 0.55);
  // the lean-to roof over the engawa (hisashi), from the wall down to its posts
  {
    const y0 = 3.15, y1 = 2.66, z0 = HZ, z1 = HZ + 1.55, x0 = -5.6, x1 = 5.6;
    poly([[x0, y0, z0], [x0, y1, z1], [x1, y1, z1], [x1, y0, z0]], tile);
    poly([[x0, y0 - 0.1, z0], [x0, y1 - 0.1, z1], [x1, y1 - 0.1, z1], [x1, y0 - 0.1, z0]], wood, true);
    box(x1 - x0, 0.12, 0.1, timber, 0, y1 - 0.06, z1);
    for (const x of [-5.3, -2.0, 1.3, 5.3]) box(0.11, y1 - F0, 0.11, timber, x, (y1 + F0) / 2, z1 - 0.12);
  }

  // ---- windows on the ends and the back: glass behind a timber frame and a lattice
  const win = (x, z, ry, w = 1.1, h = 0.8, y = 1.75) => {
    const fx = Math.sin(ry), fz = Math.cos(ry), lx = Math.cos(ry), lz = -Math.sin(ry);
    box(w, h, 0.04, glass, x + fx * 0.02, y, z + fz * 0.02, ry);
    box(w + 0.16, 0.09, 0.08, timber, x + fx * 0.05, y + h / 2 + 0.04, z + fz * 0.05, ry);
    box(w + 0.16, 0.09, 0.08, timber, x + fx * 0.05, y - h / 2 - 0.04, z + fz * 0.05, ry);
    for (const k of [-0.5, -0.17, 0.17, 0.5]) box(0.05, h, 0.06, timber, x + lx * k * w + fx * 0.06, y, z + lz * k * w + fz * 0.06, ry);
  };
  for (const x of [-3.6, 0, 3.6]) win(x, -HZ - 0.02, Math.PI);
  win(HX + 0.02, 0.6, Math.PI / 2); win(-HX - 0.02, -0.6, -Math.PI / 2);

  // ---- the roof: an irimoya, its planes from the eaves (ye) to the gable's foot (yh) and the ridge (yr)
  const Xe = HX + 0.95, Ze = HZ + 0.95, ye = 3.57, yr = 7.25, yh = 5.55;
  const k = (yr - ye) / Ze;                                   // the pitch, rise per metre
  const Zh = (yr - yh) / k, Xh = Xe - (yh - ye) / k;
  for (const s of [1, -1]) {
    // the long slopes, each a hexagon from the eave line up the hips and the gable's edge to the ridge
    poly([[-Xe, ye, s * Ze], [Xe, ye, s * Ze], [Xh, yh, s * Zh], [Xh, yr, 0], [-Xh, yr, 0], [-Xh, yh, s * Zh]], tile, s < 0);
    // the hipped ends, and the gable over each
    poly([[s * Xe, ye, Ze], [s * Xe, ye, -Ze], [s * Xh, yh, -Zh], [s * Xh, yh, Zh]], tile, s < 0);
    poly([[s * Xh, yh, Zh], [s * Xh, yh, -Zh], [s * Xh, yr, 0]], timber, s < 0);
    // the gable's white panel and its barge boards
    poly([[s * (Xh + 0.01), yh + 0.35, Zh * 0.7], [s * (Xh + 0.01), yh + 0.35, -Zh * 0.7], [s * (Xh + 0.01), yr - 0.35, 0]], plaster, s < 0);
    for (const sz of [1, -1]) beam([s * (Xh + 0.05), yh, sz * Zh], [s * (Xh + 0.05), yr + 0.05, 0], 0.08, 0.22, timber);
  }
  // the soffit under the eaves, and the fascia round them
  poly([[-Xe, ye - 0.05, Ze], [-HX, ye - 0.05, HZ], [HX, ye - 0.05, HZ], [Xe, ye - 0.05, Ze]], wood);
  poly([[-Xe, ye - 0.05, -Ze], [Xe, ye - 0.05, -Ze], [HX, ye - 0.05, -HZ], [-HX, ye - 0.05, -HZ]], wood);
  poly([[Xe, ye - 0.05, Ze], [HX, ye - 0.05, HZ], [HX, ye - 0.05, -HZ], [Xe, ye - 0.05, -Ze]], wood);
  poly([[-Xe, ye - 0.05, Ze], [-Xe, ye - 0.05, -Ze], [-HX, ye - 0.05, -HZ], [-HX, ye - 0.05, HZ]], wood);
  box(2 * Xe, 0.16, 0.08, timber, 0, ye - 0.04, Ze); box(2 * Xe, 0.16, 0.08, timber, 0, ye - 0.04, -Ze);
  box(0.08, 0.16, 2 * Ze, timber, Xe, ye - 0.04, 0); box(0.08, 0.16, 2 * Ze, timber, -Xe, ye - 0.04, 0);
  // the ridge, its onigawara, and the four hips' ridges
  box(2 * Xh + 0.5, 0.42, 0.38, ridge, 0, yr + 0.12, 0);
  for (const s of [1, -1]) {
    const o = box(0.36, 0.72, 0.5, ridge, s * (Xh + 0.3), yr + 0.3, 0);
    o.rotation.z = -s * 0.25;
    for (const sz of [1, -1]) beam([s * Xe, ye + 0.08, sz * Ze], [s * Xh, yh + 0.08, sz * Zh], 0.2, 0.18, ridge);
  }
  // tile courses: low ridges across each long slope, so the plane reads as rows of kawara
  for (const s of [1, -1]) for (const t of [0.22, 0.45, 0.68]) {
    const z = s * Ze * (1 - t), y = ye + (yr - ye) * t, xr = Xe - (Xe - Xh) * Math.min(1, t * (yr - ye) / (yh - ye));
    beam([-xr + 0.1, y + 0.05, z], [xr - 0.1, y + 0.05, z], 0.06, 0.08, ridge);
  }

  // --- the six lines: measure vertices, ground at y = 0, centre on x/z ---------
  const bb = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((o) => { const p = o.isMesh && o.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) bb.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld)); });
  const c = bb.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= bb.min.y; o.position.z -= c.z; });
  return g;
}
