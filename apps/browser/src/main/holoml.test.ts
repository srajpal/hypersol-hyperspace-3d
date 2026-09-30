import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: {},
  // Stands in for Chromium reading a file: address in, the file's bytes out.
  net: { fetch: async (url: string) => new Response(readFileSync(fileURLToPath(url))) },
}));
const { HOLOML_CSP, HOLOML_MEDIA_TYPE, HolomlPages, SHARED_FOLDER_NOTE, holomlHeaders, isHolomlResponse, isInsideFolder, isSharedFolder } = await import('./holoml');

const page = (over: Partial<Parameters<typeof isHolomlResponse>[0]> = {}) => ({
  url: 'https://site.example/scenes/room.holoml',
  resourceType: 'mainFrame',
  statusCode: 200,
  responseHeaders: { 'Content-Type': ['text/plain'] },
  ...over,
});

describe('isHolomlResponse', () => {
  it('knows a HoloML page by its address or by its media type, for a tab\'s own page only', () => {
    expect(isHolomlResponse(page())).toBe(true);
    expect(isHolomlResponse(page({ url: 'https://site.example/scenes/ROOM.HOLOML?v=2#door' }))).toBe(true);
    expect(isHolomlResponse(page({ url: 'https://site.example/scene', responseHeaders: { 'content-type': [`${HOLOML_MEDIA_TYPE}; charset=utf-8`] } }))).toBe(true);
    expect(isHolomlResponse(page({ url: 'https://site.example/scene', responseHeaders: { 'Content-Type': 'Model/Vnd.HoloML' } }))).toBe(true);
    expect(isHolomlResponse(page({ url: 'https://site.example/page.html' }))).toBe(false);
    expect(isHolomlResponse(page({ url: 'https://site.example/room.holoml.txt' }))).toBe(false);
    expect(isHolomlResponse(page({ resourceType: 'subFrame' }))).toBe(false);
    expect(isHolomlResponse(page({ resourceType: 'xhr' }))).toBe(false);
    expect(isHolomlResponse(page({ url: 'not an address' }))).toBe(false);
  });

  it('only for an answer that has the page: 2xx, or 304 from the cache', () => {
    for (const statusCode of [200, 206, 299, 304]) expect(isHolomlResponse(page({ statusCode })), String(statusCode)).toBe(true);
    for (const statusCode of [101, 301, 302, 404, 500]) expect(isHolomlResponse(page({ statusCode })), String(statusCode)).toBe(false);
  });

  it('not what the site sends as a download (review of 2026-09-30, V1)', () => {
    for (const disposition of ['attachment', 'attachment; filename="room.holoml"', 'ATTACHMENT;filename=x', '  attachment ; filename*=UTF-8\'\'x']) {
      expect(isHolomlResponse(page({ responseHeaders: { 'Content-Disposition': [disposition] } })), disposition).toBe(false);
      expect(isHolomlResponse(page({ responseHeaders: { 'content-type': [HOLOML_MEDIA_TYPE], 'content-disposition': disposition } })), disposition).toBe(false);
    }
    // Shown in place, whatever name the site suggests for saving it.
    expect(isHolomlResponse(page({ responseHeaders: { 'Content-Disposition': ['inline; filename="attachment.holoml"'] } }))).toBe(true);
  });

  it('not what the site sandboxes (review of 2026-09-30, V1)', () => {
    for (const policy of ['sandbox', 'sandbox allow-scripts', "default-src 'self'; SANDBOX allow-forms", "img-src *, sandbox", "default-src 'none';sandbox"]) {
      expect(isHolomlResponse(page({ responseHeaders: { 'Content-Security-Policy': [policy] } })), policy).toBe(false);
    }
    expect(isHolomlResponse(page({ responseHeaders: { 'content-security-policy': ["default-src 'self'", 'sandbox'] } }))).toBe(false);
    // Other policies do not stop it being a HoloML page; nor does the word elsewhere, or a policy that only reports.
    expect(isHolomlResponse(page({ responseHeaders: { 'Content-Security-Policy': ["default-src 'self'; report-uri /sandbox"] } }))).toBe(true);
    expect(isHolomlResponse(page({ responseHeaders: { 'Content-Security-Policy-Report-Only': ['sandbox'] } }))).toBe(true);
  });
});

describe('holomlHeaders', () => {
  it('shows the page as text under HoloML\'s policy, which allows no peer connections (review of 2026-09-30, M6)', () => {
    const out = holomlHeaders({ 'content-type': ['model/vnd.holoml'], 'x-content-type-options': ['anything'], 'Cache-Control': 'no-store' });
    expect(out).toEqual({
      'Cache-Control': ['no-store'],
      'Content-Type': ['text/plain; charset=utf-8'],
      'Content-Security-Policy': [HOLOML_CSP],
      'X-Content-Type-Options': ['nosniff'],
    });
    expect(HOLOML_CSP.split('; ')).toContain("webrtc 'block'");
    expect(HOLOML_CSP.split('; ')).toContain("default-src 'none'");
    expect(holomlHeaders(undefined)['Content-Security-Policy']).toEqual([HOLOML_CSP]);
  });

  it('keeps the site\'s own content policies and adds HoloML\'s as one more (review of 2026-09-30, V1)', () => {
    const out = holomlHeaders({
      'content-security-policy': ["connect-src 'none'", "img-src 'self'"],
      'Content-Security-Policy-Report-Only': ["default-src 'self'; report-uri /csp"],
      'X-Frame-Options': ['DENY'],
      'Content-Disposition': ['inline; filename="room.holoml"'],
      'Set-Cookie': ['a=1', 'b=2'],
    });
    expect(out['Content-Security-Policy']).toEqual(["connect-src 'none'", "img-src 'self'", HOLOML_CSP]);
    expect(out['content-security-policy']).toBeUndefined(); // one header, not the site's and ours under two spellings
    expect(out['Content-Security-Policy-Report-Only']).toEqual(["default-src 'self'; report-uri /csp"]);
    expect(out['X-Frame-Options']).toEqual(['DENY']);
    expect(out['Content-Disposition']).toEqual(['inline; filename="room.holoml"']);
    expect(out['Set-Cookie']).toEqual(['a=1', 'b=2']);
  });
});

describe('isInsideFolder', () => {
  it('holds a file to its opened folder, on Windows and elsewhere', () => {
    expect(isInsideFolder('C:\\scenes', 'C:\\scenes\\room.holoml', true, win32)).toBe(true);
    expect(isInsideFolder('C:\\scenes', 'C:\\scenes\\models\\car.glb', true, win32)).toBe(true);
    expect(isInsideFolder('C:\\scenes', 'c:\\SCENES\\room.holoml', true, win32)).toBe(true); // Windows ignores case
    expect(isInsideFolder('C:\\scenes', 'C:\\scenes', true, win32)).toBe(true);
    expect(isInsideFolder('C:\\scenes', 'C:\\secrets.txt', true, win32)).toBe(false);
    expect(isInsideFolder('C:\\scenes', 'C:\\scenes-private\\x.png', true, win32)).toBe(false);
    expect(isInsideFolder('C:\\scenes', 'D:\\scenes\\room.holoml', true, win32)).toBe(false);
    expect(isInsideFolder('/home/ada/scenes', '/home/ada/scenes/models/car.glb', true, posix)).toBe(true);
    expect(isInsideFolder('/home/ada/scenes', '/home/ada/notes.txt', true, posix)).toBe(false);
    expect(isInsideFolder('/home/ada/scenes', '/home/ada/scenes-private/x.png', true, posix)).toBe(false);
    // A file whose name begins with two dots is a file, not a way out.
    expect(isInsideFolder('/home/ada/scenes', '/home/ada/scenes/..hidden.png', true, posix)).toBe(true);
  });

  it('a folder that is a drive\'s or the file system\'s root works (review of 2026-09-30, M10)', () => {
    expect(isInsideFolder('C:\\', 'C:\\room.holoml', false, win32)).toBe(true);
    expect(isInsideFolder('C:\\', 'C:\\models\\car.glb', true, win32)).toBe(true);
    expect(isInsideFolder('C:\\', 'D:\\room.holoml', true, win32)).toBe(false);
    expect(isInsideFolder('/', '/room.holoml', false, posix)).toBe(true);
    expect(isInsideFolder('/', '/models/car.glb', true, posix)).toBe(true);
  });

  it('without the folders inside, only the folder\'s own files count (review of 2026-09-30, M6)', () => {
    expect(isInsideFolder('C:\\Users\\ada\\Downloads', 'C:\\Users\\ada\\Downloads\\room.holoml', false, win32)).toBe(true);
    expect(isInsideFolder('C:\\Users\\ada\\Downloads', 'C:\\Users\\ada\\Downloads\\holiday\\IMG_0001.jpg', false, win32)).toBe(false);
    expect(isInsideFolder('/home/ada/Downloads', '/home/ada/Downloads/room.glb', false, posix)).toBe(true);
    expect(isInsideFolder('/home/ada/Downloads', '/home/ada/Downloads/holiday/IMG_0001.jpg', false, posix)).toBe(false);
    expect(isInsideFolder('/', '/etc/passwd', false, posix)).toBe(false);
    expect(isInsideFolder('C:\\', 'C:\\Users\\ada\\photo.png', false, win32)).toBe(false);
  });
});

describe('isSharedFolder', () => {
  it('is a root, or one of the named folders, and nothing inside or around them', () => {
    const named = ['C:\\Users\\ada\\Downloads', 'C:\\Users\\ada\\Desktop', 'C:\\Users\\ada\\Documents', 'C:\\Users\\ada'];
    for (const folder of [...named, 'c:\\users\\ADA\\downloads', 'C:\\Users\\ada\\Downloads\\', 'C:\\', 'D:\\']) expect(isSharedFolder(folder, named, win32), folder).toBe(true);
    for (const folder of ['C:\\Users\\ada\\Downloads\\scenes', 'C:\\Users', 'C:\\Users\\ada\\Pictures', 'D:\\scenes']) expect(isSharedFolder(folder, named, win32), folder).toBe(false);
    expect(isSharedFolder('/', [], posix)).toBe(true);
    expect(isSharedFolder('/home/ada', ['/home/ada/Downloads', '/home/ada'], posix)).toBe(true);
    expect(isSharedFolder('/home/ada/scenes', ['/home/ada/Downloads', '/home/ada'], posix)).toBe(false);
  });
});

describe('HoloML files on the computer', () => {
  // A stand-in Downloads folder with a page, a model beside it, and a folder inside; and a folder of a page's own.
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'hypersol-unit-holoml-')));
  const downloads = join(root, 'Downloads');
  const own = join(root, 'scenes');
  for (const folder of [downloads, own]) {
    mkdirSync(join(folder, 'inside'), { recursive: true });
    writeFileSync(join(folder, 'room.holoml'), '<holoml version="0.1"></holoml>');
    writeFileSync(join(folder, 'beside.gltf'), '{}');
    writeFileSync(join(folder, 'notes.txt'), 'not a type a HoloML folder serves');
    writeFileSync(join(folder, 'inside', 'photo.png'), 'png');
    writeFileSync(join(folder, 'inside', 'second.holoml'), '<holoml version="0.1"></holoml>');
  }
  writeFileSync(join(root, 'outside.png'), 'png');
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  function pages() {
    const handlers = new Map<string, (request: Request) => Promise<Response>>();
    const holoml = new HolomlPages({ viewerFiles: null, sharedFolders: [downloads] });
    holoml.register({ protocol: { handle: (scheme: string, handler: (request: Request) => Promise<Response>) => void handlers.set(scheme, handler) } } as never);
    const get = async (url: string) => (await handlers.get('hypersol-file')!(new Request(url))).status;
    return { holoml, get };
  }

  it('opens only readable .holoml files, at an address with a random name for the folder', async () => {
    const { holoml } = pages();
    expect(await holoml.openFile(join(own, 'beside.gltf'))).toBeNull();
    expect(await holoml.openFile(join(own, 'missing.holoml'))).toBeNull();
    expect(await holoml.openFile(join(own, 'inside'))).toBeNull();
    const url = (await holoml.openFile(join(own, 'room.holoml')))!;
    expect(url).toMatch(/^hypersol-file:\/\/[0-9a-f]{16}\/room\.holoml$/);
    expect(await holoml.openFile(join(own, 'inside', '..', 'room.holoml'))).toBe(url); // the same folder keeps its name
    expect(holoml.isDocument(1, url)).toBe(true);
    expect(holoml.isDocument(1, url.replace('room.holoml', 'beside.gltf'))).toBe(false);
    expect(holoml.isDocument(1, url.replace(/\/\/[0-9a-f]{16}\//, '//0123456789abcdef/'))).toBe(false);
  });

  it('a folder of the page\'s own serves its files and the folders inside, and nothing outside or of another type', async () => {
    const { holoml, get } = pages();
    const base = (await holoml.openFile(join(own, 'room.holoml')))!.replace('room.holoml', '');
    expect(await get(`${base}room.holoml`)).toBe(200);
    expect(await get(`${base}beside.gltf`)).toBe(200);
    expect(await get(`${base}inside/photo.png`)).toBe(200);
    expect(holoml.isDocument(1, `${base}inside/second.holoml`)).toBe(true);
    expect(await get(`${base}notes.txt`)).toBe(404);
    expect(await get(`${base}missing.png`)).toBe(404);
    expect(await get(`${base}%2e%2e/outside.png`)).toBe(404);
    expect(await get(`${base}..%5Coutside.png`)).toBe(404);
    expect(await get('hypersol-file://0123456789abcdef/room.holoml')).toBe(404); // a folder never opened
  });

  it('a shared folder serves the files beside the page only, and says so in the page\'s console (review of 2026-09-30, M6)', async () => {
    const { holoml, get } = pages();
    const url = (await holoml.openFile(join(downloads, 'room.holoml')))!;
    const base = url.replace('room.holoml', '');
    expect(await get(url)).toBe(200);
    expect(await get(`${base}beside.gltf`)).toBe(200);
    expect(await get(`${base}inside/photo.png`)).toBe(404);
    expect(await get(`${base}inside/second.holoml`)).toBe(404);
    expect(holoml.isDocument(1, `${base}inside/second.holoml`)).toBe(false);
    // A file opened from a folder inside the shared one has a folder of its own.
    const inner = (await holoml.openFile(join(downloads, 'inside', 'second.holoml')))!;
    expect(await get(inner.replace('second.holoml', 'photo.png'))).toBe(200);

    const said: string[] = [];
    const contents = Object.assign(new EventEmitter(), { executeJavaScript: (code: string) => (said.push(code), Promise.resolve()) });
    holoml.track(contents as never);
    contents.emit('did-navigate', {}, url);
    expect(said).toEqual([`console.info(${JSON.stringify(SHARED_FOLDER_NOTE)})`]);
    contents.emit('did-navigate', {}, inner);
    contents.emit('did-navigate', {}, (await holoml.openFile(join(own, 'room.holoml')))!);
    contents.emit('did-navigate', {}, 'https://site.example/room.holoml');
    expect(said).toHaveLength(1);
  });

  it('marks a web page as HoloML from its answer, and forgets it when the tab moves on', () => {
    const { holoml } = pages();
    const url = 'https://site.example/room.holoml';
    const details = { url, resourceType: 'mainFrame', statusCode: 200, webContentsId: 7, responseHeaders: { 'Content-Type': ['text/plain'], 'Content-Security-Policy': ["img-src 'self'"] } };
    const adjusted = holoml.adjust(details, {});
    expect(adjusted.responseHeaders!['Content-Security-Policy']).toEqual(["img-src 'self'", HOLOML_CSP]);
    expect(holoml.isDocument(7, `${url}#door`)).toBe(true);
    expect(holoml.isDocument(8, url)).toBe(false);
    // Sent as a download, or sandboxed: left exactly as the site sent it, and not marked.
    const refused: Record<string, string[]>[] = [{ 'Content-Disposition': ['attachment'] }, { 'Content-Security-Policy': ['sandbox'] }];
    for (const headers of refused) {
      const left = { cancel: false };
      expect(holoml.adjust({ ...details, webContentsId: 9, responseHeaders: { 'Content-Type': ['text/plain'], ...headers } }, left)).toBe(left);
      expect(holoml.isDocument(9, url)).toBe(false);
    }
    // The shield cancelled it, or it is not the tab's own page: untouched.
    const cancelled = { cancel: true };
    expect(holoml.adjust(details, cancelled)).toBe(cancelled);
    // The tab loads an ordinary page: no longer a HoloML document.
    holoml.adjust({ ...details, url: 'https://site.example/index.html' }, {});
    expect(holoml.isDocument(7, url)).toBe(false);
    holoml.adjust(details, {});
    holoml.forget(7);
    expect(holoml.isDocument(7, url)).toBe(false);
  });
});
