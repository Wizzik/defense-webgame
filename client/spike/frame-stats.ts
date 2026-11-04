// Sorting needs a copy so the caller's ring buffer keeps its order; reused between calls.
let sorted = new Float32Array(0);

/**
 * Frame-rate statistics over the first `count` frame durations.
 * avgFps = 1000 / mean duration; low1Fps = 1000 / 99th percentile duration,
 * where the 99th percentile is the fastest of the slowest 1% of frames.
 */
export function frameStats(durationsMs: Float32Array, count: number): { avgFps: number; low1Fps: number } {
  if (sorted.length !== durationsMs.length) sorted = new Float32Array(durationsMs.length);
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
