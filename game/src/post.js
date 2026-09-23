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
    uShaft: { value: new THREE.Vector3(0.5, 0.5, 0) }, uShaftCol: { value: new THREE.Color(1, 1, 1) },
    uMist: { value: new THREE.Vector4(-1e4, 0.03, 14, 0) }, uMistCol: { value: new THREE.Color() }, uMistGlow: { value: new THREE.Color() }, uMistFar: { value: new THREE.Color() },
    uCamPos: { value: new THREE.Vector3() }, uCamRot: { value: new THREE.Matrix3() }, uTanFov: { value: new THREE.Vector2(1, 1) },
    uMoonDir: { value: new THREE.Vector3(0, 1, 0) }, uNoise: { value: null }, uMistT: { value: 0 },
    uPrevVP: { value: new THREE.Matrix4() }, uBlur: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse, tDepth; uniform vec2 uRes; uniform float uNear, uFar, uTime, uInk, uBands, uGrain, uScan, uSpeed, uVig, uHit, uCA;
    uniform vec3 uShaft, uShaftCol;
    uniform vec4 uMist; uniform vec3 uMistCol, uMistGlow, uMistFar, uCamPos, uMoonDir; uniform mat3 uCamRot; uniform vec2 uTanFov; uniform sampler2D uNoise; uniform float uMistT;
    uniform mat4 uPrevVP; uniform float uBlur;
    // how much cloud lies between height y and the cloud's top: a ramp over soft metres, then solid
    float mistG(float y, float top, float soft) { float d = top - y; return d <= 0.0 ? 0.0 : d < soft ? d * d / (2.0 * soft) : d - 0.5 * soft; }
    varying vec2 vUv;
    float lin(vec2 uv){ float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear)); }
    float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float tl(vec2 uv){ vec3 c = texture2D(tDiffuse, uv).rgb; return luma(c / (c + 1.0)); }
    void main(){
      vec2 px = 1.0 / uRes;
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // motion blur: where this pixel was on the screen a frame ago (its world position from the depth, through the
      // last frame's camera), and the picture averaged along the way it moved, half a frame's worth (a 180-degree
      // shutter). The car rides with the lens, so nothing within 9 m is blurred and nothing that near is blurred in.
      if (uBlur > 0.001) {
        float dB = lin(vUv);
        vec3 wdB = uCamRot * vec3((vUv * 2.0 - 1.0) * uTanFov, -1.0);
        vec4 pc = uPrevVP * vec4(uCamPos + wdB * dB, 1.0);
        vec2 vel = (vUv - (pc.xy / max(pc.w, 1e-4) * 0.5 + 0.5)) * uBlur * smoothstep(8.0, 14.0, dB);
        float vl = length(vel * vec2(uRes.x / uRes.y, 1.0));
        if (vl > 0.03) vel *= 0.03 / vl;
        if (vl > 0.0015 && pc.w > 0.0) {
          vec3 acc = c; float wsum = 1.0;
          float jit = hash(gl_FragCoord.xy * 0.37 + fract(uTime * 3.0)) - 0.5;
          for (int i = 1; i <= 6; i++) {
            float t = (float(i) + jit) / 6.0 - 0.5;
            vec2 uv2 = clamp(vUv - vel * t * 2.0, 0.001, 0.999);
            float ok = step(8.0, lin(uv2));
            acc += texture2D(tDiffuse, uv2).rgb * ok; wsum += ok;
          }
          c = acc / wsum;
        }
      }
      // a tube's colour fringe: red and blue slip apart toward the edges of the frame
      if (uCA > 0.0) {
        // (as a difference from the centre, so a blurred colour keeps its blur)
        vec2 fr = (vUv - 0.5) * uCA * dot(vUv - 0.5, vUv - 0.5) * 4.0;
        vec3 c0 = texture2D(tDiffuse, vUv).rgb;
        c.r += texture2D(tDiffuse, vUv + fr).r - c0.r;
        c.b += texture2D(tDiffuse, vUv - fr).b - c0.b;
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
      // the sky (nothing written to depth): no bands, no dots, no ink, so the sun's glow stays a soft glow and
      // is not cut into a great flat disc
      float sky = step(uFar * 0.985, d0);
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
      float band = mix(l, q, 0.55 * uBands * (1.0 - sky));
      vec3 col = c * (band + 0.006) / (l + 0.006);
      // halftone dots in the shade, the way printed shade is drawn
      float dots = 0.5 + 0.5 * sin(gl_FragCoord.x * 0.62) * sin(gl_FragCoord.y * 0.62);
      float shade = smoothstep(0.26, 0.06, l);
      col *= 1.0 - 0.16 * shade * dots * uBands * (1.0 - sky);
      // ink
      float ink = clamp(sil + crease * 0.45 * (1.0 - sky), 0.0, 1.0) * uInk;
      col *= 1.0 - ink * 0.92;
      // the sea of cloud: a height fog below a billowing top, integrated along this pixel's ray from the depth
      if (uMist.w > 0.001 && sky < 0.5) {
        vec3 vd = vec3((vUv * 2.0 - 1.0) * uTanFov, -1.0);
        vec3 wd = uCamRot * vd;
        vec3 P = uCamPos + wd * d0;
        float y0 = uCamPos.y, y1 = P.y;
        float tt = clamp((y0 - uMist.x) / max(1e-3, y0 - y1), 0.0, 1.0);
        vec2 hit = mix(uCamPos.xz, P.xz, tt);
        float nz = dot(texture2D(uNoise, hit / 420.0 + uMistT * vec2(0.0016, 0.0007)), vec4(0.5, 0.27, 0.15, 0.08));
        nz += 0.35 * (dot(texture2D(uNoise, hit / 130.0 - uMistT * vec2(0.003, 0.0045)), vec4(0.4, 0.3, 0.2, 0.1)) - 0.5);
        float top = uMist.x + (nz - 0.5) * 30.0;
        float L = length(P - uCamPos), dy = y0 - y1;
        float amt = abs(dy) > 0.05 ? abs(mistG(y1, top, uMist.z) - mistG(y0, top, uMist.z)) * L / abs(dy) : clamp((top - y0) / uMist.z, 0.0, 1.0) * L;
        // (in the nearer valleys, not the far ones: a sheet across the far valley floor reads as a flat lake)
        float tau = min(uMist.y * amt * (0.55 + 0.9 * nz), 0.9) * (1.0 - smoothstep(500.0, 1700.0, L));
        float T = exp(-tau);
        vec3 mc = uMistCol * (0.68 + 0.7 * nz) + uMistGlow * pow(max(0.0, dot(normalize(wd), uMoonDir)), 5.0);
        // (the far sea of cloud takes the haze, as everything far does, so it meets the sky without a line)
        mc = mix(mc, uMistFar, smoothstep(900.0, 3400.0, L) * 0.85);
        col = mix(mc, col, T);
      }
      // light shafts: march from the pixel toward the sun or the moon on the screen, counting the open sky on the
      // way (the depth buffer's far plane); whatever stands in front breaks the light into rays. Added over the
      // ink, as light in the air in front of things, and only faintly over the sky itself
      if (uShaft.z > 0.001) {
        vec2 dv = (uShaft.xy - vUv) / 22.0;
        vec2 suv = vUv + dv * hash(gl_FragCoord.xy * 0.71 + fract(uTime * 7.0) * 13.0);
        float acc = 0.0, wgt = 1.0, wsum = 0.0;
        for (int i = 0; i < 22; i++) {
          suv += dv;
          acc += step(uFar * 0.985, lin(clamp(suv, 0.002, 0.998))) * wgt;
          wsum += wgt; wgt *= 0.95;
        }
        float fall = 1.0 - smoothstep(0.05, 0.95, length((uShaft.xy - vUv) * vec2(uRes.x / uRes.y, 1.0)));
        col += uShaftCol * (acc / wsum) * fall * fall * uShaft.z * mix(1.0, 0.18, sky);
      }
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
    uLevels: { value: 32 }, uMask: { value: 0.06 }, uLens: { value: 0 }, uTime: { value: 0 }, uFlow: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uCurve, uEdge, uCorner, uLevels, uMask, uLens, uTime, uFlow;
    varying vec2 vUv;
    float hs(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    // rain on the glass: beads that gather and dry on a grid of cells, and drops that run down their own tracks (raked
    // sideways at speed). Returns where to look through the drop (an offset) in xy, and how much drop there is in z.
    vec3 lensRain(vec2 uv) {
      vec2 q = uv * vec2(uRes.x / uRes.y, 1.0);
      vec3 acc = vec3(0.0);
      {
        vec2 g = q / 0.055, id = floor(g), f = fract(g) - 0.5;
        float h = hs(id), per = 7.0 + 9.0 * hs(id + 3.1), ph = fract(uTime / per + h);
        float on = step(1.0 - uLens * 0.32, hs(id + floor(uTime / per + h) * 13.7));
        vec2 c = (vec2(hs(id + 1.7), hs(id + 5.3)) - 0.5) * 0.5;
        float r = (0.08 + 0.3 * pow(hs(id + 9.1), 2.0)) * smoothstep(0.0, 0.06, ph) * (1.0 - smoothstep(0.55, 1.0, ph));
        vec2 d = f - c; float l = length(d) / max(r, 1e-4);
        float m = on * (1.0 - smoothstep(0.8, 1.0, l)) * step(0.001, r);
        acc += vec3(-d * 0.05 * m, m);
      }
      {
        float cw = 0.045, col = floor(q.x / cw), h = hs(vec2(col, 11.0));
        float on = step(1.0 - uLens * 0.35, h);
        float sp = 0.1 + 0.25 * hs(vec2(col, 3.0));
        float y = 1.15 - fract(uTime * sp + h) * 1.3;
        float x = (fract(q.x / cw) - 0.5) * cw + sin(q.y * 23.0 + h * 9.0) * 0.004 + (q.y - y) * uFlow * 0.25;
        vec2 d = vec2(x, (q.y - y) * 0.7);
        float l = length(d) / 0.011;
        float m = on * (1.0 - smoothstep(0.7, 1.0, l));
        float trail = on * (1.0 - smoothstep(0.0, 0.004, abs(x))) * step(y, q.y) * (1.0 - smoothstep(0.0, 0.12, q.y - y)) * 0.5;
        acc += vec3(-d / 0.011 * 0.008 * m + vec2(x * 0.4 * trail, 0.0), max(m, trail));
      }
      acc.x *= uRes.y / uRes.x;                    // (back from the square-celled lens space to the picture)
      return acc;
    }
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
      vec3 col;
      if (uLens > 0.001) {
        vec3 lr = lensRain(uv);
        float m = clamp(lr.z, 0.0, 1.0);
        col = texture2D(tDiffuse, clamp(uv + lr.xy, 0.0, 1.0)).rgb;
        // a drop darkens a little at its rim and catches a glint up on its left
        col *= 1.0 - 0.14 * m * (1.0 - m);
        col += vec3(0.16) * m * smoothstep(0.6, 1.0, dot(normalize(lr.xy + 1e-5), vec2(0.55, -0.83)));
      } else col = texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb;
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
  cel.uniforms.uCA.value = fringe ? 0.0042 : 0;
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
      if (retro) retro.uniforms.uTime.value += dt;
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
