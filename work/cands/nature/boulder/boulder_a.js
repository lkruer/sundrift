// boulder — candidate A: primitives. One IcosahedronGeometry (detail 1) with every
// unique vertex pushed in or out by a hash of its index (up to 18 %), scaled to
// 1.5 x 1.1 x 1.3 m and flattened underneath to y = 0 so it sits in the ground.
// A squashed, lightly lumped icosahedron in moss green sits sunk into the crown.
export default function (THREE) {
  const g = new THREE.Group();

  const stone = new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.95, metalness: 0, flatShading: true });
  stone.name = 'stone';
  const moss = new THREE.MeshStandardMaterial({ color: 0x5f7a3a, roughness: 0.9, metalness: 0, flatShading: true });
  moss.name = 'foliage';

  const hash = (n) => {
    let h = (n | 0) + 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  // Push every UNIQUE vertex along its radius by a hashed factor. The icosahedron is
  // unindexed (each face owns its own corners), so the index is assigned per distinct
  // position; hashing the raw attribute index would tear the faces apart.
  const lumpy = (geo, amount, seed) => {
    const p = geo.attributes.position, ids = new Map();
    let next = 0;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const key = Math.round(x * 500) + ',' + Math.round(y * 500) + ',' + Math.round(z * 500);
      let id = ids.get(key);
      if (id === undefined) { id = next++; ids.set(key, id); }
      const f = 1 + (hash(id * 131 + seed) - 0.5) * 2 * amount;
      p.setXYZ(i, x * f, y * f, z * f);
    }
    return geo;
  };

  // --- the rock ---------------------------------------------------------------
  const rock = lumpy(new THREE.IcosahedronGeometry(1, 1), 0.18, 11);
  rock.scale(0.75, 0.72, 0.65);
  rock.translate(0, 0.40, 0);
  const rp = rock.attributes.position;
  for (let i = 0; i < rp.count; i++) if (rp.getY(i) < 0) rp.setY(i, 0);   // flat underside at y = 0
  // the hash moved the extents, so fit the rock to the brief's 1.5 x 1.1 x 1.3 exactly
  rock.computeBoundingBox();
  const bb = rock.boundingBox, sz = bb.getSize(new THREE.Vector3());
  rock.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  rock.scale(1.5 / sz.x, 1.1 / sz.y, 1.3 / sz.z);
  rock.computeVertexNormals();
  g.add(new THREE.Mesh(rock, stone));

  // --- moss cap: 0.9 x 0.3 x 0.8 m over the rock's highest point, sunk into the crown
  //     (centre 0.10 below the top, so its thin rim is buried and 0.1 m of moss shows)
  const top = new THREE.Vector3(0, -1, 0);
  for (let i = 0; i < rp.count; i++) if (rp.getY(i) > top.y) top.set(rp.getX(i), rp.getY(i), rp.getZ(i));
  const cap = lumpy(new THREE.IcosahedronGeometry(1, 1), 0.10, 5);
  cap.scale(0.45, 0.15, 0.40);
  cap.computeVertexNormals();
  const capMesh = new THREE.Mesh(cap, moss);
  capMesh.position.set(top.x * 0.6, top.y - 0.10, top.z * 0.6);
  capMesh.rotation.y = 0.7;
  g.add(capMesh);

  // --- the six lines: measure vertices, ground at y = 0, centre on x/z ---------
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });

  return g;
}
