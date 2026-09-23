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
  steerFalloff: 0.034,            // per m/s: 0.58 / (1 + 0.034 * 25 m/s) = 0.31 rad at 90 km/h
  steerRate: 7.5,                 // rad/s the wheels move toward the target
  engineForce: 9600,              // N at low speed, rear wheels
  engineTop: 68,                  // m/s where engine force has faded to zero (245 km/h)
  brakeForce: 10500,
  handbrakeForce: 3300,
  dragCoef: 0.46,                 // N / (m/s)^2 ; terminal about 190 km/h without boost
  rollCoef: 40,                   // N / (m/s)
  muFront: 1.35, muRear: 1.33,
  muRearHandbrake: 0.50,
  muSlide: 0.86,                  // fraction of peak grip once a tyre is past its peak slip angle
  peakSlip: 0.12,                 // rad (~7 deg)
  slideSoft: 0.36,                // rad over which grip falls from peak to muSlide
  circleGain: 0.46,               // how much of the rear longitudinal force eats into rear lateral grip
  boostForce: 6200,
  assist: 0.62,                   // counter-steer assist, 0..1, added to the player's steer at slip
  assistTouch: 0.78,
  assistYield: 2.0,               // how fast a key held into the turn takes the counter-steer help away (x the key)
  steerGainMin: 0.72,             // A/D on a straight give this share of the lock a tight corner gets
  holdAngle: 0.62,                // rad: past this the rear finds grip again, so a held slide does not spin
  lineAssist: 0.75,               // tight bends taken sideways: share of the missing turn the path and nose are helped round by
  spinFrom: 0.8, spinFull: 1.25,  // drive over the rear tyres' capacity at which they start to spin, and spin freely
  spinLoss: 0.68,                 // share of the rear's cornering grip a freely spinning tyre loses (at low speed)
  yawDamp: 0.5,                   // per second, always: a calmer car between slides
  reverseForce: 1.0, reverseTop: 20,    // reverse gear pull (share of the engine) and top speed, m/s (45 mph)
  wallSpin: 0.55,                 // share of a wall hit's yaw kick that is kept: a hit shoves, it rarely spins
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
    this._assist = 0; this._gain = 1; this._dAB = 0; this._prevAB = 0;
    this.jturn = 0;                 // seconds left in which a fast reverse may still swing round
    this.air = false;               // off the ground (a crest taken fast off the road): no tyre does anything
    this._psi = 0;                  // the direction of travel last substep (the line assist's measure of the turn)
    this._donut = 0; this.spin = 0;   // how much the car is being asked to spin on the spot; how much the rear is spinning
    this.extF = 0; this.extL = 0;   // an outside acceleration in the car's frame, m/s^2: a slope's gravity, a banked road's
    this.jt = 0; this.jtT = 0; this.jtTravel = 0; this.jtRem = 0; this.jturnDone = false;   // a J-turn in progress (its turning sign)
    // a J-turn may start; off the gear but still held to the wheels; the flick's hold; the wheel while on the gear
    this._jtOk = false; this._revCoast = false; this._jtHold = 0; this._revSteer = 0; this._revWas = false;
  }

  get speed() { return Math.hypot(this.vF, this.vL); }

  /** In the air: the car keeps its velocity and its spin, and the air slows both a touch. */
  _airSub(h) {
    this.vF *= Math.exp(-0.04 * h); this.vL *= Math.exp(-0.04 * h); this.omega *= Math.exp(-0.5 * h);
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    this.x += (s * this.vF + c * this.vL) * h;
    this.z += (c * this.vF - s * this.vL) * h;
    this.yaw += this.omega * h;
    this.beta = Math.atan2(this.vL, Math.max(Math.abs(this.vF), 0.8));
    this.slipRear = 0; this.slipFront = 0; this.accF = 0; this.accL = 0;
  }
  get kmh() { return this.speed * 3.6; }
  forward() { return [Math.sin(this.yaw), Math.cos(this.yaw)]; }
  left() { return [Math.cos(this.yaw), -Math.sin(this.yaw)]; }

  reset(x, z, yaw) {
    this.x = x; this.z = z; this.yaw = yaw;
    this.vF = this.vL = this.omega = 0; this.steer = 0; this.boost = 0; this.handGrip = 1;
    this.beta = this.alphaR = this.alphaF = 0; this.slipRear = this.slipFront = 0;
    this._assist = 0; this._gain = 1; this._dAB = 0; this._prevAB = 0; this.jturn = 0; this.jt = 0; this.jturnDone = false;
    this._jtOk = false; this._revCoast = false; this._jtHold = 0; this._revSteer = 0; this._revWas = false;
    this.air = false; this.extF = 0; this.extL = 0;
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
    if (this.air) { this._airSub(h); return; }
    const P = this.P;
    const g = 9.81, m = P.mass, L_ = P.a + P.b, L = L_;
    this.surface = surface;
    const muScale = 1 - (1 - P.offroadMu) * (1 - surface);

    // ---- steering: player + assist. Assist steers the front wheels toward the direction of travel
    // at large slip, which is what an experienced driver's hands do and what a thumb cannot.
    const speed = this.speed;
    // going backwards the wheels get full lock (the speed falloff is for stability going forwards)
    const backing = this.vF < -0.5;
    const steerMax = backing ? P.maxSteer : P.maxSteer / (1 + P.steerFalloff * speed);
    // donuts: at low speed, the throttle floored and the wheel held hard into the way the car is turning, the car is
    // asked to spin on the spot, so the help that keeps a slide from spinning steps aside
    const into = Math.abs(this.omega) > 0.3 ? (Math.sign(inp.steer) === Math.sign(this.omega) ? 1 : 0) : 1;
    const donutT = sstep(0.55, 0.9, inp.throttle) * sstep(0.5, 0.9, Math.abs(inp.steer)) * into * (1 - sstep(7, 10, speed)) * (backing || this.jt ? 0 : 1);
    this._donut += (donutT - this._donut) * Math.min(1, h * 6);
    const D = this._donut;
    const assist0 = (inp.touch ? P.assistTouch : P.assist) * (1 - 0.85 * D);
    // the direction the front axle is actually travelling, relative to the nose; steering the wheels toward it is
    // counter-steer, and doing part of it for the player is what keeps a thumb from spinning the car. With no key
    // held (or a key held the catch's way) the assist has the wheel, more of it the deeper the slide; past about 45
    // degrees it has almost all of it, which gives a held slide a natural maximum angle instead of a spin.
    const frontSlipDir = Math.atan2(this.vL + P.a * this.omega, Math.max(Math.abs(this.vF), 0.8));
    const bigSlip = sstep(0.55, 1.0, Math.abs(frontSlipDir));
    const assist = assist0 + (0.97 - assist0) * bigSlip * (1 - D);
    const assistRaw = clamp(frontSlipDir, -P.maxSteer, P.maxSteer) * assist * sstep(1.5, 6, speed) * (this.vF < 0 || this.jt ? 0 : 1);
    // filtered: the assist follows the slide, not every wobble of it, so the front wheels never chatter
    this._assist += (assistRaw - this._assist) * Math.min(1, h * 22);
    // but the player's hands win: a key held INTO the turn (against the catch) takes the help away in proportion
    // (a key held half way or more: all of it), so the wheels go where the key says. (The assist used to keep the
    // wheel and cut the key to a third in a deep slide: the wheels pointed against the key held into the turn.)
    // Spinning is then held off by the rear's grip past the comfortable angle and the yaw damping past 50 degrees.
    const intoTurn = inp.steer !== 0 && Math.sign(inp.steer) === -Math.sign(frontSlipDir);
    const yield_ = intoTurn && !backing ? Math.min(1, Math.abs(inp.steer) * P.assistYield) : 0;
    const playerSteer = inp.steer * steerMax * (backing ? 1 : 1 - 0.25 * bigSlip * (1 - D) * (intoTurn ? 1 : 0));
    // A and D ask for as much lock as the corner ahead needs: a hairpin gets full lock, a straight a gentler
    // correction. Nothing steers the car when no key is held.
    let gainT = 1;
    const LN = inp.line;
    if (LN && speed > 4 && !backing && this.jturn <= 0) gainT = clamp(Math.abs(LN.curv) * 30 + P.steerGainMin, P.steerGainMin, 1.0);
    this._gain += (gainT - this._gain) * Math.min(1, h * 4);
    let target = clamp(playerSteer * this._gain + this._assist * (1 - yield_), -P.maxSteer, P.maxSteer);
    // (and whatever else is going on, a key held firmly never has the wheels pointing the other way)
    if (Math.abs(inp.steer) > 0.25 && !backing && target * Math.sign(inp.steer) < 0) target = 0;
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
    const antiSpin = 1 - 0.55 * sstep(0.7, 1.1, Math.abs(this.beta)) * (1 - D);
    let Fdrive = this.throttle * P.engineForce * fade * antiSpin;
    if (this.boost > 0) { Fdrive += P.boostForce * (0.6 + 0.4 * this.throttle); this.boost = Math.max(0, this.boost - h); }
    // in a J-turn the throttle waits for the nose to come round, then pulls away along the line
    if (this.jt) Fdrive *= this.jtRem < 0.7 ? 1 : 0.1;
    // reverse: a short, strong gear that keeps pulling (the fade is on the square of the speed) toward 45 mph
    if (inp.reverse && this.vF < 1.0) Fdrive = -P.engineForce * P.reverseForce * clamp(1 - Math.pow(Math.max(0, -this.vF) / P.reverseTop, 2), 0, 1);
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

    // ---- wheelspin: past what the rear tyres can take, the drive spins them, and a spinning tyre has little left for
    // cornering: power oversteer out of a slide and, with the wheel held into the turn at low speed, donuts. Only in the
    // low gears or already sideways (a fast straight spreads the power too thin), and less at speed.
    {
      const cap = P.muRear * muScale * FzR * this.handGrip;
      const demand = Math.max(0, Fdrive) / Math.max(1, cap);
      const gate = Math.max(1 - sstep(10, 22, speed), sstep(0.1, 0.28, Math.abs(this.beta)) * (1 - 0.5 * sstep(24, 34, speed)), D);
      // (asked for a donut, the tyres break loose sooner: from a standstill, full lock and the throttle floored)
      const sf = P.spinFrom - (P.spinFrom - 0.45) * D, sfull = P.spinFull - (P.spinFull - 0.8) * D;
      this.spin = sstep(sf, sfull, demand) * gate * (this.vF > 0.5 && !this.jt ? 1 : 0);
    }

    // ---- slip angles, in each wheel's own frame, so they hold going backwards as well as forwards: the angle
    // between the way the wheel rolls (either way along its plane) and the way its axle is actually moving.
    // Going forwards the front one is the familiar d - atan(vy / vF); going backwards the steer's sign turns
    // round, which is what makes a reversing car swing its nose out and a J-turn possible.
    const cd = Math.cos(d), sd = Math.sin(d);
    const vyF = this.vL + P.a * this.omega;
    const vParF = this.vF * cd + vyF * sd, vPerpF = -this.vF * sd + vyF * cd;
    const aF = -Math.atan2(vPerpF, Math.max(Math.abs(vParF), 1.2));
    const aR = -Math.atan2(this.vL - P.b * this.omega, Math.max(Math.abs(this.vF), 1.2));
    this.alphaF = aF; this.alphaR = aR;

    // ---- lateral tyre forces (left positive)
    const FmaxF = P.muFront * muScale * FzF;
    const capR = P.muRear * muScale * FzR * this.handGrip;      // all the rear has, before the drive takes its share
    let FmaxR = capR;
    // drift hold: past a comfortable angle the rear finds a little grip back, so a held slide settles instead of
    // spinning; below it, on the throttle, the rear gives a little, so a slide does not die on its own
    {
      const aB = Math.abs(this.beta);
      const inDrift = sstep(0.14, 0.3, aB) * sstep(6, 11, speed) * (this.vF > 0 && this.jturn <= 0 ? 1 : 0);
      let hold = 0;
      if (aB > P.holdAngle) hold = Math.min(0.35, (aB - P.holdAngle) * 1.1);
      else if (this.throttle > 0.5 && aB > 0.2 && aB < P.holdAngle - 0.15) hold = -0.06 * sstep(0.2, 0.3, aB);
      FmaxR *= 1 + hold * inDrift * (1 - D);
    }
    // friction circle on the rear: longitudinal demand eats lateral capacity
    const used = Math.min(0.97, Math.abs(FxR) * P.circleGain / Math.max(1, capR));
    FmaxR *= Math.sqrt(1 - used * used);
    // (and a spinning tyre has little left for cornering)
    FmaxR *= 1 - P.spinLoss * this.spin * (1 - 0.45 * sstep(12, 26, speed));
    // (in a J-turn the tyres let go a little, so the car swings round its own momentum instead of being yanked)
    if (this.jt) { FmaxR *= 0.6; }
    const FyF = FmaxF * tyre(aF, P) * (this.jt ? 0.6 : 1);
    const FyR = FmaxR * tyre(aR, P);
    // longitudinal forces cannot exceed what the tyre has left either
    // (the drive is limited by the tyre's whole grip, not what is left for cornering; spinning, a little less)
    // (in a donut most of the power goes into spinning the tyres, not into speed)
    FxR = clamp(FxR, -capR * 1.25, capR * 1.25) * (1 - 0.12 * this.spin - 0.12 * D * this.spin);
    FxF = clamp(FxF, -FmaxF, FmaxF);

    // ---- low speed, and slow reversing: blend toward a kinematic bicycle so the car parks and backs up without
    // twitching. Reversing fast (a J-turn in the making) it is left to the tyres: a reversing car is unstable,
    // and that instability is the manoeuvre.
    // The J-turn window opens only when the reverse gear is let go at speed after backing up roughly straight (a
    // flick, held, then swings the car round). Let go after backing round something with the wheel over, which is
    // stopping backing up, and the car keeps following its wheels as it rolls, as if still on the gear: it used to
    // take that for a J-turn and whip the car round to face the other way.
    if (inp.reverse) {
      this._revSteer += (Math.abs(inp.steer) - this._revSteer) * Math.min(1, h * 5);
      this._jtOk = false; this._revCoast = this.vF < -0.15; this._revWas = true;
    } else {
      if (this._revWas) { this._revWas = false; this._jtOk = this.vF < -3.8 && this._revSteer < 0.45; if (this._jtOk) this._revCoast = false; }
      if (this.vF > -0.5) { this._jtOk = false; this._revCoast = false; this._revSteer = 0; }
    }
    if (this.vF < -3.8 && this._jtOk) this.jturn = 1.4; else this.jturn = Math.max(0, this.jturn - h);
    // the kinematic bicycle's yaw rate (the lateral g capped, so full lock backing up fast is a brisk arc, not a
    // pirouette on the spot)
    const wMax = 9 / Math.max(1, speed);
    const omegaKin = clamp(this.vF * Math.tan(d) / L, -wMax, wMax);
    // (both only once the car is rolling straight on its wheels: a car sliding sideways that is going a little
    // backwards, which is every spin as it passes 90 degrees and every slide braked on S, or still spinning, is the
    // tyres' to slow, not the blend's to stop dead)
    const straight = (1 - sstep(0.18, 0.45, Math.abs(this.beta))) * (1 - sstep(1.2, 3.5, Math.abs(this.vL))) * (1 - sstep(1.0, 2.2, Math.abs(this.omega - omegaKin)));
    const revSlow = this.vF < -0.15 && this.jturn <= 0 ? (1 - sstep(3, 6.5, -this.vF)) * straight : 0;
    // on the reverse gear the car follows its wheels at any speed, so backing up is steady and a tap on the wheel
    // is a correction; let the gear go at speed and the tyres have it, which is how a J-turn starts
    const revHeld = (inp.reverse || this._revCoast) && this.vF < -0.15 && !this.jt ? 0.9 * straight : 0;
    // (not in a donut: there the car is meant to go round on its spinning tyres, however slowly it moves)
    const lowT = Math.max((1 - sstep(0.4, P.lowSpeed, speed)) * (1 - 0.75 * D), revSlow, revHeld);

    // ---- accelerations in the body frame
    let aFwd = (FxR + FxF * Math.cos(d) - FyF * Math.sin(d) + Fdrag) / m;
    let aLat = (FyF * Math.cos(d) + FyR) / m;
    let omegaDot = (P.a * FyF * Math.cos(d) - P.b * FyR) / P.izz;

    this.accF = aFwd; this.accL = aLat;
    this.vF += (aFwd + this.extF + this.vL * this.omega) * h;
    this.vL += (aLat + this.extL - this.vF * this.omega) * h;
    this.omega += omegaDot * h;
    this._jturnAssist(h, inp);
    // a donut, held: while the rear tyres spin the car keeps turning, at a rate the throttle sets, and the spinning
    // tyres keep it moving round rather than letting it scrub to a stop
    if (D > 0.05 && this.spin > 0.05) {
      const wT = Math.sign(inp.steer) * (1.7 + 0.8 * clamp(inp.throttle, 0, 1));
      this.omega += (wT - this.omega) * Math.min(1, h * 2.2) * D * this.spin;
      if (speed < 3.5) this.vF += (3.5 - speed) * 2.5 * D * h;
    }
    // yaw damping: a little always; more while a slide is being caught (continuous, so it never twitches on and
    // off); and past about 50 degrees, against the yaw that would take the car further round
    {
      const aB = Math.abs(this.beta);
      const dAB = (aB - this._prevAB) / h; this._prevAB = aB;
      this._dAB += (dAB - this._dAB) * Math.min(1, h * 25);
      const recov = clamp(-this._dAB * 1.5, 0, 1) * sstep(0.06, 0.18, aB);
      // (not in a J-turn: there the car is meant to go all the way round, and the catch brings it to rest facing
      // the way it is travelling)
      const over = this.omega * this.beta < 0 && this.jturn <= 0 ? 4.0 * sstep(0.85, 1.2, aB) * (1 - D) : 0;
      this.omega *= Math.exp(-(P.yawDamp * (this.jturn > 0 ? 0.3 : 1) + 1.6 * recov * (this.jturn > 0 ? 0.25 : 1) + over) * h);
    }

    if (lowT > 0) {
      // (rolling straight it holds the car to its wheels; sliding or spinning, never faster than tyres could: the
      // blend steadies a slow car, it does not stop a slide or a spin dead)
      const capW = (4 + 42 * straight) * h, capV = (3 + 44 * straight) * h;
      this.omega += clamp((omegaKin - this.omega) * lowT * Math.min(1, h * 30), -capW, capW);
      this.vL -= clamp(this.vL * lowT * Math.min(1, h * 25), -capV, capV);
    }
    // ---- tight corners, taken sideways: a hand on the line. Held in a slide through a bend tighter than about 50 m,
    // sliding the bend's way round (the tail out to the outside), the direction of travel is helped round toward the
    // bend's own rate where the sliding tyres fall short, and the nose with it, so the slide keeps its angle. Only
    // what is missing, and only part of it: a hairpin still wants a slide set up and held, but a held one makes it.
    {
      const LN = inp.line, v = Math.hypot(this.vF, this.vL);
      const psi = this.yaw + Math.atan2(this.vL, Math.max(0.5, this.vF));
      let rate = (psi - this._psi) / h; this._psi = psi;
      rate = Math.atan2(Math.sin(rate * h), Math.cos(rate * h)) / h;
      if (LN && LN.here !== undefined && this.vF > 4 && !this.jt && !this.air) {
        const kh = LN.here, sg = Math.sign(kh);
        // (a slide the bend's way round: travelling outside of where the nose points, so beta is against the bend;
        // whatever the wheel is doing, since counter-steer is how a slide is held)
        const w = P.lineAssist * sstep(1 / 55, 1 / 16, Math.abs(kh)) * sstep(0.1, 0.3, -this.beta * sg);
        if (w > 0.002) {
          const need = v * kh;
          // the path: turn the velocity (not its size) by part of what it lacks
          const lack = clamp((need - rate) * sg, 0, 1.4);
          const dp = sg * lack * w * h;
          const cr = Math.cos(dp), sr = Math.sin(dp), vF0 = this.vF;
          this.vF = vF0 * cr - this.vL * sr; this.vL = this.vL * cr + vF0 * sr;
          // the nose: brought round with it where it lags the bend
          const lagY = clamp((need - this.omega) * sg, 0, 1.5);
          this.omega += sg * lagY * w * 1.1 * h;
          // and a slide into a bend too tight for its speed sheds some of it, the way tyres dragged sideways do
          const excess = v * v * Math.abs(kh) - 12;
          if (excess > 0) { const f = Math.max(0, 1 - Math.min(4, excess * 0.3) * w * h / Math.max(1, v)); this.vF *= f; this.vL *= f; }
        }
      }
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
   * The J-turn: reversing faster than about 10 mph, a hard flick of the wheel swings the nose out, and from there the
   * car is helped the rest of the way round to face the way it is travelling, then settled there, so the move
   * is clean every time it is asked for (a real one needs a feel no keyboard gives). A gentle correction while
   * backing up never starts one: it takes speed, a hard flick and the nose already coming round.
   */
  _jturnAssist(h, inp) {
    const speed = this.speed;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const vx = s * this.vF + c * this.vL, vz = c * this.vF - s * this.vL;
    if (!this.jt) {
      // (jturnDone stays up until the game has read it)
      // it starts when, the reverse gear let go at speed (the window above), the wheel is put hard over and held
      // there a moment: a deliberate thing, so a tap on the wheel, on the gear or off it, is only ever a correction
      this._jtHold = this.jturn > 0 && !inp.reverse && this.vF < -1.5 && speed > 3.6 && Math.abs(inp.steer) > 0.7 ? this._jtHold + h : 0;
      if (this._jtHold > 0.1) {
        // backing up, wheels left swing the nose right: the kinematic sign, unless the car is already turning
        this.jt = Math.abs(this.omega) > 0.25 ? Math.sign(this.omega) : -Math.sign(inp.steer);
        this.jtT = 0; this.jtTravel = Math.atan2(vx, vz);
      }
      return;
    }
    this.jtT += h;
    if (speed > 1.5) this.jtTravel = Math.atan2(vx, vz);
    // how much further round, turning the way it already is
    const TAU = Math.PI * 2;
    let rem = this.jt > 0 ? (this.jtTravel - this.yaw) : (this.yaw - this.jtTravel);
    rem = ((rem % TAU) + TAU) % TAU;
    if (rem > Math.PI * 1.6) rem -= TAU;                 // just past it: come back a touch
    this.jtRem = Math.abs(rem);
    const want = this.jt * clamp(rem * 4.2, -2.5, 4.4);
    this.omega += (want - this.omega) * Math.min(1, h * 9);
    if ((Math.abs(rem) < 0.1 && this.vF > 0.5) || speed < 1.2 || this.jtT > 2.6) {
      this.jturnDone = Math.abs(rem) < 0.1 && this.vF > 0.5;
      this.jt = 0; this.jturn = 0;
    }
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
    const j = (1.2 * vin) / inv;          // restitution 0.2
    this.vL += (j * nL) / this.P.mass;
    this.vF += (j * nF) / this.P.mass;
    this.omega += (j * rCross) / this.P.izz * this.P.wallSpin;
    // friction along the wall, bounded by the normal impulse (Coulomb): a glancing touch slides along the
    // rail and keeps most of its speed, a hard hit grabs
    const tx = -nz, tz = nx;
    const [ux, uz] = this.pointVelocity(l, f);
    const vt = ux * tx + uz * tz;
    const tL = c * tx - s * tz, tF = s * tx + c * tz;
    const rT = f * tL - l * tF;
    const invT = 1 / this.P.mass + (rT * rT) / this.P.izz;
    const lim = 0.3 * j;
    const jt = Math.max(-lim, Math.min(lim, -vt / invT));
    this.vL += (jt * tL) / this.P.mass;
    this.vF += (jt * tF) / this.P.mass;
    this.omega += (jt * rT) / this.P.izz * this.P.wallSpin;
    const scrub = Math.exp(-0.012 * vin);
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
