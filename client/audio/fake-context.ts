/** A minimal stand-in for AudioContext in unit tests: records the nodes it makes, plays nothing. */
export class FakeParam {
  value: number;
  constructor(value = 0) {
    this.value = value;
  }
  setValueAtTime(v: number): this {
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number): this {
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number): this {
    this.value = v;
    return this;
  }
  setTargetAtTime(v: number): this {
    this.value = v;
    return this;
  }
  cancelScheduledValues(): this {
    return this;
  }
}

export class FakeNode {
  readonly outputs: unknown[] = [];
  constructor(readonly kind: string) {}
  connect<T>(node: T): T {
    this.outputs.push(node);
    return node;
  }
  disconnect(): void {
    this.outputs.length = 0;
  }
}

export class FakeGain extends FakeNode {
  readonly gain = new FakeParam(1);
  constructor() {
    super("gain");
  }
}

export class FakeSource extends FakeNode {
  buffer: { duration: number } | null = null;
  readonly playbackRate = new FakeParam(1);
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  constructor() {
    super("source");
  }
  start(): void {
    this.started = true;
  }
  stop(): void {
    this.stopped = true;
  }
}

export class FakePanner extends FakeNode {
  readonly pan = new FakeParam(0);
  constructor() {
    super("panner");
  }
}

export class FakeContext {
  currentTime = 0;
  readonly sampleRate = 8000;
  readonly destination = new FakeNode("destination");
  readonly gains: FakeGain[] = [];
  readonly sources: FakeSource[] = [];
  readonly panners: FakePanner[] = [];
  oscillators = 0;

  createGain(): FakeGain {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createBufferSource(): FakeSource {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  createStereoPanner(): FakePanner {
    const p = new FakePanner();
    this.panners.push(p);
    return p;
  }
  createBiquadFilter(): FakeNode & { type: string; frequency: FakeParam; Q: FakeParam } {
    return Object.assign(new FakeNode("filter"), { type: "lowpass", frequency: new FakeParam(350), Q: new FakeParam(1) });
  }
  createDynamicsCompressor(): FakeNode & Record<"threshold" | "ratio" | "knee" | "attack" | "release", FakeParam> {
    return Object.assign(new FakeNode("compressor"), {
      threshold: new FakeParam(-24), ratio: new FakeParam(12), knee: new FakeParam(30),
      attack: new FakeParam(0.003), release: new FakeParam(0.25),
    });
  }
  createOscillator(): FakeNode & { type: string; frequency: FakeParam; start(): void; stop(): void } {
    this.oscillators++;
    return Object.assign(new FakeNode("osc"), { type: "sine", frequency: new FakeParam(440), start() {}, stop() {} });
  }
  createBuffer(_channels: number, length: number): { duration: number; getChannelData(): Float32Array } {
    return { duration: length / this.sampleRate, getChannelData: () => new Float32Array(length) };
  }
  createMediaElementSource(): FakeNode {
    return new FakeNode("media");
  }
  decodeAudioData(data: ArrayBuffer): Promise<{ duration: number }> {
    if (data.byteLength === 0) return Promise.reject(new Error("cannot decode"));
    return Promise.resolve({ duration: 0.4 });
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
}
