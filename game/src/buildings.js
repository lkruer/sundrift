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
 *     does not fit. A face of a block of flats is one of three: windows, balconies all across it (a sliding door
 *     in every bay behind a balustrade of frosted glass, white bars or a solid parapet, partition boards between
 *     the flats, the air conditioner out on the balcony, laundry on the poles, now and then a futon over the
 *     rail), or the open corridor that runs along every floor to the flats' doors (a parapet, steel doors and
 *     barred kitchen windows in the slab's shade, a lamp to every flat, on all night) with the stair's landing
 *     windows up one end;
 *   - its windows have their sills and, by day, what hangs behind them: lace or curtains drawn part way in a
 *     home, blinds let down in an office; an air conditioner hangs under a window here and there, and an upper
 *     floor let to a bar, a clinic or a school has its name in big characters on the glass (made-up characters:
 *     a coloured panel, the strokes left clear, lit from behind at night);
 *   - roofs (world normal mostly up) have no windows: a coping round a dark, stained deck.
 * A third of the plainer buildings are re-clad in the shader in the pale tile, the cream and the brick so much of
 * Tokyo is (the instance colours are mostly greys), the tiled ones with their grout showing up close.
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
 * brightest bloom a little. By day they are glass that reflects the sky (the shops stay lit). Every hash is fed
 * integers and flat (not interpolated) values, and every fine line is filtered by the pixel's footprint (inside a
 * room, the footprint where the ray lands), so nothing shimmers.
 * At night a wall is never black, as a Tokyo wall at night is not: the city's glow in the haze lights it faintly
 * from above (more on the upper floors, which see more of the sky, and more on the faces turned toward the city's
 * brightest quarter, so two faces of a block meet at a visible corner), the street lights its lower floors from
 * below (warm, or in a sign's colour), its parapet and its corners catch the glow as a pale edge, a lit window
 * throws a little light on the wall round it, and the tall ones carry red aviation lights at their top corners,
 * pulsing. All of it is emissive, scaled by `uNight`, so the rig's own lights are untouched.
 *
 * The facade colour is the instance colour (InstancedMesh.setColorAt): three multiplies it into the diffuse
 * colour as it does for any instanced material, and the shader builds the facade from that. Do not set
 * `vertexColors` on this material: a BoxGeometry has no colour attribute and would read as black.
 *
 * The hook is installed before the game's lighting rig sees the material; the rig keeps it and runs it first,
 * and every replacement here keeps the chunk it replaces, so the rig's own patches still find theirs.
 */
import * as THREE from 'three';
import { roomAtlas, ROOM_KINDS } from './rooms.js?v=202610032333';

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
float bBox(float a, float b, float x, float w) { return max(bStep(a, x, w) - bStep(b, x, w), 0.0); }
// stripes of the given duty, fading to their average once they are finer than the pixel
float bStripe(float x, float period, float duty, float w) {
  float f = fract(x / period), fw = w / period;
  float s = bStep(0.5 - duty * 0.5, f, fw) - bStep(0.5 + duty * 0.5, f, fw);
  return mix(s, duty, smoothstep(0.2, 0.5, fw));
}
// a round spot of radius r, filtered
float bDisc(vec2 q, float r, float w) { return 1.0 - smoothstep(r - w, r + w, length(q)); }
// a made-up character in heavy strokes, the way a tenant's name is cut out of the vinyl on its windows: up to three
// bars across and three down, each there or not by the hash h (q over the character's cell, w its footprint there)
float bGlyph(vec2 q, float h, vec2 w) {
  float s = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float y = 0.2 + 0.3 * fk, x = 0.22 + 0.28 * fk;
    s = max(s, step(0.42, fract(h * (3.1 + fk * 5.3))) * bBox(0.12, 0.88, q.x, w.x) * bBox(y - 0.07, y + 0.07, q.y, w.y));
    s = max(s, step(0.5, fract(h * (7.7 + fk * 2.9))) * bBox(x - 0.07, x + 0.07, q.x, w.x) * bBox(0.1, 0.9, q.y, w.y));
  }
  return s;
}
vec3 bAccent(float r) {
  return r < 0.2 ? ${lin(0xff6ec7)} : r < 0.4 ? ${lin(0xa878ff)} : r < 0.6 ? ${lin(0xff5a4a)} : r < 0.8 ? ${lin(0x7affb0)} : ${lin(0x6fe8ff)};
}
vec3 bSignCol(float r) {
  return r < 0.22 ? ${lin(0xfff4e6)} : r < 0.36 ? ${lin(0xff3a2a)} : r < 0.5 ? ${lin(0xffc21a)} : r < 0.62 ? ${lin(0x2f7bff)} :
         r < 0.74 ? ${lin(0x22d07a)} : r < 0.86 ? ${lin(0xff4fb0)} : ${lin(0xff8a24)};
}
// what hangs out on a balcony to dry: shirts, towels, sheets, mostly pale, now and then a colour
vec3 bLaundry(float r) {
  return r < 0.3 ? ${lin(0xf2efe6)} : r < 0.42 ? ${lin(0xa8c4e0)} : r < 0.52 ? ${lin(0xeab0c0)} : r < 0.62 ? ${lin(0xeedc8a)} :
         r < 0.72 ? ${lin(0x3a4668)} : r < 0.82 ? ${lin(0x9aa2aa)} : r < 0.9 ? ${lin(0xd85a4a)} : ${lin(0x6aa87a)};
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
  // ---- its cladding: a third of the plainer ones are re-clad in the pale tile, the cream and the brick so much of Tokyo
  // is (the instance colours are mostly greys, and by day the street read dark from end to end); the tiled ones show
  // their grout up close
  float clad = fract(bk.y * 13.7 + bi.z * 3.1);
  float ci = fract(clad * 17.3 + bj.z);
  float reclad = step(clad, 0.36) * (1.0 - old) * step(bi.x, 0.86);
  if (reclad > 0.5) {
    vec3 cc = ci < 0.2 ? ${lin(0xe4e0d6)} : ci < 0.36 ? ${lin(0xd8ccb2)} : ci < 0.52 ? ${lin(0xc4b294)} : ci < 0.64 ? ${lin(0xb2b0aa)} :
              ci < 0.76 ? ${lin(0x9aa4ae)} : ci < 0.88 ? ${lin(0x8a5e4a)} : ${lin(0xb4846e)};
    bBase = mix(bBase, cc, 0.85);
  }
  float tiled = reclad * step(ci, 0.64);
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
    float curtainWall = st >= 0.86 && old < 0.5 ? 1.0 : 0.0;
    // a face of a block of flats is one of three (the same on every floor): balconies all across it, or the open
    // corridor that runs along every floor to the flats' doors with the stair at one end, or windows
    float home = 1.0 - office;
    float fk = bH1(vec3(face * 3.7 + 0.5, 7.0, 2.0) + seed * 0.31);
    float balc = home * step(fk, 0.42) * step(9.0, bldH) * step(4.4, faceW);
    float corr = home * (1.0 - balc) * step(fk, 0.62) * step(12.0, bldH) * step(7.6, faceW) * (1.0 - old);
    float ww, sill, wh, fxw = fx, cellX = bay, bwc = bw;
    if (balc > 0.5) { ww = bw - 0.44; sill = 0.36; wh = 2.28; }        // a sliding door out to the balcony in every bay
    else if (corr > 0.5) { ww = 0.0; sill = 1.0; wh = 1.0; }          // (no windows here: the corridor is drawn below)
    else if (st < 0.4 || old > 0.5) { ww = bw * mix(0.44, 0.62, bj.x); sill = 0.95; wh = mix(1.4, 1.8, bj.y); }
    else if (st < 0.7) { ww = bw - 0.24; sill = 0.85; wh = 2.0; }
    else if (st < 0.86) { bwc = bw * 0.5; float sb = clamp(floor(fx / bwc), 0.0, 1.0); fxw = fx - sb * bwc; cellX = bay * 2.0 + sb; ww = bwc * 0.64; sill = 1.0; wh = 1.5; }
    else { ww = bw - 0.1; sill = 0.9; wh = 2.34; }
    float wx0 = (bwc - ww) * 0.5;
    float upper = step(fl + 0.5, nFl);                              // 0 on the parapet and plant level
    float win = bBox(wx0, wx0 + ww, fxw, fw.x) * bBox(sill, sill + wh, fy, fw.y) * upper;
    float fr = curtainWall > 0.5 ? 0.035 : 0.065;
    float glassA = bBox(wx0 + fr, wx0 + ww - fr, fxw, fw.x) * bBox(sill + fr, sill + wh - fr, fy, fw.y) * upper;
    float frame = max(win - glassA, 0.0);
    // far away the cells are finer than the pixels: their average instead of a shimmer
    float cellPx = min(bwc / fw.x, FLOOR / fw.y);
    float farW = 1.0 - smoothstep(1.4, 3.5, cellPx);
    float near = 1.0 - farW;
    // the wall: piers at the bay lines, a darker slab band at every floor
    float slab = 1.0 - bStep(0.34, fy, fw.y);
    float pier = 1.0 - bBox(0.2, bw - 0.2, fx, fw.x);
    vec3 wall = bBase * (1.0 + 0.1 * pier - 0.3 * slab);
    wall *= 1.0 - 0.22 * bBox(0.34, 0.41, fy, fw.y);
    wall *= 1.0 - 0.18 * bBox(0.2, 0.26, fx, fw.x) - 0.18 * bBox(bw - 0.26, bw - 0.2, fx, fw.x);
    wall *= 0.95 + 0.1 * bH1(vec3(bay, fl, face) + seed * 0.13);
    // an old building's mosaic tile, its grout showing only up close; a re-clad one's long tiles in courses
    if (old > 0.5) wall *= 1.0 - 0.16 * max(bStripe(fy, 0.1, 0.14, fw.y), bStripe(along, 0.23, 0.1, fw.x)) * fine;
    else if (tiled > 0.5) wall *= 1.0 - 0.11 * bStripe(fy, 0.068, 0.12, fw.y) * fine;
    // rain and dirt: streaks from every sill, drips from every slab and from the coping, blotches over it all
    vec3 wr = bH3(vec3(cellX + face * 61.0, fl * 1.37 + 0.5, face) + seed * 0.21);
    float key = bk.x * 97.0 + face * 13.0;
    float sillRun = bRun(fxw, sill - fy, 0.42, key + cellX * 3.0 + fl * 29.0, 1.0, fw.x) * bBox(wx0 - 0.06, wx0 + ww + 0.06, fxw, fw.x) * step(0.34, fy) * upper * (1.0 - corr);
    float slabRun = bRun(along, FLOOR - fy, 0.62, key + fl * 7.0 + 0.5, 0.8, fw.x) * step(fl + 0.5, nFl);
    float copeRun = bRun(along, bldH - hgt, 0.8, key + 91.0, 1.6, fw.x);
    float runs = max(max(sillRun * 0.95, slabRun * 0.7), copeRun * 0.85) * min(grime, 1.0);
    float dirt = clamp(0.55 * stainK + runs, 0.0, 0.9);
    wall = mix(wall, wall * vec3(0.36, 0.34, 0.3), dirt);
    if (curtainWall > 0.5) wall = mix(wall, glass * 1.6 + bBase * 0.12, 1.0 - slab);      // a curtain wall's spandrel glass
    // a window's sill: a pale concrete ledge a little wider than the opening, and its shadow on the wall under it
    float sillK = home * (1.0 - balc) * (1.0 - corr) * upper * near;
    float sillM = sillK * bBox(wx0 - 0.07, wx0 + ww + 0.07, fxw, fw.x) * bBox(sill - 0.075, sill, fy, fw.y);
    float sillSh = sillK * bBox(wx0 - 0.05, wx0 + ww + 0.05, fxw, fw.x) * bBox(sill - 0.19, sill - 0.075, fy, fw.y);
    wall *= 1.0 - 0.4 * sillSh;
    // the parapet and the coping on top; a louvred plant level where a whole floor does not fit
    float plant = (1.0 - upper) * step(1.9, bldH - GF - nFl * FLOOR) * bBox(wx0, wx0 + ww, fxw, fw.x) * bBox(0.7, 2.2, fy, fw.y) * step(fh, bldH - GF - 0.6);
    wall = mix(wall, vec3(0.08, 0.085, 0.09) * (0.7 + 0.5 * bStripe(fy, 0.15, 0.5, fw.y)), plant);
    wall = mix(wall, bBase * 1.1, bBox(bldH - 0.22, bldH + 1.0, hgt, fw.y));
    // window frames: an office's grey aluminium, a home's white or silver sash (most) or a dark one, an old one's dark
    float paleSash = home * (1.0 - old) * step(0.35, fract(bj.z * 5.3));
    vec3 frameCol = office > 0.5 ? mix(bBase, vec3(0.55, 0.57, 0.6), 0.6) : paleSash > 0.5 ? vec3(0.6, 0.61, 0.6) : mix(bBase, vec3(0.1), mix(0.55, 0.75, old));
    col = mix(wall, frameCol, frame);
    // by day, what hangs behind the glass shows a little: a home's lace, or its curtains drawn part way in a colour; an
    // office's blinds let down part way (at night the rooms behind take over, see below)
    vec3 dq = bH3(vec3(cellX * 1.9 + 0.7, fl * 1.3 + 0.4, face + 2.0) + seed * 0.23);
    float wy0 = clamp((fy - sill) / max(wh, 0.01), 0.0, 1.0), wx1 = clamp((fxw - wx0) / max(ww, 0.01), 0.0, 1.0);
    float fwx1 = fw.x / max(ww, 0.01);
    vec3 gday = glass;
    if (office > 0.5) {
      float blind = step(dq.x, 0.5) * step(1.0 - mix(0.12, 0.9, dq.y), wy0);
      gday = mix(glass, vec3(0.3, 0.31, 0.32) * (0.78 + 0.22 * bStripe(fy, 0.07, 0.5, fw.y)), blind * 0.8 * (1.0 - curtainWall * 0.5));
    } else {
      float lace = step(dq.x, 0.34) * (1.0 - balc * 0.5);
      float cw2 = mix(0.18, 0.45, dq.y);
      float drawn = step(0.34, dq.x) * step(dq.x, 0.62) * max(1.0 - bStep(cw2, wx1, fwx1), bStep(1.0 - cw2 * 0.7, wx1, fwx1));
      vec3 curC = dq.z < 0.4 ? vec3(0.46, 0.4, 0.3) : dq.z < 0.6 ? vec3(0.44, 0.3, 0.3) : dq.z < 0.8 ? vec3(0.3, 0.35, 0.42) : vec3(0.36, 0.39, 0.3);
      gday = mix(glass, vec3(0.34, 0.34, 0.33), lace * 0.55);
      gday = mix(gday, curC * 0.75, drawn);
    }
    col = mix(col, gday, glassA * near);
    col = mix(col, glass, glassA * farW);
    // the sill over it all
    col = mix(col, bBase * 1.16 + 0.03, sillM);
    glassMask = glassA;
    rough = mix(mix(0.86, 0.6, dirt), 0.14, glassA);
    // an air conditioner's outdoor unit on its bracket under a window now and then, its pipe up into the wall
    vec3 aq = bH3(vec3(cellX * 2.7 + 0.9, fl * 1.1 + 0.2, face + 6.0) + seed * 0.19);
    float acOn = home * (1.0 - balc) * (1.0 - corr) * step(aq.x, 0.2) * upper * step(0.84, sill) * near;
    if (acOn > 0.5) {
      float acx = aq.y < 0.5 ? wx0 + 0.02 : wx0 + ww - 0.8;
      float acB = bBox(acx, acx + 0.78, fxw, fw.x) * bBox(sill - 0.68, sill - 0.13, fy, fw.y);
      float acSh = bBox(acx + 0.04, acx + 0.82, fxw, fw.x) * bBox(sill - 0.76, sill - 0.68, fy, fw.y);
      float fan = bDisc(vec2(fxw - acx - 0.3, fy - sill + 0.405), 0.19, fw.x);
      float pipe = bBox(acx + 0.66, acx + 0.7, fxw, fw.x) * bBox(sill - 0.13, sill - 0.05, fy, fw.y);
      vec3 acC = vec3(0.6, 0.58, 0.52) * (1.0 - 0.75 * fan * (0.8 + 0.2 * bStripe(fy, 0.05, 0.5, fw.y)));
      col = mix(col * (1.0 - 0.45 * acSh), acC, acB);
      col = mix(col, vec3(0.62), pipe);
      glassMask *= 1.0 - acB;
      rough = mix(rough, 0.55, acB);
    }
    // an upper floor let to a bar, a clinic, a school or a karaoke box: its name in big characters on the glass, a
    // coloured panel with the strokes left clear, lit from behind at night
    vec3 sg = bH3(vec3(floor(cellX * 0.5) * 0.37 + 2.1, fl * 3.1 + 1.7, face + 3.0) + seed * 0.41);
    float signW = (1.0 - balc) * (1.0 - corr) * step(fl, 2.5) * step(sg.x, office > 0.5 ? 0.2 : 0.09) * upper * step(0.8, ww);
    vec3 signC = vec3(0.0);
    if (signW > 0.5) {
      float n = max(1.0, floor(ww / 0.85));
      float cwid = (ww - 2.0 * fr) / n;
      float u = (fxw - wx0 - fr) / cwid, v = (fy - sill - fr) / max(wh - 2.0 * fr, 0.01);
      vec2 gw = vec2(fw.x / cwid, fw.y / (wh * 0.64));
      float gq = bGlyph(vec2(fract(u), (v - 0.18) / 0.64), floor(u) * 0.618 + sg.y * 17.0 + fl * 3.3 + 0.37, gw);
      // (the strokes, until a character is a few pixels across; then the panel's own colour, a little paler)
      gq = mix(gq, 0.3, smoothstep(0.08, 0.22, max(gw.x, gw.y))) * step(0.18, v) * step(v, 0.82);
      vec3 pc = bSignCol(sg.z);
      float inv = step(0.6, sg.y);                                    // (now and then white with coloured characters)
      vec3 panel = inv > 0.5 ? vec3(0.9, 0.88, 0.84) : pc;
      vec3 chars = inv > 0.5 ? pc : vec3(0.95, 0.94, 0.9);
      signC = mix(panel, chars, gq * near);
      col = mix(col, signC * 0.75, glassA);
      rough = mix(rough, 0.35, glassA);
    }
    // this window: lit or dark, its colour and brightness, its blinds or curtains
    vec3 fr3 = bH3(vec3(fl * 2.31 + 0.7, 11.0, 5.0) + seed * 0.17);
    float wq = bH1(vec3(cellX * 1.3 + 0.2, fl * 0.7, face + 4.0) + seed * 0.37);
    float litF = mix(0.35, 0.55, bi.y) * mix(1.0, 0.6, old);
    float lit;
    if (office > 0.5) lit = fr3.x < (litF - 0.08) / 0.78 ? step(wr.x, 0.86) : step(wr.x, 0.08);
    else lit = step(wr.x, clamp(litF + (fr3.y - 0.5) * 0.3, 0.05, 0.95));
    lit *= 1.0 - signW;
    // a dark flat now and then has only its television on
    float tv = (1.0 - lit) * (1.0 - office) * (1.0 - signW) * step(fract(wq * 17.3), 0.13);
    vec3 wc;
    if (office > 0.5) wc = wr.y < 0.45 ? ${FLUO} : wr.y < 0.8 ? ${COOL} : wr.y < 0.97 ? ${WARM} : bAccent(wr.z);
    else wc = wr.y < 0.6 ? ${WARM} : wr.y < 0.74 ? ${COOL} : wr.y < 0.93 ? ${FLUO} : bAccent(wr.z);
    float br = mix(0.5, 1.2, wr.z) * (wq > 0.93 ? 1.9 : 1.0) * mix(1.0, 0.8, old);
    float wy = clamp((fy - sill) / wh, 0.0, 1.0);
    float wxr = clamp((fxw - wx0) / max(ww, 0.01), 0.0, 1.0);
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
        ov = max(1.0 - bStep(cw, wxr, fw.x / max(ww, 0.01)), bStep(1.0 - cw * 0.6, wxr, fw.x / max(ww, 0.01)));
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
    // a lit window throws a little of its light on the wall round it
    if (lit > 0.5 && near > 0.001) {
      float ddx = max(max(wx0 - fxw, fxw - wx0 - ww), 0.0), ddy = max(max(sill - fy, fy - sill - wh), 0.0);
      em += wc * br * 0.07 * exp(-length(vec2(ddx, ddy)) / 0.38) * (1.0 - win) * upper * near;
    }
    // a tenant's sign glows from behind at night
    em += signC * 0.6 * glassA * signW;
    float area = (ww * wh) / (bwc * FLOOR) * upper;
    em = mix(em, (litF * (office > 0.5 ? ${FLUO} : ${WARM}) * 0.8 * area + signW * signC * 0.4 * area) * (1.0 - corr), farW);
    if (balc > 0.5) {
      // ---- the balcony: its slab's edge standing out pale, the balustrade (frosted glass, white bars or a solid parapet,
      // the same all over the building), the partition board between two flats, and what is out on it: the air
      // conditioner seen through the rail, laundry on the pole, now and then a futon over the rail to air
      float rk = fract(bj.y * 7.3 + 0.2);
      vec3 bq = bH3(vec3(bay * 1.7 + 0.3, fl * 2.3 + 0.1, face + 9.0) + seed * 0.47);
      float edgeB = bBox(0.0, 0.2, fy, fw.y) * upper;
      float rail = bBox(0.2, 1.24, fy, fw.y) * upper;
      float part = (1.0 - bBox(0.06, bw - 0.06, fx, fw.x)) * bBox(0.2, 2.7, fy, fw.y) * upper;
      vec3 rc; float see;
      if (rk < 0.4) { rc = vec3(0.4, 0.45, 0.48); see = 0.3; }                                     // frosted glass
      else if (rk < 0.72) { float bars = bStripe(fx, 0.11, 0.3, fw.x); rc = mix(bBase * 0.3, vec3(0.74, 0.74, 0.72), bars); see = (1.0 - bars) * 0.6; }   // white bars
      else { rc = bBase * 1.04; see = 0.0; }                                                         // solid
      // behind the rail: the balcony's floor in shade and, at one end, the air conditioner
      float acb = step(bq.x, 0.72) * bBox(bq.y < 0.5 ? 0.3 : bw - 1.1, bq.y < 0.5 ? 1.1 : bw - 0.3, fx, fw.x) * bBox(0.24, 0.84, fy, fw.y);
      vec3 behind = mix(col * 0.55, vec3(0.6, 0.58, 0.52) * (1.0 - 0.7 * bDisc(vec2(fx - (bq.y < 0.5 ? 0.62 : bw - 0.78), fy - 0.54), 0.17, fw.x)), acb);
      vec3 railC = mix(rc, behind, see);
      railC = mix(railC, rk < 0.72 ? vec3(0.66, 0.67, 0.68) : bBase * 1.15, bBox(1.18, 1.24, fy, fw.y));      // its handrail
      col = mix(col, railC, rail);
      col = mix(col, bBase * 1.12 + 0.02, edgeB);
      col = mix(col, col * 0.62, bBox(2.84, 3.4, fy, fw.y) * upper * (1.0 - edgeB));      // the slab above throws its shade
      col = mix(col, vec3(0.7, 0.7, 0.68), part * 0.85);
      // laundry: a pole across under the slab, and on it shirts, towels and sheets, each its own length and colour
      float laun = step(bq.z, 0.42) * upper * near;
      float pole = laun * bBox(2.6, 2.64, fy, fw.y) * bBox(0.2, bw - 0.2, fx, fw.x);
      float gi = floor(fx / 0.36);
      vec3 gq = bH3(vec3(gi + bay * 13.0, fl + 0.5, face + 21.0) + seed * 0.13);
      float glen = mix(0.32, 0.8, gq.y);
      float garment = laun * step(gq.x, 0.66) * bBox(gi * 0.36 + 0.04, gi * 0.36 + 0.32, fx, fw.x) * bBox(2.62 - glen, 2.62, fy, fw.y) * step(0.24, fx) * step(fx, bw - 0.24);
      col = mix(col, bLaundry(gq.z) * 0.8, garment);
      col = mix(col, vec3(0.55), pole);
      // a futon over the rail, airing in the sun
      float fut = step(0.86, bq.y) * upper * near * bBox(0.35, min(1.55, bw - 0.3), fx, fw.x) * bBox(0.78, 1.36, fy, fw.y);
      col = mix(col, bLaundry(fract(bq.x * 7.0)) * 0.85, fut);
      // the rail, the laundry and the futon stand in front of the room's light
      float occ = (1.0 - rail * (1.0 - see * 0.8)) * (1.0 - garment) * (1.0 - fut) * (1.0 - part) * (1.0 - edgeB);
      rMul *= occ; rTV *= occ; em *= mix(1.0, occ, near);
      glassMask *= occ;
      rough = mix(rough, 0.5, (1.0 - occ) * near);
      // far away: the balconies as bands of rail and shade
      col = mix(col, mix(mix(wall, glass, 0.35), rc, 0.33), farW);
    } else if (corr > 0.5) {
      // ---- the open corridor of a block of flats: the parapet along each floor, and behind it, in the slab's shade, a
      // steel door to every flat with its barred kitchen window beside it, and the corridor's lamps under the slab above,
      // on all night; the stair at one end, a window at every landing, lit the whole way up
      float stairBay = fract(bk.x * 3.3) < 0.5 ? 0.0 : nb - 1.0;
      float isStair = step(abs(bay - stairBay), 0.5);
      float par = bBox(0.0, 1.2, fy, fw.y) * upper;
      // (the corridor runs on unbroken from bay to bay, to the face's ends)
      float openC = bBox(1.2, 3.12, fy, fw.y) * upper * (1.0 - isStair) * bBox(0.3, faceW - 0.3, along, fw.x);
      float dx0 = 0.22 + 0.36 * fract(bk.z * 7.7);
      float door = bBox(dx0, dx0 + 0.86, fx, fw.x) * bBox(1.2, 2.42, fy, fw.y);
      float doorIn = bBox(dx0 + 0.045, dx0 + 0.815, fx, fw.x) * bBox(1.2, 2.375, fy, fw.y);
      float kw = bBox(dx0 + 1.1, min(dx0 + 1.78, bw - 0.18), fx, fw.x) * bBox(1.62, 2.26, fy, fw.y);
      float kBars = kw * bStripe(fx, 0.1, 0.25, fw.x) * near;
      float dc = fract(bj.x * 11.3);
      vec3 doorC = dc < 0.4 ? vec3(0.3, 0.34, 0.4) : dc < 0.7 ? vec3(0.34, 0.25, 0.19) : vec3(0.62, 0.6, 0.55);
      // (all of it deep in the slab's shade by day: the corridor reads as a dark band under a pale parapet on every floor)
      vec3 cc = bBase * 0.3;                                              // the corridor's back wall
      cc = mix(cc, doorC * 0.2, door);
      cc = mix(cc, doorC * 0.36, doorIn);
      cc = mix(cc, vec3(0.16, 0.17, 0.18), kw);
      cc = mix(cc, vec3(0.4), kBars);
      cc *= 1.0 - 0.45 * smoothstep(2.4, 3.12, fy);                       // the soffit's shade
      // the lamp: one to every flat, between its door and its window, under the slab
      float lpx = dx0 + 0.98;
      float lampFix = bBox(lpx - 0.15, lpx + 0.15, fx, fw.x) * bBox(2.96, 3.08, fy, fw.y) * upper * (1.0 - isStair);
      cc = mix(cc, vec3(0.5), lampFix);
      vec3 lq = bH3(vec3(bay * 3.1 + 0.4, fl * 1.7 + 0.9, face + 33.0) + seed * 0.29);
      float on = step(lq.x, 0.94);
      vec3 lc = fract(bk.y * 3.7) < 0.55 ? ${lin(0xe8f4ff)} : ${lin(0xffe2b0)};
      float pool = exp(-pow((fx - lpx) / 1.1, 2.0)) * smoothstep(1.2, 3.0, fy);
      // (the light on the back wall and the doors is their own colour, lifted: a dark wall in a lit corridor, brightest
      // under each lamp, the doors darker shapes in it)
      em += openC * on * lc * (cc + 0.03) * (1.0 + 3.6 * pool);
      em += lampFix * on * lc * 2.4;
      em += kw * openC * step(lq.y, 0.3) * ${WARM} * 0.4 * (1.0 - kBars);
      col = mix(col, cc, openC);
      // the parapet: a pale band along every floor (the band of a block of flats from across the street), its top
      // catching the light
      col = mix(col, mix(col, bBase * 1.2 + 0.04, 0.55), par * (1.0 - isStair));
      col = mix(col, bBase * 1.3 + 0.05, bBox(1.14, 1.2, fy, fw.y) * upper * (1.0 - isStair));
      // the stair: a narrow window at every landing, half a floor up, the flight's handrail across it; lit all night
      if (isStair > 0.5) {
        float sx0 = bw * 0.5 - 0.45;
        float sw = bBox(sx0, sx0 + 0.9, fx, fw.x) * bBox(1.75, 3.05, fy, fw.y) * step(fh, bldH - GF - 0.8);
        float swIn = bBox(sx0 + 0.05, sx0 + 0.85, fx, fw.x) * bBox(1.8, 3.0, fy, fw.y);
        float rail = bBox(2.12, 2.17, fy - (fx - sx0) * 0.3, fw.y) * swIn * near;
        col = mix(col, frameCol, sw);
        col = mix(col, mix(vec3(0.3, 0.34, 0.36), vec3(0.1), rail), swIn * sw);
        em += sw * swIn * (1.0 - 0.8 * rail) * ${lin(0xdcecff)} * 0.75;
        glassMask = max(glassMask, swIn * sw * (1.0 - rail));
        rough = mix(rough, 0.2, swIn * sw);
      }
      // far away: a lit band along every floor
      col = mix(col, mix(wall, bBase * 0.45, 0.5), farW);
      em = mix(em, lc * (bBase * 0.38 + 0.04) * upper, farW * 0.85);
    } else {
      col = mix(col, mix(wall, glass, area), farW);
    }
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
  // ---- the city's own light on the walls at night: from above, the glow of the haze over the city (more on the upper
  // floors, which see more of the sky, more in rain, when the cloud is low, and more on the faces turned toward the city's
  // brightest quarter, so the two faces of a corner never meet as one black); from below, the street's light up the lower
  // floors, warm, or in the colour of the signs; a pale edge where the parapet and the corners catch the glow; the glass
  // giving back a little of it at a grazing look
  {
    float hk = smoothstep(2.0, 40.0, hgt);
    float facing = wN.y > 0.7 ? 1.25 : 0.42 + 0.58 * (0.5 + 0.5 * dot(normalize(wN.xz + vec2(1e-4)), vec2(0.6, -0.8)));
    vec3 skyC = ${lin(0x2a2140)} * (1.0 + 0.35 * wet);
    vec3 streetC = fract(bj.x * 9.1) < 0.6 ? ${lin(0xffb070)} : bAccent(fract(bk.z * 5.3));
    float streetK = abs(wN.y) <= 0.7 ? exp(-max(hgt - 3.6, 0.0) / 6.0) : 0.0;
    vec3 alb = max(col, vec3(0.06));
    vec3 fill = alb * (skyC * (0.5 + 0.5 * hk) * facing * 2.8 + streetC * 0.42 * streetK);
    em += fill * (1.0 - glassMask);
    if (abs(wN.y) <= 0.7) {
      float rimTop = 1.0 - smoothstep(0.0, max(0.3, 2.0 * fw.y), bldH - hgt);
      float rimSide = (1.0 - smoothstep(0.0, max(0.22, 2.0 * fw.x), min(along, faceW - along))) * (0.35 + 0.65 * hk);
      em += skyC * 0.55 * max(rimTop, rimSide);
      em += glassMask * skyC * 0.6 * (0.35 + 0.65 * (1.0 - abs(bDir.z)));
    }
  }
  // ---- red aviation lights on the tall ones, at the top corners of every face, pulsing slowly each on its own phase
  // (never smaller than a pixel and a half, so a far tower still shows its lights)
  if (bldH > 42.0 && abs(wN.y) <= 0.7) {
    float r = max(0.32, 1.5 * fw0);
    float ax = min(along, faceW - along) - 0.45;
    float dot1 = bDisc(vec2(ax, hgt - bldH + 0.55), r, max(fw0, 0.02));
    float k = max(0.0, sin(uTime * 1.9 + bk.y * 6.2832));
    em += dot1 * ${lin(0xff2a1e)} * (0.3 + 3.2 * k * k);
  }
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
  mat.customProgramCacheKey = () => 'bldg4';
  return mat;
}
