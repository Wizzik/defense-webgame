import { botCard } from "./bot";
import { chooseCard, openOffer } from "./cards";
import { TICKS_PER_SECOND } from "./constants";
import { gainXp } from "./level-up";
import type { Run } from "./run";

/**
 * Debug start (`?phase=N`): moves a fresh run to the start of phase N; `phases.length + 1` is the finale.
 * Timed events before that time are skipped. The hero gets `rules.debug.phaseXp` of the phase and spends
 * every level-up by the autopilot's card rule. Allocates (offers), so it runs only when the run is created.
 */
export function applyStartPhase(run: Run, phase: number): void {
  const { rules } = run.data;
  const count = rules.phases.length;
  if (!Number.isInteger(phase) || phase < 1 || phase > count + 1) {
    throw new Error(`createRun: startPhase must be a whole number from 1 to ${count + 1}, got ${phase}`);
  }
  if (phase === 1) return;
  run.tick = phase > count ? run.durationTicks : Math.round((phase - 1) * rules.run.phaseSeconds * TICKS_PER_SECOND);
  while (run.nextEvent < run.timeline.length && run.timeline[run.nextEvent].tick < run.tick) run.nextEvent++;
  run.nextPackTick = run.tick + Math.round(rules.run.firstPackSeconds * TICKS_PER_SECOND);
  gainXp(run, rules.debug.phaseXp[Math.min(phase, count) - 1]);
  if (run.hero.pendingLevelUps > 0) {
    openOffer(run);
    while (run.offer) chooseCard(run, botCard(run.offer));
  }
  run.events.clear();
}
