const ON_BELOW = 0.25;
const OFF_ABOVE = 0.3;
const BEAT_SECONDS = 0.9;

/** A heartbeat while the hero is low: on under 25 % hp, off over 30 %, a beat every 0.9 s, only while playing. */
export class LowHpPulse {
  private on = false;
  private nextBeat = 0;

  /** True when a beat should sound now. */
  update(hp: number, maxHp: number, playing: boolean, now: number): boolean {
    const share = maxHp > 0 ? hp / maxHp : 1;
    if (!playing || hp <= 0) this.on = false;
    else if (!this.on && share < ON_BELOW) {
      this.on = true;
      this.nextBeat = now;
    } else if (this.on && share > OFF_ABOVE) this.on = false;
    if (!this.on || now + 1e-9 < this.nextBeat) return false;
    this.nextBeat = now + BEAT_SECONDS;
    return true;
  }
}
