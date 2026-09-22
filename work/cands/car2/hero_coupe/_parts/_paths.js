
  const nose = endPath(1, 2.16, 1.56, wrapF);
  const F = (v) => (typeof v === 'function' ? v : () => v);
  // a band profile with a chamfered top edge: outer face from y0 to y1 - ch, then in and up
  const bandProf = (y0, y1, t, ch) => { const Y0 = F(y0), Y1 = F(y1); return [[0, Y0], [0, (x, z) => Y1(x, z) - ch], [-ch * 0.8, Y1], [-t, Y1], [-t, Y0]]; };
  const plainProf = (y0, y1, t, n0) => [[n0 || 0, y0], [n0 || 0, y1], [-t, y1], [-t, y0]];
  // a small box tangent to a swept face at x, its back sunk into the face
  const onFace = (path, x, y, w, h, d, m, proud, ry) => {
    const f = faceAt(path, x), grp = new THREE.Group();
    grp.position.set(f.x, y, f.z); grp.rotation.y = f.yaw + (ry || 0); body.add(grp);
    add(grp, box(w, h, d), m, 0, 0, (proud || 0) + d / 2 - d);
    return grp;
  };
  const tail = endPath(-1, -2.19, -1.56, wrapR).reverse();                                        // reversed so the swept normal faces out
