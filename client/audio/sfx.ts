import type { SynthName } from "../../data/schema/audio";

const CASTLE_HIT_GAP = 0.5;
/** Pickup pitch rises by a semitone-ish step per quick pickup and falls back within this time. */
const PICKUP_CHAIN_SECONDS = 1;
const PICKUP_STEPS = 12;
const ARPEGGIO = [523.25, 659.25, 783.99, 1046.5];

/** Synthesized sound effects: the fallback of a cue whose recorded files did not load. */
export class Sfx {
  private readonly ctx: AudioContext;
  private readonly noise: AudioBuffer;
  private out: AudioNode;
  private lastCastleHit = -Infinity;
  private pickupChain = 0;
  private lastPickup = -Infinity;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.out = ctx.destination;
    const length = Math.floor(ctx.sampleRate * 0.3);
    const noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = noise;
  }

  /** Plays the named tone at `at` into `out`. */
  synth(name: SynthName, at: number, out: AudioNode): void {
    this.out = out;
    try {
    this[name](at);
    } catch (error) {
    console.warn("sound failed", error);
    }
  }

  private hit(at: number): void {
    this.tone(at, "square", 900, 500, 0.04, 0.25);
  }

  private cast(at: number): void {
    this.tone(at, "sawtooth", 140, 50, 0.3, 0.5);
    this.burst(at, 0.3, 400, 0.3);
  }

  private death(at: number): void {
    this.tone(at, "sine", 500, 150, 0.08, 0.4);
  }

  private pickup(at: number): void {
    this.pickupChain = at - this.lastPickup < PICKUP_CHAIN_SECONDS ? Math.min(this.pickupChain + 1, PICKUP_STEPS) : 0;
    this.lastPickup = at;
    const base = 880 * Math.exp((this.pickupChain * Math.LN2) / 12);
    this.tone(at, "triangle", base, base * 1.5, 0.08, 0.3);
  }

  /** A coin: a short high clink. */
  private coin(at: number): void {
    this.tone(at, "square", 1560, 2090, 0.05, 0.14);
  }

  /** A heart: a soft warm two-note rise. */
  private heart(at: number): void {
    this.tone(at, "sine", 440, 520, 0.08, 0.3);
    this.tone(at + 0.06, "sine", 660, 780, 0.1, 0.25);
  }

  /** An orb: a bright shimmering swell. */
  private orb(at: number): void {
    this.tone(at, "triangle", 520, 1040, 0.25, 0.35);
    this.tone(at + 0.05, "sine", 780, 1560, 0.3, 0.25);
  }

  /** A chest opens: a low knock and a rising chime. */
  private chest(at: number): void {
    this.tone(at, "sine", 160, 90, 0.12, 0.5);
    this.tone(at + 0.08, "triangle", 660, 990, 0.2, 0.35);
  }

  private levelUp(at: number): void {
    ARPEGGIO.forEach((freq, i) => this.tone(at + i * 0.08, "triangle", freq, freq, 0.12, 0.35));
  }

  private castleHit(at: number): void {
    if (at - this.lastCastleHit < CASTLE_HIT_GAP) return;
    this.lastCastleHit = at;
    this.tone(at, "sine", 90, 40, 0.25, 0.7);
    this.burst(at, 0.15, 200, 0.4);
  }

  /** A boss arrives: a deep tone. */
  private bossArrive(at: number): void {
    this.tone(at, "sawtooth", 70, 45, 0.6, 0.6);
    this.tone(at, "sine", 140, 90, 0.6, 0.35);
  }

  /** A slam lands: a thump. */
  private slam(at: number): void {
    this.tone(at, "sine", 110, 30, 0.3, 0.8);
    this.burst(at, 0.25, 300, 0.6);
  }

  /** The final boss enrages: two tones. */
  private enrage(at: number): void {
    this.tone(at, "square", 220, 220, 0.18, 0.4);
    this.tone(at + 0.2, "square", 165, 110, 0.4, 0.45);
  }

  private envelope(at: number, seconds: number, peak: number): GainNode {
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(peak, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + seconds);
    gain.connect(this.out);
    return gain;
  }

  private tone(at: number, type: OscillatorType, from: number, to: number, seconds: number, peak: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), at + seconds);
    osc.connect(this.envelope(at, seconds, peak));
    osc.start(at);
    osc.stop(at + seconds);
  }

  private burst(at: number, seconds: number, cutoff: number, peak: number): void {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    source.connect(filter);
    filter.connect(this.envelope(at, seconds, peak));
    source.start(at);
    source.stop(at + seconds);
  }
}
