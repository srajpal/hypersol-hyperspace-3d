/**
 * A HoloML page's sounds (HoloML 0.2, `sound`; HyperSpace 3D
 * milestone 17, owner prompt 85, Q5 a). Files are fetched within the
 * page's limits like models, and nothing plays before the viewer's first
 * click, tap, or key on the page: only then is the audio started, and
 * `autoplay` sounds begin. (The browser also keeps the tab muted until
 * then, so a page's own script cannot play sound before it either.)
 *
 * Milestone 21 (HoloML 0.2, fifth part): a sound with a position comes
 * from its place. It plays at its volume within 1 metre of the viewer,
 * grows quieter evenly with distance, is silent from its range on, and
 * comes from the viewer's left or right as the place is (Web Audio's
 * panner, with the listener following the viewer).
 *
 * Review 134: a sound removed while its file is decoded never plays (V9);
 * what a sound holds of the page's totals is given back when it is
 * removed or cannot be played; sounds are decoded one at a time, and one
 * that would take the page past its seconds of sound is left out (V6).
 */
import { LeftOut, soundSeconds, type Claim } from './budget';
import type { Vec3 } from './values';

/** Where a sound from a place is heard from, as last worked out: for the tests and the inspector. */
export interface SoundPlace {
  /** Metres from the viewer. */
  distance: number;
  /** How loud distance leaves it, from 1 (within 1 metre) to 0 (from its range on). */
  gain: number;
  /** Which side it comes from: -1 the viewer's left, 1 the right, 0 ahead or behind. */
  pan: number;
  range: number;
}

/** A sound from a place within 1 metre plays at its volume; then quieter evenly, silent from its range on (Web Audio's "linear" distance). */
export function distanceGain(distance: number, range: number): number {
  const ref = Math.min(1, range);
  if (distance <= ref) return 1;
  if (distance >= range) return 0;
  return 1 - (distance - ref) / (range - ref);
}

export interface SoundReport {
  id: string | null;
  src: string;
  state: 'loading' | 'loaded' | 'failed' | 'left-out' | 'refused';
  reason?: string;
  bytes?: number;
  playing: boolean;
  /** How many times it has started playing (for the tests and the inspector: a short sound may be over before anyone looks). */
  plays: number;
  /** A sound from a place (milestone 21): how the viewer hears it now. */
  place?: SoundPlace;
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
  /** A sound from a place: how loud distance leaves it (the panner only says which side it comes from). */
  fade: GainNode | null;
  /** What it holds of the page's totals: its file's bytes, and its seconds once known. */
  claim: Claim | null;
  /** Removed from the page: whatever of it is still under way (its decoding) comes to nothing. */
  removed: boolean;
  /** play() asked for while the file was still loading or decoding. */
  wanted: boolean;
  /** A sound from a place: where it is in the world now, and how far it reaches. */
  where: (() => Vec3) | null;
  range: number;
  panner: PannerNode | null;
  /** The left and right sides of what the viewer hears of it (for the page's hooks). */
  ears: [AnalyserNode, AnalyserNode] | null;
}

export class SoundBank {
  private context: AudioContext | null = null;
  private readonly sounds = new Set<Sound>();
  private allowed = false;
  /** Where the viewer's ears were last (sounds from a place fade by how far they are from here). */
  private listener: Vec3 = [0, 0, 0];
  /** One file is decoded at a time, in the order asked: each waits for the one before. */
  private decodes: Promise<void> = Promise.resolve();
  onChange: (() => void) | null = null;
  /** A sound was left out after its file arrived (it could not be decoded, or is too long): the notice. */
  onLeftOut: (() => void) | null = null;

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
    const s: Sound = { report, ...options, data: null, buffer: null, decoding: null, source: null, gain: null, fade: null, claim: null, removed: false, wanted: false, where: null, range: 20, panner: null, ears: null };
    this.sounds.add(s);
    return {
      arrive: (data, claim) => {
        if (s.removed) {
          claim.release();
          return;
        }
        s.data = data;
        s.claim = claim;
        report.state = 'loaded';
        // Its length, where its file's header tells it: too long a sound is left out now, not decoded first.
        const seconds = soundSeconds(new Uint8Array(data));
        try {
          if (seconds !== null) claim.setSeconds(seconds);
        } catch (e) {
          this.leaveOut(s, e);
          return;
        }
        if (this.allowed) void this.decode(s).then(() => (s.autoplay || s.wanted ? this.play(s) : undefined));
      },
      fail: (state, reason) => {
        report.state = state;
        report.reason = reason;
      },
      play: () => this.play(s),
      stop: () => this.stop(s),
      get volume() {
        return s.volume;
      },
      set volume(v: number) {
        s.volume = v;
        if (s.gain) s.gain.gain.value = v;
      },
      place: (where, range) => {
        s.where = where;
        s.range = range;
        if (!where) delete report.place;
        // Playing already: heard from its place (or from everywhere) from now on.
        if (s.source && s.gain) this.connect(s, s.gain);
        this.onChange?.();
      },
      levels: () => this.levels(s),
      remove: () => {
        s.removed = true;
        this.stop(s);
        this.sounds.delete(s);
        s.data = null;
        s.buffer = null;
        s.claim?.release();
      },
    };
  }

  /** Some sound comes from a place: the viewer's place and direction matter. */
  get placed(): boolean {
    for (const s of this.sounds) if (s.where) return true;
    return false;
  }

  /**
   * The viewer's ears (the listener) where the viewer is, facing where the
   * viewer looks; each sound from a place where its thing is now.
   */
  follow(position: Vec3, forward: Vec3, up: Vec3): void {
    const right = cross(forward, up);
    this.listener = position;
    for (const s of this.sounds) {
      if (!s.where) continue;
      const p = s.where();
      const d: Vec3 = [p[0] - position[0], p[1] - position[1], p[2] - position[2]];
      const distance = Math.hypot(...d);
      const pan = distance < 1e-6 ? 0 : (d[0] * right[0] + d[1] * right[1] + d[2] * right[2]) / distance;
      s.report.place = { distance, gain: distanceGain(distance, s.range), pan, range: s.range };
      if (s.fade) s.fade.gain.value = s.report.place.gain;
      if (s.panner) {
        s.panner.positionX.value = p[0];
        s.panner.positionY.value = p[1];
        s.panner.positionZ.value = p[2];
      }
    }
    const l = this.context?.listener;
    if (!l || !this.placed) return;
    l.positionX.value = position[0];
    l.positionY.value = position[1];
    l.positionZ.value = position[2];
    l.forwardX.value = forward[0];
    l.forwardY.value = forward[1];
    l.forwardZ.value = forward[2];
    l.upX.value = up[0];
    l.upY.value = up[1];
    l.upZ.value = up[2];
  }

  /**
   * How loud a sound from a place is in the viewer's left and right ears
   * now (the root mean square of what it sends out), or null when it is
   * not playing or has no place.
   */
  private levels(s: Sound): { left: number; right: number } | null {
    if (!s.ears || !s.source) return null;
    const rms = (a: AnalyserNode) => {
      const data = new Float32Array(a.fftSize);
      a.getFloatTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += v * v;
      return Math.sqrt(sum / data.length);
    };
    return { left: rms(s.ears[0]), right: rms(s.ears[1]) };
  }

  /**
   * From the sound's gain to the speakers: for a sound from a place,
   * through how loud distance leaves it and a panner at its place; or
   * straight, for a sound from everywhere. The distance is worked out
   * here (distanceGain), not by the panner: Web Audio's own "linear"
   * distance is silent at every distance when a sound's range is 1 metre
   * or less (its reference distance and its greatest are then the same),
   * where the rule says full volume within the range (review 134, V10).
   */
  private connect(s: Sound, gain: GainNode): void {
    const ctx = this.context!;
    gain.disconnect();
    s.fade?.disconnect();
    s.fade = null;
    s.panner?.disconnect();
    s.panner = null;
    s.ears = null;
    if (!s.where) {
      gain.connect(ctx.destination);
      return;
    }
    const panner = ctx.createPanner();
    panner.panningModel = 'equalpower';
    // No fall-off of its own: `fade` has it.
    panner.rolloffFactor = 0;
    const p = s.where();
    panner.positionX.value = p[0];
    panner.positionY.value = p[1];
    panner.positionZ.value = p[2];
    const fade = ctx.createGain();
    fade.gain.value = distanceGain(Math.hypot(p[0] - this.listener[0], p[1] - this.listener[1], p[2] - this.listener[2]), s.range);
    gain.connect(fade).connect(panner).connect(ctx.destination);
    s.fade = fade;
    // What each ear gets, for the page's hooks (they lead nowhere else).
    const split = ctx.createChannelSplitter(2);
    const left = ctx.createAnalyser();
    const right = ctx.createAnalyser();
    left.fftSize = right.fftSize = 2048;
    panner.connect(split);
    split.connect(left, 0);
    split.connect(right, 1);
    s.panner = panner;
    s.ears = [left, right];
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

  /**
   * Decodes a sound's file, after those asked for before it (one at a
   * time, so the page's seconds of sound are counted in order and no two
   * long sounds are unpacked side by side). A sound removed meanwhile is
   * dropped; one that cannot be decoded, or that takes the page past its
   * seconds of sound, is left out and holds nothing.
   */
  private decode(s: Sound): Promise<void> {
    if (s.buffer || !this.context || !s.data || s.removed) return Promise.resolve();
    s.decoding ??= this.decodes = this.decodes.then(async () => {
      const data = s.data;
      if (!data || s.removed || !this.context) return;
      try {
        let buffer: AudioBuffer;
        try {
          buffer = await this.context.decodeAudioData(data.slice(0));
        } catch (e) {
          throw new Error(`could not be decoded (${e instanceof Error ? e.message : String(e)})`);
        }
        if (s.removed) return;
        // As long as it really is, whatever its header said.
        s.claim?.setSeconds(buffer.duration);
        s.buffer = buffer;
      } catch (e) {
        this.leaveOut(s, e);
      }
    });
    return s.decoding;
  }

  /** A sound that arrived and cannot be played: it holds nothing more, and the console and the notice say why. */
  private leaveOut(s: Sound, e: unknown): void {
    s.report.state = e instanceof LeftOut ? 'left-out' : 'failed';
    s.report.reason = e instanceof LeftOut ? e.reason : e instanceof Error ? e.message : String(e);
    console.warn(e instanceof LeftOut ? `HoloML: the sound "${s.report.src}" was left out: ${s.report.reason}.` : `HoloML: the sound "${s.report.src}" ${s.report.reason}.`);
    s.data = null;
    s.wanted = false;
    s.claim?.release();
    this.onLeftOut?.();
  }

  private play(s: Sound): void {
    if (!this.allowed || !this.context || s.removed) return; // nothing plays before the first click or key
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
    source.connect(gain);
    this.connect(s, gain);
    source.onended = () => {
      if (s.source !== source) return;
      s.source = null;
      s.report.playing = false;
      this.onChange?.();
    };
    s.source = source;
    s.gain = gain;
    s.report.playing = true;
    s.report.plays += 1;
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
    s.fade?.disconnect();
    s.fade = null;
    s.panner?.disconnect();
    s.panner = null;
    s.ears = null;
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
  /** Its file has arrived, with what it holds of the page's totals (given back if the sound is removed or cannot be played). */
  arrive(data: ArrayBuffer, claim: Claim): void;
  fail(state: 'failed' | 'left-out' | 'refused', reason: string): void;
  play(): void;
  stop(): void;
  /** How loud, from 0 to 1; can be changed while it plays. */
  volume: number;
  /** A sound from a place (milestone 21): where it is in the world now, and how far it reaches; null for a sound from everywhere. */
  place(where: (() => Vec3) | null, range: number): void;
  /** How loud it is in the viewer's left and right ears now (a sound from a place that plays), else null. */
  levels(): { left: number; right: number } | null;
  remove(): void;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
