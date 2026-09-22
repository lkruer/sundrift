/**
 * The chase camera. It sits behind a blend of the car's heading and its direction of travel, so in a drift the
 * car swings visibly sideways in frame instead of the world rotating around a car that always points up the
 * screen. That one choice is most of what makes a drift look like a drift from behind.
 *
 * Smoothness: the camera is attached rigidly to the car's position and only its HEADING is smoothed (and its
 * height, a little). A camera that chases a moving target with a damped position keeps a lag that depends on
 * the frame time, and on a browser's uneven frames that shows as the car shivering on screen. Roll comes from
 * the car's filtered lateral g, about the view axis; shake is smooth noise, never a random number per frame.
 * It is kept above the ground so a hairpin cut into the mountain can never put it inside the rock.
 */
import * as THREE from 'three';
import { CAM, clamp, damp, smoothstep } from './config.js?v=202609222216';

const TAU = Math.PI * 2;
function wrapA(d) { while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }

export class ChaseCam {
  constructor(camera) {
    this.cam = camera;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.dir = 0;
    this.dirVel = 0;
    this.fov = CAM.fov;
    this.shake = 0; this.t = 0;
    this.roll = 0;
    this.lift = 0;               // extra height pushed on by the ground, eased off again
    this.yS = 0;                 // smoothed road height
    this.distS = CAM.dist;
    this.init = false;
  }

  snap(car, y) {
    this.dir = car.yaw; this.dirVel = 0;
    this.yS = y; this.lift = 0; this.roll = 0; this.distS = CAM.dist;
    this.init = true;
    this._place(car, 1);
  }

  kick(amount) { this.shake = Math.min(1, this.shake + amount); }

  /**
   * @param car the Car; y the road height under it; groundAt (x, z) => ground height; boost01 0..1; zoom factor;
   * accL the car's filtered lateral acceleration
   */
  update(dt, car, y, groundAt, boost01, zoom = 1, accL = 0) {
    if (!this.init) this.snap(car, y);
    this.t += dt;
    const speed = car.speed;
    const [fx, fz] = car.forward();
    const [lx, lz] = car.left();
    const vx = fx * car.vF + lx * car.vL, vz = fz * car.vF + lz * car.vL;
    const velDir = speed > 2 && car.vF > 0 ? Math.atan2(vx, vz) : car.yaw;     // reversing: stay behind the car
    const blend = CAM.yawBlend * smoothstep(2, 9, speed);
    const want = car.yaw + wrapA(velDir - car.yaw) * blend;
    // the heading follows on a critically damped spring: no lag that depends on the frame time, no overshoot
    const w = 6.0 + speed * 0.05;
    const err = wrapA(want - this.dir);
    const k = w * w, c = 2 * w;
    // integrate in small steps so a long frame cannot destabilise it
    let rem = dt;
    while (rem > 1e-6) {
      const h = Math.min(rem, 1 / 120); rem -= h;
      const e = wrapA(want - this.dir);
      this.dirVel += (k * e - c * this.dirVel) * h;
      this.dir += this.dirVel * h;
    }
    if (Math.abs(err) > 2.2) { this.dir = want; this.dirVel = 0; }             // a spin: do not orbit the long way

    this.yS = damp(this.yS, y, 12, dt);
    const aspectK = this.cam.aspect < 1 ? 1 + 0.55 * (1 - this.cam.aspect) : 1;
    this.distS = damp(this.distS, (CAM.dist + speed * 0.012 + boost01 * 0.35) * aspectK * zoom, 3, dt);
    this.zoom = zoom;
    this._place(car, dt, groundAt);

    const fovT = CAM.fov + CAM.fovSpeed * smoothstep(5, 45, speed) + CAM.fovBoost * boost01;
    this.fov = damp(this.fov, fovT, 4, dt);
    this.shake *= Math.exp(-5 * dt);
    this.roll = damp(this.roll, clamp(-accL * CAM.roll * 0.1, -0.045, 0.045), 4, dt);

    const cm = this.cam;
    cm.position.copy(this.pos);
    if (this.shake > 0.002) {
      const s = this.shake, t = this.t;
      cm.position.x += (Math.sin(t * 31.1) * 0.6 + Math.sin(t * 17.3 + 1.3) * 0.4) * s * 0.16;
      cm.position.y += (Math.sin(t * 27.7 + 0.7) * 0.6 + Math.sin(t * 13.9 + 2.1) * 0.4) * s * 0.12;
    }
    cm.up.set(0, 1, 0);
    cm.lookAt(this.look);
    cm.rotateZ(this.roll);
    if (Math.abs(cm.fov - this.fov) > 0.05) { cm.fov = this.fov; cm.updateProjectionMatrix(); }
  }

  _place(car, dt, groundAt = null) {
    const zoom = this.zoom || 1;
    const dist = this.distS;
    const sx = Math.sin(this.dir), sz = Math.cos(this.dir);
    const tx = car.x - sx * dist, tz = car.z - sz * dist;
    let ty = this.yS + CAM.height * Math.pow(zoom, 0.8);
    if (groundAt) {
      // keep clear of the ground under the camera and halfway to the car
      const g = Math.max(groundAt(tx, tz), groundAt((tx + car.x) / 2, (tz + car.z) / 2) - 0.2);
      const need = Math.max(0, g + 1.25 - ty);
      this.lift = need > this.lift ? damp(this.lift, need, 14, dt) : damp(this.lift, need, 2.5, dt);
    }
    this.pos.set(tx, ty + this.lift, tz);
    this.look.set(car.x + sx * CAM.lookAhead, this.yS + CAM.lookUp + this.lift * 0.35, car.z + sz * CAM.lookAhead);
  }
}
