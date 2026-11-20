import type { AudioData, Cue } from "../../data/schema/audio";
import { Sfx } from "./sfx";
import { vary } from "./variation";
import { VoiceLimiter } from "./voices";

export interface Volumes {
  master: number;
  music: number;
  sfx: number;
}

export interface PlayOptions {
  pan?: number;
  gain?: number;
  /** Multiplies the varied playback rate (e.g. the rising pitch of quick pickups). */
  rate?: number;
}

export interface EngineDeps {
  fetch: (url: string) => Promise<Response>;
  rand: () => number;
}

/** Output headroom: master volume 1 sends this gain to the speakers. */
const HEADROOM = 0.5;
/** How long a synth-only voice counts against the limits. */
const SYNTH_SECONDS = 0.4;
const DEFAULT_VOLUMES: Volumes = { master: 0.8, music: 0.3, sfx: 0.8 };

interface Graph {
  ctx: AudioContext;
  master: GainNode;
  music: GainNode;
  sfx: GainNode;
  ui: GainNode;
  synth: Sfx;
}

/**
 * Plays cues through three buses: music, effects (with a compressor) and interface.
 * Recorded variants are decoded by `preload`; a cue whose files are missing or failed plays its synth tone.
 */
export class AudioEngine {
  private readonly cues = new Map<string, Cue>();
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly failed = new Set<string>();
  private readonly playing = new Map<number, AudioScheduledSourceNode>();
  private readonly voices = new VoiceLimiter();
  private readonly baseUrl: string;
  private readonly makeContext: () => AudioContext;
  private readonly deps: EngineDeps;
  private graph: Graph | null = null;
  private volumes: Volumes = { ...DEFAULT_VOLUMES };
  private muted = false;

  constructor(data: AudioData, baseUrl: string, makeContext: () => AudioContext = () => new AudioContext(), deps: Partial<EngineDeps> = {}) {
    for (const cue of data.cues) this.cues.set(cue.id, cue);
    this.baseUrl = baseUrl;
    this.makeContext = makeContext;
    this.deps = { fetch: deps.fetch ?? ((url) => fetch(url)), rand: deps.rand ?? Math.random };
  }

  get context(): AudioContext | null {
    return this.graph?.ctx ?? null;
  }

  /** The node music players connect to (the music volume bus). */
  get musicInput(): AudioNode | null {
    return this.graph?.music ?? null;
  }

  /** Creates the context and buses; call it from a user gesture. A Web Audio failure only warns. */
  enable(): void {
    if (this.graph) {
      void this.graph.ctx.resume().catch(() => {});
      return;
    }
    try {
      const ctx = this.makeContext();
      const master = ctx.createGain();
      master.connect(ctx.destination);
      const music = ctx.createGain();
      music.connect(master);
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.ratio.value = 6;
      compressor.connect(master);
      const sfx = ctx.createGain();
      sfx.connect(compressor);
      const ui = ctx.createGain();
      ui.connect(master);
      this.graph = { ctx, master, music, sfx, ui, synth: new Sfx(ctx) };
      this.applyLevels();
    } catch (error) {
      console.warn("audio unavailable", error);
    }
  }

  /** Fetches and decodes every effect file; a file that fails sends its cue to the synth fallback. */
  async preload(): Promise<void> {
    const ctx = this.context;
    if (!ctx) return;
    const jobs: Promise<void>[] = [];
    for (const cue of this.cues.values()) {
      if (cue.category === "music") continue;
      for (const file of cue.files) {
        if (this.buffers.has(file)) continue;
        jobs.push(this.load(ctx, file).then(
          (buffer) => void this.buffers.set(file, buffer),
          (error: unknown) => this.fail(cue, file, error),
        ));
      }
    }
    await Promise.all(jobs);
  }

  play(cueId: string, opts: PlayOptions = {}): void {
    const g = this.graph;
    if (!g || this.muted) return;
    const cue = this.cues.get(cueId);
    if (!cue) return;
    const v = vary(cue, this.deps.rand);
    const rate = v.rate * (opts.rate ?? 1);
    const buffer = v.file !== null && !this.failed.has(cue.id) ? this.buffers.get(v.file) : undefined;
    if (!buffer && cue.synth === undefined) return;
    const now = g.ctx.currentTime;
    const seconds = buffer ? buffer.duration / rate : SYNTH_SECONDS;
    const voice = this.voices.start(cue.id, cue.maxVoices, cue.priority, now, seconds);
    if (!voice.ok) return;
    if (voice.steal !== null) this.stop(voice.steal);
    try {
      const gain = g.ctx.createGain();
      gain.gain.value = v.gain * (opts.gain ?? 1);
      let out: AudioNode = gain;
      if (opts.pan !== undefined && opts.pan !== 0) {
        const panner = g.ctx.createStereoPanner();
        panner.pan.value = opts.pan;
        gain.connect(panner);
        out = panner;
      }
      out.connect(cue.category === "ui" ? g.ui : g.sfx);
      if (buffer) {
        const source = g.ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = rate;
        source.connect(gain);
        source.onended = () => {
          this.playing.delete(voice.id);
          this.voices.end(voice.id);
        };
        this.playing.set(voice.id, source);
        source.start(now);
      } else {
        g.synth.synth(cue.synth!, now, gain);
      }
    } catch (error) {
      console.warn("sound failed", error);
    }
  }

  setVolumes(v: Volumes): void {
    this.volumes = { ...v };
    this.applyLevels();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyLevels();
  }

  /** The bus levels as volumes (master without headroom); for tests. */
  levels(): { master: number; music: number; sfx: number; ui: number } {
    const g = this.graph;
    if (!g) return { master: 0, music: 0, sfx: 0, ui: 0 };
    return { master: g.master.gain.value / HEADROOM, music: g.music.gain.value, sfx: g.sfx.gain.value, ui: g.ui.gain.value };
  }

  private applyLevels(): void {
    const g = this.graph;
    if (!g) return;
    g.master.gain.value = this.muted ? 0 : clamp01(this.volumes.master) * HEADROOM;
    g.music.gain.value = clamp01(this.volumes.music);
    g.sfx.gain.value = clamp01(this.volumes.sfx);
    g.ui.gain.value = clamp01(this.volumes.sfx);
  }

  private async load(ctx: AudioContext, file: string): Promise<AudioBuffer> {
    const response = await this.deps.fetch(`${this.baseUrl}${file}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return ctx.decodeAudioData(await response.arrayBuffer());
  }

  private fail(cue: Cue, file: string, error: unknown): void {
    if (this.failed.has(cue.id)) return;
    this.failed.add(cue.id);
    console.warn(`sound ${cue.id}: ${file} did not load, using the synth fallback`, error);
  }

  private stop(id: number): void {
    const source = this.playing.get(id);
    this.playing.delete(id);
    try {
      source?.stop();
    } catch {
      // already stopped
    }
  }
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}
