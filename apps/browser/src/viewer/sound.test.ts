import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Budget, Claim, LIMITS } from './budget';
import { SoundBank, distanceGain, type SoundReport } from './sound';

/** A stand-in for the page's audio: decoding waits until the test lets it finish, and every sound started is noted. */
class FakeAudio {
  static started: { buffer: unknown; fade: number | null }[] = [];
  static decodes: { finish(seconds: number): void; fail(): void }[] = [];
  static gains: { gain: { value: number } }[] = [];
  static panners: { rolloffFactor: number }[] = [];
  readonly destination = {};
  decodeAudioData(): Promise<{ duration: number }> {
    return new Promise((resolve, reject) => FakeAudio.decodes.push({ finish: (duration) => resolve({ duration }), fail: () => reject(new Error('bad data')) }));
  }
  createBufferSource() {
    const source = {
      buffer: null as unknown,
      loop: false,
      onended: null,
      gain: null as { gain: { value: number } } | null,
      connect: (node: { gain: { value: number } }) => (source.gain = node),
      disconnect: () => undefined,
      start: () => FakeAudio.started.push({ buffer: source.buffer, fade: null }),
      stop: () => undefined,
    };
    return source;
  }
  createGain() {
    const node = { gain: { value: 1 }, connect: (next: unknown) => next, disconnect: () => undefined };
    FakeAudio.gains.push(node);
    return node;
  }
  createPanner() {
    const value = () => ({ value: 0 });
    const panner = { panningModel: '', rolloffFactor: 1, positionX: value(), positionY: value(), positionZ: value(), connect: (next: unknown) => next, disconnect: () => undefined };
    FakeAudio.panners.push(panner);
    return panner;
  }
  createChannelSplitter() {
    return { connect: () => undefined };
  }
  createAnalyser() {
    return { fftSize: 0 };
  }
  close() {
    return Promise.resolve();
  }
}

let firstInput: ((e: { isTrusted: boolean }) => void) | null = null;

beforeEach(() => {
  FakeAudio.started = [];
  FakeAudio.decodes = [];
  FakeAudio.gains = [];
  FakeAudio.panners = [];
  firstInput = null;
  vi.stubGlobal('window', {
    addEventListener: (type: string, listener: (e: { isTrusted: boolean }) => void) => {
      if (type === 'pointerdown') firstInput = listener;
    },
    removeEventListener: () => undefined,
  });
  vi.stubGlobal('AudioContext', FakeAudio);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const report = (src: string): SoundReport => ({ id: null, src, state: 'loading', playing: false, plays: 0 });
const click = () => firstInput!({ isTrusted: true });
const turn = () => new Promise((r) => setTimeout(r, 0));

/** A file of `bytes` bytes that arrived for a sound, counted against the page. */
function arrived(budget: Budget, bytes: number): { data: ArrayBuffer; claim: Claim } {
  const claim = new Claim(budget);
  claim.addBytes(bytes);
  return { data: new ArrayBuffer(bytes), claim };
}

describe('a sound removed while its file is decoded (review 134, V9)', () => {
  it('never plays, and its bytes stop counting', async () => {
    const budget = new Budget();
    const bank = new SoundBank();
    const r = report('music.ogg');
    const sound = bank.add(r, { loop: true, volume: 1, autoplay: true });
    const file = arrived(budget, 1000);
    sound.arrive(file.data, file.claim);
    expect(budget.bytes).toBe(1000);
    click();
    await turn();
    expect(FakeAudio.decodes).toHaveLength(1);
    // Removed (holoml.remove) before the decoding is done.
    sound.remove();
    expect(budget.bytes).toBe(0);
    FakeAudio.decodes[0]!.finish(3);
    await turn();
    expect(FakeAudio.started).toHaveLength(0);
    expect(r).toMatchObject({ playing: false, plays: 0 });
    expect(budget.seconds).toBe(0);
    // Asked to play after all (a script kept its handle): still nothing.
    sound.play();
    await turn();
    expect(FakeAudio.started).toHaveLength(0);
  });

  it('a file that arrives for a sound already removed is not kept', () => {
    const budget = new Budget();
    const bank = new SoundBank();
    const sound = bank.add(report('late.ogg'), { loop: false, volume: 1, autoplay: true });
    sound.remove();
    const file = arrived(budget, 500);
    sound.arrive(file.data, file.claim);
    expect(budget.bytes).toBe(0);
    expect(bank.reports).toEqual([]);
  });

  it('a sound not removed plays once decoded, as before', async () => {
    const budget = new Budget();
    const bank = new SoundBank();
    const r = report('chime.ogg');
    const sound = bank.add(r, { loop: false, volume: 0.5, autoplay: true });
    const file = arrived(budget, 1000);
    sound.arrive(file.data, file.claim);
    click();
    await turn();
    FakeAudio.decodes[0]!.finish(2);
    await turn();
    expect(FakeAudio.started).toHaveLength(1);
    expect(r).toMatchObject({ playing: true, plays: 1, state: 'loaded' });
    expect(budget.seconds).toBe(2);
    sound.remove();
    expect(budget).toMatchObject({ bytes: 0, seconds: 0 });
  });
});

describe("the page's seconds of sound (review 134, V6)", () => {
  it('decodes one sound at a time, and leaves out the one that would pass the limit, with its bytes', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const budget = new Budget();
    const bank = new SoundBank();
    let told = 0;
    bank.onLeftOut = () => (told += 1);
    const reports = ['a.ogg', 'b.ogg', 'c.ogg'].map(report);
    reports.forEach((r) => {
      const file = arrived(budget, 1000);
      bank.add(r, { loop: false, volume: 1, autoplay: false }).arrive(file.data, file.claim);
    });
    click();
    await turn();
    // One at a time: the second waits for the first.
    expect(FakeAudio.decodes).toHaveLength(1);
    FakeAudio.decodes[0]!.finish(LIMITS.soundSeconds - 100);
    await turn();
    expect(FakeAudio.decodes).toHaveLength(2);
    FakeAudio.decodes[1]!.finish(101);
    await turn();
    FakeAudio.decodes[2]!.finish(100);
    await turn();
    expect(reports.map((r) => r.state)).toEqual(['loaded', 'left-out', 'loaded']);
    expect(reports[1]!.reason).toMatch(/101 seconds of sound would pass the page's 600 seconds of sound in all/);
    expect(budget.seconds).toBe(LIMITS.soundSeconds);
    expect(budget.bytes).toBe(2000);
    expect(told).toBe(1);
    expect(warn.mock.calls.map((c) => String(c[0]))).toEqual([expect.stringMatching(/^HoloML: the sound "b\.ogg" was left out: 101 seconds/)]);
  });

  it('a sound whose header says it is too long is left out before it is decoded; one that cannot be decoded holds nothing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const budget = new Budget();
    const bank = new SoundBank();
    // A WAV header: one channel, 8,000 bytes a second, and a data part said to be 8,000,000 bytes long (1,000 seconds).
    const wav = new Uint8Array(8_000_044);
    const view = new DataView(wav.buffer);
    wav.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0);
    wav.set([...'WAVEfmt '].map((c) => c.charCodeAt(0)), 8);
    view.setUint32(16, 16, true);
    view.setUint32(28, 8000, true);
    wav.set([...'data'].map((c) => c.charCodeAt(0)), 36);
    view.setUint32(40, 8_000_000, true);
    const long = report('long.wav');
    const claim = new Claim(budget);
    claim.addBytes(wav.length);
    bank.add(long, { loop: false, volume: 1, autoplay: true }).arrive(wav.buffer, claim);
    expect(long).toMatchObject({ state: 'left-out', reason: expect.stringMatching(/1,000 seconds of sound would pass/) });
    expect(budget).toMatchObject({ bytes: 0, seconds: 0 });
    const broken = report('broken.ogg');
    const file = arrived(budget, 700);
    bank.add(broken, { loop: false, volume: 1, autoplay: true }).arrive(file.data, file.claim);
    click();
    await turn();
    // Only the one that may still play is decoded.
    expect(FakeAudio.decodes).toHaveLength(1);
    FakeAudio.decodes[0]!.fail();
    await turn();
    expect(broken).toMatchObject({ state: 'failed', reason: 'could not be decoded (bad data)' });
    expect(budget).toMatchObject({ bytes: 0, seconds: 0 });
    expect(FakeAudio.started).toHaveLength(0);
  });
});

describe('how loud distance leaves a sound from a place (milestone 21; review 134, V10)', () => {
  it('full within a metre, quieter evenly, silent from its range on', () => {
    expect(distanceGain(0.5, 20)).toBe(1);
    expect(distanceGain(10.5, 20)).toBeCloseTo(0.5, 5);
    expect(distanceGain(20, 20)).toBe(0);
  });

  it('a range of a metre or less: full within it, silent beyond', () => {
    expect(distanceGain(0.3, 0.8)).toBe(1);
    expect(distanceGain(0.8, 0.8)).toBe(1);
    expect(distanceGain(0.81, 0.8)).toBe(0);
  });

  it('a sound from a place is made as loud as the rule says, not as Web Audio\'s own distance would', async () => {
    const budget = new Budget();
    const bank = new SoundBank();
    const r = report('near.ogg');
    const sound = bank.add(r, { loop: true, volume: 1, autoplay: true });
    sound.place(() => [0, 0, -0.5], 0.8);
    const file = arrived(budget, 100);
    sound.arrive(file.data, file.claim);
    bank.follow([0, 0, 0], [0, 0, -1], [0, 1, 0]);
    click();
    await turn();
    FakeAudio.decodes[0]!.finish(1);
    await turn();
    expect(FakeAudio.started).toHaveLength(1);
    expect(r.place).toMatchObject({ distance: 0.5, gain: 1, range: 0.8 });
    // Its volume, then how loud distance leaves it; the panner adds no fall-off of its own.
    const [volume, fade] = FakeAudio.gains;
    expect(volume!.gain.value).toBe(1);
    expect(fade!.gain.value).toBe(1);
    expect(FakeAudio.panners.map((p) => p.rolloffFactor)).toEqual([0]);
    // The viewer steps back, out of its range: silent.
    bank.follow([0, 0, 1], [0, 0, -1], [0, 1, 0]);
    expect(r.place).toMatchObject({ distance: 1.5, gain: 0 });
    expect(fade!.gain.value).toBe(0);
  });
});
