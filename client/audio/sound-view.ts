import { EventKind, type Run, SlamEvent } from "../../sim";
import type { RunView } from "../game/session";
import type { AudioData } from "../../data/schema/audio";
import type { AudioEngine } from "./engine";

/** Turns simulation events into sounds. Draws nothing. */
export class SoundView implements RunView {
  private readonly engine: AudioEngine;
  private readonly sounds: AudioData["sounds"];

  constructor(engine: AudioEngine, data: AudioData) {
    this.engine = engine;
    this.sounds = data.sounds;
  }

  private sound(name: keyof AudioData["sounds"]): void {
    this.engine.play(this.sounds[name]);
  }

  update(): void {}

  onEvents(run: Run): void {
    const { events } = run;
    for (let i = 0; i < events.count; i++) {
      switch (events.kind[i]) {
        case EventKind.Hit:
          if (events.u[i] === 0) this.engine.play("stone-strike");
          break;
        case EventKind.Death:
          this.engine.play("bone-rattle");
          break;
        case EventKind.Cast:
          if (run.abilities[events.a[i]!]!.def.kind === "on_hit") this.engine.play("stone-strike");
          else this.engine.play("stone-rupture");
          break;
        case EventKind.Blast:
          this.engine.play("stone-strike");
          break;
        case EventKind.Heal:
          this.sound("pickup.xp");
          break;
        case EventKind.Dash:
          this.engine.play("stone-rupture");
          break;
        case EventKind.CastleHit:
          this.sound("castleHit");
          break;
        case EventKind.Pickup:
          if (events.u[i] === 1) this.sound("pickup.coin");
          else if (events.u[i] === 2) this.sound("pickup.heart");
          else this.sound("pickup.xp");
          break;
        case EventKind.OrbPickup:
          this.sound("orb.boots");
          break;
        case EventKind.ChestOpen:
          this.sound("chest.open");
          break;
        case EventKind.LevelUp:
          this.sound("levelUp");
          break;
        case EventKind.BossSpawn:
          this.sound("bossArrive");
          break;
        case EventKind.Slam:
          if (events.value[i] === SlamEvent.Hit) this.sound("slam.hit");
          break;
        case EventKind.Enrage:
          this.sound("enrage");
          break;
      }
    }
  }

  dispose(): void {}
}
