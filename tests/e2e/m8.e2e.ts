/**
 * Milestone 8 end-to-end checks J1 to J8 (TODO.md): zoom, find in page,
 * downloads, printing, private tabs, and keyboard access.
 */
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import {
  focusedPage,
  focusedTab,
  inPage,
  launch,
  navigateTo,
  pressInPage,
  pressInShell,
  removeFolder,
  shellCall,
  sleep,
  tabs,
  waitFor,
  waitForExit,
  waitForPage,
  type Harness,
} from './harness';

let server: FixtureServer;
const folders: string[] = [];

function newFolder(prefix: string, settings?: object): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  folders.push(dir);
  if (settings) writeFileSync(join(dir, 'settings.json'), JSON.stringify(settings));
  return dir;
}
const newProfile = (settings?: object) => newFolder('hypersol-e2e-profile-', { layersOnOpen: false, ...settings });

beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
  for (const dir of folders) await removeFolder(dir);
});

const BAR = (id: string) => `hs-toolbar [data-testid="${id}"]`;
const FIND = (id: string) => `hs-find-bar [data-testid="${id}"]`;
const DL = (id: string) => `hs-downloads [data-testid="${id}"]`;
const saved = (profile: string) => JSON.parse(readFileSync(join(profile, 'settings.json'), 'utf8')) as Record<string, unknown>;
const guestZoom = async (h: Harness) => {
  const page = await focusedPage(h);
  return h.app.evaluate(({ webContents }, id) => webContents.fromId(id)!.getZoomFactor(), page.id);
};
const testLog = <T>(h: Harness, key: string) =>
  h.app.evaluate((_e, k) => (globalThis as unknown as { __hypersolTest: Record<string, unknown> }).__hypersolTest[k], key) as Promise<T>;

describe('J1: zoom', () => {
  it('buttons and shortcuts zoom the page, the level shows, and it is remembered per site', async () => {
    const profile = newProfile();
    let h = await launch(server.url('link-a.html'), { userDataDir: profile });
    try {
      await waitForPage(h, 'link-a');
      expect(await h.shell.locator(BAR('zoom-level')).textContent()).toBe('100%');
      await h.shell.click(BAR('zoom-in'));
      await h.shell.click(BAR('zoom-in'));
      await waitFor('125%', () => guestZoom(h), (z) => Math.abs(z - 1.25) < 0.001);
      expect(await h.shell.locator(BAR('zoom-level')).textContent()).toBe('125%');
      await pressInPage(h, '-', ['control']);
      await waitFor('110%', () => guestZoom(h), (z) => Math.abs(z - 1.1) < 0.001);
      await pressInShell(h, '0', ['control']);
      await waitFor('100%', () => guestZoom(h), (z) => Math.abs(z - 1) < 0.001);
      await pressInShell(h, '=', ['control']);
      await pressInShell(h, '=', ['control']);
      await waitFor('125% again', () => guestZoom(h), (z) => Math.abs(z - 1.25) < 0.001);
      await waitFor('saved for the site', async () => (saved(profile)['zoomSites'] as Record<string, number>)?.['127.0.0.1'], (z) => z === 1.25);
    } finally {
      await h.close();
    }
    h = await launch(server.url('link-b.html'), { userDataDir: profile });
    try {
      await waitForPage(h, 'link-b');
      await waitFor('the site opens zoomed', () => guestZoom(h), (z) => Math.abs(z - 1.25) < 0.001);
      await h.shell.click(BAR('zoom-level'));
      await waitFor('reset', () => guestZoom(h), (z) => Math.abs(z - 1) < 0.001);
      await waitFor('forgotten', async () => (saved(profile)['zoomSites'] as Record<string, number>)?.['127.0.0.1'], (z) => z === undefined);
    } finally {
      await h.close();
    }
  });
});

describe('J2 and J4: find in page and printing', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('find.html'), { userDataDir: newProfile() });
    await waitForPage(h, 'find');
  });
  afterAll(async () => h?.close());

  it('J2 Ctrl+F finds text with a count; Enter and Shift+Enter move; Escape closes', async () => {
    await pressInPage(h, 'f', ['control']);
    await waitFor('find bar open', () => shellCall(h, 'find'), (f) => f.open);
    expect(await h.shell.evaluate(() => document.activeElement?.tagName)).toBe('HS-FIND-BAR');
    await h.shell.fill(FIND('find-input'), 'needle');
    await waitFor('three matches', () => shellCall(h, 'find'), (f) => f.matches === 3 && f.active === 1);
    expect(await h.shell.locator(FIND('find-count')).textContent()).toContain('1/3');
    await h.shell.locator(FIND('find-input')).press('Enter');
    await waitFor('second match', () => shellCall(h, 'find'), (f) => f.active === 2);
    await h.shell.locator(FIND('find-input')).press('Shift+Enter');
    await waitFor('back to the first', () => shellCall(h, 'find'), (f) => f.active === 1);
    await h.shell.fill(FIND('find-input'), 'haystack');
    await waitFor('no match', () => shellCall(h, 'find'), (f) => f.matches === 0);
    await h.shell.locator(FIND('find-input')).press('Escape');
    await waitFor('closed', () => shellCall(h, 'find'), (f) => !f.open);
  });

  it('J4 Ctrl+P and the menu print the page (counted in tests; no printer needed)', async () => {
    await pressInPage(h, 'p', ['control']);
    await waitFor('printed once', () => shellCall(h, 'prints'), (n) => n === 1);
    await h.shell.click(BAR('menu'));
    await h.shell.click(BAR('menu-print'));
    await waitFor('printed twice', () => shellCall(h, 'prints'), (n) => n === 2);
  });
});

describe('J3 and J8: downloads', () => {
  it('saves to the folder with progress; a taken name gets a number; show, cancel, and clear work; keyboard', async () => {
    const folder = newFolder('hypersol-e2e-downloads-');
    const h = await launch(server.url('find.html'), { userDataDir: newProfile(), downloadsDir: folder });
    try {
      await waitForPage(h, 'find');
      await navigateTo(h, server.url('download/sample.txt'));
      await waitFor('first download done', () => shellCall(h, 'downloads'), (d) => d.length === 1 && d[0]!.state === 'completed');
      expect(readFileSync(join(folder, 'sample.txt'), 'utf8')).toBe('HyperSol download test file\n');
      await navigateTo(h, server.url('download/sample.txt'));
      await waitFor('second download done', () => shellCall(h, 'downloads'), (d) => d.length === 2 && d[1]!.state === 'completed');
      expect((await shellCall(h, 'downloads'))[1]!.filename).toBe('sample (1).txt');
      expect(existsSync(join(folder, 'sample (1).txt'))).toBe(true);

      // J8: the panel opens with the keyboard and takes the focus.
      await pressInShell(h, 'J', ['control']);
      await waitFor('panel open', () => shellCall(h, 'openPanel'), (p) => p === 'downloads');
      expect(await h.shell.evaluate(() => document.activeElement?.tagName)).toBe('HS-DOWNLOADS');
      expect(await h.shell.locator(DL('download')).count()).toBe(2);
      await h.shell.locator(DL('download-show')).first().click();
      await waitFor('shown in its folder', () => testLog<{ what: string; path: string }[]>(h, 'opened'), (o) =>
        o.some((x) => x.what === 'show' && x.path.endsWith('sample (1).txt')));

      await navigateTo(h, server.url('download/slow.bin'));
      await waitFor('slow download running', () => shellCall(h, 'downloads'), (d) => d.some((x) => x.filename === 'slow.bin' && x.state === 'progressing' && x.received > 0));
      expect(await h.shell.locator(BAR('menu')).getAttribute('data-busy')).not.toBeNull();
      await h.shell.locator(DL('download-cancel')).click();
      await waitFor('cancelled', () => shellCall(h, 'downloads'), (d) => d.some((x) => x.filename === 'slow.bin' && x.state === 'cancelled'));
      await waitFor('badge gone', () => h.shell.locator(BAR('menu')).getAttribute('data-busy'), (b) => b === null);

      await h.shell.click(DL('downloads-clear'));
      await waitFor('list cleared', () => h.shell.locator(DL('download')).count(), (n) => n === 0);
      await h.shell.locator(DL('downloads-clear')).press('Escape');
      await waitFor('panel closed', () => shellCall(h, 'openPanel'), (p) => p === null);
    } finally {
      await h.close();
    }
  });
});

describe('J5 to J7: private tabs', () => {
  it('J5 a private tab is marked, keeps no history, and its cookies stay apart and go when it closes', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      await pressInShell(h, 'N', ['control', 'shift']);
      await waitFor('private tab', () => focusedTab(h), (t) => t.private && t.state === 'start');
      expect(await h.shell.locator('[data-testid="page-panel"][aria-hidden="false"] [data-testid="private-note"]').isVisible()).toBe(true);
      expect(await h.shell.locator(BAR('private-pill')).isVisible()).toBe(true);

      await navigateTo(h, server.url('cookie.html?set=1'));
      await waitForPage(h, 'cookie');
      const privatePage = await focusedPage(h);
      expect(await inPage<string>(h, 'document.cookie', privatePage)).toContain('hs_test=1');
      expect(await h.app.evaluate(({ webContents }, id) => webContents.fromId(id)!.session.isPersistent(), privatePage.id)).toBe(false);

      // Not in history.
      await sleep(500);
      const recent = await h.shell.evaluate(async () => {
        const w = window as unknown as { hypersol: { data(r: object): Promise<{ ok: boolean; value: { url: string }[] }> } };
        return (await w.hypersol.data({ op: 'history.recent', limit: 50 })).value.map((e) => e.url);
      });
      expect(recent).toContain(server.url('link-a.html'));
      expect(recent.some((u) => u.includes('cookie.html'))).toBe(false);

      // A normal tab on the same site does not see the private cookie.
      await pressInShell(h, 'T', ['control']);
      await navigateTo(h, server.url('cookie.html'));
      await waitForPage(h, 'cookie');
      const normalPage = await focusedPage(h);
      expect(await inPage<string>(h, 'document.cookie', normalPage)).not.toContain('hs_test');
      expect((await focusedTab(h)).private).toBe(false);
      expect(await h.shell.locator(BAR('private-pill')).count()).toBe(0);

      // Close the private tab; a new private tab starts clean.
      const privateTab = (await tabs(h)).find((t) => t.private)!;
      await pressInShell(h, 'Tab', ['control', 'shift']);
      await waitFor('private tab in front', () => focusedTab(h), (t) => t.id === privateTab.id);
      await pressInShell(h, 'W', ['control']);
      await waitFor('closed', () => tabs(h), (t) => !t.some((x) => x.private));
      await sleep(500);
      await pressInShell(h, 'N', ['control', 'shift']);
      await navigateTo(h, server.url('cookie.html'));
      await waitForPage(h, 'cookie');
      expect(await inPage<string>(h, 'document.cookie', await focusedPage(h))).not.toContain('hs_test');
    } finally {
      await h.close();
    }
  });

  it('J6 private tabs are not reopened after a restart', async () => {
    const profile = newProfile({ onStartup: 'last-tabs' });
    let h = await launch(server.url('link-a.html'), { userDataDir: profile, keepRunning: true });
    try {
      await waitForPage(h, 'link-a');
      await pressInShell(h, 'N', ['control', 'shift']);
      await navigateTo(h, server.url('link-b.html'));
      await waitForPage(h, 'link-b');
      await h.app.evaluate(({ app }) => app.quit());
      await waitForExit(h, 8000);
    } finally {
      await h.close();
    }
    const session = JSON.parse(readFileSync(join(profile, 'session.json'), 'utf8')) as { tabs: string[] };
    expect(session.tabs).toEqual([server.url('link-a.html')]);
    h = await launch('', { userDataDir: profile });
    try {
      await waitFor('reopened', () => tabs(h), (t) => t.length === 1 && t[0]!.url === server.url('link-a.html'));
    } finally {
      await h.close();
    }
  });

  it('J7 the shield blocks trackers in a private tab too', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      const ad = server.hits.get('/ddm/ad.gif') ?? 0;
      await pressInShell(h, 'N', ['control', 'shift']);
      await navigateTo(h, server.url('shield.html').replace('127.0.0.1', 'shop.test'));
      await waitForPage(h, 'shield.html');
      await waitFor('page done', () => inPage<string>(h, 'document.title', 'shield.html'), (t) => t === 'Shield test ready');
      expect(server.hits.get('/ddm/ad.gif') ?? 0).toBe(ad);
      await waitFor('counted', () => shellCall(h, 'shield'), (s) => s.count === 2);
    } finally {
      await h.close();
    }
  });
});

describe('GitHub issues #8 and #10', () => {
  it('#8 layers and shield choices made in a private tab stay in memory, shared by private tabs until the last closes', async () => {
    const profile = newProfile({ layersOnOpen: true });
    let h = await launch(server.url('link-a.html'), { userDataDir: profile });
    const site = named('shield.html');
    const settingsText = () => readFileSync(join(profile, 'settings.json'), 'utf8');
    try {
      await waitForPage(h, 'link-a');
      await pressInShell(h, 'N', ['control', 'shift']);
      await navigateTo(h, site);
      await waitForPage(h, 'shield.html');
      await h.shell.click(BAR('layers')); // layers off for shop.test, in this private tab
      await waitFor('layers off', () => shellCall(h, 'layers'), (l) => !l.on);
      await h.shell.click('hs-shield [data-testid="shield"]');
      await h.shell.click('hs-shield [data-testid="shield-pause"]');
      await waitFor(
        'paused here',
        async () => (await inPage<string>(h, 'document.title', 'shield.html')) === 'Shield test ready' && (await shellCall(h, 'shield')).count === 0,
        (v) => v,
      );
      await sleep(500);
      expect(settingsText()).not.toContain('shop.test');

      // Another private tab on the site shares the choices while one is open.
      const ad = server.hits.get('/ddm/ad.gif') ?? 0;
      await pressInShell(h, 'N', ['control', 'shift']);
      await navigateTo(h, site);
      await waitForPage(h, 'shield.html');
      await waitFor('page done', () => inPage<string>(h, 'document.title', 'shield.html'), (t) => t === 'Shield test ready');
      expect(server.hits.get('/ddm/ad.gif') ?? 0).toBe(ad + 1); // still paused: the ad went through
      expect((await shellCall(h, 'layers')).on).toBe(false);

      // A normal tab on the same site is not affected.
      await pressInShell(h, 'T', ['control']);
      await navigateTo(h, site);
      await waitForPage(h, 'shield.html');
      await waitFor('blocked in a normal tab', () => shellCall(h, 'shield'), (s) => s.count === 2);
      expect((await shellCall(h, 'layers')).on).toBe(true);

      // Close every private tab: the choices go.
      for (const t of (await tabs(h)).filter((x) => x.private)) {
        while ((await focusedTab(h)).id !== t.id) await pressInShell(h, 'Tab', ['control']);
        await pressInShell(h, 'W', ['control']);
      }
      await waitFor('no private tabs', () => tabs(h), (t) => !t.some((x) => x.private));
      await sleep(500);
      await pressInShell(h, 'N', ['control', 'shift']);
      await navigateTo(h, site);
      await waitForPage(h, 'shield.html');
      await waitFor('blocked again in a new private tab', () => shellCall(h, 'shield'), (s) => s.count === 2);
      expect((await shellCall(h, 'layers')).on).toBe(true);
    } finally {
      await h.close();
    }
    expect(settingsText()).not.toContain('shop.test');
    h = await launch(server.url('link-a.html'), { userDataDir: profile });
    try {
      await waitForPage(h, 'link-a');
      expect(settingsText()).not.toContain('shop.test'); // after a restart too
    } finally {
      await h.close();
    }
  });

  it('#10 a slow download stays listed and cancellable after 100 later ones finish', async () => {
    const folder = newFolder('hypersol-e2e-downloads-');
    const h = await launch(server.url('find.html'), { userDataDir: newProfile(), downloadsDir: folder });
    try {
      await waitForPage(h, 'find');
      const page = await focusedPage(h);
      const download = (path: string) =>
        h.app.evaluate(({ webContents }, { id, url }) => webContents.fromId(id)!.downloadURL(url), { id: page.id, url: server.url(path) });
      await download('download/slow.bin');
      await waitFor('slow running', () => shellCall(h, 'downloads'), (d) =>
        d.some((x) => x.filename === 'slow.bin' && x.state === 'progressing' && x.received > 0));
      for (let i = 0; i < 100; i++) await download(`download/sample.txt?n=${i}`);
      await waitFor('100 finished', () => shellCall(h, 'downloads'), (d) => d.filter((x) => x.state === 'completed').length >= 99, 60_000);
      const slow = (await shellCall(h, 'downloads')).find((x) => x.filename === 'slow.bin');
      expect(slow?.state).toBe('progressing');
      const cancel = await h.shell.evaluate(
        (id) => (window as unknown as { hypersol: { downloads(r: object): Promise<{ ok: boolean }> } }).hypersol.downloads({ op: 'downloads.cancel', id }),
        slow!.id,
      );
      expect(cancel.ok).toBe(true);
      await waitFor('cancelled', () => shellCall(h, 'downloads'), (d) => d.some((x) => x.id === slow!.id && x.state === 'cancelled'));
    } finally {
      await h.close();
    }
  }, 120_000);
});

/** The shield test page under its named test host. */
function named(file: string): string {
  return server.url(file).replace('127.0.0.1', 'shop.test');
}
