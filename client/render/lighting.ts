import { Color, DirectionalLight, Fog, Group, HemisphereLight, type Scene } from "three/webgpu";
import { HEMI_GROUND, HEMI_SKY, MOON, SKY } from "./palette";

const HEMI_INTENSITY = 1.1;
const MOON_INTENSITY = 2.2;
const FOG_NEAR = 58;
const FOG_FAR = 105;

export interface Lighting {
  readonly object: Group;
  /** The moon: the only light that will cast shadows. */
  readonly sun: DirectionalLight;
  /** Sets the dusk background and fog of `scene`. */
  applyTo(scene: Scene): void;
}

export function createLighting(): Lighting {
  const object = new Group();
  const sun = new DirectionalLight(MOON, MOON_INTENSITY);
  sun.position.set(30, 60, 20);
  object.add(sun, new HemisphereLight(HEMI_SKY, HEMI_GROUND, HEMI_INTENSITY));
  return {
    object,
    sun,
    applyTo(scene) {
      scene.background = new Color(SKY);
      scene.fog = new Fog(SKY, FOG_NEAR, FOG_FAR);
    },
  };
}
