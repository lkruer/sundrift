/**
 * The look: a 90s drift anime. The scene is lit and rendered normally (the recipe's rig lights it), then one
 * full-screen pass turns the frame into cel bands with ink outlines and halftone shade, adds film grain and a
 * faint scanline veneer. Bloom for the lamps and the tail lights runs before it on the desktop tier.
 *
 * Ink comes from depth discontinuities, measured relative to depth so a far ridge gets one clean line and not
 * a scribble, plus a softer luma edge for creases. Bands are decided on a tone-mapped copy of the colour and
 * applied as a ratio, so hue survives and the output stays linear HDR for the OutputPass to tone-map.
 *
 * The scene renders into its own target that owns the depth texture; the composer copies the colour out of
 * it and never touches that depth. Giving the composer's ping-pong buffers a shared depth texture rendered
 * one black frame a second, which is the kind of thing worth writing down.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { TexturePass } from 'three/addons/postprocessing/TexturePass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const Cel = {
  uniforms: {
    tDiffuse: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
    uNear: { value: 0.4 }, uFar: { value: 4500 }, uTime: { value: 0 },
    uInk: { value: 1.0 }, uBands: { value: 1.0 }, uGrain: { value: 0.035 }, uScan: { value: 0.075 }, uSpeed: { value: 0 },
    uVig: { value: 0 }, uHit: { value: 0 }, uCA: { value: 0.006 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse, tDepth; uniform vec2 uRes; uniform float uNear, uFar, uTime, uInk, uBands, uGrain, uScan, uSpeed, uVig, uHit, uCA;
    varying vec2 vUv;
    float lin(vec2 uv){ float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear)); }
    float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float tl(vec2 uv){ vec3 c = texture2D(tDiffuse, uv).rgb; return luma(c / (c + 1.0)); }
    void main(){
      vec2 px = 1.0 / uRes;
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // a tube's colour fringe: red and blue slip apart toward the edges of the frame
      if (uCA > 0.0) {
        vec2 fr = (vUv - 0.5) * uCA * dot(vUv - 0.5, vUv - 0.5) * 4.0;
        c.r = texture2D(tDiffuse, vUv + fr).r;
        c.b = texture2D(tDiffuse, vUv - fr).b;
      }
      // speed: the edges of the frame smear toward the centre, the way a drift anime draws speed
      vec2 toC = vUv - vec2(0.5, 0.42);
      float edge = smoothstep(0.12, 0.5, dot(toC, toC));
      if (uSpeed > 0.01 && edge > 0.001) {
        vec3 acc = c; float wsum = 1.0;
        for (int i = 1; i <= 5; i++) { float t = float(i) / 5.0; vec2 uv2 = vUv - toC * t * 0.05 * uSpeed * edge; acc += texture2D(tDiffuse, uv2).rgb; wsum += 1.0; }
        c = acc / wsum;
      }
      // silhouettes: relative depth discontinuity
      float d0 = lin(vUv);
      float dl = lin(vUv - vec2(px.x, 0.0)), dr = lin(vUv + vec2(px.x, 0.0)), du = lin(vUv + vec2(0.0, px.y)), dd = lin(vUv - vec2(0.0, px.y));
      float rel = (abs(dl - d0) + abs(dr - d0) + abs(du - d0) + abs(dd - d0)) / d0;
      float sil = smoothstep(0.04, 0.14, rel) * (1.0 - step(uFar * 0.9, d0));
      // creases: a sobel on tone-mapped luma
      float a = tl(vUv + vec2(-px.x,  px.y)), b = tl(vUv + vec2(0.0,  px.y)), cc = tl(vUv + vec2( px.x,  px.y));
      float d = tl(vUv + vec2(-px.x,  0.0)),                                   e = tl(vUv + vec2( px.x,  0.0));
      float f = tl(vUv + vec2(-px.x, -px.y)), g = tl(vUv + vec2(0.0, -px.y)), h = tl(vUv + vec2( px.x, -px.y));
      float gx = (cc + 2.0 * e + h) - (a + 2.0 * d + f), gy = (a + 2.0 * b + cc) - (f + 2.0 * g + h);
      float crease = smoothstep(0.18, 0.5, sqrt(gx * gx + gy * gy));
      // bands in display space, applied as a ratio so hue survives
      vec3 tm = c / (c + 1.0);
      float l = luma(tm);
      float steps = 6.0;
      float q = floor(l * steps + 0.5) / steps;
      float band = mix(l, q, 0.55 * uBands);
      vec3 col = c * (band + 0.006) / (l + 0.006);
      // halftone dots in the shade, the way printed shade is drawn
      float dots = 0.5 + 0.5 * sin(gl_FragCoord.x * 0.62) * sin(gl_FragCoord.y * 0.62);
      float shade = smoothstep(0.26, 0.06, l);
      col *= 1.0 - 0.16 * shade * dots * uBands;
      // ink
      float ink = clamp(sil + crease * 0.45, 0.0, 1.0) * uInk;
      col *= 1.0 - ink * 0.92;
      // grain and a faint scanline veneer
      float gr = (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) * uGrain;
      col += gr * (0.25 + l);
      col *= 1.0 - uScan * (0.5 + 0.5 * sin(gl_FragCoord.y * 1.5708));
      // the tube's vignette, deeper while a drift is held, and the red flash of a hit: drawn here rather than as
      // full-screen page layers, which cost the browser a 100 ms stall the first time a drift lit them
      vec2 vq = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
      float r2 = dot(vq, vq);
      col *= 1.0 - (0.34 + 0.32 * uVig) * smoothstep(0.16, 0.62, r2);
      col = mix(col, vec3(1.0, 0.23, 0.19) * (0.25 + l), uHit * 0.55 * smoothstep(0.1, 0.55, r2));
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

/**
 * The tube, last, in display space. The glass is nearly flat in the middle and bends more toward the edges and
 * most into the corners (a quadratic plus a quartic term in the distance from the centre), so the picture's own
 * edges bow and its corners pull in round, the way a 90s set's did. The picture sits a little back from the
 * glass: it darkens into the rounded edge, and a faint cold sheen runs round the rim. Then colour is cut to 32
 * levels a channel with an ordered dither (the grain of a 90s console's output), and a faint aperture grille.
 */
const Retro = {
  uniforms: {
    tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
    uCurve: { value: 0.022 }, uEdge: { value: 0.055 }, uCorner: { value: 0.045 },
    uLevels: { value: 32 }, uMask: { value: 0.06 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uCurve, uEdge, uCorner, uLevels, uMask;
    varying vec2 vUv;
    float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
    float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
    // signed distance to a rounded rectangle of half-size b and corner radius r
    float rbox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
    void main(){
      vec2 c = vUv * 2.0 - 1.0;
      float r2 = dot(c, c) * 0.5;                          // 0 at the centre, 0.5 mid-edge, 1 in the corners
      vec2 uv = vUv + c * (uCurve * r2 + uEdge * r2 * r2);
      // the picture's frame, in pixels of the picture: a rounded rectangle, anti-aliased over a pixel and a half
      vec2 px = (uv - 0.5) * uRes;
      float rad = uCorner * uRes.y;
      float d = rbox(px, 0.5 * uRes, rad);
      float inside = 1.0 - smoothstep(-1.5, 0.0, d);
      if (inside <= 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
      vec3 col = texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb;
      col = floor(col * uLevels + bayer4(gl_FragCoord.xy)) / uLevels;
      float m = mod(gl_FragCoord.x, 3.0);
      vec3 mask = vec3(m < 1.0 ? 1.0 : 1.0 - uMask, (m >= 1.0 && m < 2.0) ? 1.0 : 1.0 - uMask, m >= 2.0 ? 1.0 : 1.0 - uMask);
      col *= mask * (1.0 + uMask * 0.6);
      // set back behind the glass: darker into the rim, and a faint cold sheen along it, brightest top left
      float rim = -d / uRes.y;                             // distance in from the edge, in picture heights
      col *= 0.55 + 0.45 * smoothstep(0.0, 0.035, rim);
      float sheen = smoothstep(0.012, 0.0, abs(rim - 0.006)) * (0.5 + 0.5 * dot(normalize(c + 1e-4), vec2(-0.6, 0.8)));
      col += vec3(0.05, 0.06, 0.075) * sheen;
      gl_FragColor = vec4(col * inside, 1.0);
    }`,
};

export function makePost(renderer, scene, camera, { bloom = true, width, height, fringe = true, tube = true }) {
  const pr = renderer.getPixelRatio();
  const w = Math.floor(width * pr), h = Math.floor(height * pr);
  const sceneRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(w, h), depthBuffer: true });
  const composer = new EffectComposer(renderer);
  composer.addPass(new TexturePass(sceneRT.texture));
  const cel = new ShaderPass(Cel);
  cel.uniforms.tDepth.value = sceneRT.depthTexture;
  cel.uniforms.uRes.value.set(w, h);
  cel.uniforms.uCA.value = fringe ? 0.006 : 0;
  cel.uniforms.uNear.value = camera.near; cel.uniforms.uFar.value = camera.far;
  composer.addPass(cel);
  // bloom after the bands, so a lamp's halo stays a soft round glow over the inked frame instead of being cut
  // into flat rings by the banding
  let bloomPass = null;
  if (bloom) { bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.45, 1.35); composer.addPass(bloomPass); }
  composer.addPass(new OutputPass());
  let retro = null;
  if (tube) { retro = new ShaderPass(Retro); retro.uniforms.uRes.value.set(w, h); retro.uniforms.uMask.value = pr > 1.6 ? 0.0 : 0.06; composer.addPass(retro); }
  return {
    composer, cel, bloomPass, sceneRT, retro,
    render(dt) {
      renderer.setRenderTarget(sceneRT);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      cel.uniforms.uTime.value += dt;
      composer.render(dt);
    },
    resize(width2, height2) {
      const p = renderer.getPixelRatio();
      const w2 = Math.floor(width2 * p), h2 = Math.floor(height2 * p);
      sceneRT.setSize(w2, h2);
      composer.setSize(width2, height2);
      cel.uniforms.uRes.value.set(w2, h2);
      cel.uniforms.tDepth.value = sceneRT.depthTexture;
      if (bloomPass) bloomPass.setSize(w2, h2);
      if (retro) retro.uniforms.uRes.value.set(w2, h2);
    },
  };
}
