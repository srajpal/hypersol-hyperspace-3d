/**
 * Checks for the review of 2026-09-30 (prompts 134 and 135), the main
 * process and the page preload: what a page may do without asking (M1),
 * WebSockets through the shield (M3), leaving a page that asks to be
 * kept (M4), and what counts as a HoloML page (V1).
 */
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FIXTURES_DIR, startFixtureServer, type FixtureServer } from './fixture-server';
import { clickUntil, focusedPage, focusedTab, inPage, launch, navigateTo, pressInShell, removeFolder, screenPointOf, shellCall, waitFor, waitForPage, type Harness } from './harness';

let server: FixtureServer;
const folders: string[] = [];

beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
  for (const f of folders) await removeFolder(f);
});

function newProfile(settings?: object): string {
  const dir = mkdtempSync(join(tmpdir(), 'hypersol-e2e-profile-'));
  folders.push(dir);
  writeFileSync(join(dir, 'settings.json'), JSON.stringify({ layersOnOpen: false, ...settings }));
  return dir;
}

/** One of the main process's test logs (main/test-hooks.ts). */
const testLog = <T>(h: Harness, key: string) =>
  h.app.evaluate((_e, k) => (globalThis as unknown as { __hypersolTest: Record<string, unknown> }).__hypersolTest[k], key) as Promise<T>;
/** The address a page's web contents is at, as the main process has it. */
const addressOf = (h: Harness, page: { id: number }) => h.app.evaluate(({ webContents }, id) => webContents.fromId(id)!.getURL(), page.id);

describe('M1: what a page may do without asking', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('review-134-permissions.html'), { userDataDir: newProfile() });
    await waitForPage(h, 'review-134-permissions');
  });
  afterAll(async () => h?.close());

  it('a page that never asked is told "denied" or "prompt", never "granted", for everything that reveals something', async () => {
    const page = await focusedPage(h);
    const states = await inPage<{ notification: string; query: Record<string, string> }>(h, 'states()', page);
    expect(states.notification).toBe('denied');
    for (const name of [
      'notifications',
      'midi',
      'clipboard-read',
      'idle-detection',
      'window-management',
      'local-fonts',
      'storage-access',
      'background-sync',
      'accelerometer',
      'gyroscope',
      'magnetometer',
      'screen-wake-lock',
      'persistent-storage',
      'geolocation',
      'camera',
      'microphone',
    ]) {
      expect(states.query[name], name).not.toBe('granted');
    }
    expect(await inPage<string>(h, 'readClipboard()', page)).toMatch(/^refused:/);
  });

  it('a real click may still copy text', async () => {
    const page = await focusedPage(h);
    await h.app.evaluate(({ clipboard }) => clipboard.clear());
    const did = () => inPage<string | undefined>(h, 'window.did.copy', page);
    await clickUntil(h, await screenPointOf(h, '#copy', page), 'the copy button pressed', async () => (await did()) !== undefined);
    expect(await did()).toBe('done');
    await waitFor('the text on the clipboard', () => h.app.evaluate(({ clipboard }) => clipboard.readText()), (t) => t === 'review-134 copied');
    await h.app.evaluate(({ clipboard }) => clipboard.clear());
  });

  it('a real click may still fill the screen', async () => {
    const page = await focusedPage(h);
    // The test window stays where it is, off screen: only the page's own full screen is checked.
    await h.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setFullScreenable(false));
    const did = () => inPage<string | undefined>(h, 'window.did.full', page);
    await clickUntil(h, await screenPointOf(h, '#full', page), 'the full screen button pressed', async () => (await did()) !== undefined);
    expect(await did()).toBe('done');
    expect(await inPage<boolean>(h, 'document.fullscreenElement === document.documentElement', page)).toBe(true);
    await inPage(h, 'document.exitFullscreen().then(() => true)', page);
  });
});

describe('M3: WebSockets through the shield', () => {
  it('a WebSocket to a listed host never leaves the browser, and is counted and listed; one to the page\'s own site goes through', async () => {
    // A named host, as in the shield's own checks; the ad host is mapped to this machine (harness.ts).
    const page = server.url('review-134-websocket.html').replace('127.0.0.1', 'shop.test');
    const port = new URL(server.base).port;
    const h = await launch(page, { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'review-134-websocket');
      await waitFor('every socket closed', () => inPage<string>(h, 'document.title', 'review-134-websocket'), (t) => t === 'WebSocket test ready');
      // The page's own socket reached the server; the ad host's, plain ws like it, did not.
      expect(server.hits.get('/ddm/own-socket') ?? 0).toBe(1);
      expect(server.hits.get('/ddm/ad-socket') ?? 0).toBe(0);
      // Both listed sockets are in the shield's count and its list, the encrypted one too.
      await waitFor('two blocked', () => shellCall(h, 'shield'), (s) => s.count === 2);
      const tab = (await focusedPage(h)).id;
      const report = await h.shell.evaluate(
        (id) => (window as unknown as { hypersol: { privacy(r: object): Promise<{ value: { count: number; items: { url: string; type: string }[] } }> } }).hypersol.privacy({ op: 'shield.report', tab: id }),
        tab,
      );
      expect(report.value.items).toEqual([
        { url: `ws://ad.doubleclick.net:${port}/ddm/ad-socket`, type: 'webSocket' },
        { url: `wss://ad.doubleclick.net:${port}/ddm/secure-socket`, type: 'webSocket' },
      ]);
    } finally {
      await h.close();
    }
  });
});

describe('M8: a link that leads to a download', () => {
  it('leaves the showing page\'s site and count as they are', async () => {
    const downloads = mkdtempSync(join(tmpdir(), 'hypersol-e2e-downloads-'));
    folders.push(downloads);
    const page = server.url('shield.html').replace('127.0.0.1', 'shop.test');
    const h = await launch(page, { userDataDir: newProfile(), downloadsDir: downloads });
    try {
      await waitForPage(h, 'shield.html');
      await waitFor('two blocked', () => shellCall(h, 'shield'), (s) => s.count === 2);
      const tab = (await focusedPage(h)).id;
      const report = () =>
        h.shell.evaluate(
          (id) => (window as unknown as { hypersol: { privacy(r: object): Promise<{ value: { site: string; count: number } }> } }).hypersol.privacy({ op: 'shield.report', tab: id }),
          tab,
        );
      expect((await report()).value).toMatchObject({ site: 'shop.test', count: 2 });
      // A file on another host: the request starts as a page load and ends as a download.
      await inPage(h, `location.href = ${JSON.stringify(server.url('download/sample.txt'))}; true`, 'shield.html');
      await waitFor('the download done', () => shellCall(h, 'downloads'), (d) => d.length === 1 && d[0]!.state === 'completed');
      await waitFor('the tab at rest', () => h.app.evaluate(({ webContents }, id) => webContents.fromId(id)!.isLoading(), tab), (loading) => !loading);
      expect((await report()).value).toMatchObject({ site: 'shop.test', count: 2 });
      expect((await shellCall(h, 'shield')).count).toBe(2);
    } finally {
      await h.close();
    }
  });
});

describe('M4: leaving a page that asks to be kept', () => {
  it('after a real click the person is asked: Leave leaves, Stay stays, by a typed address and by Reload', async () => {
    const kept = server.url('review-134-beforeunload.html');
    const h = await launch(kept, { userDataDir: newProfile() });
    // The test driver hears of the page's question too and would answer it
    // itself, after the app already has: with a listener it leaves it alone.
    h.app.context().on('dialog', () => undefined);
    try {
      await waitForPage(h, 'review-134-beforeunload');
      const page = await focusedPage(h);
      const asks = () => testLog<string[]>(h, 'leaveAsks');
      const state = () => inPage<string>(h, 'document.getElementById("state").textContent', page);
      const edit = async () => clickUntil(h, await screenPointOf(h, '#edit', page), 'the page edited', async () => (await state()) === 'Edited');

      // Used, then an address typed: asked once, and "Leave" (the test runs' answer) leaves.
      await edit();
      await navigateTo(h, server.url('link-b.html'));
      await waitForPage(h, 'link-b');
      expect(await asks()).toEqual([kept]);

      // "Stay" keeps the page, with what was done in it, and nothing is fetched.
      await navigateTo(h, kept);
      await waitForPage(h, 'review-134-beforeunload');
      await edit();
      await h.app.evaluate(() => void ((globalThis as unknown as { __hypersolTest: { leaveAnswer: string } }).__hypersolTest.leaveAnswer = 'stay'));
      const before = server.hits.get('/link-a.html') ?? 0;
      await navigateTo(h, server.url('link-a.html'));
      await waitFor('asked a second time', asks, (a) => a.length === 2);
      expect(await addressOf(h, page)).toBe(kept);
      expect(await state()).toBe('Edited');
      expect(server.hits.get('/link-a.html') ?? 0).toBe(before);
      // Reload asks too, and "Stay" keeps the page as it is.
      await pressInShell(h, 'R', ['control']);
      await waitFor('asked a third time', asks, (a) => a.length === 3);
      expect(await state()).toBe('Edited');

      // "Leave" on a reload: the page starts afresh.
      await h.app.evaluate(() => void ((globalThis as unknown as { __hypersolTest: { leaveAnswer: string } }).__hypersolTest.leaveAnswer = 'leave'));
      await pressInShell(h, 'R', ['control']);
      await waitFor('reloaded', state, (s) => s === 'Not yet touched');
      expect(await asks()).toEqual([kept, kept, kept, kept]);
    } finally {
      await h.close();
    }
  });
});

/** Waits for a HoloML page's scene (the viewer's own facts are window.__holoml in the page). */
const sceneReady = (h: Harness, page: string) =>
  waitFor('the scene ready', () => inPage<boolean>(h, 'window.__holoml ? window.__holoml.ready : false', page), (r) => r === true, 20_000);

describe('V1: what counts as a HoloML page', () => {
  it('a .holoml the site sends as a download is downloaded, not run as a scene', async () => {
    const downloads = mkdtempSync(join(tmpdir(), 'hypersol-e2e-downloads-'));
    folders.push(downloads);
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile(), downloadsDir: downloads });
    try {
      await waitForPage(h, 'link-a');
      await navigateTo(h, server.url('review-134/attachment.holoml'));
      const list = await waitFor('the download done', () => shellCall(h, 'downloads'), (d) => d.length === 1 && d[0]!.state === 'completed');
      expect(list[0]!.filename).toBe('review-134-scene.holoml');
      // The tab stays on the page it had, and shows no scene.
      expect(await addressOf(h, await focusedPage(h))).toBe(server.url('link-a.html'));
      expect((await shellCall(h, 'holoml')).shown).toBe(false);
    } finally {
      await h.close();
    }
  });

  it('a .holoml the site sandboxes is shown as the site sent it: text, under the site\'s policy, with no viewer', async () => {
    const h = await launch(server.url('review-134/sandboxed.holoml'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'sandboxed.holoml');
      const facts = await inPage<{ type: string; text: string; viewer: string; origin: string }>(
        h,
        '({ type: document.contentType, text: document.body.innerText, viewer: typeof window.__holoml, origin: self.origin })',
        'sandboxed.holoml',
      );
      expect(facts.type).toBe('text/plain');
      expect(facts.text).toContain('<holoml version="0.1">');
      expect(facts.viewer).toBe('undefined');
      // The site's sandbox still holds: the page has no origin of its own.
      expect(facts.origin).toBe('null');
      expect((await shellCall(h, 'holoml')).shown).toBe(false);
    } finally {
      await h.close();
    }
  });

  it('a HoloML page keeps the site\'s own content policy beside HoloML\'s', async () => {
    const url = server.url('review-134/with-policy.holoml');
    const h = await launch(url, { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'with-policy.holoml');
      await sceneReady(h, 'with-policy.holoml');
      expect((await shellCall(h, 'holoml')).shown).toBe(true);
      // The site said connect-src 'none'; HoloML's own policy would allow the page's own site.
      const before = server.hits.get('/review-134/with-policy.holoml') ?? 0;
      expect(await inPage<string>(h, `fetch(${JSON.stringify(url)}).then(() => 'fetched', () => 'refused')`, 'with-policy.holoml')).toBe('refused');
      expect(server.hits.get('/review-134/with-policy.holoml') ?? 0).toBe(before);
      // And HoloML's policy holds too: no pictures from other sites.
      expect(
        await inPage<string>(
          h,
          `new Promise((resolve) => { const i = new Image(); i.onload = () => resolve('loaded'); i.onerror = () => resolve('refused'); i.src = ${JSON.stringify(server.url('icon.png').replace('127.0.0.1', 'shop.test'))}; })`,
          'with-policy.holoml',
        ),
      ).toBe('refused');
    } finally {
      await h.close();
    }
  });
});

describe('M6: a HoloML file opened from the computer', () => {
  const openLocal = (h: Harness, path: string) =>
    h.app.evaluate(async (_e, p) => (globalThis as unknown as { __hypersolTest: { openLocal(p: string): Promise<string | null> } }).__hypersolTest.openLocal(p), path);
  const models = (h: Harness) => inPage<{ src: string; state: string }[]>(h, 'window.__holoml.models()', 'hypersol-file');

  it('from the Downloads folder reads the files beside it, not the folders inside, and says so in its console', async () => {
    // The run's Downloads folder: a page, its model beside it, and the same model in a folder inside.
    const downloads = mkdtempSync(join(tmpdir(), 'hypersol-e2e-downloads-'));
    folders.push(downloads);
    mkdirSync(join(downloads, 'models'));
    const car = join(FIXTURES_DIR, 'holoml', 'models', 'placeholder-car.gltf');
    copyFileSync(car, join(downloads, 'beside.gltf'));
    copyFileSync(car, join(downloads, 'models', 'inside.gltf'));
    writeFileSync(
      join(downloads, 'saved.holoml'),
      '<holoml version="0.1">\n  <head>\n    <title>Saved page</title>\n  </head>\n  <scene>\n    <model id="beside" src="beside.gltf" />\n    <model id="inside" src="models/inside.gltf" position="4 0 0" />\n  </scene>\n</holoml>\n',
    );
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ instruments: true }), downloadsDir: downloads });
    try {
      await waitForPage(h, 'link-a');
      await shellCall(h, 'showUrl', (await openLocal(h, join(downloads, 'saved.holoml')))!);
      await waitForPage(h, 'saved.holoml');
      await sceneReady(h, 'hypersol-file');
      const loaded = await waitFor('both models settled', () => models(h), (m) => m.every((x) => x.state !== 'loading'));
      expect(loaded.map((m) => [m.src, m.state])).toEqual([
        ['beside.gltf', 'loaded'],
        ['models/inside.gltf', 'failed'],
      ]);
      await waitFor('the note in the page\'s console', async () => (await shellCall(h, 'instruments')).console, (lines) => lines.some((l) => l.includes('opened from a folder that holds other files too')));
    } finally {
      await h.close();
    }
  });

  it('leaves for the web only after a real click or key press, and without the address\'s query and fragment', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'hypersol-holoml-'));
    folders.push(folder);
    mkdirSync(join(folder, 'page'));
    writeFileSync(join(folder, 'page', 'local.holoml'), '<holoml version="0.1">\n  <head>\n    <title>Local page</title>\n  </head>\n  <scene>\n    <label position="0 1.5 0">A local page</label>\n  </scene>\n</holoml>\n');
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      const local = (await openLocal(h, join(folder, 'page', 'local.holoml')))!;
      await shellCall(h, 'showUrl', local);
      await waitForPage(h, 'local.holoml');
      await sceneReady(h, 'hypersol-file');
      const page = await focusedPage(h);
      const away = `${server.url('tall.html')}?file=IMG_0001.jpg#more`;
      const fetched = () => [server.hits.get('/tall.html') ?? 0, server.hits.get('/tall.html?file=IMG_0001.jpg') ?? 0];

      // A script alone: refused. The request never leaves, and the tab stays.
      await inPage(h, `location.href = ${JSON.stringify(away)}; true`, page);
      await inPage(h, 'new Promise((r) => setTimeout(() => r(true), 300))', page);
      expect(await addressOf(h, page)).toBe(local);
      expect(fetched()).toEqual([0, 0]);

      // After a real click on the page: it goes, without the parts that could carry what the page read.
      await inPage(h, `addEventListener('pointerdown', () => { window.__pressed = true; }, true); true`, page);
      const middle = await inPage<{ x: number; y: number }>(h, '({ x: innerWidth / 2, y: innerHeight - 20 })', page);
      await clickUntil(h, await shellCall(h, 'projectPagePoint', middle.x, middle.y), 'the click reached the page', () => inPage<boolean>(h, 'window.__pressed === true', page));
      await inPage(h, `location.href = ${JSON.stringify(away)}; true`, page);
      await waitFor('the page left for the web', () => focusedTab(h), (t) => t.url.startsWith(server.url('tall.html')));
      await waitForPage(h, 'tall.html');
      expect(await addressOf(h, page)).toBe(server.url('tall.html'));
      expect(fetched()).toEqual([1, 0]);
    } finally {
      await h.close();
    }
  });
});

describe('M11: a .holoml file dropped on a page', () => {
  it('opens in that tab when it comes from the page\'s own drop; a path of another kind does not', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'hypersol-holoml-'));
    folders.push(folder);
    mkdirSync(join(folder, 'page'));
    const scene = join(folder, 'page', 'dropped.holoml');
    writeFileSync(scene, '<holoml version="0.1">\n  <head>\n    <title>Dropped page</title>\n  </head>\n  <scene>\n    <label position="0 1.5 0">A dropped page</label>\n  </scene>\n</holoml>\n');
    const other = join(folder, 'page', 'notes.txt');
    writeFileSync(other, 'not a HoloML page');
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      const page = await focusedPage(h);
      /** Drops a file on the page, as the system does: through the page's own drag events. */
      const drop = (file: string) =>
        h.app.evaluate(
          async ({ webContents }, { id, file }) => {
            const guest = webContents.fromId(id)!;
            guest.debugger.attach('1.3');
            try {
              const data = { items: [], files: [file], dragOperationsMask: 1 };
              for (const type of ['dragEnter', 'dragOver', 'drop']) await guest.debugger.sendCommand('Input.dispatchDragEvent', { type, x: 200, y: 200, data });
            } finally {
              guest.debugger.detach();
            }
          },
          { id: page.id, file },
        );
      // A file of another kind: the page's preload does not pass it on, and the tab stays.
      await drop(other);
      await inPage(h, 'new Promise((r) => setTimeout(() => r(true), 300))', page);
      expect(await addressOf(h, page)).toBe(server.url('link-a.html'));
      // A .holoml file: it opens in the tab.
      await drop(scene);
      await waitFor('the dropped page in the tab', () => focusedTab(h), (t) => /^hypersol-file:\/\/[0-9a-f]{16}\/dropped\.holoml$/.test(t.url));
      await sceneReady(h, 'hypersol-file');
    } finally {
      await h.close();
    }
  });
});
