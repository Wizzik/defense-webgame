/**
 * Frame-rate statistics over the first `count` frame durations.
 * avgFps = 1000 / mean duration; low1Fps = 1000 / 99th percentile duration,
 * where the 99th percentile is the fastest of the slowest 1% of frames.
 * `sorted` is the caller's scratch array of the same length as `durationsMs` (sorting needs a
 * copy so the ring buffer keeps its order); passing it keeps this function free of module state.
 */
export function frameStats(
  durationsMs: Float32Array,
  count: number,
  sorted: Float32Array,
): { avgFps: number; low1Fps: number } {
  let sum = 0;
  for (let i = 0; i < count; i++) {
    sum += durationsMs[i];
    sorted[i] = durationsMs[i];
  }
  // unused slots sort below every real duration, so the valid ones end up at the top
  sorted.fill(-Infinity, count);
  sorted.sort();
  const p99 = sorted[sorted.length - Math.ceil(count / 100)];
  return { avgFps: 1000 / (sum / count), low1Fps: 1000 / p99 };
}
