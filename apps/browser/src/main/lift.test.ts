import { describe, expect, it } from 'vitest';
import { LIFT_LIMITS, captureArea, fetchModel, modelRequest, sameSite, zoomedArea, type ModelFetch } from './lift';

/**
 * Milestone 28 (checks LT2 and LT4): the main process's part of lifting,
 * without Electron. A model's files are fetched from the page's own site
 * only, within the HoloML viewer's limits.
 */

const PAGE = 'https://shop.example/catalogue/chairs.html';

describe('captureArea and zoomedArea', () => {
  it("takes a rectangle of the page's CSS pixels, and makes it the page's own pixels at its zoom", () => {
    expect(captureArea({ x: 10.5, y: 20, width: 100, height: 50 })).toEqual({ x: 10.5, y: 20, width: 100, height: 50 });
    expect(zoomedArea({ x: 10.5, y: 20, width: 100, height: 50 }, 1)).toEqual({ x: 10, y: 20, width: 101, height: 50 });
    expect(zoomedArea({ x: 10, y: 20, width: 100, height: 50 }, 1.5)).toEqual({ x: 15, y: 30, width: 150, height: 75 });
    expect(zoomedArea({ x: 10, y: 20, width: 100, height: 50 }, Number.NaN)).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('refuses what is not a rectangle of a page', () => {
    for (const bad of [null, 'all', { x: 0, y: 0, width: 0, height: 10 }, { x: 0, y: 0, width: 10 }, { x: -50, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: 30_000, height: 10 }, { x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 10 }]) {
      expect(captureArea(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe('sameSite and modelRequest', () => {
  it("is the page's own origin: scheme, host, and port", () => {
    expect(sameSite(PAGE, 'https://shop.example/models/chair.glb')).toBe(true);
    expect(sameSite(PAGE, 'http://shop.example/models/chair.glb')).toBe(false);
    expect(sameSite(PAGE, 'https://cdn.shop.example/models/chair.glb')).toBe(false);
    expect(sameSite(PAGE, 'https://shop.example:8443/models/chair.glb')).toBe(false);
    expect(sameSite('file:///C:/pages/chairs.html', 'file:///C:/pages/chair.glb')).toBe(false);
    expect(sameSite(PAGE, 'nonsense')).toBe(false);
  });

  it('asks for a model file on the web only', () => {
    expect(modelRequest({ webContentsId: 3, url: 'https://shop.example/chair.glb' })).toEqual({ webContentsId: 3, url: 'https://shop.example/chair.glb' });
    for (const bad of [null, { webContentsId: '3', url: 'https://shop.example/chair.glb' }, { webContentsId: 3, url: 'https://shop.example/chair.png' }, { webContentsId: 3, url: 'file:///chair.glb' }]) {
      expect(modelRequest(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

/** A glTF file: one mesh of `triangles` triangles over a buffer the file names, and pictures it names. */
function gltf(over: { buffer?: string; images?: string[]; triangles?: number; needs?: string[] } = {}): string {
  const triangles = over.triangles ?? 1;
  return JSON.stringify({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 1, componentType: 5123, count: triangles * 3, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: triangles * 6 },
    ],
    buffers: [{ uri: over.buffer ?? 'chair.bin', byteLength: 36 + triangles * 6 }],
    ...(over.images ? { images: over.images.map((uri) => ({ uri })) } : {}),
    ...(over.needs ? { extensionsRequired: over.needs } : {}),
  });
}

/** A PNG header that says it is w by h pixels (enough for the size check). */
function pngHeader(w: number, h: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
}

/** A site of files by address; each fetch is recorded. */
function site(files: Record<string, string | Uint8Array | { status?: number; redirect?: string; body?: string; hang?: boolean }>) {
  const asked: string[] = [];
  const fetchFn: ModelFetch = (url, init) => {
    asked.push(url);
    const f = files[url];
    if (f === undefined) return Promise.resolve(new Response('missing', { status: 404 }));
    if (typeof f === 'string' || f instanceof Uint8Array) return Promise.resolve(new Response(f as BodyInit));
    if (f.hang) {
      return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
    }
    const res = new Response(f.body ?? '', { status: f.status ?? 200 });
    if (f.redirect) Object.defineProperty(res, 'url', { value: f.redirect });
    return Promise.resolve(res);
  };
  return { asked, fetchFn };
}

describe('fetchModel', () => {
  it('fetches a model and the files it names on its site, by the addresses it names them with', async () => {
    const s = site({
      'https://shop.example/models/chair.gltf': gltf({ images: ['wood.png'] }),
      'https://shop.example/models/chair.bin': new Uint8Array(42),
      'https://shop.example/models/wood.png': pngHeader(512, 512),
    });
    const r = await fetchModel(PAGE, 'https://shop.example/models/chair.gltf', s.fetchFn);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resources.map((x) => x.uri)).toEqual(['chair.bin', 'wood.png']);
    expect(r.skipped).toEqual([]);
    expect(s.asked).toEqual(['https://shop.example/models/chair.gltf', 'https://shop.example/models/chair.bin', 'https://shop.example/models/wood.png']);
  });

  it("asks nothing of another site: a model there is refused, and a picture there is left out", async () => {
    const elsewhere = site({});
    expect(await fetchModel(PAGE, 'https://cdn.example/chair.glb', elsewhere.fetchFn)).toEqual({ ok: false, reason: "it is not on this page's own site" });
    expect(elsewhere.asked).toEqual([]);
    const s = site({
      'https://shop.example/chair.gltf': gltf({ images: ['https://tracker.example/pixel.png'] }),
      'https://shop.example/chair.bin': new Uint8Array(42),
    });
    const r = await fetchModel(PAGE, 'https://shop.example/chair.gltf', s.fetchFn);
    expect(r.ok && r.skipped).toEqual(['https://tracker.example/pixel.png']);
    expect(s.asked.some((u) => u.includes('tracker'))).toBe(false);
  });

  it('refuses a model that a redirect takes to another site', async () => {
    const s = site({ 'https://shop.example/chair.glb': { redirect: 'https://elsewhere.example/chair.glb', body: 'glTF' } });
    expect(await fetchModel(PAGE, 'https://shop.example/chair.glb', s.fetchFn)).toEqual({ ok: false, reason: "it is not on this page's own site" });
  });

  it("refuses by the viewer's limits, from what the file says of itself, before fetching what it names", async () => {
    const many = site({ 'https://shop.example/many.gltf': gltf({ triangles: LIFT_LIMITS.triangles + 1 }) });
    expect(await fetchModel(PAGE, 'https://shop.example/many.gltf', many.fetchFn)).toEqual({ ok: false, reason: 'it has more than 2,000,000 triangles' });
    expect(many.asked).toEqual(['https://shop.example/many.gltf']);
    const needs = site({ 'https://shop.example/needs.gltf': gltf({ needs: ['EXT_made_up'] }) });
    expect(await fetchModel(PAGE, 'https://shop.example/needs.gltf', needs.fetchFn)).toEqual({ ok: false, reason: 'it needs EXT_made_up, which the browser does not read' });
    const notModel = site({ 'https://shop.example/x.glb': 'hello' });
    expect(await fetchModel(PAGE, 'https://shop.example/x.glb', notModel.fetchFn)).toEqual({ ok: false, reason: 'it is not a glTF model' });
    const missing = site({});
    expect(await fetchModel(PAGE, 'https://shop.example/gone.glb', missing.fetchFn)).toEqual({ ok: false, reason: 'the site answered 404 for it' });
  });

  it('refuses a picture it names that is too large, a file larger than a file may be, and a file of its own site that does not come', async () => {
    const MB = 1024 * 1024;
    const limits = { ...LIFT_LIMITS, fileBytes: MB, modelBytes: 1.5 * MB };
    const bigPicture = site({ 'https://shop.example/a.gltf': gltf({ buffer: 'a.bin', images: ['p.png'] }), 'https://shop.example/a.bin': new Uint8Array(42), 'https://shop.example/p.png': pngHeader(8192, 16) });
    expect(await fetchModel(PAGE, 'https://shop.example/a.gltf', bigPicture.fetchFn, limits)).toEqual({ ok: false, reason: 'a picture of it is larger than 4096 pixels' });
    const bigFile = site({ 'https://shop.example/a.gltf': gltf({ buffer: 'a.bin' }), 'https://shop.example/a.bin': new Uint8Array(MB + 1) });
    expect(await fetchModel(PAGE, 'https://shop.example/a.gltf', bigFile.fetchFn, limits)).toEqual({ ok: false, reason: 'a file it names (a.bin) is larger than 1 MB' });
    const together = site({
      'https://shop.example/a.gltf': gltf({ buffer: 'a.bin', images: ['p.png'] }),
      'https://shop.example/a.bin': new Uint8Array(0.9 * MB),
      'https://shop.example/p.png': new Uint8Array([...pngHeader(16, 16), ...new Uint8Array(0.7 * MB)]),
    });
    expect(await fetchModel(PAGE, 'https://shop.example/a.gltf', together.fetchFn, limits)).toEqual({ ok: false, reason: 'it and its files are larger than 2 MB' });
    const absent = site({ 'https://shop.example/a.gltf': gltf({ buffer: 'a.bin' }) });
    expect(await fetchModel(PAGE, 'https://shop.example/a.gltf', absent.fetchFn)).toEqual({ ok: false, reason: 'the site answered 404 for a file it names (a.bin)' });
  });

  it('gives up after its time', async () => {
    const s = site({ 'https://shop.example/slow.glb': { hang: true } });
    expect(await fetchModel(PAGE, 'https://shop.example/slow.glb', s.fetchFn, { ...LIFT_LIMITS, ms: 50 })).toEqual({ ok: false, reason: 'it took longer than 0.05 seconds to arrive' });
  });
});
