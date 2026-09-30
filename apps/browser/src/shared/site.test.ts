import { describe, expect, it } from 'vitest';
import { hostOf, siteKey } from './site';

describe('siteKey', () => {
  it('reads addresses the way people type them: no scheme, no "www.", lower case', () => {
    expect(siteKey('HTTPS://WWW.Example.com/Path')).toBe('example.com/path');
    expect(siteKey('http://example.com')).toBe('example.com');
    expect(siteKey('www.example.com/a?b=C')).toBe('example.com/a?b=c');
    expect(siteKey('exa')).toBe('exa');
  });

  it('ignores space around typed text, and leaves everything else as it is', () => {
    expect(siteKey('  example.com/ ')).toBe('example.com/');
    // Only a scheme at the start is taken off, and only one "www.".
    expect(siteKey('example.com/?u=https://www.other.example')).toBe('example.com/?u=https://www.other.example');
    expect(siteKey('https://www.www.example.com')).toBe('www.example.com');
    expect(siteKey('ftp://example.com')).toBe('ftp://example.com');
    expect(siteKey('')).toBe('');
  });

  it('gives what was typed and the address it completes to keys that start the same', () => {
    const visited = 'https://www.Example.com/docs/Start';
    for (const typed of ['ex', 'Example.com/d', 'www.example.com/docs', 'https://example.com/docs/start']) {
      expect(siteKey(visited).startsWith(siteKey(typed)), typed).toBe(true);
    }
  });
});

describe('hostOf', () => {
  it('is the host name in lower case, without the port', () => {
    expect(hostOf('https://Shop.Example:8443/cart?x=1')).toBe('shop.example');
    expect(hostOf('http://127.0.0.1:8123/page.html')).toBe('127.0.0.1');
    expect(hostOf('http://[::1]:80/')).toBe('[::1]');
  });

  it('is empty for anything that is not an address', () => {
    expect(hostOf('')).toBe('');
    expect(hostOf('example.com')).toBe('');
    expect(hostOf('about:blank')).toBe('');
  });
});
