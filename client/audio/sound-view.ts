import { EventKind, type Run, SlamEvent } from "../../sim";
import type { RunView } from "../game/session";
import type { Sfx } from "./sfx";

/** Turns simulation events into sounds. Draws nothing. */
export class SoundView implements RunView {
  private readonly sfx: Sfx;

  constructor(sfx: Sfx) {
    this.sfx = sfx;
  }

  update(): void {}

  onEvents(run: Run): void {
    const { events } = run;
    for (let i = 0; i < events.count; i++) {
      switch (events.kind[i]) {
        case EventKind.Hit:
          if (events.u[i] === 0) this.sfx.hit();
          break;
        case EventKind.Death:
          this.sfx.death();
          break;
        case EventKind.Cast:
          if (run.abilities[events.a[i]!]!.def.kind === "on_hit") this.sfx.hit();
          else this.sfx.cast();
          break;
        case EventKind.Blast:
          this.sfx.hit();
          break;
        case EventKind.Heal:
          this.sfx.pickup();
          break;
        case EventKind.Dash:
          this.sfx.cast();
          break;
        case EventKind.CastleHit:
          this.sfx.castleHit();
          break;
        case EventKind.Pickup:
          this.sfx.pickup();
          break;
        case EventKind.LevelUp:
          this.sfx.levelUp();
          break;
        case EventKind.BossSpawn:
          this.sfx.bossArrive();
          break;
        case EventKind.Slam:
          if (events.value[i] === SlamEvent.Hit) this.sfx.slam();
          break;
        case EventKind.Enrage:
          this.sfx.enrage();
          break;
      }
    }
  }

  dispose(): void {}
}
