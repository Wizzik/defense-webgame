const MAX_PAN = 0.7;
const OFF_SCREEN_GAIN = 0.6;

/** Stereo pan and gain for a sound at a screen position in normalized device coordinates. */
export function panFromNdc(ndcX: number, ndcY: number): { pan: number; gain: number } {
  const pan = Math.max(-MAX_PAN, Math.min(MAX_PAN, ndcX * MAX_PAN));
  const off = Math.abs(ndcX) > 1 || Math.abs(ndcY) > 1;
  return { pan: Math.round(pan * 1e6) / 1e6, gain: off ? OFF_SCREEN_GAIN : 1 };
}
