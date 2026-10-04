// kura — a farm's storehouse: two storeys of thick earthen walls finished in white plaster, a skirt of charred-cedar
// boards with battens to the height of a man, a heavy plaster cornice under the eaves, and a kawara gable roof laid
// thick, its ridge raised and finished at both ends with onigawara. The door (dark timber in a deep plaster frame) is
// in the middle of the long front under its own little tiled canopy; two small windows in deep frames above it, and
// one high in each gable. On a footing of dressed stone. Front faces +Z. 5 x 4 m on plan, 7 m to the ridge.
export default function (THREE) {
  const g = new THREE.Group();
  const M = (color, name, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...extra }); m.name = name; return m; };
  const plaster = M(0xebe6d8, 'plaster'), board = M(0x2c2622, 'charred cedar'), timber = M(0x3d2c22, 'timber');
  const tile = M(0x484e58, 'roof tiles', { roughness: 0.7 }), ridge = M(0x30343b, 'ridge', { roughness: 0.7 });
  const stone = M(0x928b7f, 'stone', { roughness: 0.95 }), dark = M(0x1d1f22, 'opening');

  const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };

  const HX = 2.5, HZ = 2.0, F0 = 0.5, WT = 4.9, RY = 6.55;
  // ---- footing, walls, the board skirt and its battens, the cornice
  box(2 * HX + 0.36, F0, 2 * HZ + 0.36, stone, 0, F0 / 2, 0);
  box(2 * HX, WT - F0, 2 * HZ, plaster, 0, (F0 + WT) / 2, 0);
  box(2 * HX + 0.08, 1.35, 2 * HZ + 0.08, board, 0, F0 + 0.675, 0);
  for (const s of [1, -1]) {
    for (const x of [-1.9, -0.95, 0.95, 1.9]) box(0.07, 1.35, 0.05, timber, x, F0 + 0.675, s * (HZ + 0.06));
    for (const z of [-1.0, 0, 1.0]) box(0.05, 1.35, 0.07, timber, s * (HX + 0.06), F0 + 0.675, z);
  }
  box(2 * HX + 0.34, 0.3, 2 * HZ + 0.34, plaster, 0, WT - 0.05, 0);
  box(2 * HX + 0.2, 0.18, 2 * HZ + 0.2, plaster, 0, WT - 0.3, 0);

  // ---- the gables: a plaster prism from the cornice up under the ridge
  {
    const sh = new THREE.Shape();
    sh.moveTo(-HZ, 0); sh.lineTo(HZ, 0); sh.lineTo(0, RY - WT - 0.15); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 2 * HX, bevelEnabled: false });
    geo.rotateY(Math.PI / 2); geo.translate(-HX, WT, 0);
    g.add(new THREE.Mesh(geo, plaster));
  }

  // ---- the roof: two thick slabs at the pitch, overhanging the walls, the ridge and its onigawara on top
  const OV = 0.55, OG = 0.45, RT = 0.24;
  const run = HZ + OV, rise = RY - WT - 0.05, a = Math.atan2(rise, run), L = Math.hypot(run, rise);
  for (const s of [1, -1]) {
    const o = box(2 * HX + 2 * OG, RT, L, tile, 0, WT + rise / 2 + RT * 0.5 * Math.cos(a), s * (run / 2) + s * RT * 0.5 * Math.sin(a));
    o.rotation.x = s * a;
    // (a row of tile ends along the eave, a shade darker: the slab's edge read as a thick board)
    const e = box(2 * HX + 2 * OG + 0.04, 0.16, 0.16, ridge, 0, WT - 0.02, s * (run - 0.04));
    e.rotation.x = s * a;
  }
  box(2 * HX + 2 * OG + 0.2, 0.46, 0.46, ridge, 0, RY + 0.2, 0);
  box(2 * HX + 2 * OG + 0.1, 0.16, 0.6, ridge, 0, RY - 0.02, 0);
  for (const s of [1, -1]) {
    const o = box(0.42, 0.85, 0.62, ridge, s * (HX + OG + 0.2), RY + 0.42, 0);
    o.rotation.z = -s * 0.28;
  }

  // ---- the door in its deep frame, its canopy; the windows above and in the gables
  box(1.7, 2.5, 0.22, plaster, 0, F0 + 1.25, HZ + 0.1);
  box(1.2, 2.0, 0.06, timber, 0, F0 + 1.0, HZ + 0.2);
  for (const x of [-0.3, 0.3]) box(0.05, 1.9, 0.04, board, x, F0 + 1.0, HZ + 0.24);
  {
    const o = box(2.3, 0.12, 1.0, tile, 0, F0 + 2.75, HZ + 0.5);
    o.rotation.x = 0.32;
    for (const x of [-1.0, 1.0]) { const b = box(0.1, 0.1, 0.8, timber, x, F0 + 2.55, HZ + 0.42); b.rotation.x = 0.32; }
  }
  for (const x of [-1.45, 1.45]) {
    box(0.86, 0.86, 0.2, plaster, x, 3.75, HZ + 0.08);
    box(0.56, 0.56, 0.06, dark, x, 3.75, HZ + 0.16);
  }
  for (const s of [1, -1]) {
    box(0.2, 0.7, 0.7, plaster, s * (HX + 0.08), 5.45, 0);
    box(0.06, 0.44, 0.44, dark, s * (HX + 0.16), 5.45, 0);
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
