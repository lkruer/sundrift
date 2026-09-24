/**
 * NEO TOKYO buildings: one MeshStandardMaterial for every building box of the city.
 *
 *     const mat = buildingMaterial(THREE, { night: 1, wet: 0.5 });
 *     const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, n);
 *     // per building: matrix = compose(lot centre with y = ground + h / 2, rotation about Y, scale w x h x d)
 *     mesh.setMatrixAt(i, m); mesh.setColorAt(i, new THREE.Color(facadeColour(rng())));
 *     mat.userData.uNight.value = 0..1;   // window glow, any time, no recompile
 *     mat.userData.uWet.value = 0..1;     // rain on the walls
 *     mat.userData.uTime.value = seconds; // the televisions and the arcade screens flicker with it
 *
 * The facade is drawn in the shader, in metres, from the unit box's own coordinates times the instance scale, so
 * a window keeps its real size however the box is scaled, and the grid starts at each face's corner so every
 * face has whole bays and a pier at each end:
 *   - the ground floor (the bottom 4 m) is shop fronts: pilasters between shops, big glass in panes with dark
 *     mullions, a door, a fascia band over each shop. A quarter of the shops are shut behind grey ribbed roller
 *     shutters (rust runs, tags and grime near the foot), a few open ones have the shutter half down, some are
 *     dark with the green exit sign lit;
 *   - above it, floors every 3.4 m and bays of about 2.6 m (fitted to the face), in one of four facade types
 *     per building: punched windows, office ribbon windows, paired windows, a glass curtain wall; piers between
 *     the bays and a darker slab band at every floor, a parapet on top and a louvred plant level where a floor
 *     does not fit;
 *   - roofs (world normal mostly up) have no windows: a coping round a dark, stained deck.
 * Behind the glass there are rooms (interior mapping): the view ray is followed from the glass into a box room
 * and whatever it meets first (a wall, the floor, the ceiling, or a row of furniture across the room) is drawn from
 * the room atlas (rooms.js), so a shop or a flat has depth that shifts with the camera like the real thing. A shop
 * is an eatery, a boutique, a convenience store, an arcade or a bar; above them offices, flats and tatami rooms;
 * now and then a dark flat lit only by its television, flickering. The room is traced once per pixel, after the
 * branches that set it up (one call site keeps the program small: it compiles at load).
 * Grime: rain streaks run down from every sill, drips from every slab and from the coping, low-frequency blotches
 * cover each face (different on every building), and the foot of every wall is a dark, wet band with an uneven
 * top. One building in five is older: mosaic tile, more dirt, fewer and dimmer lights.
 * Each window's lit or dark, its colour (warm, cool, fluorescent, now and then a coloured one), its brightness
 * and its blinds or curtains come from a hash of its integer cell and the instance's position; office floors come
 * on and go off together. Lit windows are EMISSIVE, scaled by `uNight`, so they glow with no light on them and the
 * brightest bloom a little. By day they are dark glass that reflects the sky (the shops stay lit). Every hash is fed
 * integers and flat (not interpolated) values, and every fine line is filtered by the pixel's footprint (inside a
 * room, the footprint where the ray lands), so nothing shimmers.
 *
 * The facade colour is the instance colour (InstancedMesh.setColorAt): three multiplies it into the diffuse
 * colour as it does for any instanced material, and the shader builds the facade from that. Do not set
 * `vertexColors` on this material: a BoxGeometry has no colour attribute and would read as black.
 *
 * The hook is installed before the game's lighting rig sees the material; the rig keeps it and runs it first,
 * and every replacement here keeps the chunk it replaces, so the rig's own patches still find theirs.
 */
import * as THREE from 'three';
import { roomAtlas, ROOM_KINDS } from './rooms.js?v=202609242050';

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
varying vec3 vBView;         // from the camera to this point, in the face's own axes: along, up, in
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
  // the view ray in the face's axes (along, up, into the building): it is linear across the face, so the
  // interpolated value is exact, and the rooms behind the glass are traced from it
  vec3 bX = bM[0].xyz / bS.x, bY = bM[1].xyz / bS.y, bZ = bM[2].xyz / bS.z;
  vec3 bA = bFace == 0.0 ? -bZ : bFace == 2.0 ? bZ : bFace == 1.0 ? bX : bFace == 3.0 ? -bX : bX;
  vec3 bI = bFace == 0.0 ? -bX : bFace == 2.0 ? bX : bFace == 1.0 ? -bZ : bFace == 3.0 ? bZ : -bY;
  vec3 bV = (bM * vec4(position, 1.0)).xyz - cameraPosition;
  vBView = vec3(dot(bV, bA), dot(bV, bY), dot(bV, bI));
}`;

function fsPars() {
  return /* glsl */`
uniform float uNight;
uniform float uWet;
uniform float uTime;
varying vec4 vBPos;
varying vec3 vBView;
flat varying vec4 vBDim;
flat varying vec4 vBSeed;
float bH1(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 bH3(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
// value noise on integer lattice points, smoothly interpolated: stains and tags, never per pixel
float bNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  float a = bH1(vec3(i, 3.0)), b = bH1(vec3(i.x + 1.0, i.y, 3.0)), c = bH1(vec3(i.x, i.y + 1.0, 3.0)), d = bH1(vec3(i + 1.0, 3.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// a dark rain run hanging below a ledge: one per period metres across, each with its own place, width and length
// from the hash of its cell (an integer), tapering as it runs down; d is metres below the ledge, fwx the footprint
float bRun(float x, float d, float period, float key, float lenK, float fwx) {
  float c = floor(x / period);
  vec3 h = bH3(vec3(c, key, 5.0));
  float fx = x - (c + 0.25 + 0.5 * h.x) * period;
  float len = mix(0.5, 2.1, h.z) * lenK;
  float t = clamp(d / len, 0.0, 1.0);
  float hw = mix(0.025, 0.1, h.y) * (1.0 - 0.7 * t);
  float across = 1.0 - smoothstep(hw - fwx, hw + fwx, abs(fx));
  return across * step(0.0, d) * (1.0 - t * t) * step(0.2, h.y + 0.5 * h.x);
}
// a step and a box, each filtered over w (the pixel's footprint), so the facade does not shimmer
float bStep(float e, float x, float w) { return clamp((x - e) / w + 0.5, 0.0, 1.0); }
float bBox(float a, float b, float x, float w) { return bStep(a, x, w) - bStep(b, x, w); }
// stripes of the given duty, fading to their average once they are finer than the pixel
float bStripe(float x, float period, float duty, float w) {
  float f = fract(x / period), fw = w / period;
  float s = bStep(0.5 - duty * 0.5, f, fw) - bStep(0.5 + duty * 0.5, f, fw);
  return mix(s, duty, smoothstep(0.2, 0.5, fw));
}
// a round spot of radius r, filtered
float bDisc(vec2 q, float r, float w) { return 1.0 - smoothstep(r - w, r + w, length(q)); }
vec3 bAccent(float r) {
  return r < 0.2 ? ${lin(0xff6ec7)} : r < 0.4 ? ${lin(0xa878ff)} : r < 0.6 ? ${lin(0xff5a4a)} : r < 0.8 ? ${lin(0x7affb0)} : ${lin(0x6fe8ff)};
}
vec3 bSignCol(float r) {
  return r < 0.22 ? ${lin(0xfff4e6)} : r < 0.36 ? ${lin(0xff3a2a)} : r < 0.5 ? ${lin(0xffc21a)} : r < 0.62 ? ${lin(0x2f7bff)} :
         r < 0.74 ? ${lin(0x22d07a)} : r < 0.86 ? ${lin(0xff4fb0)} : ${lin(0xff8a24)};
}
// ---------------------------------------------------------------- rooms behind the glass
uniform sampler2D uRooms;
uniform vec4 uRoomA[8];
uniform vec4 uRoomB[8];
float bT;                    // the ray's length to what bHit found
float bTV;                   // 1 where the ray met a television's screen
// The first surface a ray from the glass meets inside a box room. p is the point on the glass (x from the room's
// left wall, y above its floor), d the unit ray (d.z > 0 goes in), R the room (width, height, depth). Returns the
// hit point in room metres, and in w: 0 the back wall, 1 a side wall, 2 the floor, 3 the ceiling.
vec4 bHit(vec2 p, vec3 d, vec3 R) {
  vec3 q = vec3(abs(d.x) < 1e-4 ? 1e-4 : d.x, abs(d.y) < 1e-4 ? 1e-4 : d.y, max(d.z, 0.02));
  float tx = ((q.x > 0.0 ? R.x : 0.0) - p.x) / q.x;
  float ty = ((q.y > 0.0 ? R.y : 0.0) - p.y) / q.y;
  float tz = R.z / q.z;
  bT = min(min(tx, ty), tz);
  return vec4(p + q.xy * bT, q.z * bT, bT == tz ? 0.0 : bT == tx ? 1.0 : (q.y > 0.0 ? 3.0 : 2.0));
}
// where the ray crosses the plane z metres in: (x, y) there, and the ray's length to it
vec3 bPlane(vec2 p, vec3 d, float z) { float t = z / max(d.z, 0.02); return vec3(p + d.xy * t, t); }
// one cell of the room atlas (8 x 8 cells of 128 px, 124 drawn), q over the cell (its fraction taken), w the pixel's
// footprint in cells: the gradient is given, so nothing here takes a derivative inside the branches that call it
vec4 bRoomTex(float cell, vec2 q, float w) {
  vec2 cc = vec2(mod(cell, 8.0), floor(cell / 8.0));
  vec2 f = fract(q);
  vec2 uv = vec2((cc.x * 128.0 + 2.0 + f.x * 124.0) / 1024.0, 1.0 - (cc.y * 128.0 + 2.0 + (1.0 - f.y) * 124.0) / 1024.0);
  float g = clamp(w, 1e-4, 0.5) * 0.1211;
  return textureGrad(uRooms, uv, vec2(g, 0.0), vec2(0.0, g));
}
// A room behind the glass (interior mapping): the view ray from p on the glass followed in along d; R the room's size;
// kind its furnishing (rooms.js). The colour of what the ray meets first, a wall, the floor, the ceiling or the row of
// furniture across the room, with what is drawn at full white (the lamps) glowing, and deeper in a little dimmer.
vec3 bRoom(vec2 p, vec3 d, float dist0, float fw0, vec3 R, float kind) {
  int k = int(kind + 0.5);
  vec4 A = uRoomA[k], B = uRoomB[k];
  vec4 H = bHit(p, d, R);
  float t = bT;
  float cosI = H.w == 0.0 ? d.z : H.w == 1.0 ? abs(d.x) : abs(d.y);
  float foot = fw0 * (dist0 + t) / dist0 / max(cosI, 0.15);
  vec2 s = H.w == 0.0 ? H.xy : H.w == 1.0 ? H.zy : H.xz;
  vec2 span = H.w == 0.0 ? vec2(A.x > 0.0 ? A.x : R.x, R.y) : H.w == 1.0 ? vec2(A.y > 0.0 ? A.y : R.z, R.y) : H.w == 2.0 ? vec2(A.z) : (A.w > 0.0 ? vec2(A.w) : R.xz);
  vec2 q = s / span;
  // (a wall's height always fits the room; a surface with no tile of its own is stretched to fit)
  q.y = H.w < 1.5 ? clamp(q.y, 0.002, 0.998) : q.y;
  if ((H.w == 0.0 && A.x == 0.0) || (H.w == 1.0 && A.y == 0.0) || (H.w == 3.0 && A.w == 0.0)) q = clamp(q, 0.002, 0.998);
  vec4 c = bRoomTex(kind * 5.0 + H.w, q, foot / min(span.x, span.y));
  // the row of furniture across the room: a counter, gondolas, a rail of clothes, machines, desks
  if (B.w > 0.5) {
    float zo = R.z * B.x;
    vec3 op = bPlane(p, d, zo);
    float ow = B.z > 0.0 ? B.z : R.x;
    float ox = B.z > 0.0 ? op.x / B.z : clamp(op.x / R.x, 0.002, 0.998);
    float of = fw0 * (dist0 + op.z) / dist0 / max(d.z, 0.15) / min(B.y, ow);
    if (op.z < t && op.y > 0.0 && op.y < B.y) {
      vec4 o = bRoomTex(kind * 5.0 + 4.0, vec2(ox, op.y / B.y), of);
      if (o.a > 0.5) c = o;
    } else if (op.z < t && op.y >= B.y && d.y < 0.0) {
      // its top, where the ray comes down onto it
      float dz = (op.y - B.y) * max(d.z, 0.02) / -d.y;
      if (dz < 0.5 && (zo + dz) / max(d.z, 0.02) < t) {
        vec4 o = bRoomTex(kind * 5.0 + 4.0, vec2(ox, 0.97), of);
        if (o.a > 0.5) c = vec4(o.rgb * 0.75, 1.0);
      }
    }
  }
  bTV = step(0.8, c.b) * step(c.r + c.g, 0.15);
  vec3 col = mix(c.rgb, vec3(0.04, 0.045, 0.06), bTV);
  col += c.rgb * smoothstep(0.9, 1.0, min(min(c.r, c.g), c.b)) * 1.7;
  return col * (1.0 - 0.3 * clamp(H.z / R.z, 0.0, 1.0));
}`;
}

function fsMain() {
  const WARM = lin(0xffd9a0), COOL = lin(0xcfe3ff), FLUO = lin(0xe8fff4);
  const SHOP_WARM = lin(0xffd29c), SHOP_COOL = lin(0xdbeaff);
  const TILE_BEIGE = lin(0xb7a282), TILE_BROWN = lin(0x7d5f4a);
  return /* glsl */`
{
  const float FLOOR = ${FLOOR_H.toFixed(2)}, BAY = ${BAY_W.toFixed(2)}, GF = ${SHOP_H.toFixed(2)};
  vec3 bBase = diffuseColor.rgb;
  float along = vBPos.x, hgt = vBPos.y, faceW = vBDim.x, bldH = vBDim.y;
  float face = vBSeed.w;
  vec3 seed = vBSeed.xyz;
  vec3 bi = bH3(seed * 0.0731 + vec3(17.1, 3.3, 9.7));
  vec3 bj = bH3(seed * 0.0457 + vec3(5.1, 11.9, 2.3));
  vec3 bk = bH3(seed * 0.0391 + vec3(8.3, 1.7, 13.1));
  vec2 fw = max(fwidth(vec2(along, hgt)), vec2(1e-4));
  float fine = 1.0 - smoothstep(0.015, 0.05, max(fw.x, fw.y));      // 1 up close, 0 once a pixel is over 5 cm
  vec3 wN = (vec4(normal, 0.0) * viewMatrix).xyz;
  vec3 col = bBase, em = vec3(0.0), emS = vec3(0.0);        // em: lit at night; emS: a shop's light, by day too
  float rough = roughnessFactor;
  vec3 glass = vec3(0.016, 0.02, 0.028);
  float glassMask = 0.0;
  // the view ray into the face (for the rooms behind the glass), and the glass's own footprint
  float bDist = max(length(vBView), 0.05);
  vec3 bDir = vBView / bDist;
  float fw0 = max(fw.x, fw.y);
  // the room behind this pixel's glass, traced once after the branches below (they only set it up): where on the
  // glass, its size, its furnishing, and what its light is multiplied by (rMul lit at night, rMulS a shop's, lit by
  // day too, rTV a television's screen)
  float rOn = 0.0, rKind = 0.0;
  vec2 rP = vec2(0.0);
  vec3 rR = vec3(1.0), rMul = vec3(0.0), rMulS = vec3(0.0), rTV = vec3(0.0);
  // ---- the building's age and dirt: one in five is older, tiled and stained, with fewer lights on
  float wet = clamp(uWet, 0.0, 1.0);
  float old = step(0.8, bk.x);
  float grime = mix(0.45, 0.9, bk.y) + 0.5 * old;
  if (old > 0.5) bBase = mix(bBase, bk.z < 0.5 ? ${TILE_BEIGE} : ${TILE_BROWN}, 0.55);
  float ph = bk.z * 6.2832, ph2 = bj.x * 6.2832;
  // blotchy stains: two octaves of value noise over the face, cells of metres, different on every building
  vec2 sp = vec2(along + face * 23.0 + bk.x * 40.0, hgt + bk.y * 40.0);
  float blot = bNoise(sp / vec2(4.2, 3.2)) * 0.62 + bNoise(sp / vec2(1.7, 1.3) + 17.0) * 0.38;
  float stainK = smoothstep(0.42, 0.82, blot) * grime;
  // the dirty, wet band along the foot of the walls (the game sinks each box 0.3 m), its top edge uneven
  float baseLine = 1.0 + 0.16 * sin(along * 1.7 + ph) + 0.08 * sin(along * 4.3 + ph2);
  float baseBand = 1.0 - smoothstep(baseLine - 0.3, baseLine, hgt);
  if (wN.y > 0.7) {
    // the roof: a dark deck inside a coping, stained, puddled when wet
    vec2 rp = vBPos.zw;
    float edge = min(min(rp.x, vBDim.z - rp.x), min(rp.y, vBDim.w - rp.y));
    vec2 rw = max(fwidth(rp), vec2(1e-4));
    float coping = 1.0 - bStep(0.42, edge, max(rw.x, rw.y));
    float seam = max(bStripe(rp.x, 2.4, 0.03, rw.x), bStripe(rp.y, 2.4, 0.03, rw.y));
    float rb = bNoise(rp / 3.0 + bk.xy * 30.0);
    col = mix(mix(vec3(0.05, 0.052, 0.056), bBase * 0.35, 0.35) * (1.0 - 0.25 * seam) * (0.75 + 0.35 * rb), bBase * 0.9, coping);
    rough = mix(0.95, 0.4, wet * smoothstep(0.5, 0.7, rb));
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
    float glassZ = bBox(0.55, 2.9, hgt, fw.y);
    float fasciaZ = bBox(3.02, 3.82, hgt, fw.y);
    // frames: dark bars about 9 cm wide at every pane edge (a little heavier round the door), a transom across
    float fr = mix(0.045, 0.06, isDoor);
    float mull = 1.0 - bBox(fr, pw - fr, px, fw.x);
    float transom = bBox(2.42, 2.5, hgt, fw.y);
    float bar = isDoor * bBox(1.2, 1.27, hgt, fw.y) * bBox(0.15, pw - 0.15, px, fw.x);
    float frameAll = clamp(mull + transom + bar, 0.0, 1.0);
    // a quarter of the shops are shut behind roller shutters; a few open ones have theirs half down
    float state = sr.x;
    float open = step(state, 0.62), shut = step(0.62, state) * step(state, 0.87), closed = step(0.87, state);
    float halfDown = open * step(fract(sq.x * 7.3), 0.12);
    float shutTop = 2.9, shutFoot = mix(0.55, 1.75, halfDown);
    float shutter = max(shut, halfDown * bBox(shutFoot, shutTop, hgt, fw.y));
    // the shop's kind (rooms.js) and its light: an eatery, a boutique, a convenience store, an arcade or a bar;
    // eateries and boutiques warm, a convenience store cool and bright, an arcade or a bar in coloured light
    float kind = sr.z < 0.28 ? 0.0 : sr.z < 0.42 ? 1.0 : sr.z < 0.72 ? 2.0 : sr.z < 0.86 ? 3.0 : 7.0;
    vec3 tintC = kind < 0.5 ? ${SHOP_WARM} : kind < 1.5 ? mix(${SHOP_WARM}, vec3(1.0), 0.45) : kind < 2.5 ? ${SHOP_COOL} : kind < 3.5 ? mix(vec3(1.0), bAccent(sq.x), 0.35) : mix(${SHOP_WARM}, bAccent(sq.x), 0.5);
    float bright = sq.y < 0.8 ? mix(0.6, 1.05, sq.y / 0.8) : mix(1.2, 1.45, (sq.y - 0.8) / 0.2);
    bright *= mix(1.0, 0.75, old) * (kind > 1.5 && kind < 2.5 ? 1.2 : 1.0);
    // far away the panes are finer than the pixels: their average
    float farS = 1.0 - smoothstep(1.5, 4.0, min(pw / fw.x, 0.8 / fw.y));
    // behind the glass, the shop itself: a room across the whole shop, the view ray followed into it (after the
    // branches); a poster pasted inside the glass now and then
    vec3 pr = bH3(vec3(pane + 3.0, sid, 7.0) + seed * 0.61);
    float poster = step(0.85, pr.x) * (1.0 - isDoor) * bBox(0.2 * pw, 0.8 * pw, px, fw.x) * bBox(1.2, 2.3, hgt, fw.y);
    if (inShop * glassZ > 0.001 && farS < 0.999 && open > 0.5) {
      rOn = 1.0; rKind = kind;
      rP = vec2(clamp(lx, 0.0, usable), hgt - 0.38);
      rR = vec3(usable, 2.62, mix(3.6, 7.5, fract(sq.x * 3.7)));
    }
    vec3 inner = mix(tintC * bright * 0.7 * (1.0 - rOn), bAccent(pr.y) * (0.25 + 0.3 * bright), poster);
    float lookIn = open * inShop * glassZ * (1.0 - frameAll) * (1.0 - shutter);
    // the shutter: grey ribbed steel, a darker bottom rail, rust and rain run down it, tags and grime near the foot
    float sgrey = mix(0.2, 0.36, fract(sq.y * 5.1));
    float ribs = bStripe(hgt, 0.085, 0.5, fw.y);
    vec3 sh = vec3(sgrey, sgrey * 1.02, sgrey * 1.05) * (0.78 + 0.34 * ribs * fine + 0.1 * ribs);
    sh *= 1.0 - 0.45 * bBox(shutFoot, shutFoot + 0.12, hgt, fw.y);
    float run = smoothstep(0.35, 0.8, 0.5 + 0.5 * sin(sx * 3.7 + sid) * sin(sx * 1.3 + ph));
    sh *= 1.0 - 0.3 * run * smoothstep(shutTop, shutFoot, hgt) * grime;
    float tagN = bNoise(vec2(sx * 1.3, hgt * 2.4) + vec2(sid * 3.1, 5.0));
    float tag = smoothstep(0.58, 0.64, tagN) * (1.0 - smoothstep(1.1, 2.0, hgt)) * step(0.35, fract(sq.z * 3.7));
    vec3 ink = fract(sq.x * 11.0) < 0.5 ? vec3(0.02) : bAccent(fract(sq.x * 5.0)) * 0.12;
    sh = mix(sh, ink, tag * 0.85);
    sh *= 1.0 - 0.35 * (1.0 - smoothstep(0.55, 1.4, hgt)) * grime;        // splash and grime at the foot
    vec3 frameCol = vec3(0.035, 0.036, 0.04);
    vec3 front = mix(glass, frameCol, frameAll);
    // the pilasters and the wall between shops, dirtied like the rest
    vec3 pilCol = bBase * 0.82 * (1.0 - 0.4 * stainK);
    col = mix(pilCol, mix(front, sh, shutter), inShop * glassZ);
    glassMask = inShop * glassZ * (1.0 - shutter) * (1.0 - frameAll);
    rough = mix(rough, mix(0.12, 0.55, shutter), inShop * glassZ);
    emS += inner * lookIn;
    // closed shops: dark, a faint light far inside, and the green exit sign over the door
    em += ${SHOP_COOL} * 0.05 * closed * inShop * glassZ * (1.0 - frameAll);
    float exitSign = isDoor * bBox(0.5 * pw - 0.2, 0.5 * pw + 0.2, px, fw.x) * bBox(2.56, 2.72, hgt, fw.y) * max(closed, open * (1.0 - halfDown) * step(sq.z, 0.4));
    emS *= 1.0 - exitSign * inShop;
    em = mix(em, ${lin(0x2aff7a)} * 1.1, exitSign * inShop);
    // a shutter's box above the opening
    col = mix(col, vec3(0.1, 0.1, 0.11), max(shut, halfDown) * inShop * bBox(2.9, 3.02, hgt, fw.y));
    // the fascia: most open shops light theirs, under the neon; a pale rule round it
    float fLit = open * step(sq.z, 0.72) + shut * step(sq.z, 0.18);
    vec3 fc = bSignCol(sq.z / 0.72);
    float inner2 = bBox(3.09, 3.75, hgt, fw.y) * bBox(pil + 0.07, sw - pil - 0.07, sx, fw.x);
    col = mix(col, mix(bBase * 0.35, vec3(0.03), 0.5), fasciaZ * inShop);
    em += fasciaZ * inShop * fLit * mix(vec3(1.0), fc * mix(0.75, 0.95, smoothstep(3.02, 3.82, hgt)), inner2) * mix(1.0, 0.7, old);
    // the ledge over the fascia; the plinth under the glass
    col = mix(col, bBase * 0.5, bBox(3.82, 4.1, hgt, fw.y));
    col = mix(col, bBase * 1.15, bBox(3.84, 3.88, hgt, fw.y));
    col = mix(col, vec3(0.045, 0.045, 0.05), 1.0 - bStep(0.55, hgt, fw.y));
    em = mix(em, fc * fLit * 0.8 * fasciaZ * inShop, farS);
    emS = mix(emS, tintC * bright * 0.7 * open * (1.0 - halfDown * 0.5) * glassZ * inShop, farS);
    rMulS = tintC * bright * (1.0 - poster) * lookIn * (1.0 - exitSign * inShop) * (1.0 - farS);
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
    float office = ((st >= 0.4 && st < 0.7) || st >= 0.86) && old < 0.5 ? 1.0 : 0.0;
    float ww, sill, wh, fxw = fx, cellX = bay, bwc = bw;
    if (st < 0.4 || old > 0.5) { ww = bw * mix(0.44, 0.62, bj.x); sill = 0.95; wh = mix(1.4, 1.8, bj.y); }
    else if (st < 0.7) { ww = bw - 0.24; sill = 0.85; wh = 2.0; }
    else if (st < 0.86) { bwc = bw * 0.5; float sb = clamp(floor(fx / bwc), 0.0, 1.0); fxw = fx - sb * bwc; cellX = bay * 2.0 + sb; ww = bwc * 0.64; sill = 1.0; wh = 1.5; }
    else { ww = bw - 0.1; sill = 0.9; wh = 2.34; }
    float curtainWall = st >= 0.86 && old < 0.5 ? 1.0 : 0.0;
    float wx0 = (bwc - ww) * 0.5;
    float upper = step(fl + 0.5, nFl);                              // 0 on the parapet and plant level
    float win = bBox(wx0, wx0 + ww, fxw, fw.x) * bBox(sill, sill + wh, fy, fw.y) * upper;
    float fr = curtainWall > 0.5 ? 0.035 : 0.065;
    float glassA = bBox(wx0 + fr, wx0 + ww - fr, fxw, fw.x) * bBox(sill + fr, sill + wh - fr, fy, fw.y) * upper;
    float frame = max(win - glassA, 0.0);
    // the wall: piers at the bay lines, a darker slab band at every floor
    float slab = 1.0 - bStep(0.34, fy, fw.y);
    float pier = 1.0 - bBox(0.2, bw - 0.2, fx, fw.x);
    vec3 wall = bBase * (1.0 + 0.1 * pier - 0.3 * slab);
    wall *= 1.0 - 0.22 * bBox(0.34, 0.41, fy, fw.y);
    wall *= 1.0 - 0.18 * bBox(0.2, 0.26, fx, fw.x) - 0.18 * bBox(bw - 0.26, bw - 0.2, fx, fw.x);
    wall *= 0.95 + 0.1 * bH1(vec3(bay, fl, face) + seed * 0.13);
    // an old building's mosaic tile, its grout showing only up close
    if (old > 0.5) wall *= 1.0 - 0.16 * max(bStripe(fy, 0.1, 0.14, fw.y), bStripe(along, 0.23, 0.1, fw.x)) * fine;
    // rain and dirt: streaks from every sill, drips from every slab and from the coping, blotches over it all
    vec3 wr = bH3(vec3(cellX + face * 61.0, fl * 1.37 + 0.5, face) + seed * 0.21);
    float key = bk.x * 97.0 + face * 13.0;
    float sillRun = bRun(fxw, sill - fy, 0.42, key + cellX * 3.0 + fl * 29.0, 1.0, fw.x) * bBox(wx0 - 0.06, wx0 + ww + 0.06, fxw, fw.x) * step(0.34, fy) * upper;
    float slabRun = bRun(along, FLOOR - fy, 0.62, key + fl * 7.0 + 0.5, 0.8, fw.x) * step(fl + 0.5, nFl);
    float copeRun = bRun(along, bldH - hgt, 0.8, key + 91.0, 1.6, fw.x);
    float runs = max(max(sillRun * 0.95, slabRun * 0.7), copeRun * 0.85) * min(grime, 1.0);
    float dirt = clamp(0.55 * stainK + runs, 0.0, 0.9);
    wall = mix(wall, wall * vec3(0.36, 0.34, 0.3), dirt);
    if (curtainWall > 0.5) wall = mix(wall, glass * 1.6 + bBase * 0.12, 1.0 - slab);      // a curtain wall's spandrel glass
    // the parapet and the coping on top; a louvred plant level where a whole floor does not fit
    float plant = (1.0 - upper) * step(1.9, bldH - GF - nFl * FLOOR) * bBox(wx0, wx0 + ww, fxw, fw.x) * bBox(0.7, 2.2, fy, fw.y) * step(fh, bldH - GF - 0.6);
    wall = mix(wall, vec3(0.08, 0.085, 0.09) * (0.7 + 0.5 * bStripe(fy, 0.15, 0.5, fw.y)), plant);
    wall = mix(wall, bBase * 1.1, bBox(bldH - 0.22, bldH + 1.0, hgt, fw.y));
    vec3 frameCol = office > 0.5 ? mix(bBase, vec3(0.55, 0.57, 0.6), 0.6) : mix(bBase, vec3(0.1), mix(0.55, 0.75, old));
    col = mix(wall, frameCol, frame);
    col = mix(col, glass, glassA);
    glassMask = glassA;
    rough = mix(mix(0.86, 0.6, dirt), 0.14, glassA);
    // this window: lit or dark, its colour and brightness, its blinds or curtains
    vec3 fr3 = bH3(vec3(fl * 2.31 + 0.7, 11.0, 5.0) + seed * 0.17);
    float wq = bH1(vec3(cellX * 1.3 + 0.2, fl * 0.7, face + 4.0) + seed * 0.37);
    float litF = mix(0.35, 0.55, bi.y) * mix(1.0, 0.6, old);
    float lit;
    if (office > 0.5) lit = fr3.x < (litF - 0.08) / 0.78 ? step(wr.x, 0.86) : step(wr.x, 0.08);
    else lit = step(wr.x, clamp(litF + (fr3.y - 0.5) * 0.3, 0.05, 0.95));
    // a dark flat now and then has only its television on
    float tv = (1.0 - lit) * (1.0 - office) * step(fract(wq * 17.3), 0.13);
    vec3 wc;
    if (office > 0.5) wc = wr.y < 0.45 ? ${FLUO} : wr.y < 0.8 ? ${COOL} : wr.y < 0.97 ? ${WARM} : bAccent(wr.z);
    else wc = wr.y < 0.6 ? ${WARM} : wr.y < 0.74 ? ${COOL} : wr.y < 0.93 ? ${FLUO} : bAccent(wr.z);
    float br = mix(0.5, 1.2, wr.z) * (wq > 0.93 ? 1.9 : 1.0) * mix(1.0, 0.8, old);
    float wy = clamp((fy - sill) / wh, 0.0, 1.0);
    float wxr = clamp((fxw - wx0) / ww, 0.0, 1.0);
    // far away the cells are finer than the pixels: their average instead of a shimmer
    float cellPx = min(bwc / fw.x, FLOOR / fw.y);
    float farW = 1.0 - smoothstep(1.4, 3.5, cellPx);
    float kindW = fract(wq * 7.31);
    if (glassA > 0.001 && farW < 0.999 && lit + tv > 0.5) {
      // the room behind (traced after the branches): as wide as the bay, floor to ceiling, three to five and a half
      // metres deep; an office, a flat or a tatami room, or a dark flat with only its television on
      vec3 hr = bH3(vec3(cellX * 2.1 + 0.5, fl * 1.9 + 0.3, face) + seed * 0.43);
      rOn = 1.0;
      rP = vec2(fxw, fy - 0.3);
      rR = vec3(bwc, 3.1, mix(3.0, 5.5, fract(wq * 3.1)));
      rKind = office > 0.5 ? 6.0 : (fract(wq * 13.7) < 0.28 && tv < 0.5 ? 5.0 : 4.0);
      // what hangs at the glass: blinds in an office, curtains drawn part way in a home, lit through
      float ov = 0.0;
      vec3 ovc = vec3(0.0);
      if (office > 0.5) {
        if (kindW < 0.35) { ov = 0.55 * bStripe(fy, 0.07, 0.55, fw.y) * smoothstep(0.0, 0.1, 1.0 - wy * 0.3); ovc = vec3(0.8) * (0.6 + 0.4 * wy); }
      } else if (kindW < 0.5 + 0.2 * old && tv < 0.5) {
        float cw = mix(0.18, 0.42, fract(kindW * 13.7));
        ov = max(1.0 - bStep(cw, wxr, fw.x / ww), bStep(1.0 - cw * 0.6, wxr, fw.x / ww));
        ovc = vec3(1.0, 0.72, 0.5) * mix(0.55, 0.8, wy);
      }
      vec3 lightC = wc * br;
      if (tv > 0.5) {
        float fl2 = bH1(vec3(floor(uTime * 1.3 + hr.x * 7.0), hr.y * 13.0, 3.0));
        vec3 tvc = mix(vec3(0.3, 0.55, 1.0), mix(vec3(1.0, 0.6, 0.8), vec3(0.6, 1.0, 0.7), step(0.5, fract(fl2 * 5.0))), 0.35);
        lightC = tvc * (0.16 + 0.1 * fl2);
        rTV = tvc * 1.8 * (0.7 + 0.3 * fl2) * glassA * (1.0 - farW);
      }
      rMul = lightC * (1.0 - ov) * glassA * (1.0 - farW);
      em = lightC * ovc * ov * glassA;
    }
    em = mix(em, litF * (office > 0.5 ? ${FLUO} : ${WARM}) * 0.8 * (ww * wh) / (bwc * FLOOR) * upper, farW);
    col = mix(col, mix(wall, glass, (ww * wh) / (bwc * FLOOR) * upper), farW);
  }
  // the room behind the glass, traced once for whichever branch asked for it
  if (rOn > 0.5) {
    vec3 room = bRoom(rP, bDir, bDist, fw0, rR, rKind);
    em += room * rMul + bTV * rTV;
    emS += room * rMulS;
  }
  // the foot of every wall: darker, dirtier, wetter; rain darkens and glosses what is not glass
  if (abs(wN.y) <= 0.7) {
    float foot = baseBand * (1.0 - glassMask);
    col = mix(col, col * vec3(0.3, 0.29, 0.27), foot * min(1.0, 0.7 + 0.3 * grime));
    rough = mix(rough, 0.24, foot * (0.4 + 0.6 * wet));
  }
  col *= 1.0 - 0.2 * wet * (1.0 - glassMask);
  rough = mix(rough, rough * 0.6, wet * (1.0 - glassMask));
  diffuseColor.rgb = col;
  roughnessFactor = rough;
  // (a shop is lit by day too: its light never quite goes)
  totalEmissiveRadiance += em * uNight + emS * max(uNight, 0.4);
}`;
}

/**
 * The building material. `night` (0..1) is the initial window glow, `wet` (0..1) how rain-soaked the walls are
 * (darker, glossier, the dirty foot of the walls wetter still); change either later, with no recompile, through
 * material.userData.uNight.value and material.userData.uWet.value; uTime.value (seconds) drives the flicker.
 */
export function buildingMaterial(T = THREE, { night = 1, wet = 0.5 } = {}) {
  const mat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0.0 });
  mat.name = 'building';
  mat.userData.uNight = { value: night };
  mat.userData.uWet = { value: wet };
  mat.userData.uTime = { value: 0 };
  // the rooms behind the glass: one atlas, and each furnishing's tiles and row of furniture (rooms.js)
  const rooms = roomAtlas(T);
  mat.userData.uRooms = { value: rooms.texture };
  mat.userData.uRoomA = { value: ROOM_KINDS.map((k) => new T.Vector4(...k.a)) };
  mat.userData.uRoomB = { value: ROOM_KINDS.map((k) => new T.Vector4(...k.b)) };
  const fsP = fsPars(), fsM = fsMain();
  mat.onBeforeCompile = function (shader) {
    const ud = (this && this.userData && this.userData.uNight) ? this.userData : mat.userData;
    shader.uniforms.uNight = ud.uNight;
    shader.uniforms.uWet = ud.uWet || (ud.uWet = { value: 0.5 });
    shader.uniforms.uTime = ud.uTime || (ud.uTime = { value: 0 });
    shader.uniforms.uRooms = mat.userData.uRooms;
    shader.uniforms.uRoomA = mat.userData.uRoomA;
    shader.uniforms.uRoomB = mat.userData.uRoomB;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VS_PARS)
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n' + VS_MAIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + fsP)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + fsM);
  };
  mat.customProgramCacheKey = () => 'bldg3';
  return mat;
}
