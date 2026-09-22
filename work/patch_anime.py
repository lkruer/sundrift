p='game/src/main.js'; s=open(p,encoding='utf-8').read()

a="""import { SkidMarks, Particles, ExhaustFlame } from './fx.js';"""
b="""import { SkidMarks, Particles, ExhaustFlame } from './fx.js';
import { makePost } from './post.js';"""
assert a in s; s=s.replace(a,b)

# the rig lights; the cel pass draws
a="""const rig = createRig(THREE, renderer, scene, { hour: G.hour, azimuth: 235, tier, fogStart: 55, fogDensity: 0.0013, exposure: 1.05, bloomThreshold: 1.6, bloomStrength: 0.22 });"""
b="""const rig = createRig(THREE, renderer, scene, { hour: G.hour, azimuth: 235, tier, fogStart: 55, fogDensity: 0.0013, exposure: 1.05, post: false });
const post = makePost(renderer, scene, camera, { bloom: tier !== 'phone', width: innerWidth, height: innerHeight });
// the composer renders several passes; count the whole frame for the telemetry, the way the rig's own post did
renderer.info.autoReset = false;"""
assert a in s; s=s.replace(a,b)

a="""  rig.render(camera, dt);

  const g = window.__GAME__;"""
b="""  renderer.info.reset();
  rig.update(camera, dt);
  post.render(dt);

  const g = window.__GAME__;"""
assert a in s; s=s.replace(a,b)

a="""  rig.resize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());"""
b="""  post.resize(w, h);"""
assert a in s; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s); print('main patched')

# drift assists: more counter-steer for the player, anti-spin throttle, a smoother catch, more lock at speed
p='game/src/car.js'; s=open(p,encoding='utf-8').read()
for a,b in [
 ("  steerFalloff: 0.040,            // per m/s: 0.58 / (1 + 0.040 * 25 m/s) = 0.29 rad at 90 km/h", "  steerFalloff: 0.030,            // per m/s: 0.58 / (1 + 0.030 * 25 m/s) = 0.33 rad at 90 km/h"),
 ("  muRearHandbrake: 0.55,", "  muRearHandbrake: 0.50,"),
 ("  handbrakeForce: 3800,", "  handbrakeForce: 3300,"),
 ("  muSlide: 0.80,                  // fraction of peak grip once a tyre is past its peak slip angle", "  muSlide: 0.86,                  // fraction of peak grip once a tyre is past its peak slip angle"),
 ("  slideSoft: 0.30,                // rad over which grip falls from peak to muSlide", "  slideSoft: 0.36,                // rad over which grip falls from peak to muSlide"),
 ("  assist: 0.48,                   // counter-steer assist, 0..1, added to the player's steer at slip", "  assist: 0.62,                   // counter-steer assist, 0..1, added to the player's steer at slip"),
 ("  assistTouch: 0.66,", "  assistTouch: 0.78,"),
]:
    assert a in s, a[:50]; s=s.replace(a,b)
a="""    const bigSlip = sstep(0.55, 1.05, Math.abs(frontSlipDir));
    const assist = assist0 + (0.95 - assist0) * bigSlip;"""
b="""    const bigSlip = sstep(0.55, 1.0, Math.abs(frontSlipDir));
    const assist = assist0 + (0.97 - assist0) * bigSlip;"""
assert a in s; s=s.replace(a,b)
# anti-spin: past forty degrees of slip the throttle is eased, so holding the gas cannot spin the car
a="""    const fade = clamp(1 - Math.pow(Math.max(0, this.vF) / P.engineTop, 2), 0, 1);
    let Fdrive = this.throttle * P.engineForce * fade;"""
b="""    const fade = clamp(1 - Math.pow(Math.max(0, this.vF) / P.engineTop, 2), 0, 1);
    const antiSpin = 1 - 0.55 * sstep(0.7, 1.1, Math.abs(this.beta));
    let Fdrive = this.throttle * P.engineForce * fade * antiSpin;"""
assert a in s; s=s.replace(a,b)
# a smoother catch: extra yaw damping while the slide is coming back
a="""    this.omega += omegaDot * h;
    this.omega *= Math.exp(-0.35 * h);"""
b="""    this.omega += omegaDot * h;
    const recovering = Math.abs(this.beta) < Math.abs(this._prevBeta || 0) && Math.abs(this.beta) > 0.1;
    this.omega *= Math.exp(-(0.35 + (recovering ? 1.6 : 0)) * h);
    this._prevBeta = this.beta;"""
assert a in s; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s); print('car patched')

p='game/src/config.js'; s=open(p,encoding='utf-8').read()
a="  minSlip: 0.19,         // rad, drift begins"
b="  minSlip: 0.17,         // rad, drift begins"
assert a in s; s=s.replace(a,b); open(p,'w',encoding='utf-8').write(s); print('config patched')
