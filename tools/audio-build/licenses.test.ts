import { describe, expect, it } from "vitest";
import { mergeModelRows } from "../assets-build/license-rows";
import { encodeArgs, licenseRows, mergeLicenseRows, mixArgs } from "./licenses";
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
    expect(joined).toContain("afade=t=out:st=92.000:d=1.500");
  });

  it("fades the end of a cut effect so it does not click", () => {
    const joined = encodeArgs({ ...sfx, trim: [0.2, 0.6] }, "in.wav", "out.ogg").join(" ");
    expect(joined).toContain("afade=t=out:st=0.280:d=0.120");
    expect(encodeArgs(sfx, "in.wav", "out.ogg").join(" ")).not.toContain("afade");
  });
});

describe("mixArgs", () => {
  const layered: AudioSource = {
    ...sfx,
    out: "sfx/moon-starfall-1",
    length: 1.9,
    space: "hall",
    layers: [
      { src: "pack/shimmer.wav", trim: [0, 1.3], highpass: 3000, gainDb: -14 },
      { src: "pack/bell.ogg", at: 0.1, rate: 2, reverse: true, tempo: 0.5 },
    ],
  };

  it("mixes every layer with its own treatment, adds the room and cuts the length", () => {
    const args = mixArgs(layered, ["a.wav", "b.ogg"], "out.ogg");
    const joined = args.join(" ");
    expect(joined).toContain("-ss 0 -to 1.3 -i a.wav -i b.ogg");
    const graph = args[args.indexOf("-filter_complex") + 1]!;
    expect(graph).toContain("[0:a]aformat=channel_layouts=mono,aresample=48000,afade=t=out:st=1.180:d=0.120,highpass=f=3000,volume=-14dB[l0]");
    expect(graph).toContain("[1:a]aformat=channel_layouts=mono,aresample=48000,areverse,asetrate=96000,aresample=48000,atempo=0.5,adelay=100[l1]");
    expect(graph).toContain("[l0][l1]amix=inputs=2:normalize=0:duration=longest,aecho=");
    expect(graph).toContain("atrim=0:1.9,afade=t=out:st=1.650:d=0.25");
    expect(graph).toContain("loudnorm=I=-16:TP=-1.5:LRA=11");
    expect(joined).toContain("-map [out]");
    expect(joined.endsWith("out.ogg")).toBe(true);
  });

  it("refuses a take without layers or with the wrong number of inputs", () => {
    expect(() => mixArgs(sfx, ["a.wav"], "out.ogg")).toThrow();
    expect(() => mixArgs(layered, ["a.wav"], "out.ogg")).toThrow();
  });

  it("marks a layered take as mixed in its license row", () => {
    expect(licenseRows([layered], () => "f")[0]).toContain("Someone; mixed, loudness normalized");
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
