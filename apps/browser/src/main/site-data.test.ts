import { describe, expect, it } from 'vitest';
import { cookieSite, parentSites, siteList } from './site-data';

describe('per-site storage: the site list (milestone 26, issue #26; Q5 a, Q6 a)', () => {
  it('a cookie is listed under the site it is set for, without the leading dot', () => {
    expect(cookieSite({ domain: '.Example.com' })).toBe('example.com');
    expect(cookieSite({ domain: 'shop.example.com' })).toBe('shop.example.com');
  });

  it('counts cookies and their size by host, adds open tabs, and names the listed sites above each', () => {
    const list = siteList(
      [
        { domain: '.example.com', name: 'id', value: 'abc' },
        { domain: 'shop.example.com', name: 'cart', value: '12' },
        { domain: 'shop.example.com', name: 'ü', value: '€' },
        { domain: 'other.example', name: 'x', value: '' },
      ],
      ['shop.example.com', 'news.example', 'news.example'],
    );
    expect(list).toEqual([
      { host: 'example.com', cookies: 1, cookieBytes: 5, openTabs: 0, parents: [] },
      { host: 'news.example', cookies: 0, cookieBytes: 0, openTabs: 2, parents: [] },
      { host: 'other.example', cookies: 1, cookieBytes: 1, openTabs: 0, parents: [] },
      // "ü" is 2 bytes and "€" 3 in UTF-8.
      { host: 'shop.example.com', cookies: 2, cookieBytes: 4 + 2 + 2 + 3, openTabs: 1, parents: ['example.com'] },
    ]);
  });

  it('names only listed parents, nearest first, and never a lone top-level name', () => {
    const listed = new Set(['b.example.com', 'example.com', 'com']);
    expect(parentSites('a.b.example.com', listed)).toEqual(['b.example.com', 'example.com']);
    expect(parentSites('example.com', listed)).toEqual([]);
  });
});
