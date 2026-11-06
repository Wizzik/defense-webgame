export interface GameParams {
  seed: number;
  speed: number;
  debug: boolean;
  durationSeconds?: number;
  renderer: "webgpu" | "webgl2";
  fps: boolean;
  lang?: "en" | "cs";
}

function readInt(value: string | null): number | undefined {
  if (value === null || !/^-?\d+$/.test(value.trim())) return undefined;
  return Number.parseInt(value, 10);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** seed: ?seed or randomSeed(); speed 1..16 (default 1); duration 5..600; debug and fps only "1". */
export function readGameParams(search: string, randomSeed: () => number): GameParams {
  const params = new URLSearchParams(search);
  const speed = readInt(params.get("speed"));
  const duration = readInt(params.get("duration"));
  const lang = params.get("lang");
  return {
    seed: readInt(params.get("seed")) ?? randomSeed(),
    speed: speed === undefined ? 1 : clamp(speed, 1, 16),
    debug: params.get("debug") === "1",
    durationSeconds: duration === undefined ? undefined : clamp(duration, 5, 600),
    renderer: params.get("renderer") === "webgl2" ? "webgl2" : "webgpu",
    fps: params.get("fps") === "1",
    lang: lang === "en" || lang === "cs" ? lang : undefined,
  };
}
