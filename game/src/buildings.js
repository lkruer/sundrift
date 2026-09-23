/**
 * NEO TOKYO buildings: one MeshStandardMaterial for every building box of the city.
 *
 *     const mat = buildingMaterial(THREE, { night: 1 });
 *     const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, n);
 *     // per building: matrix = compose(lot centre with y = ground + h / 2, rotation about Y, scale w x h x d)
 *     mesh.setMatrixAt(i, m); mesh.setColorAt(i, new THREE.Color(facadeColour(rng())));
 *     mat.userData.uNight.value = 0..1;   // window glow, any time, no recompile
 *
 * The facade is drawn in the shader, in metres, from the unit box's own coordinates times the instance scale, so
 * a window keeps its real size however the box is scaled, and the grid starts at each face's corner so every
 * face has whole bays and a pier at each end:
 *   - the ground floor (the bottom 4 m) is shop fronts: pilasters between shops, big glass in panes with dark
 *     mullions, a door, a fascia band over each shop; behind the glass a few large flat blocks per pane (shelf
 *     bands, a counter, an open floor, a poster), lit warm white, cool white or tinted; some shops shuttered,
 *     some dark with the green exit sign lit. The brightest pane reaches about 1.5 linear, most sit well below;
 *   - above it, floors every 3.4 m and bays of about 2.6 m (fitted to the face), in one of four facade types
 *     per building: punched windows, office ribbon windows, paired windows, a glass curtain wall; piers between
 *     the bays and a darker slab band at every floor, rain streaks under the sills, a parapet on top and a
 *     louvred plant level where a floor does not fit;
 *   - roofs (world normal mostly up) have no windows: a coping round a dark deck.
 * Each window's lit or dark, its colour (warm, cool, fluorescent, now and then a coloured one), its brightness
 * and its blinds or curtains come from a hash of its integer cell and the instance's position; office floors come
 * on and go off together. Lit windows are EMISSIVE, scaled by `uNight`, so they glow with no light on them and the
 * brightest bloom a little. By day they are dark glass that reflects the sky. Every hash is fed integers and
 * flat (not interpolated) values, and every fine line is filtered by the pixel's footprint, so nothing shimmers.
 *
 * The facade colour is the instance colour (InstancedMesh.setColorAt): three multiplies it into the diffuse
 * colour as it does for any instanced material, and the shader builds the facade from that. Do not set
 * `vertexColors` on this material: a BoxGeometry has no colour attribute and would read as black.
 *
 * The hook is installed before the game's lighting rig sees the material; the rig keeps it and runs it first,
 * and every replacement here keeps the chunk it replaces, so the rig's own patches still find theirs.
 */
import * as THREE from 'three';

export const FLOOR_H = 3.4;    // metres floor to floor
export const BAY_W = 2.6;      // target bay width (fitted per face)
export const SHOP_H = 4.0;     // the ground floor

/**
 * Facade colours for the instances: dark greys, concrete, tile beige, white tile, and a few dark blue, brown
 * and salmon. Pass a number in 0..1 (a seeded random) to facadeColour() for a pick.
 */
export const FACADE_COLOURS = [
  0x3b3d43, 0x46484e, 0x2f3136, 0x55575c,             // dark greys
  0x8c8983, 0x9b978f, 0x7b7872, 0xa6a39b,             // concrete
  0xb9a68b, 0xc6b598, 0xa89478, 0xd2c6b0,             // tile beige
  0xd9d6ce, 0xc9c7c2,                                 // white tile
  0x2d3b54, 0x3a4a63,                                 // dark blue
  0x5b4537, 0x6c5343,                                 // brown
  0xb08a7c,                                           // salmon tile
];
export function facadeColour(r) { return FACADE_COLOURS[Math.min(FACADE_COLOURS.length - 1, Math.floor(r * FACADE_COLOURS.length))]; }

const lin = (hex) => { const c = new THREE.Color(hex); return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`; };

const VS_PARS = /* glsl */`
varying vec4 vBPos;          // metres along the face from its left corner, metres above the base; roof x, z
flat varying vec4 vBDim;     // face width, building height, box size in x and z
flat varying vec4 vBSeed;    // the instance's position (its identity), face index`;

const VS_MAIN = /* glsl */`
{
  mat4 bM = modelMatrix;
  vec3 bSeed = modelMatrix[3].xyz;
  #ifdef USE_INSTANCING
    bM = modelMatrix * instanceMatrix;
    bSeed = instanceMatrix[3].xyz;
  #endif
  vec3 bS = vec3(length(bM[0].xyz), length(bM[1].xyz), length(bM[2].xyz));
  vec3 bP = (position + 0.5) * bS;
  vec3 bN = normal;
  float bFace, bAlong, bW;
  // along runs left to right as the face is seen from outside
  if (abs(bN.x) > 0.5) { bFace = bN.x > 0.0 ? 0.0 : 2.0; bAlong = bN.x > 0.0 ? bS.z - bP.z : bP.z; bW = bS.z; }
  else if (abs(bN.z) > 0.5) { bFace = bN.z > 0.0 ? 1.0 : 3.0; bAlong = bN.z > 0.0 ? bP.x : bS.x - bP.x; bW = bS.x; }
  else { bFace = bN.y > 0.0 ? 4.0 : 5.0; bAlong = bP.x; bW = bS.x; }
  vBPos = vec4(bAlong, bP.y, bP.x, bP.z);
  vBDim = vec4(bW, bS.y, bS.x, bS.z);
  vBSeed = vec4(floor(bSeed * 4.0 + 0.5) * 0.25, bFace);
}`;

function fsPars() {
  return /* glsl */`
uniform float uNight;
varying vec4 vBPos;
flat varying vec4 vBDim;
flat varying vec4 vBSeed;
float bH1(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 bH3(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
// a step and a box, each filtered over w (the pixel's footprint), so the facade does not shimmer
float bStep(float e, float x, float w) { return clamp((x - e) / w + 0.5, 0.0, 1.0); }
float bBox(float a, float b, float x, float w) { return bStep(a, x, w) - bStep(b, x, w); }
// stripes of the given duty, fading to their average once they are finer than the pixel
float bStripe(float x, float period, float duty, float w) {
  float f = fract(x / period), fw = w / period;
  float s = bStep(0.5 - duty * 0.5, f, fw) - bStep(0.5 + duty * 0.5, f, fw);
  return mix(s, duty, smoothstep(0.2, 0.5, fw));
}
vec3 bAccent(float r) {
  return r < 0.2 ? ${lin(0xff6ec7)} : r < 0.4 ? ${lin(0xa878ff)} : r < 0.6 ? ${lin(0xff5a4a)} : r < 0.8 ? ${lin(0x7affb0)} : ${lin(0x6fe8ff)};
}
vec3 bSignCol(float r) {
  return r < 0.22 ? ${lin(0xfff4e6)} : r < 0.36 ? ${lin(0xff3a2a)} : r < 0.5 ? ${lin(0xffc21a)} : r < 0.62 ? ${lin(0x2f7bff)} :
         r < 0.74 ? ${lin(0x22d07a)} : r < 0.86 ? ${lin(0xff4fb0)} : ${lin(0xff8a24)};
}`;
}

function fsMain() {
  const WARM = lin(0xffd9a0), COOL = lin(0xcfe3ff), FLUO = lin(0xe8fff4);
  const SHOP_WARM = lin(0xffd29c), SHOP_COOL = lin(0xdbeaff);
  return /* glsl */`
{
  const float FLOOR = ${FLOOR_H.toFixed(2)}, BAY = ${BAY_W.toFixed(2)}, GF = ${SHOP_H.toFixed(2)};
  vec3 bBase = diffuseColor.rgb;
  float along = vBPos.x, hgt = vBPos.y, faceW = vBDim.x, bldH = vBDim.y;
  float face = vBSeed.w;
  vec3 seed = vBSeed.xyz;
  vec3 bi = bH3(seed * 0.0731 + vec3(17.1, 3.3, 9.7));
  vec3 bj = bH3(seed * 0.0457 + vec3(5.1, 11.9, 2.3));
  vec2 fw = max(fwidth(vec2(along, hgt)), vec2(1e-4));
  float fine = 1.0 - smoothstep(0.015, 0.05, max(fw.x, fw.y));      // 1 up close, 0 once a pixel is over 5 cm
  vec3 wN = (vec4(normal, 0.0) * viewMatrix).xyz;
  vec3 col = bBase, em = vec3(0.0);
  float rough = roughnessFactor;
  vec3 glass = vec3(0.016, 0.02, 0.028);
  if (wN.y > 0.7) {
    // the roof: a dark deck inside a coping
    vec2 rp = vBPos.zw;
    float edge = min(min(rp.x, vBDim.z - rp.x), min(rp.y, vBDim.w - rp.y));
    vec2 rw = max(fwidth(rp), vec2(1e-4));
    float coping = 1.0 - bStep(0.42, edge, max(rw.x, rw.y));
    float seam = max(bStripe(rp.x, 2.4, 0.03, rw.x), bStripe(rp.y, 2.4, 0.03, rw.y));
    col = mix(mix(vec3(0.05, 0.052, 0.056), bBase * 0.35, 0.35) * (1.0 - 0.25 * seam), bBase * 0.9, coping);
    rough = 0.95;
  } else if (wN.y < -0.7) {
    col = bBase * 0.3;
  } else if (hgt < GF) {
    // ---------------------------------------------------------------- shop fronts
    float nb = max(1.0, floor(faceW / BAY + 0.5));
    float shopBays = 1.0 + floor(bj.z * 2.99);
    float nShop = max(1.0, floor(nb / shopBays + 0.5));
    float sw = faceW / nShop;
    float si = clamp(floor(along / sw), 0.0, nShop - 1.0);
    float sx = along - si * sw;
    float sid = si + face * 37.0;
    vec3 sr = bH3(vec3(sid, 2.0, 9.0) + seed * 0.29);     // the shop: open or not, which pane is the door, its light
    vec3 sq = bH3(vec3(sid, 5.0, 1.0) + seed * 0.53);     // its brightness, its tint, its sign
    float pil = 0.3;
    float inShop = bBox(pil, sw - pil, sx, fw.x);
    float lx = sx - pil, usable = max(0.5, sw - 2.0 * pil);
    float np = max(1.0, floor(usable / 1.3 + 0.5)), pw = usable / np;
    float pane = clamp(floor(lx / pw), 0.0, np - 1.0);
    float px = lx - pane * pw;
    float isDoor = 1.0 - step(0.5, abs(pane - floor(sr.y * np)));
    float glassZ = bBox(0.28, 2.86, hgt, fw.y);
    float fasciaZ = bBox(2.98, 3.8, hgt, fw.y);
    // frames: dark bars about 9 cm wide at every pane edge (a little heavier round the door), a transom across
    float fr = mix(0.045, 0.06, isDoor);
    float mull = 1.0 - bBox(fr, pw - fr, px, fw.x);
    float transom = bBox(2.36, 2.44, hgt, fw.y);
    float bar = isDoor * bBox(0.95, 1.02, hgt, fw.y) * bBox(0.15, pw - 0.15, px, fw.x);
    float frameAll = clamp(mull + transom + bar, 0.0, 1.0);
    float state = sr.x;                                            // < 0.64 open, < 0.84 shuttered, else closed
    float open = step(state, 0.64), shut = step(0.64, state) * step(state, 0.84), closed = step(0.84, state);
    // the shop's light: warm or cool white, now and then tinted; most well under the bloom line, a few just over
    vec3 tintC = sr.z < 0.5 ? ${SHOP_WARM} : sr.z < 0.78 ? ${SHOP_COOL} : mix(${SHOP_WARM}, bAccent(sq.x), 0.5);
    float bright = sq.y < 0.8 ? mix(0.36, 0.78, sq.y / 0.8) : mix(1.1, 1.35, (sq.y - 0.8) / 0.2);
    // behind each pane (a cell over a metre wide): shelf bands, a counter, an open floor or a poster, all flat
    vec3 pr = bH3(vec3(pane + 3.0, sid, 7.0) + seed * 0.61);
    float k = 0.8;
    vec3 goods = vec3(1.0);
    if (isDoor > 0.5) k = 0.55;                                    // the doorway: the floor deeper in
    else if (pr.x < 0.45) {
      // shelves: three bands of goods, each one flat tone and a muted colour of its own
      float band = floor(clamp((hgt - 0.3) / 0.58, 0.0, 2.99));
      vec3 gh = bH3(vec3(pane + 1.0, band + 1.0, sid) + seed * 0.71);
      k = hgt > 2.04 ? 0.85 : mix(0.4, 0.78, gh.x);
      goods = hgt > 2.04 ? vec3(1.0) : mix(vec3(1.0), bAccent(gh.y), 0.32);
      float shelf = bBox(0.3, 0.36, hgt, fw.y) + bBox(0.88, 0.94, hgt, fw.y) + bBox(1.46, 1.52, hgt, fw.y) + bBox(2.04, 2.1, hgt, fw.y);
      k *= 1.0 - 0.6 * shelf * fine;
    } else if (pr.x < 0.7) {
      k = hgt < 1.05 ? 0.22 : 0.8;                                 // a counter's dark front, the room above
    }
    k *= mix(0.6, 1.0, smoothstep(0.3, 2.3, hgt));                 // lit from the ceiling, the floor darker
    if (hgt > 2.44) k = 1.1;                                       // the lit ceiling above the transom
    vec3 inner = tintC * goods * bright * k;
    float poster = step(0.85, pr.x) * (1.0 - isDoor) * bBox(0.2 * pw, 0.8 * pw, px, fw.x) * bBox(0.95, 2.1, hgt, fw.y);
    inner = mix(inner, bAccent(pr.y) * (0.25 + 0.3 * bright), poster);
    // shutters: ribbed metal (the ribs fade out with distance)
    vec3 shutter = vec3(0.13, 0.135, 0.14) * (0.85 + 0.25 * bStripe(hgt, 0.09, 0.5, fw.y) * fine) * mix(0.8, 1.0, smoothstep(0.3, 1.2, hgt));
    vec3 frameCol = vec3(0.035, 0.036, 0.04);
    vec3 front = mix(glass, frameCol, frameAll);
    col = mix(bBase * 0.82, mix(front, shutter, shut), inShop * glassZ);
    rough = mix(rough, mix(0.12, 0.6, shut), inShop * glassZ);
    em += inner * open * inShop * glassZ * (1.0 - frameAll);
    // closed shops: dark, a faint light far inside, and the green exit sign over the door
    em += ${SHOP_COOL} * 0.05 * closed * inShop * glassZ * (1.0 - frameAll);
    float exitSign = isDoor * bBox(0.5 * pw - 0.2, 0.5 * pw + 0.2, px, fw.x) * bBox(2.5, 2.66, hgt, fw.y) * max(closed, open * step(sq.z, 0.4));
    em = mix(em, ${lin(0x2aff7a)} * 1.1, exitSign * inShop);
    // the fascia: most open shops light theirs, under the neon; a pale rule round it
    float fLit = open * step(sq.z, 0.72) + shut * step(sq.z, 0.2);
    vec3 fc = bSignCol(sq.z / 0.72);
    float inner2 = bBox(3.05, 3.73, hgt, fw.y) * bBox(pil + 0.07, sw - pil - 0.07, sx, fw.x);
    col = mix(col, mix(bBase * 0.35, vec3(0.03), 0.5), fasciaZ * inShop);
    em += fasciaZ * inShop * fLit * mix(vec3(1.0), fc * mix(0.75, 0.95, smoothstep(3.0, 3.8, hgt)), inner2);
    // the ledge over the fascia, the plinth under the glass
    col = mix(col, bBase * 0.5, bBox(3.8, 4.1, hgt, fw.y));
    col = mix(col, bBase * 1.15, bBox(3.82, 3.86, hgt, fw.y));
    col = mix(col, vec3(0.045, 0.045, 0.05), 1.0 - bStep(0.28, hgt, fw.y));
    // far away the panes are finer than the pixels: their average
    float farS = 1.0 - smoothstep(1.5, 4.0, min(pw / fw.x, 0.8 / fw.y));
    em = mix(em, (tintC * bright * 0.7 * open * glassZ + fc * fLit * 0.8 * fasciaZ) * inShop, farS);
  } else {
    // ---------------------------------------------------------------- the floors above
    float fh = hgt - GF;
    float fl = floor(fh / FLOOR);
    float fy = fh - fl * FLOOR;
    float nFl = floor((bldH - GF - 0.6) / FLOOR);
    float nb = max(1.0, floor(faceW / BAY + 0.5));
    float bw = faceW / nb;
    float bay = clamp(floor(along / bw), 0.0, nb - 1.0);
    float fx = along - bay * bw;
    float st = bi.x;
    float office = (st >= 0.4 && st < 0.7) || st >= 0.86 ? 1.0 : 0.0;
    float ww, sill, wh, fxw = fx, cellX = bay, bwc = bw;
    if (st < 0.4) { ww = bw * mix(0.44, 0.62, bj.x); sill = 0.95; wh = mix(1.4, 1.8, bj.y); }
    else if (st < 0.7) { ww = bw - 0.24; sill = 0.85; wh = 2.0; }
    else if (st < 0.86) { bwc = bw * 0.5; float sb = clamp(floor(fx / bwc), 0.0, 1.0); fxw = fx - sb * bwc; cellX = bay * 2.0 + sb; ww = bwc * 0.64; sill = 1.0; wh = 1.5; }
    else { ww = bw - 0.1; sill = 0.9; wh = 2.34; }
    float wx0 = (bwc - ww) * 0.5;
    float upper = step(fl + 0.5, nFl);                              // 0 on the parapet and plant level
    float win = bBox(wx0, wx0 + ww, fxw, fw.x) * bBox(sill, sill + wh, fy, fw.y) * upper;
    float fr = st >= 0.86 ? 0.035 : 0.065;
    float glassA = bBox(wx0 + fr, wx0 + ww - fr, fxw, fw.x) * bBox(sill + fr, sill + wh - fr, fy, fw.y) * upper;
    float frame = max(win - glassA, 0.0);
    // the wall: piers at the bay lines, a darker slab band at every floor, streaks under the sills
    float slab = 1.0 - bStep(0.34, fy, fw.y);
    float pier = 1.0 - bBox(0.2, bw - 0.2, fx, fw.x);
    vec3 wall = bBase * (1.0 + 0.1 * pier - 0.3 * slab);
    wall *= 1.0 - 0.22 * bBox(0.34, 0.41, fy, fw.y);
    wall *= 1.0 - 0.18 * bBox(0.2, 0.26, fx, fw.x) - 0.18 * bBox(bw - 0.26, bw - 0.2, fx, fw.x);
    wall *= 0.95 + 0.1 * bH1(vec3(bay, fl, face) + seed * 0.13);
    float streak = bBox(wx0 + 0.1, wx0 + ww - 0.1, fxw, fw.x) * smoothstep(sill, sill - 1.3, fy) * step(0.34, fy) * upper;
    wall *= 1.0 - 0.14 * streak;
    if (st >= 0.86) wall = mix(wall, glass * 1.6 + bBase * 0.12, 1.0 - slab);      // a curtain wall's spandrel glass
    // the parapet and the coping on top; a louvred plant level where a whole floor does not fit
    float plant = (1.0 - upper) * step(1.9, bldH - GF - nFl * FLOOR) * bBox(wx0, wx0 + ww, fxw, fw.x) * bBox(0.7, 2.2, fy, fw.y) * step(fh, bldH - GF - 0.6);
    wall = mix(wall, vec3(0.08, 0.085, 0.09) * (0.7 + 0.5 * bStripe(fy, 0.15, 0.5, fw.y)), plant);
    wall = mix(wall, bBase * 1.18, bBox(bldH - 0.22, bldH + 1.0, hgt, fw.y));
    vec3 frameCol = office > 0.5 ? mix(bBase, vec3(0.55, 0.57, 0.6), 0.6) : mix(bBase, vec3(0.1), 0.55);
    col = mix(wall, frameCol, frame);
    col = mix(col, glass, glassA);
    rough = mix(0.86, 0.14, glassA);
    // this window: lit or dark, its colour and brightness, its blinds or curtains
    vec3 wr = bH3(vec3(cellX + face * 61.0, fl * 1.37 + 0.5, face) + seed * 0.21);
    vec3 fr3 = bH3(vec3(fl * 2.31 + 0.7, 11.0, 5.0) + seed * 0.17);
    float wq = bH1(vec3(cellX * 1.3 + 0.2, fl * 0.7, face + 4.0) + seed * 0.37);
    float litF = mix(0.35, 0.55, bi.y);
    float lit;
    if (office > 0.5) lit = fr3.x < (litF - 0.08) / 0.78 ? step(wr.x, 0.86) : step(wr.x, 0.08);
    else lit = step(wr.x, clamp(litF + (fr3.y - 0.5) * 0.3, 0.05, 0.95));
    vec3 wc;
    if (office > 0.5) wc = wr.y < 0.45 ? ${FLUO} : wr.y < 0.8 ? ${COOL} : wr.y < 0.97 ? ${WARM} : bAccent(wr.z);
    else wc = wr.y < 0.6 ? ${WARM} : wr.y < 0.74 ? ${COOL} : wr.y < 0.93 ? ${FLUO} : bAccent(wr.z);
    float br = mix(0.5, 1.2, wr.z) * (wq > 0.93 ? 1.9 : 1.0);
    float wy = clamp((fy - sill) / wh, 0.0, 1.0);
    float wxr = clamp((fxw - wx0) / ww, 0.0, 1.0);
    float det = mix(0.72, 1.12, wy);
    float kind = fract(wq * 7.31);
    if (office > 0.5) {
      if (kind < 0.35) det *= 0.6 + 0.4 * bStripe(fy, 0.07, 0.55, fw.y);               // venetian blinds
    } else if (kind < 0.5) {
      float cw = mix(0.18, 0.42, fract(kind * 13.7));
      float cur = max(1.0 - bStep(cw, wxr, fw.x / ww), bStep(1.0 - cw * 0.6, wxr, fw.x / ww));
      det *= mix(1.0, 0.5, cur);
      wc *= mix(vec3(1.0), vec3(1.0, 0.72, 0.5), cur);                                 // curtains, lit through
    }
    float reveal = mix(0.6, 1.0, smoothstep(0.0, 0.16, sill + wh - fr - fy) * smoothstep(0.0, 0.08, fxw - wx0 - fr));
    em = wc * br * det * reveal * lit * glassA;
    // far away the cells are finer than the pixels: their average instead of a shimmer
    float cellPx = min(bwc / fw.x, FLOOR / fw.y);
    float farW = 1.0 - smoothstep(1.4, 3.5, cellPx);
    float area = (ww * wh) / (bwc * FLOOR) * upper;
    col = mix(col, mix(wall, glass, area), farW);
    em = mix(em, litF * (office > 0.5 ? ${FLUO} : ${WARM}) * 0.8 * area, farW);
  }
  diffuseColor.rgb = col;
  roughnessFactor = rough;
  totalEmissiveRadiance += em * uNight;
}`;
}

/**
 * The building material. `night` (0..1) is the initial window glow; change it later through
 * material.userData.uNight.value.
 */
export function buildingMaterial(T = THREE, { night = 1 } = {}) {
  const mat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0.0 });
  mat.name = 'building';
  mat.userData.uNight = { value: night };
  const fsP = fsPars(), fsM = fsMain();
  mat.onBeforeCompile = function (shader) {
    shader.uniforms.uNight = (this && this.userData && this.userData.uNight) || mat.userData.uNight;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VS_PARS)
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n' + VS_MAIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + fsP)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + fsM);
  };
  mat.customProgramCacheKey = () => 'bldg';
  return mat;
}
