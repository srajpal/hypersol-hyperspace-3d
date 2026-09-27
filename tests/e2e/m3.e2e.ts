/**
 * Milestone 3 end-to-end checks E1 to E10 (TODO.md): bookmarks, history,
 * the Library and Settings panels, the start panel's data, restarts,
 * clearing data, damaged saved data, and keyboard access.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import {
  focusedTab,
  inPage,
  launch,
  navigateTo,
  pressInPage,
  pressInShell,
  removeFolder,
  settled,
  shellCall,
  sleep,
  tabs,
  waitFor,
  waitForExit,
  waitForPage,
  type Harness,
  settingsTo,
} from './harness';

let server: FixtureServer;
const profiles: string[] = [];
const searchUrl = () => `${server.base}search?q=%s`;

function newProfile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'hypersol-e2e-profile-'));
  profiles.push(dir);
  return dir;
}

beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
  for (const dir of profiles) await removeFolder(dir);
});

const STAR = 'hs-toolbar [data-testid="star"]';
const LIB = (id: string) => `hs-library [data-testid="${id}"]`;
const SET = (id: string) => `hs-settings [data-testid="${id}"]`;
const FOCUSED = '[data-testid="page-panel"][aria-hidden="false"]';

function starState(h: Harness): Promise<string | null> {
  return h.shell.locator(STAR).getAttribute('aria-pressed');
}

async function openLibrary(h: Harness, view: 'bookmarks' | 'history'): Promise<void> {
  if ((await shellCall(h, 'openPanel')) !== 'library') await pressInShell(h, 'O', ['control', 'shift']);
  await waitFor('library open', () => shellCall(h, 'openPanel'), (p) => p === 'library');
  await h.shell.click(LIB(`lib-tab-${view}`));
  await waitFor(`${view} view`, () => h.shell.locator(LIB(`lib-tab-${view}`)).getAttribute('aria-selected'), (s) => s === 'true');
}

function libTitles(h: Harness): Promise<string[]> {
  return h.shell.locator(`${LIB('lib-item')} .title`).allTextContents();
}

async function openSettings(h: Harness): Promise<void> {
  if ((await shellCall(h, 'openPanel')) !== 'settings') await pressInShell(h, ',', ['control']);
  await waitFor('settings open', () => shellCall(h, 'openPanel'), (p) => p === 'settings');
}

describe('E1 to E3: bookmarks, history, and the Library', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    await waitForPage(h, 'link-a');
  });
  afterAll(async () => h?.close());

  it('E1 the star and Ctrl+D add and remove a bookmark', async () => {
    await waitFor('star ready', () => h.shell.locator(STAR).isDisabled(), (d) => !d);
    expect(await starState(h)).toBe('false');
    await h.shell.click(STAR);
    await waitFor('bookmarked', () => starState(h), (s) => s === 'true');
    await pressInShell(h, 'D', ['control']);
    await waitFor('removed', () => starState(h), (s) => s === 'false');
    await pressInPage(h, 'D', ['control']); // from inside the page too
    await waitFor('bookmarked again', () => starState(h), (s) => s === 'true');
    await openLibrary(h, 'bookmarks');
    await waitFor('bookmark listed', () => libTitles(h), (t) => t.join() === 'Link A');
    await h.shell.keyboard.press('Escape');
  });

  it('E2 records history by day, searches it, deletes one entry, and clears all', async () => {
    await navigateTo(h, server.url('link-b.html'));
    await waitForPage(h, 'link-b');
    await navigateTo(h, server.url('form.html'));
    await waitForPage(h, 'form');
    await openLibrary(h, 'history');
    await waitFor('three visits', () => libTitles(h), (t) => t.length === 3);
    expect(await libTitles(h)).toEqual(['Form', 'Link B', 'Link A']);
    expect(await h.shell.locator('hs-library h3').allTextContents()).toEqual(['Today']);

    await h.shell.fill(LIB('lib-search'), 'link b');
    await waitFor('search result', () => libTitles(h), (t) => t.join() === 'Link B');
    await h.shell.fill(LIB('lib-search'), '');
    await waitFor('all again', () => libTitles(h), (t) => t.length === 3);

    await h.shell.locator(LIB('lib-delete')).first().click();
    await waitFor('one deleted', () => libTitles(h), (t) => t.join() === 'Link B,Link A');

    await h.shell.click(LIB('lib-clear'));
    await h.shell.click(LIB('lib-clear-cancel'));
    expect(await libTitles(h)).toHaveLength(2); // cancel keeps everything
    await h.shell.click(LIB('lib-clear'));
    await h.shell.click(LIB('lib-clear-confirm'));
    await waitFor('history empty', () => h.shell.locator(LIB('lib-empty')).textContent(), (t) => t === 'Nothing saved yet');
  });

  it('E2 searches once typing pauses, not on every key (GitHub issue #4)', async () => {
    await navigateTo(h, server.url('link-b.html'));
    await waitForPage(h, 'link-b');
    await openLibrary(h, 'history');
    await waitFor('a visit listed', () => libTitles(h), (t) => t.length > 0);
    const searches = () =>
      h.app.evaluate(() => (globalThis as unknown as { __hypersolTest: { dataOps: Record<string, number> } }).__hypersolTest.dataOps['history.search'] ?? 0);
    const before = await searches();
    await h.shell.locator(LIB('lib-search')).pressSequentially('link b', { delay: 30 });
    await waitFor('search result', () => libTitles(h), (t) => t.join() === 'Link B');
    // Six keys typed quickly: one search after the pause, not six.
    expect((await searches()) - before).toBeLessThanOrEqual(2);
    await h.shell.fill(LIB('lib-search'), '');
    await h.shell.keyboard.press('Escape');
  });

  it('E3 opens a bookmark from the Library and removes it', async () => {
    await openLibrary(h, 'bookmarks');
    await waitFor('bookmark listed', () => libTitles(h), (t) => t.join() === 'Link A');
    await h.shell.locator(LIB('lib-item')).first().click();
    await waitFor('panel closed', () => shellCall(h, 'openPanel'), (p) => p === null);
    await waitFor('opened in the tab', () => focusedTab(h), (t) => t.url.endsWith('link-a.html') && t.state === 'loaded');
    await openLibrary(h, 'bookmarks');
    await h.shell.locator(LIB('lib-remove')).first().click();
    await waitFor('no bookmarks', () => h.shell.locator(LIB('lib-empty')).textContent(), (t) => t === 'Nothing saved yet');
    await waitFor('star off', () => starState(h), (s) => s === 'false');
    await h.shell.keyboard.press('Escape');
  });
});

describe('E4 start panel with your data', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    await waitForPage(h, 'link-a');
  });
  afterAll(async () => h?.close());

  it('shows bookmarks and recent history, and opens them', async () => {
    await waitFor('star ready', () => h.shell.locator(STAR).isDisabled(), (d) => !d);
    await h.shell.click(STAR);
    await waitFor('bookmarked', () => starState(h), (s) => s === 'true');
    await navigateTo(h, server.url('link-b.html'));
    await waitForPage(h, 'link-b');
    await pressInShell(h, 'T', ['control']);
    await settled(h);
    const panel = `${FOCUSED} [data-testid="start-panel"]`;
    await waitFor(
      'bookmark tile',
      () => h.shell.locator(`${panel} [data-testid="start-bookmarks"] .hs-start-label`).allTextContents(),
      (t) => t.join() === 'Link A',
    );
    await waitFor(
      'recent list',
      () => h.shell.locator(`${panel} [data-testid="start-recent"] .hs-start-label`).allTextContents(),
      (t) => t.join() === 'Link B,Link A',
    );
    await h.shell.locator(`${panel} [data-testid="start-recent"] button`).first().click();
    await waitFor('opened here', () => focusedTab(h), (t) => t.url.endsWith('link-b.html') && t.state === 'loaded');
    expect(await tabs(h)).toHaveLength(2);
  });
});

describe('E5 search engine setting', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch('', { userDataDir: newProfile(), searchUrl: searchUrl() });
  });
  afterAll(async () => h?.close());

  it('sends searches to the chosen engine', async () => {
    await openSettings(h);
    await settingsTo(h, 'set-engine-duckduckgo');
    expect(await h.shell.locator(SET('set-engine-duckduckgo')).isChecked()).toBe(true);
    await settingsTo(h, 'set-engine-brave');
    await h.shell.click(SET('set-engine-brave'));
    await waitFor('saved', () => h.shell.locator(SET('set-message')).textContent(), (t) => t === 'Saved.');
    await h.shell.keyboard.press('Escape');
    await navigateTo(h, 'hello world');
    // Nothing loads from the internet in tests; the address shows where the search went.
    await waitFor(
      'Brave search address',
      () => focusedTab(h),
      (t) => t.url === 'https://search.brave.com/search?q=hello%20world',
    );
    await openSettings(h);
    await settingsTo(h, 'set-engine-duckduckgo');
    await h.shell.click(SET('set-engine-duckduckgo'));
    await settingsTo(h, 'set-engine-duckduckgo');
    await waitFor('saved', () => h.shell.locator(SET('set-engine-duckduckgo')).isChecked(), (c) => c);
    await h.shell.keyboard.press('Escape');
    await navigateTo(h, 'hello again');
    await waitForPage(h, '/search');
    expect((await focusedTab(h)).url).toBe(`${server.base}search?q=hello%20again`);
  });
});

describe('E6 and E7: restarts', () => {
  it('E6 reopens the tabs from last time when asked to', async () => {
    const profile = newProfile();
    let h = await launch('', { userDataDir: profile });
    await openSettings(h);
    await settingsTo(h, 'set-startup-last-tabs');
    await h.shell.click(SET('set-startup-last-tabs'));
    await waitFor('saved', () => h.shell.locator(SET('set-message')).textContent(), (t) => t === 'Saved.');
    await h.shell.keyboard.press('Escape');
    await navigateTo(h, server.url('link-a.html'));
    await waitForPage(h, 'link-a');
    await pressInShell(h, 'T', ['control']);
    await settled(h);
    await navigateTo(h, server.url('link-b.html'));
    await waitForPage(h, 'link-b');
    await pressInShell(h, 'Tab', ['control']);
    await waitFor('page A focused', () => focusedTab(h), (t) => t.url.endsWith('link-a.html'));
    await waitFor('session saved', async () => existsSync(join(profile, 'session.json')), (x) => x);
    await new Promise((r) => setTimeout(r, 800)); // the save waits 400 ms for changes to settle
    await h.close();

    h = await launch('', { userDataDir: profile });
    try {
      const restored = await waitFor('two tabs back', () => tabs(h), (t) => t.length === 2);
      expect(restored.map((t) => t.url)).toEqual([server.url('link-a.html'), server.url('link-b.html')]);
      expect((await focusedTab(h)).url).toBe(server.url('link-a.html'));
    } finally {
      await h.close();
    }
  });

  it('E6 keeps the latest tabs when the app closes right after a change (GitHub issue #3)', async () => {
    const profile = newProfile();
    writeFileSync(join(profile, 'settings.json'), JSON.stringify({ searchEngine: 'duckduckgo', onStartup: 'last-tabs' }));
    let h = await launch(server.url('link-a.html'), { userDataDir: profile });
    await waitForPage(h, 'link-a');
    await pressInShell(h, 'T', ['control']);
    await settled(h);
    await navigateTo(h, server.url('link-b.html'));
    await waitForPage(h, 'link-b');
    await navigateTo(h, server.url('form.html'));
    await waitForPage(h, 'form');
    await h.close(); // at once: well inside the 400 ms the usual save waits

    h = await launch('', { userDataDir: profile });
    try {
      const restored = await waitFor('tabs back', () => tabs(h), (t) => t.length === 2);
      expect(restored.map((t) => t.url)).toEqual([server.url('link-a.html'), server.url('form.html')]);
      expect((await focusedTab(h)).url).toBe(server.url('form.html'));
    } finally {
      await h.close();
    }
  });

  it('E6 says so in Settings when the open tabs cannot be saved (GitHub issue #3)', async () => {
    const profile = newProfile();
    mkdirSync(join(profile, 'session.json')); // a folder where the file should be
    const h = await launch(server.url('link-a.html'), { userDataDir: profile });
    try {
      await waitForPage(h, 'link-a');
      await openSettings(h);
      await settingsTo(h, 'set-session-problem');
      await waitFor(
        'save problem shown',
        () => h.shell.locator(SET('set-session-problem')).textContent(),
        (t) => (t ?? '').includes("Couldn't save your open tabs"),
      );
    } finally {
      await h.close();
    }
  });

  it('E7 keeps bookmarks, history, and settings across a restart', async () => {
    const profile = newProfile();
    let h = await launch(server.url('link-a.html'), { userDataDir: profile });
    await waitForPage(h, 'link-a');
    await waitFor('star ready', () => h.shell.locator(STAR).isDisabled(), (d) => !d);
    await h.shell.click(STAR);
    await waitFor('bookmarked', () => starState(h), (s) => s === 'true');
    await navigateTo(h, server.url('link-b.html'));
    await waitForPage(h, 'link-b');
    await openSettings(h);
    await settingsTo(h, 'set-engine-bing');
    await h.shell.click(SET('set-engine-bing'));
    await waitFor('saved', () => h.shell.locator(SET('set-message')).textContent(), (t) => t === 'Saved.');
    await h.close();

    h = await launch(server.url('form.html'), { userDataDir: profile });
    try {
      await waitForPage(h, 'form');
      await openLibrary(h, 'bookmarks');
      await waitFor('bookmark kept', () => libTitles(h), (t) => t.join() === 'Link A');
      await openLibrary(h, 'history');
      await waitFor('history kept', () => libTitles(h), (t) => t.join() === 'Form,Link B,Link A');
      await openSettings(h);
      await settingsTo(h, 'set-engine-bing');
      await waitFor('setting kept', () => h.shell.locator(SET('set-engine-bing')).isChecked(), (c) => c);
    } finally {
      await h.close();
    }
  });
});

describe('E6b quitting and closing keep the latest tabs (PR #7 review)', () => {
  // These run with the app kept alive when its last window closes, as it
  // is on macOS, so a quit that turned into a mere window close would show.
  const lastTabs = JSON.stringify({ searchEngine: 'duckduckgo', onStartup: 'last-tabs' });

  async function twoTabs(h: Harness): Promise<void> {
    await waitForPage(h, 'link-a');
    await pressInShell(h, 'T', ['control']);
    await settled(h);
    await navigateTo(h, server.url('link-b.html'));
    await waitForPage(h, 'link-b');
  }

  function savedTabs(profile: string): string[] {
    const text = readFileSync(join(profile, 'session.json'), 'utf8');
    return (JSON.parse(text) as { tabs: string[] }).tabs;
  }

  it('Quit saves the tabs and ends the app, even where closing the last window does not', async () => {
    const profile = newProfile();
    writeFileSync(join(profile, 'settings.json'), lastTabs);
    const h = await launch(server.url('link-a.html'), { userDataDir: profile, keepRunning: true });
    try {
      await twoTabs(h);
      await h.app.evaluate(({ app }) => app.quit()); // straight after the last change
      expect(await waitForExit(h, 5000)).toBeLessThan(5000);
      expect(savedTabs(profile)).toEqual([server.url('link-a.html'), server.url('link-b.html')]);
    } finally {
      await h.close();
    }
  });

  it('closing the window saves the tabs and, where the app keeps running, leaves it running', async () => {
    const profile = newProfile();
    writeFileSync(join(profile, 'settings.json'), lastTabs);
    const h = await launch(server.url('link-a.html'), { userDataDir: profile, keepRunning: true });
    try {
      await twoTabs(h);
      await h.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close());
      await waitFor(
        'the window to close',
        () => h.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length),
        (n) => n === 0,
        5000,
      );
      await sleep(1000);
      expect(h.proc.exitCode).toBeNull(); // still running, like macOS
      expect(savedTabs(profile)).toEqual([server.url('link-a.html'), server.url('link-b.html')]);
    } finally {
      await h.close();
    }
  });

  it('if the shell never answers, Quit still ends the app after the 2 s wait', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile(), keepRunning: true });
    try {
      await waitForPage(h, 'link-a');
      await shellCall(h, 'ignorePrepareClose');
      const start = Date.now();
      await h.app.evaluate(({ app }) => app.quit());
      await waitForExit(h, 8000);
      const took = Date.now() - start;
      expect(took).toBeGreaterThanOrEqual(1800);
      expect(took).toBeLessThan(6000);
    } finally {
      await h.close();
    }
  });

  it('if the shell never answers, closing the window still closes it after the 2 s wait', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile(), keepRunning: true });
    try {
      await waitForPage(h, 'link-a');
      await shellCall(h, 'ignorePrepareClose');
      const start = Date.now();
      await h.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close());
      await waitFor(
        'the window to close',
        () => h.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length),
        (n) => n === 0,
        8000,
      );
      const took = Date.now() - start;
      expect(took).toBeGreaterThanOrEqual(1800);
      expect(took).toBeLessThan(6000);
      expect(h.proc.exitCode).toBeNull();
    } finally {
      await h.close();
    }
  });
});

describe('E8 clear browsing data', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('cookie.html?set=1'), { userDataDir: newProfile() });
    await waitForPage(h, 'cookie');
  });
  afterAll(async () => h?.close());

  it('clears history and cookies', async () => {
    expect(await inPage<string>(h, 'document.cookie', 'cookie')).toContain('hs_test=1');
    await navigateTo(h, server.url('link-a.html'));
    await waitForPage(h, 'link-a');
    await openSettings(h);
    await settingsTo(h, 'set-clear-history');
    expect(await h.shell.locator(SET('set-clear-history')).isChecked()).toBe(true);
    await settingsTo(h, 'set-clear-cookies');
    await h.shell.click(SET('set-clear-cookies'));
    await settingsTo(h, 'set-clear');
    await h.shell.click(SET('set-clear'));
    await settingsTo(h, 'set-clear-confirm');
    await h.shell.click(SET('set-clear-confirm'));
    await waitFor('cleared', () => h.shell.locator(SET('set-message')).textContent(), (t) => t === 'Cleared.');
    await h.shell.keyboard.press('Escape');

    await navigateTo(h, server.url('cookie.html'));
    await waitForPage(h, 'cookie');
    expect(await inPage<string>(h, 'document.cookie', 'cookie')).not.toContain('hs_test');
    await openLibrary(h, 'history');
    // Only the visit made after clearing remains.
    await waitFor('history cleared', () => libTitles(h), (t) => t.join() === 'Cookie');
  });
});

describe('E9 damaged or blocked saved data', () => {
  it('a damaged settings file gives the defaults and is kept aside', async () => {
    const profile = newProfile();
    writeFileSync(join(profile, 'settings.json'), '{ this is not json');
    const h = await launch('', { userDataDir: profile });
    try {
      await openSettings(h);
      await settingsTo(h, 'set-engine-duckduckgo');
      expect(await h.shell.locator(SET('set-engine-duckduckgo')).isChecked()).toBe(true);
      await settingsTo(h, 'set-startup-new-tab');
      expect(await h.shell.locator(SET('set-startup-new-tab')).isChecked()).toBe(true);
      expect(readdirSync(profile).some((f) => f.startsWith('settings.json.damaged-'))).toBe(true);
      expect(h.errors).toEqual([]);
    } finally {
      await h.close();
    }
  });

  it('unreadable settings: the app opens, explains, and a failed change changes nothing (GitHub issue #2)', async () => {
    const profile = newProfile();
    mkdirSync(join(profile, 'settings.json')); // a folder where the file should be
    const h = await launch('', { userDataDir: profile, searchUrl: searchUrl() });
    try {
      await openSettings(h);
      await waitFor(
        'explanation',
        () => h.shell.locator(SET('set-problem')).textContent(),
        (t) => (t ?? '').includes("Your settings couldn't be read (EISDIR)"),
      );
      await settingsTo(h, 'set-engine-brave');
      await h.shell.click(SET('set-engine-brave'));
      await waitFor(
        'failure message',
        () => h.shell.locator(SET('set-message')).textContent(),
        (t) => (t ?? '').includes("Couldn't save your settings"),
      );
      await settingsTo(h, 'set-engine-duckduckgo');
      await waitFor('still DuckDuckGo', () => h.shell.locator(SET('set-engine-duckduckgo')).isChecked(), (c) => c);
      await settingsTo(h, 'set-engine-brave');
      expect(await h.shell.locator(SET('set-engine-brave')).isChecked()).toBe(false);
      await h.shell.keyboard.press('Escape');
      await navigateTo(h, 'still default');
      await waitForPage(h, '/search'); // the local stand-in for DuckDuckGo, not Brave
    } finally {
      await h.close();
    }
  });

  it('a database that cannot be opened: plain message, browsing still works', async () => {
    const profile = newProfile();
    mkdirSync(join(profile, 'hypersol.sqlite')); // a folder where the database file should be
    const h = await launch(server.url('link-a.html'), { userDataDir: profile });
    try {
      await waitForPage(h, 'link-a');
      await navigateTo(h, server.url('link-b.html'));
      await waitForPage(h, 'link-b');
      expect(await h.shell.locator(STAR).isDisabled()).toBe(true);
      await openLibrary(h, 'history');
      await waitFor('message', () => h.shell.locator(LIB('lib-error')).textContent(), (t) => t === "Couldn't open your saved data");
      await h.shell.keyboard.press('Escape');
      await pressInShell(h, 'T', ['control']);
      await settled(h);
      await waitFor(
        'start panel message',
        () => h.shell.locator(`${FOCUSED} [data-testid="start-bookmarks"]`).textContent(),
        (t) => (t ?? '').includes("Couldn't open your saved data"),
      );
    } finally {
      await h.close();
    }
  });
});

describe('E10 keyboard access to the panels', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    await waitForPage(h, 'link-a');
  });
  afterAll(async () => h?.close());

  const active = () =>
    h.shell.evaluate(() => {
      const a = document.activeElement;
      return {
        host: a?.tagName ?? '',
        inner: a?.shadowRoot?.activeElement?.getAttribute('data-testid') ?? a?.shadowRoot?.activeElement?.tagName ?? '',
      };
    });

  it('opens with shortcuts, moves focus in, and returns it on Escape', async () => {
    await pressInPage(h, 'L', ['control']);
    await waitFor('address focused', active, (a) => a.host === 'HS-TOOLBAR' && a.inner === 'address');

    await pressInShell(h, 'O', ['control', 'shift']);
    await waitFor('focus in the Library', active, (a) => a.host === 'HS-LIBRARY' && a.inner === 'lib-search');
    // The panel's other controls are reachable from the keyboard (the
    // Passwords tab came with milestone 9).
    await h.shell.keyboard.press('Shift+Tab');
    expect(await active()).toEqual({ host: 'HS-LIBRARY', inner: 'lib-tab-passwords' });
    await h.shell.keyboard.press('Shift+Tab');
    expect(await active()).toEqual({ host: 'HS-LIBRARY', inner: 'lib-tab-history' });
    await h.shell.keyboard.press('Shift+Tab');
    expect(await active()).toEqual({ host: 'HS-LIBRARY', inner: 'lib-tab-bookmarks' });
    await h.shell.keyboard.press('Escape');
    await waitFor('closed', () => shellCall(h, 'openPanel'), (p) => p === null);
    await waitFor('focus back in the address field', active, (a) => a.host === 'HS-TOOLBAR' && a.inner === 'address');
  });

  it('Ctrl+, opens Settings, switching from the Library keeps one panel open', async () => {
    await pressInShell(h, 'O', ['control', 'shift']);
    await waitFor('library', () => shellCall(h, 'openPanel'), (p) => p === 'library');
    await pressInShell(h, ',', ['control']);
    await waitFor('settings', () => shellCall(h, 'openPanel'), (p) => p === 'settings');
    expect(await h.shell.locator('hs-library').getAttribute('open')).toBeNull();
    await waitFor('focus in Settings', active, (a) => a.host === 'HS-SETTINGS');
    await h.shell.keyboard.press('Escape');
    await waitFor('closed', () => shellCall(h, 'openPanel'), (p) => p === null);
  });

  it('the menu opens both panels', async () => {
    await h.shell.click('hs-toolbar [data-testid="menu"]');
    await h.shell.click('hs-toolbar [data-testid="menu-library"]');
    await waitFor('library', () => shellCall(h, 'openPanel'), (p) => p === 'library');
    await h.shell.click('hs-toolbar [data-testid="menu"]');
    await h.shell.click('hs-toolbar [data-testid="menu-settings"]');
    await waitFor('settings', () => shellCall(h, 'openPanel'), (p) => p === 'settings');
    await h.shell.click(SET('settings-close'));
    await waitFor('closed', () => shellCall(h, 'openPanel'), (p) => p === null);
  });
});
