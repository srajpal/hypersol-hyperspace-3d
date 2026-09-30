/**
 * Milestone 10 end-to-end checks L1 to L10 (TODO.md): reopening closed
 * tabs, tab search, mute, card size, how tabs are shown, economy mode,
 * sleeping tabs, history through the worker and its budget, and the
 * new shortcuts and menu entries.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import {
  clickAt,
  clickCard,
  focusedPage,
  focusedTab,
  inPage,
  launch,
  navigateTo,
  pressInPage,
  pressInShell,
  removeFolder,
  screenPointOf,
  settled,
  shellCall,
  sleep,
  tabs,
  typeInPage,
  waitFor,
  waitForExit,
  waitForPage,
  type Harness,
  settingsTo,
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
const SEARCH = (id: string) => `hs-tab-search [data-testid="${id}"]`;
const STRIP = (id: string) => `hs-tab-strip [data-testid="${id}"]`;
const saved = (profile: string) => JSON.parse(readFileSync(join(profile, 'settings.json'), 'utf8')) as Record<string, unknown>;
const setSettings = (h: Harness, patch: object) =>
  h.shell.evaluate(async (p) => {
    const w = window as unknown as { hypersol: { data(r: object): Promise<{ ok: boolean; error?: string }> } };
    const reply = await w.hypersol.data({ op: 'settings.set', patch: p });
    if (!reply.ok) throw new Error(reply.error);
  }, patch);

async function openTab(h: Harness, file: string): Promise<number> {
  await pressInShell(h, 'T', ['control']);
  await settled(h);
  await navigateTo(h, server.url(file));
  await waitForPage(h, file.split('?')[0]!.replace('.html', ''));
  return (await focusedTab(h)).id;
}

describe('L1, L2, L10: reopening, searching, shortcuts and menus', () => {
  it('L1 Ctrl+Shift+T and the menu reopen closed tabs in place, with back history; private tabs are not kept', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      expect(await shellCall(h, 'closedCount')).toBe(0);
      await openTab(h, 'link-b.html');
      await navigateTo(h, server.url('find.html'));
      await waitForPage(h, 'find');
      await openTab(h, 'form.html');
      // Close the middle tab (find.html, with link-b behind it).
      await pressInShell(h, 'Tab', ['control', 'shift']);
      await waitFor('middle tab in front', () => focusedTab(h), (t) => t.url.includes('find'));
      await pressInShell(h, 'W', ['control']);
      await waitFor('closed', () => tabs(h), (t) => t.length === 2);
      expect(await shellCall(h, 'closedCount')).toBe(1);

      // A private tab is not kept for reopening.
      await pressInShell(h, 'N', ['control', 'shift']);
      await navigateTo(h, server.url('cookie.html'));
      await waitForPage(h, 'cookie');
      await pressInShell(h, 'W', ['control']);
      await waitFor('private closed', () => tabs(h), (t) => t.length === 2);
      expect(await shellCall(h, 'closedCount')).toBe(1);

      await pressInShell(h, 'T', ['control', 'shift']);
      const reopened = await waitFor('reopened', () => tabs(h), (t) => t.length === 3 && t[1]!.url.includes('find.html') && t[1]!.state === 'loaded');
      expect(reopened[1]!.focused).toBe(true);
      await waitForPage(h, 'find');
      expect(await waitFor('back history', () => focusedTab(h), (t) => t.canGoBack)).toBeTruthy();
      await h.shell.click(BAR('back'));
      await waitFor('back to link-b', () => focusedTab(h), (t) => t.url.includes('link-b'));
      expect(await shellCall(h, 'closedCount')).toBe(0);

      // L10: the menu entry, disabled when nothing is closed, and reopening from the menu.
      await h.shell.click(BAR('menu'));
      expect(await h.shell.locator(BAR('menu-reopen-tab')).isDisabled()).toBe(true);
      await h.shell.click(BAR('menu-close-tab'));
      await waitFor('closed again', () => tabs(h), (t) => t.length === 2);
      await h.shell.click(BAR('menu'));
      await h.shell.click(BAR('menu-reopen-tab'));
      await waitFor('reopened from the menu', () => tabs(h), (t) => t.length === 3 && t[1]!.url.includes('link-b'));
    } finally {
      await h.close();
    }
  });

  it('L2 and L10 search tabs: shortcut from the page and the shell, filter, Enter, close, Escape', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      await openTab(h, 'link-b.html');
      await openTab(h, 'find.html');
      // From the page.
      await pressInPage(h, 'A', ['control', 'shift']);
      await waitFor('search open', () => h.shell.locator(SEARCH('tab-search')).isVisible(), (v) => v);
      expect(await h.shell.locator(SEARCH('tab-search-item')).count()).toBe(3);
      await h.shell.fill(SEARCH('tab-search-input'), 'link-b');
      await waitFor('filtered', () => h.shell.locator(SEARCH('tab-search-item')).count(), (n) => n === 1);
      await h.shell.press(SEARCH('tab-search-input'), 'Enter');
      await waitFor('switched', () => focusedTab(h), (t) => t.url.includes('link-b'));
      expect(await h.shell.locator(SEARCH('tab-search')).isVisible()).toBe(false);
      // From the menu; close a tab from the list; Escape.
      await h.shell.click(BAR('menu'));
      await h.shell.click(BAR('menu-search-tabs'));
      await h.shell.fill(SEARCH('tab-search-input'), 'find');
      await waitFor('filtered', () => h.shell.locator(SEARCH('tab-search-item')).count(), (n) => n === 1);
      await h.shell.click(SEARCH('tab-search-close'));
      await waitFor('closed from the list', () => tabs(h), (t) => t.length === 2);
      await h.shell.fill(SEARCH('tab-search-input'), 'nothing like this');
      expect(await h.shell.locator(SEARCH('tab-search-empty')).isVisible()).toBe(true);
      await h.shell.press(SEARCH('tab-search-input'), 'Escape');
      await waitFor('search closed', () => h.shell.locator(SEARCH('tab-search')).isVisible(), (v) => !v);
      // And from the shell's keyboard, with arrows.
      await pressInShell(h, 'A', ['control', 'shift']);
      await waitFor('search open', () => h.shell.locator(SEARCH('tab-search')).isVisible(), (v) => v);
      await h.shell.press(SEARCH('tab-search-input'), 'ArrowUp');
      await h.shell.press(SEARCH('tab-search-input'), 'Enter');
      await waitFor('first tab', () => focusedTab(h), (t) => t.url.includes('link-a'));
    } finally {
      await h.close();
    }
  });
});

describe('L3: mute', () => {
  it('a page making sound shows the speaker; the card, the list, and the menu mute and unmute it', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ tabDisplay: 'cards' }) });
    try {
      await waitForPage(h, 'link-a');
      const tabId = await openTab(h, 'sound.html');
      const page = await focusedPage(h);
      expect(await inPage<string>(h, 'play()', page)).toBe('running');
      await waitFor('the tab is audible', () => focusedTab(h), (t) => t.audible, 10_000);
      // The card's speaker.
      await clickCard(h, tabId, 'audio');
      await waitFor('muted', () => focusedTab(h), (t) => t.muted);
      expect(await h.app.evaluate(({ webContents }, id) => webContents.fromId(id)!.isAudioMuted(), page.id)).toBe(true);
      // The menu.
      await h.shell.click(BAR('menu'));
      expect(await h.shell.locator(BAR('menu-mute-tab')).textContent()).toContain('Unmute tab');
      await h.shell.click(BAR('menu-mute-tab'));
      await waitFor('unmuted', () => focusedTab(h), (t) => !t.muted);
      expect(await h.app.evaluate(({ webContents }, id) => webContents.fromId(id)!.isAudioMuted(), page.id)).toBe(false);
      // The list in the top bar.
      await setSettings(h, { tabDisplay: 'list' });
      await waitFor('list shown', () => shellCall(h, 'tabDisplay'), (d) => d.strip);
      await h.shell.click(STRIP('strip-mute'));
      await waitFor('muted from the list', () => focusedTab(h), (t) => t.muted);
      await inPage(h, 'stop()', page);
    } finally {
      await h.close();
    }
  });
});

describe('L4 and L5: card size and how tabs are shown', () => {
  it('L4 Small, Medium, and Large change the cards and the page, and are saved', async () => {
    const profile = newProfile();
    const h = await launch(server.url('link-a.html'), { userDataDir: profile });
    try {
      await waitForPage(h, 'link-a');
      await openTab(h, 'link-b.html');
      const width = async () => (await shellCall(h, 'layout')).panelWidth;
      const medium = await width();
      expect((await shellCall(h, 'tabDisplay')).scale).toBe(1);
      await pressInShell(h, ',', ['control']);
      await settingsTo(h, 'set-tab-size');
      await h.shell.selectOption('hs-settings [data-testid="set-tab-size"]', 'large');
      await waitFor('large cards', () => shellCall(h, 'tabDisplay'), (d) => d.scale === 1.3);
      expect(await width()).toBeLessThan(medium);
      await settingsTo(h, 'set-tab-size');
      await h.shell.selectOption('hs-settings [data-testid="set-tab-size"]', 'small');
      await waitFor('small cards', () => shellCall(h, 'tabDisplay'), (d) => d.scale === 0.8);
      expect(await width()).toBeGreaterThan(medium);
      await waitFor('saved', async () => saved(profile)['tabSize'], (v) => v === 'small');
    } finally {
      await h.close();
    }
  });

  // Milestone 11 (owner, prompt 50): "Cards that hide" was removed; tabs show
  // as cards or as a list, and a saved "autohide" opens as cards.
  it('L5 tabs show as cards or as a list; a saved "cards that hide" opens as cards; the list switches and closes tabs', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ tabDisplay: 'autohide' }) });
    try {
      await waitForPage(h, 'link-a');
      await openTab(h, 'link-b.html');
      expect(await shellCall(h, 'tabDisplay')).toMatchObject({ display: 'cards', railVisible: true, strip: false });
      await pressInShell(h, ',', ['control']);
      await settingsTo(h, 'set-tab-display');
      const options = await h.shell.locator('hs-settings [data-testid="set-tab-display"] option').evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value));
      expect(options).toEqual(['cards', 'list']);
      await pressInShell(h, 'Escape');

      await setSettings(h, { tabDisplay: 'list' });
      await waitFor('list only', () => shellCall(h, 'tabDisplay'), (x) => x.display === 'list' && x.strip && !x.railVisible);
      expect(await h.shell.locator(STRIP('strip-tab')).count()).toBe(2);
      await pressInShell(h, 'Tab', ['control']);
      await sleep(300);
      expect((await shellCall(h, 'tabDisplay')).railVisible).toBe(false);
      await h.shell.locator(STRIP('strip-tab')).first().click();
      await waitFor('switched from the list', () => focusedTab(h), (t) => t.url.includes('link-a'));
      await h.shell.locator(STRIP('strip-close')).last().click();
      await waitFor('closed from the list', () => tabs(h), (t) => t.length === 1);
      await h.shell.click(STRIP('strip-new'));
      await waitFor('new tab from the list', () => tabs(h), (t) => t.length === 2);

      await setSettings(h, { tabDisplay: 'cards' });
      await waitFor('cards again', () => shellCall(h, 'tabDisplay'), (x) => x.railVisible && !x.strip);
    } finally {
      await h.close();
    }
  });
});

describe('L6: economy mode', () => {
  it('lowers the resolution, turns effects off, caps the frame rate, shows ECO, and follows the power source', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ economy: 'off' }) });
    try {
      await waitForPage(h, 'link-a');
      const off = await shellCall(h, 'economy');
      expect(off.on).toBe(false);
      expect(off.pixelRatio).toBe(off.devicePixelRatio);
      expect(await h.shell.locator(BAR('eco-pill')).count()).toBe(0);

      await setSettings(h, { economy: 'on' });
      const on = await waitFor('economy on', () => shellCall(h, 'economy'), (e) => e.on);
      expect(on.pixelRatio).toBeLessThan(on.devicePixelRatio);
      expect(await h.shell.locator(BAR('eco-pill')).isVisible()).toBe(true);
      expect((await shellCall(h, 'sceneColors'))['sun']).toBe('hidden');
      expect(await h.shell.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--hs-scanlines').trim())).toBe('0');

      // A loading tab's spinner draws continuously: count the frames in a second.
      await pressInShell(h, 'T', ['control']);
      await navigateTo(h, server.url('slow?ms=6000'));
      await pressInShell(h, 'Tab', ['control']);
      await sleep(500);
      const before = (await shellCall(h, 'economy')).frames;
      await sleep(1000);
      const perSecond = (await shellCall(h, 'economy')).frames - before;
      expect(perSecond).toBeGreaterThan(5);
      expect(perSecond).toBeLessThanOrEqual(32);

      // On when running on battery.
      await setSettings(h, { economy: 'battery' });
      await waitFor('off on mains power', () => shellCall(h, 'economy'), (e) => !e.on);
      await h.app.evaluate(({ powerMonitor }) => powerMonitor.emit('on-battery'));
      await waitFor('on with battery power', () => shellCall(h, 'economy'), (e) => e.on);
      await h.app.evaluate(({ powerMonitor }) => powerMonitor.emit('on-ac'));
      await waitFor('off again', () => shellCall(h, 'economy'), (e) => !e.on);
    } finally {
      await h.close();
    }
  });
});

describe('L7: sleeping tabs', () => {
  it('an unused tab sleeps and wakes with its history; tabs with typed text or a download stay awake', async () => {
    const downloads = newFolder('hypersol-e2e-downloads-');
    // A "minute" of 100 ms: five minutes is half a second here.
    const h = await launch(server.url('link-b.html'), {
      userDataDir: newProfile({ tabSleep: 5, economy: 'off' }),
      sleepMinuteMs: 100,
      downloadsDir: downloads,
    });
    try {
      await waitForPage(h, 'link-b');
      await navigateTo(h, server.url('link-a.html'));
      await waitForPage(h, 'link-a');
      const idle = (await focusedTab(h)).id;
      const typedTab = await openTab(h, 'form.html');
      const formPage = await focusedPage(h);
      await clickAt(h, await screenPointOf(h, 'input', formPage));
      await typeInPage(h, 'draft', formPage);
      const downloadTab = await openTab(h, 'find.html');
      await navigateTo(h, server.url('download/slow.bin'));
      await waitFor('download running', () => shellCall(h, 'downloads'), (d) => d.some((x) => x.state === 'progressing' && x.received > 0));
      await openTab(h, 'link-b.html?front=1');
      await sleep(1000);
      await shellCall(h, 'sleepNow');
      const all = await waitFor('the idle tab asleep', () => tabs(h), (t) => t.find((x) => x.id === idle)?.asleep === true);
      expect(all.find((x) => x.id === typedTab)!.asleep).toBe(false);
      expect(all.find((x) => x.id === downloadTab)!.asleep).toBe(false);
      expect(all.find((x) => x.focused)!.asleep).toBe(false);
      expect(await shellCall(h, 'webContentsIdOf', idle)).toBeNull();

      // Opening it wakes it, on the same page and with its back history.
      await pressInShell(h, 'Tab', ['control']); // wraps to the first tab
      const woken = await waitFor('awake', () => focusedTab(h), (t) => t.id === idle && !t.asleep && t.state === 'loaded' && t.url.includes('link-a'));
      await waitForPage(h, 'link-a');
      expect(await waitFor('back history kept', () => focusedTab(h), (t) => t.canGoBack)).toBeTruthy();
      expect(woken.title).toBe('Link A');
      await h.shell.click(BAR('back'));
      await waitFor('back to the page before', () => focusedTab(h), (t) => t.url.includes('link-b'));
    } finally {
      await h.close();
    }
  });
});

describe('L8 and L9: history through the worker', () => {
  it('L8 history, search, and the start panel work through the worker thread', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      await navigateTo(h, server.url('link-b.html'));
      await waitForPage(h, 'link-b');
      expect(await h.app.evaluate(() => (globalThis as unknown as { __hypersolTest: { historyWorker(): boolean } }).__hypersolTest.historyWorker())).toBe(true);
      const found = await waitFor(
        'history search',
        () =>
          h.shell.evaluate(async () => {
            const w = window as unknown as { hypersol: { data(r: object): Promise<{ ok: boolean; value: { title: string }[] }> } };
            return (await w.hypersol.data({ op: 'history.search', query: 'link b', limit: 10 })).value.map((e) => e.title);
          }),
        (t) => t.includes('Link B'),
      );
      expect(found).toContain('Link B');
    } finally {
      await h.close();
    }
  });

  it('L9 with 100,000 visits, searches answer within 50 ms and the main process is never held 20 ms', async () => {
    const profile = newProfile();
    let h = await launch('', { userDataDir: profile, keepRunning: true });
    await h.app.evaluate(({ app }) => app.quit());
    await waitForExit(h, 30_000);
    await h.close();
    // Fill the history directly (the app made the tables and their triggers).
    const db = new DatabaseSync(join(profile, 'hypersol.sqlite'));
    db.exec('BEGIN');
    const insert = db.prepare('INSERT INTO history (url, title, visited_at) VALUES (?, ?, ?)');
    const words = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet'];
    for (let i = 0; i < 100_000; i++) insert.run(`https://site${i % 5000}.example/${words[i % 10]}/${i}`, `${words[i % 10]} page ${i}`, i);
    db.exec('COMMIT');
    db.close();

    h = await launch('', { userDataDir: profile });
    try {
      expect(await h.app.evaluate(() => (globalThis as unknown as { __hypersolTest: { historyWorker(): boolean } }).__hypersolTest.historyWorker())).toBe(true);
      const searches = () =>
        h.shell.evaluate(async () => {
          const w = window as unknown as { hypersol: { data(r: object): Promise<{ ok: boolean; value: unknown[] }> } };
          const out: number[] = [];
          for (const query of ['charlie', 'page 99', 'hotel', 'site42', 'go', '', 'juliet page', 'echo']) {
            const start = performance.now();
            const reply = await w.hypersol.data({ op: 'history.search', query, limit: 500 });
            out.push(performance.now() - start);
            if (!reply.ok) throw new Error('search failed');
          }
          const start = performance.now();
          await w.hypersol.data({ op: 'history.recent', limit: 8 });
          out.push(performance.now() - start);
          return out;
        });
      // First the answer times, with nothing else running.
      const timings = await searches();
      // Then the same searches again for the longest time the main process
      // is held: a chain of setImmediate calls keeps its event loop turning,
      // and the longest gap between two turns is the longest piece of work
      // in between. (An event-loop delay timer cannot be used: an idle
      // Windows process wakes only every 15.6 ms, so it read 16 to 24 ms
      // with no work at all; prompt 107.) The probe keeps a processor busy,
      // so the answer times are not taken while it runs.
      await h.app.evaluate(() => {
        const probe = { max: 0, stop: false };
        let last = performance.now();
        const turn = () => {
          const now = performance.now();
          probe.max = Math.max(probe.max, now - last);
          last = now;
          if (!probe.stop) setImmediate(turn);
        };
        setImmediate(turn);
        (globalThis as unknown as { __lag: typeof probe }).__lag = probe;
      });
      const probed = await searches();
      const lagMs = await h.app.evaluate(() => {
        const probe = (globalThis as unknown as { __lag: { max: number; stop: boolean } }).__lag;
        probe.stop = true;
        return probe.max;
      });
      writeFileSync(join(tmpdir(), 'hypersol-l9-timings.json'), JSON.stringify({ timings, probed, lagMs }));
      // The first search warms the page cache (a person's first search after starting the app).
      for (const ms of timings.slice(1)) expect(ms).toBeLessThan(50);
      expect(lagMs).toBeLessThan(20);
    } finally {
      await h.close();
    }
  }, 180_000);
});
