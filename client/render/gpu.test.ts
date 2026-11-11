import { describe, expect, it } from "vitest";
import { describeGpu, isSoftwareRenderer } from "./gpu";

describe("isSoftwareRenderer", () => {
  it("knows the software renderers by name", () => {
    for (const name of [
      "Google SwiftShader",
      "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
      "llvmpipe (LLVM 15.0.7, 256 bits)",
      "Microsoft Basic Render Driver",
    ]) {
      expect(isSoftwareRenderer(name, false), name).toBe(true);
    }
  });

  it("a hardware GPU is not software", () => {
    expect(
      isSoftwareRenderer("ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 (0x00002F04) Direct3D11 vs_5_0 ps_5_0, D3D11)", false),
    ).toBe(false);
  });

  it("a fallback adapter is software whatever its name", () => {
    expect(isSoftwareRenderer("NVIDIA", true)).toBe(true);
  });
});

describe("describeGpu", () => {
  const adapter = (description: string, isFallbackAdapter = false) => ({
    device: { adapterInfo: { description, vendor: "nvidia", architecture: "blackwell", isFallbackAdapter } },
  });

  it("describeGpu with WebGPU adapter info", () => {
    expect(describeGpu(adapter(""), "WebGPU")).toEqual({ name: "nvidia blackwell", software: false });
    expect(describeGpu(adapter("SwiftShader Device"), "WebGPU")).toEqual({ name: "SwiftShader Device", software: true });
    expect(describeGpu(adapter("", true), "WebGPU")).toEqual({ name: "nvidia blackwell", software: true });
  });

  it("describeGpu with the WebGL2 renderer string", () => {
    const UNMASKED_RENDERER_WEBGL = 0x9246;
    const gl = {
      RENDERER: 0x1f01,
      getExtension: (name: string) => (name === "WEBGL_debug_renderer_info" ? { UNMASKED_RENDERER_WEBGL } : null),
      getParameter: (p: number) => (p === UNMASKED_RENDERER_WEBGL ? "Google SwiftShader" : "WebKit WebGL"),
    };
    expect(describeGpu({ gl }, "WebGL2")).toEqual({ name: "Google SwiftShader", software: true });
    const masked = { ...gl, getExtension: () => null };
    expect(describeGpu({ gl: masked }, "WebGL2")).toEqual({ name: "WebKit WebGL", software: false });
  });

  it("describeGpu without adapter info", () => {
    expect(describeGpu({}, "WebGPU")).toEqual({ name: "unknown", software: false });
    const gl = { getExtension: () => null, getParameter: () => undefined, RENDERER: 0x1f01 };
    expect(describeGpu({ gl }, "WebGL2")).toEqual({ name: "unknown", software: false });
    expect(describeGpu(null, "WebGL2")).toEqual({ name: "unknown", software: false });
  });

  it("a throwing backend gives unknown", () => {
    const gl = {
      getExtension: () => {
        throw new Error("lost context");
      },
    };
    expect(describeGpu({ gl }, "WebGL2")).toEqual({ name: "unknown", software: false });
  });
});
