/**
 * Milestone 26 end-to-end checks PD1 to PD9 (TODO.md): privacy and data
 * tools. HTTPS-only browsing (GitHub issue #24), per-site storage (#26),
 * and bookmark import and export (#27).
 *
 * HTTPS is checked with local fixtures only (fixture-server.ts,
 * startDualFixtureServer): three test sites mapped to 127.0.0.1, HTTP and
 * HTTPS on one port, and a certificate made for the run that only this
 * run trusts, by its fingerprint (--test-trusted-cert). Nothing leaves
 * the computer.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HTTPS_ONLY_HOSTS, startDualFixtureServer, startFixtureServer, type DualFixtureServer, type FixtureServer } from './fixture-server';
import {
  caughtUp,
  cycleToTab,
  focusedPage,
  focusedTab,
  inPage,
  launch,
  navigateTo,
  newProfile,
  pressInShell,
  removeFolder,
  settingsTo,
  shellCall,
  tabs,
  waitFor,
  waitForPage,
  type Harness,
} from './harness';

let dual: DualFixtureServer;
let server: FixtureServer;
const folders: string[] = [];

beforeAll(async () => {
  [dual, server] = await Promise.all([startDualFixtureServer(), startFixtureServer()]);
});

afterAll(async () => {
  await Promise.all([dual?.close(), server?.close()]);
  for (const dir of folders.splice(0)) await removeFolder(dir);
});

const { secure, plain, loop } = HTTPS_ONLY_HOSTS;
const CARD = '[data-testid="page-panel"][aria-hidden="false"] .hs-error-card';
const SET = (id: string) => `hs-settings [data-testid="${id}"]`;
const LIB = (id: string) => `hs-library [data-testid="${id}"]`;
const SITE = (id: string) => `hs-site-panel [data-testid="${id}"]`;
const BAR = (id: string) => `hs-toolbar [data-testid="${id}"]`;
const cardKind = (h: Harness) => h.shell.locator(CARD).getAttribute('data-kind').catch(() => null);
const httpTo = (host: string) => dual.httpRequests.filter((r) => r.startsWith(`${host}/`));
const openLibrary = async (h: Harness, tab: 'bookmarks' | 'sites') => {
  if ((await shellCall(h, 'openPanel')) !== 'library') await pressInShell(h, 'O', ['control', 'shift']);
  await waitFor('Library open', () => shellCall(h, 'openPanel'), (p) => p === 'library');
  await h.shell.click(LIB(`lib-tab-${tab}`));
};
/** Opens Settings (Ctrl+,) on a control. */
const openSettingsAt = async (h: Harness, control: string) => {
  if ((await shellCall(h, 'openPanel')) !== 'settings') await pressInShell(h, ',', ['control']);
  await waitFor('Settings open', () => shellCall(h, 'openPanel'), (p) => p === 'settings');
  await settingsTo(h, control);
};
const launchHttps = (profile = newProfile()) => launch(server.url('link-a.html'), { userDataDir: profile, trustedCertificate: dual.fingerprint });

describe('PD1 to PD5: HTTPS-only browsing (issue #24)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launchHttps();
    await waitForPage(h, 'link-a');
  });
  afterAll(async () => h?.close());

  it('PD1 a typed http:// address, a link, and a redirect to http load over HTTPS, the path and query kept; local addresses are left alone', async () => {
    // Typed.
    await navigateTo(h, dual.url('http', secure, '/link-a.html?x=1&y=2'));
    await waitFor('loaded over HTTPS', () => focusedTab(h), (t) => t.state === 'loaded' && t.url.startsWith('https:'));
    expect((await focusedTab(h)).url).toBe(dual.url('https', secure, '/link-a.html?x=1&y=2'));
    // Followed from the page.
    await inPage(h, `location.href = ${JSON.stringify(dual.url('http', secure, '/link-b.html?from=link'))}; true`, secure);
    await waitFor('the link over HTTPS', () => focusedTab(h), (t) => t.state === 'loaded' && t.url.includes('from=link'));
    expect((await focusedTab(h)).url).toBe(dual.url('https', secure, '/link-b.html?from=link'));
    // A redirect from the HTTPS site to an http:// page of it.
    await navigateTo(h, dual.url('https', secure, '/to-http'));
    await waitFor('the redirect over HTTPS', () => focusedTab(h), (t) => t.state === 'loaded' && t.url.endsWith('/link-b.html'));
    expect((await focusedTab(h)).url).toBe(dual.url('https', secure, '/link-b.html'));
    expect(httpTo(secure)).toEqual([]);
    // 127.0.0.1 cannot have a certificate: left as it is (every other check's pages are such addresses).
    await navigateTo(h, server.url('link-b.html'));
    await waitForPage(h, server.url('link-b.html'));
    expect((await focusedTab(h)).url).toBe(server.url('link-b.html'));
  });

  it('PD2 a site without HTTPS gets the card, and nothing goes over HTTP before Continue; Go back returns; a redirect back to HTTP gets the card, not a loop', async () => {
    await navigateTo(h, server.url('link-a.html'));
    await waitForPage(h, server.url('link-a.html'));
    await navigateTo(h, dual.url('http', plain, '/link-b.html'));
    await waitFor('the HTTPS-only card', () => cardKind(h), (k) => k === 'https-only');
    expect(await h.shell.locator(`${CARD} .hs-error-address`).textContent()).toBe(dual.url('http', plain, '/link-b.html'));
    expect(httpTo(plain)).toEqual([]);
    // Go back: the page before.
    await h.shell.click(`${CARD} #panel-back`);
    await waitFor('back on link-a', () => focusedTab(h), (t) => t.state === 'loaded' && t.url === server.url('link-a.html'));
    expect(httpTo(plain)).toEqual([]);

    // A site whose HTTPS page sends it back to the same http:// address.
    await navigateTo(h, dual.url('http', loop, '/link-a.html'));
    await waitFor('the card for the loop', () => cardKind(h), (k) => k === 'https-only');
    expect(httpTo(loop)).toEqual([]);
    await h.shell.click(`${CARD} #panel-back`);
    await waitFor('the card closed', () => cardKind(h), (k) => k === null);
  });

  it('PD3 Continue makes an exception until the browser closes, listed in Settings and the site panel; Remove ends it; a kept one outlives a restart', async () => {
    const profile = newProfile();
    let app = await launchHttps(profile);
    try {
      await waitForPage(app, 'link-a');
      await navigateTo(app, dual.url('http', plain, '/link-b.html?visit=1'));
      await waitFor('the card', () => cardKind(app), (k) => k === 'https-only');
      await app.shell.click(`${CARD} #panel-continue-http`);
      await waitFor('loaded over plain HTTP', () => focusedTab(app), (t) => t.state === 'loaded' && t.url === dual.url('http', plain, '/link-b.html?visit=1'));
      expect(httpTo(plain)).toEqual([`${plain}/link-b.html?visit=1`]);

      // The site panel says so, and Settings lists it.
      await app.shell.click(BAR('site-button'));
      await waitFor('the site panel says it', () => app.shell.locator(SITE('site-https-state')).textContent(), (t) => /until you close the browser/.test(t ?? ''));
      await pressInShell(app, 'Escape');
      await openSettingsAt(app, 'set-https-only');
      await waitFor('listed in Settings', () => app.shell.locator(SET('set-https-site')).allTextContents(), (t) => t.length === 1 && t[0]!.includes(plain) && t[0]!.includes('until you close'));

      // Remove: the card shows again.
      await app.shell.click(SET('set-https-remove'));
      await waitFor('gone from Settings', () => app.shell.locator(SET('set-https-site')).count(), (n) => n === 0);
      await pressInShell(app, 'Escape');
      await navigateTo(app, dual.url('http', plain, '/link-b.html?visit=2'));
      await waitFor('the card again', () => cardKind(app), (k) => k === 'https-only');
      expect(httpTo(plain).filter((r) => r.includes('visit=2'))).toEqual([]);

      // Continue, then keep it from the site panel.
      await app.shell.click(`${CARD} #panel-continue-http`);
      await waitFor('loaded over plain HTTP', () => focusedTab(app), (t) => t.state === 'loaded' && t.url.includes('visit=2'));
      await app.shell.click(BAR('site-button'));
      await waitFor('the keep button', () => app.shell.locator(SITE('site-https-keep')).count(), (n) => n === 1);
      await app.shell.click(SITE('site-https-keep'));
      await waitFor('kept', () => app.shell.locator(SITE('site-https-state')).textContent(), (t) => /Always allowed/.test(t ?? ''));
      await pressInShell(app, 'Escape');
    } finally {
      await app.close();
    }
    // After a restart: kept, so no card.
    app = await launchHttps(profile);
    try {
      await waitForPage(app, 'link-a');
      await navigateTo(app, dual.url('http', plain, '/link-b.html?visit=3'));
      await waitFor('loaded over plain HTTP at once', () => focusedTab(app), (t) => t.state === 'loaded' && t.url === dual.url('http', plain, '/link-b.html?visit=3'));
      expect(await cardKind(app)).toBeNull();
    } finally {
      await app.close();
    }
  });

  it('PD3 an exception until the browser closes does not outlive a restart', async () => {
    const profile = newProfile();
    let app = await launchHttps(profile);
    try {
      await waitForPage(app, 'link-a');
      await navigateTo(app, dual.url('http', plain, '/link-a.html?once=1'));
      await waitFor('the card', () => cardKind(app), (k) => k === 'https-only');
      await app.shell.click(`${CARD} #panel-continue-http`);
      await waitFor('loaded over plain HTTP', () => focusedTab(app), (t) => t.state === 'loaded' && t.url.includes('once=1'));
    } finally {
      await app.close();
    }
    app = await launchHttps(profile);
    try {
      await waitForPage(app, 'link-a');
      await navigateTo(app, dual.url('http', plain, '/link-a.html?once=2'));
      await waitFor('the card after the restart', () => cardKind(app), (k) => k === 'https-only');
    } finally {
      await app.close();
    }
  });

  it("PD4 a private tab's exception does not reach normal tabs, and goes when the last private tab closes", async () => {
    await pressInShell(h, 'N', ['control', 'shift']);
    await waitFor('private tab', () => focusedTab(h), (t) => t.private && t.state === 'start');
    await navigateTo(h, dual.url('http', plain, '/link-a.html?private=1'));
    await waitFor('the card in the private tab', () => cardKind(h), (k) => k === 'https-only');
    await h.shell.click(`${CARD} #panel-continue-http`);
    await waitFor('loaded over plain HTTP', () => focusedTab(h), (t) => t.private && t.state === 'loaded' && t.url.includes('private=1'));
    // A normal tab: the card.
    await pressInShell(h, 'T', ['control']);
    await waitFor('a normal tab', () => focusedTab(h), (t) => !t.private);
    await navigateTo(h, dual.url('http', plain, '/link-a.html?normal=1'));
    await waitFor('the card in the normal tab', () => cardKind(h), (k) => k === 'https-only');
    await pressInShell(h, 'W', ['control']);
    // Close the private tab; a new private tab gets the card.
    const privateTab = (await tabs(h)).find((t) => t.private)!;
    await cycleToTab(h, privateTab.id);
    await pressInShell(h, 'W', ['control']);
    await waitFor('no private tab', () => tabs(h), (all) => !all.some((t) => t.private));
    await pressInShell(h, 'N', ['control', 'shift']);
    await waitFor('a new private tab', () => focusedTab(h), (t) => t.private && t.state === 'start');
    await navigateTo(h, dual.url('http', plain, '/link-a.html?private=2'));
    await waitFor('the card again', () => cardKind(h), (k) => k === 'https-only');
    await pressInShell(h, 'W', ['control']);
    await waitFor('no private tab', () => tabs(h), (all) => !all.some((t) => t.private));
  });

  it('PD5 with HTTPS-only off, http:// loads as before, and the setting is kept', async () => {
    await openSettingsAt(h, 'set-https-only');
    expect(await h.shell.locator(SET('set-https-only')).isChecked()).toBe(true);
    await h.shell.click(SET('set-https-only'));
    await waitFor('saved', () => h.shell.evaluate(async () => {
      const w = window as unknown as { hypersol: { data(r: object): Promise<{ value: { httpsOnly: boolean } }> } };
      return (await w.hypersol.data({ op: 'settings.get' })).value.httpsOnly;
    }), (v) => v === false);
    await pressInShell(h, 'Escape');
    await navigateTo(h, dual.url('http', secure, '/link-a.html?off=1'));
    await waitFor('loaded over plain HTTP', () => focusedTab(h), (t) => t.state === 'loaded' && t.url === dual.url('http', secure, '/link-a.html?off=1'));
    expect(httpTo(secure)).toEqual([`${secure}/link-a.html?off=1`]);
    await openSettingsAt(h, 'set-https-only');
    await h.shell.click(SET('set-https-only'));
    await pressInShell(h, 'Escape');
  });
});

describe('PD6 and PD7: per-site storage (issue #26)', () => {
  it('PD6 lists the sites that keep data, with their cookies; not a private tab\'s. PD7 clears one site and reloads its tab, and keeps the rest', async () => {
    const h = await launchHttps();
    try {
      await waitForPage(h, 'link-a');
      // Data on two sites: cookies, local storage, and IndexedDB; and a cookie for a site above one of them.
      const fill = (tag: string) => `(async () => {
        document.cookie = 'who=${tag}; path=/; max-age=3600';
        localStorage.setItem('kept', '${tag}');
        await new Promise((ok, no) => { const r = indexedDB.open('box'); r.onupgradeneeded = () => r.result.createObjectStore('s'); r.onsuccess = () => { const t = r.result.transaction('s', 'readwrite'); t.objectStore('s').put('${tag}', 'k'); t.oncomplete = () => { r.result.close(); ok(true); }; }; r.onerror = no; });
        return true;
      })()`;
      const shopUrl = dual.url('https', `shop.${secure}`, '/link-a.html');
      const otherUrl = dual.url('https', secure, '/link-b.html');
      await navigateTo(h, shopUrl);
      await waitForPage(h, shopUrl);
      await inPage(h, fill('shop'), shopUrl);
      await inPage(h, `document.cookie = 'parent=1; domain=${secure}; path=/; max-age=3600'; true`, shopUrl);
      await pressInShell(h, 'T', ['control']);
      await navigateTo(h, otherUrl);
      await waitForPage(h, otherUrl);
      await inPage(h, fill('other'), otherUrl);
      // A private tab's cookie is never listed.
      await pressInShell(h, 'N', ['control', 'shift']);
      await waitFor('private tab', () => focusedTab(h), (t) => t.private && t.state === 'start');
      const privateUrl = dual.url('https', `private.${secure}`, '/link-a.html');
      await navigateTo(h, privateUrl);
      await waitForPage(h, privateUrl);
      await inPage(h, `document.cookie = 'p=1; path=/'; true`, privateUrl);

      await openLibrary(h, 'sites');
      await waitFor(
        'the two sites listed',
        () => h.shell.locator(LIB('sites-host')).allTextContents(),
        (hosts) => hosts.includes(secure) && hosts.includes(`shop.${secure}`),
      );
      const hosts = await h.shell.locator(LIB('sites-host')).allTextContents();
      expect(hosts.some((x) => x.startsWith('private.'))).toBe(false);
      const detail = async (host: string) => {
        const rows = h.shell.locator(LIB('sites-item'));
        for (let i = 0; i < (await rows.count()); i++) {
          if ((await rows.nth(i).locator('[data-testid="sites-host"]').textContent()) === host) return rows.nth(i).locator('[data-testid="sites-detail"]').textContent();
        }
        return null;
      };
      expect(await detail(`shop.${secure}`)).toMatch(/^1 cookie, \d+ bytes · open in 1 tab · also receives secure\.test's cookies$/);
      expect(await detail(secure)).toMatch(/^2 cookies, \d+ bytes · open in 1 tab$/);
      expect(await h.shell.locator(LIB('sites-about')).textContent()).toMatch(/not\s+reported\s+per\s+site/);

      // Clear shop.secure.test (with its confirmation): its own data goes, its tab reloads; secure.test's stays.
      const shopPage = (await h.app.evaluate(({ webContents }, host) => webContents.getAllWebContents().find((w) => w.getURL().includes(`//${host}`))?.id ?? null, `shop.${secure}`))!;
      await inPage(h, 'window.__beforeClear = true; true', { id: shopPage });
      await h.shell.fill(LIB('lib-search'), `shop.${secure}`);
      await h.shell.click(LIB('sites-clear'));
      expect(await h.shell.locator(LIB('sites-item')).textContent()).toMatch(/Cookies set for secure\.test, which it also receives, stay too/);
      await h.shell.click(LIB('sites-clear-confirm'));
      await waitFor('cleared', () => h.shell.locator(LIB('lib-note')).textContent().catch(() => ''), (t) => t === `Cleared shop.${secure}.`);
      await waitFor('its tab reloaded', () => inPage<boolean>(h, 'window.__beforeClear === true', { id: shopPage }).catch(() => true), (v) => v === false);
      await waitFor('its page settled', () => inPage<string>(h, 'document.readyState', { id: shopPage }), (s) => s === 'complete');
      const storage = (page: { id: number } | string) =>
        inPage<{ cookie: string; kept: string | null; dbs: string[] }>(h, `(async () => ({ cookie: document.cookie, kept: localStorage.getItem('kept'), dbs: (await indexedDB.databases()).map((d) => d.name) }))()`, page);
      expect(await storage({ id: shopPage })).toEqual({ cookie: 'parent=1', kept: null, dbs: [] });
      expect(await storage(otherUrl)).toEqual({ cookie: expect.stringContaining('who=other'), kept: 'other', dbs: ['box'] });
    } finally {
      await h.close();
    }
  });
});

describe('PD8 and PD9: bookmark import and export (issue #27)', () => {
  const folder = () => {
    const dir = mkdtempSync(join(tmpdir(), 'hypersol-bookmarks-'));
    folders.push(dir);
    return dir;
  };
  const nextFile = (h: Harness, path: string | null) => h.app.evaluate((_e, p) => void (globalThis.__hypersolTest!.nextFile = p), path);
  const bookmarks = (h: Harness) =>
    h.shell.evaluate(async () => {
      const w = window as unknown as { hypersol: { data(r: object): Promise<{ value: { url: string; title: string }[] } > } };
      return (await w.hypersol.data({ op: 'bookmarks.list' })).value.map((b) => ({ url: b.url, title: b.title }));
    });

  it('PD8 the preview lists what is added and skipped; Cancel adds nothing; Add adds them; duplicates skipped; text kept as written, and nothing in the file runs', async () => {
    const dir = folder();
    const file = join(dir, 'from-another-browser.html');
    writeFileSync(
      file,
      `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE><H1>Bookmarks</H1>
<DL><p>
  <DT><H3>Trips</H3>
  <DL><p>
    <DT><A HREF="https://tokyo.example/" ADD_DATE="1700000000">東京 &amp; Ταξίδι</A>
    <DT><A HREF="https://x.example/">&lt;img src=x onerror="window.__ran=1"&gt;<script>window.__ran = 2</script>Plain</A>
  </DL><p>
  <DT><A HREF="${server.url('link-a.html')}">Already here</A>
  <DT><A HREF="javascript:window.__ran=3">A bookmarklet</A>
</DL><p>`,
    );
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      await h.shell.evaluate(async (url) => {
        const w = window as unknown as { hypersol: { data(r: object): Promise<unknown> } };
        await w.hypersol.data({ op: 'bookmarks.add', url, title: 'Link A', favicon: null });
      }, server.url('link-a.html'));
      await openLibrary(h, 'bookmarks');
      // A dialog closed without a choice: nothing happens.
      await nextFile(h, null);
      await h.shell.click(LIB('lib-import'));
      await caughtUp(h, await focusedPage(h));
      expect(await h.shell.locator(LIB('lib-import-preview')).count()).toBe(0);

      await nextFile(h, file);
      await h.shell.click(LIB('lib-import'));
      await waitFor('the preview', () => h.shell.locator(LIB('lib-import-summary')).textContent(), (t) => /2 bookmarks to add, 2 skipped/.test(t ?? ''));
      expect(await h.shell.locator(`${LIB('lib-import-found')} .title`).allTextContents()).toEqual(['東京 & Ταξίδι', '<img src=x onerror="window.__ran=1">window.__ran = 2Plain']);
      expect(await h.shell.locator(`${LIB('lib-import-found')} .url`).first().textContent()).toBe('Trips · https://tokyo.example/');
      expect(await h.shell.locator(`${LIB('lib-import-skipped')} .why`).allTextContents()).toEqual([`already bookmarked · ${server.url('link-a.html')}`, 'not a web address · javascript:window.__ran=3']);
      // Cancel: nothing added.
      await h.shell.click(LIB('lib-import-cancel'));
      expect(await bookmarks(h)).toEqual([{ url: server.url('link-a.html'), title: 'Link A' }]);

      // Again, and Add.
      await nextFile(h, file);
      await h.shell.click(LIB('lib-import'));
      await waitFor('the preview', () => h.shell.locator(LIB('lib-import-add')).count(), (n) => n === 1);
      await h.shell.click(LIB('lib-import-add'));
      await waitFor('added', () => h.shell.locator(LIB('lib-note')).textContent().catch(() => ''), (t) => t === 'Added 2 bookmarks from from-another-browser.html.');
      expect((await bookmarks(h)).sort((a, b) => a.url.localeCompare(b.url))).toEqual(
        [
          { url: server.url('link-a.html'), title: 'Link A' },
          { url: 'https://tokyo.example/', title: '東京 & Ταξίδι' },
          { url: 'https://x.example/', title: '<img src=x onerror="window.__ran=1">window.__ran = 2Plain' },
        ].sort((a, b) => a.url.localeCompare(b.url)),
      );
      expect(await h.shell.evaluate(() => (window as unknown as { __ran?: number }).__ran)).toBeUndefined();

      // A file that is not a bookmark file, and one with too many bookmarks: refused with the reason, nothing added.
      const notes = join(dir, 'notes.html');
      writeFileSync(notes, '<p>Just a page</p>');
      await nextFile(h, notes);
      await h.shell.click(LIB('lib-import'));
      await waitFor('refused', () => h.shell.locator(LIB('lib-import-error')).textContent().catch(() => ''), (t) => /not a bookmark file/.test(t ?? ''));
      await h.shell.click(LIB('lib-import-cancel'));
      const many = join(dir, 'many.html');
      writeFileSync(many, `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>${Array.from({ length: 20_001 }, (_, i) => `<DT><A HREF="https://e.example/${i}">${i}</A>`).join('\n')}</DL>`);
      await nextFile(h, many);
      await h.shell.click(LIB('lib-import'));
      await waitFor('refused', () => h.shell.locator(LIB('lib-import-error')).textContent().catch(() => ''), (t) => /more than 20,000 bookmarks/.test(t ?? ''));
      await h.shell.click(LIB('lib-import-cancel'));
      expect(await bookmarks(h)).toHaveLength(3);
    } finally {
      await h.close();
    }
  });

  it('PD9 export writes the standard file with bookmarks only, and it imports into an empty profile as the same bookmarks', async () => {
    const dir = folder();
    const out = join(dir, 'exported.html');
    const marks = [
      { url: 'https://a.example/?q="1"&r=<2>', title: 'A & "quotes" <tags>' },
      { url: 'https://b.example/日本', title: 'Ünïcödé · 東京' },
    ];
    let h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      for (const m of marks) {
        await h.shell.evaluate(async (b) => {
          const w = window as unknown as { hypersol: { data(r: object): Promise<unknown> } };
          await w.hypersol.data({ op: 'bookmarks.add', url: b.url, title: b.title, favicon: null });
        }, m);
      }
      await openLibrary(h, 'bookmarks');
      await nextFile(h, out);
      await h.shell.click(LIB('lib-export'));
      await waitFor('exported', () => h.shell.locator(LIB('lib-note')).textContent().catch(() => ''), (t) => t === 'Exported 2 bookmarks to exported.html.');
      const text = readFileSync(out, 'utf8');
      expect(text.startsWith('<!DOCTYPE NETSCAPE-Bookmark-file-1>')).toBe(true);
      expect(text).toContain('<DT><A HREF="https://a.example/?q=&quot;1&quot;&amp;r=&lt;2&gt;"');
      // Bookmarks only: not the pages visited.
      expect(text).not.toContain('link-a.html');
    } finally {
      await h.close();
    }
    h = await launch(server.url('link-b.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-b');
      await openLibrary(h, 'bookmarks');
      await nextFile(h, out);
      await h.shell.click(LIB('lib-import'));
      await waitFor('the preview', () => h.shell.locator(LIB('lib-import-add')).count(), (n) => n === 1);
      await h.shell.click(LIB('lib-import-add'));
      await waitFor('added', () => h.shell.locator(LIB('lib-note')).textContent().catch(() => ''), (t) => (t ?? '').startsWith('Added 2 bookmarks'));
      expect((await bookmarks(h)).sort((a, b) => a.url.localeCompare(b.url))).toEqual(marks);
    } finally {
      await h.close();
    }
  });
});
