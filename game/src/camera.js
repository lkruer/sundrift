/**
 * The chase camera. It sits behind a blend of the car's heading and its direction of travel, so in a drift
 * the car swings visibly sideways in frame instead of the world rotating around a car that always points
 * up the screen. That one choice is most of what makes a drift look like a drift from behind.
 *
 * The camera never rolls with the ground (docs/traps.md), only a touch with lateral g, and it is kept above
 * the terrain so a hairpin cut into the mountain cannot put it inside the rock.
 */
import * as THREE from 'three';
import { CAM, clamp, damp, smoothstep } from './config.js?v=202609220343';

const TAU = Math.PI * 2;
function lerpAngle(a, b, t) { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return a + d * t; }

export class ChaseCam {
  constructor(camera) {
    this.cam = camera;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.dir = 0;
    this.fov = CAM.fov;
    this.shake = 0;
    this.roll = 0;
    this.init = false;
    this._tmp = new THREE.Vector3();
  }

  snap(car, y) {
    this.dir = car.yaw;
    this.pos.set(car.x - Math.sin(car.yaw) * CAM.dist, y + CAM.height, car.z - Math.cos(car.yaw) * CAM.dist);
    this.look.set(car.x, y + CAM.lookUp, car.z);
    this.init = true;
  }

  kick(amount) { this.shake = Math.min(1, this.shake + amount); }

  /**
   * @param car the Car
   * @param y the road height under the car
   * @param groundAt (x, z) => terrain height, to keep the camera out of the hill
   * @param boost01 0..1 boost intensity
   */
  update(dt, car, y, groundAt, boost01, zoom = 1) {
    if (!this.init) this.snap(car, y);
    const speed = car.speed;
    const [fx, fz] = car.forward();
    const [lx, lz] = car.left();
    const vx = fx * car.vF + lx * car.vL, vz = fz * car.vF + lz * car.vL;
    const velDir = speed > 2 && car.vF > 0 ? Math.atan2(vx, vz) : car.yaw;   // reversing: stay behind the car
    const blend = CAM.yawBlend * smoothstep(2, 9, speed);
    const want = lerpAngle(car.yaw, velDir, blend);
    // the camera's own heading eases toward the target, faster at speed; on a spin it lags rather than whips
    this.dir = lerpAngle(this.dir, want, 1 - Math.exp(-(3.2 + speed * 0.08) * dt));

    // a portrait phone sees less width, so the camera stands further back to keep the road in frame
    const aspectK = this.cam.aspect < 1 ? 1 + 0.55 * (1 - this.cam.aspect) : 1;
    const dist = (CAM.dist + speed * 0.012 + boost01 * 0.4) * aspectK * zoom;
    const tx = car.x - Math.sin(this.dir) * dist;
    const tz = car.z - Math.cos(this.dir) * dist;
    let ty = y + CAM.height * Math.pow(zoom, 0.8) + boost01 * 0.15;
    const g = groundAt ? groundAt(tx, tz) : y;
    if (g + 1.3 > ty) ty = g + 1.3;

    const rate = CAM.followRate + speed * 0.06;
    this.pos.x = damp(this.pos.x, tx, rate, dt);
    this.pos.z = damp(this.pos.z, tz, rate, dt);
    this.pos.y = damp(this.pos.y, ty, rate * 0.8, dt);

    const lx2 = car.x + Math.sin(this.dir) * CAM.lookAhead, lz2 = car.z + Math.cos(this.dir) * CAM.lookAhead;
    this.look.x = damp(this.look.x, lx2, rate * 1.4, dt);
    this.look.z = damp(this.look.z, lz2, rate * 1.4, dt);
    this.look.y = damp(this.look.y, y + CAM.lookUp, rate, dt);

    // field of view widens with speed and boost
    const fovT = CAM.fov + CAM.fovSpeed * smoothstep(5, 45, speed) + CAM.fovBoost * boost01;
    this.fov = damp(this.fov, fovT, 4, dt);

    // shake decays; roll follows lateral g gently
    this.shake *= Math.exp(-6 * dt);
    this.roll = damp(this.roll, clamp(-car.accL * CAM.roll * 0.1, -0.05, 0.05), 5, dt);

    const c = this.cam;
    c.position.copy(this.pos);
    if (this.shake > 0.002) {
      c.position.x += (Math.random() - 0.5) * this.shake * 0.35;
      c.position.y += (Math.random() - 0.5) * this.shake * 0.25;
    }
    c.up.set(Math.sin(this.roll), Math.cos(this.roll), 0);
    c.lookAt(this.look);
    if (Math.abs(c.fov - this.fov) > 0.05) { c.fov = this.fov; c.updateProjectionMatrix(); }
  }
}
