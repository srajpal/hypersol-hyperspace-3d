/**
 * Milestone 2 end-to-end checks D1 to D11 (TODO.md): tabs, top bar,
 * shortcuts, start panel, new-window rules, loading, error cards, and the
 * right-click menu. Every host except 127.0.0.1 is blocked for the run.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, startHttpsFixtureServer, type FixtureServer } from './fixture-server';
import {
  ADDRESS,
  APP_DIR,
  clickAt,
  clickUntil,
  clickCard,
  focusedPage,
  focusedTab,
  inPage,
  launch,
  mainLog,
  navigateTo,
  pressInPage,
  pressInShell,
  roomStill,
  describeMissedClick,
  screenPointOf,
  settled,
  shellCall,
  sleep,
  tabs,
  typeInPage,
  waitFor,
  waitForPage,
  type Harness,
} from './harness';

let server: FixtureServer;
const searchUrl = () => `${server.base}search?q=%s`;

beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
});

/** The focused tab's panel and the parts inside it. */
const FOCUSED = '[data-testid="page-panel"][aria-hidden="false"]';
const OVERLAY = `${FOCUSED} [data-testid="page-overlay"]`;
const bar = (id: string) => `hs-toolbar [data-testid="${id}"]`;
const NEW_TAB = bar('new-tab');

async function tabCount(h: Harness, n: number): Promise<void> {
  await waitFor(`${n} tabs`, () => tabs(h), (t) => t.length === n);
}

async function focusedWhere(h: Harness, what: string, ok: (t: Awaited<ReturnType<typeof focusedTab>>) => boolean) {
  return waitFor(what, () => focusedTab(h), ok);
}

/** Tells whether the shell's keyboard focus is in the address field. */
function addressHasFocus(h: Harness): Promise<boolean> {
  return h.shell.evaluate(() => {
    const bar = document.querySelector('hs-toolbar');
    return document.activeElement === bar && bar?.shadowRoot?.activeElement?.getAttribute('data-testid') === 'address';
  });
}

describe('D1 top bar', () => {
  // These share one app and run in order: back and forward need the page
  // the check before them loaded.
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'), { searchUrl: searchUrl() });
    await waitForPage(h, 'link-a');
  });
  afterAll(async () => h?.close());

  it('shows the address, and back and forward start disabled', async () => {
    expect(await h.shell.inputValue(ADDRESS)).toBe(server.url('link-a.html'));
    expect(await h.shell.locator(bar('back')).isDisabled()).toBe(true);
    expect(await h.shell.locator(bar('forward')).isDisabled()).toBe(true);
    expect(await h.shell.locator(bar('reload')).isDisabled()).toBe(false);
  });

  it('loads a typed address', async () => {
    await navigateTo(h, server.url('link-b.html'));
    await waitForPage(h, 'link-b');
    await waitFor('address to update', () => h.shell.inputValue(ADDRESS), (v) => v === server.url('link-b.html'));
  });

  it('goes back and forward with the buttons', async () => {
    await waitFor('back to enable', () => h.shell.locator(bar('back')).isDisabled(), (d) => !d);
    await h.shell.click(bar('back'));
    await focusedWhere(h, 'back to page A', (t) => t.url.endsWith('link-a.html') && t.state === 'loaded');
    await waitFor('forward to enable', () => h.shell.locator(bar('forward')).isDisabled(), (d) => !d);
    await h.shell.click(bar('forward'));
    await focusedWhere(h, 'forward to page B', (t) => t.url.endsWith('link-b.html') && t.state === 'loaded');
  });

  it('reloads with the button', async () => {
    const page = await focusedPage(h);
    await inPage(h, 'window.__marker = 42', page);
    await h.shell.click(bar('reload'));
    await waitFor('reload', () => inPage(h, 'window.__marker ?? null', page), (m) => m === null);
  });

  it('searches for words that are not an address', async () => {
    await navigateTo(h, 'hello 3d world');
    await waitForPage(h, '/search');
    expect(await inPage<string>(h, 'document.getElementById("query").textContent', '/search')).toBe('hello 3d world');
    expect((await focusedTab(h)).url).toBe(`${server.base}search?q=hello%203d%20world`);
  });
});

describe('D2 tabs', () => {
  // These share one app and run in order, each starting from the tabs the
  // one before left: one, two, two with a form filled in, two, one, a
  // fresh start tab.
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'), { searchUrl: searchUrl() });
    await waitForPage(h, 'link-a');
  });
  afterAll(async () => h?.close());

  it('fetches each page once (found in milestone 3: every new tab loaded twice)', async () => {
    const count = (url: string) =>
      h.app.evaluate((_e, url) => globalThis.__hypersolTest!.requests.filter((r) => r === url).length, url);
    expect(await count(server.url('link-a.html'))).toBe(1);
  });

  it('with one tab the rail is hidden; the new-tab button opens a start tab, the address field ready, and the rail appears', async () => {
    // Owner, prompt 33: the cards show only with two or more tabs.
    expect(await shellCall(h, 'railVisible')).toBe(false);
    expect(await shellCall(h, 'cardPoint', 'plus', 'body')).toBeNull();
    await h.shell.click(NEW_TAB);
    await tabCount(h, 2);
    await waitFor('rail shown', () => shellCall(h, 'railVisible'), (v) => v);
    const tab = await focusedTab(h);
    expect(tab.state).toBe('start');
    expect(await h.shell.locator(`${FOCUSED} [data-testid="start-panel"]`).isVisible()).toBe(true);
    await waitFor('address focus', () => addressHasFocus(h), (f) => f);
    expect(await h.shell.inputValue(ADDRESS)).toBe('');
  });

  it('switching tabs keeps each page as it was, without reloading', async () => {
    await navigateTo(h, server.url('form.html'));
    await waitForPage(h, 'form');
    const formPage = await focusedPage(h);
    const p = await screenPointOf(h, '#name', formPage);
    await clickAt(h, p);
    await waitFor('field focus', () => inPage(h, 'document.activeElement.id', formPage), (id) => id === 'name');
    await typeInPage(h, 'kept', formPage);
    await inPage(h, 'window.__marker = 7', formPage);

    const [first] = await tabs(h);
    await clickCard(h, first!.id);
    await focusedWhere(h, 'page A focused', (t) => t.id === first!.id);
    await settled(h);
    expect(await h.shell.inputValue(ADDRESS)).toBe(server.url('link-a.html'));

    await pressInShell(h, 'Tab', ['control']);
    await focusedWhere(h, 'form tab focused', (t) => t.url.endsWith('form.html'));
    await settled(h);
    expect(await inPage(h, 'window.__marker', formPage)).toBe(7);
    expect(await inPage(h, 'document.getElementById("name").value', formPage)).toBe('kept');
  });

  it('Ctrl+T, Ctrl+Tab, Ctrl+Shift+Tab, and Ctrl+W work from the shell', async () => {
    await pressInShell(h, 'T', ['control']);
    await tabCount(h, 3);
    expect((await focusedTab(h)).state).toBe('start');
    await pressInShell(h, 'Tab', ['control']);
    await focusedWhere(h, 'wrap to first tab', (t) => t.url.endsWith('link-a.html'));
    await pressInShell(h, 'Tab', ['control', 'shift']);
    await focusedWhere(h, 'back to the start tab', (t) => t.state === 'start');
    await pressInShell(h, 'W', ['control']);
    await tabCount(h, 2);
    await focusedWhere(h, 'form tab after close', (t) => t.url.endsWith('form.html'));
  });

  it("closes a tab with its card's close button", async () => {
    const [first] = await tabs(h);
    await clickCard(h, first!.id, 'close');
    await tabCount(h, 1);
    expect((await tabs(h))[0]!.url).toContain('form.html');
  });

  it('closing the last tab leaves a start tab, and the rail hides', async () => {
    expect(await shellCall(h, 'railVisible')).toBe(false); // one tab left
    const before = (await tabs(h))[0]!.id;
    await pressInShell(h, 'W', ['control']);
    await waitFor('a fresh start tab', () => tabs(h), (t) => t.length === 1 && t[0]!.id !== before);
    expect((await focusedTab(h)).state).toBe('start');
  });
});

describe('D3 snapshots and favicons', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'), { searchUrl: searchUrl() });
    await waitForPage(h, 'link-a');
  });
  afterAll(async () => h?.close());

  it('shows the page on its card and the favicon, then stops drawing', async () => {
    await waitFor('favicon', () => focusedTab(h), (t) => t.hasFavicon);
    await h.shell.click(NEW_TAB);
    await navigateTo(h, server.url('long.html'));
    await waitForPage(h, 'long');
    const all = await waitFor('snapshots on both cards', () => tabs(h), (t) => t.every((x) => x.hasSnapshot));
    expect(all).toHaveLength(2);
    // Spinners have stopped: nothing is drawn while idle.
    const before = await roomStill(h);
    await sleep(1500);
    expect(await shellCall(h, 'frames')).toBe(before);
  });
});

describe('D4 many tabs', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'));
    await waitForPage(h, 'link-a');
  });
  afterAll(async () => h?.close());

  it('scrolls the arc and keeps cards at full size', async () => {
    await h.shell.click(NEW_TAB);
    await tabCount(h, 2);
    await settled(h);
    const [a] = await tabs(h);
    // A card's size on screen: from its middle to its close button.
    const size = async (id: number) => {
      const body = (await shellCall(h, 'cardPoint', id, 'body'))!;
      const close = (await shellCall(h, 'cardPoint', id, 'close'))!;
      return Math.hypot(close.x - body.x, close.y - body.y);
    };
    const before = await size(a!.id);

    for (let i = 0; i < 10; i++) await pressInShell(h, 'T', ['control']);
    await tabCount(h, 12);
    await settled(h);
    const rail = await shellCall(h, 'rail');
    expect(rail.maxScroll).toBeGreaterThan(0);
    expect(rail.scroll).toBeGreaterThan(0); // scrolled down to the newest (focused) tab
    const focused = await focusedTab(h);
    expect(await shellCall(h, 'cardPoint', focused.id, 'body')).not.toBeNull();
    expect(await shellCall(h, 'cardPoint', 'plus', 'body')).not.toBeNull(); // "+" pinned in view

    // Wheel up over the rail brings the first cards back.
    const inRail = (await shellCall(h, 'cardPoint', focused.id, 'body'))!;
    await h.shell.mouse.move(inRail.x, inRail.y);
    for (let i = 0; i < 20; i++) await h.shell.mouse.wheel(0, -400);
    await waitFor('rail at the top', () => shellCall(h, 'rail'), (r) => r.scroll === 0);
    const all = await tabs(h);
    // The same card is the same size with twelve tabs as with two. (Until
    // 2026-09-26 this compared the spacing of the first two cards; the
    // arc's curve depends on the number of cards, which moves them a few
    // pixels without resizing them, and with the smaller cards that
    // crossed the tolerance.)
    expect(Math.abs((await size(all[0]!.id)) - before)).toBeLessThan(1.5);
    expect(await shellCall(h, 'cardPoint', all[11]!.id, 'body')).toBeNull(); // scrolled out of view
    expect(await shellCall(h, 'cardPoint', 'plus', 'body')).not.toBeNull(); // still in view at the top
    await clickCard(h, 'plus');
    await tabCount(h, 13);
  });
});

describe('D5 new-window links', () => {
  // These share one app and run in order: each counts the tabs the ones
  // before opened (one, two, three), and the last needs the first page in
  // front, as the third leaves it.
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('new-window.html'));
    await waitForPage(h, 'new-window');
  });
  afterAll(async () => h?.close());

  it('blocks a pop-up nobody clicked for', async () => {
    const blocked = await waitFor(
      'the unrequested pop-up to be blocked',
      () => mainLog(h, 'blockedPopups'),
      (b) => b.some((u) => u.includes('from=auto')),
    );
    expect(blocked.some((u) => u.includes('from=auto'))).toBe(true);
    expect(await tabs(h)).toHaveLength(1);
  });

  it('opens target=_blank links in a new tab in front', async () => {
    const p = await screenPointOf(h, '#blank', 'new-window');
    // Clicked again if a click is lost (GitHub's Linux machines, issue #30).
    await clickUntil(h, p, 'the new tab in front', async () => (await focusedTab(h)).url.includes('from=blank'));
    await focusedWhere(h, 'the new tab in front', (t) => t.url.includes('from=blank'));
    expect(await tabs(h)).toHaveLength(2);
  });

  it('opens Ctrl-clicked links behind, next to their page', async () => {
    const [opener] = await tabs(h);
    await clickCard(h, opener!.id);
    await focusedWhere(h, 'opener focused', (t) => t.id === opener!.id);
    await waitForPage(h, 'new-window');
    const p = await screenPointOf(h, '#plain', 'new-window');
    await h.shell.keyboard.down('Control');
    try {
      await clickUntil(h, p, 'a tab behind', async () => (await tabs(h)).length === 3);
    } finally {
      await h.shell.keyboard.up('Control');
    }
    await tabCount(h, 3);
    const all = await tabs(h);
    expect(all[1]!.url).toContain('from=plain'); // right after its opener
    expect((await focusedTab(h)).id).toBe(opener!.id); // focus stays
  });

  it('opens window.open from a click in front', async () => {
    const p = await screenPointOf(h, '#open', 'new-window');
    await clickUntil(h, p, 'the clicked pop-up in front', async () => (await focusedTab(h)).url.includes('from=click'));
    await focusedWhere(h, 'the clicked pop-up in front', (t) => t.url.includes('from=click'));
  });
});

describe('D6 loading', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch('', { searchUrl: searchUrl() });
  });
  afterAll(async () => h?.close());

  it('shows the loading strip and the shimmer while a page loads', async () => {
    await navigateTo(h, server.url('slow?ms=2500'));
    await waitFor(
      'loading strip',
      () => h.shell.locator(bar('progress')).getAttribute('data-state'),
      (s) => s === 'loading',
      2000,
    );
    expect(await h.shell.locator(`${FOCUSED} .hs-shimmer`).isVisible()).toBe(true);
    await waitForPage(h, '/slow');
    await waitFor('strip to finish', () => h.shell.locator(bar('progress')).getAttribute('data-state'), (s) => s === 'idle');
    expect(await h.shell.locator(`${FOCUSED} .hs-shimmer`).isVisible()).toBe(false);
  });
});

describe('D7 error cards', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch('', { searchUrl: searchUrl() });
  });
  afterAll(async () => h?.close());

  async function card(): Promise<string> {
    return (await h.shell.locator(OVERLAY).textContent()) ?? '';
  }

  it('address not found', async () => {
    await navigateTo(h, 'http://notfound.test/');
    await waitFor('not-found card', card, (t) => t.includes("We couldn't find that site"));
    expect(await card()).toContain('http://notfound.test/');
    expect(await h.shell.locator(`${OVERLAY} #panel-reload`).isVisible()).toBe(true);
  });

  it('connection failed, and Retry recovers once the site is back', async () => {
    const temp = await startFixtureServer();
    const port = Number(new URL(temp.base).port);
    const target = temp.url('link-b.html');
    await temp.close();
    await navigateTo(h, target);
    await waitFor('connection card', card, (t) => t.includes("Couldn't connect"));
    expect(await card()).toContain(target);
    const back = await startFixtureServer(port);
    try {
      await h.shell.locator(`${OVERLAY} #panel-reload`).click();
      await focusedWhere(h, 'page B after retry', (t) => t.state === 'loaded' && t.url === target);
      expect(await h.shell.locator(OVERLAY).isVisible()).toBe(false);
    } finally {
      await back.close();
    }
  });

  it('certificate error, with no way to proceed', async () => {
    const tls = await startHttpsFixtureServer();
    try {
      await navigateTo(h, tls.url('link-a.html'));
      await waitFor('certificate card', card, (t) => t.includes("This site's certificate isn't valid"));
      expect(await card()).toContain(tls.url('link-a.html'));
      expect(await h.shell.locator(`${OVERLAY} #panel-reload`).count()).toBe(0);
      expect(await h.shell.locator(`${OVERLAY} #panel-back`).isVisible()).toBe(true);
      expect((await focusedTab(h)).state).toBe('failed');
    } finally {
      await tls.close();
    }
  });
});

describe('D8 right-click menu', () => {
  // These share one app and run in order: the third counts the tabs (two,
  // with the one it opens), and the last leaves the first page for the
  // form.
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'));
    await waitForPage(h, 'link-a');
  });
  afterAll(async () => h?.close());

  async function rightClick(selector: string, page = 'link-a'): Promise<string[]> {
    const menus = () => h.app.evaluate(() => globalThis.__hypersolTest!.menus.map((m) => m.labels));
    const count = (await menus()).length;
    // Aimed once the room is still: a tab opened behind brings the rail, and the page moves.
    await settled(h);
    const p = await screenPointOf(h, selector, page);
    const opened = async () => (await menus()).length > count;
    // A right-click lost on its way to the page brings no menu at all (issue #30); if every one is,
    // the failure says what the shell has at the point (Linux, pull request #52).
    await clickUntil(h, p, 'a right-click menu', opened, { button: 'right' }, () => describeMissedClick(h, p, opened));
    const all = await menus();
    return all[all.length - 1]!;
  }

  function choose(label: string): Promise<void> {
    return h.app.evaluate((_electron, label) => {
      const log = globalThis.__hypersolTest!;
      log.menus[log.menus.length - 1]!.run(label);
    }, label);
  }

  it('offers back, forward, and reload on the page', async () => {
    expect(await rightClick('h1')).toEqual(['Back', 'Forward', 'Reload']);
  });

  it('copies a link address', async () => {
    expect(await rightClick('#go')).toEqual(['Open link in new tab', 'Copy link address']);
    await choose('Copy link address');
    expect(await h.app.evaluate(({ clipboard }) => clipboard.readText())).toBe(server.url('link-b.html'));
  });

  it('opens a link in a new tab behind', async () => {
    await rightClick('#go');
    await choose('Open link in new tab');
    await tabCount(h, 2);
    expect((await tabs(h))[1]!.url).toContain('link-b.html');
    expect((await focusedTab(h)).url).toContain('link-a.html');
  });

  it('copies selected text', async () => {
    await inPage(h, 'getSelection().selectAllChildren(document.querySelector("p"))', 'link-a');
    expect(await rightClick('p')).toEqual(['Copy']);
    await choose('Copy');
    await waitFor(
      'copied text',
      () => h.app.evaluate(({ clipboard }) => clipboard.readText()),
      (t) => t.startsWith('Readable body text'),
    );
  });

  it('pastes into a text field', async () => {
    await navigateTo(h, server.url('form.html'));
    await waitForPage(h, 'form');
    await h.app.evaluate(({ clipboard }) => clipboard.writeText('pasted text'));
    const p = await screenPointOf(h, '#name', 'form');
    await clickAt(h, p);
    const labels = await rightClick('#name', 'form');
    expect(labels).toEqual(['Cut', 'Copy', 'Paste', 'Select all']);
    await choose('Paste');
    await waitFor('pasted', () => inPage(h, 'document.getElementById("name").value', 'form'), (v) => v === 'pasted text');
  });
});

describe('D9 start panel', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch('', { searchUrl: searchUrl() });
  });
  afterAll(async () => h?.close());

  it('shows the empty state', async () => {
    const panel = h.shell.locator(`${FOCUSED} [data-testid="start-panel"]`);
    expect(await panel.isVisible()).toBe(true);
    const text = (await panel.textContent()) ?? '';
    expect(text.match(/Nothing saved yet/g)).toHaveLength(2);
    expect(text).toContain('Pages you bookmark will show up here.');
    expect(text).toContain('Pages you visit will show up here.');
  });

  it('its search box searches', async () => {
    await h.shell.fill(`${FOCUSED} [data-testid="start-search"]`, 'hyperSol');
    await h.shell.press(`${FOCUSED} [data-testid="start-search"]`, 'Enter');
    await waitForPage(h, '/search');
    expect(await inPage(h, 'document.getElementById("query").textContent', '/search')).toBe('hyperSol');
  });
});

describe('D10 shortcuts from inside a page', () => {
  // These share one app and run in order: back and forward need the two
  // pages the hook loaded, and "Ctrl+W" closes the tab "Ctrl+T" left
  // beside the start tab.
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'));
    await waitForPage(h, 'link-a');
    await navigateTo(h, server.url('link-b.html'));
    await waitForPage(h, 'link-b');
  });
  afterAll(async () => h?.close());

  it('Alt+Left and Alt+Right go back and forward', async () => {
    await pressInPage(h, 'Left', ['alt']);
    await focusedWhere(h, 'back', (t) => t.url.endsWith('link-a.html') && t.state === 'loaded');
    await waitForPage(h, 'link-a');
    await pressInPage(h, 'Right', ['alt']);
    await focusedWhere(h, 'forward', (t) => t.url.endsWith('link-b.html') && t.state === 'loaded');
    await waitForPage(h, 'link-b');
  });

  it('Ctrl+R and F5 reload', async () => {
    for (const [key, mods] of [['R', ['control']], ['F5', []]] as const) {
      const page = await focusedPage(h);
      await inPage(h, 'window.__marker = 1', page);
      await pressInPage(h, key, [...mods], page);
      await waitFor(`${key} reload`, () => inPage(h, 'window.__marker ?? null', page), (m) => m === null);
      await waitForPage(h, page);
    }
  });

  it('Ctrl+L moves to the address field', async () => {
    await pressInPage(h, 'L', ['control']);
    await waitFor('address focus', () => addressHasFocus(h), (f) => f);
  });

  it('Ctrl+T opens a tab and Ctrl+Tab cycles', async () => {
    const page = { id: (await focusedPage(h)).id };
    await pressInPage(h, 'T', ['control'], page);
    await tabCount(h, 2);
    expect((await focusedTab(h)).state).toBe('start');
    await pressInShell(h, 'Tab', ['control']);
    await focusedWhere(h, 'back on the page', (t) => t.url.endsWith('link-b.html'));
    await settled(h);
    await pressInPage(h, 'Tab', ['control'], page);
    await focusedWhere(h, 'on the start tab', (t) => t.state === 'start');
  });

  it('Ctrl+W from a page closes its tab', async () => {
    await pressInShell(h, 'Tab', ['control']);
    const pageTab = await focusedWhere(h, 'page tab', (t) => t.url.endsWith('link-b.html'));
    await settled(h);
    await pressInPage(h, 'W', ['control']);
    await waitFor('page tab closed', () => tabs(h), (t) => !t.some((x) => x.id === pageTab.id));
  });
});

describe('D11 about', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'));
    await waitForPage(h, 'link-a');
  });
  afterAll(async () => h?.close());

  it('shows versions and closes with Escape', async () => {
    await h.shell.click(bar('menu'));
    await h.shell.click(bar('menu-about'));
    const about = h.shell.locator('hs-about [data-testid="about"]');
    await waitFor('about panel', () => about.isVisible(), (v) => v);
    const electron = await h.app.evaluate(() => process.versions.electron);
    expect(await h.shell.locator('hs-about [data-testid="about-engine"]').textContent()).toContain(`Electron ${electron}`);
    // The version the app is built as (0.9.0 from milestone 12 on), read from its package file.
    const { version } = JSON.parse(readFileSync(join(APP_DIR, 'package.json'), 'utf8')) as { version: string };
    expect(await h.shell.locator('hs-about [data-testid="about-version"]').textContent()).toContain(`Version ${version}`);
    expect(version).toBe('0.9.0');
    // An experimental developer preview until 1.0 (owner, prompt 131).
    expect(await h.shell.locator('hs-about [data-testid="about-status"]').textContent()).toContain('experimental developer preview');
    await h.shell.keyboard.press('Escape');
    await waitFor('about closed', () => about.isVisible(), (v) => !v);
  });

  it('the menu opens and closes tabs', async () => {
    await h.shell.click(bar('menu'));
    await h.shell.click(bar('menu-new-tab'));
    await tabCount(h, 2);
    await h.shell.click(bar('menu'));
    await h.shell.click(bar('menu-close-tab'));
    await tabCount(h, 1);
  });
});

describe('D13 favicon limits (GitHub issue #1)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'));
    await waitForPage(h, 'link-a');
  });
  afterAll(async () => h?.close());

  const hitsFor = (prefix: string) =>
    [...server.hits.entries()].filter(([k]) => k.startsWith(prefix)).reduce((n, [, v]) => n + v, 0);
  const abortedFor = (key: string) => server.aborted.get(key) ?? 0;

  async function openWithIcon(icon: string): Promise<void> {
    await navigateTo(h, server.url(`favicon.html?icon=${encodeURIComponent(icon)}`));
    await waitForPage(h, 'favicon.html');
  }

  async function expectNoFavicon(): Promise<void> {
    await sleep(1500);
    expect((await focusedTab(h)).hasFavicon).toBe(false);
    expect(await h.shell.evaluate(() => 1 + 1)).toBe(2); // the app still answers
  }

  it('refuses a favicon over the size limit, declared or streamed', async () => {
    await openWithIcon('/favicon/huge-bytes.png');
    await expectNoFavicon();
    expect(hitsFor('/favicon/huge-bytes.png')).toBeGreaterThan(0);
    await openWithIcon('/favicon/huge-stream.png');
    await expectNoFavicon();
    expect(hitsFor('/favicon/huge-stream.png')).toBeGreaterThan(0);
  });

  it('refuses huge dimensions without decoding', async () => {
    await openWithIcon('/favicon/huge-dims.png');
    await expectNoFavicon();
    expect(hitsFor('/favicon/huge-dims.png')).toBeGreaterThan(0);
  });

  it('refuses an oversized inline (data:) favicon', async () => {
    await openWithIcon('');
    await inPage(
      h,
      `document.querySelector('link[rel=icon]').href = 'data:image/png;base64,' + 'A'.repeat(400000)`,
      'favicon.html',
    );
    await expectNoFavicon();
  });

  it('gives up on a slow favicon after the timeout', async () => {
    const key = '/favicon/slow.png?ms=20000';
    await openWithIcon(key);
    await waitFor('the slow request to be cancelled', async () => abortedFor(key), (n) => n > 0, 9000);
    expect((await focusedTab(h)).hasFavicon).toBe(false);
  });

  it('cancels a favicon fetch when the page navigates away', async () => {
    const key = '/favicon/slow.png?ms=20001';
    await openWithIcon(key);
    await waitFor('the fetch to start', async () => server.hits.get(key) ?? 0, (n) => n > 0, 3000);
    await navigateTo(h, server.url('link-b.html'));
    await waitFor('cancelled on navigation', async () => abortedFor(key), (n) => n > 0, 3000);
    // The app's own account of it: the fetch was cancelled by the page moving on, not ended by the 5 s timeout.
    const ends = await waitFor('the app to say how the fetch ended', () => mainLog(h, 'faviconEnds'), (e) => e.some((x) => x.url.endsWith(key)));
    expect(ends.filter((e) => e.url.endsWith(key)).map((e) => e.why)).toEqual(['cancelled']);
  });

  it('fetches only the last favicon of a page that keeps changing it', async () => {
    await navigateTo(h, server.url('favicon.html?churn=30'));
    await waitForPage(h, 'favicon.html');
    await waitFor('the final favicon', () => focusedTab(h), (t) => t.hasFavicon, 5000);
    expect(hitsFor('/icon.png?v=')).toBeLessThanOrEqual(3);
  });
});

describe('D13 favicon downloads are cancelled when refused (PR #7 review)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'));
    await waitForPage(h, 'link-a');
  });
  afterAll(async () => h?.close());

  it('drops each refused 10 MB download at once, one at a time', async () => {
    const PATH = '/favicon/declared-huge.png';
    // The app cancels each refused download before it asks for the next.
    // On GitHub's slow Linux machines the server can still take in the
    // next request a moment before it sees the last one close, and count
    // two open for that instant (once, run 36432173070): then the page is
    // loaded again, with new downloads, up to three times, and each rerun
    // is logged (as issue #30's retries). A download left running would
    // overlap the next on every run.
    for (let attempt = 1; ; attempt++) {
      const keys = [1, 2, 3].map((n) => `${PATH}?n=${attempt * 10 + n}`);
      server.maxOpen.delete(PATH);
      await navigateTo(h, server.url(`favicon.html?icons=${encodeURIComponent(keys.join(','))}`));
      await waitForPage(h, 'favicon.html');
      // The server sees every connection closed well before the 5 s timeout.
      await waitFor(
        'all three downloads dropped',
        async () => keys.map((k) => server.aborted.get(k) ?? 0),
        (n) => n.every((x) => x > 0),
        3000,
      );
      expect(server.openNow.get(PATH) ?? 0).toBe(0);
      for (const k of keys) expect(server.sent.get(k) ?? 0).toBeLessThan(256 * 1024);
      expect((await focusedTab(h)).hasFavicon).toBe(false);
      const most = server.maxOpen.get(PATH);
      if (most === 1 || attempt >= 3) {
        expect(most, 'refused downloads open at once').toBe(1);
        break;
      }
      console.warn(`[D13] the server counted ${most} refused downloads open at once; loading the page again (attempt ${attempt + 1})`);
    }
  });

  it('drops a download answered with an error status', async () => {
    const key = '/favicon/error-body.png';
    await navigateTo(h, server.url(`favicon.html?icon=${encodeURIComponent(key)}`));
    await waitForPage(h, 'favicon.html');
    await waitFor('error download dropped', async () => server.aborted.get(key) ?? 0, (n) => n > 0, 3000);
    expect(server.openNow.get(key) ?? 0).toBe(0);
    expect(server.sent.get(key) ?? 0).toBeLessThan(256 * 1024);
  });
});
