import { NeutralToneMapping, WebGPURenderer } from "three/webgpu";

export type Backend = "WebGPU" | "WebGL2";

/** Neither WebGPU nor WebGL 2 is available. */
export class NoGpuError extends Error {
  constructor(options?: ErrorOptions) {
    super("neither WebGPU nor WebGL2 is available", options);
    this.name = "NoGpuError";
  }
}

export interface GpuInfo {
  name: string;
  /** The browser draws on the CPU (no graphics card in use). */
  software: boolean;
}

const UNKNOWN_GPU: GpuInfo = { name: "unknown", software: false };
const SOFTWARE_NAMES = /swiftshader|llvmpipe|softpipe|microsoft basic render/i;

export function isSoftwareRenderer(name: string, fallbackAdapter: boolean): boolean {
  return fallbackAdapter || SOFTWARE_NAMES.test(name);
}

type Loose = Record<string, unknown> | null | undefined;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Names the GPU behind `renderer.backend`: WebGPU reads `device.adapterInfo`, WebGL2 reads
 * UNMASKED_RENDERER_WEBGL (else RENDERER). A browser that hides it gives "unknown" and no warning.
 */
export function describeGpu(backend: unknown, kind: Backend): GpuInfo {
  try {
    let name = "";
    let fallback = false;
    if (kind === "WebGPU") {
      const info = ((backend as Loose)?.device as Loose)?.adapterInfo as Loose;
      name = text(info?.description) || [text(info?.vendor), text(info?.architecture)].filter(Boolean).join(" ");
      fallback = info?.isFallbackAdapter === true;
    } else {
      const gl = (backend as Loose)?.gl as
        | { RENDERER: number; getExtension(name: string): Loose; getParameter(p: number): unknown }
        | undefined;
      if (gl) {
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        name = text(gl.getParameter(ext ? (ext.UNMASKED_RENDERER_WEBGL as number) : gl.RENDERER));
      }
    }
    if (name === "") return UNKNOWN_GPU;
    return { name, software: isSoftwareRenderer(name, fallback) };
  } catch {
    return UNKNOWN_GPU;
  }
}

/** Creates the renderer, appends its canvas to `parent` and reports the backend that was chosen. */
export async function createRenderer(
  kind: "webgpu" | "webgl2",
  parent: HTMLElement,
): Promise<{ renderer: WebGPURenderer; backend: Backend }> {
  const renderer = new WebGPURenderer({ forceWebGL: kind === "webgl2" });
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1;
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
