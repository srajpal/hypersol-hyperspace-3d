/**
 * Milestone 4 end-to-end checks F1 to F10 (TODO.md): ad and tracker
 * blocking, the shield count and popover, element hiding, blocked pages
 * with "open anyway", pausing a site, encrypted DNS, and the filter lists.
 *
 * Nothing here uses the internet. The shield uses the starter lists
 * included in the app; well-known ad and tracker hosts are mapped to this
 * machine (harness.ts), so anything the shield let through would reach
 * the local test server and show in its counts.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import {
  APP_DIR,
  inPage,
  launch,
  mainLog,
  navigateTo,
  newProfile,
  pressInShell,
  shellCall,
  sleep,
  waitFor,
  waitForPage,
  type Harness,
  settingsTo,
} from './harness';

let server: FixtureServer;
const FILTERS_DIR = join(APP_DIR, 'resources', 'filters');
const QUAD9 = 'https://dns.quad9.net/dns-query';

beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
});

/** The test server under a host name (element hiding skips raw IP addresses). */
const named = (host: string, file: string) => server.url(file).replace('127.0.0.1', host);
const shieldPage = () => named('shop.test', 'shield.html');
const hits = (key: string) => server.hits.get(key) ?? 0;
const SHIELD = (id: string) => `hs-shield [data-testid="${id}"]`;
const SET = (id: string) => `hs-settings [data-testid="${id}"]`;
const CARD = '[data-testid="page-panel"][aria-hidden="false"] .hs-error-card';

async function loadShieldPage(h: Harness): Promise<Record<string, string>> {
  await navigateTo(h, shieldPage());
  return readShieldPage(h);
}

async function readShieldPage(h: Harness): Promise<Record<string, string>> {
  await waitForPage(h, 'shield.html');
  await waitFor('the page to finish its requests', () => inPage<string>(h, 'document.title', 'shield.html'), (t) => t === 'Shield test ready');
  return JSON.parse(await inPage<string>(h, 'document.getElementById("result").textContent', 'shield.html')) as Record<
    string,
    string
  >;
}

const shield = (h: Harness) => shellCall(h, 'shield');

async function openSettings(h: Harness): Promise<void> {
  if ((await shellCall(h, 'openPanel')) !== 'settings') await pressInShell(h, ',', ['control']);
  await waitFor('settings open', () => shellCall(h, 'openPanel'), (p) => p === 'settings');
  // DNS and the filter lists are in Settings > Privacy and security (milestone 11).
  await settingsTo(h, 'set-filters-status');
}

async function openPopover(h: Harness): Promise<void> {
  await h.shell.click(SHIELD('shield'));
  await waitFor('shield popover', () => shield(h), (s) => s.open);
}

describe('F1 to F5: the shield on a page', () => {
  // These share one app and run in order: F1 to F3 read the page the app
  // opened with (F2 opens a second tab and comes back to the first), and
  // F5 leaves that page.
  let h: Harness;
  beforeAll(async () => {
    h = await launch(shieldPage());
  });
  afterAll(async () => h?.close());

  it('F1 blocks tracker and ad requests from the starter lists, and the page still works', async () => {
    const results = await readShieldPage(h);
    expect(results['ownImage']).toBe('loaded');
    expect(hits('/ddm/ad.gif')).toBe(0); // ad image: never left the browser
    expect(hits('/analytics.js')).toBe(0); // tracker script: never left the browser
    expect(results['adImage']).toBe('failed');
    expect(results['analytics']).toBe('failed');
    expect(hits('/ddm/pixel.gif')).toBe(1); // a host on no list goes through
    expect(await inPage<string>(h, 'document.getElementById("content").textContent', 'shield.html')).toBe('Shield test page');
  });

  it('F4 hides page elements matched by element-hiding rules', async () => {
    const display = (sel: string) => inPage<string>(h, `getComputedStyle(document.querySelector('${sel}')).display`, 'shield.html');
    await waitFor('the advert hidden', () => display('#ad_banner'), (d) => d === 'none');
    expect(await display('ad-slot')).toBe('none');
    expect(await display('#content')).toBe('block');
  });

  it('F2 counts per tab, and a new page starts from zero', async () => {
    await waitFor('the count', () => shield(h), (s) => s.count === 2);
    expect((await shield(h)).disabled).toBe(false);
    await pressInShell(h, 'T', ['control']);
    await waitFor('a start tab: no count', () => shield(h), (s) => s.disabled);
    await navigateTo(h, server.url('link-a.html'));
    await waitForPage(h, 'link-a');
    await waitFor('the second tab counts nothing', () => shield(h), (s) => !s.disabled && s.count === 0);
    await pressInShell(h, 'Tab', ['control']);
    await waitFor('back to the first tab', () => shield(h), (s) => s.count === 2);
  });

  it('F3 the popover lists what was blocked, takes the keyboard, and Escape closes it', async () => {
    await openPopover(h);
    await waitFor('the list', () => h.shell.locator(SHIELD('shield-list')).textContent(), (t) =>
      Boolean(t?.includes('ad.doubleclick.net') && t.includes('www.google-analytics.com')),
    );
    expect(await h.shell.locator(SHIELD('shield-summary')).textContent()).toBe('2 requests blocked on this page.');
    expect(await h.shell.evaluate(() => document.activeElement?.tagName)).toBe('HS-SHIELD');
    await pressInShell(h, 'Escape');
    await waitFor('popover closed', () => shield(h), (s) => !s.open);
    expect(
      await h.shell.evaluate(() => document.querySelector('hs-shield')?.shadowRoot?.activeElement?.getAttribute('data-testid')),
    ).toBe('shield');
  });

  it('F5 a listed page shows the blocked card; "open anyway" opens it once, in that tab only', async () => {
    const landing = named('ad.doubleclick.net', 'ddm/clk/landing');
    await navigateTo(h, landing);
    await waitFor('blocked card', () => h.shell.locator(CARD).getAttribute('data-kind'), (k) => k === 'blocked');
    expect(hits('/ddm/clk/landing')).toBe(0);
    await h.shell.click(`${CARD} #panel-open-anyway`);
    await waitForPage(h, 'ddm/clk/landing');
    expect(await inPage<string>(h, 'document.title', 'ddm/clk/landing')).toBe('Ad landing');
    expect(hits('/ddm/clk/landing')).toBe(1);

    await pressInShell(h, 'T', ['control']);
    await navigateTo(h, server.url('link-b.html'));
    await waitForPage(h, 'link-b');
    await navigateTo(h, landing);
    await waitFor('blocked in the other tab', () => h.shell.locator(CARD).getAttribute('data-kind'), (k) => k === 'blocked');
    expect(hits('/ddm/clk/landing')).toBe(1);
    // "Go back" returns to the page the tab is still on.
    await h.shell.click(`${CARD} #panel-back`);
    await waitFor('back on Link B', () => shellCall(h, 'status'), (s) => s?.state === 'loaded' && s.url.endsWith('/link-b.html'));
    expect(await h.shell.locator(CARD).count()).toBe(0);
  });
});

describe('F6: pausing the shield on a site', () => {
  it('lets everything through on that site, and remembers it after a restart', async () => {
    const profile = newProfile();
    let h = await launch(shieldPage(), { userDataDir: profile });
    try {
      await readShieldPage(h);
      const before = hits('/ddm/ad.gif');
      await waitFor('the count', () => shield(h), (s) => s.count === 2);
      await openPopover(h);
      await h.shell.click(SHIELD('shield-pause'));
      // The page reloads with the shield paused: the ad now reaches the server.
      await waitFor('the ad let through', async () => hits('/ddm/ad.gif'), (n) => n === before + 1);
      await waitFor('nothing counted', () => shield(h), (s) => s.count === 0);
      await waitFor('summary', () => h.shell.locator(SHIELD('shield-summary')).textContent(), (t) => t?.startsWith('Paused') ?? false);
      expect(JSON.parse(readFileSync(join(profile, 'settings.json'), 'utf8')).pausedSites).toEqual(['shop.test']);
    } finally {
      await h.close();
    }

    const before = hits('/ddm/ad.gif');
    h = await launch(shieldPage(), { userDataDir: profile });
    try {
      await readShieldPage(h);
      expect(hits('/ddm/ad.gif')).toBe(before + 1); // still paused
      await openPopover(h);
      expect(await h.shell.locator(SHIELD('shield-pause')).isChecked()).toBe(true);
      await h.shell.click(SHIELD('shield-pause')); // resume
      await waitFor('blocking again', () => shield(h), (s) => s.count === 2);
      expect(hits('/ddm/ad.gif')).toBe(before + 1);
    } finally {
      await h.close();
    }
  });
});

describe('F7 and F8: encrypted DNS', () => {
  it('F7 starts in Secure mode with Quad9, and the Automatic setting applies at once and after a restart', async () => {
    const profile = newProfile();
    let h = await launch(server.url('link-a.html'), { userDataDir: profile });
    try {
      expect(await mainLog(h, 'dnsApplied')).toEqual([{ mode: 'secure', resolver: QUAD9 }]);
      await openSettings(h);
      await settingsTo(h, 'set-dns-secure');
      expect(await h.shell.locator(SET('set-dns-secure')).isChecked()).toBe(true);
      await settingsTo(h, 'set-dns-automatic');
      await h.shell.click(SET('set-dns-automatic'));
      await waitFor('automatic applied', () => mainLog(h, 'dnsApplied'), (a) => a.at(-1)?.mode === 'automatic');
    } finally {
      await h.close();
    }
    h = await launch(server.url('link-a.html'), { userDataDir: profile });
    try {
      expect(await mainLog(h, 'dnsApplied')).toEqual([{ mode: 'automatic', resolver: QUAD9 }]);
    } finally {
      await h.close();
    }
  });

  it('F8 a blocked resolver gets its own card, and "use this network\'s DNS" applies until the app closes', async () => {
    const h = await launch(server.url('link-a.html'), { dnsProbe: server.url('dns-portal') });
    try {
      await waitForPage(h, 'link-a');
      await navigateTo(h, 'http://nowhere.invalid/');
      await waitFor('DNS card', () => h.shell.locator(CARD).getAttribute('data-kind'), (k) => k === 'dns-blocked');
      await h.shell.click(`${CARD} #panel-use-network-dns`);
      await waitFor('automatic for now', () => mainLog(h, 'dnsApplied'), (a) => a.at(-1)?.mode === 'automatic');
      // The name still does not exist: now it is simply "not found".
      await waitFor('not-found card', () => h.shell.locator(CARD).getAttribute('data-kind'), (k) => k === 'not-found');
      await openSettings(h);
      await settingsTo(h, 'set-dns-session');
      await waitFor('session note', () => h.shell.locator(SET('set-dns-session')).isVisible(), (v) => v);
      await settingsTo(h, 'set-dns-secure');
      expect(await h.shell.locator(SET('set-dns-secure')).isChecked()).toBe(true); // the saved setting is unchanged
    } finally {
      await h.close();
    }
  });

  it('F8 a reachable resolver keeps the plain "not found" card', async () => {
    const probe = server.url('dns-query');
    const h = await launch(server.url('link-a.html'), { dnsProbe: probe });
    try {
      await waitForPage(h, 'link-a');
      await navigateTo(h, 'http://nowhere.invalid/');
      await waitFor('the resolver asked', () => mainLog(h, 'requests'), (r) => r.some((u) => u.startsWith(probe)));
      // The card is decided when the app's answer about the resolver
      // reaches the shell. The resolver's own answer has left the server...
      const asked = () => [...server.hits.entries()].filter(([k]) => k.startsWith('/dns-query')).reduce((n, [, c]) => n + c, 0);
      await waitFor("the resolver's answer sent", async () => [asked(), server.openNow.get('/dns-query') ?? 0], ([n, open]) => n! > 0 && open === 0);
      // ...and a second question about the resolver, put to the app from
      // the shell only now, takes a request of its own: its answer comes
      // back after the first one's, and says what the first said.
      const again = await h.shell.evaluate(() =>
        (window as unknown as { hypersol: { privacy(r: object): Promise<{ ok: boolean; value?: unknown }> } }).hypersol.privacy({ op: 'dns.check' }),
      );
      expect(again).toEqual({ ok: true, value: 'reachable' });
      expect(await h.shell.locator(CARD).getAttribute('data-kind')).toBe('not-found');
    } finally {
      await h.close();
    }
  });
});

describe('F9 and F10: the filter lists', () => {
  const manifest = JSON.parse(readFileSync(join(FILTERS_DIR, 'lists.json'), 'utf8')) as {
    lists: { path: string }[];
    resources: { path: string };
  };
  const listUrls = (base: string) => [...manifest.lists.map((l) => base + l.path), base + manifest.resources.path];
  const filterHits = (prefix: string) => [...server.hits.entries()].filter(([k]) => k.startsWith(prefix)).reduce((n, [, c]) => n + c, 0);
  const statusText = (h: Harness) => h.shell.locator(SET('set-filters-status')).textContent();

  /** A profile whose saved lists are a day old, so a refresh is due at once. */
  function staleProfile(base: string, settings?: object): string {
    const profile = newProfile();
    mkdirSync(join(profile, 'filters'));
    copyFileSync(join(FILTERS_DIR, 'starter.bin'), join(profile, 'filters', 'engine.bin'));
    writeFileSync(join(profile, 'filters', 'engine.json'), JSON.stringify({ updatedAt: 1, urls: listUrls(base) }));
    if (settings) writeFileSync(join(profile, 'settings.json'), JSON.stringify(settings));
    return profile;
  }

  it('F9 "Update now" downloads only the named lists, puts them in use, and keeps them after a restart', async () => {
    const base = server.url('filters/');
    const profile = newProfile();
    // Only "Update now" here: with daily updates on, the built-in lists
    // (built more than a day ago) would also refresh on schedule and
    // double the count (GitHub issue #20). The schedule has its own check below.
    writeFileSync(join(profile, 'settings.json'), JSON.stringify({ filterRefresh: false }));
    let h = await launch(shieldPage(), { userDataDir: profile, filtersBase: base });
    try {
      await readShieldPage(h);
      const tracker = hits('/ddm/pixel.gif');
      await openSettings(h);
      await waitFor('starter lists', () => statusText(h), (t) => t?.includes('included with the app') ?? false);
      const before = filterHits('/filters/');
      await settingsTo(h, 'set-filters-update');
      await h.shell.click(SET('set-filters-update'));
      await waitFor('lists updated', () => statusText(h), (t) => t?.startsWith('Lists updated') ?? false, 30_000);
      expect(filterHits('/filters/') - before).toBe(listUrls(base).length);
      expect(existsSync(join(profile, 'filters', 'engine.bin'))).toBe(true);
      await pressInShell(h, 'Escape');
      await loadShieldPage(h);
      expect(hits('/ddm/pixel.gif')).toBe(tracker); // now on a list
    } finally {
      await h.close();
    }
    h = await launch(shieldPage(), { userDataDir: profile });
    try {
      const tracker = hits('/ddm/pixel.gif');
      await readShieldPage(h);
      expect(hits('/ddm/pixel.gif')).toBe(tracker);
      await openSettings(h);
      await waitFor('downloaded lists in use', () => statusText(h), (t) => t?.startsWith('Lists updated') ?? false);
    } finally {
      await h.close();
    }
  });

  it('F9 a failed refresh says so and keeps the lists in use', async () => {
    const h = await launch(shieldPage(), { filtersBase: server.url('filters-failing/') });
    try {
      await readShieldPage(h);
      await openSettings(h);
      await settingsTo(h, 'set-filters-update');
      await h.shell.click(SET('set-filters-update'));
      await settingsTo(h, 'set-filters-error');
      await waitFor('error shown', () => h.shell.locator(SET('set-filters-error')).textContent(), (t) =>
        Boolean(t?.includes('The current lists are still in use')),
      );
      expect(await statusText(h)).toContain('included with the app');
      await pressInShell(h, 'Escape');
      const ad = hits('/ddm/ad.gif');
      await loadShieldPage(h);
      expect(hits('/ddm/ad.gif')).toBe(ad); // still blocked
    } finally {
      await h.close();
    }
  });

  it('F9 a damaged saved copy falls back to the starter lists', async () => {
    const profile = newProfile();
    mkdirSync(join(profile, 'filters'));
    writeFileSync(join(profile, 'filters', 'engine.bin'), 'not an engine');
    writeFileSync(join(profile, 'filters', 'engine.json'), JSON.stringify({ updatedAt: Date.now(), urls: [] }));
    const h = await launch(shieldPage(), { userDataDir: profile });
    try {
      const ad = hits('/ddm/ad.gif');
      await readShieldPage(h);
      expect(hits('/ddm/ad.gif')).toBe(ad);
      await openSettings(h);
      await waitFor('starter lists', () => statusText(h), (t) => t?.includes('included with the app') ?? false);
    } finally {
      await h.close();
    }
  });

  it('F9 with refresh on, due lists are refreshed on schedule from the named addresses only', async () => {
    const base = server.url('filters/');
    const before = filterHits('/filters/');
    const h = await launch(server.url('link-a.html'), { userDataDir: staleProfile(base), filtersBase: base });
    try {
      await waitFor('scheduled refresh', async () => filterHits('/filters/') - before, (n) => n === listUrls(base).length, 20_000);
      const web = (await mainLog(h, 'requests')).filter((u) => /^https?:/i.test(u));
      expect(web.filter((u) => new URL(u).hostname !== '127.0.0.1')).toEqual([]);
    } finally {
      await h.close();
    }
  });

  it('F10 with refresh off, the app downloads nothing on its own', async () => {
    const base = server.url('filters/');
    const before = filterHits('/filters/');
    const h = await launch(server.url('link-a.html'), {
      userDataDir: staleProfile(base, { filterRefresh: false }),
      filtersBase: base,
    });
    try {
      await waitForPage(h, 'link-a');
      await sleep(4000); // the schedule's first check comes after 1 s in tests
      expect(filterHits('/filters/')).toBe(before);
      const web = (await mainLog(h, 'requests')).filter((u) => /^https?:/i.test(u));
      expect(web.every((u) => u.startsWith(server.base))).toBe(true);
    } finally {
      await h.close();
    }
  });
});
