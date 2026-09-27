/**
 * A HoloML page's sounds (HoloML 0.2 draft, `sound`; HyperSpace 3D
 * milestone 17, owner prompt 85, Q5 a). Files are fetched within the
 * page's limits like models, and nothing plays before the viewer's first
 * click, tap, or key on the page: only then is the audio started, and
 * `autoplay` sounds begin. (The browser also keeps the tab muted until
 * then, so a page's own script cannot play sound before it either.)
 */

export interface SoundReport {
  id: string | null;
  src: string;
  state: 'loading' | 'loaded' | 'failed' | 'left-out' | 'refused';
  reason?: string;
  bytes?: number;
  playing: boolean;
}

interface Sound {
  report: SoundReport;
  loop: boolean;
  volume: number;
  autoplay: boolean;
  data: ArrayBuffer | null;
  buffer: AudioBuffer | null;
  decoding: Promise<void> | null;
  source: AudioBufferSourceNode | null;
  gain: GainNode | null;
  /** play() asked for while the file was still loading or decoding. */
  wanted: boolean;
}

export class SoundBank {
  private context: AudioContext | null = null;
  private readonly sounds = new Set<Sound>();
  private allowed = false;
  onChange: (() => void) | null = null;

  constructor() {
    // Only real input counts: a page's script cannot make a trusted event.
    const allow = (e: Event) => {
      if (!e.isTrusted || this.allowed) return;
      this.allowed = true;
      window.removeEventListener('pointerdown', allow, true);
      window.removeEventListener('keydown', allow, true);
      this.start();
    };
    window.addEventListener('pointerdown', allow, true);
    window.addEventListener('keydown', allow, true);
  }

  /** Sounds may play: the viewer has clicked, tapped, or pressed a key on the page. */
  get active(): boolean {
    return this.allowed;
  }

  get reports(): SoundReport[] {
    return [...this.sounds].map((s) => s.report);
  }

  /** A sound element, with its file still to come (arrive or fail). */
  add(report: SoundReport, options: { loop: boolean; volume: number; autoplay: boolean }): SoundHandle {
    const s: Sound = { report, ...options, data: null, buffer: null, decoding: null, source: null, gain: null, wanted: false };
    this.sounds.add(s);
    return {
      arrive: (data) => {
        s.data = data;
        report.state = 'loaded';
        if (this.allowed) void this.decode(s).then(() => (s.autoplay || s.wanted ? this.play(s) : undefined));
      },
      fail: (state, reason) => {
        report.state = state;
        report.reason = reason;
      },
      play: () => this.play(s),
      stop: () => this.stop(s),
      remove: () => {
        this.stop(s);
        this.sounds.delete(s);
      },
    };
  }

  private start(): void {
    try {
      this.context = new AudioContext();
    } catch {
      return; // no audio device: the page stays silent
    }
    for (const s of this.sounds) {
      if (s.data) void this.decode(s).then(() => (s.autoplay || s.wanted ? this.play(s) : undefined));
    }
  }

  private decode(s: Sound): Promise<void> {
    if (s.buffer || !this.context || !s.data) return Promise.resolve();
    s.decoding ??= this.context
      .decodeAudioData(s.data.slice(0))
      .then((b) => {
        s.buffer = b;
      })
      .catch((e: unknown) => {
        s.report.state = 'failed';
        s.report.reason = `could not be decoded (${e instanceof Error ? e.message : String(e)})`;
        console.warn(`HoloML: the sound "${s.report.src}" ${s.report.reason}.`);
      });
    return s.decoding;
  }

  private play(s: Sound): void {
    if (!this.allowed || !this.context) return; // nothing plays before the first click or key
    if (!s.buffer) {
      s.wanted = s.report.state === 'loading' || s.report.state === 'loaded';
      if (s.data) void this.decode(s).then(() => (s.wanted ? this.play(s) : undefined));
      return;
    }
    s.wanted = false;
    this.stop(s);
    const source = this.context.createBufferSource();
    source.buffer = s.buffer;
    source.loop = s.loop;
    const gain = this.context.createGain();
    gain.gain.value = s.volume;
    source.connect(gain).connect(this.context.destination);
    source.onended = () => {
      if (s.source !== source) return;
      s.source = null;
      s.report.playing = false;
      this.onChange?.();
    };
    s.source = source;
    s.gain = gain;
    s.report.playing = true;
    source.start();
    this.onChange?.();
  }

  private stop(s: Sound): void {
    s.wanted = false;
    const source = s.source;
    if (!source) return;
    s.source = null;
    s.report.playing = false;
    try {
      source.stop();
    } catch {
      // Already stopped.
    }
    source.disconnect();
    s.gain?.disconnect();
    this.onChange?.();
  }

  dispose(): void {
    for (const s of this.sounds) this.stop(s);
    this.sounds.clear();
    void this.context?.close();
    this.context = null;
  }
}

export interface SoundHandle {
  arrive(data: ArrayBuffer): void;
  fail(state: 'failed' | 'left-out' | 'refused', reason: string): void;
  play(): void;
  stop(): void;
  remove(): void;
}
