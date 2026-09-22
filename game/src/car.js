/**
 * The car: a two-axle bicycle model with saturating tyres, weight transfer and a friction circle on the
 * driven rear axle. Pure maths, no Three.js, so it runs in Node for tuning (work/sim.mjs) and in the game.
 *
 * Why a real-ish tyre model rather than "lateral velocity decays": drifting only feels right when the car
 * has to be caught. With saturating rear tyres and a friction circle, throttle takes lateral grip away
 * from the rear (power oversteer), the handbrake takes it away outright, weight moves forward under braking
 * so a lift-and-turn rotates the car, and counter-steer is what holds an angle. Every one of those is a thing
 * a drift player expects to be able to do, and none of them can be faked convincingly from a decay factor.
 *
 * Frame: forward is +Z when yaw = 0, and left is +X. yaw increases when the nose turns LEFT. Steering input
 * is +1 for left. The body slip angle `beta` is positive when the car travels to the LEFT of where its nose
 * points, which means the tail is out to the right.
 */
export const CAR = {
  mass: 1240, izz: 2650,
  a: 1.18, b: 1.32,               // CG to front and rear axle, metres (wheelbase 2.5)
  cgHeight: 0.42,
  maxSteer: 0.58,                 // rad at standstill
  steerFalloff: 0.030,            // per m/s: 0.58 / (1 + 0.030 * 25 m/s) = 0.33 rad at 90 km/h
  steerRate: 7.5,                 // rad/s the wheels move toward the target
  engineForce: 8200,              // N at low speed, rear wheels
  engineTop: 64,                  // m/s where engine force has faded to zero (230 km/h)
  brakeForce: 10500,
  handbrakeForce: 3300,
  dragCoef: 0.46,                 // N / (m/s)^2 ; terminal about 190 km/h without boost
  rollCoef: 40,                   // N / (m/s)
  muFront: 1.35, muRear: 1.30,
  muRearHandbrake: 0.50,
  muSlide: 0.86,                  // fraction of peak grip once a tyre is past its peak slip angle
  peakSlip: 0.12,                 // rad (~7 deg)
  slideSoft: 0.36,                // rad over which grip falls from peak to muSlide
  circleGain: 0.50,               // how much of the rear longitudinal force eats into rear lateral grip
  boostForce: 6200,
  assist: 0.62,                   // counter-steer assist, 0..1, added to the player's steer at slip
  assistTouch: 0.78,
  offroadMu: 0.55, offroadDrag: 260,
  wheelRadius: 0.32, track: 1.5,
  lowSpeed: 2.5,                  // below this the model blends toward kinematic
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

/** Normalised tyre curve: force / peak, from slip angle. Rises to 1 at peakSlip, droops to muSlide beyond. */
function tyre(alpha, P) {
  const s = Math.abs(alpha);
  const rise = Math.tanh((s / P.peakSlip) * 1.35);
  const droop = 1 - (1 - P.muSlide) * sstep(P.peakSlip, P.peakSlip + P.slideSoft, s);
  return Math.sign(alpha) * rise * droop;
}

export class Car {
  constructor(P = CAR) {
    this.P = P;
    this.x = 0; this.z = 0; this.yaw = 0;
    this.vF = 0; this.vL = 0; this.omega = 0;
    this.steer = 0;                 // actual road-wheel angle, rad, left positive
    this.throttle = 0; this.brake = 0; this.hand = 0;
    this.handGrip = 1;              // rear grip factor, eases back after the handbrake is released
    this.boost = 0;                 // seconds of boost remaining
    this.surface = 1;               // 1 road, 0 off road
    this.wheelSpin = 0;             // radians, visual
    this.rearSpin = 0;
    this.beta = 0; this.alphaR = 0; this.alphaF = 0;
    this.accF = 0; this.accL = 0;
    this.slipRear = 0;              // 0..1, how far past peak the rear is (drives smoke, sound, skid alpha)
    this.slipFront = 0;
    this.gForce = 0;
  }

  get speed() { return Math.hypot(this.vF, this.vL); }
  get kmh() { return this.speed * 3.6; }
  forward() { return [Math.sin(this.yaw), Math.cos(this.yaw)]; }
  left() { return [Math.cos(this.yaw), -Math.sin(this.yaw)]; }

  reset(x, z, yaw) {
    this.x = x; this.z = z; this.yaw = yaw;
    this.vF = this.vL = this.omega = 0; this.steer = 0; this.boost = 0; this.handGrip = 1;
    this.beta = this.alphaR = this.alphaF = 0; this.slipRear = this.slipFront = 0;
  }

  /** World-space position of a point given in car space (left, forward). */
  point(l, f) {
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    return [this.x + c * l + s * f, this.z - s * l + c * f];
  }

  /** World velocity of a car-space point, for impact speeds. */
  pointVelocity(l, f) {
    // v = v_cg + omega x r ; in 2D with omega about +Y (yaw positive left): dv_left = omega * f, dv_fwd = -omega * l
    const vl = this.vL + this.omega * f, vf = this.vF - this.omega * l;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    return [c * vl + s * vf, -s * vl + c * vf];
  }

  /**
   * One physics step. input = { throttle 0..1, brake 0..1, steer -1..1 (left +), hand 0/1, reverse bool, touch bool }.
   * surface = 1 on asphalt, 0 fully off the road. Sub-steps internally for stability.
   */
  step(dt, input, surface = 1) {
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / n;
    for (let i = 0; i < n; i++) this._sub(h, input, surface);
    this.wheelSpin += this.vF / this.P.wheelRadius * dt;
    // the rear visibly overspeeds under throttle while sliding, and locks under the handbrake
    const rearRate = this.hand > 0.5 ? this.vF * 0.15 : this.vF * (1 + this.slipRear * 0.8 * this.throttle);
    this.rearSpin += rearRate / this.P.wheelRadius * dt;
  }

  _sub(h, inp, surface) {
    const P = this.P;
    const g = 9.81, m = P.mass, L = P.a + P.b;
    this.surface = surface;
    const muScale = 1 - (1 - P.offroadMu) * (1 - surface);

    // ---- steering: player + assist. Assist steers the front wheels toward the direction of travel
    // at large slip, which is what an experienced driver's hands do and what a thumb cannot.
    const speed = this.speed;
    const steerMax = P.maxSteer / (1 + P.steerFalloff * speed);
    const assist0 = inp.touch ? P.assistTouch : P.assist;
    // the direction the front axle is actually travelling, relative to the nose; steering the wheels toward it is
    // counter-steer, and doing part of it for the player is what keeps a thumb from spinning the car. Past about
    // 45 degrees of slip the assist takes over almost entirely, which is what gives the car a natural maximum
    // angle instead of a spin when a player keeps the key held into the slide.
    const frontSlipDir = Math.atan2(this.vL + P.a * this.omega, Math.max(Math.abs(this.vF), 0.8));
    const bigSlip = sstep(0.55, 1.0, Math.abs(frontSlipDir));
    const assist = assist0 + (0.97 - assist0) * bigSlip;
    const assistAngle = clamp(frontSlipDir, -P.maxSteer, P.maxSteer) * assist * sstep(1.5, 6, speed);
    const playerSteer = inp.steer * steerMax * (1 - 0.7 * bigSlip * (Math.sign(inp.steer) === -Math.sign(frontSlipDir) ? 1 : 0));
    const target = clamp(playerSteer + assistAngle, -P.maxSteer, P.maxSteer);
    this.steer += clamp(target - this.steer, -P.steerRate * h, P.steerRate * h);
    const d = this.steer;

    // ---- handbrake grip eases back over ~0.35 s so a release does not snap the car straight
    this.hand = inp.hand ? 1 : 0;
    const handTarget = inp.hand ? P.muRearHandbrake : 1;
    this.handGrip += (handTarget - this.handGrip) * (inp.hand ? 1 : Math.min(1, h * 3.2));
    this.throttle = clamp(inp.throttle, 0, 1);
    this.brake = clamp(inp.brake, 0, 1);

    // ---- longitudinal forces on the rear (RWD)
    const fade = clamp(1 - Math.pow(Math.max(0, this.vF) / P.engineTop, 2), 0, 1);
    const antiSpin = 1 - 0.55 * sstep(0.7, 1.1, Math.abs(this.beta));
    let Fdrive = this.throttle * P.engineForce * fade * antiSpin;
    if (this.boost > 0) { Fdrive += P.boostForce * (0.6 + 0.4 * this.throttle); this.boost = Math.max(0, this.boost - h); }
    if (inp.reverse && this.vF < 1.0) Fdrive = -P.engineForce * 0.45 * (this.vF > -8 ? 1 : 0);
    // the brake key is also reverse once the car has stopped, so it must not fight the reverse drive
    const braking = inp.reverse && this.vF < 0.5 ? 0 : this.brake;
    const Fbrake = -Math.sign(this.vF) * braking * P.brakeForce * Math.min(1, Math.abs(this.vF) / 0.6);
    const Fhand = -Math.sign(this.vF) * this.hand * P.handbrakeForce * Math.min(1, Math.abs(this.vF) / 0.6);
    const Fdrag = -(P.dragCoef * this.vF * Math.abs(this.vF) + P.rollCoef * this.vF) - (1 - surface) * P.offroadDrag * this.vF;
    let FxR = Fdrive + Fbrake * 0.4 + Fhand;      // rear carries 40 % of the brakes and all of the drive
    let FxF = Fbrake * 0.6;

    // ---- weight transfer from the last step's longitudinal acceleration
    const ax = clamp(this.accF, -12, 12);
    const FzF = Math.max(0.2 * m * g, m * g * P.b / L - m * ax * P.cgHeight / L);
    const FzR = Math.max(0.2 * m * g, m * g * P.a / L + m * ax * P.cgHeight / L);

    // ---- slip angles
    const vFa = Math.max(Math.abs(this.vF), 1.2);
    const aF = d - Math.atan2(this.vL + P.a * this.omega, vFa);
    const aR = -Math.atan2(this.vL - P.b * this.omega, vFa);
    this.alphaF = aF; this.alphaR = aR;

    // ---- lateral tyre forces (left positive)
    const FmaxF = P.muFront * muScale * FzF;
    let FmaxR = P.muRear * muScale * FzR * this.handGrip;
    // friction circle on the rear: longitudinal demand eats lateral capacity
    const used = Math.min(0.97, Math.abs(FxR) * P.circleGain / Math.max(1, FmaxR));
    FmaxR *= Math.sqrt(1 - used * used);
    const FyF = FmaxF * tyre(aF, P);
    const FyR = FmaxR * tyre(aR, P);
    // longitudinal forces cannot exceed what the tyre has left either
    FxR = clamp(FxR, -FmaxR * 1.4, FmaxR * 1.4);
    FxF = clamp(FxF, -FmaxF, FmaxF);

    // ---- low speed: blend toward a kinematic bicycle so the car parks without twitching
    const lowT = 1 - sstep(0.4, P.lowSpeed, speed);

    // ---- accelerations in the body frame
    let aFwd = (FxR + FxF * Math.cos(d) - FyF * Math.sin(d) + Fdrag) / m;
    let aLat = (FyF * Math.cos(d) + FyR) / m;
    let omegaDot = (P.a * FyF * Math.cos(d) - P.b * FyR) / P.izz;

    this.accF = aFwd; this.accL = aLat;
    this.vF += (aFwd + this.vL * this.omega) * h;
    this.vL += (aLat - this.vF * this.omega) * h;
    this.omega += omegaDot * h;
    const recovering = Math.abs(this.beta) < Math.abs(this._prevBeta || 0) && Math.abs(this.beta) > 0.1;
    this.omega *= Math.exp(-(0.35 + (recovering ? 1.6 : 0)) * h);
    this._prevBeta = this.beta;

    if (lowT > 0) {
      const omegaKin = this.vF * Math.tan(d) / L;
      this.omega += (omegaKin - this.omega) * lowT * Math.min(1, h * 30);
      this.vL *= 1 - lowT * Math.min(1, h * 25);
    }
    // stop the last centimetres per second so the car actually stops
    if (Math.abs(this.vF) < 0.05 && this.throttle === 0 && !inp.reverse) this.vF = 0;

    // ---- integrate pose
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    this.x += (s * this.vF + c * this.vL) * h;
    this.z += (c * this.vF - s * this.vL) * h;
    this.yaw += this.omega * h;

    // ---- telemetry
    this.beta = Math.atan2(this.vL, Math.max(Math.abs(this.vF), 0.8));
    this.slipRear = sstep(P.peakSlip * 0.9, P.peakSlip + P.slideSoft * 0.9, Math.abs(aR)) * sstep(2, 6, speed);
    this.slipFront = sstep(P.peakSlip, P.peakSlip + P.slideSoft, Math.abs(aF)) * sstep(2, 6, speed);
    this.gForce = Math.hypot(aFwd, aLat) / g;
  }

  /**
   * A wall hit: `n` is the unit normal pointing from the wall INTO the road (world x, z), `depth` how far a
   * corner is inside the wall, and (l, f) that corner in car space. Pushes the car out, kills the velocity
   * into the wall, scrubs speed, and spins the car by the corner's lever arm. Returns the impact speed.
   */
  hitWall(nx, nz, depth, l, f) {
    // move out
    this.x += nx * depth; this.z += nz * depth;
    // velocity of the corner into the wall
    const [vx, vz] = this.pointVelocity(l, f);
    const vin = -(vx * nx + vz * nz);
    if (vin <= 0) return 0;
    // impulse along the normal, with a little restitution, applied at the corner
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const nL = c * nx - s * nz;           // normal in car space (left component)
    const nF = s * nx + c * nz;           // forward component
    const rCross = f * nL - l * nF;       // r x n, the lever for yaw
    const inv = 1 / this.P.mass + (rCross * rCross) / this.P.izz;
    const j = (1.25 * vin) / inv;         // restitution 0.25
    this.vL += (j * nL) / this.P.mass;
    this.vF += (j * nF) / this.P.mass;
    this.omega += (j * rCross) / this.P.izz;
    // friction along the wall scrubs speed
    const scrub = Math.exp(-0.06 * vin);
    this.vF *= scrub; this.vL *= scrub;
    return vin;
  }
}

/** rpm and gear from speed, for the engine sound and the tacho. Six close ratios, redline 8,200. */
export function gearbox(speedMs, throttle, prev) {
  const ratios = [3.3, 2.1, 1.5, 1.15, 0.92, 0.78];
  const final = 4.1, r = CAR.wheelRadius;
  let gear = prev?.gear ?? 0;
  const rpmOf = (g) => (Math.abs(speedMs) / (2 * Math.PI * r)) * 60 * ratios[g] * final;
  let rpm = rpmOf(gear);
  if (rpm > 7900 && gear < 5) { gear++; rpm = rpmOf(gear); }
  else if (rpm < 3200 && gear > 0) { gear--; rpm = rpmOf(gear); }
  rpm = Math.max(900, rpm);
  if (speedMs < 0.5) rpm = 900 + throttle * 4500;
  return { gear, rpm };
}
