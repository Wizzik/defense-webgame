import type { AudioData, Track } from "../../data/schema/audio";
import type { AudioEngine } from "./engine";
import type { Duck, MusicSlot } from "./music-director";

const FADE_SECONDS = 1.5;
/** setTargetAtTime reaches ~95 % after three time constants. */
const FADE_TAU = FADE_SECONDS / 3;
const LOWPASS_HZ = 900;
const OPEN_HZ = 20000;

interface Channel {
  element: HTMLAudioElement;
  fade: GainNode;
}

/**
 * Streams the music through two <audio> elements wired into Web Audio and crossfades between them.
 * Run tracks play one after another; the end jingles play once; the rest loop. Before the engine is enabled it does nothing.
 */
export class MusicPlayer {
  private readonly engine: AudioEngine;
  private readonly data: AudioData;
  private readonly baseUrl: string;
  private readonly tracks = new Map<string, Track>();
  private channels: [Channel, Channel] | null = null;
  private duckGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private active = 0;
  private slot: MusicSlot | null = null;
  private runIndex = 0;
  private lastDuck: Duck | null = null;

  constructor(engine: AudioEngine, data: AudioData, baseUrl: string) {
    this.engine = engine;
    this.data = data;
    this.baseUrl = baseUrl;
    for (const t of data.tracks) this.tracks.set(t.id, t);
  }

  set(slot: MusicSlot): void {
    if (slot === this.slot || !this.data.music || !this.wire()) return;
    this.slot = slot;
    if (slot === "run") this.runIndex = 0;
    this.crossfade(this.trackFor(slot));
  }

  setDuck(d: Duck): void {
    const ctx = this.engine.context;
    if (!ctx || !this.duckGain || !this.filter) return;
    if (this.lastDuck && this.lastDuck.gain === d.gain && this.lastDuck.lowpass === d.lowpass) return;
    this.lastDuck = d;
    this.duckGain.gain.setTargetAtTime(d.gain, ctx.currentTime, 0.1);
    this.filter.frequency.setTargetAtTime(d.lowpass ? LOWPASS_HZ : OPEN_HZ, ctx.currentTime, 0.1);
  }

  private trackFor(slot: MusicSlot): Track | null {
    const music = this.data.music!;
    const id = slot === "run" ? music.run[this.runIndex % music.run.length]! : music[slot];
    return this.tracks.get(id) ?? null;
  }

  /** Builds the graph on first use after the engine is enabled; false while there is no context. */
  private wire(): boolean {
    if (this.channels) return true;
    const ctx = this.engine.context;
    const input = this.engine.musicInput;
    if (!ctx || !input) return false;
    try {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = OPEN_HZ;
      filter.connect(input);
      const duck = ctx.createGain();
      duck.connect(filter);
      const channel = (): Channel => {
        const element = new Audio();
        element.preload = "auto";
        const fade = ctx.createGain();
        fade.gain.value = 0;
        ctx.createMediaElementSource(element).connect(fade);
        fade.connect(duck);
        element.addEventListener("ended", () => this.onEnded(element));
        return { element, fade };
      };
      this.channels = [channel(), channel()];
      this.duckGain = duck;
      this.filter = filter;
      return true;
    } catch (error) {
      console.warn("music unavailable", error);
      return false;
    }
  }

  private crossfade(track: Track | null): void {
    const ctx = this.engine.context!;
    const channels = this.channels!;
    const old = channels[this.active]!;
    old.fade.gain.setTargetAtTime(0, ctx.currentTime, FADE_TAU);
    const stopAt = old.element;
    setTimeout(() => {
      if (channels[this.active]!.element !== stopAt) stopAt.pause();
    }, FADE_SECONDS * 1000 + 100);
    if (!track) return;
    this.active = 1 - this.active;
    const next = channels[this.active]!;
    next.element.src = `${this.baseUrl}${track.file}`;
    next.element.loop = this.slot === "run" ? false : track.loop && this.slot !== "victory" && this.slot !== "defeat";
    next.fade.gain.cancelScheduledValues(ctx.currentTime);
    next.fade.gain.setValueAtTime(0, ctx.currentTime);
    next.fade.gain.setTargetAtTime(10 ** (track.gainDb / 20), ctx.currentTime, FADE_TAU);
    void next.element.play().catch((error: unknown) => console.warn(`music ${track.id} did not play`, error));
  }

  /** The next run track starts when one ends; other ended tracks leave silence. */
  private onEnded(element: HTMLAudioElement): void {
    if (this.slot !== "run" || this.channels?.[this.active]?.element !== element) return;
    this.runIndex++;
    this.crossfade(this.trackFor("run"));
  }
}
