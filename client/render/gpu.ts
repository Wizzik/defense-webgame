import { WebGPURenderer } from "three/webgpu";

export type Backend = "WebGPU" | "WebGL2";

/** Neither WebGPU nor WebGL 2 is available. */
export class NoGpuError extends Error {
  constructor(options?: ErrorOptions) {
    super("neither WebGPU nor WebGL2 is available", options);
    this.name = "NoGpuError";
  }
}

/** Creates the renderer, appends its canvas to `parent` and reports the backend that was chosen. */
export async function createRenderer(
  kind: "webgpu" | "webgl2",
  parent: HTMLElement,
): Promise<{ renderer: WebGPURenderer; backend: Backend }> {
  const renderer = new WebGPURenderer({ forceWebGL: kind === "webgl2" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  parent.prepend(renderer.domElement);
  try {
    await renderer.init();
  } catch (error) {
    renderer.domElement.remove();
    throw new NoGpuError({ cause: error });
  }
  // `Backend` does not declare the flag; WebGPUBackend sets it to true
  const backend: Backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? "WebGPU" : "WebGL2";
  return { renderer, backend };
}
