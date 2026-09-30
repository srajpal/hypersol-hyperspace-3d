import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe as group, expect, it, vi } from 'vitest';
import { Budget, Claim, LIMITS, LeftOut, Unreadable, describe, hdrSize, headerSize, pictureSize, soundSeconds } from './budget';

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

group('what a load holds of the page, and gives back (review 134, V3, V4, V6)', () => {
  const ORIGIN = 'http://127.0.0.1:1';
  const at = (p: string) => new URL(p, ORIGIN);
  afterEach(() => vi.unstubAllGlobals());

  it('a claim charges the page and gives back exactly what it charged, once', () => {
    const budget = new Budget();
    const a = new Claim(budget);
    const b = new Claim(budget);
    a.addBytes(1000);
    a.setTriangles(300);
    a.setPixels(4096 * 4096);
    a.setSeconds(12.5);
    b.addBytes(10);
    b.setTriangles(7);
    expect(budget).toMatchObject({ bytes: 1010, triangles: 307, pixels: 4096 * 4096, seconds: 12.5 });
    // Counted again once decoded: the page's total follows, up or down.
    a.setTriangles(450);
    expect(budget.triangles).toBe(457);
    a.setTriangles(20);
    expect(budget.triangles).toBe(27);
    a.release();
    expect(budget).toMatchObject({ bytes: 10, triangles: 7, pixels: 0, seconds: 0 });
    a.release();
    expect(budget).toMatchObject({ bytes: 10, triangles: 7, pixels: 0, seconds: 0 });
    b.release();
    expect(budget).toMatchObject({ bytes: 0, triangles: 0, pixels: 0, seconds: 0 });
  });

  it('a claim that would pass a total is refused, and keeps what it held', () => {
    const budget = new Budget();
    const a = new Claim(budget);
    a.setTriangles(LIMITS.triangles - 10);
    const b = new Claim(budget);
    b.setTriangles(5);
    expect(() => b.setTriangles(11)).toThrow(expect.objectContaining({ overTotal: true, reason: expect.stringMatching(/11 triangles would pass the page's 2,000,000/) }));
    expect(b.triangles).toBe(5);
    expect(budget.triangles).toBe(LIMITS.triangles - 5);
    a.setPixels(LIMITS.picturePixels);
    expect(() => b.setPixels(1)).toThrow(expect.objectContaining({ overTotal: true, reason: expect.stringMatching(/pixels of pictures in all/) }));
    a.setSeconds(LIMITS.soundSeconds - 1);
    expect(() => b.setSeconds(2)).toThrow(expect.objectContaining({ overTotal: true, reason: expect.stringMatching(/2 seconds of sound would pass the page's 600 seconds/) }));
    a.release();
    b.setTriangles(11);
    b.setPixels(1);
    b.setSeconds(2);
    expect(budget).toMatchObject({ triangles: 11, pixels: 1, seconds: 2 });
  });

  it("a model's load holds its bytes, triangles, and pictures' pixels in its claim, and a file that is not glTF holds nothing", async () => {
    const png = pngHead(1024, 512);
    const gltf = enc({
      nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      accessors: [{ count: 30 }],
      buffers: [{ uri: 'a.bin', byteLength: 2000 }],
      images: [{ uri: 'a.png' }],
    });
    serve({ '/a.gltf': gltf, '/a.bin': 2000, '/a.png': png.buffer as ArrayBuffer, '/not.gltf': new TextEncoder().encode('this is not a model').buffer as ArrayBuffer });
    const budget = new Budget();
    const files = await budget.load(at('/a.gltf'), ORIGIN);
    expect(files.claim).toMatchObject({ bytes: gltf.byteLength + 2000 + png.length, triangles: 10, pixels: 1024 * 512 });
    expect(budget).toMatchObject({ bytes: files.bytes, triangles: 10, pixels: 1024 * 512 });
    const bad = await budget.load(at('/not.gltf'), ORIGIN).catch((e: unknown) => e);
    expect(bad).toBeInstanceOf(Unreadable);
    expect(budget).toMatchObject({ bytes: files.bytes, triangles: 10, pixels: 1024 * 512 });
    // Decoding failed, or the model was let go: everything it held stops counting, whatever was charged.
    files.claim.setTriangles(12);
    files.claim.release();
    expect(budget).toMatchObject({ bytes: 0, triangles: 0, pixels: 0 });
  });

  it('a file other than a model holds its bytes in its claim', async () => {
    serve({ '/chime.ogg': 5000 });
    const budget = new Budget();
    const { claim, bytes } = await budget.file(at('/chime.ogg'), ORIGIN);
    expect(bytes).toBe(5000);
    expect(budget.bytes).toBe(5000);
    claim.release();
    expect(budget.bytes).toBe(0);
  });

  it("a model whose pictures would pass the page's pixels is left out, holding nothing", async () => {
    const images = Array.from({ length: 9 }, (_, i) => ({ uri: `p${i}.png` }));
    const files: Record<string, ArrayBuffer | number> = { '/many.gltf': enc({ images }) };
    for (let i = 0; i < 9; i++) files[`/p${i}.png`] = pngHead(4096, 4096).buffer as ArrayBuffer;
    serve(files);
    const budget = new Budget();
    await expect(budget.load(at('/many.gltf'), ORIGIN)).rejects.toMatchObject({ overTotal: true, reason: expect.stringMatching(/pixels of pictures in all/) });
    expect(budget).toMatchObject({ bytes: 0, pixels: 0 });
  });
});

group('reading a hostile or unusual model before decoding it (review 134, V4, V5, V10)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('counts nodes that share their children once each, in no time: 64 levels of two shared children', () => {
    // Level i holds level i + 1 twice; the last holds a mesh of one triangle: 2^64 paths to it.
    const nodes: { children?: number[]; mesh?: number }[] = Array.from({ length: 64 }, (_, i) => ({ children: [i + 1, i + 1] }));
    nodes.push({ mesh: 0 });
    const gltf = { scene: 0, scenes: [{ nodes: [0] }], nodes, meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], accessors: [{ count: 3 }] };
    const start = performance.now();
    const d = describe(enc(gltf));
    expect(performance.now() - start).toBeLessThan(200);
    // As often as the scene uses it: far past the limit, so it is refused as too many triangles.
    expect(d.triangles).toBe(2 ** 64);
    expect(d.triangles).toBeGreaterThan(LIMITS.triangles);
  });

  it('a node that holds itself, a child that does not exist, and a chain 100,000 deep are read without hanging or failing', () => {
    const loop = { scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, children: [1, 7, -1] }, { mesh: 0, children: [0, 1] }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], accessors: [{ count: 9 }] };
    expect(describe(enc(loop)).triangles).toBe(6);
    const deep = { scenes: [{ nodes: [0] }], nodes: Array.from({ length: 100_000 }, (_, i) => (i < 99_999 ? { children: [i + 1] } : { mesh: 0 })), meshes: loop.meshes, accessors: loop.accessors };
    expect(describe(enc(deep)).triangles).toBe(3);
  });

  it('counts strips and fans as they are drawn, and a mesh the file repeats (EXT_mesh_gpu_instancing) as often as it says', () => {
    const gltf = {
      scenes: [{ nodes: [0, 1] }],
      nodes: [{ mesh: 0 }, { mesh: 1, extensions: { EXT_mesh_gpu_instancing: { attributes: { TRANSLATION: 3 } } } }],
      meshes: [
        { primitives: [{ mode: 5, attributes: { POSITION: 0 } }, { mode: 6, indices: 1, attributes: { POSITION: 0 } }, { mode: 1, attributes: { POSITION: 0 } }] },
        { primitives: [{ attributes: { POSITION: 2 } }] },
      ],
      accessors: [{ count: 10 }, { count: 7 }, { count: 300 }, { count: 5000 }],
    };
    // A strip of 10 corners is 8 triangles, a fan of 7 is 5, lines are none; 100 triangles drawn 5,000 times.
    expect(describe(enc(gltf)).triangles).toBe(8 + 5 + 100 * 5000);
  });

  it('counts that are not counts are nothing, not a number that poisons the total', () => {
    const gltf = { nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }, { attributes: { POSITION: 1 } }, { attributes: { POSITION: 2 } }] }], accessors: [{ count: 'many' }, { count: -30 }, { count: 9 }] };
    expect(describe(enc(gltf)).triangles).toBe(3);
  });

  it("reads the size of a picture kept in a file the model names (a .gltf's picture in its .bin)", async () => {
    const png = pngHead(6000, 10);
    const bin = new Uint8Array(500 + png.length);
    bin.set(png, 500);
    const gltf = enc({ buffers: [{ uri: 'a.bin', byteLength: bin.length }], bufferViews: [{ buffer: 0, byteOffset: 500, byteLength: png.length }], images: [{ bufferView: 0 }] });
    expect(describe(gltf).picturesIn.get('a.bin')).toEqual([{ offset: 500, length: png.length }]);
    serve({ '/a.gltf': gltf, '/a.bin': bin.buffer as ArrayBuffer });
    const budget = new Budget();
    await expect(budget.load(new URL('http://127.0.0.1:1/a.gltf'), 'http://127.0.0.1:1')).rejects.toMatchObject({ reason: expect.stringMatching(/6000 by 10 pixels is larger than 4096/) });
    expect(budget.bytes).toBe(0);
    // In a buffer written into the file itself (a data: address), too.
    const inline = enc({ buffers: [{ uri: `data:application/octet-stream;base64,${Buffer.from(bin).toString('base64')}` }], bufferViews: [{ buffer: 0, byteOffset: 500, byteLength: png.length }], images: [{ bufferView: 0 }] });
    expect(describe(inline).embeddedPictures).toEqual([{ width: 6000, height: 10 }]);
  });

  it('a file of meshes is not taken for a picture by its first bytes', async () => {
    // A .bin that happens to start like a BMP ("BM").
    const bin = new Uint8Array(64).fill(0xff);
    bin.set([0x42, 0x4d], 0);
    serve({ '/a.gltf': enc({ buffers: [{ uri: 'a.bin', byteLength: 64 }] }), '/a.bin': bin.buffer as ArrayBuffer });
    const budget = new Budget();
    await expect(budget.load(new URL('http://127.0.0.1:1/a.gltf'), 'http://127.0.0.1:1')).resolves.toMatchObject({ pictures: [] });
  });

  it('reads GIF, BMP, and AVIF sizes from their headers, for pictures inside models', () => {
    const gif = new Uint8Array(16);
    gif.set([...'GIF89a'].map((c) => c.charCodeAt(0)));
    gif.set([0x00, 0x20, 0x10, 0x00], 6); // 8192 wide, 16 high
    expect(headerSize(gif)).toEqual({ width: 8192, height: 16 });
    const bmp = new Uint8Array(30);
    bmp.set([0x42, 0x4d]);
    new DataView(bmp.buffer).setInt32(18, 5000, true);
    new DataView(bmp.buffer).setInt32(22, -300, true);
    expect(headerSize(bmp)).toEqual({ width: 5000, height: 300 });
    const avif = new Uint8Array(120);
    const word = (at: number, text: string) => avif.set([...text].map((c) => c.charCodeAt(0)), at);
    word(4, 'ftypavif');
    // A tile's size, then the whole picture's.
    word(40, 'ispe');
    new DataView(avif.buffer).setUint32(48, 512);
    new DataView(avif.buffer).setUint32(52, 512);
    word(80, 'ispe');
    new DataView(avif.buffer).setUint32(88, 9000);
    new DataView(avif.buffer).setUint32(92, 4500);
    expect(headerSize(avif)).toEqual({ width: 9000, height: 4500 });
    expect(headerSize(pngHead(640, 480))).toEqual({ width: 640, height: 480 });
    expect(headerSize(new Uint8Array(64))).toBeNull();
    // The page's own pictures stay PNG, JPEG, or WebP.
    expect(pictureSize(gif)).toBeNull();
  });

  it("reads an HDR panorama's size from the text at its start", () => {
    const hdr = (text: string) => new TextEncoder().encode(text);
    expect(hdrSize(hdr('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 8192 +X 16384\n\u0002\u0002'))).toEqual({ width: 16384, height: 8192 });
    expect(hdrSize(hdr('#?RADIANCE\n# made by a test\nEXPOSURE=1\nFORMAT=32-bit_rle_rgbe\n\n-Y 32 +X 64\n'))).toEqual({ width: 64, height: 32 });
    expect(hdrSize(hdr('not a picture'))).toBeNull();
  });
});

group("how long a sound is, from its file's header (review 134, V6)", () => {
  const fixture = (path: string) => new Uint8Array(readFileSync(fileURLToPath(new URL(`../../../../tests/fixtures/holoml/${path}`, import.meta.url))));
  const letters = (text: string) => [...text].map((c) => c.charCodeAt(0));

  it('a WAV file: its data over its bytes a second', () => {
    // 16-bit, one channel, 22,050 samples a second, one second.
    const wav = new Uint8Array(44 + 44_100);
    const v = new DataView(wav.buffer);
    wav.set(letters('RIFF'), 0);
    wav.set(letters('WAVEfmt '), 8);
    v.setUint32(16, 16, true);
    v.setUint32(28, 44_100, true);
    wav.set(letters('data'), 36);
    v.setUint32(40, 44_100, true);
    expect(soundSeconds(wav)).toBeCloseTo(1, 5);
    // A length larger than the file (a header that is wrong, or a stream): what is there counts.
    v.setUint32(40, 0xffffffff, true);
    expect(soundSeconds(wav)).toBeCloseTo(1, 5);
  });

  it('an Ogg file: the position of its last page over its samples a second', () => {
    const page = (granule: number, body: number[]) => {
      const b = new Uint8Array(27 + 1 + body.length);
      b.set(letters('OggS'));
      new DataView(b.buffer).setUint32(6, granule, true);
      b[26] = 1;
      b[27] = body.length;
      b.set(body, 28);
      return b;
    };
    const vorbis = [1, ...letters('vorbis'), 0, 0, 0, 0, 2, 0x44, 0xac, 0, 0]; // two channels, 44,100 a second
    const opus = [...letters('OpusHead'), 1, 2, 0, 0];
    const join = (...parts: Uint8Array[]) => {
      const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      let at = 0;
      for (const p of parts) {
        out.set(p, at);
        at += p.length;
      }
      return out;
    };
    expect(soundSeconds(join(page(0, vorbis), page(88_200, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])))).toBeCloseTo(2, 5);
    expect(soundSeconds(join(page(0, opus), page(48_000 * 90, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0])))).toBeCloseTo(90, 5);
    expect(soundSeconds(join(page(0, letters('somethingelse'))))).toBeNull();
  });

  it('an MP3 file: its count of frames where it has one, and not told otherwise', () => {
    // MPEG 1 layer III, 44,100 samples a second, two channels: a "Xing" part after 32 bytes, with 1,000 frames.
    const mp3 = new Uint8Array(200);
    mp3.set([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 10], 0); // an ID3 tag of 10 bytes
    mp3.set([0xff, 0xfb, 0x90, 0x00], 20);
    mp3.set(letters('Xing'), 20 + 4 + 32);
    new DataView(mp3.buffer).setUint32(20 + 4 + 32 + 4, 1);
    new DataView(mp3.buffer).setUint32(20 + 4 + 32 + 8, 1000);
    expect(soundSeconds(mp3)).toBeCloseTo((1000 * 1152) / 44_100, 5);
    mp3.fill(0, 20 + 4 + 32, 20 + 4 + 32 + 12);
    expect(soundSeconds(mp3)).toBeNull();
    expect(soundSeconds(new Uint8Array(64))).toBeNull();
  });

  it('reads the sounds of the examples: a few seconds each', () => {
    for (const [file, least, most] of [
      ['blockworld/sounds/birds.wav', 1, 20],
      ['blockworld/sounds/break.ogg', 0.05, 5],
      ['blockworld/sounds/won.ogg', 0.05, 10],
      ['aquarium/sounds/water.wav', 1, 20],
      ['harbour-loft/sounds/door.wav', 0.1, 5],
    ] as const) {
      const seconds = soundSeconds(fixture(file));
      expect(seconds, file).not.toBeNull();
      expect(seconds!, file).toBeGreaterThan(least);
      expect(seconds!, file).toBeLessThan(most);
    }
  });
});
