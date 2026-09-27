import { describe, expect, it } from 'vitest';
import { Store } from './database';

describe('history index (milestone 10, GitHub issue #4)', () => {
  it('finds parts of words in addresses and titles, any case, newest first', () => {
    const store = new Store(':memory:');
    store.recordVisit('https://example.com/Alpha', 'First page', 1);
    store.recordVisit('https://news.example/b', 'Breaking NEWS today', 2);
    store.recordVisit('https://example.com/alpha', 'Second', 3);
    expect(store.searchHistory('alph', 10).map((h) => h.visitedAt)).toEqual([3, 1]);
    expect(store.searchHistory('news', 10).map((h) => h.url)).toEqual(['https://news.example/b']);
    expect(store.searchHistory('king new', 10)).toHaveLength(1); // across a space, inside words
    expect(store.searchHistory('zzz', 10)).toEqual([]);
    // Shorter than three letters: the plain search.
    expect(store.searchHistory('b', 10).map((h) => h.visitedAt)).toEqual([2]);
    // Quotes and wildcards are text.
    store.recordVisit('https://q.example/', 'say "hi" 50%', 4);
    expect(store.searchHistory('"hi"', 10)).toHaveLength(1);
    expect(store.searchHistory('50%', 10)).toHaveLength(1);
    expect(store.searchHistory('%', 10)).toHaveLength(1);
  });

  it('keeps the index current as titles change and visits go', () => {
    const store = new Store(':memory:');
    const id = store.recordVisit('https://a.example/', 'https://a.example/', 1);
    store.updateVisitTitle(id, 'Renamed page');
    expect(store.searchHistory('renamed', 10)).toHaveLength(1);
    store.deleteVisit(id);
    expect(store.searchHistory('renamed', 10)).toEqual([]);
    store.recordVisit('https://b.example/', 'Bee', 2);
    store.clearHistory();
    expect(store.searchHistory('bee', 10)).toEqual([]);
    expect(store.recentHistory(10)).toEqual([]);
  });

  it('lists each address once, at its latest visit; deleting that visit falls back to the one before', () => {
    const store = new Store(':memory:');
    store.recordVisit('https://a.example/', 'A', 1);
    const b1 = store.recordVisit('https://b.example/', 'B old', 2);
    store.recordVisit('https://a.example/', 'A again', 3);
    const b2 = store.recordVisit('https://b.example/', 'B new', 4);
    expect(store.recentHistory(10).map((h) => h.title)).toEqual(['B new', 'A again']);
    store.deleteVisit(b2);
    expect(store.recentHistory(10).map((h) => h.title)).toEqual(['A again', 'B old']);
    store.deleteVisit(b1);
    expect(store.recentHistory(10).map((h) => h.title)).toEqual(['A again']);
    expect(store.recentHistory(1)).toHaveLength(1);
  });

  it('L9: with 100,000 visits, search and the recent list each answer within 50 ms', () => {
    const store = new Store(':memory:');
    const words = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet'];
    const insert = () => {
      for (let i = 0; i < 100_000; i++) {
        const w = words[i % words.length]!;
        store.recordVisit(`https://site${i % 5000}.example/${w}/${i}`, `${w} page number ${i}`, i);
      }
    };
    insert();
    // The middle of five runs, after a warm-up: what a person's searches
    // feel like. One run alone can catch a pause of the machine's own (seen
    // on GitHub's shared test machines, milestone 12).
    const time = (fn: () => unknown) => {
      fn();
      const runs: number[] = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        fn();
        runs.push(performance.now() - start);
      }
      return runs.sort((a, b) => a - b)[2]!;
    };
    const timings = {
      searchCommon: time(() => store.searchHistory('charlie', 500)),
      searchRare: time(() => store.searchHistory('number 99999', 500)),
      searchShort: time(() => store.searchHistory('go', 500)),
      recent: time(() => store.recentHistory(8)),
      recentLong: time(() => store.recentHistory(500)),
    };
    expect(store.searchHistory('number 99999', 500)).toHaveLength(1);
    for (const [name, ms] of Object.entries(timings)) expect(ms, `${name} took ${ms.toFixed(1)} ms`).toBeLessThan(50);
  }, 120_000);
});
