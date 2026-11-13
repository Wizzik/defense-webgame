import { Throttle } from "./throttle";

const MASTER_VOLUME = 0.4;
const BURST_LIMIT = 4;
const BURST_WINDOW = 0.05;
const CASTLE_HIT_GAP = 0.5;
/** Pickup pitch rises by a semitone-ish step per quick pickup and falls back within this time. */
const PICKUP_CHAIN_SECONDS = 1;
const PICKUP_STEPS = 12;
const ARPEGGIO = [523.25, 659.25, 783.99, 1046.5];

/** Synthesized sound effects. Without a context (before the first click) every call is silent. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;
  private readonly throttle = new Throttle(BURST_LIMIT, BURST_WINDOW);
  private lastCastleHit = -Infinity;
  private pickupChain = 0;
  private lastPickup = -Infinity;

  /** Creates the context; call it from a user gesture. A Web Audio failure only warns. */
  enable(): void {
    if (this.ctx) {
      void this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : MASTER_VOLUME;
      master.connect(ctx.destination);
      const length = Math.floor(ctx.sampleRate * 0.3);
      const noise = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      this.ctx = ctx;
      this.master = master;
      this.noise = noise;
    } catch (error) {
      console.warn("audio unavailable", error);
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : MASTER_VOLUME;
  }

  hit(): void {
    this.play("hit", (at) => {
      this.tone(at, "square", 900, 500, 0.04, 0.25);
    });
  }

  cast(): void {
    this.play("cast", (at) => {
      this.tone(at, "sawtooth", 140, 50, 0.3, 0.5);
      this.burst(at, 0.3, 400, 0.3);
    });
  }

  death(): void {
    this.play("death", (at) => {
      this.tone(at, "sine", 500, 150, 0.08, 0.4);
    });
  }

  pickup(): void {
    this.play("pickup", (at, now) => {
      this.pickupChain = now - this.lastPickup < PICKUP_CHAIN_SECONDS ? Math.min(this.pickupChain + 1, PICKUP_STEPS) : 0;
      this.lastPickup = now;
      const base = 880 * Math.exp((this.pickupChain * Math.LN2) / 12);
      this.tone(at, "triangle", base, base * 1.5, 0.08, 0.3);
    });
  }

  /** A coin: a short high clink. */
  coin(): void {
    this.play("coin", (at) => {
      this.tone(at, "square", 1560, 2090, 0.05, 0.14);
    });
  }

  /** A chest opens: a low knock and a rising chime. */
  chest(): void {
    this.play("chest", (at) => {
      this.tone(at, "sine", 160, 90, 0.12, 0.5);
      this.tone(at + 0.08, "triangle", 660, 990, 0.2, 0.35);
    });
  }

  levelUp(): void {
    this.play("levelUp", (at) => {
      ARPEGGIO.forEach((freq, i) => this.tone(at + i * 0.08, "triangle", freq, freq, 0.12, 0.35));
    });
  }

  castleHit(): void {
    this.play("castleHit", (at, now) => {
      if (now - this.lastCastleHit < CASTLE_HIT_GAP) return;
      this.lastCastleHit = now;
      this.tone(at, "sine", 90, 40, 0.25, 0.7);
      this.burst(at, 0.15, 200, 0.4);
    });
  }

  /** A boss arrives: a deep tone. */
  bossArrive(): void {
    this.play("bossArrive", (at) => {
      this.tone(at, "sawtooth", 70, 45, 0.6, 0.6);
      this.tone(at, "sine", 140, 90, 0.6, 0.35);
    });
  }

  /** A slam lands: a thump. */
  slam(): void {
    this.play("slam", (at) => {
      this.tone(at, "sine", 110, 30, 0.3, 0.8);
      this.burst(at, 0.25, 300, 0.6);
    });
  }

  /** The final boss enrages: two tones. */
  enrage(): void {
    this.play("enrage", (at) => {
      this.tone(at, "square", 220, 220, 0.18, 0.4);
      this.tone(at + 0.2, "square", 165, 110, 0.4, 0.45);
    });
  }

  private play(key: string, make: (at: number, now: number) => void): void {
    const { ctx } = this;
    if (!ctx || this.muted) return;
    const now = ctx.currentTime;
    if (!this.throttle.allow(key, now)) return;
    try {
      make(now, now);
    } catch (error) {
      console.warn("sound failed", error);
    }
  }

  private envelope(at: number, seconds: number, peak: number): GainNode {
    const gain = this.ctx!.createGain();
    gain.gain.setValueAtTime(peak, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + seconds);
    gain.connect(this.master!);
    return gain;
  }

  private tone(at: number, type: OscillatorType, from: number, to: number, seconds: number, peak: number): void {
    const osc = this.ctx!.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), at + seconds);
    osc.connect(this.envelope(at, seconds, peak));
    osc.start(at);
    osc.stop(at + seconds);
  }

  private burst(at: number, seconds: number, cutoff: number, peak: number): void {
    const source = this.ctx!.createBufferSource();
    source.buffer = this.noise;
    const filter = this.ctx!.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    source.connect(filter);
    filter.connect(this.envelope(at, seconds, peak));
    source.start(at);
    source.stop(at + seconds);
  }
}
