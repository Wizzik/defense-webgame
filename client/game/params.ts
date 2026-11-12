export interface GameParams {
  seed: number;
  speed: number;
  debug: boolean;
  durationSeconds?: number;
  renderer: "webgpu" | "webgl2";
  fps: boolean;
  /** ?shadows=0 switches the shadow map off. */
  shadows: boolean;
  lang?: "en" | "cs";
  /** ?hero=<id>; the caller checks it against the data. */
  hero?: string;
  /** ?phase=N, only with debug=1: start at phase N (1 to 21, the last is the finale). The session checks it against the data. */
  startPhase?: number;
}

/** 20 phases and the finale. */
const MAX_START_PHASE = 21;

function readInt(value: string | null): number | undefined {
  if (value === null || !/^-?\d+$/.test(value.trim())) return undefined;
  return Number.parseInt(value, 10);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** seed: ?seed or randomSeed(); speed 1..16 (default 1); duration 5..1200; phase 1..21 only with debug; debug and fps only "1"; shadows on unless "0". */
export function readGameParams(search: string, randomSeed: () => number): GameParams {
  const params = new URLSearchParams(search);
  const speed = readInt(params.get("speed"));
  const duration = readInt(params.get("duration"));
  const lang = params.get("lang");
  const hero = params.get("hero")?.trim();
  const debug = params.get("debug") === "1";
  const phase = readInt(params.get("phase"));
  return {
    seed: readInt(params.get("seed")) ?? randomSeed(),
    speed: speed === undefined ? 1 : clamp(speed, 1, 16),
    debug,
    durationSeconds: duration === undefined ? undefined : clamp(duration, 5, 1200),
    renderer: params.get("renderer") === "webgl2" ? "webgl2" : "webgpu",
    fps: params.get("fps") === "1",
    shadows: params.get("shadows") !== "0",
    lang: lang === "en" || lang === "cs" ? lang : undefined,
    hero: hero ? hero : undefined,
    startPhase: debug && phase !== undefined && phase >= 1 && phase <= MAX_START_PHASE ? phase : undefined,
  };
}
