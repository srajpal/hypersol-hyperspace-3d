/**
 * Checks for the review of 2026-09-30 (prompts 134 and 135), the main
 * process and the page preload: what a page may do without asking (M1),
 * WebSockets through the shield (M3), leaving a page that asks to be
 * kept (M4), and what counts as a HoloML page (V1).
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import { clickUntil, focusedPage, inPage, launch, navigateTo, pressInShell, removeFolder, screenPointOf, shellCall, waitFor, waitForPage, type Harness } from './harness';

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
