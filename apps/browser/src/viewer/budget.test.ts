import { afterEach, describe as group, expect, it, vi } from 'vitest';
import { Budget, LIMITS, LeftOut, describe, pictureSize } from './budget';

const enc = (o: unknown) => new TextEncoder().encode(JSON.stringify(o)).buffer as ArrayBuffer;

/** A PNG header claiming a size (no picture data: never decoded). */
function pngHead(width: number, height: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

group('HoloML resource limits: reading a model before decoding it (milestone 15, issue #23)', () => {
  it('counts triangles from the file, each mesh as often as the scene uses it', () => {
    const gltf = {
      scene: 0,
      scenes: [{ nodes: [0, 1] }],
      nodes: [{ mesh: 0 }, { children: [2, 3] }, { mesh: 0 }, { mesh: 1 }],
      meshes: [{ primitives: [{ indices: 0, attributes: { POSITION: 1 } }] }, { primitives: [{ attributes: { POSITION: 2 } }] }],
      accessors: [{ count: 300 }, { count: 50 }, { count: 30 }],
    };
    // Mesh 0: 100 triangles, used twice; mesh 1: 10, once.
    expect(describe(enc(gltf)).triangles).toBe(210);
  });

  it('lists the files a glTF names, not its data: addresses', () => {
    const gltf = { buffers: [{ uri: 'car.bin' }, { uri: 'data:application/octet-stream;base64,AAAA' }], images: [{ uri: 'paint.png' }] };
    expect(describe(enc(gltf)).externalUris).toEqual(['car.bin', 'paint.png']);
  });

  it('reads the size of a picture stored in a data: address', () => {
    const b64 = Buffer.from(pngHead(8192, 8192)).toString('base64');
    const gltf = { images: [{ uri: `data:image/png;base64,${b64}` }] };
    expect(describe(enc(gltf)).embeddedPictures).toEqual([{ width: 8192, height: 8192 }]);
  });

  it('reads a .glb: its triangles and a picture in its binary part', () => {
    const png = pngHead(5000, 10);
    const json = new TextEncoder().encode(
      JSON.stringify({
        nodes: [{ mesh: 0 }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
        accessors: [{ count: 9 }],
        images: [{ bufferView: 0 }],
        bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: png.length }],
      }).padEnd(Math.ceil(200 / 4) * 4, ' '),
    );
    const pad = (n: number) => n + ((4 - (n % 4)) % 4);
    const jsonLen = pad(json.length);
    const binLen = pad(png.length);
    const glb = new Uint8Array(12 + 8 + jsonLen + 8 + binLen);
    const v = new DataView(glb.buffer);
    v.setUint32(0, 0x46546c67, true);
    v.setUint32(4, 2, true);
    v.setUint32(8, glb.length, true);
    v.setUint32(12, jsonLen, true);
    v.setUint32(16, 0x4e4f534a, true);
    glb.set(json, 20);
    glb.fill(0x20, 20 + json.length, 20 + jsonLen);
    v.setUint32(20 + jsonLen, binLen, true);
    v.setUint32(24 + jsonLen, 0x004e4942, true);
    glb.set(png, 28 + jsonLen);
    const d = describe(glb.buffer);
    expect(d.triangles).toBe(3);
    expect(d.embeddedPictures).toEqual([{ width: 5000, height: 10 }]);
  });

  it('reads PNG, JPEG, and WebP sizes from their headers', () => {
    expect(pictureSize(pngHead(640, 480))).toEqual({ width: 640, height: 480 });
    // A JPEG: SOI, an APP0 segment, then a baseline start of frame (height 300, width 400).
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x01, 0x90, 0x03]);
    expect(pictureSize(jpeg)).toEqual({ width: 400, height: 300 });
    const webp = new Uint8Array(30);
    webp.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0);
    webp.set([...'WEBPVP8X'].map((c) => c.charCodeAt(0)), 8);
    webp.set([0xff, 0x0f, 0x00, 0x7f, 0x07, 0x00], 24); // 4096 wide, 1920 high
    expect(pictureSize(webp)).toEqual({ width: 4096, height: 1920 });
    expect(pictureSize(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

/** A model of the given triangles whose one buffer is `size` bytes at `bin`. */
function model(triangles: number, bin: string, size: number): ArrayBuffer {
  return enc({
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ indices: 0, attributes: { POSITION: 1 } }] }],
    accessors: [{ count: triangles * 3 }, { count: 3 }],
    buffers: [{ uri: bin, byteLength: size }],
  });
}

/** fetch() answering from a table of files, each streamed in 1 MB pieces. */
function serve(files: Record<string, ArrayBuffer | number>): void {
  vi.stubGlobal('fetch', async (url: URL) => {
    const file = files[url.pathname];
    if (file === undefined) return new Response(null, { status: 404 });
    const bytes = typeof file === 'number' ? new Uint8Array(file) : new Uint8Array(file);
    let at = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        if (at >= bytes.length) return c.close();
        c.enqueue(bytes.subarray(at, at + 1024 * 1024));
        at += 1024 * 1024;
      },
    });
    return new Response(body, { status: 200 });
  });
}

group('HoloML resource limits: loading within the page budget', () => {
  const ORIGIN = 'http://127.0.0.1:1';
  const at = (p: string) => new URL(p, ORIGIN);
  afterEach(() => vi.unstubAllGlobals());

  it('leaves out a file over the one-file limit and stops counting its bytes', async () => {
    const MB = 1024 * 1024;
    serve({ '/big.gltf': model(1, 'big.bin', 40 * MB), '/big.bin': 40 * MB, '/small.gltf': model(1, 'small.bin', MB), '/small.bin': MB });
    const budget = new Budget();
    const big = await budget.load(at('/big.gltf'), ORIGIN).catch((e: unknown) => e);
    expect(big).toBeInstanceOf(LeftOut);
    expect((big as LeftOut).reason).toMatch(/larger than 32 MB/);
    expect(budget.bytes).toBe(0);
    expect(budget.triangles).toBe(0);
    const small = await budget.load(at('/small.gltf'), ORIGIN);
    expect(small.bytes).toBe(budget.bytes);
    expect(budget.triangles).toBe(1);
  });

  it('lets models loading side by side pass neither the triangle nor the byte limit together', async () => {
    const MB = 1024 * 1024;
    const half = LIMITS.triangles / 2 + 1;
    const files: Record<string, ArrayBuffer | number> = {};
    for (const n of [1, 2]) {
      files[`/t${n}.gltf`] = model(half, `t${n}.bin`, 1024);
      files[`/t${n}.bin`] = 1024;
    }
    for (const n of [1, 2, 3, 4, 5]) {
      files[`/b${n}.gltf`] = model(1, `b${n}.bin`, 30 * MB);
      files[`/b${n}.bin`] = 30 * MB;
    }
    serve(files);
    const budget = new Budget();
    const tris = await Promise.allSettled([1, 2].map((n) => budget.load(at(`/t${n}.gltf`), ORIGIN)));
    expect(tris.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(budget.triangles).toBe(half);
    const bytes = await Promise.allSettled([1, 2, 3, 4, 5].map((n) => budget.load(at(`/b${n}.gltf`), ORIGIN)));
    const out = bytes.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(out).toHaveLength(1);
    expect((out[0]!.reason as LeftOut).reason).toMatch(/128 MB/);
    expect((out[0]!.reason as LeftOut).overTotal).toBe(true);
    expect(budget.bytes).toBeLessThanOrEqual(LIMITS.totalBytes);
  });

  it("marks what would pass the page's totals, which fall again as models are let go (milestone 20), apart from the one-file limit", async () => {
    const MB = 1024 * 1024;
    const half = LIMITS.triangles / 2 + 1;
    serve({
      '/t1.gltf': model(half, 't1.bin', 1024),
      '/t1.bin': 1024,
      '/t2.gltf': model(half, 't2.bin', 1024),
      '/t2.bin': 1024,
      '/big.gltf': model(1, 'big.bin', 40 * MB),
      '/big.bin': 40 * MB,
    });
    const budget = new Budget();
    const first = await budget.load(at('/t1.gltf'), ORIGIN);
    const over = (await budget.load(at('/t2.gltf'), ORIGIN).catch((e: unknown) => e)) as LeftOut;
    expect(over).toMatchObject({ overTotal: true, reason: expect.stringMatching(/triangles would pass/) });
    expect(() => budget.useTriangles(half)).toThrow(expect.objectContaining({ overTotal: true }));
    expect((await budget.load(at('/big.gltf'), ORIGIN).catch((e: unknown) => e)) as LeftOut).toMatchObject({ overTotal: false });
    // Let go: its triangles and bytes stop counting, and the other fits.
    budget.releaseTriangles(half);
    budget.releaseBytes(first.bytes);
    expect(budget.triangles).toBe(0);
    expect(budget.bytes).toBe(0);
    await expect(budget.load(at('/t2.gltf'), ORIGIN)).resolves.toMatchObject({ triangles: half });
  });

  it('refuses a file from another site, and stops every load at once', async () => {
    serve({ '/away.gltf': model(1, 'http://example.test/x.bin', 10), '/slow.gltf': model(1, 'slow.bin', 10) });
    const budget = new Budget();
    await expect(budget.load(at('/away.gltf'), ORIGIN)).rejects.toMatchObject({ reason: expect.stringMatching(/another site/) });
    vi.stubGlobal('fetch', (_url: URL, init: RequestInit) => new Promise((_ok, fail) => init.signal!.addEventListener('abort', () => fail(init.signal!.reason))));
    const pending = budget.load(at('/slow.gltf'), ORIGIN);
    expect(budget.busy).toBe(true);
    budget.stop();
    await expect(pending).rejects.toMatchObject({ reason: expect.stringMatching(/stopped/) });
    expect(budget.busy).toBe(false);
  });
});
