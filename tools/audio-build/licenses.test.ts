import { describe, expect, it } from "vitest";
import { mergeModelRows } from "../assets-build/license-rows";
import { encodeArgs, licenseRows, mergeLicenseRows } from "./licenses";
import type { AudioSource } from "./manifest";

const sfx: AudioSource = {
  out: "sfx/stone-hit-1", src: "pack/hit.wav", kind: "sfx", author: "Someone", license: "CC0 1.0",
  url: "https://example.org/pack", downloaded: "2026-11-20",
};
const music: AudioSource = { ...sfx, out: "music/run-a", src: "pack/run.mp3", kind: "music", trim: [2, 95.5], gainDb: -1 };

const TABLE = [
  "# Asset licenses",
  "",
  "| Asset | Author | License | Source URL | Downloaded | sha256 |",
  "|---|---|---|---|---|---|",
  "| RobotExpressive (`models/robot-expressive/RobotExpressive.glb`) | T | CC0 1.0 | u | 2026-11-04 | `aa` |",
  "| heroes/stonehorn (`models/heroes/stonehorn.glb`) | K | CC0 1.0 | u | 2026-11-11 | `bb` |",
  "| sfx/old (`audio/sfx/old.ogg`) | X | CC0 1.0 | u | 2026-11-19 | `cc` |",
  "",
].join("\n");

describe("encodeArgs", () => {
  it("trims silence, normalizes loudness and encodes mono opus at 64k for effects", () => {
    const args = encodeArgs(sfx, "in.wav", "out.ogg").join(" ");
    expect(args).toContain("silenceremove");
    expect(args).toContain("loudnorm=I=-16:TP=-1.5:LRA=11");
    expect(args).toContain("-ac 1 -c:a libopus -b:a 64k");
    expect(args.endsWith("out.ogg")).toBe(true);
    expect(args).toContain("-i in.wav");
  });

  it("keeps music stereo at 96k without trimming silence, with the cut and the gain", () => {
    const args = encodeArgs(music, "in.mp3", "out.ogg");
    const joined = args.join(" ");
    expect(joined).not.toContain("silenceremove");
    expect(joined).toContain("loudnorm=I=-18:TP=-1.5:LRA=11");
    expect(joined).toContain("volume=-1dB");
    expect(joined).toContain("-ac 2 -c:a libopus -b:a 96k");
    expect(joined).toContain("-ss 2 -to 95.5");
  });
});

describe("license rows", () => {
  it("writes a row per source with the sha of the encoded file", () => {
    expect(licenseRows([sfx], () => "f".repeat(64))).toEqual([
      `| sfx/stone-hit-1 (\`audio/sfx/stone-hit-1.ogg\`) | Someone; trimmed, loudness normalized, encoded to Opus | CC0 1.0 | https://example.org/pack | 2026-11-20 | \`${"f".repeat(64)}\` |`,
    ]);
  });

  it("replaces the audio rows and keeps the models and the robot", () => {
    const merged = mergeLicenseRows(TABLE, ["| sfx/new (`audio/sfx/new.ogg`) | Y | CC0 1.0 | u | 2026-11-20 | `dd` |"]);
    expect(merged).toContain("RobotExpressive");
    expect(merged).toContain("models/heroes/stonehorn.glb");
    expect(merged).not.toContain("audio/sfx/old.ogg");
    expect(merged).toContain("audio/sfx/new.ogg");
    expect(merged.endsWith("|\n")).toBe(true);
  });

  it("assets:build keeps the audio rows when it rewrites the model rows", () => {
    const merged = mergeModelRows(TABLE, ["| heroes/x (`models/heroes/x.glb`) | K | CC0 1.0 | u | 2026-11-20 | `ee` |"]);
    expect(merged).toContain("audio/sfx/old.ogg");
    expect(merged).not.toContain("models/heroes/stonehorn.glb");
    expect(merged).toContain("RobotExpressive");
  });
});
