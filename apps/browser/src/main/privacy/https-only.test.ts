import { describe, expect, it } from 'vitest';
import { HttpsOnly, httpsFor, isLocalHost } from './https-only';

describe('HTTPS-only: which addresses are upgraded (milestone 26, issue #24; Q4 a)', () => {
  it('upgrades an http:// address, keeping its path, query, and fragment, and any port but 80', () => {
    expect(httpsFor('http://example.com/a/b?x=1&y=2#top')).toBe('https://example.com/a/b?x=1&y=2#top');
    expect(httpsFor('http://example.com:80/')).toBe('https://example.com/');
    expect(httpsFor('http://example.com:8080/')).toBe('https://example.com:8080/');
    expect(httpsFor('http://user@example.com/')).toBe('https://user@example.com/');
  });

  it('leaves alone what is not http://, and what cannot have a certificate', () => {
    for (const url of ['https://example.com/', 'file:///C:/x.html', 'hypersol-file://abc/x.holoml', 'not an address']) expect(httpsFor(url), url).toBeNull();
    for (const host of ['localhost', 'app.localhost', '127.0.0.1', '127.8.9.10', '10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.1.1', '0.0.0.0', '[::1]', '[fd12::1]', '[fe80::1]', '[::ffff:7f00:1]', 'router', 'nas']) {
      expect(isLocalHost(host), host).toBe(true);
      expect(httpsFor(`http://${host}/`), host).toBeNull();
    }
    for (const host of ['example.com', '172.32.0.1', '8.8.8.8', '[2001:db8::1]', '[::ffff:808:808]', 'router.example']) expect(isLocalHost(host), host).toBe(false);
  });
});

describe('HTTPS-only: page loads', () => {
  const make = (enabled = true, lasting: string[] = []) => new HttpsOnly({ enabled: () => enabled, lasting: () => lasting });

  it('loads an http:// page over HTTPS, and knows a failure of it for an upgrade', () => {
    const h = make();
    expect(h.decide(1, 'http://example.com/a?q=1', false)).toEqual({ redirectURL: 'https://example.com/a?q=1' });
    expect(h.failedUpgrade(1, 'https://example.com/a?q=1')).toBe('http://example.com/a?q=1');
    expect(h.failedUpgrade(1, 'https://other.example/')).toBeNull();
    expect(h.failedUpgrade(2, 'https://example.com/a?q=1')).toBeNull();
    // Once the tab shows a page, the upgrade is settled.
    h.committed(1);
    expect(h.failedUpgrade(1, 'https://example.com/a?q=1')).toBeNull();
  });

  it('a redirect back to HTTP on the same site is refused, not upgraded again; to another site it is upgraded', () => {
    const h = make();
    h.decide(1, 'http://loop.example/', false);
    h.redirecting(1, 'http://loop.example/');
    expect(h.decide(1, 'http://loop.example/', false)).toEqual({ refuse: 'http://loop.example/' });
    h.decide(2, 'http://a.example/', false);
    h.redirecting(2, 'http://b.example/');
    expect(h.decide(2, 'http://b.example/', false)).toEqual({ redirectURL: 'https://b.example/' });
    // A second load of the same address that is no redirect (Retry, a click) is tried over HTTPS again.
    h.decide(3, 'http://again.example/', false);
    expect(h.decide(3, 'http://again.example/', false)).toEqual({ redirectURL: 'https://again.example/' });
  });

  it('continuing makes an exception until the browser closes; a lasting one comes from settings; off is off', () => {
    const lasting = ['always.example'];
    const h = make(true, lasting);
    expect(h.decide(1, 'http://always.example/', false)).toBeNull();
    expect(h.exception('always.example', false)).toBe('lasting');
    h.allowForSession('once.example', false);
    expect(h.exception('once.example', false)).toBe('session');
    expect(h.decide(1, 'http://once.example/', false)).toBeNull();
    expect(h.sessionHosts()).toEqual(['once.example']);
    h.removeSession('once.example', false);
    expect(h.decide(1, 'http://once.example/', false)).toEqual({ redirectURL: 'https://once.example/' });
    expect(make(false).decide(1, 'http://example.com/', false)).toBeNull();
  });

  it("private tabs keep their own exceptions, which go when the last private tab closes, and use no lasting ones", () => {
    const h = make(true, ['always.example']);
    h.allowForSession('p.example', true);
    expect(h.decide(1, 'http://p.example/', true)).toBeNull();
    expect(h.decide(2, 'http://p.example/', false)).toEqual({ redirectURL: 'https://p.example/' });
    expect(h.sessionHosts()).toEqual([]);
    expect(h.decide(1, 'http://always.example/', true)).toEqual({ redirectURL: 'https://always.example/' });
    h.forgetPrivate();
    expect(h.decide(1, 'http://p.example/', true)).toEqual({ redirectURL: 'https://p.example/' });
  });
});
