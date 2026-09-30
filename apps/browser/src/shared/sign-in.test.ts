import { describe, expect, it } from 'vitest';
import { challengeKey, describeChallenge, INSECURE_SIGN_IN, MAX_REALM, parseSignInRequest, quotedRealm, signInWords, type Challenge } from './sign-in';

const PAGE = 'https://site.example/page';
const challenge = (over: Partial<Challenge> = {}): Challenge => ({
  url: 'https://site.example/private/',
  isProxy: false,
  host: 'site.example',
  port: 443,
  realm: 'Staff only',
  forNavigation: true,
  ...over,
});

describe('what a sign-in prompt says (review of 2026-09-30, M10)', () => {
  it('names the site from the address of the request, never from what the server says', () => {
    expect(describeChallenge(challenge(), PAGE)).toEqual({ asker: 'site.example', proxy: false, insecure: false, realm: 'Staff only' });
    // The port shows when it is not the scheme's own; a user name in the address does not.
    expect(describeChallenge(challenge({ url: 'http://ada@127.0.0.1:8123/private/x?y=1' }), PAGE)?.asker).toBe('127.0.0.1:8123');
    // A server that names another host is not believed.
    expect(describeChallenge(challenge({ host: 'bank.example' }), PAGE)?.asker).toBe('site.example');
  });

  it('warns when the request is not over https', () => {
    expect(describeChallenge(challenge({ url: 'http://site.example/private/' }), PAGE)?.insecure).toBe(true);
    expect(describeChallenge(challenge(), PAGE)?.insecure).toBe(false);
    expect(INSECURE_SIGN_IN).toBe("This site's connection is not private; the password can be read on the way.");
  });

  it('names a proxy by its host and port, and says it is one', () => {
    const p = describeChallenge(challenge({ isProxy: true, host: 'proxy.example', port: 3128, realm: 'Office proxy' }), PAGE);
    expect(p).toEqual({ asker: 'proxy.example:3128', proxy: true, insecure: false, realm: 'Office proxy' });
    expect(describeChallenge(challenge({ isProxy: true, host: '::1', port: 3128 }), PAGE)?.asker).toBe('[::1]:3128');
    expect(signInWords({ proxy: true })).toEqual({ before: 'The proxy ', after: ' asks for a user name and password.' });
    expect(signInWords({ proxy: false })).toEqual({ before: '', after: ' asks for a user name and password.' });
  });

  it('asks nobody for a request that is not for a web address, or for a part of a page from another site', () => {
    expect(describeChallenge(challenge({ url: 'ftp://site.example/file' }), PAGE)).toBeNull();
    expect(describeChallenge(challenge({ url: 'not an address' }), PAGE)).toBeNull();
    const picture = { url: 'https://other.example/picture.png', forNavigation: false };
    expect(describeChallenge(challenge(picture), PAGE)).toBeNull();
    // The page's own site may ask for a part; another site may ask when it is a page or frame being loaded.
    expect(describeChallenge(challenge({ url: 'https://site.example/picture.png', forNavigation: false }), PAGE)).not.toBeNull();
    expect(describeChallenge(challenge({ url: 'https://other.example/', forNavigation: true }), PAGE)?.asker).toBe('other.example');
    // A page that is not on the web (a start tab, a local HoloML file) has no site of its own.
    expect(describeChallenge(challenge({ forNavigation: false }), '')).toBeNull();
    // A proxy asks for whatever passes through it.
    expect(describeChallenge(challenge({ ...picture, isProxy: true, host: 'proxy.example', port: 3128 }), PAGE)?.proxy).toBe(true);
  });

  it('shows the realm the server gave on one line, without control characters, cut to 80 characters', () => {
    expect(quotedRealm('  Staff\r\n\tonly \u0007 ')).toBe('Staff only');
    expect(quotedRealm('')).toBe('');
    const long = 'HyperSpace 3D needs your computer password to go on. Type it below and press Sign in. '.repeat(3);
    const cut = quotedRealm(long);
    expect([...cut]).toHaveLength(MAX_REALM);
    expect(cut.endsWith('…')).toBe(true);
    expect(long.startsWith(cut.slice(0, -1))).toBe(true);
    // Exactly at the limit is left whole; characters outside the basic plane count as one each.
    expect(quotedRealm('a'.repeat(MAX_REALM))).toBe('a'.repeat(MAX_REALM));
    expect([...quotedRealm('😀'.repeat(MAX_REALM + 5))]).toHaveLength(MAX_REALM);
  });

  it('gives requests for the same sign-in the same key, and others another', () => {
    const a = describeChallenge(challenge(), PAGE)!;
    const again = describeChallenge(challenge({ url: 'https://site.example/private/picture.png', forNavigation: false }), PAGE)!;
    expect(challengeKey(again)).toBe(challengeKey(a));
    for (const other of [challenge({ realm: 'Archive' }), challenge({ url: 'http://site.example/private/' }), challenge({ url: 'https://site.example:8443/private/' })]) {
      expect(challengeKey(describeChallenge(other, PAGE)!)).not.toBe(challengeKey(a));
    }
  });
});

describe('sign-in requests from the shell', () => {
  it('are an answer with a user name and a password, or a cancel', () => {
    expect(parseSignInRequest({ op: 'answer', id: 3, username: 'ada', password: 'made-up', extra: 1 })).toEqual({ request: { op: 'answer', id: 3, username: 'ada', password: 'made-up' } });
    expect(parseSignInRequest({ op: 'answer', id: 3, username: '', password: '' })).toHaveProperty('request');
    expect(parseSignInRequest({ op: 'cancel', id: 3 })).toEqual({ request: { op: 'cancel', id: 3 } });
  });

  it('are refused when anything is missing, of the wrong kind, or too long', () => {
    const bad = [
      null,
      'answer',
      {},
      { op: 'answer', id: 0, username: 'a', password: 'b' },
      { op: 'answer', id: 1, username: 'a' },
      { op: 'answer', id: 1, username: 5, password: 'b' },
      { op: 'answer', id: 1, username: 'a'.repeat(1025), password: 'b' },
      { op: 'cancel' },
      { op: 'cancel', id: 1.5 },
      { op: 'other', id: 1 },
    ];
    for (const request of bad) expect(parseSignInRequest(request), JSON.stringify(request)).toHaveProperty('error');
  });
});
