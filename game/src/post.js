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
    uInk: { value: 1.0 }, uBands: { value: 1.0 }, uGrain: { value: 0.035 }, uScan: { value: 0.06 }, uSpeed: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse, tDepth; uniform vec2 uRes; uniform float uNear, uFar, uTime, uInk, uBands, uGrain, uScan, uSpeed;
    varying vec2 vUv;
    float lin(vec2 uv){ float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear)); }
    float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float tl(vec2 uv){ vec3 c = texture2D(tDiffuse, uv).rgb; return luma(c / (c + 1.0)); }
    void main(){
      vec2 px = 1.0 / uRes;
      vec3 c = texture2D(tDiffuse, vUv).rgb;
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
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

export function makePost(renderer, scene, camera, { bloom = true, width, height }) {
  const pr = renderer.getPixelRatio();
  const w = Math.floor(width * pr), h = Math.floor(height * pr);
  const sceneRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(w, h), depthBuffer: true });
  const composer = new EffectComposer(renderer);
  composer.addPass(new TexturePass(sceneRT.texture));
  let bloomPass = null;
  if (bloom) { bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.45, 1.35); composer.addPass(bloomPass); }
  const cel = new ShaderPass(Cel);
  cel.uniforms.tDepth.value = sceneRT.depthTexture;
  cel.uniforms.uRes.value.set(w, h);
  cel.uniforms.uNear.value = camera.near; cel.uniforms.uFar.value = camera.far;
  composer.addPass(cel);
  composer.addPass(new OutputPass());
  return {
    composer, cel, bloomPass, sceneRT,
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
    },
  };
}
