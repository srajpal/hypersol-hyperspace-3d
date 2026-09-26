import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FiltersEngine, Request } from '@ghostery/adblocker';
import { describe, expect, it } from 'vitest';
import { MAX_BLOCKED_ITEMS, parsePrivacyRequest } from '../../shared/privacy';
import { DnsControl, base64Url, dnsQuery, isDnsAnswer } from './dns';
import { DAY_MS, FilterService, RETRY_MS, type FilterDeps, type ListManifest } from './filters';
import { Shield, type Matcher } from './shield';

// ---- Shield -----------------------------------------------------------------

/** Blocks anything on tracker.example; serves a stand-in for tracker.example/surrogate.js. */
const matcher: Matcher = (url) => {
  const host = new URL(url).hostname;
  if (host !== 'tracker.example') return { blocked: false };
  return url.endsWith('/surrogate.js') ? { blocked: true, redirect: 'data:text/javascript,' } : { blocked: true };
};

function shield(paused: string[] = []) {
  const counts: [number, number][] = [];
  const s = new Shield(
    () => matcher,
    (site) => paused.includes(site),
    (tab, count) => counts.push([tab, count]),
  );
  return { s, counts };
}

describe('Shield', () => {
  it('blocks listed requests and lets others through, counting per tab', () => {
    const { s, counts } = shield();
    expect(s.decide({ tab: 1, resourceType: 'mainFrame', url: 'https://news.example/' })).toEqual({});
    expect(s.decide({ tab: 1, resourceType: 'script', url: 'https://tracker.example/t.js' })).toEqual({ cancel: true });
    expect(s.decide({ tab: 1, resourceType: 'script', url: 'https://tracker.example/surrogate.js' })).toEqual({
      redirectURL: 'data:text/javascript,',
    });
    expect(s.decide({ tab: 1, resourceType: 'image', url: 'https://cdn.example/a.png' })).toEqual({});
    expect(s.decide({ tab: 2, resourceType: 'image', url: 'https://tracker.example/p.gif' })).toEqual({ cancel: true });
    expect(s.report(1)).toMatchObject({ site: 'news.example', count: 2, paused: false });
    expect(s.report(2).count).toBe(1);
    expect(counts).toEqual([
      [1, 1],
      [1, 2],
      [2, 1],
    ]);
  });

  it('starts a fresh count when the tab loads a new page', () => {
    const { s, counts } = shield();
    s.decide({ tab: 1, resourceType: 'mainFrame', url: 'https://a.example/' });
    s.decide({ tab: 1, resourceType: 'script', url: 'https://tracker.example/t.js' });
    s.decide({ tab: 1, resourceType: 'mainFrame', url: 'https://b.example/' });
    expect(s.report(1)).toEqual({ site: 'b.example', paused: false, count: 0, items: [] });
    expect(counts.at(-1)).toEqual([1, 0]);
  });

  it('a page reached without a request (history) also starts fresh, but not the same page', () => {
    const { s } = shield();
    s.decide({ tab: 1, resourceType: 'mainFrame', url: 'https://a.example/' });
    s.decide({ tab: 1, resourceType: 'script', url: 'https://tracker.example/t.js' });
    s.committed(1, 'https://a.example/#top');
    expect(s.report(1).count).toBe(1);
    s.committed(1, 'https://c.example/');
    expect(s.report(1)).toMatchObject({ site: 'c.example', count: 0 });
  });

  it('blocks a listed page, and "open anyway" lets exactly that address through once, in that tab', () => {
    const { s } = shield();
    const page = 'https://tracker.example/landing';
    expect(s.decide({ tab: 1, resourceType: 'mainFrame', url: page })).toEqual({ cancel: true });
    expect(s.report(1).items).toEqual([{ url: page, type: 'mainFrame' }]);
    s.allow(1, page);
    expect(s.decide({ tab: 2, resourceType: 'mainFrame', url: page })).toEqual({ cancel: true });
    expect(s.decide({ tab: 1, resourceType: 'mainFrame', url: 'https://tracker.example/other' })).toEqual({ cancel: true });
    s.allow(1, page);
    expect(s.decide({ tab: 1, resourceType: 'mainFrame', url: page })).toEqual({});
    expect(s.decide({ tab: 1, resourceType: 'mainFrame', url: page })).toEqual({ cancel: true });
  });

  it('blocks nothing while the tab is on a paused site', () => {
    const { s } = shield(['news.example']);
    s.decide({ tab: 1, resourceType: 'mainFrame', url: 'https://news.example/' });
    expect(s.decide({ tab: 1, resourceType: 'script', url: 'https://tracker.example/t.js' })).toEqual({});
    expect(s.report(1)).toMatchObject({ paused: true, count: 0 });
    s.decide({ tab: 1, resourceType: 'mainFrame', url: 'https://other.example/' });
    expect(s.decide({ tab: 1, resourceType: 'script', url: 'https://tracker.example/t.js' })).toEqual({ cancel: true });
  });

  it('asks about pausing per tab, so private tabs can have their own choices (issue #8)', () => {
    const asked: [string, number][] = [];
    const s = new Shield(
      () => matcher,
      (site, tab) => (asked.push([site, tab]), tab === 2 && site === 'news.example'),
      () => undefined,
    );
    s.decide({ tab: 1, resourceType: 'mainFrame', url: 'https://news.example/' });
    s.decide({ tab: 2, resourceType: 'mainFrame', url: 'https://news.example/' });
    expect(s.decide({ tab: 1, resourceType: 'script', url: 'https://tracker.example/t.js' })).toEqual({ cancel: true });
    expect(s.decide({ tab: 2, resourceType: 'script', url: 'https://tracker.example/t.js' })).toEqual({});
    expect(s.report(2).paused).toBe(true);
    expect(s.report(1).paused).toBe(false);
    expect(asked).toContainEqual(['news.example', 2]);
  });

  it('keeps the latest items only, but counts them all', () => {
    const { s } = shield();
    s.decide({ tab: 1, resourceType: 'mainFrame', url: 'https://a.example/' });
    for (let i = 0; i < MAX_BLOCKED_ITEMS + 5; i++) s.decide({ tab: 1, resourceType: 'image', url: `https://tracker.example/${i}.gif` });
    const r = s.report(1);
    expect(r.count).toBe(MAX_BLOCKED_ITEMS + 5);
    expect(r.items).toHaveLength(MAX_BLOCKED_ITEMS);
    expect(r.items.at(-1)!.url).toBe(`https://tracker.example/${MAX_BLOCKED_ITEMS + 4}.gif`);
  });

  it('ignores non-web requests and forgets closed tabs', () => {
    const { s } = shield();
    expect(s.decide({ tab: 1, resourceType: 'script', url: 'data:text/javascript,1' })).toEqual({});
    s.decide({ tab: 1, resourceType: 'image', url: 'https://tracker.example/p.gif' });
    s.forget(1);
    expect(s.report(1)).toEqual({ site: '', paused: false, count: 0, items: [] });
  });
});

// ---- Filter lists -------------------------------------------------------------

const manifest: ListManifest = {
  base: 'https://lists.example/',
  lists: [
    { path: 'a.txt', name: 'A', license: 'x', ship: true },
    { path: 'b.txt', name: 'B', license: 'x', ship: false },
  ],
  resources: { path: 'r.json', name: 'R', license: 'x', ship: true },
};

/** An "engine" is the text it was built from; "damaged" data cannot be loaded. */
function fakeDeps(over: Partial<FilterDeps<string>> & { saved?: { bin: Uint8Array; meta: string } | null } = {}) {
  const enc = (t: string) => new TextEncoder().encode(t);
  const state = {
    now: Date.parse('2026-09-26T12:00:00Z'),
    saved: over.saved ?? null,
    downloads: [] as string[],
    writes: 0,
  };
  const deps: FilterDeps<string> = {
    files: {
      readSaved: () => state.saved,
      writeSaved: (bin, meta) => {
        state.writes += 1;
        state.saved = { bin, meta };
      },
      readStarter: () => ({ bin: enc('starter'), built: state.now - 3 * DAY_MS }),
    },
    download: async (url) => {
      state.downloads.push(url);
      return `list from ${url}`;
    },
    build: async (lists, resources) => enc(`built:${lists.length}+${resources.length > 0}`),
    load: (bin) => {
      const text = new TextDecoder().decode(bin);
      if (text === 'damaged') throw new Error('bad data');
      return text;
    },
    now: () => state.now,
    ...over,
  };
  return { deps, state, enc };
}

describe('FilterService', () => {
  it('starts from the included starter copy when nothing is saved', () => {
    const { deps } = fakeDeps();
    const f = new FilterService(manifest, deps);
    expect(f.engine).toBe('starter');
    expect(f.status()).toMatchObject({ source: 'starter', refreshing: false });
    expect(f.problem).toBeNull();
  });

  it('uses the saved copy, and falls back to the starter copy when it is damaged', () => {
    const good = fakeDeps();
    const meta = JSON.stringify({ updatedAt: good.state.now - 1000, urls: new FilterService(manifest, good.deps).urls });
    const a = new FilterService(manifest, fakeDeps({ saved: { bin: good.enc('saved'), meta } }).deps);
    expect(a.engine).toBe('saved');
    expect(a.status().source).toBe('downloaded');
    const b = new FilterService(manifest, fakeDeps({ saved: { bin: good.enc('damaged'), meta } }).deps);
    expect(b.engine).toBe('starter');
    expect(b.problem).toContain('bad data');
    const c = new FilterService(manifest, fakeDeps({ saved: { bin: good.enc('saved'), meta: '{' } }).deps);
    expect(c.engine).toBe('starter');
  });

  it('refreshes from every named address, saves, and only then uses the new lists', async () => {
    const { deps, state } = fakeDeps();
    const f = new FilterService(manifest, deps);
    const status = await f.refresh();
    expect(state.downloads).toEqual(['https://lists.example/a.txt', 'https://lists.example/b.txt', 'https://lists.example/r.json']);
    expect(f.engine).toBe('built:2+true');
    expect(status).toEqual({ source: 'downloaded', updatedAt: state.now, refreshing: false });
    expect(state.writes).toBe(1);
    expect(JSON.parse(state.saved!.meta)).toEqual({ updatedAt: state.now, urls: state.downloads });
  });

  it('downloads from another base when given one (tests use a local server)', async () => {
    const { deps, state } = fakeDeps();
    await new FilterService(manifest, deps, 'http://127.0.0.1:9/lists/').refresh();
    expect(state.downloads[0]).toBe('http://127.0.0.1:9/lists/a.txt');
  });

  it('keeps the current lists when any download or the build fails', async () => {
    const { deps, state } = fakeDeps({
      download: async (url) => {
        if (url.endsWith('b.txt')) throw new Error('b.txt answered 500');
        return 'x';
      },
    });
    const f = new FilterService(manifest, deps);
    const status = await f.refresh();
    expect(f.engine).toBe('starter');
    expect(status.lastError).toContain('b.txt answered 500');
    expect(status.lastError).toContain('current lists are still in use');
    expect(state.writes).toBe(0);
  });

  it('runs one refresh at a time', async () => {
    let builds = 0;
    const { deps } = fakeDeps({ build: async () => (builds++, new TextEncoder().encode('x')) });
    const f = new FilterService(manifest, deps);
    const [a, b] = [f.refresh(), f.refresh()];
    expect(f.status().refreshing).toBe(true);
    await Promise.all([a, b]);
    expect(builds).toBe(1);
  });

  it('is due once a day, and an hour after a failed attempt', async () => {
    const { deps, state } = fakeDeps({ download: async () => Promise.reject(new Error('offline')) });
    const f = new FilterService(manifest, deps);
    expect(f.due()).toBe(true); // the starter copy is three days old
    await f.refresh();
    expect(f.due()).toBe(false);
    state.now += RETRY_MS;
    expect(f.due()).toBe(true);
    const ok = fakeDeps();
    const g = new FilterService(manifest, ok.deps);
    await g.refresh();
    ok.state.now += DAY_MS - 1;
    expect(g.due()).toBe(false);
    ok.state.now += 1;
    expect(g.due()).toBe(true);
  });

  it('a saved copy built from a different set of lists is due at once', () => {
    const { enc } = fakeDeps();
    const meta = JSON.stringify({ updatedAt: Date.now(), urls: ['https://lists.example/old.txt'] });
    const f = new FilterService(manifest, fakeDeps({ saved: { bin: enc('saved'), meta } }).deps);
    expect(f.engine).toBe('saved');
    expect(f.due()).toBe(true);
  });
});

// ---- Encrypted DNS -----------------------------------------------------------

/** A minimal DNS answer: header with the response bit and one question. */
function answer(): Uint8Array<ArrayBuffer> {
  const q = dnsQuery('dns.quad9.net');
  const a = new Uint8Array(q.length);
  a.set(q);
  a[2] = 0x81;
  a[3] = 0x80;
  return a;
}

describe('DNS', () => {
  it('builds a DNS question and recognises an answer', () => {
    const q = dnsQuery('example.com');
    expect([...q.slice(0, 12)]).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0]);
    expect(new TextDecoder().decode(q.slice(13, 20))).toBe('example');
    expect(base64Url(q)).not.toMatch(/[+/=]/);
    expect(isDnsAnswer(q)).toBe(false); // a question, not an answer
    expect(isDnsAnswer(answer())).toBe(true);
    expect(isDnsAnswer(new TextEncoder().encode('<html>Sign in to Wi-Fi</html>'))).toBe(false);
  });

  it('applies the setting, and "use this network\'s DNS" holds until the app closes', () => {
    const applied: string[] = [];
    const dns = new DnsControl((mode) => applied.push(mode), async () => new Response());
    dns.setMode('secure');
    expect(dns.useNetwork()).toMatchObject({ effective: 'automatic', networkForSession: true });
    dns.setMode('secure');
    expect(applied).toEqual(['secure', 'automatic', 'automatic']);
    expect(dns.status().resolver).toBe('https://dns.quad9.net/dns-query');
  });

  it('says the resolver is blocked when it cannot be reached or does not answer as DNS', async () => {
    const reply = (r: () => Promise<Response>) => new DnsControl(() => undefined, r, 'https://r.example/dns-query');
    const asked: string[] = [];
    const ok = new DnsControl(
      () => undefined,
      async (url) => (asked.push(url), new Response(answer())),
      'https://r.example/dns-query',
    );
    ok.setMode('secure');
    expect(await ok.check()).toBe('reachable');
    expect(asked[0]).toMatch(/^https:\/\/r\.example\/dns-query\?dns=[A-Za-z0-9_-]+$/);
    expect(await reply(() => Promise.reject(new Error('refused'))).check()).toBe('blocked');
    expect(await reply(async () => new Response('<html>portal</html>')).check()).toBe('blocked');
    expect(await reply(async () => new Response('x', { status: 403 })).check()).toBe('blocked');
    const auto = reply(async () => new Response(answer()));
    auto.setMode('automatic');
    expect(await auto.check()).toBe('not-secure');
    expect(await new DnsControl(() => undefined, () => Promise.reject(new Error('no')), 'https://r/', null).check()).toBe(
      'reachable',
    );
  });
});

// ---- Requests from the shell ---------------------------------------------------

describe('parsePrivacyRequest', () => {
  it('accepts well-formed requests', () => {
    expect(parsePrivacyRequest({ op: 'shield.report', tab: 3 })).toEqual({ request: { op: 'shield.report', tab: 3 } });
    // The tab is part of the request since GitHub issue #8 (a private tab's pause stays in memory).
    expect(parsePrivacyRequest({ op: 'shield.pause', tab: 4, site: 'News.Example', paused: true })).toEqual({
      request: { op: 'shield.pause', tab: 4, site: 'news.example', paused: true },
    });
    expect(parsePrivacyRequest({ op: 'dns.check' })).toEqual({ request: { op: 'dns.check' } });
  });

  it('refuses anything else', () => {
    expect(parsePrivacyRequest(null)).toHaveProperty('error');
    expect(parsePrivacyRequest({ op: 'shield.report', tab: -1 })).toHaveProperty('error');
    expect(parsePrivacyRequest({ op: 'shield.allow-once', tab: 2, url: 'file:///x' })).toHaveProperty('error');
    expect(parsePrivacyRequest({ op: 'shield.pause', tab: 4, site: 'a b', paused: true })).toHaveProperty('error');
    expect(parsePrivacyRequest({ op: 'shield.pause', tab: 4, site: 'a.example', paused: 'yes' })).toHaveProperty('error');
    expect(parsePrivacyRequest({ op: 'shield.pause', site: 'a.example', paused: true })).toHaveProperty('error'); // no tab
    expect(parsePrivacyRequest({ op: 'dns.flush' })).toEqual({ error: 'Unknown request: dns.flush' });
  });
});

// ---- The starter copy included in the app -------------------------------------

describe('starter copy (resources/filters)', () => {
  const dir = join(__dirname, '..', '..', '..', 'resources', 'filters');

  it('loads with the installed blocker and blocks well-known ad and tracking addresses', () => {
    const engine = FiltersEngine.deserialize(new Uint8Array(readFileSync(join(dir, 'starter.bin'))));
    const blocked = (url: string, type: 'script' | 'image' | 'mainFrame') =>
      engine.match(Request.fromRawDetails({ url, type, sourceUrl: type === 'mainFrame' ? '' : 'https://news.example/' })).match;
    expect(blocked('https://www.google-analytics.com/analytics.js', 'script')).toBe(true);
    expect(blocked('https://ad.doubleclick.net/ddm/ad.gif', 'image')).toBe(true);
    expect(blocked('https://ad.doubleclick.net/ddm/clk/1', 'mainFrame')).toBe(true);
    expect(blocked('https://news.example/app.js', 'script')).toBe(false);
  });

  it('leaves out the download-only lists and records what went in', () => {
    const manifest = JSON.parse(readFileSync(join(dir, 'lists.json'), 'utf8')) as ListManifest;
    const built = JSON.parse(readFileSync(join(dir, 'starter.json'), 'utf8')) as { lists: { name: string; shipped: boolean }[] };
    expect(built.lists.map((l) => [l.name, l.shipped])).toEqual(manifest.lists.map((l) => [l.name, l.ship]));
    expect(manifest.lists.find((l) => l.path.startsWith('peter-lowe'))?.ship).toBe(false);
  });
});
