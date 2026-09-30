import { afterEach, describe, expect, it, vi } from 'vitest';
import { Budget, LIMITS } from './budget';
import { Pictures } from './pictures';

const ORIGIN = 'http://127.0.0.1:1';
const at = (p: string) => new URL(p, ORIGIN);

/** A PNG's first bytes, claiming a size (enough for its header to be read). */
function png(width: number, height: number, size = 1000): Uint8Array {
  const b = new Uint8Array(size);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

/** fetch() answering pictures from a table, counting the requests; decoding gives a bitmap that notes when it is closed. */
function serve(files: Record<string, Uint8Array>): { fetched: string[]; closed: number } {
  const seen = { fetched: [] as string[], closed: 0 };
  vi.stubGlobal('fetch', async (url: URL) => {
    seen.fetched.push(url.pathname);
    const file = files[url.pathname];
    return file ? new Response(file.slice(), { status: 200 }) : new Response(null, { status: 404 });
  });
  vi.stubGlobal('createImageBitmap', async () => ({ width: 64, height: 64, close: () => (seen.closed += 1) }));
  return seen;
}

describe("A page's pictures let go with the models that use them (loading by area, milestone 20)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps a picture while any material uses it, and lets it go (its bytes, its decoded image) with the last', async () => {
    const seen = serve({ '/fabric.png': png(64, 64) });
    const budget = new Budget();
    const pictures = new Pictures(budget, ORIGIN);
    const a = await pictures.texture(at('/fabric.png'), 'color', [1, 1]);
    const b = await pictures.texture(at('/fabric.png'), 'color', [2, 2]);
    // One file, fetched and counted once however many use it.
    expect(seen.fetched).toEqual(['/fabric.png']);
    expect(budget.bytes).toBe(1000);
    pictures.release(a, true);
    await Promise.resolve();
    expect(budget.bytes).toBe(1000);
    expect(seen.closed).toBe(0);
    pictures.release(b, true);
    await vi.waitFor(() => expect(budget.bytes).toBe(0));
    expect(seen.closed).toBe(1);
    // Wanted again: fetched and counted again.
    await pictures.texture(at('/fabric.png'), 'color', [1, 1]);
    expect(seen.fetched).toEqual(['/fabric.png', '/fabric.png']);
    expect(budget.bytes).toBe(1000);
  });

  it('keeps a picture that a removed model used (holoml.remove), and one the page shows itself', async () => {
    const seen = serve({ '/wood.png': png(64, 64), '/plan.png': png(64, 64, 500) });
    const budget = new Budget();
    const pictures = new Pictures(budget, ORIGIN);
    pictures.release(await pictures.texture(at('/wood.png'), 'color', [1, 1]), false);
    await Promise.resolve();
    expect(budget.bytes).toBe(1000);
    await pictures.texture(at('/wood.png'), 'data', [1, 1]);
    expect(seen.fetched).toEqual(['/wood.png']);
    // A floor plan's picture, used by a material too: the page keeps it.
    await pictures.address(at('/plan.png'));
    pictures.release(await pictures.texture(at('/plan.png'), 'color', [1, 1]), true);
    await Promise.resolve();
    expect(budget.bytes).toBe(1500);
    expect(seen.closed).toBe(0);
  });

  it('a picture that failed stays failed, and its use ends with the failure', async () => {
    const seen = serve({ '/huge.png': png(8192, 8192) });
    const budget = new Budget();
    const pictures = new Pictures(budget, ORIGIN);
    await expect(pictures.texture(at('/huge.png'), 'color', [1, 1])).rejects.toMatchObject({ reason: expect.stringMatching(/larger than 4096/) });
    await expect(pictures.texture(at('/huge.png'), 'color', [1, 1])).rejects.toBeDefined();
    expect(seen.fetched).toEqual(['/huge.png']);
    expect(budget.bytes).toBe(0);
  });
});

describe("the page's pixels of pictures (review 134, V6 and V10)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it('counts each picture by its header before decoding it, and leaves out the one that would pass the limit, with its bytes', async () => {
    const files: Record<string, Uint8Array> = {};
    for (let i = 0; i < 9; i++) files[`/p${i}.png`] = png(4096, 4096);
    const seen = serve(files);
    const decoded = vi.fn(async () => ({ width: 4096, height: 4096, close: () => (seen.closed += 1) }));
    vi.stubGlobal('createImageBitmap', decoded);
    const budget = new Budget();
    const pictures = new Pictures(budget, ORIGIN);
    const shown = [];
    for (let i = 0; i < 8; i++) shown.push(await pictures.texture(at(`/p${i}.png`), 'color', [1, 1]));
    expect(budget.pixels).toBe(LIMITS.picturePixels);
    expect(budget.bytes).toBe(8000);
    await expect(pictures.texture(at('/p8.png'), 'color', [1, 1])).rejects.toMatchObject({ overTotal: true, reason: expect.stringMatching(/pixels of pictures in all/) });
    // Left out before it was decoded, and it holds nothing.
    expect(decoded).toHaveBeenCalledTimes(8);
    expect(budget.pixels).toBe(LIMITS.picturePixels);
    expect(budget.bytes).toBe(8000);
    // A picture let go (its model was, loading by area) gives its pixels back.
    pictures.release(shown[0]!, true);
    await vi.waitFor(() => expect(budget.pixels).toBe(LIMITS.picturePixels - 4096 * 4096));
    expect(budget.bytes).toBe(7000);
  });

  it("reads an HDR panorama's size from its header, and leaves a huge one out without unpacking it", async () => {
    // Only the header: unpacking it would fail as "not an HDR picture", not as too large.
    const header = new TextEncoder().encode('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 8192 +X 16384\n');
    serve({ '/sky.hdr': header });
    const budget = new Budget();
    const pictures = new Pictures(budget, ORIGIN);
    await expect(pictures.environment(at('/sky.hdr'))).rejects.toMatchObject({ reason: 'a picture of 16384 by 8192 pixels is larger than 4096 by 4096' });
    expect(budget).toMatchObject({ bytes: 0, pixels: 0 });
  });

  it('a picture the page shows itself that cannot be drawn after all gives back what it held', async () => {
    serve({ '/plan.png': png(200, 200, 500) });
    const budget = new Budget();
    const pictures = new Pictures(budget, ORIGIN);
    await pictures.address(at('/plan.png'));
    expect(budget).toMatchObject({ bytes: 500, pixels: 40_000 });
    pictures.discard(at('/plan.png'));
    await vi.waitFor(() => expect(budget).toMatchObject({ bytes: 0, pixels: 0 }));
  });
});
