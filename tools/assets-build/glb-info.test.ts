import { describe, expect, it } from "vitest";
import { readGlbInfo } from "./glb-info";

describe("readGlbInfo", () => {
  it("reads the robot model", () => {
    const info = readGlbInfo("assets/models/robot-expressive/RobotExpressive.glb");
    expect(info.triangles).toBe(3237);
    expect(info.clips).toEqual(expect.arrayContaining(["Walking", "Punch", "Idle", "Running", "Death"]));
    expect(info.hasTexture).toBe(false);
  });
});
