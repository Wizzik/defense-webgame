import { PerspectiveCamera } from "three/webgpu";

/** Camera pitch below the horizon. */
const TILT_DEG = 55;
const FOV_DEG = 35;
/** Distance from the camera to the point it looks at, in scene units. */
const DISTANCE = 46;
/** How fast the camera closes the gap to the hero, per second (exponential smoothing). */
const FOLLOW_RATE = 8;

/** Seconds a shake takes to fade out. */
const SHAKE_SECONDS = 0.2;

const TILT = (TILT_DEG * Math.PI) / 180;
const OFFSET_Y = Math.sin(TILT) * DISTANCE;
const OFFSET_Z = Math.cos(TILT) * DISTANCE;

/** Tilted camera that follows a point on the floor smoothly. */
export class FollowCamera {
  readonly camera: PerspectiveCamera;
  private x = 0;
  private z = 0;
  private placed = false;
  private shakeAmount = 0;
  private shakeLeft = 0;

  constructor(aspect: number) {
    this.camera = new PerspectiveCamera(FOV_DEG, aspect, 1, 500);
    this.place();
  }

  /** `animDt` drives the shake; the session passes 0 while the scene is frozen. */
  follow(sceneX: number, sceneZ: number, dt: number, animDt = dt): void {
    if (!this.placed) {
      this.x = sceneX;
      this.z = sceneZ;
      this.placed = true;
    } else {
      const k = 1 - Math.exp(-FOLLOW_RATE * dt);
      this.x += (sceneX - this.x) * k;
      this.z += (sceneZ - this.z) * k;
    }
    this.place(animDt);
  }

  /** Shakes the camera by up to `amount` scene units, fading out in 0.2 s; a stronger shake wins. */
  shake(amount: number): void {
    const current = this.shakeAmount * (this.shakeLeft / SHAKE_SECONDS);
    if (amount < current) return;
    this.shakeAmount = amount;
    this.shakeLeft = SHAKE_SECONDS;
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** `dt` 0 means the scene is frozen (card choice, end screen): no shake and no fading then. */
  private place(dt = 0): void {
    let ox = 0;
    let oy = 0;
    let oz = 0;
    if (dt > 0 && this.shakeLeft > 0) {
      const k = (this.shakeAmount * this.shakeLeft) / SHAKE_SECONDS;
      ox = (Math.random() * 2 - 1) * k;
      oy = (Math.random() * 2 - 1) * k;
      oz = (Math.random() * 2 - 1) * k;
      this.shakeLeft = Math.max(0, this.shakeLeft - dt);
    }
    this.camera.position.set(this.x + ox, OFFSET_Y + oy, this.z + OFFSET_Z + oz);
    this.camera.lookAt(this.x + ox, 0, this.z + oz);
  }
}
