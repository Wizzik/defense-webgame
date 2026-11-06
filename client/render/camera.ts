import { PerspectiveCamera } from "three/webgpu";

/** Camera pitch below the horizon. */
const TILT_DEG = 55;
const FOV_DEG = 35;
/** Distance from the camera to the point it looks at, in scene units. */
const DISTANCE = 38;
/** How fast the camera closes the gap to the hero, per second (exponential smoothing). */
const FOLLOW_RATE = 8;

const TILT = (TILT_DEG * Math.PI) / 180;
const OFFSET_Y = Math.sin(TILT) * DISTANCE;
const OFFSET_Z = Math.cos(TILT) * DISTANCE;

/** Tilted camera that follows a point on the floor smoothly. */
export class FollowCamera {
  readonly camera: PerspectiveCamera;
  private x = 0;
  private z = 0;
  private placed = false;

  constructor(aspect: number) {
    this.camera = new PerspectiveCamera(FOV_DEG, aspect, 1, 500);
    this.place();
  }

  follow(sceneX: number, sceneZ: number, dt: number): void {
    if (!this.placed) {
      this.x = sceneX;
      this.z = sceneZ;
      this.placed = true;
    } else {
      const k = 1 - Math.exp(-FOLLOW_RATE * dt);
      this.x += (sceneX - this.x) * k;
      this.z += (sceneZ - this.z) * k;
    }
    this.place();
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  private place(): void {
    this.camera.position.set(this.x, OFFSET_Y, this.z + OFFSET_Z);
    this.camera.lookAt(this.x, 0, this.z);
  }
}
