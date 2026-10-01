/**
 * Favicons named by web pages are untrusted input (GitHub issue #1). They
 * are fetched with a byte limit and a timeout, one at a time per tab, and
 * cancelled when the page moves on. Before anything decodes an image, its
 * dimensions are read from the file header; only small PNG, JPEG, and ICO
 * images are decoded, so a tiny file claiming huge dimensions is never
 * expanded in memory.
 *
 * No Electron imports: the fetch and decode steps are passed in, so this
 * is unit tested directly.
 */

export const FAVICON_LIMITS = {
  /** Largest favicon file, fetched or inline, in bytes. */
  maxBytes: 256 * 1024,
  /** Largest width or height accepted for decoding, in pixels. */
  maxDimension: 512,
  /** Longest a single favicon fetch may take. */
  timeoutMs: 5000,
  /** At most this many of a page's favicon addresses are tried. */
  maxCandidates: 3,
  /** Wait for a page to stop changing its favicon before fetching. */
  settleMs: 150,
} as const;

export type Limits = { readonly [K in keyof typeof FAVICON_LIMITS]: number };
export type ImageFormat = 'png' | 'jpeg' | 'ico';

export interface ImageInfo {
  format: ImageFormat;
  width: number;
  height: number;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(b: Uint8Array, at = 0): boolean {
  return b.length >= at + 24 && PNG_SIGNATURE.every((v, i) => b[at + i] === v);
}

function u32be(b: Uint8Array, at: number): number {
  return ((b[at]! << 24) >>> 0) + (b[at + 1]! << 16) + (b[at + 2]! << 8) + b[at + 3]!;
}

function u16be(b: Uint8Array, at: number): number {
  return (b[at]! << 8) + b[at + 1]!;
}

function u16le(b: Uint8Array, at: number): number {
  return b[at]! + (b[at + 1]! << 8);
}

function u32le(b: Uint8Array, at: number): number {
  return b[at]! + (b[at + 1]! << 8) + (b[at + 2]! << 16) + ((b[at + 3]! << 24) >>> 0);
}

function i32le(b: Uint8Array, at: number): number {
  return u32le(b, at) | 0;
}

function pngSize(b: Uint8Array, at = 0): { width: number; height: number } {
  // The IHDR chunk always comes first: width and height at bytes 16 and 20.
  return { width: u32be(b, at + 16), height: u32be(b, at + 20) };
}

function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1]!;
    // Start-of-frame markers carry the size (not DHT, JPG, or DAC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: u16be(b, i + 5), width: u16be(b, i + 7) };
    }
    i += 2 + u16be(b, i + 2);
  }
  return null;
}

/** An ICO's largest image, checking any PNG images stored inside it too. */
function icoSize(b: Uint8Array): { width: number; height: number } | null {
  const count = u16le(b, 4);
  if (count === 0 || count > 64 || b.length < 6 + count * 16) return null;
  let width = 0;
  let height = 0;
  for (let n = 0; n < count; n++) {
    const entry = 6 + n * 16;
    const size = u32le(b, entry + 8);
    const offset = u32le(b, entry + 12);
    if (offset + size > b.length || size < 8) return null;
    let w: number;
    let h: number;
    if (isPng(b, offset)) {
      ({ width: w, height: h } = pngSize(b, offset));
    } else if (offset + 12 <= b.length) {
      // A bitmap: its header states width and (doubled) height.
      w = Math.abs(i32le(b, offset + 4));
      h = Math.abs(i32le(b, offset + 8)) / 2;
    } else {
      return null;
    }
    width = Math.max(width, w);
    height = Math.max(height, h);
  }
  return { width, height };
}

/** Reads an image's format and size from its header, without decoding it. */
export function imageInfo(b: Uint8Array): ImageInfo | null {
  if (isPng(b)) return { format: 'png', ...pngSize(b) };
  if (b.length > 10 && b[0] === 0xff && b[1] === 0xd8) {
    const size = jpegSize(b);
    return size ? { format: 'jpeg', ...size } : null;
  }
  if (b.length > 22 && u16le(b, 0) === 0 && u16le(b, 2) === 1) {
    const size = icoSize(b);
    return size ? { format: 'ico', ...size } : null;
  }
  return null;
}

/** Whether an image may be decoded as a favicon, with the reason when not. */
export function checkFavicon(b: Uint8Array, limits: Limits = FAVICON_LIMITS): { ok: true } | { ok: false; reason: string } {
  if (b.length > limits.maxBytes) return { ok: false, reason: `larger than ${limits.maxBytes} bytes` };
  const info = imageInfo(b);
  if (!info) return { ok: false, reason: 'not a PNG, JPEG, or ICO image' };
  if (info.width === 0 || info.height === 0) return { ok: false, reason: 'empty image' };
  if (info.width > limits.maxDimension || info.height > limits.maxDimension) {
    return { ok: false, reason: `${info.width}x${info.height} is larger than ${limits.maxDimension}px` };
  }
  return { ok: true };
}

/** The bytes of a data: image address, or null if it is not one or is too large. */
export function dataUrlBytes(url: string, limits: Limits = FAVICON_LIMITS): Buffer | null {
  const match = /^data:image\/[a-z0-9.+-]+(;[^,]*)?,/i.exec(url);
  if (!match) return null;
  const body = url.slice(match[0].length);
  const base64 = /;base64/i.test(match[1] ?? '');
  // Check the size before decoding anything.
  const estimate = base64 ? Math.floor((body.length * 3) / 4) : body.length;
  if (estimate > limits.maxBytes) return null;
  try {
    const bytes = base64 ? Buffer.from(body, 'base64') : Buffer.from(decodeURIComponent(body), 'latin1');
    return bytes.length > limits.maxBytes ? null : bytes;
  } catch {
    return null;
  }
}

/** Stops a response's download; safe to call on any response. */
export async function discardBody(response: Response): Promise<void> {
  if (response.body && !response.bodyUsed) await response.body.cancel().catch(() => undefined);
}

/**
 * Reads a response body, stopping as soon as it exceeds maxBytes. A body
 * that is refused is cancelled before this throws, so no download is
 * left running.
 */
export async function readLimited(response: Response, maxBytes: number): Promise<Buffer> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await discardBody(response);
    throw new Error('too large');
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error('too large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export type FetchFn = (url: string, init: { signal: AbortSignal }) => Promise<Response>;
/** Decodes checked image bytes into a small data: URL, or null. */
export type DecodeFn = (bytes: Buffer) => string | null;
/**
 * How an attempt at one favicon address ended: decoded, cancelled (the
 * page moved on), timed out, refused (too large, wrong kind, an error
 * status), or failed (could not be fetched or read).
 */
export type FaviconEnd = 'done' | 'cancelled' | 'timed out' | 'refused' | 'failed';

/**
 * Loads one tab's favicon. A new request replaces (and cancels) the one
 * in progress; cancel() stops everything, for navigation and closing.
 */
export class FaviconLoader {
  private controller: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  /**
   * @param ended Told how each attempt ended (test runs record it: a
   *   check can then see that a fetch was cancelled by the page moving
   *   on, not ended by the timeout).
   */
  constructor(
    private readonly fetchFn: FetchFn,
    private readonly decode: DecodeFn,
    private readonly limits: Limits = FAVICON_LIMITS,
    private readonly ended?: (url: string, why: FaviconEnd) => void,
  ) {}

  /**
   * Starts loading from the page's favicon addresses, after the page has
   * stopped changing them for a moment. Calls done with a data: URL, or
   * not at all if nothing usable was found or a newer request came.
   */
  request(urls: readonly string[], done: (dataUrl: string) => void): void {
    this.cancel();
    const controller = new AbortController();
    this.controller = controller;
    this.timer = setTimeout(() => {
      void this.load(urls, controller.signal).then((result) => {
        if (result && !controller.signal.aborted) done(result);
        if (this.controller === controller) this.controller = null;
      });
    }, this.limits.settleMs);
  }

  cancel(): void {
    clearTimeout(this.timer);
    this.controller?.abort();
    this.controller = null;
  }

  /**
   * Tries the addresses in turn, strictly one at a time: every attempt has
   * its own cancel switch, and whatever it did not finish (a refused size,
   * an error status, a failed read) is cancelled before the next address
   * is tried (PR #7 review). Never throws.
   */
  async load(urls: readonly string[], signal: AbortSignal): Promise<string | null> {
    for (const url of urls.slice(0, this.limits.maxCandidates)) {
      if (signal.aborted) return null;
      const attempt = new AbortController();
      let timeout: AbortSignal | null = null;
      let why: FaviconEnd = 'refused';
      try {
        let bytes: Buffer | null = null;
        if (/^data:/i.test(url)) {
          bytes = dataUrlBytes(url, this.limits);
        } else if (/^https?:\/\//i.test(url)) {
          timeout = AbortSignal.timeout(this.limits.timeoutMs);
          const response = await this.fetchFn(url, { signal: AbortSignal.any([signal, timeout, attempt.signal]) });
          if (!response.ok) {
            await discardBody(response);
            continue;
          }
          bytes = await readLimited(response, this.limits.maxBytes);
        }
        if (signal.aborted) {
          why = 'cancelled';
          continue;
        }
        if (!bytes || !checkFavicon(bytes, this.limits).ok) continue;
        const dataUrl = this.decode(bytes);
        if (!dataUrl) continue;
        why = 'done';
        return dataUrl;
      } catch (e) {
        // Too large, too slow, cancelled, or unreadable: try the next one.
        why = signal.aborted ? 'cancelled' : timeout?.aborted ? 'timed out' : e instanceof Error && e.message === 'too large' ? 'refused' : 'failed';
      } finally {
        // Ends this attempt's request whatever happened; after a complete
        // read it has nothing left to stop.
        attempt.abort();
        this.ended?.(url, why);
      }
    }
    return null;
  }
}
