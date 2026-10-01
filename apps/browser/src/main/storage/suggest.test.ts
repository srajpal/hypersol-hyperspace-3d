import { describe, expect, it } from 'vitest';
import { Store } from './database';
import { siteKey } from '../../shared/site';
import { frecency } from './history';

const DAY = 86_400_000;
const now = 1000 * DAY;

describe('address bar suggestions (milestone 11)', () => {
  it('completes typed text to the most visited site, then to pages once a path is typed', () => {
    const store = new Store(':memory:');
    store.recordVisit('https://www.youtube.com/', 'YouTube', now - DAY);
    store.recordVisit('https://www.youtube.com/watch?v=1', 'A video', now - DAY);
    store.recordVisit('https://www.youtube.com/watch?v=1', 'A video', now - DAY);
    store.recordVisit('https://yahoo.com/', 'Yahoo', now - DAY);
    const h = store.history;
    expect(h.suggest('y', 6, now).inline).toEqual({ key: 'youtube.com/', url: 'https://www.youtube.com/' });
    expect(h.suggest('YA', 6, now).inline).toEqual({ key: 'yahoo.com/', url: 'https://yahoo.com/' });
    expect(h.suggest('https://www.you', 6, now).inline?.key).toBe('youtube.com/');
    expect(h.suggest('youtube.com/w', 6, now).inline).toEqual({ key: 'youtube.com/watch?v=1', url: 'https://www.youtube.com/watch?v=1' });
    expect(h.suggest('zzz', 6, now).inline).toBeNull();
    expect(h.suggest('  ', 6, now)).toEqual({ inline: null, items: [] });
    // The list: the site it completes to first, then the most visited.
    expect(h.suggest('y', 6, now).items.map((i) => i.url)).toEqual([
      'https://www.youtube.com/',
      'https://www.youtube.com/watch?v=1',
      'https://yahoo.com/',
    ]);
  });

  it('completes to a site even if only its pages were visited', () => {
    const store = new Store(':memory:');
    store.recordVisit('https://example.com/docs/page', 'Docs', now);
    expect(store.history.suggest('exa', 6, now).inline).toEqual({ key: 'example.com/', url: 'https://example.com/' });
  });

  it('prefers recent visits, and lists pages whose title contains the words', () => {
    const store = new Store(':memory:');
    for (let i = 0; i < 5; i++) store.recordVisit('https://old.example/', 'Old', now - 200 * DAY);
    store.recordVisit('https://oregon.example/', 'Oregon', now - DAY);
    store.recordVisit('https://news.example/', 'Open letter', now - DAY);
    const s = store.history.suggest('o', 6, now);
    expect(s.inline?.key).toBe('oregon.example/'); // 1 recent visit beats 5 old ones
    const words = store.history.suggest('open let', 6, now);
    expect(words.items.map((i) => i.url)).toContain('https://news.example/');
  });

  it('keeps visit counts as visits come and go, and forgets an address', () => {
    const store = new Store(':memory:');
    const a = store.recordVisit('https://a.example/', 'A', now);
    store.recordVisit('https://a.example/', 'A', now);
    store.recordVisit('https://ab.example/', 'AB', now);
    expect(store.history.suggest('a', 6, now).inline?.key).toBe('a.example/');
    store.deleteVisit(a);
    // One visit each now; still listed, and the counts stay right.
    expect(store.history.suggest('a', 6, now).items).toHaveLength(2);
    store.history.forgetUrl('https://a.example/');
    expect(store.history.suggest('a', 6, now).items.map((i) => i.url)).toEqual(['https://ab.example/']);
    expect(store.recentHistory(10).map((h) => h.url)).toEqual(['https://ab.example/']);
  });

  it('keeps each address under the key the address bar looks it up by (shared/site.ts)', () => {
    // The database writes the key in SQL as a visit is recorded; typed
    // text is turned into one by siteKey. Each address is found by its own key.
    const store = new Store(':memory:');
    const visited = ['https://www.example.com/Docs/Start?q=A', 'http://www.plain.example/', 'https://shop.example:8443/cart', 'http://127.0.0.1:8123/page.html'];
    for (const url of visited) store.recordVisit(url, 'A page', now);
    for (const url of visited) {
      const found = store.history.suggest(siteKey(url), 6, now);
      expect(found.items.map((i) => i.url), url).toEqual([url]);
      expect(found.inline, url).toEqual({ key: siteKey(url), url });
    }
  });

  it('counts a site by its visits and how recent the last one was', () => {
    expect(frecency(4, now, now)).toBe(4);
    expect(frecency(4, now - 100 * DAY, now)).toBeCloseTo(0.4);
  });

  it('stays fast with 100,000 visits', () => {
    const store = new Store(':memory:');
    for (let i = 0; i < 100_000; i++) store.recordVisit(`https://site${i % 5000}.example/p/${i}`, `page ${i}`, now - (i % 90) * DAY);
    // Each keystroke asks again: the middle of five tries is what typing feels like
    // (the first call after 100,000 inserts can catch a pause of the test's own making).
    const times: number[] = [];
    let s = store.history.suggest('site1', 6, now);
    for (const text of ['site12', 'site123', 'site1234', 'site4', 'site49']) {
      const start = performance.now();
      s = store.history.suggest(text, 6, now);
      times.push(performance.now() - start);
      expect(s.inline?.key.startsWith(text)).toBe(true);
    }
    const median = [...times].sort((a, b) => a - b)[2]!;
    expect(median, `took ${times.map((t) => t.toFixed(1)).join(', ')} ms`).toBeLessThan(50);
  }, 120_000);
});
