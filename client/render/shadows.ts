import { type DirectionalLight, PCFShadowMap, Vector3, type WebGPURenderer } from "three/webgpu";

/** Half the side of the orthographic shadow box, in scene units, and the shadow map resolution. */
const BOX_HALF = 34;
const MAP_SIZE = 2048;

/** Shadow maps are off with `?shadows=0` and on software rendering (too slow there). */
export function shadowsEnabled(param: boolean, softwareGpu: boolean): boolean {
  return param && !softwareGpu;
}

/** `value` moved to the nearest shadow texel; `boxSize` is the side of the shadow box covered by `mapSize` texels. */
export function snapToTexel(value: number, boxSize: number, mapSize: number): number {
  const texel = boxSize / mapSize;
  return Math.round(value / texel) * texel;
}

/**
 * The moon's shadow map: an orthographic box around the camera target that moves in whole texels, so
 * shadow edges do not swim. With `enabled` false nothing is switched on and `follow` does nothing.
 */
export class SunShadow {
  private readonly offset: Vector3;
  private readonly right = new Vector3();
  private readonly up = new Vector3();
  private readonly forward = new Vector3();
  private readonly centre = new Vector3();

  constructor(
    private readonly sun: DirectionalLight,
    renderer: WebGPURenderer,
    readonly enabled: boolean,
  ) {
    // the light keeps its direction: it sits at the same offset from its target wherever the box goes
    this.offset = sun.position.clone().sub(sun.target.position);
    if (!enabled) return;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap; // WebGPURenderer has no PCFSoftShadowMap (three 0.187)
    sun.castShadow = true;
    const { shadow } = sun;
    shadow.mapSize.set(MAP_SIZE, MAP_SIZE);
    const camera = shadow.camera;
    camera.left = -BOX_HALF;
    camera.right = BOX_HALF;
    camera.bottom = -BOX_HALF;
    camera.top = BOX_HALF;
    camera.near = 1;
    camera.far = this.offset.length() + 2 * BOX_HALF;
    camera.updateProjectionMatrix();
    shadow.radius = 2; // PCF taps spread 2 shadow texels (about 0.07 units): a soft edge without visible banding
    shadow.bias = -0.0005;
    shadow.normalBias = 0.03;
    // the axes of the light's view, fixed because its direction is
    this.forward.copy(this.offset).normalize();
    this.right.set(0, 1, 0).cross(this.forward).normalize();
    this.up.crossVectors(this.forward, this.right);
  }

  /** Centres the box on a point of the floor (the camera target), in whole texels of the light's view. */
  follow(sceneX: number, sceneZ: number): void {
    if (!this.enabled) return;
    const { centre, right, up, forward } = this;
    centre.set(sceneX, 0, sceneZ);
    const across = snapToTexel(centre.dot(right), 2 * BOX_HALF, MAP_SIZE);
    const high = snapToTexel(centre.dot(up), 2 * BOX_HALF, MAP_SIZE);
    const depth = centre.dot(forward);
    centre.set(0, 0, 0).addScaledVector(right, across).addScaledVector(up, high).addScaledVector(forward, depth);
    this.sun.target.position.copy(centre);
    this.sun.position.copy(centre).add(this.offset);
    this.sun.target.updateMatrixWorld();
  }
}
