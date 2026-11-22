import { Color, DirectionalLight, Fog, Group, HemisphereLight, type Scene } from "three/webgpu";
import type { WorldLook } from "./world-look";

export interface Lighting {
  readonly object: Group;
  /** The moon: the only light that casts shadows (see `SunShadow`). */
  readonly sun: DirectionalLight;
  readonly hemi: HemisphereLight;
  /** Sets the world's sky colour, fog and the colours and strengths of the moon and the sky light. */
  applyLook(scene: Scene, look: WorldLook): void;
}

export function createLighting(): Lighting {
  const object = new Group();
  const sun = new DirectionalLight(0xffffff, 1);
  sun.position.set(30, 60, 20);
  const hemi = new HemisphereLight(0xffffff, 0x000000, 1);
  object.add(sun, sun.target, hemi);
  return {
    object,
    sun,
    hemi,
    applyLook(scene, look) {
      scene.background = new Color(look.sky);
      scene.fog = new Fog(look.sky, look.fog.near, look.fog.far);
      sun.color.setHex(look.moon.color);
      sun.intensity = look.moon.intensity;
      hemi.color.setHex(look.hemi.sky);
      hemi.groundColor.setHex(look.hemi.ground);
      hemi.intensity = look.hemi.intensity;
    },
  };
}
