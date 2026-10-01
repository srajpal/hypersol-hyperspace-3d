import { describe, expect, it } from 'vitest';
import { displayAddress, normalizeAddress, resolveInput, siteMarker } from './url';

describe('resolveInput', () => {
  it('loads web addresses', () => {
    expect(resolveInput('example.com')).toEqual({ kind: 'address', url: 'https://example.com/' });
  });

  it('searches DuckDuckGo for anything else', () => {
    expect(resolveInput('3d web browser')).toEqual({
      kind: 'search',
      url: 'https://duckduckgo.com/?q=3d%20web%20browser',
      query: '3d web browser',
    });
    expect(resolveInput('hello')!.kind).toBe('search');
    // Never runs script-like input; it becomes a search.
    expect(resolveInput('javascript:alert(1)')).toEqual({
      kind: 'search',
      url: 'https://duckduckgo.com/?q=javascript%3Aalert(1)',
      query: 'javascript:alert(1)',
    });
  });

  it('uses another search address when given one', () => {
    expect(resolveInput('a&b', 'http://127.0.0.1:9/search?q=%s')!.url).toBe('http://127.0.0.1:9/search?q=a%26b');
  });

  it('ignores empty input', () => {
    expect(resolveInput('   ')).toBeNull();
  });
});

describe('normalizeAddress', () => {
  it('keeps full web addresses', () => {
    expect(normalizeAddress('https://example.com/a?b=c')).toBe('https://example.com/a?b=c');
    expect(normalizeAddress('  http://example.com  ')).toBe('http://example.com/');
  });

  it('adds https to bare host names', () => {
    expect(normalizeAddress('wikipedia.org')).toBe('https://wikipedia.org/');
    expect(normalizeAddress('en.wikipedia.org/wiki/Web_browser')).toBe(
      'https://en.wikipedia.org/wiki/Web_browser',
    );
    expect(normalizeAddress('example.com:8443/x')).toBe('https://example.com:8443/x');
  });

  it('uses http for this machine', () => {
    expect(normalizeAddress('localhost:5173')).toBe('http://localhost:5173/');
    expect(normalizeAddress('127.0.0.1:8080/page.html')).toBe('http://127.0.0.1:8080/page.html');
  });

  it('allows the blank page', () => {
    expect(normalizeAddress('about:blank')).toBe('about:blank');
  });

  it('refuses other schemes', () => {
    expect(normalizeAddress('file:///C:/Windows/win.ini')).toBeNull();
    expect(normalizeAddress('javascript:alert(1)')).toBeNull();
    expect(normalizeAddress('chrome://gpu')).toBeNull();
    expect(normalizeAddress('mailto:someone@example.com')).toBeNull();
  });

  it('refuses things that are not addresses (search comes in milestone 2)', () => {
    expect(normalizeAddress('')).toBeNull();
    expect(normalizeAddress('   ')).toBeNull();
    expect(normalizeAddress('hello world')).toBeNull();
    expect(normalizeAddress('hello')).toBeNull();
  });
});

describe('displayAddress', () => {
  const upTo = (n: number) => (start: string) => start.length <= n;

  it('shows an address that fits as it is', () => {
    expect(displayAddress('https://example.com/a?b=1#c')).toBe('https://example.com/a?b=1#c');
    expect(displayAddress('http://127.0.0.1:8123/page.html', upTo(30))).toBe('http://127.0.0.1:8123/page.html');
    // Only the scheme and host must fit: a long path runs off the right.
    expect(displayAddress(`https://example.com/${'a'.repeat(200)}`, upTo(30))).toBe(`https://example.com/${'a'.repeat(200)}`);
  });

  it("leaves out the left of a host that does not fit, never its right", () => {
    const spoof = `https://accounts.google.com.${'a'.repeat(40)}.evil.example/signin`;
    expect(displayAddress(spoof, upTo(40))).toBe('https://…evil.example/signin');
    expect(displayAddress(spoof, upTo(80))).toBe(`https://…google.com.${'a'.repeat(40)}.evil.example/signin`);
    // The default, without a measure, keeps the end in view too.
    expect(displayAddress(spoof)).toBe('https://…evil.example/signin');
    expect(displayAddress(spoof)).not.toContain('accounts');
  });

  it("keeps the site's own name and the port however little fits", () => {
    expect(displayAddress('https://a.b.c.example.com:8443/x', upTo(1))).toBe('https://…example.com:8443/x');
    expect(displayAddress('https://login.bank.example.co.uk/x', upTo(1))).toBe('https://…example.co.uk/x');
    expect(displayAddress('https://example.com/x', upTo(1))).toBe('https://example.com/x');
  });

  it('never cuts a numeric address', () => {
    expect(displayAddress('http://192.168.100.200:8080/x', upTo(1))).toBe('http://192.168.100.200:8080/x');
    expect(displayAddress('http://[2001:db8::1]:8080/x', upTo(1))).toBe('http://[2001:db8::1]:8080/x');
  });

  it('never shows a user name or password', () => {
    expect(displayAddress('https://user:secret@example.com/a')).toBe('https://example.com/a');
    expect(displayAddress('https://user@example.com/a')).toBe('https://example.com/a');
    expect(displayAddress(`https://accounts.google.com:x@${'a'.repeat(70)}.evil.example/`)).toBe('https://…evil.example/');
  });

  it('leaves anything that is not a web address alone', () => {
    expect(displayAddress('')).toBe('');
    expect(displayAddress('about:blank')).toBe('about:blank');
    expect(displayAddress('not an address')).toBe('not an address');
  });
});

describe('siteMarker', () => {
  it('says secure only for a page that loaded over https', () => {
    expect(siteMarker('loaded', 'https://example.com/a', 'https://example.com/a')).toBe('secure');
    expect(siteMarker('loading', 'https://example.com/b', 'https://example.com/a')).toBe('secure'); // a reload, or a link on the same site
    expect(siteMarker('loaded', 'http://example.com/', 'http://example.com/')).toBe('insecure');
  });

  it('says nothing for a failed or crashed page, or a start tab', () => {
    // A certificate error: the address is https, but no page loaded.
    expect(siteMarker('failed', 'https://example.com/', '')).toBe('none');
    expect(siteMarker('failed', 'https://example.com/', 'https://example.com/')).toBe('none');
    expect(siteMarker('crashed', 'https://example.com/', 'https://example.com/')).toBe('none');
    expect(siteMarker('start', '', '')).toBe('none');
  });

  it("says nothing while another site's address is on its way in", () => {
    expect(siteMarker('loading', 'https://new.example/', '')).toBe('none');
    expect(siteMarker('loading', 'https://new.example/', 'https://old.example/')).toBe('none');
    expect(siteMarker('loading', 'http://example.com/', 'https://example.com/')).toBe('none');
    expect(siteMarker('loaded', 'about:blank', 'about:blank')).toBe('none');
  });
});
