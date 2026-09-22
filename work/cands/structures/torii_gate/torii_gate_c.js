// torii_gate — candidate C: a different breakdown.
// The kasagi and its cap are hand-built lofts: 25 rectangular cross-sections along the span,
// skinned into a BufferGeometry in a loop, flat between the pillars and easing upward (a
// quadratic ease) to 0.25 m higher at the ends, so the sweep is a true curve rather than a hinge.
// Pillars are 24-sided cylinders with a dark daiwa collar under the kasagi; each drum stands on a
// square stone pad; the kusabi are two-section lofts (tapered frustums) rather than boxes.
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (hex, rough, name, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: 0 }, extra || {}));
    if (name) m.name = name;
    return m;
  };
  const verm = mat(0xc9402b, 0.6);
  const vermL = mat(0xc9402b, 0.6, null, { side: THREE.DoubleSide, flatShading: true });   // lofts
  const stone = mat(0x8a7f72, 0.95, 'stone', { flatShading: true });
  const dark = mat(0x2b2d31, 0.35);
  const darkL = mat(0x2b2d31, 0.35, null, { side: THREE.DoubleSide, flatShading: true });

  const box = (w, h, d, x, y, z, m) => {
    const n = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    n.position.set(x, y, z); g.add(n); return n;
  };
  // skin a list of closed loops (each an array of [x,y,z], same count) into a solid with end caps
  const loft = (sections, m) => {
    const N = sections[0].length, S = sections.length;
    const pos = [], idx = [];
    for (const sec of sections) for (const p of sec) pos.push(p[0], p[1], p[2]);
    for (let i = 0; i < S - 1; i++) for (let k = 0; k < N; k++) {
      const a = i * N + k, b = i * N + (k + 1) % N, c = (i + 1) * N + (k + 1) % N, d = (i + 1) * N + k;
      idx.push(a, b, c, a, c, d);
    }
    const last = (S - 1) * N;
    for (let k = 1; k < N - 1; k++) { idx.push(0, k + 1, k); idx.push(last, last + k, last + k + 1); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const flat = geo.toNonIndexed(); flat.computeVertexNormals();
    const n = new THREE.Mesh(flat, m); g.add(n); return n;
  };
  const rect = (x, y0, y1, hd) => [[x, y0, hd], [x, y0, -hd], [x, y1, -hd], [x, y1, hd]];

  const LEAN = 3 * Math.PI / 180, PX = 2.2, PAD_H = 0.06, DRUM_H = 0.22, TOP = PAD_H + DRUM_H;
  const PIL_R = 0.21;
  const pillarX = (y) => PX - (y - TOP) * Math.tan(LEAN);

  // --- footings: square stone pad, round drum ---------------------------------------
  for (const s of [1, -1]) {
    box(0.9, PAD_H, 0.9, s * PX, PAD_H / 2, 0, stone);
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, DRUM_H, 16), stone);
    d.position.set(s * PX, PAD_H + DRUM_H / 2, 0); g.add(d);
  }

  // --- pillars with a dark daiwa collar at the top, under the kasagi ---------------
  for (const s of [1, -1]) {
    const hub = new THREE.Group();
    hub.position.set(s * PX, TOP, 0); hub.rotation.z = s * LEAN; g.add(hub);
    const L = 4.3;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(PIL_R, PIL_R, L + 0.1, 24), verm);
    c.position.y = (L + 0.1) / 2 - 0.05; hub.add(c);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(PIL_R + 0.05, PIL_R + 0.02, 0.14, 24), dark);
    ring.position.y = L - 0.02; hub.add(ring);
  }

  // --- nuki, and lofted kusabi wedges front and back of each pillar ---------------
  const NY = 3.42;
  box(5.6, 0.24, 0.20, 0, NY, 0, verm);
  for (const s of [1, -1]) for (const f of [1, -1]) {
    const x = s * pillarX(NY), z0 = f * 0.19, z1 = f * 0.31;
    const sec = (z, hw, hh) => [[x - hw, NY - hh, z], [x + hw, NY - hh, z], [x + hw, NY + hh, z], [x - hw, NY + hh, z]];
    loft([sec(z0, 0.09, 0.23), sec(z1, 0.06, 0.15)], vermL);
  }

  // --- kasagi: 25 sections along 6.4 m, flat in the middle, easing up 0.25 m at the ends ---
  const rise = (x) => { const t = Math.min(1, Math.max(0, (Math.abs(x) - 1.4) / 1.8)); return 0.25 * t * t; };
  const kSec = [], cSec = [];
  for (let i = 0; i <= 24; i++) {
    const x = -3.2 + 6.4 * i / 24, r = rise(x);
    kSec.push(rect(x, 4.65 + r, 5.01 + r, 0.17));
    cSec.push(rect(x, 5.01 + r, 5.07 + r, 0.17));
  }
  loft(kSec, vermL);
  loft(cSec, darkL);

  // --- strut and tablet between the beams -------------------------------------------
  box(0.14, 1.15, 0.14, 0, 3.54 + 0.55, 0, verm);
  box(0.3, 0.5, 0.1, 0, 4.38, 0.09, verm);

  // --- ground and centre by measuring vertices -----------------------------------
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
