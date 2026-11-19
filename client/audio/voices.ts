export interface VoiceStart {
  ok: boolean;
  /** The id of a lower-priority voice to stop for this one, or null. */
  steal: number | null;
  id: number;
}

interface Voice {
  id: number;
  cue: string;
  priority: number;
  start: number;
  end: number;
}

/** Counts playing voices per cue and in total; voices end by themselves at their end time. */
export class VoiceLimiter {
  private readonly maxTotal: number;
  private readonly voices: Voice[] = [];
  private nextId = 1;

  constructor(maxTotal = 32) {
    this.maxTotal = maxTotal;
  }

  start(cueId: string, maxVoices: number, priority: number, now: number, seconds: number): VoiceStart {
    for (let i = this.voices.length - 1; i >= 0; i--) if (this.voices[i]!.end <= now) this.voices.splice(i, 1);
    let sameCue = 0;
    for (const v of this.voices) if (v.cue === cueId) sameCue++;
    if (sameCue >= maxVoices) return { ok: false, steal: null, id: 0 };
    let steal: number | null = null;
    if (this.voices.length >= this.maxTotal) {
      let victim = -1;
      for (let i = 0; i < this.voices.length; i++) {
        const v = this.voices[i]!;
        if (v.priority >= priority) continue;
        if (victim < 0 || v.start < this.voices[victim]!.start) victim = i;
      }
      if (victim < 0) return { ok: false, steal: null, id: 0 };
      steal = this.voices[victim]!.id;
      this.voices.splice(victim, 1);
    }
    const id = this.nextId++;
    this.voices.push({ id, cue: cueId, priority, start: now, end: now + seconds });
    return { ok: true, steal, id };
  }

  end(id: number): void {
    const i = this.voices.findIndex((v) => v.id === id);
    if (i >= 0) this.voices.splice(i, 1);
  }
}
