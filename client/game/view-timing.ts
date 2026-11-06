/** Interpolation factor and animation time the views get for a frame. */
export interface ViewTiming {
  alpha: number;
  dt: number;
}

/**
 * While the run is not "playing" (card choice, end screen) the scene is frozen: draw the last step
 * exactly (`alpha` 1) and advance no animation (`dt` 0).
 */
export function viewTiming(state: string, loopAlpha: number, frameSeconds: number): ViewTiming {
  return state === "playing" ? { alpha: loopAlpha, dt: frameSeconds } : { alpha: 1, dt: 0 };
}
