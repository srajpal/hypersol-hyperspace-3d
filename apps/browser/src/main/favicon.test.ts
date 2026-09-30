import { afterEach, describe, expect, it, vi } from 'vitest';
import { FAVICON_LIMITS, FaviconLoader, checkFavicon, dataUrlBytes, imageInfo, readLimited, type Limits } from './favicon';

/** A PNG header claiming the given size (enough for the size check; not decodable). */
function pngHeader(width: number, height: number): Buffer {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

function jpegHeader(width: number, height: number): Buffer {
  // SOI, an APP0 segment, then SOF0 with the size.
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03,
  ]);
}

function icoWithPng(width: number, height: number): Buffer {
  const png = pngHeader(width, height);
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header[6] = 0; // the directory claims 256x256
  header[7] = 0;
  header.writeUInt32LE(png.length, 6 + 8);
  header.writeUInt32LE(22, 6 + 12);
  return Buffer.concat([header, png]);
}

const fast: Limits = { ...FAVICON_LIMITS, settleMs: 0, timeoutMs: 100 };

describe('imageInfo and checkFavicon', () => {
  it('reads sizes from PNG, JPEG, and ICO headers', () => {
    expect(imageInfo(pngHeader(32, 16))).toEqual({ format: 'png', width: 32, height: 16 });
    expect(imageInfo(jpegHeader(64, 48))).toEqual({ format: 'jpeg', width: 64, height: 48 });
    expect(imageInfo(icoWithPng(48, 48))).toEqual({ format: 'ico', width: 48, height: 48 });
    expect(imageInfo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
  });

  it('accepts small images', () => {
    expect(checkFavicon(pngHeader(32, 32))).toEqual({ ok: true });
  });

  it('refuses huge dimensions before decoding, including inside an ICO', () => {
    expect(checkFavicon(pngHeader(20000, 20000))).toEqual({ ok: false, reason: '20000x20000 is larger than 512px' });
    expect(checkFavicon(jpegHeader(4096, 10))).toMatchObject({ ok: false });
    expect(checkFavicon(icoWithPng(30000, 30000))).toMatchObject({ ok: false });
  });

  it('refuses oversized files and unknown formats', () => {
    const big = Buffer.concat([pngHeader(16, 16), Buffer.alloc(FAVICON_LIMITS.maxBytes)]);
    expect(checkFavicon(big)).toMatchObject({ ok: false, reason: expect.stringContaining('larger than') });
    expect(checkFavicon(Buffer.from('GIF89a......'))).toMatchObject({ ok: false });
  });
});

describe('dataUrlBytes', () => {
  it('decodes small inline images', () => {
    const png = pngHeader(16, 16);
    expect(dataUrlBytes(`data:image/png;base64,${png.toString('base64')}`)).toEqual(png);
  });

  it('refuses oversized inline images without decoding them', () => {
    const huge = `data:image/png;base64,${'A'.repeat(FAVICON_LIMITS.maxBytes * 2)}`;
    expect(dataUrlBytes(huge)).toBeNull();
    expect(dataUrlBytes('data:text/html,<b>x</b>')).toBeNull();
  });
});

describe('readLimited', () => {
  const stream = (chunks: number, size: number) =>
    new Response(
      new ReadableStream({
        start(c) {
          for (let i = 0; i < chunks; i++) c.enqueue(new Uint8Array(size));
          c.close();
        },
      }),
    );

  it('reads a small body', async () => {
    expect((await readLimited(stream(2, 10), 100)).length).toBe(20);
  });

  it('stops as soon as a body is too large, even without a declared length', async () => {
    await expect(readLimited(stream(50, 10), 100)).rejects.toThrow('too large');
  });

  it('refuses a declared length over the limit without reading', async () => {
    const r = new Response('x', { headers: { 'content-length': '999999' } });
    await expect(readLimited(r, 100)).rejects.toThrow('too large');
  });
});

describe('FaviconLoader', () => {
  const ok = (bytes: Buffer) => new Response(new Uint8Array(bytes));
  /**
   * The loader's own wait before it fetches (settleMs) runs on a clock
   * the check moves, so these do not depend on how fast the machine is:
   * on real timers they slept 20 to 120 ms and hoped that was enough.
   */
  const ownClock = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the first usable favicon', async () => {
    const loader = new FaviconLoader(async () => ok(pngHeader(16, 16)), () => 'data:image/png;base64,ok', fast);
    expect(await loader.load(['https://a.example/i.png'], new AbortController().signal)).toBe('data:image/png;base64,ok');
  });

  it('skips images that fail the checks and tries the next address', async () => {
    const decoded: number[] = [];
    const loader = new FaviconLoader(
      async (url) => ok(url.includes('big') ? pngHeader(20000, 20000) : pngHeader(16, 16)),
      (b) => (decoded.push(b.length), 'data:image/png;base64,small'),
      fast,
    );
    expect(await loader.load(['https://a.example/big.png', 'https://a.example/small.png'], new AbortController().signal)).toBe(
      'data:image/png;base64,small',
    );
    expect(decoded).toHaveLength(1); // the huge one was never decoded
  });

  it('gives up on a slow server after the timeout', async () => {
    const loader = new FaviconLoader(
      (_url, init) =>
        new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))),
      () => 'never',
      fast,
    );
    const start = Date.now();
    expect(await loader.load(['https://slow.example/i.png'], new AbortController().signal)).toBeNull();
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it('a new request cancels the one in progress, and only the latest reports', async () => {
    const signals: AbortSignal[] = [];
    const loader = new FaviconLoader(
      (url, init) => {
        signals.push(init.signal);
        return url.includes('first')
          ? new Promise((_r, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))))
          : Promise.resolve(ok(pngHeader(16, 16)));
      },
      () => 'data:image/png;base64,latest',
      { ...fast, timeoutMs: 5000 },
    );
    const results: string[] = [];
    ownClock();
    loader.request(['https://a.example/first.png'], (d) => results.push(d));
    await vi.advanceTimersByTimeAsync(20);
    expect(signals).toHaveLength(1); // the first fetch is under way
    loader.request(['https://a.example/second.png'], (d) => results.push(d));
    await vi.advanceTimersByTimeAsync(50);
    expect(signals[0]!.aborted).toBe(true);
    // The second fetch has begun; its answer is read and decoded in turns of its own.
    await vi.waitFor(() => expect(results).toEqual(['data:image/png;base64,latest']));
  });

  it('waits for a page to stop changing its favicon before fetching', async () => {
    const fetched: string[] = [];
    const loader = new FaviconLoader(
      async (url) => (fetched.push(url), ok(pngHeader(16, 16))),
      () => 'data:image/png;base64,x',
      { ...fast, settleMs: 40 },
    );
    ownClock();
    for (let i = 0; i < 20; i++) loader.request([`https://a.example/i.png?v=${i}`], () => undefined);
    await vi.advanceTimersByTimeAsync(39);
    expect(fetched).toEqual([]); // still waiting, a moment before the 40 ms are up
    await vi.advanceTimersByTimeAsync(81);
    expect(fetched).toEqual(['https://a.example/i.png?v=19']);
  });

  it('cancel() stops a pending request', async () => {
    const results: string[] = [];
    let fetches = 0;
    const loader = new FaviconLoader(async () => (fetches++, ok(pngHeader(16, 16))), () => 'x', { ...fast, settleMs: 30 });
    ownClock();
    loader.request(['https://a.example/i.png'], (d) => results.push(d));
    loader.cancel();
    await vi.advanceTimersByTimeAsync(80);
    // Nothing was fetched (a fetch begins the moment the wait ends), so nothing can come later either.
    expect(fetches).toBe(0);
    expect(results).toEqual([]);
  });
});

describe('FaviconLoader cancels what it refuses (PR #7 review)', () => {
  /**
   * A fake server connection: a body that never finishes, and a record of
   * whether it is still open (a cancelled body or an aborted request closes it).
   */
  function endless(status: number, declared: number | null, log: { open: number; maxOpen: number; closed: number }) {
    return (_url: string, init: { signal: AbortSignal }) => {
      log.open += 1;
      log.maxOpen = Math.max(log.maxOpen, log.open);
      let closed = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let settle: (() => void) | undefined;
      const close = () => {
        if (closed) return;
        closed = true;
        // Stop the pending chunk so nothing is written to a closed stream.
        clearTimeout(timer);
        settle?.();
        log.open -= 1;
        log.closed += 1;
      };
      init.signal.addEventListener('abort', close);
      const body = new ReadableStream<Uint8Array>({
        pull: (c) => {
          // An aborted request fails its body, as a real fetch does.
          if (closed) return c.error(new Error('aborted'));
          return new Promise<void>((r) => {
            settle = r;
            timer = setTimeout(() => {
              settle = undefined;
              c.enqueue(new Uint8Array(1024));
              r();
            }, 5);
          });
        },
        cancel: close,
      });
      const headers: Record<string, string> = declared === null ? {} : { 'content-length': String(declared) };
      return Promise.resolve(new Response(body, { status, headers }));
    };
  }

  it('closes each download refused for its declared size before trying the next', async () => {
    const log = { open: 0, maxOpen: 0, closed: 0 };
    const loader = new FaviconLoader(endless(200, 10 * 1024 * 1024, log), () => 'never', { ...fast, timeoutMs: 5000 });
    const urls = ['https://a.example/1.png', 'https://a.example/2.png', 'https://a.example/3.png'];
    expect(await loader.load(urls, new AbortController().signal)).toBeNull();
    expect(log.closed).toBe(3);
    expect(log.open).toBe(0);
    expect(log.maxOpen).toBe(1); // never two at once
  });

  it('closes a download answered with an error status', async () => {
    const log = { open: 0, maxOpen: 0, closed: 0 };
    const loader = new FaviconLoader(endless(500, null, log), () => 'never', { ...fast, timeoutMs: 5000 });
    expect(await loader.load(['https://a.example/1.png', 'https://a.example/2.png'], new AbortController().signal)).toBeNull();
    expect(log.closed).toBe(2);
    expect(log.maxOpen).toBe(1);
  });

  it('closes a download that streams past the size limit without declaring it', async () => {
    const log = { open: 0, maxOpen: 0, closed: 0 };
    const loader = new FaviconLoader(endless(200, null, log), () => 'never', { ...fast, maxBytes: 8 * 1024, timeoutMs: 5000 });
    expect(await loader.load(['https://a.example/1.png'], new AbortController().signal)).toBeNull();
    expect(log.closed).toBe(1);
    expect(log.open).toBe(0);
  });
});
