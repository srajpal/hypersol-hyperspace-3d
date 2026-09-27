/**
 * Milestone 11 end-to-end checks M1 to M8 (TODO.md): two ways to show
 * tabs, address bar completion, the wider page, the view settings, menus
 * that close, the reorganized Settings, shortcut remapping, and the
 * Library's search reset.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import {
  ADDRESS,
  clickAt,
  clickCard,
  focusedTab,
  launch,
  navigateTo,
  pressInPage,
  pressInShell,
  project,
  removeFolder,
  settingsTo,
  settled,
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
const SET = (id: string) => `hs-settings [data-testid="${id}"]`;
const LIB = (id: string) => `hs-library [data-testid="${id}"]`;
const saved = (profile: string) => JSON.parse(readFileSync(join(profile, 'settings.json'), 'utf8')) as Record<string, unknown>;
const address = (h: Harness) =>
  h.shell.evaluate(() => {
    const input = document.querySelector('hs-toolbar')!.shadowRoot!.querySelector('input[data-testid="address"]') as HTMLInputElement;
    return { value: input.value, start: input.selectionStart, end: input.selectionEnd };
  });
const pageCentre = async (h: Harness) => {
  const l = await shellCall(h, 'layout');
  return project(h, l.panelWidth / 2, l.panelHeight / 2);
};

describe('M1 and M8: tabs and the Library search', () => {
  it('M1 tabs show as cards or as a list only', async () => {
    const profile = newProfile({ tabDisplay: 'autohide' });
    const h = await launch(server.url('link-a.html'), { userDataDir: profile });
    try {
      await waitForPage(h, 'link-a');
      expect((await shellCall(h, 'tabDisplay')).display).toBe('cards');
      await pressInShell(h, ',', ['control']);
      await settingsTo(h, 'set-tab-display');
      const options = await h.shell.locator(`${SET('set-tab-display')} option`).evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value));
      expect(options).toEqual(['cards', 'list']);
    } finally {
      await h.close();
    }
  });

  it('M8 switching Library tabs empties the search box', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      await pressInShell(h, 'O', ['control', 'shift']);
      await h.shell.click(LIB('lib-tab-history'));
      await h.shell.fill(LIB('lib-search'), 'link');
      await h.shell.click(LIB('lib-tab-bookmarks'));
      expect(await h.shell.locator(LIB('lib-search')).inputValue()).toBe('');
      await h.shell.fill(LIB('lib-search'), 'zzz');
      await h.shell.click(LIB('lib-tab-passwords'));
      expect(await h.shell.locator(LIB('lib-search')).inputValue()).toBe('');
      await h.shell.click(LIB('lib-tab-history'));
      await waitFor('the full history', () => h.shell.locator(LIB('lib-item')).count(), (n) => n >= 1);
    } finally {
      await h.close();
    }
  });
});

describe('M2: address bar completion', () => {
  it('completes visited sites as you type, lists matches, and follows the keys', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile(), searchUrl: `${server.base}search?q=%s` });
    const port = new URL(server.base).port;
    const site = `shop.test:${port}`;
    try {
      await waitForPage(h, 'link-a');
      // Visits on a named site (it points at this machine in test runs).
      for (const page of ['link-a.html', 'link-b.html', 'link-a.html?again']) {
        await navigateTo(h, `http://${site}/${page}`);
        await waitForPage(h, page);
      }
      const input = h.shell.locator(ADDRESS);
      await input.click();
      await input.pressSequentially('sho');
      // The rest of the site, filled in and selected.
      const done = await waitFor('completed', () => address(h), (a) => a.value === `sho${`p.test:${port}/`}`);
      expect([done.start, done.end]).toEqual([3, done.value.length]);
      await waitFor('suggestions', () => h.shell.locator(BAR('suggestion')).count(), (n) => n >= 2);
      expect(await h.shell.locator(BAR('suggestion-search')).textContent()).toContain('for “sho”');
      // Typing on replaces the completion; a path completes to a page.
      await input.pressSequentially(`p.test:${port}/link-b`);
      await waitFor('page completed', () => address(h), (a) => a.value === `shop.test:${port}/link-b.html`);
      await input.press('Enter');
      await waitFor('went to the completed page', () => focusedTab(h), (t) => t.url === `http://${site}/link-b.html`);

      // Backspace removes the completion and does not complete again.
      await input.click();
      await input.fill('');
      await input.pressSequentially('sho');
      await waitFor('completed', () => address(h), (a) => a.value.length > 3);
      await input.press('Backspace');
      await sleep(300);
      expect((await address(h)).value).toBe('sho');

      // Escape drops the list and keeps the typing; arrows pick a row.
      await input.pressSequentially('p');
      await waitFor('suggestions', () => h.shell.locator(BAR('suggestion')).count(), (n) => n >= 2);
      await input.press('Escape');
      expect(await h.shell.locator(BAR('address-suggestions')).count()).toBe(0);
      expect((await address(h)).value).toBe('shop');
      await input.pressSequentially('.');
      await waitFor('suggestions', () => h.shell.locator(BAR('suggestion')).count(), (n) => n >= 2);
      await input.press('ArrowDown');
      await input.press('ArrowDown');
      const picked = (await address(h)).value;
      expect(picked.startsWith('http://shop.test')).toBe(true);
      await input.press('Enter');
      await waitFor('went to the picked row', () => focusedTab(h), (t) => t.url === picked);

      // Removing a match forgets it.
      await input.click();
      await input.fill('');
      await input.pressSequentially('link-b');
      await waitFor('link-b listed', () => h.shell.locator(BAR('suggestion')).allTextContents(), (t) => t.some((x) => x.includes('link-b')));
      const row = h.shell.locator(BAR('suggestion')).filter({ hasText: 'link-b' }).first();
      await row.locator('[data-testid="suggestion-remove"]').click();
      await waitFor('forgotten', () => h.shell.locator(BAR('suggestion')).allTextContents(), (t) => !t.some((x) => x.includes('link-b.html')));

      // The search row searches, even for text that looks like an address.
      await input.fill('');
      await input.pressSequentially('shop.test');
      await h.shell.click(BAR('suggestion-search'));
      await waitFor('searched', () => focusedTab(h), (t) => t.url.includes('/search?q=shop.test'));
    } finally {
      await h.close();
    }
  });
});

describe('M3 and M4: the page and the view', () => {
  it('M3 the tilted page reaches both sides of the free area', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile(), tilt: 10 });
    try {
      await waitForPage(h, 'link-a');
      const l = await shellCall(h, 'layout');
      const quad = await shellCall(h, 'panelQuad');
      const left = Math.min(quad[0]!.x, quad[3]!.x);
      const right = Math.max(quad[1]!.x, quad[2]!.x);
      // One tab: no rail, the normal margin (36 px) on both sides.
      expect(left - 36).toBeLessThan(3);
      expect(l.viewportWidth - 36 - right).toBeLessThan(3);
      expect(left).toBeGreaterThanOrEqual(35);
    } finally {
      await h.close();
    }
  });

  it('M4 direction, movement, and space change the view; "Flat and still" and "Default view"; saved', async () => {
    const profile = newProfile();
    const h = await launch(server.url('link-a.html'), { userDataDir: profile });
    try {
      await waitForPage(h, 'link-a');
      const edges = async () => {
        const q = await shellCall(h, 'panelQuad');
        return { left: q[3]!.y - q[0]!.y, right: q[2]!.y - q[1]!.y };
      };
      let e = await edges();
      expect(e.left).toBeGreaterThan(e.right); // right edge back
      const normalWidth = (await shellCall(h, 'layout')).panelWidth;
      await pressInShell(h, ',', ['control']);
      await settingsTo(h, 'set-tilt-direction');
      await h.shell.selectOption(SET('set-tilt-direction'), 'left');
      await waitFor('left edge back', edges, (x) => x.left < x.right);
      await h.shell.selectOption(SET('set-parallax'), 'subtle');
      await waitFor('subtle movement', () => shellCall(h, 'view'), (v) => v.parallax === 12);
      await h.shell.selectOption(SET('set-page-margin'), 'roomy');
      await waitFor('roomy', () => shellCall(h, 'view'), (v) => v.margin === 72);
      expect((await shellCall(h, 'layout')).panelWidth).toBeLessThan(normalWidth);
      await h.shell.click(SET('set-flat'));
      await waitFor('flat and still', () => shellCall(h, 'view'), (v) => v.parallax === 0);
      expect(await shellCall(h, 'tilt')).toBe(0);
      e = await edges();
      expect(Math.abs(e.left - e.right)).toBeLessThan(1);
      const s = saved(profile);
      expect([s['pageTilt'], s['parallax'], s['tiltDirection'], s['pageMargin']]).toEqual([0, 'off', 'left', 'roomy']);
      // "Default view" (owner, prompt 53) puts all four back.
      await h.shell.click(SET('set-view-default'));
      await waitFor('default view', async () => {
        const d = saved(profile);
        return [d['pageTilt'], d['parallax'], d['tiltDirection'], d['pageMargin']];
      }, (v) => JSON.stringify(v) === JSON.stringify([10, 'normal', 'right', 'normal']));
      expect(await shellCall(h, 'tilt')).toBe(10);
      expect(await shellCall(h, 'view')).toMatchObject({ direction: 1, margin: 36, parallax: 24 });
      expect((await shellCall(h, 'layout')).panelWidth).toBe(normalWidth);
    } finally {
      await h.close();
    }
  });
});

describe('M5: menus close when you click elsewhere', () => {
  it('the dots menu, the "+" menu, the site panel, and tab search close on a click in the page or on a card', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      await pressInShell(h, 'T', ['control']);
      await settled(h);
      await navigateTo(h, server.url('link-b.html'));
      await waitForPage(h, 'link-b');
      const closedBy = async (open: () => Promise<void>, isOpen: () => Promise<boolean>, click: () => Promise<void>) => {
        await open();
        await waitFor('open', isOpen, (o) => o);
        await click();
        await waitFor('closed', isOpen, (o) => !o);
      };
      const inPageClick = async () => clickAt(h, await pageCentre(h));
      const menuOpen = () => h.shell.locator(BAR('menu-new-tab')).isVisible();
      await closedBy(() => h.shell.click(BAR('menu')), menuOpen, inPageClick);
      await closedBy(() => h.shell.click(BAR('new-tab-more')), () => h.shell.locator(BAR('new-tab-menu')).isVisible(), inPageClick);
      await closedBy(() => h.shell.click(BAR('site-button')), async () => (await shellCall(h, 'sitePanel')).open, inPageClick);
      const first = (await tabs(h))[0]!.id;
      await closedBy(
        () => pressInShell(h, 'A', ['control', 'shift']),
        () => h.shell.locator('hs-tab-search [data-testid="tab-search"]').isVisible(),
        () => clickCard(h, first),
      );
      await closedBy(() => h.shell.click(BAR('menu')), menuOpen, () => clickCard(h, first));
    } finally {
      await h.close();
    }
  });
});

describe('M6 and M7: Settings and shortcuts', () => {
  it('M6 Settings has sections and a search across them', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      await pressInShell(h, ',', ['control']);
      await waitFor('open', () => shellCall(h, 'openPanel'), (p) => p === 'settings');
      expect(await h.shell.locator('hs-settings [role="tab"]').count()).toBe(8);
      await h.shell.click(SET('set-nav-privacy'));
      expect(await h.shell.locator(SET('set-group-dns')).isVisible()).toBe(true);
      expect(await h.shell.locator(SET('set-group-theme')).count()).toBe(0);
      await h.shell.fill(SET('set-search'), 'camera');
      await waitFor('found in another section', () => h.shell.locator(SET('set-group-permissions')).isVisible(), (v) => v);
      await h.shell.fill(SET('set-search'), 'lean');
      await waitFor('found the view', () => h.shell.locator(SET('set-group-view')).isVisible(), (v) => v);
      // Its controls work in the results.
      await h.shell.selectOption(SET('set-parallax'), 'off');
      await waitFor('saved', () => h.shell.locator(SET('set-message')).textContent(), (t) => t === 'Saved.');
      await h.shell.fill(SET('set-search'), 'qwertyuiop');
      expect(await h.shell.locator(SET('set-search-empty')).isVisible()).toBe(true);
      // Escape clears the search first, then closes.
      await h.shell.press(SET('set-search'), 'Escape');
      expect(await h.shell.locator(SET('set-search')).inputValue()).toBe('');
      await h.shell.press(SET('set-search'), 'Escape');
      await waitFor('closed', () => shellCall(h, 'openPanel'), (p) => p === null);
    } finally {
      await h.close();
    }
  });

  it('M7 shortcuts are listed and can be remapped, refused on a clash or a reserved key, reset, and kept after a restart', async () => {
    const profile = newProfile();
    let h = await launch(server.url('link-a.html'), { userDataDir: profile, keepRunning: true });
    try {
      await waitForPage(h, 'link-a');
      await h.shell.click(BAR('menu'));
      await h.shell.click(BAR('menu-shortcuts'));
      await waitFor('shortcuts shown', () => h.shell.locator(SET('set-keys-list')).isVisible(), (v) => v);
      expect(await h.shell.locator(SET('set-key-row')).count()).toBe(22);
      // Remap "Reopen closed tab" to Ctrl+Alt+R.
      await h.shell.click(SET('set-key-change-reopen-tab'));
      await waitFor('waiting for keys', () => h.shell.locator(SET('set-key-waiting')).isVisible(), (v) => v);
      await pressInShell(h, 'R', ['control', 'alt']);
      await waitFor('saved', async () => (saved(profile)['shortcuts'] as Record<string, string>)?.['reopen-tab'], (k) => k === 'Mod+Alt+R');
      // A clash and a reserved key are refused, with the reason.
      await h.shell.click(SET('set-key-change-find'));
      await pressInShell(h, 'T', ['control']);
      await waitFor('clash refused', () => h.shell.locator(SET('set-keys-message')).textContent(), (t) => /already used by New tab/.test(t ?? ''));
      await h.shell.click(SET('set-key-change-find'));
      await pressInShell(h, 'V', ['control']);
      await waitFor('reserved refused', () => h.shell.locator(SET('set-keys-message')).textContent(), (t) => /kept for editing/.test(t ?? ''));
      expect((saved(profile)['shortcuts'] as Record<string, string>)['find']).toBeUndefined();
      await h.shell.press(SET('set-search'), 'Escape');
      await waitFor('closed', () => shellCall(h, 'openPanel'), (p) => p === null);
      // The menu shows the new keys.
      await h.shell.click(BAR('menu'));
      expect(await h.shell.locator(BAR('menu-reopen-tab')).textContent()).toContain('Ctrl+Alt+R');
      await pressInShell(h, 'Escape');

      // The new keys work from the page after a restart; the old ones do nothing.
      await h.app.evaluate(({ app }) => app.quit());
      await waitForExit(h, 8000);
      await h.close();
      h = await launch(server.url('link-a.html'), { userDataDir: profile, keepRunning: true });
      await waitForPage(h, 'link-a');
      await pressInShell(h, 'T', ['control']);
      await settled(h);
      await navigateTo(h, server.url('link-b.html'));
      await waitForPage(h, 'link-b');
      await pressInShell(h, 'W', ['control']);
      await waitFor('closed', () => tabs(h), (t) => t.length === 1);
      await pressInPage(h, 'T', ['control', 'shift']);
      await sleep(400);
      expect((await tabs(h)).length).toBe(1);
      await pressInPage(h, 'R', ['control', 'alt']);
      await waitFor('reopened with the new keys', () => tabs(h), (t) => t.length === 2 && t.some((x) => x.url.includes('link-b')));

      // Reset returns the default.
      await pressInShell(h, ',', ['control']);
      await settingsTo(h, 'set-key-reset-reopen-tab');
      await h.shell.click(SET('set-key-reset-reopen-tab'));
      await waitFor('back to the default', async () => saved(profile)['shortcuts'], (v) => JSON.stringify(v) === '{}');
    } finally {
      await h.close();
    }
  });
});
