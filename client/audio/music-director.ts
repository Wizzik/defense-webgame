import type { Run } from "../../sim";

export type MusicSlot = "menu" | "run" | "miniboss" | "final" | "victory" | "defeat";

export interface MusicInput {
  menuOpen: boolean;
  state: Run["state"];
  bossAlive: boolean;
  finale: boolean;
  /** A panel stands the run in place (the gear panel or the settings). */
  panelOpen: boolean;
}

export interface Duck {
  gain: number;
  lowpass: boolean;
}

const STANDING_GAIN = 0.35;
const ALERT_GAIN = 0.5;
const ALERT_SECONDS = 2.5;

/** The music for a state: menu, then the end of a run, then the final boss, a boss, the run. */
/**
 * Whether a track loops on its element: the end jingles never; run tracks only when the run has one track
 * (several run tracks play one after another); the rest as the track says.
 */
export function loopsInSlot(slot: MusicSlot, trackLoops: boolean, runTracks: number): boolean {
  if (slot === "victory" || slot === "defeat") return false;
  if (slot === "run") return runTracks === 1 && trackLoops;
  return trackLoops;
}

export function musicSlot(input: MusicInput): MusicSlot {
  if (input.menuOpen) return "menu";
  if (input.state === "won") return "victory";
  if (input.state === "lost") return "defeat";
  if (input.bossAlive) return input.finale ? "final" : "miniboss";
  return "run";
}

/** Decides how much the music gives way: while the game stands, and for a moment after an alert horn. */
export class MusicDirector {
  private alertAt = -Infinity;

  onAlert(now: number): void {
    this.alertAt = now;
  }

  duck(input: MusicInput, now: number): Duck {
    if (input.menuOpen) return { gain: 1, lowpass: false };
    if (input.state === "levelUp" || input.state === "chest" || input.panelOpen) return { gain: STANDING_GAIN, lowpass: true };
    if (now - this.alertAt < ALERT_SECONDS) return { gain: ALERT_GAIN, lowpass: false };
    return { gain: 1, lowpass: false };
  }
}
