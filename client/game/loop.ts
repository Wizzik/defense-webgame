/** Longest frame that counts; a longer one (a hidden tab) is cut to it. */
const MAX_FRAME_SECONDS = 0.25;
/** Absorbs float error so that 0.2 s is exactly 6 steps of 1/30 s. */
const EPSILON = 1e-9;

/** Turns frame times into a whole number of fixed simulation steps and an interpolation factor. */
export class FixedStepLoop {
  private readonly stepSeconds: number;
  private readonly maxStepsPerFrame: number;
  private accumulator = 0;

  constructor(stepSeconds: number, maxStepsPerFrame: number) {
    this.stepSeconds = stepSeconds;
    this.maxStepsPerFrame = maxStepsPerFrame;
  }

  /**
   * Adds min(frameSeconds, 0.25) * speed and returns how many steps to run now.
   * Above maxStepsPerFrame * speed it returns that cap and drops the rest.
   */
  advance(frameSeconds: number, speed: number): number {
    this.accumulator += Math.min(frameSeconds, MAX_FRAME_SECONDS) * speed;
    const steps = Math.floor(this.accumulator / this.stepSeconds + EPSILON);
    const cap = this.maxStepsPerFrame * speed;
    if (steps > cap) {
      this.accumulator = 0;
      return cap;
    }
    this.accumulator = Math.max(0, this.accumulator - steps * this.stepSeconds);
    return steps;
  }

  /** Remainder of the accumulator in steps, in [0, 1). */
  get alpha(): number {
    return Math.min(this.accumulator / this.stepSeconds, 1 - EPSILON);
  }
}
